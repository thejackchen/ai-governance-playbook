# AI Governance Playbook

给 AI 主导的项目装一台「治理恒温器」:规则不靠文档自觉,靠机器载体执行;经验不靠人记,靠判例沉淀。**版本 v3.1.1(见 VERSION),经无记忆 AI 实测发布。**

## 怎么用(负责人只需要这一段)

把这句话交给任何项目的 AI:

> 读 https://github.com/thejackchen/ai-governance-playbook 的 setup.md,先通读 governance/cases/ 判例库,再为本项目建立治理(存量项目走 setup 附A);完成后按 setup 附B 自检,向我交付安装报告。

之后你的参与只有三种:确认它提交的意图/红线、回答它升上来的问题、每次纠正它(纠正会变成判例,所有项目共享)。

## 里面有什么(文件地图)

| 文件/目录 | 给谁 | 干什么 |
|---|---|---|
| README.md(本页) | **人** | 唯一需要人读的页 |
| CORE.md | AI | 方法论权威(控制回路/五个结构问题/载体规范+运行时适配) |
| setup.md | AI | 安装流程(+附A 存量迁移/附B 验收自检) |
| governance/cases/ | AI | **判例库(12 条)——历次真实教训,新项目安装第一步通读** |
| profiles/ · adapters/ · templates/ | AI | 三档规格 · 运行时适配 · 安装模板 |
| scripts/ | 机器 | init 安装器 · doctor 体检 · verify 校验 |
| governance/ 其余 · ROADMAP · CHANGELOG | 机器+AI | 本仓库自己的治理(自食其力) |

## 原则(一行)

能简单绝不复杂;规则必须说清解决什么结构问题,说不清不装;负责人看不懂 = 最高优先级事故。
