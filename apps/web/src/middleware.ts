import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./server/session-cookie";

/** Cheap gate for signed-out visitors. Every page still validates the session server-side. */
export function middleware(request: NextRequest): NextResponse {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = { matcher: ["/app", "/app/:path*"] };
