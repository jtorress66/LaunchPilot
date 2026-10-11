import type { HttpUrl, Result } from "@launchpilot/domain";
import type { PortError } from "./port-error";

export interface CrawledPage {
  readonly url: string;
  readonly title: string;
  readonly text: string;
}

export interface CrawledSite {
  readonly url: HttpUrl;
  readonly pages: readonly CrawledPage[];
}

export type CrawlError = PortError<"unreachable" | "blocked_by_robots" | "not_html">;

/** Reads the founder's own site so agents can ground the brief in real facts. */
export interface SiteCrawler {
  crawl(url: HttpUrl): Promise<Result<CrawledSite, CrawlError>>;
}
