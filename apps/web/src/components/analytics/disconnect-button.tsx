import { disconnectAnalyticsAction } from "../../app/_lib/analytics-actions";

export function DisconnectButton({
  productId,
  provider,
  label,
}: {
  readonly productId: string;
  readonly provider: "google" | "plausible";
  readonly label: string;
}) {
  return (
    <form action={disconnectAnalyticsAction.bind(null, productId, provider)}>
      <button
        type="submit"
        className="text-sm font-medium text-slate-600 underline hover:text-red-700 dark:text-slate-400"
      >
        {label}
      </button>
    </form>
  );
}
