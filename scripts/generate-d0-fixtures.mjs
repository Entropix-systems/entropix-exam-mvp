import fs from 'node:fs';
import path from 'node:path';

function ensure(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, value) {
  fs.writeFileSync(
    file,
    JSON.stringify(value, null, 2) + '\n',
  );
}

function csvEscape(value) {
  const s = String(value ?? '');

  if (
    s.includes(',') ||
    s.includes('"') ||
    s.includes('\n')
  ) {
    return `"${s.replaceAll('"', '""')}"`;
  }

  return s;
}

function writeCsv(file, headers, rows) {
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) =>
        csvEscape(row[header]),
      ).join(','),
    ),
  ];

  fs.writeFileSync(file, lines.join('\n') + '\n');
}

ensure('fixtures/tenants');
ensure('fixtures/imports');
ensure('fixtures/results');
ensure('fixtures/identities');

/*
 * --------------------------------------------------------------------------
 * NORTHSTAR COLLEGE
 *
 * Implementation fixture choice:
 * - college/application mode
 * - Semester 3
 * - documented 40% internal / 60% external example
 * --------------------------------------------------------------------------
 */

const northstarSubjects = [
  {
    code: 'CS301',
    name: 'Data Structures',
    credits: 3,
  },
  {
    code: 'MA301',
    name: 'Discrete Mathematics',
    credits: 4,
  },
  {
    code: 'EN301',
    name: 'Technical Communication',
    credits: 3,
  },
];

const northstarFaculty = [
  {
    code: 'NSF001',
    name: 'Ananya Iyer',
    email: 'ananya.iyer@northstar.example.test',
    departmentCodes: ['CSE'],
  },
  {
    code: 'NSF002',
    name: 'Ravi Menon',
    email: 'ravi.menon@northstar.example.test',
    departmentCodes: ['MATH'],
  },
  {
    code: 'NSF003',
    name: 'Meera Shah',
    email: 'meera.shah@northstar.example.test',
    departmentCodes: ['ENGLISH'],
  },

  // Required fixture:
  // faculty member carrying two department scopes.
  {
    code: 'NSF004',
    name: 'Dev Kumar',
    email: 'dev.kumar@northstar.example.test',
    departmentCodes: ['CSE', 'MATH'],
  },
];

const northstar = {
  fixtureVersion: 1,

  tenant: {
    name: 'Northstar College',
    slug: 'northstar-college',
    timezone: 'Asia/Kolkata',
    mode: 'APPLICATION',
  },

  academicStructure: {
    campus: {
      code: 'MAIN',
      name: 'Main Campus',
    },

    academicYear: {
      code: 'AY2026',
      name: '2026-27',
    },

    term: {
      code: 'SEM3',
      name: 'Semester 3',
    },

    cohort: {
      code: 'BSC-CS-S3',
      name: 'BSc Computer Science Semester 3',
    },

    departments: [
      {
        code: 'CSE',
        name: 'Computer Science',
      },
      {
        code: 'MATH',
        name: 'Mathematics',
      },
      {
        code: 'ENGLISH',
        name: 'English',
      },
    ],

    program: {
      code: 'BSC-CS',
      name: 'BSc Computer Science',
    },

    subjects: northstarSubjects,
  },

  faculty: northstarFaculty,

  exam: {
    code: 'NS-SEM3-REG-2026',
    name: 'Semester 3 Regular Examination 2026',
    registrationMode: 'APPLICATION',

    rule: {
      components: [
        {
          code: 'INTERNAL',
          maximum: 40,
          weight: 40,
          passPercentage: 40,
        },
        {
          code: 'EXTERNAL',
          maximum: 60,
          weight: 60,
          passPercentage: 40,
        },
      ],

      totalPassPercentage: 40,

      gradeBands: [
        {
          grade: 'A',
          minInclusive: 80,
          maxInclusive: 100,
          points: 10,
        },
        {
          grade: 'B',
          minInclusive: 60,
          maxExclusive: 80,
          points: 8,
        },
        {
          grade: 'C',
          minInclusive: 40,
          maxExclusive: 60,
          points: 6,
        },
        {
          grade: 'F',
          minInclusive: 0,
          maxExclusive: 40,
          points: 0,
        },
      ],

      gpaEnabled: true,
      graceMarks: 0,
    },
  },
};

writeJson(
  'fixtures/tenants/northstar-college.json',
  northstar,
);

/*
 * Generate exactly 100 fictional Northstar students.
 */

