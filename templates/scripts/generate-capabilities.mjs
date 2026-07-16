#!/usr/bin/env node
// 模板:能力清单生成器——代码即注册表。谁填:顶部 SCAN_DIRS / API_DIR 按项目实际改,正文逻辑无需动。
// 用法:node scripts/generate-capabilities.mjs          → 生成/覆写 docs/capabilities.md
//       node scripts/generate-capabilities.mjs --check  → 与落盘 diff,不一致 exit 1(挂 pre-commit / CI 保鲜)
// 原理(为什么是生成制):人工注册会腐烂(Backstage 教训)→ 从代码生成,写完即注册;
//   清单会过期 → --check 让漂移物理上过不了提交;没人记得查 → 宪法「写新功能前先查」每 session 注入。
// 支持:TS/JS 导出(ESM,以及 CommonJS 的 `module.exports = { X }` 与 `exports.X =`,含 .cjs 文件) · Python 顶层 def/class · 任意脚本头注 · Next.js API 路由(无则自动跳过)。
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

// ── 按项目实际改 ──
const SCAN_DIRS = ["src", "lib", "app"]; // 扫导出/定义的目录(不存在的自动跳过);平铺型小项目可加 "."
const API_DIR = "app/api";               // Next.js 路由目录;非 Next 项目留着也无害(不存在即跳过)
const SCRIPT_DIRS = ["scripts"];         // 按"文件级能力"收录的脚本目录
const OUT_FILE = "docs/capabilities.md";

const ROOT = new URL("..", import.meta.url).pathname; // 本脚本假定位于 scripts/,上一级即仓库根
const rel = (p) => relative(ROOT, p);
// 生成物必须是干净文本:剥离控制字符(保留 \n\t)——母版实测踩过源码注释里的字面 NUL 让 grep 把清单判为二进制、静默失配
const readClean = (p) => readFileSync(p, "utf8").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
const NO_DESC = "(无描述——补一行注释)";
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "__pycache__", "dist", "build", ".venv", "venv"]);

const walk = (dir, filter) => {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out;
};

const isTest = (p) => /(\.test\.|\.spec\.|_test\.|^test_)/.test(p.split("/").pop()) || p.endsWith("conftest.py");

