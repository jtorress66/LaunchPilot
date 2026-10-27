import type { ContentItem } from "../content-item/content-item";

/** One of the product's own published articles, which a new article may link to. */
export interface InternalLink {
  readonly title: string;
  readonly url: string;
}

/** The product's published blog articles, newest first: the only links an article may carry. */
export const publishedArticles = (
  items: readonly ContentItem[],
  max = 10,
): readonly InternalLink[] =>
  items
    .flatMap((item) =>
      item.channel === "blog" && item.publication !== null
        ? [{ title: item.title, url: item.publication.externalUrl, at: item.publication.at }]
        : [],
    )
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, max)
    .map(({ title, url }) => ({ title, url }));

/** A Markdown link `[text](url)` or a bare http(s) URL, in order of appearance. */
const LINK = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|https?:\/\/[^\s<>()[\]]+/g;
const TRAILING = /[.,;:!?'"]+$/;

const sameUrl = (a: string, b: string) => a.replace(/\/$/, "") === b.replace(/\/$/, "");
const isAllowed = (url: string, allowed: readonly InternalLink[]) =>
  allowed.some((link) => sameUrl(link.url, url));

/** Every linked URL in the Markdown that is not one of the allowed articles. */
export const linksOutside = (markdown: string, allowed: readonly InternalLink[]): string[] =>
  [...markdown.matchAll(LINK)]
    .map((match) => match[2] ?? match[0].replace(TRAILING, ""))
    .filter((url) => !isAllowed(url, allowed));

/** Keeps links to allowed articles; any other link becomes plain text. */
export const unlinkOutside = (markdown: string, allowed: readonly InternalLink[]): string =>
  markdown.replace(LINK, (whole, text: string | undefined, url: string | undefined) => {
    if (url !== undefined) return isAllowed(url, allowed) ? whole : (text ?? "");
    const bare = whole.replace(TRAILING, "");
    const tail = whole.slice(bare.length);
    return isAllowed(bare, allowed) ? whole : `${bare.replace(/^https?:\/\//, "")}${tail}`;
  });
