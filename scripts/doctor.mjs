#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const target = resolve(String(args.target || ""));
if (!args.target || !existsSync(target)) fail("必须提供已存在的 --target");

const errors = [];
const warnings = [];
const lockPath = join(target, "governance.lock.json");
if (!existsSync(lockPath)) fail("未找到governance.lock.json；项目尚未由v3安装器登记");
let lock;
try { lock = JSON.parse(readFileSync(lockPath, "utf8")); } catch (e) { fail(`lock无法解析: ${e.message}`); }

const lint = spawnSync(process.execPath, [join(target, "scripts/governance-lint.mjs"), "--root", target], { encoding: "utf8" });
process.stdout.write(lint.stdout || "");
process.stderr.write(lint.stderr || "");
if (lint.status !== 0) errors.push("governance-lint未通过");

const read = (p) => readFileSync(join(target, p), "utf8");
const required = (p) => {
  if (!existsSync(join(target, p))) errors.push(`缺少文件: ${p}`);
};
for (const p of lock.installedFiles || []) required(p);
const instructionFile = lock.runtime === "claude-code" ? "CLAUDE.md" : "AGENTS.md";
const bridgeFile = lock.runtime === "claude-code" ? "AGENTS.md" : "CLAUDE.md";
if (existsSync(join(target, instructionFile)) && !read(instructionFile).includes("governance.lock.json")) {
  errors.push(`${instructionFile}仍未对齐v3执行宪法`);
}
if (existsSync(join(target, bridgeFile)) && !read(bridgeFile).includes(instructionFile)) {
  errors.push(`${bridgeFile}不是指向${instructionFile}的桥接入口`);
}

if (lock.runtime === "codex") {
  try {
    const hooks = JSON.parse(read(".codex/hooks.json"));
    for (const event of ["SessionStart", "PreToolUse", "Stop"]) {
      if (!hooks.hooks?.[event]?.length) errors.push(`Codex缺少${event} Hook`);
    }
  } catch (e) { errors.push(`.codex/hooks.json无法解析: ${e.message}`); }
  if (!read(".codex/config.toml").includes("hooks = true")) errors.push("Codex hooks功能未启用");
  if (!read(".codex/rules/default.rules").includes("match =")) errors.push("Codex rules缺少内联匹配测试");
  warnings.push("Codex项目Hook写入后必须在新会话用 /hooks 审核并信任当前哈希");
} else if (lock.runtime === "claude-code") {
  try {
    const settings = JSON.parse(read(".claude/settings.json"));
    for (const event of ["SessionStart", "PreToolUse", "Stop"]) {
      if (!settings.hooks?.[event]?.length) errors.push(`Claude Code缺少${event} Hook`);
    }
  } catch (e) { errors.push(`.claude/settings.json无法解析: ${e.message}`); }
}

const todoFiles = [];
for (const p of lock.installedFiles || []) {
  if (!existsSync(join(target, p)) || !/\.(md|json|toml)$/.test(p)) continue;
  if (/TODO(?:\(|:|\b)/.test(read(p))) todoFiles.push(p);
}
if (todoFiles.length) warnings.push(`仍有待项目化内容: ${todoFiles.join(", ")}`);

if (lock.profile !== "lite") {
  let hookPath = "";
  try { hookPath = execFileSync("git", ["config", "--get", "core.hooksPath"], { cwd: target, encoding: "utf8" }).trim(); } catch {}
  if (hookPath !== ".githooks") warnings.push("pre-commit尚未启用；运行 git config core.hooksPath .githooks");
  let remote = "";
  try { remote = execFileSync("git", ["remote"], { cwd: target, encoding: "utf8" }).trim(); } catch {}
  if (!remote) warnings.push("项目没有Git远端；CI和branch protection尚不能形成共享门禁");
}
if (lock.profile === "high-assurance" && read(".github/CODEOWNERS").includes("TODO(owner)")) {
  errors.push("High Assurance的CODEOWNERS仍是占位owner");
}

for (const item of warnings) console.warn(`[doctor] WARN ${item}`);
for (const item of errors) console.error(`[doctor] ERROR ${item}`);
console.log(`[doctor] ${errors.length} error / ${warnings.length} warn`);
process.exit(errors.length ? 1 : 0);

function fail(message) { console.error(`[doctor] ${message}`); process.exit(1); }
