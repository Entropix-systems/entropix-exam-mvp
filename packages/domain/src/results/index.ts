import { RESULT_OUTCOMES, type ResultOutcome } from '@entropix/contracts';
import {
  ONE_HUNDRED,
  ZERO,
  add,
  compare,
  decimal,
  divide,
  formatHalfUp,
  multiply,
  toNumber,
  type Decimal,
} from '../rules/decimal.js';
import type {
  DecimalInput,
  ResultComponent,
  ValidatedGradeBand,
  ValidatedResultRule,
} from '../rules/index.js';

export type ResultInputErrorCode =
  | 'INVALID_ATTENDANCE'
  | 'INCOMPLETE_INPUT'
  | 'INVALID_MARK'
  | 'INVALID_CREDITS'
  | 'INVALID_GRADE_POINTS'
  | 'INVALID_AGGREGATE';

export class ResultInputError extends Error {
  readonly name = 'ResultInputError';

  constructor(
    readonly code: ResultInputErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface SubjectResultInput {
  readonly attendance?: 'PRESENT' | 'ABSENT';
  readonly openStudentIncident?: boolean;
  readonly marks?: Readonly<
    Partial<Record<ResultComponent, DecimalInput | null | undefined>>
  >;
}

export interface SubjectResult {
  readonly outcome: ResultOutcome;
  readonly rawPercentage: number | null;
  readonly displayPercentage: string | null;
  readonly percentageFraction: Readonly<{
    readonly numerator: string;
    readonly denominator: string;
  }> | null;
  readonly componentPercentages: Readonly<
    Partial<Record<ResultComponent, number>>
  >;
  readonly grade: string | null;
  readonly gradePoints: number | null;
  readonly failedComponents: readonly ResultComponent[];
  readonly numericResultVisible: boolean;
}

export interface CurrentExamGpaInput {
  readonly credits: readonly DecimalInput[];
  readonly gradePoints: readonly DecimalInput[];
}

export interface CurrentExamGpa {
  readonly weightedPoints: number;
  readonly totalCredits: number;
  readonly gpa: number;
  readonly displayGpa: string;
}

export interface AggregateSubjectInput {
  readonly result: SubjectResult;
  readonly credits: DecimalInput;
}

export interface StudentAggregateInput {
  readonly subjects: readonly AggregateSubjectInput[];
  readonly includeCurrentExamGpa?: boolean;
}

export interface StudentAggregateResult {
  readonly outcome: ResultOutcome;
  readonly rawPercentage: number | null;
  readonly displayPercentage: string | null;
  readonly gpa: number | null;
  readonly displayGpa: string | null;
  readonly totalCredits: number;
  readonly weightedPoints: number | null;
  readonly numericResultVisible: boolean;
}

const fail = (code: ResultInputErrorCode, message: string): never => {
  throw new ResultInputError(code, message);
};

const parseInputDecimal = (
  value: DecimalInput,
  label: string,
  code: ResultInputErrorCode,
): Decimal => {
  try {
    return decimal(value, label);
  } catch (error) {
    return fail(code, error instanceof Error ? error.message : `${label} is invalid.`);
  }
};

const hiddenSubjectResult = (
  outcome: typeof RESULT_OUTCOMES.ABSENT | typeof RESULT_OUTCOMES.WITHHELD,
): SubjectResult =>
  Object.freeze({
    outcome,
    rawPercentage: null,
    displayPercentage: null,
    percentageFraction: null,
    componentPercentages: Object.freeze({}),
    grade: null,
    gradePoints: outcome === RESULT_OUTCOMES.ABSENT ? 0 : null,
    failedComponents: Object.freeze([]),
    numericResultVisible: false,
  });

const findGradeBand = (
  bands: readonly ValidatedGradeBand[],
  percentage: Decimal,
): ValidatedGradeBand => {
  const match = bands.find((band) => {
    const minimum = decimal(band.minInclusive, 'Grade band minimum');
    const maximum = decimal(
      band.maxExclusive ?? band.maxInclusive!,
      'Grade band maximum',
    );
    const belowMaximum =
      band.maxExclusive === null
        ? compare(percentage, maximum) <= 0
        : compare(percentage, maximum) < 0;
    return compare(percentage, minimum) >= 0 && belowMaximum;
  });
  if (!match) {
    return fail(
      'INVALID_AGGREGATE',
      'Validated grade bands do not cover the computed percentage.',
    );
  }
  return match;
};

export const computeSubjectResult = (
  rule: ValidatedResultRule,
  input: SubjectResultInput,
): SubjectResult => {
  const attendance = input.attendance ?? 'PRESENT';
  if (attendance !== 'PRESENT' && attendance !== 'ABSENT') {
    fail('INVALID_ATTENDANCE', 'Attendance must be PRESENT or ABSENT.');
  }
  if (input.openStudentIncident === true) {
    return hiddenSubjectResult(RESULT_OUTCOMES.WITHHELD);
  }
  if (attendance === 'ABSENT') {
    return hiddenSubjectResult(RESULT_OUTCOMES.ABSENT);
  }

  const expectedComponents = new Set(
    rule.components.map(({ component }) => component),
  );
  for (const suppliedComponent of Object.keys(input.marks ?? {})) {
    if (!expectedComponents.has(suppliedComponent as ResultComponent)) {
      fail(
        'INVALID_MARK',
        `Mark supplied for unexpected component ${suppliedComponent}.`,
      );
    }
  }

  let totalPercentage = ZERO;
  const componentPercentages: Partial<Record<ResultComponent, number>> = {};
  const failedComponents: ResultComponent[] = [];

  for (const componentRule of rule.components) {
    const markInput =
      input.marks?.[componentRule.component] ??
      fail(
        'INCOMPLETE_INPUT',
        `Present student is missing required ${componentRule.component} marks.`,
      );

    const mark = parseInputDecimal(
      markInput,
      `${componentRule.component} mark`,
      'INVALID_MARK',
    );
    const maximum = decimal(
      componentRule.maximum,
      `${componentRule.component} maximum`,
    );
    if (compare(mark, ZERO) < 0 || compare(mark, maximum) > 0) {
      fail(
        'INVALID_MARK',
        `${componentRule.component} mark must be between 0 and ${componentRule.maximum}.`,
      );
    }

    const componentPercentage = multiply(divide(mark, maximum), ONE_HUNDRED);
    componentPercentages[componentRule.component] = toNumber(componentPercentage);
    totalPercentage = add(
      totalPercentage,
      multiply(
        componentPercentage,
        divide(decimal(componentRule.weight, 'Component weight'), ONE_HUNDRED),
      ),
    );

    if (
      componentRule.minimumPassPercentage !== null &&
      compare(
        componentPercentage,
        decimal(componentRule.minimumPassPercentage, 'Component threshold'),
      ) < 0
    ) {
      failedComponents.push(componentRule.component);
    }
  }

  const totalFailed =
    compare(
      totalPercentage,
      decimal(rule.totalPassPercentage, 'Total pass percentage'),
    ) < 0;
  const passed = !totalFailed && failedComponents.length === 0;
  const band = passed
    ? findGradeBand(rule.gradeBands, totalPercentage)
    : rule.gradeBands[0]!;

  return Object.freeze({
    outcome: passed ? RESULT_OUTCOMES.PASS : RESULT_OUTCOMES.FAIL,
    rawPercentage: toNumber(totalPercentage),
    displayPercentage: formatHalfUp(totalPercentage),
    percentageFraction: Object.freeze({
      numerator: totalPercentage.numerator.toString(),
      denominator: totalPercentage.denominator.toString(),
    }),
    componentPercentages: Object.freeze(componentPercentages),
    grade: band.grade,
    gradePoints: passed ? toNumber(decimal(band.points, 'Grade points')) : 0,
    failedComponents: Object.freeze(failedComponents),
    numericResultVisible: true,
  });
};

export const calculateCurrentExamGpa = (
  input: CurrentExamGpaInput,
): CurrentExamGpa => {
  if (
    input.credits.length === 0 ||
    input.credits.length !== input.gradePoints.length
  ) {
    fail(
      'INVALID_AGGREGATE',
      'Credits and grade points must be non-empty arrays of equal length.',
    );
  }

  let totalCredits = ZERO;
  let weightedPoints = ZERO;
  input.credits.forEach((creditInput, index) => {
    const credits = parseInputDecimal(
      creditInput,
      `Credits at index ${index}`,
      'INVALID_CREDITS',
    );
    if (compare(credits, ZERO) <= 0) {
      fail('INVALID_CREDITS', 'Credits must be positive.');
    }
    const points = parseInputDecimal(
      input.gradePoints[index]!,
      `Grade points at index ${index}`,
      'INVALID_GRADE_POINTS',
    );
    if (compare(points, ZERO) < 0) {
      fail('INVALID_GRADE_POINTS', 'Grade points cannot be negative.');
    }
    totalCredits = add(totalCredits, credits);
    weightedPoints = add(weightedPoints, multiply(credits, points));
  });

  const gpa = divide(weightedPoints, totalCredits);
  return Object.freeze({
    weightedPoints: toNumber(weightedPoints),
    totalCredits: toNumber(totalCredits),
    gpa: toNumber(gpa),
    displayGpa: formatHalfUp(gpa),
  });
};

const aggregateOutcome = (subjects: readonly AggregateSubjectInput[]) => {
  const outcomes = new Set(subjects.map(({ result }) => result.outcome));
  if (outcomes.has(RESULT_OUTCOMES.WITHHELD)) return RESULT_OUTCOMES.WITHHELD;
  if (outcomes.has(RESULT_OUTCOMES.ABSENT)) return RESULT_OUTCOMES.ABSENT;
  if (outcomes.has(RESULT_OUTCOMES.FAIL)) return RESULT_OUTCOMES.FAIL;
  return RESULT_OUTCOMES.PASS;
};

export const computeStudentAggregate = (
  input: StudentAggregateInput,
): StudentAggregateResult => {
  if (input.subjects.length === 0) {
    fail('INVALID_AGGREGATE', 'At least one subject result is required.');
  }

  const outcome = aggregateOutcome(input.subjects);
  const credits: DecimalInput[] = [];
  const gradePoints: DecimalInput[] = [];
  let totalCredits = ZERO;
  let percentageTotal = ZERO;
  let percentageCount = 0;

  input.subjects.forEach(({ result, credits: creditInput }, index) => {
    const credit = parseInputDecimal(
      creditInput,
      `Credits at index ${index}`,
      'INVALID_CREDITS',
    );
    if (compare(credit, ZERO) <= 0) {
      fail('INVALID_CREDITS', 'Credits must be positive.');
    }
    totalCredits = add(totalCredits, credit);
    credits.push(creditInput);

    if (result.outcome === RESULT_OUTCOMES.WITHHELD) {
      gradePoints.push(0);
    } else {
      gradePoints.push(result.gradePoints ?? 0);
    }

    if (result.rawPercentage !== null) {
      const exactPercentage = result.percentageFraction
        ? divide(
            decimal(result.percentageFraction.numerator, 'Percentage numerator'),
            decimal(result.percentageFraction.denominator, 'Percentage denominator'),
          )
        : parseInputDecimal(
            result.rawPercentage,
            `Subject percentage at index ${index}`,
            'INVALID_AGGREGATE',
          );
      percentageTotal = add(
        percentageTotal,
        exactPercentage,
      );
      percentageCount += 1;
    }
  });

  if (outcome === RESULT_OUTCOMES.WITHHELD) {
    return Object.freeze({
      outcome,
      rawPercentage: null,
      displayPercentage: null,
      gpa: null,
      displayGpa: null,
      totalCredits: toNumber(totalCredits),
      weightedPoints: null,
      numericResultVisible: false,
    });
  }

  const percentage =
    outcome === RESULT_OUTCOMES.ABSENT
      ? null
      : divide(percentageTotal, decimal(percentageCount, 'Subject count'));
  const gpa =
    input.includeCurrentExamGpa === false
      ? null
      : calculateCurrentExamGpa({ credits, gradePoints });

  return Object.freeze({
    outcome,
    rawPercentage: percentage === null ? null : toNumber(percentage),
    displayPercentage: percentage === null ? null : formatHalfUp(percentage),
    gpa: gpa?.gpa ?? null,
    displayGpa: gpa?.displayGpa ?? null,
    totalCredits: toNumber(totalCredits),
    weightedPoints: gpa?.weightedPoints ?? null,
    numericResultVisible: true,
  });
};
