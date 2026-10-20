import { err, ok, type Result } from "@launchpilot/domain";
import type { KeywordError, KeywordIdea, KeywordProvider, KeywordQuery } from "@launchpilot/ports";
import { NextFailure } from "./next-failure";

export class FakeKeywordProvider implements KeywordProvider {
  readonly queries: KeywordQuery[] = [];
  private readonly failure = new NextFailure<KeywordError>();
  private ideas: readonly KeywordIdea[] = [];

  setIdeas(ideas: readonly KeywordIdea[]): void {
    this.ideas = ideas;
  }

  failNext(error: KeywordError): void {
    this.failure.set(error);
  }

  suggest(query: KeywordQuery): Promise<Result<readonly KeywordIdea[], KeywordError>> {
    this.queries.push(query);
    const error = this.failure.take();
    return Promise.resolve(error ? err(error) : ok(this.ideas.slice(0, query.limit)));
  }
}
