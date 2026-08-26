import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { admissionPath } from "../scripts/lib/boot-admission.mjs";

const kit = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const playbookVersion = readFileSync(join(kit, "VERSION"), "utf8").trim();
const badgeRe = new RegExp(`三句核心 v${playbookVersion.replaceAll(".", "\\.")}`);
const run = (command, args, cwd = kit, input) => spawnSync(command, args, { cwd, input, encoding: "utf8" });
const project = () => {
  const dir = mkdtempSync(join(tmpdir(), "governance-kit-"));
  assert.equal(run("git", ["init", "-q"], dir).status, 0);
  return dir;
};
const commitAll = (dir, message = "baseline") => {
  assert.equal(run("git", ["add", "."], dir).status, 0);
  assert.equal(
    run("git", ["-c", "user.name=Test User", "-c", "user.email=test@example.com", "commit", "-qm", message], dir).status,
    0,
  );
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

test("Codex Lite installs shared instruction files, hooks and frontend extension", () => {
  const dir = project();
  const init = run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite",
    "--project-name", "demo", "--with", "frontend-design-system", "--write"
  ]);
  assert.equal(init.status, 0, init.stderr);
  assert.match(readFileSync(join(dir, "AGENTS.md"), "utf8"), /governance\.lock\.json/);
  assert.equal(readFileSync(join(dir, "CLAUDE.md"), "utf8"), readFileSync(join(dir, "AGENTS.md"), "utf8"));
  assert.equal(existsSync(join(dir, "scripts/claim.mjs")), false);
  assert.ok(readFileSync(join(dir, ".codex/hooks.json"), "utf8").includes("PreToolUse"));
  for (const file of [
    "docs/design/design-system.md",
    "docs/design/reference-pack.md",
    "design/tokens.json",
    "docs/architecture/frontend-surfaces.md",
    "governance/frontend-policy.json",
    "scripts/frontend-governance-verify.mjs"
  ]) assert.ok(existsSync(join(dir, file)), `missing frontend extension file: ${file}`);
  const tokens = JSON.parse(readFileSync(join(dir, "design/tokens.json"), "utf8"));
  for (const layer of ["primitive", "semantic", "component"]) assert.ok(tokens[layer], `missing token layer: ${layer}`);
  const frontendPolicy = JSON.parse(readFileSync(join(dir, "governance/frontend-policy.json"), "utf8"));
  assert.equal(frontendPolicy.lifecycle, "reference-pending");
  assert.deepEqual(Object.keys(frontendPolicy.authority).sort(), ["designSystem", "referencePack", "surfaces", "tokens"]);
  assert.deepEqual(frontendPolicy.representativeJourneys, []);
  assert.deepEqual(frontendPolicy.checks, [], "reference-pending 安装默认不得执行未配置的项目命令");
  assert.equal(frontendPolicy.visualRegression.enabled, false);
  assert.equal(frontendPolicy.visualRegression.checkId, "visual-regression");
  assert.equal(frontendPolicy.visualRegression.baselinePath, "tests/visual/baselines");
  assert.ok(readFileSync(join(dir, "AGENTS.md"), "utf8").includes("frontend-design-system"));
  assert.ok(existsSync(join(dir, "docs/ops/extra-repo-facts.json")), "missing extra-repo facts index");
  assert.ok(existsSync(join(dir, "scripts/lib/extra-repo-facts.mjs")), "missing extra-repo facts library");
  assert.ok(existsSync(join(dir, "scripts/lib/integration-line.mjs")), "missing integration-line library");
  assert.ok(existsSync(join(dir, ".grok/hooks/governance.json")), "missing Grok governance hooks");
  const extraRepoSession = run(process.execPath, [join(dir, "scripts/governance-hooks/session-start.mjs")], join(dir, "docs"));
  assert.equal(extraRepoSession.status, 0, extraRepoSession.stderr);
  assert.match(extraRepoSession.stdout, /仓外正本/);
  assert.ok(readFileSync(join(dir, "docs/index.md"), "utf8").includes("frontend-governance-verify.mjs"));
  const referencePack = readFileSync(join(dir, "docs/design/reference-pack.md"), "utf8");
  for (const layer of ["baseSystem", "industryPatterns", "brandLayer"]) assert.match(referencePack, new RegExp(`^### ${layer}$`, "m"));
  assert.match(referencePack, /参考来源不是复制资产/);
  assert.match(referencePack, /不能只作为换色皮肤/);
  assert.match(referencePack, /项目语义层/);
  assert.match(referencePack, /行业\/电商页面模式/);
  assert.match(referencePack, /项目色彩、资产和信息角色/);
  const doctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.equal(doctor.status, 0, doctor.stderr);
  assert.match(doctor.stdout + doctor.stderr, /0 error/);
});

test("SessionStart reaches frontend lifecycle and authority paths when the extension is installed", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite",
    "--with", "frontend-design-system", "--write"
  ]).status, 0);
  const session = run(process.execPath, [join(dir, "scripts/governance-hooks/session-start.mjs")], join(dir, "docs"));
  assert.equal(session.status, 0, session.stderr);
  assert.match(session.stdout, /视觉治理: lifecycle=reference-pending/);
  assert.match(session.stdout, /journeys=0/);
  for (const path of [
    "designSystem:docs/design/design-system.md",
    "tokens:design/tokens.json",
    "referencePack:docs/design/reference-pack.md",
    "surfaces:docs/architecture/frontend-surfaces.md"
  ]) assert.match(session.stdout, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("SessionStart names representative journeys when policy records them", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite",
    "--with", "frontend-design-system", "--write"
  ]).status, 0);
  const policyPath = join(dir, "governance/frontend-policy.json");
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  policy.representativeJourneys = [{
    id: "primary-flow",
    surfaces: ["entry"],
    states: ["loading", "ready"],
    evidence: ["docs/design/design-system.md"],
  }];
  writeFileSync(policyPath, JSON.stringify(policy, null, 2) + "\n");
  const session = run(process.execPath, [join(dir, "scripts/governance-hooks/session-start.mjs")], join(dir, "docs"));
  assert.equal(session.status, 0, session.stderr);
  assert.match(session.stdout, /journeys=1; ids=primary-flow/);
});

