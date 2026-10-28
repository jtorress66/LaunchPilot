import { ok, type Result } from "@nuvantre/domain";
import type { EmailMessage, Mailer, MailerErrorCode, PortError } from "@nuvantre/ports";

/** For development: records that an email would go out, without addresses or content. */
export class LogMailer implements Mailer {
  constructor(private readonly write: (line: string) => void) {}

  send(
    message: EmailMessage,
  ): Promise<Result<{ readonly id: string }, PortError<MailerErrorCode>>> {
    this.write(
      JSON.stringify({
        event: "mail.logged",
        subject: message.subject,
        recipientDomains: message.to.map((address) => address.split("@")[1] ?? ""),
      }),
    );
    return Promise.resolve(ok({ id: `logged-${message.idempotencyKey}` }));
  }
}
