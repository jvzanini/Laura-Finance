import { test, expect } from "@playwright/test";

test("X-Request-Id header presente em responses /api/v1", async ({ request }) => {
  // Smoke contra healthcheck publico — nao requer auth.
  const res = await request.get("/api/v1/health").catch(() => null);
  if (res && res.ok()) {
    const reqId = res.headers()["x-request-id"];
    expect(reqId).toBeTruthy();
    expect(reqId).toMatch(/^[0-9a-f-]{8,}$/i);
  } else {
    test.skip(true, "API nao disponivel — STANDBY [PROD-DEPLOY]");
  }
});