test("shared governance verify invokes the installed frontend verifier with the selected mode", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite",
    "--with", "frontend-design-system", "--write"
  ]).status, 0);
  const verify = run(process.execPath, [join(kit, "scripts/governance-verify.mjs"), "--fast"], dir);
  assert.equal(verify.status, 0, verify.stderr);
  assert.match(verify.stdout + verify.stderr, /\[frontend-governance\]/);
  assert.match(verify.stdout + verify.stderr, /lifecycle=reference-pending mode=fast checks=0/);
  assert.doesNotMatch(verify.stdout + verify.stderr, /npm (?:error|run)|REPORT/);
});

test("frontend governance verifier separates structural errors from lifecycle enforcement", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite",
    "--with", "frontend-design-system", "--write"
  ]).status, 0);
  const script = join(dir, "scripts/frontend-governance-verify.mjs");
  const policyPath = join(dir, "governance/frontend-policy.json");
  const referencePackPath = join(dir, "docs/design/reference-pack.md");
  const originalReferencePack = readFileSync(referencePackPath, "utf8");
  const readPolicy = () => JSON.parse(readFileSync(policyPath, "utf8"));
  const writePolicy = (policy) => writeFileSync(policyPath, JSON.stringify(policy, null, 2) + "\n");

  const structural = readPolicy();
  structural.lifecycle = "not-a-lifecycle";
  writePolicy(structural);
  const structuralResult = run(process.execPath, [script, "--fast"], dir);
  assert.notEqual(structuralResult.status, 0);
  assert.match(structuralResult.stderr, /STRUCTURE ERROR/);
  assert.match(structuralResult.stderr, /lifecycle/);

  const noGate = readPolicy();
  noGate.lifecycle = "enforced";
  noGate.checks = [];
  writePolicy(noGate);
  const noGateResult = run(process.execPath, [script, "--fast"], dir);
  assert.notEqual(noGateResult.status, 0);
  assert.match(noGateResult.stderr, /enforced lifecycle 不能使用空 checks/);

  const missingReferenceLayer = readPolicy();
  writeFileSync(referencePackPath, originalReferencePack.replace("### brandLayer", "### projectBrand"));
  writePolicy(missingReferenceLayer);
  const missingReferenceResult = run(process.execPath, [script, "--fast"], dir);
  assert.notEqual(missingReferenceResult.status, 0);
  assert.match(missingReferenceResult.stderr, /referencePack 缺少 brandLayer/);
  writeFileSync(referencePackPath, originalReferencePack);

  const visualDirectory = join(dir, "tests/visual/baselines");
  mkdirSync(visualDirectory, { recursive: true });
  const enabledVisual = readPolicy();
  enabledVisual.lifecycle = "reference-pending";
  enabledVisual.visualRegression.enabled = true;
  enabledVisual.checks = [{
    id: "visual-regression",
    name: "Visual regression",
    modes: ["fast"],
    command: "node -e \"process.exit(0)\"",
    enforcement: "report"
  }];
  writePolicy(enabledVisual);
  const enabledVisualResult = run(process.execPath, [script, "--fast"], dir);
  assert.equal(enabledVisualResult.status, 0, enabledVisualResult.stderr);

  const shadow = readPolicy();
  shadow.lifecycle = "shadow";
  shadow.visualRegression.enabled = false;
  shadow.representativeJourneys = [{
    id: "primary-flow",
    surfaces: ["entry"],
    states: ["loading", "ready"],
    evidence: ["docs/design/design-system.md"],
  }];
  shadow.checks = [{
    id: "failing-shadow-check",
    name: "Failing shadow check",
    modes: ["fast"],
    command: "node -e \"process.exit(7)\"",
    enforcement: "block"
  }];
  writePolicy(shadow);
  const shadowResult = run(process.execPath, [script, "--fast"], dir);
  assert.equal(shadowResult.status, 0, shadowResult.stderr);
  assert.match(shadowResult.stdout + shadowResult.stderr, /REPORT failing-shadow-check/);
  assert.doesNotMatch(shadowResult.stdout + shadowResult.stderr, /BLOCK failing-shadow-check/);

  const enforced = readPolicy();
  enforced.lifecycle = "enforced";
  enforced.checks[0].enforcement = "block";
  writePolicy(enforced);
  const enforcedResult = run(process.execPath, [script, "--fast"], dir);
  assert.notEqual(enforcedResult.status, 0);
  assert.match(enforcedResult.stdout + enforcedResult.stderr, /BLOCK failing-shadow-check/);
});

