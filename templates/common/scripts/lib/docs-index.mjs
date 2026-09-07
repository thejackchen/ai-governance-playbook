import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { posix, resolve, relative, isAbsolute } from "node:path";

// Navigation is prose, not sample code. Anchors are intentionally left to the
// document renderer; this gate establishes file reachability only.
export function navigationTargets(markdown) {
  const lines = [];
  let fence = null;
  const listIndents = [];
  for (let line of String(markdown).replace(/<!--[^]*?-->/g, "").split(/\r?\n/)) {
    // Deliberately limited navigation syntax: ordinary prose and bullet/ordered
    // lists, with four-column tab stops. A list continuation is prose until it
    // is four columns deeper than the item's content; that is indented code.
    line = line.replace(/^[ \t]*/, (prefix) => {
      let width = 0;
      for (const char of prefix) width += char === "\t" ? 4 - width % 4 : 1;
      return " ".repeat(width);
    });
    const indent = line.match(/^ */)[0].length;
    if (line.trim() && !fence) {
      while (listIndents.length && indent < listIndents.at(-1)) listIndents.pop();
    }
    let content = line.slice(listIndents.at(-1) ?? 0);
    if (!fence) {
      const item = content.match(/^ {0,3}(?:[-+*]|\d{1,9}[.)]) {1,4}(?=\S)/);
      if (item) {
        listIndents.push((listIndents.at(-1) ?? 0) + item[0].length);
        content = content.slice(item[0].length);
      }
    }
    const marker = content.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }
    if (marker && !(marker[1][0] === "`" && marker[2].includes("`"))) {
      fence = { char: marker[1][0], length: marker[1].length };
      continue;
    }
    if (!/^ {4}/.test(content)) lines.push(content);
  }
  const prose = lines.join("\n").replace(/(`+)[^]*?\1/g, "");
  return [...prose.matchAll(/\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^]*?["'])?\s*\)/g)]
    .map((match) => match[1].replace(/^<|>$/g, ""))
    .filter((target) => target && !/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target));
}

export function inspectDocsIndex(root, { exemptFiles = new Set(), requiredExtras = [] } = {}) {
  const errors = [];
  let realRoot;
  try {
    realRoot = realpathSync(root);
  } catch (error) {
    return {
      errors: [`docs/index: root unavailable (${error.code ?? error.name})`],
      coverage: { total: 0, covered: 0, indexes: 0 },
      registered: new Set(["docs/index.md"]),
    };
  }
  const outsideRoot = (full) => {
    try {
      const local = relative(realRoot, realpathSync(full));
      return local === ".." || local.startsWith("../") || isAbsolute(local);
    } catch {
      return true;
    }
  };
  const registered = new Set(["docs/index.md"]);
  const visited = new Set();
  const queue = ["docs/index.md"];
  const rootTargets = new Set();
  while (queue.length) {
    const index = queue.shift();
    const full = resolve(root, index);
    if (!existsSync(full) || !statSync(full).isFile()) {
      errors.push(`${index} 索引不存在或不是文件`);
      continue;
    }
    if (outsideRoot(full)) {
      errors.push(`${index} 索引真实路径越出仓库`);
      continue;
    }
    const realIndex = realpathSync(full);
    if (visited.has(realIndex)) continue;
    visited.add(realIndex);
    for (const raw of navigationTargets(readFileSync(full, "utf8"))) {
      const path = raw.split("#")[0];
      if (!path) continue;
      const target = posix.normalize(posix.join(posix.dirname(index), path));
      const local = relative(resolve(root), resolve(root, target));
      if (path.startsWith("/") || local.startsWith("../") || local === ".." || isAbsolute(local)) {
        errors.push(`${index} 导航越出仓库：${raw}`);
        continue;
      }
      const destination = resolve(root, target);
      if (!existsSync(destination)) {
        errors.push(`${index} 链接不可达：${raw}`);
        continue;
      }
      if (outsideRoot(destination)) {
        errors.push(`${index} 导航真实路径越出仓库：${raw}`);
        continue;
      }
      registered.add(target);
      if (index === "docs/index.md") rootTargets.add(target);
      if (posix.basename(target) === "INDEX.md" && statSync(destination).isFile()) queue.push(target);
    }
  }
  for (const extra of requiredExtras) {
    if (!rootTargets.has(extra)) errors.push(`${extra} 未登记进 docs/index.md`);
  }
  const files = [];
  const walk = (dir) => {
    const fullDir = resolve(root, dir);
    if (!existsSync(fullDir)) return;
    if (outsideRoot(fullDir)) {
      errors.push(`${dir} 文档目录真实路径越出仓库`);
      return;
    }
    for (const entry of readdirSync(fullDir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && /\.(md|pptx|pdf)$/.test(entry.name)) files.push(path);
    }
  };
  walk("docs");
  let covered = 0;
  for (const file of files) {
    if (registered.has(file) || exemptFiles.has(file)) covered++;
    else errors.push(`${file} 未登记：无法从 docs/index.md 经目录 INDEX.md 导航到达`);
  }
  return { errors, coverage: { total: files.length, covered, indexes: visited.size }, registered };
}
