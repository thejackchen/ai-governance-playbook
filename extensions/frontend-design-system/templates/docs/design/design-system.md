# {{PROJECT_NAME}} 设计系统

设计系统属于项目产品架构。本文是项目设计语言、信息层级、组件状态和代表链路的正文权威；治理只负责唯一正本、变更门、启动触达和机器验证，不在治理文件中复制设计正文。

## 设计意图

{{DESIGN_INTENT}}

请说明目标用户、核心任务、产品气质和不可妥协的取舍。不要用一套跨项目默认审美替代项目自己的判断。

## 设计语言

把项目的可复用视觉与交互语法写成规则，而不只是列 token 值：

- composition：页面构图、容器关系、入口与工作区的组织方式；
- space：间距节奏、密度、对齐和响应式收缩规则；
- shape：表面、边界、层级和可点击区域的形状语法；
- type：字体角色、字号层级、数字/代码/状态的排版规则；
- color：背景、表面、内容、动作、状态和品牌角色的语义映射；
- media：图片、插图、视频和占位/失败态的使用边界；
- icon：图标来源、语义、尺寸、对齐和无障碍名称；
- motion：反馈、过渡、加载和 reduced-motion 的行为规则。

项目必须说明这些语法怎样跨页面族、组件和端复用。`design/tokens.json` 是结构化 token 正本，但 token 表本身不等于设计语言。

## 信息层级

描述信息角色、优先级、扫描顺序、主次动作和内容密度。说明重要、次要、辅助、状态和不可用信息如何被区分，以及在窄屏、长文案和异常数据下如何保持可理解。

## 页面族与代表链路

列出项目自己选择的页面族和关键用户旅程，并说明入口、浏览/工作、比较/编辑、关键动作及完成反馈之间如何沿用同一语言。不要用一张漂亮页面、单个组件或换色宣称设计语言已经落地。

每条代表链路在 `governance/frontend-policy.json` 的 `representativeJourneys` 中登记 `id`、`surfaces`、`states` 和证据路径；证据可以是文件或目录。`reference-pending` 可以先留空，进入 `shadow` 或 `enforced` 后每条链路都必须有可读证据。

## 组件、状态与边界

记录组件复用边界、组合规则和真实状态契约，包括 loading、empty、error、disabled、success、权限/网络/数据不完整等项目实际需要的状态。新原语必须说明现有能力为何不足；无障碍、响应式、内容长度和 reduced-motion 也属于组件契约。

## 验证与晋级

把设计语言的采用范围和证据写成可复现检查：代表链路、真实状态、可访问性、响应式、关键交互和视觉回归各由项目选择合适的命令或证据。`reference-pending` 只要求结构完整，`shadow` 报告失败，`enforced` 才阻断配置中标记为 `block` 的检查；晋级必须同时更新 policy、代表旅程证据和本正文，不得只改生命周期字符串。

### 权威映射

- Token权威：`design/tokens.json`
- 参考风格权威：`docs/design/reference-pack.md`
- 组件与实现权威：{{COMPONENT_SOURCE}}
- 图标与资产权威：{{ASSET_SOURCE}}
- 多端映射：`docs/architecture/frontend-surfaces.md`
- 生命周期、代表链路和门禁：`governance/frontend-policy.json`

参考包的 `baseSystem`、`industryPatterns` 和 `brandLayer` 只是设计输入；最终组件和 token 必须落到本项目的 semantic 层，不能把外部系统简化为换色、把参考资产当成项目资产，或把来源色直接绑定到组件和业务身份。
