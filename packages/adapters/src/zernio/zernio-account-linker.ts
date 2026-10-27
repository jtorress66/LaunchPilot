import {
  err,
  ok,
  socialChannels,
  type LinkedAccount,
  type Result,
  type SocialChannel,
} from "@nuvantre/domain";
import type { SocialAccountLinker, SocialLinkError } from "@nuvantre/ports";
import { z } from "zod";
import {
  callZernio,
  channelOf,
  isOutage,
  platformOf,
  zernioMessage,
  type ZernioOptions,
  type ZernioResponse,
} from "./api";
import { accountList, isUsable } from "./schemas";

const createdProfile = z.object({ profile: z.object({ _id: z.string().min(1) }) });
const existingProfile = z.object({ details: z.object({ existingProfileId: z.string().min(1) }) });
const connect = z.object({ authUrl: z.url() });

const failure = (code: SocialLinkError["code"], message: string, retryable: boolean) =>
  err<SocialLinkError>({ code, message, retryable });

/** Turns a Zernio answer into the expected shape, or a SocialLinkError. */
const read = <T>(
  response: Result<ZernioResponse, "network">,
  schema: z.ZodType<T>,
): Result<T, SocialLinkError> => {
  if (!response.ok) return failure("unavailable", "Zernio could not be reached", true);
  const { status, body } = response.value;
  if (isOutage(status)) {
    return failure("unavailable", `Zernio is unavailable (HTTP ${String(status)})`, true);
  }
  if (status >= 400) {
    const reason = zernioMessage(body) ?? `HTTP ${String(status)}`;
    return failure("rejected", `Zernio refused the request: ${reason}`, false);
  }
  const parsed = schema.safeParse(body);
  return parsed.success
    ? ok(parsed.data)
    : failure("unavailable", "Zernio answered in an unexpected format", true);
};

/** Creates a product's Zernio profile and lets the founder link X and LinkedIn to it. */
export class ZernioAccountLinker implements SocialAccountLinker {
  constructor(private readonly options: ZernioOptions) {}

  async createProfile(
    name: string,
    externalId: string,
  ): Promise<Result<{ readonly profileId: string }, SocialLinkError>> {
    const response = await callZernio(this.options, {
      method: "POST",
      path: "profiles",
      body: { name, externalId },
    });
    // The product already has a profile (e.g. a retry after a timeout): reuse it.
    if (response.ok && response.value.status === 409) {
      const existing = existingProfile.safeParse(response.value.body);
      if (existing.success) return ok({ profileId: existing.data.details.existingProfileId });
    }
    const created = read(response, createdProfile);
    return created.ok ? ok({ profileId: created.value.profile._id }) : created;
  }

  async linkingUrl(
    profileId: string,
    channel: SocialChannel,
    returnUrl: string,
  ): Promise<Result<string, SocialLinkError>> {
    const response = await callZernio(this.options, {
      method: "GET",
      path: `connect/${platformOf[channel]}`,
      query: { profileId, redirect_url: returnUrl },
    });
    const result = read(response, connect);
    return result.ok ? ok(result.value.authUrl) : result;
  }

  async linkedAccounts(
    profileId: string,
  ): Promise<Result<readonly LinkedAccount[], SocialLinkError>> {
    const response = await callZernio(this.options, {
      method: "GET",
      path: "accounts",
      query: { profileId },
    });
    const result = read(response, accountList);
    if (!result.ok) return result;
    const usable = result.value.accounts.flatMap((account) => {
      const channel = channelOf(account.platform);
      return channel && isUsable(account) ? [{ channel, accountId: account._id }] : [];
    });
    return ok(socialChannels.flatMap((c) => usable.filter((a) => a.channel === c).slice(0, 1)));
  }
}
