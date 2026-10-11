/** Landing-page copy lives here so sections render data and new items need no component changes. */

export const EARLY_ACCESS_EMAIL = "hello@launchpilot.app";

export interface Step {
  readonly title: string;
  readonly body: string;
}

export const steps: readonly Step[] = [
  {
    title: "Paste your URL",
    body: "LaunchPilot reads your site and drafts a Product Brief: who it's for, the problem it solves, and how it's different.",
  },
  {
    title: "Get a weekly plan",
    body: "A strategist turns the brief into a weekly plan of articles, launches, and posts, ranked by expected impact.",
  },
  {
    title: "Approve in one inbox",
    body: "Every draft lands in your approval inbox. Edit, approve, or reject. Nothing is published until you say so.",
  },
  {
    title: "See what worked",
    body: "A weekly report pulls Search Console and analytics data and feeds the results back into next week's plan.",
  },
];

export interface Feature {
  readonly icon: "search" | "rocket" | "chat" | "chart";
  readonly title: string;
  readonly body: string;
}

export const features: readonly Feature[] = [
  {
    icon: "search",
    title: "SEO content engine",
    body: "Keyword research, a content plan, and long-form articles grounded in your brief, published to your blog once approved.",
  },
  {
    icon: "rocket",
    title: "Launches & directories",
    body: "A ready-to-paste launch kit and a tracker for Product Hunt and SaaS directories, so every submission is consistent.",
  },
  {
    icon: "chat",
    title: "Social on autopilot",
    body: "A content calendar for X and LinkedIn through official APIs. Community posts stay drafts you share yourself.",
  },
  {
    icon: "chart",
    title: "Analytics that close the loop",
    body: "Search Console, GA4, or Plausible metrics turned into a plain-English weekly report with next actions.",
  },
];

export const safeguards: readonly string[] = [
  "Nothing goes live without your approval",
  "Only facts from your brief and your own site",
  "Official platform APIs — no scraping, no fake engagement",
  "Reddit, Hacker News & Indie Hackers stay draft-only",
  "OAuth tokens encrypted at rest",
];
