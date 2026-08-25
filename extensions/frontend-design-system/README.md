# Frontend Design System治理扩展

适用于包含 Web、移动端或其他前端界面的项目。设计系统属于项目产品架构；本扩展不提供一套通用审美，也不创建视觉 Skill，只帮助项目把自己的设计语言写成唯一正文、在页面族和代表用户旅程中复用，并由机器看到证据范围。

这里的“设计语言”不是 token 表，也不是一张漂亮页面：它是跨页面、组件和端可复用的 composition、space、shape、type、color、media、icon、motion 语法，加上信息角色、状态和交互契约。项目自己决定页面族、旅程和具体取舍；治理只保证唯一正本、启动触达、变更门和确定性验证。

治理边界只有四件事：保证唯一正本、约束设计变更门、让每次会话启动触达权威路径和代表链路、运行确定性机器验证。设计判断、参考风格选择和组件取舍仍由项目产品架构负责。

## Policy

生命周期写在 `governance/frontend-policy.json`：

- `reference-pending`：参考来源和候选设计可以已经提出，`representativeJourneys` 数组可以为空；每条旅程仍必须有 `evidence` 字段且类型为数组，只允许其值为空数组；仍必须通过 policy、四条 authority、设计正文结构和路径类型门；默认 `checks: []`，不执行虚构的项目命令；
- `shadow`：至少登记一条代表旅程，且每条旅程至少有一条仓库内文件或目录证据；配置检查只报告，不阻断存量视觉；
- `enforced`：沿用 `shadow` 的代表旅程证据门，且 `checks` 中的 `enforcement: "block"` 检查在失败时阻断，不能使用空 checks 冒充门禁。

`representativeJourneys` 是 policy 中的机器原语，而不是第五份设计正文。每条对象有唯一非空 `id`、非空字符串数组 `surfaces`、非空字符串数组 `states` 和仓库相对路径数组 `evidence`。项目可以把证据指向文件或目录；SessionStart 会播报 `journeys=<count>`，有旅程时同时播报 ids，让新 AI 看见采用范围，而不只看 token。

## 四条权威

安装后应填写或确认：

- `docs/design/design-system.md`：设计意图、设计语言、信息层级、页面族与代表链路、组件状态边界、验证与晋级的产品架构正文；
- `docs/design/reference-pack.md`：参考风格的来源、版本、借鉴范围和排除项；
- `design/tokens.json`：primitive → semantic → component 三层结构化权威；
- `docs/architecture/frontend-surfaces.md`：不同端如何消费同一设计语言，以及代表链路如何落到 surface；
- `governance/frontend-policy.json`：生命周期、四条权威路径、代表旅程、生成物、配置检查和视觉回归设置；
- `scripts/frontend-governance-verify.mjs`：可独立调用的结构、代表旅程和配置检查器。

参考包固定分三层：`baseSystem`、`industryPatterns` 和 `brandLayer`。它们只是设计输入，不能被复制成项目资产，也不能只换色；最终组件和 token 必须经过项目自己的 semantic 层、信息角色和代表链路验证。

## Verification

`node scripts/frontend-governance-verify.mjs --fast` 与 `--ci` 按 policy 的 `checks[].modes` 读取命令；空 `checks` 不执行配置命令。结构错误始终退出非零；`reference-pending` 和 `shadow` 的非结构检查失败只输出 `REPORT`，`enforced` 仅对 `enforcement: "block"` 失败退出非零。AI 评审可以补充设计判断，但不能替代 policy 的代表旅程、路径和生命周期门。
