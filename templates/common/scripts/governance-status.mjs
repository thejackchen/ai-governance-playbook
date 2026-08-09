#!/usr/bin/env node
// 自适应执行状态生成器 + 漂移门（方法论见 playbook CORE.md §2.5「执行状态建模」）。
// - 未分裂（无 docs/execution/branches/ 或为空）：打印单游标 + 工作树，供开工播报。
// - 已分裂（战线≥3 毕业成分支文件）：从各分支「## 当前游标」投影 ROADMAP 战线表。
//     --write 生成/刷新投影块；--check（有分支时默认）比对，漂移则退出 1（漂移门）。
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const branchesDir = join(root, "docs", "execution", "branches");
const roadmapPath =
  ["docs/execution/ROADMAP.md", "ROADMAP.md"]
    .map((rel) => join(root, rel))
    .find((p) => existsSync(p)) || join(root, "ROADMAP.md");
const roadmapDir = dirname(roadmapPath);

const START = "<!-- governance-status:projection:start -->";
const END = "<!-- governance-status:projection:end -->";

function firstLineAfterCursor(text, label) {
  const m = text.match(/^##\s+当前游标\s*$/m);
  if (!m) throw new Error(`${label} 缺少「## 当前游标」标题`);
  const line =
    text
      .slice(m.index + m[0].length)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean) || "";
  if (!line) throw new Error(`${label} 的「当前游标」为空`);
  return line;
}

function branchSlugs() {
  if (!existsSync(branchesDir)) return [];
  return readdirSync(branchesDir)
    .filter((n) => n.endsWith(".md") && !n.startsWith("_"))
    .map((n) => n.replace(/\.md$/, ""))
    .sort();
}

function projectionBlock(slugs) {
  const rows = slugs.map((slug) => {
    const cursor = firstLineAfterCursor(
      readFileSync(join(branchesDir, `${slug}.md`), "utf8"),
      `branches/${slug}.md`,
    );
    // 链接相对 ROADMAP 实际所在目录，兼容 ROADMAP 放仓库根或 docs/execution/ 两种布局。
    const link = relative(roadmapDir, join(branchesDir, `${slug}.md`)) || `${slug}.md`;
    return `| ${slug} | ${cursor} | [${slug}](${link}) |`;
  });
  return [
    START,
    "<!-- 本表由 `node scripts/governance-status.mjs --write` 从各分支「当前游标」投影生成，请勿手改 -->",
    "| 战线 | 当前游标 | 指针 |",
    "|---|---|---|",
    ...rows,
    END,
  ].join("\n");
}

function extractBlock(text) {
  const i = text.indexOf(START);
  const j = text.indexOf(END);
  if (i === -1 || j === -1 || j < i) return null;
  return text.slice(i, j + END.length);
}

// 分裂后,ROADMAP 顶部的单线「## 当前游标」段是废弃的第二份状态正本。
// hasTopCursor 供 --check 拦(有分支还留着它=漂移);stripTopCursor 供 --write 自动删。
function hasTopCursor(text) {
  return text.split(/\r?\n/).some((line) => /^##[ \t]+当前游标[ \t]*$/.test(line));
}

function stripTopCursor(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^##[ \t]+当前游标[ \t]*$/.test(line));
  if (start === -1) return text;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##[ \t]/.test(lines[i])) { end = i; break; }
  }
  lines.splice(start, end - start);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function printSingle() {
  let cursor;
  try {
    cursor = firstLineAfterCursor(readFileSync(roadmapPath, "utf8"), "ROADMAP.md");
  } catch (error) {
    cursor = `（${error instanceof Error ? error.message : String(error)}）`;
  }
  let status = "";
  try {
    status = execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }).trim();
  } catch {}
  console.log(`治理启动状态（单线）\n\n当前游标:\n${cursor}\n\n工作树:${status ? `\n${status}` : " clean"}`);
}

try {
  const arg = process.argv[2];
  if (arg && !["--check", "--write", "--print"].includes(arg)) {
    throw new Error("用法: node scripts/governance-status.mjs [--check|--write|--print]");
  }
  const slugs = branchSlugs();

  // 未分裂：无投影可算。--check 视为通过（漂移门空过），其余打印单游标。
  if (slugs.length === 0) {
    if (arg === "--check") console.log("[governance-status] 单线项目，无分支投影可校验（通过）");
    else printSingle();
    process.exit(0);
  }

  const mode = arg || "--check";
  if (mode === "--print") {
    // 有分支时打印各分支游标（投影视图），不读顶部单游标——分裂后它已废弃。
    let status = "";
    try { status = execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }).trim(); } catch {}
    const lines = slugs.map((s) => `- ${s}: ${firstLineAfterCursor(readFileSync(join(branchesDir, `${s}.md`), "utf8"), `branches/${s}.md`)}`);
    console.log(`治理启动状态（${slugs.length} 条战线）\n\n${lines.join("\n")}\n\n工作树:${status ? `\n${status}` : " clean"}`);
    process.exit(0);
  }

  const expected = projectionBlock(slugs);
  if (mode === "--write") {
    // 分裂态:先删顶部单游标(废弃的第二正本),再写投影块。
    const roadmap = stripTopCursor(readFileSync(roadmapPath, "utf8"));
    const existing = extractBlock(roadmap);
    const next = existing ? roadmap.replace(existing, expected) : `${roadmap.trimEnd()}\n\n${expected}\n`;
    writeFileSync(roadmapPath, next, "utf8");
    console.log(`[governance-status] 已把 ${slugs.length} 条战线游标投影进 ${roadmapPath.replace(root, "")}（并清除顶部单游标）`);
    process.exit(0);
  }

  // --check：漂移门。分裂态下先拦「顶部还留着单游标」这份第二正本,再比投影。
  const roadmapText = readFileSync(roadmapPath, "utf8");
  if (hasTopCursor(roadmapText)) {
    console.error("[governance-status] 分裂态下 ROADMAP 仍有顶部「## 当前游标」段——它是废弃的第二份状态正本；运行 --write 删除，状态只留各分支游标");
    process.exitCode = 1;
  } else {
    const actual = extractBlock(roadmapText);
    if (actual === expected) {
      console.log(`[governance-status] ROADMAP 投影一致（${slugs.length} 条战线）`);
      process.exit(0);
    }
    console.error("[governance-status] ROADMAP 投影漂移——请运行 node scripts/governance-status.mjs --write 重算");
    if (actual === null) console.error("  （ROADMAP 里还没有投影块；首次分裂成分支后需先 --write 生成）");
    process.exitCode = 1;
  }
} catch (cause) {
  console.error(`[governance-status] ERROR ${cause instanceof Error ? cause.message : String(cause)}`);
  process.exitCode = 1;
}
