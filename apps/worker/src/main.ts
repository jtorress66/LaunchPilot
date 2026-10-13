import { parsePublisherConfig } from "./config";
import { container, createPublishDue } from "./container";
import { createHeartbeat } from "./heartbeat";
import { createPublishDueJob } from "./jobs/publish-due-job";

const config = parsePublisherConfig(process.env);
if (!config.ok) {
  container.log(JSON.stringify({ event: "worker.config_invalid", error: config.error }));
  process.exit(1);
}

const heartbeatMs = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 60_000);
const heartbeat = createHeartbeat(container);
// Assumes a single worker instance; concurrent workers need a lock (build step 11).
const { publishDue, close } = createPublishDue(config.value);
const job = createPublishDueJob({ publishDue, log: container.log });

heartbeat.tick();
void job.run();
const timers = [
  setInterval(() => heartbeat.tick(), heartbeatMs),
  setInterval(() => void job.run(), config.value.intervalMs),
];

const shutdown = (signal: NodeJS.Signals) => {
  for (const timer of timers) clearInterval(timer);
  container.log(JSON.stringify({ event: "worker.shutdown", signal }));
  void close().finally(() => process.exit(0));
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
