import { randomUUID } from 'node:crypto';
import type {
  AuthenticatedContext,
  CreateInvitationRequest,
  MembershipDirectoryResponse,
  ScopedRoleGrant,
  UUID,
} from '@entropix/contracts';
import { MAX_CURSOR_PAGE_SIZE } from '@entropix/contracts';
import { isScopedRoleGrant, isUuid } from '@entropix/domain';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IdentityAdminRepository } from '../identity.repository.js';
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from '../security/opaque-token.js';
import {
  DEFAULT_TOKEN_POLICY,
  type TokenPolicy,
} from '../security/token-policy.js';
import { AUTH_CLOCK } from './auth.service.js';
import { IdentityNotificationSender } from './identity-notifications.js';

export const IDENTITY_ADMIN_CONFIGURATION = Symbol(
  'identity.admin-configuration',
);

export interface IdentityAdminConfiguration {
  invitationUrl: string;
  tokenPolicy?: Readonly<TokenPolicy>;
}

function normalizedEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) &&
    normalized.length <= 320
    ? normalized
    : null;
}

function normalizedName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  return normalized.length >= 1 && normalized.length <= 160 ? normalized : null;
}

function checkedGrants(value: unknown): readonly ScopedRoleGrant[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every(isScopedRoleGrant)
  )
    throw new UnprocessableEntityException('Role grants are invalid');
  const grants = value.map((grant) => ({
    role: grant.role,
    departmentId: grant.departmentId?.toLowerCase() ?? null,
  }));
  if (grants.some((grant) => grant.role === 'DEPARTMENT_ADMIN'))
    throw new UnprocessableEntityException(
      'Department Admin requires a department supplied by M01 Academics',
    );
  const keys = grants.map(
    (grant) => `${grant.role}:${grant.departmentId ?? '*'}`,
  );
  if (new Set(keys).size !== keys.length)
    throw new UnprocessableEntityException('Role grants contain duplicates');
  return grants;
}

function tenantContext(context: AuthenticatedContext) {
  if (context.kind !== 'TENANT')
    throw new ForbiddenException('Permission denied');
  return context;
}

function checkedMembershipId(value: string): UUID {
  if (!isUuid(value)) throw new NotFoundException('Membership not found');
  return value;
}

@Injectable()
export class IdentityAdminService {
  private readonly invitationUrl: URL;
  private readonly policy: Readonly<TokenPolicy>;

  constructor(
    private readonly repository: IdentityAdminRepository,
    private readonly notifications: IdentityNotificationSender,
    @Inject(IDENTITY_ADMIN_CONFIGURATION)
    configuration: IdentityAdminConfiguration,
    @Inject(AUTH_CLOCK) private readonly clock: () => Date,
  ) {
    this.invitationUrl = new URL(configuration.invitationUrl);
    this.policy = configuration.tokenPolicy ?? DEFAULT_TOKEN_POLICY;
  }

  async list(
    context: AuthenticatedContext,
    cursorValue: unknown,
    pageSizeValue: unknown,
  ): Promise<MembershipDirectoryResponse> {
    const tenant = tenantContext(context);
    const cursor =
      cursorValue === undefined || cursorValue === ''
        ? null
        : typeof cursorValue === 'string' && isUuid(cursorValue)
          ? cursorValue.toLowerCase()
          : (() => {
              throw new UnprocessableEntityException('Membership cursor is invalid');
            })();
    const parsedPageSize =
      pageSizeValue === undefined || pageSizeValue === ''
        ? 25
        : typeof pageSizeValue === 'string' && /^\d+$/.test(pageSizeValue)
          ? Number(pageSizeValue)
          : Number.NaN;
    if (
      !Number.isSafeInteger(parsedPageSize) ||
      parsedPageSize < 1 ||
      parsedPageSize > MAX_CURSOR_PAGE_SIZE
    )
      throw new UnprocessableEntityException('Membership page size is invalid');
    const directory = await this.repository.listMemberships(
      tenant.tenantId,
      parsedPageSize,
      cursor,
    );
    if (!directory) throw new NotFoundException('Membership page not found');
    return {
      institutionName: directory.institutionName,
      departments: directory.departments,
      pageSize: parsedPageSize,
      memberships: {
        items: directory.memberships.items.map(
          ({ userId: _userId, ...membership }) => membership,
        ),
        nextCursor: directory.memberships.nextCursor,
      },
    };
  }

  async invite(context: AuthenticatedContext, input: CreateInvitationRequest) {
    const tenant = tenantContext(context);
    const name = normalizedName(input.name);
    if (!name) throw new UnprocessableEntityException('Name is invalid');
    const email = normalizedEmail(input.email);
    if (!email) throw new UnprocessableEntityException('Email is invalid');
    const grants = checkedGrants(input.grants);
    const now = this.clock();
    const rawToken = generateOpaqueToken();
    const result = await this.repository.createInvitation({
      tenantId: tenant.tenantId,
      actorMembershipId: tenant.membershipId,
      name,
      email,
      grants,
      invitationTokenId: randomUUID(),
      invitationTokenHash: hashOpaqueToken(rawToken),
      now,
      expiresAt: new Date(
        now.getTime() + this.policy.invitationTtlSeconds * 1000,
      ),
    });
    if (result.kind !== 'CREATED')
      throw new ConflictException('Identity cannot be invited');

    const link = new URL(this.invitationUrl);
    link.searchParams.set('token', rawToken);
    try {
      await this.notifications.send({
        to: email,
        subject: 'You are invited to Examination ERP',
        text: `Use this one-time link to accept your invitation: ${link.toString()}`,
        category: 'INVITATION',
      });
    } catch {
      // Invitation persistence is authoritative; delivery remains retryable externally.
    }
    return { invited: true as const, membership: result.membership };
  }

  async replaceRoleGrants(
    context: AuthenticatedContext,
    membershipIdValue: string,
    grantsValue: unknown,
    expectedVersionValue: unknown,
  ) {
    const tenant = tenantContext(context);
    const membershipId = checkedMembershipId(membershipIdValue);
    const grants = checkedGrants(grantsValue);
    const expectedVersion =
      expectedVersionValue === undefined
        ? null
        : Number.isSafeInteger(expectedVersionValue) &&
            (expectedVersionValue as number) > 0
          ? (expectedVersionValue as number)
          : (() => {
              throw new UnprocessableEntityException(
                'Expected version is invalid',
              );
            })();
    const result = await this.repository.replaceRoleGrants({
      tenantId: tenant.tenantId,
      actorUserId: tenant.userId,
      actorMembershipId: tenant.membershipId,
      membershipId,
      grants,
      expectedVersion,
    });
    return this.unwrap(result);
  }

  async setActive(
    context: AuthenticatedContext,
    membershipIdValue: string,
    active: boolean,
  ) {
    const tenant = tenantContext(context);
    const result = await this.repository.setMembershipActive(
      tenant.tenantId,
      tenant.membershipId,
      checkedMembershipId(membershipIdValue),
      active,
      this.clock(),
    );
    return this.unwrap(result);
  }

  private unwrap(
    result: Awaited<ReturnType<IdentityAdminRepository['setMembershipActive']>>,
  ) {
    if (result.kind === 'UPDATED') return result.membership;
    if (result.kind === 'NOT_FOUND')
      throw new NotFoundException('Membership not found');
    if (result.kind === 'VERSION_CONFLICT')
      throw new ConflictException('Membership version is stale');
    if (result.kind === 'FORBIDDEN')
      throw new ForbiddenException('Membership change is not allowed');
    throw new UnprocessableEntityException('Membership state is not eligible');
  }
}
