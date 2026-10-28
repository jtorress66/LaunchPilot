import {
  createClientWorkspace,
  domainError,
  err,
  ok,
  plans,
  workspaceId,
  type Result,
  type Workspace,
} from "@nuvantre/domain";
import type { ProductRepository } from "@nuvantre/ports";
import { founderOfAccess, recordAudit, type AuditDeps } from "./audit";
import { currentPlan, type PlanDeps } from "./current-plan";
import { failure, type UseCaseError } from "./errors";
import { authorize, type WorkspaceAccess } from "./workspace-access";

/** Adds a client workspace to an agency on the Agency plan, up to the plan's number of clients. */
export class AddClient {
  constructor(private readonly deps: PlanDeps & AuditDeps) {}

  async execute(input: {
    access: WorkspaceAccess;
    name: string;
  }): Promise<Result<Workspace, UseCaseError>> {
    const allowed = authorize(input.access, "manage_clients");
    if (!allowed.ok) return allowed;
    const agency = input.access.workspace;
    if ((await currentPlan(this.deps, agency)) !== "agency") {
      return err(failure("agency_plan_required", "Clients come with the Agency plan"));
    }
    const { clients } = plans.agency.limits;
    if ((await this.deps.workspaces.listClients(agency.id)).length >= clients) {
      return err(
        domainError("plan_limit_reached", `The Agency plan includes ${String(clients)} clients.`),
      );
    }
    const client = createClientWorkspace(agency, {
      id: workspaceId(this.deps.ids.next()),
      name: input.name,
      now: this.deps.clock.now(),
    });
    if (!client.ok) return client;
    await this.deps.workspaces.save(client.value);
    await recordAudit(this.deps, {
      workspaceId: agency.id,
      actor: founderOfAccess(input.access),
      action: "client_added",
      subject: { kind: "workspace", id: client.value.id, label: client.value.name },
    });
    return client;
  }
}

export interface ClientSummary {
  readonly workspace: Workspace;
  readonly products: number;
}

/** An agency's clients with how many products each has. Empty for any other workspace. */
export class ListClients {
  constructor(private readonly deps: PlanDeps & { readonly products: ProductRepository }) {}

  async execute(input: {
    access: WorkspaceAccess;
  }): Promise<Result<readonly ClientSummary[], UseCaseError>> {
    const allowed = authorize(input.access, "view");
    if (!allowed.ok) return allowed;
    const clients = await this.deps.workspaces.listClients(input.access.workspace.id);
    return ok(
      await Promise.all(
        clients.map(async (workspace) => ({
          workspace,
          products: (await this.deps.products.listByWorkspace(workspace.id)).length,
        })),
      ),
    );
  }
}
