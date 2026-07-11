# Frontend Design System治理扩展

适用于包含Web、移动端或小程序界面的项目。它不提供一套通用审美，而是建立“项目自己的统一设计语言”应住在哪里、如何复用和如何验证。

安装后应填写：

- `docs/design/design-system.md`：设计哲学、层级、组件与交互边界；
- `design/tokens.json`：颜色、字体、间距、圆角、层级、动效的结构化权威；
- `docs/architecture/frontend-surfaces.md`：不同端如何消费同一设计语言；
- `governance/frontend-policy.json`：项目的前端自动检查命令。

推荐验证：token生成漂移、stylelint、组件测试、可访问性检查、Playwright关键页截图和视觉回归。AI审美评审可以补充，但不能替代这些确定性检查。
