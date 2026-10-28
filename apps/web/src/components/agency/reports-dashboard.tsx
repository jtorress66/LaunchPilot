import type { ProductCard } from "@nuvantre/application";
import Link from "next/link";

/** What a client viewer sees: each product with its latest visitors and a link to its reports. */
export function ReportsDashboard({
  workspaceName,
  cards,
}: {
  readonly workspaceName: string;
  readonly cards: readonly ProductCard[];
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{workspaceName}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Your weekly marketing reports.
        </p>
      </div>
      {cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          No reports yet.
        </p>
      ) : (
        <ul aria-label="Reports" className="space-y-3">
          {cards.map(({ product, visitors }) => (
            <li
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-slate-500">
                  {visitors ? `${String(visitors.value)} visitors last week` : "No report yet"}
                </p>
              </div>
              <Link
                href={`/app/products/${product.id}/analytics`}
                className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                Weekly reports
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
