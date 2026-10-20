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

const socialMessages: Partial<Record<string, string>> = {
  unavailable: "Social accounts are unavailable right now. Try again in a minute.",
  rejected: "The social account service refused the request. Check the Zernio settings.",
};

/** What the founder sees when connecting X or LinkedIn fails. Provider details stay out of the UI. */
export const socialFailureMessage = (error: { code: string; message: string }): string =>
  socialMessages[error.code] ?? error.message;

/** What the founder sees when publishing fails; the platform's own reason is kept when useful. */
export const publishFailureMessage = (error: { code: string; message: string }): string =>
  error.code === "unavailable"
    ? "The channel is unavailable right now. Try again in a minute."
    : error.message;

const UNREACHABLE = "The analytics service could not be reached. Try again in a minute.";

const analyticsMessages: Partial<Record<string, string>> = {
  invalid_grant: "The Google sign-in expired. Try connecting again.",
  denied: "Google access was not granted.",
  missing_scope: "Allow LaunchPilot to see Search Console or Analytics data to connect Google.",
  oauth_state_mismatch: "The Google sign-in could not be checked. Try connecting again.",
  invalid_credentials: "The key was rejected. Check it and try again.",
  site_not_found: "No site with that domain was found for this key.",
  unreachable: UNREACHABLE,
  unavailable: UNREACHABLE,
  blocked: "That address cannot be used.",
};

/** What the founder sees when connecting analytics fails. Provider details stay out of the UI. */
export const analyticsFailureMessage = (error: { code: string; message: string }): string =>
  analyticsMessages[error.code] ?? error.message;
