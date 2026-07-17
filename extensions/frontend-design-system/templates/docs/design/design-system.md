# {{PROJECT_NAME}} 设计系统

## 设计意图

{{DESIGN_INTENT}}

## 单一真相

- Token权威：`design/tokens.json`
- 组件权威：{{COMPONENT_SOURCE}}
- 图标与资产：{{ASSET_SOURCE}}
- 多端映射：`docs/architecture/frontend-surfaces.md`

## 规则

- 新页面优先复用现有token和组件。
- 新增视觉或交互原语前说明现有能力为何不足，并记录设计决策。
- 禁止在多个端手工维护同一套颜色、间距和字体数值；由token生成。
- 无障碍、响应式、加载/空/错误状态是组件契约的一部分。
- 关键用户路径必须有交互测试和视觉证据。
