import { describe, expect, it } from "vitest";
import {
  analyticsFailureMessage,
  draftFailureMessage,
  fieldFor,
  keywordFailureMessage,
  publishFailureMessage,
  socialFailureMessage,
} from "./messages";

describe("fieldFor", () => {
  it.each([
    ["invalid_email", "email"],
    ["email_taken", "email"],
    ["weak_password", "password"],
    ["invalid_url", "url"],
    ["invalid_text", "name"],
    ["plan_limit_reached", "form"],
    ["invalid_credentials", "form"],
  ] as const)("shows a %s error on the %s field", (code, field) => {
    expect(fieldFor(code)).toBe(field);
  });
});

describe("draftFailureMessage", () => {
  it.each([
    ["rate_limited", "Our AI is busy right now. Try again in a minute."],
    ["unavailable", "Our AI is busy right now. Try again in a minute."],
    ["refused", "The AI could not draft a brief for this site. You can try again."],
    ["ungrounded", "We could not find enough facts on your site to draft a reliable brief."],
    ["generation_failed", "Something went wrong while drafting. Please try again."],
    ["invalid_request", "Something went wrong while drafting. Please try again."],
  ])("explains %s in plain words", (code, message) => {
    expect(draftFailureMessage({ code, message: "internal detail" })).toBe(message);
  });

  it("shows the crawler's own explanation when the site could not be read", () => {
    expect(
      draftFailureMessage({ code: "crawl_failed", message: "The site could not be reached" }),
    ).toBe("We could not read your site: The site could not be reached");
  });

  it("shows other errors as they are", () => {
    expect(draftFailureMessage({ code: "product_not_found", message: "Gone" })).toBe("Gone");
  });
});

describe("keywordFailureMessage", () => {
  it.each([
    ["quota_exceeded", "Keyword research is paused: the keyword data account needs more credit."],
    ["unavailable", "Keyword research is unavailable right now. Try again in a minute."],
    ["invalid_request", "Keyword research could not run for these topics. Try different wording."],
  ])("explains %s without exposing the provider's details", (code, message) => {
    expect(keywordFailureMessage({ code, message: "DataForSEO internal detail" })).toBe(message);
  });

  it("shows other errors as they are", () => {
    expect(keywordFailureMessage({ code: "brief_not_approved", message: "Approve it" })).toBe(
      "Approve it",
    );
  });
});

describe("socialFailureMessage", () => {
  it("keeps provider details out of an outage message", () => {
    expect(
      socialFailureMessage({ code: "unavailable", message: "Zernio is unavailable (HTTP 503)" }),
    ).toBe("Social accounts are unavailable right now. Try again in a minute.");
  });

  it("explains a refusal and passes other errors through", () => {
    expect(socialFailureMessage({ code: "rejected", message: "x" })).toBe(
      "The social account service refused the request. Check the Zernio settings.",
    );
    expect(socialFailureMessage({ code: "product_not_found", message: "Missing" })).toBe("Missing");
  });
});

describe("publishFailureMessage", () => {
  it("tells the founder what to do", () => {
    expect(publishFailureMessage({ code: "unavailable", message: "HTTP 502" })).toBe(
      "The channel is unavailable right now. Try again in a minute.",
    );
    expect(
      publishFailureMessage({ code: "not_connected", message: "Link your X account first" }),
    ).toBe("Link your X account first");
  });
});

describe("analyticsFailureMessage", () => {
  it.each([
    ["invalid_grant", "The Google sign-in expired. Try connecting again."],
    ["denied", "Google access was not granted."],
    ["missing_scope", "Allow Nuvantre to see Search Console or Analytics data to connect Google."],
    ["oauth_state_mismatch", "The Google sign-in could not be checked. Try connecting again."],
    ["invalid_credentials", "The key was rejected. Check it and try again."],
    ["site_not_found", "No site with that domain was found for this key."],
    ["unreachable", "The analytics service could not be reached. Try again in a minute."],
    ["unavailable", "The analytics service could not be reached. Try again in a minute."],
    ["blocked", "That address cannot be used."],
  ])("explains %s", (code, message) => {
    expect(analyticsFailureMessage({ code, message: "internal detail" })).toBe(message);
  });

  it("keeps the use case's own message for anything else", () => {
    expect(
      analyticsFailureMessage({ code: "analytics_not_connected", message: "Connect first" }),
    ).toBe("Connect first");
  });
});
