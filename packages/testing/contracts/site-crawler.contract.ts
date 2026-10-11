import { parseHttpUrl, type HttpUrl } from "@launchpilot/domain";
import type { CrawledPage, SiteCrawler } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";

export interface SiteCrawlerHarness {
  readonly crawler: SiteCrawler;
  givenSite(url: HttpUrl, pages: readonly CrawledPage[]): void | Promise<void>;
  givenUnreachable(url: HttpUrl): void | Promise<void>;
}

const parsed = parseHttpUrl("https://acme.dev/");
if (!parsed.ok) throw new Error(parsed.error.message);
const site: HttpUrl = parsed.value;
const pages: CrawledPage[] = [
  { url: "https://acme.dev/", title: "Acme", text: "Marketing for SaaS founders." },
  { url: "https://acme.dev/pricing", title: "Pricing", text: "Free 14-day trial." },
];

export function describeSiteCrawlerContract(
  name: string,
  make: () => SiteCrawlerHarness | Promise<SiteCrawlerHarness>,
): void {
  describe(`SiteCrawler contract: ${name}`, () => {
    it("returns the pages of the crawled site", async () => {
      const harness = await make();
      await harness.givenSite(site, pages);
      expect(await harness.crawler.crawl(site)).toEqual({ ok: true, value: { url: site, pages } });
    });

    it("reports an unreachable site as a CrawlError result", async () => {
      const harness = await make();
      await harness.givenUnreachable(site);
      const result = await harness.crawler.crawl(site);
      expect(result.ok ? undefined : result.error.code).toBe("unreachable");
    });
  });
}
