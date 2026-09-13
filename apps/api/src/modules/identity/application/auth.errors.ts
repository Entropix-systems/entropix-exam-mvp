export type AuthErrorKind = 'UNAUTHENTICATED' | 'VALIDATION';

export class AuthApplicationError extends Error {
  constructor(
    readonly kind: AuthErrorKind,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'AuthApplicationError';
  }
}

export const invalidCredentials = () =>
  new AuthApplicationError('UNAUTHENTICATED', 'Invalid credentials');
export const invalidSession = () =>
  new AuthApplicationError('UNAUTHENTICATED', 'Session is not valid');
export const invalidRecoveryToken = () =>
  new AuthApplicationError('UNAUTHENTICATED', 'Recovery link is not valid');
export const invalidInvitation = () =>
  new AuthApplicationError('UNAUTHENTICATED', 'Invitation link is not valid');

