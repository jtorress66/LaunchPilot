import { describe, expect, it } from "vitest";
import { markdownToRicos } from "./markdown-to-ricos";

const text = (value: string, decorations: object[] = []) => ({
  type: "TEXT",
  id: "",
  nodes: [],
  textData: { text: value, decorations },
});

describe("markdownToRicos", () => {
  it("turns paragraphs and headings into Ricos nodes with their own ids", () => {
    expect(markdownToRicos("## Why it matters\n\nFive numbers a week.")).toEqual({
      nodes: [
        { type: "HEADING", id: "n1", nodes: [text("Why it matters")], headingData: { level: 2 } },
        { type: "PARAGRAPH", id: "n2", nodes: [text("Five numbers a week.")], paragraphData: {} },
      ],
    });
  });

  it("keeps bold, italic and links as decorations", () => {
    const [paragraph] = markdownToRicos(
      "A **bold** and *quiet* [guide](https://blog.acme.dev/guide).",
    ).nodes;
    expect(paragraph?.nodes).toEqual([
      text("A "),
      text("bold", [{ type: "BOLD" }]),
      text(" and "),
      text("quiet", [{ type: "ITALIC" }]),
      text(" "),
      text("guide", [
        {
          type: "LINK",
          linkData: { link: { url: "https://blog.acme.dev/guide", target: "SELF" } },
        },
      ]),
      text("."),
    ]);
  });

  it("keeps the words but drops a link that is not http(s), mailto or relative", () => {
    const [paragraph] = markdownToRicos("[click](javascript:alert(1))").nodes;
    expect(paragraph?.nodes).toEqual([text("click")]);
  });

  it("turns bulleted and numbered lists into list items of paragraphs", () => {
    const [bulleted, numbered] = markdownToRicos("- one\n- two\n\n1. first").nodes;
    expect(bulleted).toMatchObject({
      type: "BULLETED_LIST",
      nodes: [
        { type: "LIST_ITEM", nodes: [{ type: "PARAGRAPH", nodes: [text("one")] }] },
        { type: "LIST_ITEM", nodes: [{ type: "PARAGRAPH", nodes: [text("two")] }] },
      ],
    });
    expect(numbered).toMatchObject({ type: "ORDERED_LIST", nodes: [{ type: "LIST_ITEM" }] });
  });

  it("keeps code, quotes and dividers", () => {
    const nodes = markdownToRicos("```\nnpm i\n```\n\n> Said well.\n\n---\n\nUse `x` here.").nodes;
    expect(nodes.map((node) => node.type)).toEqual([
      "CODE_BLOCK",
      "BLOCKQUOTE",
      "DIVIDER",
      "PARAGRAPH",
    ]);
    expect(nodes[0]?.nodes).toEqual([text("npm i")]);
    expect(nodes[1]?.nodes[0]).toMatchObject({ type: "PARAGRAPH", nodes: [text("Said well.")] });
    expect(nodes[3]?.nodes).toEqual([text("Use "), text("x"), text(" here.")]);
  });

  it("shows raw HTML as text instead of rendering it", () => {
    const [paragraph] = markdownToRicos("Hi <script>alert(1)</script>").nodes;
    expect(paragraph?.nodes.map((node) => node.textData?.text).join("")).toBe(
      "Hi <script>alert(1)</script>",
    );
  });
});
