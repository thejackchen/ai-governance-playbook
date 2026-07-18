# setup.md · 治理安装流程

> 给项目AI执行。机制以[CORE.md](CORE.md)为准；本文件只规定安装顺序。存量项目先读本文附A。

## -1. 通读判例库（先于一切）

通读本仓库 [governance/cases/](governance/cases/README.md) 的全部判例——前人踩过的坑不再踩。它们是历次真实纠正的沉淀（负责人当场纠正当场落档）；安装与后续执行中遇到同族场景，直接类比引用，别重新交学费。

## 0. 先探测，不猜

记录五项：

1. runtime：`codex` / `claude-code` / `generic`；
2. 项目：全新或存量；
3. 风险：原型、真实用户、资金/合规/生产关键数据；
4. 协作：本地单人、多人、是否有Git远端和CI；
5. 领域扩展：是否有前端，是否需要统一设计系统。

按[profiles/README.md](profiles/README.md)选择最小够用Profile。选择更重Profile必须说明风险或消费者；不能因为“看起来完整”全装。

## 1. 先看安装计划

```bash
node scripts/init.mjs \
  --target /path/to/project \
  --runtime codex \
  --profile lite \
  --project-name demo
```

需要前端设计治理时加：

```bash
--with frontend-design-system
```

默认dry-run。检查计划不会覆盖既有文件后，再加`--write`。存量项目禁止直接使用`--force`。

## 2. 填项目事实

安装器只建载体，不替负责人发明意图。完成以下项目化：

- 运行时指令正本中的`TODO(owner)`由负责人确认；
- `ROADMAP.md`写真实游标、战线和硬约束；
- `docs/architecture/repository-layout.md`分类现有顶层目录；
- `docs/index.md`指向真实架构、需求、决策和运行文档；架构/需求指针是markdown链接、已进死链检测射程，指针必须指向真实存在的文件，不能留安装器默认占位路径（`docs/architecture.md`、`docs/requirements/backlog.md`）；
- `governance/policy.json`登记真实验证命令和项目特定危险操作；
- `.gitignore`至少含`.env.local`/`node_modules`（安装器提供最小样例，已有的合并而不是覆盖）——「真实凭据不进git」红线的day-1结构前提；
- Standard/High Assurance逐条审计`registry`，删除不适用的示例规则；
- 前端extension填写设计意图、token、组件和多端映射。

不要复制同一正文到`AGENTS.md`和`CLAUDE.md`。安装器只生成一个正本和一个桥接指针。

## 3. 启用运行时载体

### Codex

1. 确认项目已trusted；
2. 新开会话，用`/hooks`审核并信任`.codex/hooks.json`当前哈希；
3. 测试Rules：

```bash
codex execpolicy check --pretty --resolve-host-executables --rules .codex/rules/default.rules -- git reset --hard
```

不带`--resolve-host-executables`测不出绝对路径写法（例如`/usr/bin/git reset --hard`会判定`matchedRules`为空，即规则形同虚设）。

4. 手工向PreToolUse Hook输入一个危险命令fixture，确认返回`decision:block`。

### Claude Code

确认`.claude/settings.json`加载，并对SessionStart、PreToolUse、Stop各跑一个fixture。

### Standard及以上

```bash
git config core.hooksPath .githooks
```

GitHub Actions只有在远端启用branch protection和`deterministic` required check后，才能登记为共享阻断门禁。AI review保持建议层。

仓库暂无远端时的完整降级路径：pre-commit承载同等确定性检查并真实跑过一次；registry（或安装报告）如实登记「CI就绪未激活」；接入远端后用一次空提交验证workflow真实运行，再按上款登记共享门禁。

心跳定时器：GitHub项目由workflow schedule承载；非GitHub环境用等效定时器（CI schedule / 本地cron）并如实登记载体。本地cron/日历提醒属仓库外动作——安装AI备好脚本与运行说明、把「负责人自设提醒」写入安装报告即算完成本步，不虚报「已配置」。

## 4. 编译项目规则

对每条规则写清：

```text
消费者 / 来源 / trigger / predicate / effect / carrier / bypass / evidence / death condition
```

- 能用IAM、只读凭据、schema或API投影实现的，不只写CI；
- 机器判不准的，不伪装成硬门禁；
- 合规、安全、资金、不可逆和合同规则可在事故前建立；
- 其它预防式规则默认不装。

