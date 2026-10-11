import { err, ok, type Result } from "../result";
import { domainError, type DomainError } from "./errors";
import type { Brand } from "./ids";

export type HttpUrl = Brand<string, "HttpUrl">;

interface WhatwgUrl {
  readonly protocol: string;
  readonly hostname: string;
  toString(): string;
}

/**
 * The WHATWG URL parser is a standard global in Node, browsers and edge runtimes and does no I/O.
 * Domain loads no DOM or Node type libraries, so we type just the part we use.
 */
const WhatwgUrlParser = (
  globalThis as unknown as {
    URL: { new (input: string): WhatwgUrl; canParse(input: string): boolean };
  }
).URL;

const invalid = (value: string) =>
  err(domainError("invalid_url", `"${value}" is not a valid http(s) URL`));

/** Absolute http(s) URL with a host, normalised by the WHATWG URL parser. */
export const parseHttpUrl = (value: string): Result<HttpUrl, DomainError> => {
  const trimmed = value.trim();
  if (!WhatwgUrlParser.canParse(trimmed)) return invalid(trimmed);
  const url = new WhatwgUrlParser(trimmed);
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname === "") {
    return invalid(trimmed);
  }
  return ok(url.toString() as HttpUrl);
};
