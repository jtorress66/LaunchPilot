import type { JsonSchema } from "@nuvantre/ports";
import { z } from "zod";

/** The model's answer, validated at the edge. Counts and numbers are checked by the agent. */
export const notesAnswer = z.object({
  summary: z.string(),
  highlights: z.array(z.string()).max(20),
  suggestions: z.array(z.string()).max(20),
  citedFacts: z.array(z.string()).max(50),
});

export type NotesAnswer = z.infer<typeof notesAnswer>;

const text = { type: "string" } as const;

export const notesAnswerJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "highlights", "suggestions", "citedFacts"],
  properties: {
    summary: text,
    highlights: { type: "array", items: text },
    suggestions: { type: "array", items: text },
    citedFacts: { type: "array", items: text },
  },
};
