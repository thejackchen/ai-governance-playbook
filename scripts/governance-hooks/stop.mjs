#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch {}

const result = spawnSync(process.execPath, [new URL("../governance-verify.mjs", import.meta.url).pathname], {
  cwd: root,
  encoding: "utf8"
});

if (result.status === 0) {
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

const detail = `${result.stdout || ""}\n${result.stderr || ""}`.trim().slice(-4000);
if (input.stop_hook_active) {
  process.stdout.write(JSON.stringify({
    continue: true,
    systemMessage: `治理验证仍未通过，必须在最终报告中如实说明：\n${detail}`
  }));
} else {
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: `治理验证失败，请修复后再结束：\n${detail}`
  }));
}
