export function PlanBadge({ name, paid }: { readonly name: string; readonly paid: boolean }) {
  return (
    <span
      data-testid="plan-badge"
      className={
        paid
          ? "inline-flex items-center rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white"
          : "inline-flex items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      }
    >
      {name} plan
    </span>
  );
}
