import { expect, test } from "@playwright/test";

test("GET /api/health returns status ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toMatchObject({ status: "ok", service: "web" });
});
