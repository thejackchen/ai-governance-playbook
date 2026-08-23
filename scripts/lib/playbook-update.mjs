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
  "scripts/governance-hooks/pre-compact.mjs",
  "scripts/governance-hooks/pre-compact-codex.mjs",
];

const PRECOMPACT_TEXT_CMD = 'node "$(git rev-parse --show-toplevel)/scripts/governance-hooks/pre-compact.mjs"';
const PRECOMPACT_CODEX_CMD = 'node "$(git rev-parse --show-toplevel)/scripts/governance-hooks/pre-compact-codex.mjs"';

function needsPreCompactPatch(command = "") {
  if (!command) return true;
  if (/\becho\b/.test(command)) return true;
  return !/pre-compact/.test(command);
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

export function writeUpgradedLock(projectRoot, kitRoot = KIT_ROOT) {
  const { path, lock, error } = readLock(projectRoot);
  if (!lock) throw new Error(error || "缺少 governance.lock.json，不能升级；新仓请走 init");
  const additions = SAFE_ADDITIONS.filter((relativePath) => existsSync(join(projectRoot, relativePath)));
  const installedFiles = [...new Set([...(lock.installedFiles || []), ...additions])].sort();
  const next = {
    ...lock,
    playbookVersion: kitVersionOf(kitRoot),
    kitFingerprint: fingerprintKit(kitRoot),
    installedFiles,
    upgradedAt: new Date().toISOString(),
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export function formatUpdateReport({ localVersion, remoteVersion, kitVersion, status, added = [], patched = [], error }) {
  const remote = remoteVersion || "不可用";
  const head = `📦 治理版本: 本仓 ${localVersion || "?"} · GitHub ${remote} · kit ${kitVersion || "?"}`;
  if (status === "current") return `${head} · 已是线上版本`;
  if (status === "unpublished-local") return `${head} · 本机 kit 领先 GitHub（未发布，其他组还吃不到）`;
  if (status === "kit-stale") return `${head} · 本机 playbook 落后 GitHub，先 git pull`;
  if (status === "behind") {
    const extra = added.length ? `已补 ${added.join(", ")}` : "无缺失载体可补";
    const sockets = patched?.length ? `；已补 PreCompact 插座 ${patched.join(", ")}` : "";
    return `${head} · 已做 lock 升级（${extra}；未覆盖已有文件${sockets}）`;
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
  const lockBehindKit = localVersion ? compareVersions(kitVersion, localVersion) > 0 : true;

  if (remoteVersion && compareVersions(kitVersion, remoteVersion) < 0) {
    return { status: "kit-stale", localVersion, remoteVersion, kitVersion, added: [] };
  }
  if (remoteVersion && compareVersions(kitVersion, remoteVersion) > 0) {
    return { status: "unpublished-local", localVersion, remoteVersion, kitVersion, added: [] };
  }
  if (!remote?.ok && !lockBehindKit) {
    return { status: "offline", localVersion, remoteVersion, kitVersion, added: [], error: remote?.error };
  }
  const desired = remoteVersion || kitVersion;
  if (localVersion && compareVersions(localVersion, desired) >= 0) {
    return { status: "current", localVersion, remoteVersion, kitVersion, added: [] };
  }

  const apply = options.apply ?? policy.apply ?? "safe";
  if (apply !== "safe" && apply !== true) {
    return { status: "available", localVersion, remoteVersion, kitVersion, added: [] };
  }
  const { added } = applySafeAdditions(projectRoot, kitRoot);
  const patched = patchPreCompactHooks(projectRoot);
  const nextLock = writeUpgradedLock(projectRoot, kitRoot);
  return {
    status: "behind",
    localVersion,
    remoteVersion,
    kitVersion,
    added,
    patched,
    lock: nextLock,
  };
}
