#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { basename, join, relative, resolve } from "node:path";
import { KIT_ROOT, VERSION, copyRendered, detectRuntime, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const target = resolve(String(args.target || ""));
if (!args.target || !existsSync(target)) fail("必须提供已存在的 --target /path/to/project");

const runtime = args.runtime === "auto" || !args.runtime ? detectRuntime(target) : String(args.runtime);
if (!new Set(["codex", "claude-code", "generic"]).has(runtime)) fail(`不支持runtime: ${runtime}`);
const profile = String(args.profile || "lite");
if (!new Set(["lite", "standard", "high-assurance"]).has(profile)) fail(`不支持profile: ${profile}`);
const profileInfo = JSON.parse(readFileSync(join(KIT_ROOT, "profiles", `${profile}.json`), "utf8"));
const adapter = JSON.parse(readFileSync(join(KIT_ROOT, "adapters", runtime, "adapter.json"), "utf8"));
const policyPath = join(target, "governance/policy.json");
const existingLockPath = join(target, "governance.lock.json");
const policyExistedBeforeInit = existsSync(policyPath);
let existingRequirements = null;
if (policyExistedBeforeInit) {
  try { existingRequirements = JSON.parse(readFileSync(policyPath, "utf8")).requirements || null; } catch {}
}
const requirementsModeExplicit = Object.hasOwn(args, "requirements-mode");
const requirementsMode = requirementsModeExplicit
  ? String(args["requirements-mode"])
  : existingRequirements?.mode === "external" ? "external" : "local";
const requirementsSource = requirementsMode === "external"
  ? String(requirementsModeExplicit ? args["requirements-source"] || "" : existingRequirements?.source || "")
  : "docs/requirements/backlog.md";
if (!new Set(["local", "external"]).has(requirementsMode)) fail(`不支持requirements-mode: ${requirementsMode}`);
if (requirementsMode === "external" && requirementsModeExplicit && !requirementsSource) fail("--requirements-source 在 external 模式下为必填");
if (requirementsMode === "external" && requirementsSource && !/^https?:\/\//i.test(requirementsSource)) {
  fail("--requirements-source 仅支持 https:// 或 http:// 形式的外部链接");
}
if (existsSync(existingLockPath) && !policyExistedBeforeInit && !args.force) {
  fail("已安装项目缺少 governance/policy.json；普通 init 不会补写或重置已有安装。先按迁移流程恢复 policy，再运行 doctor。");
}
if (
  requirementsModeExplicit
  && existsSync(existingLockPath)
  && existingRequirements?.mode
  && existingRequirements.mode !== requirementsMode
) {
  fail(`已安装 ${existingRequirements.mode} 项目不能由 init 直接切换到 ${requirementsMode}：先显式迁移需求内容、policy 与三处指针并通过 lint。--force 只覆盖文件，不是安全迁移手段。`);
}
const extensions = String(args.with || "").split(",").map((x) => x.trim()).filter(Boolean);
for (const ext of extensions) if (!existsSync(join(KIT_ROOT, "extensions", ext))) fail(`未知extension: ${ext}`);

// 日期用本地时区——toISOString 按 UTC 输出，非零时区在跨日窗口会给出错误日期（v2.3.0 已在心跳脚本修过，此处 3.1.2 补齐）
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const projectName = String(args["project-name"] || basename(target));
const values = {
  PROJECT_NAME: projectName,
  RUNTIME: runtime,
  PROFILE: profile,
  TODAY: today,
  PLAYBOOK_VERSION: VERSION,
  RULE_BUDGET: String(profileInfo.ruleBudget),
  INTENT: "TODO(owner): 用一段话确认项目目的、当前阶段和取舍倾向。",
  ARCHITECTURE_SOURCE: "docs/architecture.md",
  REQUIREMENTS_SOURCE: requirementsSource,
  REQUIREMENTS_LINK: requirementsMode === "external"
    ? requirementsSource
    : "../docs/requirements/backlog.md",
  FRONTEND_DESIGN_SYSTEM_ROUTE: extensions.includes("frontend-design-system")
    ? "- 若安装了 `frontend-design-system` 扩展：前端视觉与交互正文属于产品架构，请按 `docs/index.md` 路由读取 `docs/design/design-system.md`、`docs/design/reference-pack.md`、`design/tokens.json`、`docs/architecture/frontend-surfaces.md`、`governance/frontend-policy.json` 与 `scripts/frontend-governance-verify.mjs`；治理只负责唯一正本、变更门、启动触达和机器验证，不在此处复制设计正文。"
    : "",
  PROJECT_RED_LINES: "- TODO(owner): 添加项目特定红线；没有就删除本行。",
  VERIFY_COMMAND: "node scripts/governance-verify.mjs --fast",
  CURRENT_CURSOR: "TODO: 写明当前主攻战线、做到哪一步、下一步是什么。",
  CONSTRAINT: "TODO: 项目最重要的架构或合同约束",
  CONSTRAINT_SOURCE: "TODO: ADR或权威文档",
  CONSTRAINT_GUARD: "暂无（靠review）",
  WORKSTREAM: "治理与架构基线",
  MILESTONE: "治理已初始化，待填项目事实",
  NEXT_STEP: "填写TODO并运行doctor",
  SOURCE_DIR: "src",
  SOURCE_OWNER: "业务代码",
  SOURCE_ALLOWED: "项目源码",
  SOURCE_FORBIDDEN: "生成缓存和临时导出",
  SOURCE_CHECK: "项目测试/静态检查",
  GITHUB_OWNER: "TODO(owner)",
  DESIGN_INTENT: "TODO(owner): 描述产品受众、气质和设计取舍。",
  COMPONENT_SOURCE: "TODO: 组件库路径",
  ASSET_SOURCE: "TODO: 资产路径",
  SURFACE: "Web",
  STACK: "TODO",
  TOKEN_OUTPUT: "TODO",
  COMPONENT_PATH: "TODO",
  NATIVE_BOUNDARY: "TODO",
  SURFACE_CHECK: "TODO",
  COLOR_BACKGROUND: "#ffffff",
  COLOR_SURFACE: "#f6f7f9",
  COLOR_TEXT: "#17191c",
  COLOR_PRIMARY: "#1769e0",
  COLOR_DANGER: "#c83349"
};

const writes = [];
const common = join(KIT_ROOT, "templates", "common");
const map = [
  [".gitignore", ".gitignore"], // 「真实凭据不进git」红线的day-1结构前提；已有则跳过，由安装AI合并
  ["ROADMAP.md", "ROADMAP.md"],
  ["CHANGELOG.md", "CHANGELOG.md"],
  ["docs/index.md", "docs/index.md"],
  [".grok/hooks/governance.json", ".grok/hooks/governance.json"],
  ["docs/ops/extra-repo-facts.json", "docs/ops/extra-repo-facts.json"],
  ["docs/ops/extra-repo-facts.md", "docs/ops/extra-repo-facts.md"],
  ["docs/architecture/repository-layout.md", "docs/architecture/repository-layout.md"],
  ["docs/decisions/ADR-000.md", "docs/decisions/ADR-000.md"],
  // 架构/需求指针在INSTRUCTIONS.md与docs/index.md中是markdown链接（进死链检测射程），
  // 必须有真实存在的默认落点，否则刚init完的项目会立刻报死链错误
  ["docs/architecture.md", "docs/architecture.md"],
  ["governance/policy.json", "governance/policy.json"],
  ["governance/incidents.md", "governance/incidents.md"],
  ["governance/questions.md", "governance/questions.md"],
  ["scripts/lib/extra-repo-facts.mjs", "scripts/lib/extra-repo-facts.mjs"],
  ["scripts/governance-lint.mjs", "scripts/governance-lint.mjs"],
  ["scripts/requirements-check.mjs", "scripts/requirements-check.mjs"],
  ["scripts/governance-status.mjs", "scripts/governance-status.mjs"],
  ["scripts/governance-verify.mjs", "scripts/governance-verify.mjs"],
  ["scripts/governance-hooks/session-start.mjs", "scripts/governance-hooks/session-start.mjs"],
  ["scripts/governance-hooks/session-start-codex.mjs", "scripts/governance-hooks/session-start-codex.mjs"],
  ["scripts/governance-hooks/pre-tool-use.mjs", "scripts/governance-hooks/pre-tool-use.mjs"],
  ["scripts/governance-hooks/stop.mjs", "scripts/governance-hooks/stop.mjs"],
  ["scripts/governance-hooks/pre-compact.mjs", "scripts/governance-hooks/pre-compact.mjs"],
  ["scripts/governance-hooks/pre-compact-codex.mjs", "scripts/governance-hooks/pre-compact-codex.mjs"]
];
if (profile !== "lite") {
  map.push(["scripts/claim.mjs", "scripts/claim.mjs"]);
  map.push(["governance/claim-gate.md", "governance/claim-gate.md"]);
  map.push(["governance/registry.md", "governance/registry.md"]);
  map.push(["governance/cases/README.md", "governance/cases/README.md"]);
}
if (profile === "high-assurance") map.push(["governance/high-assurance.md", "governance/high-assurance.md"]);
if (requirementsMode === "local") {
  map.push(["docs/requirements/README.md", "docs/requirements/README.md"]);
  map.push(["docs/requirements/backlog.md", "docs/requirements/backlog.md"]);
  map.push(["docs/requirements/specs/_TEMPLATE.md", "docs/requirements/specs/_TEMPLATE.md"]);
}

for (const [source, dest] of map) writes.push({ source: join(common, source), dest: join(target, dest) });
writes.push({ source: join(common, "INSTRUCTIONS.md"), dest: join(target, adapter.instructionFile) });

// Hook载体默认双接线：新项目同时安装Claude Code与Codex配置。
// runtime仍只决定原生指令/桥接入口和Codex专属CI，不决定是否安装另一套静态hook配置。
for (const hookRuntime of ["claude-code", "codex"]) {
  const hookAdapter = JSON.parse(readFileSync(join(KIT_ROOT, "adapters", hookRuntime, "adapter.json"), "utf8"));
  const adapterRoot = join(KIT_ROOT, hookAdapter.filesRoot);
  for (const source of files(adapterRoot)) writes.push({ source, dest: join(target, relative(adapterRoot, source)) });
}
if (profile !== "lite") {
  const standard = join(KIT_ROOT, "templates", "standard");
  for (const source of files(standard)) writes.push({ source, dest: join(target, relative(standard, source)) });
  // Codex专属CI夹带（.github/codex/** + 含ai-review job的workflow变体）只在runtime=codex时叠加；
  // 覆盖同名workflow路径（数组靠后者在下面的Map去重中胜出），其它runtime保持零codex/openai引用的base版本。
  if (runtime === "codex") {
    const standardCodex = join(KIT_ROOT, "templates", "standard-codex");
    for (const source of files(standardCodex)) writes.push({ source, dest: join(target, relative(standardCodex, source)) });
  }
}
if (profile === "high-assurance") {
  const high = join(KIT_ROOT, "templates", "high-assurance");
  for (const source of files(high)) writes.push({ source, dest: join(target, relative(high, source)) });
}
for (const ext of extensions) {
  const extRoot = join(KIT_ROOT, "extensions", ext, "templates");
  for (const source of files(extRoot)) writes.push({ source, dest: join(target, relative(extRoot, source)) });
}

const finalWrites = [...new Map(writes.map((item) => [relative(target, item.dest), item])).values()];

const bridgePath = join(target, adapter.bridgeFile);

const installedFiles = [...new Set(finalWrites.map((x) => relative(target, x.dest)).concat([adapter.bridgeFile, "governance.lock.json"]))].sort();
const kitFingerprint = fingerprintKit();

console.log(`治理安装计划: target=${target} runtime=${runtime} profile=${profile}`);
for (const item of finalWrites) console.log(`${existsSync(item.dest) && !args.force ? "SKIP" : "WRITE"} ${relative(target, item.dest)}`);
console.log(`${existsSync(bridgePath) && !args.force ? "SKIP" : "WRITE"} ${adapter.bridgeFile}`);
console.log(`${existsSync(join(target, "governance.lock.json")) && !args.force ? "SKIP" : "WRITE"} governance.lock.json`);
if (!args.write) {
  console.log("dry-run完成；加入 --write 才写文件。");
  process.exit(0);
}

for (const item of finalWrites) copyRendered(item.source, item.dest, values, { force: !!args.force });
if (!existsSync(join(target, "docs/index.md"))) {
  copyRendered(join(common, "docs/index.md"), join(target, "docs/index.md"), values, { force: true });
}
if (!existsSync(bridgePath) || args.force) {
  mkdirSync(join(target), { recursive: true });
  const instructionPath = join(target, adapter.instructionFile);
  if (!existsSync(instructionPath)) fail(`运行时正本安装失败: ${adapter.instructionFile}`);
  // 新安装的两个运行时入口是同一份完整正文；旧安装的手写桥接由 lint 兼容保留，
  // 普通 init 不会覆盖它们，避免把存量项目事实改掉。
  writeFileSync(bridgePath, readFileSync(instructionPath, "utf8"));
}
if (!existsSync(policyPath)) fail("governance/policy.json 安装失败");
if (!policyExistedBeforeInit || args.force) {
  try {
    const policy = JSON.parse(readFileSync(policyPath, "utf8"));
    policy.requirements = { mode: requirementsMode, source: requirementsSource, validator: [] };
    writeFileSync(policyPath, JSON.stringify(policy, null, 2) + "\n");
  } catch (error) {
    fail(`governance/policy.json 写入失败: ${error.message}`);
  }
}
const lockPath = join(target, "governance.lock.json");
if (!existsSync(lockPath) || args.force) {
  writeFileSync(lockPath, JSON.stringify({
    schemaVersion: 1,
    playbookVersion: VERSION,
    kitFingerprint,
    runtime,
    profile,
    ruleBudget: profileInfo.ruleBudget,
    extensions,
    installedAt: today,
    installedFiles
  }, null, 2) + "\n");
}
for (const p of installedFiles) {
  if (/^(scripts\/.*\.mjs|\.githooks\/pre-commit)$/.test(p) && existsSync(join(target, p))) chmodSync(join(target, p), 0o755);
}
// 激活 .githooks 为 git 钩子目录：否则 pre-commit 只是躺着的文件、不在提交路径上（宣称>实现）。
// lite 无钩子不设。已设成别的 hooksPath 时不覆盖（尊重项目自有约定，doctor 会提示）。
if (profile !== "lite" && installedFiles.includes(".githooks/pre-commit")) {
  let existing = "";
  try { existing = execFileSync("git", ["-C", target, "config", "--get", "core.hooksPath"], { encoding: "utf8" }).trim(); } catch {}
  if (existing && existing !== ".githooks") {
    console.log(`⚠ core.hooksPath 已是「${existing}」，未覆盖；如需启用治理 pre-commit 请手动改为 .githooks`);
  } else {
    try {
      execFileSync("git", ["-C", target, "config", "core.hooksPath", ".githooks"]);
      console.log("已激活 core.hooksPath=.githooks（pre-commit 门在本地提交路径上生效）。");
    } catch {
      console.log("⚠ 未能自动激活 core.hooksPath，请手动执行：git config core.hooksPath .githooks");
    }
  }
}
console.log("治理骨架已写入。下一步填写TODO(owner)/TODO并运行 node scripts/doctor.mjs --target <project>（从playbook仓库执行doctor）。");

function files(root) {
  const out = [];
  if (!existsSync(root)) return out;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full); else out.push(full);
    }
  }
  return out;
}
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
    hash.update(relative(KIT_ROOT, file));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}
function fail(message) { console.error(message); process.exit(1); }
