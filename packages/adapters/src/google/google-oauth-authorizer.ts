import { err, ok, type Result } from "@nuvantre/domain";
import type { GoogleAuthError, GoogleAuthorizer, GoogleGrant } from "@nuvantre/ports";
import { z } from "zod";
import { callGoogle, GOOGLE_SCOPES, unreachable, urlsOf, type GoogleOptions } from "./api";

const exchanged = z.object({
  refresh_token: z.string().min(1),
  scope: z.string(),
  id_token: z.string(),
});

const idClaims = z.object({ email: z.email() });

const READ_SCOPES = GOOGLE_SCOPES.filter((s) => s.startsWith("https://"));

/**
 * The id token arrives straight from Google's token endpoint over TLS, so its claims can be
 * read without checking the signature (Google's guidance for this exact case).
 */
const emailOf = (idToken: string): string | undefined => {
  const [, payload = ""] = idToken.split(".");
  try {
    const claims = idClaims.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    return claims.success ? claims.data.email : undefined;
  } catch {
    return undefined;
  }
};

const failure = (code: GoogleAuthError["code"], message: string, retryable = false) =>
  err<GoogleAuthError>({ code, message, retryable });

/** Google's OAuth 2.0 web-server flow for read-only Search Console and GA4 access. */
export class GoogleOAuthAuthorizer implements GoogleAuthorizer {
  constructor(private readonly options: GoogleOptions) {}

  authorizationUrl({ state, redirectUrl }: { state: string; redirectUrl: string }): string {
    const url = new URL(urlsOf(this.options).consent);
    url.search = new URLSearchParams({
      client_id: this.options.clientId,
      redirect_uri: redirectUrl,
      response_type: "code",
      scope: GOOGLE_SCOPES.join(" "),
      // Offline access and a fresh consent: Google only returns a refresh token on consent.
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    }).toString();
    return url.toString();
  }

  async exchangeCode({
    code,
    redirectUrl,
  }: {
    code: string;
    redirectUrl: string;
  }): Promise<Result<GoogleGrant, GoogleAuthError>> {
    const response = await callGoogle(this.options, {
      method: "POST",
      url: urlsOf(this.options).token,
      form: {
        code,
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
        redirect_uri: redirectUrl,
        grant_type: "authorization_code",
      },
    });
    if (!response.ok) return err(unreachable("sign-in"));
    const { status, body } = response.value;
    if (status === 400) return failure("invalid_grant", "The Google sign-in expired: try again");
    const parsed = exchanged.safeParse(body);
    if (status !== 200 || !parsed.success) {
      return failure("unavailable", `Google sign-in did not answer (HTTP ${String(status)})`, true);
    }
    const granted = parsed.data.scope.split(" ");
    if (!READ_SCOPES.some((s) => granted.includes(s))) {
      return failure(
        "missing_scope",
        "Allow Nuvantre to see Search Console or Analytics data to connect Google",
      );
    }
    const accountEmail = emailOf(parsed.data.id_token);
    if (accountEmail === undefined) {
      return failure("unavailable", "Google did not say which account signed in", true);
    }
    return ok({ refreshToken: parsed.data.refresh_token, accountEmail });
  }
}
