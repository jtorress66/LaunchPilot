import { err, ok, type LinkedAccount, type Result, type SocialChannel } from "@launchpilot/domain";
import type { SocialAccountLinker, SocialLinkError } from "@launchpilot/ports";
import { NextFailure } from "./next-failure";

/** One profile per external id, with sequential ids; tests link accounts with `link`. */
export class FakeSocialAccountLinker implements SocialAccountLinker {
  /** Names of the profiles actually created. */
  readonly created: string[] = [];
  private readonly byExternalId = new Map<string, string>();
  private readonly accounts = new Map<string, readonly LinkedAccount[]>();
  private readonly failure = new NextFailure<SocialLinkError>();

  /** Simulates the founder linking accounts on the provider's page. */
  link(profileId: string, accounts: readonly LinkedAccount[]): this {
    this.accounts.set(profileId, accounts);
    return this;
  }

  failNext(error: SocialLinkError): this {
    this.failure.set(error);
    return this;
  }

  createProfile(
    name: string,
    externalId: string,
  ): Promise<Result<{ readonly profileId: string }, SocialLinkError>> {
    return this.respond(() => {
      const existing = this.byExternalId.get(externalId);
      if (existing !== undefined) return ok({ profileId: existing });
      const profileId = `zp_fake_${String(this.byExternalId.size + 1)}`;
      this.byExternalId.set(externalId, profileId);
      this.accounts.set(profileId, []);
      this.created.push(name);
      return ok({ profileId });
    });
  }

  linkingUrl(
    profileId: string,
    channel: SocialChannel,
    returnUrl: string,
  ): Promise<Result<string, SocialLinkError>> {
    return this.respond(() =>
      this.known(profileId, () =>
        ok(
          `https://link.social.test/${channel}?profile=${profileId}&return=${encodeURIComponent(returnUrl)}`,
        ),
      ),
    );
  }

  linkedAccounts(profileId: string): Promise<Result<readonly LinkedAccount[], SocialLinkError>> {
    return this.respond(() => this.known(profileId, (accounts) => ok(accounts)));
  }

  private known<T>(
    profileId: string,
    then: (accounts: readonly LinkedAccount[]) => Result<T, SocialLinkError>,
  ): Result<T, SocialLinkError> {
    const accounts = this.accounts.get(profileId);
    return accounts === undefined
      ? err({ code: "rejected", message: "Unknown social profile", retryable: false })
      : then(accounts);
  }

  private respond<T>(run: () => Result<T, SocialLinkError>): Promise<Result<T, SocialLinkError>> {
    const failure = this.failure.take();
    return Promise.resolve(failure === undefined ? run() : err(failure));
  }
}
