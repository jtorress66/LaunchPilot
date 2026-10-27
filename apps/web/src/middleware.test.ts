import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : {});

describe("middleware", () => {
  it("sends signed-out visitors of the app to the login page", () => {
    const response = middleware(request("/app/billing"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it.each(["lp_session=t", "__Host-lp_session=t"])("lets a visitor with %s through", (cookie) => {
    expect(middleware(request("/app", cookie)).headers.get("location")).toBeNull();
  });

  it("gives every response a fresh nonce in its Content-Security-Policy", () => {
    const first = middleware(request("/")).headers.get("content-security-policy");
    const second = middleware(request("/")).headers.get("content-security-policy");
    expect(first).toMatch(/'nonce-[A-Za-z0-9+/=]{16,}'/);
    expect(first).not.toBe(second);
  });

  it("tags each response with a request id, keeping one the proxy already set", () => {
    expect(middleware(request("/")).headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    const proxied = new NextRequest("http://localhost:3000/", {
      headers: { "x-request-id": "req_from_proxy" },
    });
    expect(middleware(proxied).headers.get("x-request-id")).toBe("req_from_proxy");
  });
});
