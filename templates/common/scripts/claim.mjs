#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const CLAIM_ID_PATTERN = /^[a-f0-9]{8}$/;
const VALID_CLOSE_STATUSES = new Set(["closed", "continued", "abandoned"]);
const VALID_CURRENT_STATUSES = new Set(["active", "continued"]);
const DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_CLAIM_GATE = {
  codeRoots: ["src/", "scripts/"],
  alwaysClaimPaths: [
    "AGENTS.md",
    "CLAUDE.md",
    "governance.lock.json",
    "governance/",
    ".codex/",
    ".claude/",
    ".grok/",
    ".githooks/",
    "scripts/governance-hooks/",
    "scripts/lib/boot-admission.mjs"
  ],
  exemptPatterns: [
    "\\.md$",
    "^docs/",
    "(^|/)package-lock\\.json$",
    "(^|/)pnpm-lock\\.yaml$",
    "\\.gen\\.",
    "(^|/)node_modules/",
  ],
  bashClaimPatterns: ["\\bcodex\\s+exec\\b", "\\bgrok\\b[^\\n]*--prompt-file(?:=|\\s)"],
};

export class ClaimDataError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "ClaimDataError";
  }
}

export function spawnGit(args, cwd, options = {}) {
  const inherited = options.env || process.env;
  const env = Object.fromEntries(Object.entries(inherited).filter(([key]) => !key.startsWith("GIT_")));
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: options.timeout ?? 10_000,
    env,
    ...(Object.hasOwn(options, "input") ? { input: options.input } : {}),
  });
}

