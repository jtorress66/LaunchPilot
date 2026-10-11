import { err, ok, parseEmail, startSession, type Result, type Session } from "@launchpilot/domain";
import type {
  Clock,
  PasswordHasher,
  SessionRepository,
  TokenGenerator,
  UserRepository,
} from "@launchpilot/ports";
import { failure, type UseCaseError } from "./errors";

export interface LogInDeps {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly hasher: PasswordHasher;
  readonly tokens: TokenGenerator;
  readonly clock: Clock;
}

const invalid = () => err(failure("invalid_credentials", "Email or password is incorrect"));

export class LogIn {
  /** Checked when the email is unknown, so failed logins take the same time either way. */
  private decoyHash: Promise<string> | undefined;

  constructor(private readonly deps: LogInDeps) {}

  async execute(input: {
    email: string;
    password: string;
  }): Promise<Result<Session, UseCaseError>> {
    const email = parseEmail(input.email);
    const user = email.ok ? await this.deps.users.findByEmail(email.value) : undefined;
    this.decoyHash ??= this.deps.hasher.hash("decoy password for unknown accounts");
    const hash = user?.passwordHash ?? (await this.decoyHash);
    const matches = await this.deps.hasher.verify(input.password, hash);
    if (!user || !matches) return invalid();

    const session = startSession({
      token: this.deps.tokens.generate(),
      userId: user.id,
      now: this.deps.clock.now(),
    });
    await this.deps.sessions.save(session);
    return ok(session);
  }
}
