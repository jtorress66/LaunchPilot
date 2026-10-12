import { notFound } from "next/navigation";

const ID = /^[\w-]{1,100}$/;

/** Ids arrive from the URL or from bound action arguments, so they are validated like any input. */
export const idParam = (value: string): string => {
  if (!ID.test(value)) notFound();
  return value;
};
