// `pnpm smoke:social`: posts one real test post to X through Zernio, then takes it down.
// Proves the API key, the linked test X account and the response format still work.
import { runSocialSmoke } from "../container";

function fail(message: string): never {
  console.error(`smoke:social: ${message}`);
  process.exit(1);
}

const apiKey = process.env.ZERNIO_API_KEY;
const accountId = process.env.ZERNIO_TEST_X_ACCOUNT_ID;
if (!apiKey || !accountId) {
  fail(
    "ZERNIO_API_KEY and ZERNIO_TEST_X_ACCOUNT_ID are not set. In CI: add them under Settings → Secrets and variables → Actions.",
  );
}

const runId = process.env.GITHUB_RUN_ID ?? String(Date.now());
const result = await runSocialSmoke(
  { apiKey, baseUrl: null },
  accountId,
  `LaunchPilot CI smoke test ${runId}`,
);
if (!result.ok) fail(result.error);
console.log(`Zernio smoke check passed: posted and took down ${result.value.postUrl}`);
