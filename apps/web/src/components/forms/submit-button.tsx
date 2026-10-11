"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pending,
}: {
  readonly children: ReactNode;
  readonly pending: string;
}) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-wait disabled:opacity-70"
    >
      {status.pending ? pending : children}
    </button>
  );
}
