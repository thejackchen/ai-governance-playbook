#!/usr/bin/env node
// 模板:周治理对账包生成器(单一心跳的备料端;登记进 registry 的心跳条目)。谁填:顶部常量按项目实际路径改,正文逻辑无需改;在仓库根目录运行。
// 扫描治理文件,输出 markdown 对账包到 stdout;由 .github/workflows/weekly-governance.yml(或你环境的等效定时器)每周开 Issue。
// 只读,零依赖。触发/备料自动化,判断留给负责人。
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// ── 路径常量(按你的项目实际改;其余逻辑别动) ──
const CONSTITUTION_FILE = "CLAUDE.md"; // Codex / AGENTS.md 为宪法正本的环境改为 "AGENTS.md"
const CHANGELOG_FILE = "CHANGELOG.md"; // 流水不在根目录的改这里(如 "docs/CHANGELOG.md")
const QUESTIONS_FILE = "governance/questions.md";
const INCIDENTS_FILE = "governance/incidents.md";
const REGISTRY_FILE = "governance/registry.md";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8"); // 本脚本假定位于 scripts/,上一级即仓库根
const git = (cmd) => { try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } }; // 首次安装尚无 commit 时不崩
// 日期一律用本地时区——toISOString / new Date("YYYY-MM-DD") 按 UTC 解释,非零时区会算出「-1 天」负数(实测缺陷)
const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseLocal = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }; // 本地时区零点
// GOV_REVIEW_DATE=YYYY-MM-DD 可覆盖今日(测试节拍分支用)
const today = parseLocal(process.env.GOV_REVIEW_DATE || localISO(new Date()));
const daysSince = (iso) => Math.round((today - parseLocal(iso)) / 86400000); // round 抹平夏令时 ±1h
// 节拍:cron 保证每周一跑;当月第一个周一 = 月度期;1/4/7/10 月的月度期 = 季度期;1 月的 = 年度期
const isMonthly = today.getDate() <= 7;
const isQuarterly = isMonthly && [0, 3, 6, 9].includes(today.getMonth());
const isYearly = isMonthly && today.getMonth() === 0;

// ── ① 问题队列:未结条目 + 滞留天数 ──
const questions = read(QUESTIONS_FILE);
const qEntries = [];
{
  const lines = questions.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\d+)\.\s+(\d{4}-\d{2}-\d{2})\s*\|\s*(.+?)\s*\|/);
    if (!m) continue;
    // 向后看缩进续行,是否已裁决
    let resolved = false;
    for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j]); j++) {
      if (lines[j].includes("已裁决")) { resolved = true; break; }
    }
    if (!resolved) qEntries.push({ n: m[1], date: m[2], brief: m[3].slice(0, 60), stale: daysSince(m[2]) });
  }
}

