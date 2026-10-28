// A local stand-in for Resend's email API, for E2E only. POST /emails accepts a message like
// Resend does (Bearer key, Idempotency-Key) and GET /_stub/emails lists what would have been sent,
// so tests can read a branded report or an invitation link without sending real email.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

export const RESEND_STUB_PORT = 4060;
export const RESEND_STUB_KEY = "re_e2e_resend_api_key";

const json = (res, status, body) =>
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));

const readJson = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString();
  return text === "" ? {} : JSON.parse(text);
};

export const startResendStub = () => {
  const sent = [];
  const byKey = new Map();
  const base = `http://127.0.0.1:${RESEND_STUB_PORT}`;

  const server = createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", base).pathname;
    if (path === "/_stub/emails" && req.method === "GET") return json(res, 200, sent);
    if (path !== "/emails" || req.method !== "POST") return json(res, 404, { name: "not_found" });
    if (req.headers.authorization !== `Bearer ${RESEND_STUB_KEY}`) {
      return json(res, 403, {
        statusCode: 403,
        name: "invalid_api_key",
        message: "API key is invalid",
      });
    }
    const key = req.headers["idempotency-key"];
    if (typeof key === "string" && byKey.has(key)) return json(res, 200, byKey.get(key));
    const email = await readJson(req);
    const answer = { id: randomUUID() };
    sent.push({ ...email, id: answer.id });
    if (typeof key === "string") byKey.set(key, answer);
    return json(res, 200, answer);
  });

  return new Promise((resolve) => {
    server.listen(RESEND_STUB_PORT, "127.0.0.1", () =>
      resolve({
        env: {
          RESEND_API_KEY: RESEND_STUB_KEY,
          RESEND_BASE_URL: base,
          MAIL_FROM: "reports@mail.nuvantre.test",
          E2E_RESEND_URL: base,
        },
        stop: () => new Promise((done) => server.close(() => done())),
      }),
    );
  });
};
