import { container } from "./container";
import { createHeartbeat } from "./heartbeat";

const intervalMs = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 60_000);
const heartbeat = createHeartbeat(container);

heartbeat.tick();
const timer = setInterval(() => heartbeat.tick(), intervalMs);

const shutdown = (signal: NodeJS.Signals) => {
  clearInterval(timer);
  container.log(JSON.stringify({ event: "worker.shutdown", signal }));
  process.exit(0);
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
