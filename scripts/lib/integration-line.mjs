import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, join, resolve } from "node:path";

const WRITE_TOOLS = /^(?:apply_patch|Edit|Write|MultiEdit|search_replace)$/i;
const SHELL_TOOLS = /^(?:Bash|run_terminal_command)$/i;
const RECOVERY_GIT = /^(?:fetch|status|log|diff|show|rev-parse|rev-list|merge-base|merge|switch)\b/i;

function oneLine(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function readPolicy(root) {
  try {
    return JSON.parse(readFileSync(join(root, "governance/policy.json"), "utf8"));
  } catch {
    return {};
  }
}

function defaultExecGit(root, args, timeoutMs = 8000) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: "0" };
  for (const key of Object.keys(env)) {
    if (key === "GIT_OPTIONAL_LOCKS") continue;
    if (key.startsWith("GIT_")) delete env[key];
  }
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    env,
    timeout: timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0,
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim(),
  };
}

export function resolveIntegrationLine(policy = {}) {
  const configured = policy.integrationLine || {};
  const remote = String(configured.remote || "").trim();
  const branch = String(configured.branch || "").trim();
  if (remote && branch) {
    return {
      remote,
      branch,
      ref: `${remote}/${branch}`,
      label: String(configured.label || `${remote} ${branch}`).trim(),
      configured: true,
    };
  }
  return { remote: "", branch: "", ref: "", label: "", configured: false };
}

function gitText(execGit, args) {
  const result = execGit(args);
  return result.ok ? String(result.stdout || "").trim() : "";
}

export function inspectIntegrationLine(root, options = {}) {
  const policy = options.policy || readPolicy(root);
  const execGit = (args, timeoutMs) =>
    options.execGit ? options.execGit(args) : defaultExecGit(root, args, timeoutMs);
  const line = resolveIntegrationLine(policy);

  const gitDir = gitText(execGit, ["rev-parse", "--git-dir"]);
  if (!gitDir) {
    return {
      kind: "no-git",
      primary: false,
      blockWrites: false,
      message: "🛤 公共主干: 这里不是 Git 仓库，主干守卫未启用。",
      line,
    };
  }
  const commonDir = gitText(execGit, ["rev-parse", "--git-common-dir"]) || gitDir;
  const resolvedGitDir = isAbsolute(gitDir) ? gitDir : resolve(root, gitDir);
  const resolvedCommonDir = isAbsolute(commonDir) ? commonDir : resolve(root, commonDir);
  const primary = resolvedGitDir === resolvedCommonDir;
  const mergeInProgress = existsSync(join(resolvedGitDir, "MERGE_HEAD"));
  const branch = gitText(execGit, ["rev-parse", "--abbrev-ref", "HEAD"]) || "HEAD";
  const upstream = gitText(execGit, ["rev-parse", "--abbrev-ref", "@{u}"]);
  const shallow = gitText(execGit, ["rev-parse", "--is-shallow-repository"]) === "true";

  if (!line.configured) {
    return {
      kind: "unconfigured",
      primary,
      branch,
      upstream,
      blockWrites: false,
      mergeInProgress,
      message: "🛤 公共主干: 未配置（governance/policy.json 的 integrationLine），主干守卫未启用。",
      line,
    };
  }

  if (options.fetch && line.remote && line.branch) {
    execGit(["fetch", "--quiet", line.remote, line.branch], 8000);
  }

  const mergeBase = execGit(["merge-base", "HEAD", line.ref]);
  const behindRaw = gitText(execGit, ["rev-list", "--count", `HEAD..${line.ref}`]);
  const aheadRaw = gitText(execGit, ["rev-list", "--count", `${line.ref}..HEAD`]);
  const behind = Number.parseInt(behindRaw, 10);
  const ahead = Number.parseInt(aheadRaw, 10);
  const countsTrusted = mergeBase.ok && Number.isFinite(behind) && Number.isFinite(ahead);
  const namedTrunk = branch === line.branch;
  const sidecarTrackingTrunk = primary && !namedTrunk && upstream === line.ref;

  const base = {
    primary,
    branch,
    upstream,
    behind: countsTrusted ? behind : null,
    ahead: countsTrusted ? ahead : null,
    shallow,
    mergeInProgress,
    countsTrusted,
    namedTrunk,
    sidecarTrackingTrunk,
    line,
  };

  if (!primary) {
    return {
      ...base,
      kind: "worktree",
      blockWrites: false,
      message: `🛤 临时工作树：旁支 ${branch} 允许，记得把 ${line.label} 合进来，干完回收。`,
    };
  }

  if (!countsTrusted) {
    const message = shallow
      ? `🛤 Git 历史被截断，算不出眼前这份有没有同事的新提交。数字不可信，先补全历史。`
      : `🛤 暂时算不出和 ${line.label} 差多少。先 fetch。`;
    return { ...base, kind: "untrusted-counts", blockWrites: false, message };
  }

  if (behind > 0) {
    let message = `🛤 ${line.label} 上有 ${behind} 个提交还没并进眼前这份。先合进来再写。`;
    if (sidecarTrackingTrunk) {
      message += `现在在旁支 ${branch} 上却拿公共线来比，看起来像同一条线，其实已经分开。`;
    } else if (!namedTrunk) {
      message += `现在在旁支 ${branch}。`;
    }
    return { ...base, kind: "behind-line", blockWrites: true, message, blockReason: message };
  }

  if (!namedTrunk) {
    return {
      ...base,
      kind: "caught-up-side-branch",
      blockWrites: false,
      message: `🛤 在旁支 ${branch}，已经含有 ${line.label} 的最新提交，可以写。干完把这支合回公共线。`,
    };
  }

  return {
    ...base,
    kind: "on-line",
    blockWrites: false,
    message: `🛤 公共线 ${line.label} 的提交已经并进眼前这份。`,
  };
}

