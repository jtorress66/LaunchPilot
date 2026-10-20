// A local stand-in for Google (OAuth consent, token, Search Console, GA4 Admin and Data) and for
// a Plausible instance, for E2E only. It replays the same recorded responses as the adapters'
// integration tests: the report week gets the W42 recordings and the week before gets W41.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

export const ANALYTICS_STUB_PORT = 4030;
const base = `http://127.0.0.1:${ANALYTICS_STUB_PORT}`;
const recorded = join(import.meta.dirname, "..", "packages", "adapters", "test");
const google = (name) =>
  JSON.parse(readFileSync(join(recorded, "google", "recorded", `${name}.json`), "utf8"));
const plausible = (name) =>
  JSON.parse(readFileSync(join(recorded, "plausible", "recorded", `${name}.json`), "utf8"));

const REFRESH = "1//recorded-refresh-token";
const PLAUSIBLE_SITE = "acme.dev";
/** Any key with this prefix is accepted, until `/_stub/plausible/revoke` revokes it. */
const PLAUSIBLE_KEY_PREFIX = "plausible-e2e-";

const DAY = 86_400_000;
/** Monday of the last complete UTC week, as LaunchPilot computes it. */
const reportWeekStart = () => {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const sinceMonday = (new Date(today).getUTCDay() + 6) % 7;
  return new Date(today - (sinceMonday + 7) * DAY).toISOString().slice(0, 10);
};
const weekOf = (startDate) => (startDate === reportWeekStart() ? "w42" : "w41");

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

export const startAnalyticsStub = () => {
  const codes = new Set();
  const revoked = new Set();
  let issued = 0;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", base);
    const path = url.pathname;
    const bearer = req.headers.authorization?.replace(/^Bearer /, "") ?? "";

    // Google's consent screen: Allow returns a code, Cancel returns access_denied.
    if (path === "/o/oauth2/v2/auth" && req.method === "GET") {
      const redirect = url.searchParams.get("redirect_uri") ?? "/";
      const state = url.searchParams.get("state") ?? "";
      return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(
        `<!doctype html><title>Sign in with Google</title><h1>LaunchPilot wants read-only access</h1>
<p>${escape(url.searchParams.get("scope") ?? "")}</p>
<form method="post" action="/o/oauth2/v2/auth">
<input type="hidden" name="redirect" value="${escape(redirect)}">
<input type="hidden" name="state" value="${escape(state)}">
<button type="submit" name="decision" value="allow">Allow</button>
<button type="submit" name="decision" value="cancel">Cancel</button></form>`,
      );
    }
    if (path === "/o/oauth2/v2/auth" && req.method === "POST") {
      const { redirect, state, decision } = await readBody(req);
      const back = new URL(redirect);
      back.searchParams.set("state", state);
      if (decision === "allow") {
        issued += 1;
        const code = `4/e2e-code-${issued}`;
        codes.add(code);
        back.searchParams.set("code", code);
      } else {
        back.searchParams.set("error", "access_denied");
      }
      return res.writeHead(302, { location: back.href }).end();
    }

    if (path === "/token" && req.method === "POST") {
      const form = await readBody(req);
      if (form.grant_type === "authorization_code" && codes.delete(form.code)) {
        return json(res, 200, google("token-exchange"));
      }
      if (form.grant_type === "refresh_token" && form.refresh_token === REFRESH) {
        return json(res, 200, google("token-refresh"));
      }
      return json(res, 400, google("invalid-grant"));
    }

    const googleAuthorised = bearer === "ya29.recorded-access-token";
    if (path === "/webmasters/v3/sites" && req.method === "GET") {
      return googleAuthorised ? json(res, 200, google("sites")) : json(res, 401, {});
    }
    if (/^\/webmasters\/v3\/sites\/[^/]+\/searchAnalytics\/query$/.test(path)) {
      if (!googleAuthorised) return json(res, 401, {});
      const body = await readBody(req);
      const kind = body.dimensions ? "queries" : "totals";
      return json(res, 200, google(`gsc-${kind}-${weekOf(body.startDate)}`));
    }
    if (path === "/admin/v1beta/accountSummaries") {
      return googleAuthorised ? json(res, 200, google("account-summaries")) : json(res, 401, {});
    }
    if (/^\/data\/v1beta\/properties\/\d+:runReport$/.test(path)) {
      if (!googleAuthorised) return json(res, 401, {});
      const body = await readBody(req);
      const kind = body.dimensions ? "pages" : "totals";
      return json(res, 200, google(`ga4-${kind}-${weekOf(body.dateRanges?.[0]?.startDate)}`));
    }

    if (path === "/plausible/api/v2/query" && req.method === "POST") {
      const body = await readBody(req);
      if (!bearer.startsWith(PLAUSIBLE_KEY_PREFIX) || revoked.has(bearer)) {
        return json(res, 401, plausible("invalid-key"));
      }
      if (body.site_id !== PLAUSIBLE_SITE) return json(res, 401, plausible("site-not-found"));
      if (body.date_range === "day") return json(res, 200, plausible("totals-w42"));
      const kind = body.dimensions ? "pages" : "totals";
      return json(res, 200, plausible(`${kind}-${weekOf(body.date_range?.[0])}`));
    }
    // Test control: revoke a Plausible key, as if the founder deleted it in Plausible.
    if (path === "/_stub/plausible/revoke" && req.method === "POST") {
      const { key } = await readBody(req);
      revoked.add(key);
      return json(res, 200, { revoked: key });
    }
    return json(res, 404, { error: "Not found" });
  });

  return new Promise((resolve) => {
    server.listen(ANALYTICS_STUB_PORT, "127.0.0.1", () =>
      resolve({
        env: {
          GOOGLE_CLIENT_ID: "e2e-client.apps.googleusercontent.com",
          GOOGLE_CLIENT_SECRET: "e2e-client-secret",
          GOOGLE_API_BASE_URL: base,
          ANALYST: "template",
          E2E_ANALYTICS_URL: base,
        },
        stop: () => new Promise((done) => server.close(done)),
      }),
    );
  });
};
