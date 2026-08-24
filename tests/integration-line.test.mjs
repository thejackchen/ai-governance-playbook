import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateIntegrationLineGate,
  inspectIntegrationLine,
  isRecoveryAction,
} from "../scripts/lib/integration-line.mjs";

function execFrom(map) {
  return (args) => {
    const key = args.join(" ");
    if (map[key]) return map[key];
    return { ok: false, stdout: "", stderr: `missing ${key}` };
  };
}

const trunkPolicy = {
  integrationLine: { remote: "codeup", branch: "dev", label: "阿里云 dev" },
};

const primaryGit = {
  "rev-parse --git-dir": { ok: true, stdout: "/repo/.git" },
  "rev-parse --git-common-dir": { ok: true, stdout: "/repo/.git" },
  "rev-parse --is-shallow-repository": { ok: true, stdout: "false" },
};

test("sidecar tracking trunk blocks only when colleague commits are missing", () => {
  const inspection = inspectIntegrationLine("/repo", {
    policy: trunkPolicy,
    execGit: execFrom({
      ...primaryGit,
      "rev-parse --abbrev-ref HEAD": { ok: true, stdout: "wcs-logout-deploy" },
      "rev-parse --abbrev-ref @{u}": { ok: true, stdout: "codeup/dev" },
      "merge-base HEAD codeup/dev": { ok: true, stdout: "abc" },
      "rev-list --count HEAD..codeup/dev": { ok: true, stdout: "112" },
      "rev-list --count codeup/dev..HEAD": { ok: true, stdout: "1" },
    }),
  });
  assert.equal(inspection.kind, "behind-line");
  assert.equal(inspection.blockWrites, true);
  assert.match(inspection.message, /112 个提交还没并进眼前这份/);
  assert.match(inspection.message, /看起来像同一条线/);
  const reason = evaluateIntegrationLineGate({
    root: "/repo",
    toolName: "search_replace",
    toolInput: { file_path: "apps/web/page.tsx" },
    policy: trunkPolicy,
    execGit: execFrom({
      ...primaryGit,
      "rev-parse --abbrev-ref HEAD": { ok: true, stdout: "wcs-logout-deploy" },
      "rev-parse --abbrev-ref @{u}": { ok: true, stdout: "codeup/dev" },
      "merge-base HEAD codeup/dev": { ok: true, stdout: "abc" },
      "rev-list --count HEAD..codeup/dev": { ok: true, stdout: "112" },
      "rev-list --count codeup/dev..HEAD": { ok: true, stdout: "1" },
    }),
  });
  assert.match(reason, /先合进来再写/);
});

test("caught-up side branch is allowed; branch name need not be dev", () => {
  const execGit = execFrom({
    ...primaryGit,
    "rev-parse --abbrev-ref HEAD": { ok: true, stdout: "wcs-logout-deploy" },
    "rev-parse --abbrev-ref @{u}": { ok: true, stdout: "codeup/dev" },
    "merge-base HEAD codeup/dev": { ok: true, stdout: "abc" },
    "rev-list --count HEAD..codeup/dev": { ok: true, stdout: "0" },
    "rev-list --count codeup/dev..HEAD": { ok: true, stdout: "3" },
  });
  const inspection = inspectIntegrationLine("/repo", { policy: trunkPolicy, execGit });
  assert.equal(inspection.kind, "caught-up-side-branch");
  assert.equal(inspection.blockWrites, false);
  assert.match(inspection.message, /已经含有/);
  assert.equal(
    evaluateIntegrationLineGate({
      root: "/repo",
      toolName: "search_replace",
      toolInput: { file_path: "apps/web/page.tsx" },
      policy: trunkPolicy,
      execGit,
    }),
    null,
  );
});

test("on the shared line allows writes even with local-only commits", () => {
  const execGit = execFrom({
    ...primaryGit,
    "rev-parse --abbrev-ref HEAD": { ok: true, stdout: "dev" },
    "rev-parse --abbrev-ref @{u}": { ok: true, stdout: "codeup/dev" },
    "merge-base HEAD codeup/dev": { ok: true, stdout: "abc" },
    "rev-list --count HEAD..codeup/dev": { ok: true, stdout: "0" },
    "rev-list --count codeup/dev..HEAD": { ok: true, stdout: "3" },
  });
  const inspection = inspectIntegrationLine("/repo", { policy: trunkPolicy, execGit });
  assert.equal(inspection.kind, "on-line");
  assert.equal(inspection.blockWrites, false);
  assert.equal(
    evaluateIntegrationLineGate({
      root: "/repo",
      toolName: "search_replace",
      toolInput: { file_path: "apps/web/page.tsx" },
      policy: trunkPolicy,
      execGit,
    }),
    null,
  );
});

