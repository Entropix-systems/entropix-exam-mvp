# IAM Phase 1 — Security Core and Migration Handoff

Scope: contracts, pure policies, cryptographic adapters, cookie configuration,
guards/decorators, repository interfaces, and unit tests only. No IAM endpoints,
web flows, production repositories, Prisma edits, or migrations are supplied.
This records the user's Phase 1 corrections to the earlier plan.

## Contracts and permission policy

Canonical roles: PLATFORM_ADMIN, INSTITUTION_ADMIN, EXAM_CONTROLLER,
DEPARTMENT_ADMIN, FACULTY, INVIGILATOR, STUDENT, AUDITOR. No aliases are accepted
as persisted/API canonical roles. Existing database values are not rewritten here.

`AuthenticatedContext` is a discriminated union:

- TENANT: userId, tenantId, membershipId, activeRole, and grants (role + nullable departmentId).
- PLATFORM: userId and role PLATFORM_ADMIN, with no tenant/membership fields.

`RequestContext` adds requestId to that union. This intentionally replaces the old
flattened roles context. Runtime validation rejects unknown roles, malformed UUIDs,
platform grants inside tenant context, and platform contexts with tenant bindings.
DEPARTMENT_ADMIN requires a department; INSTITUTION_ADMIN is tenant-wide.

IAM permissions are fixed application policy, not editable role definitions:

| Role/context | Permissions |
| --- | --- |
| Every valid context | Read own context; manage own sessions |
| PLATFORM_ADMIN | Global user administration only in PLATFORM scope |
| INSTITUTION_ADMIN | Read/manage memberships, invitations, grants, revoke tenant sessions |
| DEPARTMENT_ADMIN | Read memberships within the specific department grant |
| Other tenant roles | Self permissions only for IAM |

A department-scoped read does not authorize listing an entire tenant. Future list
queries must filter to allowed departments. Permission AND department must match
the same grant. A FACULTY grant in department B cannot widen a DEPARTMENT_ADMIN
grant in department A. Multiple department grants are supported. Platform context
does not bypass tenant RLS. Grant replacement rejects self changes (except an
unchanged set), duplicates, foreign tenants, and platform privilege injection.
Target membership, existing grants, and resource departments must be server-loaded.
Future adapters must validate department existence and same-tenant ownership.
Last-administrator protection requires transactional persistence and remains future work.

Student ownership, examiner evaluation assignments, invigilator duty assignments,
and domain separation of duties are separate server-side requirements. This IAM
permission map does not grant access to unimplemented academic/exam operations.

## Security primitives and configuration

- Argon2PasswordHasher uses the established `argon2` library with Argon2id,
  64 MiB memory, three iterations, parallelism one, 32-byte output and random salt.
- Opaque tokens use Node crypto.randomBytes(32), base64url encoding, and SHA-256
  hash-only persistence. Random tokens do not use password hashing.
- JoseAccessTokenCodec uses `jose`, explicitly HS256, a caller-supplied random
  secret of at least 32 bytes, required issuer/audience, `at+jwt`, and required
  subject/session/kind/issued-at/expiry claims. It validates lifetime and bindings.
- JWT payloads contain identity hints, never current role authority. Browser access
  tokens are intended to remain in memory. No storage/browser implementation exists yet.
- No crypto keys or default signing secret are committed.

| Environment setting | Default seconds |
| --- | --- |
| ACCESS_TOKEN_TTL_SECONDS | 900 |
| REFRESH_TOKEN_TTL_SECONDS | 604800 |
| INVITE_TTL_SECONDS | 86400 |
| PASSWORD_RESET_TTL_SECONDS | 1800 |

Password-reset 1800 seconds is an implementation default, not an existing frozen
source requirement. No absolute-session lifetime beyond the configured session
expiry is added. Invalid lifetimes fail configuration validation.
The existing ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS and
INVITE_TTL_SECONDS names are retained; only the reset setting is new.

