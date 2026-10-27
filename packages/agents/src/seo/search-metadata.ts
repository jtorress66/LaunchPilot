import { slugify, type ArticleSeo } from "@nuvantre/domain";

const MAX_EXCERPT = 300;

/** One line, at most 300 characters, cut at a word boundary with an ellipsis. */
export const shortenExcerpt = (text: string, max = MAX_EXCERPT): string => {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= max) return line;
  const cut = line.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?]+$/, "")}…`;
};

/** The model's slug, tidied; the title's words when the model's slug has none left. */
export const searchMetadata = (
  answer: { slug: string; excerpt: string },
  title: string,
): ArticleSeo => ({
  slug: slugify(answer.slug) || slugify(title) || "article",
  excerpt: shortenExcerpt(answer.excerpt),
});