test("frontend governance verifier validates design language headings and representative journey lifecycle", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite",
    "--with", "frontend-design-system", "--write"
  ]).status, 0);
  const script = join(dir, "scripts/frontend-governance-verify.mjs");
  const policyPath = join(dir, "governance/frontend-policy.json");
  const designSystemPath = join(dir, "docs/design/design-system.md");
  const originalPolicy = JSON.parse(readFileSync(policyPath, "utf8"));
  const originalDesignSystem = readFileSync(designSystemPath, "utf8");
  const writePolicy = (policy) => writeFileSync(policyPath, JSON.stringify(policy, null, 2) + "\n");
  const validJourney = {
    id: "primary-flow",
    surfaces: ["entry"],
    states: ["loading", "ready"],
    evidence: ["docs/design/design-system.md"],
  };
  const assertBlocked = (policy, pattern) => {
    writePolicy(policy);
    const result = run(process.execPath, [script, "--fast"], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, pattern);
  };

  writeFileSync(designSystemPath, originalDesignSystem.replace("## 设计语言", "## 缺失章节"));
  assertBlocked(originalPolicy, /designSystem 缺少 ## 设计语言/);
  writeFileSync(designSystemPath, originalDesignSystem);

  assertBlocked({ ...originalPolicy, representativeJourneys: "invalid" }, /representativeJourneys 必须是数组/);
  assertBlocked({
    ...originalPolicy,
    representativeJourneys: [validJourney, { ...validJourney }],
  }, /representativeJourneys\.id 重复/);
  assertBlocked({
    ...originalPolicy,
    representativeJourneys: [{ ...validJourney, evidence: ["missing/evidence"] }],
  }, /representativeJourneys\[0\]\.evidence\[0\] 不存在/);
  assertBlocked({
    ...originalPolicy,
    representativeJourneys: [{ ...validJourney, states: [] }],
  }, /representativeJourneys\[0\]\.states 必须是非空字符串数组/);
  assertBlocked({ ...originalPolicy, lifecycle: "shadow", representativeJourneys: [] }, /shadow lifecycle 至少需要一个 representative journey/);
  assertBlocked({
    ...originalPolicy,
    lifecycle: "shadow",
    representativeJourneys: [{ ...validJourney, evidence: [] }],
  }, /evidence 在 shadow lifecycle 必须至少有一条证据路径/);

  const shadow = {
    ...originalPolicy,
    lifecycle: "shadow",
    representativeJourneys: [validJourney],
    checks: [{
      id: "failing-shadow-journey-check",
      name: "Failing shadow journey check",
      modes: ["fast"],
      command: "node -e \"process.exit(7)\"",
      enforcement: "block",
    }],
  };
  writePolicy(shadow);
  const shadowResult = run(process.execPath, [script, "--fast"], dir);
  assert.equal(shadowResult.status, 0, shadowResult.stderr);
  assert.match(shadowResult.stdout + shadowResult.stderr, /REPORT failing-shadow-journey-check/);

  assertBlocked({ ...originalPolicy, lifecycle: "enforced", representativeJourneys: [] }, /enforced lifecycle 至少需要一个 representative journey/);
  const enforced = {
    ...shadow,
    lifecycle: "enforced",
    checks: [{ ...shadow.checks[0], enforcement: "block" }],
  };
  writePolicy(enforced);
  const enforcedResult = run(process.execPath, [script, "--fast"], dir);
  assert.notEqual(enforcedResult.status, 0);
  assert.match(enforcedResult.stdout + enforcedResult.stderr, /BLOCK failing-shadow-journey-check/);

  writePolicy(originalPolicy);
});

test("every new runtime/profile install carries both hook schemas", () => {
  const events = ["SessionStart", "PreToolUse", "Stop", "PreCompact"];
  for (const runtime of ["codex", "claude-code", "generic"]) {
    for (const profile of ["lite", "standard", "high-assurance"]) {
      const dir = project();
      const init = run(process.execPath, [
        "scripts/init.mjs", "--target", dir, "--runtime", runtime, "--profile", profile, "--write"
      ]);
      assert.equal(init.status, 0, `${runtime}+${profile}: ${init.stderr}`);

      const claude = JSON.parse(readFileSync(join(dir, ".claude/settings.json"), "utf8"));
      const codex = JSON.parse(readFileSync(join(dir, ".codex/hooks.json"), "utf8"));
      for (const event of events) {
        assert.ok(claude.hooks?.[event]?.length, `${runtime}+${profile} Claude ${event}`);
        assert.ok(codex.hooks?.[event]?.length, `${runtime}+${profile} Codex ${event}`);
      }
      assert.match(
        codex.hooks.SessionStart[0].hooks[0].command,
        /session-start-codex\.mjs/,
        `${runtime}+${profile} Codex SessionStart 应指向 JSON 适配器`,
      );
      assert.match(
        claude.hooks.SessionStart[0].hooks[0].command,
        /session-start\.mjs/,
        `${runtime}+${profile} Claude SessionStart 应保留人类文本脚本`,
      );
      assert.match(
        codex.hooks.PreCompact[0].hooks[0].command,
        /pre-compact-codex\.mjs/,
        `${runtime}+${profile} Codex PreCompact 应指向 JSON 适配器`,
      );
      assert.match(
        claude.hooks.PreCompact[0].hooks[0].command,
        /pre-compact\.mjs/,
        `${runtime}+${profile} Claude PreCompact 应指向检查脚本`,
      );
      assert.match(readFileSync(join(dir, ".codex/config.toml"), "utf8"), /hooks\s*=\s*true/);
      assert.match(readFileSync(join(dir, ".codex/rules/default.rules"), "utf8"), /match\s*=/);
    }
  }
});

test("doctor keeps legacy single-runtime installs compatible", () => {
  const codexDir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", codexDir, "--runtime", "codex", "--profile", "lite", "--write"
  ]).status, 0);
  const codexLockPath = join(codexDir, "governance.lock.json");
  const codexLock = JSON.parse(readFileSync(codexLockPath, "utf8"));
  unlinkSync(join(codexDir, ".claude/settings.json"));
  codexLock.installedFiles = codexLock.installedFiles.filter((p) => p !== ".claude/settings.json");
  writeFileSync(codexLockPath, JSON.stringify(codexLock, null, 2) + "\n");
  const codexDoctor = run(process.execPath, ["scripts/doctor.mjs", "--target", codexDir]);
  assert.equal(codexDoctor.status, 0, codexDoctor.stderr);
  assert.doesNotMatch(codexDoctor.stderr, /Claude Code缺少|缺少文件: \.claude/);

  const claudeDir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", claudeDir, "--runtime", "claude-code", "--profile", "standard", "--write"
  ]).status, 0);
  const claudeLockPath = join(claudeDir, "governance.lock.json");
  const claudeLock = JSON.parse(readFileSync(claudeLockPath, "utf8"));
  for (const p of [".codex/hooks.json", ".codex/config.toml", ".codex/rules/default.rules"]) unlinkSync(join(claudeDir, p));
  claudeLock.installedFiles = claudeLock.installedFiles.filter((p) => !p.startsWith(".codex/"));
  writeFileSync(claudeLockPath, JSON.stringify(claudeLock, null, 2) + "\n");
  const claudeDoctor = run(process.execPath, ["scripts/doctor.mjs", "--target", claudeDir]);
  assert.equal(claudeDoctor.status, 0, claudeDoctor.stderr);
  assert.doesNotMatch(claudeDoctor.stderr, /Codex缺少|Codex hooks|Codex rules|缺少文件: \.codex/);
});

