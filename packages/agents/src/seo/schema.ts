import type { JsonSchema } from "@nuvantre/ports";
import { z } from "zod";

/** Validates the model's answer at the edge; limits match the ContentItem entity's. */
export const articleAnswer = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(100_000),
  citedFacts: z.array(z.string()).max(50),
  slug: z.string().trim().max(200),
  excerpt: z.string().trim().min(1).max(2_000),
});

export type ArticleAnswer = z.infer<typeof articleAnswer>;

export const articleAnswerJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "body", "citedFacts", "slug", "excerpt"],
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    citedFacts: { type: "array", items: { type: "string" } },
    slug: { type: "string" },
    excerpt: { type: "string" },
  },
};
