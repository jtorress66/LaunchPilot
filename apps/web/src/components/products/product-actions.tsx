"use client";

import { useActionState } from "react";
import {
  archiveProductAction,
  makeProductActiveAction,
  restoreProductAction,
  type ProductActionState,
} from "../../app/_lib/product-actions";

const button =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-900";

const ErrorText = ({ state }: { readonly state: ProductActionState }) => {
  const message = state.errors?.form ?? state.errors?.pause;
  return message ? (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {message}
    </p>
  ) : null;
};

/** Puts a product aside: its work is kept and its slot is freed. */
export function ArchiveButton({ id, name }: { readonly id: string; readonly name: string }) {
  const [state, action, busy] = useActionState(archiveProductAction.bind(null, id), {});
  return (
    <form action={action} className="space-y-1">
      <button type="submit" disabled={busy} className={button} aria-label={`Archive ${name}`}>
        Archive
      </button>
      <ErrorText state={state} />
    </form>
  );
}

export function RestoreButton({ id, name }: { readonly id: string; readonly name: string }) {
  const [state, action, busy] = useActionState(restoreProductAction.bind(null, id), {});
  return (
    <form action={action} className="space-y-1">
      <button type="submit" disabled={busy} className={button} aria-label={`Restore ${name}`}>
        Restore
      </button>
      <ErrorText state={state} />
    </form>
  );
}

/** Makes a paused product active in place of the active product the founder picks. */
export function MakeActiveForm({
  id,
  name,
  active,
}: {
  readonly id: string;
  readonly name: string;
  readonly active: readonly { readonly id: string; readonly name: string }[];
}) {
  const [state, action, busy] = useActionState<ProductActionState, FormData>(
    makeProductActiveAction.bind(null, id),
    {},
  );
  const selectId = `pause-for-${id}`;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label htmlFor={selectId} className="block text-xs font-medium text-slate-500">
          Pause instead
        </label>
        <select
          id={selectId}
          name="pause"
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {active.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={busy} className={button} aria-label={`Make ${name} active`}>
        Make active
      </button>
      <ErrorText state={state} />
    </form>
  );
}
