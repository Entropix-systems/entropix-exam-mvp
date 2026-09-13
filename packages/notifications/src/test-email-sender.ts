import type {
  EmailSender,
  EmailSendResult,
  SendEmailCommand,
} from './types.js';

export type TestEmailMode =
  | 'ACCEPT'
  | 'FAIL';

export class TestEmailSender
implements EmailSender {
  readonly messages:
    SendEmailCommand[] = [];

  constructor(
    private readonly mode:
      TestEmailMode = 'ACCEPT',
  ) {}

  async send(
    command: SendEmailCommand,
  ): Promise<EmailSendResult> {
    this.messages.push(command);

    const recipients =
      command.to.map(
        (recipient) =>
          recipient.email,
      );

    if (
      this.mode === 'FAIL'
    ) {
      return {
        status: 'FAILED',
        provider: 'TEST',

        acceptedRecipients: [],
        rejectedRecipients:
          recipients,

        errorCode:
          'SIMULATED_EMAIL_FAILURE',

        errorMessage:
          'Simulated email provider failure',
      };
    }

    return {
      status: 'ACCEPTED',
      provider: 'TEST',

      providerMessageId:
        `test-${this.messages.length}`,

      acceptedRecipients:
        recipients,

      rejectedRecipients: [],
    };
  }
}
