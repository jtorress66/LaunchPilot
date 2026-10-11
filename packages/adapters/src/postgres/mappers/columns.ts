/**
 * Helpers for reading stored values back into domain types. A value that does not fit means the
 * database was changed outside this code, so it throws (rejecting the repository call).
 */
export const oneOf = <T extends string>(
  allowed: readonly T[],
  value: string,
  column: string,
): T => {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) throw new Error(`Unexpected value "${value}" in ${column}`);
  return match;
};

/**
 * jsonb comes back parsed from Postgres, while mappers write JSON text (and unit tests pass text).
 * Accept both so the mapper behaves the same in and out of the database.
 */
export const readJson = (value: unknown): unknown =>
  typeof value === "string" ? (JSON.parse(value) as unknown) : value;

export const toJson = (value: unknown): string => JSON.stringify(value);
