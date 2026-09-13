import type { CookieOptions } from 'express';
import { tokenPolicy } from './token-policy.js';

export interface RefreshCookieConfiguration {
  environment: 'development' | 'test' | 'production';
  /** Explicit opt-in, permitted only for a local development server. */
  localDevelopment?: boolean;
  refreshTtlSeconds?: number;
}

export function refreshCookiePolicy(config: RefreshCookieConfiguration): {
  name: string;
  options: CookieOptions;
  clearOptions: CookieOptions;
} {
  if (
    !['development', 'test', 'production'].includes(config.environment) ||
    (config.localDevelopment && config.environment !== 'development')
  )
    throw new Error('Invalid cookie environment');
  const secure = !(
    config.environment === 'development' && config.localDevelopment === true
  );
  const ttl = tokenPolicy(
    config.refreshTtlSeconds === undefined
      ? {}
      : { refreshTtlSeconds: config.refreshTtlSeconds },
  ).refreshTtlSeconds;
  const base: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  };
  return {
    name: secure ? '__Host-iam-refresh' : 'iam-refresh',
    options: { ...base, maxAge: ttl * 1000 },
    clearOptions: { ...base },
  };
}
