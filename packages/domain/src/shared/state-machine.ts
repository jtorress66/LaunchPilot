import { err, ok, type Result } from "../result";
import { domainError, type DomainError } from "./errors";

export type TransitionTable<S extends string, E extends string> = Readonly<
  Record<S, Readonly<Partial<Record<E, S>>>>
>;

export interface StateMachine<S extends string, E extends string> {
  readonly table: TransitionTable<S, E>;
  can(state: S, event: E): boolean;
}

/** Declares allowed transitions as data, so entities add states and events without branching. */
export const defineTransitions = <S extends string, E extends string>(
  table: TransitionTable<S, E>,
): StateMachine<S, E> => ({
  table,
  can: (state, event) => table[state][event] !== undefined,
});

export const applyTransition = <S extends string, E extends string>(
  machine: StateMachine<S, E>,
  state: S,
  event: E,
): Result<S, DomainError> => {
  const next = machine.table[state][event];
  return next === undefined
    ? err(domainError("invalid_transition", `Cannot "${event}" from "${state}"`))
    : ok(next);
};
