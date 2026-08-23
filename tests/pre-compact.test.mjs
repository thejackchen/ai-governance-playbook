import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { formatPreCompactReport, inspectPreCompact, isEphemeralPath } from "../scripts/governance-hooks/pre-compact.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = join(root, "scripts/governance-hooks/pre-compact.mjs");
const codexScript = join(root, "scripts/governance-hooks/pre-compact-codex.mjs");

function gitRepo() {
  const dir = mkdtempSync(join(tmpdir(), "pre-compact-"));
  const git = (args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git(["init", "-q"]);
  git(["checkout", "-q", "-b", "main"]);
  writeFileSync(join(dir, "README.md"), "demo\n");
  git(["add", "README.md"]);
  spawnSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "init"], { cwd: dir });
  return dir;
}

test("flags /tmp as ephemeral and dirty worktrees as unsafe to forget", () => {
  assert.equal(isEphemeralPath("/tmp/aios-wcs-control-poc"), true);
  assert.equal(isEphemeralPath("/private/tmp/work"), true);
  const dir = gitRepo();
  const clean = inspectPreCompact(dir);
  assert.equal(clean.dirty, false);
  writeFileSync(join(dir, "scratch.txt"), "not committed\n");
  const dirty = inspectPreCompact(dir);
  assert.equal(dirty.dirty, true);
  const report = formatPreCompactReport(dirty);
  assert.match(report, /目录:/);
  assert.match(report, /分支:/);
  assert.match(report, /HEAD:/);
  assert.match(report, /不干净/);
  assert.match(formatPreCompactReport(inspectPreCompact("/tmp/aios-wcs-control-poc")), /临时盘/);
  assert.doesNotMatch(report, /git commit/);
});

test("CLI prints coordinates and Codex wrapper returns JSON context", () => {
  const dir = gitRepo();
  const text = spawnSync(process.execPath, [script], { cwd: dir, encoding: "utf8" });
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /压缩前坐标/);
  assert.doesNotMatch(text.stdout, /git commit/);
  const json = spawnSync(process.execPath, [codexScript], { cwd: dir, encoding: "utf8" });
  assert.equal(json.status, 0, json.stderr);
  const payload = JSON.parse(json.stdout);
  assert.match(payload.systemMessage, /压缩前坐标/);
  assert.equal(payload.hookSpecificOutput.hookEventName, "PreCompact");
  assert.equal(payload.hookSpecificOutput.additionalContext, payload.systemMessage);
});
