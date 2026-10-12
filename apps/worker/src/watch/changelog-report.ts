/** A Zernio changelog entry that affects LaunchPilot's integration, with the reasons. */
export interface FlaggedChange {
  readonly id: string;
  readonly type: string;
  readonly impact: string | null;
  readonly url: string;
  readonly publishedAt: string;
  /** Zernio's announcement, in Markdown. Untrusted text: quoted, never acted on. */
  readonly message: string;
  readonly reasons: readonly string[];
}

export interface ChangelogIssue {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

const MAX_TITLE = 140;

/** The announcement's first line as plain text: no Markdown emphasis, code ticks or headings. */
const headline = (message: string) =>
  (message.split("\n").find((line) => line.trim() !== "") ?? "")
    .replace(/^#+\s*/, "")
    .replace(/[*_`]/g, "")
    .trim();

/** Stops quoted text from mentioning people or teams on GitHub. */
const noMentions = (text: string) => text.replace(/@(?=[\w-])/g, "@​");

/** The GitHub issue that tells the team about one affecting change. */
export const toIssue = (change: FlaggedChange): ChangelogIssue => {
  const suffix = ` [${change.id}]`;
  const prefix = "Zernio API change: ";
  const room = MAX_TITLE - prefix.length - suffix.length;
  const text = headline(change.message);
  const short = text.length > room ? `${text.slice(0, room - 1)}…` : text;
  const quoted = noMentions(change.message)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return {
    id: change.id,
    title: `${prefix}${short}${suffix}`,
    body: [
      "Zernio published an API change that affects LaunchPilot's social publishing.",
      "",
      "**Why it matters**",
      change.reasons.map((reason) => `- ${reason}`).join("\n"),
      "",
      `${change.type} · impact: ${change.impact ?? "unknown"} · published ${change.publishedAt.slice(0, 10)} · ${change.url}`,
      "",
      "**Zernio's announcement**",
      quoted,
      "",
      "Check the adapter in `packages/adapters/src/zernio` and its recorded responses in `packages/adapters/test/zernio/recorded`.",
      "",
      "_Opened by the daily Zernio changelog check (`.github/workflows/zernio-changelog.yml`)._",
    ].join("\n"),
  };
};
