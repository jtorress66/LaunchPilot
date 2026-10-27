import { err, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";

/**
 * The language a product's content is written in and the market (country) it targets. Any language
 * the runtime's Unicode data knows is accepted; there is no hand-kept list to grow.
 */
export interface ContentLocale {
  /** ISO 639 language code, lower case: "pt". */
  readonly language: string;
  /** ISO 3166 country code, upper case: "BR". */
  readonly market: string;
}

export const defaultLocale: ContentLocale = { language: "en", market: "US" };

const languageNames = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });
const regionNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
const TAG = /^([a-z]{2,3})[-_]([a-z]{2})$/i;

/** Region codes that name a group of countries or a test locale, not a market. */
const NOT_A_MARKET = new Set(["EU", "EZ", "UN", "QO", "XA", "XB", "ZZ"]);

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const TWO_LETTERS = LETTERS.flatMap((a) => LETTERS.map((b) => `${a}${b}`));
const named = (names: Intl.DisplayNames, code: string) => {
  const name = names.of(code);
  return name !== undefined && name !== code;
};

/** Two-letter language codes the runtime can name: "pt", "de", … */
export const contentLanguages: readonly string[] = TWO_LETTERS.filter((code) =>
  named(languageNames, code),
);

/** Country codes the runtime can name, without groupings such as EU or UN: "BR", "DE", … */
export const contentMarkets: readonly string[] = TWO_LETTERS.map((code) =>
  code.toUpperCase(),
).filter((code) => !NOT_A_MARKET.has(code) && named(regionNames, code));

const invalid = (value: string) =>
  err(
    domainError("invalid_locale", `"${value}" is not a language and market such as en-US or pt-BR`),
  );

export const parseContentLocale = (value: string): Result<ContentLocale, DomainError> => {
  const match = TAG.exec(value.trim());
  if (!match?.[1] || !match[2]) return invalid(value);
  const language = match[1].toLowerCase();
  const market = match[2].toUpperCase();
  if (!named(languageNames, language) || !named(regionNames, market) || NOT_A_MARKET.has(market)) {
    return invalid(value);
  }
  return ok({ language, market });
};

/** "Portuguese (Brazil)": for prompts and the UI. */
export const describeLocale = ({ language, market }: ContentLocale): string =>
  `${languageNames.of(language) ?? language} (${regionNames.of(market) ?? market})`;

/** "pt-BR": how a locale is stored and sent to adapters. */
export const formatLocale = ({ language, market }: ContentLocale): string =>
  `${language}-${market}`;
