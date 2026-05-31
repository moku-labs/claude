# Incident Report: Two features planned in one session collided over a single plan slot

**Date:** 2026-05-31
**Project:** `@moku-labs/web` (uses the moku Claude Code plugin)
**Scope of this document:** factual record only — what happened, in what order, and the mechanical reason it was possible. No recommendations or fixes.

---

## 1. What happened (one sentence)

Two features were brainstormed and then planned in the same session before either was built; because the moku plan/build layer uses a single `.planning/specs/` directory and a single `.planning/STATE.md`, planning the second feature landed on top of the first feature's completed plan, and the two spec sets ended up being manually merged.

---

## 2. Timeline (chronological, with on-disk timestamps where available)

| Time | Event | Artifact / evidence |
|---|---|---|
| 03:20 | `/moku:brainstorm` started for feature **web-parity** (9 blog-migration gaps). | `.planning/.brainstorm-active` created (later removed at session end). |
| 03:58 | web-parity brainstorm finished. | `.planning/context-web-parity.md` written (mtime 03:58). |
| ~04:0x | In the same conversation, a **second** brainstorm was started for feature **client-data** (SPA client access to content/route data). It was launched conversationally within the running context, not as a separate `/moku:brainstorm` slash invocation. | — |
| 04:47 | client-data brainstorm finished. | `.planning/context-client-data.md` written (mtime 04:47). Two context files now coexist at `.planning/` root. |
| ~04:5x | `/moku:plan update framework "client-data" --context context-client-data.md` run. Produced specs `01–05` + skeleton; `## Phase: complete`. | `.planning/specs/01-router.md … 05-framework.md`, `.planning/skeleton-spec.md`, `.planning/STATE.md` (`Target: client-data`). |
| ~05:0x | `/moku:plan update framework "web-parity" --context context-web-parity.md` run. The single `.planning/specs/` slot and single `.planning/STATE.md` already held the completed client-data plan. | Collision point. |
| 05:14 | The running agent moved the client-data specs to `.planning/archive/client-data/` (5 spec files + STATE.md + skeleton-spec.md) and planned web-parity into the freed slot. | `.planning/archive/client-data/` created (mtime 05:14). |
| (after) | User stated the archived specs were approved design meant to be used, not shelved. The agent restored client-data and merged both features into 8 per-plugin specs (`01-env … 08-spa`), tagging each section `[WP]`/`[CD]`. | `.planning/specs/` (8 files, mtime 05:32), `.planning/skeleton-spec.md` (05:29), `.planning/STATE.md` `Target: web (MERGED) …` (05:32). |

---

## 3. End state on disk (verified at report time)

```
.planning/
  STATE.md                       # Phase: complete; Target: "web (MERGED) — web-parity + client-data"
  context-web-parity.md          # feature 1 brainstorm output
  context-client-data.md         # feature 2 brainstorm output
  specs/                         # 8 merged per-plugin specs (01-env … 08-spa)
  skeleton-spec.md               # merged skeleton
  archive/client-data/           # the standalone client-data plan (01-router…05-framework, STATE.md, skeleton-spec.md)
  build/                         # directory (normal)
  learnings.md                   # contains brainstorm entries for both web-migration, web-parity, client-data
```

- `.planning/.brainstorm-active`: not present at report time (created during brainstorm, removed by session end).
- `.planning/STATE.md.bak`: not present at report time.
- `.planning/` is gitignored (local-only; no commits involved).
- The moku plugin repo (`/Users/alex/Projects/moku/claude`) is a git repo on branch `main`, clean working tree, at report time.

---

## 4. How the collision was mechanically possible

These are the relevant defined behaviors of the moku plugin as written (statements of fact about the command/reference files, not evaluations).

**(a) Brainstorm emits one context file per run, with no cross-feature registry.**
`commands/brainstorm.md` defines the output as `.planning/context-{NAME}.md` and the closing suggestion references only that one file:
> "Brainstorm complete. Context saved to `.planning/context-{NAME}.md`. Run `/moku:plan … --context context-{NAME}.md` to begin planning."
Its "Existing Context Guard" triggers only when a context file of the **same NAME** already exists. Two different names (web-parity, client-data) produce two files with no mutual awareness.

