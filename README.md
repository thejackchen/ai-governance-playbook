# AI Governance Playbook v3

> 一套面向 AI 主导软件项目的治理编译器：把负责人的意图和项目红线，编译到最靠近风险的载体中。

治理不是文件集合。文件保存规则；Hooks 负责在事件发生时触发；脚本和测试负责判定；CI、权限与运行时约束负责阻断；事故和定时审计负责让治理自身持续修正。

## 核心判断

治理有效性取决于五个相乘项：

```text
规则质量 x 触发覆盖 x 判定确定性 x 阻断强度 x 反馈修复能力
```

任何一项接近零，写得再严厉也只是文档。

完整模型见 [CORE.md](CORE.md)。v1/v2 内容逐条审计见 [docs/audits/v3-content-audit.md](docs/audits/v3-content-audit.md)。

负责人历次真实纠正沉淀为判例库 [governance/cases/](governance/cases/README.md)：新项目安装前先通读，同族场景直接类比引用——判例是唯一随执行者换代增值的治理资产。

三类无上下文AI前向测试、首轮失败和修复证据见 [docs/evals/v3-forward-tests.md](docs/evals/v3-forward-tests.md)。

## 一个核心，不复制两套方法论

本仓库不维护两个分叉版本。公共治理模型只有一份，通过适配器落到不同运行时：

| 运行时 | 自动指令 | 生命周期载体 | 命令策略 | CI 中的 AI |
|---|---|---|---|---|
| Codex | `AGENTS.md` | `.codex/hooks.json` | `.codex/rules/*.rules` | `openai/codex-action` |
| Claude Code | `CLAUDE.md` | `.claude/settings.json` | PreToolUse Hook | 未内置，自行接入 |
| Generic | `AGENTS.md` | pre-commit / CI | 环境权限 | 未内置，自行接入 |

细节见 [ADAPTERS.md](ADAPTERS.md)。

## 三档治理强度

| Profile | 适用 | 默认内容 |
|---|---|---|
| `lite` | 本地原型、单人、多 AI 接力 | 自动指令、状态投影、最小 Hooks、治理 lint |
| `standard` | 活跃开发、多人、准备上线 | Lite + 规则台账、事故/问题/判例、pre-commit、CI、心跳 |
| `high-assurance` | 资金、合规、生产关键数据 | Standard + 强审批、CODEOWNERS、供应链与发布证据 |

Profile 不是成熟度勋章，而是风险和协作成本的选择。详见 [profiles/](profiles/README.md)。

## 快速开始

### 交给 AI 安装

```text
读取 https://github.com/thejackchen/ai-governance-playbook 的 setup.md。
为当前项目安装治理；安装前先通读 governance/cases/ 的现有判例；
自动探测 runtime，选择最小够用的 profile；
存量项目先按 MIGRATION.md 迁移；最后按 SELF-CHECK.md 验收并提交报告。
```

### 使用脚手架

```bash
node scripts/init.mjs --target /path/to/project --runtime codex --profile lite --project-name demo
node scripts/doctor.mjs --target /path/to/project
```

`init` 默认只展示计划；加入 `--write` 才写文件。安装后仍需由 AI 或负责人填写项目意图、权威路径和验证命令。

## 仓库结构

```text
CORE.md                 治理核心模型，所有适配器的唯一方法论来源
ADAPTERS.md             Codex / Claude Code / Generic 的载体映射
profiles/               Lite / Standard / High Assurance 选择规则
setup.md                AI 安装流程
MIGRATION.md            存量项目可回滚迁移
SELF-CHECK.md           安装验收
templates/common/       公共项目模板
adapters/               运行时专属配置与 Hooks
extensions/             可选领域治理（如前端设计系统）
scripts/                init / doctor / verify
tests/                  脚本与适配器契约测试
skill/                  薄入口 skill，流程仍以本仓库为唯一权威
governance/cases/       本仓库判例库：负责人真实纠正的沉淀，安装前先通读
VERSION                 治理基版锚点（下游 lock 登记与上游比对用）
```

## 证据边界

v2 的沙盒实验和真实迁移说明了两个有用方向：特定红线需要显式承载；规则的执行率受载体显著影响。但样本规模不足以证明普适性。v3 不再把小样本结果写成定律，而把它们作为设计证据，并要求每个采用项目继续用事故、门禁命中和无上下文演练校准。

所有项目安装仓库结构地图；前端项目可加`--with frontend-design-system`，把设计语言纳入单一真相和自动验证，而不是把具体视觉规范写进通用治理核心。

## 许可证

MIT。可以复用思想和实现；项目特定规则必须由项目自己的失败、风险或负责人意图证明。
