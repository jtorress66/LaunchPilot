import {
  channels,
  directoryKinds,
  directoryPricings,
  err,
  ok,
  parseDirectory,
  type Directory,
  type Result,
} from "@nuvantre/domain";
import { z } from "zod";

const limit = z.number().int().positive().optional();

/** One curated entry as stored in `directories.json`. Research notes (e.g. evidence) are ignored. */
const entrySchema = z.object({
  slug: z.string(),
  name: z.string(),
  kind: z.enum(directoryKinds),
  channel: z.enum(channels),
  homepageUrl: z.string(),
  submitUrl: z.string(),
  pricing: z.enum(directoryPricings),
  priceNote: z.string().nullable(),
  topics: z.array(z.string()),
  limits: z.object({ tagline: limit, shortDescription: limit, longDescription: limit }),
  checkedAt: z.string(),
});

const slugOf = (raw: unknown) =>
  typeof raw === "object" && raw !== null && "slug" in raw ? String(raw.slug) : "(no slug)";

/** Validates the curated catalogue: shape with Zod, meaning with the domain. */
export const parseSeedDirectories = (json: unknown): Result<Directory[], string> => {
  if (!Array.isArray(json)) return err("The directory seed must be a list of entries");
  const directories: Directory[] = [];
  for (const raw of json as unknown[]) {
    const shape = entrySchema.safeParse(raw);
    if (!shape.success) {
      const issue = shape.error.issues[0];
      return err(
        `${slugOf(raw)}: ${issue?.path.join(".") ?? ""} ${issue?.message ?? "is invalid"}`,
      );
    }
    const { limits, ...rest } = shape.data;
    const directory = parseDirectory({
      ...rest,
      limits: Object.fromEntries(Object.entries(limits).filter(([, v]) => v !== undefined)),
    });
    if (!directory.ok) return err(`${shape.data.slug}: ${directory.error.message}`);
    if (directories.some((d) => d.slug === directory.value.slug)) {
      return err(`Duplicate directory slug: ${directory.value.slug}`);
    }
    directories.push(directory.value);
  }
  return ok(directories);
};
