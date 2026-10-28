// Responses below are shaped after Resend's API as typed by its official SDK (resend@6).
import { parseEmail, type Email } from "@nuvantre/domain";
import type { EmailMessage } from "@nuvantre/ports";
import { describeMailerContract, type DeliveredEmail } from "@nuvantre/testing/contracts";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ResendMailer } from "../../src";
import concurrentIdempotent from "./recorded/concurrent-idempotent.json";
import invalidApiKey from "./recorded/invalid-api-key.json";
import invalidFrom from "./recorded/invalid-from.json";
import rateLimited from "./recorded/rate-limited.json";
import sent from "./recorded/sent.json";

const BASE = "https://api.resend.com";
const API_KEY = "re_recorded_resend_api_key";
const FROM = "reports@mail.nuvantre.app";

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const email = (value: string): Email => {
  const parsed = parseEmail(value);
  if (!parsed.ok) throw new Error(value);
  return parsed.value;
};

const message: EmailMessage = {
  to: [email("client@acme.test")],
  fromName: "Brightside Agency",
  replyTo: email("hello@brightside.agency"),
  subject: "Acme Analytics — weekly report",
  html: "<p>Visitors: 1,240</p>",
  text: "Visitors: 1,240",
  idempotencyKey: "report-1:client@acme.test:2026-10-27",
};

const mailer = () => new ResendMailer({ apiKey: API_KEY, from: FROM });

/** A stand-in for Resend that keeps what it accepted and honours idempotency keys like Resend. */
const resendStub = () => {
  const accepted: { body: Record<string, unknown>; headers: Headers }[] = [];
  const byKey = new Map<string, JsonBodyType>();
  let rejectNext = false;
  server.use(
    http.post(`${BASE}/emails`, async ({ request }) => {
      const key = request.headers.get("idempotency-key") ?? "";
      const earlier = byKey.get(key);
      if (earlier) return HttpResponse.json(earlier);
      if (rejectNext) {
        rejectNext = false;
        return HttpResponse.json(invalidFrom, { status: 422 });
      }
      accepted.push({
        body: (await request.json()) as Record<string, unknown>,
        headers: request.headers,
      });
      const response = { id: `${sent.id}-${accepted.length}` };
      byKey.set(key, response);
      return HttpResponse.json(response);
    }),
  );
  return {
    accepted,
    rejectNext: () => {
      rejectNext = true;
    },
  };
};

const fromName = (from: unknown) =>
  String(from)
    .replace(/ <[^>]+>$/, "")
    .replace(/^"|"$/g, "");

describeMailerContract("ResendMailer", () => {
  const stub = resendStub();
  return {
    mailer: mailer(),
    delivered: (): DeliveredEmail[] =>
      stub.accepted.map(({ body }) => ({
        to: body.to as string[],
        fromName: fromName(body.from),
        replyTo: body.reply_to as string | undefined,
        subject: String(body.subject),
        html: String(body.html),
        text: String(body.text),
      })),
    rejectNext: stub.rejectNext,
  };
});

describe("ResendMailer", () => {
  it("sends from the verified address under the agency's name, with the key and idempotency key", async () => {
    const stub = resendStub();
    await mailer().send(message);
    const [request] = stub.accepted;
    expect(request?.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(request?.headers.get("idempotency-key")).toBe(message.idempotencyKey);
    expect(request?.body).toEqual({
      from: `"Brightside Agency" <${FROM}>`,
      to: ["client@acme.test"],
      reply_to: "hello@brightside.agency",
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  });

  it("keeps quotes and angle brackets in a sender name from changing the address", async () => {
    const stub = resendStub();
    await mailer().send({ ...message, fromName: 'Evil "Co" <x@evil.test>' });
    expect(stub.accepted[0]?.body.from).toBe(`"Evil Co x@evil.test" <${FROM}>`);
  });

  it.each([
    ["a wrong API key", 403, invalidApiKey, "mailer_unauthorized", false],
    ["an unverified sender", 422, invalidFrom, "mailer_rejected", false],
    ["a rate limit", 429, rateLimited, "mailer_unavailable", true],
    ["the same key still in flight", 409, concurrentIdempotent, "mailer_unavailable", true],
    ["an outage", 503, { name: "internal_server_error", message: "x" }, "mailer_unavailable", true],
  ])("reports %s as %s", async (_case, status, body, code, retryable) => {
    server.use(http.post(`${BASE}/emails`, () => HttpResponse.json(body, { status })));
    expect(await mailer().send(message)).toMatchObject({ ok: false, error: { code, retryable } });
  });

  it("shows Resend's explanation but never the key", async () => {
    server.use(http.post(`${BASE}/emails`, () => HttpResponse.json(invalidFrom, { status: 422 })));
    const result = await mailer().send(message);
    expect(result.ok ? "" : result.error.message).toContain("Invalid `from` field");
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it("reports a network failure as retryable", async () => {
    server.use(http.post(`${BASE}/emails`, () => HttpResponse.error()));
    expect(await mailer().send(message)).toMatchObject({
      ok: false,
      error: { code: "mailer_unavailable", retryable: true },
    });
  });

  it("can talk to a local stand-in instead of Resend", async () => {
    server.use(http.post("http://127.0.0.1:4099/emails", () => HttpResponse.json(sent)));
    const local = new ResendMailer({
      apiKey: API_KEY,
      from: FROM,
      baseUrl: "http://127.0.0.1:4099",
    });
    expect(await local.send(message)).toEqual({ ok: true, value: { id: sent.id } });
  });
});
