import { Logo } from "./logo";

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          LaunchPilot
        </a>
        <nav aria-label="Main" className="flex items-center gap-6 text-sm">
          <a
            href="#how-it-works"
            className="hidden text-slate-600 hover:text-slate-900 sm:inline dark:text-slate-400 dark:hover:text-white"
          >
            How it works
          </a>
          <a
            href="#features"
            className="hidden text-slate-600 hover:text-slate-900 sm:inline dark:text-slate-400 dark:hover:text-white"
          >
            Features
          </a>
          <a
            href="#early-access"
            className="rounded-lg bg-brand-600 px-3.5 py-2 font-medium text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Get early access
          </a>
        </nav>
      </div>
    </header>
  );
}
