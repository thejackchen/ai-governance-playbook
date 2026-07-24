#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = (p) => existsSync(p) ? readFileSync(p, "utf8") : "";
// 日期用本地时区——toISOString 按 UTC 输出，非零时区在跨日窗口会给出错误日期（v2.3.0 实测缺陷）
const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = localISO(new Date());
const datedRows = (body) => (body.match(/^\|\s*\d{4}-\d{2}-\d{2}\s*\|/gm) || []).length;
// 问题队列是 `##` 标题制(与收件箱聚合器同一判据:标题行含「已裁决」即闭环);表格/编号列表格式聚合不到,详见模板头
const openQuestions = (body) => (body.match(/^##\s+(?!.*已裁决).+$/gm) || []).length;
const questions = openQuestions(read("governance/questions.md"));
const incidents = datedRows(read("governance/incidents.md"));
const rules = (read("governance/registry.md").match(/^\| R\d+ \|/gm) || []).length;
// 流量对账(母版 2026-07-25 实证):补条目只修库存不修流量——手写账本断流的根因是「写入与事件无绑定」,
// 光补历史条目不防再断。这两行只报告、不设门禁、零新载体:拿「近期修复密度」反推事故簿是否该有新条目。
const daysBetween = (a, b) => Math.floor((new Date(`${a}T00:00:00`) - new Date(`${b}T00:00:00`)) / 86400000);
const incidentBody = read("governance/incidents.md");
const incidentDates = [...incidentBody.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]).sort();
const lastIncident = incidentDates.length ? incidentDates[incidentDates.length - 1] : null;
const incidentAge = lastIncident ? daysBetween(today, lastIncident) : null;
let recentFixes = "0";
try { recentFixes = execFileSync("git", ["log", "--since=7 days ago", "--grep=fix\\|security", "--oneline"], { encoding: "utf8" }).trim().split("\n").filter(Boolean).length; } catch {}
const flowFlag = incidentAge !== null && Number(recentFixes) >= 3 && incidentAge > 14 ? "⚠️ 疑断流" : "正常";

let commits = "0";
try { commits = execFileSync("git", ["rev-list", "--count", "--since=7 days ago", "HEAD"], { encoding: "utf8" }).trim(); } catch {}

console.log(`# 周治理对账 · ${today}

- 待裁决问题(未结)：${questions}
- 事故条目：${incidents}
- 规则条目：${rules}
- 事故簿流量：近 7 天 ${recentFixes} 条修复类提交，事故簿 ${incidentAge === null ? "无条目" : `${incidentAge} 天未新增`} — ${flowFlag}
- 近7天commit：${commits}

## 人工抽检

- [ ] 本周架构/需求/ROADMAP是否分叉
- [ ] 新规则是否写清trigger、predicate、effect和绕过
- [ ] AI审查是否只提供建议，没有替代确定性门禁
- [ ] 上一期问题与事故是否有证据闭环
`);
