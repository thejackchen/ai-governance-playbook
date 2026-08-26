import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, join, resolve } from "node:path";

export const DEFAULT_BOOT_ADMISSION_TTL_MS = 12 * 60 * 60 * 1000;

const UNIVERSAL_CRITICAL_FILES = [
    "governance.lock.json",
    ".codex/hooks.json",
    ".claude/settings.json",
    ".grok/hooks/governance.json",
    "AGENTS.md",
    "CLAUDE.md",
    "docs/index.md",
    "governance/policy.json",
    "scripts/governance-status.mjs",
    "scripts/governance-verify.mjs",
    "scripts/governance-lint.mjs",
    "scripts/governance-hooks/session-start.mjs",
    "scripts/governance-hooks/session-start-admission.mjs",
    "scripts/governance-hooks/session-start-codex.mjs",
    "scripts/governance-hooks/pre-tool-use.mjs",
    "scripts/governance-hooks/pre-tool-use-admission.mjs",
    "scripts/governance-hooks/pre-tool-use-codex.mjs",
    "scripts/lib/boot-admission.mjs",
    "scripts/lib/extra-repo-facts.mjs",
    "scripts/lib/integration-line.mjs",
];
const CRITICAL_FILES = {
  universal: UNIVERSAL_CRITICAL_FILES,
  codex: UNIVERSAL_CRITICAL_FILES,
};

const CODEX_SESSION_COMMAND = 'node "$(git rev-parse --show-toplevel)/scripts/governance-hooks/session-start-codex.mjs"';
const CODEX_PRETOOL_COMMAND = 'node "$(git rev-parse --show-toplevel)/scripts/governance-hooks/pre-tool-use-codex.mjs"';
const SHARED_SESSION_COMMAND = 'node "$(git rev-parse --show-toplevel)/scripts/governance-hooks/session-start-admission.mjs"';
const SHARED_PRETOOL_COMMAND = 'node "$(git rev-parse --show-toplevel)/scripts/governance-hooks/pre-tool-use-admission.mjs"';
const WRITE_TOOL_ALIASES = ["Bash", "run_terminal_command", "apply_patch", "Edit", "Write", "MultiEdit", "search_replace"];

function canonicalRoot(root) {
  try { return realpathSync.native(root); } catch { return resolve(root); }
}

function readJson(path) {
  try {
    return { ok: true, value: JSON.parse(readFileSync(path, "utf8")) };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
  }
}

function hashCriticalFiles(root, runtime) {
  const hash = createHash("sha256");
  for (const relativePath of CRITICAL_FILES[runtime] || ["governance.lock.json"]) {
    const path = join(root, relativePath);
    hash.update(relativePath);
    hash.update("\0");
    if (existsSync(path)) hash.update(readFileSync(path));
    else hash.update("<missing>");
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function eventCommands(config, event) {
  return (config?.hooks?.[event] || []).flatMap((entry) => entry?.hooks || [])
    .map((hook) => String(hook?.command || "").trim())
    .filter(Boolean);
}

function checkSingleManagedCommand(add, config, event, expected, id) {
  const commands = eventCommands(config, event);
  add(id, commands.length === 1 && commands[0] === expected, commands.length ? commands.join(" | ") : "missing");
}

function eventMatchers(config, event) {
  return (config?.hooks?.[event] || []).map((entry) => String(entry?.matcher || "")).filter(Boolean);
}

function checkWriteMatcherCoverage(add, config, id) {
  const matcher = eventMatchers(config, "PreToolUse").join("|");
  const missing = WRITE_TOOL_ALIASES.filter((name) => !new RegExp(`(?:^|\\|)${name}(?:\\||$)`, "i").test(matcher));
  add(id, missing.length === 0, missing.length ? `missing ${missing.join(",")}` : matcher);
}

function runProjectVerifier(root) {
  const verifier = join(root, "scripts/governance-verify.mjs");
  if (!existsSync(verifier)) return { ok: false, detail: "missing scripts/governance-verify.mjs" };
  const result = spawnSync(process.execPath, [verifier, "--fast"], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, GOVERNANCE_BOOT_VALIDATION: "1" },
  });
  if (result.error) return { ok: false, detail: result.error.message };
  if (result.status !== 0) {
    const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim().split(/\r?\n/).slice(-4).join(" | ");
    return { ok: false, detail: output || `exit ${result.status}` };
  }
  return { ok: true, detail: "scripts/governance-verify.mjs --fast passed" };
}

