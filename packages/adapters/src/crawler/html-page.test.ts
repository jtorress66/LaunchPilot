import { describe, expect, it } from "vitest";
import { parseHtmlPage } from "./html-page";

const html = `<!doctype html>
<html>
  <head>
    <title>Acme &amp; Co — Analytics</title>
    <meta name="description" content="Privacy-friendly analytics for SaaS founders.">
    <style>body { color: red }</style>
    <script>window.track = true;</script>
  </head>
  <body>
    <nav><a href="/pricing">Pricing</a><a href="/about">About</a></nav>
    <main>
      <h1>Know which pages bring signups</h1>
      <p>Start a free 14-day trial.<br>No credit card required.</p>
      <ul><li>GDPR compliant</li><li>No cookies</li></ul>
      <a href="https://acme.dev/features#top">See features</a>
      <noscript>Enable JavaScript</noscript>
      <svg><text>chart</text></svg>
    </main>
    <footer>© 2026 Acme. <a href="mailto:hi@acme.dev">Email</a></footer>
  </body>
</html>`;

describe("parseHtmlPage", () => {
  it("reads the title with entities decoded", () => {
    expect(parseHtmlPage(html).title).toBe("Acme & Co — Analytics");
  });

  it("keeps the meta description, headings, paragraphs and list items as lines", () => {
    const { text } = parseHtmlPage(html);
    expect(text.split("\n")).toEqual([
      "Privacy-friendly analytics for SaaS founders.",
      "Know which pages bring signups",
      "Start a free 14-day trial.",
      "No credit card required.",
      "GDPR compliant",
      "No cookies",
      "See features",
    ]);
  });

  it("drops scripts, styles, navigation, footers and other non-content", () => {
    const { text } = parseHtmlPage(html);
    for (const noise of ["window.track", "color: red", "Enable JavaScript", "chart", "© 2026"]) {
      expect(text).not.toContain(noise);
    }
  });

  it("collects every link, navigation included, for the crawler to choose from", () => {
    expect(parseHtmlPage(html).links).toEqual([
      "/pricing",
      "/about",
      "https://acme.dev/features#top",
      "mailto:hi@acme.dev",
    ]);
  });

  it("copes with a page that has no title or body", () => {
    expect(parseHtmlPage("plain words")).toEqual({ title: "", text: "plain words", links: [] });
  });
});
