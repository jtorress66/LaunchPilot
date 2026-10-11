import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Enforces the CLAUDE.md dependency rule: domain ← ports ← application ← agents / adapters ← apps.
 * Inner packages never depend on outer ones; only apps' composition roots wire adapters.
 */
const root = join(import.meta.dirname, "..");

const allowedInternalDeps: Record<string, readonly string[]> = {
  domain: [],
  ports: ["domain"],
  application: ["domain", "ports", "testing"],
  agents: ["domain", "ports"],
  testing: ["domain", "ports"],
  adapters: ["domain", "ports", "testing"],
  web: ["domain", "ports", "application", "adapters", "testing"],
  worker: ["domain", "ports", "application", "adapters", "testing"],
};

const packageDirs = ["packages", "apps"].flatMap((group) =>
  readdirSync(join(root, group)).map((name) => ({ name, dir: join(root, group, name) })),
);

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const internalDepsOf = (dir: string): string[] => {
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;
  return Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })
    .filter((dep) => dep.startsWith("@launchpilot/"))
    .map((dep) => dep.replace("@launchpilot/", ""));
};

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });

const importsOf = (file: string): string[] =>
  [...readFileSync(file, "utf8").matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map(
    (match) => match[1] ?? "",
  );

describe("architecture", () => {
  it("knows the layer of every workspace package", () => {
    expect(packageDirs.map((p) => p.name).sort()).toEqual(Object.keys(allowedInternalDeps).sort());
  });

  it.each(packageDirs)("$name depends only on inner layers", ({ name, dir }) => {
    expect(internalDepsOf(dir).filter((dep) => !allowedInternalDeps[name]?.includes(dep))).toEqual(
      [],
    );
  });

  it.each(["domain", "ports", "application", "agents"])(
    "%s production code imports no adapters, SDKs, frameworks or I/O modules",
    (name) => {
      const forbidden =
        /^(@launchpilot\/(application|adapters|testing|web|worker)|next|react|react-dom|pg|kysely|stripe|node:|fs$|http$|https$|@anthropic-ai\/)/;
      const violations = sourceFiles(join(root, "packages", name, "src"))
        .filter((file) => !file.endsWith(".test.ts"))
        .flatMap((file) =>
          importsOf(file)
            .filter((spec) => forbidden.test(spec))
            .map((spec) => `${relative(root, file)} → ${spec}`),
        );
      expect(violations).toEqual([]);
    },
  );

  it.each(["web", "worker"])("%s instantiates adapters only in its composition root", (name) => {
    const violations = sourceFiles(join(root, "apps", name, "src"))
      .filter((file) => !file.endsWith("container.ts") && !file.endsWith(".test.ts"))
      .filter((file) => importsOf(file).includes("@launchpilot/adapters"))
      .map((file) => relative(root, file));
    expect(violations).toEqual([]);
  });
});
