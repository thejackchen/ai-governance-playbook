#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

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

// protectedPaths 判定面最小化(3.1.2):判「改什么」只看目标路径字段,不做全输入序列化子串匹配——
// 被保护文件名必然被合法引用(文档链接/注释/commit message),全文匹配首启即误伤(首个安装项目当场实证);
// 误伤率决定门禁存活率(高误伤门禁终被 --no-verify 或拆除,保护归零)。
if (/apply_patch|Edit|Write/i.test(toolName)) {
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

process.exit(0);

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
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
