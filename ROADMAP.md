# ai-governance-playbook Roadmap

> 当前状态唯一权威。只保留当前投影；历史进入CHANGELOG和ADR。

## 当前游标

v3核心、运行时适配器、Profile、脚手架和三组无上下文前向测试机制已就绪。最小可执行需求入口、local/external init+doctor闭环、AIOS治理母版回流、通用前端设计系统扩展、设计语言代表旅程 policy 原语、跨项目发布治理入口与 Codex SessionStart JSON 可视适配、仓外正本路径索引（CORE §7.1 / R11）、`pro-supervised-delivery` skill 已完成本地验证；当前为 v3.4.4：眼前这份必须含有公共线（CORE §7.4 / R14）。落后才拦改文件，不拦测试，不要求分支改名。线上正本是 GitHub 默认分支。

## 硬约束

| 约束 | 权威定义 | 自动守护 |
|---|---|---|
| 核心方法论只有一份 | `CORE.md`、`CORE.md 附(运行时适配)` | kit contract测试 + review |
| 确定性红线不由AI独自裁决 | `CORE.md`第5节 | 脚本测试 + CI |
| 适配器只承载运行时差异 | `CORE.md 附(运行时适配)` | kit contract测试 + review |
| 发布前必须通过自动测试和无上下文演练 | `AGENTS.md`、`docs/evals/` | CI + 发布review |

## 战线

| 战线 | 状态 | 当前里程碑 | 下一步 | 卡点 | 深度文档 |
|---|---|---|---|---|---|
| v3核心与内容审计 | 完成 | 旧规则逐条归并、降级或删除 | 根据前向测试修订 | - | `CORE.md`、`docs/audits/v3-content-audit.md` |
| 运行时与Profile | 完成 | Codex/Claude Code/Generic适配器和三档Profile | 验证安装契约 | - | `CORE.md 附(运行时适配)`、`profiles/README.md` |
| 脚手架与门禁 | 完成 | init/doctor/verify、Hooks、Rules、定时CI和契约测试可运行 | 随运行时变化持续复测 | - | `setup.md`、`setup.md 附B(验收自检)` |
| 前端设计系统扩展 | 推进 | 产品架构正本、设计语言章节、representativeJourneys 结构/证据生命周期门、扩展验证器和SessionStart触达已落盘 | 由消费项目选择页面族、代表链路、参考包并配置真实检查；本轮 local-only 未发布 | - | `extensions/frontend-design-system/README.md`、`docs/decisions/001-frontend-design-language-journeys.md`、`CORE.md` |
| 无上下文前向测试 | 完成 | 新项目、存量迁移和红线压力通过 | 后续版本复用同类夹具 | - | `docs/evals/v3-forward-tests.md` |
| v3发布 | 推进 | v3.4.4 日常目录=公共主干 | 提交、推送并回读远端；不创建正式tag | Codex 非托管 Hook 仍需真实 UI trusted + `/hooks` 审核验收 | `CHANGELOG.md` |
