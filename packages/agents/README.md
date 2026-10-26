# @nuvantre/agents

Strategist, SEO, launch, social, analyst and reviewer agents (added from build step 5 onward).

Rules: depend on `@nuvantre/domain` and `@nuvantre/ports` only, receive every collaborator
(`LlmClient`, `Clock`, repositories…) through the constructor, and do exactly one job each:
draft **or** review **or** plan.
