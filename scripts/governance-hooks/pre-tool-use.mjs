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
const serialized = JSON.stringify(toolInput);

for (const pattern of policy.denyCommandPatterns || []) {
  if (new RegExp(pattern, "i").test(command)) block(`命令命中治理禁止模式: ${pattern}`);
}

if (/apply_patch|Edit|Write/i.test(toolName)) {
  for (const path of policy.protectedPaths || []) {
    if (serialized.includes(path)) block(`受保护路径不能由自动工具直接修改: ${path}`);
  }
}

process.exit(0);

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}
