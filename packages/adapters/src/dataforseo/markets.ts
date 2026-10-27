import { err, ok, type ContentLocale, type Result } from "@nuvantre/domain";
import { z } from "zod";

/** What DataForSEO Labs needs to research one language in one country. */
export interface DataForSeoMarket {
  readonly location_code: number;
  readonly language_code: string;
}

/** Markets keyed by "BR:pt". */
export type DataForSeoMarkets = ReadonlyMap<string, DataForSeoMarket>;

const OK = 20000;

const listing = z.object({
  status_code: z.number(),
  status_message: z.string().default(""),
  tasks: z.array(
    z.object({
      status_code: z.number().default(OK),
      result: z.array(
        z.object({
          location_code: z.number(),
          country_iso_code: z.string(),
          available_languages: z.array(
            z.object({
              language_code: z.string(),
              available_sources: z.array(z.string()).default(["google"]),
            }),
          ),
        }),
      ),
    }),
  ),
});

const key = (country: string, language: string) =>
  `${country.toUpperCase()}:${language.toLowerCase()}`;

/**
 * Reads DataForSEO Labs' own list of locations and languages, keeping the ones with Google
 * keyword data. The list is the only source: no market table is kept by hand.
 */
export const parseMarkets = (json: unknown): Result<DataForSeoMarkets, string> => {
  const parsed = listing.safeParse(json);
  if (!parsed.success) return err("DataForSEO listed its markets in an unexpected format");
  if (parsed.data.status_code !== OK) {
    return err(`DataForSEO did not list its markets: ${parsed.data.status_message}`);
  }
  const markets = new Map<string, DataForSeoMarket>();
  for (const location of parsed.data.tasks.flatMap((task) => task.result)) {
    for (const language of location.available_languages) {
      if (!language.available_sources.includes("google")) continue;
      markets.set(key(location.country_iso_code, language.language_code), {
        location_code: location.location_code,
        language_code: language.language_code,
      });
    }
  }
  return ok(markets);
};

export const marketFor = (
  markets: DataForSeoMarkets,
  { language, market }: ContentLocale,
): DataForSeoMarket | undefined => markets.get(key(market, language));
