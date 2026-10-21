import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the dashboard's helpers (no browser needed)
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) }, // same "@/..." imports as the app
  },
  test: {
    include: ["lib/**/*.test.ts", "components/**/*.test.ts"],
  },
});
