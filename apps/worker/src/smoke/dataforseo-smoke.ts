// `pnpm smoke:keywords`: one real DataForSEO call (limit 5, about $0.01) to prove the account,
// the credentials and the response format still match the recorded fixtures.
import { createKeywordProvider } from "../container";

function fail(message: string): never {
  console.error(`smoke:keywords: ${message}`);
  process.exit(1);
}

const login = process.env.DATAFORSEO_LOGIN;
const password = process.env.DATAFORSEO_PASSWORD;
if (!login || !password) {
  fail(
    "DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are not set. In CI: add them under Settings → Secrets and variables → Actions.",
  );
}

const result = await createKeywordProvider({ login, password }).suggest({
  seeds: ["website analytics"],
  locale: "en-US",
  limit: 5,
});
if (!result.ok) fail(`${result.error.code}: ${result.error.message}`);
if (result.value.length === 0) fail("DataForSEO returned no keyword ideas");
for (const idea of result.value) {
  console.log(
    `${idea.keyword.padEnd(40)} ${String(idea.monthlySearches).padStart(8)} searches  difficulty ${idea.difficulty}`,
  );
}
console.log(`DataForSEO smoke check passed: ${result.value.length} ideas.`);
