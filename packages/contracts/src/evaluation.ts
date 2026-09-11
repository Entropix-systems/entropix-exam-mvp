export const ATTENDANCE_STATES = {
  NOT_MARKED: 'NOT_MARKED',
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
} as const;

export type AttendanceState =
  (typeof ATTENDANCE_STATES)[keyof typeof ATTENDANCE_STATES];

export const MARK_COMPONENTS = {
  FINAL: 'FINAL',
  INTERNAL: 'INTERNAL',
  EXTERNAL: 'EXTERNAL',
} as const;

export type MarkComponent =
  (typeof MARK_COMPONENTS)[keyof typeof MARK_COMPONENTS];

export const MARKS_BATCH_STATES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  RETURNED: 'RETURNED',
} as const;

export type MarksBatchState =
  (typeof MARKS_BATCH_STATES)[keyof typeof MARKS_BATCH_STATES];
