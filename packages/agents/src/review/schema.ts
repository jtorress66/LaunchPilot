import type { JsonSchema } from "@launchpilot/ports";
import { z } from "zod";

export const verdictAnswer = z.object({
  decision: z.enum(["pass", "needs_changes"]),
  issues: z
    .array(z.object({ severity: z.enum(["blocker", "suggestion"]), message: z.string().min(1) }))
    .max(20),
});

export type VerdictAnswer = z.infer<typeof verdictAnswer>;

export const verdictAnswerJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decision", "issues"],
  properties: {
    decision: { type: "string", enum: ["pass", "needs_changes"] },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "message"],
        properties: {
          severity: { type: "string", enum: ["blocker", "suggestion"] },
          message: { type: "string" },
        },
      },
    },
  },
};
