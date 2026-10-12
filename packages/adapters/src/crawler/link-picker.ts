/** Pages that usually describe the product, most useful first. */
const PRIORITY = [
  "pricing",
  "features",
  "product",
  "about",
  "faq",
  "how-it-works",
  "integrations",
  "security",
  "use-cases",
  "solutions",
];

const NOT_A_PAGE = /\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|gz|mp4|mp3|css|js|json|xml|txt)$/i;

const priorityOf = (url: URL): number => {
  const path = url.pathname.toLowerCase();
  const index = PRIORITY.findIndex((word) => path.includes(word));
  return index < 0 ? PRIORITY.length : index;
};

const resolve = (href: string, base: URL): URL | undefined => {
  if (!URL.canParse(href, base.href)) return undefined;
  const url = new URL(href, base);
  url.hash = "";
  return url;
};

/** Chooses which same-origin pages to crawl after the home page. */
export const pickLinks = (homeUrl: string, hrefs: readonly string[], max: number): string[] => {
  const home = new URL(homeUrl);
  const seen = new Set([home.href]);
  const candidates: URL[] = [];
  for (const href of hrefs) {
    const url = resolve(href, home);
    if (url?.origin !== home.origin || NOT_A_PAGE.test(url.pathname)) continue;
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    candidates.push(url);
  }
  return candidates
    .map((url, order) => ({ url, order, priority: priorityOf(url) }))
    .sort((a, b) => a.priority - b.priority || a.order - b.order)
    .slice(0, max)
    .map(({ url }) => url.href);
};
