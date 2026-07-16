# templates/ — 治理零件库(setup.md 是流程,这里是零件)

> 本目录 = 可直接复制的占位骨架。**别只抄零件不走流程**:安装顺序、环境自适配、首任务演练都在 [setup.md](../setup.md)——流程里的验收步骤是防装歪的,零件本身不防。
> 所有 `{花括号中文说明}` 都是占位符;每个文件头部第一行注释写明「填什么、谁来填」,填完把该注释删掉。

## 复制清单(整目录拷到项目根,保持相对路径)

```
CLAUDE.md                                宪法九段骨架(L2 会话注入;硬上限 150 行)
AGENTS.md                                宪法双入口桥(按环境二选一)
ROADMAP.md                               当前状态唯一权威(游标 + 约束登记 + 战线表)
CHANGELOG.md                             事件流水(append-only,格式与心跳脚本对齐)
docs/index.md                            知识路由表(什么知识住哪)
docs/decisions/ADR-000.md                首份决策记录:采纳治理本身(安装完成时填写)
governance/registry.md                   规则台账(day-1 底座示例条目已就位)
governance/incidents.md                  事故簿(棘轮必填)
governance/questions.md                  问题队列(执行侧 → 负责人唯一升级通道)
governance/cases/README.md               判例库索引(六字段格式)
scripts/weekly-governance-review.mjs     心跳对账包生成器(零依赖 Node 脚本)
scripts/heartbeat-audit-prompt.md        AI 审计任务书(心跳判断层输入)
scripts/generate-capabilities.mjs        能力清单生成器(代码即注册表;--check 挂 pre-commit/CI 保鲜)
.github/workflows/weekly-governance.yml  单一心跳 cron(每周开对账 Issue)
.githooks/pre-commit                     提交门禁样例(占位结构,按项目工具裁剪)
.gitignore                               忽略样例(.env.local/node_modules 等——宪法「凭据不进 git」红线的结构前提)
```

(本 README 是零件库说明,不复制到目标项目。)

## 填占位顺序(先环境、后项目、再联动)

1. **环境类**(由 setup 第 0 步的探测结果决定,映射表见 [ADAPTERS.md](../ADAPTERS.md)):
   - `CLAUDE.md` 头部双入口声明 + `AGENTS.md` 二选一;
   - 宪法 boot/landing 段的载体描述(自动注入 / hook / pre-commit+CI);
   - `registry.md` 每条的载体列与出处列(**如实填,诚实优先于完备**);
   - `scripts/weekly-governance-review.mjs` 顶部路径常量(Codex 环境把宪法常量改 `AGENTS.md`)。
2. **项目类**(内容来自负责人与项目现实):
   - 宪法:项目名 / 意图纲领(负责人确认)/ 不变量 / 项目特定红线 / 有成本动作清单;
   - `ROADMAP.md` 第一条真实战线与游标;`docs/index.md` 登记现有文档住址;
   - `.githooks/pre-commit` 三段门禁命令(没有对应工具的整段删)。
3. **联动检查**:宪法里每条红线/协议在 `registry.md` 都有户口;所有 `.md` 链接指向的文件真实存在;全局搜 `{` 确认无残留占位。

## 首跑验证命令

```sh
wc -l CLAUDE.md                                # ≤150
node scripts/weekly-governance-review.mjs      # 输出周对账包(在仓库根运行)
GOV_REVIEW_DATE={下月第一个周一} node scripts/weekly-governance-review.mjs  # 出现「月度腐烂审计」段
git config core.hooksPath .githooks            # 装 hook(每个 clone 都要做一次)
git commit --allow-empty -m "治理安装冒烟"      # 真实触发一次 pre-commit + CI
```

装完回 [setup.md](../setup.md) 第 2 步(首任务演练)与第 3 步([SELF-CHECK.md](../SELF-CHECK.md) 自检 + 交付报告)。