export function formatIntegrationLineReport(inspection) {
  return oneLine(inspection?.message || "🛤 公共主干: 检查失败（不阻断开工）");
}

function isWriteTool(name) {
  return WRITE_TOOLS.test(String(name || ""));
}

function isShellTool(name) {
  return SHELL_TOOLS.test(String(name || ""));
}

function normalizeGitVerb(command) {
  const tokens = String(command || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return "";
  let index = 0;
  if (tokens[index].includes("/")) tokens[index] = tokens[index].split("/").pop();
  if (tokens[index] !== "git") return "";
  index += 1;
  while (index < tokens.length) {
    if (tokens[index] === "-C" || tokens[index] === "-c") {
      index += 2;
      continue;
    }
    if (tokens[index].startsWith("--git-dir") || tokens[index].startsWith("--work-tree")) {
      index += tokens[index].includes("=") ? 1 : 2;
      continue;
    }
    break;
  }
  return tokens[index] || "";
}

export function isRecoveryAction({ toolName, toolInput = {}, candidates = [], inspection }) {
  const branch = inspection?.line?.branch || "";
  const ref = inspection?.line?.ref || "";
  if (isWriteTool(toolName)) return false;
  if (!isShellTool(toolName)) return false;
  const commands = candidates.length ? candidates : [String(toolInput.command || toolInput.cmd || "")];
  return commands.some((raw) => {
    const text = String(raw || "").trim();
    if (/\bclaim\.mjs\b/.test(text)) return true;
    const verb = normalizeGitVerb(text);
    if (!verb) return false;
    if (RECOVERY_GIT.test(verb) && verb !== "switch") return true;
    if (verb === "switch" || verb === "checkout") {
      return Boolean(branch) && new RegExp(`(?:^|\\s)(?:${branch}|${ref.replace("/", "\\/")})(?:\\s|$)`).test(text);
    }
    if ((verb === "add" || verb === "commit") && inspection?.mergeInProgress) return true;
    return false;
  });
}

export function evaluateIntegrationLineGate({
  root,
  toolName,
  toolInput = {},
  candidates = [],
  policy,
  claims = [],
  execGit,
} = {}) {
  const inspection = inspectIntegrationLine(root, { policy, execGit, fetch: false });
  if (!inspection.blockWrites) return null;
  if (claims.some((claim) => claim.mode === "emergency" && (claim.status === "active" || claim.status === "continued"))) {
    return null;
  }
  if (inspection.mergeInProgress) return null;
  const targetPath = String(toolInput.file_path || toolInput.notebook_path || toolInput.path || "");
  if (targetPath && root) {
    const abs = isAbsolute(targetPath) ? targetPath : resolve(root, targetPath);
    const rel = abs.startsWith(`${resolve(root)}/`) || abs === resolve(root);
    if (!rel) return null;
  }
  if (/\.md$/i.test(targetPath) || /(^|\/)docs\//i.test(targetPath.replaceAll("\\", "/"))) return null;
  if (!isWriteTool(toolName)) return null;
  return inspection.blockReason || inspection.message;
}
