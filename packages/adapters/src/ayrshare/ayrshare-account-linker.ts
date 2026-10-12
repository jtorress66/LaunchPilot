import { err, ok, socialChannels, type Result, type SocialChannel } from "@launchpilot/domain";
import type {
  CreatedSocialProfile,
  SocialAccountLinker,
  SocialLinkError,
} from "@launchpilot/ports";
import { z } from "zod";
import {
  ayrshareMessage,
  callAyrshare,
  channelOf,
  isOutage,
  platformOf,
  type AyrshareOptions,
  type AyrshareResponse,
} from "./api";

const createdProfile = z.object({ profileKey: z.string().min(1), refId: z.string().min(1) });
const jwt = z.object({ url: z.string().url() });
const userInfo = z.object({ activeSocialAccounts: z.array(z.string()).optional() });

const failure = (code: SocialLinkError["code"], message: string, retryable: boolean) =>
  err<SocialLinkError>({ code, message, retryable });

/** Turns an Ayrshare answer into the expected shape, or a SocialLinkError. */
const read = <T>(
  response: Result<AyrshareResponse, "network">,
  schema: z.ZodType<T>,
): Result<T, SocialLinkError> => {
  if (!response.ok) return failure("unavailable", "Ayrshare could not be reached", true);
  const { status, body } = response.value;
  if (isOutage(status)) {
    return failure("unavailable", `Ayrshare is unavailable (HTTP ${String(status)})`, true);
  }
  if (status >= 400) {
    const reason = ayrshareMessage(body) ?? `HTTP ${String(status)}`;
    return failure("rejected", `Ayrshare refused the request: ${reason}`, false);
  }
  const parsed = schema.safeParse(body);
  return parsed.success
    ? ok(parsed.data)
    : failure("unavailable", "Ayrshare answered in an unexpected format", true);
};

/** Creates a product's Ayrshare profile and lets the founder link X and LinkedIn to it. */
export class AyrshareAccountLinker implements SocialAccountLinker {
  constructor(private readonly options: AyrshareOptions) {}

  async createProfile(title: string): Promise<Result<CreatedSocialProfile, SocialLinkError>> {
    const response = await callAyrshare(this.options, {
      method: "POST",
      path: "profiles/profile",
      body: { title },
    });
    return read(response, createdProfile);
  }

  async linkingUrl(
    profileKey: string,
    returnUrl: string,
  ): Promise<Result<string, SocialLinkError>> {
    const x = this.options.xCredentials;
    const response = await callAyrshare(this.options, {
      method: "POST",
      path: "profiles/generateJWT",
      body: {
        domain: this.options.domain,
        privateKey: this.options.privateKey,
        profileKey,
        redirect: returnUrl,
        allowedSocial: socialChannels.map((channel) => platformOf[channel]),
        ...(x === undefined ? {} : { twitterApiKey: x.apiKey, twitterApiSecret: x.apiSecret }),
      },
    });
    const result = read(response, jwt);
    return result.ok ? ok(result.value.url) : result;
  }

  async linkedChannels(
    profileKey: string,
  ): Promise<Result<readonly SocialChannel[], SocialLinkError>> {
    const response = await callAyrshare(this.options, { method: "GET", path: "user", profileKey });
    const result = read(response, userInfo);
    if (!result.ok) return result;
    const linked = (result.value.activeSocialAccounts ?? []).map(channelOf);
    return ok(socialChannels.filter((channel) => linked.includes(channel)));
  }
}
