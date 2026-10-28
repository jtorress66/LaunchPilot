import Link from "next/link";
import { logOutAction } from "../../app/_lib/actions";
import { WorkspaceSwitcher, type SwitcherWorkspace } from "../agency/workspace-switcher";
import type { NavItem } from "../../server/app-nav";
import { Logo } from "../logo";

const navLink =
  "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white whitespace-nowrap";

export function AppHeader({
  workspaceName,
  email,
  nav,
  isClient,
  current,
  workspaces,
}: {
  readonly workspaceName: string;
  readonly email: string;
  /** What this person's role lets them open, in order. */
  readonly nav: readonly NavItem[];
  readonly isClient: boolean;
  readonly current: string;
  readonly workspaces: readonly SwitcherWorkspace[];
}) {
  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/app" className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo />
            <span className="hidden sm:inline">Nuvantre</span>
          </Link>
          <nav aria-label="App" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className={navLink}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm">
          <WorkspaceSwitcher current={current} workspaces={workspaces} />
          <span className="hidden truncate text-slate-500 md:inline" title={email}>
            {workspaceName}
            {isClient ? (
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                Client
              </span>
            ) : null}{" "}
            · {email}
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
