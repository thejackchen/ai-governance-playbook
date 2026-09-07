import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { KIT_ROOT } from "../lib.mjs";

export const DISCOVERY_CAPABILITY = "discovery";

// 发现能力只携带通用导航/索引代码。它不能借能力升级之名接管
// admission、policy、Hook、项目事实或任何运行时安全门。
export const DISCOVERY_FILES = [
  "scripts/lib/docs-index.mjs",
  "scripts/lib/project-catalog.mjs",
  "scripts/lib/catalog-search.mjs",
  "scripts/lib/discovery-map.mjs",
  "scripts/lib/environment-check.mjs",
  "scripts/project-catalog.mjs",
  "scripts/discovery-map.mjs",
  "scripts/environment-check.mjs",
];

// 文件内容之外，来源版本锚点和实际执行升级的控制代码也必须来自同一个
// 干净提交；否则可能把工作树里的新版本/新算法挂在旧 source SHA 上。
const DISCOVERY_SOURCE_CONTROL_FILES = [
  "VERSION",
  "package.json",
  "scripts/upgrade.mjs",
  "scripts/lib/discovery-upgrade.mjs",
];

const HASH_PREFIX = "sha256:";
const VERIFIER = "scripts/governance-verify.mjs";

function canonicalPath(path) {
  try { return realpathSync.native(path); } catch { return resolve(path); }
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function hashBytes(bytes) {
  return `${HASH_PREFIX}${createHash("sha256").update(bytes).digest("hex")}`;
}

function hashFile(path) {
  return hashBytes(readFileSync(path));
}

function sourceSha(kitRoot) {
  const result = spawnSync("git", ["-C", kitRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
    timeout: 3000,
  });
  if (result.status !== 0) return null;
  const value = String(result.stdout || "").trim();
  return /^[0-9a-f]{7,64}$/i.test(value) ? value : null;
}

function sourceVersion(kitRoot) {
  try {
    return String(JSON.parse(readFileSync(join(kitRoot, "package.json"), "utf8")).version || "");
  } catch {
    return "";
  }
}

// 只读取已存在的本地发布跟踪 ref，不在升级路径 fetch 或访问网络。HEAD
// 必须已经被该 ref 包含，且发布提交里的 VERSION 必须和当前 kit 版本一致，
// 才能证明这是已抓取的发布来源而不是本地 candidate。
function sourceRelease(kitRoot, expectedVersion) {
  const ref = "refs/remotes/origin/main";
  const revision = spawnSync("git", ["-C", kitRoot, "rev-parse", "--verify", `${ref}^{commit}`], {
    encoding: "utf8",
    timeout: 5000,
  });
  if (revision.status !== 0) {
    return {
      ok: false,
      ref,
      sha: null,
      version: null,
      error: `缺少已抓取发布 ref ${ref}；未联网获取来源`,
    };
  }
  const releaseSHA = String(revision.stdout || "").trim();
  if (!/^[0-9a-f]{40}$/i.test(releaseSHA)) {
    return { ok: false, ref, sha: null, version: null, error: `发布 ref ${ref} 无法解析为提交` };
  }
  const contained = spawnSync("git", ["-C", kitRoot, "merge-base", "--is-ancestor", "HEAD", ref], {
    encoding: "utf8",
    timeout: 5000,
  });
  if (contained.status !== 0) {
    return {
      ok: false,
      ref,
      sha: releaseSHA,
      version: null,
      error: `当前 kit HEAD 未被已抓取发布 ref ${ref} 包含（candidate 未发布）`,
    };
  }
  const versionResult = spawnSync("git", ["-C", kitRoot, "show", `${ref}:VERSION`], {
    encoding: "utf8",
    timeout: 5000,
  });
  const releaseVersion = String(versionResult.stdout || "").trim();
  if (versionResult.status !== 0 || !releaseVersion) {
    return { ok: false, ref, sha: releaseSHA, version: null, error: `发布 ref ${ref} 缺少 VERSION` };
  }
  if (releaseVersion !== expectedVersion) {
    return {
      ok: false,
      ref,
      sha: releaseSHA,
      version: releaseVersion,
      error: `发布 ref ${ref} 的 VERSION=${releaseVersion} 与 kit sourceVersion=${expectedVersion || "?"} 不一致`,
    };
  }
  return { ok: true, ref, sha: releaseSHA, version: releaseVersion, error: null };
}

function sourcePath(kitRoot, relativePath) {
  return join(kitRoot, "templates/common", relativePath);
}

function readLock(projectRoot) {
  const path = join(projectRoot, "governance.lock.json");
  if (!existsSync(path)) return { path, lock: null, error: "缺少 governance.lock.json" };
  try {
    return { path, lock: JSON.parse(readFileSync(path, "utf8")) };
  } catch (cause) {
    // 不把解析器可能回显的原文片段（项目事实/秘密）带进报告。
    return { path, lock: null, error: "governance.lock.json 无法解析" };
  }
}

function readGitStatus(projectRoot) {
  const result = spawnSync("git", ["-C", projectRoot, "status", "--porcelain=v1", "--untracked-files=all"], {
    encoding: "utf8",
    timeout: 5000,
  });
  if (result.status !== 0) {
    return { ok: false, detail: String(result.stderr || result.stdout || "git status failed").trim() };
  }
  const entries = String(result.stdout || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const value = line.slice(3);
      const rename = value.indexOf(" -> ");
      return { raw: line, path: (rename >= 0 ? value.slice(rename + 4) : value).trim() };
    });
  return { ok: true, entries };
}

