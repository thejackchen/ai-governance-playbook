#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs } from "./lib.mjs";
import { checkAndMaybeUpgrade, formatUpdateReport } from "./lib/playbook-update.mjs";

const args = parseArgs(process.argv.slice(2));
const target = resolve(String(args.target || process.cwd()));
const apply = args.write || args.apply === "safe" ? "safe" : args.notify ? "notify" : "safe";
const result = await checkAndMaybeUpgrade(target, { apply: args.write ? "safe" : apply, skipCache: true });
console.log(formatUpdateReport(result));
if (result.added?.length) console.log(`added: ${result.added.join("\nadded: ")}`);
if (result.updated?.length) console.log(`updated adapter: ${result.updated.join("\nupdated adapter: ")}`);
if (result.patched?.length) console.log(`patched wiring: ${result.patched.join("\npatched wiring: ")}`);
if (result.conflicts?.length) console.log(`needs human: ${result.conflicts.join("\nneeds human: ")}`);
if (result.adaptationReport) console.log(`adaptation report: ${JSON.stringify(result.adaptationReport)}`);
if (result.status === "offline") process.exit(0);
