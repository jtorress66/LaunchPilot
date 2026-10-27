import { createHmac } from "node:crypto";

/** A Ghost Admin API key, `{id}:{secret}`, from Settings → Integrations → Custom integration. */
export interface GhostAdminKey {
  readonly id: string;
  /** Hex; only ever used to sign, never sent. */
  readonly secret: string;
}

const keyFormat = /^([0-9a-f]+):([0-9a-f]+)$/i;

export const parseGhostAdminKey = (value: string): GhostAdminKey | undefined => {
  const match = keyFormat.exec(value.trim());
  if (!match?.[1] || !match[2] || match[2].length % 2 !== 0) return undefined;
  return { id: match[1], secret: match[2] };
};

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** A short-lived token for the `Authorization: Ghost {token}` header (HS256, 5 minutes). */
export const ghostAdminToken = (key: GhostAdminKey, now: Date): string => {
  const iat = Math.floor(now.getTime() / 1000);
  const unsigned = `${encode({ alg: "HS256", typ: "JWT", kid: key.id })}.${encode({
    iat,
    exp: iat + 300,
    aud: "/admin/",
  })}`;
  const signature = createHmac("sha256", Buffer.from(key.secret, "hex"))
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
};
