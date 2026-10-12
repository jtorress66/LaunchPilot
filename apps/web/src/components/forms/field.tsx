interface FieldProps {
  readonly label: string;
  readonly name: string;
  readonly type?: string;
  readonly error?: string | undefined;
  readonly autoComplete?: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly defaultValue?: string;
}

export function Field({
  label,
  name,
  type = "text",
  error,
  autoComplete,
  placeholder,
  hint,
  defaultValue,
}: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 aria-invalid:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      {hint && !error ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
