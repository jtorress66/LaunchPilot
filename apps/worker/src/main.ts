import { parsePublisherConfig, parseReportsConfig } from "./config";
import { container, createPublishDue, createWeeklyReports } from "./container";
import { createHeartbeat } from "./heartbeat";
import { createPublishDueJob } from "./jobs/publish-due-job";
import { createWeeklyReportsJob } from "./jobs/weekly-reports-job";

const config = parsePublisherConfig(process.env);
const reportsConfig = parseReportsConfig(process.env);
if (!config.ok || !reportsConfig.ok) {
  const error = !config.ok ? config.error : !reportsConfig.ok ? reportsConfig.error : "";
  container.log(JSON.stringify({ event: "worker.config_invalid", error }));
  process.exit(1);
}
if (reportsConfig.value.google === null) {
  container.log(JSON.stringify({ event: "worker.google_not_configured" }));
}

const heartbeatMs = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 60_000);
const heartbeat = createHeartbeat(container);
// Assumes a single worker instance; concurrent workers need a lock (build step 11).
const publishing = createPublishDue(config.value);
const reporting = createWeeklyReports(config.value, reportsConfig.value);
const publishJob = createPublishDueJob({ publishDue: publishing.publishDue, log: container.log });
const reportsJob = createWeeklyReportsJob({ buildDue: reporting.buildDue, log: container.log });

heartbeat.tick();
void publishJob.run();
void reportsJob.run();
const timers = [
  setInterval(() => heartbeat.tick(), heartbeatMs),
  setInterval(() => void publishJob.run(), config.value.intervalMs),
  setInterval(() => void reportsJob.run(), reportsConfig.value.intervalMs),
];

const shutdown = (signal: NodeJS.Signals) => {
  for (const timer of timers) clearInterval(timer);
  container.log(JSON.stringify({ event: "worker.shutdown", signal }));
  void Promise.all([publishing.close(), reporting.close()]).finally(() => process.exit(0));
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
