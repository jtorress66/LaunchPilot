import { err, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";

const MAX_SLUG = 75;

/** Latin letters lose their accents ("café" → "cafe"); other scripts are kept as they are. */
const foldLatin = (text: string) =>
  text
    .normalize("NFD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .normalize("NFC")
    .replace(/ß/g, "ss");

/** Cuts at the last hyphen that fits, so no word is cut in half. */
const fit = (slug: string) => {
  if (slug.length <= MAX_SLUG) return slug;
  const cut = slug.slice(0, MAX_SLUG + 1);
  const lastHyphen = cut.lastIndexOf("-");
  return lastHyphen > 0 ? cut.slice(0, lastHyphen) : slug.slice(0, MAX_SLUG);
};

/** A URL slug: lower-case words joined by single hyphens, at most 75 characters. */
export const slugify = (text: string): string =>
  fit(
    foldLatin(text)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, ""),
  );

/** Accepts a slug only when slugify would leave it unchanged. */
export const parseSlug = (value: string): Result<string, DomainError> => {
  const trimmed = value.trim();
  return trimmed !== "" && slugify(trimmed) === trimmed
    ? ok(trimmed)
    : err(
        domainError(
          "invalid_slug",
          "A URL slug is lower-case words joined by single hyphens, at most 75 characters",
        ),
      );
};
