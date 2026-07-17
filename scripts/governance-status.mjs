#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const roadmap = readFileSync(join(root, "ROADMAP.md"), "utf8");
const match = roadmap.match(/## 当前游标\s+([\s\S]*?)(?=\n## |$)/);
const cursor = match ? match[1].trim() : "未找到当前游标";
let status = "";
try {
  status = execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }).trim();
} catch {}

console.log(`治理启动状态\n\n当前游标:\n${cursor}\n\n工作树:${status ? `\n${status}` : " clean"}`);
