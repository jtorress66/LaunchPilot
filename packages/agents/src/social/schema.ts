import type { JsonSchema } from "@nuvantre/ports";
import { z } from "zod";

/** Validates the model's answer at the edge; the channel limit is checked by the writer. */
export const postAnswer = z.object({
  text: z.string().trim().min(1),
  citedFacts: z.array(z.string()).max(20),
});

export type PostAnswer = z.infer<typeof postAnswer>;

export const postAnswerJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "citedFacts"],
  properties: {
    text: { type: "string" },
    citedFacts: { type: "array", items: { type: "string" } },
  },
};
