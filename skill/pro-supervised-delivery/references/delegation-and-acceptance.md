# Delegation and Acceptance

## Implementation Assignment

Use this five-part contract:

```text
Goal:
<one observable outcome>

Owned files:
<exclusive files or module boundary>

Interfaces:
<contracts, schemas, routes, events, migrations, callers>

Constraints:
<architecture decision, compatibility, safety, no-go actions>
You are not alone in the workspace. Preserve user and other-agent changes,
do not revert unrelated edits, and stop if overlapping edits make the contract
ambiguous.

Verification:
<focused tests, typecheck, lint, build, diff checks>

Return only a terminal result: changed files plus verified command output, or a
specific blocker with evidence. Do not stop at “dispatched” or leave an
unmonitored background task.
```

Do not give two agents overlapping file ownership. When the runtime deliberately
shares one checkout and worktree isolation is unavailable, enforce one writer for
every overlapping file; make the other lanes read-only reviewers. Treat a late
agent result as a proposal, not a safe merge order: the controller must reread the
combined diff and rerun the integration gate after receipt.

Delegate discovery separately from implementation when discovery output is large.

## Receipt Check

Before reviewing quality, confirm the delivery is the requested object:

- correct repository, branch, and baseline;
- correct files and scope;
- complete attachments or patch;
- no unrelated rewrites;
- claimed commands include actual exit status and relevant counts;
- no credential or production action.

Reject an answer to a nearby question before spending time polishing it.

## Evidence Ladder

Use the strongest applicable evidence:

1. source and configuration readback;
2. focused automated test;
3. full repository gate;
4. built artifact inspection;
5. isolated integration or E2E;
6. deployment record;
7. receiver-side runtime readback;
8. real business acceptance.

Lower rungs cannot claim higher-rung states. Mocked external services prove local behavior only.

## High-risk Review

For authorization, migrations, irreversible actions, money, external writes, or concurrency:

- trace the negative path and fail-closed behavior;
- verify identity and authority at the final mutation boundary;
- check replay, idempotency, retry, and partial-failure windows;
- inspect data minimization and secret handling;
- verify rollback or reconciliation;
- add tests for denied, stale, malformed, duplicate, and unavailable cases.
- for negative tests, require the intended rejection class or stable error prefix
  as well as failure status; an arbitrary non-zero exit is not proof of the target
  invariant.

## Final State Matrix

Record each deliverable as one of:

- proposed;
- locally implemented;
- locally verified;
- committed;
- pushed;
- deployed;
- runtime-verified;
- business-accepted;
- blocked.

Never collapse these into a single “done” label.