function runGit(args, cwd, options = {}) {
  const result = spawnGit(args, cwd, options);
  if (result.error) throw new Error(`git ${args.join(" ")} 执行失败: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim();
    throw new Error(`git ${args.join(" ")} 执行失败${detail ? `: ${detail}` : ""}`);
  }
  return String(result.stdout || "").trim();
}

export function resolveGitContext({ cwd = process.cwd(), env = process.env } = {}) {
  const operationCwd = resolve(cwd);
  const worktreeOutput = runGit(["rev-parse", "--show-toplevel"], operationCwd, { env });
  const commonDirOutput = runGit(["rev-parse", "--git-common-dir"], operationCwd, { env });
  const worktree = realpathSync(worktreeOutput);
  const commonDir = realpathSync(resolve(operationCwd, commonDirOutput));
  return {
    cwd: operationCwd,
    worktree,
    commonDir,
    claimsDir: join(commonDir, "governance-claims"),
  };
}

function nonEmpty(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function hasEnvironmentKey(env, key) {
  return Object.hasOwn(env, key);
}

export function resolveSession({ session, env = process.env } = {}) {
  if (session !== undefined) return nonEmpty(session);
  for (const key of ["GOVERNANCE_SESSION_ID", "CODEX_SESSION_ID", "CLAUDE_SESSION_ID", "CLAUDE_CODE_SESSION_ID"]) {
    const value = nonEmpty(env[key]);
    if (value) return value;
  }
  return null;
}

export function resolveAgent({ agent, env = process.env } = {}) {
  if (agent !== undefined) {
    const explicit = String(agent).trim();
    if (!["claude", "codex", "grok", "unknown"].includes(explicit)) {
      throw new Error(`--agent 必须是 claude、codex、grok 或 unknown，收到: ${agent}`);
    }
    return explicit;
  }
  const keys = Object.keys(env);
  if (
    hasEnvironmentKey(env, "CLAUDECODE") ||
    hasEnvironmentKey(env, "CLAUDE_SESSION_ID") ||
    keys.some((key) => key.startsWith("CLAUDE_CODE_"))
  ) {
    return "claude";
  }
  if (hasEnvironmentKey(env, "CODEX_SESSION_ID") || keys.some((key) => key.startsWith("CODEX_"))) {
    return "codex";
  }
  if (hasEnvironmentKey(env, "GROK_SESSION_ID") || hasEnvironmentKey(env, "GROK_HOOK_EVENT")) {
    return "grok";
  }
  return "unknown";
}

export function isAiEnvironment(env = process.env) {
  const keys = Object.keys(env);
  return (
    hasEnvironmentKey(env, "CLAUDECODE") ||
    hasEnvironmentKey(env, "CODEX_SESSION_ID") ||
    hasEnvironmentKey(env, "CLAUDE_SESSION_ID") ||
    hasEnvironmentKey(env, "GOVERNANCE_SESSION_ID") ||
    hasEnvironmentKey(env, "GROK_SESSION_ID") ||
    hasEnvironmentKey(env, "GROK_HOOK_EVENT") ||
    keys.some((key) => key.startsWith("CODEX_")) ||
    keys.some((key) => key.startsWith("CLAUDE_CODE_"))
  );
}

export function writeClaimFile(target, data) {
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, target);
  return target;
}

function ensureClaimsDir(context) {
  mkdirSync(context.claimsDir, { recursive: true });
}

function claimFileEntries(context) {
  if (!existsSync(context.claimsDir)) return [];
  let entries;
  try {
    entries = readdirSync(context.claimsDir, { withFileTypes: true });
  } catch (cause) {
    throw new ClaimDataError(`认领账本目录无法读取: ${context.claimsDir}: ${cause.message}`, { cause });
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function parseClaimFile(path) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    throw new ClaimDataError(`认领文件无法解析: ${path}: ${cause.message}`, { cause });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ClaimDataError(`认领文件不是 JSON 对象: ${path}`);
  }
  return parsed;
}

export function loadClaims({ cwd = process.cwd(), env = process.env, strict = true } = {}) {
  const context = resolveGitContext({ cwd, env });
  const records = [];
  const invalidFiles = [];
  for (const entry of claimFileEntries(context)) {
    const path = join(context.claimsDir, entry.name);
    try {
      records.push(parseClaimFile(path));
    } catch (cause) {
      if (strict) throw cause;
      invalidFiles.push({ path, error: cause });
    }
  }
  return { context, records, invalidFiles };
}

function docRefForLine(line) {
  const normalized = nonEmpty(line);
  if (!normalized) throw new Error("--line 不能为空");
  if (normalized === "cross") return "docs/index.md";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(normalized)) {
    throw new Error(`--line 必须是安全的 line slug 或字面量 cross，收到: ${line}`);
  }
  return `docs/execution/branches/${normalized}.md`;
}

function resolveDocument(context, line, env) {
  const docRef = docRefForLine(line);
  const absolute = resolve(context.worktree, docRef);
  if (!absolute.startsWith(`${context.worktree}${sep}`)) {
    throw new Error(`--line 对应文档不在 worktree 内: ${docRef}`);
  }
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    throw new Error(`--line 对应文档不存在: ${docRef}`);
  }
  const docBaseline = runGit(["hash-object", absolute], context.cwd, { env });
  if (!/^[0-9a-f]{40}$/.test(docBaseline)) {
    throw new Error(`git hash-object 未返回有效文档基线: ${docRef}`);
  }
  return { docRef, docBaseline };
}

function parseScope(value) {
  if (value === undefined) throw new Error("--scope 必填，至少提供一个逗号分隔的路径前缀");
  const scope = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (scope.length === 0) throw new Error("--scope 至少要有一个非空路径前缀");
  return scope;
}

function requiredOption(options, key, label) {
  const value = nonEmpty(options[key]);
  if (!value) throw new Error(`${label} 必填且不能为空`);
  return value;
}

function createClaimId(claimsDir) {
  for (;;) {
    const claimId = randomBytes(4).toString("hex");
    if (!existsSync(join(claimsDir, `${claimId}.json`))) return claimId;
  }
}

function currentTimestamp() {
  return new Date().toISOString();
}

function claimForCreation({ context, options, mode, env }) {
  const line =
    mode === "emergency"
      ? Object.hasOwn(options, "line")
        ? requiredOption(options, "line", "--line")
        : null
      : requiredOption(options, "line", "--line");
  const document = line ? resolveDocument(context, line, env) : { docRef: null, docBaseline: null };
  const task = mode === "emergency" ? nonEmpty(options.task) || "" : requiredOption(options, "task", "--task");
  const acceptance =
    mode === "emergency" ? nonEmpty(options.accept) || "" : requiredOption(options, "accept", "--accept");
  const nonGoals = mode === "emergency" ? nonEmpty(options["non-goals"]) || "" : requiredOption(options, "non-goals", "--non-goals");
  const scope = parseScope(options.scope);
  const incidentRef = mode === "emergency" ? requiredOption(options, "incident", "--incident") : null;
  const now = currentTimestamp();
  return {
    claimId: createClaimId(context.claimsDir),
    line,
    docRef: document.docRef,
    docBaseline: document.docBaseline,
    task,
    acceptance,
    nonGoals,
    scope,
    worktree: context.worktree,
    session: resolveSession({ session: options.session, env }),
    agent: resolveAgent({ agent: options.agent, env }),
    status: "active",
    mode,
    incidentRef,
    createdAt: now,
    updatedAt: now,
  };
}

function ageMilliseconds(timestamp) {
  const parsed = Date.parse(timestamp || "");
  return Number.isFinite(parsed) ? Date.now() - parsed : Number.POSITIVE_INFINITY;
}

function isOlderThan(timestamp, milliseconds) {
  const parsed = Date.parse(timestamp || "");
  return Number.isFinite(parsed) && Date.now() - parsed > milliseconds;
}

function formatAge(timestamp) {
  const age = ageMilliseconds(timestamp);
  if (!Number.isFinite(age) || age < 0) return "时间未知";
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function shortWorktree(path) {
  const normalized = String(path || "");
  const tail = normalized.split(/[\\/]/).filter(Boolean).at(-1);
  return tail || normalized || "未知 worktree";
}

function sameLineConflicts(records, line) {
  return records
    .filter((record) => record.status === "active" && record.line === line)
    .map((record) => ({
      claimId: record.claimId,
      line: record.line,
      task: record.task,
      worktree: record.worktree,
      age: formatAge(record.createdAt),
    }));
}

function sessionCompatible(claimSession, currentSession, mode) {
  const claimValue = nonEmpty(claimSession);
  const currentValue = nonEmpty(currentSession);
  if (mode === "emergency") return Boolean(claimValue && currentValue && claimValue === currentValue);
  return !(claimValue && currentValue && claimValue !== currentValue);
}

export { sessionCompatible };

function normalizeExistingWorktree(path) {
  if (!nonEmpty(path) || !existsSync(path)) return null;
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

function recordsForWorktree(records, worktree, statuses = VALID_CURRENT_STATUSES) {
  return records.filter(
    (record) =>
      statuses.has(record.status) &&
      normalizeExistingWorktree(record.worktree) === worktree,
  );
}

export function claimsForWorktree({ cwd = process.cwd(), env = process.env, statuses = VALID_CURRENT_STATUSES } = {}) {
  const { context, records } = loadClaims({ cwd, env, strict: true });
  return recordsForWorktree(records, context.worktree, statuses);
}

export function resolveCurrentClaim({ cwd = process.cwd(), session, env = process.env } = {}) {
  const { context, records } = loadClaims({ cwd, env, strict: true });
  const currentSession = resolveSession({ session, env });
  const matches = recordsForWorktree(records, context.worktree).filter((record) =>
    sessionCompatible(record.session, currentSession, record.mode),
  );
  matches.sort((left, right) => {
    const rightTime = Date.parse(right.updatedAt || "");
    const leftTime = Date.parse(left.updatedAt || "");
    const timeDifference = (Number.isFinite(rightTime) ? rightTime : Number.NEGATIVE_INFINITY) -
      (Number.isFinite(leftTime) ? leftTime : Number.NEGATIVE_INFINITY);
    return timeDifference || String(right.claimId || "").localeCompare(String(left.claimId || ""));
  });
  return matches[0] || null;
}

export function loadClaimGatePolicy() {
  const policyPath = join(SCRIPT_ROOT, "governance", "policy.json");
  let policy;
  try {
    policy = JSON.parse(readFileSync(policyPath, "utf8"));
  } catch (cause) {
    throw new Error(`治理策略无法读取: ${cause.message}`, { cause });
  }
  return {
    ...DEFAULT_CLAIM_GATE,
    ...(policy.claimGate || {}),
  };
}

function normalizedRelativePath(path) {
  return String(path || "").replaceAll("\\", "/").replace(/^\.\//, "");
}

export function matchesClaimGateCodePath(path, claimGate = loadClaimGatePolicy()) {
  const candidate = normalizedRelativePath(path);
  if (!candidate) return false;
  if ((claimGate.alwaysClaimPaths || []).some((prefix) => matchesPathPrefix(candidate, prefix))) return true;
  for (const pattern of claimGate.exemptPatterns || []) {
    if (new RegExp(pattern, "i").test(candidate)) return false;
  }
  return (claimGate.codeRoots || []).some((prefix) => candidate.startsWith(normalizedRelativePath(prefix)));
}

function matchesPathPrefix(candidate, prefix) {
  const normalized = normalizedRelativePath(prefix);
  if (!normalized) return false;
  return normalized.endsWith("/") ? candidate.startsWith(normalized) : candidate === normalized;
}

export function stagedCodePaths({ cwd = process.cwd(), env = process.env, claimGate = loadClaimGatePolicy() } = {}) {
  const output = runGit(["diff", "--cached", "--name-only"], resolve(cwd), { env });
  const paths = output ? output.split(/\r?\n/).map(normalizedRelativePath).filter(Boolean) : [];
  return paths.filter((path) => matchesClaimGateCodePath(path, claimGate));
}

export function verifyCommit({ cwd = process.cwd(), env = process.env } = {}) {
  if (!isAiEnvironment(env)) {
    return { ok: true, aiEnvironment: false, codePaths: [] };
  }
  const claimGate = loadClaimGatePolicy();
  const codePaths = stagedCodePaths({ cwd, env, claimGate });
  if (codePaths.length === 0) return { ok: true, aiEnvironment: true, codePaths };
  const claims = claimsForWorktree({ cwd, env });
  if (claims.length > 0) return { ok: true, aiEnvironment: true, codePaths, claims };
  return { ok: false, aiEnvironment: true, codePaths, claims: [] };
}

function parseCliArgs(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      options.json = true;
      continue;
    }
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    const equal = argument.indexOf("=");
    if (equal > 2) {
      options[argument.slice(2, equal)] = argument.slice(equal + 1);
      continue;
    }
    const key = argument.slice(2);
    if (!key) throw new Error("发现空 CLI 参数");
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`参数 ${argument} 需要一个值`);
    options[key] = value;
    index += 1;
  }
  return { command: positional[0] || "", options };
}

function emitResult(options, result) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result.payload === undefined ? result : result.payload, null, 2)}\n`);
  } else if (result.human) {
    process.stdout.write(`${result.human}\n`);
  }
}

