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
if (result.status === "offline") process.exit(0);
