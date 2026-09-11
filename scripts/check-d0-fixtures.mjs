import assert from 'node:assert/strict';
import fs from 'node:fs';

function readJson(file) {
  return JSON.parse(
    fs.readFileSync(file, 'utf8'),
  );
}

function dataRowCount(file) {
  const content =
    fs.readFileSync(file, 'utf8').trim();

  if (!content) {
    return 0;
  }

  return content.split(/\r?\n/).length - 1;
}

const manifest =
  readJson('fixtures/manifest.json');

assert.equal(
  manifest.tenants.northstarCollege.studentCount,
  100,
);

assert.equal(
  manifest.tenants.northstarCollege.subjectCount,
  3,
);

assert.ok(
  manifest.tenants.northstarCollege.actualFacultyCount >= 3,
);

assert.equal(
  manifest.tenants.northstarCollege.registrationMode,
  'APPLICATION',
);

assert.equal(
  manifest.tenants.cedarSchool.registrationMode,
  'AUTO_ENROL',
);

assert.equal(
  dataRowCount(
    'fixtures/imports/northstar-students-valid.csv',
  ),
  100,
);

assert.equal(
  dataRowCount(
    'fixtures/imports/cedar-students-valid.csv',
  ),
  20,
);

const northstar =
  readJson(
    'fixtures/tenants/northstar-college.json',
  );

assert.equal(
  northstar.academicStructure.subjects.length,
  3,
);

assert.ok(
  northstar.faculty.length >= 3,
);

const dualScopedFaculty =
  northstar.faculty.find(
    (faculty) =>
      faculty.departmentCodes.length === 2,
  );

assert.ok(
  dualScopedFaculty,
  'Dual-department faculty fixture missing',
);

const edgeCases =
  readJson(
    'fixtures/tenants/business-edge-cases.json',
  );

assert.equal(
  edgeCases
    .inactiveStudent
    .expectedRegistrationEligibility,
  false,
);

assert.equal(
  edgeCases
    .rejectedApplication
    .expectedState,
  'REJECTED',
);

const invalidImport =
  fs.readFileSync(
    'fixtures/imports/student-import-invalid.csv',
    'utf8',
  );

assert.match(
  invalidImport,
  /NS26001/,
);

assert.match(
  invalidImport,
  /UNKNOWN999/,
);

const resultFixtures =
  readJson(
    'fixtures/results/result-engine-fixtures.json',
  );

const resultById =
  Object.fromEntries(
    resultFixtures.cases.map(
      (fixture) => [
        fixture.id,
        fixture,
      ],
    ),
  );

assert.equal(
  resultById
    .R1_TWO_COMPONENT_PASS
    .expected
    .rawPercentage,
  74,
);

assert.equal(
  resultById
    .R1_TWO_COMPONENT_PASS
    .expected
    .outcome,
  'PASS',
);

assert.equal(
  resultById
    .R1_TWO_COMPONENT_PASS
    .expected
    .grade,
  'B',
);

assert.equal(
  resultById
    .R1_TWO_COMPONENT_PASS
    .expected
    .gradePoints,
  8,
);

assert.equal(
  resultById
    .R2_COMPONENT_THRESHOLD_FAIL
    .expected
    .rawPercentage,
  54,
);

assert.equal(
  resultById
    .R2_COMPONENT_THRESHOLD_FAIL
    .expected
    .externalPercentage,
  30,
);

assert.equal(
  resultById
    .R2_COMPONENT_THRESHOLD_FAIL
    .expected
    .outcome,
  'FAIL',
);

assert.equal(
  resultById
    .R3_UNROUNDED_BOUNDARY_FAIL
    .expected
    .rawPercentage,
  39.995,
);

assert.equal(
  resultById
    .R3_UNROUNDED_BOUNDARY_FAIL
    .expected
    .displayPercentage,
  '40.00',
);

assert.equal(
  resultById
    .R3_UNROUNDED_BOUNDARY_FAIL
    .expected
    .outcome,
  'FAIL',
);

assert.equal(
  resultById
    .R4_ABSENT
    .expected
    .outcome,
  'ABSENT',
);

assert.equal(
  resultById
    .R5_WITHHELD
    .expected
    .outcome,
  'WITHHELD',
);

assert.equal(
  resultById
    .R5_WITHHELD
    .expected
    .numericResultVisible,
  false,
);

assert.equal(
  resultById
    .R6_GPA
    .expected
    .weightedPoints,
  82,
);

assert.equal(
  resultById
    .R6_GPA
    .expected
    .totalCredits,
  10,
);

assert.equal(
  resultById
    .R6_GPA
    .expected
    .displayGpa,
  '8.20',
);

const identities =
  readJson(
    'fixtures/identities/demo-identities.json',
  );

assert.equal(
  identities.passwordsStoredInRepository,
  false,
);

console.log('D0 fixture smoke: PASS');
console.log('  Northstar students: 100');
console.log('  Northstar subjects: 3');
console.log('  Northstar faculty: >= 3');
console.log('  Cedar auto-enrol cohort: READY');
console.log('  Import error fixtures: READY');
console.log('  Result R1-R6 fixtures: READY');
console.log('  Demo identities: READY');
