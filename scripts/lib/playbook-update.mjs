import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { compareVersions, fingerprintKit, KIT_ROOT, VERSION } from "../lib.mjs";

export const DEFAULT_CHANNEL = "https://raw.githubusercontent.com/thejackchen/ai-governance-playbook/main";
export const DEFAULT_CACHE_SECONDS = 6 * 60 * 60;

// 只补缺失的治理载体，绝不覆盖项目已经改过的文件。这是「软件自动更新」里对用户设置的那一层。
export const SAFE_ADDITIONS = [
  "docs/ops/extra-repo-facts.json",
  "docs/ops/extra-repo-facts.md",
  "scripts/lib/extra-repo-facts.mjs",
  ".grok/hooks/governance.json",
  "scripts/governance-hooks/session-start-codex.mjs",
  "scripts/governance-hooks/pre-tool-use-codex.mjs",
  "scripts/lib/boot-admission.mjs",
  "scripts/governance-hooks/pre-compact.mjs",
  "scripts/governance-hooks/pre-compact-codex.mjs",
  "scripts/lib/integration-line.mjs",
  "scripts/requirements-check.mjs",
  "scripts/governance-verify.mjs",
];

// 这些文件是运行时协议的薄适配器，不得承载项目事实；升级时由 playbook 管理。
// 项目宪法、policy、游标和共享治理逻辑不在这里，仍然绝不原样覆盖。
export const MANAGED_RUNTIME_FILES = [
  "scripts/governance-hooks/session-start-codex.mjs",
  "scripts/governance-hooks/pre-tool-use-codex.mjs",
  "scripts/lib/boot-admission.mjs",
];

const PRECOMPACT_TEXT_CMD = 'node "$(git rev-parse --show-toplevel)/scripts/governance-hooks/pre-compact.mjs"';
const PRECOMPACT_CODEX_CMD = 'node "$(git rev-parse --show-toplevel)/scripts/governance-hooks/pre-compact-codex.mjs"';
const SESSION_START_CODEX_CMD = 'node "$(git rev-parse --show-toplevel)/scripts/governance-hooks/session-start-codex.mjs"';
const PRETOOL_CODEX_CMD = 'node "$(git rev-parse --show-toplevel)/scripts/governance-hooks/pre-tool-use-codex.mjs"';

function sameBytes(left, right) {
  return existsSync(left) && existsSync(right) && readFileSync(left).equals(readFileSync(right));
}

export function refreshManagedRuntimeFiles(projectRoot, kitRoot = KIT_ROOT) {
  const updated = [];
  for (const relativePath of MANAGED_RUNTIME_FILES) {
    const source = kitSourcePath(relativePath, kitRoot);
    const dest = join(projectRoot, relativePath);
    if (!existsSync(source)) continue;
    if (sameBytes(source, dest)) continue;
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(source, dest);
    updated.push(relativePath);
  }
  return updated;
}

function setCommand(json, event, command, { matcher, timeout, statusMessage } = {}) {
  if (!json.hooks || typeof json.hooks !== "object") json.hooks = {};
  if (!json.hooks[event]?.[0]?.hooks?.[0]) {
    json.hooks[event] = [{
      ...(matcher ? { matcher } : {}),
      hooks: [{ type: "command", command, ...(timeout ? { timeout } : {}), ...(statusMessage ? { statusMessage } : {}) }],
    }];
    return;
  }
  json.hooks[event][0].hooks[0].command = command;
}

function eventCommands(json, event) {
  return (json?.hooks?.[event] || []).flatMap((entry) => entry?.hooks || [])
    .map((hook) => String(hook?.command || ""))
    .filter(Boolean);
}

