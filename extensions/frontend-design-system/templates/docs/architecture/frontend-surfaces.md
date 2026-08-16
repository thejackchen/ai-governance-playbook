# 前端多端映射

本页是产品架构中的前端 surface 边界。各端可以采用不同技术实现，但不得另起一份 token 或组件语义正本。

| 端 | 技术实现 | Token产物 | 组件实现 | 原生能力边界 | 验证 |
|---|---|---|---|---|---|
| {{SURFACE}} | {{STACK}} | {{TOKEN_OUTPUT}} | {{COMPONENT_PATH}} | {{NATIVE_BOUNDARY}} | {{SURFACE_CHECK}} |

同一设计语言允许不同技术实现，但语义token、组件状态和交互契约必须可追溯到 `governance/frontend-policy.json` 声明的四条权威路径。
