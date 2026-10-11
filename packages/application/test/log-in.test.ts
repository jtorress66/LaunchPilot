import { describe, expect, it } from "vitest";
import { LogIn } from "../src";
import { makeWorld, PASSWORD, signedUp } from "./world";

const invalid = {
  ok: false,
  error: { code: "invalid_credentials", message: "Email or password is incorrect" },
};

describe("LogIn", () => {
  it("starts a new session for the right email and password", async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    const result = await new LogIn(world).execute({
      email: " Founder@acme.dev",
      password: PASSWORD,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.userId).toBe(user.id);
    expect(await world.sessions.findByToken(result.value.token)).toEqual(result.value);
  });

  it("refuses a wrong password", async () => {
    const world = makeWorld();
    await signedUp(world);
    expect(
      await new LogIn(world).execute({ email: "founder@acme.dev", password: "wrong password!" }),
    ).toEqual(invalid);
  });

  it("gives an unknown email the same answer and still checks a password, so timing reveals nothing", async () => {
    const world = makeWorld();
    const result = await new LogIn(world).execute({ email: "nobody@acme.dev", password: PASSWORD });
    expect(result).toEqual(invalid);
    expect(world.hasher.verifyCalls).toBe(1);
  });

  it("gives a malformed email the same answer", async () => {
    const world = makeWorld();
    expect(await new LogIn(world).execute({ email: "nope", password: PASSWORD })).toEqual(invalid);
  });
});
