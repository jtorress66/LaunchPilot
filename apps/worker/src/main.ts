import {
  parseLoopConfig,
  parseMailConfig,
  parseMonitoringConfig,
  parsePublisherConfig,
  parseReportsConfig,
} from "./config";
import {
  container,
  createErrorReporter,
  createJobRuntime,
  createPublishDue,
  createWeeklyLoop,
  createWeeklyReports,
} from "./container";
import { createHeartbeat } from "./heartbeat";
import { createPublishDueJob } from "./jobs/publish-due-job";
import { createPurgeRateLimitsJob } from "./jobs/purge-rate-limits-job";
import { createWeeklyLoopJob } from "./jobs/weekly-loop-job";
import { createWeeklyReportsJob } from "./jobs/weekly-reports-job";

const config = parsePublisherConfig(process.env);
const reportsConfig = parseReportsConfig(process.env);
const loopConfig = parseLoopConfig(process.env);
const monitoring = parseMonitoringConfig(process.env);
const mail = parseMailConfig(process.env);
if (!config.ok || !reportsConfig.ok || !loopConfig.ok || !monitoring.ok || !mail.ok) {
  const error = [config, reportsConfig, loopConfig, monitoring, mail].flatMap((c) =>
    c.ok ? [] : [c.error],
  )[0];
  container.log(JSON.stringify({ event: "worker.config_invalid", error }));
  process.exit(1);
}
if (reportsConfig.value.google === null) {
  container.log(JSON.stringify({ event: "worker.google_not_configured" }));
}

const HOUR_MS = 60 * 60 * 1000;
const heartbeatMs = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 60_000);
const errors = createErrorReporter(monitoring.value);
// Every job runs under a Postgres advisory lock, so several workers never run one job twice.
const jobs = createJobRuntime(config.value.connectionString, errors);
const publishing = createPublishDue(config.value, errors);
const reporting = createWeeklyReports(config.value, reportsConfig.value, mail.value, errors);
const looping = createWeeklyLoop(config.value, loopConfig.value);
const { runtime } = jobs;
const publishJob = createPublishDueJob({ publishDue: publishing.publishDue, runtime });
const reportsJob = createWeeklyReportsJob({
  buildDue: reporting.buildDue,
  emails: reporting.emails,
  runtime,
});
const loopJob = createWeeklyLoopJob({ runDue: looping.runDue, runtime });
const purgeJob = createPurgeRateLimitsJob({ limits: jobs.limits, runtime });
const heartbeat = createHeartbeat({
  ...container,
  jobs: {
    publish_due: publishJob,
    weekly_reports: reportsJob,
    weekly_loop: loopJob,
    purge_rate_limits: purgeJob,
  },
});

heartbeat.tick();
void publishJob.run();
void reportsJob.run();
void loopJob.run();
void purgeJob.run();
const timers = [
  setInterval(() => heartbeat.tick(), heartbeatMs),
  setInterval(() => void publishJob.run(), config.value.intervalMs),
  setInterval(() => void reportsJob.run(), reportsConfig.value.intervalMs),
  setInterval(() => void loopJob.run(), loopConfig.value.intervalMs),
  setInterval(() => void purgeJob.run(), HOUR_MS),
];

const shutdown = (signal: NodeJS.Signals) => {
  for (const timer of timers) clearInterval(timer);
  container.log(JSON.stringify({ event: "worker.shutdown", signal }));
  void Promise.all([publishing.close(), reporting.close(), looping.close(), jobs.close()]).finally(
    () => process.exit(0),
  );
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
