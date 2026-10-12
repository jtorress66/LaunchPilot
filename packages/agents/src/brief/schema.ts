import type { JsonSchema } from "@launchpilot/ports";
import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

/** Validates the model's answer at the edge; limits match the Brief entity's. */
export const briefAnswer = z.object({
  audience: text(2000),
  problem: text(2000),
  solution: text(2000),
  differentiators: z.array(text(500)).max(10),
  tone: text(2000),
  facts: z.array(z.object({ statement: text(500), quote: z.string() })).max(20),
});

export type BriefAnswer = z.infer<typeof briefAnswer>;

const string = { type: "string" } as const;

/** The same shape as JSON Schema, for the provider's structured output feature. */
export const briefAnswerJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["audience", "problem", "solution", "differentiators", "tone", "facts"],
  properties: {
    audience: string,
    problem: string,
    solution: string,
    differentiators: { type: "array", items: string },
    tone: string,
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["statement", "quote"],
        properties: { statement: string, quote: string },
      },
    },
  },
};
