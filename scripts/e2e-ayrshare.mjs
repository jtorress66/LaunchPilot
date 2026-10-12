// A local stand-in for Ayrshare's REST API, for E2E only. It implements the calls LaunchPilot
// makes (create profile, linking JWT, user, post), a linking page the founder clicks through,
// and GET /_stub/posts so tests can assert exactly what would have been posted.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

export const AYRSHARE_STUB_PORT = 4020;
export const AYRSHARE_STUB_KEY = "e2e-ayrshare-api-key";

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

export const startAyrshareStub = () => {
  /** profileKey → { refId, title, linked: string[] } */
  const profiles = new Map();
  const posts = [];
  const base = `http://127.0.0.1:${AYRSHARE_STUB_PORT}`;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", base);
    const path = url.pathname;

    // The founder's linking page (Ayrshare hosts this in production).
    if (path === "/link" && req.method === "GET") {
      const profile = url.searchParams.get("profile") ?? "";
      const redirect = url.searchParams.get("redirect") ?? "/";
      return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(
        `<!doctype html><title>Link your accounts</title><h1>Link your social accounts</h1>
<form method="post" action="/link"><input type="hidden" name="profile" value="${escape(profile)}">
<input type="hidden" name="redirect" value="${escape(redirect)}">
<button type="submit">Link X and LinkedIn</button></form>`,
      );
    }
    if (path === "/link" && req.method === "POST") {
      const { profile, redirect } = await readBody(req);
      const found = profiles.get(profile);
      if (!found) return res.writeHead(404).end("Unknown profile");
      found.linked = ["twitter", "linkedin"];
      return res.writeHead(303, { location: redirect }).end();
    }
    if (path === "/_stub/posts" && req.method === "GET") return json(res, 200, posts);
    if (path.startsWith("/posts/")) {
      const post = posts.find((p) => `/posts/${p.id}` === path);
      return post
        ? res.writeHead(200, { "content-type": "text/plain" }).end(post.post)
        : res.writeHead(404).end();
    }

    if (req.headers.authorization !== `Bearer ${AYRSHARE_STUB_KEY}`) {
      return json(res, 401, { status: "error", code: 102, message: "API Key not valid." });
    }
    const body = req.method === "GET" ? {} : await readBody(req);
    const profileKey = req.headers["profile-key"];
    const profile = typeof profileKey === "string" ? profiles.get(profileKey) : undefined;

    if (path === "/api/profiles/profile" && req.method === "POST") {
      const key = `STUB-${randomUUID()}`;
      const refId = randomUUID().replaceAll("-", "");
      profiles.set(key, { refId, title: body.title, linked: [] });
      return json(res, 200, { status: "success", title: body.title, refId, profileKey: key });
    }
    if (path === "/api/profiles/generateJWT" && req.method === "POST") {
      if (!profiles.has(body.profileKey)) {
        return json(res, 403, { status: "error", code: 103, message: "Profile Key not found." });
      }
      const link = new URL("/link", base);
      link.searchParams.set("profile", body.profileKey);
      link.searchParams.set("redirect", body.redirect ?? "/");
      return json(res, 200, { status: "success", token: "stub", url: link.href, expiresIn: "5m" });
    }
    if (path === "/api/user" && req.method === "GET") {
      if (!profile)
        return json(res, 403, { status: "error", code: 103, message: "Profile Key not found." });
      return json(res, 200, { activeSocialAccounts: profile.linked, refId: profile.refId });
    }
    if (path === "/api/post" && req.method === "POST") {
      if (!profile)
        return json(res, 403, { status: "error", code: 103, message: "Profile Key not found." });
      const platform = body.platforms?.[0];
      if (!profile.linked.includes(platform)) {
        return json(res, 400, {
          status: "error",
          errors: [{ code: 156, message: "Social account not linked.", platform }],
          postIds: [],
        });
      }
      const id = randomUUID();
      posts.push({ id, refId: profile.refId, post: body.post, platforms: body.platforms });
      return json(res, 200, {
        status: "success",
        id,
        postIds: [{ status: "success", id, platform, postUrl: `${base}/posts/${id}` }],
      });
    }
    return json(res, 404, { status: "error", message: "Not found" });
  });

  return new Promise((resolve) => {
    server.listen(AYRSHARE_STUB_PORT, "127.0.0.1", () =>
      resolve({
        env: {
          AYRSHARE_API_KEY: AYRSHARE_STUB_KEY,
          AYRSHARE_DOMAIN: "e2e",
          AYRSHARE_PRIVATE_KEY: "e2e-private-key",
          AYRSHARE_BASE_URL: base,
          E2E_AYRSHARE_URL: base,
        },
        stop: () => new Promise((done) => server.close(done)),
      }),
    );
  });
};
