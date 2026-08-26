#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch {}

let policy;
try {
  policy = JSON.parse(readFileSync(join(root, "governance/policy.json"), "utf8"));
} catch (e) {
  block(`治理策略无法读取，拒绝继续: ${e.message}`);
}

const toolName = input.tool_name || input.toolName || "";
const toolInput = input.tool_input || input.toolInput || {};
const command = String(toolInput.command || toolInput.cmd || "");
// 命令链必须按连接符拆成独立候选;否则跨段拼接会把前段 push 与后段 --force 串成假命中,
// 该误报已在 2026-07-19 的真实安装项目中复现两次。含连接符的整串故意不进入 candidates,只匹配各段原始/归一化形式。
// 这是字符串级防线而非真正 shell parser,不解析引号内的连接符(如参数字面量 &&);误拆最多令危险模式匹配失败,不会新增误拦;
// 真正的 wrapper 伪装先由 unwrapShell 解包,再回到同一队列重新分段。
// 已知边界(诚实披露,不伪装完美门禁):命令替换 $()、管道拼装、解释器执行(python -c)、base64 编解码等
// 不在字符串防线射程内——由运行时自带的深度命令解析(如有)、人工责任与事故簿兜底,详见发行包 ADAPTERS 已知边界节。
const candidates = gatherCandidates(command);

function gatherCandidates(rawCommand) {
  const out = new Set();
  const seen = new Set();
  const queue = [String(rawCommand || "")];
  while (queue.length && seen.size < 48) {
    const cur = queue.shift();
    if (!cur || seen.has(cur)) continue;
    seen.add(cur);
    for (const whole of new Set([cur, normalizeCommand(cur)])) {
      const inner = unwrapShell(whole);
      if (inner && inner !== whole) queue.push(inner);
      for (const seg of splitShellChain(whole)) {
        const segNorm = normalizeCommand(seg);
        out.add(seg);
        out.add(segNorm);
        const segInner = unwrapShell(segNorm);
        if (segInner && segInner !== segNorm) queue.push(segInner);
      }
    }
  }
  return [...out];
}

function splitShellChain(s) {
  return String(s || "")
    .split(/(?:\|\||&&|[;|&\n])+/)
    .map((seg) => seg.trim())
    .filter(Boolean);
}

for (const pattern of policy.denyCommandPatterns || []) {
  const re = new RegExp(pattern, "i");
  if (candidates.some((c) => re.test(c))) block(`命令命中治理禁止模式: ${pattern}`);
}

const grokHarnessReason = evaluateGrokHarness(candidates, policy.grokHarness);
if (grokHarnessReason) block(grokHarnessReason);

// protectedPaths 判定面最小化(3.1.2):判「改什么」只看目标路径字段,不做全输入序列化子串匹配——
// 被保护文件名必然被合法引用(文档链接/注释/commit message),全文匹配首启即误伤(首个安装项目当场实证);
// 误伤率决定门禁存活率(高误伤门禁终被 --no-verify 或拆除,保护归零)。
if (/^(?:apply_patch|Edit|Write|MultiEdit|search_replace)$/i.test(toolName)) {
  const targetPath = String(toolInput.file_path || toolInput.notebook_path || toolInput.path || "");
  for (const path of policy.protectedPaths || []) {
    if (targetPath === path || targetPath.endsWith(`/${path}`)) {
      block(`受保护路径不能由自动工具直接修改: ${path}`);
    }
  }
}

if (/Bash/i.test(toolName)) {
  for (const path of policy.protectedPaths || []) {
    const esc = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // 只拦写入形态:重定向(>/>>)、tee、sed -i、mv/cp 目标位;纯读(cat/grep)放行。
    // 解释器写文件等旁路不在字符串防线射程(与上方 denyCommandPatterns 同款诚实披露)。
    const writeRe = new RegExp(
      `(?:>>?\\s*|\\btee\\s+(?:-a\\s+)?|\\bsed\\s+-i[^|;&]*\\s|\\b(?:mv|cp)\\s+[^|;&]*\\s)(?:\\S*/)?${esc}(?:\\s|$|["'])`,
      "i"
    );
    if (candidates.some((c) => writeRe.test(c))) {
      block(`受保护路径不能经 Bash 重定向/写入: ${path}`);
    }
  }
}

const claimGateReason = await evaluateClaimGate({ input, toolName, toolInput, candidates });
if (claimGateReason) block(claimGateReason);

