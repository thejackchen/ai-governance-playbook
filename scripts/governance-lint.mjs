#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const root = resolve(arg("--root") || process.cwd());
const errors = [];
const warnings = [];
const outputLimit = 32 * 1024;
let reqCfg = null;
const BUILT_IN_REQUIREMENTS_VALIDATOR = ["node", "scripts/requirements-check.mjs", "--root", "."];
const LOCAL_REQUIREMENTS_SOURCE = "docs/requirements/backlog.md";
const read = (p) => readFileSync(join(root, p), "utf8");
const required = (p) => {
  if (!existsSync(join(root, p))) errors.push(`缺少文件: ${p}`);
};
function clampOutput(text) {
  const raw = String(text || "");
  return raw.length > outputLimit ? `${raw.slice(0, outputLimit)}…(已截断 ${raw.length - outputLimit} 字符)` : raw;
}
function parseRequirementsConfig(policy) {
  const cfg = policy?.requirements;
  if (!cfg) {
    warnings.push("[需求系统] governance/policy.json 未声明 requirements；按兼容策略默认 local + built-in 校验");
    return {
      mode: "local",
      source: LOCAL_REQUIREMENTS_SOURCE,
      validators: [],
    };
  }
  if (typeof cfg !== "object" || cfg === null || Array.isArray(cfg)) {
    errors.push("governance/policy.json requirements 需为对象");
    return null;
  }
  const mode = cfg.mode === "external" || cfg.mode === "local" ? cfg.mode : "local";
  if (cfg.mode !== mode) errors.push(`governance/policy.json requirements.mode 必须为 local 或 external: ${cfg.mode}`);
  const source = typeof cfg.source === "string" && cfg.source.trim() ? cfg.source.trim() : "";
  if (!source) errors.push("governance/policy.json requirements.source 不能为空");
  if (cfg.validator !== undefined && !Array.isArray(cfg.validator)) {
    errors.push("governance/policy.json requirements.validator 形态非法；要求为 string[][]");
    return null;
  }
  const validator = cfg.validator ?? [];
  for (const item of validator) {
    if (!Array.isArray(item) || !item.length || !item.every((x) => typeof x === "string")) {
      errors.push(`governance/policy.json requirements.validator 形态非法: ${JSON.stringify(item)}；要求为 string[][]`);
      return null;
    }
  }
  if (mode === "external" && validator.length) errors.push("external 模式 requirements.validator 必须为空；外部权威只由三处同一 URL 指针承载");
  return {
    mode,
    source,
    validators: validator,
  };
}
function isExternalRequirementsSource(source) {
  return /^https?:\/\/[^\s]+$/i.test(source);
}
function isInsideRepoRoot(targetPath) {
  const normalizedRoot = resolve(root);
  const normalizedTarget = resolve(targetPath);
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${sep}`);
}
function validateRequirementsConfig(cfg) {
  if (!cfg) return;
  const sourcePath = resolve(root, cfg.source);
  const localBacklog = join(root, "docs/requirements/backlog.md");
  const hasStatefulBacklog = existsSync(localBacklog)
    ? /##\s*进行中需求/.test(read("docs/requirements/backlog.md")) || /^\s*-\s*\[\s\]\s+REQ-[A-Z0-9-]+/m.test(read("docs/requirements/backlog.md"))
    : false;

  if (cfg.mode === "external") {
    if (!isExternalRequirementsSource(cfg.source)) {
      errors.push(`requirements.source 必须是 https:// 或 http:// 外链: ${cfg.source}`);
    }
    if (hasStatefulBacklog) {
      errors.push("external 模式检测到本地状态化 backlog，请移除状态字段；外部需求应仅保留外部指针");
    }
    validateExternalRequirementPointers(cfg.source);
    return;
  }

  if (cfg.source !== LOCAL_REQUIREMENTS_SOURCE) {
    errors.push(`local 模式 requirements.source 必须为 ${LOCAL_REQUIREMENTS_SOURCE}，以与内置 requirements-check 的唯一权威一致: ${cfg.source}`);
    return;
  }

  if (!existsSync(sourcePath)) {
    errors.push(`requirements.source 不存在: ${cfg.source}`);
    return;
  }
  if (!isInsideRepoRoot(sourcePath)) {
    errors.push(`requirements.source 越界: ${cfg.source}`);
    return;
  }
}
function validateExternalRequirementPointers(source) {
  const instruction = lock?.runtime === "claude-code" ? "CLAUDE.md" : "AGENTS.md";
  const pointers = [
    ["governance/policy.json", source],
    [instruction, extractLinkForLabel(read(instruction), "需求")],
    ["docs/index.md", extractLinkForLabel(read("docs/index.md"), "需求")],
  ];
  for (const [file, actual] of pointers) {
    if (actual !== source) {
      errors.push(`external 需求指针不一致: ${file}=${actual || "缺少需求链接"}，应为 ${source}`);
    }
  }
}
function validateCredentialIgnoreRules() {
  const targets = [".env.local.bak", ".env.local.old", ".env.local.save", ".env.local~", ".env.production"];
  const results = targets.map((target) => [target, spawnSync("git", ["check-ignore", "-q", "--", target], { cwd: root, encoding: "utf8" })]);
  const executionFailure = results.find(([, result]) => result.error);
  if (executionFailure) {
    errors.push(`无法运行 git check-ignore 以验证凭据忽略规则: ${executionFailure[1].error.message}`);
    return;
  }
  const missing = results.filter(([, result]) => result.status !== 0).map(([target]) => target);
  if (!missing.length) return;
  errors.push(`.gitignore 未忽略凭据派生文件: ${missing.join(", ")}；补充 .env.* 或等效规则后重跑治理检查`);
}
function hasRecursiveRisk(argv) {
  return argv.some((token) => {
    const base = basename(String(token || "")).replace(/\.mjs$/i, "").toLowerCase();
    return new Set(["governance-lint", "governance-verify", "init", "doctor"]).has(base);
  });
}
function runValidator(argv) {
  if (process.env.AIOS_REQUIREMENTS_GUARD === "1") {
    errors.push("需求校验被要求阻断递归调用（AIOS_REQUIREMENTS_GUARD=1）");
    return;
  }
  if (!Array.isArray(argv) || !argv.length) {
    errors.push("非法 requirements.validator: 空向量");
    return;
  }
  if (hasRecursiveRisk(argv)) {
    errors.push(`需求校验器命中递归禁令: ${argv.join(" ")}`);
    return;
  }
  const command = argv[0];
  const args = argv.slice(1);
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, AIOS_REQUIREMENTS_GUARD: "1" },
    encoding: "utf8",
    timeout: 10000,
  });
  if (result.error) {
    errors.push(`需求校验器执行异常: ${command} ${args.join(" ")}; ${result.error.message}`);
    return;
  }
  if (result.status !== 0) {
    const output = clampOutput([result.stdout, result.stderr].filter(Boolean).join("\n"));
    errors.push(`需求校验器执行失败（${Date.now() - started}ms）: ${argv.join(" ")}; ${output}`);
    return;
  }
}
function isBuiltInRequirementsValidator(argv) {
  return argv.length === BUILT_IN_REQUIREMENTS_VALIDATOR.length
    && argv.every((part, index) => part === BUILT_IN_REQUIREMENTS_VALIDATOR[index]);
}
function runRequirementValidators(cfg) {
  if (!cfg || cfg.mode !== "local") return;
  // 内置 checker 是 local 合同的一部分，policy 只能追加，不能替换。
  runValidator(BUILT_IN_REQUIREMENTS_VALIDATOR);
  for (const validator of cfg.validators) {
    if (!isBuiltInRequirementsValidator(validator)) runValidator(validator);
  }
}
function resolveRequirementsSourceFromLegacy() {
  const readInstruction = existsSync(join(root, ".codex/hooks.json"))
    ? "AGENTS.md"
    : existsSync(join(root, ".claude/settings.json"))
      ? "CLAUDE.md"
      : existsSync(join(root, "AGENTS.md"))
        ? "AGENTS.md"
        : "CLAUDE.md";
  const linkFromInstruction = extractLinkForLabel(read(readInstruction), "需求");
  if (linkFromInstruction) return linkFromInstruction;
  return extractLinkForLabel(read("docs/index.md"), "需求") || extractLinkForLabel(read("docs/index.md"), "requirements");
}
const resolveRelativeLink = (fromFile, target) => {
  const trimmed = target.trim().replace(/^<|>$/g, "").split("#")[0];
  if (!trimmed || /^(https?:|mailto:|#)/.test(trimmed)) return null;
  const resolved = isAbsolute(trimmed) ? trimmed : resolve(dirname(fromFile), trimmed);
  return resolved;
};
const extractLinkForLabel = (body, label) => {
  for (const m of body.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
    const text = m[1];
    const target = m[2];
    if (!text || !target) continue;
    if (text.includes(label)) return target;
  }
  return null;
};

required("governance.lock.json");
if (errors.length) finish();

let lock;
try {
  lock = JSON.parse(read("governance.lock.json"));
} catch (e) {
  errors.push(`governance.lock.json 无法解析: ${e.message}`);
  finish();
}

for (const p of lock.installedFiles || []) required(p);
validateCredentialIgnoreRules();
if (lock.runtime === "codex") {
  ["AGENTS.md", "CLAUDE.md", ".codex/config.toml", ".codex/hooks.json", ".codex/rules/default.rules"].forEach(required);
} else if (lock.runtime === "claude-code") {
  ["CLAUDE.md", "AGENTS.md", ".claude/settings.json"].forEach(required);
} else {
  required("AGENTS.md");
}

for (const p of lock.installedFiles || []) {
  const full = join(root, p);
  if (!existsSync(full) || !/\.(md|json|toml|rules|mjs)$/.test(p)) continue;
  const body = readFileSync(full, "utf8");
  const placeholders = [...body.matchAll(/\{\{[A-Z0-9_]+\}\}/g)].map((m) => m[0]);
  if (placeholders.length) errors.push(`${p} 残留占位符: ${[...new Set(placeholders)].join(", ")}`);
}

// 死链扫描范围 = installedFiles ∪ 目标根目录全部 *.md。
// 只扫installedFiles会漏掉CORE.md/README.md这类自托管文档——它们是真实交付内容，
// 但从未登记进governance.lock.json，之前死链检测对它们完全失明。
// 目录级排除 templates/（含extensions/*/templates）：那是渲染前的模板源，双花括号占位符
// 出现在链接目标里是设计如此，不是死链——与validate-kit.mjs对占位符残留的排除口径一致。
const markdownFiles = new Set((lock.installedFiles || []).filter((p) => p.endsWith(".md")));
for (const full of collectMarkdownFiles(root)) markdownFiles.add(relative(root, full));
for (const p of markdownFiles) {
  const full = join(root, p);
  if (!existsSync(full)) continue;
  const body = readFileSync(full, "utf8");
  for (const m of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = m[1].trim().replace(/^<|>$/g, "").split("#")[0];
    if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
    const resolved = isAbsolute(target) ? target : resolve(dirname(full), target);
    if (!existsSync(resolved)) errors.push(`${p} 死链: ${m[1]}`);
  }
}

try {
  const policy = JSON.parse(read("governance/policy.json"));
  if (policy.schemaVersion !== 1) errors.push("governance/policy.json schemaVersion 必须为 1");
  for (const key of ["denyCommandPatterns", "fastChecks", "ciChecks", "protectedPaths", "allowedTopLevelEntries"]) {
    if (!Array.isArray(policy[key])) errors.push(`governance/policy.json ${key} 必须是数组`);
  }
  for (const pattern of policy.denyCommandPatterns || []) {
    try { new RegExp(pattern, "i"); } catch (e) { errors.push(`非法 denyCommandPatterns 正则: ${pattern}`); }
  }
  reqCfg = parseRequirementsConfig(policy);
  validateRequirementsConfig(reqCfg);
  runRequirementValidators(reqCfg);
  if (lock.profile !== "lite" && !(policy.ciChecks || []).length) warnings.push("尚未登记项目级 ciChecks；当前CI只验证治理结构");
  if ((policy.allowedTopLevelEntries || []).length) {
    const allowed = new Set(policy.allowedTopLevelEntries);
    const ignored = new Set([".git", ".DS_Store"]);
    for (const name of readdirSync(root)) {
      if (!ignored.has(name) && !allowed.has(name)) errors.push(`未知顶层项: ${name}（更新仓库结构地图和allowedTopLevelEntries，或移走该文件）`);
    }
  }
} catch (e) {
  errors.push(`governance/policy.json 无法解析: ${e.message}`);
}

if (existsSync(join(root, "governance/registry.md"))) {
  const count = (read("governance/registry.md").match(/^\| R\d+ \|/gm) || []).length;
  if (count > Number(lock.ruleBudget || 0)) errors.push(`规则预算超限: ${count}/${lock.ruleBudget}`);
}

if (existsSync(join(root, "governance/registry.md"))) {
  const registryBody = read("governance/registry.md");
  const carriers = [];
  const pushDir = (dir, label) => {
    let names = [];
    try { names = readdirSync(join(root, dir)); } catch { return; }
    for (const name of names) {
      try { if (!statSync(join(root, dir, name)).isFile()) continue; } catch { continue; }
      carriers.push({ id: name, label: `${label} ${name}` });
    }
  };
  pushDir(".githooks", "git hook");
  pushDir(".github/workflows", "CI workflow");
  const unregistered = carriers.filter((c) => !registryBody.includes(c.id));
  for (const c of unregistered) {
    warnings.push(`载体在跑但未登记进 registry.md: ${c.label}——登记它，或说明为何不算治理载体`);
  }
}

// ── hook 载体实效检查:文件存在 ≠ 守卫在岗 ──
{
  const checkHookCarrier = (path, extract, label) => {
    const full = join(root, path);
    if (!existsSync(full)) return;   // 文件缺失已由上方 required() 按 runtime 报 error
    try {
      const carrier = JSON.parse(readFileSync(full, "utf8"));
      if (!extract(carrier)) warnings.push(`${path} 存在但未挂 ${label}——守卫文件是空壳,landing/拦截不会真跑(手工抄治理的典型残留,重跑 init 或补齐 hook 段)`);
    } catch (e) {
      warnings.push(`${path} 无法解析: ${e.message}`);
    }
  };
  if (lock.runtime === "claude-code") {
    checkHookCarrier(".claude/settings.json", (c) => Array.isArray(c?.hooks?.Stop) && c.hooks.Stop.length > 0, "Stop hook");
  } else if (lock.runtime === "codex") {
    checkHookCarrier(".codex/hooks.json", (c) => c && Object.keys(c).length > 0, "任何 hook");
  }
}

// ── ROADMAP 游标新鲜度:记载的「当前」必须真的当前 ──
{
  try {
    const sh = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    const lastCommit = sh(["log", "-1", "--format=%cI"]).slice(0, 10);
    const roadmapPath = ["ROADMAP.md", "docs/ROADMAP.md"].find((p2) => existsSync(join(root, p2)));
    if (roadmapPath && lastCommit) {
      const body = readFileSync(join(root, roadmapPath), "utf8");
      const dates = [...body.matchAll(/20\d{2}-\d{2}-\d{2}/g)].map((m) => m[0]).sort();
      const newest = dates.at(-1);
      if (newest) {
        const gapDays = Math.floor((new Date(lastCommit) - new Date(newest)) / 86400000);
        if (gapDays > 7) warnings.push(`${roadmapPath} 最新日期 ${newest} 落后最新提交 ${lastCommit} 达 ${gapDays} 天——游标疑陈旧,新 AI 接手会被误导;收尾请刷新当前活跃状态`);
      }
    }
  } catch { /* 非 git 环境 */ }
}

// 交付真实性:禁止在本地宣称“已推送”却非真实远端。不能简单用 `git push` 输出替代。
{
  const sh = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  try {
    const branch = sh(["rev-parse", "--abbrev-ref", "HEAD"]);
    const remotes = sh(["remote"]).split("\n").filter(Boolean);
    if (remotes.length === 0) {
      warnings.push("本仓没有配置任何远端 — 所有提交只存在本机一份,磁盘故障即全部丢失");
    }
    for (const remote of remotes) {
      let ahead;
      try { ahead = Number(sh(["rev-list", "--count", `${remote}/${branch}..${branch}`])); } catch { continue; }
      if (ahead > 0) warnings.push(`本地 ${branch} 领先 ${remote} ${ahead} 个提交 — 未推送到真远端(别拿 push 的成功输出当证据)`);
    }
  } catch {
    warnings.push("git 环境不可用，无法核验仓库分支/远端状态");
  }
}

finish();

function finish() {
  for (const item of warnings) console.warn(`[governance] WARN ${item}`);
  for (const item of errors) console.error(`[governance] ERROR ${item}`);
  console.log(`[governance] ${errors.length} error / ${warnings.length} warn`);
  process.exit(errors.length ? 1 : 0);
}

function collectMarkdownFiles(dir, out = []) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === ".git" || name === "node_modules" || name === "templates" || name === ".claude") continue;
    if (name === ".claude/worktrees") continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) collectMarkdownFiles(full, out);
    else if (name.endsWith(".md")) out.push(full);
  }
  return out;
}
