import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

export const DEFAULT_CHANNEL = "https://raw.githubusercontent.com/thejackchen/ai-governance-playbook/main";
export const MAX_TIMEOUT_MS = 3000;
export const MAX_VERSION_BODY_BYTES = 128;
export const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
export const SEMANTIC_UPDATE_USAGE = "用法: node scripts/governance-update.mjs [--target <项目目录>] [--offline]";

const MAX_VERSION_COMPONENT = BigInt(Number.MAX_SAFE_INTEGER);
const DEFAULT_POLICY = { channel: DEFAULT_CHANNEL, check: "session-start", apply: "semantic" };

function parseVersion(value) {
  const text = String(value ?? "").trim();
  if (!VERSION_PATTERN.test(text)) return null;
  const parts = text.split(".").map((part) => BigInt(part));
  return parts.some((part) => part > MAX_VERSION_COMPONENT) ? null : parts;
}

export function isStrictVersion(value) {
  return Boolean(parseVersion(value));
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

function boundedTimeout(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return MAX_TIMEOUT_MS;
  return Math.min(Math.floor(number), MAX_TIMEOUT_MS);
}

function sourceUrl(channel = DEFAULT_CHANNEL) {
  const base = String(channel || DEFAULT_CHANNEL).trim().replace(/\/+$/u, "");
  const candidate = `${base}/VERSION`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return { ok: false, url: "unknown", error: "official-source-invalid", sourceKind: "unknown" };
    }
    const url = parsed.href;
    return { ok: true, url, sourceKind: base === DEFAULT_CHANNEL ? "official" : "configured" };
  } catch {
    return { ok: false, url: "unknown", error: "official-source-invalid", sourceKind: "unknown" };
  }
}

function failedProbe(source, error, checked = "online") {
  return {
    ok: false,
    status: "unknown",
    checked,
    version: null,
    officialSource: source.url,
    sourceKind: source.sourceKind || "unknown",
    error: String(error || "unknown"),
  };
}

