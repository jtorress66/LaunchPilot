import type { ReactNode } from "react";
import { AppHeader } from "../../components/app/app-header";
import { getAppContainer } from "../../container";
import { requireUser } from "../_lib/auth";

export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const { user, workspace } = await requireUser();
  const inbox = await getAppContainer().getInbox.execute({ workspace });
  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <AppHeader workspaceName={workspace.name} email={user.email} inboxCount={inbox.length} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