function hasStatus(entries, relativePath) {
  return entries.some((entry) => entry.path === relativePath);
}

function safeSource(kitRoot, relativePath) {
  const root = canonicalPath(kitRoot);
  const source = resolve(root, "templates/common", relativePath);
  if (!inside(root, source)) return { ok: false, path: source, error: "source path escapes kit root" };
  try {
    const resolved = realpathSync.native(source);
    if (!inside(root, resolved)) return { ok: false, path: source, error: "source symlink escapes kit root" };
    if (!statSync(resolved).isFile()) return { ok: false, path: source, error: "source is not a regular file" };
    return { ok: true, path: source, resolved };
  } catch (cause) {
    return { ok: false, path: source, error: `source missing: ${cause instanceof Error ? cause.message : String(cause)}` };
  }
}

function safeDestination(projectRoot, relativePath) {
  const root = canonicalPath(projectRoot);
  const dest = resolve(root, relativePath);
  if (!inside(root, dest)) return { ok: false, path: dest, error: "destination path escapes project root" };
  const parts = relative(root, dest).split(/[\\/]/);
  let cursor = root;
  try {
    for (const part of parts.slice(0, -1)) {
      cursor = join(cursor, part);
      try {
        if (lstatSync(cursor).isSymbolicLink()) return { ok: false, path: dest, error: "destination parent is a symlink" };
      } catch (cause) {
        if (cause?.code !== "ENOENT") throw cause;
      }
    }
    try {
      if (lstatSync(dest).isSymbolicLink()) return { ok: false, path: dest, error: "destination is a symlink" };
    } catch (cause) {
      if (cause?.code !== "ENOENT") throw cause;
    }
  } catch (cause) {
    return { ok: false, path: dest, error: `destination cannot be inspected: ${cause instanceof Error ? cause.message : String(cause)}` };
  }
  return { ok: true, path: dest };
}

function previousFileRecord(lock, relativePath) {
  const receipt = lock?.capabilities?.[DISCOVERY_CAPABILITY];
  const files = receipt?.files;
  if (Array.isArray(files)) {
    return files.find((item) => item?.relativePath === relativePath) || null;
  }
  if (files && typeof files === "object") return files[relativePath] || null;
  return null;
}

function recordedDestinationHash(record) {
  return record?.destinationHash || null;
}

function aggregateSourceFingerprint(files) {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(file.sourceHash || "<missing>");
    hash.update("\0");
  }
  return `${HASH_PREFIX}${hash.digest("hex")}`;
}

function verifierState(projectRoot) {
  const path = join(projectRoot, VERIFIER);
  try {
    return { path, exists: lstatSync(path).isFile() };
  } catch {
    return { path, exists: false };
  }
}

function planFiles(projectRoot, kitRoot, lock, statusEntries, conflicts) {
  const files = [];
  for (const relativePath of DISCOVERY_FILES) {
    const source = safeSource(kitRoot, relativePath);
    const destination = safeDestination(projectRoot, relativePath);
    const item = {
      relativePath,
      source: source.path,
      destination: destination.path,
      sourceHash: null,
      destinationHash: null,
      action: "conflict",
    };
    if (!source.ok) {
      conflicts.push(`${relativePath}: ${source.error}`);
      files.push(item);
      continue;
    }
    item.sourceHash = hashFile(source.resolved);
    if (!destination.ok) {
      conflicts.push(`${relativePath}: ${destination.error}`);
      files.push(item);
      continue;
    }
    const dirty = hasStatus(statusEntries, relativePath);
    const destinationExists = existsSync(destination.path);
    if (destinationExists) {
      try { item.destinationHash = hashFile(destination.path); } catch (cause) {
        conflicts.push(`${relativePath}: destination cannot be read: ${cause instanceof Error ? cause.message : String(cause)}`);
        files.push(item);
        continue;
      }
    }
    if (dirty) {
      conflicts.push(`${relativePath}: target is dirty (${statusEntries.find((entry) => entry.path === relativePath)?.raw || "git status"})`);
    } else if (!destinationExists) {
      item.action = "add";
    } else {
      const recorded = recordedDestinationHash(previousFileRecord(lock, relativePath));
      if (!recorded) {
        conflicts.push(`${relativePath}: existing file is not recorded as discovery-managed`);
      } else if (recorded !== item.destinationHash) {
        conflicts.push(`${relativePath}: existing file hash differs from recorded capability hash`);
      } else if (item.destinationHash === item.sourceHash) {
        item.action = "unchanged";
      } else {
        item.action = "update";
      }
    }
    files.push(item);
  }
  return files;
}

