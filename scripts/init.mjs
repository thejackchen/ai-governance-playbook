#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { KIT_ROOT, VERSION, copyRendered, detectRuntime, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const target = resolve(String(args.target || ""));
if (!args.target || !existsSync(target)) fail("必须提供已存在的 --target /path/to/project");

const runtime = args.runtime === "auto" || !args.runtime ? detectRuntime(target) : String(args.runtime);
if (!new Set(["codex", "claude-code", "generic"]).has(runtime)) fail(`不支持runtime: ${runtime}`);
if (runtime === "generic") {
  console.log("[警告] generic运行时没有自动hook载体：SessionStart/PreToolUse/Stop不会被运行时自动触发，governance-verify/governance-lint等治理脚本需要人工或pre-commit/CI等效机制主动触发，否则治理不会真实生效。");
}
const profile = String(args.profile || "lite");
if (!new Set(["lite", "standard", "high-assurance"]).has(profile)) fail(`不支持profile: ${profile}`);
const profileInfo = JSON.parse(readFileSync(join(KIT_ROOT, "profiles", `${profile}.json`), "utf8"));
const adapter = JSON.parse(readFileSync(join(KIT_ROOT, "adapters", runtime, "adapter.json"), "utf8"));
const extensions = String(args.with || "").split(",").map((x) => x.trim()).filter(Boolean);
for (const ext of extensions) if (!existsSync(join(KIT_ROOT, "extensions", ext))) fail(`未知extension: ${ext}`);

const today = new Date().toISOString().slice(0, 10);
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
  REQUIREMENTS_SOURCE: "docs/requirements/backlog.md",
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
  ["docs/architecture/repository-layout.md", "docs/architecture/repository-layout.md"],
  ["docs/decisions/ADR-000.md", "docs/decisions/ADR-000.md"],
  // 架构/需求指针在INSTRUCTIONS.md与docs/index.md中是markdown链接（进死链检测射程），
  // 必须有真实存在的默认落点，否则刚init完的项目会立刻报死链错误
  ["docs/architecture.md", "docs/architecture.md"],
  ["docs/requirements/backlog.md", "docs/requirements/backlog.md"],
  ["governance/policy.json", "governance/policy.json"],
  ["governance/incidents.md", "governance/incidents.md"],
  ["governance/questions.md", "governance/questions.md"],
  ["scripts/governance-lint.mjs", "scripts/governance-lint.mjs"],
  ["scripts/governance-status.mjs", "scripts/governance-status.mjs"],
  ["scripts/governance-verify.mjs", "scripts/governance-verify.mjs"],
  ["scripts/governance-hooks/session-start.mjs", "scripts/governance-hooks/session-start.mjs"],
  ["scripts/governance-hooks/pre-tool-use.mjs", "scripts/governance-hooks/pre-tool-use.mjs"],
  ["scripts/governance-hooks/stop.mjs", "scripts/governance-hooks/stop.mjs"]
];
if (profile !== "lite") {
  map.push(["governance/registry.md", "governance/registry.md"]);
  map.push(["governance/cases/README.md", "governance/cases/README.md"]);
}
if (profile === "high-assurance") map.push(["governance/high-assurance.md", "governance/high-assurance.md"]);

for (const [source, dest] of map) writes.push({ source: join(common, source), dest: join(target, dest) });
writes.push({ source: join(common, "INSTRUCTIONS.md"), dest: join(target, adapter.instructionFile) });

if (adapter.filesRoot) {
  const adapterRoot = join(KIT_ROOT, adapter.filesRoot);
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

const bridgeText = runtime === "claude-code"
  ? "# AGENTS.md\n\n项目执行宪法见 [CLAUDE.md](CLAUDE.md)。\n"
  : "# CLAUDE.md\n\n项目执行宪法见 [AGENTS.md](AGENTS.md)。\n";
const bridgePath = join(target, adapter.bridgeFile);
const installedFiles = [...new Set(finalWrites.map((x) => relative(target, x.dest)).concat([adapter.bridgeFile, "governance.lock.json"]))].sort();

console.log(`治理安装计划: target=${target} runtime=${runtime} profile=${profile}`);
for (const item of finalWrites) console.log(`${existsSync(item.dest) && !args.force ? "SKIP" : "WRITE"} ${relative(target, item.dest)}`);
console.log(`${existsSync(bridgePath) && !args.force ? "SKIP" : "WRITE"} ${adapter.bridgeFile}`);
console.log(`${existsSync(join(target, "governance.lock.json")) && !args.force ? "SKIP" : "WRITE"} governance.lock.json`);
if (!args.write) {
  console.log("dry-run完成；加入 --write 才写文件。");
  process.exit(0);
}

for (const item of finalWrites) copyRendered(item.source, item.dest, values, { force: !!args.force });
if (!existsSync(bridgePath) || args.force) {
  mkdirSync(join(target), { recursive: true });
  writeFileSync(bridgePath, bridgeText);
}
const lockPath = join(target, "governance.lock.json");
if (!existsSync(lockPath) || args.force) {
  writeFileSync(lockPath, JSON.stringify({
    schemaVersion: 1,
    playbookVersion: VERSION,
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
function fail(message) { console.error(message); process.exit(1); }