export function inspectBootReadiness(root, { runtime = "universal", sharedMessage = "", runProjectValidation = false } = {}) {
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, ok: Boolean(ok), detail });
  const lockResult = readJson(join(root, "governance.lock.json"));
  const version = lockResult.ok ? String(lockResult.value?.playbookVersion || "") : "";
  add("lock", lockResult.ok && /^\d+\.\d+\.\d+/.test(version), lockResult.ok ? `v${version || "?"}` : lockResult.error);
  const adaptation = lockResult.ok ? lockResult.value?.adaptation : null;
  add(
    "adaptation",
    adaptation?.deterministicStatus === "pass" && adaptation?.sourceVersion === version,
    adaptation ? `${adaptation.deterministicStatus || "unknown"}@${adaptation.sourceVersion || "?"}` : "missing"
  );

  for (const relativePath of ["AGENTS.md", "CLAUDE.md", "docs/index.md", "governance/policy.json"]) {
    add(`authority:${relativePath}`, existsSync(join(root, relativePath)), relativePath);
  }

  let carrierCount = 0;
  const installedFiles = new Set(lockResult.ok && Array.isArray(lockResult.value?.installedFiles) ? lockResult.value.installedFiles : []);
  const codexExpected = installedFiles.has(".codex/hooks.json") || existsSync(join(root, ".codex/hooks.json"));
  if (codexExpected) {
    carrierCount += 1;
    const hookResult = readJson(join(root, ".codex/hooks.json"));
    add("codex-hooks", hookResult.ok, hookResult.ok ? ".codex/hooks.json" : hookResult.error);
    if (hookResult.ok) {
      checkSingleManagedCommand(add, hookResult.value, "SessionStart", CODEX_SESSION_COMMAND, "codex-session-adapter");
      checkSingleManagedCommand(add, hookResult.value, "PreToolUse", CODEX_PRETOOL_COMMAND, "codex-pretool-adapter");
      checkWriteMatcherCoverage(add, hookResult.value, "codex-pretool-matcher");
    }
  }

  const claudeExpected = installedFiles.has(".claude/settings.json") || existsSync(join(root, ".claude/settings.json"));
  if (claudeExpected) {
    carrierCount += 1;
    const hookResult = readJson(join(root, ".claude/settings.json"));
    add("claude-hooks", hookResult.ok, hookResult.ok ? ".claude/settings.json" : hookResult.error);
    if (hookResult.ok) {
      checkSingleManagedCommand(add, hookResult.value, "SessionStart", SHARED_SESSION_COMMAND, "claude-session-adapter");
      checkSingleManagedCommand(add, hookResult.value, "PreToolUse", SHARED_PRETOOL_COMMAND, "claude-pretool-adapter");
      checkWriteMatcherCoverage(add, hookResult.value, "claude-pretool-matcher");
    }
  }

  const grokExpected = installedFiles.has(".grok/hooks/governance.json") || existsSync(join(root, ".grok/hooks/governance.json"));
  if (grokExpected) {
    carrierCount += 1;
    const hookResult = readJson(join(root, ".grok/hooks/governance.json"));
    add("grok-hooks", hookResult.ok, hookResult.ok ? ".grok/hooks/governance.json" : hookResult.error);
    if (hookResult.ok) {
      checkSingleManagedCommand(add, hookResult.value, "SessionStart", SHARED_SESSION_COMMAND, "grok-session-adapter");
      checkSingleManagedCommand(add, hookResult.value, "PreToolUse", SHARED_PRETOOL_COMMAND, "grok-pretool-adapter");
      checkWriteMatcherCoverage(add, hookResult.value, "grok-pretool-matcher");
    }
  }
  add("runtime-carrier", carrierCount > 0, carrierCount ? `${carrierCount} carrier(s)` : "missing");

  if (runProjectValidation) {
    const projectValidation = runProjectVerifier(root);
    add("project-validator", projectValidation.ok, projectValidation.detail);
  }

  if (sharedMessage) {
    const badge = version ? new RegExp(`三句核心\\s+v${version.replaceAll(".", "\\.")}`) : null;
    add("injected-version", Boolean(badge?.test(sharedMessage)), version ? `v${version}` : "unknown version");
    add("injected-boot", /治理启动状态|boot\(|当前游标/.test(sharedMessage), "shared SessionStart output");
  }
  try {
    add("admission-store", true, gitCommonDir(root));
  } catch (cause) {
    add("admission-store", false, cause instanceof Error ? cause.message : String(cause));
  }

  return {
    ok: checks.every((check) => check.ok),
    runtime,
    version,
    fingerprint: hashCriticalFiles(root, runtime),
    checks,
  };
}

