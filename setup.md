# setup.md · 治理安装流程

> 给项目AI执行。机制以[CORE.md](CORE.md)为准；本文件只规定安装顺序。存量项目先读本文附A。
>
> ⛔ **禁止手工抄治理文件**(从别的项目复制 CLAUDE.md/hook 脚本拼一套):`.claude/` 不随 git 走,手工抄必漏 hook 载体,且无 lock 登记=脱离模板管辖无法升级(判例 2026-07-28)。唯一正道 = 跑 `init.mjs`;目标仓已有零散治理文件但无 `governance.lock.json` 的,视为「手工抄残骸」,按附A 收编。

全新项目或零上下文 AI 先读 [`BOOTSTRAP.md`](BOOTSTRAP.md)；它固定默认 `standard`，负责定位/克隆 playbook、调用真实 runtime 探测、运行 init、doctor 和 lint。本文件保留完整解释、Profile 例外、存量迁移和安装报告合同。

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

## 1.1 需求入口策略

支持两种需求入口方式，默认本地化：

- `local`（默认）：安装 `docs/requirements/backlog.md` 并以本文件为活要求；不能空白。
- `external`：不写入本地 backlog，`docs/index.md` 与运行时指令中 `REQUIREMENTS_SOURCE` 必须直接指向外部系统（Issue、PRD、产品项目等），并说明映射关系。

外部模式禁止再用本地 `docs/requirements/backlog.md` 维护状态字段（`[ ]/状态/负责人`），否则会被 `governance-lint` 阻断，防止“双套需求系统”。

在命令中显式选择：

```bash
node scripts/init.mjs \
  --target /path/to/project \
  --requirements-mode local \
  --write
```

或

```bash
node scripts/init.mjs \
  --target /path/to/project \
  --requirements-mode external \
  --requirements-source https://issues.example.com/my-project \
  --write
```

## 1.2 存量版本升级（治理编译）

`governance.lock.json` 记录项目实际采用的 kit 版本、指纹和适配结果。版本核对与能力升级
分开：母版升级/来源准入默认只读、不拉取、不写 lock、不迁移。显式升级也必须按能力运行，
不得把版本号或下载结果当作全量采用；项目宪法、游标、业务文档、policy、catalog 和仓外事实
始终保留在项目。

线上正本是 GitHub 默认分支，不是某台电脑上的脏工作树。来源准入只信本地已抓取的
`refs/remotes/origin/main`；母版升级计划不自动联网或 fetch，需要刷新母版时由负责人正常显式
执行 `git fetch` 后再重跑只读计划。项目公共线（如 `integrationLine`）同步仍按项目合同执行，
合同允许时可联网 fetch；SessionStart 的实际接线和行为以项目证据为准，本页不宣称它已比较
`origin/main` 的 `VERSION`。

```bash
node scripts/upgrade.mjs --target /path/to/project
```

上述命令是只读计划。当前唯一可显式写入的能力是 discovery，且必须由负责人确认计划后
同时带 `--write`：

```bash
node scripts/upgrade.mjs --target /path/to/project --capability discovery --write
```

它只安装 8 个发现能力 CLI/库，并在 lock 的 `capabilities.discovery` 写入
`status=file-install-only` 回执；不改变 `playbookVersion`、`kitFingerprint`、admission、
任何 Hook、policy、项目事实或基础接线。目标脏、来源未提交、已有未登记定制或验证失败
均不覆盖；写入失败整批回滚。未带 `--capability` 的旧式 `--write` 必须拒绝，`full` 暂不
提供。

`doctor` 发现 lock 版本或指纹与当前 kit 不一致时会阻断完成声明。那是体检，不是让人
`--force` 覆盖项目事实。发布状态与当前游标见 [ROADMAP.md](ROADMAP.md)；来源 ref 未抓取、
版本或指纹无法证明时只报告，不把版本写入消费仓 lock，也不写成完成。

## 1.3 项目发现能力（按需、项目自有事实）

发现能力的 schema、八个任务域、检索、地图预算与离线诊断合同见
[`docs/project-discovery.md`](docs/project-discovery.md)。安装能力文件不自动生成资产，也
不自动接入任何运行时；项目只有在完成真实事实适配和对应客户端 fixture 后才能声称采用。

项目按需维护 `docs/architecture/project-catalog.json`：

- `schemaVersion` 固定为 `1`；`assets` 可为空；没有 catalog 时目录 CLI 报告“未配置”，
  地图在缺少/为空的 `discoveryIds` 时报告未装载，不填示例主机、服务、团队或 100% 覆盖率；
- 可选声明 `sourceRoots`、`sourceCollections`、`workstreamDirectory`；省略即为未知范围，
  不能把全仓当作已检查；
- 每个资产使用稳定 `id`、多 `aliases`/`tags`、一跳 `links`、入口与边界；凭据仅引用
  `docs/ops/extra-repo-facts.json` 的 ID，正文不进 catalog、地图或 CLI 输出；
- 所有资产正文、源码根、工作线、外部路径和凭据索引留在项目本地，母版不代填。

能力安装后，项目可在本地离线运行：

