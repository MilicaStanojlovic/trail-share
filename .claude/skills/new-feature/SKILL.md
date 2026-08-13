---
name: new-feature
description: Build a TrailShare feature end to end with the multiagent pipeline — cut a feature branch from develop, have the planner write a task checklist, run the implementor once per task, review, test in Chrome, then merge back to develop. Use whenever starting any new feature or screen.
---

# Building a feature with the multiagent pipeline

You are the **orchestrator**. You run on Opus and you do not write feature code yourself — you sequence the four role agents, carry state between them, and own every git operation.

## Prerequisites

Check these before starting; fix or report anything missing.

| Requirement | Check |
|---|---|
| PostgreSQL running | `Get-Service postgresql-x64-16` → `Running` |
| `trailshare` database exists | `psql -U postgres -c "\l"` (or the backend starts without a DB error) |
| opencode CLI + Kimi K2 | `opencode run -m opencode-go/kimi-k2.7-code "say PONG"` |
| Design access | `DesignSync` `list_files` on project `b5b8b913-1ab6-424e-94b6-b0841637a0d1` |
| Docker Desktop | Only needed for `npm run test:e2e` — the tester starts it on demand |

## The pipeline

### 1. Branch

```bash
git checkout develop && git pull --ff-only        # pull only if a remote exists
git checkout -b feature/<kebab-description>
```

Branch names describe the feature, not the task: `feature/trail-detail-page`, not `feature/fix`.

### 2. Plan

Launch the **planner** agent. Give it the feature name, the goal in the user's own words, and any constraints. It reads `CLAUDE.md`, `docs/design-spec.md`, and the design source, then writes `plans/<feature>.md` — an API contract plus 8–20 checkbox tasks.

Read the plan file yourself before proceeding. You are the only reviewer of the plan; a wrong contract here becomes wrong code in a dozen tasks.

### 3. Implement, one task at a time

For each unchecked task **in order**, launch a fresh **implementor** agent with:
- the plan file path,
- the exact task ID (e.g. `T4`),
- a one-paragraph summary of what previous tasks actually produced (the implementor has no memory of earlier invocations).

Run these **sequentially, never in parallel.** Two independent reasons, both observed in practice:

1. Every task shares one working tree, so concurrent agents clobber each other's edits.
2. **Concurrent `opencode run` invocations hang.** Run serially it answers in a couple of minutes; run two or more at once and they sit at zero output until the timeout, and buffered writes can land *after* the agent gives up and writes the file itself. Parallelism does not speed this pipeline up — it converts it into a slower one that silently falls back to the orchestrating model.

The implementor delegates the code writing to Kimi K2 via `opencode run`, verifies it type-checks, and ticks the box. If it reports a task as blocked, resolve the blocker (usually a missing dependency or an ambiguous plan step) and re-run that task before moving on. Never advance past a blocked task.

Commit after each task or small group of related tasks:

```bash
git add -A && git commit -m "feat(<scope>): <what T4 did>"
```

### 4. Review

Launch the **reviewer** agent once every task is ticked. It is read-only and reports blocking findings versus nits, focusing on the API contract agreeing across backend and frontend.

For each blocking finding, launch an implementor to fix it (state the finding and the file — no plan file task needed), then commit. Re-run the reviewer if the fixes were substantial.

### 5. Test

Launch the **tester** agent. It runs lint, Jest unit tests, the Testcontainers e2e suite, and the frontend type-check and build, then drives Chrome through the real user flow at `http://localhost:5173` and compares each screen against the design.

Failures go back to an implementor as fix tasks. Loop until the tester reports green. Do not merge on a "probably fine" — a suite the tester reports as **not run** is not a pass.

### 6. Merge

```bash
git add -A && git commit -m "feat(<scope>): <feature summary>"   # if anything is uncommitted
git push -u origin feature/<kebab-description>                   # skip if no remote
git checkout develop
git merge --no-ff feature/<kebab-description>
git push                                                          # skip if no remote
```

Use `--no-ff` so each feature stays a visible unit in develop's history. Leave `main` alone — releases are merged from develop deliberately, not as part of this pipeline.

## Rules

- One feature per branch, one task per implementor invocation, agents run sequentially.
- The plan file is the shared state between agents. It is the only thing every role reads.
- Only you run git commands. Agents that commit will corrupt the sequencing.
- If a feature turns out to need more than ~20 tasks, stop and split it into two features rather than letting the plan sprawl.