test("doctor validates both installed carriers regardless of lock runtime", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite", "--write"
  ]).status, 0);
  writeFileSync(join(dir, ".claude/settings.json"), "{}\n");
  writeFileSync(join(dir, ".codex/config.toml"), "[features]\nhooks = false\n");
  const doctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.notEqual(doctor.status, 0);
  assert.match(doctor.stderr, /Claude Code缺少SessionStart Hook/);
  assert.match(doctor.stderr, /Codex hooks功能未启用/);
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

  // 3.1.2 判定面最小化:直接改保护文件被拦;引用/读取不误伤(首个安装项目当场误伤的回归)
  const editProtected = run(process.execPath, [hook], dir, JSON.stringify({ tool_name: "Write", tool_input: { file_path: `${dir}/governance/policy.json`, content: "x" } }));
  assert.equal(JSON.parse(editProtected.stdout).decision, "block", "Write 保护文件应被拦");
  const editMention = run(process.execPath, [hook], dir, JSON.stringify({ tool_name: "Edit", tool_input: { file_path: `${dir}/docs/index.md`, new_string: "见 [policy](../governance/policy.json)" } }));
  assert.equal(editMention.stdout, "", "他文件内容提及保护路径不应误拦");
  const readProtected = run(process.execPath, [hook], dir, JSON.stringify({ tool_name: "Bash", tool_input: { command: "cat governance/policy.json" } }));
  assert.equal(readProtected.stdout, "", "读保护文件不应误拦");
});

test("PreToolUse matches deny patterns per command segment, not across connectors", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"]).status, 0);
  const hook = join(dir, "scripts/governance-hooks/pre-tool-use.mjs");
  for (const command of [
    "git reset --hard",
    "git clean -fdx",
    "git push --force",
    "rm -rf /",
    "rm -rf .git",
    "/usr/bin/git push origin main --force",
    'bash -c "git push --force"',
    'bash -c "echo hi && git push --force"',
    "cd /tmp && /usr/bin/git reset --hard"
  ]) {
    const result = run(process.execPath, [hook], dir, JSON.stringify({ tool_name: "Bash", tool_input: { command } }));
    assert.equal(result.status, 0, `hook failed for: ${command}`);
    assert.equal(JSON.parse(result.stdout).decision, "block", `expected block for: ${command}`);
  }
  for (const command of [
    "git push origin main && git worktree remove /tmp/x --force",
    "git status; git log --oneline | head -3",
    'git commit -m "safe" && git push origin main'
  ]) {
    const result = run(process.execPath, [hook], dir, JSON.stringify({ tool_name: "Bash", tool_input: { command } }));
    assert.equal(result.status, 0, `hook failed for: ${command}`);
    assert.equal(result.stdout, "", `expected allow for: ${command}`);
  }
});

test("SessionStart keeps Claude human text and gives Codex a same-source JSON adapter", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"]).status, 0);
  const nested = join(dir, "docs");
  const human = run(process.execPath, [join(dir, "scripts/governance-hooks/session-start.mjs")], nested);
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /治理启动状态/);
  assert.throws(() => JSON.parse(human.stdout));
  const codex = run(process.execPath, [join(dir, "scripts/governance-hooks/session-start-codex.mjs")], nested);
  assert.equal(codex.status, 0, codex.stderr);
  const payload = JSON.parse(codex.stdout);
  const shared = human.stdout.trim();
  assert.equal(payload.systemMessage, `${shared}\n✅ 开机自检: 治理 v${playbookVersion} · 规则注入成功 · 接线正常 · 已签发施工许可`);
  assert.equal(payload.hookSpecificOutput.additionalContext, payload.systemMessage);
  assert.equal(payload.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(payload.systemMessage, badgeRe);
  assert.match(payload.systemMessage, /当前游标|治理启动状态/);
});

test("Codex hooks resolve governance state from a nested working directory", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"]).status, 0);
  commitAll(dir);
  const nested = join(dir, "docs");
  const session = run(process.execPath, [join(dir, "scripts/governance-hooks/session-start-codex.mjs")], nested);
  assert.equal(session.status, 0, session.stderr);
  const payload = JSON.parse(session.stdout);
  assert.match(payload.systemMessage, /治理启动状态/);
  const stop = run(process.execPath, [join(dir, "scripts/governance-hooks/stop.mjs")], nested, "{}");
  assert.equal(stop.status, 0, stop.stderr);
  const stopPayload = JSON.parse(stop.stdout);
  assert.equal(stopPayload.continue, true);
  assert.match(stopPayload.systemMessage, badgeRe);
  assert.match(stopPayload.systemMessage, /✅ 治理验证: 通过/);
});

test("Codex write adapter requires a current boot admission", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"]).status, 0);
  const hook = join(dir, "scripts/governance-hooks/pre-tool-use-codex.mjs");
  const writeInput = JSON.stringify({ tool_name: "apply_patch", tool_input: { file_path: join(dir, "scratch.txt") } });

  const beforeBoot = run(process.execPath, [hook], dir, writeInput);
  assert.equal(beforeBoot.status, 0, beforeBoot.stderr);
  assert.equal(JSON.parse(beforeBoot.stdout).decision, "block");
  assert.match(JSON.parse(beforeBoot.stdout).reason, /没有施工许可/);

  const diagnostic = run(process.execPath, [hook], dir, JSON.stringify({
    tool_name: "Bash",
    tool_input: { command: "git status --short && rg -n TODO ROADMAP.md" },
  }));
  assert.equal(diagnostic.status, 0, diagnostic.stderr);
  assert.equal(diagnostic.stdout, "", "未开机时仍应允许只读诊断");
  const shellWrite = run(process.execPath, [hook], dir, JSON.stringify({
    tool_name: "Bash",
    tool_input: { command: "printf changed > scratch.txt" },
  }));
  assert.equal(shellWrite.status, 0, shellWrite.stderr);
  assert.equal(JSON.parse(shellWrite.stdout).decision, "block");

  const session = run(process.execPath, [join(dir, "scripts/governance-hooks/session-start-codex.mjs")], dir);
  assert.equal(session.status, 0, session.stderr);
  assert.match(JSON.parse(session.stdout).systemMessage, /已签发施工许可/);
  const admitted = run(process.execPath, [hook], dir, writeInput);
  assert.equal(admitted.status, 0, admitted.stderr);
  assert.equal(admitted.stdout, "");

  const path = admissionPath(dir);
  const expired = JSON.parse(readFileSync(path, "utf8"));
  expired.expiresAt = new Date(0).toISOString();
  writeFileSync(path, `${JSON.stringify(expired, null, 2)}\n`);
  const afterExpiry = run(process.execPath, [hook], dir, writeInput);
  assert.equal(afterExpiry.status, 0, afterExpiry.stderr);
  assert.equal(JSON.parse(afterExpiry.stdout).decision, "block");
  assert.match(JSON.parse(afterExpiry.stdout).reason, /已过期/);
});

