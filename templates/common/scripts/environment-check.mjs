#!/usr/bin/env node
import { main } from "./lib/environment-check.mjs";

process.exitCode = await main(process.argv.slice(2));
