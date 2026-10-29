const ELLIPSIS = "…";

/** Shortens `text` to `max` characters at a word boundary. */
export const fit = (text: string, max: number): string => {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - ELLIPSIS.length);
  const space = cut.lastIndexOf(" ");
  const atWord = space > 0 ? cut.slice(0, space).trimEnd() : cut;
  return `${atWord}${ELLIPSIS}`;
};
