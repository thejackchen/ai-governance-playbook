# {{PROJECT_NAME}} · AI执行宪法

> 运行时：{{RUNTIME}}；治理Profile：{{PROFILE}}。治理安装记录见`governance.lock.json`。

## 三句核心

> 一切治理零件回指其一；方法论权威见 playbook `CORE.md`。

- **真相在文本**：全部真相住在人机共读的文本正本里，不在对话／脑子／代码；每类真相一份正本，想法唯一入口＝收件箱，对话不算数、入箱才算。
- **行动跟文本**：顺序是「人改文本 → 文本指挥 AI → AI 改代码」；大活先落三行规格（解决什么／怎么验收／这次不碰什么）经负责人文本层点头再施工；查文入箱之前禁止动手实现。
- **底线在机器**：「绝不许做」必须装进机器载体（hook／pre-commit／CI／权限），规则生效靠载体不靠自觉，新规则无载体不出生。

## 意图

{{INTENT}}

此段由负责人确认。若这里仍是安装器的 `TODO(owner)` 占位，AI 不得把它当成已完成的意图确认：必须先从负责人已有的真实材料（README、package.json 描述、现有文档等）起草一段意图**建议稿**，再在 `governance/questions.md` 挂一条确认问题，请负责人确认或修正。不得留字面 TODO 占位符冒充已完成确认，也不得跳过“起草建议稿 + 挂确认问题”就把建议稿当成定论去改写其它文档；负责人确认前只能把它作为建议稿使用。

## 权威与边界

- 当前状态唯一可写正本＝游标：单线时在 `ROADMAP.md`「当前游标」；战线 **≥3 且单表压不住叙事**时才分裂，分裂后在各 `docs/execution/branches/<slug>.md` 各自的「当前游标」（`--write` 会自动删除 `ROADMAP.md` 顶部单游标段，`--check` 会拦分裂态下残留的它，别留第二份状态正本）。`ROADMAP.md` 的战线表：战线 **< 3 时人手维护**；**分裂后是机器投影（生成物），勿手改**——由 `node scripts/governance-status.mjs --write` 从各分支游标重算覆盖。`--check` 是漂移门：`init` 已激活 `core.hooksPath` 使其成为**本地 pre-commit 门（commit 即拦）**；CI 也会跑，但须配 branch-protection/required-check 后才阻断合并。
- 架构当前真相：[{{ARCHITECTURE_SOURCE}}]({{ARCHITECTURE_SOURCE}})。
- 需求权威：[需求]({{REQUIREMENTS_SOURCE}})。
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
6. 需求是活文档：唯一入口为[需求]({{REQUIREMENTS_SOURCE}})；外部来源不得保留第二套本地状态正文。

## 验证与完成

- 修改后运行：{{VERIFY_COMMAND}}。
- 完成说明包含真实运行结果；无法运行的检查明确写出。
- 有意义的仓库变化才更新CHANGELOG/ROADMAP/ADR/事故，不为只读评审和讨论制造流水。
- 活跃开发可以暂时未提交；多人或多AI交接以可识别的Git基线为边界。本轮获得授权且验证通过时，在任务分支形成范围清楚的提交并push/MR，经共享门禁后再合并默认分支；默认不让多个执行者直接写`main`。
- 未获commit或push授权时保留工作树，明确报告`local-only`、基线、改动和验证结果；不自动提交用户的无关改动，也不把本地完成称为共享交付。

## 治理铭牌

- 每轮最终回复末尾先打治理铭牌：`🏛 治理: 三句核心 v<版本>`；版本从本项目的`governance.lock.json`读取。SessionStart hook 会注入同一铭牌，不能凭记忆填写或省略。

## 指针

- 当前状态：`ROADMAP.md`
- 知识路由：`docs/index.md`
- 规则台账：`governance/registry.md`（Profile启用时）
- 判例库：`governance/cases`（Profile启用时；负责人历次纠正的沉淀，同族场景先类比判例再动手）
- 事故：`governance/incidents.md`
- 待裁决问题：`governance/questions.md`
- ADR：`docs/decisions/`