export function patchCodexRuntimeHooks(projectRoot) {
  const path = join(projectRoot, ".codex/hooks.json");
  if (!existsSync(path)) return { patched: [], conflicts: [] };
  let current;
  try {
    current = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    return { patched: [], conflicts: [`.codex/hooks.json 无法解析: ${cause instanceof Error ? cause.message : String(cause)}`] };
  }
  const json = structuredClone(current);
  const conflicts = [];
  let changed = false;
  for (const event of ["SessionStart", "PreToolUse"]) {
    if (eventCommands(current, event).length > 1) {
      conflicts.push(`Codex ${event} 包含额外定制 Hook，未覆盖`);
    }
  }
  const session = String(json?.hooks?.SessionStart?.[0]?.hooks?.[0]?.command || "");
  if (!session) {
    setCommand(json, "SessionStart", SESSION_START_CODEX_CMD, {
      matcher: "startup|resume|clear|compact",
      timeout: 30,
      statusMessage: "读取治理状态",
    });
    changed = true;
  } else if (!/session-start-codex\.mjs/.test(session)) {
    if (/session-start\.mjs/.test(session)) {
      setCommand(json, "SessionStart", SESSION_START_CODEX_CMD);
      changed = true;
    } else {
      conflicts.push(`Codex SessionStart 是未知定制，未覆盖: ${session}`);
    }
  }

  const pretool = String(json?.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command || "");
  if (!pretool) {
    setCommand(json, "PreToolUse", PRETOOL_CODEX_CMD, {
      matcher: "Bash|apply_patch|Edit|Write",
      timeout: 30,
      statusMessage: "检查治理策略",
    });
    changed = true;
  } else if (!/pre-tool-use-codex\.mjs/.test(pretool)) {
    if (/pre-tool-use\.mjs/.test(pretool)) {
      setCommand(json, "PreToolUse", PRETOOL_CODEX_CMD);
      changed = true;
    } else {
      conflicts.push(`Codex PreToolUse 是未知定制，未覆盖: ${pretool}`);
    }
  }
  const precompact = String(json?.hooks?.PreCompact?.[0]?.hooks?.[0]?.command || "");
  if (precompact && !/\becho\b/.test(precompact) && !/pre-compact(?:-codex)?\.mjs/.test(precompact)) {
    conflicts.push(`Codex PreCompact 是未知定制，未覆盖: ${precompact}`);
  }
  // 同一配置内只要有一个未知定制，整个 Codex 接线迁移都不落盘，避免半适配状态。
  if (conflicts.length) return { patched: [], conflicts };
  if (changed) writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  return { patched: changed ? [".codex/hooks.json"] : [], conflicts };
}

function needsPreCompactPatch(command = "") {
  if (!command) return true;
  if (/\becho\b/.test(command)) return true;
  return false;
}

export function patchPreCompactHooks(projectRoot) {
  const patched = [];
  const targets = [
    {
      rel: ".codex/hooks.json",
      command: PRECOMPACT_CODEX_CMD,
      extra: { timeout: 30, statusMessage: "压缩前检查坐标" },
    },
    {
      rel: ".claude/settings.json",
      command: PRECOMPACT_TEXT_CMD,
      extra: { timeout: 30 },
    },
    {
      rel: ".grok/hooks/governance.json",
      command: PRECOMPACT_TEXT_CMD,
      extra: { timeout: 30 },
    },
  ];
  for (const target of targets) {
    const path = join(projectRoot, target.rel);
    if (!existsSync(path)) continue;
    let json;
    try {
      json = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      continue;
    }
    if (!json.hooks || typeof json.hooks !== "object") continue;
    const current = json.hooks.PreCompact?.[0]?.hooks?.[0]?.command || "";
    if (!needsPreCompactPatch(current)) continue;
    json.hooks.PreCompact = [{
      hooks: [{ type: "command", command: target.command, ...target.extra }],
    }];
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
    patched.push(target.rel);
  }
  return patched;
}

const INTEGRATION_BOOT = `try {
  const { formatIntegrationLineReport, inspectIntegrationLine } = await import("../lib/integration-line.mjs");
  console.log(formatIntegrationLineReport(inspectIntegrationLine(root, { fetch: true })));
} catch {
  console.log("🛤 公共主干: 检查失败（不阻断开工）");
}
`;

