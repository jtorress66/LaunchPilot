import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
  readonly footer: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 font-semibold tracking-tight"
        >
          <Logo />
          Nuvantre
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
          {children}
        </div>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">{footer}</p>
      </div>
    </main>
  );
}
