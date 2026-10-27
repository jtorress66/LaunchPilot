/** One thing the founder types when connecting a blog, besides its address and secret key. */
export interface BlogField {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
}

export interface BlogPlatformInfo {
  readonly name: string;
  /** What the address field means on this platform. */
  readonly siteLabel: string;
  readonly fields: readonly BlogField[];
  /** The key or token the founder pastes; stored encrypted. */
  readonly secret: { readonly label: string; readonly hint: string };
}

export const blogPlatformIds = ["wordpress", "ghost", "shopify", "webflow", "wix"] as const;
export type BlogPlatform = (typeof blogPlatformIds)[number];

/**
 * Every blog platform Nuvantre publishes to, and what connecting one asks for. Data, so a new
 * platform is one more row plus its adapters.
 */
export const blogPlatforms: Readonly<Record<BlogPlatform, BlogPlatformInfo>> = {
  wordpress: {
    name: "WordPress",
    siteLabel: "Blog address",
    fields: [
      {
        key: "username",
        label: "WordPress username",
        hint: "An Editor or Administrator account.",
      },
    ],
    secret: {
      label: "Application Password",
      hint: "In WordPress, open Users → Profile → Application Passwords, name it “Nuvantre” and paste it here.",
    },
  },
  ghost: {
    name: "Ghost",
    siteLabel: "Blog address",
    fields: [],
    secret: {
      label: "Admin API key",
      hint: "In Ghost, open Settings → Integrations → Add custom integration and copy its Admin API key.",
    },
  },
  shopify: {
    name: "Shopify",
    siteLabel: "Store address (your-store.myshopify.com)",
    fields: [],
    secret: {
      label: "Admin API access token",
      hint: "In Shopify, open Settings → Apps → Develop apps, create an app with the write_content scope, install it and copy its Admin API access token.",
    },
  },
  webflow: {
    name: "Webflow",
    siteLabel: "Site address",
    fields: [
      {
        key: "collectionId",
        label: "Webflow collection ID",
        hint: "Your blog collection's ID: in the Designer, open CMS → the blog collection → Settings.",
      },
    ],
    secret: {
      label: "Site API token",
      hint: "In Webflow, open Site settings → Apps & integrations → API access and generate a token with CMS read and write access.",
    },
  },
  wix: {
    name: "Wix",
    siteLabel: "Site address",
    fields: [
      {
        key: "siteId",
        label: "Wix site ID",
        hint: "The ID in your dashboard's address: manage.wix.com/dashboard/<site ID>.",
      },
    ],
    secret: {
      label: "API key",
      hint: "In Wix, open Account settings → API Keys, create a key with Wix Blog permissions and paste it here.",
    },
  },
};

export const isBlogPlatform = (value: string): value is BlogPlatform =>
  (blogPlatformIds as readonly string[]).includes(value);
