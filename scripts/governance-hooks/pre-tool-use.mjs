#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch {}

let policy;
try {
  policy = JSON.parse(readFileSync(join(root, "governance/policy.json"), "utf8"));
} catch (e) {
  block(`治理策略无法读取，拒绝继续: ${e.message}`);
}

const toolName = input.tool_name || input.toolName || "";
const toolInput = input.tool_input || input.toolInput || {};
const command = String(toolInput.command || toolInput.cmd || "");
const normalizedCommand = normalizeCommand(command);
const serialized = JSON.stringify(toolInput);

for (const pattern of policy.denyCommandPatterns || []) {
  const re = new RegExp(pattern, "i");
  if (re.test(command) || re.test(normalizedCommand)) block(`命令命中治理禁止模式: ${pattern}`);
}

if (/apply_patch|Edit|Write/i.test(toolName)) {
  for (const path of policy.protectedPaths || []) {
    if (serialized.includes(path)) block(`受保护路径不能由自动工具直接修改: ${path}`);
  }
}

if (/Bash/i.test(toolName)) {
  for (const path of policy.protectedPaths || []) {
    if (command.includes(path) || normalizedCommand.includes(path)) {
      block(`受保护路径不能经 Bash 重定向/写入: ${path}`);
    }
  }
}

process.exit(0);

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

// 命令归一化：剥离外层括号/首token目录前缀/包裹引号与反斜杠转义，
// 防止 /usr/bin/git、\git、(git ...)、'--hard' 等等价写法绕过 denyCommandPatterns 的 (^|\s) 锚点匹配（四维实测缺陷）。
// denyCommandPatterns 用原始串与归一化串双匹配；任一命中即block。
function normalizeCommand(raw) {
  let s = String(raw || "").trim();
  while (s.length >= 2 && s[0] === "(" && s[s.length - 1] === ")") {
    s = s.slice(1, -1).trim();
  }
  if (!s) return s;
  const tokens = s.split(/\s+/).filter(Boolean).map(stripQuotesAndEscapes);
  if (tokens.length && tokens[0].includes("/")) tokens[0] = tokens[0].split("/").pop();
  return tokens.join(" ");
}

function stripQuotesAndEscapes(token) {
  let t = token;
  if (t.length >= 2) {
    const first = t[0], last = t[t.length - 1];
    if ((first === "'" && last === "'") || (first === '"' && last === '"')) t = t.slice(1, -1);
  }
  t = t.replace(/^\\+/, "");
  return t;
}
