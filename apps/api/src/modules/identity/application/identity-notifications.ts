import type { EmailSender } from '@entropix/notifications';
import { Inject, Injectable } from '@nestjs/common';

export interface IdentityNotificationMessage {
  to: string;
  subject: string;
  text: string;
  /** Safe reason/category only. Never put raw credentials here. */
  category: 'PASSWORD_RESET';
}

export abstract class IdentityNotificationSender {
  abstract send(message: IdentityNotificationMessage): Promise<void>;
}

export const EMAIL_SENDER = Symbol('identity.email-sender');

@Injectable()
export class EmailIdentityNotificationSender extends IdentityNotificationSender {
  constructor(@Inject(EMAIL_SENDER) private readonly email: EmailSender) {
    super();
  }

  async send(message: IdentityNotificationMessage): Promise<void> {
    const result = await this.email.send({
      to: [{ email: message.to }],
      subject: message.subject,
      text: message.text,
      metadata: { category: message.category },
    });
    if (result.status !== 'ACCEPTED')
      throw new Error('Identity notification was not accepted');
  }
}