test("Codex write admission is revoked when critical wiring changes", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"]).status, 0);
  const session = run(process.execPath, [join(dir, "scripts/governance-hooks/session-start-codex.mjs")], dir);
  assert.equal(session.status, 0, session.stderr);
  assert.match(JSON.parse(session.stdout).systemMessage, /已签发施工许可/);

  const hooksPath = join(dir, ".codex/hooks.json");
  const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
  hooks.hooks.SessionStart[0].hooks[0].command = "node scripts/governance-hooks/session-start.mjs";
  writeFileSync(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);

  const hook = join(dir, "scripts/governance-hooks/pre-tool-use-codex.mjs");
  const result = run(process.execPath, [hook], dir, JSON.stringify({
    tool_name: "Write",
    tool_input: { file_path: join(dir, "scratch.txt") },
  }));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).decision, "block");
  assert.match(JSON.parse(result.stdout).reason, /开机自检未通过|关键接线已变化/);
});

test("Stop success always emits governance badge for clean and dirty worktrees", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"
  ]).status, 0);
  commitAll(dir);
  const hook = join(dir, "scripts/governance-hooks/stop.mjs");

  const clean = run(process.execPath, [hook], dir, "{}");
  assert.equal(clean.status, 0, clean.stderr);
  const cleanPayload = JSON.parse(clean.stdout);
  assert.equal(cleanPayload.continue, true);
  assert.match(cleanPayload.systemMessage, badgeRe);
  assert.match(cleanPayload.systemMessage, /✅ 治理验证: 通过/);
  assert.doesNotMatch(cleanPayload.systemMessage, /🧾 未收口/);

  writeFileSync(join(dir, "scratch.txt"), "dirty\n");
  const dirty = run(process.execPath, [hook], dir, "{}");
  assert.equal(dirty.status, 0, dirty.stderr);
  const dirtyPayload = JSON.parse(dirty.stdout);
  assert.equal(dirtyPayload.continue, true);
  assert.match(dirtyPayload.systemMessage, badgeRe);
  assert.match(dirtyPayload.systemMessage, /✅ 治理验证: 通过/);
  assert.match(dirtyPayload.systemMessage, /🧾 未收口: 工作树仍有 \d+ 条未提交改动。/);
});

test("doctor fails when the Codex SessionStart adapter carrier is missing", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"
  ]).status, 0);
  unlinkSync(join(dir, "scripts/governance-hooks/session-start-codex.mjs"));
  const doctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.notEqual(doctor.status, 0);
  assert.match(doctor.stderr, /缺少文件: scripts\/governance-hooks\/session-start-codex\.mjs/);
});

test("doctor rejects Codex hooks top-level fields outside description/hooks", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"
  ]).status, 0);
  const hooksPath = join(dir, ".codex/hooks.json");
  const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
  hooks.$comment = "legacy field";
  writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + "\n");
  const doctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.notEqual(doctor.status, 0);
  assert.match(doctor.stderr, /\.codex\/hooks\.json 顶层字段非法: \$comment/);
});

test("doctor rejects legacy Codex SessionStart and PreToolUse wiring", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"
  ]).status, 0);
  const hooksPath = join(dir, ".codex/hooks.json");
  const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
  hooks.hooks.SessionStart[0].hooks[0].command = "node scripts/governance-hooks/session-start.mjs";
  hooks.hooks.PreToolUse[0].hooks[0].command = "node scripts/governance-hooks/pre-tool-use.mjs";
  writeFileSync(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);
  const doctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.notEqual(doctor.status, 0);
  assert.match(doctor.stderr, /Codex SessionStart 未接 JSON 开机适配器/);
  assert.match(doctor.stderr, /Codex PreToolUse 未接施工许可适配器/);
});

test("Stop falls back to a visible report hint instead of looping forever on repeated failure", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"
  ]).status, 0);
  writeFileSync(join(dir, "governance/policy.json"), "{\n", "utf8");
  const hook = join(dir, "scripts/governance-hooks/stop.mjs");

  const first = run(process.execPath, [hook], dir, "{}");
  assert.equal(first.status, 0, first.stderr);
  const firstPayload = JSON.parse(first.stdout);
  assert.equal(firstPayload.decision, "block");
  assert.match(firstPayload.reason, badgeRe);
  assert.match(firstPayload.reason, /❌ 治理验证: 失败/);
  assert.match(firstPayload.reason, /治理验证失败，请修复后再结束/);

  const second = run(process.execPath, [hook], dir, JSON.stringify({ stop_hook_active: true }));
  assert.equal(second.status, 0, second.stderr);
  const secondPayload = JSON.parse(second.stdout);
  assert.equal(secondPayload.continue, true);
  assert.match(secondPayload.systemMessage, badgeRe);
  assert.match(secondPayload.systemMessage, /❌ 治理验证: 仍未通过/);
  assert.match(secondPayload.systemMessage, /治理验证仍未通过，必须在最终报告中如实说明/);
});

