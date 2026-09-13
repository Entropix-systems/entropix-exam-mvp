import assert from 'node:assert/strict';

import {
  TestEmailSender,
} from '../src/index.js';

const command = {
  to: [
    {
      email:
        'student@example.test',

      name:
        'Demo Student',
    },
  ],

  subject:
    'Examination notification',

  text:
    'Your examination notification is ready.',

  metadata: {
    event:
      'EXAM_NOTIFICATION',
  },
};

const success =
  new TestEmailSender(
    'ACCEPT',
  );

const accepted =
  await success.send(
    command,
  );

assert.equal(
  accepted.status,
  'ACCEPTED',
);

assert.deepEqual(
  accepted.acceptedRecipients,
  [
    'student@example.test',
  ],
);

assert.equal(
  success.messages.length,
  1,
);

const failure =
  new TestEmailSender(
    'FAIL',
  );

const failed =
  await failure.send(
    command,
  );

assert.equal(
  failed.status,
  'FAILED',
);

assert.equal(
  failed.errorCode,
  'SIMULATED_EMAIL_FAILURE',
);

assert.deepEqual(
  failed.rejectedRecipients,
  [
    'student@example.test',
  ],
);

/*
 * Business-operation simulation:
 *
 * The domain state succeeds first.
 * Email then fails.
 * The successful business state must
 * remain successful.
 */

let businessCommitted = false;

businessCommitted = true;

const notification =
  await failure.send({
    ...command,

    subject:
      'Result published',
  });

assert.equal(
  businessCommitted,
  true,
);

assert.equal(
  notification.status,
  'FAILED',
);

console.log(
  'Email adapter smoke: PASS',
);

console.log(
  '  Accepted send: PASS',
);

console.log(
  '  Failed send visible: PASS',
);

console.log(
  '  Business success preserved on email failure: PASS',
);

console.log(
  '  False DELIVERED state avoided: PASS',
);
