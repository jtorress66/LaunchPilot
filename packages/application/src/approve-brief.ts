import {
  approveBrief,
  type Actor,
  type Brief,
  type ProductId,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type { BriefRepository, Clock, ProductRepository } from "@nuvantre/ports";
import type { UseCaseError } from "./errors";
import { loadOwnedBrief } from "./owned-brief";

/** Records the founder's approval; agents can never approve a brief. */
export class ApproveBrief {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly briefs: BriefRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
    actor: Actor;
  }): Promise<Result<Brief, UseCaseError>> {
    const brief = await loadOwnedBrief(this.deps, input.workspace, input.productId);
    if (!brief.ok) return brief;
    const approved = approveBrief(brief.value, input.actor, { now: this.deps.clock.now() });
    if (approved.ok) await this.deps.briefs.save(approved.value);
    return approved;
  }
}
