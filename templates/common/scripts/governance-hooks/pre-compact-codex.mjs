#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const preCompact = fileURLToPath(new URL("./pre-compact.mjs", import.meta.url));
const result = spawnSync(process.execPath, [preCompact], {
  cwd: process.cwd(),
  encoding: "utf8",
});

const sharedMessage = `${result.stdout || ""}${result.stderr || ""}`.trim()
  || "压缩前坐标读取失败；压缩后先核对目录、分支和 HEAD，不要从聊天记忆猜路径。";

process.stdout.write(JSON.stringify({
  systemMessage: sharedMessage,
  hookSpecificOutput: {
    hookEventName: "PreCompact",
    additionalContext: sharedMessage,
  },
}));
