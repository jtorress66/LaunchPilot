import { Marked, type Tokens } from "marked";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SAFE_LINK = /^(https?:|mailto:|\/|#)/i;

/**
 * Articles are written in Markdown. Raw HTML in them is shown as text, never rendered,
 * and only http(s), mailto and relative links survive.
 */
const marked = new Marked({
  gfm: true,
  renderer: {
    html: ({ text }: { text: string }) => escapeHtml(text),
  },
  walkTokens: (token) => {
    if (token.type !== "link") return;
    const link = token as Tokens.Link;
    if (!SAFE_LINK.test(link.href)) link.href = "#";
  },
});

export const markdownToHtml = (markdown: string): string =>
  marked.parse(markdown, { async: false });
