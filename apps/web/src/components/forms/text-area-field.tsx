interface TextAreaFieldProps {
  readonly label: string;
  readonly name: string;
  readonly defaultValue: string;
  readonly rows?: number;
  readonly hint?: string;
  readonly error?: string | undefined;
}

export function TextAreaField({
  label,
  name,
  defaultValue,
  rows = 3,
  hint,
  error,
}: TextAreaFieldProps) {
  const hintId = `${name}-hint`;
  const errorId = `${name}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy === "" ? undefined : describedBy}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 aria-invalid:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      {hint ? (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
