import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("Worker API", () => {
  it("returns an uncached health response", async () => {
    const response = await exports.default.fetch("http://localhost/api/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      environment: "local",
    });
  });

  it("rejects unsupported methods with an Allow header", async () => {
    const response = await exports.default.fetch(
      "http://localhost/api/contact",
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("rejects unsupported media types before reading a body", async () => {
    const response = await exports.default.fetch(
      "http://localhost/api/contact",
      {
        method: "POST",
        headers: { origin: "http://localhost", "content-type": "text/plain" },
        body: "not json",
      },
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("rejects cross-origin form submissions", async () => {
    const response = await exports.default.fetch(
      "http://localhost/api/contact",
      {
        method: "POST",
        headers: {
          origin: "https://attacker.example",
          "content-type": "application/json",
        },
        body: "{}",
      },
    );

    expect(response.status).toBe(403);
  });
});
