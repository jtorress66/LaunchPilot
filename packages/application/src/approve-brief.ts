import {
  approveBrief,
  type Actor,
  type Brief,
  type ProductId,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type { BriefRepository, Clock, ProductRepository } from "@nuvantre/ports";
import { recordAudit, type AuditDeps } from "./audit";
import type { UseCaseError } from "./errors";
import { loadOwnedBrief } from "./owned-brief";

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
    workspace: Workspace;
    productId: ProductId;
    actor: Actor;
  }): Promise<Result<Brief, UseCaseError>> {
    const brief = await loadOwnedBrief(this.deps, input.workspace, input.productId);
    if (!brief.ok) return brief;
    const approved = approveBrief(brief.value, input.actor, { now: this.deps.clock.now() });
    if (!approved.ok) return approved;
    await this.deps.briefs.save(approved.value);
    const product = await this.deps.products.findById(input.productId);
    await recordAudit(this.deps, {
      workspaceId: input.workspace.id,
      actor: input.actor,
      action: "brief_approved",
      subject: { kind: "brief", id: approved.value.id, label: product?.name ?? "Product Brief" },
    });
    return approved;
  }
}
