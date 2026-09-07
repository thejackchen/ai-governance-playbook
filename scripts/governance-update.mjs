#!/usr/bin/env node
import { runGovernanceUpdateCLI } from "./lib/governance-update.mjs";

process.exitCode = await runGovernanceUpdateCLI(process.argv.slice(2));
