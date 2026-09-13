import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  API_ERROR_CODES,
  ATTENDANCE_STATES,
  EXAM_STATES,
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_RETENTION_HOURS,
  MARKS_BATCH_STATES,
  MAX_CURSOR_PAGE_SIZE,
  REGISTRATION_STATES,
  RESULT_OUTCOMES,
  ROLES,
  AUTH_PROTOCOL_OPERATIONS,
} from '../src/index.js';

assert.equal(ROLES.EXAM_CONTROLLER, 'EXAM_CONTROLLER');
assert.equal(ROLES.STUDENT, 'STUDENT');
assert.deepEqual(
  Object.values(ROLES).sort(),
  [
    'PLATFORM_ADMIN',
    'INSTITUTION_ADMIN',
    'EXAM_CONTROLLER',
    'DEPARTMENT_ADMIN',
    'FACULTY',
    'INVIGILATOR',
    'STUDENT',
    'AUDITOR',
  ].sort(),
);

const identities = JSON.parse(
  readFileSync(
    new URL(
      '../../../fixtures/identities/demo-identities.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as { identities: { roles: string[] }[] };
for (const identity of identities.identities) {
  for (const role of identity.roles) {
    assert.ok(
      Object.values(ROLES).some((canonical) => canonical === role),
      `Noncanonical fixture role: ${role}`,
    );
  }
}
assert.deepEqual(
  [...AUTH_PROTOCOL_OPERATIONS],
  [
    'login',
    'refresh',
    'logout',
    'context-switch',
    'forgot-password',
    'reset-password',
    'invitation-acceptance',
  ],
);

assert.equal(REGISTRATION_STATES.APPROVED, 'APPROVED');

assert.equal(EXAM_STATES.SCHEDULE_PUBLISHED, 'SCHEDULE_PUBLISHED');

assert.equal(ATTENDANCE_STATES.NOT_MARKED, 'NOT_MARKED');

assert.equal(MARKS_BATCH_STATES.RETURNED, 'RETURNED');

assert.equal(RESULT_OUTCOMES.WITHHELD, 'WITHHELD');

assert.equal(API_ERROR_CODES.RESULT_INPUT_CHANGED, 'RESULT_INPUT_CHANGED');
assert.equal(API_ERROR_CODES.INTERNAL_ERROR, 'INTERNAL_ERROR');

assert.equal(IDEMPOTENCY_HEADER, 'Idempotency-Key');

assert.equal(IDEMPOTENCY_RETENTION_HOURS, 24);

assert.equal(MAX_CURSOR_PAGE_SIZE, 100);

console.log('Shared contracts smoke: PASS');
