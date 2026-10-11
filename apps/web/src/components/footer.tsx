import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 py-10 dark:border-slate-800">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
        <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
          <Logo />
          LaunchPilot
        </span>
        <span>
          © {new Date().getFullYear()} LaunchPilot. Marketing on autopilot, with you at the
          controls.
        </span>
      </div>
    </footer>
  );
}
