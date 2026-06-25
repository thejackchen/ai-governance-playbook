# AGENTS.md — 接手就照这个干

> 给 AI 的交接（所有协作 AI 都读这份，CodeX / Claude 同一份、不抄副本）。它落地宪法 [CONSTITUTION.md](CONSTITUTION.md)。改它用 git commit；动宪法 / 主线要用户审。本仓库默认 {语言:本项目交接默认语言}。

<!-- 这份是「接手主入口」骨架：任何 AI 一进项目读完它就知道——先读什么、干活铁律、想法往哪沉、结束前必跑什么。为 AI 写：最小高信号、能机器拦的别靠自觉。复制后把 {占位} 填成你项目的真实文件/目录，删掉本注释。 -->

## 接手先读（按顺序）

1. [CONSTITUTION.md](CONSTITUTION.md) — 北极星：我们做什么、怎么运转（SoT 当根：做产品的方法 = 治理自己的方法）
2. [{知识地图入口:索引文件，告诉你「找 X 在哪」}](KNOWLEDGE_BASE/index.md) — 知识地图（找 X 在哪）
3. [{状态线文件}](ROADMAP.md) § {当前游标 anchor} — 此刻在哪条线、下一步（唯一权威的「现在状态」）
4. [docs/runbooks/cold-start-onboarding.md](docs/runbooks/cold-start-onboarding.md) — 上手包：协作脾气 / 踩坑 / 凭据

## 干活铁律（凌驾一切）

动手前想清楚、不瞎猜（做过没 / 真实状态 / 权威在哪）；只动该动的、能简单绝不复杂；说做完了，必须拿证据。详见 [execution-discipline.md](docs/runbooks/execution-discipline.md)

## 对话中：想法落到对应文件

<!-- 对话里冒出来的东西不能只停在对话里——按类型落到唯一权威处，否则下一个 AI 接不住。 -->

- 改方向 / 焦点 / 优先级 → [{状态线文件}](ROADMAP.md) 当前游标 + 对应线 section
- 与已定决策冲突 → 暴露冲突，等用户拍，不自动执行（增量进 SoT、最简默认：别擅自加复杂度）
- 新认知 / 踩坑 / 跨项目洞察 → [{知识库目录}](KNOWLEDGE_BASE/index.md)（归口见 index）

## 结束前（必跑，不可跳）

① 该沉淀的沉淀（决策 / 踩坑 / 状态，一处权威别抄副本）；② [CHANGELOG.md](CHANGELOG.md) 追加一行 `- [YYYY-MM-DD] [type] 摘要`；③ 跑 `npx tsx scripts/knowledge-lint.ts`（0 error 才算完）。

## 知识往哪沉（SoT：一处权威、不抄副本）

<!-- 每类知识有且只有一个去向。填成你项目的真实目录；增量进唯一真相、不抄副本是不变原理。 -->

| 内容 | 去哪 |
|---|---|
| 需求 / 任务 | [{需求清单文件}](docs/requirements/backlog.md) |
| 已定决策 | [docs/decisions/](docs/decisions/INDEX.md)（用户拍 + INDEX 登记） |
| 领域 / 品牌 / 数据源事实 | {知识库目录}/（归口见 index） |
| 踩坑 / 洞察 | {知识库目录}/insights/ |
| 历史事件 | [CHANGELOG.md](CHANGELOG.md) |
| {端 UI / 设计:若项目有专门的设计/前端规范} | {设计系统文件} |

## 治理怎么自纠（非季审）

lint 报错当场修 · [evals](docs/runbooks/governance-evals.md) 答不出改文件 · 用户打脸即改 · 撞见过时规则即删。事件驱动、嵌进工作流（腐烂默认靠持续自动纠错、非周期意志）。详见 [governance-self-correction.md](docs/runbooks/governance-self-correction.md)

## git

格式 `tag: {说明}`（tag 表 → [commit-conventions.md](docs/runbooks/commit-conventions.md)）；`constitution:` / `roadmap:`（动宪法 / 主线）需用户审。