// ── ② 事故簿:未闭环条目(条目文本不含精确短语「本条闭环」= 未闭环,per incidents.md 落款约定;
//     不用「闭环」子串——条目正文里的「未闭环」会误命中,子串匹配假绿是实测踩过的坑) ──
const incidents = read(INCIDENTS_FILE);
const openIncidents = [];
{
  // 条目 = 以 "- YYYY-MM-DD |" 开头的整段(到下一条目或文件尾)
  const blocks = incidents.split(/\n(?=- \d{4}-\d{2}-\d{2} \|)/);
  for (const b of blocks) {
    const m = b.match(/^- (\d{4}-\d{2}-\d{2}) \| \*{0,2}(.+?)\*{0,2}(?:\(|:|\|)/);
    if (m && !b.includes("本条闭环")) openIncidents.push({ date: m[1], brief: m[2].slice(0, 50) });
  }
}

// ── ③ 回路活性:近 7 天 CHANGELOG 条目数 + commit 数 ──
const changelog = read(CHANGELOG_FILE);
let weekEntries = 0;
{
  const secs = changelog.split(/\n(?=## \d{4}-\d{2}-\d{2}\s*$)/m);
  for (const s of secs) {
    const m = s.match(/^## (\d{4}-\d{2}-\d{2})\s*$/m);
    if (m && daysSince(m[1]) < 7) weekEntries += (s.match(/^- /gm) || []).length;
  }
}
const weekCommits = Number(git('git rev-list --count --since="7 days ago" HEAD') || 0);

// ── ④ 意图纲领年龄(宪法最后一次改动) ──
const constitutionTouched = git(`git log -1 --format=%as -- ${CONSTITUTION_FILE}`);
const constitutionAge = constitutionTouched ? daysSince(constitutionTouched) : null;

// ── ⑤ registry 预算 + 执行者代际 + 复审清单 ──
const registry = read(REGISTRY_FILE);
const ruleCount = (registry.match(/^\| R\d+ /gm) || []).length;
const genMatch = registry.match(/当前执行者代际[::]\s*([^((\n]+)[((](?:登记\s*)?(\d{4}-\d{2}-\d{2})/);
const generation = genMatch ? { id: genMatch[1].trim(), since: genMatch[2] } : null;
const baseMatch = registry.match(/治理基版[::]\s*([^((\n]+)[((](?:登记\s*)?(\d{4}-\d{2}-\d{2})/);
const baseVer = baseMatch ? { id: baseMatch[1].trim(), since: baseMatch[2] } : null;
// 复审清单:解析规则表行,列出指定频率的条目(季初列「季」,年初再加「年」)
const reviewDue = [];
if (isQuarterly) {
  const wanted = isYearly ? ["季", "年"] : ["季"];
  for (const line of registry.split("\n")) {
    const m = line.match(/^\| (R\d+) \| (.+?) \|.*\| (季|年|换代) \|\s*$/);
    if (m && wanted.includes(m[3])) reviewDue.push({ id: m[1], brief: m[2].slice(0, 40), freq: m[3] });
  }
}

// ── 输出对账包 ──
const iso = localISO(today);
const flag = (bad, txt) => (bad ? `⚠️ ${txt}` : `✅ ${txt}`);
console.log(`## 周治理对账包 · ${iso}

> 机器备料,判断在人。逐项勾完即可关闭本 Issue(目标 ≤1 小时)。

### 读数

- ${flag(qEntries.length > 0 && Math.max(0, ...qEntries.map((q) => q.stale)) > 7, `问题队列:**${qEntries.length} 条未结**${qEntries.length ? `(最长滞留 ${Math.max(...qEntries.map((q) => q.stale))} 天;滞留 >7 天 = 治理信号)` : "(注意:长期空队列也是信号——该问的没问)"}`)}
${qEntries.map((q) => `  - #${q.n} [${q.date} · 滞留 ${q.stale} 天] ${q.brief}…`).join("\n")}
- ${flag(openIncidents.length > 0, `事故簿:**${openIncidents.length} 条未闭环**(无闭环链接 = 未闭环)`)}
${openIncidents.map((x) => `  - [${x.date}] ${x.brief}…`).join("\n")}
- ${flag(weekEntries === 0, `回路活性:近 7 天 CHANGELOG **${weekEntries} 条** / commit **${weekCommits}** 个(连续为 0 = 回路停转或记录纪律死了)`)}
- ${constitutionAge === null ? `⚠️ 宪法(${CONSTITUTION_FILE})尚无 commit 记录(首次安装属正常;入库后此项开始计年龄)` : flag(constitutionAge > 30, `意图纲领:宪法上次改动 **${constitutionAge} 天前**(${constitutionTouched})——超过 30 天该自问:纲领还反映负责人的真实想法吗?`)}
- ${flag(ruleCount >= 30, `规则台账:**${ruleCount}/30**(触顶必须先删后加)`)}
- ${generation ? flag(false, `执行者代际:**${generation.id}**(登记 ${generation.since},${daysSince(generation.since)} 天)——如已换用更强模型,更新 registry 登记行并触发 \`[cap]\` 清仓审查`) : "⚠️ registry 未登记执行者代际(换代清仓失去传感器)"}\n- ${baseVer ? flag(false, `治理基版:**${baseVer.id}**(登记 ${baseVer.since},${daysSince(baseVer.since)} 天)——上游新版比对由 AI 审计执行`) : "⚠️ registry 未登记治理基版(上游回流/升级失去锚点)"}${
  isMonthly ? `

### 📅 本期附加 · 月度腐烂审计(任务书,交给一个全新 session 执行)

> 起一个无上下文的新 session,给它这份任务书;产出的腐烂报告走事故管道(incidents.md)。
- [ ] 逐条核对宪法(${CONSTITUTION_FILE})与现实:命令还能跑吗?描述的结构还是真的吗?
- [ ] 从 registry 随机抽 3 条规则,核查最近的 commit/产物是否实际遵守
- [ ] incidents.md 有无未闭环条目;questions.md 回答是否都已落判例/ADR
- [ ] 故意违反一条 L0/L1 门禁(测试分支),验证真的拦得住(测完还原)
- [ ] 校准点:若连续两次月审零发现,怀疑审计本身腐烂(任务书过时/抽样失效)` : ""}${
  isQuarterly ? `

### 🗓 本期附加 · 季度节拍

**复审到期规则**(逐条问:最近一个周期你拦住了什么?答不出 → 删除或降级):
${reviewDue.map((r) => `- [ ] ${r.id}(${r.freq})${r.brief}…`).join("\n")}

**冷启动演习**:起一个全新 session 空降任一战线,计时到首次有效产出——这是记忆系统质量唯一的可测数字,记入 CHANGELOG 对比上季。` : ""}

### 负责人核对单(不可委托的一小时)

- [ ] 清空问题队列(每条:点头或改一个词;回答由执行者落判例/ADR)
- [ ] 本周纠正过 AI 的话,是否都落成了判例?(没落的现在补:说一声即可,AI 代笔)
- [ ] 抽查 1 个本周合入:五分钟能否答出「为什么做/证据在哪/何时发生」?
- [ ] 读一遍宪法「意图纲领」段:还是你的真实想法吗?变了当场改
- [ ] 上期对账 Issue 是否已关?(未关先处理旧账)

> 载体:registry 心跳条目(L1)· 死亡条件:连续 8 期零互动 → 换渠道或降级`);