目录治理默认安装。`allowedTopLevelEntries`只在完成存量目录分类后启用，不能把现有混乱直接快照成“合法结构”。

## 5. 验证

从playbook仓库运行：

```bash
node scripts/doctor.mjs --target /path/to/project
```

从项目仓库运行：

```bash
node scripts/governance-verify.mjs --fast
node scripts/governance-verify.mjs --ci
```

逐项完成[setup.md 附B](setup.md)。有warn可以交付，但必须说明风险、负责人和升级条件；有error不能宣称安装完成。

安装器不自动提交。未获提交授权时保留工作树并报告未跟踪/未提交状态；只有形成可识别的Git基线后，才能宣称迁移可回退、Hook哈希已稳定或治理基线已落地。

## 6. 无上下文演练

至少让一个没有项目历史的全新AI只读取运行时指令、ROADMAP和知识路由，完成一个真实小任务或评审。Standard及以上再增加：

- 危险命令阻断；
- 不可通过测试的红线压力；
- 架构文档分叉检测。

修载体和判据，不修改验收答案迁就失败结果。

## 7. 安装报告

固定交付：

1. runtime、profile、extension及选择原因；
2. 待负责人确认的意图、红线和架构假设；
3. 实际启用的trigger/effect/carrier表；
4. 没装什么、为什么、何时升级；
5. doctor、Hook fixture、CI和无上下文演练证据；
6. 仍可绕过的边界和人工责任。

报告必须区分“骨架已生成”“本地fixture已通过”“Git基线已形成”“远端required check已生效”，不得把前一层证据升级成后一层结论。

---

# 附A · 存量项目迁移(原 MIGRATION.md)
> 原则：保留历史、建立新权威、逐步切流、随时可回退。迁移不是借机重写业务文档。
> 动手前先通读本仓库 [governance/cases/](governance/cases/README.md) 的现有判例——前人踩过的坑不再踩，迁移中遇到同族场景直接类比引用。

## 1. 盘点

列出：自动指令、宪法、ROADMAP、backlog、ADR、runbook、lint、Hooks、CI、权限策略和口头惯例。每项记录：消费者、实际触发、能否阻断、最近一次产生价值。

同时扫描历史版本和已废弃文件，逐条判定：保留、合并、降级、删除、升级载体。过时正文由Git历史保存，不在现行目录继续伪装成指令。

## 2. 选择Profile

- 本地原型默认Lite；
- 有远端、多人或真实用户进入Standard；
- 资金、合规、生产写权限进入High Assurance。

不要把模板文件清单当合规清单。

## 3. Dry-run安装

运行`init.mjs`但不加`--write`，确认新文件位置和现有冲突。再以`--write`安装；已有文件默认跳过。

禁止迁移第一步就`--force`覆盖既有`AGENTS.md`、`CLAUDE.md`、ROADMAP或ADR。

## 4. 建立唯一运行时正本

- Codex：`AGENTS.md`为正本，`CLAUDE.md`只指向它；
- Claude Code：`CLAUDE.md`为正本，`AGENTS.md`只指向它；
- 旧治理正文头部加降级指针，或在确认内容已吸收后删除现行副本；Git历史负责保留。

产品纲领可以保留为单独的`CONSTITUTION.md`，但运行时指令只引用它，不复制全文。

## 5. 目录分类

填写`docs/architecture/repository-layout.md`。先把既有顶层项分成源码、配置、文档、生成物、缓存和历史，再决定迁移或保留。

分类完成前不要启用`allowedTopLevelEntries`；启用后新增顶层目录必须同时更新结构地图并经过ADR或架构评审。

## 6. 规则迁移

旧规则逐条经过[CORE.md](CORE.md)六问：

- 没有消费者或来源的删除；
- 只靠文档但需要阻断的升级载体；
- 机器判不准的从CI降为review/AI建议；
- 重复规则合并到一个权威；
- 当前工具能力补丁标`[cap]`和清理条件。

历史事故不搬运；新事故从新事故簿开始，并链接旧归档位置。

## 7. 先影子运行，再切门禁

Hooks、lint和CI先以warn或非required方式运行一轮，确认误报率和耗时；判据稳定后再升级为block/required。安全和不可逆红线已有确定判据时可以直接阻断。

## 8. 对照验证

