// Agents depend on @launchpilot/domain and @launchpilot/ports only and receive every
// collaborator through their constructor. Each one drafts, reviews or plans, never several.
export { BriefAgent } from "./brief/brief-agent";
export { ExtractiveBriefDrafter } from "./brief/extractive-brief-drafter";
export { BRIEF_SYSTEM_PROMPT } from "./brief/prompt";