Cookie helper: host-only, HttpOnly, SameSite=Lax, Path=/, Secure by default, with
matching clear attributes. The Secure cookie uses the __Host- prefix. Only explicit
localDevelopment=true with environment=development permits insecure transport.
The future deployment bootstrap must set this from trusted server configuration,
never a request. Cookie-based mutation endpoints still need Origin/CSRF protection.

Library references: [node-argon2](https://github.com/ranisalt/node-argon2) and
[jose](https://github.com/panva/jose). No custom password hashing or JWT format.

## Guard integration boundary

AuthenticationGuard requires an AuthenticatedContextResolver provider. The future
provider must verify the token and consult current persistence on every request:
session binding/expiry/revocation, user status, and either active tenant/membership
plus current grants, or User.platformRole=PLATFORM_ADMIN. Only ACTIVE statuses allow
tenant access. Signing/verifying an access token does not implement these checks.

PermissionGuard requires a PermissionScopeResolver provider that loads the target's
actual scope. Missing scope/permissions deny; unknown permissions deny. A private
WeakMap holds frozen server-resolved contexts rather than accepting a request body
or request.authContext. Class and method permissions are both required.

Authenticated and RequirePermissions decorators attach guards in order. PublicRoute
marks explicit public routes for AuthenticationGuard; required permissions cannot
be bypassed by public metadata. CurrentAuthContext reads the verified context.

IdentityModule remains unbound in Phase 1: no fake provider, credentials, public
login controller, or database integration. A future Nest module must provide the
two resolver ports and guards before using these decorators. Guard tests supply
test doubles only. Health endpoints remain unchanged. Full API error-envelope
integration remains with the future endpoint/bootstrap work.

## Persistence contract for the migration owner

Interfaces live in apps/api/src/modules/identity/identity.repository.ts. No Prisma
or SQL declarations are created here. All exposed IDs are UUIDs.

Session is a global authentication record:

- id (family identifier), userId, context kind.
- Paired tenantId/membershipId for TENANT; both null for PLATFORM.
- createdAt, expiresAt, lastUsedAt, revokedAt, revocationReason.
- No refreshTokenHash: refresh credentials live solely in AuthToken.

AuthToken is a global authentication capability record:

- id, unique tokenHash, purpose INVITATION/PASSWORD_RESET/REFRESH, userId.
- Nullable sessionId, paired tenantId/membershipId, predecessorId.
- createdAt, expiresAt, consumedAt, revokedAt.
- REFRESH requires sessionId and matching user/context binding. A predecessor
  must be a refresh token in the same family; allow at most one successor.
- INVITATION requires tenant/membership binding. PASSWORD_RESET is user-global.
- Expiry indexes and session/user lookup indexes; retain consumed refresh hashes
  through family expiry for replay detection.

User gains one nullable platformRole restricted to PLATFORM_ADMIN, not a general
global-role subsystem. Existing RoleGrant needs department scope, same-tenant
department FK and null-safe scope uniqueness. Account/membership versions and
status constraints must be coordinated with the shared-domain migration.

Membership and RoleGrant stay behind FORCE RLS and withTenant(). A global token
lookup supplies routing metadata only, never general tenant query authorization.
The global auth records require restricted application access and identity-only
repository entry points; no migration/superuser runtime credentials or RLS bypass.

Future transaction implementation must lock user/session in consistent order,
atomically consume tokens and create refresh successors, and commit family
revocation on replay before returning failure (do not throw and roll it back).
Reset consumes the token, changes password, revokes reset tokens and all sessions
atomically. Suspension blocks subsequent authorization and session issuance.
Invitation acceptance must not overwrite existing credentials or reactivate a
suspended account. No production rotation/reset behavior is claimed in Phase 1.

## Protocol and remaining work

Login, refresh, logout, forgot-password, reset-password and invitation acceptance
are exempt from generic Idempotency-Key rules. Never cache/replay rotation output.
Authenticated business/admin commands retain normal version/idempotency conventions.

Migration owner handoff is needed for schema changes. After the reviewed migration
merges, implement real repositories, revocation/rotation concurrency tests, generic
login/reset failures, invitation/email integration, endpoint validation, HTTP error
envelopes, rate limiting/CSRF and browser flows in a separately authorized phase.
Do not claim A14 or complete IAM acceptance from Phase 1 unit tests.

## Build and verification

The domain package now emits ESM and declarations so Nest can consume it at runtime
without compiling source outside the API root directory. Root typecheck/test scripts
build contracts and domain first, making clean-checkout execution independent of
untracked dist output. For a focused API/domain run, first run:

```sh
pnpm --filter @entropix/domain... build
```

Required gates: contracts smoke/typecheck, domain and API unit tests, API and root
typecheck, fixture smoke and git diff --check. D0 database/storage smoke is not run
as part of this migration-free phase, and no acceptance of live IAM is implied.

## Phase 1 completion evidence

Task: D1 Identity & Access security/core, Phase 1 only.
Branch: d1-a-iam-phase1. No commit created.

Validation completed using Node 24.20.0 and pnpm 12.3.4:

- Contracts smoke and contracts typecheck: PASS.
- Domain tests: 14 PASS, including UUID casing and self-escalation regression.
- API unit tests: 21 PASS (19 IAM tests plus 2 existing health tests).
- API source and test-file typechecking: PASS.
- Domain source and test-file typechecking: PASS.
- Repository typecheck: PASS.
- Fixture smoke and API lint: PASS.
- Non-database ci:quality gate: PASS after clearing contracts/domain dist outputs;
  includes repository build/lint/tests and the existing API health E2E test.
- Final focused tests/typechecks passed after the UUID-casing correction.
- git diff --check: PASS.

The sandbox initially blocked package downloads and tsx IPC; authorized escalated
installation/test runs succeeded. An extra test-typecheck invocation used an
unsupported CLI option; it was corrected using a temporary test tsconfig and passed.
No outstanding failed code checks remain. Database/storage D0 smoke was not executed.

Dependencies: argon2 ^0.45.1 and jose ^6.2.12 in API; contracts/domain workspace
links; domain uses the existing Vitest line (^4.1.2, resolved 4.1.11). The Argon2
native install script is explicitly allowed. pnpm also reconciled optional-peer
lockfile entries; no unrelated direct dependency versions were changed.

Schema, migrations, generated Prisma code, database data and RLS remain unchanged.
Persistence adapters, real session rotation/revocation, invitation/reset/login
workflows and browser integration remain deferred. The migration owner must add
the reviewed persistence before that subsequent phase.

Files changed (repository-relative inventory):

- `.env.example`
- `apps/api/package.json`
- `apps/api/src/modules/identity/authorization/decorators.ts`
- `apps/api/src/modules/identity/authorization/guards.spec.ts`
- `apps/api/src/modules/identity/authorization/guards.ts`
- `apps/api/src/modules/identity/authorization/metadata.ts`
- `apps/api/src/modules/identity/identity.repository.ts`
- `apps/api/src/modules/identity/security/access-token.ts`
- `apps/api/src/modules/identity/security/cookie-policy.ts`
- `apps/api/src/modules/identity/security/opaque-token.ts`
- `apps/api/src/modules/identity/security/password-hasher.ts`
- `apps/api/src/modules/identity/security/security.spec.ts`
- `apps/api/src/modules/identity/security/token-policy.ts`
- `docs/D0-CONTRACT-FREEZE.md`
- `docs/codex/CONTRACTS.md`
- `docs/codex/IAM-PHASE1.md`
- `fixtures/identities/demo-identities.json`
- `package.json`
- `packages/contracts/scripts/smoke.ts`
- `packages/contracts/src/context.ts`
- `packages/contracts/src/identity.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/roles.ts`
- `packages/domain/package.json`
- `packages/domain/src/identity/context.ts`
- `packages/domain/src/identity/identity.spec.ts`
- `packages/domain/src/identity/index.ts`
- `packages/domain/src/identity/permissions.ts`
- `packages/domain/src/index.ts`
- `packages/domain/tsconfig.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `scripts/generate-d0-fixtures.mjs`
