/** Which form field a use-case error belongs to, so it can be shown next to the input. */
const fields: Partial<Record<string, string>> = {
  invalid_email: "email",
  email_taken: "email",
  weak_password: "password",
  invalid_url: "url",
  invalid_text: "name",
};

export const fieldFor = (code: string): string => fields[code] ?? "form";

const BUSY = "Our AI is busy right now. Try again in a minute.";
const FAILED = "Something went wrong while drafting. Please try again.";

const draftMessages: Partial<Record<string, string>> = {
  rate_limited: BUSY,
  unavailable: BUSY,
  refused: "The AI could not draft a brief for this site. You can try again.",
  ungrounded: "We could not find enough facts on your site to draft a reliable brief.",
  generation_failed: FAILED,
  invalid_request: FAILED,
};

/** What the founder sees when a brief cannot be drafted. Internal details stay in the logs. */
export const draftFailureMessage = (error: { code: string; message: string }): string => {
  if (error.code === "crawl_failed") return `We could not read your site: ${error.message}`;
  return draftMessages[error.code] ?? error.message;
};

const keywordMessages: Partial<Record<string, string>> = {
  quota_exceeded: "Keyword research is paused: the keyword data account needs more credit.",
  unavailable: "Keyword research is unavailable right now. Try again in a minute.",
  invalid_request: "Keyword research could not run for these topics. Try different wording.",
};

/** What the founder sees when planning content fails. Provider details stay out of the UI. */
export const keywordFailureMessage = (error: { code: string; message: string }): string =>
  keywordMessages[error.code] ?? error.message;
