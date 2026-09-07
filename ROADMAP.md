# ai-governance-playbook Roadmap

> 当前状态唯一权威。只保留当前投影；历史进入CHANGELOG和ADR。

## 当前游标

母版 v4.2.0 已发布，实施发布基线为 `985a03710d128281cfcfb5333237e636bc837b78`（实现提交 `42a1a3f55645caa29656ea88e195d726925ee79c` 经 PR #4 合并）；GitHub API 与 `git fetch` 均回读 `VERSION=4.2.0`。母版验收为 CI `140/140`、doctor `0 error/1 warning`（Codex 新会话 trust）；文档覆盖 `22/22`、已识别源码覆盖 `127/127`，独立冷启动导航通过。真实客户端 UI trust 与全客户端现场未验，不作宣称。当前工作按 [REQ-GOV-004](docs/requirements/specs/REQ-GOV-004-project-discovery-release.md) 继续推进跨仓范围盘点；不能用版本号冒充采用，下一步先确定消费者采用范围、分支与 owner，本轮不进入业务部署分支。这次不碰什么：业务代码、生产部署、主机/服务重启、凭据正文、个人全局配置、他人 WIP、已退出的自动升级/许可/巡检机制。

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
| 治理编译与开机自检 | 推进 | v4.2.0 已发布；母版 CI/doctor 证据见当前游标；Codex 新会话 trust 仍有 1 warning；v3.6–v3.7 运行时能力以 CHANGELOG 为准 | 消费仓逐项按能力显式采用并复验；不把版本号当项目采用 | 真实客户端 UI trust 与全客户端现场未验 | `docs/requirements/specs/REQ-GOV-003-governance-compilation-and-boot-self-test.md`、`docs/playbook-update.md` |
| 前端设计系统扩展 | 推进 | `frontend-design-system` 的 v3.4.x 变更已记入 CHANGELOG；消费项目采用仍推进 | 由消费项目选择页面族、代表链路、参考包并配置真实检查；采用状态按项目证据确认 | - | `extensions/frontend-design-system/README.md`、`docs/decisions/001-frontend-design-language-journeys.md`、`CORE.md` |
| 无上下文前向测试 | 完成 | 新项目、存量迁移和红线压力通过 | 后续版本复用同类夹具 | - | `docs/evals/v3-forward-tests.md` |
| v3发布 | 完成 | v3.0.0 及后续 v3.x 版本均有 CHANGELOG 记录；v4.2.0 已发布，远端回读见当前游标与 CHANGELOG | 后续跨项目采用按 REQ-GOV-004 推进 | 消费仓采用与真实客户端 UI trust 仍未完成 | `CHANGELOG.md` |
