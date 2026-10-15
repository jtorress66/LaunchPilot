import type { DirectoryEntry } from "@launchpilot/application";
import Link from "next/link";
import type { DirectoryFilter } from "../../server/forms";
import { AddDirectoryButton } from "./add-directory-button";

const kindLabels = {
  launch_platform: "Launch platforms",
  directory: "Directories",
  community: "Communities",
} as const;
const priceLabels = { free: "Free", freemium: "Freemium", paid: "Paid" } as const;

const query = (
  filter: DirectoryFilter,
  change: { readonly kind?: string | undefined; readonly pricing?: string },
) => {
  const params = new URLSearchParams();
  const kind = "kind" in change ? change.kind : filter.kind;
  const pricing = "pricing" in change ? change.pricing : (filter.pricing ?? "all");
  if (kind) params.set("kind", kind);
  if (pricing) params.set("pricing", pricing);
  return `?${params.toString()}#directories`;
};

function FilterLink({
  href,
  active,
  children,
}: {
  readonly href: string;
  readonly active: boolean;
  readonly children: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full px-3 py-1 text-sm ${
        active
          ? "bg-brand-600 text-white"
          : "border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </Link>
  );
}

/** The curated catalogue with kind and price filters. Free directories show by default. */
export function DirectoryBrowser({
  productId,
  entries,
  filter,
}: {
  readonly productId: string;
  readonly entries: readonly DirectoryEntry[];
  readonly filter: DirectoryFilter;
}) {
  return (
    <div className="space-y-4">
      <nav aria-label="Directory filters" className="flex flex-wrap gap-2">
        <FilterLink href={query(filter, { kind: undefined })} active={filter.kind === undefined}>
          All kinds
        </FilterLink>
        {(Object.keys(kindLabels) as (keyof typeof kindLabels)[]).map((kind) => (
          <FilterLink key={kind} href={query(filter, { kind })} active={filter.kind === kind}>
            {kindLabels[kind]}
          </FilterLink>
        ))}
        <span className="mx-1 border-l border-slate-300 dark:border-slate-700" />
        {(Object.keys(priceLabels) as (keyof typeof priceLabels)[]).map((pricing) => (
          <FilterLink
            key={pricing}
            href={query(filter, { pricing })}
            active={filter.pricing === pricing}
          >
            {priceLabels[pricing]}
          </FilterLink>
        ))}
        <FilterLink href={query(filter, { pricing: "all" })} active={filter.pricing === undefined}>
          Any price
        </FilterLink>
      </nav>
      <ul aria-label="Directories" className="divide-y divide-slate-200 dark:divide-slate-800">
        {entries.map(({ directory, tracked }) => (
          <li
            key={directory.slug}
            className="flex flex-wrap items-start justify-between gap-3 py-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">
                <a
                  href={directory.homepageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {directory.name}
                </a>{" "}
                <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {priceLabels[directory.pricing]}
                </span>
              </p>
              {directory.priceNote ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">{directory.priceNote}</p>
              ) : null}
              <p className="text-xs text-slate-500">
                {directory.topics.join(" · ")} · checked{" "}
                {directory.checkedAt.toISOString().slice(0, 10)}
              </p>
            </div>
            {tracked ? (
              <span className="text-sm text-emerald-700 dark:text-emerald-400">
                On your tracker
              </span>
            ) : (
              <AddDirectoryButton
                productId={productId}
                slug={directory.slug}
                name={directory.name}
              />
            )}
          </li>
        ))}
      </ul>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No directories match these filters.</p>
      ) : null}
    </div>
  );
}
