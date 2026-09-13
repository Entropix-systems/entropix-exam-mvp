import {
  SmtpEmailSender,
} from './smtp-email-sender.js';

import {
  TestEmailSender,
} from './test-email-sender.js';

import type {
  EmailSender,
} from './types.js';

function required(
  env: NodeJS.ProcessEnv,
  key: string,
): string {
  const value = env[key];

  if (!value) {
    throw new Error(
      `Missing required email environment variable: ${key}`,
    );
  }

  return value;
}

export function createEmailSenderFromEnv(
  env:
    NodeJS.ProcessEnv =
      process.env,
): EmailSender {
  const provider =
    (
      env.EMAIL_PROVIDER ||
      'test'
    ).toLowerCase();

  if (
    provider === 'test'
  ) {
    return new TestEmailSender(
      env.EMAIL_TEST_MODE ===
        'FAIL'
        ? 'FAIL'
        : 'ACCEPT',
    );
  }

  if (
    provider === 'smtp'
  ) {
    const user =
      env.SMTP_USER ||
      undefined;

    const password =
      env.SMTP_PASSWORD ||
      undefined;

    if (
      Boolean(user) !==
      Boolean(password)
    ) {
      throw new Error(
        'SMTP_USER and SMTP_PASSWORD must be configured together',
      );
    }

    return new SmtpEmailSender({
      host:
        required(
          env,
          'SMTP_HOST',
        ),

      port:
        Number(
          required(
            env,
            'SMTP_PORT',
          ),
        ),

      secure:
        env.SMTP_SECURE ===
        'true',

      user,
      password,

      from:
        required(
          env,
          'EMAIL_FROM',
        ),
    });
  }

  throw new Error(
    `Unsupported EMAIL_PROVIDER: ${provider}`,
  );
}
