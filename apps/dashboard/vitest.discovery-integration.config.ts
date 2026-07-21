import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Discovery integration tests share one local PostgreSQL queue.  Files run in
 * sequence, while each file retains its own in-test worker concurrency checks.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/server/discovery-runs-atomic-page.integration.test.ts",
      "src/server/discovery-runs-page-restart.integration.test.ts",
      "src/server/discovery-runs-stale-lease.integration.test.ts",
      "src/server/discovery-runs-concurrent-claim.integration.test.ts",
      "src/server/discovery-runs-budget-reservation.integration.test.ts",
      "src/server/discovery-runs-retry-policy.integration.test.ts",
      "src/server/discovery-runs-cancel-resume.integration.test.ts",
      "src/server/discovery-runs-finalization.integration.test.ts",
    ],
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
