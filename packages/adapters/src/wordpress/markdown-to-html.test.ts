import { describe, expect, it } from "vitest";
import { markdownToHtml } from "./markdown-to-html";

describe("markdownToHtml", () => {
  it("renders headings, paragraphs, emphasis and lists", () => {
    const html = markdownToHtml("Intro with **bold**.\n\n## Why it matters\n\n- one\n- two\n");
    expect(html).toContain("<p>Intro with <strong>bold</strong>.</p>");
    expect(html).toContain("<h2>Why it matters</h2>");
    expect(html).toContain("<ul>\n<li>one</li>\n<li>two</li>\n</ul>");
  });

  it("renders links", () => {
    expect(markdownToHtml("[Acme](https://acme.dev)")).toContain(
      '<a href="https://acme.dev">Acme</a>',
    );
  });

  it("escapes raw HTML instead of passing it through", () => {
    const html = markdownToHtml('Hello <script>alert("x")</script>\n\n<iframe src="x"></iframe>');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops javascript: links", () => {
    expect(markdownToHtml("[click](javascript:alert(1))")).not.toContain("javascript:");
  });
});
