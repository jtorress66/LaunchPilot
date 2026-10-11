import { err, ok, type HttpUrl, type Result } from "@launchpilot/domain";
import type { CrawlError, CrawledPage, CrawledSite, SiteCrawler } from "@launchpilot/ports";

export class FakeSiteCrawler implements SiteCrawler {
  private readonly sites = new Map<HttpUrl, readonly CrawledPage[]>();

  addSite(url: HttpUrl, pages: readonly CrawledPage[]): void {
    this.sites.set(url, pages);
  }

  makeUnreachable(url: HttpUrl): void {
    this.sites.delete(url);
  }

  crawl(url: HttpUrl): Promise<Result<CrawledSite, CrawlError>> {
    const pages = this.sites.get(url);
    return Promise.resolve(
      pages
        ? ok({ url, pages })
        : err({ code: "unreachable", message: `${url} could not be reached`, retryable: true }),
    );
  }
}
