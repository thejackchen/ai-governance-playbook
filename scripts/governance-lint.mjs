#!/usr/bin/env node
// Mother CLI alias. Lite projects only install governance.mjs.
import { main } from './governance.mjs';
try { main(['check', ...process.argv.slice(2)]); }
catch (error) { console.error(`[governance] ${error.message}`); process.exitCode = 1; }
