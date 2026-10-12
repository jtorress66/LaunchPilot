import type { Result, SocialChannel } from "@launchpilot/domain";
import type { PortError } from "./port-error";

export interface CreatedSocialProfile {
  /** Secret: encrypt before storing, never log. */
  readonly profileKey: string;
  /** The provider's public reference for the profile. */
  readonly refId: string;
}

export type SocialLinkError = PortError<"rejected" | "unavailable">;

/**
 * Provisions a product's profile at the unified social API and lets the founder link
 * their accounts on the provider's own hosted page. Linking only: it never publishes.
 */
export interface SocialAccountLinker {
  createProfile(title: string): Promise<Result<CreatedSocialProfile, SocialLinkError>>;
  /** A short-lived page where the founder links X and LinkedIn, returning to `returnUrl`. */
  linkingUrl(profileKey: string, returnUrl: string): Promise<Result<string, SocialLinkError>>;
  linkedChannels(profileKey: string): Promise<Result<readonly SocialChannel[], SocialLinkError>>;
}
