#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { parseArgs, KIT_ROOT, VERSION } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const target = resolve(String(args.target || ""));
if (!args.target || !existsSync(target)) fail("必须提供已存在的 --target");

const errors = [];
const warnings = [];
const lockPath = join(target, "governance.lock.json");
if (!existsSync(lockPath)) fail("未找到governance.lock.json；项目尚未由v3安装器登记");
let lock;
try { lock = JSON.parse(readFileSync(lockPath, "utf8")); } catch (e) { fail(`lock无法解析: ${e.message}`); }

const lockVersion = String(lock.playbookVersion || "").trim();
if (!lockVersion) {
  errors.push("governance.lock.json 缺少 playbookVersion；无法确认与kit版本一致性。按 setup.md 的存量版本升级流程审查差异并取得验证证据后再更新 lock；普通 init 不会覆盖旧文件，禁止直接 --force");
} else if (lockVersion !== VERSION) {
  errors.push(`governance.lock.json playbookVersion 漂移: lock=${lockVersion}, kit=${VERSION}；按 setup.md 的存量版本升级流程审查差异并取得验证证据后再更新 lock；普通 init 不会覆盖旧文件，禁止直接 --force`);
}
const currentFingerprint = fingerprintKit();
if (!lock.kitFingerprint) {
  errors.push("governance.lock.json 缺少 kitFingerprint；无法区分同版本的不同或 dirty kit 内容。按 setup.md 的存量版本升级流程审查差异后重新安装或显式迁移。");
} else if (lock.kitFingerprint !== currentFingerprint) {
  errors.push(`governance.lock.json kitFingerprint 漂移: lock=${lock.kitFingerprint}, kit=${currentFingerprint}；当前 kit 内容与安装时不同，审查差异后显式迁移，不能只更新版本字符串。`);
}

const lint = spawnSync(process.execPath, [join(KIT_ROOT, "scripts/governance-lint.mjs"), "--root", target], { encoding: "utf8" });
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
const instructionBody = existsSync(join(target, instructionFile)) ? read(instructionFile) : "";
const bridgeBody = existsSync(join(target, bridgeFile)) ? read(bridgeFile) : "";
if (instructionBody && !instructionBody.includes("governance.lock.json")) {
  errors.push(`${instructionFile}仍未对齐v3执行宪法`);
}
if (bridgeBody && bridgeBody !== instructionBody && !bridgeBody.includes(instructionFile)) {
  errors.push(`${bridgeFile}既不是与${instructionFile}字节一致的双正本，也不是指向它的桥接入口`);
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
} else if (lock.runtime === "generic") {
  warnings.push("generic运行时没有自动hook载体；SessionStart/PreToolUse/Stop不会被运行时自动触发，治理脚本需要人工或pre-commit/CI等效机制主动触发，需如实登记该降级");
}

const todoFiles = [];
for (const p of lock.installedFiles || []) {
  if (!existsSync(join(target, p)) || !/\.(md|json|toml)$/.test(p)) continue;
  if (/TODO(?:\(|:|\b)|待负责人确认|待确认/.test(read(p))) todoFiles.push(p);
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

function fingerprintKit() {
  const hash = createHash("sha256");
  const excluded = new Set([".git", "node_modules", "governance.lock.json"]);
  const stack = [KIT_ROOT];
  const contents = [];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (excluded.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else contents.push(full);
    }
  }
  for (const file of contents.sort()) {
    hash.update(fullPathRelative(file));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function fullPathRelative(file) {
  return file.slice(KIT_ROOT.length + 1);
}
