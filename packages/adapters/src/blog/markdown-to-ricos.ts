import { Lexer, type Token, type Tokens } from "marked";

/** The subset of Wix's Ricos rich-content format that Nuvantre writes. */
export interface RicosDecoration {
  readonly type: "BOLD" | "ITALIC" | "STRIKETHROUGH" | "LINK";
  readonly linkData?: { readonly link: { readonly url: string; readonly target: "SELF" } };
}

export interface RicosNode {
  readonly type: string;
  readonly id: string;
  readonly nodes: readonly RicosNode[];
  readonly textData?: { readonly text: string; readonly decorations: readonly RicosDecoration[] };
  readonly [data: `${string}Data`]: unknown;
}

export interface RicosDocument {
  readonly nodes: readonly RicosNode[];
}

const SAFE_LINK = /^(https?:|mailto:|\/|#)/i;

const textNode = (text: string, decorations: readonly RicosDecoration[]): RicosNode => ({
  type: "TEXT",
  id: "",
  nodes: [],
  textData: { text, decorations },
});

const inline = (
  tokens: readonly Token[],
  decorations: readonly RicosDecoration[] = [],
): RicosNode[] =>
  tokens.flatMap((token): RicosNode[] => {
    switch (token.type) {
      case "strong":
        return inline((token as Tokens.Strong).tokens, [...decorations, { type: "BOLD" }]);
      case "em":
        return inline((token as Tokens.Em).tokens, [...decorations, { type: "ITALIC" }]);
      case "del":
        return inline((token as Tokens.Del).tokens, [...decorations, { type: "STRIKETHROUGH" }]);
      case "link": {
        const link = token as Tokens.Link;
        const linked: RicosDecoration[] = SAFE_LINK.test(link.href)
          ? [{ type: "LINK", linkData: { link: { url: link.href, target: "SELF" } } }]
          : [];
        return inline(link.tokens, [...decorations, ...linked]);
      }
      case "text": {
        const nested = (token as Tokens.Text).tokens;
        return nested?.length ? inline(nested, decorations) : [textNode(token.raw, decorations)];
      }
      case "br":
        return [textNode("\n", decorations)];
      case "codespan":
      case "escape":
        return [textNode((token as Tokens.Codespan | Tokens.Escape).text, decorations)];
      default:
        // Raw HTML and anything else stays visible as the text that was written.
        return [textNode(token.raw, decorations)];
    }
  });

/** Converts an article's Markdown into Ricos nodes; ids are n1, n2, … in document order. */
export const markdownToRicos = (markdown: string): RicosDocument => {
  let next = 0;
  const id = () => `n${String(++next)}`;
  const paragraph = (tokens: readonly Token[]): RicosNode => ({
    type: "PARAGRAPH",
    id: id(),
    nodes: inline(tokens),
    paragraphData: {},
  });

  const block = (token: Token): RicosNode[] => {
    switch (token.type) {
      case "heading": {
        const heading = token as Tokens.Heading;
        return [
          {
            type: "HEADING",
            id: id(),
            nodes: inline(heading.tokens),
            headingData: { level: heading.depth },
          },
        ];
      }
      case "paragraph":
        return [paragraph((token as Tokens.Paragraph).tokens)];
      case "text": {
        const text = token as Tokens.Text;
        return [paragraph(text.tokens ?? [{ type: "text", raw: text.text, text: text.text }])];
      }
      case "list": {
        const list = token as Tokens.List;
        return [
          {
            type: list.ordered ? "ORDERED_LIST" : "BULLETED_LIST",
            id: id(),
            nodes: list.items.map((item) => ({
              type: "LIST_ITEM",
              id: id(),
              nodes: item.tokens.flatMap(block),
            })),
          },
        ];
      }
      case "code":
        return [
          {
            type: "CODE_BLOCK",
            id: id(),
            nodes: [textNode((token as Tokens.Code).text, [])],
            codeBlockData: {},
          },
        ];
      case "blockquote":
        return [
          {
            type: "BLOCKQUOTE",
            id: id(),
            nodes: (token as Tokens.Blockquote).tokens.flatMap(block),
            blockquoteData: {},
          },
        ];
      case "hr":
        return [{ type: "DIVIDER", id: id(), nodes: [], dividerData: {} }];
      case "space":
        return [];
      default:
        // Tables and raw HTML blocks are kept as plain text in a paragraph.
        return [paragraph([{ type: "text", raw: token.raw.trim(), text: token.raw.trim() }])];
    }
  };

  return { nodes: Lexer.lex(markdown, { gfm: true }).flatMap(block) };
};
