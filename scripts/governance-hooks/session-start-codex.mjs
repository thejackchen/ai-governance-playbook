#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const sessionStart = fileURLToPath(new URL("./session-start.mjs", import.meta.url));
const result = spawnSync(process.execPath, [sessionStart], {
  cwd: process.cwd(),
  encoding: "utf8"
});

const sharedMessage = `${result.stdout || ""}${result.stderr || ""}`.trim()
  || "治理状态读取失败；开始工作前检查ROADMAP.md和governance.lock.json。";

process.stdout.write(JSON.stringify({
  systemMessage: sharedMessage,
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: sharedMessage,
  }
}));
