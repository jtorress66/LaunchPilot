import { err, ok, type Result } from "@launchpilot/domain";
import type { z } from "zod";
import { callZernio, channelOf, zernioMessage, type ZernioOptions } from "./api";
import { accountList, isUsable, profileList } from "./schemas";

const list = async <T>(
  options: ZernioOptions,
  path: string,
  schema: z.ZodType<T>,
): Promise<Result<T, string>> => {
  const response = await callZernio(options, { method: "GET", path });
  const label = `Listing ${path} failed`;
  if (!response.ok) return err(`${label}: Zernio could not be reached`);
  const { status, body } = response.value;
  if (status >= 400) return err(`${label}: ${zernioMessage(body) ?? `HTTP ${String(status)}`}`);
  const parsed = schema.safeParse(body);
  return parsed.success
    ? ok(parsed.data)
    : err(`${label}: Zernio answered in an unexpected format`);
};

/**
 * CI smoke check against the real API, read-only: proves the key works and that the profile and
 * account responses still have the shape the adapter reads. It never posts anything.
 */
export const runZernioSmoke = async (
  options: ZernioOptions,
): Promise<Result<{ profiles: number; xAccounts: number; linkedinAccounts: number }, string>> => {
  const profiles = await list(options, "profiles", profileList);
  if (!profiles.ok) return profiles;
  const accounts = await list(options, "accounts", accountList);
  if (!accounts.ok) return accounts;
  const count = (channel: "x" | "linkedin") =>
    accounts.value.accounts.filter((a) => isUsable(a) && channelOf(a.platform) === channel).length;
  return ok({
    profiles: profiles.value.profiles.length,
    xAccounts: count("x"),
    linkedinAccounts: count("linkedin"),
  });
};
