---
name: pro-supervised-delivery
description: Orchestrate complex or high-risk engineering work through an authenticated ChatGPT Pro research and design lane, a Codex controller, and lower-cost implementation subagents. Use when a user asks for dual-agent collaboration, Pro-led architecture or planning, repository source packets, delegated implementation, long-running external AI discussions, independent acceptance, or evidence-backed delivery across multiple models.
---

# Pro Supervised Delivery

Use the strongest model where ambiguity and judgment are expensive. Use cheaper agents where the contract is already precise. Keep Codex as the only delivery controller and final acceptance authority.

## Role Contract

- Assign ChatGPT Pro deep reading, independent problem framing, architecture alternatives, threat modeling, and design criticism.
- Keep Codex responsible for authority discovery, source preparation, task decomposition, browser continuity, contradiction handling, integration, testing, and final claims.
- Assign implementation agents bounded files or modules only after the design contract is stable.
- Treat every model output as a proposal until independent evidence supports it.
- Never ask the user to relay technical messages between agents.

## 1. Establish Reality and Authority

1. Read repository instructions and authoritative architecture, roadmap, requirement, release, and runbook documents.
2. Identify the go-forward repository. Do not infer authority from the current directory, an old packet, or a similarly named legacy checkout.
3. Record branch, HEAD, remotes, dirty files, and upstream relationship. Fetch only when authorized; do not overwrite existing changes.
4. Separate five evidence classes:
   - repository and configuration facts;
   - documented intent;
   - runtime or deployment facts;
   - user decisions;
   - proposals and hypotheses.
5. Inspect the actual runtime when a claim depends on deployment, data source, authentication, or user-visible behavior.

## 2. Design the Collaboration

Split work into separate Pro conversations only when the questions are independently complex and can be accepted separately. Keep coupled architecture decisions in one conversation so tradeoffs remain visible.

Before contacting Pro, read [references/pro-collaboration.md](references/pro-collaboration.md). Build a task brief around the engineering problem, not a command transcript. Give Pro room to challenge the framing, but bind every factual claim to packet evidence.

Save each conversation URL immediately. Reuse the authenticated tab. Stop for login, CAPTCHA, passkey, account selection, or two-factor authentication; never request or extract credentials.

## 3. Prepare the Source Packet

When Pro cannot access the repository directly, run:

```bash
scripts/prepare-source-packet.sh --repo /absolute/repo --output /absolute/output.zip
```

Add repeated `--include <repo-relative-path>` arguments for a scoped packet. The script must fail closed if secret scanning is unavailable or finds a leak.

Before upload, independently confirm:

- the intended repository, branch, commit, and dirty state;
- excluded `.git`, dependencies, builds, caches, databases, runtime/browser state, and credentials;
- Gitleaks success on staged content;
- ZIP integrity;
- a second Gitleaks scan after extraction;
- file count, byte size, and SHA-256 in the sidecar manifest.

Do not include `.env`, keys, tokens, cookies, private keys, database dumps, browser profiles, or unneeded customer data. Redaction is not permission to include sensitive material.

## 4. Run an Engineering Discussion

Send the brief and packet together. Require Pro to:

- restate the problem in its own model;
- distinguish verified facts, assumptions, risks, alternatives, and recommendations;
- cite concrete paths and symbols from the packet;
- test conclusions against non-breakable boundaries;
- identify missing evidence rather than inventing it;
- return deliverables and an acceptance matrix.

Do not present a long imperative checklist as if Pro were a command-line worker. Use follow-ups to explore disagreements, request counterexamples, and supply missing repository evidence. Do not repeatedly prompt a long-running response merely because it is slow.

Reject or correct a response when it uses the wrong repository or version, invents capabilities, creates a competing source of truth, duplicates an existing directory, confuses code with deployment, or recommends action outside authorization.

## 5. Freeze the Decision Contract

Before implementation, write a concise contract containing:

- selected decision and rejected alternatives;
- boundaries and fact ownership;
- affected interfaces, data, permissions, and migrations;
- compatibility and rollback constraints;
- acceptance commands and evidence;
- unresolved external blockers.

Keep requirement state, implementation state, deployment state, and production validation distinct. A proposed design is not an implemented capability; passing mocked tests is not a live production proof.

## 6. Delegate Implementation

Read [references/delegation-and-acceptance.md](references/delegation-and-acceptance.md) before assigning implementation.

Give each agent exclusive ownership and a five-part specification: goal, files, interfaces, constraints, and verification commands. State that other agents and user edits coexist in the workspace and must not be reverted.

Use the least expensive capable model for mechanical implementation, focused tests, migrations, documentation projection, or repetitive inspection. Escalate architectural ambiguity back to Codex and Pro instead of letting an implementation agent silently redesign the contract.

Require a terminal result: verified artifacts or a specific blocker. “Started another process,” “task dispatched,” or “looks complete” is not delivery.

## 7. Accept Independently

Apply external patches in an isolated worktree when practical. Verify attachment size and SHA-256 before use. Review the full diff, executable files, dependencies, lockfiles, migrations, trust boundaries, and failure behavior.

Run repository-required lint, formatting, type checks, unit tests, contract tests, production builds, and relevant E2E. Add focused adversarial checks for permissions, secrets, destructive actions, concurrency, idempotency, and external side effects when affected.

Use failure evidence for correction:

- exact command and error output;
- file and symbol;
- violated contract;
- smallest complete expected correction.

Return concrete defects to Pro or the implementation agent and repeat until accepted or a genuine external blocker remains.

## 8. Persist and Report

Persist valuable decisions, specifications, and acceptance evidence in the repository's existing authoritative locations and indexes. Do not leave the only copy in a chat or temporary directory.

Report:

- Pro conversation links;
- packet baseline, size, SHA-256, and scan result;
- actual changes;
- corrections requested from Pro or agents;
- independently run tests and their results;
- unverified risks;
- exact Git and deployment state.

Never commit, push, create a PR, deploy, migrate a real database, change production configuration, enable production behavior, or touch real user data without explicit authorization.

## Failure Patterns

| Failure | Required correction |
| --- | --- |
| Pro sounds mechanical because it received a command dump | Reframe as an engineering review, provide context and decision questions, and ask it to form and challenge its own model. |
| A polished report is accepted without source checks | Reopen the cited files and falsify the important claims before planning work. |
| Pro invents a duplicate directory or authority | Map every deliverable to the existing source-of-truth matrix before acceptance. |
| The packet points at a legacy repository | Stop, rebuild from the go-forward authority, and explicitly invalidate the old conclusion. |
| A subagent answers a nearby task instead of its assignment | Reject the response, restate the bounded contract with evidence, and rerun or replace it. |
| Shared-checkout agents edit overlapping files | Stop overlapping writers, assign one writer per file, make other lanes read-only, and re-accept the combined diff. |
| A nested agent leaves a long process running and ends | Resume supervision; accept only verified output or an explicit blocker. |
| A test or success flag verifies itself | Add an independent receiver-side or extracted-artifact check. |
| A negative test accepts any non-zero exit | Isolate each invalid fixture and require both failure status and the intended stable rejection class or prefix. |
| A model claims shipped, live, or production-ready from code alone | Require release records and runtime readback, or label the claim unverified. |
