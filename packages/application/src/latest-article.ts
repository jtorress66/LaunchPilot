import type { ContentItem } from "@nuvantre/domain";

/** The newest published blog article, which the week's first posts promote. */
export const latestArticle = (items: readonly ContentItem[]) => {
  const article = items
    .filter((i) => i.channel === "blog" && i.publication !== null)
    .sort((a, b) => (b.publication?.at.getTime() ?? 0) - (a.publication?.at.getTime() ?? 0))[0];
  return article?.publication
    ? { title: article.title, url: article.publication.externalUrl }
    : undefined;
};
