#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const admissionHook = fileURLToPath(new URL("./pre-tool-use-admission.mjs", import.meta.url));
const raw = readFileSync(0, "utf8") || "{}";
const result = spawnSync(process.execPath, [admissionHook], {
  cwd: process.cwd(),
  input: raw,
  encoding: "utf8",
});
process.stdout.write(`${result.stdout || ""}${result.stderr || ""}`);
process.exit(result.status ?? 0);
