export interface TokenPolicy {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  invitationTtlSeconds: number;
  passwordResetTtlSeconds: number;
}

export const DEFAULT_TOKEN_POLICY: Readonly<TokenPolicy> = Object.freeze({
  accessTtlSeconds: 15 * 60,
  refreshTtlSeconds: 7 * 24 * 60 * 60,
  invitationTtlSeconds: 24 * 60 * 60,
  // Implementation default, not a previously frozen product requirement.
  passwordResetTtlSeconds: 30 * 60,
});

export function tokenPolicy(
  overrides: Partial<TokenPolicy> = {},
): Readonly<TokenPolicy> {
  const policy = { ...DEFAULT_TOKEN_POLICY, ...overrides };
  for (const value of Object.values(policy)) {
    if (
      !Number.isSafeInteger(value) ||
      value <= 0 ||
      value > Math.floor(Number.MAX_SAFE_INTEGER / 1000)
    )
      throw new Error('Invalid token lifetime');
  }
  return Object.freeze(policy);
}

export function tokenPolicyFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): Readonly<TokenPolicy> {
  const read = (name: string, fallback: number) =>
    env[name] === undefined
      ? fallback
      : /^\d+$/.test(env[name]!)
        ? Number(env[name])
        : NaN;
  return tokenPolicy({
    accessTtlSeconds: read(
      'ACCESS_TOKEN_TTL_SECONDS',
      DEFAULT_TOKEN_POLICY.accessTtlSeconds,
    ),
    refreshTtlSeconds: read(
      'REFRESH_TOKEN_TTL_SECONDS',
      DEFAULT_TOKEN_POLICY.refreshTtlSeconds,
    ),
    invitationTtlSeconds: read(
      'INVITE_TTL_SECONDS',
      DEFAULT_TOKEN_POLICY.invitationTtlSeconds,
    ),
    passwordResetTtlSeconds: read(
      'PASSWORD_RESET_TTL_SECONDS',
      DEFAULT_TOKEN_POLICY.passwordResetTtlSeconds,
    ),
  });
}
