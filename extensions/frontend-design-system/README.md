# Frontend Design System治理扩展

适用于包含Web、移动端或小程序界面的项目。设计系统属于项目产品架构；本扩展不提供一套通用审美，只建立项目自己的设计语言应住在哪里、如何复用和如何验证。

治理边界只有四件事：保证唯一正本、约束设计变更门、让每次会话启动触达权威路径、运行确定性机器验证。设计判断、参考风格选择和组件取舍仍由项目产品架构负责；没有 Skill 层。

生命周期写在 `governance/frontend-policy.json`：

- `reference-pending`：参考来源和候选设计可以已经提出，但尚未经过代表页面、真实状态、可访问性与运行端验证形成可执行基线；默认 `checks: []`，只运行结构门，不执行虚构的项目命令；项目填入真实检查命令后再进入 `shadow` 或 `enforced`；
- `shadow`：配置检查只报告，不阻断存量视觉；
- `enforced`：`checks` 中的 `enforcement: "block"` 检查在失败时阻断，且不能使用空 checks 冒充门禁。

参考包固定分三层：`baseSystem`（大厂或成熟基础设计系统）、`industryPatterns`（行业/电商页面模式）和 `brandLayer`（项目色彩、资产、信息角色）。三层可以在 `reference-pending` 时未选定，也可以记录尚待验证的候选。参考来源不是复制资产；大厂系统不能只换色，品牌色也只是来源证据，二者都必须经过项目 semantic 层才能成为 UI 角色。

安装后应填写或确认：

- `docs/design/design-system.md`：设计哲学、层级、组件与交互边界；
- `docs/design/reference-pack.md`：参考风格的来源、版本、借鉴范围和排除项；
- `design/tokens.json`：primitive → semantic → component 三层结构化权威；
- `docs/architecture/frontend-surfaces.md`：不同端如何消费同一设计语言；
- `governance/frontend-policy.json`：生命周期、四条权威路径、生成物、配置检查和视觉回归设置；
- `scripts/frontend-governance-verify.mjs`：可独立调用的结构与配置检查器。

`node scripts/frontend-governance-verify.mjs --fast` 与 `--ci` 按 policy 的 `checks[].modes` 读取命令；空 `checks` 不执行任何配置命令。结构错误始终退出非零；`reference-pending` 和 `shadow` 的非结构检查失败只输出 `REPORT`，`enforced` 仅对 `enforcement: "block"` 失败退出非零。AI审美评审可以补充，但不能替代这些确定性检查。
