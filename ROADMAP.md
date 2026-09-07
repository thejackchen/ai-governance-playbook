# ai-governance-playbook Roadmap

> 当前状态唯一权威。只保留当前投影；历史进入CHANGELOG和ADR。

## 当前游标

母版 v4.3.0 已发布。实现提交 `431a6cda0fed2c288d528302ed83574757580204` 经 PR #6 正常合入，实施发布基线 `6cf12a59d8826e37132e2a6f31e31671cf061ec2`；GitHub API 与 git fetch 均回读 `VERSION=4.3.0`。主代理全检 162/162、专项 27/27、无上下文 A 复测与 B 各 96/100；远端 deterministic CI run `34107998818` 成功，doctor 0 error/1 warning（真实 Codex UI Hook trust 未验，CI advisory 模型步骤未运行）。按 [REQ-GOV-004](docs/requirements/specs/REQ-GOV-004-project-discovery-release.md) 完成本次母版语义升级：模板是建议，项目发现新版后自主理解、适配、验收，只有真实无法解决的权威冲突交负责人；不再要求逐仓指定能力。具体命令、评分及范围见[无上下文验收](docs/evals/semantic-upgrade-forward-tests.md)。全消费仓采用与真实客户端现场不由母版发布代证；缺发现载体或 off/manual 策略按项目事实接入。本轮未改业务、部署、凭据、主机或用户 WIP，未新建常驻更新服务，Hook 不调用模型或覆盖治理文件；未恢复已退出的许可或巡检机制。

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
| 治理编译与开机自检 | 本次母版升级完成 | v4.3.0 已发布；母版 CI/doctor 证据见当前游标；v3.6–v3.7 运行时能力以 CHANGELOG 为准 | 后续消费项目自主语义适配并按自身事实记录，不把母版版本当项目采用 | 真实客户端 UI trust 与全客户端现场未验 | `docs/requirements/specs/REQ-GOV-003-governance-compilation-and-boot-self-test.md`、`docs/playbook-update.md` |
| 前端设计系统扩展 | 推进 | `frontend-design-system` 的 v3.4.x 变更已记入 CHANGELOG；消费项目采用仍推进 | 由消费项目选择页面族、代表链路、参考包并配置真实检查；采用状态按项目证据确认 | - | `extensions/frontend-design-system/README.md`、`docs/decisions/001-frontend-design-language-journeys.md`、`CORE.md` |
| 无上下文前向测试 | 完成 | 新项目、存量迁移和红线压力通过 | 后续版本复用同类夹具 | - | `docs/evals/v3-forward-tests.md` |
| 母版发布 | 本次完成 | v4.3.0 已发布，远端回读见当前游标与 CHANGELOG；旧版过程留 CHANGELOG | 后续项目自主采用按升级合同进行 | 全消费仓采用与真实客户端 UI trust 不属本次发布证明 | `CHANGELOG.md` |
