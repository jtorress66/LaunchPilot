import { parse, type HTMLElement } from "node-html-parser";

export interface HtmlPage {
  readonly title: string;
  /** Readable content, one block per line. */
  readonly text: string;
  /** Raw href values, in document order. */
  readonly links: readonly string[];
}

const NOISE = "script, style, noscript, template, svg, iframe, nav, footer, form";

const lines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");

/** Extracts what a person reads on the page; navigation is kept only for its links. */
export const parseHtmlPage = (html: string): HtmlPage => {
  const root = parse(html, { blockTextElements: { script: true, style: true, noscript: true } });
  const links = root
    .querySelectorAll("a[href]")
    .map((a) => a.getAttribute("href") ?? "")
    .filter((href) => href !== "");
  const title = root.querySelector("title")?.text.trim() ?? "";
  const description = root.querySelector('meta[name="description"]')?.getAttribute("content");

  const body: HTMLElement = root.querySelector("body") ?? root;
  for (const element of body.querySelectorAll(NOISE)) element.remove();

  return {
    title,
    text: [...lines(description ?? ""), ...lines(body.structuredText)].join("\n"),
    links,
  };
};
