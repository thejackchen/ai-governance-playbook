import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";

export const TIMEOUT_MS = 10_000;
const networkAdvice = "按当前机器与进程的环境入口检查 VPN/代理和目标路由；尚未确认代理是否开启。Tailscale 不等于外网代理。";

export function parseTarget(value) {
  if (typeof value !== "string" || /[\s?#]/u.test(value)) throw new Error("仅接受不含凭据、query、fragment 的 HTTPS URL。");
  let url;
  try { url = new URL(value); } catch { throw new Error("目标必须是 HTTPS URL。"); }
  if (url.protocol !== "https:" || url.username || url.password || value.includes("@")) throw new Error("仅接受不含凭据、query、fragment 的 HTTPS URL。");
  return url;
}

// No shell, curlrc, redirects, cookies, credentials files or verbose output.
// The existing process proxy environment is inherited, never inspected or printed.
export function runCurl(args, { executable = "curl", timeout = TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    execFile(executable, args, { timeout, killSignal: "SIGKILL", maxBuffer: 4096, encoding: "utf8" }, (error, stdout) => {
      resolve({ code: error ? error.code : 0, killed: Boolean(error?.killed), stdout: stdout || "" });
    });
  });
}

export async function checkEnvironment(value, { runner = runCurl } = {}) {
  const url = parseTarget(value);
  const args = ["-q", "--globoff", "--silent", "--head", "--output", "/dev/null", "--connect-timeout", "5", "--max-time", "10", "--retry", "0", "--proto", "=https", "--write-out", "%{http_code} %{time_connect} %{time_appconnect}", "--url", url.href];
  let result;
  try { result = await runner(args); } catch { result = { code: "RUNNER_FAILURE" }; }
  const match = /^(\d{3}) ([\d.]+) ([\d.]+)\s*$/u.exec(result.stdout || "");
  const code = Number(result.code);
  const response = (stage, status, advice) => ({ host: url.host, stage, status, advice });
  if (result.killed) return response("deadline", "timeout", `已到进程硬时限，停止探测，不重复重试。${networkAdvice}`);
  if (code === 5 || code === 6) return response("dns", "failed", networkAdvice);
  if ([35, 51, 58, 59, 60, 64, 66, 77, 80, 82, 83, 90, 91].includes(code)) return response("tls", "failed", "检查证书、系统时间、代理拦截和路由；不要关闭 TLS 校验。");
  if (code === 7) return response("tcp", "failed", networkAdvice);
  if (code === 28) {
    const stage = !match || Number(match[2]) === 0 ? "connect" : Number(match[3]) === 0 ? "tls-or-proxy" : "http";
    return response(stage, "timeout", `探测超时，阶段仅供定位，代理可能参与连接。${networkAdvice}`);
  }
  if (code !== 0 || !match) return response("probe", "failed", "只读探测未完成；检查 curl 是否可用及环境入口。不输出底层错误或凭据，不自动重试。");
  const http = Number(match[1]);
  if (http < 100 || http > 599) return response("probe", "failed", "没有有效 HTTP 状态，检查环境入口；本次不重试。");
  if (http === 401 || http === 403) return response("http", http, "检查身份、授权及访问策略；403 也可能是出口策略。不能直接判断 VPN 未开启，本探测未携带业务凭据。");
  if (http === 429) return response("http", http, "服务限流，按服务约定退避；本次不重试，不重试结果不明的真实写入。");
  if (http >= 500) return response("http", http, "服务或上游故障，查看服务状态并按约定退避；本次不重试。");
  if (http >= 300 && http < 400) return response("http", http, "已收到重定向但未跟随；需单独确认新目标，不代表最终服务可用。");
  if (http >= 200 && http < 300) return response("http", http, "仅证明当前进程到该目标此次 HEAD 成功；不证明下载速度、其他机器/应用或代理状态。");
  return response("http", http, "已收到 HTTP 响应；检查路径或 HEAD 支持情况，不等同于业务验收通过。");
}

export async function main(argv) {
  if (argv.length === 0 || (argv.length === 1 && ["--help", "-h"].includes(argv[0]))) {
    console.log("用法: node scripts/environment-check.mjs --url https://目标/路径\n仅按需单目标 HEAD，无凭据、query、fragment，不跟随跳转，不重试；最长约 10 秒加终止调度容差。指南：从 docs/index.md 按项目环境入口查找");
    return 0;
  }
  if (argv.length !== 2 || argv[0] !== "--url") { console.error("参数无效；使用 --help 查看用法。"); return 2; }
  try {
    const result = await checkEnvironment(argv[1]);
    console.log(JSON.stringify(result));
    return result.stage === "http" && result.status >= 200 && result.status < 300 ? 0 : 1;
  } catch { console.error("目标无效；仅接受不含凭据、query、fragment 的 HTTPS URL。"); return 2; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
