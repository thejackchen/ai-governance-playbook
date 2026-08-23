import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareVersions } from "../scripts/lib.mjs";
import {
  applySafeAdditions,
  checkAndMaybeUpgrade,
  formatUpdateReport,
  patchPreCompactHooks,
  planSafeAdditions,
} from "../scripts/lib/playbook-update.mjs";

function project(version = "3.4.0") {
  const dir = mkdtempSync(join(tmpdir(), "playbook-update-"));
  writeFileSync(join(dir, "governance.lock.json"), `${JSON.stringify({
    schemaVersion: 1,
    playbookVersion: version,
    kitFingerprint: "sha256:old",
    runtime: "generic",
    profile: "lite",
    installedFiles: ["AGENTS.md"],
  }, null, 2)}\n`);
  mkdirSync(join(dir, "governance"), { recursive: true });
  writeFileSync(join(dir, "governance/policy.json"), `${JSON.stringify({
    playbookUpdate: { check: "session-start", apply: "safe", cacheSeconds: 1 },
  }, null, 2)}\n`);
  return dir;
}

test("compareVersions orders x.y.z", () => {
  assert.equal(compareVersions("3.4.2", "3.4.0"), 1);
  assert.equal(compareVersions("3.4.0", "3.4.2"), -1);
  assert.equal(compareVersions("3.4.2", "3.4.2"), 0);
});

test("safe additions never overwrite an existing file", () => {
  const dir = project();
  mkdirSync(join(dir, "docs/ops"), { recursive: true });
  writeFileSync(join(dir, "docs/ops/extra-repo-facts.json"), "{\"schemaVersion\":1,\"facts\":[\"keep-me\"]}\n");
  const { added } = applySafeAdditions(dir);
  assert.equal(readFileSync(join(dir, "docs/ops/extra-repo-facts.json"), "utf8").includes("keep-me"), true);
  assert.equal(added.includes("docs/ops/extra-repo-facts.json"), false);
  assert.ok(planSafeAdditions(dir).some((item) => item.relativePath === "docs/ops/extra-repo-facts.json" && item.action === "skip"));
});

test("safe upgrade adds missing carriers and bumps lock to kit version", async () => {
  const dir = project("3.4.0");
  const result = await checkAndMaybeUpgrade(dir, {
    skipCache: true,
    remote: { ok: true, version: "3.4.3" },
    apply: "safe",
  });
  assert.equal(result.status, "behind");
  assert.ok(result.added.includes("docs/ops/extra-repo-facts.json"));
  assert.ok(result.added.includes("scripts/governance-hooks/pre-compact.mjs"));
  const lock = JSON.parse(readFileSync(join(dir, "governance.lock.json"), "utf8"));
  assert.equal(lock.playbookVersion, "3.4.3");
  assert.match(lock.kitFingerprint, /^sha256:/);
  assert.ok(lock.installedFiles.includes("docs/ops/extra-repo-facts.json"));
  assert.ok(lock.installedFiles.includes("AGENTS.md"));
});

test("does not lock-upgrade to an unpublished local kit ahead of GitHub", async () => {
  const dir = project("3.4.0");
  const result = await checkAndMaybeUpgrade(dir, {
    skipCache: true,
    remote: { ok: true, version: "3.4.0" },
    apply: "safe",
  });
  assert.equal(result.status, "unpublished-local");
  const lock = JSON.parse(readFileSync(join(dir, "governance.lock.json"), "utf8"));
  assert.equal(lock.playbookVersion, "3.4.0");
  assert.match(formatUpdateReport(result), /未发布/);
});

test("notify mode reports available and does not write", async () => {
  const dir = project("3.4.0");
  const result = await checkAndMaybeUpgrade(dir, {
    skipCache: true,
    remote: { ok: true, version: "3.4.3" },
    apply: "notify",
  });
  assert.equal(result.status, "available");
  const lock = JSON.parse(readFileSync(join(dir, "governance.lock.json"), "utf8"));
  assert.equal(lock.playbookVersion, "3.4.0");
});

test("upgrade patches missing PreCompact and replaces echo without touching other events", async () => {
  const dir = project("3.4.0");
  mkdirSync(join(dir, ".codex"), { recursive: true });
  mkdirSync(join(dir, ".claude"), { recursive: true });
  writeFileSync(join(dir, ".codex/hooks.json"), `${JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "keep-session-start" }] }],
      PreToolUse: [{ hooks: [{ type: "command", command: "keep-pre-tool" }] }],
      Stop: [{ hooks: [{ type: "command", command: "keep-stop" }] }],
    },
  }, null, 2)}\n`);
  writeFileSync(join(dir, ".claude/settings.json"), `${JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "keep-claude-start" }] }],
      PreCompact: [{ hooks: [{ type: "command", command: "echo leftover" }] }],
    },
  }, null, 2)}\n`);
  const result = await checkAndMaybeUpgrade(dir, {
    skipCache: true,
    remote: { ok: true, version: "3.4.3" },
    apply: "safe",
  });
  const codex = JSON.parse(readFileSync(join(dir, ".codex/hooks.json"), "utf8"));
  const claude = JSON.parse(readFileSync(join(dir, ".claude/settings.json"), "utf8"));
  assert.equal(codex.hooks.SessionStart[0].hooks[0].command, "keep-session-start");
  assert.equal(codex.hooks.Stop[0].hooks[0].command, "keep-stop");
  assert.match(codex.hooks.PreCompact[0].hooks[0].command, /pre-compact-codex\.mjs/);
  assert.match(claude.hooks.PreCompact[0].hooks[0].command, /pre-compact\.mjs/);
  assert.equal(/echo/.test(claude.hooks.PreCompact[0].hooks[0].command), false);
  assert.ok(result.patched.includes(".codex/hooks.json"));
  assert.ok(result.patched.includes(".claude/settings.json"));
  const again = patchPreCompactHooks(dir);
  assert.deepEqual(again, []);
});