const northstarStudents = Array.from(
  { length: 100 },
  (_, index) => {
    const sequence = String(index + 1).padStart(3, '0');

    return {
      roll_no: `NS26${sequence}`,
      name: `Northstar Student ${sequence}`,
      email: `student.${sequence}@northstar.example.test`,
      cohort_code: 'BSC-CS-S3',
      subject_codes: 'CS301|MA301|EN301',
    };
  },
);

writeCsv(
  'fixtures/imports/northstar-students-valid.csv',
  [
    'roll_no',
    'name',
    'email',
    'cohort_code',
    'subject_codes',
  ],
  northstarStudents,
);

/*
 * --------------------------------------------------------------------------
 * CEDAR SCHOOL
 *
 * Implementation fixture choice:
 * - 20 students because source only says "smaller cohort"
 * - Class 10 A
 * - auto-enrol
 * - documented single 100-mark / 40% example
 * --------------------------------------------------------------------------
 */

const cedarSubjects = [
  {
    code: 'MAT10',
    name: 'Mathematics',
    credits: 1,
  },
  {
    code: 'SCI10',
    name: 'Science',
    credits: 1,
  },
  {
    code: 'ENG10',
    name: 'English',
    credits: 1,
  },
];

const cedar = {
  fixtureVersion: 1,

  tenant: {
    name: 'Cedar School',
    slug: 'cedar-school',
    timezone: 'Asia/Kolkata',
    mode: 'AUTO_ENROL',
  },

  academicStructure: {
    campus: {
      code: 'MAIN',
      name: 'Main Campus',
    },

    academicYear: {
      code: 'AY2026',
      name: '2026-27',
    },

    term: {
      code: 'ANNUAL',
      name: 'Annual',
    },

    cohort: {
      code: 'CLASS10A',
      name: 'Class 10 A',
    },

    departments: [
      {
        code: 'SCHOOL',
        name: 'Secondary School',
      },
    ],

    program: {
      code: 'CLASS10',
      name: 'Class 10',
    },

    subjects: cedarSubjects,
  },

  faculty: [
    {
      code: 'CSF001',
      name: 'Nisha Rao',
      email: 'nisha.rao@cedar.example.test',
      departmentCodes: ['SCHOOL'],
    },
    {
      code: 'CSF002',
      name: 'Arun Das',
      email: 'arun.das@cedar.example.test',
      departmentCodes: ['SCHOOL'],
    },
    {
      code: 'CSF003',
      name: 'Priya Nair',
      email: 'priya.nair@cedar.example.test',
      departmentCodes: ['SCHOOL'],
    },
  ],

  exam: {
    code: 'CEDAR-ANNUAL-2026',
    name: 'Class 10 Annual Examination 2026',
    registrationMode: 'AUTO_ENROL',

    rule: {
      components: [
        {
          code: 'FINAL',
          maximum: 100,
          weight: 100,
          passPercentage: 40,
        },
      ],

      totalPassPercentage: 40,

      gradeBands: [
        {
          grade: 'A',
          minInclusive: 80,
          maxInclusive: 100,
          points: 10,
        },
        {
          grade: 'B',
          minInclusive: 60,
          maxExclusive: 80,
          points: 8,
        },
        {
          grade: 'C',
          minInclusive: 40,
          maxExclusive: 60,
          points: 6,
        },
        {
          grade: 'F',
          minInclusive: 0,
          maxExclusive: 40,
          points: 0,
        },
      ],

      gpaEnabled: false,
      graceMarks: 0,
    },
  },
};

writeJson(
  'fixtures/tenants/cedar-school.json',
  cedar,
);

const cedarStudents = Array.from(
  { length: 20 },
  (_, index) => {
    const sequence = String(index + 1).padStart(2, '0');

    return {
      roll_no: `CED10A${sequence}`,
      name: `Cedar Student ${sequence}`,
      email: `student.${sequence}@cedar.example.test`,
      cohort_code: 'CLASS10A',
      subject_codes: 'MAT10|SCI10|ENG10',
    };
  },
);

writeCsv(
  'fixtures/imports/cedar-students-valid.csv',
  [
    'roll_no',
    'name',
    'email',
    'cohort_code',
    'subject_codes',
  ],
  cedarStudents,
);

/*
 * --------------------------------------------------------------------------
 * IMPORT TEMPLATE
 * --------------------------------------------------------------------------
 */

