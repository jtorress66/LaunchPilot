import {
  checkPassword,
  createUser,
  createWorkspace,
  err,
  freeSubscription,
  ok,
  parseEmail,
  startSession,
  userId,
  workspaceId,
  type Result,
  type Session,
  type User,
  type Workspace,
} from "@nuvantre/domain";
import type {
  Clock,
  IdGenerator,
  PasswordHasher,
  SessionRepository,
  SubscriptionRepository,
  TokenGenerator,
  UserRepository,
  WorkspaceRepository,
} from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";

export interface SignUpDeps {
  readonly users: UserRepository;
  readonly workspaces: WorkspaceRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly sessions: SessionRepository;
  readonly hasher: PasswordHasher;
  readonly tokens: TokenGenerator;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

export interface SignedUp {
  readonly user: User;
  readonly workspace: Workspace;
  readonly session: Session;
}

/** Creates a founder account with a workspace on the Free plan and signs them in. */
export class SignUp {
  constructor(private readonly deps: SignUpDeps) {}

  async execute(input: {
    email: string;
    password: string;
  }): Promise<Result<SignedUp, UseCaseError>> {
    const email = parseEmail(input.email);
    if (!email.ok) return email;
    const password = checkPassword(input.password, email.value);
    if (!password.ok) return password;
    if (await this.deps.users.findByEmail(email.value)) {
      return err(failure("email_taken", "An account with this email already exists"));
    }

    const now = this.deps.clock.now();
    const user = createUser({
      id: userId(this.deps.ids.next()),
      email: email.value,
      passwordHash: await this.deps.hasher.hash(password.value),
      now,
    });
    const workspace = createWorkspace({
      id: workspaceId(this.deps.ids.next()),
      ownerId: user.id,
      name: "My workspace",
      now,
    });
    if (!workspace.ok) return workspace;
    const session = startSession({ token: this.deps.tokens.generate(), userId: user.id, now });

    await this.deps.users.save(user);
    await this.deps.workspaces.save(workspace.value);
    await this.deps.subscriptions.save(freeSubscription(workspace.value.id, now));
    await this.deps.sessions.save(session);
    return ok({ user, workspace: workspace.value, session });
  }
}
