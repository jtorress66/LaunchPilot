import type { JsonSchema } from "@nuvantre/ports";
import { z } from "zod";

const post = z.object({ title: z.string(), body: z.string() });

/** The model's answer, validated at the edge. Field limits are checked by the writer. */
export const kitAnswer = z.object({
  listing: z.object({
    name: z.string(),
    tagline: z.string(),
    shortDescription: z.string(),
    longDescription: z.string(),
    features: z.array(z.string()),
    categories: z.array(z.string()),
    makerComment: z.string(),
  }),
  community: z.object({ hackernews: post, reddit: post, indiehackers: post }),
  citedFacts: z.array(z.string()).max(50),
});

export type KitAnswer = z.infer<typeof kitAnswer>;

const text = { type: "string" } as const;
const postSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "body"],
  properties: { title: text, body: text },
} as const;

export const kitAnswerJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["listing", "community", "citedFacts"],
  properties: {
    listing: {
      type: "object",
      additionalProperties: false,
      required: [
        "name",
        "tagline",
        "shortDescription",
        "longDescription",
        "features",
        "categories",
        "makerComment",
      ],
      properties: {
        name: text,
        tagline: text,
        shortDescription: text,
        longDescription: text,
        features: { type: "array", items: text },
        categories: { type: "array", items: text },
        makerComment: text,
      },
    },
    community: {
      type: "object",
      additionalProperties: false,
      required: ["hackernews", "reddit", "indiehackers"],
      properties: { hackernews: postSchema, reddit: postSchema, indiehackers: postSchema },
    },
    citedFacts: { type: "array", items: text },
  },
};
