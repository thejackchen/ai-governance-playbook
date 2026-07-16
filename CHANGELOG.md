# CHANGELOG — ai-governance-playbook 事件流水

> 每轮收尾追加一行(只增不改)。最新在上。格式:日期段标题独占一行 `## YYYY-MM-DD`,其下条目以 `- ` 开头——与自家模板 [templates/CHANGELOG.md](templates/CHANGELOG.md) 的机器可解析约定一致(心跳脚本按此统计回路活性)。playbook 自身也要自食其力——本文件自 2026-07-17 起记账(此前历史见 git log 与 tag v1-pre-kit/v2.x)。

## 2026-07-17

- [fix] v2.3.1:复测(第二沙盒,无指路冷启动)残留 3 处 P2 修复——本地定时器完成判据(setup 1.5)/ 心跳脚本尾注去硬编码层级 / SELF-CHECK 1.5 措辞对齐最小档。两轮实测(四维 + 复测)全 PASS,判例库自然发现率 100%。
- [fix] v2.3.0:四位无记忆测试员实测缺陷修复——判例库接线进全部入口(README/setup/MIGRATION)+ 判例格式统一六字段 + templates 复制清单补全(生成器/ADR-000/.gitignore)+ 生成器支持 CommonJS + 心跳脚本本地时区修复 + CI 无远端降级路径 + hook 载体口径统一 + VERSION 版本锚点 + setup 最小档豁免段。
- [cases] 母版(产品中心)首批三条判例反哺:机器节拍与数字门槛不继承人类惯性 / 组成部分读出来不背清单 / 多人协作仓开工先 fetch 对账(10 天双线分叉实证)。均经负责人当场纠正或批准;同内容已同步 v3 草案分支,合并零冲突。
