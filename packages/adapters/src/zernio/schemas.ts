import { z } from "zod";

/** `GET /v1/accounts`, as the adapter reads it. */
export const accountList = z.object({
  accounts: z.array(
    z.object({
      _id: z.string().min(1),
      platform: z.string(),
      isActive: z.boolean(),
      needsReconnection: z.boolean().optional(),
    }),
  ),
});

/** `GET /v1/profiles`, as the smoke check reads it. */
export const profileList = z.object({ profiles: z.array(z.object({ _id: z.string().min(1) })) });

type Account = z.infer<typeof accountList>["accounts"][number];

/** An account LaunchPilot can post through: active and not waiting to be reconnected. */
export const isUsable = (account: Account) =>
  account.isActive && account.needsReconnection !== true;
