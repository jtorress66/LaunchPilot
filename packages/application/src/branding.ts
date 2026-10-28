import {
  createBranding,
  err,
  ok,
  type ReportBranding,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type { BrandingRepository } from "@nuvantre/ports";
import { founderOfAccess, recordAudit, type AuditDeps } from "./audit";
import { failure, type UseCaseError } from "./errors";
import { authorize, type WorkspaceAccess } from "./workspace-access";

/** The branding a workspace's reports wear: its agency's for a client, otherwise its own. */
export const brandingFor = async (
  deps: { readonly branding: BrandingRepository },
  workspace: Pick<Workspace, "id" | "agencyId">,
): Promise<ReportBranding | null> =>
  (await deps.branding.findByWorkspace(workspace.agencyId ?? workspace.id)) ?? null;

export class GetBranding {
  constructor(private readonly deps: { readonly branding: BrandingRepository }) {}

  async execute(input: {
    access: WorkspaceAccess;
  }): Promise<Result<ReportBranding | null, UseCaseError>> {
    const allowed = authorize(input.access, "view");
    if (!allowed.ok) return allowed;
    return ok(await brandingFor(this.deps, input.access.workspace));
  }
}

/** Set on the agency (or a founder's own workspace) by its owner; clients inherit it. */
export class UpdateBranding {
  constructor(private readonly deps: { readonly branding: BrandingRepository } & AuditDeps) {}

  async execute(input: {
    access: WorkspaceAccess;
    senderName: string;
    accentColor: string;
    logoUrl?: string;
    replyTo: string;
    footer?: string;
  }): Promise<Result<ReportBranding, UseCaseError>> {
    const allowed = authorize(input.access, "manage_branding");
    if (!allowed.ok) return allowed;
    const { workspace } = input.access;
    if (workspace.agencyId !== null) {
      return err(failure("forbidden", "Branding is set on the agency for all of its clients"));
    }
    const branding = createBranding({ ...input, workspaceId: workspace.id });
    if (!branding.ok) return branding;
    await this.deps.branding.save(branding.value);
    await recordAudit(this.deps, {
      workspaceId: workspace.id,
      actor: founderOfAccess(input.access),
      action: "branding_updated",
      subject: { kind: "branding", id: workspace.id, label: branding.value.senderName },
    });
    return ok(branding.value);
  }
}
