import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/lib/__tests__/**/*.test.ts", "src/components/**/__tests__/**/*.test.{ts,tsx}"],
  },
});
