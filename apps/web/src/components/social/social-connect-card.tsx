"use client";

import type { SocialChannel } from "@launchpilot/domain";
import { useActionState } from "react";
import { connectSocialAction, type SocialActionState } from "../../app/_lib/social-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";
import { channelName } from "./channel-name";

export function SocialConnectCard({
  productId,
  linkedChannels,
}: {
  readonly productId: string;
  /** null until the founder has connected once. */
  readonly linkedChannels: readonly SocialChannel[] | null;
}) {
  const [state, action] = useActionState<SocialActionState>(
    connectSocialAction.bind(null, productId),
    {},
  );
  const linked = linkedChannels ?? [];
  return (
    <div className="space-y-4">
      {linked.length > 0 ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          Linked: {linked.map(channelName).join(" and ")}
        </p>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Link X and LinkedIn on Ayrshare&apos;s secure page. LaunchPilot never sees your passwords
          and only posts what you approve.
        </p>
      )}
      <form action={action} className="space-y-2">
        <SubmitButton pending="Opening…">
          {linked.length > 0 ? "Manage linked accounts" : "Connect X and LinkedIn"}
        </SubmitButton>
        <FormError message={state.errors?.form} />
      </form>
    </div>
  );
}