writeCsv(
  'fixtures/imports/student-import-template.csv',
  [
    'roll_no',
    'name',
    'email',
    'cohort_code',
    'subject_codes',
  ],
  [],
);

/*
 * Required bad-data fixture:
 * - duplicate roll
 * - unknown subject
 *
 * These must cause an atomic batch rejection later.
 */

writeCsv(
  'fixtures/imports/student-import-invalid.csv',
  [
    'roll_no',
    'name',
    'email',
    'cohort_code',
    'subject_codes',
  ],
  [
    {
      roll_no: 'NS26001',
      name: 'Duplicate Roll Example',
      email: 'duplicate.roll@northstar.example.test',
      cohort_code: 'BSC-CS-S3',
      subject_codes: 'CS301|MA301|EN301',
    },
    {
      roll_no: 'NS26101',
      name: 'Unknown Subject Example',
      email: 'unknown.subject@northstar.example.test',
      cohort_code: 'BSC-CS-S3',
      subject_codes: 'CS301|UNKNOWN999',
    },
  ],
);

/*
 * --------------------------------------------------------------------------
 * ADDITIONAL REQUIRED BUSINESS FIXTURES
 * --------------------------------------------------------------------------
 */

writeJson(
  'fixtures/tenants/business-edge-cases.json',
  {
    inactiveStudent: {
      tenant: 'northstar-college',
      rollNo: 'NS26099',
      expectedStatus: 'INACTIVE',
      expectedRegistrationEligibility: false,
    },

    rejectedApplication: {
      tenant: 'northstar-college',
      studentRollNo: 'NS26098',
      examCode: 'NS-SEM3-REG-2026',
      expectedState: 'REJECTED',
      reason: 'Fixture rejection for eligibility workflow testing',
    },

    dualDepartmentFaculty: {
      tenant: 'northstar-college',
      facultyCode: 'NSF004',
      departmentCodes: ['CSE', 'MATH'],
    },
  },
);

/*
 * --------------------------------------------------------------------------
 * RESULT ENGINE FIXTURES
 *
 * These values come from the approved Solution document.
 * --------------------------------------------------------------------------
 */

writeJson(
  'fixtures/results/result-engine-fixtures.json',
  {
    fixtureVersion: 1,

    gradeBands: [
      {
        grade: 'A',
        minInclusive: 80,
        maxInclusive: 100,
        points: 10,
      },
      {
        grade: 'B',
        minInclusive: 60,
        maxExclusive: 80,
        points: 8,
      },
      {
        grade: 'C',
        minInclusive: 40,
        maxExclusive: 60,
        points: 6,
      },
      {
        grade: 'F',
        minInclusive: 0,
        maxExclusive: 40,
        points: 0,
      },
    ],

    cases: [
      {
        id: 'R1_TWO_COMPONENT_PASS',
        input: {
          internal: {
            value: 32,
            maximum: 40,
            weight: 40,
          },
          external: {
            value: 42,
            maximum: 60,
            weight: 60,
          },
          totalPassPercentage: 40,
          componentPassPercentage: 40,
        },
        expected: {
          rawPercentage: 74,
          displayPercentage: '74.00',
          outcome: 'PASS',
          grade: 'B',
          gradePoints: 8,
        },
      },

      {
        id: 'R2_COMPONENT_THRESHOLD_FAIL',
        input: {
          internal: {
            value: 36,
            maximum: 40,
            weight: 40,
          },
          external: {
            value: 18,
            maximum: 60,
            weight: 60,
          },
          totalPassPercentage: 40,
          componentPassPercentage: 40,
        },
        expected: {
          rawPercentage: 54,
          externalPercentage: 30,
          outcome: 'FAIL',
          grade: 'F',
          gradePoints: 0,
        },
      },

      {
        id: 'R3_UNROUNDED_BOUNDARY_FAIL',
        input: {
          final: {
            value: 39.995,
            maximum: 100,
            weight: 100,
          },
          totalPassPercentage: 40,
        },
        expected: {
          rawPercentage: 39.995,
          displayPercentage: '40.00',
          outcome: 'FAIL',
          grade: 'F',
          gradePoints: 0,
        },
      },

      {
        id: 'R4_ABSENT',
        input: {
          attendance: 'ABSENT',
        },
        expected: {
          outcome: 'ABSENT',
          percentage: null,
          grade: null,
          gradePoints: 0,
        },
      },

      {
        id: 'R5_WITHHELD',
        input: {
          attendance: 'PRESENT',
          openStudentIncident: true,
        },
        expected: {
          outcome: 'WITHHELD',
          percentage: null,
          grade: null,
          gpa: null,
          numericResultVisible: false,
        },
      },

      {
        id: 'R6_GPA',
        input: {
          credits: [3, 4, 3],
          gradePoints: [8, 10, 6],
        },
        expected: {
          weightedPoints: 82,
          totalCredits: 10,
          gpa: 8.2,
          displayGpa: '8.20',
        },
      },
    ],

    validationCases: [
      {
        id: 'V1_PRESENT_MISSING_REQUIRED_MARK',
        input: {
          attendance: 'PRESENT',
          requiredMarkPresent: false,
        },
        expected: {
          resultRunAllowed: false,
          publicationAllowed: false,
          classification: 'INCOMPLETE_INPUT',
        },
      },
    ],
  },
);

