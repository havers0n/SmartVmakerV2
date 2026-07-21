import "dotenv/config";
import { rebuildDiscoveryRunContentFormats } from "../src/server/discovery-runs";

const runId = process.argv[2];
if (!runId) {
  throw new Error("Usage: pnpm --filter dashboard discovery:backfill-content-formats <discovery-run-id>");
}

rebuildDiscoveryRunContentFormats(runId)
  .then((result) => console.log(`Updated content formats for ${result.updatedClusters} clusters.`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
