import type { CrawledSite } from "@launchpilot/ports";

/** Everything a brief may quote from: the title and text of every crawled page. */
export const siteCorpus = (site: CrawledSite): string =>
  site.pages.map((page) => `${page.title}\n${page.text}`).join("\n\n");
