import test from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "fixtures", "semantic-adaptation");
const fixturePaths = {
  a: join(fixtureRoot, "project-a"),
  b: join(fixtureRoot, "project-b"),
};

const expectedFiles = {
  a: [
    "AGENTS.md",
    "INDEX.md",
    "governance.lock.json",
    "governance/policy.json",
    "knowledge/INDEX.md",
    "knowledge/specs/release-posture.md",
    "scripts/verify-facts.mjs",
    "src/workbench/wip-sentinel.txt",
  ],
  b: [
    "AGENTS.md",
    "INDEX.md",
    "governance.lock.json",
    "governance/policy.json",
    "knowledge/INDEX.md",
    "knowledge/specs/owner-a.md",
    "knowledge/specs/owner-b.md",
    "scripts/verify-facts.mjs",
    "src/workbench/wip-sentinel.txt",
  ],
};

function listFiles(root, current = root) {
  const out = [];
  for (const entry of readdirSync(current)) {
    const path = join(current, entry);
    if (lstatSync(path).isDirectory()) out.push(...listFiles(root, path));
    else out.push(relative(root, path));
  }
  return out;
}

function parseFrontMatter(body) {
  const match = body.match(/^---\n([\s\S]*?)\n---\n/);
  const fields = {};
  if (!match) return fields;
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return fields;
}

function runVerifier(projectRoot) {
  return spawnSync(process.execPath, ["scripts/verify-facts.mjs"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env },
  });
}

