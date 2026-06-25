# templates/ — 克隆即用的治理骨架

> 把**整个 `templates/` 目录的内容**复制到你项目根，填掉 `{占位}`，就得到一套和母版同构的精简新架构治理。
> 背后的「为什么」见 [`governance-architecture-essence.md`](https://github.com/thejackchen/ai-governance-playbook/blob/main/governance-architecture-essence.md)；这里只讲「怎么用」。

## 怎么用（6 步）

1. **复制**：把 `templates/` 下所有文件复制到你项目根——`CONSTITUTION.md`、`AGENTS.md`、`CLAUDE.md`、`ROADMAP.md`、`CHANGELOG.md`、`docs/`、`KNOWLEDGE_BASE/`、`scripts/`、`.githooks/`、`package.json`。（本 `README.md` 是用法说明，复制后可删。）
2. **填占位**：全局搜 `{`，把每个 `{占位}` 换成你项目的真实内容（占位旁的「如…」给了示例）。重点：
   - `CONSTITUTION.md` 的 SoT 根（你项目把什么散乱收进唯一真相源）。
   - `AGENTS.md` 的知识路由表去向、状态线文件名。
   - `docs/runbooks/cold-start-onboarding.md` 的协作契约 / 踩坑 / 凭据。
   - `docs/runbooks/governance-evals.md` 第 9–12 题（项目特定，从你的 `KNOWLEDGE_BASE/insights/` 踩坑 + 与用户磨合出的偏好里挑**真实**场景；没有就先留空、随积累再补——别编废话，这 4 题正是 evals 测「AI 行为遵从」的价值所在）。
   - ⚠️ **填 `.md` 链接时确保目标文件真存在**：你若写 `[已定决策](docs/decisions/INDEX.md)` 或引用某 insight 页，就要真建它；引用一个还没建的页 = 首跑 lint 报断链。还没有的就先用纯文字、别挂 `.md` 链接。
3. **装门禁**：`npm install`（触发 `package.json` 的 `prepare`，把 git hooksPath 指到 `.githooks/`）→ 之后每次 commit 自动跑 lint。**这一步不做 = hook 不随 clone 生效 = 等于没装门禁。**
4. **改 lint 配置（沿用默认结构可跳过）**：`scripts/knowledge-lint.ts` 顶部 CONFIG 常量。**若你沿用骨架默认文件名（CONSTITUTION/AGENTS/ROADMAP/CHANGELOG/KNOWLEDGE_BASE…），默认 CONFIG 已适配、此步可跳过**；只有改了状态线文件名 / KB 目录名才需要动。
5. **首跑验证**：`npx tsx scripts/knowledge-lint.ts`，修到 0 error。
6. **验收**：治理大改后，按 [`acceptance-test.md`](https://github.com/thejackchen/ai-governance-playbook/blob/main/acceptance-test.md)（复制并填好放到 `docs/runbooks/governance-acceptance-test.md`）派无记忆 AI 跑一遍。

## 文件清单（克隆后你拥有的）

```
CONSTITUTION.md                          北极星 · SoT 根 + 四原理（人管，AI 不自动改）
AGENTS.md                                接手主入口（CodeX/Claude 同读）
CLAUDE.md                                Claude 入口（@AGENTS.md import）
ROADMAP.md                               状态线 · 当前游标（失焦找回的活锚点）
CHANGELOG.md                             事件流水（每轮追一行）
docs/requirements/backlog.md             需求/任务唯一清单
docs/decisions/INDEX.md                  已定决策索引（ADR，用户拍板的选择）
docs/runbooks/
  ├── cold-start-onboarding.md           上手包：协作契约/踩坑/凭据
  ├── execution-discipline.md            干活铁律完整正文
  ├── governance-self-correction.md      事件驱动纠错（取代季审）
  ├── governance-evals.md                行为回归题库（用 AI 验 AI 轻量版）
  ├── governance-acceptance-test.md      验收套件（指针 → github acceptance-test.md）
  └── commit-conventions.md              commit tag 表
KNOWLEDGE_BASE/index.md                  知识地图（找 X 在哪）
scripts/knowledge-lint.ts                lint 门禁（确定性检查，pre-commit 调它）
.githooks/pre-commit                     真门禁（调 lint）
package.json                             prepare 配 hooksPath（随 clone 生效）
```

## 这套骨架是什么

四件套同构母版：**可懂**（CONSTITUTION 大白话 SoT 根 + 四原理）/ **可执行**（AGENTS 接手主入口 + execution-discipline 铁律）/ **会自纠**（governance-self-correction 事件驱动、非季审）/ **可回归**（governance-evals + acceptance-test，用 AI 验 AI）。

不该建的（母版砍掉的官僚，别加回来）：控制点注册表 / 季审 / 仪式预算 / ROI 举证制度 / L1-L4 黑话 / 为凑行数硬删——见 [`setup.md`](https://github.com/thejackchen/ai-governance-playbook/blob/main/setup.md) 的「⚠️ 别建这些」段。
