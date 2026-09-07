# ai-governance-playbook Roadmap

> 当前状态唯一权威。只保留当前投影；历史进入CHANGELOG和ADR。

## 当前游标

已发布母版为 v4.2.0，实施发布基线 `985a03710d128281cfcfb5333237e636bc837b78`，发布记录同步基线 `d5d364a7dbbaf5b14c098687252811d9c97d97d6`。当前 v4.3.0 候选已通过主代理全检 162/162、专项 27/27、无上下文 A 复测与 B 各 96/100，待正常提交、CI 合入及发布回读。按 [REQ-GOV-004 当前授权](docs/requirements/specs/REQ-GOV-004-project-discovery-release.md) 修正语义升级：模板是建议，项目发现新版后自主理解、适配、验收，只有真实无法解决的权威冲突交负责人；不再要求逐仓指定能力。具体命令、评分及范围见[无上下文验收](docs/evals/semantic-upgrade-forward-tests.md)。本轮不改业务、部署、凭据、主机或用户 WIP，不新建常驻更新服务，不在 Hook 内调用模型或覆盖治理文件；不恢复已退出的许可或巡检机制。

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
| 治理编译与开机自检 | 推进 | v4.2.0 已发布；母版 CI/doctor 证据见当前游标；Codex 新会话 trust 仍有 1 warning；v3.6–v3.7 运行时能力以 CHANGELOG 为准 | 完成本次母版语义升级的确定性测试、独立无上下文复验与发布回读；消费项目采用按自身事实另行记录，不把版本号当项目采用 | 真实客户端 UI trust 与全客户端现场未验 | `docs/requirements/specs/REQ-GOV-003-governance-compilation-and-boot-self-test.md`、`docs/playbook-update.md` |
| 前端设计系统扩展 | 推进 | `frontend-design-system` 的 v3.4.x 变更已记入 CHANGELOG；消费项目采用仍推进 | 由消费项目选择页面族、代表链路、参考包并配置真实检查；采用状态按项目证据确认 | - | `extensions/frontend-design-system/README.md`、`docs/decisions/001-frontend-design-language-journeys.md`、`CORE.md` |
| 无上下文前向测试 | 完成 | 新项目、存量迁移和红线压力通过 | 后续版本复用同类夹具 | - | `docs/evals/v3-forward-tests.md` |
| v3发布 | 完成 | v3.0.0 及后续 v3.x 版本均有 CHANGELOG 记录；v4.2.0 已发布，远端回读见当前游标与 CHANGELOG | 后续跨项目采用按 REQ-GOV-004 推进 | 消费仓采用与真实客户端 UI trust 仍未完成 | `CHANGELOG.md` |