export function planDiscoveryUpgrade(projectRoot, { kitRoot = KIT_ROOT } = {}) {
  const root = canonicalPath(projectRoot);
  const kit = canonicalPath(kitRoot);
  const lockResult = readLock(root);
  const conflicts = [];
  if (!lockResult.lock) conflicts.push(lockResult.error || "无法读取 lock");
  const lockDestination = safeDestination(root, "governance.lock.json");
  if (!lockDestination.ok) conflicts.push(`governance.lock.json: ${lockDestination.error}`);
  const status = readGitStatus(root);
  if (!status.ok) conflicts.push(`无法读取目标工作树状态: ${status.detail}`);
  const statusEntries = status.ok ? status.entries : [];
  if (status.ok && hasStatus(statusEntries, "governance.lock.json")) {
    conflicts.push("governance.lock.json: target is dirty; refusing to overwrite user changes");
  }
  const kitStatus = readGitStatus(kit);
  const sourceDirtyPaths = [];
  if (!kitStatus.ok) {
    conflicts.push(`无法读取 kit 工作树状态: ${kitStatus.detail}`);
  } else {
    const sourcePrefixes = new Set([
      ...DISCOVERY_FILES.map((path) => `templates/common/${path}`),
      ...DISCOVERY_SOURCE_CONTROL_FILES,
    ]);
    for (const entry of kitStatus.entries) {
      if (sourcePrefixes.has(entry.path)) sourceDirtyPaths.push(entry.path);
    }
    if (sourceDirtyPaths.length) conflicts.push(`kit source is dirty: ${sourceDirtyPaths.join(", ")}`);
  }
  const kitSHA = sourceSha(kit);
  if (!kitSHA) conflicts.push("kit source SHA unavailable; commit the source before applying");
  const sourceVersionValue = sourceVersion(kit);
  const release = sourceRelease(kit, sourceVersionValue);
  if (!release.ok) conflicts.push(release.error);
  const verifier = verifierState(root);
  if (!verifier.exists) conflicts.push(`缺少 ${VERIFIER}，不能完成 discovery 验收`);

  const files = lockResult.lock
    ? planFiles(root, kit, lockResult.lock, statusEntries, conflicts)
    : DISCOVERY_FILES.map((relativePath) => ({ relativePath, source: sourcePath(kit, relativePath), destination: join(root, relativePath), sourceHash: null, destinationHash: null, action: "conflict" }));
  const sourceSHA = kitSHA;
  const sourceFingerprint = aggregateSourceFingerprint(files);
  return {
    capability: DISCOVERY_CAPABILITY,
    status: conflicts.length ? "conflict" : "plan",
    canApply: conflicts.length === 0,
    projectRoot: root,
    localVersion: lockResult.lock?.playbookVersion || null,
    sourceVersion: sourceVersionValue || null,
    sourceSHA,
    sourceReleaseRef: release.ref,
    sourceReleaseSHA: release.sha,
    sourceReleaseVersion: release.version,
    sourceReleaseVerified: release.ok,
    sourceFingerprint,
    sourceDirtyPaths,
    dirtyPaths: statusEntries.filter((entry) => entry.path === "governance.lock.json" || DISCOVERY_FILES.includes(entry.path)).map((entry) => entry.path),
    files,
    conflicts,
  };
}

function samePlan(left, right) {
  if (left.sourceVersion !== right.sourceVersion
    || left.sourceSHA !== right.sourceSHA
    || left.sourceFingerprint !== right.sourceFingerprint
    || left.sourceReleaseRef !== right.sourceReleaseRef
    || left.sourceReleaseSHA !== right.sourceReleaseSHA
    || left.sourceReleaseVersion !== right.sourceReleaseVersion) return false;
  if (left.files.length !== right.files.length) return false;
  return left.files.every((item, index) => {
    const other = right.files[index];
    return item.relativePath === other.relativePath
      && item.action === other.action
      && item.sourceHash === other.sourceHash
      && item.destinationHash === other.destinationHash;
  });
}

