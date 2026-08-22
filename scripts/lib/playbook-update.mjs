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
];

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

export async function fetchLatestVersion(channel = DEFAULT_CHANNEL, { fetchImpl = fetch, timeoutMs = 3000 } = {}) {
  const url = `${String(channel).replace(/\/$/, "")}/VERSION`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
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

export function formatUpdateReport({ localVersion, remoteVersion, kitVersion, status, added = [], error }) {
  const remote = remoteVersion || "不可用";
  const head = `📦 治理版本: 本仓 ${localVersion || "?"} · GitHub ${remote} · kit ${kitVersion || "?"}`;
  if (status === "current") return `${head} · 已是线上版本`;
  if (status === "unpublished-local") return `${head} · 本机 kit 领先 GitHub（未发布，其他组还吃不到）`;
  if (status === "kit-stale") return `${head} · 本机 playbook 落后 GitHub，先 git pull`;
  if (status === "behind") {
    const extra = added.length ? `已补 ${added.join(", ")}` : "无缺失载体可补";
    return `${head} · 已做 lock 升级（${extra}；未覆盖已有文件）`;
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
      remote = await fetchLatestVersion(policy.channel, options.fetch || {});
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
  const nextLock = writeUpgradedLock(projectRoot, kitRoot);
  return {
    status: "behind",
    localVersion,
    remoteVersion,
    kitVersion,
    added,
    lock: nextLock,
  };
}
