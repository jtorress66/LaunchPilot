import { err, ok, type Result } from "@nuvantre/domain";
import type { EmailMessage, Mailer, MailerErrorCode, PortError } from "@nuvantre/ports";
import { z } from "zod";

export interface ResendOptions {
  /** The account's API key (`re_…`), from RESEND_API_KEY. Never logged or echoed. */
  readonly apiKey: string;
  /** An address on a domain verified in Resend, from MAIL_FROM. */
  readonly from: string;
  /** Defaults to https://api.resend.com; tests point it at a local stand-in. */
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

type SendResult = Result<{ readonly id: string }, PortError<MailerErrorCode>>;

const sentBody = z.object({ id: z.string().min(1) });
const errorBody = z.object({ name: z.string().optional(), message: z.string().optional() });

/** Quotes and brackets in a display name could change the address; keep only safe text. */
const displayName = (name: string) =>
  name
    .replace(/["<>\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const failure = (code: MailerErrorCode, message: string, retryable: boolean): SendResult =>
  err({ code, message, retryable });

/** What each HTTP status means for the caller: whether to fix something or try again later. */
const codeFor = (status: number): { code: MailerErrorCode; retryable: boolean } => {
  if (status === 401 || status === 403) return { code: "mailer_unauthorized", retryable: false };
  if (status === 409 || status === 429 || status >= 500) {
    return { code: "mailer_unavailable", retryable: true };
  }
  return { code: "mailer_rejected", retryable: false };
};

/** Sends email through Resend's REST API (https://resend.com/docs/api-reference). */
export class ResendMailer implements Mailer {
  constructor(private readonly options: ResendOptions) {}

  async send(message: EmailMessage): Promise<SendResult> {
    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl ?? "https://api.resend.com"}/emails`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
          "idempotency-key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from: `"${displayName(message.fromName)}" <${this.options.from}>`,
          to: message.to,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
      });
    } catch {
      return failure("mailer_unavailable", "Could not reach Resend. Try again shortly.", true);
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (response.ok) {
      const parsed = sentBody.safeParse(body);
      return parsed.success
        ? ok({ id: parsed.data.id })
        : failure("mailer_unavailable", "Resend sent an unexpected answer", true);
    }
    const { code, retryable } = codeFor(response.status);
    const explained = errorBody.safeParse(body);
    const reason = explained.success ? explained.data.message?.slice(0, 300) : undefined;
    return failure(code, `Resend refused the email${reason ? `: ${reason}` : ""}`, retryable);
  }
}
