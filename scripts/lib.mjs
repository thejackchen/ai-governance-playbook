import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export const KIT_ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
export const VERSION = JSON.parse(readFileSync(join(KIT_ROOT, "package.json"), "utf8")).version;

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith("--")) { out._.push(item); continue; }
    const key = item.slice(2);
    if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) out[key] = argv[++i];
    else out[key] = true;
  }
  return out;
}

export function walkFiles(root) {
  const out = [];
  if (!existsSync(root)) return out;
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

export function render(text, values) {
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => values[key] ?? `TODO(${key})`);
}

export function copyRendered(source, target, values, { force = false } = {}) {
  if (existsSync(target) && !force) return { action: "skip", target };
  mkdirSync(dirname(target), { recursive: true });
  const body = render(readFileSync(source, "utf8"), values);
  writeFileSync(target, body);
  return { action: "write", target };
}

export function copyTree(sourceRoot, targetRoot, values, options = {}) {
  const results = [];
  for (const source of walkFiles(sourceRoot)) {
    const target = join(targetRoot, relative(sourceRoot, source));
    results.push(copyRendered(source, target, values, options));
  }
  return results;
}

export function detectRuntime(target) {
  if (existsSync(join(target, ".codex"))) return "codex";
  if (existsSync(join(target, ".claude")) || existsSync(join(target, "CLAUDE.md"))) return "claude-code";
  if (process.env.CODEX_HOME) return "codex";
  return "generic";
}
