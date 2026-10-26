import { safeguards } from "../content/landing";

export function ApprovalSection() {
  return (
    <section className="py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase dark:text-brand-400">
            You stay in control
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Automation with a founder-shaped safety switch
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Nuvantre drafts and schedules, but publishing is gated on your approval, enforced in
            code rather than in a settings toggle.
          </p>
        </div>
        <ul className="space-y-3">
          {safeguards.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="mt-0.5 h-5 w-5 flex-none fill-emerald-500"
              >
                <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.7-9.3-4.5 4.5a1 1 0 0 1-1.4 0l-2-2a1 1 0 1 1 1.4-1.4l1.3 1.3 3.8-3.8a1 1 0 1 1 1.4 1.4z" />
              </svg>
              <span className="font-medium">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