function backupFile(path) {
  if (!existsSync(path)) return { exists: false };
  const info = lstatSync(path);
  return { exists: true, bytes: readFileSync(path), mode: info.mode & 0o777 };
}

function writeAtomic(path, bytes, mode = 0o644) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${path.split("/").pop()}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, bytes, { mode, flag: "wx" });
    chmodSync(temporary, mode);
    renameSync(temporary, path);
  } catch (cause) {
    try { rmSync(temporary, { force: true }); } catch {}
    throw cause;
  }
}

function restoreFile(path, backup) {
  if (backup.exists) writeAtomic(path, backup.bytes, backup.mode);
  else rmSync(path, { force: true });
}

export function validateProject(projectRoot, { timeoutMs = 60_000 } = {}) {
  const verifier = join(projectRoot, VERIFIER);
  const startedAt = new Date().toISOString();
  const boundedTimeout = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Math.min(Number(timeoutMs), 60_000)
    : 60_000;
  const result = spawnSync(process.execPath, [verifier, "--fast"], {
    cwd: projectRoot,
    encoding: "utf8",
    timeout: boundedTimeout,
    killSignal: "SIGKILL",
    maxBuffer: 64 * 1024,
    env: { ...process.env, GOVERNANCE_UPGRADE_VALIDATION: "1" },
  });
  let detail = "passed";
  if (result.error?.code === "ETIMEDOUT") detail = "timeout";
  else if (result.error) detail = "spawn failed";
  else if (result.status !== 0) detail = result.signal ? `signal ${result.signal}` : `exit ${result.status}`;
  return {
    command: `node ${VERIFIER} --fast`,
    status: result.error || result.status !== 0 ? "failed" : "pass",
    detail,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

function receiptFor(plan, files, verification, rollback = false) {
  return {
    schemaVersion: 1,
    capability: DISCOVERY_CAPABILITY,
    status: "file-install-only",
    sourceVersion: plan.sourceVersion,
    sourceSHA: plan.sourceSHA,
    sourceReleaseRef: plan.sourceReleaseRef,
    sourceReleaseSHA: plan.sourceReleaseSHA,
    sourceReleaseVersion: plan.sourceReleaseVersion,
    sourceReleaseVerified: plan.sourceReleaseVerified,
    sourceFingerprint: plan.sourceFingerprint,
    files: files.map((file) => ({
      relativePath: file.relativePath,
      action: file.action,
      sourceHash: file.sourceHash,
      destinationHash: file.destinationHash,
    })),
    verification,
    rollback,
  };
}

export async function applyDiscoveryUpgrade(projectRoot, { kitRoot = KIT_ROOT, plan = null } = {}) {
  const initial = plan || planDiscoveryUpgrade(projectRoot, { kitRoot });
  if (!initial.canApply) return { ...initial, status: "conflict" };
  const fresh = planDiscoveryUpgrade(projectRoot, { kitRoot });
  if (!fresh.canApply || !samePlan(initial, fresh)) {
    const conflicts = [...(fresh.conflicts || []), "计划在写入前发生变化，已取消整批升级"];
    return { ...fresh, status: "conflict", canApply: false, conflicts };
  }

  const root = fresh.projectRoot;
  const lockResult = readLock(root);
  const lockBackup = backupFile(lockResult.path);
  const backups = new Map();
  const changed = fresh.files.filter((file) => file.action === "add" || file.action === "update");
  try {
    if (!lockBackup.exists) throw new Error("governance.lock.json disappeared before write");
    if (!readFileSync(lockResult.path).equals(lockBackup.bytes)) {
      throw new Error("governance.lock.json changed during preflight; refusing to overwrite");
    }
    // 验证器可能改写任一受管文件，即使该文件本轮 action=unchanged；
    // 先记录全部八个目标，失败时才能完整恢复整批能力文件。
    for (const file of fresh.files) backups.set(file.destination, backupFile(file.destination));
    for (const file of changed) {
      const source = safeSource(kitRoot, file.relativePath);
      if (!source.ok) throw new Error(`${file.relativePath}: ${source.error}`);
      writeAtomic(file.destination, readFileSync(source.resolved), statSync(source.resolved).mode & 0o777);
    }
    // 二次核验来源与落盘目标，避免验证器/并发写入让回执记录错误哈希。
    for (const file of fresh.files) {
      const source = safeSource(kitRoot, file.relativePath);
      if (!source.ok || hashFile(source.resolved) !== file.sourceHash) {
        throw new Error(`${file.relativePath}: source changed during write`);
      }
      if (!existsSync(file.destination) || hashFile(file.destination) !== file.sourceHash) {
        throw new Error(`${file.relativePath}: destination hash does not match source`);
      }
    }
    const provisionalFiles = fresh.files.map((file) => ({
      ...file,
      destinationHash: existsSync(file.destination) ? hashFile(file.destination) : file.destinationHash,
    }));
    const provisionalVerification = { command: `node ${VERIFIER} --fast`, status: "pending", startedAt: new Date().toISOString() };
    const provisionalReceipt = receiptFor(fresh, provisionalFiles, provisionalVerification);
    const provisionalLock = {
      ...lockResult.lock,
      capabilities: {
        ...(lockResult.lock.capabilities || {}),
        [DISCOVERY_CAPABILITY]: provisionalReceipt,
      },
    };
    if (!readFileSync(lockResult.path).equals(lockBackup.bytes)) {
      throw new Error("governance.lock.json changed before receipt write; refusing to overwrite");
    }
    writeAtomic(lockResult.path, Buffer.from(`${JSON.stringify(provisionalLock, null, 2)}\n`), lockBackup.mode || 0o644);
    const verification = validateProject(root);
    if (verification.status !== "pass") throw new Error(`项目实例验证未通过: ${verification.detail}`);
    if (!readFileSync(lockResult.path).equals(Buffer.from(`${JSON.stringify(provisionalLock, null, 2)}\n`))) {
      throw new Error("governance.lock.json changed during validation; refusing to finalize");
    }
    for (const file of provisionalFiles) {
      const source = safeSource(kitRoot, file.relativePath);
      if (!source.ok || hashFile(source.resolved) !== file.sourceHash) {
        throw new Error(`${file.relativePath}: source changed during validation`);
      }
    }
    const finalFiles = provisionalFiles.map((file) => ({ ...file, destinationHash: hashFile(file.destination) }));
    for (const file of finalFiles) {
      if (file.destinationHash !== file.sourceHash) throw new Error(`${file.relativePath}: verifier changed managed file`);
    }
    const finalReceipt = receiptFor(fresh, finalFiles, verification);
    const finalLock = {
      ...lockResult.lock,
      capabilities: {
        ...(lockResult.lock.capabilities || {}),
        [DISCOVERY_CAPABILITY]: finalReceipt,
      },
    };
    writeAtomic(lockResult.path, Buffer.from(`${JSON.stringify(finalLock, null, 2)}\n`), lockBackup.mode || 0o644);
    return {
      ...fresh,
      status: "applied",
      canApply: false,
      files: finalFiles,
      receipt: finalReceipt,
      verification,
      lock: finalLock,
    };
  } catch (cause) {
    const rollbackErrors = [];
    for (const [path, backup] of backups) {
      try { restoreFile(path, backup); } catch { rollbackErrors.push(path); }
    }
    try { restoreFile(lockResult.path, lockBackup); } catch { rollbackErrors.push(lockResult.path); }
    const detail = cause instanceof Error ? cause.message : "upgrade failed";
    return {
      ...fresh,
      status: "failed",
      canApply: false,
      conflicts: [...fresh.conflicts, detail],
      rollback: rollbackErrors.length === 0,
      ...(rollbackErrors.length ? { rollbackErrors } : {}),
    };
  }
}

export function formatDiscoveryUpgradeReport(result) {
  const source = `source v${result.sourceVersion || "?"}${result.sourceSHA ? ` @ ${result.sourceSHA}` : ""}`;
  if (result.status === "capability-required") return `🔎 治理升级计划: ${source} · 只读；${result.error || "需要显式选择 capability"}`;
  if (result.status === "plan") return `🔎 discovery: ${source} · 只读计划（未写入；显式 --capability discovery --write 才会应用）`;
  if (result.status === "applied") return `🔎 discovery: ${source} · 已安装文件，file-install-only；项目验证通过，未改变 playbookVersion/admission/policy`;
  if (result.status === "failed") {
    const rollback = result.rollback === true ? "已完全回滚" : "未完全回滚，需要手工恢复";
    return `🔎 discovery: ${source} · 应用失败，${rollback}（${(result.conflicts || []).join("；") || "unknown"}）`;
  }
  if (result.status === "conflict") return `🔎 discovery: ${source} · 冲突/脏文件，未写入（${(result.conflicts || []).join("；") || "unknown"}）`;
  return `🔎 discovery: ${source} · ${result.status || "inspect"}`;
}
