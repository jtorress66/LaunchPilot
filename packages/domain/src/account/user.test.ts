import { describe, expect, it } from "vitest";
import { userId } from "../shared/ids";
import { parseEmail } from "./email";
import { createUser } from "./user";

describe("createUser", () => {
  it("creates a user with an email and an opaque password hash", () => {
    const email = parseEmail("founder@acme.dev");
    if (!email.ok) throw new Error("setup");
    const now = new Date("2026-05-01T00:00:00.000Z");
    expect(
      createUser({ id: userId("user_1"), email: email.value, passwordHash: "hash", now }),
    ).toEqual({
      id: "user_1",
      email: "founder@acme.dev",
      passwordHash: "hash",
      createdAt: now,
    });
  });
});