test("doctor warns about Codex trust for claude-code runtime because v3.4 installs Codex hooks too", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "claude-code", "--profile", "lite", "--write"
  ]).status, 0);
  const doctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.equal(doctor.status, 0, doctor.stderr);
  assert.match(doctor.stderr, /Codex项目Hook写入后必须在新会话用 \/hooks 审核并信任当前哈希/);
});

test("doctor/lint do not leak ambiguous origin branch noise when a remote exists without fetched refs", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"
  ]).status, 0);
  assert.equal(run("git", ["remote", "add", "origin", "https://example.invalid/demo.git"], dir).status, 0);

  const lint = run(process.execPath, [join(dir, "scripts/governance-lint.mjs"), "--root", dir], dir);
  assert.equal(lint.status, 0, lint.stderr);
  assert.doesNotMatch(lint.stdout + lint.stderr, /ambiguous argument|unknown revision/);

  const doctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.equal(doctor.status, 0, doctor.stderr);
  assert.doesNotMatch(doctor.stdout + doctor.stderr, /ambiguous argument|unknown revision/);
});

test("Claude Code Standard installs shared gates and passes doctor", () => {
  const dir = project();
  const init = run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "claude-code", "--profile", "standard", "--write"]);
  assert.equal(init.status, 0, init.stderr);
  assert.match(readFileSync(join(dir, "CLAUDE.md"), "utf8"), /governance\.lock\.json/);
  assert.equal(readFileSync(join(dir, "AGENTS.md"), "utf8"), readFileSync(join(dir, "CLAUDE.md"), "utf8"));
  assert.ok(existsSync(join(dir, "scripts/claim.mjs")));
  assert.ok(existsSync(join(dir, "governance/claim-gate.md")));
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

test("Standard profile carries no Codex/OpenAI CI stowaway outside Codex runtime", () => {
  // scripts/governance-lint.mjs 对每个runtime都相同地包含 `lock.runtime === "codex"` 分支——
  // 这是共享的跨runtime校验逻辑（本身在Lite也会安装，与Standard的CI夹带问题无关），不算作item 3要清除的
  // Codex专属CI工具引用（.github/codex/**、openai/codex-action、OPENAI_API_KEY）。默认双接线的
  // .codex 三个静态hook载体是有意安装的运行时配置，单独排除；其余任何文件都不应提及。
  // 认领门是公共载体；其 `codex exec` 触发模式和 CLI 示例不是 runtime 偷渡，
  // 而是跨 runtime 的共享合同，单独排除这些共享文件再检查真正的 Codex/OpenAI 夹带。
  const exempt = new Set([
    ".codex/config.toml",
    ".codex/hooks.json",
    ".codex/rules/default.rules",
    "governance.lock.json",
    "scripts/governance-lint.mjs",
    "governance/claim-gate.md",
    "governance/policy.json",
    "scripts/claim.mjs",
    "scripts/governance-hooks/session-start-codex.mjs",
    "scripts/governance-hooks/pre-tool-use-codex.mjs",
    "scripts/lib/boot-admission.mjs",
  ]);
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
        const relativePath = relative(dir, full);
        if (relativePath === "AGENTS.md" || relativePath === "CLAUDE.md") body = body.replace("`codex exec`", "");
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

test("doctor reports lock version drift when playbookVersion不匹配", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"]).status, 0);
  const lockPath = join(dir, "governance.lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.playbookVersion = "0.0.0";
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
  const doctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.notEqual(doctor.status, 0);
  assert.match(doctor.stderr, /playbookVersion.*漂移/);
  assert.match(doctor.stderr, /普通 init 不会覆盖旧文件，禁止直接 --force/);
});

test("doctor rejects a mismatched kit fingerprint", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "codex", "--profile", "lite", "--write"]).status, 0);
  const lockPath = join(dir, "governance.lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.kitFingerprint = "sha256:not-the-installed-kit";
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
  const doctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.notEqual(doctor.status, 0);
  assert.match(doctor.stderr, /kitFingerprint 漂移/);
});