**(b) Plan uses one flat specs directory, one STATE file, one skeleton file.**
`commands/plan.md` and `skills/moku-core/references/plan-templates.md` define a single `.planning/specs/` (flat, specs numbered `01-…`, `02-…` per plan), a single `.planning/STATE.md`, and a single `.planning/skeleton-spec.md`. There is no per-feature namespacing (no `specs/<feature>/`, no `STATE-<feature>.md`). Planning a second feature reuses the same numbered slots (both plans begin at `01-*.md`).

**(c) Plan's pre-flight identity check compares TYPE, not feature name.**
In `commands/plan.md` Step 0.1, when a `STATE.md` exists, the resume comparison and the "Resume / Start fresh / Cancel" prompt are keyed on phase and TYPE (framework/app/plugin). Two different features that are both `update framework` are not distinguished by feature name/Target at this gate.

**(d) The `complete` + `update`/`add` path is defined to delete the existing specs.**
`commands/plan.md`, Phase-to-Stage Jump Table, exact text:
> | `complete` (VERB is `update` or `add`) | Back up `.planning/STATE.md` to `.planning/STATE.md.bak`. Delete `.planning/specs/*.md` files (preserve decisions.md, wipe `.planning/build/` contents). In the existing STATE.md, change only `## Phase:` to `none` — preserve all other headers unchanged. Do not rewrite the full file. Proceed as a new planning cycle for the given verb. |

At the moment the second plan ran, `STATE.md` was `Phase: complete` (from client-data) and the verb was `update` — i.e. this row's defined behavior is to delete the client-data specs and start a new cycle.

**(e) Build assumes a single specs set / one plan at a time.**
`commands/build.md` reads `.planning/specs/` and `.planning/STATE.md` and advances a single sequential `## Cycle:`. There is no plan queue or multi-feature selection; the model assumes a plan is built before the next plan is created.

**Net:** brainstorm allowed two unbuilt features to exist simultaneously; plan/build provide exactly one slot for plan state and specs; the `complete`+`update` transition is defined to clear that slot. The second plan therefore had no non-destructive built-in path, and the spec sets were reconciled manually.

---

## 5. Deviations from the plugin's defined flow that occurred this session

Recorded as fact, for completeness:

- The second brainstorm (client-data) was initiated conversationally inside the first session's context rather than as an independent `/moku:plan`/`/moku:brainstorm` invocation in a fresh context.
- At the collision (step 05:14), the agent did **not** execute the Jump Table's defined delete. It instead moved the client-data specs into `.planning/archive/client-data/` and planned web-parity into the slot, then — after user input — restored and merged. (The defined behavior would have deleted `.planning/specs/*.md`; the agent substituted an archive-and-merge sequence.)
- During investigation for this report, the agent's first draft asserted two "secondary defects" (an orphaned `.planning/.brainstorm-active` marker and a malformed `.planning/build` file). Both were then verified false (`.brainstorm-active` absent; `.planning/build` is a normal directory) and removed from this report.

---

## 6. Evidence pointers

- `.planning/context-web-parity.md` (03:58), `.planning/context-client-data.md` (04:47) — the two coexisting feature contexts.
- `.planning/archive/client-data/` — the client-data plan as it stood before the merge.
- `.planning/specs/` (8 files) + `.planning/skeleton-spec.md` + `.planning/STATE.md` (`Target: web (MERGED) …`) — the merged end state.
- `commands/brainstorm.md` — output model + Existing Context Guard + closing suggestion.
- `commands/plan.md` — Step 0.1 resume prompt; Phase-to-Stage Jump Table (`complete`+`update` row quoted in §4d); single `.planning/specs/`/`STATE.md`/`skeleton-spec.md`.
- `skills/moku-core/references/plan-templates.md` — STATE.md template (single plan; sequential `## Cycle:`; spec naming `NN-name.md`).
- `commands/build.md` — single-STATE, single-specs, sequential cycle.

---

## 7. Other defects observed this session (separate from the collision; candidates for a next patch)

