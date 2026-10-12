import { err, ok, type HttpUrl, type Result } from "@launchpilot/domain";
import type { CrawledPage, CrawledSite, CrawlError, SiteCrawler } from "@launchpilot/ports";
import { httpGet, type HttpGetOptions } from "./http-get";
import { parseHtmlPage } from "./html-page";
import { pickLinks } from "./link-picker";
import { parseRobots } from "./robots";

export const CRAWLER_USER_AGENT = "LaunchPilotBot/1.0 (+https://launchpilot.app/bot)";
const ROBOTS_TOKEN = "LaunchPilotBot";

export interface HttpSiteCrawlerOptions {
  /** Development and test only: lets the crawler reach localhost and LAN addresses. */
  readonly allowPrivateNetwork: boolean;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  /** Home page included. */
  readonly maxPages?: number;
  /** Text budget across all pages, so the brief prompt stays a sensible size. */
  readonly maxTotalChars?: number;
}

const HTML = /^(text\/html|application\/xhtml\+xml)\b/i;

type PageResult = Result<{ page: CrawledPage; links: readonly string[] }, CrawlError>;

const unreachable = (message: string, retryable: boolean): CrawlError => ({
  code: "unreachable",
  message,
  retryable,
});

/** Keeps pages in order until the text budget runs out. */
const withinBudget = (pages: readonly CrawledPage[], budget: number): CrawledPage[] => {
  let left = budget;
  const kept: CrawledPage[] = [];
  for (const page of pages) {
    if (left <= 0) break;
    kept.push({ ...page, text: page.text.slice(0, left) });
    left -= page.text.length;
  }
  return kept;
};

/** Reads the founder's public site politely: robots.txt, one page at a time, same site only. */
export class HttpSiteCrawler implements SiteCrawler {
  private readonly get: HttpGetOptions;
  private readonly maxPages: number;
  private readonly maxTotalChars: number;

  constructor(options: HttpSiteCrawlerOptions) {
    this.get = {
      policy: { allowPrivateNetwork: options.allowPrivateNetwork },
      userAgent: CRAWLER_USER_AGENT,
      timeoutMs: options.timeoutMs ?? 10_000,
      maxBytes: options.maxBytes ?? 2_000_000,
    };
    this.maxPages = options.maxPages ?? 8;
    this.maxTotalChars = options.maxTotalChars ?? 60_000;
  }

  async crawl(url: HttpUrl): Promise<Result<CrawledSite, CrawlError>> {
    const allowed = await this.robots(url);
    if (!allowed(new URL(url).pathname)) {
      return err({
        code: "blocked_by_robots",
        message: "The site's robots.txt does not allow us to read it",
        retryable: false,
      });
    }
    const home = await this.page(url);
    if (!home.ok) return home;

    const pages = [home.value.page];
    const links = pickLinks(home.value.page.url, home.value.links, this.maxPages - 1);
    for (const link of links.filter((l) => allowed(new URL(l).pathname))) {
      const next = await this.page(link);
      if (next.ok) pages.push(next.value.page);
    }
    return ok({ url, pages: withinBudget(pages, this.maxTotalChars) });
  }

  private async robots(url: string): Promise<(path: string) => boolean> {
    const response = await httpGet(new URL("/robots.txt", url).href, this.get);
    const robots = response.ok && response.value.status === 200 ? response.value.body : "";
    return parseRobots(robots, ROBOTS_TOKEN);
  }

  private async page(url: string): Promise<PageResult> {
    const response = await httpGet(url, this.get);
    if (!response.ok) {
      return err(unreachable(response.error.message, response.error.reason !== "blocked"));
    }
    const { status, contentType, body } = response.value;
    if (status >= 400) {
      return err(
        unreachable(`The site answered with HTTP ${status}`, status >= 500 || status === 429),
      );
    }
    if (!HTML.test(contentType)) {
      return err({ code: "not_html", message: "The page is not an HTML page", retryable: false });
    }
    const { title, text, links } = parseHtmlPage(body);
    return ok({ page: { url: response.value.url, title, text }, links });
  }
}