test("requirements-mode local/external 由init与doctor联动", () => {
  const local = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", local, "--runtime", "generic", "--profile", "lite", "--write"]).status, 0);
  const localBacklog = readFileSync(join(local, "docs/requirements/backlog.md"), "utf8");
  assert.match(localBacklog, /^#\s*需求\s*Backlog/m);
  assert.match(localBacklog, /^>\s*当前无已受理需求。$/m);
  assert.ok(existsSync(join(local, "docs/requirements/README.md")));
  assert.ok(existsSync(join(local, "docs/requirements/specs/_TEMPLATE.md")));
  const localDoctor = run(process.execPath, ["scripts/doctor.mjs", "--target", local]);
  assert.equal(localDoctor.status, 0, localDoctor.stderr);
  mkdirSync(join(local, "docs/requirements/specs"), { recursive: true });
  writeFileSync(
    join(local, "docs/requirements/specs/REQ-2026-001-demo.md"),
    "# 演示需求规格\n",
  );
  const activeBacklog = localBacklog.replace(
    "> 当前无已受理需求。",
    "- [ ] REQ-2026-001 | owner: team-a | priority: P1 | title: 交付一个可验收结果\n  - source_refs: customer-brief.md\n  - spec_refs: specs/REQ-2026-001-demo.md\n  - acceptance: 通过可执行验收清单\n  - evidence: pending",
  );
  writeFileSync(join(local, "docs/requirements/backlog.md"), activeBacklog);
  const activeDoctor = run(process.execPath, ["scripts/doctor.mjs", "--target", local]);
  assert.equal(activeDoctor.status, 0, activeDoctor.stderr);
  writeFileSync(
    join(local, "docs/requirements/backlog.md"),
    activeBacklog.replace("## 进行中需求\n", "## 进行中需求\n\n> 当前无已受理需求。\n"),
  );
  const conflictingDoctor = run(process.execPath, ["scripts/doctor.mjs", "--target", local]);
  assert.notEqual(conflictingDoctor.status, 0);
  assert.match(conflictingDoctor.stderr, /不能同时声明空状态和进行中需求/);
  const localPolicy = JSON.parse(readFileSync(join(local, "governance/policy.json"), "utf8"));
  assert.equal(localPolicy.requirements.mode, "local");
  assert.equal(localPolicy.requirements.source, "docs/requirements/backlog.md");
  assert.deepEqual(localPolicy.requirements.validator, []);

  const external = project();
  const invalid = run(process.execPath, [
    "scripts/init.mjs",
    "--target", external,
    "--runtime", "generic",
    "--profile", "lite",
    "--requirements-mode", "external",
    "--requirements-source", "mailto:team@example.com",
    "--write"
  ]);
  assert.notEqual(invalid.status, 0);
  assert.equal(
    run(process.execPath, [
      "scripts/init.mjs",
      "--target", external,
      "--runtime", "generic",
      "--profile", "lite",
      "--requirements-mode", "external",
      "--requirements-source", "https://issues.example.com/ai-governance-playbook",
      "--write"
    ]).status,
    0,
  );
  const externalIndex = readFileSync(join(external, "docs/index.md"), "utf8");
  const requirementsSource = "https://issues.example.com/ai-governance-playbook";
  assert.match(externalIndex, new RegExp(`\\| 需求 \\| \\[需求\\]\\(${requirementsSource}\\) \\|`));
  const hasBacklog = existsSync(join(external, "docs/requirements/backlog.md"));
  assert.equal(hasBacklog, false);
  const externalDoctor = run(process.execPath, ["scripts/doctor.mjs", "--target", external]);
  assert.equal(externalDoctor.status, 0, externalDoctor.stderr);
  const externalPolicy = JSON.parse(readFileSync(join(external, "governance/policy.json"), "utf8"));
  assert.equal(externalPolicy.requirements.mode, "external");
  assert.equal(externalPolicy.requirements.source, requirementsSource);
  assert.deepEqual(externalPolicy.requirements.validator, []);
});

test("doctor ignores installer-owned TODO examples but still reports a project TODO", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "standard", "--write"
  ]).status, 0);

  const cleanDoctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.equal(cleanDoctor.status, 0, cleanDoctor.stderr);
  assert.doesNotMatch(cleanDoctor.stderr, /docs\/requirements\/README\.md/);
  assert.doesNotMatch(cleanDoctor.stderr, /docs\/requirements\/specs\/_TEMPLATE\.md/);

  const projectTodo = "\nTODO(owner): 测试\n";
  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    writeFileSync(join(dir, file), readFileSync(join(dir, file), "utf8") + projectTodo);
  }
  const todoDoctor = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.equal(todoDoctor.status, 0, todoDoctor.stderr);
  assert.match(todoDoctor.stderr, /仍有待项目化内容/);
  assert.match(todoDoctor.stderr, /AGENTS\.md/);
  assert.doesNotMatch(todoDoctor.stderr, /docs\/requirements\/(?:README\.md|specs\/_TEMPLATE\.md)/);
});

test("doctor ignores code examples and changelog history without weakening TODO detection", () => {
  const dir = project();
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "standard", "--write"
  ]).status, 0);

  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    const body = readFileSync(join(dir, file), "utf8");
    writeFileSync(join(dir, file), body.replace(
      "TODO(owner): 用一段话确认项目目的、当前阶段和取舍倾向。",
      "本项目为团队提供可审计的治理脚手架，当前阶段聚焦稳定交付和可验证门禁。"
    ).replace("- TODO(owner): 添加项目特定红线；没有就删除本行。\n", ""));
  }
  const confirmed = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.equal(confirmed.status, 0, confirmed.stderr);
  assert.doesNotMatch(confirmed.stderr, /仍有待项目化内容: .*\b(?:AGENTS|CLAUDE)\.md/);

  writeFileSync(join(dir, "CHANGELOG.md"), "\nTODO(owner): historical note\n待负责人确认\n", { flag: "a" });
  const withHistory = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.equal(withHistory.status, 0, withHistory.stderr);
  assert.doesNotMatch(withHistory.stderr, /CHANGELOG\.md/);

  const codeExamples = [
    "```text",
    "TODO(owner): example",
    "```",
    "`TODO(owner): example`",
    ""
  ].join("\n");
  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    writeFileSync(join(dir, file), `${readFileSync(join(dir, file), "utf8")}\n${codeExamples}`);
  }
  const withExamples = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.equal(withExamples.status, 0, withExamples.stderr);
  assert.doesNotMatch(withExamples.stderr, /仍有待项目化内容: .*AGENTS\.md/);

  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    writeFileSync(join(dir, file), `${readFileSync(join(dir, file), "utf8")}\nTODO(owner): 测试\n`);
  }
  const withProjectTodo = run(process.execPath, ["scripts/doctor.mjs", "--target", dir]);
  assert.equal(withProjectTodo.status, 0, withProjectTodo.stderr);
  assert.match(withProjectTodo.stderr, /仍有待项目化内容/);
  assert.match(withProjectTodo.stderr, /AGENTS\.md/);
});

test("local semantic requirements checker cannot be replaced with a successful custom validator", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite", "--write"]).status, 0);
  const policyPath = join(dir, "governance/policy.json");
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  policy.requirements.validator = [["true"]];
  writeFileSync(policyPath, JSON.stringify(policy, null, 2) + "\n");
  writeFileSync(join(dir, "docs/requirements/backlog.md"), "# 需求 Backlog\n\n## 进行中需求\n\n- [ ] REQ-GOV-001 | title: invalid\n");
  const lint = run(process.execPath, [join(dir, "scripts/governance-lint.mjs"), "--root", dir], dir);
  assert.notEqual(lint.status, 0);
  assert.match(lint.stderr, /requirements-check/);
});

test("credential derived files are a git-check-ignore hard gate", () => {
  const dir = project();
  writeFileSync(join(dir, ".gitignore"), ".env.local\n");
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite", "--write"]).status, 0);
  for (const lintScript of [join(dir, "scripts/governance-lint.mjs"), "scripts/governance-lint.mjs"]) {
    const lint = run(process.execPath, [lintScript, "--root", dir], kit);
    assert.notEqual(lint.status, 0, lintScript);
    assert.match(lint.stderr, /\.gitignore 未忽略凭据派生文件/);
    assert.match(lint.stderr, /\.env\.production/);
  }
});

