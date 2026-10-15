"use client";

import { useState } from "react";

/** Copies one listing field to the clipboard, so the founder can paste it into a directory. */
export function CopyButton({ text, label }: { readonly text: string; readonly label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
        });
      }}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      {copied ? "Copied" : `Copy ${label}`}
    </button>
  );
}
