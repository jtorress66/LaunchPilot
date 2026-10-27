import { contentLanguages, contentMarkets } from "@nuvantre/domain";

export interface LocaleOption {
  readonly code: string;
  readonly name: string;
}

const named = (codes: readonly string[], type: "language" | "region"): LocaleOption[] => {
  const names = new Intl.DisplayNames(["en"], { type });
  return codes
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
};

/** Every language and country the domain accepts, by English name. */
export const languageOptions: readonly LocaleOption[] = named(contentLanguages, "language");
export const marketOptions: readonly LocaleOption[] = named(contentMarkets, "region");
