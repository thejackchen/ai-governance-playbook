#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const DEFAULT_REMOTE = "https://github.com/thejackchen/ai-governance-playbook.git";
const DEFAULT_DIR = join(homedir(), "working", "ai-governance-playbook");

const { forwardedArgs, remoteOverride } = parseBootstrapArgs(process.argv.slice(2));
const playbookDir = resolve(process.env.GOVERNANCE_PLAYBOOK_DIR || DEFAULT_DIR);
const remote = remoteOverride || process.env.GOVERNANCE_PLAYBOOK_REMOTE || DEFAULT_REMOTE;

ensureGit();
ensurePlaybookCheckout(playbookDir, remote);

const initScript = join(playbookDir, "scripts", "init.mjs");
if (!existsSync(initScript)) fail(`playbook checkout 缺少 scripts/init.mjs: ${playbookDir}`);

const initArgs = [...forwardedArgs];
if (!initArgs.some((argument) => argument === "--profile" || argument.startsWith("--profile="))) {
  initArgs.push("--profile", "standard");
}

const result = spawnSync(process.execPath, [initScript, ...initArgs], {
  cwd: playbookDir,
  stdio: "inherit",
});
if (result.error) fail(`无法调用 init.mjs: ${result.error.message}`);
process.exit(result.status ?? 1);

function parseBootstrapArgs(argv) {
  const forwardedArgs = [];
  let remoteOverride = "";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--remote") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail("--remote 必须跟一个 Git remote 地址");
      remoteOverride = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--remote=")) {
      remoteOverride = argument.slice("--remote=".length);
      if (!remoteOverride) fail("--remote= 不能为空");
      continue;
    }
    forwardedArgs.push(argument);
  }
  return { forwardedArgs, remoteOverride };
}

function ensureGit() {
  const result = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (result.error) fail(`找不到 git：${result.error.message}。请先把 git 加入 PATH。`);
  if (result.status !== 0) fail(`git 不可用：${String(result.stderr || result.stdout || "").trim()}`);
}

function ensurePlaybookCheckout(dir, remoteUrl) {
  if (existsSync(dir)) {
    let isDirectory = false;
    try { isDirectory = statSync(dir).isDirectory(); } catch (cause) { fail(`无法读取 GOVERNANCE_PLAYBOOK_DIR=${dir}：${cause.message}`); }
    if (!isDirectory) fail(`GOVERNANCE_PLAYBOOK_DIR 不是目录：${dir}`);
    if (!isValidPlaybookCheckout(dir)) {
      fail(`GOVERNANCE_PLAYBOOK_DIR 已存在但不是合法 playbook checkout：${dir}。请改用另一个目录或先由负责人处理该目录，bootstrap 不会覆盖现有内容。`);
    }
    runGit(["-C", dir, "pull", "--ff-only"], `更新 playbook：${dir}`);
    return;
  }

  try { mkdirSync(dirname(dir), { recursive: true }); } catch (cause) {
    fail(`无法创建 playbook 父目录 ${dirname(dir)}：${cause.message}`);
  }
  runGit(["clone", remoteUrl, dir], `克隆 playbook：${remoteUrl} -> ${dir}`);
}

function isValidPlaybookCheckout(dir) {
  const packagePath = join(dir, "package.json");
  const markerFiles = existsSync(join(dir, "CORE.md")) && existsSync(packagePath);
  if (markerFiles) {
    try {
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
      if (packageJson.name === "ai-governance-playbook") return true;
    } catch {}
  }
  const result = spawnSync("git", ["-C", dir, "remote", "get-url", "origin"], { encoding: "utf8" });
  return result.status === 0 && /ai-governance-playbook/i.test(String(result.stdout || ""));
}

function runGit(args, label) {
  const result = spawnSync("git", args, { encoding: "utf8", stdio: "inherit" });
  if (result.error) fail(`${label}失败：${result.error.message}`);
  if (result.status !== 0) fail(`${label}失败（git ${args.join(" ")}，exit=${result.status}）。请检查 remote、网络和工作树状态。`);
}

function fail(message) {
  console.error(`[gov-bootstrap] ERROR ${message}`);
  process.exit(1);
}
