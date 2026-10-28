import {
  createAuditEntry,
  type AuditAction,
  type AuditActor,
  type AuditEntry,
  type AuditSubject,
  type Workspace,
  type WorkspaceId,
} from "@nuvantre/domain";
import type { AuditTrail, Clock, ErrorReporter, IdGenerator } from "@nuvantre/ports";

export interface AuditDeps {
  readonly audit: AuditTrail;
  readonly errors: ErrorReporter;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/** The founder who owns the workspace: the person behind every action taken in the app. */
export const founderOf = (workspace: Workspace): AuditActor => ({
  kind: "founder",
  userId: workspace.ownerId,
});

/**
 * Adds an entry to the workspace's activity after an action succeeded. A failure to record
 * never undoes the action; it is reported so an operator can see the gap.
 */
export const recordAudit = async (
  deps: AuditDeps,
  input: {
    readonly workspaceId: WorkspaceId;
    readonly actor: AuditActor;
    readonly action: AuditAction;
    readonly subject: AuditSubject;
  },
): Promise<void> => {
  try {
    await deps.audit.record(
      createAuditEntry({ id: deps.ids.next(), ...input, now: deps.clock.now() }),
    );
  } catch (error) {
    deps.errors.report(error, { workspaceId: input.workspaceId });
  }
};

const PAGE_SIZE = 50;

export interface ActivityPage {
  readonly entries: readonly AuditEntry[];
  /** Pass back as `before` for the next page; null on the last page. */
  readonly nextBefore: Date | null;
}

/** The workspace's history, newest first, a page at a time. */
export class GetActivity {
  constructor(private readonly deps: { readonly audit: AuditTrail }) {}

  async execute(input: { workspace: Workspace; before?: Date }): Promise<ActivityPage> {
    // One extra row tells whether another page follows.
    const rows = await this.deps.audit.listByWorkspace(input.workspace.id, {
      limit: PAGE_SIZE + 1,
      ...(input.before ? { before: input.before } : {}),
    });
    const entries = rows.slice(0, PAGE_SIZE);
    return {
      entries,
      nextBefore: rows.length > PAGE_SIZE ? (entries.at(-1)?.at ?? null) : null,
    };
  }
}
