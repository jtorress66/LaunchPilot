import { parseEmail, useWorkspace, userId, workspaceId, type Email } from "@nuvantre/domain";
import type { SessionRepository, SubscriptionRepository, UserRepository } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";
import { aSession, aSubscription, aUser } from "../src/fixtures/accounts";
import { describeRepositoryContract } from "./repository.contract";

type Make<R> = () => R | Promise<R>;

const email = (value: string): Email => {
  const parsed = parseEmail(value);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
};

export function describeUserRepositoryContract(name: string, make: Make<UserRepository>): void {
  describeRepositoryContract(name, {
    make,
    sample: (n) => aUser({ id: userId(`user_${n}`), email: `founder${n}@acme.dev` }),
    modify: (u) => ({ ...u, passwordHash: `${u.passwordHash}-rotated` }),
    unknownId: userId("user_missing"),
  });

  describe(`UserRepository contract: ${name}`, () => {
    it("finds a user by email", async () => {
      const repo = await make();
      const user = aUser({ id: userId("user_1"), email: "founder@acme.dev" });
      await repo.save(user);
      expect(await repo.findByEmail(email("founder@acme.dev"))).toEqual(user);
      expect(await repo.findByEmail(email("someone@else.dev"))).toBeUndefined();
    });
  });
}

export function describeSessionRepositoryContract(
  name: string,
  make: Make<SessionRepository>,
): void {
  describe(`SessionRepository contract: ${name}`, () => {
    it("finds a session by its token after it is saved", async () => {
      const repo = await make();
      const session = aSession({ token: "token-a".padEnd(43, "a") });
      await repo.save(session);
      expect(await repo.findByToken(session.token)).toEqual(session);
    });

    it("returns undefined for an unknown token", async () => {
      const repo = await make();
      await repo.save(aSession());
      expect(await repo.findByToken("unknown".padEnd(43, "x"))).toBeUndefined();
    });

    it("forgets a session once it is deleted", async () => {
      const repo = await make();
      const session = aSession();
      await repo.save(session);
      await repo.delete(session.token);
      expect(await repo.findByToken(session.token)).toBeUndefined();
    });

    it("keeps the workspace a person switched to", async () => {
      const repo = await make();
      const session = aSession();
      await repo.save(session);
      const switched = useWorkspace(session, workspaceId("ws_2"));
      await repo.save(switched);
      expect(await repo.findByToken(session.token)).toEqual(switched);
    });

    it("treats deleting an unknown token as a no-op", async () => {
      const repo = await make();
      await expect(repo.delete("never-saved".padEnd(43, "z"))).resolves.toBeUndefined();
    });
  });
}

export function describeSubscriptionRepositoryContract(
  name: string,
  make: Make<SubscriptionRepository>,
): void {
  describe(`SubscriptionRepository contract: ${name}`, () => {
    it("finds a workspace's subscription after it is saved", async () => {
      const repo = await make();
      const subscription = aSubscription({ workspaceId: workspaceId("ws_1") });
      await repo.save(subscription);
      expect(await repo.findByWorkspace(workspaceId("ws_1"))).toEqual(subscription);
      expect(await repo.findByWorkspace(workspaceId("ws_2"))).toBeUndefined();
    });

    it("replaces the subscription when saved again", async () => {
      const repo = await make();
      await repo.save(aSubscription({ workspaceId: workspaceId("ws_1") }));
      const paid = aSubscription({ workspaceId: workspaceId("ws_1"), plan: "growth" });
      await repo.save(paid);
      expect(await repo.findByWorkspace(workspaceId("ws_1"))).toEqual(paid);
    });

    it("finds a paid subscription by the provider's subscription id", async () => {
      const repo = await make();
      const paid = aSubscription({ workspaceId: workspaceId("ws_2"), plan: "starter" });
      await repo.save(aSubscription({ workspaceId: workspaceId("ws_1") }));
      await repo.save(paid);
      expect(await repo.findByProviderSubscriptionId("sub_ws_2")).toEqual(paid);
      expect(await repo.findByProviderSubscriptionId("sub_unknown")).toBeUndefined();
    });
  });
}
