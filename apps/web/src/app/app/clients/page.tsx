import { plans } from "@nuvantre/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { AddClientForm } from "../../../components/agency/agency-forms";
import { WorkspaceSwitcherButton } from "../../../components/agency/open-workspace-button";
import { getAppContainer } from "../../../container";
import { requireAccess } from "../../_lib/auth";

export const metadata: Metadata = { title: "Clients — Nuvantre" };

const card =
  "rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900";

export default async function ClientsPage() {
  const access = await requireAccess("manage_clients");
  const app = getAppContainer();
  const [clients, dashboard] = await Promise.all([
    app.listClients.execute({ access }),
    app.getDashboard.execute(access.workspace),
  ]);
  const onAgency = dashboard.plan.id === "agency";
  const list = clients.ok ? clients.value : [];
  const limit = plans.agency.limits.clients;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Each client gets its own workspace with its own products and reports. Your team works in
          every client; a client only sees their own.
        </p>
      </div>
      {!onAgency ? (
        <p className={`${card} text-sm`}>
          Clients come with the Agency plan: {String(limit)} client workspaces for $
          {String(plans.agency.priceMonthlyUsd)} a month.{" "}
          <Link href="/app/billing" className="font-semibold text-brand-600 underline">
            See plans
          </Link>
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <section aria-labelledby="client-list" className={card}>
            <h2 id="client-list" className="mb-4 text-lg font-semibold">
              {String(list.length)} of {String(limit)} clients
            </h2>
            {list.length === 0 ? (
              <p className="text-sm text-slate-500">No clients yet.</p>
            ) : (
              <ul aria-label="Clients" className="divide-y divide-slate-200 dark:divide-slate-800">
                {list.map(({ workspace, products }) => (
                  <li key={workspace.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">{workspace.name}</p>
                      <p className="text-sm text-slate-500">
                        {products === 1 ? "1 product" : `${String(products)} products`}
                      </p>
                    </div>
                    <WorkspaceSwitcherButton workspaceId={workspace.id} name={workspace.name} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="add-client" className={`${card} h-fit`}>
            <h2 id="add-client" className="mb-4 text-lg font-semibold">
              Add a client
            </h2>
            <AddClientForm />
          </section>
        </div>
      )}
    </div>
  );
}
