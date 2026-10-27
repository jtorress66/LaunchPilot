export interface SecurityHeaderOptions {
  /** Served over HTTPS, so browsers may be told to stay there. */
  readonly https: boolean;
  /** The development server needs eval for hot reload. */
  readonly development: boolean;
}

/** Per-response headers: a nonce-based Content-Security-Policy, plus HSTS over HTTPS. */
export const buildSecurityHeaders = (
  nonce: string,
  options: SecurityHeaderOptions,
): Record<string, string> => {
  const policy: Record<string, readonly string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(options.development ? ["'unsafe-eval'"] : []),
    ],
    // Next and React set inline style attributes; styles cannot run code.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'", "https://checkout.stripe.com"],
  };
  const csp = Object.entries(policy)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
  return {
    "content-security-policy": csp,
    ...(options.https
      ? { "strict-transport-security": "max-age=63072000; includeSubDomains" }
      : {}),
  };
};
