import type { LinkedAccount, Result, SocialChannel } from "@launchpilot/domain";
import type { PortError } from "./port-error";

export type SocialLinkError = PortError<"rejected" | "unavailable">;

/**
 * Provisions a product's profile at the unified social API and lets the founder link
 * each account on the provider's own hosted page. Linking only: it never publishes.
 */
export interface SocialAccountLinker {
  /** Idempotent per `externalId`: creating the same product's profile again returns its id. */
  createProfile(
    name: string,
    externalId: string,
  ): Promise<Result<{ readonly profileId: string }, SocialLinkError>>;
  /** The provider's page where the founder links one channel, returning to `returnUrl`. */
  linkingUrl(
    profileId: string,
    channel: SocialChannel,
    returnUrl: string,
  ): Promise<Result<string, SocialLinkError>>;
  /** Active X and LinkedIn accounts linked to the profile. */
  linkedAccounts(profileId: string): Promise<Result<readonly LinkedAccount[], SocialLinkError>>;
}
