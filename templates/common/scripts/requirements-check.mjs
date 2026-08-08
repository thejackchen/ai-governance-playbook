#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const BACKLOG_PATH = "docs/requirements/backlog.md";
const PENDING_EVIDENCE = "pending";
const REQUIREMENT_ID = "REQ-(?:[0-9]{4}|[A-Z][A-Z0-9]*)-[0-9]{3}";

function splitSection(body, title) {
  const heading = new RegExp(`^##\\s*${title}\\s*$`, "m").exec(body);
  if (!heading || heading.index === undefined) return "";
  const afterHeading = heading.index + heading[0].length;
  const followingHeading = /^##\s+/m;
  followingHeading.lastIndex = afterHeading;
  const end = followingHeading.exec(body.slice(afterHeading));
  return body.slice(heading.index, end ? afterHeading + end.index : body.length);
}

function parseCodeFenceAwareEntries(section) {
  const lines = section.split(/\r?\n/);
  const entries = [];
  let inFence = false;
  let current = null;
  const flush = () => { if (current) entries.push(current); current = null; };
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const entry = new RegExp(`^\\s*-\\s*\\[([ xX])\\]\\s*(${REQUIREMENT_ID})\\s*\\|\\s*(.*?)$`).exec(line);
    if (entry) { flush(); current = { done: entry[1].toLowerCase() === "x", id: entry[2], fields: {} }; continue; }
    if (!current || trimmed === "") continue;
    const field = /^\s+-\s*([a-zA-Z_]+)\s*:\s*(.*)$/.exec(line);
    if (field) { current.fields[field[1].toLowerCase()] = field[2].trim(); continue; }
    if (!trimmed.startsWith("- [")) flush();
  }
  flush();
  return entries;
}

function isInsideRepo(root, target) {
  const repoRoot = resolve(root);
  const targetPath = resolve(target);
  return targetPath !== repoRoot && targetPath.startsWith(`${repoRoot}${sep}`);
}

function validateSpecRefs(entry, root, backlogPath) {
  const errors = [];
  const refs = entry.fields.spec_refs.split(",").map((item) => item.trim()).filter(Boolean);
  if (!refs.length) return [`[需求系统] ${entry.id} 的 spec_refs 不能为空`];
  for (const ref of refs) {
    const specPath = resolve(dirname(backlogPath), ref);
    if (!isInsideRepo(root, specPath)) { errors.push(`[需求系统] ${entry.id} 的 spec_refs 必须位于项目内并相对 backlog 解析: ${ref}`); continue; }
    if (!existsSync(specPath)) { errors.push(`[需求系统] ${entry.id} 的 spec 文件不存在: ${ref}`); continue; }
    const spec = readFileSync(specPath, "utf8").trim();
    if (!spec || /TODO(?:\(|\[|:|\b)|<[^>]+>/.test(spec)) errors.push(`[需求系统] ${entry.id} 的 spec 文件为空或仍含占位内容: ${ref}`);
  }
  return errors;
}

function validateEntry(entry, root, backlogPath) {
  const errors = [];
  const requiredFields = ["source_refs", "spec_refs", "acceptance", "evidence"];
  const missing = requiredFields.filter((key) => !entry.fields[key]);
  if (missing.length) errors.push(`[需求系统] ${entry.id} ${entry.done ? "已交付项" : "未完成项"}必须补齐字段: ${missing.join(", ")}`);
  if (entry.fields.evidence?.toLowerCase() === PENDING_EVIDENCE && entry.done) errors.push(`[需求系统] ${entry.id} 已交付项不允许 evidence 为 pending`);
  if (entry.fields.spec_refs) errors.push(...validateSpecRefs(entry, root, backlogPath));
  return errors;
}

export function checkRequirements(root = DEFAULT_ROOT) {
  const backlogPath = resolve(root, BACKLOG_PATH);
  if (!existsSync(backlogPath)) return { errors: [`[需求系统] 缺少 ${BACKLOG_PATH}`] };
  const errors = [];
  const body = readFileSync(backlogPath, "utf8");
  if (!/^#\s*需求\s*Backlog/.test(body)) errors.push("[需求系统] backlog 缺少标准标题: # 需求 Backlog");
  if (!/^##\s*进行中需求\s*$/m.test(body)) errors.push("[需求系统] backlog 缺少 ## 进行中需求 节点");
  const inProgress = splitSection(body, "进行中需求");
  const completed = splitSection(body, "已完成需求");
  if (/TODO\(|TODO\[|TODO:/.test(inProgress)) errors.push("[需求系统] backlog 中包含 TODO 占位内容，不能直接通过");
  const entries = parseCodeFenceAwareEntries(inProgress);
  const hasExplicitEmpty = /^\s*>\s*当前无已受理需求。\s*$/m.test(inProgress);
  if (!entries.length && !hasExplicitEmpty) errors.push("[需求系统] backlog 进行中需求为空时必须写明: > 当前无已受理需求。");
  if (entries.length && hasExplicitEmpty) errors.push("[需求系统] backlog 不能同时声明空状态和进行中需求");
  for (const entry of entries) errors.push(...validateEntry(entry, root, backlogPath));
  for (const entry of parseCodeFenceAwareEntries(completed)) errors.push(...validateEntry(entry, root, backlogPath));
  return { errors };
}

function main() {
  const rootIndex = process.argv.indexOf("--root");
  const root = rootIndex >= 0 && process.argv[rootIndex + 1] ? resolve(process.argv[rootIndex + 1]) : DEFAULT_ROOT;
  const { errors } = checkRequirements(root);
  for (const message of errors) console.error(`✖ ${message}`);
  if (errors.length === 0) console.log("[requirements-check] PASS"); else console.error("[requirements-check] FAIL");
  console.log(`[requirements-check] SUMMARY errors=${errors.length}`);
  if (errors.length > 0) process.exitCode = 1;
}

const entry = process.argv[1] ? resolve(process.argv[1]) : "";
if (entry === fileURLToPath(import.meta.url)) main();
