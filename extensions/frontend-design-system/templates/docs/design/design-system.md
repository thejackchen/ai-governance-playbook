# {{PROJECT_NAME}} 设计系统

设计系统属于项目产品架构。本文是项目视觉、组件和交互契约的正文权威；治理只负责它的唯一正本、变更门、启动触达和机器验证，不在治理文件中复制这里的设计正文。

## 设计意图

{{DESIGN_INTENT}}

## 单一真相

- Token权威：`design/tokens.json`
- 参考风格权威：`docs/design/reference-pack.md`
- 组件权威：{{COMPONENT_SOURCE}}
- 图标与资产：{{ASSET_SOURCE}}
- 多端映射：`docs/architecture/frontend-surfaces.md`
- 生命周期和门禁：`governance/frontend-policy.json`

参考包的 `baseSystem`、`industryPatterns` 和 `brandLayer` 只是设计输入；最终组件和 token 必须落到本项目的 semantic 层，不能把大厂系统简化为换色、把参考资产当成项目资产，或把官网/Logo 来源色直接绑定到组件和业务身份。

## 规则

- 新页面优先复用现有token和组件。
- 新增视觉或交互原语前说明现有能力为何不足，并记录设计决策。
- 禁止在多个端手工维护同一套颜色、间距和字体数值；由token生成。
- 无障碍、响应式、加载/空/错误状态是组件契约的一部分。
- 关键用户路径必须有交互测试和视觉证据。
