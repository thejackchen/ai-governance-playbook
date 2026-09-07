import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  applyDiscoveryUpgrade,
  DISCOVERY_FILES,
  formatDiscoveryUpgradeReport,
  planDiscoveryUpgrade,
  validateProject,
} from "../scripts/lib/discovery-upgrade.mjs";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const run = (command, args, cwd, input) => spawnSync(command, args, {
  cwd,
  input,
  encoding: "utf8",
  env: { ...process.env },
});

function commitAll(dir, message = "fixture") {
  assert.equal(run("git", ["add", "."], dir).status, 0);
  assert.equal(
    run("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", "commit", "-qm", message], dir).status,
    0,
  );
}

function publishRef(dir) {
  const head = run("git", ["rev-parse", "HEAD"], dir).stdout.trim();
  assert.match(head, /^[0-9a-f]{40}$/);
  assert.equal(run("git", ["update-ref", "refs/remotes/origin/main", head], dir).status, 0);
}

function fixtureDir(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function gitProject(t, verifier = "process.exit(0);") {
  const dir = fixtureDir(t, "discovery-project-");
  assert.equal(run("git", ["init", "-q"], dir).status, 0);
  mkdirSync(join(dir, "governance"), { recursive: true });
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "governance.lock.json"), `${JSON.stringify({
    schemaVersion: 1,
    playbookVersion: "4.0.1",
    kitFingerprint: "sha256:base",
    runtime: "generic",
    profile: "lite",
    adaptation: { schemaVersion: 1, sourceVersion: "4.0.1", deterministicStatus: "pass", projectFacts: "preserved" },
    installedFiles: ["AGENTS.md"],
  }, null, 2)}\n`);
  writeFileSync(join(dir, "governance/policy.json"), "{\"playbookUpdate\":{\"check\":\"manual\",\"apply\":\"notify\"}}\n");
  writeFileSync(join(dir, "scripts/governance-verify.mjs"), `#!/usr/bin/env node\n${verifier}\n`);
  commitAll(dir);
  return dir;
}

function gitKit(t) {
  const dir = fixtureDir(t, "discovery-kit-");
  assert.equal(run("git", ["init", "-q"], dir).status, 0);
  writeFileSync(join(dir, "VERSION"), "4.2.0\n");
  writeFileSync(join(dir, "package.json"), "{\"name\":\"ai-governance-playbook\",\"version\":\"4.2.0\",\"type\":\"module\"}\n");
  for (const relativePath of DISCOVERY_FILES) {
    const path = join(dir, "templates/common", relativePath);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, `// discovery fixture: ${relativePath}\nexport const fixture = ${JSON.stringify(relativePath)};\n`);
  }
  commitAll(dir, "kit source");
  publishRef(dir);
  return dir;
}

