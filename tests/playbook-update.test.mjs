import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareVersions, fingerprintKit } from "../scripts/lib.mjs";
import {
  applySafeAdditions,
  checkAndMaybeUpgrade,
  formatUpdateReport,
  patchPreCompactHooks,
  patchCodexRuntimeHooks,
  patchSharedRuntimeHooks,
  planSafeAdditions,
} from "../scripts/lib/playbook-update.mjs";

const kitVersion = readFileSync(new URL("../VERSION", import.meta.url), "utf8").trim();

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
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "scripts/governance-verify.mjs"), "#!/usr/bin/env node\nprocess.exit(0);\n");
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
    remote: { ok: true, version: kitVersion },
    apply: "safe",
  });
  assert.equal(result.status, "restart-required");
  assert.ok(result.added.includes("docs/ops/extra-repo-facts.json"));
  assert.ok(result.added.includes("scripts/governance-hooks/pre-compact.mjs"));
  const lock = JSON.parse(readFileSync(join(dir, "governance.lock.json"), "utf8"));
  assert.equal(lock.playbookVersion, kitVersion);
  assert.equal(lock.adaptation.deterministicStatus, "restart_required");
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
    remote: { ok: true, version: kitVersion },
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
      SessionStart: [{ hooks: [{ type: "command", command: "node scripts/governance-hooks/session-start-codex.mjs" }] }],
      PreToolUse: [{ hooks: [{ type: "command", command: "node scripts/governance-hooks/pre-tool-use-codex.mjs" }] }],
      Stop: [{ hooks: [{ type: "command", command: "keep-stop" }] }],
    },
  }, null, 2)}\n`);
  writeFileSync(join(dir, ".claude/settings.json"), `${JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "node scripts/governance-hooks/session-start.mjs" }] }],
      PreToolUse: [{ hooks: [{ type: "command", command: "node scripts/governance-hooks/pre-tool-use.mjs" }] }],
      Stop: [{ hooks: [{ type: "command", command: "keep-claude-stop" }] }],
      PreCompact: [{ hooks: [{ type: "command", command: "echo leftover" }] }],
    },
  }, null, 2)}\n`);
  const result = await checkAndMaybeUpgrade(dir, {
    skipCache: true,
    remote: { ok: true, version: kitVersion },
    apply: "safe",
  });
  const codex = JSON.parse(readFileSync(join(dir, ".codex/hooks.json"), "utf8"));
  const claude = JSON.parse(readFileSync(join(dir, ".claude/settings.json"), "utf8"));
  assert.match(codex.hooks.SessionStart[0].hooks[0].command, /session-start-codex\.mjs/);
  assert.equal(codex.hooks.Stop[0].hooks[0].command, "keep-stop");
  assert.match(codex.hooks.PreCompact[0].hooks[0].command, /pre-compact-codex\.mjs/);
  assert.match(claude.hooks.PreCompact[0].hooks[0].command, /pre-compact\.mjs/);
  assert.match(claude.hooks.SessionStart[0].hooks[0].command, /session-start-admission\.mjs/);
  assert.match(claude.hooks.PreToolUse[0].hooks[0].command, /pre-tool-use-admission\.mjs/);
  assert.equal(claude.hooks.Stop[0].hooks[0].command, "keep-claude-stop");
  assert.equal(/echo/.test(claude.hooks.PreCompact[0].hooks[0].command), false);
  assert.ok(result.patched.includes(".codex/hooks.json"));
  assert.ok(result.patched.includes(".claude/settings.json"));
  const again = patchPreCompactHooks(dir);
  assert.deepEqual(again, []);
});

test("unknown shared runtime customization is preserved and blocks adaptation atomically", async () => {
  const dir = project(kitVersion);
  mkdirSync(join(dir, ".claude"), { recursive: true });
  mkdirSync(join(dir, ".codex"), { recursive: true });
  const claudePath = join(dir, ".claude/settings.json");
  const codexPath = join(dir, ".codex/hooks.json");
  const claudeOriginal = `${JSON.stringify({ hooks: {
    SessionStart: [{ hooks: [{ type: "command", command: "node custom/start.mjs" }] }],
    PreToolUse: [{ hooks: [{ type: "command", command: "node custom/gate.mjs" }] }],
  } }, null, 2)}\n`;
  const codexOriginal = `${JSON.stringify({ hooks: {
    SessionStart: [{ hooks: [{ type: "command", command: "node scripts/governance-hooks/session-start.mjs" }] }],
    PreToolUse: [{ hooks: [{ type: "command", command: "node scripts/governance-hooks/pre-tool-use.mjs" }] }],
  } }, null, 2)}\n`;
  writeFileSync(claudePath, claudeOriginal);
  writeFileSync(codexPath, codexOriginal);
  assert.equal(patchSharedRuntimeHooks(dir, { write: false }).conflicts.length, 2);

  const result = await checkAndMaybeUpgrade(dir, {
    skipCache: true,
    remote: { ok: true, version: kitVersion },
    apply: "safe",
  });
  assert.equal(result.status, "needs-adaptation");
  assert.equal(readFileSync(claudePath, "utf8"), claudeOriginal);
  assert.equal(readFileSync(codexPath, "utf8"), codexOriginal);
  assert.deepEqual(result.updated, []);
  assert.deepEqual(result.patched, []);
});

test("current version still repairs known legacy Codex wiring", async () => {
  const dir = project(kitVersion);
  mkdirSync(join(dir, ".codex"), { recursive: true });
  writeFileSync(join(dir, ".codex/hooks.json"), `${JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "node scripts/governance-hooks/session-start.mjs" }] }],
      PreToolUse: [{ hooks: [{ type: "command", command: "node scripts/governance-hooks/pre-tool-use.mjs" }] }],
    },
  }, null, 2)}\n`);
  const result = await checkAndMaybeUpgrade(dir, {
    skipCache: true,
    remote: { ok: true, version: kitVersion },
    apply: "safe",
  });
  assert.equal(result.status, "restart-required");
  const codex = JSON.parse(readFileSync(join(dir, ".codex/hooks.json"), "utf8"));
  assert.match(codex.hooks.SessionStart[0].hooks[0].command, /session-start-codex\.mjs/);
  assert.match(codex.hooks.PreToolUse[0].hooks[0].command, /pre-tool-use-codex\.mjs/);
  assert.ok(result.patched.includes(".codex/hooks.json"));
});

test("offline current version repairs wiring only from the lock-verified local kit", async () => {
  const dir = project(kitVersion);
  const lockPath = join(dir, "governance.lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.kitFingerprint = fingerprintKit();
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  mkdirSync(join(dir, ".codex"), { recursive: true });
  writeFileSync(join(dir, ".codex/hooks.json"), `${JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "node scripts/governance-hooks/session-start.mjs" }] }],
      PreToolUse: [{ hooks: [{ type: "command", command: "node scripts/governance-hooks/pre-tool-use.mjs" }] }],
    },
  }, null, 2)}\n`);
  const result = await checkAndMaybeUpgrade(dir, {
    skipCache: true,
    remote: { ok: false, version: null, error: "offline" },
    apply: "safe",
  });
  assert.equal(result.status, "restart-required");
  const codex = JSON.parse(readFileSync(join(dir, ".codex/hooks.json"), "utf8"));
  assert.match(codex.hooks.SessionStart[0].hooks[0].command, /session-start-codex\.mjs/);
  assert.match(codex.hooks.PreToolUse[0].hooks[0].command, /pre-tool-use-codex\.mjs/);
});

test("offline does not adopt an unverified local kit", async () => {
  const dir = project(kitVersion);
  const result = await checkAndMaybeUpgrade(dir, {
    skipCache: true,
    remote: { ok: false, version: null, error: "offline" },
    apply: "safe",
  });
  assert.equal(result.status, "offline");
});

test("unknown Codex hook customization is not overwritten and needs human adaptation", () => {
  const dir = project(kitVersion);
  mkdirSync(join(dir, ".codex"), { recursive: true });
  writeFileSync(join(dir, ".codex/hooks.json"), `${JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "node custom/start.mjs" }] }],
      PreToolUse: [{ hooks: [{ type: "command", command: "node custom/gate.mjs" }] }],
    },
  }, null, 2)}\n`);
  const result = patchCodexRuntimeHooks(dir);
  assert.deepEqual(result.patched, []);
  assert.equal(result.conflicts.length, 2);
  const codex = JSON.parse(readFileSync(join(dir, ".codex/hooks.json"), "utf8"));
  assert.equal(codex.hooks.SessionStart[0].hooks[0].command, "node custom/start.mjs");
  assert.equal(codex.hooks.PreToolUse[0].hooks[0].command, "node custom/gate.mjs");
});

test("unknown Codex customization stops the whole adaptation without partial writes", async () => {
  const dir = project(kitVersion);
  mkdirSync(join(dir, ".codex"), { recursive: true });
  const hooksPath = join(dir, ".codex/hooks.json");
  const original = `${JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "node custom/start.mjs" }] }],
      PreToolUse: [{ hooks: [{ type: "command", command: "node scripts/governance-hooks/pre-tool-use.mjs" }] }],
    },
  }, null, 2)}\n`;
  writeFileSync(hooksPath, original);
  const result = await checkAndMaybeUpgrade(dir, {
    skipCache: true,
    remote: { ok: true, version: kitVersion },
    apply: "safe",
  });
  assert.equal(result.status, "needs-adaptation");
  assert.equal(readFileSync(hooksPath, "utf8"), original);
  assert.deepEqual(result.updated, []);
  assert.deepEqual(result.patched, []);
  const lock = JSON.parse(readFileSync(join(dir, "governance.lock.json"), "utf8"));
  assert.equal(lock.adaptation.deterministicStatus, "needs_human_decision");
});

test("a second SessionStart finalizes restart_required only after project validation passes", async () => {
  const dir = project(kitVersion);
  mkdirSync(join(dir, ".codex"), { recursive: true });
  writeFileSync(join(dir, ".codex/hooks.json"), `${JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "node scripts/governance-hooks/session-start.mjs" }] }],
      PreToolUse: [{ hooks: [{ type: "command", command: "node scripts/governance-hooks/pre-tool-use.mjs" }] }],
    },
  }, null, 2)}\n`);
  const first = await checkAndMaybeUpgrade(dir, {
    skipCache: true,
    remote: { ok: true, version: kitVersion },
    apply: "safe",
  });
  assert.equal(first.status, "restart-required");
  assert.equal(JSON.parse(readFileSync(join(dir, "governance.lock.json"), "utf8")).adaptation.deterministicStatus, "restart_required");

  const second = await checkAndMaybeUpgrade(dir, {
    skipCache: true,
    remote: { ok: true, version: kitVersion },
    apply: "safe",
  });
  assert.equal(second.status, "repaired-current");
  assert.match(formatUpdateReport(second), /重启后项目复验/);
  assert.equal(JSON.parse(readFileSync(join(dir, "governance.lock.json"), "utf8")).adaptation.deterministicStatus, "pass");
});

test("project validation failure revokes adaptation pass instead of bumping the lock", async () => {
  const dir = project(kitVersion);
  writeFileSync(join(dir, "scripts/governance-verify.mjs"), "#!/usr/bin/env node\nprocess.exit(7);\n");
  const result = await checkAndMaybeUpgrade(dir, {
    skipCache: true,
    remote: { ok: true, version: kitVersion },
    apply: "safe",
  });
  assert.equal(result.status, "needs-adaptation");
  const lock = JSON.parse(readFileSync(join(dir, "governance.lock.json"), "utf8"));
  assert.equal(lock.adaptation.deterministicStatus, "failed");
});
