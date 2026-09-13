import nodemailer, {
  type Transporter,
} from 'nodemailer';

import type {
  EmailSender,
  EmailSendResult,
  SendEmailCommand,
} from './types.js';

export interface SmtpEmailConfig {
  host: string;
  port: number;
  secure: boolean;

  user?: string;
  password?: string;

  from: string;
}

function formatRecipient(
  email: string,
  name?: string,
): string {
  if (!name) {
    return email;
  }

  const escaped =
    name.replaceAll(
      '"',
      '\\"',
    );

  return `"${escaped}" <${email}>`;
}

export class SmtpEmailSender
implements EmailSender {
  private readonly transporter:
    Transporter;

  constructor(
    private readonly config:
      SmtpEmailConfig,
  ) {
    this.transporter =
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,

        auth:
          config.user &&
          config.password
            ? {
                user:
                  config.user,

                pass:
                  config.password,
              }
            : undefined,
      });
  }

  async verify(): Promise<void> {
    await this.transporter.verify();
  }

  async send(
    command: SendEmailCommand,
  ): Promise<EmailSendResult> {
    try {
      const result =
        await this.transporter.sendMail({
          from:
            this.config.from,

          to:
            command.to.map(
              (recipient) =>
                formatRecipient(
                  recipient.email,
                  recipient.name,
                ),
            ),

          subject:
            command.subject,

          text:
            command.text,

          html:
            command.html,

          replyTo:
            command.replyTo,

          headers:
            command.metadata
              ? Object.fromEntries(
                  Object.entries(
                    command.metadata,
                  ).map(
                    ([key, value]) => [
                      `X-Entropix-${key}`,
                      value,
                    ],
                  ),
                )
              : undefined,
        });

      const accepted =
        Array.isArray(
          result.accepted,
        )
          ? result.accepted.map(
              String,
            )
          : [];

      const rejected =
        Array.isArray(
          result.rejected,
        )
          ? result.rejected.map(
              String,
            )
          : [];

      return {
        status:
          accepted.length > 0
            ? 'ACCEPTED'
            : 'FAILED',

        provider: 'SMTP',

        providerMessageId:
          result.messageId,

        acceptedRecipients:
          accepted,

        rejectedRecipients:
          rejected,

        errorCode:
          accepted.length > 0
            ? undefined
            : 'SMTP_NO_RECIPIENT_ACCEPTED',

        errorMessage:
          accepted.length > 0
            ? undefined
            : 'SMTP provider accepted no recipients',
      };
    } catch (error) {
      return {
        status: 'FAILED',
        provider: 'SMTP',

        acceptedRecipients: [],
        rejectedRecipients:
          command.to.map(
            (recipient) =>
              recipient.email,
          ),

        errorCode:
          'SMTP_SEND_FAILED',

        errorMessage:
          error instanceof Error
            ? error.message
            : 'Unknown SMTP failure',
      };
    }
  }
}
