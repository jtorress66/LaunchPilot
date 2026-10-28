import { can } from "@nuvantre/domain";
import type { ReactNode } from "react";
import { AppHeader } from "../../components/app/app-header";
import { getAppContainer } from "../../container";
import { appNav } from "../../server/app-nav";
import { requireUser } from "../_lib/auth";

export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const { user, workspace, role, workspaces } = await requireUser();
  const inbox = can(role, "approve") ? await getAppContainer().getInbox.execute({ workspace }) : [];
  const isClient = workspace.agencyId !== null;
  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <AppHeader
        workspaceName={workspace.name}
        email={user.email}
        nav={appNav({ role, isClient, inboxCount: inbox.length })}
        isClient={isClient}
        current={workspace.id}
        workspaces={workspaces.map((w) => ({
          id: w.workspace.id,
          name: w.workspace.name,
          role: w.role,
          isClient: w.workspace.agencyId !== null,
        }))}
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
