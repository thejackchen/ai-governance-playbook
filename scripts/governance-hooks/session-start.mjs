#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

const result = spawnSync(process.execPath, [new URL("../governance-status.mjs", import.meta.url).pathname], {
  cwd: root,
  encoding: "utf8"
});
if (result.status === 0) process.stdout.write(result.stdout);
else process.stdout.write("治理状态读取失败；开始工作前检查ROADMAP.md和governance.lock.json。\n");
