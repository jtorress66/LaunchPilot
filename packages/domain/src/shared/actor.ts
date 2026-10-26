import type { UserId } from "./ids";

export type AgentName =
  "brief" | "strategist" | "seo" | "launch" | "social" | "analyst" | "reviewer";

/** Who performed an action. Only founders may approve anything that leaves Nuvantre. */
export type Actor =
  | { readonly kind: "founder"; readonly userId: UserId }
  | { readonly kind: "agent"; readonly agent: AgentName };
