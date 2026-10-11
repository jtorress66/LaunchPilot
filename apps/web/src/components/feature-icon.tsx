import type { Feature } from "../content/landing";

const paths: Record<Feature["icon"], string> = {
  search: "M21 21l-4.35-4.35M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z",
  rocket: "M5 19l3-1 8-8a4 4 0 0 0-6-6l-8 8-1 3 4 4zM14 6l4 4M9 15l-4 4",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
};

export function FeatureIcon({ name }: { readonly name: Feature["icon"] }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-700/15 dark:text-brand-400">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d={paths[name]} />
      </svg>
    </span>
  );
}
