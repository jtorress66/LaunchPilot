export interface HealthReport {
  readonly status: "ok";
  readonly service: string;
  readonly version: string;
  readonly checkedAt: string;
}

export interface HealthInput {
  readonly service: string;
  readonly version: string;
  readonly now: Date;
}

/** Pure: the caller supplies the time, so the report is deterministic. */
export const buildHealthReport = ({ service, version, now }: HealthInput): HealthReport => ({
  status: "ok",
  service,
  version,
  checkedAt: now.toISOString(),
});
