import {
  ONE_HUNDRED,
  ZERO,
  add,
  compare,
  decimal,
  equals,
  toCanonicalDecimal,
  type DecimalInput,
} from './decimal.js';

export type { DecimalInput } from './decimal.js';

export const RESULT_COMPONENTS = {
  FINAL: 'FINAL',
  INTERNAL: 'INTERNAL',
  EXTERNAL: 'EXTERNAL',
} as const;

export type ResultComponent =
  (typeof RESULT_COMPONENTS)[keyof typeof RESULT_COMPONENTS];

export interface ResultComponentRuleInput {
  readonly component: ResultComponent;
  readonly maximum: DecimalInput;
  readonly weight: DecimalInput;
  readonly minimumPassPercentage?: DecimalInput;
}

export interface GradeBandInput {
  readonly grade: string;
  readonly minInclusive: DecimalInput;
  readonly maxExclusive?: DecimalInput;
  readonly maxInclusive?: DecimalInput;
  readonly points: DecimalInput;
}

export interface ResultRuleInput {
  readonly components: readonly ResultComponentRuleInput[];
  readonly totalPassPercentage: DecimalInput;
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

export type RuleValidationErrorCode =
  | 'INVALID_COMPONENTS'
  | 'INVALID_MAXIMUM'
  | 'INVALID_WEIGHT'
  | 'INVALID_WEIGHT_TOTAL'
  | 'INVALID_THRESHOLD'
  | 'INVALID_GRADE_BANDS';

export class RuleValidationError extends Error {
  readonly name = 'RuleValidationError';

