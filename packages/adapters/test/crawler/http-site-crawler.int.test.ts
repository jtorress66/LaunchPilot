import { parseHttpUrl, type HttpUrl } from "@launchpilot/domain";
import type { CrawledPage } from "@launchpilot/ports";
import { describeSiteCrawlerContract } from "@launchpilot/testing/contracts";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HttpSiteCrawler, type HttpSiteCrawlerOptions } from "../../src";

type Route = (req: IncomingMessage, res: ServerResponse) => void;

/** A local website whose routes each test arranges. Records every path requested. */
const site = {
  routes: new Map<string, Route>(),
  requests: [] as { path: string; userAgent: string | undefined }[],
};
let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url ?? "/";
    site.requests.push({ path, userAgent: req.headers["user-agent"] });
    const route = site.routes.get(path.split("?")[0] ?? path);
    if (route) route(req, res);
    else res.writeHead(404).end("Not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
beforeEach(() => {
  site.routes.clear();
  site.requests = [];
});

const html =
  (body: string, title = "Page"): Route =>
  (_req, res) => {
    res
      .writeHead(200, { "content-type": "text/html; charset=utf-8" })
      .end(`<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`);
  };

const serve = (path: string, route: Route) => site.routes.set(path, route);

const url = (path = ""): HttpUrl => {
  const parsed = parseHttpUrl(new URL(path, base).href);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
};

const crawler = (options: Partial<HttpSiteCrawlerOptions> = {}) =>
  new HttpSiteCrawler({ allowPrivateNetwork: true, ...options });

const requested = () => site.requests.map((r) => r.path);

describeSiteCrawlerContract("HttpSiteCrawler (local server)", () => ({
  crawler: crawler(),
  get baseUrl() {
    return base;
  },
  givenSite: (_url, pages: readonly CrawledPage[]) => {
    const links = pages.map((p) => `<a href="${new URL(p.url).pathname}">${p.title}</a>`).join("");
    for (const page of pages) {
      serve(new URL(page.url).pathname, html(`<nav>${links}</nav><p>${page.text}</p>`, page.title));
    }
  },
  givenUnreachable: () => {
    site.routes.clear();
  },
}));

describe("HttpSiteCrawler", () => {
  it("crawls the home page, then the most useful same-site pages up to the limit", async () => {
    serve(
      "/",
      html(
        '<a href="/blog">Blog</a><a href="/about">About</a><a href="/pricing">Pricing</a><p>Home</p>',
      ),
    );
    for (const path of ["/blog", "/about", "/pricing"]) serve(path, html(`<p>${path}</p>`));
    const result = await crawler({ maxPages: 3 }).crawl(url());
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.pages.map((p) => new URL(p.url).pathname)).toEqual([
      "/",
      "/pricing",
      "/about",
    ]);
    expect(requested()).not.toContain("/blog");
  });

  it("never follows links to other sites", async () => {
    serve("/", html('<a href="https://example.com/pricing">Elsewhere</a><p>Home</p>'));
    const result = await crawler().crawl(url());
    expect(result.ok && result.value.pages).toHaveLength(1);
  });

  it("identifies itself with its own user agent", async () => {
    serve("/", html("<p>Home</p>"));
    await crawler().crawl(url());
    expect(site.requests[0]?.userAgent).toMatch(/^LaunchPilotBot\/1\.0/);
  });

  it("skips pages robots.txt disallows for our bot", async () => {
    serve("/robots.txt", (_req, res) => {
      res
        .writeHead(200, { "content-type": "text/plain" })
        .end("User-agent: *\nDisallow: /secret\n");
    });
    serve("/", html('<a href="/secret">Secret</a><a href="/about">About</a><p>Home</p>'));
    serve("/about", html("<p>About</p>"));
    serve("/secret", html("<p>Secret</p>"));
    const result = await crawler().crawl(url());
    expect(result.ok && result.value.pages.map((p) => new URL(p.url).pathname)).toEqual([
      "/",
      "/about",
    ]);
    expect(requested()).not.toContain("/secret");
  });

  it("refuses a site whose robots.txt disallows the home page", async () => {
    serve("/robots.txt", (_req, res) => {
      res.writeHead(200).end("User-agent: LaunchPilotBot\nDisallow: /\n");
    });
    serve("/", html("<p>Home</p>"));
    const result = await crawler().crawl(url());
    expect(result.ok ? undefined : result.error.code).toBe("blocked_by_robots");
  });

  it("reports a home page that is not HTML", async () => {
    serve("/", (_req, res) => {
      res.writeHead(200, { "content-type": "application/pdf" }).end("%PDF");
    });
    const result = await crawler().crawl(url());
    expect(result.ok ? undefined : result.error.code).toBe("not_html");
  });

  it("skips linked pages that are not HTML or fail", async () => {
    serve("/", html('<a href="/data">Data</a><a href="/broken">Broken</a><p>Home</p>'));
    serve("/data", (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" }).end("{}");
    });
    const result = await crawler().crawl(url());
    expect(result.ok && result.value.pages).toHaveLength(1);
  });

  it("follows a redirect on the same site", async () => {
    serve("/", (_req, res) => {
      res.writeHead(301, { location: "/home" }).end();
    });
    serve("/home", html("<p>Welcome home</p>"));
    const result = await crawler().crawl(url());
    expect(result.ok && result.value.pages[0]).toMatchObject({
      url: url("home"),
      text: "Welcome home",
    });
  });

  it("refuses a redirect to cloud metadata, even when private networking is allowed", async () => {
    serve("/", (_req, res) => {
      res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" }).end();
    });
    const result = await crawler().crawl(url());
    expect(result).toMatchObject({ ok: false, error: { code: "unreachable", retryable: false } });
  });

  it("refuses a private address when private networking is off", async () => {
    serve("/", html("<p>Home</p>"));
    const result = await crawler({ allowPrivateNetwork: false }).crawl(url());
    expect(result).toMatchObject({ ok: false, error: { code: "unreachable", retryable: false } });
    expect(requested()).toEqual([]);
  });

  it("refuses a host name that resolves to a private address when private networking is off", async () => {
    const port = new URL(base).port;
    const parsed = parseHttpUrl(`http://localhost:${port}/`);
    if (!parsed.ok) throw new Error("bad url");
    const result = await crawler({ allowPrivateNetwork: false }).crawl(parsed.value);
    expect(result).toMatchObject({ ok: false, error: { code: "unreachable", retryable: false } });
    expect(requested()).toEqual([]);
  });

  it("stops reading a page at the size limit", async () => {
    serve("/", html(`<p>${"word ".repeat(50_000)}</p>`));
    const result = await crawler({ maxBytes: 10_000 }).crawl(url());
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.pages[0]?.text.length).toBeLessThan(10_000);
  });

  it("keeps the text of all pages within the total budget", async () => {
    serve("/", html(`<nav><a href="/about">About</a></nav><p>${"a".repeat(800)}</p>`));
    serve("/about", html(`<p>${"b".repeat(800)}</p>`));
    const result = await crawler({ maxTotalChars: 1000 }).crawl(url());
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.pages.map((p) => p.text.length)).toEqual([800, 200]);
  });

  it("gives up on a page that does not answer in time", async () => {
    serve("/", () => {
      // Never responds.
    });
    const result = await crawler({ timeoutMs: 200 }).crawl(url());
    expect(result).toMatchObject({ ok: false, error: { code: "unreachable", retryable: true } });
  });

  it("reports a home page that returns an error status", async () => {
    serve("/", (_req, res) => {
      res.writeHead(503).end("Down");
    });
    const result = await crawler().crawl(url());
    expect(result).toMatchObject({ ok: false, error: { code: "unreachable", retryable: true } });
  });
});