const INTEGRATION_GATE = `try {
  const { evaluateIntegrationLineGate } = await import("../lib/integration-line.mjs");
  const integrationReason = evaluateIntegrationLineGate({
    root,
    toolName,
    toolInput,
    candidates,
    policy,
  });
  if (integrationReason) block(integrationReason);
} catch { /* 主干守卫失败不误拦 */ }
`;

export function patchIntegrationLineHooks(projectRoot) {
  const patched = [];
  const sessionPath = join(projectRoot, "scripts/governance-hooks/session-start.mjs");
  if (existsSync(sessionPath)) {
    const body = readFileSync(sessionPath, "utf8");
    if (!body.includes("integration-line.mjs")) {
      writeFileSync(sessionPath, `${body.trimEnd()}\n${INTEGRATION_BOOT}`);
      patched.push("scripts/governance-hooks/session-start.mjs");
    }
  }
  const pretoolPath = join(projectRoot, "scripts/governance-hooks/pre-tool-use.mjs");
  if (existsSync(pretoolPath)) {
    const body = readFileSync(pretoolPath, "utf8");
    if (!body.includes("integration-line.mjs") && body.includes("process.exit(0)")) {
      writeFileSync(pretoolPath, body.replace(
        /if \(claimGateReason\) block\(claimGateReason\);\n\nprocess\.exit\(0\);/,
        `if (claimGateReason) block(claimGateReason);\n${INTEGRATION_GATE}\nprocess.exit(0);`,
      ));
      const next = readFileSync(pretoolPath, "utf8");
      if (next.includes("integration-line.mjs")) patched.push("scripts/governance-hooks/pre-tool-use.mjs");
    }
  }
  return patched;
}

export function kitSourcePath(relativePath, kitRoot = KIT_ROOT) {
  return join(kitRoot, "templates/common", relativePath);
}

export function readLock(projectRoot) {
  const path = join(projectRoot, "governance.lock.json");
  if (!existsSync(path)) return { path, lock: null };
  try {
    return { path, lock: JSON.parse(readFileSync(path, "utf8")) };
  } catch (cause) {
    return { path, lock: null, error: cause instanceof Error ? cause.message : String(cause) };
  }
}

export function readUpdatePolicy(projectRoot) {
  const defaults = {
    channel: DEFAULT_CHANNEL,
    check: "session-start",
    apply: "safe",
    cacheSeconds: DEFAULT_CACHE_SECONDS,
  };
  try {
    const policy = JSON.parse(readFileSync(join(projectRoot, "governance/policy.json"), "utf8"));
    return { ...defaults, ...(policy.playbookUpdate || {}) };
  } catch {
    return defaults;
  }
}

