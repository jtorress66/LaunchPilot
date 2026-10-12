import { err, ok, type Result } from "@launchpilot/domain";
import type {
  BriefDraft,
  BriefDraftError,
  BriefDrafter,
  BriefDraftRequest,
} from "@launchpilot/ports";
import { NextFailure } from "./next-failure";

/** Drafts a predictable brief whose facts are the first line of each crawled page. */
export class FakeBriefDrafter implements BriefDrafter {
  readonly requests: BriefDraftRequest[] = [];
  private readonly failure = new NextFailure<BriefDraftError>();
  private scripted: BriefDraft | undefined;

  respondWith(draft: BriefDraft): void {
    this.scripted = draft;
  }

  failNext(error: BriefDraftError): void {
    this.failure.set(error);
  }

  draft(request: BriefDraftRequest): Promise<Result<BriefDraft, BriefDraftError>> {
    this.requests.push(request);
    const error = this.failure.take();
    if (error) return Promise.resolve(err(error));
    if (this.scripted) return Promise.resolve(ok(this.scripted));
    const facts = request.site.pages
      .map((page) => page.text.split("\n")[0]?.trim() ?? "")
      .filter((line) => line !== "");
    return Promise.resolve(
      ok({
        content: {
          audience: `Customers of ${request.productName}`,
          problem: "A problem described on the site",
          solution: `${request.productName} solves it`,
          differentiators: [],
          tone: "Friendly",
          facts,
        },
        evidence: facts.map((fact) => ({ statement: fact, quote: fact })),
        droppedClaims: [],
      }),
    );
  }
}
