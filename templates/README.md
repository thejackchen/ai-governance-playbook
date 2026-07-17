# 模板目录

`common/`是唯一公共模板来源；`adapters/`只提供运行时配置，不能复制公共治理正文。

不要手工把整个目录复制进项目。使用：

```bash
node scripts/init.mjs --target /path/to/project --runtime codex --profile lite --project-name demo --write
```

安装器会把`common/INSTRUCTIONS.md`渲染为运行时正本：Codex/Generic写成`AGENTS.md`，Claude Code写成`CLAUDE.md`，另一入口只生成桥接指针。
