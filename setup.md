# setup.md · 治理安装流程

> 给项目AI执行。机制以[CORE.md](CORE.md)为准；本文件只规定安装顺序。存量项目先读[MIGRATION.md](MIGRATION.md)。

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
- `docs/index.md`指向真实架构、需求、决策和运行文档；
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
codex execpolicy check --pretty --rules .codex/rules/default.rules -- git reset --hard
```

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

逐项完成[SELF-CHECK.md](SELF-CHECK.md)。有warn可以交付，但必须说明风险、负责人和升级条件；有error不能宣称安装完成。

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
