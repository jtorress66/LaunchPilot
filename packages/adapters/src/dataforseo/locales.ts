/** Google Ads location codes and language codes DataForSEO expects, per supported locale. */
const locations: Readonly<Record<string, { location_code: number; language_code: string }>> = {
  "en-us": { location_code: 2840, language_code: "en" },
  "en-gb": { location_code: 2826, language_code: "en" },
  "en-ca": { location_code: 2124, language_code: "en" },
  "en-au": { location_code: 2036, language_code: "en" },
  "de-de": { location_code: 2276, language_code: "de" },
  "fr-fr": { location_code: 2250, language_code: "fr" },
  "es-es": { location_code: 2724, language_code: "es" },
};

export const dataForSeoLocation = (locale: string) => locations[locale.toLowerCase()];
