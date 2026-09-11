export const REGISTRATION_MODES = {
  AUTO_ENROL: 'AUTO_ENROL',
  APPLICATION: 'APPLICATION',
} as const;

export type RegistrationMode =
  (typeof REGISTRATION_MODES)[keyof typeof REGISTRATION_MODES];

export const REGISTRATION_STATES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type RegistrationState =
  (typeof REGISTRATION_STATES)[keyof typeof REGISTRATION_STATES];
