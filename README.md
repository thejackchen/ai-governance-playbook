# AI 治理方法论库 · AI Governance Playbook

> 两样东西：① **`setup.md`** — 给 AI 的一次性安装指令，让它为你项目建立一套完整治理体系 ② **`essence`** — 给人理解为什么的方法论。
> 核心原则：借思想，别抄实现。

## 怎么用（最重要）

把 [`setup.md`](setup.md) 交给你项目的 AI，说：

> **「读 setup.md，为本项目建立治理体系。」**

AI 会**强制建出**：`CONSTITUTION.md`（北极星）+ `AGENTS.md`（工作规则全集）+ `CLAUDE.md`（启动入口 + 行为铁律）+ `PROJECT.md`（当前坐标），项目大了再加 ROADMAP / CHANGELOG / lint。**建完你项目就有了和本库参考体系一样的治理骨架。**

⚠️ `setup.md` 是**安装脚本**（建完使命完成）；建出来的那几个文件才是**常驻治理产物**——别搞混（这正是本库踩过、并写进反模式的「安装 vs 产物」角色混淆坑）。

## 想懂背后为什么

读 [`governance-architecture-essence.md`](governance-architecture-essence.md)——完整方法论：三线一底座 + 9 条治理定律（每条带踩坑 why）+ 核心机制 + 反模式。**给人理解；AI 安装只需 `setup.md`。**

## 结构（就 3 样）

```
setup.md                            ★ 给 AI 的安装指令（建出完整治理体系）← 交给你项目的 AI
governance-architecture-essence.md  给人的方法论（为什么）
README.md                           本文（导航）
```

## 共建

某项目踩出可迁移的新定律 → 加进 essence 的定律清单（§5）。项目特定的（具体规则 / 数值 / 业务）留本地，别污染本库。

---

*萃取自一个真实项目（Next.js + 微信小程序 + 自托管数据库的 PIM）的治理实战（2026）。每条定律带的「踩坑 why」是最值钱的部分。*
