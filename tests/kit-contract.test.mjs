import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

test("current doctrine records every legacy concept disposition", () => {
  const audit = readFileSync(`${root}/docs/audits/v3-content-audit.md`, "utf8");
  for (const concept of [
    "治理是成本", "为消费者而生", "腐烂是默认", "单一真相", "五块地基",
    "L0-L3", "二犯", "第二次使用", "单一心跳", "能力清单", "每个session必须commit"
  ]) assert.ok(audit.includes(concept), `audit missing ${concept}`);
});

test("runtime adapters do not duplicate the common instruction template", () => {
  assert.ok(existsSync(`${root}/templates/common/INSTRUCTIONS.md`));
  for (const runtime of ["codex", "claude-code", "generic"]) {
    const adapter = JSON.parse(readFileSync(`${root}/adapters/${runtime}/adapter.json`, "utf8"));
    if (adapter.filesRoot) {
      assert.ok(!existsSync(`${root}/${adapter.filesRoot}/AGENTS.md`));
      assert.ok(!existsSync(`${root}/${adapter.filesRoot}/CLAUDE.md`));
    }
  }
});

test("Standard workflow pins third-party actions and has a real scheduled heartbeat", () => {
  for (const path of [
    `${root}/templates/standard/.github/workflows/governance.yml`,
    `${root}/templates/standard-codex/.github/workflows/governance.yml`
  ]) {
    const workflow = readFileSync(path, "utf8");
    assert.match(workflow, /schedule:/, path);
    assert.match(workflow, /heartbeat:/, path);
    assert.match(workflow, /weekly-governance-review\.mjs/, path);
    assert.ok(!/uses:\s+[^\s]+@v\d+/m.test(workflow), path);
  }
});

test("AI review cannot replace deterministic CI", () => {
  const workflow = readFileSync(`${root}/templates/standard-codex/.github/workflows/governance.yml`, "utf8");
  assert.match(workflow, /governance-verify\.mjs --ci/);
  assert.match(workflow, /continue-on-error: true/);
  assert.match(workflow, /permissions:[\s\S]*contents: read/);
});

test("Codex-only CI stowaway lives outside the shared Standard template", () => {
  assert.ok(!existsSync(`${root}/templates/standard/.github/codex`), "templates/standard 不应再含 .github/codex");
  const baseWorkflow = readFileSync(`${root}/templates/standard/.github/workflows/governance.yml`, "utf8");
  assert.ok(!/codex|openai/i.test(baseWorkflow), "base Standard workflow 不应引用 codex/openai");
  assert.ok(existsSync(`${root}/templates/standard-codex/.github/codex/prompts/governance-review.md`));
  const codexWorkflow = readFileSync(`${root}/templates/standard-codex/.github/workflows/governance.yml`, "utf8");
  assert.match(codexWorkflow, /ai-review:/);
  assert.match(codexWorkflow, /openai\/codex-action/);
});

test("external authority reports missing sources instead of inventing a loaded fact", async (t) => {
  const { inspectExtraRepoFacts } = await import("../templates/common/scripts/lib/extra-repo-facts.mjs");
  const dir = mkdtempSync(join(tmpdir(), "authority-contract-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const result = inspectExtraRepoFacts(dir);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test("PreCompact emits recoverable coordinates for temporary and durable paths", async () => {
  const { inspectPreCompact, formatPreCompactReport, isEphemeralPath } = await import("../templates/common/scripts/governance-hooks/pre-compact.mjs");
  const info = inspectPreCompact(root);
  assert.ok(info.repo);
  assert.match(formatPreCompactReport(info), /HEAD:/);
  assert.equal(isEphemeralPath("/tmp/recovery"), true);
  assert.equal(isEphemeralPath("/work/recovery"), false);
});

test("self-hosted write hook allows ordinary work without a boot permit and still blocks destructive git", () => {
  const hook = `${root}/scripts/governance.mjs`;
  const invoke = (command) => spawnSync(process.execPath, [hook, "pre-tool", "--runtime", "codex"], {
    cwd: root, encoding: "utf8", input: JSON.stringify({tool_name: "Bash", tool_input: {command}})
  });
  const allowed = invoke("git status");
  assert.equal(allowed.status, 0);
  assert.equal(allowed.stdout, "");
  const denied = invoke("cd x && /usr/bin/git reset --hard");
  assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, "deny");
  assert.match(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecisionReason, /禁止模式/);
});

test("Release governance is discoverable and covers the minimal contract", () => {
  const index = readFileSync(`${root}/docs/index.md`, "utf8");
  const release = readFileSync(`${root}/docs/release-governance.md`, "utf8");
  const template = readFileSync(`${root}/templates/common/docs/index.md`, "utf8");

  assert.match(index, /docs\/release-governance\.md/);
  for (const field of ["target", "artifact", "entrypoint", "stage", "evidence", "rollback", "receipt"]) {
    assert.match(release, new RegExp(`\\b${field}\\b`, "i"), `release contract missing ${field}`);
  }
  assert.match(release, /runtime\s+readback/i, "release contract missing runtime readback");
  assert.match(template, /本地\s+release runbook/i);
  assert.match(template, /发布面[\s\S]{0,40}建立|建立[\s\S]{0,40}发布面/);
});
