# 治理版本与 lock 升级

> 给负责人和其他组的 session：线上正本、何时检查、什么叫 lock 升级、怎么分享。

## 线上正本

GitHub 仓库默认分支的 `VERSION` 是「当前最佳实践」的版本号标记：

https://github.com/thejackchen/ai-governance-playbook

消费仓的 `governance.lock.json` 只记录**自己装过哪一版**，不是第二份方法论。

## 何时检查

只在 **SessionStart**（开新会话、续接、压缩后重开）。不在每一轮对话、也不在每个工具调用时查询。查到的结果缓存 6 小时。这和手机 App、VS Code 在启动时查更新是同一类节拍。

## 什么是 lock 升级

1. 读 GitHub 上的 `VERSION`。
2. 和本仓 lock 里的 `playbookVersion` 比较。
3. 若落后：从本机已 `git pull` 的 playbook 目录，把本版**新增且项目里还没有**的载体文件补上。
4. **不覆盖**已经存在的文件（`CLAUDE.md`、游标、改过的 hook 一律不动）。
5. 把 lock 的版本号、kit 指纹、`installedFiles` 改成这次实际装上的状态。

所以 lock 升级不是「用模板重装整个项目」，是「软件更新：补零件 + 改版本记录」。

## 其他组 / 其他 session 怎么拿到

1. 负责人把 playbook **提交并推送到 GitHub**（没推送 = 其他组看不到）。
2. 对新仓说：`参考我的 AI governance：https://github.com/thejackchen/ai-governance-playbook ，按 setup.md 安装`。
3. 对已有仓：那个 session 开工会自己对照 GitHub；也可以手动跑  
   `node ~/working/ai-governance-playbook/scripts/upgrade.mjs --target . --write`
4. 新开一个会话说「读本仓治理接手」，用四题考试验收。
5. Grok 仓若项目 hook 未信任，跑一次 `/hooks-trust`。

第一次从很老的 session-start 升上来，如果旧开工脚本里还没有这段检查，需要在那个 session 里跑一次上面的 `upgrade.mjs`；之后开机就会自己查。
