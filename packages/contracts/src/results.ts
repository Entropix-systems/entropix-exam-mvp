export const RESULT_OUTCOMES = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  ABSENT: 'ABSENT',
  WITHHELD: 'WITHHELD',
} as const;

export type ResultOutcome =
  (typeof RESULT_OUTCOMES)[keyof typeof RESULT_OUTCOMES];

export type ResultRuleDecimalInput = number | string;

export const RESULT_COMPONENTS = {
  FINAL: 'FINAL',
  INTERNAL: 'INTERNAL',
  EXTERNAL: 'EXTERNAL',
} as const;

export type ResultComponent =
  (typeof RESULT_COMPONENTS)[keyof typeof RESULT_COMPONENTS];

export interface ResultComponentRuleInput {
  readonly component: ResultComponent;
  readonly maximum: ResultRuleDecimalInput;
  readonly weight: ResultRuleDecimalInput;
  readonly minimumPassPercentage?: ResultRuleDecimalInput;
}

export interface GradeBandInput {
  readonly grade: string;
  readonly minInclusive: ResultRuleDecimalInput;
  readonly maxExclusive?: ResultRuleDecimalInput;
  readonly maxInclusive?: ResultRuleDecimalInput;
  readonly points: ResultRuleDecimalInput;
}

export interface ResultRuleInput {
  readonly components: readonly ResultComponentRuleInput[];
  readonly totalPassPercentage: ResultRuleDecimalInput;
  readonly gradeBands: readonly GradeBandInput[];
}

export interface ValidatedResultComponentRule {
  readonly component: ResultComponent;
  readonly maximum: string;
  readonly weight: string;
  readonly minimumPassPercentage: string | null;
}

export interface ValidatedGradeBand {
  readonly grade: string;
  readonly minInclusive: string;
  readonly maxExclusive: string | null;
  readonly maxInclusive: string | null;
  readonly points: string;
}

export interface ValidatedResultRule {
  readonly kind: 'VALIDATED_RESULT_RULE';
  readonly components: readonly ValidatedResultComponentRule[];
  readonly totalPassPercentage: string;
  readonly gradeBands: readonly ValidatedGradeBand[];
}
