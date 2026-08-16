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
const installedFiles = new Set(lock.installedFiles || []);
for (const p of installedFiles) required(p);
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

const codexPaths = [".codex/hooks.json", ".codex/config.toml", ".codex/rules/default.rules"];
const claudePath = ".claude/settings.json";
const codexListedComplete = codexPaths.every((p) => installedFiles.has(p));
const codexPresentComplete = codexPaths.every((p) => existsSync(join(target, p)));
const claudeExpected = installedFiles.has(claudePath);
const claudePresent = existsSync(join(target, claudePath));
const codexActive = lock.runtime === "codex" || codexListedComplete || codexPresentComplete;

// 新安装默认双接线；存量单runtime lock 仍按其已有文件集合兼容。
// 缺失的已登记文件由 required() 报错，存在的两套载体都必须通过各自的结构检查。
if (codexActive) {
  for (const p of codexPaths) if (!existsSync(join(target, p)) && !installedFiles.has(p)) errors.push(`缺少文件: ${p}`);
  if (existsSync(join(target, ".codex/hooks.json"))) {
    try {
      const hooks = JSON.parse(read(".codex/hooks.json"));
      const topLevelKeys = Object.keys(hooks || {});
      const invalidTopLevelKeys = topLevelKeys.filter((key) => !["description", "hooks"].includes(key));
      if (invalidTopLevelKeys.length) {
        errors.push(`.codex/hooks.json 顶层字段非法: ${invalidTopLevelKeys.join(", ")}；当前 Codex schema 仅接受 description/hooks`);
      }
      for (const event of ["SessionStart", "PreToolUse", "Stop"]) {
        if (!hooks.hooks?.[event]?.length) errors.push(`Codex缺少${event} Hook`);
      }
    } catch (e) { errors.push(`.codex/hooks.json无法解析: ${e.message}`); }
  }
  if (existsSync(join(target, ".codex/config.toml")) && !read(".codex/config.toml").includes("hooks = true")) {
    errors.push("Codex hooks功能未启用");
  }
  if (existsSync(join(target, ".codex/rules/default.rules")) && !read(".codex/rules/default.rules").includes("match =")) {
    errors.push("Codex rules缺少内联匹配测试");
  }
}

if (claudeExpected || claudePresent) {
  if (claudePresent) {
    try {
      const settings = JSON.parse(read(claudePath));
      for (const event of ["SessionStart", "PreToolUse", "Stop"]) {
        if (!settings.hooks?.[event]?.length) errors.push(`Claude Code缺少${event} Hook`);
      }
    } catch (e) { errors.push(`${claudePath}无法解析: ${e.message}`); }
  }
}

if (codexActive) {
  warnings.push("Codex项目Hook写入后必须在新会话用 /hooks 审核并信任当前哈希");
} else if (!codexActive && !claudeExpected && !claudePresent) {
  warnings.push("未检测到 Claude Code 或 Codex 的 hook 配置；如果实际使用的工具不是这两者，SessionStart/PreToolUse/Stop 不会自动触发");
}

const todoFiles = [];
const todoExemptFiles = new Set([
  "docs/requirements/README.md",
  "docs/requirements/specs/_TEMPLATE.md",
  "CHANGELOG.md",
]);
for (const p of installedFiles) {
  if (!existsSync(join(target, p)) || !/\.(md|json|toml)$/.test(p)) continue;
  if (todoExemptFiles.has(p)) continue;
  const body = read(p);
  const scannable = body.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
  if (/TODO(?:\(|:|\b)|待负责人确认|待确认/.test(scannable)) todoFiles.push(p);
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
