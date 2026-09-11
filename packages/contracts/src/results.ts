export const RESULT_OUTCOMES = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  ABSENT: 'ABSENT',
  WITHHELD: 'WITHHELD',
} as const;

export type ResultOutcome =
  (typeof RESULT_OUTCOMES)[keyof typeof RESULT_OUTCOMES];
