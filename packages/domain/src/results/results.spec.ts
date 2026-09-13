import { describe, expect, it } from 'vitest';
import fixtures from '../../../../fixtures/results/result-engine-fixtures.json';
import {
  RESULT_COMPONENTS,
  RuleValidationError,
  validateResultRule,
  type GradeBandInput,
  type ResultRuleInput,
} from '../rules/index.js';
import {
  ResultInputError,
  calculateCurrentExamGpa,
  computeStudentAggregate,
  computeSubjectResult,
} from './index.js';

const gradeBands = fixtures.gradeBands as readonly GradeBandInput[];

const splitRuleInput: ResultRuleInput = {
  components: [
    { component: RESULT_COMPONENTS.INTERNAL, maximum: 40, weight: 40 },
    {
      component: RESULT_COMPONENTS.EXTERNAL,
      maximum: 60,
      weight: 60,
      minimumPassPercentage: 40,
    },
  ],
  totalPassPercentage: 40,
  gradeBands,
};

const finalRuleInput: ResultRuleInput = {
  components: [
    { component: RESULT_COMPONENTS.FINAL, maximum: 100, weight: 100 },
  ],
  totalPassPercentage: 40,
  gradeBands,
};

const splitRule = validateResultRule(splitRuleInput);
const finalRule = validateResultRule(finalRuleInput);

