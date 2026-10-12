import { err, ok, type Result } from "@launchpilot/domain";
import { z } from "zod";
import { ayrshareMessage, callAyrshare, type AyrshareOptions } from "./api";

const created = z.object({
  id: z.string(),
  postIds: z.array(z.object({ platform: z.string(), postUrl: z.string().optional() })),
});

/**
 * CI smoke check: posts `text` to X on a dedicated test profile through the real API, then
 * deletes it, proving the keys, the linked account and the response format still work.
 */
export const runAyrshareSmoke = async (
  options: AyrshareOptions,
  profileKey: string,
  text: string,
): Promise<Result<{ postUrl: string }, string>> => {
  const posted = await callAyrshare(options, {
    method: "POST",
    path: "post",
    profileKey,
    forX: true,
    body: { post: text, platforms: ["twitter"] },
  });
  if (!posted.ok) return err("Ayrshare could not be reached");
  const parsed = created.safeParse(posted.value.body);
  if (posted.value.status >= 400 || !parsed.success) {
    const reason = ayrshareMessage(posted.value.body) ?? `HTTP ${String(posted.value.status)}`;
    return err(`Posting failed: ${reason}`);
  }
  const postUrl = parsed.data.postIds.find((p) => p.platform === "twitter")?.postUrl ?? "(no URL)";
  const deleted = await callAyrshare(options, {
    method: "DELETE",
    path: "post",
    profileKey,
    forX: true,
    body: { id: parsed.data.id },
  });
  if (!deleted.ok || deleted.value.status >= 400) {
    const reason = deleted.ok ? ayrshareMessage(deleted.value.body) : "unreachable";
    return err(`Posted ${postUrl} but could not delete it: ${reason ?? "unknown error"}`);
  }
  return ok({ postUrl });
};
