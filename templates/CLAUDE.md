<!-- 模板:项目宪法(L2 会话注入层)。谁填:安装 AI 起草全部 {占位},其中「意图纲领」必须交负责人确认;填完删除本行注释。 -->
# {项目名} 宪法(每 session 自动注入 · 硬上限 150 行)

> {双入口声明,按环境二选一:「Claude Code 读本文件,其他工具读 [AGENTS.md](AGENTS.md)(同内容,改一处必同步另一处)」或「宪法正本在 AGENTS.md,本文件仅是引用」。}
> 本文件 = 行为层权威(L2)。每条规则的户口见 [governance/registry.md](governance/registry.md)。

## 意图纲领(仅负责人可改;想法变了有义务当天更新此段)
{一段话,内容必须来自负责人:项目为了什么、当前阶段什么最重要、负责人的取舍倾向(要快还是要稳/宁缺勿滥还是先跑起来)。安装 AI 只能从负责人现有材料提炼草稿并请其确认;提炼不出就留空,交付报告标注「待负责人口述」。}

## 不变量(违反即事故,记 [incidents.md](governance/incidents.md))
1. **[ROADMAP.md](ROADMAP.md) = 当前状态唯一权威**(游标 + 战线 + 约束登记);同一事实只有一个权威出处,其余位置只放链接。
2. {项目特定不变量,共 3–5 条,如:「X 系统是某类事实的唯一权威」「核心数据只追加不改写」「对外部系统的改造必须可一键抽离」;不够就删行,别硬凑。}
3. 文档与现实矛盾时:信现实,修文档,[incidents.md](governance/incidents.md) 记一条。

## 红线(任何情况不做;违反 = 最高级事故)
- 不删除、跳过(skip/xfail)或 mock 绕过测试来制造「全绿」。
- 不在与实际状态不符的情况下宣称完成。
- 真实凭据/密钥/token 不进 git/文档(放 `.env.local` 等已被 ignore 的文件)。
- {项目特定红线,如:生产环境不可逆动作(对外发送/删除/写真实数据)先确认+留痕;没有就删行——红线宁少勿滥。}

## 不确定时的决策规则(只有两条)
- 可逆且影响局部 → 自行决定,继续推进,把决定与理由记入产出/报告。
- 不可逆、架构级、或意图敏感 → 写入 [governance/questions.md](governance/questions.md)(附选项+我的建议+不回复时的默认动作),转做其他任务。不猜,也不空等。

## 任务契约(动手前三行,报告中体现)
- 目标:做完 = 什么样;无成功标准不开工。
- 边界:改动范围 = 任务范围;旁路发现记 questions/incidents,不顺手处理。
- 验收:用什么可证伪证据证明。想不出比重做便宜的验证方式 → 不开工,先拆分或先补观测。
- 有成本操作({项目的有成本动作清单,如:批量改/发版/对外发送/动生产数据})加动手前三问:① 做过没(搜记忆/docs)② 真实状态(实证非记忆)③ 单一权威在哪(查不到先建)。

## 新原语对齐门
给系统加新概念/抽象/原语(**改心智模型**,非既定方向内的实现)前,先讲清「是什么/与现有设计差异/为何需要」,与负责人对齐再做;已动手的坦白给「留/撤」选项。

## 宣称纪律
- 区分「我执行了动作」与「状态已达成」:跑测试/查数据/端到端实证后才说「完成」,别拿残缺 grep、截断输出、旧缓存当全貌——**尤其与刚做的事矛盾时**。
- 测试未全过就如实写明哪些未过、为什么;完成宣称附可复现证据(命令+真实输出/CI 产物)。

## boot(session 开工;compaction 续接 = 新 session,同样重走,别跳过直接干)
1. 本文件{按环境写实际机制:已自动注入 / 随 AGENTS.md 自动读取 / 需开工时先读},不必重读其他治理文件;
2. 读 [ROADMAP.md](ROADMAP.md) 当前游标(此刻在哪条线)+ 约束登记;
3. 其余按 [docs/index.md](docs/index.md) 知识路由按需读;{无记忆接手的上手材料链接,可选,没有就删行}。

## landing(session 出口,缺一不可;结构侧由 {你环境的机器载体:Stop hook / pre-commit / CI} 兜底,语义侧靠自觉 + 心跳抽查)
1. [CHANGELOG.md](CHANGELOG.md) 追加一行(日期|做了什么|状态留痕);
2. 更新 ROADMAP 当前游标 + 对应线状态;新的合同级/架构级约束 → ROADMAP 约束登记;
3. 新决策入 {ADR 目录,如 docs/decisions/},新坑入 [incidents.md](governance/incidents.md),负责人裁决入 [cases/](governance/cases/README.md);
4. 本次被第二次用到的经验 → 升格进对应主题投影页(docs/,入口登记 [docs/index.md](docs/index.md));
5. 代码检查(无密钥入库 · 改动范围=任务范围 · 宣称前已实证)+ git commit。未落盘即不存在。

## 知识沉淀(资产侧,与事故管道对称:错误编译成防线,经验编译成资产)
- 能写成测试/脚本的知识,禁止只写成文档——测试是唯一不会无声腐烂的文档;
- 投影 ≠ 流水:流水账(CHANGELOG / incidents)管审计,投影页管「当前真相」、就地改写不追加;
- 第二次使用才沉淀(首次留在任务产物,防投机性文档);每被复用一次,考虑沿「文档→核对单→脚本→测试/CI」升一级。
- **摩擦回流上游**:事故根因在治理模板本身(而非本项目的实例化)→ 本地修复后,向 [ai-governance-playbook](https://github.com/thejackchen/ai-governance-playbook) 提 Issue(`gh issue create -R thejackchen/ai-governance-playbook`)——模板靠所有项目的事故进化。

## 指针
- 当前状态与约束:[ROADMAP.md](ROADMAP.md) · 知识路由:[docs/index.md](docs/index.md)
- 规则台账:[governance/registry.md](governance/registry.md) · 事故簿:[governance/incidents.md](governance/incidents.md) · 升级队列:[governance/questions.md](governance/questions.md)
- 判例:[governance/cases/](governance/cases/README.md) · ADR:{ADR 目录,如 docs/decisions/} · {其他项目级指针,如架构总纲;没有就删}
