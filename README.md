# AI Governance Playbook

让 AI 找对意图、守住可执行红线，并把结果交接给下一位执行者。

当前版本：**5.0.0**（本分支已备齐发版内容，尚未 push 或合入 main）。状态与下一步只看 [ROADMAP](ROADMAP.md)。

## 从这里开始

阅读唯一安装入口 [BOOTSTRAP.md](BOOTSTRAP.md)。默认 Lite，按项目实际工具安装：

```sh
node <mother>/scripts/init.mjs --target /path/to/project --tools claude-code,codex
node <mother>/scripts/init.mjs --target /path/to/project --tools claude-code,codex --write
```

Lite 的治理代码只有一个 `scripts/governance.mjs`，双工具约 12 文件、800 行以内。启动只注入本地游标、最近五条带日期决策和 Git 坐标；不联网或发施工许可。Stop 在有改动但游标未更新时提醒一次。

`check` 检查实际接线、游标、凭据防护及暂存软链；真实 gitleaks 缺失即失败，指向仓库外的绝对路径软链接不能提交。建议接入项目已有 pre-commit，同时保留项目自身检查与测试。

误报可在对应行添加 `gitleaks:allow`，或把 gitleaks 报告中的项目相对路径指纹（`路径:规则:行号`）登记到项目根 `.gitleaksignore`。检查会扫描可提交的工作树文件和暂存内容，并对两次扫描显式使用项目根豁免文件；未登记的发现仍会阻断。

## 从 v4 迁移

迁移按需进行，母版更新不强制消费项目升级：

1. 在独立分支/worktree 保存现状和恢复点，确认工具、意图、原有机器门与 WIP；在临时仓试装比较。
2. 合并 Lite 单脚本与实际工具接线，撤下重复许可/旧 hook；保留项目事实和历史账本，把正本路径写进宪法表，铭牌只记版本/档位/日期/工具。
3. 跑项目原检查、Lite 自检、事故正反探针、真实客户端接线与独立冷启动考试；失败回退，验证成立才登记采用。

具体边界和命令见 [迁移入口](BOOTSTRAP.md#从-v4-迁移按需三步)。Standard/High Assurance 继续作为显式 [v4 兼容路径](profiles/README.md)，不符合新 Lite 预算。

## 怎么证明有效

| 验收层 | 需要的证据 |
|---|---|
| 安装与机器防护 | 自检真实通过；缺 gitleaks、坏接线和危险暂存软链必须失败 |
| 运行时 | 真实客户端启动、拒绝、Stop 与 compact；静态文件不能代证 trust |
| 交接 | 无上下文能找到意图/游标/红线/验收，引用文件与行号；平均 ≥80、最低 ≥60 |
| 项目结果 | 项目测试、部署回读和真实业务验收分别说明，不混成“全绿” |

本轮本地数字与事故重放见 [v5 实现审计](docs/audits/v5-lite-implementation.md)；项目实装与独立考试证据见 [发版审计](docs/audits/v5-release.md)。

## 路由

| 内容 | 正本 |
|---|---|
| 方法论 | [CORE.md](CORE.md) |
| 安装、迁移、自检 | [BOOTSTRAP.md](BOOTSTRAP.md) |
| 协议与覆盖边界 | [adapters/README.md](adapters/README.md) |
| 当前状态 | [ROADMAP.md](ROADMAP.md) |
| 知识导航 | [docs/index.md](docs/index.md) |
| 历史教训 | [母版判例索引](governance/cases/README.md)，按问题检索，不默认安装、不要求开工通读 |

开发验证：`npm run check && npm test`；治理载体修改另跑 `node scripts/governance-verify.mjs --ci`。不以删测试或伪造证据制造假全绿。
