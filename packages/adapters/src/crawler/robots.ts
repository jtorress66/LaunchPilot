interface Rule {
  readonly allow: boolean;
  readonly pattern: string;
}

interface Group {
  readonly agents: string[];
  readonly rules: Rule[];
}

const groupsOf = (robots: string): Group[] => {
  const groups: Group[] = [];
  let current: Group | undefined;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === "allow" || key === "disallow") && value !== "") {
        current.rules.push({ allow: key === "allow", pattern: value });
      }
    }
  }
  return groups;
};

const toRegExp = (pattern: string): RegExp => {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
};

/**
 * Parses robots.txt (RFC 9309) for one crawler. The group naming the bot wins over `*`;
 * within a group the longest matching rule decides, and Allow wins a tie.
 */
export const parseRobots = (robots: string, userAgent: string): ((path: string) => boolean) => {
  const groups = groupsOf(robots);
  const token = userAgent.toLowerCase();
  const rules =
    groups.find((g) => g.agents.includes(token))?.rules ??
    groups.find((g) => g.agents.includes("*"))?.rules ??
    [];
  const compiled = rules.map((rule) => ({ ...rule, regexp: toRegExp(rule.pattern) }));

  return (path) => {
    let best: { allow: boolean; length: number } | undefined;
    for (const rule of compiled) {
      if (!rule.regexp.test(path)) continue;
      const length = rule.pattern.length;
      if (!best || length > best.length || (length === best.length && rule.allow)) {
        best = { allow: rule.allow, length };
      }
    }
    return best?.allow ?? true;
  };
};