function gitRefs(dir) {
  const result = run("git", ["for-each-ref", "--format=%(refname) %(objectname)"], dir);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function gitRemotes(dir) {
  const result = run("git", ["remote", "-v"], dir);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test("default and legacy --write are read-only until a capability is named", (t) => {
  const project = gitProject(t);
  const before = readFileSync(join(project, "governance.lock.json"));
  const defaultResult = run(process.execPath, [join(root, "scripts/upgrade.mjs"), "--target", project], root);
  assert.equal(defaultResult.status, 0);
  assert.match(defaultResult.stdout + defaultResult.stderr, /只读计划/);
  assert.deepEqual(readFileSync(join(project, "governance.lock.json")), before);
  assert.deepEqual(run("git", ["status", "--porcelain"], project).stdout, "");

  const legacyResult = run(process.execPath, [join(root, "scripts/upgrade.mjs"), "--target", project, "--write"], root);
  assert.notEqual(legacyResult.status, 0);
  assert.match(legacyResult.stdout + legacyResult.stderr, /capability discovery|显式选择能力/);
  assert.deepEqual(readFileSync(join(project, "governance.lock.json")), before);
  assert.deepEqual(run("git", ["status", "--porcelain"], project).stdout, "");
  for (const file of DISCOVERY_FILES) assert.equal(existsSync(join(project, file)), false, file);
});

test("unknown CLI arguments are rejected before an explicit write", (t) => {
  const project = gitProject(t);
  const beforeLock = readFileSync(join(project, "governance.lock.json"));
  const result = run(process.execPath, [
    join(root, "scripts/upgrade.mjs"),
    "--target", project,
    "--capability", "discovery",
    "--write",
    "--force",
  ], root);
  assert.equal(result.status, 2);
  assert.match(result.stdout + result.stderr, /不支持参数.*force/);
  assert.deepEqual(readFileSync(join(project, "governance.lock.json")), beforeLock);
  assert.equal(run("git", ["status", "--porcelain"], project).stdout, "");
  for (const file of DISCOVERY_FILES) assert.equal(existsSync(join(project, file)), false, file);
});

test("discovery capability applies only with explicit write and preserves base lock/policy", async (t) => {
  const project = gitProject(t);
  const kit = gitKit(t);
  const beforeLock = JSON.parse(readFileSync(join(project, "governance.lock.json"), "utf8"));
  const plan = planDiscoveryUpgrade(project, { kitRoot: kit });
  assert.equal(plan.status, "plan");
  assert.equal(plan.canApply, true);
  for (const file of DISCOVERY_FILES) assert.equal(existsSync(join(project, file)), false);

  const result = await applyDiscoveryUpgrade(project, { kitRoot: kit, plan });
  assert.equal(result.status, "applied");
  assert.equal(result.receipt.status, "file-install-only");
  assert.equal(result.receipt.verification.status, "pass");
  assert.match(result.receipt.sourceSHA, /^[0-9a-f]{40}$/);
  const afterLock = JSON.parse(readFileSync(join(project, "governance.lock.json"), "utf8"));
  assert.equal(afterLock.playbookVersion, beforeLock.playbookVersion);
  assert.deepEqual(afterLock.adaptation, beforeLock.adaptation);
  assert.deepEqual(afterLock.capabilities.discovery, result.receipt);
  for (const file of DISCOVERY_FILES) assert.ok(existsSync(join(project, file)), file);
  assert.equal(readFileSync(join(project, "governance/policy.json"), "utf8"), "{\"playbookUpdate\":{\"check\":\"manual\",\"apply\":\"notify\"}}\n");
});

test("discovery write requires an already fetched release ref containing HEAD", async (t) => {
  const project = gitProject(t);
  const kit = gitKit(t);
  writeFileSync(join(kit, "templates/common", DISCOVERY_FILES[0]), "// unpublished candidate\n");
  commitAll(kit, "unpublished candidate");
  const candidatePlan = planDiscoveryUpgrade(project, { kitRoot: kit });
  assert.equal(candidatePlan.status, "conflict");
  assert.equal(candidatePlan.canApply, false);
  assert.match(candidatePlan.conflicts.join("\n"), /candidate 未发布|refs\/remotes\/origin\/main/);
  const refused = await applyDiscoveryUpgrade(project, { kitRoot: kit, plan: candidatePlan });
  assert.equal(refused.status, "conflict");
  for (const file of DISCOVERY_FILES) assert.equal(existsSync(join(project, file)), false, file);

  publishRef(kit);
  const releasedPlan = planDiscoveryUpgrade(project, { kitRoot: kit });
  assert.equal(releasedPlan.status, "plan");
  assert.equal(releasedPlan.canApply, true);
  assert.equal(releasedPlan.sourceReleaseVerified, true);
  const applied = await applyDiscoveryUpgrade(project, { kitRoot: kit, plan: releasedPlan });
  assert.equal(applied.status, "applied");
  assert.equal(applied.receipt.sourceReleaseRef, "refs/remotes/origin/main");
  assert.equal(applied.receipt.sourceReleaseVersion, "4.2.0");
  assert.equal(applied.receipt.sourceReleaseVerified, true);
});

test("missing or mismatched release VERSION cannot authorize discovery write", (t) => {
  const project = gitProject(t);
  const missingRefKit = gitKit(t);
  assert.equal(run("git", ["update-ref", "-d", "refs/remotes/origin/main"], missingRefKit).status, 0);
  const missing = planDiscoveryUpgrade(project, { kitRoot: missingRefKit });
  assert.equal(missing.status, "conflict");
  assert.match(missing.conflicts.join("\n"), /缺少已抓取发布 ref refs\/remotes\/origin\/main/);

  const mismatchedKit = gitKit(t);
  writeFileSync(join(mismatchedKit, "VERSION"), "4.2.1\n");
  commitAll(mismatchedKit, "mismatched release marker");
  publishRef(mismatchedKit);
  const mismatched = planDiscoveryUpgrade(project, { kitRoot: mismatchedKit });
  assert.equal(mismatched.status, "conflict");
  assert.match(mismatched.conflicts.join("\n"), /VERSION=4\.2\.1.*sourceVersion=4\.2\.0/);
});

test("discovery install leaves local cache content and Git refs/remotes unchanged", async (t) => {
  const project = gitProject(t);
  const kit = gitKit(t);
  mkdirSync(join(project, ".cache/ai-governance-playbook"), { recursive: true });
  const cachePath = join(project, ".cache/ai-governance-playbook/latest.json");
  writeFileSync(cachePath, "{\"version\":\"sentinel\",\"checkedAt\":\"never\"}\n");
  commitAll(project, "cache sentinel");
  assert.equal(run("git", ["remote", "add", "origin", "https://example.invalid/discovery.git"], kit).status, 0);
  assert.equal(run("git", ["remote", "add", "origin", "https://example.invalid/project.git"], project).status, 0);
  for (const dir of [kit, project]) {
    const head = run("git", ["rev-parse", "HEAD"], dir).stdout.trim();
    assert.match(head, /^[0-9a-f]{40}$/);
    assert.equal(run("git", ["update-ref", "refs/remotes/origin/protected", head], dir).status, 0);
  }
  const before = {
    kitRefs: gitRefs(kit),
    projectRefs: gitRefs(project),
    kitRemotes: gitRemotes(kit),
    projectRemotes: gitRemotes(project),
    cache: readFileSync(cachePath),
  };
  const result = await applyDiscoveryUpgrade(project, { kitRoot: kit });
  assert.equal(result.status, "applied");
  assert.equal(gitRefs(kit), before.kitRefs);
  assert.equal(gitRefs(project), before.projectRefs);
  assert.equal(gitRemotes(kit), before.kitRemotes);
  assert.equal(gitRemotes(project), before.projectRemotes);
  assert.deepEqual(readFileSync(cachePath), before.cache);
});

test("custom, dirty, untracked, symlink and source-dirty targets refuse atomically", async (t) => {
  const kit = gitKit(t);
  const project = gitProject(t);
  const custom = join(project, DISCOVERY_FILES[0]);
  mkdirSync(join(custom, ".."), { recursive: true });
  writeFileSync(custom, "// project-owned custom file\n");
  commitAll(project, "custom discovery file");
  const originalCustom = readFileSync(custom);
  const conflict = await applyDiscoveryUpgrade(project, { kitRoot: kit });
  assert.equal(conflict.status, "conflict");
  assert.deepEqual(readFileSync(custom), originalCustom);

  const dirtyProject = gitProject(t);
  const dirty = join(dirtyProject, DISCOVERY_FILES[0]);
  mkdirSync(join(dirty, ".."), { recursive: true });
  writeFileSync(dirty, "// untracked then dirty\n");
  const dirtyPlan = planDiscoveryUpgrade(dirtyProject, { kitRoot: kit });
  assert.equal(dirtyPlan.status, "conflict");

  const linkProject = gitProject(t);
  const outside = fixtureDir(t, "discovery-outside-");
  mkdirSync(join(linkProject, "scripts"), { recursive: true });
  symlinkSync(outside, join(linkProject, "scripts/lib"));
  const linkPlan = planDiscoveryUpgrade(linkProject, { kitRoot: kit });
  assert.equal(linkPlan.status, "conflict");
  assert.equal(lstatSync(join(linkProject, "scripts/lib")).isSymbolicLink(), true);

  const danglingLockProject = gitProject(t);
  const lockPath = join(danglingLockProject, "governance.lock.json");
  rmSync(lockPath);
  symlinkSync(join(danglingLockProject, "missing-governance.lock.json"), lockPath);
  const danglingPlan = planDiscoveryUpgrade(danglingLockProject, { kitRoot: kit });
  assert.equal(danglingPlan.status, "conflict");
  assert.equal(lstatSync(lockPath).isSymbolicLink(), true);

  writeFileSync(join(kit, "templates/common", DISCOVERY_FILES[0]), "// dirty kit\n");
  const sourceDirty = planDiscoveryUpgrade(gitProject(t), { kitRoot: kit });
  assert.equal(sourceDirty.status, "conflict");
  assert.ok(sourceDirty.sourceDirtyPaths.length > 0);
});

test("dirty source identity and upgrader control files refuse discovery apply", (t) => {
  const project = gitProject(t);
  for (const [relativePath, contents] of [
    ["VERSION", "4.2.1\n"],
    ["package.json", "{\"name\":\"ai-governance-playbook\",\"version\":\"4.2.1\",\"type\":\"module\"}\n"],
    ["scripts/upgrade.mjs", "// dirty upgrade entry\n"],
    ["scripts/lib/discovery-upgrade.mjs", "// dirty upgrade engine\n"],
  ]) {
    const kit = gitKit(t);
    const path = join(kit, relativePath);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, contents);
    const plan = planDiscoveryUpgrade(project, { kitRoot: kit });
    assert.equal(plan.status, "conflict", relativePath);
    assert.ok(plan.sourceDirtyPaths.includes(relativePath), relativePath);
    assert.ok(plan.conflicts.some((entry) => entry.includes(relativePath)), relativePath);
  }
});

test("a saved plan is invalidated when its source or destination drifts", async (t) => {
  const sourceKit = gitKit(t);
  const sourceProject = gitProject(t);
  const sourcePlan = planDiscoveryUpgrade(sourceProject, { kitRoot: sourceKit });
  assert.equal(sourcePlan.canApply, true);
  writeFileSync(join(sourceKit, "templates/common", DISCOVERY_FILES[0]), "// source drift after plan\n");
  const sourceResult = await applyDiscoveryUpgrade(sourceProject, { kitRoot: sourceKit, plan: sourcePlan });
  assert.equal(sourceResult.status, "conflict");
  assert.ok(sourceResult.conflicts.some((entry) => /dirty|变化/.test(entry)));
  for (const file of DISCOVERY_FILES) assert.equal(existsSync(join(sourceProject, file)), false, file);

  const destinationKit = gitKit(t);
  const destinationProject = gitProject(t);
  const destinationPlan = planDiscoveryUpgrade(destinationProject, { kitRoot: destinationKit });
  assert.equal(destinationPlan.canApply, true);
  const driftedDestination = join(destinationProject, DISCOVERY_FILES[0]);
  mkdirSync(join(driftedDestination, ".."), { recursive: true });
  writeFileSync(driftedDestination, "// destination drift after plan\n");
  const destinationResult = await applyDiscoveryUpgrade(destinationProject, {
    kitRoot: destinationKit,
    plan: destinationPlan,
  });
  assert.equal(destinationResult.status, "conflict");
  assert.ok(destinationResult.conflicts.some((entry) => /dirty|变化/.test(entry)));
  assert.equal(readFileSync(driftedDestination, "utf8"), "// destination drift after plan\n");
  for (const file of DISCOVERY_FILES.slice(1)) assert.equal(existsSync(join(destinationProject, file)), false, file);
});

test("a verifier cannot tamper with an installed source file", async (t) => {
  const kit = gitKit(t);
  const sourcePath = join(kit, "templates/common", DISCOVERY_FILES[0]);
  const project = gitProject(t, `import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(sourcePath)}, "// verifier source tamper\\n");`);
  const beforeLock = readFileSync(join(project, "governance.lock.json"));
  const result = await applyDiscoveryUpgrade(project, { kitRoot: kit });
  assert.equal(result.status, "failed");
  assert.equal(result.rollback, true);
  assert.match(result.conflicts.join("\n"), /source changed during (write|validation)/);
  assert.deepEqual(readFileSync(join(project, "governance.lock.json")), beforeLock);
  for (const file of DISCOVERY_FILES) assert.equal(existsSync(join(project, file)), false, file);
});

test("validator hard-kills a hanging verifier at a bounded timeout", (t) => {
  const project = gitProject(t, "setInterval(() => {}, 1000);");
  const started = Date.now();
  const result = validateProject(project, { timeoutMs: 100 });
  const elapsed = Date.now() - started;
  assert.equal(result.status, "failed");
  assert.equal(result.detail, "timeout");
  assert.ok(elapsed < 5_000, `validator exceeded bounded timeout: ${elapsed}ms`);
});

test("failed report distinguishes complete rollback from manual recovery", () => {
  const incomplete = formatDiscoveryUpgradeReport({
    status: "failed",
    sourceVersion: "4.2.0",
    sourceSHA: "deadbeef",
    rollback: false,
    conflicts: ["restore failed"],
  });
  assert.match(incomplete, /未完全回滚/);
  assert.match(incomplete, /手工恢复/);

  const complete = formatDiscoveryUpgradeReport({
    status: "failed",
    sourceVersion: "4.2.0",
    sourceSHA: "deadbeef",
    rollback: true,
    conflicts: ["verification failed"],
  });
  assert.match(complete, /已完全回滚/);
  assert.doesNotMatch(complete, /手工恢复/);
});

test("verifier tampering with unchanged files rolls back all eight managed destinations", async (t) => {
  const kit = gitKit(t);
  const project = gitProject(t);
  const first = await applyDiscoveryUpgrade(project, { kitRoot: kit });
  assert.equal(first.status, "applied");
  commitAll(project, "adopt discovery");
  const originalFiles = new Map(DISCOVERY_FILES.map((file) => [file, readFileSync(join(project, file))]));
  const originalLock = readFileSync(join(project, "governance.lock.json"));

  writeFileSync(join(kit, "templates/common", DISCOVERY_FILES[0]), "// one source update\n");
  commitAll(kit, "single discovery update");
  publishRef(kit);
  writeFileSync(join(project, "scripts/governance-verify.mjs"), `import { writeFileSync } from "node:fs";
for (const relativePath of ${JSON.stringify(DISCOVERY_FILES)}) writeFileSync(relativePath, "// verifier corrupted unchanged file\\n");
process.exit(9);\n`);

  const plan = planDiscoveryUpgrade(project, { kitRoot: kit });
  assert.equal(plan.status, "plan");
  assert.equal(plan.files.filter((file) => file.action === "update").length, 1);
  assert.equal(plan.files.filter((file) => file.action === "unchanged").length, DISCOVERY_FILES.length - 1);
  const failed = await applyDiscoveryUpgrade(project, { kitRoot: kit, plan });
  assert.equal(failed.status, "failed");
  assert.equal(failed.rollback, true);
  assert.deepEqual(readFileSync(join(project, "governance.lock.json")), originalLock);
  for (const [file, bytes] of originalFiles) assert.deepEqual(readFileSync(join(project, file)), bytes, file);
});

test("recorded capability hashes permit later managed updates, while verifier failure rolls back", async (t) => {
  const kit = gitKit(t);
  const project = gitProject(t);
  const first = await applyDiscoveryUpgrade(project, { kitRoot: kit });
  assert.equal(first.status, "applied");
  commitAll(project, "adopt discovery");

  const oldContent = readFileSync(join(project, DISCOVERY_FILES[0]));
  writeFileSync(join(kit, "templates/common", DISCOVERY_FILES[0]), "// updated discovery\n");
  commitAll(kit, "update discovery source");
  publishRef(kit);
  const secondPlan = planDiscoveryUpgrade(project, { kitRoot: kit });
  assert.equal(secondPlan.status, "plan");
  assert.equal(secondPlan.files.find((file) => file.relativePath === DISCOVERY_FILES[0]).action, "update");
  const second = await applyDiscoveryUpgrade(project, { kitRoot: kit, plan: secondPlan });
  assert.equal(second.status, "applied");
  assert.notDeepEqual(readFileSync(join(project, DISCOVERY_FILES[0])), oldContent);
  commitAll(project, "adopt update");

  const failingVerifier = `import { writeFileSync } from "node:fs";
for (const relativePath of ${JSON.stringify(DISCOVERY_FILES)}) writeFileSync(relativePath, "// verifier rollback tamper\\n");
writeFileSync("governance.lock.json", "secret lock output must not leak");
console.error("secret must not leak");
process.exit(7);`;
  const failingProject = gitProject(t, failingVerifier);
  const before = readFileSync(join(failingProject, "governance.lock.json"));
  const failed = await applyDiscoveryUpgrade(failingProject, { kitRoot: gitKit(t) });
  assert.equal(failed.status, "failed");
  assert.equal(failed.rollback, true);
  assert.deepEqual(readFileSync(join(failingProject, "governance.lock.json")), before);
  for (const file of DISCOVERY_FILES) assert.equal(existsSync(join(failingProject, file)), false, file);
  assert.doesNotMatch(JSON.stringify(failed), /secret/);
});
