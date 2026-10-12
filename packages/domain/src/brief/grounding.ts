/**
 * Product safety rule: agents may only state product facts found on the founder's site.
 * A fact is grounded when its supporting quote appears in the crawled text.
 */

export interface QuotedFact {
  readonly statement: string;
  /** Text copied from the site that supports the statement. */
  readonly quote: string;
}

/** Lowercase words only, so whitespace, punctuation and quote style never decide a match. */
const normalise = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const isGrounded = (quote: string, corpus: string): boolean => {
  const needle = normalise(quote);
  if (needle === "") return false;
  return ` ${normalise(corpus)} `.includes(` ${needle} `);
};

export const keepGroundedFacts = (
  facts: readonly QuotedFact[],
  corpus: string,
): { readonly kept: QuotedFact[]; readonly dropped: string[] } => {
  const kept: QuotedFact[] = [];
  const dropped: string[] = [];
  for (const fact of facts) {
    if (isGrounded(fact.quote, corpus)) kept.push(fact);
    else dropped.push(fact.statement);
  }
  return { kept, dropped };
};
