import { Inject, Injectable } from '@nestjs/common';
import { AUTH_CLOCK } from '../application/auth.service.js';
import {
  AuthenticatedContextResolver,
  CurrentAuthorityRepository,
  type AuthenticatedPrincipal,
} from '../identity.repository.js';
import { AccessTokenCodec } from '../security/access-token.js';

@Injectable()
export class PersistentAuthenticatedContextResolver extends AuthenticatedContextResolver {
  constructor(
    private readonly accessTokens: AccessTokenCodec,
    private readonly authority: CurrentAuthorityRepository,
    @Inject(AUTH_CLOCK) private readonly clock: () => Date,
  ) {
    super();
  }

  async resolveAccessToken(
    rawAccessToken: string,
  ): Promise<AuthenticatedPrincipal | null> {
    let identity;
    try {
      identity = await this.accessTokens.verify(rawAccessToken);
    } catch {
      return null;
    }
    const context = await this.authority.resolveCurrentAuthority(
      identity,
      this.clock(),
    );
    return context ? { identity, context } : null;
  }
}
