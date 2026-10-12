import { parseHttpUrl, type HttpUrl } from "@launchpilot/domain";
import type { CrawledPage, SiteCrawler } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";

export interface SiteCrawlerHarness {
  readonly crawler: SiteCrawler;
  /** Where the harness serves sites; a real crawler needs a server it can reach. */
  readonly baseUrl?: string;
  givenSite(url: HttpUrl, pages: readonly CrawledPage[]): void | Promise<void>;
  givenUnreachable(url: HttpUrl): void | Promise<void>;
}

const httpUrl = (value: string): HttpUrl => {
  const parsed = parseHttpUrl(value);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
};

const siteAt = (base: string) => {
  const url = httpUrl(base);
  const pages: CrawledPage[] = [
    { url, title: "Acme", text: "Marketing for SaaS founders." },
    { url: new URL("pricing", url).href, title: "Pricing", text: "Free 14-day trial." },
  ];
  return { url, pages };
};

export function describeSiteCrawlerContract(
  name: string,
  make: () => SiteCrawlerHarness | Promise<SiteCrawlerHarness>,
): void {
  describe(`SiteCrawler contract: ${name}`, () => {
    it("returns the pages of the crawled site", async () => {
      const harness = await make();
      const { url, pages } = siteAt(harness.baseUrl ?? "https://acme.dev/");
      await harness.givenSite(url, pages);
      expect(await harness.crawler.crawl(url)).toEqual({ ok: true, value: { url, pages } });
    });

    it("reports an unreachable site as a CrawlError result", async () => {
      const harness = await make();
      const { url } = siteAt(harness.baseUrl ?? "https://acme.dev/");
      await harness.givenUnreachable(url);
      const result = await harness.crawler.crawl(url);
      expect(result.ok ? undefined : result.error.code).toBe("unreachable");
    });
  });
}
