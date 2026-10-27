import { err, ok, slugify, type Result } from "@nuvantre/domain";
import type { ContentDrafter, Draft, DraftError, DraftRequest } from "@nuvantre/ports";
import { NextFailure } from "./next-failure";

export class FakeContentDrafter implements ContentDrafter {
  readonly requests: DraftRequest[] = [];
  private readonly failure = new NextFailure<DraftError>();
  private scripted: Draft | undefined;

  respondWith(draft: Draft): void {
    this.scripted = draft;
  }

  failNext(error: DraftError): void {
    this.failure.set(error);
  }

  draft(request: DraftRequest): Promise<Result<Draft, DraftError>> {
    this.requests.push(request);
    const error = this.failure.take();
    if (error) return Promise.resolve(err(error));
    return Promise.resolve(
      ok(
        this.scripted ?? {
          title: request.task.title,
          body: `Draft for "${request.task.title}" on ${request.channel}.`,
          citedFacts: request.brief.facts.slice(0, 1),
          ...(request.channel === "blog"
            ? {
                seo: {
                  slug: slugify(request.task.title) || "article",
                  excerpt: `About ${request.task.title}.`,
                },
              }
            : {}),
        },
      ),
    );
  }
}
