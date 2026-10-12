import { err, ok, type Result, type SocialChannel } from "@launchpilot/domain";
import type {
  CreatedSocialProfile,
  SocialAccountLinker,
  SocialLinkError,
} from "@launchpilot/ports";
import { NextFailure } from "./next-failure";

/** Hands out sequential profile keys; tests link channels with `link`. */
export class FakeSocialAccountLinker implements SocialAccountLinker {
  readonly created: string[] = [];
  private readonly linked = new Map<string, readonly SocialChannel[]>();
  private readonly failure = new NextFailure<SocialLinkError>();

  /** Simulates the founder linking accounts on the provider's page. */
  link(profileKey: string, channels: readonly SocialChannel[]): this {
    this.linked.set(profileKey, channels);
    return this;
  }

  failNext(error: SocialLinkError): this {
    this.failure.set(error);
    return this;
  }

  createProfile(title: string): Promise<Result<CreatedSocialProfile, SocialLinkError>> {
    return this.respond(() => {
      const n = this.linked.size + 1;
      const profileKey = `pk_fake_${String(n)}`;
      this.linked.set(profileKey, []);
      this.created.push(title);
      return ok({ profileKey, refId: `ref_${String(n)}` });
    });
  }

  linkingUrl(profileKey: string, returnUrl: string): Promise<Result<string, SocialLinkError>> {
    return this.respond(() =>
      this.known(profileKey, () =>
        ok(
          `https://link.social.test/?profile=${profileKey}&return=${encodeURIComponent(returnUrl)}`,
        ),
      ),
    );
  }

  linkedChannels(profileKey: string): Promise<Result<readonly SocialChannel[], SocialLinkError>> {
    return this.respond(() => this.known(profileKey, (channels) => ok(channels)));
  }

  private known<T>(
    profileKey: string,
    then: (channels: readonly SocialChannel[]) => Result<T, SocialLinkError>,
  ): Result<T, SocialLinkError> {
    const channels = this.linked.get(profileKey);
    return channels === undefined
      ? err({ code: "rejected", message: "Unknown social profile", retryable: false })
      : then(channels);
  }

  private respond<T>(run: () => Result<T, SocialLinkError>): Promise<Result<T, SocialLinkError>> {
    const failure = this.failure.take();
    return Promise.resolve(failure === undefined ? run() : err(failure));
  }
}
