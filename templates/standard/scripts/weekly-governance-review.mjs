#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = (p) => existsSync(p) ? readFileSync(p, "utf8") : "";
// 日期用本地时区——toISOString 按 UTC 输出，非零时区在跨日窗口会给出错误日期（v2.3.0 实测缺陷）
const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = localISO(new Date());
const datedRows = (body) => (body.match(/^\|\s*\d{4}-\d{2}-\d{2}\s*\|/gm) || []).length;
const questions = datedRows(read("governance/questions.md"));
const incidents = datedRows(read("governance/incidents.md"));
const rules = (read("governance/registry.md").match(/^\| R\d+ \|/gm) || []).length;
let commits = "0";
try { commits = execFileSync("git", ["rev-list", "--count", "--since=7 days ago", "HEAD"], { encoding: "utf8" }).trim(); } catch {}

console.log(`# 周治理对账 · ${today}

- 待裁决问题条目：${questions}
- 事故条目：${incidents}
- 规则条目：${rules}
- 近7天commit：${commits}

## 人工抽检

- [ ] 本周架构/需求/ROADMAP是否分叉
- [ ] 新规则是否写清trigger、predicate、effect和绕过
- [ ] AI审查是否只提供建议，没有替代确定性门禁
- [ ] 上一期问题与事故是否有证据闭环
`);