try {
  const { evaluateIntegrationLineGate } = await import("../lib/integration-line.mjs");
  let claims = [];
  try {
    const claimModule = await loadClaimModule();
    if (claimModule) claims = claimModule.loadClaims({ cwd: input.cwd || process.cwd(), strict: false }).records;
  } catch { /* 无认领模块时仍做主干守卫 */ }
  const integrationReason = evaluateIntegrationLineGate({
    root,
    toolName,
    toolInput,
    candidates,
    policy,
    claims,
  });
  if (integrationReason) block(integrationReason);
} catch { /* 主干守卫失败不误拦 */ }

process.exit(0);

function block(reason) {
  const decision = process.env.GROK_HOOK_EVENT ? "deny" : "block";
  process.stdout.write(JSON.stringify({ decision, reason }));
  process.exit(0);
}

// 命令归一化：剥离外层括号/首token目录前缀/包裹引号与反斜杠转义，
// 防止 /usr/bin/git、\git、(git ...)、'--hard' 等等价写法绕过 denyCommandPatterns 的 (^|\s) 锚点匹配（四维实测缺陷）。
// denyCommandPatterns 用原始串与归一化串双匹配；任一命中即block。
function normalizeCommand(raw) {
  let s = String(raw || "").trim();
  while (s.length >= 2 && s[0] === "(" && s[s.length - 1] === ")") {
    s = s.slice(1, -1).trim();
  }
  if (!s) return s;
  const tokens = s.split(/\s+/).filter(Boolean).map(stripQuotesAndEscapes);
  if (tokens.length && tokens[0].includes("/")) tokens[0] = tokens[0].split("/").pop();
  return tokens.join(" ");
}

// 拆一层 shell 包裹:bash -c "…" / sh -c '…' / eval … → 返回内层命令串(去包裹引号)
function unwrapShell(s) {
  let m = s.match(/^(?:bash|sh|zsh)\s+(?:-\S+\s+)*-c\s+([\s\S]+)$/i);
  if (!m) m = s.match(/^eval\s+([\s\S]+)$/i);
  if (!m) return null;
  let inner = m[1].trim();
  if (inner.length >= 2) {
    const f = inner[0], l = inner[inner.length - 1];
    if ((f === "'" && l === "'") || (f === '"' && l === '"')) inner = inner.slice(1, -1);
  }
  return inner.trim();
}

function stripQuotesAndEscapes(token) {
  let t = token;
  if (t.length >= 2) {
    const first = t[0], last = t[t.length - 1];
    if ((first === "'" && last === "'") || (first === '"' && last === '"')) t = t.slice(1, -1);
  }
  t = t.replace(/^\\+/, "");
  return t;
}

function evaluateGrokHarness(commandCandidates, config) {
  if (!config || typeof config !== "object") return null;
  const models = new Set(config.models || []);
  const efforts = new Set(config.efforts || []);
  for (const candidate of commandCandidates) {
    for (const key of config.forbidEnvironmentKeys || []) {
      const escaped = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?:^|\\s)(?:export\\s+)?${escaped}\\s*=`, "i").test(candidate)) {
        return `Grok harness 拦截：禁止调用方读取或注入 ${key}`;
      }
    }
    for (const fragment of config.forbidCredentialPathFragments || []) {
      if (candidate.includes(fragment) && /^(?:cat|sed|awk|grep|rg|head|tail|less|more|cp|python(?:3)?|node|perl|ruby|openssl)\b/i.test(candidate.trim())) {
        return `Grok harness 拦截：禁止调用方读取 ${fragment}`;
      }
    }
    for (const host of config.forbidDirectHttpHosts || []) {
      if (/\b(?:curl|wget|http|xh|python3?|node)\b/i.test(candidate) && candidate.includes(host)) {
        return `Grok harness 拦截：禁止调用方直打 ${host}，请使用已配置的 ~/.grok/bin/grok`;
      }
    }
    for (const commandName of config.forbidLoginCommands || []) {
      const escaped = String(commandName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?:^|\\s)${escaped}\\s+login(?:\\s|$)`, "i").test(candidate)) {
        return `Grok harness 拦截：禁止 ${commandName} login`;
      }
    }
    const match = candidate.match(/^(?:(?:env|command)\s+)?(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*(?:(?:~|\/\S+)\/\.grok\/bin\/)?grok(?=\s|$)([\s\S]*)/i);
    if (!match) continue;
    const args = match[1] || "";
    if (/^\s*(?:--version|-v|version|models|inspect|doctor|help)(?:\s|$)/i.test(args)) continue;
    if (/(?:^|\s)(?:-p|--single|--always-approve)(?:=|\s|$)/i.test(args)) {
      return "Grok harness 拦截：禁止 -p / --single / --always-approve，长提示必须走 --prompt-file";
    }
    if (!/(?:^|\s)--verbatim(?:\s|$)/i.test(args)) return "Grok harness 拦截：缺 --verbatim";
    if (!/(?:^|\s)--output-format(?:=|\s+)plain(?:\s|$)/i.test(args)) {
      return "Grok harness 拦截：输出必须是 --output-format plain";
    }
    if (!/(?:^|\s)--prompt-file(?:=|\s+)\S+/i.test(args)) {
      return "Grok harness 拦截：长提示必须写入文件并用 --prompt-file 传入";
    }
    const model = args.match(/(?:^|\s)(?:-m|--model)(?:=|\s+)(\S+)/i)?.[1] || config.defaultModel;
    if (!models.has(model)) return `Grok harness 拦截：模型只允许 ${[...models].join(" / ")}`;
    const effort = args.match(/(?:^|\s)(?:--effort|--reasoning-effort)(?:=|\s+)(\S+)/i)?.[1] || config.defaultEffort;
    if (!efforts.has(effort)) return `Grok harness 拦截：effort 只允许 ${[...efforts].join(" / ")}`;
  }
  return null;
}

