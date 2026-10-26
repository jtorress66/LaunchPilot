import { randomUUID } from "node:crypto";
import type { IdGenerator } from "@nuvantre/ports";

/** Random (v4) UUIDs from the OS CSPRNG. */
export class UuidIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
