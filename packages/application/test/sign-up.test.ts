import { effectivePlan, isActive, parseEmail } from "@nuvantre/domain";
import { describe, expect, it } from "vitest";
import { SignUp } from "../src";
import { makeWorld, PASSWORD, signedUp } from "./world";

const email = (value: string) => {
  const parsed = parseEmail(value);
  if (!parsed.ok) throw new Error("bad email");
  return parsed.value;
};

describe("SignUp", () => {
  it("creates the founder, their workspace on the Free plan, and a session", async () => {
    const world = makeWorld();
    const { user, workspace, session } = await signedUp(world, "Founder@Acme.dev");

    expect(user.email).toBe("founder@acme.dev");
    expect(await world.users.findByEmail(email("founder@acme.dev"))).toEqual(user);
    expect(workspace).toMatchObject({ ownerId: user.id, name: "My workspace" });
    expect(await world.workspaces.findByOwner(user.id)).toEqual(workspace);
    const subscription = await world.subscriptions.findByWorkspace(workspace.id);
    expect(subscription && effectivePlan(subscription, world.clock.now())).toBe("free");
    expect(await world.sessions.findByToken(session.token)).toEqual(session);
    expect(isActive(session, world.clock.now())).toBe(true);
  });

  it("stores only a hash of the password", async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(await world.hasher.verify(PASSWORD, user.passwordHash)).toBe(true);
  });

  it("refuses an email that is already registered, whatever its case", async () => {
    const world = makeWorld();
    await signedUp(world, "founder@acme.dev");
    const result = await new SignUp(world).execute({
      email: "FOUNDER@acme.dev",
      password: PASSWORD,
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "email_taken", message: "An account with this email already exists" },
    });
  });

  it.each([
    ["an invalid email", "not-an-email", PASSWORD, "invalid_email"],
    ["a weak password", "founder@acme.dev", "short", "weak_password"],
  ])("refuses %s and creates nothing", async (_case, emailInput, password, code) => {
    const world = makeWorld();
    const result = await new SignUp(world).execute({ email: emailInput, password });
    expect(result.ok ? undefined : result.error.code).toBe(code);
    expect(world.hasher.hashCalls).toBe(0);
    expect(await world.users.findByEmail(email("founder@acme.dev"))).toBeUndefined();
  });
});
