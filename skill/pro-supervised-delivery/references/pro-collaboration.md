# Pro Collaboration

Use this reference whenever preparing, sending, or correcting a ChatGPT Pro task.

## Brief Shape

Write in natural engineering prose. Include:

1. **Background and outcome**: why the problem matters and what decision or artifact is needed.
2. **Repository reality**: go-forward repo, branch, commit, dirty-state note, technology stack, current implementation, and authoritative documents.
3. **Non-breakable boundaries**: facts of ownership, compatibility, security, production, authorization, and existing user decisions.
4. **Research and design questions**: the tensions Pro must reason about, not a predetermined conclusion to repeat.
5. **Scope**: files, modules, workflows, and adjacent systems that matter.
6. **Deliverables**: architecture assessment, alternatives, recommendation, migration sequence, threat model, acceptance matrix, or patch as applicable.
7. **Evidence standard**: cite packet paths and symbols; mark anything not evidenced as an assumption.
8. **Required verification**: commands Pro can legitimately run on the packet, plus tests Codex will run locally.
9. **Forbidden operations and claims**: no production action, credential use, fabricated runtime proof, commit, push, deploy, or claim that unavailable systems were tested.
10. **Acceptance criteria**: observable conditions that let Codex accept or reject the result.

## Opening Prompt Pattern

```text
Act as a senior engineering peer, not a form-filling executor.

First inspect the attached repository packet and build your own model of the
current system. Then challenge the framing below where the source disagrees or
where a simpler design would preserve the goal. Separate verified facts,
assumptions, alternatives, recommendations, and missing evidence.

<background and desired outcome>
<repository baseline and authoritative documents>
<current architecture and constraints>
<design questions>
<deliverables and acceptance>
<forbidden actions and claims>

For every important conclusion, cite a concrete path and symbol from the packet.
Do not treat documentation, code existence, deployment, and production
validation as the same state.
```

## Productive Follow-ups

Ask follow-ups that create new information:

- “This conclusion conflicts with `<path>:<symbol>`. Re-evaluate it under this evidence.”
- “Give the strongest counterexample to your preferred option and the trigger that would reverse the decision.”
- “Your proposal creates a second status authority beside `<existing SoT>`. Rework it so status is projected, not duplicated.”
- “Separate the identity, authorization, data visibility, and audit questions; the current answer conflates them.”
- “State what is unverified because you cannot access the runtime.”

Avoid:

- sending the same task again while Pro is still working;
- adding commands unrelated to the reasoning question;
- telling Pro the intended answer before it has inspected the source;
- asking for code before architecture boundaries are stable;
- accepting a rewrite that only sounds more complete.

## Correction Loop

When a response fails:

1. Quote the smallest incorrect claim.
2. Provide the contradicting file, symbol, or test output.
3. State the violated boundary.
4. Ask for the smallest complete correction.
5. Require a revised impact and acceptance matrix.

Keep the same conversation for corrections to the same decision. Start a new conversation only for an independent complex problem.
