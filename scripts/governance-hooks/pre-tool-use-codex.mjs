#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateBootAdmission } from "../lib/boot-admission.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const sharedHook = fileURLToPath(new URL("./pre-tool-use.mjs", import.meta.url));
const raw = readFileSync(0, "utf8") || "{}";
let input = {};
try { input = JSON.parse(raw); } catch {}
const toolName = String(input.tool_name || input.toolName || "");
const isDirectWrite = /^(?:apply_patch|Edit|Write|MultiEdit|search_replace)$/i.test(toolName);
const toolInput = input.tool_input || input.toolInput || {};
const command = String(toolInput.command || toolInput.cmd || "");
const isShell = /^(?:Bash|run_terminal_command)$/i.test(toolName);
const needsAdmission = isDirectWrite || (isShell && !isDiagnosticShell(command));

if (needsAdmission) {
  const admission = validateBootAdmission(root, { runtime: "codex" });
  if (!admission.ok) {
    process.stdout.write(JSON.stringify({
      decision: "block",
      reason: `开机自检门拦截：${admission.reason}。请重新开始会话并确认出现“✅ 开机自检”后再写文件。`,
    }));
    process.exit(0);
  }
}

const result = spawnSync(process.execPath, [sharedHook], {
  cwd: process.cwd(),
  input: raw,
  encoding: "utf8",
});
process.stdout.write(`${result.stdout || ""}${result.stderr || ""}`);
process.exit(result.status ?? 0);

function isDiagnosticShell(raw) {
  const command = String(raw || "").trim();
  if (!command) return true;
  if (/(?:^|[^<])(?:>>?|<<?)|\b(?:tee|touch|mkdir|rm|cp|mv|install|chmod|chown|ln|truncate|dd|patch|apply_patch)\b/i.test(command)) {
    return false;
  }
  const segments = command.split(/(?:\|\||&&|[;|&\n])+/).map((part) => part.trim()).filter(Boolean);
  return segments.every((segment) => {
    const text = segment.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*/, "");
    if (/^cd\s+\S+(?:\s|$)/.test(text)) return true;
    if (/^(?:pwd|ls|find|rg|grep|cat|head|tail|wc|stat|file|jq|type|which|whereis|realpath|basename|dirname|printf|echo)\b/.test(text)) return true;
    if (/^(?:\/usr\/bin\/)?git\b/.test(text)) {
      return /\s(?:status|diff|log|show|rev-parse|rev-list|merge-base|ls-files|fetch)(?:\s|$)/.test(text)
        || /\sremote\s+(?:-v|get-url)(?:\s|$)/.test(text);
    }
    if (/^(?:npm|pnpm|yarn)\s+(?:test|run\s+(?:check|test|lint|typecheck|verify))(?:\s|$)/.test(text)) return true;
    if (/^node\s+(?:--check|--test)(?:\s|$)/.test(text)) return true;
    if (/^node\s+\S*(?:doctor|governance-(?:verify|status|lint))\.mjs(?:\s|$)/.test(text)) return true;
    return false;
  });
}