const fixtureCase = (id: string) => {
  const match = fixtures.cases.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Missing result fixture ${id}.`);
  return match as any;
};

describe('shared result engine fixtures', () => {
  it('R1_TWO_COMPONENT_PASS computes 74.00, PASS, and B/8', () => {
    const fixture = fixtureCase('R1_TWO_COMPONENT_PASS');
    const result = computeSubjectResult(splitRule, {
      marks: {
        INTERNAL: fixture.input.internal.value,
        EXTERNAL: fixture.input.external.value,
      },
    });

    expect(result).toMatchObject({
      rawPercentage: fixture.expected.rawPercentage,
      displayPercentage: fixture.expected.displayPercentage,
      outcome: fixture.expected.outcome,
      grade: fixture.expected.grade,
      gradePoints: fixture.expected.gradePoints,
    });
  });

  it('R2_COMPONENT_THRESHOLD_FAIL forces F/0 despite a passing total', () => {
    const fixture = fixtureCase('R2_COMPONENT_THRESHOLD_FAIL');
    const result = computeSubjectResult(splitRule, {
      marks: {
        INTERNAL: fixture.input.internal.value,
        EXTERNAL: fixture.input.external.value,
      },
    });

    expect(result).toMatchObject({
      rawPercentage: fixture.expected.rawPercentage,
      outcome: fixture.expected.outcome,
      grade: fixture.expected.grade,
      gradePoints: fixture.expected.gradePoints,
      failedComponents: ['EXTERNAL'],
    });
    expect(result.componentPercentages.EXTERNAL).toBe(
      fixture.expected.externalPercentage,
    );
  });

  it('R3_UNROUNDED_BOUNDARY_FAIL rounds only its display value', () => {
    const fixture = fixtureCase('R3_UNROUNDED_BOUNDARY_FAIL');
    const result = computeSubjectResult(finalRule, {
      marks: { FINAL: fixture.input.final.value },
    });

    expect(result).toMatchObject({
      rawPercentage: fixture.expected.rawPercentage,
      displayPercentage: fixture.expected.displayPercentage,
      outcome: fixture.expected.outcome,
      grade: fixture.expected.grade,
      gradePoints: fixture.expected.gradePoints,
    });
  });

  it('R4_ABSENT exposes no percentage or grade and contributes zero points', () => {
    const fixture = fixtureCase('R4_ABSENT');
    const result = computeSubjectResult(splitRule, {
      attendance: fixture.input.attendance,
    });

    expect(result).toMatchObject({
      outcome: fixture.expected.outcome,
      rawPercentage: fixture.expected.percentage,
      displayPercentage: null,
      percentageFraction: null,
      grade: fixture.expected.grade,
      gradePoints: fixture.expected.gradePoints,
      numericResultVisible: false,
    });
    expect(result.componentPercentages).toEqual({});
  });

  it('R5_WITHHELD takes precedence and hides every numeric result', () => {
    const fixture = fixtureCase('R5_WITHHELD');
    const result = computeSubjectResult(splitRule, {
      attendance: fixture.input.attendance,
      openStudentIncident: fixture.input.openStudentIncident,
    });

    expect(result).toMatchObject({
      outcome: fixture.expected.outcome,
      rawPercentage: fixture.expected.percentage,
      displayPercentage: null,
      percentageFraction: null,
      grade: fixture.expected.grade,
      gradePoints: null,
      numericResultVisible: fixture.expected.numericResultVisible,
    });
  });

  it('R6_GPA computes exact credit-weighted current-exam GPA', () => {
    const fixture = fixtureCase('R6_GPA');
    expect(calculateCurrentExamGpa(fixture.input)).toEqual(fixture.expected);
  });

  it('V1_PRESENT_MISSING_REQUIRED_MARK fails explicitly as incomplete input', () => {
    const fixture = fixtures.validationCases.find(
      ({ id }) => id === 'V1_PRESENT_MISSING_REQUIRED_MARK',
    )!;

    expect(fixture.expected).toMatchObject({
      resultRunAllowed: false,
      publicationAllowed: false,
      classification: 'INCOMPLETE_INPUT',
    });
    expect(() =>
      computeSubjectResult(splitRule, {
        attendance: fixture.input.attendance as 'PRESENT',
        marks: { INTERNAL: 32 },
      }),
    ).toThrowError(
      expect.objectContaining<ResultInputError>({ code: 'INCOMPLETE_INPUT' }),
    );
  });
});

describe('declarative result rule validation', () => {
  it('accepts only FINAL or INTERNAL plus EXTERNAL and freezes normalized rules', () => {
    expect(finalRule.components.map(({ component }) => component)).toEqual([
      'FINAL',
    ]);
    expect(splitRule.components.map(({ component }) => component)).toEqual([
      'INTERNAL',
      'EXTERNAL',
    ]);
    expect(Object.isFrozen(splitRule)).toBe(true);
    expect(Object.isFrozen(splitRule.components)).toBe(true);

    for (const components of [
      [],
      [{ component: RESULT_COMPONENTS.INTERNAL, maximum: 40, weight: 100 }],
      [
        { component: RESULT_COMPONENTS.FINAL, maximum: 100, weight: 50 },
        { component: RESULT_COMPONENTS.FINAL, maximum: 100, weight: 50 },
      ],
    ]) {
      expect(() =>
        validateResultRule({ ...finalRuleInput, components }),
      ).toThrowError(
        expect.objectContaining<RuleValidationError>({
          code: 'INVALID_COMPONENTS',
        }),
      );
    }
  });

  it('rejects non-positive maxima and weights that do not sum exactly to 100', () => {
    expect(() =>
      validateResultRule({
        ...finalRuleInput,
        components: [{ component: 'FINAL', maximum: 0, weight: 100 }],
      }),
    ).toThrowError(
      expect.objectContaining<RuleValidationError>({ code: 'INVALID_MAXIMUM' }),
    );

    expect(() =>
      validateResultRule({
        ...splitRuleInput,
        components: [
          { component: 'INTERNAL', maximum: 40, weight: '40.000' },
          { component: 'EXTERNAL', maximum: 60, weight: '59.999' },
        ],
      }),
    ).toThrowError(
      expect.objectContaining<RuleValidationError>({
        code: 'INVALID_WEIGHT_TOTAL',
      }),
    );
  });

  it('rejects thresholds outside 0 through 100', () => {
    expect(() =>
      validateResultRule({ ...finalRuleInput, totalPassPercentage: '100.001' }),
    ).toThrowError(
      expect.objectContaining<RuleValidationError>({ code: 'INVALID_THRESHOLD' }),
    );
    expect(() =>
      validateResultRule({
        ...splitRuleInput,
        components: [
          splitRuleInput.components[0]!,
          {
            ...splitRuleInput.components[1]!,
            minimumPassPercentage: -1,
          },
        ],
      }),
    ).toThrowError(
      expect.objectContaining<RuleValidationError>({ code: 'INVALID_THRESHOLD' }),
    );
  });

  it('rejects grade bands with gaps, overlap, invalid endpoints, or duplicate names', () => {
    const invalidBands: readonly (readonly GradeBandInput[])[] = [
      [
        { grade: 'F', minInclusive: 0, maxExclusive: 39, points: 0 },
        { grade: 'P', minInclusive: 40, maxInclusive: 100, points: 5 },
      ],
      [
        { grade: 'F', minInclusive: 0, maxExclusive: 41, points: 0 },
        { grade: 'P', minInclusive: 40, maxInclusive: 100, points: 5 },
      ],
      [
        { grade: 'F', minInclusive: 1, maxExclusive: 40, points: 0 },
        { grade: 'P', minInclusive: 40, maxInclusive: 100, points: 5 },
      ],
      [
        { grade: 'F', minInclusive: 0, maxExclusive: 40, points: 0 },
        { grade: 'F', minInclusive: 40, maxInclusive: 100, points: 5 },
      ],
    ];

    for (const bands of invalidBands) {
      expect(() =>
        validateResultRule({ ...finalRuleInput, gradeBands: bands }),
      ).toThrowError(
        expect.objectContaining<RuleValidationError>({
          code: 'INVALID_GRADE_BANDS',
        }),
      );
    }
  });
});

describe('subject input and aggregate rules', () => {
  it('rejects out-of-range, unexpected, and missing present marks', () => {
    for (const marks of [
      { INTERNAL: 32 },
      { INTERNAL: 32, EXTERNAL: 61 },
      { INTERNAL: 32, EXTERNAL: 42, FINAL: 74 },
    ]) {
      expect(() => computeSubjectResult(splitRule, { marks })).toThrowError(
        ResultInputError,
      );
    }
    expect(() =>
      computeSubjectResult(splitRule, { attendance: 'LATE' as never }),
    ).toThrowError(
      expect.objectContaining({ code: 'INVALID_ATTENDANCE' }),
    );
  });

  it('uses aggregate precedence WITHHELD, ABSENT, then FAIL', () => {
    const pass = computeSubjectResult(splitRule, {
      marks: { INTERNAL: 32, EXTERNAL: 42 },
    });
    const fail = computeSubjectResult(splitRule, {
      marks: { INTERNAL: 36, EXTERNAL: 18 },
    });
    const absent = computeSubjectResult(splitRule, { attendance: 'ABSENT' });
    const withheld = computeSubjectResult(splitRule, {
      openStudentIncident: true,
    });

    const failedAggregate = computeStudentAggregate({
      subjects: [
        { result: pass, credits: 3 },
        { result: fail, credits: 4 },
      ],
    });
    expect(failedAggregate).toMatchObject({
      outcome: 'FAIL',
      weightedPoints: 24,
      displayGpa: '3.43',
    });
    expect(
      computeStudentAggregate({
        subjects: [
          { result: fail, credits: 3 },
          { result: absent, credits: 4 },
        ],
      }).outcome,
    ).toBe('ABSENT');
    expect(
      computeStudentAggregate({
        subjects: [
          { result: absent, credits: 3 },
          { result: withheld, credits: 4 },
        ],
      }).outcome,
    ).toBe('WITHHELD');
  });

  it('suppresses an absent overall percentage but includes zero GPA points', () => {
    const pass = computeSubjectResult(splitRule, {
      marks: { INTERNAL: 32, EXTERNAL: 42 },
    });
    const absent = computeSubjectResult(splitRule, { attendance: 'ABSENT' });
    const aggregate = computeStudentAggregate({
      subjects: [
        { result: pass, credits: 3 },
        { result: absent, credits: 2 },
      ],
    });

    expect(aggregate).toMatchObject({
      outcome: 'ABSENT',
      rawPercentage: null,
      displayPercentage: null,
      weightedPoints: 24,
      totalCredits: 5,
      gpa: 4.8,
      displayGpa: '4.80',
      numericResultVisible: true,
    });
  });

  it('suppresses all aggregate numeric results when any subject is withheld', () => {
    const pass = computeSubjectResult(splitRule, {
      marks: { INTERNAL: 32, EXTERNAL: 42 },
    });
    const withheld = computeSubjectResult(splitRule, {
      openStudentIncident: true,
    });
    expect(
      computeStudentAggregate({
        subjects: [
          { result: pass, credits: 3 },
          { result: withheld, credits: 2 },
        ],
      }),
    ).toMatchObject({
      outcome: 'WITHHELD',
      rawPercentage: null,
      displayPercentage: null,
      gpa: null,
      displayGpa: null,
      weightedPoints: null,
      numericResultVisible: false,
    });
  });

  it('supports optional GPA and exact equal-subject overall percentage', () => {
    const first = computeSubjectResult(finalRule, { marks: { FINAL: 2 } });
    const second = computeSubjectResult(finalRule, { marks: { FINAL: 3 } });
    expect(
      computeStudentAggregate({
        subjects: [
          { result: first, credits: 1 },
          { result: second, credits: 1 },
        ],
        includeCurrentExamGpa: false,
      }),
    ).toMatchObject({
      outcome: 'FAIL',
      rawPercentage: 2.5,
      displayPercentage: '2.50',
      gpa: null,
      displayGpa: null,
    });
  });

  it('rejects empty/mismatched GPA input and non-positive credits', () => {
    for (const input of [
      { credits: [], gradePoints: [] },
      { credits: [3], gradePoints: [8, 10] },
      { credits: [0], gradePoints: [8] },
      { credits: [-1], gradePoints: [8] },
      { credits: [3], gradePoints: [-1] },
    ]) {
      expect(() => calculateCurrentExamGpa(input)).toThrowError(ResultInputError);
    }
  });
});
