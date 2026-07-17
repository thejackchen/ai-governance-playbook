import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const kit = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const run = (command, args, cwd = kit, input) => spawnSync(command, args, { cwd, input, encoding: "utf8" });
const project = () => {
  const dir = mkdtempSync(join(tmpdir(), "governance-kit-"));
  assert.equal(run("git", ["init", "-q"], dir).status, 0);
  return dir;
};

test("dry-run does not write files", () => {
  const dir = project();
  const result = run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--project-name", "demo"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /dry-run完成/);
  assert.deepEqual(readdirSync(dir).filter((x) => x !== ".git"), []);
});

test("auto runtime detection prefers target markers over the caller environment", () => {
  const dir = project();
  writeFileSync(join(dir, "CLAUDE.md"), "# existing Claude project\n");
  const result = spawnSync(process.execPath, ["scripts/init.mjs", "--target", dir, "--profile", "lite"], {
    cwd: kit,
    encoding: "utf8",
    env: { ...process.env, CODEX_HOME: "/tmp/eval-codex-home" }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /runtime=claude-code/);
});

test("Codex Lite installs one instruction source, hooks and frontend extension", () => {
  const dir = project();
  const init = run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite",
    "--project-name", "demo", "--with", "frontend-design-system", "--write"
  ]);
  assert.equal(init.status, 0, init.stderr);
  assert.match(readFileSync(join(dir, "AGENTS.md"), "utf8"), /governance\.lock\.json/);
  assert.match(readFileSync(join(dir, "CLAUDE.md"), "utf8"), /AGENTS\.md/);
  assert.ok(readFileSync(join(dir, ".codex/hooks.json"), "utf8").includes("PreToolUse"));
  assert.ok(readFileSync(join(dir, "design/tokens.json"), "utf8").includes("schemaVersion"));
  const doctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.equal(doctor.status, 0, doctor.stderr);
  assert.match(doctor.stdout + doctor.stderr, /0 error/);
});

test("PreToolUse blocks destructive commands and allows safe commands", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"]).status, 0);
  const hook = join(dir, "scripts/governance-hooks/pre-tool-use.mjs");
  const blocked = run(process.execPath, [hook], dir, JSON.stringify({ tool_name: "Bash", tool_input: { command: "git reset --hard" } }));
  assert.equal(blocked.status, 0);
  assert.equal(JSON.parse(blocked.stdout).decision, "block");
  const alternate = run(process.execPath, [hook], join(dir, "docs"), JSON.stringify({ tool_name: "Bash", tool_input: { command: "git -C . reset --hard" } }));
  assert.equal(alternate.status, 0);
  assert.equal(JSON.parse(alternate.stdout).decision, "block");
  const safe = run(process.execPath, [hook], dir, JSON.stringify({ tool_name: "Bash", tool_input: { command: "git status --short" } }));
  assert.equal(safe.status, 0);
  assert.equal(safe.stdout, "");
});

test("PreToolUse command normalization catches equivalent bypass spellings", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"]).status, 0);
  const hook = join(dir, "scripts/governance-hooks/pre-tool-use.mjs");
  for (const command of [
    "/usr/bin/git reset --hard",
    "\\git reset --hard",
    "(git reset --hard)",
    "git reset '--hard'"
  ]) {
    const result = run(process.execPath, [hook], dir, JSON.stringify({ tool_name: "Bash", tool_input: { command } }));
    assert.equal(result.status, 0, command);
    assert.equal(JSON.parse(result.stdout).decision, "block", `expected block for: ${command}`);
  }
  const safe = run(process.execPath, [hook], dir, JSON.stringify({ tool_name: "Bash", tool_input: { command: "git status" } }));
  assert.equal(safe.status, 0);
  assert.equal(safe.stdout, "");

  const policyPath = join(dir, "governance/policy.json");
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  policy.protectedPaths = ["governance/policy.json"];
  writeFileSync(policyPath, JSON.stringify(policy, null, 2) + "\n");
  const redirected = run(process.execPath, [hook], dir, JSON.stringify({ tool_name: "Bash", tool_input: { command: "echo x > governance/policy.json" } }));
  assert.equal(redirected.status, 0);
  assert.equal(JSON.parse(redirected.stdout).decision, "block");
});

test("Codex hooks resolve governance state from a nested working directory", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"]).status, 0);
  const nested = join(dir, "docs");
  const session = run(process.execPath, [join(dir, "scripts/governance-hooks/session-start.mjs")], nested);
  assert.equal(session.status, 0, session.stderr);
  assert.match(session.stdout, /治理启动状态/);
  const stop = run(process.execPath, [join(dir, "scripts/governance-hooks/stop.mjs")], nested, "{}");
  assert.equal(stop.status, 0, stop.stderr);
  assert.equal(JSON.parse(stop.stdout).continue, true);
});

