import type { Metadata } from "next";
import { InviteForm, RemoveMemberButton } from "../../../components/agency/agency-forms";
import { getAppContainer } from "../../../container";
import { requireAccess } from "../../_lib/auth";

export const metadata: Metadata = { title: "Team — Nuvantre" };

const card =
  "rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900";

const roleNames = { owner: "Owner", member: "Team member", viewer: "Client viewer" } as const;

export default async function TeamPage() {
  const access = await requireAccess("manage_team");
  const team = await getAppContainer().listTeam.execute({ access });
  const { members, pending } = team.ok ? team.value : { members: [], pending: [] };
  const isClient = access.workspace.agencyId !== null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          {isClient
            ? `Invite people from ${access.workspace.name} to read their reports. Your agency's team already works here.`
            : "Team members draft, approve and publish. Client viewers only read reports and activity."}
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="members" className={card}>
          <h2 id="members" className="mb-4 text-lg font-semibold">
            Members
          </h2>
          <ul aria-label="Members" className="divide-y divide-slate-200 dark:divide-slate-800">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{m.email}</p>
                  <p className="text-sm text-slate-500">{roleNames[m.role]}</p>
                </div>
                {m.userId === access.user.id ? null : (
                  <RemoveMemberButton userId={m.userId} email={m.email} />
                )}
              </li>
            ))}
          </ul>
          {pending.length > 0 ? (
            <>
              <h3 className="mt-6 mb-2 font-semibold">Invited</h3>
              <ul aria-label="Pending invitations" className="space-y-1 text-sm">
                {pending.map((i) => (
                  <li key={i.id}>
                    {i.email} · {roleNames[i.role]}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
        <section aria-labelledby="invite" className={`${card} h-fit`}>
          <h2 id="invite" className="mb-4 text-lg font-semibold">
            Invite someone
          </h2>
          <InviteForm />
        </section>
      </div>
    </div>
  );
}
