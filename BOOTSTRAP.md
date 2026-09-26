# 治理安装与迁移

唯一安装入口。方法论见 [CORE.md](CORE.md)，运行时协议与边界见 [adapters](adapters/README.md)。

## 新项目：Lite 默认

前提：目标必须为 Git 仓库根目录；Node ≥20、Git、真实 `gitleaks` 可执行文件。无需 npm 依赖；若需 npm，使用 `https://registry.npmmirror.com`。
只选择项目实际使用的工具；纯手动检查使用 `--tools generic`。

```sh
node <mother>/scripts/init.mjs --target /path/to/project --tools claude-code,codex
node <mother>/scripts/init.mjs --target /path/to/project --tools claude-code,codex --write
```

首条是只读计划；第二条安装并执行自检。第三工具按需追加为 `--tools claude-code,codex,grok`。
已有文件保持不变；安装遇到旧 v4 lock、工具集合改变或目标路径软链接会停止，保留事实供审查。
已有 `docs/ROADMAP.md` 或 `docs/index.md` 登记的其他路线图时，计划显示 `KEEP`，不会另建根目录路线图；若原文缺少带日期的 `## 当前游标`，dry-run 与安装都会提示补写，安装自检保持失败直到项目自行更新正本。
默认两工具共约 12 个文件；无项目库依赖，治理代码只有 `scripts/governance.mjs`。
`--runtime` 可作为单工具兼容写法；不再由某个 runtime 偷带全部工具。

安装之后：

1. 填写 AGENTS 项目意图、仓外正本路径表、ROADMAP 当前游标（含日期）、docs/index 的已有正本指针。
2. 执行 `node scripts/governance.mjs check`。缺 gitleaks 或发现凭据必须失败，不能把跳过扫描当通过。
   已确认误报可在对应行添加 `gitleaks:allow`，或将 gitleaks 报告的项目相对路径指纹（`路径:规则:行号`）写入项目根 `.gitleaksignore`；扫描器同时检查工作树和暂存区，未登记的发现仍须失败。
3. 将同一 `check` 命令接入已有 pre-commit，再接项目自身 lint/typecheck/test。保留原项目门，不用治理检查替换业务测试。
4. 在真实客户端开始新会话，验证启动坐标；Codex 在 `/hooks` 审核并信任定义。先运行安全命令，再发送危险命令负例，确认工具被拒绝（不得实际执行）。
5. 测试有改动但未更新游标时 Stop 提醒一次，游标更新后放行；压缩恢复应重新获得坐标。
6. 独立零上下文回答“做什么/做到哪、开工读什么、红线、如何证明完成”，平均 ≥80、最低 ≥60 才具备方法论验收证据。

机器自检只能证明静态接线与脚本行为；不能代证 UI trust、真实 hook 生命周期、项目业务或发布成功。
脚本不自动启用共享 Git 配置，不自动提交，不发布、不把版本写回消费项目。

## 从 v4 迁移：按需三步

1. **保存与规划**：在独立 worktree/分支留存当前差异和恢复点，确认实际工具与已有治理入口；保留意图、需求、架构、历史 claim/registry/事故数据和用户 WIP。在 `/tmp` 新仓试装 Lite，比较文件与真实行为。
2. **有界替换**：将单脚本与所需接线合并到项目；移除 admission、旧启动/Stop 等重复接线。已有事实只改指针，不覆盖正文；历史制度停写并保留数据。铭牌改为 schemaVersion=2、profile=lite、版本/日期/tools，去掉 installedFiles 与施工票据约束；root/table 内容按项目事实填写。
3. **独立验收再采用**：跑项目原检查、`check`、真实 gitleaks、本文 hook 正反探针及独立冷启动考试。验证失败退回保存点；验证成立才记录采用版本。母版发版不代表任何消费项目已经迁移。

普通 init 不负责替存量项目做语义迁移，也不支持以 `--force` 覆盖事实。没有升级需求的项目继续原采用版本。

## 兼容与按需命令

```sh
# 显式 v4 兼容安装；不符合 Lite 体量/常驻机制预算
node <mother>/scripts/init.mjs --target /path/to/project --profile standard --runtime codex --write
node <mother>/scripts/init.mjs --target /path/to/project --profile high-assurance --runtime codex --write
# 母版按需工具；不默认装进 Lite
node <mother>/scripts/governance-update.mjs --target /path/to/project --offline
node <mother>/scripts/project-catalog.mjs --root /path/to/project
node <mother>/scripts/discovery-map.mjs --root /path/to/project
node <mother>/scripts/environment-check.mjs --root /path/to/project
```

在线版本发现必须显式调用母版 `governance-update.mjs --target ...`；结果是建议，不是授权或已采用状态。
可选 v4 discovery 文件安装与回滚详见 [按需工具](docs/playbook-update.md)，不要对 Lite 使用旧文件升级器。
历史判例仅在母版 [索引](governance/cases/README.md) 按问题检索，不要求开工通读。

## 母版自检与发布

```sh
npm run check && npm test
node scripts/governance-verify.mjs --ci
```

自动化与独立无上下文前向考试未过不发布；VERSION 在最终验收之后由发布负责人变更。
