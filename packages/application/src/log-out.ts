import { ok, type Result } from "@launchpilot/domain";
import type { SessionRepository } from "@launchpilot/ports";
import type { UseCaseError } from "./errors";

export class LogOut {
  constructor(private readonly deps: { readonly sessions: SessionRepository }) {}

  async execute(token: string): Promise<Result<null, UseCaseError>> {
    await this.deps.sessions.delete(token);
    return ok(null);
  }
}
