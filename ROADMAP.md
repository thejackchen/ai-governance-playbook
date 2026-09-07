# ai-governance-playbook Roadmap

> 当前状态唯一权威。只保留当前投影；历史进入CHANGELOG和ADR。

## 当前游标

远端已发布版本为 v4.0.1（`CHANGELOG.md` 2026-08-31 已记录 governance-optimization skill v1.1 收编）；本地 `VERSION` 为 v4.2.0 候选，尚未发布；发布状态按当前游标/远端回读确认。当前工作按 [REQ-GOV-004](docs/requirements/specs/REQ-GOV-004-project-discovery-release.md) 进行：把项目发现能力提炼为通用母版，显式升级并逐项目验收；发布前须有母版准确版本/SHA、完整测试、无上下文证据和消费项目采用清单，不能用版本号冒充采用。此候选不代表母版发布或跨项目采用已完成；这次不碰什么：业务代码、生产部署、主机/服务重启、凭据正文、个人全局配置、他人 WIP、已退出的自动升级/许可/巡检机制。

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
| 治理编译与开机自检 | 推进 | 远端 v4.0.1 已发布；本地 VERSION=4.2.0 为候选；v3.6–v3.7 运行时能力以 CHANGELOG 为准 | 继续复验安装契约；不把版本号当项目采用 | Codex 项目 Hook 仍需真实 UI trust | `docs/requirements/specs/REQ-GOV-003-governance-compilation-and-boot-self-test.md`、`docs/playbook-update.md` |
| 前端设计系统扩展 | 推进 | `frontend-design-system` 的 v3.4.x 变更已记入 CHANGELOG；消费项目采用仍推进 | 由消费项目选择页面族、代表链路、参考包并配置真实检查；采用状态按项目证据确认 | - | `extensions/frontend-design-system/README.md`、`docs/decisions/001-frontend-design-language-journeys.md`、`CORE.md` |
| 无上下文前向测试 | 完成 | 新项目、存量迁移和红线压力通过 | 后续版本复用同类夹具 | - | `docs/evals/v3-forward-tests.md` |
| v3发布 | 完成 | v3.0.0 及后续 v3.x 版本均有 CHANGELOG 记录；远端 v4.0.1 已发布，本地 VERSION=4.2.0 为候选 | 后续候选与跨项目采用按 REQ-GOV-004 推进 | v4.2.0 候选尚未发布 | `CHANGELOG.md` |