// 定义行上方最近的注释(// 或 # 或 * );Python 另试定义行下方的 docstring 首行
function commentAbove(lines, i, mark) {
  for (let j = i - 1; j >= 0 && j >= i - 4; j--) {
    const t = lines[j].trim();
    if (t === "") break;
    if (t.startsWith(mark)) return t.replace(new RegExp(`^${mark === "#" ? "#" : "\\/\\/"}\\s?`), "").trim();
    if (t.startsWith("*") && !t.startsWith("*/")) return t.replace(/^\*+\s?/, "").trim();
    if (t.startsWith("/**")) return t.replace(/^\/\*+\s?|\*+\/\s*$/g, "").trim() || NO_DESC;
    break;
  }
  return "";
}
const docstringBelow = (lines, i) => {
  const t = (lines[i + 1] || "").trim();
  const m = t.match(/^(?:"""|''')(.*?)(?:"""|''')?$/);
  return m && m[1] ? m[1].trim() : "";
};

// ── ① 代码导出/定义 ──
const srcRows = [];
for (const dir of SCAN_DIRS) {
  for (const f of walk(join(ROOT, dir), (p) => /\.(ts|tsx|js|mjs|cjs|py)$/.test(p) && !p.endsWith(".d.ts") && !/route\.(ts|js)$/.test(p) && !isTest(p))) {
    const lines = readClean(f).split("\n");
    const group = rel(f).split("/").slice(0, 3).join("/");
    lines.forEach((line, i) => {
      const found = []; // {kind, name};一行可含多个导出(CommonJS 对象字面量)
      let m = line.match(/^export (?:async )?(function|const|class) (\w+)/);
      if (m) found.push({ kind: m[1], name: m[2] });
      else if ((m = line.match(/^(?:module\.)?exports\.(\w+)\s*=/))) found.push({ kind: "cjs", name: m[1] }); // CommonJS:exports.X = / module.exports.X =
      else if ((m = line.match(/^module\.exports\s*=\s*\{([^}]*)\}/))) {
        // CommonJS:module.exports = { X, Y: impl }(单行形态;多行对象请在各定义处补注释并改用上面两种形态之一)
        for (const part of m[1].split(",")) {
          const n = part.trim().split(":")[0].trim();
          if (/^\w+$/.test(n)) found.push({ kind: "cjs", name: n });
        }
      } else if (f.endsWith(".py")) {
        m = line.match(/^(?:async )?(def|class) (\w+)/);
        if (m && !m[2].startsWith("_")) found.push({ kind: m[1], name: m[2] });
      }
      if (!found.length) return;
      const desc = commentAbove(lines, i, f.endsWith(".py") ? "#" : "//") || (f.endsWith(".py") ? docstringBelow(lines, i) : "") || NO_DESC;
      for (const { kind, name } of found) srcRows.push({ group, name, kind, desc, loc: `${rel(f)}:${i + 1}` });
    });
  }
}

// ── ② HTTP API 路由(Next.js;非 Next 项目自动为空) ──
const apiRows = [];
for (const f of walk(join(ROOT, API_DIR), (p) => p.endsWith("route.ts") || p.endsWith("route.js"))) {
  const src = readClean(f);
  const methods = [...src.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)/g)].map((m) => m[1]);
  const route = "/" + rel(f).replace(/^app\//, "").replace(/\/route\.(ts|js)$/, "");
  const first = src.split("\n").find((l) => l.trim().startsWith("//"));
  apiRows.push({ route, methods: methods.join(" ") || "?", desc: first ? first.trim().replace(/^\/\/\s?/, "") : NO_DESC });
}

// ── ③ 独立脚本(文件级能力) ──
const scriptRows = [];
for (const dir of SCRIPT_DIRS) {
  for (const f of walk(join(ROOT, dir), (p) => /\.(mjs|cjs|js|py|sh|ts)$/.test(p) && !isTest(p))) {
    const lines = readClean(f).split("\n").slice(0, 6);
    const c = lines.find((l) => /^(\/\/|#)\s*\S/.test(l.trim()) && !l.startsWith("#!"));
    scriptRows.push({ name: rel(f), desc: c ? c.trim().replace(/^(\/\/|#)\s?/, "") : NO_DESC });
  }
}

// ── 输出 ──
const table = (rows, header, fmt) => rows.length ? `| ${header.join(" | ")} |\n|${header.map(() => "---").join("|")}|\n` + rows.map(fmt).join("\n") : "(空)";
let body = "";
for (const g of [...new Set(srcRows.map((r) => r.group))].sort()) {
  body += `\n### \`${g}\`\n\n` + table(srcRows.filter((r) => r.group === g), ["导出/定义", "说明", "位置"], (r) => `| \`${r.name}\` | ${r.desc} | ${r.loc} |`) + "\n";
}
const md = `# 能力清单(生成物,勿手改 · 动手写新功能前先来这里 grep)

> 由 \`scripts/generate-capabilities.mjs\` 从代码生成——代码即注册表,写完即注册(pre-commit / CI 以 --check 保鲜)。
> 用法:实现任何功能前,先在本页搜关键词;命中 → import/调用复用,禁止再造。
> 「${NO_DESC}」= 缺注释:碰到顺手补一行,这页同时是注释欠账仪表盘。

## HTTP API

${table(apiRows, ["路由", "方法", "说明"], (r) => `| \`${r.route}\` | ${r.methods} | ${r.desc} |`)}

## 代码导出 / 定义
${body}
## 独立脚本

${table(scriptRows, ["脚本", "说明"], (r) => `| \`${r.name}\` | ${r.desc} |`)}
`;

const OUT = join(ROOT, OUT_FILE);
if (process.argv.includes("--check")) {
  if ((existsSync(OUT) ? readFileSync(OUT, "utf8") : "") !== md) {
    console.error("[capabilities] ✗ 清单与代码不一致——跑 `node scripts/generate-capabilities.mjs` 再提交");
    process.exit(1);
  }
  console.log("[capabilities] ✓ 清单与代码一致");
} else {
  writeFileSync(OUT, md);
  console.log(`[capabilities] ✓ 已生成 ${OUT_FILE}(导出/定义 ${srcRows.length} · API ${apiRows.length} · 脚本 ${scriptRows.length})`);
}
