#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function git(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return {
    status: result.status,
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim(),
  };
}

export function isEphemeralPath(input) {
  const normalized = resolve(input).replaceAll("\\", "/");
  return (
    normalized === "/tmp"
    || normalized.startsWith("/tmp/")
    || normalized === "/private/tmp"
    || normalized.startsWith("/private/tmp/")
    || /\/var\/folders\//.test(normalized)
  );
}

export function inspectPreCompact(cwd = process.cwd()) {
  const top = git(["rev-parse", "--show-toplevel"], cwd);
  const repo = top.status === 0 ? top.stdout : null;
  const branch = repo ? git(["rev-parse", "--abbrev-ref", "HEAD"], repo).stdout : "";
  const head = repo ? git(["log", "-1", "--format=%h %s"], repo).stdout : "";
  const dirty = repo ? git(["status", "--porcelain"], repo).stdout : "";
  const dirtyFiles = dirty ? dirty.split("\n").filter(Boolean) : [];
  return {
    cwd: resolve(cwd),
    repo,
    branch: branch || "DETACHED",
    head: head || "unknown",
    dirty: dirtyFiles.length > 0,
    dirtyCount: dirtyFiles.length,
    ephemeral: isEphemeralPath(cwd) || (repo ? isEphemeralPath(repo) : false),
  };
}

export function formatPreCompactReport(info) {
  const warnings = [];
  if (info.ephemeral) warnings.push("当前目录在临时盘(/tmp)，重启会丢");
  if (!info.repo) warnings.push("不在 git 仓库");
  else if (info.dirty) warnings.push(`工作区不干净(${info.dirtyCount} 项)，未提交内容压缩后只剩记忆`);
  return [
    "📍 压缩前坐标（只检查+注入；不自动提交、不回收 worktree、不阻断压缩）",
    `目录: ${info.cwd}`,
    `分支: ${info.branch}`,
    `HEAD: ${info.head}`,
    "下一步: 压缩后先读这四行，不要从聊天记忆猜路径",
    `警告: ${warnings.length ? warnings.join("；") : "无"}`,
  ].join("\n");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  process.stdout.write(`${formatPreCompactReport(inspectPreCompact())}\n`);
}
