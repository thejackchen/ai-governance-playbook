# ai-governance-playbook Roadmap

> 当前状态唯一权威。只保留当前投影；历史进入CHANGELOG和ADR。

## 当前游标

当前线上基线为 v3.6.1：通用母版先按项目事实适配，已知旧接线窄迁移、未知定制停手；版本相同也检查载体。Codex Session Start 自检通过后签发短期施工许可。远端 main 与 AIOS 正负开机 fixture 已回读，后续观察真实会话误报与跨运行时需求。

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
| 治理编译与开机自检 | 完成 | v3.6.1 已发布；AIOS 缺许可拦截、正常签发、过期拒绝 fixture 通过 | 观察真实会话误报；未知定制继续由负责人裁决 | Codex 项目 Hook 仍需真实 UI trust | `docs/requirements/specs/REQ-GOV-003-governance-compilation-and-boot-self-test.md`、`docs/playbook-update.md` |
| 前端设计系统扩展 | 推进 | 产品架构正本、设计语言章节、representativeJourneys 结构/证据生命周期门、扩展验证器和SessionStart触达已落盘 | 由消费项目选择页面族、代表链路、参考包并配置真实检查；本轮 local-only 未发布 | - | `extensions/frontend-design-system/README.md`、`docs/decisions/001-frontend-design-language-journeys.md`、`CORE.md` |
| 无上下文前向测试 | 完成 | 新项目、存量迁移和红线压力通过 | 后续版本复用同类夹具 | - | `docs/evals/v3-forward-tests.md` |
| v3发布 | 推进 | v3.6.1 治理编译与开机许可已推送并回读 | 按消费项目逐步升级；不创建正式tag | Codex 非托管 Hook 仍需真实 UI trusted + `/hooks` 审核验收 | `CHANGELOG.md` |
