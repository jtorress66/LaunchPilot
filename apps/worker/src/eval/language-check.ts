/**
 * The most common short words of the languages the evals cover. Enough to tell which language a
 * text is in; a language without a list here is not checked.
 */
const commonWords: Readonly<Record<string, ReadonlySet<string>>> = {
  en: new Set("the and is to of for with that you what how this are it in your".split(" ")),
  de: new Set("der die das und ist für mit wie sie nicht ein eine zu den was wollen".split(" ")),
  pt: new Set("o os as é para com que não um uma do da como isso e você".split(" ")),
  es: new Set("el la los las es para con que no un una del cómo y esta qué".split(" ")),
};

const MIN_HITS = 3;

/** The covered language with the most common words in the text, if any stands out. */
export const dominantLanguage = (text: string): string | undefined => {
  const words = text.toLowerCase().split(/[^\p{L}]+/u);
  const ranked = Object.entries(commonWords)
    .map(([language, list]) => ({ language, hits: words.filter((w) => list.has(w)).length }))
    .sort((a, b) => b.hits - a.hits);
  const [best] = ranked;
  return best && best.hits >= MIN_HITS ? best.language : undefined;
};

/** False only when the text is clearly in another covered language. */
export const writesIn = (text: string, language: string): boolean => {
  if (!(language in commonWords)) return true;
  const found = dominantLanguage(text);
  return found === undefined || found === language;
};
