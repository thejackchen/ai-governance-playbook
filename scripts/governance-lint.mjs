#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { lintExtraRepoFacts } from "./lib/extra-repo-facts.mjs";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const root = resolve(arg("--root") || process.cwd());
const errors = [];
const warnings = [];
const read = (p) => readFileSync(join(root, p), "utf8");
const required = (p) => {
  if (!existsSync(join(root, p))) errors.push(`缺少文件: ${p}`);
};
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
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isShortBridge(content, targetFile) {
  const body = String(content || "").trim();
  if (!body || body.split(/\r?\n/).length > 24 || Buffer.byteLength(body, "utf8") > 4096) return false;
  const target = escapeRegex(targetFile);
  return new RegExp(`\\[[^\\]]*${target}[^\\]]*\\]\\([^)]*${target}[^)]*\\)`, "i").test(body);
}

// 新安装使用字节一致的双正本；历史安装允许一份完整正本加一份手写桥接。
// 桥接只按短文件+明确 markdown 链接启发式识别，不绑定某一版模板措辞。
function validateConstitutionFiles() {
  const claudePath = join(root, "CLAUDE.md");
  const agentsPath = join(root, "AGENTS.md");
  if (!existsSync(claudePath) || !existsSync(agentsPath)) return;
  const claude = readFileSync(claudePath, "utf8");
  const agents = readFileSync(agentsPath, "utf8");
  if (claude === agents) return;
  const bridgeCount = [
    isShortBridge(claude, "AGENTS.md"),
    isShortBridge(agents, "CLAUDE.md"),
  ].filter(Boolean).length;
  if (bridgeCount !== 1) {
    errors.push("[双宪法] CLAUDE.md 与 AGENTS.md 必须字节一致，或保留一份完整正本加一份短 markdown 桥接");
  }
}

required("governance.lock.json");
if (errors.length) finish();

let lock;
try {
  lock = JSON.parse(read("governance.lock.json"));
} catch (e) {
  errors.push(`governance.lock.json 无法解析: ${e.message}`);
  finish();
}

// installedFiles 是历史记录，不是强制存在清单；实际采用的运行时仍检查接线。
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
validateConstitutionFiles();

