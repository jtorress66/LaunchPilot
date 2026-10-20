const names: Partial<Record<string, string>> = {
  search_console: "Search Console",
  ga4: "Google Analytics 4",
  plausible: "Plausible",
};

export const sourceName = (source: string): string => names[source] ?? source;
