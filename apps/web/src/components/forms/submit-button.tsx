"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pending,
  busy,
}: {
  readonly children: ReactNode;
  readonly pending: string;
  /** For forms submitted by hand, which useFormStatus cannot see. */
  readonly busy?: boolean;
}) {
  const status = useFormStatus();
  const waiting = busy ?? status.pending;
  return (
    <button
      type="submit"
      disabled={waiting}
      className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-wait disabled:opacity-70"
    >
      {waiting ? pending : children}
    </button>
  );
}
