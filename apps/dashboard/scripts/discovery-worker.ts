import { config } from "dotenv";
import path from "node:path";

const once = process.argv.includes("--once");
const workerId = process.env.DISCOVERY_WORKER_ID ?? `discovery-${process.pid}`;

async function tick() {
  const { runDiscoveryWorkerOnce } = await import("../src/server/discovery-runs");
  const result = await runDiscoveryWorkerOnce(workerId);
  if (once || !result.processed) return result;
  return result;
}

async function main() {
  config({ path: path.resolve(process.cwd(), "../../.env") });
  if (once) {
    try { await tick(); }
    finally { const { getPgClient } = await import("@scrimspec/db"); await getPgClient().end(); }
    return;
  }
  // A deliberately small polling worker: durable leases make overlapping processes safe.
  for (;;) { await tick(); await new Promise((resolve) => setTimeout(resolve, 1_000)); }
}

main().catch((error) => { console.error("Discovery worker failed", error); process.exitCode = 1; });