async function readBoundedBody(response, limit) {
  const body = response?.body;
  if (body && typeof body.getReader === "function") {
    const reader = body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        const chunk = Buffer.from(next.value || "");
        total += chunk.length;
        if (total > limit) {
          try { await reader.cancel(); } catch {}
          throw new Error("body-too-large");
        }
        chunks.push(chunk);
      }
    } finally {
      try { reader.releaseLock(); } catch {}
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  if (body && typeof body[Symbol.asyncIterator] === "function") {
    const chunks = [];
    let total = 0;
    for await (const value of body) {
      const chunk = Buffer.from(value || "");
      total += chunk.length;
      if (total > limit) throw new Error("body-too-large");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  if (typeof response?.text !== "function") throw new Error("body-unavailable");
  const text = await response.text();
  if (Buffer.byteLength(String(text), "utf8") > limit) throw new Error("body-too-large");
  return String(text);
}

/** Probe the published VERSION once; this function is read-only and never uses git or a cache. */
export async function probeLatestVersion(channel = DEFAULT_CHANNEL, options = {}) {
  const source = sourceUrl(channel);
  if (!source.ok) return failedProbe(source, source.error);
  if (options.offline) return failedProbe(source, "offline", "offline");
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") return failedProbe(source, "fetch-unavailable");
  const timeoutMs = boundedTimeout(options.timeoutMs);
  const bodyLimit = Number.isFinite(Number(options.maxBodyBytes)) && Number(options.maxBodyBytes) > 0
    ? Math.min(Math.floor(Number(options.maxBodyBytes)), MAX_VERSION_BODY_BYTES)
    : MAX_VERSION_BODY_BYTES;
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((resolveDeadline) => {
    timer = setTimeout(() => {
      controller.abort();
      resolveDeadline({ timedOut: true });
    }, timeoutMs);
  });
  // Catch here as well as in the race so an ignored abort cannot create an unhandled rejection.
  const request = Promise.resolve()
    .then(() => fetchImpl(source.url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { accept: "text/plain" },
    }))
    .then(async (response) => {
      if (!response || response.ok === false || (Number.isInteger(response.status) && (response.status < 200 || response.status >= 300))) {
        return { httpError: `HTTP ${response?.status ?? "unknown"}` };
      }
      if (response.redirected) return { redirectError: true };
      return { body: await readBoundedBody(response, bodyLimit) };
    })
    .catch((error) => ({ error }));
  const outcome = await Promise.race([request, deadline]);
  clearTimeout(timer);
  if (outcome?.timedOut) return failedProbe(source, "timeout");
  if (outcome?.httpError) return failedProbe(source, outcome.httpError);
  if (outcome?.redirectError) return failedProbe(source, "redirect-refused");
  if (outcome?.error) {
    return failedProbe(source, outcome.error?.message === "body-too-large" ? "body-too-large" : "request-failed");
  }
  const version = String(outcome?.body || "").trim();
  if (!isStrictVersion(version)) return failedProbe(source, "VERSION-invalid");
  return { ok: true, status: "ok", checked: "online", version, officialSource: source.url, sourceKind: source.sourceKind, error: null };
}

export function readLocalVersion(projectRoot) {
  const root = resolve(projectRoot || process.cwd());
  const path = join(root, "governance.lock.json");
  if (!existsSync(path)) return { version: null, source: path, status: "missing", error: "lock-missing" };
  try {
    const lock = JSON.parse(readFileSync(path, "utf8"));
    const version = String(lock?.playbookVersion || "").trim();
    if (!isStrictVersion(version)) return { version: null, source: path, status: "invalid", error: "lock-version-invalid" };
    return { version, source: path, status: "ok", error: null };
  } catch {
    return { version: null, source: path, status: "invalid", error: "lock-invalid" };
  }
}

export function readUpdatePolicy(projectRoot) {
  const root = resolve(projectRoot || process.cwd());
  const path = join(root, "governance/policy.json");
  if (!existsSync(path)) return { ...DEFAULT_POLICY, configured: false, error: null, source: path };
  try {
    const policy = JSON.parse(readFileSync(path, "utf8"));
    const update = policy?.playbookUpdate;
    if (!update || typeof update !== "object") return { ...DEFAULT_POLICY, configured: true, error: null, source: path };
    const configuredChannel = typeof update.channel === "string" && update.channel.trim() ? update.channel.trim() : DEFAULT_CHANNEL;
    let channel = DEFAULT_CHANNEL;
    try {
      const parsed = new URL(configuredChannel);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("invalid");
      channel = configuredChannel;
    } catch {
      return { ...DEFAULT_POLICY, configured: true, error: "policy-source-invalid", source: path };
    }
    return {
      ...DEFAULT_POLICY,
      channel,
      check: String(update.check || DEFAULT_POLICY.check),
      apply: String(update.apply || DEFAULT_POLICY.apply),
      configured: true,
      error: null,
      source: path,
    };
  } catch {
    return { ...DEFAULT_POLICY, configured: true, error: "policy-invalid", source: path };
  }
}

function statusLabel(status) {
  return ({
    "update-available": "发现已发布新版",
    current: "本地与线上同版",
    "local-ahead": "本地版本领先线上",
    "local-missing": "本地版本未知（缺 lock）",
    unknown: "线上版本 unknown",
  })[status] || status;
}

export function buildSemanticTask({ status, localVersion, onlineVersion, officialSource, probe }) {
  const local = localVersion || "unknown";
  const online = onlineVersion || "unknown";
  const sourceLabel = probe?.sourceKind === "configured" ? "配置来源" : "官方来源";
  const head = `🔎 语义升级发现：${statusLabel(status)}\n版本事实：本地版=${local}；线上版=${online}；${sourceLabel}=${officialSource || "unknown"}。`;
  if (status === "update-available") {
    return [
      `${head}\n仅输出任务，未修改治理文件或 governance.lock.json。`,
      "1. 先从官方已发布回读中固定提交 SHA，读取母版 CORE.md 与 docs/playbook-update.md 升级合同；VERSION 只是发现信号，缺母版正文或固定来源不能更新 lock。",
      "2. 按本次版本新增/变更且与项目相关的主题，读取本地 AGENTS.md、CLAUDE.md、docs/index.md、ROADMAP.md、policy、lock、现有认领与工作树，按本项目真实权威梳理差异；已有有效语义不重复记账，缺基线才首次全梳理，不臆测未声明范围。",
      "3. 对相关建议由项目 AI 自主选择“采用”“等价实现”或“不适用”，写清映射与理由；保留项目事实、定制、WIP 与现有认领，已知差异不要机械问人，只有真实语义冲突或负责人意图无法裁决才提问。",
      "4. 从本地正本定位确定性验证入口（例如 scripts/governance-verify.mjs --fast，若存在；也可使用项目等价命令），再做独立无上下文语义复核；两者通过后才前移 lock 的版本、指纹和适配回执。脚本不调用模型、不写治理文件、不签发许可、不部署或发送消息。",
    ].join("\n");
  }
  if (status === "unknown") {
    const reason = probe?.error || "未取得发布 VERSION";
    if (reason.startsWith("policy-")) {
      return `${head}\n配置错误（${reason}）；不联网、不改写版本，保留本地已记录版本 ${local}。先修复 governance/policy.json 后再运行手动 CLI。仅状态提示，未完成适配。`;
    }
    return `${head}\n线上检查为 unknown（${reason}）；保留本地已记录版本 ${local}，按本地验证状态继续，不降级、不猜测或伪造 latest；需要时手动重试或使用 --offline。仅状态提示，未完成适配。`;
  }
  if (status === "local-ahead") return `${head}\n本地版本领先线上发布；保持本地状态，不降级、不把候选称作官方已发布版本。仅状态提示，未完成适配。`;
  if (status === "local-missing") return `${head}\n缺少可验证的 governance.lock.json 版本（bootstrap gap）；不能只凭线上 VERSION 前移 lock。先按本地权威完成初始化/恢复，再由 AI 适配。仅状态提示，未完成适配。`;
  return `${head}\n无需前移版本；仍由项目自身验证与语义复核决定是否存在漂移。仅状态提示，未完成适配。`;
}

export async function inspectSemanticUpdate(projectRoot = process.cwd(), options = {}) {
  const root = resolve(projectRoot || process.cwd());
  const policy = options.policy || readUpdatePolicy(root);
  const local = readLocalVersion(root);
  const probeOptions = { offline: Boolean(options.offline || policy.error), timeoutMs: options.timeoutMs, maxBodyBytes: options.maxBodyBytes };
  if (typeof options.fetchImpl === "function") probeOptions.fetchImpl = options.fetchImpl;
  const probe = policy.error
    ? { ok: false, status: "unknown", checked: "policy", version: null, officialSource: "unknown", sourceKind: "unknown", error: policy.error }
    : await probeLatestVersion(options.channel || policy.channel, probeOptions);
  const onlineVersion = probe.ok ? probe.version : null;
  const comparison = local.version && onlineVersion ? compareVersions(local.version, onlineVersion) : null;
  const status = !probe.ok
    ? "unknown"
    : !local.version
      ? "local-missing"
      : comparison < 0
        ? "update-available"
        : comparison > 0
          ? "local-ahead"
          : "current";
  return {
    status,
    localVersion: local.version,
    onlineVersion,
    officialSource: probe.officialSource,
    probe,
    comparison,
    task: buildSemanticTask({ status, localVersion: local.version, onlineVersion, officialSource: probe.officialSource, probe }),
    wrote: false,
  };
}

export function formatSemanticUpdateReport(result) {
  return result?.task || "🔎 语义升级发现：线上版本 unknown；未修改任何治理文件。";
}

function parseCliArgs(argv) {
  const args = { target: process.cwd(), offline: false, help: false };
  let seenTarget = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    if (arg === "--help" || arg === "-h") { args.help = true; continue; }
    if (arg === "--offline") {
      if (args.offline) throw new Error("参数重复");
      args.offline = true;
      continue;
    }
    if (arg === "--target") {
      if (seenTarget) throw new Error("参数重复");
      const value = argv[++index];
      if (!value || String(value).startsWith("--")) throw new Error("--target 缺少目录");
      seenTarget = true;
      args.target = resolve(String(value));
      continue;
    }
    throw new Error("未知参数");
  }
  return args;
}

export async function runGovernanceUpdateCLI(argv = process.argv.slice(2), { output = console } = {}) {
  let args;
  try {
    args = parseCliArgs(argv);
  } catch (error) {
    output.error(`${error.message}\n${SEMANTIC_UPDATE_USAGE}`);
    return 2;
  }
  if (args.help) { output.log(SEMANTIC_UPDATE_USAGE); return 0; }
  if (!existsSync(args.target)) { output.error(`目标项目不存在: ${args.target}`); return 2; }
  const result = await inspectSemanticUpdate(args.target, { offline: args.offline });
  output.log(formatSemanticUpdateReport(result));
  return 0;
}
