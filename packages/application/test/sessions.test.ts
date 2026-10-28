import { userId } from "@nuvantre/domain";
import { aSession, aUser } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { AuthenticateSession, LogOut } from "../src";
import { makeWorld, signedUp } from "./world";

describe("AuthenticateSession", () => {
  it("resolves a valid session to its founder, their workspace and their role there", async () => {
    const world = makeWorld();
    const { user, workspace, session } = await signedUp(world);
    expect(await new AuthenticateSession(world).execute(session.token)).toEqual({
      ok: true,
      value: { user, workspace, role: "owner", workspaces: [{ workspace, role: "owner" }] },
    });
  });

  it("refuses an unknown token", async () => {
    const world = makeWorld();
    const result = await new AuthenticateSession(world).execute("unknown-token");
    expect(result.ok ? undefined : result.error.code).toBe("unauthenticated");
  });

  it("refuses and deletes an expired session", async () => {
    const world = makeWorld();
    const { session } = await signedUp(world);
    world.clock.advance(31 * 24 * 60 * 60 * 1000);
    const result = await new AuthenticateSession(world).execute(session.token);
    expect(result.ok ? undefined : result.error.code).toBe("session_expired");
    expect(await world.sessions.findByToken(session.token)).toBeUndefined();
  });

  it("refuses a session whose user no longer exists", async () => {
    const world = makeWorld();
    await world.sessions.save(
      aSession({ token: "orphan", userId: userId("user_gone"), now: world.clock.now() }),
    );
    const result = await new AuthenticateSession(world).execute("orphan");
    expect(result.ok ? undefined : result.error.code).toBe("unauthenticated");
  });

  it("refuses a founder without a workspace", async () => {
    const world = makeWorld();
    const lonely = aUser({ id: userId("user_lonely"), email: "lonely@acme.dev" });
    await world.users.save(lonely);
    await world.sessions.save(
      aSession({ token: "lonely", userId: lonely.id, now: world.clock.now() }),
    );
    const result = await new AuthenticateSession(world).execute("lonely");
    expect(result.ok ? undefined : result.error.code).toBe("workspace_not_found");
  });
});

describe("LogOut", () => {
  it("ends the session", async () => {
    const world = makeWorld();
    const { session } = await signedUp(world);
    expect(await new LogOut(world).execute(session.token)).toEqual({ ok: true, value: null });
    expect(await world.sessions.findByToken(session.token)).toBeUndefined();
  });
});
