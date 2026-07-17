# {{PROJECT_NAME}} · AI执行宪法

> 运行时：{{RUNTIME}}；治理Profile：{{PROFILE}}。治理安装记录见`governance.lock.json`。

## 意图

{{INTENT}}

此段由负责人确认。AI可以提出修改建议，但未经确认不得改写项目意图。

## 权威与边界

- 当前状态唯一权威：`ROADMAP.md`。
- 架构当前真相：[{{ARCHITECTURE_SOURCE}}]({{ARCHITECTURE_SOURCE}})。
- 需求权威：[{{REQUIREMENTS_SOURCE}}]({{REQUIREMENTS_SOURCE}})。
- 仓库结构权威：`docs/architecture/repository-layout.md`；新增顶层目录或跨层依赖先写ADR。
- 同一事实只有一个正文权威；其它位置用链接或可验证生成物。
- 文档与现实冲突时，以现实为准，修正文档；影响过真实执行时记`governance/incidents.md`。

## 红线

- 不通过skip、删测试、放宽断言或伪造mock制造假全绿。
- 不在验证证据与实际状态不一致时宣称完成。
- 密钥、token、真实凭据不进入git、日志或文档。
{{PROJECT_RED_LINES}}

## 决策

- 可逆且局部：自行决定，说明理由并验证。
- 不可逆、架构级、资金/合规或负责人意图敏感：写入`governance/questions.md`，给选项、建议和默认动作；不可逆事项没有默认执行。
- 改变系统心智模型的新原语进入ADR，不把实现细节泛化成架构概念。

## 开工

1. 读取`ROADMAP.md`当前游标和约束。
2. 按`docs/index.md`只读取本任务需要的权威材料。
3. 修改前检查真实状态和工作树，不覆盖不属于本任务的变更。
4. 复杂或高风险任务明确目标、边界和可证伪验收；简单任务直接执行。
5. 新文件先按仓库结构地图选择归属；不得把临时文件、生成物或新模块随意堆在项目根。

## 验证与完成

- 修改后运行：{{VERIFY_COMMAND}}。
- 完成说明包含真实运行结果；无法运行的检查明确写出。
- 有意义的仓库变化才更新CHANGELOG/ROADMAP/ADR/事故，不为只读评审和讨论制造流水。
- 只有获得授权、范围清楚且验证通过时才提交git；不自动提交用户的无关改动。

## 指针

- 当前状态：`ROADMAP.md`
- 知识路由：`docs/index.md`
- 规则台账：`governance/registry.md`（Profile启用时）
- 判例库：`governance/cases`（Profile启用时；负责人历次纠正的沉淀，同族场景先类比判例再动手）
- 事故：`governance/incidents.md`
- 待裁决问题：`governance/questions.md`
- ADR：`docs/decisions/`
