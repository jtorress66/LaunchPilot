import { err, ok, type Result } from "@nuvantre/domain";
import type {
  BlogConnectionVerifier,
  BlogCredentials,
  ConnectionError,
  VerifiedBlog,
} from "@nuvantre/ports";
import { z } from "zod";
import { httpGet, safeRequest, type HttpFailure } from "../net/safe-http";
import { basicAuth, httpOptions, parseJson, restUrl, type WordPressNetwork } from "./rest";

const siteIndex = z.object({
  name: z.string(),
  home: z.string().url(),
  namespaces: z.array(z.string()),
});

const currentUser = z.object({
  capabilities: z.record(z.string(), z.unknown()).default({}),
});

const failure = (code: ConnectionError["code"], message: string, retryable = false) =>
  err<ConnectionError>({ code, message, retryable });

const fromHttpFailure = (error: HttpFailure) =>
  error.reason === "blocked"
    ? failure("blocked", "That address cannot be used for a blog")
    : failure("unreachable", "The blog could not be reached", true);

/** Checks a WordPress site and its Application Password before Nuvantre stores them. */
export class WordPressConnectionVerifier implements BlogConnectionVerifier {
  constructor(private readonly network: WordPressNetwork) {}

  async verify({
    siteUrl,
    username,
    secret,
  }: BlogCredentials): Promise<Result<VerifiedBlog, ConnectionError>> {
    const options = httpOptions(this.network);
    const indexResponse = await httpGet(restUrl(siteUrl, "/"), options);
    if (!indexResponse.ok) return fromHttpFailure(indexResponse.error);
    const index = siteIndex.safeParse(parseJson(indexResponse.value.body));
    if (
      indexResponse.value.status !== 200 ||
      !index.success ||
      !index.data.namespaces.includes("wp/v2")
    ) {
      return failure(
        "not_wordpress",
        "This address is not a WordPress site with the REST API enabled",
      );
    }

    const home = index.data.home.endsWith("/") ? index.data.home : `${index.data.home}/`;
    const me = await safeRequest(
      restUrl(home, "/wp/v2/users/me", { context: "edit" }),
      { method: "GET", headers: { authorization: basicAuth(username, secret) } },
      options,
    );
    if (!me.ok) return fromHttpFailure(me.error);
    if (me.value.status === 401 || me.value.status === 403) {
      return failure(
        "invalid_credentials",
        "WordPress did not accept that username and Application Password",
      );
    }
    const user = currentUser.safeParse(parseJson(me.value.body));
    if (me.value.status !== 200 || !user.success) {
      return failure("not_wordpress", "WordPress answered in an unexpected way", true);
    }
    if (user.data.capabilities.publish_posts !== true) {
      return failure(
        "invalid_credentials",
        "This WordPress user cannot publish posts. Use an Editor or Administrator account.",
      );
    }
    return ok({ siteName: index.data.name, siteUrl: home });
  }
}