function openCommand(options, { cwd, env }, mode) {
  const context = resolveGitContext({ cwd, env });
  const claim = claimForCreation({ context, options, mode, env });
  const loaded = loadClaims({ cwd, env, strict: false });
  const conflicts = mode === "normal" ? sameLineConflicts(loaded.records, claim.line) : [];
  ensureClaimsDir(context);
  writeClaimFile(join(context.claimsDir, `${claim.claimId}.json`), claim);
  const humanLines = [];
  if (conflicts.length) {
    humanLines.push(`同一 line 已有 ${conflicts.length} 条 active 认领（只播报，不拦截）：`);
    for (const conflict of conflicts) {
      humanLines.push(`- ${conflict.task} · worktree=${shortWorktree(conflict.worktree)} · ${conflict.age}`);
    }
  }
  humanLines.push(`认领已创建: ${claim.claimId} (line=${claim.line || "emergency/no-line"}, mode=${claim.mode})`);
  if (loaded.invalidFiles.length) humanLines.push(`提示: ${loaded.invalidFiles.length} 个认领文件无法解析，已跳过播报。`);
  return {
    code: 0,
    payload: { claimId: claim.claimId, claim, conflicts, unparseable: loaded.invalidFiles.length },
    human: humanLines.join("\n"),
  };
}

