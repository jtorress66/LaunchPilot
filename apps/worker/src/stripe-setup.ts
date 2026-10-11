import { parseStripeSetupConfig } from "./config";
import { runStripeSetup } from "./container";

/** CLI: `pnpm stripe:setup`. Creates LaunchPilot's Stripe prices if they are missing. */
const config = parseStripeSetupConfig(process.env, process.argv.slice(2));
if (!config.ok) {
  process.stderr.write(`${config.error}\n`);
  process.exit(1);
}

const result = await runStripeSetup(config.value);
if (!result.ok) {
  process.stderr.write(`Stripe setup failed: ${result.error}\n`);
  process.exit(1);
}
const { created } = result.value;
process.stdout.write(
  created.length === 0
    ? "Stripe prices already exist.\n"
    : `Created prices: ${created.join(", ")}\n`,
);
