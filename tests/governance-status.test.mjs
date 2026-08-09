import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

// 回归守卫:自适应执行状态生成器 + 漂移门 + 顶部单游标(第二正本)门。
// 这些是 CORE §2.5「执行状态建模」的机器载体——行为改坏必须被测试拦住。
const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT_SRC = join(here, "..", "templates", "common", "scripts", "governance-status.mjs");

function project(branches) {
  const dir = mkdtempSync(join(tmpdir(), "gs-"));
  mkdirSync(join(dir, "scripts"), { recursive: true });
  cpSync(SCRIPT_SRC, join(dir, "scripts", "governance-status.mjs"));
  // 根布局 ROADMAP:顶部单游标 + 战线投影标记块(镜像模板形态)
  writeFileSync(
    join(dir, "ROADMAP.md"),
    "# R\n\n## 当前游标\n\n单线遗留游标\n\n## 战线\n\n" +
      "<!-- governance-status:projection:start -->\n| 战线 | 状态 |\n|---|---|\n| x | 推进 |\n<!-- governance-status:projection:end -->\n",
  );
  if (branches) {
    mkdirSync(join(dir, "docs", "execution", "branches"), { recursive: true });
    for (const [slug, cursor] of branches) {
      writeFileSync(join(dir, "docs", "execution", "branches", `${slug}.md`), `# ${slug}\n## 当前游标\n${cursor}\n`);
    }
  }
  return dir;
}

function run(dir, ...args) {
  return spawnSync(process.execPath, [join(dir, "scripts", "governance-status.mjs"), ...args], {
    cwd: dir,
    encoding: "utf8",
  });
}

test("单线项目(无分支):--check 空过 exit 0", () => {
  const dir = project(null);
  try {
    assert.equal(run(dir, "--check").status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("分裂:--write 投影 + 自动删顶部单游标;--check 一致 exit 0", () => {
  const dir = project([["a", "阶段 1/2 · x · y"], ["b", "阶段 1/3 · p · q"], ["c", "阶段 2/2 · m · n"]]);
  try {
    assert.equal(run(dir, "--write").status, 0);
    const roadmap = readFileSync(join(dir, "ROADMAP.md"), "utf8");
    assert.ok(!/^##[ \t]+当前游标/m.test(roadmap), "分裂后顶部单游标应被 --write 删除");
    assert.match(roadmap, /\| a \|/);
    assert.equal(run(dir, "--check").status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("分裂:游标漂移未重投影 → --check exit 1(漂移门)", () => {
  const dir = project([["a", "阶段 1/2 · x · y"], ["b", "阶段 1/3 · p · q"]]);
  try {
    run(dir, "--write");
    writeFileSync(join(dir, "docs", "execution", "branches", "a.md"), "# a\n## 当前游标\n阶段 9/9 · drifted · z\n");
    assert.equal(run(dir, "--check").status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("分裂:重新塞入顶部单游标(第二正本)→ --check exit 1", () => {
  const dir = project([["a", "阶段 1/2 · x · y"], ["b", "阶段 1/3 · p · q"]]);
  try {
    run(dir, "--write");
    const roadmap = readFileSync(join(dir, "ROADMAP.md"), "utf8");
    writeFileSync(join(dir, "ROADMAP.md"), "## 当前游标\n矛盾的第二正本\n\n" + roadmap);
    assert.equal(run(dir, "--check").status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