function stageFixture(t, fixtureName) {
  const stagingRoot = mkdtempSync(join(tmpdir(), "semantic-adaptation-fixture-"));
  t.after(() => rmSync(stagingRoot, { recursive: true, force: true }));
  const projectRoot = join(stagingRoot, fixtureName);
  cpSync(fixturePaths[fixtureName], projectRoot, { recursive: true });
  const initialized = spawnSync("git", ["init", "-q"], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(initialized.status, 0, initialized.stderr);
  return projectRoot;
}

function candidateLock(projectRoot, fixtureName) {
  const lock = JSON.parse(readFileSync(join(projectRoot, "governance.lock.json"), "utf8"));
  assert.equal(lock.playbookVersion, "4.1.0", `${fixtureName} must start on its old project version`);
  assert.equal(lock.adaptation?.sourceVersion, "4.1.0", `${fixtureName} source version drifted`);
  assert.deepEqual(lock.adaptation?.source, {
    status: "candidate",
    verification: "unverified",
    published: false,
  }, `${fixtureName} candidate boundary changed`);
  assert.equal(lock.adaptation?.projectFacts, "preserved", `${fixtureName} facts are not preserved`);
  return lock;
}

test("semantic adaptation fixtures are complete synthetic candidate repositories", (t) => {
  for (const [fixtureName, projectRoot] of Object.entries(fixturePaths)) {
    assert.ok(existsSync(projectRoot), `${fixtureName} fixture missing`);
    const actual = listFiles(projectRoot).sort();
    assert.deepEqual(actual, [...expectedFiles[fixtureName]].sort(), `${fixtureName} fixture file set changed`);
    for (const relativePath of expectedFiles[fixtureName]) {
      const path = join(projectRoot, relativePath);
      assert.equal(lstatSync(path).isFile(), true, `${fixtureName}/${relativePath} is not a regular file`);
    }
    const policy = JSON.parse(readFileSync(join(projectRoot, "governance/policy.json"), "utf8"));
    assert.match(policy.playbookUpdate?.channel || "", /^synthetic:\/\//, `${fixtureName} must not point at a live source`);
    candidateLock(projectRoot, fixtureName);
    const verifier = runVerifier(stageFixture(t, fixtureName));
    assert.equal(verifier.status, 0, `${fixtureName} source verifier should pass: ${verifier.stderr}`);
  }
});

test("project-a verifier follows the index chain after a decision record moves", (t) => {
  const projectRoot = stageFixture(t, "a");
  assert.equal(runVerifier(projectRoot).status, 0);

  mkdirSync(join(projectRoot, "knowledge/records"), { recursive: true });
  renameSync(
    join(projectRoot, "knowledge/specs/release-posture.md"),
    join(projectRoot, "knowledge/records/release-posture.md"),
  );
  const indexPath = join(projectRoot, "knowledge/INDEX.md");
  writeFileSync(indexPath, readFileSync(indexPath, "utf8").replace("specs/release-posture.md", "records/release-posture.md"));
  const lockPath = join(projectRoot, "governance.lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.installedFiles = lock.installedFiles.map((path) => path.replace("knowledge/specs/", "knowledge/records/"));
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  const result = runVerifier(projectRoot);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("project-a guard rejects fact, WIP, and version-only changes", (t) => {
  const mutations = [
    {
      name: "project identifier",
      mutate(projectRoot) {
        const path = join(projectRoot, "knowledge/specs/release-posture.md");
        writeFileSync(path, readFileSync(path, "utf8").replaceAll("HL-ORBIT-17", "HL-ORBIT-18"));
      },
      diagnostic: /project identifier changed/,
    },
    {
      name: "outbound posture",
      mutate(projectRoot) {
        const path = join(projectRoot, "knowledge/specs/release-posture.md");
        writeFileSync(path, readFileSync(path, "utf8").replace("outbound: blocked", "outbound: allowed"));
      },
      diagnostic: /outbound posture changed/,
    },
    {
      name: "deployment posture",
      mutate(projectRoot) {
        const path = join(projectRoot, "knowledge/specs/release-posture.md");
        writeFileSync(path, readFileSync(path, "utf8").replace("automatic-deployment: prohibited", "automatic-deployment: allowed"));
      },
      diagnostic: /deployment posture changed/,
    },
    {
      name: "unfinished work",
      mutate(projectRoot) {
        writeFileSync(join(projectRoot, "src/workbench/wip-sentinel.txt"), "WIP: replaced by an unrelated sample.\n");
      },
      diagnostic: /unfinished project work changed/,
    },
    {
      name: "version-only adoption",
      mutate(projectRoot) {
        const path = join(projectRoot, "governance.lock.json");
        const lock = JSON.parse(readFileSync(path, "utf8"));
        lock.playbookVersion = "4.2.0";
        writeFileSync(path, `${JSON.stringify(lock, null, 2)}\n`);
      },
      diagnostic: /candidate lock version moved/,
    },
  ];

  for (const mutation of mutations) {
    const projectRoot = stageFixture(t, "a");
    mutation.mutate(projectRoot);
    const result = runVerifier(projectRoot);
    assert.notEqual(result.status, 0, `${mutation.name} should be blocked`);
    assert.match(`${result.stdout}\n${result.stderr}`, mutation.diagnostic, mutation.name);
  }
});

test("project-b keeps both owner records and exposes a real semantic conflict", (t) => {
  const projectRoot = stageFixture(t, "b");
  const verifier = runVerifier(projectRoot);
  assert.equal(verifier.status, 0, `${verifier.stdout}\n${verifier.stderr}`);
  candidateLock(projectRoot, "b");

  const records = ["owner-a.md", "owner-b.md"].map((file) => {
    const body = readFileSync(join(projectRoot, "knowledge/specs", file), "utf8");
    return { fields: parseFrontMatter(body), body: body.replace(/^---\n[\s\S]*?\n---\n/, "").toLowerCase() };
  });
  assert.equal(new Set(records.map(({ fields }) => fields.owner)).size, 2, "owners must remain distinct");
  assert.equal(new Set(records.map(({ fields }) => fields.subject)).size, 1, "records must address one fact");
  assert.deepEqual(new Set(records.map(({ fields }) => fields.decision)), new Set(["allowed", "prohibited"]));
  assert.ok(records.some(({ body }) => /automatic deployment[\s\S]*allowed/.test(body)));
  assert.ok(records.some(({ body }) => /automatic deployment[\s\S]*prohibited/.test(body)));

  const indexPath = join(projectRoot, "knowledge/INDEX.md");
  writeFileSync(indexPath, readFileSync(indexPath, "utf8").replace("- [Release note from owner B](specs/owner-b.md)\n", ""));
  const missingRecord = runVerifier(projectRoot);
  assert.notEqual(missingRecord.status, 0, "dropping a conflicting owner record must not pass the fixture guard");
  assert.match(`${missingRecord.stdout}\n${missingRecord.stderr}`, /both decision records/);
});
