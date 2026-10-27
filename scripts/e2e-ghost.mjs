// A real Ghost blog for the step 10.6 E2E gate: Ghost 5 on SQLite in Docker, set up through its
// Admin API, with a custom integration whose Admin API key the founder pastes. Dev/test only.
import { randomBytes } from "node:crypto";
import { GenericContainer, Wait } from "testcontainers";

const GHOST_PORT = 4050;
// Ghost refuses passwords containing "ghost" or "password", so the owner gets a random one.
const OWNER = {
  name: "Nuvantre E2E",
  email: "owner@nuvantre.test",
  password: randomBytes(18).toString("hex"),
};

const call = async (url, path, { method = "GET", body, cookie } = {}) => {
  const response = await fetch(`${url}/ghost/api/admin/${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: url,
      "accept-version": "v5.0",
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    throw new Error(`Ghost ${method} ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response;
};

export const startGhost = async () => {
  const ghost = await new GenericContainer("ghost:5-alpine")
    .withEnvironment({
      NODE_ENV: "development",
      // IPv4 only: Ghost's default "::" fails where Docker has no IPv6.
      server__host: "0.0.0.0",
      url: `http://127.0.0.1:${GHOST_PORT}`,
      database__client: "sqlite3",
      database__connection__filename: "/var/lib/ghost/content/data/ghost.db",
      security__staffDeviceVerification: "false",
      logging__level: "warn",
    })
    .withExposedPorts({ container: 2368, host: GHOST_PORT })
    .withWaitStrategy(Wait.forHttp("/ghost/api/admin/site/", 2368).withStartupTimeout(180_000))
    .start();
  const url = `http://127.0.0.1:${GHOST_PORT}`;

  await call(url, "authentication/setup/", {
    method: "POST",
    body: { setup: [{ ...OWNER, blogTitle: "Nuvantre E2E Ghost" }] },
  });
  const session = await call(url, "session/", {
    method: "POST",
    body: { username: OWNER.email, password: OWNER.password },
  });
  const cookie = session.headers.get("set-cookie")?.split(";")[0] ?? "";
  const created = await call(url, "integrations/?include=api_keys", {
    method: "POST",
    cookie,
    body: { integrations: [{ name: "Nuvantre" }] },
  });
  const { integrations } = await created.json();
  const admin = integrations[0].api_keys.find((key) => key.type === "admin");

  return {
    // Ghost returns the admin key's secret already as `{id}:{secret}`, as its UI shows it.
    env: { E2E_GHOST_URL: `${url}/`, E2E_GHOST_ADMIN_KEY: admin.secret },
    stop: () => ghost.stop(),
  };
};
