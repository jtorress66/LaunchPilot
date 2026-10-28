import {
  err,
  ok,
  parseRecipients,
  type AuditActor,
  type Email,
  type Product,
  type ProductId,
  type Result,
  type WeeklyReport,
  type Workspace,
} from "@nuvantre/domain";
import type {
  BrandingRepository,
  Mailer,
  MailerErrorCode,
  PortError,
  ProductRepository,
  ReportRecipientRepository,
  WeeklyReportRepository,
  WorkspaceRepository,
} from "@nuvantre/ports";
import { founderOfAccess, recordAudit, type AuditDeps } from "./audit";
import { brandingFor } from "./branding";
import { failure, type UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";
import { renderReportEmail } from "./report-email";
import { authorize, type WorkspaceAccess } from "./workspace-access";

type MailDeps = AuditDeps & {
  readonly branding: BrandingRepository;
  readonly mailer: Mailer;
};

type SendFailure = PortError<MailerErrorCode>;

/** Renders and sends one report under the workspace's branding, then records it. */
const emailReport = async (
  deps: MailDeps,
  input: {
    workspace: Workspace;
    product: Product;
    report: WeeklyReport;
    to: readonly Email[];
    actor: AuditActor;
  },
): Promise<Result<null, SendFailure>> => {
  const branding = await brandingFor(deps, input.workspace);
  const email = renderReportEmail({ report: input.report, product: input.product, branding });
  const day = deps.clock.now().toISOString().slice(0, 10);
  const sent = await deps.mailer.send({
    to: input.to,
    fromName: branding?.senderName ?? "Nuvantre",
    replyTo: branding?.replyTo,
    ...email,
    // A retried request, or a second click the same day, never emails the client twice.
    idempotencyKey: `report:${input.report.id}:${[...input.to].sort().join(",")}:${day}`,
  });
  if (!sent.ok) return sent;
  await recordAudit(deps, {
    workspaceId: input.workspace.id,
    actor: input.actor,
    action: "report_sent",
    subject: {
      kind: "report",
      id: input.report.id,
      label: `${input.product.name} ${input.report.weekKey}`,
    },
  });
  return ok(null);
};

/** "Email this report": sends a week's report to up to ten addresses and remembers them. */
export class SendReport {
  constructor(
    private readonly deps: MailDeps & {
      readonly products: ProductRepository;
      readonly weeklyReports: WeeklyReportRepository;
      readonly reportRecipients: ReportRecipientRepository;
    },
  ) {}

  async execute(input: {
    access: WorkspaceAccess;
    productId: ProductId;
    weekKey: string;
    recipients: string;
    weekly: boolean;
  }): Promise<Result<{ readonly to: readonly Email[] }, UseCaseError | SendFailure>> {
    const allowed = authorize(input.access, "send_reports");
    if (!allowed.ok) return allowed;
    const to = parseRecipients(input.recipients);
    if (!to.ok) return to;
    const product = await loadOwnedProduct(
      this.deps.products,
      input.access.workspace,
      input.productId,
    );
    if (!product.ok) return product;
    const report = await this.deps.weeklyReports.findByProductAndWeek(
      product.value.id,
      input.weekKey,
    );
    if (!report) return err(failure("report_not_found", "There is no report for this week"));
    const sent = await emailReport(this.deps, {
      workspace: input.access.workspace,
      product: product.value,
      report,
      to: to.value,
      actor: founderOfAccess(input.access),
    });
    if (!sent.ok) return sent;
    await this.deps.reportRecipients.save({
      productId: product.value.id,
      emails: to.value,
      weekly: input.weekly,
    });
    return ok({ to: to.value });
  }
}

/** After the weekly job builds reports: each goes to its product's weekly list, if it has one. */
export class SendWeeklyReportEmails {
  constructor(
    private readonly deps: MailDeps & {
      readonly products: ProductRepository;
      readonly workspaces: WorkspaceRepository;
      readonly reportRecipients: ReportRecipientRepository;
    },
  ) {}

  async execute(reports: readonly WeeklyReport[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    for (const report of reports) {
      const recipients = await this.deps.reportRecipients.findByProduct(report.productId);
      if (!recipients?.weekly || recipients.emails.length === 0) continue;
      const product = await this.deps.products.findById(report.productId);
      const workspace = product && (await this.deps.workspaces.findById(product.workspaceId));
      if (!product || !workspace) continue;
      const result = await emailReport(this.deps, {
        workspace,
        product,
        report,
        to: recipients.emails,
        actor: { kind: "system" },
      });
      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
        this.deps.errors.report(new Error(`Weekly report email failed: ${result.error.message}`), {
          workspaceId: workspace.id,
          job: "worker.weekly_report_emails",
        });
      }
    }
    return { sent, failed };
  }
}
