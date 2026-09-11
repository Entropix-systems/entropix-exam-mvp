import assert from 'node:assert/strict';

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
} from '../src/index.js';

assert.equal(ROLES.EXAM_CONTROLLER, 'EXAM_CONTROLLER');
assert.equal(ROLES.STUDENT, 'STUDENT');

assert.equal(
  REGISTRATION_STATES.APPROVED,
  'APPROVED',
);

assert.equal(
  EXAM_STATES.SCHEDULE_PUBLISHED,
  'SCHEDULE_PUBLISHED',
);

assert.equal(
  ATTENDANCE_STATES.NOT_MARKED,
  'NOT_MARKED',
);

assert.equal(
  MARKS_BATCH_STATES.RETURNED,
  'RETURNED',
);

assert.equal(
  RESULT_OUTCOMES.WITHHELD,
  'WITHHELD',
);

assert.equal(
  API_ERROR_CODES.RESULT_INPUT_CHANGED,
  'RESULT_INPUT_CHANGED',
);

assert.equal(
  IDEMPOTENCY_HEADER,
  'Idempotency-Key',
);

assert.equal(
  IDEMPOTENCY_RETENTION_HOURS,
  24,
);

assert.equal(
  MAX_CURSOR_PAGE_SIZE,
  100,
);

console.log('Shared contracts smoke: PASS');