async function loadClaimModule() {
  try {
    return await import("../claim.mjs");
  } catch (cause) {
    // Lite 没有安装 claim.mjs；只跳过认领判定，不能影响本文件已有的危险命令/保护路径逻辑。
    if (cause?.code === "ERR_MODULE_NOT_FOUND" && /claim\.mjs/i.test(String(cause.message || ""))) return null;
    throw cause;
  }
}

async function evaluateClaimGate({ input: hookInput, toolName: currentToolName, toolInput: currentToolInput, candidates: commandCandidates }) {
  const claimModule = await loadClaimModule().catch((cause) => ({ loadError: cause }));
  if (!claimModule) return null;
  if (claimModule.loadError) return `认领门模块加载失败，拒绝继续：${claimModule.loadError.message || claimModule.loadError}`;

  let policy;
  try {
    policy = JSON.parse(readFileSync(join(root, "governance/policy.json"), "utf8"));
  } catch (cause) {
    return `治理策略无法读取，认领门拒绝继续：${cause.message}`;
  }

  const effectiveClaimGate = { ...claimModule.DEFAULT_CLAIM_GATE, ...(policy.claimGate || {}) };
  const isWriteTool = /^(?:apply_patch|Edit|Write|MultiEdit|search_replace)$/i.test(currentToolName);
  const isShellTool = /^(?:Bash|run_terminal_command)$/i.test(currentToolName);
  const targetPath = String(currentToolInput.file_path || currentToolInput.notebook_path || currentToolInput.path || "");
  const isClaimCommand = isShellTool && (effectiveClaimGate.bashClaimPatterns || []).some((pattern) => {
    const re = new RegExp(pattern, "i");
    return commandCandidates.some((candidate) => re.test(candidate));
  });
  const isControlPlaneShellWrite = isShellTool
    && shellWritesAlwaysClaimPath(commandCandidates, effectiveClaimGate.alwaysClaimPaths || []);
  if (!isWriteTool && !isClaimCommand && !isControlPlaneShellWrite) return null;

  const operationCwd = hookInput.cwd || process.cwd();
  let relativeTarget = null;
  if (isWriteTool) {
    if (targetPath) {
      try {
        const context = claimModule.resolveGitContext({ cwd: operationCwd });
        const target = realpathWithMissing(isAbsolute(targetPath) ? targetPath : resolve(operationCwd, targetPath));
        relativeTarget = normalizeRelative(relative(context.worktree, target));
      } catch (cause) {
        return claimLedgerFailureReason(cause, "受影响的路径前缀");
      }
      if (!relativeTarget || relativeTarget === "." || relativeTarget.startsWith("../") || relativeTarget === "..") {
        relativeTarget = null;
      }
      if (!claimModule.matchesClaimGateCodePath(relativeTarget, effectiveClaimGate)) return null;
    }
  }

  try {
    const claim = claimModule.resolveCurrentClaim({ cwd: operationCwd, session: hookInput.session_id });
    if (claim) return null;
  } catch (cause) {
    return claimLedgerFailureReason(cause, relativeTarget || "受影响的路径前缀");
  }

  let activeClaims;
  try {
    activeClaims = claimModule.loadClaims({ cwd: operationCwd, strict: true }).records.filter((claim) => claim.status === "active");
  } catch (cause) {
    return claimLedgerFailureReason(cause, relativeTarget || "受影响的路径前缀");
  }
  const scope = suggestedScope(relativeTarget, effectiveClaimGate);
  const activeSummary = activeClaims.length
    ? activeClaims
        .map(
          (claim) =>
            `- line=${claim.line || "emergency/no-line"} · task=${claim.task || ""} · worktree=${claim.worktree || "未知"} · claimId=${claim.claimId || "?"}`,
        )
        .join("\n")
    : "当前没有其它活跃认领。";
  let lineHint = "<line>";
  try {
    const slugs = readdirSync(join(dirname(fileURLToPath(import.meta.url)), "../../docs/execution/branches"))
      .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
      .map((name) => name.replace(/\.md$/, ""));
    if (slugs.length) lineHint = `<${slugs.join("|")}|cross>`;
  } catch {}
  return [
    "认领门拦截：当前行为代码写入或派单命令没有匹配的有效认领。",
    `可复制命令模板: node scripts/claim.mjs open --line ${lineHint} --task "一句话做什么" --accept "一句话怎么验收" --non-goals "这次不碰什么" --scope "${scope}"`,
    `当前（全部 worktree）各 line 下的 active 认领:\n${activeSummary}`,
    "纯文档改动、或救火场景请参见 governance/claim-gate.md。",
  ].join("\n");
}