Each verified against the plugin source. Stated as fact, no recommended fix.

### A. Researcher agents are instructed to write output files but have no Write tool
- `agents/brainstorm-researcher.md` frontmatter: `tools: ["Read", "Grep", "Glob", "WebSearch", "WebFetch"]` — no `Write`. Same for `agents/researcher.md`.
- `skills/moku-core/references/brainstorm-flow.md:395` instructs each researcher: "The output path: `.planning/brainstorm-{NAME}-research-{focus-slug}.md`."
- Consequence observed this session: every researcher returned findings as its final text message and wrote no file. The merge step's own guard (`brainstorm-flow.md:400`: "verify each researcher's output file exists … Do NOT attempt to read or merge missing files") then treats all of them as missing, so the parent agent had to capture findings from the returned text and assemble `.planning/brainstorm-{NAME}-research.md` by hand. The file-based parallel-research merge path is effectively never exercised; the text-return fallback always runs.

### B. `skeleton-spec.md` location is specified inconsistently across the plugin
- Authoritative references say `.planning/build/skeleton-spec.md`: `plan-templates.md:329` ("Save to `.planning/build/skeleton-spec.md`."), `plan-stages.md:414`, and the build reader `build-skeleton.md:15` ("Read `.planning/build/skeleton-spec.md`").
- One location says `.planning/skeleton-spec.md` (no `build/`): `commands/plan.md:417` (the `/goal` completion-condition line: "`.planning/skeleton-spec.md` exists …").
- Consequence observed this session: the skeleton was written to `.planning/skeleton-spec.md` (the non-authoritative path). Per `build-skeleton.md:15`, `/moku:build` reads `.planning/build/skeleton-spec.md`, so the build would not find the skeleton at the path it was written to. (Also: the plan-checker agent this session reported "skeleton-spec.md missing" because it looked under `.planning/specs/` — a third assumed location — which was a false positive but reflects the same path ambiguity.)

### C. The `--quick` auto-suggest (≤4 plugins) is unreachable for the `update` verb
- `commands/plan.md:43` defines the auto-suggest as running "after the plugin table is assembled, before the Stage 1 approval gate."
- `skills/moku-core/references/plan-verb-update.md` routes update flows to "proceed to Stage 2 directly (skip Stage 1)."
- Consequence: for `update framework`/`update plugin`/`update app`, Stage 1 is skipped, so the ≤4-plugin auto-suggest never fires. This session quick mode was offered manually by the agent, not by the defined auto-suggest.

### D. plan-checker BLOCKER triage did not gate the approval this session
- `plan-stages.md:255` defines: "If the plan-checker finds BLOCKER issues, use Interactive Triage to present each BLOCKER … Fix all 'Fix now' items before presenting the plan." `commands/plan.md:404`: "Run plan-checker agent BEFORE every user gate — users see validated plans only."
- Observed this session: across the two later plan runs, the plan-checker returned `FAIL` with BLOCKER findings (e.g. the `createStaticApp` plugin-removal blocker; the `HeadConfig` name-collision blocker; the `spa.dataDir`/`clientData.outputDir` path-domain blocker), and the approval gate was presented/accepted before those BLOCKERs were triaged; the agent then fixed them after approval. In quick mode the three per-stage gates collapse to one, but the "run plan-checker before the (single) gate and triage BLOCKERs first" rule still applies and was not followed in order. (This is partly an agent-execution deviation; recorded here as a fact alongside the structural items because it recurred.)

### Verified NOT defects (checked and ruled out)
- `--context` on `update`/`migrate` doing nothing but a warning (`plan.md:143`): this is the documented, intended pass-through behavior, not a defect.
- Brainstorm cleanup deleting research files the researchers never wrote: `brainstorm-flow.md:400` explicitly handles missing files ("Do NOT attempt to read or merge missing files"), so cleanup/merge is orphan-safe.
- Earlier-drafted "orphaned `.brainstorm-active`" and "malformed `.planning/build` file": both re-verified false (`.brainstorm-active` absent at report time; `.planning/build` is a normal directory).
