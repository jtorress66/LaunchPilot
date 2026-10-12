"use client";

import { useEffect, useState } from "react";

/** Shows a moment in the founder's own timezone; UTC until the browser takes over. */
export function LocalTime({ iso }: { readonly iso: string }) {
  const [text, setText] = useState(`${iso.slice(0, 16).replace("T", " ")} UTC`);
  useEffect(() => {
    setText(
      new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(iso),
      ),
    );
  }, [iso]);
  return <time dateTime={iso}>{text}</time>;
}
