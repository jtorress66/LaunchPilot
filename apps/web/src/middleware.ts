import { NextResponse, type NextRequest } from "next/server";
import { buildSecurityHeaders } from "./server/security-headers";
import { sessionCookieNames } from "./server/session-cookie";

// A proxy's id is kept only when it is short and plain, so it cannot forge log lines.
const PROXY_REQUEST_ID = /^[\w.-]{1,128}$/;

const requestIdOf = (request: NextRequest): string => {
  const fromProxy = request.headers.get("x-request-id");
  return fromProxy !== null && PROXY_REQUEST_ID.test(fromProxy) ? fromProxy : crypto.randomUUID();
};

const freshNonce = (): string => btoa(crypto.randomUUID());

const isSignedOutOfApp = (request: NextRequest): boolean =>
  request.nextUrl.pathname.startsWith("/app") &&
  !sessionCookieNames.some((name) => request.cookies.has(name));

/**
 * Every page gets a per-response CSP nonce and a request id. Signed-out visitors of /app go to
 * the login page; every page there still validates the session server-side.
 */
export function middleware(request: NextRequest): NextResponse {
  const requestId = requestIdOf(request);
  const headers = buildSecurityHeaders(freshNonce(), {
    https: (process.env.APP_URL ?? "").startsWith("https://"),
    development: process.env.NODE_ENV === "development",
  });
  const tagged = { ...headers, "x-request-id": requestId };

  const response = isSignedOutOfApp(request)
    ? NextResponse.redirect(new URL("/login", request.url))
    : NextResponse.next({
        // Next reads the nonce from the request's CSP and puts it on its own scripts.
        request: { headers: new Headers([...request.headers, ...Object.entries(tagged)]) },
      });
  for (const [name, value] of Object.entries(tagged)) response.headers.set(name, value);
  return response;
}

export const config = {
  // Everything but static files, which carry no scripts to protect.
  matcher: [
    { source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)" },
  ],
};