test("Claude Code Standard installs shared gates and passes doctor", () => {
  const dir = project();
  const init = run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "claude-code", "--profile", "standard", "--write"]);
  assert.equal(init.status, 0, init.stderr);
  assert.match(readFileSync(join(dir, "CLAUDE.md"), "utf8"), /governance\.lock\.json/);
  assert.match(readFileSync(join(dir, "AGENTS.md"), "utf8"), /CLAUDE\.md/);
  assert.ok(readFileSync(join(dir, ".claude/settings.json"), "utf8").includes("SessionStart"));
  assert.ok(readFileSync(join(dir, ".github/workflows/governance.yml"), "utf8").includes("deterministic"));
  assert.ok(readFileSync(join(dir, "governance/registry.md"), "utf8").includes("判定条件"));
  // 架构/需求指针是markdown链接（进死链检测射程），默认落点必须真实存在，否则刚装完就会死链报错
  assert.match(readFileSync(join(dir, "CLAUDE.md"), "utf8"), /\[docs\/architecture\.md\]\(docs\/architecture\.md\)/);
  assert.ok(existsSync(join(dir, "docs/architecture.md")));
  assert.ok(existsSync(join(dir, "docs/requirements/backlog.md")));
  const lint = run(process.execPath, [join(dir, "scripts/governance-lint.mjs"), "--root", dir], dir);
  assert.equal(lint.status, 0, lint.stderr);
  assert.doesNotMatch(lint.stdout + lint.stderr, /死链/);
  const doctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.equal(doctor.status, 0, doctor.stderr);
});

test("Standard profile carries no Codex/OpenAI stowaway outside Codex runtime", () => {
  // scripts/governance-lint.mjs 对每个runtime都相同地包含 `lock.runtime === "codex"` 分支——
  // 这是共享的跨runtime校验逻辑（本身在Lite也会安装，与Standard的CI夹带问题无关），不算作item 3要清除的
  // Codex专属CI工具引用（.github/codex/**、openai/codex-action、OPENAI_API_KEY）。其余任何文件都不应提及。
  const exempt = new Set(["scripts/governance-lint.mjs"]);
  const findLeaks = (dir) => {
    const hits = [];
    const walk = (d) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        if (entry.name === ".git") continue;
        const full = join(d, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (exempt.has(relative(dir, full))) continue;
        let body = "";
        try { body = readFileSync(full, "utf8"); } catch { continue; }
        if (/codex|openai/i.test(body)) hits.push(full);
      }
    };
    walk(dir);
    return hits;
  };

  for (const runtime of ["claude-code", "generic"]) {
    const dir = project();
    assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", runtime, "--profile", "standard", "--write"]).status, 0);
    assert.deepEqual(findLeaks(dir), [], `${runtime}+standard 不应残留 codex/openai 引用`);
  }

  const codexDir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", codexDir, "--runtime", "codex", "--profile", "standard", "--write"]).status, 0);
  assert.ok(existsSync(join(codexDir, ".github/codex/prompts/governance-review.md")));
  assert.match(readFileSync(join(codexDir, ".github/workflows/governance.yml"), "utf8"), /ai-review:/);
});

test("doctor rejects an old instruction file that init skipped", () => {
  const dir = project();
  writeFileSync(join(dir, "AGENTS.md"), "# old instructions\n");
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"]).status, 0);
  const doctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.notEqual(doctor.status, 0);
  assert.match(doctor.stderr, /仍未对齐v3执行宪法/);
});

test("top-level allowlist catches repository clutter", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite", "--write"]).status, 0);
  const policyPath = join(dir, "governance/policy.json");
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  policy.allowedTopLevelEntries = readdirSync(dir).filter((x) => x !== ".git");
  writeFileSync(policyPath, JSON.stringify(policy, null, 2) + "\n");
  writeFileSync(join(dir, "stray-output.json"), "{}\n");
  const lint = run(process.execPath, [join(dir, "scripts/governance-lint.mjs"), "--root", dir], dir);
  assert.notEqual(lint.status, 0);
  assert.match(lint.stderr, /未知顶层项: stray-output\.json/);
});

test("Generic Lite does not install Standard pre-commit machinery", () => {
  const dir = project();
  const init = run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite", "--write"]);
  assert.equal(init.status, 0, init.stderr);
  assert.ok(!existsSync(join(dir, ".githooks/pre-commit")));
});

test("Standard heartbeat is scheduled and counts table entries", () => {
  const dir = project();
  const init = run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "standard", "--write"]);
  assert.equal(init.status, 0, init.stderr);
  writeFileSync(join(dir, "governance/incidents.md"), "| 日期 | 现象 |\n|---|---|\n| 2026-07-11 | example |\n");
  writeFileSync(join(dir, "governance/questions.md"), "| 日期 | 问题 |\n|---|---|\n| 2026-07-11 | example |\n");
  const review = run(process.execPath, ["scripts/weekly-governance-review.mjs"], dir);
  assert.equal(review.status, 0, review.stderr);
  assert.match(review.stdout, /待裁决问题条目：1/);
  assert.match(review.stdout, /事故条目：1/);
  const workflow = readFileSync(join(dir, ".github/workflows/governance.yml"), "utf8");
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /weekly-governance-review\.mjs/);
});

test("High Assurance remains incomplete until CODEOWNERS is assigned", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "high-assurance", "--write"]).status, 0);
  const doctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.notEqual(doctor.status, 0);
  assert.match(doctor.stderr, /CODEOWNERS仍是占位owner/);
});
