import {
  reviseBrief,
  type Brief,
  type BriefContent,
  type ProductId,
  type Result,
  type Workspace,
} from "@launchpilot/domain";
import type { BriefRepository, Clock, ProductRepository } from "@launchpilot/ports";
import type { UseCaseError } from "./errors";
import { loadOwnedBrief } from "./owned-brief";

/** Saves the founder's edits. Any edit returns the brief to draft until approved again. */
export class UpdateBrief {
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
    content: BriefContent;
  }): Promise<Result<Brief, UseCaseError>> {
    const brief = await loadOwnedBrief(this.deps, input.workspace, input.productId);
    if (!brief.ok) return brief;
    const revised = reviseBrief(brief.value, input.content, { now: this.deps.clock.now() });
    if (revised.ok) await this.deps.briefs.save(revised.value);
    return revised;
  }
}
