<!-- 模板:知识路由表。谁填:安装 AI 登记项目现有文档资产的住址(存量项目把既有文档归类入表);此后新增投影页随手登记;填完删除本行注释。 -->
# 知识路由(什么知识住哪 · 一页,超一页说明该合并投影页了)

> 投影 ≠ 流水:流水账(CHANGELOG / incidents)负责审计与溯源、只追加;投影页负责「当前真相」——就地改写,永远反映现状,读一页顶考古一个月。写给「能力极强但今天第一天上班」的读者。

| 知识类型 | 住址 | 形态与规则 |
|---|---|---|
| 当前状态(游标/战线/约束登记) | [ROADMAP.md](../ROADMAP.md) | 唯一权威,每轮收尾覆写 |
| 事件流水 | [CHANGELOG.md](../CHANGELOG.md) | append-only,最新在上,每轮一行 |
| 规则台账(每条规则的户口) | [governance/registry.md](../governance/registry.md) | 载体 L0–L3 诚实标注;≤30 条零和 |
| 踩坑教训(治理/工程层) | [governance/incidents.md](../governance/incidents.md) | 事故簿,棘轮必填 |
| 品味与裁决 | [governance/cases/](../governance/cases/README.md) | 判例,一事一文,随模型换代增值 |
| 升级队列(问负责人) | [governance/questions.md](../governance/questions.md) | 选项+建议+默认动作;回答强制落判例/ADR |
| 为什么这么设计(ADR) | {ADR 目录,如 docs/decisions/;已有 ADR 目录则指向它} | append-only,防好心翻案 |
| 主题投影页(设计/洞察) | {docs/<主题>.md,有了再登记;没有就先别建} | 就地改写不追加;与现实矛盾 = 事故 |
| 操作路径(接手/部署/环境) | {runbook 位置,可选} | 每复用一次考虑升级:文档→核对单→脚本→CI |
| 可执行化的一切 | 代码 / 测试 / 脚本 | 知识的最高载体:能写成测试的禁止只写文档 |
