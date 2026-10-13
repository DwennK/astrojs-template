import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: {
    // The Workers runtime cannot read Vitest's host-side module cache.
    fsModuleCache: false,
    include: ["tests/worker/**/*.test.ts"],
  },
});
