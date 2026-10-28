import { parseEmail, type Email } from "../account/email";
import { err, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";
import type { WorkspaceId } from "../shared/ids";
import { nonEmptyText } from "../shared/text";
import { parseHttpUrl } from "../shared/url";

/** How an agency's weekly reports look and who they come from. Its clients inherit it. */
export interface ReportBranding {
  readonly workspaceId: WorkspaceId;
  readonly senderName: string;
  /** `#rrggbb`, lowercase. */
  readonly accentColor: string;
  readonly logoUrl: string | null;
  readonly replyTo: Email;
  readonly footer: string | null;
}

const invalid = (message: string) => err(domainError("invalid_branding", message));

const httpsUrl = (value: string): boolean => {
  const url = parseHttpUrl(value);
  return url.ok && url.value.startsWith("https://");
};

export const createBranding = (input: {
  workspaceId: WorkspaceId;
  senderName: string;
  accentColor: string;
  logoUrl?: string | undefined;
  replyTo: string;
  footer?: string | undefined;
}): Result<ReportBranding, DomainError> => {
  const senderName = nonEmptyText(input.senderName, { field: "Sender name", max: 60 });
  if (!senderName.ok) return senderName;
  const accentColor = input.accentColor.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(accentColor)) return invalid("Use a colour like #0f766e");
  const logoUrl = input.logoUrl?.trim() ?? "";
  if (logoUrl !== "" && !httpsUrl(logoUrl)) return invalid("The logo must be an https:// address");
  const replyTo = parseEmail(input.replyTo);
  if (!replyTo.ok) return replyTo;
  const footer = input.footer?.trim() ?? "";
  if (footer.length > 200) return invalid("The footer must be at most 200 characters");
  return ok({
    workspaceId: input.workspaceId,
    senderName: senderName.value,
    accentColor,
    logoUrl: logoUrl === "" ? null : logoUrl,
    replyTo: replyTo.value,
    footer: footer === "" ? null : footer,
  });
};