// 死链扫描范围 = installedFiles ∪ 目标根目录全部 *.md。
// 只扫installedFiles会漏掉CORE.md/README.md这类自托管文档——它们是真实交付内容，
// 但从未登记进governance.lock.json，之前死链检测对它们完全失明。
// 目录级排除 templates/（含extensions/*/templates）：那是渲染前的模板源，双花括号占位符
// 出现在链接目标里是设计如此，不是死链——与validate-kit.mjs对占位符残留的排除口径一致。
const markdownFiles = new Set((lock.installedFiles || []).filter((p) => p.endsWith(".md")));
for (const full of collectMarkdownFiles(root)) markdownFiles.add(relative(root, full));
// 历史/append-only/草稿/时点快照文档：链接是时点快照，允许随时间腐烂，不纳入死链硬门
// （与 incidents.md append-only 豁免同理）。涵盖 handoff/audit/archive/draft 目录、
// 日期前缀快照文件（YYYY-MM-DD-*）、CHANGELOG、incidents、含 draft 或「交接」的文档。
const deadLinkExempt = /(^|\/)(handoffs?|audits?|_?archive|_?rescued|drafts?)(\/|$)|(^|\/)\d{4}-\d{2}-\d{2}[^/]*\.md$|(^|\/)CHANGELOG[^/]*\.md$|incidents\.md$|draft|交接/i;
for (const p of markdownFiles) {
  if (deadLinkExempt.test(p)) continue;
  const full = join(root, p);
  if (!existsSync(full)) continue;
  const body = readFileSync(full, "utf8");
  // 先剥掉 fenced code block 与 inline code span：其中的 [x](y) 是代码/示例（如考题里演示死链），不是真实链接。
  const scannable = body.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
  for (const m of scannable.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = m[1].trim().replace(/^<|>$/g, "").split("#")[0];
    if (!target || /^(https?:|mailto:|file:|#)/i.test(target)) continue;
    // 目标含正则/glob 元字符（[ ] ^ *）：是文档里的正则/路径模式示例，不是真实链接。
    if (/[[\]^*]/.test(target)) continue;
    // 路径含未平衡括号（如 Next.js 路由组 app/(dashboard)/…）：正则 [^)]+ 会截断误判，无法可靠解析，跳过。
    if ((target.match(/\(/g) || []).length !== (target.match(/\)/g) || []).length) continue;
    // 剥掉行号后缀（如 src/app.js:40 指的是文件 src/app.js，:40 是行号不是文件名的一部分）。
    target = target.replace(/:\d+(-\d+)?$/, "");
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

// ── playbook 自身版本漂移：消费项目没有 VERSION/CORE 时跳过 ──
{
  if (existsSync(join(root, "VERSION")) && existsSync(join(root, "CORE.md"))) {
    const versionFiles = ["VERSION", "package.json", "governance.lock.json", "README.md", "CHANGELOG.md"];
    const missing = versionFiles.filter((path) => !existsSync(join(root, path)));
    if (missing.length) {
      errors.push(`[版本漂移] playbook 仓库缺少版本对账文件: ${missing.join(", ")}`);
    } else {
      const version = read("VERSION").trim();
      let packageVersion = "";
      let lockVersion = "";
      let readmeVersion = "";
      let changelogVersion = "";
      try {
        packageVersion = JSON.parse(read("package.json")).version || "";
      } catch (cause) {
        errors.push(`[版本漂移] package.json 无法解析: ${cause.message}`);
      }
      try {
        lockVersion = JSON.parse(read("governance.lock.json")).playbookVersion || "";
      } catch (cause) {
        errors.push(`[版本漂移] governance.lock.json 无法解析: ${cause.message}`);
      }
      const readmeMatch = read("README.md").match(/版本\s+v(\d+\.\d+\.\d+)/);
      if (readmeMatch) readmeVersion = readmeMatch[1];
      else errors.push("[版本漂移] README.md 缺少 `版本 vX.Y.Z` 标记");
      const changelogTitle = read("CHANGELOG.md").match(/^## [^\n]+/m)?.[0] || "";
      const changelogHead = changelogTitle.match(/\bv(\d+\.\d+\.\d+)/);
      if (changelogHead) changelogVersion = changelogHead[1];
      else errors.push("[版本漂移] CHANGELOG.md 头部缺少带 `vX.Y.Z` 的最新版本节");
      const versions = [
        ["VERSION", version],
        ["package.json.version", packageVersion],
        ["governance.lock.json.playbookVersion", lockVersion],
        ["README.md", readmeVersion],
        ["CHANGELOG.md 头部", changelogVersion],
      ];
      const distinct = new Set(versions.map(([, value]) => value));
      if (distinct.size !== 1 || versions.some(([, value]) => !value)) {
        errors.push(`[版本漂移] ${versions.map(([name, value]) => `${name}=${value || "缺失"}`).join("；")}`);
      }
    }
  }
}

{
  const extra = lintExtraRepoFacts(root);
  errors.push(...extra.errors);
  warnings.push(...extra.warnings);
}

// 交付真实性:禁止在本地宣称“已推送”却非真实远端。不能简单用 `git push` 输出替代。
{
  const sh = (args) => execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  try {
    const branch = sh(["symbolic-ref", "--quiet", "--short", "HEAD"]);
    const remotes = sh(["remote"]).split("\n").filter(Boolean);
    if (remotes.length === 0) {
      warnings.push("本仓没有配置任何远端 — 所有提交只存在本机一份,磁盘故障即全部丢失");
    }
    for (const remote of remotes) {
      let remoteRefExists = false;
      try {
        remoteRefExists = sh(["show-ref", "--verify", "--quiet", `refs/remotes/${remote}/${branch}`]) === "";
      } catch {
        remoteRefExists = false;
      }
      if (!remoteRefExists) continue;
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