test("behind trunk blocks new feature writes but allows git merge", () => {
  const execGit = execFrom({
    ...primaryGit,
    "rev-parse --abbrev-ref HEAD": { ok: true, stdout: "dev" },
    "rev-parse --abbrev-ref @{u}": { ok: true, stdout: "codeup/dev" },
    "merge-base HEAD codeup/dev": { ok: true, stdout: "abc" },
    "rev-list --count HEAD..codeup/dev": { ok: true, stdout: "5" },
    "rev-list --count codeup/dev..HEAD": { ok: true, stdout: "0" },
  });
  const inspection = inspectIntegrationLine("/repo", { policy: trunkPolicy, execGit });
  assert.equal(inspection.kind, "behind-line");
  assert.match(inspection.message, /5 个提交还没并进眼前这份/);
  assert.match(
    evaluateIntegrationLineGate({
      root: "/repo",
      toolName: "Write",
      toolInput: { file_path: "packages/core/src/index.ts" },
      policy: trunkPolicy,
      execGit,
    }),
    /先合进来再写/,
  );
  assert.equal(
    evaluateIntegrationLineGate({
      root: "/repo",
      toolName: "Bash",
      toolInput: { command: "git merge codeup/dev" },
      candidates: ["git merge codeup/dev"],
      policy: trunkPolicy,
      execGit,
    }),
    null,
  );
  assert.equal(
    evaluateIntegrationLineGate({
      root: "/repo",
      toolName: "run_terminal_command",
      toolInput: { command: "pnpm test" },
      candidates: ["pnpm test"],
      policy: trunkPolicy,
      execGit,
    }),
    null,
  );
});

test("linked worktree may sit on a feature branch", () => {
  const inspection = inspectIntegrationLine("/repo-wt", {
    policy: trunkPolicy,
    execGit: execFrom({
      "rev-parse --git-dir": { ok: true, stdout: "/repo/.git/worktrees/demo" },
      "rev-parse --git-common-dir": { ok: true, stdout: "/repo/.git" },
      "rev-parse --abbrev-ref HEAD": { ok: true, stdout: "codex/demo3-send-safety" },
      "rev-parse --abbrev-ref @{u}": { ok: false, stdout: "" },
      "rev-parse --is-shallow-repository": { ok: true, stdout: "false" },
      "merge-base HEAD codeup/dev": { ok: true, stdout: "abc" },
      "rev-list --count HEAD..codeup/dev": { ok: true, stdout: "0" },
      "rev-list --count codeup/dev..HEAD": { ok: true, stdout: "2" },
    }),
  });
  assert.equal(inspection.kind, "worktree");
  assert.equal(inspection.blockWrites, false);
});

test("markdown writes and emergency claims are not blocked", () => {
  const execGit = execFrom({
    ...primaryGit,
    "rev-parse --abbrev-ref HEAD": { ok: true, stdout: "wcs-logout-deploy" },
    "rev-parse --abbrev-ref @{u}": { ok: true, stdout: "codeup/dev" },
    "merge-base HEAD codeup/dev": { ok: true, stdout: "abc" },
    "rev-list --count HEAD..codeup/dev": { ok: true, stdout: "1" },
    "rev-list --count codeup/dev..HEAD": { ok: true, stdout: "1" },
  });
  assert.equal(
    evaluateIntegrationLineGate({
      root: "/repo",
      toolName: "Write",
      toolInput: { file_path: "docs/execution/FEATURES.md" },
      policy: trunkPolicy,
      execGit,
    }),
    null,
  );
  assert.equal(
    evaluateIntegrationLineGate({
      root: "/repo",
      toolName: "Write",
      toolInput: { file_path: "apps/web/page.tsx" },
      policy: trunkPolicy,
      execGit,
      claims: [{ mode: "emergency", status: "active" }],
    }),
    null,
  );
});

test("writes outside the repo are not blocked by this repo's trunk gate", () => {
  const execGit = execFrom({
    ...primaryGit,
    "rev-parse --abbrev-ref HEAD": { ok: true, stdout: "wcs-logout-deploy" },
    "rev-parse --abbrev-ref @{u}": { ok: true, stdout: "codeup/dev" },
    "merge-base HEAD codeup/dev": { ok: true, stdout: "abc" },
    "rev-list --count HEAD..codeup/dev": { ok: true, stdout: "1" },
    "rev-list --count codeup/dev..HEAD": { ok: true, stdout: "1" },
  });
  assert.equal(
    evaluateIntegrationLineGate({
      root: "/repo",
      toolName: "Write",
      toolInput: { file_path: "/Users/jack/working/ai-governance-playbook/CORE.md" },
      policy: trunkPolicy,
      execGit,
    }),
    null,
  );
});

test("checkout of the trunk branch is recovery", () => {
  assert.equal(
    isRecoveryAction({
      toolName: "Bash",
      candidates: ["git checkout dev"],
      inspection: { line: { branch: "dev", ref: "codeup/dev" } },
    }),
    true,
  );
  assert.equal(
    isRecoveryAction({
      toolName: "Bash",
      candidates: ["git checkout wcs-logout-deploy"],
      inspection: { line: { branch: "dev", ref: "codeup/dev" } },
    }),
    false,
  );
});
