---
name: governance-bootstrap
description: 为当前项目建立或对齐一套实测版 AI 治理（新项目从零装、存量项目绞杀式迁移都适用）。当用户说「建立治理 / 搭治理架构 / 装治理恒温器 / 对齐治理 / 用 ai-governance-playbook 给这个项目做治理」时使用。
---

# 治理 Bootstrap

为本项目安装治理。**唯一真相源是 ai-governance-playbook 仓库——本 skill 只把你引过去，不在这里复制流程、文件清单或命令**（复制了就会和仓库漂移，违反治理自己教的「同一事实只有一个权威出处」）。

## 照做（五步，全部以仓库现读内容为准）

1. **读 setup**：拉取 `https://github.com/thejackchen/ai-governance-playbook` 的 `setup.md`（用 WebFetch，或让用户提供仓库内容），它是安装指令书，以下四步就是它的目录。
2. **探测**（setup 第 0 步）：回答三问——运行环境 / 全新还是存量 / 有无 CI；载体按 `ADAPTERS.md` 映射表就地取材。**存量项目先读 `MIGRATION.md` 走绞杀式六步**，再回 setup。
3. **安装**（setup 第 1 步）：先结构层后散文层，用 `templates/` 的零件复制填空，每小步过它标注的 ✅ 验收。
4. **演练**（setup 第 2 步）：用一个真实小任务走完全流程，走不通的条款当场修。
5. **自检交付**（setup 第 3 步）：对照 `SELF-CHECK.md` 逐项过（含三条反模式自查），向负责人交付五项齐全的安装报告。

## 一句话原则

机制不变，载体就地取材；每条规则在 registry 如实登记实际载体——**诚实优先于完备**。具体怎么做、文件叫什么、命令是什么——**去仓库现读，别凭本 skill 记忆**。
