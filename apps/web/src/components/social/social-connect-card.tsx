"use client";

import { socialChannels, type SocialChannel } from "@launchpilot/domain";
import { useActionState } from "react";
import { connectSocialAction, type SocialActionState } from "../../app/_lib/social-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";
import { channelName } from "./channel-name";

function ConnectButton({
  productId,
  channel,
  linked,
}: {
  readonly productId: string;
  readonly channel: SocialChannel;
  readonly linked: boolean;
}) {
  const [state, action] = useActionState<SocialActionState>(
    connectSocialAction.bind(null, productId, channel),
    {},
  );
  return (
    <form action={action} className="space-y-2">
      <SubmitButton pending="Opening…">
        {linked ? `Reconnect ${channelName(channel)}` : `Connect ${channelName(channel)}`}
      </SubmitButton>
      <FormError message={state.errors?.form} />
    </form>
  );
}

export function SocialConnectCard({
  productId,
  linkedChannels,
}: {
  readonly productId: string;
  /** null until the founder has connected once. */
  readonly linkedChannels: readonly SocialChannel[] | null;
}) {
  const linked = linkedChannels ?? [];
  return (
    <div className="space-y-4">
      {linked.length > 0 ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          Linked: {linked.map(channelName).join(" and ")}
        </p>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Link your accounts on the platform&apos;s own sign-in page, through Zernio. LaunchPilot
          never sees your passwords and only posts what you approve.
        </p>
      )}
      {socialChannels.map((channel) => (
        <ConnectButton
          key={channel}
          productId={productId}
          channel={channel}
          linked={linked.includes(channel)}
        />
      ))}
    </div>
  );
}