function gitCommonDir(root) {
  const result = spawnSync("git", ["-C", root, "rev-parse", "--git-common-dir"], {
    encoding: "utf8",
    timeout: 3000,
  });
  if (result.status !== 0) throw new Error("无法解析 git common dir");
  const raw = String(result.stdout || "").trim();
  if (!raw) throw new Error("git common dir 为空");
  return isAbsolute(raw) ? raw : resolve(root, raw);
}

export function admissionPath(root, runtime = "universal") {
  const worktreeId = createHash("sha256").update(canonicalRoot(root)).digest("hex").slice(0, 16);
  return join(gitCommonDir(root), "ai-governance-admissions", `${worktreeId}-${runtime}.json`);
}

export function revokeBootAdmission(root, runtime = "universal") {
  try { rmSync(admissionPath(root, runtime), { force: true }); } catch {}
}

export function issueBootAdmission(root, {
  runtime = "universal",
  sharedMessage = "",
  now = Date.now(),
  ttlMs = DEFAULT_BOOT_ADMISSION_TTL_MS,
} = {}) {
  const readiness = inspectBootReadiness(root, { runtime, sharedMessage, runProjectValidation: true });
  if (!readiness.ok) {
    revokeBootAdmission(root, runtime);
    return { ok: false, readiness, admission: null };
  }
  const path = admissionPath(root, runtime);
  mkdirSync(dirname(path), { recursive: true });
  const admission = {
    schemaVersion: 1,
    admissionId: randomUUID(),
    runtime,
    projectRoot: canonicalRoot(root),
    playbookVersion: readiness.version,
    fingerprint: readiness.fingerprint,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
  };
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(admission, null, 2)}\n`, { mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, path);
  return { ok: true, readiness, admission, path };
}

export function validateBootAdmission(root, { runtime = "universal", now = Date.now() } = {}) {
  const readiness = inspectBootReadiness(root, { runtime });
  if (!readiness.ok) return { ok: false, reason: "开机自检未通过", readiness };
  let admission;
  try {
    admission = JSON.parse(readFileSync(admissionPath(root, runtime), "utf8"));
  } catch {
    return { ok: false, reason: "本次会话没有施工许可", readiness };
  }
  if (admission.runtime !== runtime || admission.projectRoot !== canonicalRoot(root)) {
    return { ok: false, reason: "施工许可不属于当前项目或运行时", readiness };
  }
  if (Date.parse(admission.expiresAt || "") <= now) {
    return { ok: false, reason: "施工许可已过期，请重新开始会话", readiness };
  }
  if (admission.playbookVersion !== readiness.version || admission.fingerprint !== readiness.fingerprint) {
    return { ok: false, reason: "治理版本或关键接线已变化，请重新开始会话", readiness };
  }
  return { ok: true, reason: "允许施工", readiness, admission };
}

export function formatBootReadiness(readiness) {
  const failed = readiness.checks.filter((check) => !check.ok);
  if (readiness.ok) return `✅ 开机自检: 治理 v${readiness.version} · 规则注入成功 · 接线正常 · 已签发施工许可`;
  return `❌ 开机自检失败: ${failed.map((check) => `${check.id}=${check.detail}`).join("；")} · 禁止施工，只允许查看和诊断`;
}
