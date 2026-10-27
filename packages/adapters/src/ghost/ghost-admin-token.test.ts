import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ghostAdminToken, parseGhostAdminKey } from "./ghost-admin-token";

const id = "6489f2f3a1b2c3d4e5f60718";
const secret = "a".repeat(32) + "0123456789abcdef0123456789abcdef";
const key = `${id}:${secret}`;
const now = new Date("2026-10-27T12:00:00.000Z");

const decode = (part: string) =>
  JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as unknown;

describe("parseGhostAdminKey", () => {
  it("splits an Admin API key into its id and hex secret", () => {
    expect(parseGhostAdminKey(` ${key} `)).toEqual({ id, secret });
  });

  it.each([["no colon"], ["abc:not-hex"], [`${id}:`], [`:${secret}`], ["wrong-password-1234"]])(
    "refuses a malformed key (%s)",
    (value) => {
      expect(parseGhostAdminKey(value)).toBeUndefined();
    },
  );
});

describe("ghostAdminToken", () => {
  const token = ghostAdminToken({ id, secret }, now);
  const [header = "", payload = "", signature = ""] = token.split(".");

  it("names the key in the header and signs with HS256", () => {
    expect(decode(header)).toEqual({ alg: "HS256", typ: "JWT", kid: id });
  });

  it("is meant for the Admin API and expires five minutes after it is issued", () => {
    const iat = Math.floor(now.getTime() / 1000);
    expect(decode(payload)).toEqual({ iat, exp: iat + 300, aud: "/admin/" });
  });

  it("is signed with the secret decoded from hex", () => {
    const expected = createHmac("sha256", Buffer.from(secret, "hex"))
      .update(`${header}.${payload}`)
      .digest("base64url");
    expect(signature).toBe(expected);
    expect(token).not.toContain(secret);
  });
});
