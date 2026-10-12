import { err, ok, type Result } from "@launchpilot/domain";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { guardedLookup, isBlockedAddress, type AddressPolicy } from "./address-policy";

export interface HttpGetOptions {
  readonly policy: AddressPolicy;
  readonly userAgent: string;
  /** Deadline for the whole fetch, redirects included. */
  readonly timeoutMs: number;
  /** The body is cut off after this many bytes. */
  readonly maxBytes: number;
}

export interface HttpGetResponse {
  /** Final URL after redirects. */
  readonly url: string;
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
}

export interface HttpGetFailure {
  readonly reason: "blocked" | "timeout" | "network" | "too_many_redirects";
  readonly message: string;
}

const MAX_REDIRECTS = 5;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

type Hop = { redirect: string } | { response: HttpGetResponse };

const blockedTarget = (url: URL, policy: AddressPolicy): boolean => {
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  return isIP(host) !== 0 && isBlockedAddress(host, policy);
};

const failureOf = (error: unknown, signal: AbortSignal): HttpGetFailure => {
  if (signal.aborted) return { reason: "timeout", message: "The site did not answer in time" };
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EADDRBLOCKED") {
    return { reason: "blocked", message: "The site resolves to an address we cannot crawl" };
  }
  return { reason: "network", message: "The site could not be reached" };
};

const requestOnce = (url: URL, options: HttpGetOptions, signal: AbortSignal) =>
  new Promise<Hop>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.get(
      url,
      {
        agent: false,
        signal,
        lookup: guardedLookup(options.policy),
        headers: {
          "user-agent": options.userAgent,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (REDIRECTS.has(status) && location !== undefined) {
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
    request.on("error", reject);
  });

/**
 * GET with SSRF protection on every hop, a deadline and a size cap.
 * Expected failures come back as a Result; nothing here throws for a bad site.
 */
export const httpGet = async (
  target: string,
  options: HttpGetOptions,
): Promise<Result<HttpGetResponse, HttpGetFailure>> => {
  const signal = AbortSignal.timeout(options.timeoutMs);
  let url = new URL(target);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (blockedTarget(url, options.policy)) {
      return err({ reason: "blocked", message: "The site points to an address we cannot crawl" });
    }
    let result: Hop;
    try {
      result = await requestOnce(url, options, signal);
    } catch (error) {
      return err(failureOf(error, signal));
    }
    if ("response" in result) return ok(result.response);
    url = new URL(result.redirect, url);
  }
  return err({ reason: "too_many_redirects", message: "The site redirected too many times" });
};
