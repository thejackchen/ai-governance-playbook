#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { formatBootReadiness, issueBootAdmission } from "../lib/boot-admission.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const sharedSessionStart = fileURLToPath(new URL("./session-start.mjs", import.meta.url));
const childEnv = { ...process.env };
if (childEnv.NO_COLOR && childEnv.FORCE_COLOR) delete childEnv.NO_COLOR;
const result = spawnSync(process.execPath, [sharedSessionStart], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: childEnv,
});

const sharedMessage = `${result.stdout || ""}${result.stderr || ""}`.trim()
  || "治理状态读取失败；开始工作前检查 ROADMAP.md 和 governance.lock.json。";
const boot = issueBootAdmission(root, { runtime: "universal", sharedMessage });
process.stdout.write(`${sharedMessage}\n${formatBootReadiness(boot.readiness)}`);
