import { approveBrief, type Brief, type ProductId, type Result } from "@nuvantre/domain";
import type { BriefRepository, Clock, ProductRepository } from "@nuvantre/ports";
import { founderOfAccess, recordAudit, type AuditDeps } from "./audit";
import type { UseCaseError } from "./errors";
import { loadOwnedBrief } from "./owned-brief";
import { authorize, type WorkspaceAccess } from "./workspace-access";

/** Records the founder's approval; agents can never approve a brief. */
export class ApproveBrief {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly briefs: BriefRepository;
      readonly clock: Clock;
    } & AuditDeps,
  ) {}

  async execute(input: {
    access: WorkspaceAccess;
    productId: ProductId;
  }): Promise<Result<Brief, UseCaseError>> {
    const allowed = authorize(input.access, "approve");
    if (!allowed.ok) return allowed;
    const { workspace } = input.access;
    const actor = founderOfAccess(input.access);
    const brief = await loadOwnedBrief(this.deps, workspace, input.productId);
    if (!brief.ok) return brief;
    const approved = approveBrief(brief.value, actor, { now: this.deps.clock.now() });
    if (!approved.ok) return approved;
    await this.deps.briefs.save(approved.value);
    const product = await this.deps.products.findById(input.productId);
    await recordAudit(this.deps, {
      workspaceId: workspace.id,
      actor,
      action: "brief_approved",
      subject: { kind: "brief", id: approved.value.id, label: product?.name ?? "Product Brief" },
    });
    return approved;
  }
}
