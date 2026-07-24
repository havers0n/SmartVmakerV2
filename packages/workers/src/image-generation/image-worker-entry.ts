import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { createLogger } from "@aec/logger";
import { getDrizzleClient } from "@scrimspec/db";
import {
  ImageWorkerRuntime,
  SHUTDOWN_TIMEOUT_MS,
} from "./image-worker-runtime.js";
import { createGeminiProviderAdapter } from "./gemini-provider-adapter.js";
import { createMiniMaxProviderAdapter } from "./minimax-provider-adapter.js";
import { RoutingImageProviderAdapter } from "./routing-provider-adapter.js";
import { createR2StorageAdapter } from "./r2-storage-adapter.js";

const logger = createLogger({ name: "image-worker" });

process.on("uncaughtException", (err) => {
  const msg = String(err);
  if (
    msg.includes("ECONNRESET") ||
    msg.includes("Connection terminated") ||
    msg.includes("57P01")
  ) {
    logger.warn("DB connection glitch intercepted. Staying alive.");
    return;
  }
  logger.fatal({ err }, "Uncaught exception");
  process.exit(1);
});

function validateEnv(): void {
  const dbUrl = process.env.DRIZZLE_DATABASE_URL;
  if (!dbUrl || dbUrl.includes("[YOUR_PASSWORD]")) {
    throw new Error("DRIZZLE_DATABASE_URL is not configured");
  }

  const r2Account = process.env.R2_ACCOUNT_ID;
  const r2Key = process.env.R2_ACCESS_KEY_ID;
  const r2Secret = process.env.R2_SECRET_ACCESS_KEY;
  if (!r2Account || !r2Key || !r2Secret) {
    throw new Error(
      "R2 storage credentials are not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)",
    );
  }

  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasMiniMax = !!process.env.MINIMAX_API_KEY;

  if (!hasGemini && !hasMiniMax) {
    throw new Error(
      "No image provider configured. Set GEMINI_API_KEY and/or MINIMAX_API_KEY.",
    );
  }

  logger.info({ hasGemini, hasMiniMax }, "Image worker environment validated");
}

async function main(): Promise<void> {
  validateEnv();

  const db = getDrizzleClient();
  const gemini = process.env.GEMINI_API_KEY
    ? createGeminiProviderAdapter()
    : undefined;
  const minimax = process.env.MINIMAX_API_KEY
    ? createMiniMaxProviderAdapter()
    : undefined;
  const provider = new RoutingImageProviderAdapter({ gemini, minimax, logger });
  const storage = createR2StorageAdapter();

  const runtime = new ImageWorkerRuntime({
    db,
    provider,
    storage,
    logger,
  });

  process.once("SIGTERM", () => runtime.requestShutdown());
  process.once("SIGINT", () => runtime.requestShutdown());

  process.once("SIGALRM", () => {
    logger.fatal("Shutdown timeout exceeded; forcing exit");
    process.exit(1);
  });

  setTimeout(() => {
    process.emit("SIGALRM" as any);
  }, SHUTDOWN_TIMEOUT_MS + 10_000).unref();

  await runtime.run();
}

if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    logger.fatal({ err: error }, "Image worker terminated");
    process.exitCode = 1;
  });
}
