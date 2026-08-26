# ai-governance-playbook Roadmap

> 当前状态唯一权威。只保留当前投影；历史进入CHANGELOG和ADR。

## 当前游标

当前发布候选为 v3.7.5：补齐 v3.7.4 通用 claim 门未识别 `MultiEdit/search_replace` 写入别名的旁路。解决什么：Codex、Claude、Grok 共用一张开机施工许可，治理控制面无许可或无认领时无论走全部登记的直接文件工具还是常见终端写入都不可修改；怎么验收：三种 Hook 的缺票/过期/接线变化负例、五种直接写入别名与终端写入无认领负例都阻断，纯读取不误拦，母版全测与两个零上下文模型复验通过；这次不碰什么：不把项目宪法、policy 或业务文本改成母版托管文件，不登录、不读取密钥、不替项目负责人解释业务事实。

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
| 治理编译与开机自检 | 推进 | v3.7.5 统一运行时施工许可与治理控制面认领门施工中 | 三运行时负例、全部直接写入别名/终端写入负例、完整测试、双模型零上下文验收 | Codex 项目 Hook 仍需真实 UI trust | `docs/requirements/specs/REQ-GOV-003-governance-compilation-and-boot-self-test.md`、`docs/playbook-update.md` |
| 前端设计系统扩展 | 推进 | 产品架构正本、设计语言章节、representativeJourneys 结构/证据生命周期门、扩展验证器和SessionStart触达已落盘 | 由消费项目选择页面族、代表链路、参考包并配置真实检查；本轮 local-only 未发布 | - | `extensions/frontend-design-system/README.md`、`docs/decisions/001-frontend-design-language-journeys.md`、`CORE.md` |
| 无上下文前向测试 | 完成 | 新项目、存量迁移和红线压力通过 | 后续版本复用同类夹具 | - | `docs/evals/v3-forward-tests.md` |
| v3发布 | 推进 | v3.7.5 发布候选施工中 | 完整测试、远端发布、AIOS 采用、双模型零上下文复验；不创建正式tag | Codex 非托管 Hook 仍需真实 UI trusted + `/hooks` 审核验收 | `CHANGELOG.md` |
