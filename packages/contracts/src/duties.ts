export const DUTY_STATES = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
} as const;

export type DutyState =
  (typeof DUTY_STATES)[keyof typeof DUTY_STATES];