用无上下文AI重做1至3个近期真实任务：项目定位、当前游标、不能碰的边界、正确验证命令必须读得出来。再跑危险命令、假全绿压力和架构分叉案例。

失败时修规则、触发或判据，不把答案塞进case prompt。

## 9. 回退

迁移前不搬历史、不删除业务文件。回退时移除新增适配器、Hooks、lock和新入口，恢复旧入口指针即可。涉及业务结构的整理必须有独立ADR和提交，不能和治理安装混成一个不可逆改动。

---

# 附B · 安装验收自检(原 SELF-CHECK.md)
> 每项附命令、输出或文件链接。`doctor`为0 error是最低线，不代表语义已经对齐。

## 运行时与单一真相

- [ ] runtime和Profile选择有风险依据，不是默认全装；
- [ ] Codex只有`AGENTS.md`正文，Claude Code只有`CLAUDE.md`正文，另一文件是桥接；
- [ ] 项目意图已由负责人确认；
- [ ] ROADMAP、架构、需求、目录结构各有唯一权威；
- [ ] 决策权威唯一：存量项目已有ADR目录则指令与`docs/index.md`指向它；否则`docs/decisions/`已建且ADR-000记录治理采纳；
- [ ] `governance.lock.json`记录版本、runtime、profile和已安装文件。
- [ ] 已形成获授权的Git基线，或明确报告全部未跟踪/未提交文件；没有基线时不宣称可回退或Hook哈希稳定。

## 载体

- [ ] 每条核心规则写清trigger、predicate、effect、carrier和绕过；
- [ ] 需要物理禁止的规则优先落IAM、只读凭据、schema或API边界；
- [ ] Codex项目已trusted，并用`/hooks`审核当前Hook哈希；
- [ ] PreToolUse危险命令fixture真实被阻断；
- [ ] Stop验证失败时会要求修复，第二次仍失败会如实报告而不是无限循环；
- [ ] `.rules`用`codex execpolicy check`验证match/not_match（Codex）；
- [ ] pre-commit已启用或明确不安装（Standard及以上）；
- [ ] CI deterministic job真实运行；required check状态如实登记；
- [ ] 无远端仓库时按降级路径执行：pre-commit已真实承载同等检查，「CI就绪未激活」已如实登记，接入远端后用空提交补验；
- [ ] 心跳定时器已挂（workflow schedule或等效定时器），或降级形态（本地cron/负责人自设提醒）已如实登记进安装报告（Standard及以上）；
- [ ] AI review只读且不是唯一硬门禁。

## 内容审计

- [ ] 旧规则逐条完成保留/合并/降级/删除/升级载体判断；
- [ ] 没有“已废弃但仍像现行指令”的正文；
- [ ] 普通规则有消费者和来源；安全/合规预防规则有责任依据；
- [ ] 只读任务不被强制写CHANGELOG或commit；
- [ ] 规则预算符合Profile。

## 目录结构

- [ ] `docs/architecture/repository-layout.md`覆盖所有顶层职责；
- [ ] 临时文件、缓存和生成物有固定位置和ignore；
- [ ] `.gitignore`在位且至少含`.env.local`/`node_modules`——「真实凭据不进git」红线的day-1结构前提；
- [ ] 启用`allowedTopLevelEntries`前已完成人工分类；
- [ ] 新顶层目录和跨层依赖需要ADR。

## 前端扩展（安装时才检查）

- [ ] 设计意图、token、组件和资产各有唯一权威；
- [ ] 多端token由结构化来源生成，不手工维护副本；
- [ ] 新设计原语有复用门和决策记录；
- [ ] 可访问性、响应式、关键交互和视觉回归有验证计划。

## 机器验证

```bash
npm test
npm run check
node scripts/doctor.mjs --target /path/to/project
```

- [ ] 全部0 error；warn有负责人、风险和处理期限；
- [ ] common模板、三个adapter和profile契约测试通过；
- [ ] 无上下文AI案例至少覆盖新项目、存量迁移和红线压力；
- [ ] 验收失败修载体，不修改期望答案迁就结果。

## 交付

- [ ] 报告列出装了什么、没装什么、为什么；
- [ ] 列出仍可绕过的边界；
- [ ] 负责人知道何时从Lite升级Standard或High Assurance；
- [ ] 变更已按授权提交，未夹带目标项目的无关改动。
