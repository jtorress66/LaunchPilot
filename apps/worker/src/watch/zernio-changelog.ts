// `pnpm watch:zernio [--days 8] [--out flagged.json]`: reads Zernio's public API changelog (no key
// needed) and lists the entries that affect LaunchPilot's integration. With --out it writes one
// GitHub issue (id, title, body) per entry, which the daily workflow opens if it does not exist yet.
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { findAffectingZernioChanges } from "../container";
import { toIssue } from "./changelog-report";

const DAY_MS = 24 * 60 * 60 * 1000;

const { values } = parseArgs({
  options: { days: { type: "string", default: "8" }, out: { type: "string" } },
});
const days = Number(values.days);
if (!Number.isInteger(days) || days < 1 || days > 90) {
  console.error("watch:zernio: --days must be a whole number from 1 to 90");
  process.exit(1);
}

const result = await findAffectingZernioChanges(new Date(Date.now() - days * DAY_MS));
if (!result.ok) {
  console.error(`watch:zernio: ${result.error}`);
  process.exit(1);
}
const issues = result.value.map(toIssue);
for (const issue of issues) console.log(`! ${issue.title}`);
console.log(
  `Zernio changelog, last ${String(days)} days: ${String(issues.length)} change(s) affect LaunchPilot.`,
);
if (values.out !== undefined) await writeFile(values.out, `${JSON.stringify(issues, null, 2)}\n`);
