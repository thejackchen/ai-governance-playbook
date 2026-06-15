# AI 治理方法论库 · AI Governance Playbook

> 给「用 AI 维护的项目」两样东西：**① 给 AI 直接执行的治理指令**（强制建治理 + 行为铁律）**② 给人理解为什么的方法论**。
> 核心原则：借思想，别抄实现。

## 怎么用（最重要）

**让你的项目 AI 强制执行治理 —— 把执行指令丢进项目根：**

- Claude Code：复制 [`starter/CLAUDE.md`](starter/CLAUDE.md) → 你项目根的 `CLAUDE.md`
- Codex：复制 [`starter/AGENTS.md`](starter/AGENTS.md) → 你项目根的 `AGENTS.md`

AI 一进项目读到它就**强制执行**：缺治理文件就建（CONSTITUTION / PROJECT…）、守 5 条行为铁律、每轮维护。**是命令，不是参考。**

## 想懂背后为什么

读 [`governance-architecture-essence.md`](governance-architecture-essence.md)——完整方法论：三线一底座 + 9 条治理定律（每条带踩坑 why）+ 核心机制 + 反模式。**这是给人理解的；AI 执行只需上面那个指令文件。**

## 结构（就 3 样）

```
starter/CLAUDE.md · AGENTS.md       ★ 给 AI 的执行指令（强制·单文件自包含）← 丢进你项目
governance-architecture-essence.md  给人的完整方法论（为什么）
README.md                           本文（导航）
```

## 共建

某项目踩出可迁移的新定律 → 加进 essence 的定律清单（§5）。项目特定的（具体规则/数值/业务）留本地，别污染本库。

---

*萃取自一个真实项目（Next.js + 微信小程序 + 自托管数据库的 PIM）的治理实战（2026）。每条定律带的「踩坑 why」是最值钱的部分。*
