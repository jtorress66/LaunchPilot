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

const invalid = (value: string) =>
  err(
    domainError("invalid_locale", `"${value}" is not a language and market such as en-US or pt-BR`),
  );

export const parseContentLocale = (value: string): Result<ContentLocale, DomainError> => {
  const match = TAG.exec(value.trim());
  if (!match?.[1] || !match[2]) return invalid(value);
  const language = match[1].toLowerCase();
  const market = match[2].toUpperCase();
  if (languageNames.of(language) === undefined || regionNames.of(market) === undefined) {
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
