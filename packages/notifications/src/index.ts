export {
  createEmailSenderFromEnv,
} from './config.js';

export {
  SmtpEmailSender,
} from './smtp-email-sender.js';

export type {
  SmtpEmailConfig,
} from './smtp-email-sender.js';

export {
  TestEmailSender,
} from './test-email-sender.js';

export type {
  TestEmailMode,
} from './test-email-sender.js';

export type {
  EmailRecipient,
  EmailSender,
  EmailSendResult,
  EmailSendStatus,
  SendEmailCommand,
} from './types.js';