  constructor(
    readonly code: RuleValidationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const fail = (code: RuleValidationErrorCode, message: string): never => {
  throw new RuleValidationError(code, message);
};

const parseRuleDecimal = (
  value: DecimalInput,
  label: string,
  code: RuleValidationErrorCode,
) => {
  try {
    return decimal(value, label);
  } catch (error) {
    return fail(code, error instanceof Error ? error.message : `${label} is invalid.`);
  }
};

const assertPercentage = (
  value: DecimalInput,
  label: string,
  code: RuleValidationErrorCode,
) => {
  const parsed = parseRuleDecimal(value, label, code);
  if (compare(parsed, ZERO) < 0 || compare(parsed, ONE_HUNDRED) > 0) {
    fail(code, `${label} must be between 0 and 100 inclusive.`);
  }
  return parsed;
};

const validateComponentShape = (
  components: readonly ResultComponentRuleInput[],
): void => {
  const names = components.map(({ component }) => component);
  const uniqueNames = new Set(names);
  if (uniqueNames.size !== names.length) {
    fail('INVALID_COMPONENTS', 'Result components must be unique.');
  }

  const isFinal = names.length === 1 && names[0] === RESULT_COMPONENTS.FINAL;
  const isSplit =
    names.length === 2 &&
    uniqueNames.has(RESULT_COMPONENTS.INTERNAL) &&
    uniqueNames.has(RESULT_COMPONENTS.EXTERNAL);
  if (!isFinal && !isSplit) {
    fail(
      'INVALID_COMPONENTS',
      'Components must be either FINAL or INTERNAL plus EXTERNAL.',
    );
  }
};

const validateGradeBands = (
  bands: readonly GradeBandInput[],
): readonly ValidatedGradeBand[] => {
  if (bands.length === 0) {
    fail('INVALID_GRADE_BANDS', 'At least one grade band is required.');
  }

  const seenGrades = new Set<string>();
  const parsed = bands.map((band) => {
    const grade = band.grade.trim();
    if (!grade || seenGrades.has(grade)) {
      fail('INVALID_GRADE_BANDS', 'Grade names must be non-empty and unique.');
    }
    seenGrades.add(grade);

    const minimum = assertPercentage(
      band.minInclusive,
      `Grade ${grade} minimum`,
      'INVALID_GRADE_BANDS',
    );
    const hasExclusive = band.maxExclusive !== undefined;
    const hasInclusive = band.maxInclusive !== undefined;
    if (hasExclusive === hasInclusive) {
      fail(
        'INVALID_GRADE_BANDS',
        `Grade ${grade} must define exactly one maximum boundary.`,
      );
    }
    const maximum = assertPercentage(
      (band.maxExclusive ?? band.maxInclusive) as DecimalInput,
      `Grade ${grade} maximum`,
      'INVALID_GRADE_BANDS',
    );
    if (compare(minimum, maximum) >= 0) {
      fail(
        'INVALID_GRADE_BANDS',
        `Grade ${grade} minimum must be less than its maximum.`,
      );
    }

    const points = parseRuleDecimal(
      band.points,
      `Grade ${grade} points`,
      'INVALID_GRADE_BANDS',
    );
    if (compare(points, ZERO) < 0) {
      fail('INVALID_GRADE_BANDS', 'Grade points cannot be negative.');
    }

    return { band, grade, minimum, maximum, points };
  });

  const sorted = [...parsed].sort((left, right) =>
    compare(left.minimum, right.minimum),
  );
  sorted.forEach(({ band }, index) => {
    const isFinal = index === sorted.length - 1;
    if (!isFinal && band.maxExclusive === undefined) {
      fail(
        'INVALID_GRADE_BANDS',
        'Only the final grade band may have an inclusive maximum.',
      );
    }
    if (isFinal && band.maxInclusive === undefined) {
      fail('INVALID_GRADE_BANDS', 'The final grade band must include 100.');
    }
  });
  if (!equals(sorted[0]!.minimum, ZERO)) {
    fail('INVALID_GRADE_BANDS', 'Grade bands must begin at 0.');
  }
  if (!equals(sorted.at(-1)!.maximum, ONE_HUNDRED)) {
    fail('INVALID_GRADE_BANDS', 'Grade bands must end at 100 inclusive.');
  }
  for (let index = 1; index < sorted.length; index += 1) {
    if (!equals(sorted[index - 1]!.maximum, sorted[index]!.minimum)) {
      fail(
        'INVALID_GRADE_BANDS',
        'Grade bands must cover 0 through 100 without gaps or overlap.',
      );
    }
  }

  return Object.freeze(
    sorted.map(({ band, grade, minimum, maximum, points }, index) =>
      Object.freeze({
        grade,
        minInclusive: toCanonicalDecimal(minimum),
        maxExclusive:
          index < sorted.length - 1 ? toCanonicalDecimal(maximum) : null,
        maxInclusive:
          index === sorted.length - 1 ? toCanonicalDecimal(maximum) : null,
        points: toCanonicalDecimal(points),
      }),
    ),
  );
};

export const validateResultRule = (
  input: ResultRuleInput,
): ValidatedResultRule => {
  validateComponentShape(input.components);

  let weightTotal = ZERO;
  const components = input.components.map((component) => {
    const maximum = parseRuleDecimal(
      component.maximum,
      `${component.component} maximum`,
      'INVALID_MAXIMUM',
    );
    if (compare(maximum, ZERO) <= 0) {
      fail('INVALID_MAXIMUM', `${component.component} maximum must be positive.`);
    }

    const weight = parseRuleDecimal(
      component.weight,
      `${component.component} weight`,
      'INVALID_WEIGHT',
    );
    if (compare(weight, ZERO) <= 0 || compare(weight, ONE_HUNDRED) > 0) {
      fail(
        'INVALID_WEIGHT',
        `${component.component} weight must be greater than 0 and at most 100.`,
      );
    }
    weightTotal = add(weightTotal, weight);

    const minimumPassPercentage =
      component.minimumPassPercentage === undefined
        ? null
        : assertPercentage(
            component.minimumPassPercentage,
            `${component.component} pass percentage`,
            'INVALID_THRESHOLD',
          );

    return Object.freeze({
      component: component.component,
      maximum: toCanonicalDecimal(maximum),
      weight: toCanonicalDecimal(weight),
      minimumPassPercentage:
        minimumPassPercentage === null
          ? null
          : toCanonicalDecimal(minimumPassPercentage),
    });
  });

  if (!equals(weightTotal, ONE_HUNDRED)) {
    fail('INVALID_WEIGHT_TOTAL', 'Component weights must sum exactly to 100.');
  }

  const totalPassPercentage = assertPercentage(
    input.totalPassPercentage,
    'Total pass percentage',
    'INVALID_THRESHOLD',
  );

  return Object.freeze({
    kind: 'VALIDATED_RESULT_RULE',
    components: Object.freeze(components),
    totalPassPercentage: toCanonicalDecimal(totalPassPercentage),
    gradeBands: validateGradeBands(input.gradeBands),
  });
};
