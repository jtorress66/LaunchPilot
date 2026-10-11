export function UsageMeter({
  label,
  used,
  limit,
}: {
  readonly label: string;
  readonly used: number;
  readonly limit: number;
}) {
  const percent = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-slate-600 tabular-nums dark:text-slate-400">
          {used} of {limit}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      >
        <div
          className={`h-full rounded-full ${percent >= 100 ? "bg-amber-500" : "bg-brand-600"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
