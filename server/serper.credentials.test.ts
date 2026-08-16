import { describe, expect, it } from "vitest";

const SERPER_ENDPOINT = "https://google.serper.dev/search";

describe("Serper.dev credentials", () => {
  it("authenticates a lightweight live USA Google search", async () => {
    const apiKey = process.env.SERPER_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch(SERPER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey!,
      },
      body: JSON.stringify({ q: "site:example.com", gl: "us", hl: "en", num: 1 }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { searchParameters?: { gl?: string } };
    expect(body.searchParameters?.gl).toBe("us");
  }, 15_000);
});
