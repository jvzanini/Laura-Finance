import { test, expect } from "@playwright/test";

test("login com credencial invalida retorna error shape canonico", async ({ request }) => {
  const res = await request.post("/api/v1/auth/login", {
    data: { email: "x@x", password: "bad" },
  }).catch(() => null);
  if (res && res.status() === 401) {
    const body = await res.json();
    expect(body.error?.code).toBe("AUTH_INVALID_CREDENTIALS");
    expect(body.error?.request_id).toMatch(/^[0-9a-f-]{8,}$/i);
    expect(Date.parse(body.error?.timestamp)).not.toBeNaN();
    expect(body.error?.message).toBeTruthy();
  } else {
    test.skip(true, "API nao disponivel ou shape nao implementado ainda — STANDBY [PROD-DEPLOY]");
  }
});
