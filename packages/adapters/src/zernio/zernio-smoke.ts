import { err, ok, type Result } from "@launchpilot/domain";
import { z } from "zod";
import { callZernio, zernioMessage, type ZernioOptions } from "./api";

const created = z.object({
  post: z.object({
    _id: z.string(),
    platforms: z.array(z.object({ platformPostUrl: z.string().nullish() })).default([]),
  }),
});

/**
 * CI smoke check: posts `text` to a test X account through the real API, then takes it down,
 * proving the key, the linked account and the response format still work.
 */
export const runZernioSmoke = async (
  options: ZernioOptions,
  accountId: string,
  text: string,
): Promise<Result<{ postUrl: string }, string>> => {
  const posted = await callZernio(options, {
    method: "POST",
    path: "posts",
    body: { content: text, platforms: [{ platform: "twitter", accountId }], publishNow: true },
  });
  if (!posted.ok) return err("Zernio could not be reached");
  const parsed = created.safeParse(posted.value.body);
  if (posted.value.status >= 300 || !parsed.success) {
    const reason = zernioMessage(posted.value.body) ?? `HTTP ${String(posted.value.status)}`;
    return err(`Posting failed: ${reason}`);
  }
  const postUrl = parsed.data.post.platforms[0]?.platformPostUrl ?? "(no URL)";
  const removed = await callZernio(options, {
    method: "POST",
    path: `posts/${parsed.data.post._id}/unpublish`,
    body: { platform: "twitter" },
  });
  if (!removed.ok || removed.value.status >= 400) {
    const reason = removed.ok ? zernioMessage(removed.value.body) : "unreachable";
    return err(`Posted ${postUrl} but could not take it down: ${reason ?? "unknown error"}`);
  }
  return ok({ postUrl });
};
