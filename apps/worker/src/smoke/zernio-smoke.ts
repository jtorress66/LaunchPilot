// `pnpm smoke:social`: read-only calls to the real Zernio API, proving that ZERNIO_API_KEY works
// and that the responses still match the adapter. It never posts anything.
import { runSocialSmoke } from "../container";

function fail(message: string): never {
  console.error(`smoke:social: ${message}`);
  process.exit(1);
}

const apiKey = process.env.ZERNIO_API_KEY;
if (!apiKey) {
  fail(
    "ZERNIO_API_KEY is not set. In CI: add it under Settings → Secrets and variables → Actions.",
  );
}

const result = await runSocialSmoke({ apiKey, baseUrl: null });
if (!result.ok) fail(result.error);
const { profiles, xAccounts, linkedinAccounts } = result.value;
console.log(
  `Zernio smoke check passed: ${String(profiles)} profiles, ${String(xAccounts)} X and ${String(linkedinAccounts)} LinkedIn accounts linked.`,
);
