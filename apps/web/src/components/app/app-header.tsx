import Link from "next/link";
import { logOutAction } from "../../app/_lib/actions";
import { Logo } from "../logo";

export function AppHeader({
  workspaceName,
  email,
  inboxCount,
}: {
  readonly workspaceName: string;
  readonly email: string;
  /** Items waiting for the founder's approval. */
  readonly inboxCount: number;
}) {
  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/app" className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo />
            <span className="hidden sm:inline">Nuvantre</span>
          </Link>
          <nav aria-label="App" className="flex gap-4 text-sm">
            <Link
              href="/app"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/app/inbox"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Inbox{inboxCount > 0 ? ` (${String(inboxCount)})` : ""}
            </Link>
            <Link
              href="/app/activity"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Activity
            </Link>
            <Link
              href="/app/billing"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Billing
            </Link>
          </nav>
        </div>
        <div className="flex min-w-0 items-center gap-3 text-sm">
          <span className="hidden truncate text-slate-500 md:inline" title={email}>
            {workspaceName} · {email}
          </span>
          <form action={logOutAction}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