test("external mode rejects pointer drift across policy, instruction, and docs index", () => {
  const dir = project();
  const source = "https://issues.example.com/requirements";
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite",
    "--requirements-mode", "external", "--requirements-source", source, "--write",
  ]).status, 0);
  writeFileSync(join(dir, "AGENTS.md"), readFileSync(join(dir, "AGENTS.md"), "utf8").replace(source, "https://wrong.example.com/requirements"));
  for (const lintScript of [join(dir, "scripts/governance-lint.mjs"), "scripts/governance-lint.mjs"]) {
    const lint = run(process.execPath, [lintScript, "--root", dir], kit);
    assert.notEqual(lint.status, 0, lintScript);
    assert.match(lint.stderr, /external 需求指针不一致: AGENTS\.md/);
  }
});

test("ordinary init preserves an installed external policy and lock when requirements arguments are omitted", () => {
  const dir = project();
  const source = "https://issues.example.com/requirements";
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite",
    "--requirements-mode", "external", "--requirements-source", source, "--write",
  ]).status, 0);
  const policyPath = join(dir, "governance/policy.json");
  const lockPath = join(dir, "governance.lock.json");
  const beforePolicy = readFileSync(policyPath, "utf8");
  const beforeLock = readFileSync(lockPath, "utf8");
  const rerun = run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite", "--write"]);
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.equal(readFileSync(policyPath, "utf8"), beforePolicy);
  assert.equal(readFileSync(lockPath, "utf8"), beforeLock);
  assert.ok(!existsSync(join(dir, "docs/requirements/backlog.md")));
});

test("local requirements source must match the built-in checker authority", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite", "--write"]).status, 0);
  const policyPath = join(dir, "governance/policy.json");
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  policy.requirements.source = "docs/other-requirements.md";
  writeFileSync(policyPath, JSON.stringify(policy, null, 2) + "\n");
  for (const lintScript of [join(dir, "scripts/governance-lint.mjs"), "scripts/governance-lint.mjs"]) {
    const lint = run(process.execPath, [lintScript, "--root", dir], kit);
    assert.notEqual(lint.status, 0, lintScript);
    assert.match(lint.stderr, /local 模式 requirements\.source 必须为 docs\/requirements\/backlog\.md/);
  }
});

test("requirements validator rejects non-array shapes instead of silently disabling project checks", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite", "--write"]).status, 0);
  const policyPath = join(dir, "governance/policy.json");
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  policy.requirements.validator = "true";
  writeFileSync(policyPath, JSON.stringify(policy, null, 2) + "\n");
  for (const lintScript of [join(dir, "scripts/governance-lint.mjs"), "scripts/governance-lint.mjs"]) {
    const lint = run(process.execPath, [lintScript, "--root", dir], kit);
    assert.notEqual(lint.status, 0, lintScript);
    assert.match(lint.stderr, /requirements\.validator 形态非法/);
  }
});

test("ordinary init refuses to half-migrate an installed local project to external", () => {
  const dir = project();
  assert.equal(run(process.execPath, ["scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite", "--write"]).status, 0);
  const result = run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite",
    "--requirements-mode", "external", "--requirements-source", "https://issues.example.com/requirements", "--write",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /不能由 init 直接切换到 external/);
  assert.match(result.stderr, /--force 只覆盖文件，不是安全迁移手段/);
  const policy = JSON.parse(readFileSync(join(dir, "governance/policy.json"), "utf8"));
  assert.equal(policy.requirements.mode, "local");
});

test("ordinary init refuses to half-migrate an installed external project to local", () => {
  const dir = project();
  const source = "https://issues.example.com/requirements";
  assert.equal(run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite",
    "--requirements-mode", "external", "--requirements-source", source, "--write",
  ]).status, 0);
  const policyPath = join(dir, "governance/policy.json");
  const lockPath = join(dir, "governance.lock.json");
  const instructionPath = join(dir, "AGENTS.md");
  const docsIndexPath = join(dir, "docs/index.md");
  const requirementsDir = join(dir, "docs/requirements");
  const beforePolicy = readFileSync(policyPath, "utf8");
  const beforeLock = readFileSync(lockPath, "utf8");
  const beforeInstruction = readFileSync(instructionPath, "utf8");
  const beforeDocsIndex = readFileSync(docsIndexPath, "utf8");
  assert.ok(!existsSync(requirementsDir));

  const result = run(process.execPath, [
    "scripts/init.mjs", "--target", dir, "--runtime", "generic", "--profile", "lite",
    "--requirements-mode", "local", "--write",
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /不能由 init 直接切换到 local/);
  assert.match(result.stderr, /--force 只覆盖文件，不是安全迁移手段/);
  assert.equal(readFileSync(policyPath, "utf8"), beforePolicy);
  assert.equal(readFileSync(lockPath, "utf8"), beforeLock);
  assert.equal(readFileSync(instructionPath, "utf8"), beforeInstruction);
  assert.equal(readFileSync(docsIndexPath, "utf8"), beforeDocsIndex);
  assert.ok(!existsSync(requirementsDir));
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
  // 问题队列是 `##` 标题制(v3.2.0 起,与跨项目收件箱聚合器同一判据):一问一标题,标题行含「已裁决」即闭环
  writeFileSync(join(dir, "governance/questions.md"), "# 待裁决问题\n\n## 未结的一个问题\n\n背景一行。\n\n## 已经拍过的问题 已裁决\n\n结论一行。\n");
  const review = run(process.execPath, ["scripts/weekly-governance-review.mjs"], dir);
  assert.equal(review.status, 0, review.stderr);
  assert.match(review.stdout, /待裁决问题\(未结\)：1/);   // 两个 ## 里只有一个未结
  assert.match(review.stdout, /事故条目：1/);
  assert.match(review.stdout, /事故簿流量：/);              // 流量对账读数在位
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