function listCommand({ cwd, env }) {
  const loaded = loadClaims({ cwd, env, strict: false });
  const claims = loaded.records.map((claim) => ({
    ...claim,
    orphan: !existsSync(claim.worktree || ""),
    stale: isOlderThan(claim.updatedAt, DAY),
  }));
  const human = claims.length
    ? claims
        .map(
          (claim) =>
            `${claim.claimId || "?"} · ${claim.status || "?"} · ${claim.line || "emergency/no-line"} · ${claim.task || ""} · ${claim.orphan ? "orphan " : ""}${claim.stale ? "stale" : ""}`.trim(),
        )
        .join("\n")
    : "当前没有认领记录。";
  return {
    code: 0,
    payload: { claims, unparseable: loaded.invalidFiles.length },
    human: `${human}${loaded.invalidFiles.length ? `\n${loaded.invalidFiles.length} 个认领文件无法解析，已跳过。` : ""}`,
  };
}

function readClaimById(context, claimId) {
  if (!CLAIM_ID_PATTERN.test(claimId)) throw new Error(`--id 必须是 8 位小写 hex，收到: ${claimId}`);
  const path = join(context.claimsDir, `${claimId}.json`);
  if (!existsSync(path)) throw new Error(`找不到认领: ${claimId}`);
  return { path, claim: parseClaimFile(path) };
}

