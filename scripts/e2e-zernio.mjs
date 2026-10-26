// A local stand-in for Zernio's REST API, for E2E only. It implements the calls Nuvantre makes
// (profiles, connect, accounts, posts), an authorisation page the founder clicks through, and
// GET /_stub/posts so tests can assert exactly what would have been posted.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

export const ZERNIO_STUB_PORT = 4020;
export const ZERNIO_STUB_KEY = "sk_e2e_zernio_api_key";

const json = (res, status, body) =>
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString();
  if (text === "") return {};
  return req.headers["content-type"]?.includes("json")
    ? JSON.parse(text)
    : Object.fromEntries(new URLSearchParams(text));
};

const escape = (text) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const names = { twitter: "X", linkedin: "LinkedIn" };

export const startZernioStub = () => {
  /** profileId → { externalId, accounts: [{ _id, platform }] } */
  const profiles = new Map();
  const posts = [];
  const base = `http://127.0.0.1:${ZERNIO_STUB_PORT}`;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", base);
    const path = url.pathname;

    // The platform's consent page (X or LinkedIn hosts this in production).
    if (path === "/authorize" && req.method === "GET") {
      const platform = url.searchParams.get("platform") ?? "";
      return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(
        `<!doctype html><title>Authorize</title><h1>Authorize Nuvantre on ${escape(names[platform] ?? platform)}</h1>
<form method="post" action="/authorize">
<input type="hidden" name="platform" value="${escape(platform)}">
<input type="hidden" name="profileId" value="${escape(url.searchParams.get("profileId") ?? "")}">
<input type="hidden" name="redirect" value="${escape(url.searchParams.get("redirect") ?? "/")}">
<button type="submit">Authorize</button></form>`,
      );
    }
    if (path === "/authorize" && req.method === "POST") {
      const { platform, profileId, redirect } = await readBody(req);
      const profile = profiles.get(profileId);
      if (!profile) return res.writeHead(404).end("Unknown profile");
      const accountId = randomUUID().replaceAll("-", "").slice(0, 24);
      profile.accounts = [
        ...profile.accounts.filter((a) => a.platform !== platform),
        { _id: accountId, platform },
      ];
      const back = new URL(redirect);
      back.searchParams.set("connected", platform);
      back.searchParams.set("profileId", profileId);
      back.searchParams.set("accountId", accountId);
      return res.writeHead(303, { location: back.href }).end();
    }
    if (path === "/_stub/posts" && req.method === "GET") return json(res, 200, posts);
    if (path.startsWith("/posts/")) {
      const post = posts.find((p) => `/posts/${p.id}` === path);
      return post
        ? res.writeHead(200, { "content-type": "text/plain" }).end(post.content)
        : res.writeHead(404).end();
    }

    if (req.headers.authorization !== `Bearer ${ZERNIO_STUB_KEY}`) {
      return json(res, 401, { error: "Invalid API key.", type: "authentication_error" });
    }
    const body = req.method === "GET" ? {} : await readBody(req);

    if (path === "/api/v1/profiles" && req.method === "POST") {
      const existing = [...profiles].find(([, p]) => p.externalId === body.externalId);
      if (existing) {
        return json(res, 409, {
          error: "A profile with this externalId already exists.",
          code: "profile_external_id_conflict",
          details: { existingProfileId: existing[0] },
        });
      }
      const id = randomUUID().replaceAll("-", "").slice(0, 24);
      profiles.set(id, { externalId: body.externalId, accounts: [] });
      return json(res, 201, { profile: { _id: id, name: body.name, externalId: body.externalId } });
    }
    const connect = path.match(/^\/api\/v1\/connect\/(twitter|linkedin)$/);
    if (connect && req.method === "GET") {
      const profileId = url.searchParams.get("profileId") ?? "";
      if (!profiles.has(profileId)) return json(res, 404, { error: "Profile not found." });
      const authUrl = new URL("/authorize", base);
      authUrl.searchParams.set("platform", connect[1]);
      authUrl.searchParams.set("profileId", profileId);
      authUrl.searchParams.set("redirect", url.searchParams.get("redirect_url") ?? "/");
      return json(res, 200, { authUrl: authUrl.href, state: "stub" });
    }
    if (path === "/api/v1/accounts" && req.method === "GET") {
      const profile = profiles.get(url.searchParams.get("profileId") ?? "");
      if (!profile)
        return json(res, 404, { error: "Profile not found.", code: "profile_not_found" });
      return json(res, 200, {
        accounts: profile.accounts.map((a) => ({ ...a, isActive: true })),
        hasAnalyticsAccess: false,
      });
    }
    if (path === "/api/v1/posts" && req.method === "POST") {
      const target = body.platforms?.[0];
      const linked = [...profiles.values()].some((p) =>
        p.accounts.some((a) => a._id === target?.accountId && a.platform === target?.platform),
      );
      if (!linked) {
        return json(res, 403, {
          error: "Account not found or disconnected.",
          code: "ACCOUNT_DISCONNECTED",
        });
      }
      const id = randomUUID();
      posts.push({ id, content: body.content, platforms: body.platforms });
      return json(res, 201, {
        post: {
          _id: id,
          status: "published",
          platforms: [{ ...target, status: "published", platformPostUrl: `${base}/posts/${id}` }],
        },
      });
    }
    return json(res, 404, { error: "Not found" });
  });

  return new Promise((resolve) => {
    server.listen(ZERNIO_STUB_PORT, "127.0.0.1", () =>
      resolve({
        env: {
          ZERNIO_API_KEY: ZERNIO_STUB_KEY,
          ZERNIO_BASE_URL: `${base}/api`,
          E2E_ZERNIO_URL: base,
        },
        stop: () => new Promise((done) => server.close(done)),
      }),
    );
  });
};
