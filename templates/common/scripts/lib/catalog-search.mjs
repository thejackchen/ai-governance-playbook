import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { CATEGORIES } from "./project-catalog.mjs";

const normalize = (value) => String(value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
const HELP = "Usage: node scripts/project-catalog.mjs [--query TEXT] [--category PATH_OR_SEGMENT] [--related ASSET_ID] [--json]\nFilters combine with AND. Results are pointers, not authorization or live status.";
const ROOT_CATEGORIES = [...CATEGORIES].map(normalize);

function categoryMatches(path, needle) {
  const root = ROOT_CATEGORIES.find((candidate) => path === candidate || path.startsWith(`${candidate}/`));
  if (!root) return false;
  if (needle === root) return true;
  if (needle.startsWith(`${root}/`)) return path === needle || path.startsWith(`${needle}/`);
  return path.slice(root.length + 1).split("/").includes(needle);
}

export function parseArguments(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    const key = String(flag).slice(2);
    if (!["--query", "--category", "--related", "--json", "--help"].includes(flag) || key in options) {
      throw new Error(`Unknown or repeated option: ${flag}`);
    }
    if (key === "json" || key === "help") options[key] = true;
    else {
      const value = args[++i];
      if (!value || String(value).startsWith("--") || !normalize(value)) throw new Error(`Missing value for ${flag}`);
      options[key] = value;
    }
  }
  return options;
}

/** Read metadata only. Never follow entry/externalPath or execute an operation. */
export function searchCatalog(assets, { query, category, related } = {}) {
  if (!Array.isArray(assets)) throw new Error("Catalog assets must be an array");
  if (related && !assets.some((asset) => asset?.id === related)) throw new Error(`Unknown related asset ID: ${related}`);
  const origin = assets.find((asset) => asset?.id === related);
  const needle = query ? normalize(query) : null;
  const categoryNeedle = category ? normalize(category) : null;
  const ranked = [];
  for (const asset of assets) {
    if (!asset || typeof asset !== "object" || Array.isArray(asset)) continue;
    const matches = [];
    let score = 0;
    if (needle) {
      for (const field of ["id", "purpose", "aliases", "tags", "category", "sourcePaths"]) {
        const values = Array.isArray(asset[field]) ? asset[field] : [asset[field]];
        for (const value of values) {
          if (typeof value !== "string" || !normalize(value).includes(needle)) continue;
          const exact = normalize(value) === needle;
          matches.push({ field, value, type: exact ? "exact" : "contains" });
          score = Math.max(score, exact && ["id", "aliases"].includes(field) ? 2 : 1);
        }
      }
      if (!matches.length) continue;
    }
    if (categoryNeedle) {
      const path = normalize(asset.category);
      if (!categoryMatches(path, categoryNeedle)) continue;
      matches.push({ field: "category", value: asset.category, type: "filter" });
    }
    if (related) {
      const outgoing = Array.isArray(origin?.links) && origin.links.includes(asset.id);
      const incoming = Array.isArray(asset.links) && asset.links.includes(related);
      if (!(outgoing || incoming)) continue;
      matches.push({ field: "links", value: related, type: "关联" });
    }
    ranked.push({ score, result: { id: asset.id, purpose: asset.purpose, entry: asset.entry, boundaries: asset.boundaries, matches } });
  }
  return ranked
    .sort((a, b) => b.score - a.score || (String(a.result.id) < String(b.result.id) ? -1 : String(a.result.id) > String(b.result.id) ? 1 : 0))
    .map(({ result }) => result);
}

function catalogPath(options = {}) {
  if (options.root) return resolve(options.root, "docs/architecture/project-catalog.json");
  if (options.catalogPath) return resolve(options.catalogPath);
  return new URL("../../docs/architecture/project-catalog.json", import.meta.url);
}

export function main(args, output = console, options = {}) {
  try {
    const parsed = parseArguments(args);
    if (parsed.help || ![parsed.query, parsed.category, parsed.related].some(Boolean)) {
      output.log(HELP);
      return 0;
    }
    const catalog = JSON.parse(readFileSync(catalogPath(options), "utf8"));
    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.assets)) throw new Error("Invalid catalog schema");
    const results = searchCatalog(catalog.assets, parsed);
    if (parsed.json) output.log(JSON.stringify({ results }, null, 2));
    else if (!results.length) output.log("无命中。请尝试名称、别名、标签或分类；不推测未登记对象。");
    else for (const result of results) {
      output.log(`${result.id}: ${result.purpose}\n  正本: ${result.entry}\n  边界: ${result.boundaries}\n  匹配: ${result.matches.map((match) => `${match.field} ${match.type}: ${match.value}`).join("; ")}`);
    }
    return 0;
  } catch (error) {
    // Do not print file content or a stack on malformed input.
    output.error(error instanceof SyntaxError ? "Cannot parse catalog JSON" : error.message);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
