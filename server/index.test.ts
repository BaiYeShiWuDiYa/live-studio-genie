import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStudioServer } from "./index.js";

const cleanup: Array<() => void> = [];

afterEach(() => {
  cleanup.splice(0).reverse().forEach((dispose) => dispose());
});

async function startTestServer(apiKey?: string) {
  const publicRoot = mkdtempSync(join(tmpdir(), "live-studio-genie-"));
  writeFileSync(join(publicRoot, "index.html"), "<h1>Studio</h1>");
  const server = createStudioServer({ publicRoot, apiKey });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  cleanup.push(() => {
    server.close();
    rmSync(publicRoot, { force: true, recursive: true });
  });

  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe("production server", () => {
  it("serves the SPA and health endpoint", async () => {
    const origin = await startTestServer();

    const health = await fetch(`${origin}/healthz`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ status: "ok" });

    const page = await fetch(`${origin}/studio`);
    expect(page.status).toBe(200);
    await expect(page.text()).resolves.toContain("Studio");
  });

  it("keeps the model key server-side", async () => {
    const origin = await startTestServer();
    const response = await fetch(`${origin}/api/genie/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hello" }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "未配置 GENIE_MODEL_AK，请检查 Goofy 运行时环境变量。",
    });
  });
});
