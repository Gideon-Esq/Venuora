import path from "node:path";
import { defineConfig } from "vitest/config";

// Upload security checks use mocked auth/storage and do not need PostgreSQL.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["tests/image-upload.test.ts"] },
});
