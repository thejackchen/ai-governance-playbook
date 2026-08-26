#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const sessionStart = fileURLToPath(new URL("./session-start-admission.mjs", import.meta.url));
const childEnv = { ...process.env };
if (childEnv.NO_COLOR && childEnv.FORCE_COLOR) delete childEnv.NO_COLOR;
const result = spawnSync(process.execPath, [sessionStart], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: childEnv,
});

const message = `${result.stdout || ""}${result.stderr || ""}`.trim()
  || "治理状态读取失败；开始工作前检查ROADMAP.md和governance.lock.json。";

process.stdout.write(JSON.stringify({
  systemMessage: message,
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: message,
  }
}));
