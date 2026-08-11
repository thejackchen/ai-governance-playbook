# 模板目录

`common/`是唯一公共模板来源；`adapters/`只提供运行时配置，不能复制公共治理正文。

不要手工把整个目录复制进项目。使用：

```bash
node scripts/init.mjs --target /path/to/project --runtime codex --profile standard --project-name demo --write
```

安装器会把`common/INSTRUCTIONS.md`渲染为运行时正文，并将同一份字节复制到`AGENTS.md`与`CLAUDE.md`；Standard及以上另装认领门，Lite 的共享 hook 会动态跳过缺失的认领脚本。