export async function fetchLatestVersion(channel = DEFAULT_CHANNEL, { fetchImpl = fetch, timeoutMs = 3000, kitRoot = KIT_ROOT } = {}) {
  const url = `${String(channel).replace(/\/$/, "")}/VERSION`;
  spawnSync("git", ["-C", kitRoot, "fetch", "-q", "origin"], { timeout: 8000, stdio: "ignore" });
  const git = spawnSync("git", ["-C", kitRoot, "show", "origin/main:VERSION"], {
    encoding: "utf8",
    timeout: 5000,
  });
  const gitVersion = String(git.stdout || "").trim();
  if (git.status === 0 && /^\d+\.\d+\.\d+/.test(gitVersion)) {
    return { ok: true, version: gitVersion, url: "origin/main:VERSION" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${url}?t=${Date.now()}`, {
      signal: controller.signal,
      headers: { "cache-control": "no-cache", pragma: "no-cache" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const version = String(await response.text()).trim();
    if (!/^\d+\.\d+\.\d+/.test(version)) throw new Error("VERSION 不是 x.y.z");
    return { ok: true, version, url };
  } catch (cause) {
    return { ok: false, version: null, url, error: cause instanceof Error ? cause.message : String(cause) };
  } finally {
    clearTimeout(timer);
  }
}

export function cachePath() {
  return join(homedir(), ".cache", "ai-governance-playbook", "latest.json");
}

export function readCache(now = Date.now(), maxAgeSeconds = DEFAULT_CACHE_SECONDS) {
  const path = cachePath();
  if (!existsSync(path)) return null;
  try {
    const cached = JSON.parse(readFileSync(path, "utf8"));
    if (!cached?.checkedAt || !cached.version) return null;
    if (now - Date.parse(cached.checkedAt) > maxAgeSeconds * 1000) return null;
    return cached;
  } catch {
    return null;
  }
}

export function writeCache(latest) {
  const path = cachePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...latest, checkedAt: new Date().toISOString() }, null, 2)}\n`);
}

export function planSafeAdditions(projectRoot, kitRoot = KIT_ROOT) {
  const planned = [];
  for (const relativePath of SAFE_ADDITIONS) {
    const dest = join(projectRoot, relativePath);
    const source = kitSourcePath(relativePath, kitRoot);
    if (!existsSync(source)) continue;
    if (existsSync(dest)) planned.push({ relativePath, action: "skip", reason: "already exists" });
    else planned.push({ relativePath, action: "add", source, dest });
  }
  return planned;
}

export function applySafeAdditions(projectRoot, kitRoot = KIT_ROOT) {
  const planned = planSafeAdditions(projectRoot, kitRoot);
  const added = [];
  for (const item of planned) {
    if (item.action !== "add") continue;
    mkdirSync(dirname(item.dest), { recursive: true });
    copyFileSync(item.source, item.dest);
    added.push(item.relativePath);
  }
  return { planned, added };
}

export function kitVersionOf(kitRoot = KIT_ROOT) {
  try {
    return JSON.parse(readFileSync(join(kitRoot, "package.json"), "utf8")).version;
  } catch {
    return VERSION;
  }
}

export function writeUpgradedLock(projectRoot, kitRoot = KIT_ROOT, { deterministicStatus = "pass" } = {}) {
  const { path, lock, error } = readLock(projectRoot);
  if (!lock) throw new Error(error || "缺少 governance.lock.json，不能升级；新仓请走 init");
  const additions = SAFE_ADDITIONS.filter((relativePath) => existsSync(join(projectRoot, relativePath)));
  const installedFiles = [...new Set([...(lock.installedFiles || []), ...additions])].sort();
  const next = {
    ...lock,
    playbookVersion: kitVersionOf(kitRoot),
    kitFingerprint: fingerprintKit(kitRoot),
    adaptation: {
      schemaVersion: 1,
      sourceVersion: kitVersionOf(kitRoot),
      deterministicStatus,
      projectFacts: "preserved",
      managedRuntimeFiles: [...MANAGED_RUNTIME_FILES],
    },
    installedFiles,
    upgradedAt: new Date().toISOString(),
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

function writeAdaptationFailure(projectRoot, deterministicStatus, conflicts) {
  const { path, lock } = readLock(projectRoot);
  if (!lock) return;
  const next = {
    ...lock,
    adaptation: {
      ...(lock.adaptation || {}),
      schemaVersion: 1,
      sourceVersion: lock.playbookVersion,
      deterministicStatus,
      projectFacts: "preserved",
      managedRuntimeFiles: [...MANAGED_RUNTIME_FILES],
      ...(conflicts?.length ? { conflicts } : {}),
    },
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
}

function validateProjectInstance(projectRoot) {
  const verifier = join(projectRoot, "scripts/governance-verify.mjs");
  if (!existsSync(verifier)) return { ok: false, detail: "缺少 scripts/governance-verify.mjs" };
  const result = spawnSync(process.execPath, [verifier, "--fast"], {
    cwd: projectRoot,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, GOVERNANCE_UPGRADE_VALIDATION: "1" },
  });
  if (result.error) return { ok: false, detail: result.error.message };
  if (result.status !== 0) {
    const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim().split(/\r?\n/).slice(-6).join(" | ");
    return { ok: false, detail: output || `exit ${result.status}` };
  }
  return { ok: true, detail: "scripts/governance-verify.mjs --fast passed" };
}

function adaptationReport({ kitVersion, desiredVersion, added = [], updated = [], patched = [], conflicts = [] }) {
  return {
    schemaVersion: 1,
    verdict: conflicts.length ? "needs_human_decision" : "pass",
    sourceVersion: kitVersion,
    targetVersion: desiredVersion,
    projectFacts: "preserved",
    added,
    updated,
    patched,
    conflicts,
  };
}

export function formatUpdateReport({ localVersion, remoteVersion, kitVersion, status, added = [], updated = [], patched = [], conflicts = [], error }) {
  const remote = remoteVersion || "不可用";
  const head = `📦 治理版本: 本仓 ${localVersion || "?"} · GitHub ${remote} · kit ${kitVersion || "?"}`;
  if (status === "current") return `${head} · 已是线上版本`;
  if (status === "repaired-current") {
    const repaired = [...updated, ...patched];
    return repaired.length
      ? `${head} · 版本未变，已修复适配载体 ${repaired.join(", ")}`
      : `${head} · 已完成重启后项目复验，适配状态恢复 pass`;
  }
  if (status === "restart-required") return `${head} · 运行时治理载体已更新，本会话禁止施工；请新开一次会话完成开机自检`;
  if (status === "needs-adaptation") return `${head} · 适配冲突，未宣称可施工（${conflicts.join("；")}）`;
  if (status === "unpublished-local") return `${head} · 本机 kit 领先 GitHub（未发布，其他组还吃不到）`;
  if (status === "kit-stale") return `${head} · 本机 playbook 落后 GitHub，先 git pull`;
  if (status === "behind") {
    const extra = added.length ? `已补 ${added.join(", ")}` : "无缺失载体可补";
    const managed = updated?.length ? `；已更新薄适配器 ${updated.join(", ")}` : "";
    const sockets = patched?.length ? `；已迁移接线 ${patched.join(", ")}` : "";
    return `${head} · 已完成治理适配并升级 lock（${extra}；项目事实未覆盖${managed}${sockets}）`;
  }
  if (status === "available") return `${head} · 可升级：node $GOVERNANCE_PLAYBOOK_DIR/scripts/upgrade.mjs --target . --write`;
  if (status === "offline") return `${head} · 线上版本查询失败，未改 lock（${error || "offline"}）`;
  return head;
}

export async function checkAndMaybeUpgrade(projectRoot, options = {}) {
  const policy = options.policy || readUpdatePolicy(projectRoot);
  const { lock } = readLock(projectRoot);
  const localVersion = lock?.playbookVersion || null;
  const kitRoot = options.kitRoot || KIT_ROOT;
  const kitVersion = kitVersionOf(kitRoot);
  let remote = options.remote || null;
  if (!remote && policy.check !== "off") {
    const cached = options.skipCache ? null : readCache(Date.now(), Number(policy.cacheSeconds) || DEFAULT_CACHE_SECONDS);
    if (cached?.version) remote = { ok: true, version: cached.version, url: cached.url, cached: true };
    else {
      remote = await fetchLatestVersion(policy.channel, { kitRoot, ...(options.fetch || {}) });
      if (remote.ok) writeCache(remote);
    }
  }
  const remoteVersion = remote?.ok ? remote.version : null;
  const localKitVerified = Boolean(
    localVersion
    && compareVersions(localVersion, kitVersion) === 0
    && lock?.kitFingerprint
    && lock.kitFingerprint === fingerprintKit(kitRoot)
  );

  if (remoteVersion && compareVersions(kitVersion, remoteVersion) < 0) {
    return { status: "kit-stale", localVersion, remoteVersion, kitVersion, added: [] };
  }
  if (remoteVersion && compareVersions(kitVersion, remoteVersion) > 0) {
    return { status: "unpublished-local", localVersion, remoteVersion, kitVersion, added: [] };
  }
  // 离线时不得把可能尚未发布的本机新版本写进消费项目。只有 lock 指纹证明
  // 当前项目原本就来自这一份同版本 kit 时，才允许做同版本载体活性修复。
  if (!remote?.ok && !localKitVerified) {
    return { status: "offline", localVersion, remoteVersion, kitVersion, added: [], error: remote?.error };
  }
  const desired = remoteVersion || kitVersion;
  const apply = options.apply ?? policy.apply ?? "safe";
  if (apply !== "safe" && apply !== true) {
    if (localVersion && compareVersions(localVersion, desired) >= 0) {
      return { status: "current", localVersion, remoteVersion, kitVersion, added: [] };
    }
    return { status: "available", localVersion, remoteVersion, kitVersion, added: [] };
  }

  // 即使版本号相同，也必须检查并修复已知旧接线；版本标签不能替代载体活性。
  const codex = patchCodexRuntimeHooks(projectRoot);
  const conflicts = codex.conflicts;
  if (conflicts.length) {
    writeAdaptationFailure(projectRoot, "needs_human_decision", conflicts);
    const report = adaptationReport({ kitVersion, desiredVersion: desired, conflicts });
    return { status: "needs-adaptation", localVersion, remoteVersion, kitVersion, added: [], updated: [], patched: [], conflicts, adaptationReport: report };
  }
  const updated = refreshManagedRuntimeFiles(projectRoot, kitRoot);
  const patched = [
    ...codex.patched,
    ...patchPreCompactHooks(projectRoot),
    ...patchIntegrationLineHooks(projectRoot),
  ];
  if (localVersion && compareVersions(localVersion, desired) >= 0) {
    const projectValidation = validateProjectInstance(projectRoot);
    if (!projectValidation.ok) {
      const validationConflicts = [`项目实例验证未通过: ${projectValidation.detail}`];
      writeAdaptationFailure(projectRoot, "failed", validationConflicts);
      const report = adaptationReport({ kitVersion, desiredVersion: desired, updated, patched, conflicts: validationConflicts });
      return {
        status: "needs-adaptation",
        localVersion,
        remoteVersion,
        kitVersion,
        added: [],
        updated,
        patched,
        conflicts: validationConflicts,
        adaptationReport: report,
      };
    }
    const changed = updated.length || patched.length;
    const needsRestart = changed;
    const needsFinalization = lock?.adaptation?.deterministicStatus !== "pass"
      || lock?.adaptation?.sourceVersion !== localVersion;
    const nextLock = (changed || needsFinalization)
      ? writeUpgradedLock(projectRoot, kitRoot, { deterministicStatus: needsRestart ? "restart_required" : "pass" })
      : undefined;
    return {
      status: needsRestart ? "restart-required" : (needsFinalization ? "repaired-current" : "current"),
      localVersion,
      remoteVersion,
      kitVersion,
      added: [],
      updated,
      patched,
      conflicts,
      adaptationReport: adaptationReport({ kitVersion, desiredVersion: desired, updated, patched }),
      ...(nextLock ? { lock: nextLock } : {}),
    };
  }
  const { added } = applySafeAdditions(projectRoot, kitRoot);
  const validationAfterAdditions = validateProjectInstance(projectRoot);
  if (!validationAfterAdditions.ok) {
    const validationConflicts = [`项目实例验证未通过: ${validationAfterAdditions.detail}`];
    writeAdaptationFailure(projectRoot, "failed", validationConflicts);
    return {
      status: "needs-adaptation",
      localVersion,
      remoteVersion,
      kitVersion,
      added,
      updated,
      patched,
      conflicts: validationConflicts,
      adaptationReport: adaptationReport({ kitVersion, desiredVersion: desired, added, updated, patched, conflicts: validationConflicts }),
    };
  }
  const nextLock = writeUpgradedLock(projectRoot, kitRoot, {
    deterministicStatus: (updated.length || patched.length) ? "restart_required" : "pass",
  });
  return {
    status: (updated.length || patched.length) ? "restart-required" : "behind",
    localVersion,
    remoteVersion,
    kitVersion,
    added,
    updated,
    patched,
    conflicts,
    adaptationReport: adaptationReport({ kitVersion, desiredVersion: desired, added, updated, patched }),
    lock: nextLock,
  };
}
