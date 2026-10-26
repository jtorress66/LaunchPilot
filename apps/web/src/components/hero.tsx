import Link from "next/link";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-[28rem] max-w-3xl rounded-full bg-gradient-to-tr from-brand-400/40 to-fuchsia-400/30 blur-3xl dark:from-brand-600/30 dark:to-fuchsia-600/20"
      />
      <div className="mx-auto max-w-4xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
        <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-700/40 dark:bg-brand-700/10 dark:text-brand-400">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          Built for bootstrapped SaaS founders
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          The AI marketing team that runs your growth loop every week
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-slate-600 dark:text-slate-400">
          Nuvantre reads your SaaS, writes your Product Brief, and handles SEO content, launches,
          social posts, and analytics, with you approving every piece before it ships.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="w-full rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:w-auto"
          >
            Start free
          </Link>
          <a
            href="#how-it-works"
            className="w-full rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}
