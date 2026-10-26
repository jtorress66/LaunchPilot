import { err, ok, type Result } from "@nuvantre/domain";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { guardedLookup, isBlockedAddress, type AddressPolicy } from "./address-policy";

/**
 * Outbound HTTP to URLs a founder supplied (their site, their blog). Every hop is checked
 * against the address policy, so a founder URL can never reach our own network.
 */
export interface SafeHttpOptions {
  readonly policy: AddressPolicy;
  readonly userAgent: string;
  /** Deadline for the whole request, redirects included. */
  readonly timeoutMs: number;
  /** The response body is cut off after this many bytes. */
  readonly maxBytes: number;
}

export interface SafeHttpRequest {
  readonly method: "GET" | "POST";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface HttpResponse {
  /** Final URL after redirects. */
  readonly url: string;
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
}

export interface HttpFailure {
  readonly reason: "blocked" | "timeout" | "network" | "too_many_redirects";
  readonly message: string;
}

const MAX_REDIRECTS = 5;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

type Hop = { redirect: string } | { response: HttpResponse };

const blockedTarget = (url: URL, policy: AddressPolicy): boolean => {
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  return isIP(host) !== 0 && isBlockedAddress(host, policy);
};

const failureOf = (error: unknown, signal: AbortSignal): HttpFailure => {
  if (signal.aborted) return { reason: "timeout", message: "The site did not answer in time" };
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EADDRBLOCKED") {
    return { reason: "blocked", message: "The site resolves to an address we cannot reach" };
  }
  return { reason: "network", message: "The site could not be reached" };
};

const send = (url: URL, request: SafeHttpRequest, options: SafeHttpOptions, signal: AbortSignal) =>
  new Promise<Hop>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const outgoing = client.request(
      url,
      {
        method: request.method,
        agent: false,
        signal,
        lookup: guardedLookup(options.policy),
        headers: { "user-agent": options.userAgent, ...request.headers },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        // Only safe requests follow redirects; a redirected POST is reported to the caller.
        if (request.method === "GET" && REDIRECTS.has(status) && location !== undefined) {
          response.resume();
          resolve({ redirect: location });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        const finish = () => {
          resolve({
            response: {
              url: url.href,
              status,
              contentType: response.headers["content-type"] ?? "",
              body: Buffer.concat(chunks).subarray(0, options.maxBytes).toString("utf8"),
            },
          });
        };
        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
          if (size >= options.maxBytes) {
            response.destroy();
            finish();
          }
        });
        response.on("end", finish);
        response.on("error", reject);
      },
    );
    outgoing.on("error", reject);
    outgoing.end(request.body);
  });

/**
 * A request with SSRF protection on every hop, a deadline and a size cap.
 * Expected failures come back as a Result; nothing here throws for a bad site.
 */
export const safeRequest = async (
  target: string,
  request: SafeHttpRequest,
  options: SafeHttpOptions,
): Promise<Result<HttpResponse, HttpFailure>> => {
  const signal = AbortSignal.timeout(options.timeoutMs);
  let url = new URL(target);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (blockedTarget(url, options.policy)) {
      return err({ reason: "blocked", message: "The site points to an address we cannot reach" });
    }
    let result: Hop;
    try {
      result = await send(url, request, options, signal);
    } catch (error) {
      return err(failureOf(error, signal));
    }
    if ("response" in result) return ok(result.response);
    url = new URL(result.redirect, url);
  }
  return err({ reason: "too_many_redirects", message: "The site redirected too many times" });
};

export const httpGet = (target: string, options: SafeHttpOptions) =>
  safeRequest(target, { method: "GET" }, options);
