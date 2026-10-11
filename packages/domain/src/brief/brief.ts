import { all, andThen, err, ok, type Result } from "../result";
import type { Actor } from "../shared/actor";
import { domainError, type DomainError } from "../shared/errors";
import type { BriefId, ProductId, UserId } from "../shared/ids";
import { applyTransition, defineTransitions } from "../shared/state-machine";
import { nonEmptyText } from "../shared/text";

export interface BriefContent {
  readonly audience: string;
  readonly problem: string;
  readonly solution: string;
  readonly differentiators: readonly string[];
  readonly tone: string;
  /** The only product claims agents are allowed to make. */
  readonly facts: readonly string[];
}

export type BriefStatus = "draft" | "approved";

export interface Brief {
  readonly id: BriefId;
  readonly productId: ProductId;
  readonly version: number;
  readonly status: BriefStatus;
  readonly content: BriefContent;
  readonly approval: { readonly by: UserId; readonly at: Date } | null;
  readonly updatedAt: Date;
}

const machine = defineTransitions<BriefStatus, "approve" | "revise">({
  draft: { approve: "approved", revise: "draft" },
  approved: { revise: "draft" },
});

const field = (value: string, name: string) => nonEmptyText(value, { field: name, max: 2000 });
const list = (values: readonly string[], name: string) =>
  all(values.map((value) => nonEmptyText(value, { field: name, max: 500 })));

const validateContent = (content: BriefContent): Result<BriefContent, DomainError> =>
  andThen(field(content.audience, "Audience"), (audience) =>
    andThen(field(content.problem, "Problem"), (problem) =>
      andThen(field(content.solution, "Solution"), (solution) =>
        andThen(field(content.tone, "Tone"), (tone) =>
          andThen(list(content.differentiators, "Differentiator"), (differentiators) =>
            andThen(list(content.facts, "Fact"), (facts) =>
              ok({ audience, problem, solution, tone, differentiators, facts }),
            ),
          ),
        ),
      ),
    ),
  );

export const createBrief = (input: {
  id: BriefId;
  productId: ProductId;
  content: BriefContent;
  now: Date;
}): Result<Brief, DomainError> =>
  andThen(validateContent(input.content), (content) =>
    ok({
      id: input.id,
      productId: input.productId,
      version: 1,
      status: "draft",
      content,
      approval: null,
      updatedAt: input.now,
    }),
  );

/** Any revision starts a new draft version that needs approval again. */
export const reviseBrief = (
  brief: Brief,
  content: BriefContent,
  { now }: { now: Date },
): Result<Brief, DomainError> =>
  andThen(applyTransition(machine, brief.status, "revise"), (status) =>
    andThen(validateContent(content), (valid) =>
      ok({
        ...brief,
        content: valid,
        status,
        version: brief.version + 1,
        approval: null,
        updatedAt: now,
      }),
    ),
  );

export const approveBrief = (
  brief: Brief,
  actor: Actor,
  { now }: { now: Date },
): Result<Brief, DomainError> =>
  andThen(applyTransition(machine, brief.status, "approve"), (status) => {
    if (actor.kind !== "founder") {
      return err(domainError("approval_requires_founder", "Only the founder can approve a brief"));
    }
    if (brief.content.facts.length === 0) {
      return err(
        domainError("brief_has_no_facts", "Add at least one product fact before approving"),
      );
    }
    return ok({ ...brief, status, approval: { by: actor.userId, at: now }, updatedAt: now });
  });