function normalizeRelative(path) {
  return String(path || "").replaceAll("\\", "/").replace(/^\.\//, "");
}

function shellWritesAlwaysClaimPath(commandCandidates, alwaysClaimPaths) {
  return commandCandidates.some((candidate) => {
    if (!isShellWriteLike(candidate)) return false;
    return alwaysClaimPaths.some((path) => shellMentionsPath(candidate, path));
  });
}

function isShellWriteLike(command) {
  return /(?:^|[^<])>>?|\b(?:tee|touch|mkdir|rm|cp|mv|install|truncate|dd|patch|apply_patch|chmod|chown|ln)\b|\b(?:sed|perl)\s+-[^\n]*(?:i|p)|\bgit\s+(?:apply|checkout|restore)\b|\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|write_text|write_bytes)\b/i.test(String(command || ""));
}

function shellMentionsPath(command, path) {
  const normalized = normalizeRelative(path).replace(/\/$/, "");
  if (!normalized) return false;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s'\"=:/])${escaped}(?:[\\s'\"/]|$)`, "i").test(String(command || ""));
}

function realpathWithMissing(path) {
  const absolute = resolve(path);
  const missing = [];
  let cursor = absolute;
  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) return absolute;
    missing.push(cursor.slice(parent.length + 1));
    cursor = parent;
  }
  return join(realpathSync(cursor), ...missing.reverse());
}

function suggestedScope(relativeTarget, claimGate) {
  if (relativeTarget) {
    const directory = dirname(relativeTarget).replaceAll("\\", "/");
    if (directory && directory !== ".") return `${directory}/`;
  }
  return normalizeRelative((claimGate.codeRoots || ["src/"])[0] || "src/");
}

function claimLedgerFailureReason(cause, scope) {
  const recovery = {
    claimId: "手动起一个8位hex",
    line: "cross",
    docRef: "docs/index.md",
    docBaseline: "运行 git hash-object docs/index.md 得到",
    task: "手写说明:门为什么坏、你在做什么",
    acceptance: "手写说明:怎么验收",
    nonGoals: "",
    scope: [scope],
    worktree: "运行 git rev-parse --show-toplevel 拿到后再 realpath 的结果",
    session: null,
    agent: "unknown",
    status: "active",
    mode: "emergency",
    incidentRef: "认领门数据损坏,手动恢复",
    createdAt: "当前 ISO 时间戳",
    updatedAt: "同 createdAt",
  };
  return [
    `认领账本读取失败：${cause instanceof Error ? cause.message : String(cause)}`,
    "这是 fail-closed 设计，无法把账本损坏默认为没有认领。请手动恢复最小记录：",
    JSON.stringify(recovery, null, 2),
    "将其保存为 chmod 0600 的 JSON 文件，放到 $(git rev-parse --git-common-dir)/governance-claims/<claimId>.json（文件名必须与 claimId 字段一致），再重试。",
  ].join("\n");
}
