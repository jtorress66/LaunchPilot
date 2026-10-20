import type { JsonSchema } from "@launchpilot/ports";
import { z } from "zod";

export const planAnswer = z.object({
  name: z.string(),
  goal: z.string(),
  tasks: z
    .array(
      z.object({
        kind: z.enum(["seo_article", "social_post"]),
        channel: z.enum(["blog", "x", "linkedin"]),
        title: z.string(),
        rationale: z.string(),
        keyword: z.string().nullable(),
        angle: z.string().nullable(),
      }),
    )
    .max(20),
});

export type PlanAnswer = z.infer<typeof planAnswer>;

const text = { type: "string" } as const;
const nullableText = { type: ["string", "null"] } as const;

export const planAnswerJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "goal", "tasks"],
  properties: {
    name: text,
    goal: text,
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "channel", "title", "rationale", "keyword", "angle"],
        properties: {
          kind: { type: "string", enum: ["seo_article", "social_post"] },
          channel: { type: "string", enum: ["blog", "x", "linkedin"] },
          title: text,
          rationale: text,
          keyword: nullableText,
          angle: nullableText,
        },
      },
    },
  },
};