/*
 * --------------------------------------------------------------------------
 * ROLE-BASED DEMO IDENTITIES
 *
 * No passwords belong in source control.
 * --------------------------------------------------------------------------
 */

writeJson(
  'fixtures/identities/demo-identities.json',
  {
    passwordsStoredInRepository: false,

    identities: [
      {
        key: 'platformAdmin',
        email: 'platform.admin@example.test',
        roles: ['PLATFORM_ADMIN'],
        tenant: null,
      },
      {
        key: 'northstarInstitutionAdmin',
        email: 'admin@northstar.example.test',
        roles: ['INSTITUTION_ADMIN'],
        tenant: 'northstar-college',
      },
      {
        key: 'northstarController',
        email: 'controller@northstar.example.test',
        roles: ['EXAM_CONTROLLER'],
        tenant: 'northstar-college',
      },
      {
        key: 'northstarDepartmentAdmin',
        email: 'hod@northstar.example.test',
        roles: ['DEPARTMENT_ADMIN'],
        tenant: 'northstar-college',
        departmentScopes: ['CSE'],
      },
      {
        key: 'northstarExaminer',
        email: 'examiner@northstar.example.test',
        roles: ['FACULTY_EXAMINER'],
        tenant: 'northstar-college',
      },
      {
        key: 'northstarInvigilator',
        email: 'invigilator@northstar.example.test',
        roles: ['INVIGILATOR_OBSERVER'],
        tenant: 'northstar-college',
      },
      {
        key: 'northstarStudent',
        email: 'student.001@northstar.example.test',
        roles: ['STUDENT'],
        tenant: 'northstar-college',
      },
      {
        key: 'northstarAuditor',
        email: 'auditor@northstar.example.test',
        roles: ['AUDITOR'],
        tenant: 'northstar-college',
      },
      {
        key: 'cedarInstitutionAdmin',
        email: 'admin@cedar.example.test',
        roles: ['INSTITUTION_ADMIN'],
        tenant: 'cedar-school',
      },
      {
        key: 'cedarController',
        email: 'controller@cedar.example.test',
        roles: ['EXAM_CONTROLLER'],
        tenant: 'cedar-school',
      },
      {
        key: 'cedarStudent',
        email: 'student.01@cedar.example.test',
        roles: ['STUDENT'],
        tenant: 'cedar-school',
      },
    ],
  },
);

/*
 * --------------------------------------------------------------------------
 * MANIFEST
 * --------------------------------------------------------------------------
 */

writeJson(
  'fixtures/manifest.json',
  {
    fixtureVersion: 1,

    tenants: {
      northstarCollege: {
        studentCount: 100,
        subjectCount: 3,
        minimumFacultyCount: 3,
        actualFacultyCount: northstarFaculty.length,
        registrationMode: 'APPLICATION',
      },

      cedarSchool: {
        studentCount: 20,
        subjectCount: 3,
        actualFacultyCount: 3,
        registrationMode: 'AUTO_ENROL',
      },
    },

    requiredEdgeCases: [
      'DUPLICATE_ROLL',
      'UNKNOWN_SUBJECT',
      'INACTIVE_STUDENT',
      'REJECTED_APPLICATION',
      'DUAL_DEPARTMENT_FACULTY',
    ],

    resultFixtureIds: [
      'R1_TWO_COMPONENT_PASS',
      'R2_COMPONENT_THRESHOLD_FAIL',
      'R3_UNROUNDED_BOUNDARY_FAIL',
      'R4_ABSENT',
      'R5_WITHHELD',
      'R6_GPA',
    ],
  },
);

console.log('D0 fixtures generated');
console.log('Northstar students: 100');
console.log('Cedar students: 20');