function closeCommand(options, { cwd, env }) {
  const claimId = requiredOption(options, "id", "--id");
  const status = options.status === undefined ? "closed" : String(options.status).trim();
  if (!VALID_CLOSE_STATUSES.has(status)) {
    throw new Error(`--status 必须是 closed、continued 或 abandoned，收到: ${status}`);
  }
  const context = resolveGitContext({ cwd, env });
  const { path, claim } = readClaimById(context, claimId);
  const currentSession = resolveSession({ session: options.session, env });
  const claimSession = nonEmpty(claim.session);
  if (claimSession && currentSession && claimSession !== currentSession) {
    throw new Error(
      `这条认领是 session ${claimSession} 开的，你是 session ${currentSession}；如果确实要关闭请让原 session 关闭或说明理由。`,
    );
  }
  const updated = { ...claim, status, updatedAt: currentTimestamp() };
  writeClaimFile(path, updated);
  return {
    code: 0,
    payload: { claimId, status, claim: updated },
    human: `认领已更新: ${claimId} -> ${status}`,
  };
}

function currentCommand(options, { cwd, env }) {
  const claim = resolveCurrentClaim({ cwd, session: options.session, env });
  return {
    code: claim ? 0 : 1,
    payload: claim,
    human: claim ? `当前有效认领: ${claim.claimId}` : "当前上下文没有有效认领。",
  };
}

function pruneCommand({ cwd, env }) {
  const loaded = loadClaims({ cwd, env, strict: false });
  const deleted = [];
  for (const claim of loaded.records) {
    if (!new Set(["closed", "abandoned"]).has(claim.status)) continue;
    if (!isOlderThan(claim.updatedAt, 7 * DAY)) continue;
    if (!CLAIM_ID_PATTERN.test(String(claim.claimId || ""))) continue;
    const path = join(loaded.context.claimsDir, `${claim.claimId}.json`);
    if (existsSync(path)) {
      unlinkSync(path);
      deleted.push(claim.claimId);
    }
  }
  return {
    code: 0,
    payload: { deleted, count: deleted.length, unparseable: loaded.invalidFiles.length },
    human: deleted.length ? `已清理 ${deleted.length} 条认领: ${deleted.join(", ")}` : "没有符合条件的过期 closed/abandoned 认领。",
  };
}

function verifyCommitCommand({ cwd, env }) {
  const result = verifyCommit({ cwd, env });
  if (!result.ok) {
    return {
      code: 1,
      payload: result,
      human: `暂存区含代码改动但当前 worktree 无有效认领。\n命中路径: ${result.codePaths.join(", ")}\n请先 node scripts/claim.mjs open --line <line> --task "..." --accept "..." --non-goals "..." --scope "${result.codePaths[0] || "src/"}"。`,
    };
  }
  return {
    code: 0,
    payload: result,
    human: result.aiEnvironment ? "claim gate verify-commit 通过。" : "非 AI 环境，claim gate 不拦截手工提交。",
  };
}

function usage() {
  return `用法:
  node scripts/claim.mjs open --line <slug> --task "..." --accept "..." --non-goals "..." --scope "a/,b/"
  node scripts/claim.mjs emergency --incident "..." --scope "a/" [--line <slug>] [--task "..."] [--accept "..."]
  node scripts/claim.mjs list [--json]
  node scripts/claim.mjs close --id <id> [--status closed|continued|abandoned]
  node scripts/claim.mjs current [--json]
  node scripts/claim.mjs prune [--json]
  node scripts/claim.mjs verify-commit [--json]`;
}

export function runCli(argv = process.argv.slice(2), context = {}) {
  try {
    const { command, options } = parseCliArgs(argv);
    const runtime = { cwd: context.cwd || process.cwd(), env: context.env || process.env };
    let result;
    if (command === "open") result = openCommand(options, runtime, "normal");
    else if (command === "emergency") result = openCommand(options, runtime, "emergency");
    else if (command === "list") result = listCommand(runtime);
    else if (command === "close") result = closeCommand(options, runtime);
    else if (command === "current") result = currentCommand(options, runtime);
    else if (command === "prune") result = pruneCommand(runtime);
    else if (command === "verify-commit") result = verifyCommitCommand(runtime);
    else if (command === "" || command === "help") {
      if (options.json) process.stdout.write(`${JSON.stringify({ usage: usage() }, null, 2)}\n`);
      else process.stdout.write(`${usage()}\n`);
      return 0;
    } else {
      throw new Error(`未知子命令: ${command}\n${usage()}`);
    }
    emitResult(options, result);
    process.exitCode = result.code;
    return result.code;
  } catch (cause) {
    console.error(`[claim] ERROR ${cause instanceof Error ? cause.message : String(cause)}`);
    process.exitCode = 1;
    return 1;
  }
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (cause) {
    console.error(`[claim] ERROR ${cause instanceof Error ? cause.message : String(cause)}`);
    process.exitCode = 1;
  }
}
