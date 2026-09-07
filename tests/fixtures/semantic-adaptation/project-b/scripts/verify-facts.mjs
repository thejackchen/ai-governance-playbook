#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const path = resolve(root, relativePath);
  if (!existsSync(path)) {
    errors.push(`missing ${relativePath}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function inRepository(relativePath) {
  const path = resolve(root, relativePath);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (path !== root && !path.startsWith(rootPrefix)) {
    errors.push(`index escapes repository: ${relativePath}`);
    return null;
  }
  return path;
}

function links(body) {
  return [...body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
}

function linkedPath(fromRelativePath, target) {
  if (!target || target.startsWith("#") || /^[a-z]+:/i.test(target)) return null;
  const path = inRepository(resolve(root, fromRelativePath, "..", target));
  return path ? relative(root, path) : null;
}

function frontMatter(body) {
  const match = body.match(/^---\n([\s\S]*?)\n---\n/);
  const fields = {};
  if (!match) return fields;
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return fields;
}

const rootIndex = read("INDEX.md");
const knowledgeTarget = links(rootIndex).map((target) => linkedPath("INDEX.md", target)).find(Boolean);
if (!knowledgeTarget || !knowledgeTarget.startsWith(`knowledge${sep}`)) {
  errors.push("root index does not lead to knowledge/INDEX.md");
}

const knowledgeIndex = knowledgeTarget ? read(knowledgeTarget) : "";
const specTargets = links(knowledgeIndex)
  .map((target) => linkedPath(knowledgeTarget || "knowledge/INDEX.md", target))
  .filter(Boolean);
if (specTargets.length !== 2) errors.push("knowledge index must retain both decision records");

const records = specTargets.map((target) => ({ path: target, fields: frontMatter(read(target)) }));
for (const { fields } of records) {
  if (fields.kind !== "decision-record") errors.push("decision record kind changed");
  if (!fields.owner) errors.push("decision record owner missing");
  if (fields.authority !== "project") errors.push("project authority changed");
  if (fields.subject !== "automatic-deployment") errors.push("decision subject changed");
  if (!fields.decision) errors.push("decision value missing");
}
for (const { path } of records) {
  if (!read(path).includes("PC-TIDE-09")) errors.push("project identifier changed");
}

const sentinel = read("src/workbench/wip-sentinel.txt");
if (sentinel !== "WIP: PC-TIDE-09 release rehearsal (unfinished).\n") {
  errors.push("unfinished project work changed");
}

let lock;
try {
  lock = JSON.parse(read("governance.lock.json"));
} catch (cause) {
  errors.push(`governance lock is not valid JSON: ${cause.message}`);
}
if (lock) {
  if (lock.playbookVersion !== "4.1.0") errors.push("candidate lock version moved");
  if (lock.adaptation?.sourceVersion !== "4.1.0") errors.push("candidate source version moved");
  if (lock.adaptation?.source?.status !== "candidate") errors.push("candidate status changed");
  if (lock.adaptation?.source?.verification !== "unverified") errors.push("candidate verification boundary changed");
  if (lock.adaptation?.source?.published !== false) errors.push("candidate marked published");
  if (lock.adaptation?.projectFacts !== "preserved") errors.push("project facts are not marked preserved");
}

if (errors.length) {
  for (const error of errors) console.error(`[project-b] ${error}`);
  process.exit(1);
}
console.log("[project-b] project facts and unfinished work verified; decision records retained");
