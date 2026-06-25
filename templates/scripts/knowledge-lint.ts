/**
 * knowledge-lint.ts — 治理健康检查（自动化层 / pre-commit 门禁）
 *
 * 这是一个**骨架**。用法：把下面 CONFIG 常量改成你项目的路径，`npx tsx scripts/knowledge-lint.ts` 即跑。
 *
 * 它做什么：检查治理知识库里**机器能确定性判断**的问题——断链、关键文件失踪、
 * 状态线/CHANGELOG 不新鲜。语义级判断（哪条主线该改成什么、内容对不对）**不在这**，
 * 那留给 AI 自觉 + 事件驱动纠错（撞见就改）+ 验收测试兜底。
 *
 * 设计原则（新架构内核）：
 *  - 「腐烂默认靠持续自动、非周期意志」——这个脚本就是那个「持续自动」的机器半边；
 *    它把「文档烂了」从隐形变成 commit 时拦得住的红灯。
 *  - 「最简默认、复杂度要挣来」——别膨胀到 20 个检查。每个检查都稀释信号、增加误报。
 *    新增检查先过三问：① 能确定性判（不靠语义猜）？② 拦的是要命的事？③ 有真消费者会去消化报告？
 *    三个都 yes 才加。一个永不被消化的检查 = 负资产（淹没真信号 + 制造「lint 在工作」的虚假安全感）。
 *  - error = 当场拦下提交；warn = 该修但不阻断；info 默认只汇总计数（别逐条刷屏淹没真信号）。
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

// ── CONFIG：改成你项目的路径 / 阈值 ──────────────────────────
// 关键治理文件（失踪即 error）。文件名 → 在 ROOT 下的相对路径。
const FILES = {
  constitution: "CONSTITUTION.md",           // 北极星 / SoT 根
  agents: "AGENTS.md",                        // AI 交接：启动协议 + 干活铁律
  status: "ROADMAP.md",                       // 状态线（当前游标 + 各线进度）；改成你的状态线文件名
  changelog: "CHANGELOG.md",                  // 事件流水
  coldStart: "docs/runbooks/cold-start-onboarding.md", // 冷启动上手包（启动协议引用它）
  kbIndex: "KNOWLEDGE_BASE/index.md",         // 知识地图
};
// 状态线里「当前游标」段的标题正则（失焦找回的活锚点，必须存在且非空）。改成你状态线用的段名。
const CURSOR_HEADING = /^##\s+当前游标/;
// CHANGELOG 行格式：- [YYYY-MM-DD] [type] 摘要
const CHANGELOG_LINE = /^- \[(\d{4}-\d{2}-\d{2})\]/gm;
// 新鲜度阈值（天）：CHANGELOG 最新事件超过 STALE_ERROR 天 → error（漏沉淀）。
const STALE_ERROR_DAYS = 7;
// 状态线 Last Updated 落后 CHANGELOG 最新事件超过 LAG_WARN 天 → warn（状态恐已漂移）。
const LAG_WARN_DAYS = 7;
// 扫断链 / 收集 .md 的目录（相对 ROOT）。加上你存知识/决策的目录。
const SCAN_DIRS = ["KNOWLEDGE_BASE", "docs"];
// 知识 index 完整性：检查 6 自动扫描 KB 根下所有子目录（不硬编码子目录名，
// 避免你用了别的子目录名时检查静默失效）。

// ── 工具 ─────────────────────────────────────────────────
interface Issue { level: "error" | "warn" | "info"; file: string; message: string; line?: number; }
const issues: Issue[] = [];
const report = (level: Issue["level"], file: string, message: string, line?: number) =>
  issues.push({ level, file: path.relative(ROOT, file), message, line });

const abs = (rel: string) => path.join(ROOT, rel);
const exists = (rel: string) => fs.existsSync(abs(rel));
const readLines = (file: string) => fs.readFileSync(file, "utf-8").split("\n");

function allMarkdown(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...allMarkdown(full));
    else if (e.name.endsWith(".md")) out.push(full);
  }
  return out;
}

// 最新 CHANGELOG 事件日期（多处复用）
function latestChangelogDate(): string | null {
  if (!exists(FILES.changelog)) return null;
  const content = fs.readFileSync(abs(FILES.changelog), "utf-8");
  let latest: string | null = null;
  for (const m of content.matchAll(CHANGELOG_LINE)) if (!latest || m[1] > latest) latest = m[1];
  return latest;
}
const daysBetween = (a: string, b: string) =>
  Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

// ── 检查 1：断链（被 .md 引用的相对路径必须存在） ───────────────
// 匹配 [text](path.md)、→ `path.md`、详见 path.md。锚点 #/§ 剥掉，URL 跳过。
function checkBrokenRefs(file: string, lines: string[]) {
  const mdLink = /\[[^\]]*\]\(([^)]+\.md(?:#[^)]*)?)\)/g;
  const arrowRef = /→\s*`([^`]+\.md(?:\s*§[^`]*)?)`/g;
  const detailRef = /详见\s*`?([^\s`[\]()]+\.md)`?/g;
  const dir = path.dirname(file);
  lines.forEach((line, i) => {
    if (line.trim().startsWith("```")) return; // 跳过代码块
    for (const pat of [mdLink, arrowRef, detailRef]) {
      pat.lastIndex = 0;
      let m;
      while ((m = pat.exec(line)) !== null) {
        const ref = m[1].split("#")[0].split("§")[0].trim();
        if (ref.startsWith("http")) continue;
        if (ref.includes("{") || ref.includes("}")) continue; // 骨架 {占位} 链接，填好占位后才查
        // 依次尝试：相对文件 → 项目根 → KB 根（KB 文件常用简写如 domains/...）
        const tries = [path.resolve(dir, ref), abs(ref), path.resolve(abs(FILES.kbIndex), "..", ref)];
        if (!tries.some(fs.existsSync)) report("error", file, `断链: ${ref}（文件不存在）`, i + 1);
      }
    }
  });
}

// ── 检查 2：关键治理文件在 ────────────────────────────────────
// CONSTITUTION / AGENTS / 状态线 / 冷启动上手包 / KB index 任一失踪 = 治理断裂。
function checkCriticalFiles() {
  const required: Array<[string, string]> = [
    [FILES.constitution, "北极星 / SoT 根缺失"],
    [FILES.agents, "AI 交接（启动协议 + 干活铁律）缺失"],
    [FILES.status, "状态线缺失（当前游标 + 各线进度的活锚点）"],
    [FILES.changelog, "CHANGELOG 缺失（事件流水）"],
    [FILES.coldStart, "冷启动上手包缺失（启动协议引用它，新 AI 走不到就冷启动断裂）"],
    [FILES.kbIndex, "知识地图 index 缺失"],
  ];
  for (const [rel, msg] of required) if (!exists(rel)) report("error", abs(rel), msg);
  // 引用闭环：启动协议（AGENTS）必须真链到冷启动上手包，否则它存在也没人走到。
  if (exists(FILES.agents) && exists(FILES.coldStart)) {
    const stem = path.basename(FILES.coldStart, ".md");
    if (!fs.readFileSync(abs(FILES.agents), "utf-8").includes(stem))
      report("error", abs(FILES.agents), `启动协议未链接冷启动上手包（${stem}），新 AI 走不到它`);
  }
}

// ── 检查 3：CHANGELOG 新鲜度 ─────────────────────────────────
// 最新事件超过阈值 → error：要么真断档没干活，要么干了没沉淀。补 CHANGELOG 再提交。
function checkChangelogFreshness() {
  if (!exists(FILES.changelog)) return; // 失踪已由检查 2 报
  const latest = latestChangelogDate();
  if (!latest) { report("warn", abs(FILES.changelog), "CHANGELOG 无事件条目"); return; }
  const days = daysBetween(latest, new Date().toISOString().slice(0, 10));
  if (days > STALE_ERROR_DAYS)
    report("error", abs(FILES.changelog), `断档：最近一条 ${latest}（${days} 天前 > ${STALE_ERROR_DAYS}）——漏沉淀，补 CHANGELOG 再提交`);
}

// ── 检查 4：状态线 Last Updated 跟得上 CHANGELOG ──────────────
// 可机械化的半边：状态线日期戳显著落后最新事件 = 主线状态整体没跟进。
// 内容对错（哪条线该改成什么）是语义判断，不在这。
function checkStatusFreshness() {
  if (!exists(FILES.status) || !exists(FILES.changelog)) return;
  const lu = fs.readFileSync(abs(FILES.status), "utf-8").match(/Last Updated:\s*(\d{4}-\d{2}-\d{2})/);
  if (!lu) { report("warn", abs(FILES.status), "状态线缺 Last Updated 日期戳，新鲜度无法机械校验"); return; }
  const latest = latestChangelogDate();
  if (!latest) return;
  const lag = daysBetween(lu[1], latest);
  if (lag > LAG_WARN_DAYS)
    report("warn", abs(FILES.status), `Last Updated ${lu[1]} 落后 CHANGELOG 最新事件 ${latest} ${lag} 天——主线状态恐已漂移，刷新并更新日期戳`);
}

// ── 检查 5：状态线「当前游标」段存在且非空 ─────────────────────
// 当前游标 = 失焦找回的活锚点（北极星 + 此刻在哪条线）。段缺失/空 = 状态线失锚、静默失败。
function checkStatusCursor() {
  if (!exists(FILES.status)) return;
  const lines = readLines(abs(FILES.status));
  const idx = lines.findIndex((l) => CURSOR_HEADING.test(l));
  if (idx === -1) {
    report("error", abs(FILES.status), "缺「当前游标」段——状态线失锚（它是失焦找回的活锚点）");
    return;
  }
  let hasBody = false;
  for (let i = idx + 1; i < lines.length && !/^##\s/.test(lines[i]); i++)
    if (lines[i].trim().length > 0) { hasBody = true; break; }
  if (!hasBody) report("error", abs(FILES.status), "「当前游标」段为空——填此刻在哪条线 + 一句上下文");
}

// ── 检查 6：知识 index 与实际文件一致 ────────────────────────
// KB 子目录里每个 .md 都该在 index 出现，否则是「写了没挂进地图」的孤儿。
function checkIndexCompleteness() {
  if (!exists(FILES.kbIndex)) return; // 失踪已由检查 2 报
  const kbRoot = path.resolve(abs(FILES.kbIndex), "..");
  const indexContent = fs.readFileSync(abs(FILES.kbIndex), "utf-8");
  // 自动发现 KB 下所有子目录（避免硬编码漏掉新目录而静默失效）
  for (const sub of fs.readdirSync(kbRoot, { withFileTypes: true })) {
    if (!sub.isDirectory()) continue;
    const dir = path.join(kbRoot, sub.name);
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith(".md")) continue;
      if (!indexContent.includes(`${sub.name}/${entry}`))
        report("warn", path.join(dir, entry), `未在知识 index 中列出: ${sub.name}/${entry}（孤儿文件，挂进地图）`);
    }
  }
}

// ── 检查 7（可选）：CHANGELOG 行格式 ─────────────────────────
// 非空、非标题、以 `- ` 起头的行应符合 `- [YYYY-MM-DD] [type] 摘要`。格式一致才能被检查 3/4 机器解析。
function checkChangelogFormat() {
  if (!exists(FILES.changelog)) return;
  const lines = readLines(abs(FILES.changelog));
  const wellFormed = /^- \[\d{4}-\d{2}-\d{2}\]\s*\[[^\]]+\]/;
  lines.forEach((l, i) => {
    if (l.startsWith("- ") && !wellFormed.test(l))
      report("warn", abs(FILES.changelog), "行格式应为 `- [YYYY-MM-DD] [type] 摘要`", i + 1);
  });
}

// ── 主流程 ───────────────────────────────────────────────
function main() {
  console.log("治理健康检查\n");

  // 逐文件：断链
  const targets = SCAN_DIRS.map(abs).flatMap(allMarkdown)
    .concat([FILES.constitution, FILES.agents, FILES.status].map(abs))
    .filter(fs.existsSync);
  for (const f of new Set(targets)) checkBrokenRefs(f, readLines(f));

  // 全局检查
  checkCriticalFiles();
  checkChangelogFreshness();
  checkStatusFreshness();
  checkStatusCursor();
  checkIndexCompleteness();
  checkChangelogFormat();

  // 输出
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");
  const infos = issues.filter((i) => i.level === "info");
  const print = (items: Issue[], icon: string) =>
    items.forEach((it) => {
      console.log(`  ${icon} ${it.file}${it.line ? `:${it.line}` : ""}`);
      console.log(`    ${it.message}`);
    });

  if (errors.length) { console.log(`\n--- ERROR (${errors.length}) ---`); print(errors, "✗"); }
  if (warns.length) { console.log(`\n--- WARN (${warns.length}) ---`); print(warns, "⚠"); }
  if (infos.length) {
    // info 默认只汇总计数、不逐条刷屏（别淹没真信号）；--verbose 看详情。
    console.log(`\n--- INFO (${infos.length}) ---（逐条见 --verbose）`);
    if (process.argv.includes("--verbose")) print(infos, "ℹ");
  }

  console.log(`\n合计: ${errors.length} error / ${warns.length} warn / ${infos.length} info`);
  if (issues.length === 0) console.log("\n知识库健康 ✓");
  process.exit(errors.length > 0 ? 1 : 0); // error 即门禁红灯，pre-commit 拦下提交
}

main();