```bash
node scripts/project-catalog.mjs --check --json
node scripts/discovery-map.mjs
node scripts/project-catalog.mjs --query <名称或别名>
node scripts/project-catalog.mjs --category '<任务域>'
node scripts/environment-check.mjs --url https://<目标路径>
```

`environment-check` 仅按需对单个 HTTPS URL 做无凭据、单次、有界 HEAD，不跟随跳转、不
重试；一次 HTTP 回执不证明真实业务、其它机器或所有客户端可用。

## 2. 填项目事实

安装器只建载体，不替负责人发明意图。完成以下项目化：

- 意图按运行时指令正本的[意图段规定动作](templates/common/INSTRUCTIONS.md#意图)处理：先从真实材料起草建议稿、在`governance/questions.md`挂确认问题，再由负责人确认；本节不另维护一套意图规则。标题/`PROJECT_NAME`使用basename（机械、稳定、不需要 AI 判断）；意图正文使用项目的真实/自称名；两者不一致时沿用上述意图段规定动作（先起草建议稿、再在`governance/questions.md`挂确认问题），不要静默二选一；
- `ROADMAP.md`写真实游标、战线和硬约束；
- `docs/architecture/repository-layout.md`分类现有顶层目录；
- `docs/index.md`指向真实架构、需求、决策和运行文档；架构/需求指针是markdown链接、已进死链检测射程，指针必须指向真实存在的文件，不能留安装器默认占位路径（`docs/architecture.md`、`docs/requirements/backlog.md`）。全新项目的正确动作是把安装器已经建好的这两个权威文件内容填成真实架构/需求正文；只有当项目确实希望架构或需求文档存放在别的路径时，才需要同时改指针和搬文件，不要在双方都不需要改路径的情况下产生“是不是要挪地方”的误判；
- 若采用发现能力，`docs/index.md` 另以真实相对 Markdown 链接指向项目实际的 catalog/架构入口；没有 catalog 或资产时保留“未配置”状态，不为索引覆盖率制造虚假文件；
- `governance/policy.json`登记真实验证命令和项目特定危险操作；
- `.gitignore`至少含`.env.local`/`node_modules`（安装器提供最小样例，已有的合并而不是覆盖）——「真实凭据不进git」红线的day-1结构前提；
- Standard/High Assurance逐条审计`registry`，删除不适用的示例规则；
- 前端extension填写设计意图、token、组件和多端映射。

新安装由 `init.mjs --write` 生成一份完整正文，并把它字节级复制到 `AGENTS.md` 与 `CLAUDE.md`，两者必须一致。已有项目的一份正本加一份手写短桥接仍是合法存量形态；lint 只用“短文件 + 指向另一文件的 Markdown 链接”启发式兼容它，不覆盖项目事实。

## 3. 启用运行时载体

### Codex

1. 确认项目已trusted；
2. 新开会话，用`/hooks`审核并信任`.codex/hooks.json`当前哈希；非托管 Codex Hook 的信任边界以此为准，**写入 `.codex/hooks.json` 不代表已生效**；
3. 测试Rules：

```bash
codex execpolicy check --pretty --resolve-host-executables --rules .codex/rules/default.rules -- git reset --hard
```

不带`--resolve-host-executables`测不出绝对路径写法（例如`/usr/bin/git reset --hard`会判定`matchedRules`为空，即规则形同虚设）。

4. 手工向PreToolUse Hook输入一个危险命令fixture，确认返回`decision:block`。
5. 手工触发 SessionStart fixture，确认 Codex 侧返回可解析 JSON，`systemMessage` 与 `hookSpecificOutput.additionalContext` 同源，并出现治理版本、当前状态和 `✅ 开机自检`。
6. 在未开机、许可过期和关键接线变化三个负例下，确认 Codex PreToolUse 拦截直接写文件；重新开机后正例放行。
7. 手工触发一次成功 Stop fixture，确认每轮结束都显式显示从 `governance.lock.json` 读取的治理版本铭牌和 `✅ 治理验证: 通过`；若存在 active claim 或 dirty worktree，只能追加这些确定性提示。

### Claude Code

确认`.claude/settings.json`加载，并对SessionStart、PreToolUse、Stop各跑一个fixture。

### Standard及以上

```bash
git config core.hooksPath .githooks
```

GitHub Actions只有在远端启用branch protection和`deterministic` required check后，才能登记为共享阻断门禁。AI review保持建议层。

仓库暂无远端时的完整降级路径：pre-commit承载同等确定性检查并真实跑过一次；registry（或安装报告）如实登记「CI就绪未激活」；接入远端后用一次空提交验证workflow真实运行，再按上款登记共享门禁。

心跳定时器：GitHub项目由workflow schedule承载；非GitHub环境用等效定时器（CI schedule / 本地cron）并如实登记载体。本地cron/日历提醒属仓库外动作——安装AI备好脚本与运行说明、把「负责人自设提醒」写入安装报告即算完成本步，不虚报「已配置」。

Standard及以上还自动安装认领门：`scripts/claim.mjs`、`governance/claim-gate.md` 和共享 PreToolUse/SessionStart/Stop 接线。Lite 不安装认领账本脚本；共享 hook 对缺失模块动态降级，不能因此破坏原有危险命令拦截。认领门默认保护 `src/`、`scripts/`，项目范围通过 `governance/policy.json` 的 `claimGate` 覆盖。

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

若安装了 discovery 能力，附加运行：

```bash
node scripts/project-catalog.mjs --check --json
node scripts/discovery-map.mjs
```

这两条命令只验证项目显式声明的 metadata；catalog 缺失时报告未配置，地图在
`discoveryIds` 缺失/为空时报告未装载，不凑 100% 覆盖。catalog/schema 通过不代表
SessionStart/PreToolUse 已接线，单次 CLI 或环境回执也
不代表生产、其它机器或所有客户端可用。

安装器不自动提交。未获提交授权时保留工作树并报告未跟踪/未提交状态；多人或多AI项目在获授权后应由任务分支形成范围清楚的提交并push/MR，经共享门禁后再合并默认分支，默认不直接写`main`。只有形成可识别的Git基线后，才能宣称迁移可回退、Hook哈希已稳定或治理基线已落地。

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

## 4. 建立运行时宪法形态

- 新安装：`AGENTS.md` 与 `CLAUDE.md` 是字节一致的完整双正本，运行时只决定哪一份被优先自动加载；
- 存量迁移：保留既有一份正本 + 一份短桥接，先让 lint/doctor 绿，再由负责人决定是否切换为双正本；
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
- [ ] 新安装的`CLAUDE.md`与`AGENTS.md`字节一致；存量桥接项目已由 lint 证明为短文件+Markdown指针，且没有第二份正文；
- [ ] 项目意图已由负责人确认；
- [ ] ROADMAP、架构、需求、目录结构各有唯一权威；
- [ ] 决策权威唯一：存量项目已有ADR目录则指令与`docs/index.md`指向它；否则`docs/decisions/`已建且ADR-000记录治理采纳；
- [ ] `governance.lock.json`记录版本、runtime、profile和已安装文件。
- [ ] 已形成获授权的Git基线，或明确报告全部未跟踪/未提交文件；没有基线时不宣称可回退或Hook哈希稳定。

## 载体

- [ ] 每条核心规则写清trigger、predicate、effect、carrier和绕过；
- [ ] 需要物理禁止的规则优先落IAM、只读凭据、schema或API边界；
- [ ] Codex项目已trusted，并用`/hooks`审核当前Hook哈希；
- [ ] Claude/Grok SessionStart fixture 返回带 `✅ 开机自检` 的同源文本，Codex 返回可解析 JSON 且 `systemMessage` 与 `hookSpecificOutput.additionalContext` 同源；三运行时缺票/过期/接线变化写入负例均阻断；Codex 未过 trusted + `/hooks` 前不得宣称 Hook 已生效；
- [ ] PreCompact fixture 注入目录/分支/HEAD，且不执行 `git commit`；Codex 侧返回 JSON，Claude/Grok 侧为文本；
- [ ] Stop success fixture 每次都显式显示治理铭牌与 `✅ 治理验证: 通过`；有 active claim/dirty worktree 时只追加确定性提示；
- [ ] PreToolUse危险命令fixture真实被阻断；
- [ ] Stop验证失败与第二次失败的输出都带治理版本；第二次仍失败会如实报告而不是无限循环；
- [ ] `.rules`用`codex execpolicy check`验证match/not_match（Codex）；
- [ ] pre-commit已启用或明确不安装（Standard及以上）；
- [ ] CI deterministic job真实运行；required check状态如实登记；
- [ ] 无远端仓库时按降级路径执行：pre-commit已真实承载同等检查，「CI就绪未激活」已如实登记，接入远端后用空提交补验；
- [ ] 心跳定时器已挂（workflow schedule或等效定时器），或降级形态（本地cron/负责人自设提醒）已如实登记进安装报告（Standard及以上）；
- [ ] AI review只读且不是唯一硬门禁。

## 项目发现能力（若安装）

- [ ] `docs/architecture/project-catalog.json` 是项目本地唯一 metadata 正本；`schemaVersion=1`，
  `assets` 可为空，目录 CLI 对缺失 catalog 报告未配置，地图对缺少/为空 `discoveryIds` 报告未装载；
- [ ] 八个任务域、稳定 ID、别名/标签、一跳关联、入口和边界均来自真实项目材料；没有
  为覆盖率或地图预算制造示例资产；
- [ ] `sourceRoots`/`workstreamDirectory` 未声明时覆盖宇宙仍标为 unknown，不将全仓当成 100%；
- [ ] 凭据只以 `docs/ops/extra-repo-facts.json` 中的 ID 引用，地图/CLI/日志无正文；
- [ ] 地图 <=60 行且 <=6 KiB；环境诊断只读、离线默认、按需单目标 HEAD；
- [ ] 能力文件安装、项目 catalog/schema、运行时接线、真实 CLI/环境调用、各客户端证据分开
  记录，未通过的层级不向上宣称。

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
