const REDACTED = "[redacted]";

/** Patterns for values that must never reach a log line or an error report. */
const patterns: readonly [RegExp, string][] = [
  [/\b(Bearer|Ghost|Basic)\s+[\w.~+/=-]+/gi, `$1 ${REDACTED}`],
  [/\b(?:sk|rk|pk)_(?:live|test)_[\w]+/g, REDACTED],
  [/\bsk-ant-[\w-]+/g, REDACTED],
  [/\bwhsec_[\w]+/g, REDACTED],
  [/\bshpat_[\w]+/g, REDACTED],
  [/\b(password|passwd|secret|api_?key|token)=([^&\s]+)/gi, `$1=${REDACTED}`],
  // userinfo in URLs: scheme://user:password@host
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^:/\s@]+:)[^@\s/]+@/gi, `$1${REDACTED}@`],
  // OAuth and similar query parameters
  [/([?&](?:code|state|access_token|refresh_token|key|sig|signature)=)[^&\s#]+/gi, `$1${REDACTED}`],
];

/** Removes keys, tokens, passwords and secret URL parts from text before it is logged or sent. */
export const scrubSecrets = (text: string): string =>
  patterns.reduce(
    (scrubbed, [pattern, replacement]) => scrubbed.replace(pattern, replacement),
    text,
  );
