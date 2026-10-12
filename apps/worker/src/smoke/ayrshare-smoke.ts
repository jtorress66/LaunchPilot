// `pnpm smoke:social`: posts one real test post to X through Ayrshare on a dedicated test
// profile, then deletes it. Proves the API key, the linked X account and the response format.
import { runAyrshareSmoke, SystemClock } from "@launchpilot/adapters";

function fail(message: string): never {
  console.error(`smoke:social: ${message}`);
  process.exit(1);
}

const apiKey = process.env.AYRSHARE_API_KEY;
const profileKey = process.env.AYRSHARE_TEST_PROFILE_KEY;
if (!apiKey || !profileKey) {
  fail(
    "AYRSHARE_API_KEY and AYRSHARE_TEST_PROFILE_KEY are not set. In CI: add them under Settings → Secrets and variables → Actions.",
  );
}
const xKey = process.env.AYRSHARE_X_API_KEY;
const xSecret = process.env.AYRSHARE_X_API_SECRET;
if (!xKey || !xSecret) {
  fail(
    "AYRSHARE_X_API_KEY and AYRSHARE_X_API_SECRET are not set. Since March 2026 Ayrshare needs your own X developer app's keys to post to X.",
  );
}

const runId = process.env.GITHUB_RUN_ID ?? String(Date.now());
const result = await runAyrshareSmoke(
  // Linking is not exercised here, so the JWT domain and key are not needed.
  {
    apiKey,
    domain: "",
    privateKey: "",
    xCredentials: { apiKey: xKey, apiSecret: xSecret },
    clock: new SystemClock(),
  },
  profileKey,
  `LaunchPilot CI smoke test ${runId}`,
);
if (!result.ok) fail(result.error);
console.log(`Ayrshare smoke check passed: posted and deleted ${result.value.postUrl}`);
