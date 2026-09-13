export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailCommand {
  to: readonly EmailRecipient[];
  subject: string;

  text?: string;
  html?: string;

  replyTo?: string;

  metadata?: Readonly<
    Record<string, string>
  >;
}

export type EmailSendStatus =
  | 'ACCEPTED'
  | 'FAILED';

export interface EmailSendResult {
  status: EmailSendStatus;

  provider:
    | 'TEST'
    | 'SMTP';

  providerMessageId?: string;

  acceptedRecipients: readonly string[];
  rejectedRecipients: readonly string[];

  errorCode?: string;
  errorMessage?: string;
}

export interface EmailSender {
  send(
    command: SendEmailCommand,
  ): Promise<EmailSendResult>;
}
