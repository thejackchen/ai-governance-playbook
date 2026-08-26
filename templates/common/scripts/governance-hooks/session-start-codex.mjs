#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { formatBootReadiness, issueBootAdmission } from "../lib/boot-admission.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const sessionStart = fileURLToPath(new URL("./session-start.mjs", import.meta.url));
const result = spawnSync(process.execPath, [sessionStart], {
  cwd: process.cwd(),
  encoding: "utf8"
});

const sharedMessage = `${result.stdout || ""}${result.stderr || ""}`.trim()
  || "治理状态读取失败；开始工作前检查ROADMAP.md和governance.lock.json。";
const boot = issueBootAdmission(root, { runtime: "codex", sharedMessage });
const message = `${sharedMessage}\n${formatBootReadiness(boot.readiness)}`;

process.stdout.write(JSON.stringify({
  systemMessage: message,
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: message,
  }
}));
