import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach } from "vitest";

export interface Received {
  readonly method: string;
  readonly path: string;
  readonly search: string;
  readonly headers: IncomingMessage["headers"];
  readonly body: string;
}

export type Route = (req: IncomingMessage & { body: string }, res: ServerResponse) => void;

/**
 * A local platform that replays recorded responses, keyed by `METHOD /path`. Each test starts
 * from `serve()`'s happy path; `SITE_URL` in a recording becomes the server's own address.
 */
export const recordedServer = (serve: (routes: Map<string, Route>) => void) => {
  const state = {
    routes: new Map<string, Route>(),
    received: [] as Received[],
    url: "",
  };
  let server: Server;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://platform");
      let body = "";
      req.on("data", (chunk: Buffer) => (body += chunk.toString()));
      req.on("end", () => {
        state.received.push({
          method: req.method ?? "",
          path: url.pathname,
          search: url.search,
          headers: req.headers,
          body,
        });
        const handler = state.routes.get(`${req.method ?? ""} ${url.pathname}`);
        if (handler) handler(Object.assign(req, { body }), res);
        else res.writeHead(404, { "content-type": "text/html" }).end("<h1>Not Found</h1>");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    state.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  beforeEach(() => {
    state.routes.clear();
    state.received = [];
    serve(state.routes);
  });

  const json =
    (status: number, payload: unknown): Route =>
    (_req, res) => {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload).replaceAll("SITE_URL", state.url));
    };

  return { state, json };
};
