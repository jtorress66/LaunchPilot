import {
  createAuditEntry,
  type Actor,
  type AuditAction,
  type AuditActor,
  type AuditEntry,
  type AuditSubject,
  type UserId,
  type Workspace,
  type WorkspaceId,
} from "@nuvantre/domain";
import type {
  AuditTrail,
  Clock,
  ErrorReporter,
  IdGenerator,
  UserRepository,
} from "@nuvantre/ports";

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

/** The person acting through a workspace access. */
export const founderOfAccess = (access: { readonly user: { readonly id: UserId } }): Actor => ({
  kind: "founder",
  userId: access.user.id,
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
  /** Email address of each person behind an entry on this page, by user id. */
  readonly people: Readonly<Record<string, string>>;
  /** Pass back as `before` for the next page; null on the last page. */
  readonly nextBefore: Date | null;
}

/** The workspace's history, newest first, a page at a time. */
export class GetActivity {
  constructor(
    private readonly deps: { readonly audit: AuditTrail; readonly users: UserRepository },
  ) {}

  async execute(input: { workspace: Workspace; before?: Date }): Promise<ActivityPage> {
    // One extra row tells whether another page follows.
    const rows = await this.deps.audit.listByWorkspace(input.workspace.id, {
      limit: PAGE_SIZE + 1,
      ...(input.before ? { before: input.before } : {}),
    });
    const entries = rows.slice(0, PAGE_SIZE);
    const ids = new Set(
      entries.flatMap((e) => (e.actor.kind === "founder" ? [e.actor.userId] : [])),
    );
    const people: Record<string, string> = {};
    for (const id of ids) {
      const user = await this.deps.users.findById(id);
      if (user) people[id] = user.email;
    }
    return {
      entries,
      people,
      nextBefore: rows.length > PAGE_SIZE ? (entries.at(-1)?.at ?? null) : null,
    };
  }
}
