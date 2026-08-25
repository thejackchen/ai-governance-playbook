# 前端多端映射

本页是产品架构中的前端 surface 边界。各端可以采用不同技术实现，但不得另起一份 token、组件语义或设计语言正本。设计语言是跨页面/组件可复用的 composition、space、shape、type、color、media、icon、motion 语法，加上信息角色、状态和交互契约；不是一张 token 表或一张孤立的漂亮页面。

| 端 | 技术实现 | Token产物 | 组件实现 | 原生能力边界 | 验证 |
|---|---|---|---|---|---|
| {{SURFACE}} | {{STACK}} | {{TOKEN_OUTPUT}} | {{COMPONENT_PATH}} | {{NATIVE_BOUNDARY}} | {{SURFACE_CHECK}} |

同一设计语言允许不同技术实现，但语义token、组件状态、交互契约和页面族采用范围必须可追溯到 `governance/frontend-policy.json` 声明的四条权威路径与 `representativeJourneys`。项目选择自己的页面族和关键链路；进入 `shadow` 或 `enforced` 后，每条代表链路都要有至少一条仓库内证据路径。
