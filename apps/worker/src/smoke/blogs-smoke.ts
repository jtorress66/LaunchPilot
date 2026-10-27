// `pnpm smoke:blogs`: the connect check against real Shopify, Webflow and Wix test accounts,
// read-only (no post is published). Each platform is checked once its variables are set; with
// none set it skips, since those formats are otherwise checked only against recordings.
import { parseBlogSmokeConfig } from "../config";
import { runBlogSmoke } from "../container";

function fail(message: string): never {
  console.error(`smoke:blogs: ${message}`);
  process.exit(1);
}

const config = parseBlogSmokeConfig(process.env);
if (!config.ok) fail(config.error);
if (config.value.length === 0) {
  console.log(
    "smoke:blogs: skipped. No Shopify, Webflow or Wix test account is configured; see README → Blog platforms.",
  );
  process.exit(0);
}

let failed = false;
for (const credentials of config.value) {
  const result = await runBlogSmoke(credentials);
  if (result.ok) {
    console.log(
      `${credentials.platform}: connected to ${result.value.siteName} (${result.value.siteUrl})`,
    );
  } else {
    failed = true;
    console.error(`${credentials.platform}: ${result.error.code}: ${result.error.message}`);
  }
}
if (failed) fail("at least one blog platform failed its connect check");
console.log("Blog smoke check passed.");
