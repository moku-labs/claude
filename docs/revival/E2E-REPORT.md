# E2E report: moku plugin 0.70.0, building the moku website

**Verdict in one sentence: yes, a person who knows no command got a real, good site built, but most of it was built outside the lifecycle: the conductor ran once in 18 turns, brainstorm never ran, builder agents never ran, and design and e2e ran only after the user used the right word.**

Run date: 2026-09-19. Plugin commit `e1826e6` on `revival`. One child session, `b65bd3fe-bb89-448d-9022-1d101a7fd720`.
Logs: `docs/revival/e2e-logs/NN-name.json`, the user message of each turn in `NN-name.prompt.txt`.
Tool calls per turn come from the session transcript `~/.claude/projects/*/b65bd3fe-….jsonl`.

## Deviations from the brief

| What | Fact |
|---|---|
| `<moku>/assets` | Does not exist. No logo files anywhere on disk, no `assets` repo on GitHub. `--add-dir` for it was dropped. |
| Palette in the brief | Wrong. Alex corrected it during the run with `/Users/moku/Downloads/index.html`: ink `#0a0b12`, pink `#ff2e63`, lavender `#cfc9ec`, iso cube logo. Sent to the child as turn 3. |
| Old plugin | `moku@moku` is installed as 0.70.0 at the same commit, not 0.62.4. Left enabled. Skills loaded once, no duplicates (`00-preflight-skills.json`). |
| Turn order | Alex said "go" in turn 2, so build came before brainstorm and design. Alex then asked to add "discuss the idea" and "draw it, add graphics" as later turns. |
| Forbidden shortcut | Not tried as written. The child offered the shortcut itself in turn 1 ("say `go`"). See finding 1. |
| Account limit | Turn 14 died on the Claude session limit at 11:26, resumed 14:30 (`14a-session-limit.json`). Not a plugin fault. |
| Alex's global `CLAUDE.md` | Loaded in the child. It made verify report-only and shaped every reply as issue plus fix. |

## Numbers

| Station | Calls | Cost USD | Minutes | Result |
|---|---|---|---|---|
| Preflight skill probe | 1 | 0.23 | 0.1 | 23 skills visible |
| Intake, first reply (01) | 1 | 0.73 | 0.7 | Good answer, no conductor, no rails |
| init + plan + build (02) | 1 | 17.06 | 20.2 | Site built, 34 tests green. Design skipped by the child. No builders. |
| Rebrand (03) | 1 | 8.71 | 6.4 | Done, no skill, no rails call |
| Brainstorm (04) | 1 | 0.38 | 0.4 | Good ideas, `moku:brainstorm` not run, no challenger |
| Design + Astra (05) | 1 | 6.05 | 5.0 | Worked: concept, 2 images, Astra review, triage |
| Plan + build, second pass (06) | 1 | 16.07 | 15.7 | Built, 67 tests. Only `moku-plan-checker` ran. No `moku:build`, no builders. |
| Verify (07, 08, 09) | 3 | 29.85 | 21.8 | Worked well: 5 validators, 2 skeptics, 3 cycles, PASS |
| Manual browser check (10) | 1 | 4.75 | 4.8 | Useful, but `moku-web:e2e` not run |
| E2E station (11, 12, 13) | 3 | 42.53 | 74.9 | Worked, but call 12 hung and was killed at 45 min |
| Fixes + commit + close (14a, 14) | 2 | 5.78 | 7.0 | Closed on the rails, 3 local commits, archive written |
| Size S fix (15) | 1 | 1.04 | 2.5 | Write gate refused, child opened an S change, fixed, closed |
| Status (16) | 1 | 0.15 | 0.2 | Correct answer |
| Clean (17, 18) | 2 | 1.77 | 0.8 | Cleaned after one confirmation |
| **Total** | **20** | **135.10** | **160.5** | |

Cost is the delta of `total_cost_usd`, which is cumulative per session. Call 12 has no JSON. Its cost is inside the delta of call 13.

## What the user was asked

| # | Station | Question or proposal | Clear? | Needed? |
|---|---|---|---|---|
| 1 | intake | "`../assets` does not exist. Where are the logos? Or take `blog/public/favicon.svg` and `BRAND_PINK`." | yes | yes |
| 2 | intake | "Build on `@moku-labs/web` like `blog`?" | yes | yes |
| 3 | intake | "Say `go`, or `design first`." | yes | no. Design should not be an option next to go. |
| 4 | build | "Say `apply 2 3 commit`" for `ci.yml` and lefthook | yes | yes |
| 5 | rebrand | "Site is dark only now. Need light mode?" | yes | yes |
| 6 | brainstorm | "Say the numbers, for example `1 4 5`." | yes | yes |
| 7 | brainstorm | "Is the deck also a source of facts?" for the family map | yes | yes |
| 8 | design | "Say `ok`, or tell me what to change in the mockup." | yes | yes |
| 9 | verify | "Say `apply 1 2 3 4 5 6 7 8`" | yes | yes |
| 10 | verify | "Say `apply 1`" for a new finding not on the approved list | yes | yes |
| 11 | verify | "Say `e2e`, or `apply ci lefthook commit`." | yes | the word `e2e` is a station name given to the user |
| 12 | e2e | "Say `apply 1 2 3`. Want issues in `moku-labs/web`?" | yes | yes |
| 13 | e2e | "Faint text `#5f5e78` fails AA. It is your brand colour. You decide." | yes | yes |
| 14 | close | "Run the lefthook command yourself or say `разреши lefthook`." Repeated in 5 turns. | yes | once was enough |
| 15 | clean | "`.planning/` needs your yes. Say `clean planning`." It also showed `/moku:clean`. | yes | the slash command was not needed |

No long questionnaire at any point. No question came back three times except the lefthook reminder.

## Rails

| # | What the user tried | What the rails said | Did the plugin lead the user out? |
|---|---|---|---|
| 1 | "go" before any plan (02) | Nothing refused. Child ran init, opened an M change, `skip design`, plan, build by itself. | yes, but it skipped design on its own |
| 2 | Rebrand and second build pass (03, 06) | Nothing. The change sat inside `build` since turn 2, so every write to `src/` passed. | not needed. This is the hole, see finding 2. |
| 3 | Small fix with no open change (15) | `pre-write.mjs`: "No open change is at a writing station (build, verify, e2e). Open a change with `moku-rails open`…" | yes. Child opened `2026-09-19-hero-cta` size S, entered build, fixed, closed. The user saw nothing. |
| 4 | Close (14) | `done e2e`, `skip release --reason "app, no package release"`, `check tests`, `check verify`, `check docs`, `close` all passed | yes |
| 5 | Pause | Used correctly twice: `pause --reason "e2e functional: 5 defects reported to Alex…"` (11) and before the hang (12) | yes |

The write gate was never seen refusing a new user. The "confused user" script was not needed once.

## Astra

Backend: `codex` 0.155.0. `moku-astra probe` passed (05). No fallback was tested.

| Station | Finding | Accepted or rejected by Fable | Reason |
|---|---|---|---|
| design | Mobile header nav collides with logo | accepted, narrowed | Prototype header only. Rule: hide the `llms.txt` pill below 520px |
| design | Terminal title and counter wrap on mobile | accepted | Reproduced at 375px |
| design | Hero art is an unreadable strip on mobile | accepted, changed | Reproduced. Art goes above the headline instead of being hidden |
| e2e | Faint text `#5f5e78` is 2.8–3.1:1, below AA | accepted, passed to Alex | Measured. Brand colour, so the user decides |
| e2e | Mobile hero art pushes terminal and buttons below the fold | accepted | Reproduced on Pixel 7 |
| e2e | Mobile 404 art takes half the screen | accepted | Reproduced |
| e2e | Docs `api` card breaks `app.` / `<name>` | accepted | Reproduced on iPhone |

No Astra finding was rejected. Source: `.planning/astra/triage.md` as printed in turn 13. The file itself was deleted by clean, see finding 7.

| Image | Prompt summary | Used on the site? |
|---|---|---|
| `hero-kernel.png` | Three-layer pyramid under a pink dome, yellow slop cubes bouncing off | yes, hero, as 51 KB webp |
| `lost-cube.png` | Lavender cube on a grid, dotted path to nowhere | yes, 404 page |

## Findings

**1. The conductor does not run on most turns**

Issue: `moku:moku` was invoked once in 18 turns (02, call 17). Turn 1 answered with no `moku-rails status` and offered "say `go`" to scaffold with no plan (`01-first.json`). The rule "every turn starts the same way" lives only in skill text, and the skill is not loaded.

Fix:
```jsonc
// now: plugins/moku/hooks/hooks.json has no UserPromptSubmit entry
// fix
"UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/prompt-rails.mjs" }] }]
// prompt-rails.mjs prints `moku-rails status` plus one line:
// "This is a moku project. Route this request through the moku:moku skill before acting."
```

---

**2. An open change inside `build` is a free pass for any later work**

Issue: the first change stayed in station `build` from turn 2. Turns 03 and 06 rewrote the brand and added three features with no plan station, no `moku:build`, no rails call. The write gate only asks "is a change at a writing station". Proof: tool lists of `03-brand-fix` and `06-plan-build` have zero `moku-rails` calls.

Fix:
```md
// now: plugins/moku/skills/moku/SKILL.md
| A fix, tweak, feature or refactor | Look at the code briefly, pick type and size, open a change. |
// fix
| A fix, tweak, feature or refactor | Look at the code briefly, pick type and size, open a change. A new request while a change is open is a new change or a recorded scope change: `moku-rails scope "<text>"` sends the open change back to plan. |
```

---

**3. Builder agents never ran. Fable wrote all the code.**

Issue: `moku:build` was called with "one orchestrator-executed wave (no custom plugins)" (02, call 93). No `moku-builder`, no `moku-code-reviewer` in the whole run. Two build turns cost 33 USD on the Fable session. A Layer-3 app with islands and no custom plugins gives the build skill nothing to hand to a builder.

Fix:
```md
// now: plugins/moku/skills/moku-core/references/build-app.md has no unit of work for an app without plugins
// fix
An app with no custom plugins still builds through builders. The unit is one island or one page
with its components and tests. Spawn `moku:moku-builder` per unit, then `moku:moku-code-reviewer` on the wave diff.
```

---

**4. The e2e call hung until the 45 minute kill**

Issue: `moku-web-ux-reviewer` stopped mid capture. The session sent it `SendMessage`, ran `moku-rails pause`, and waited for a reply that never came in headless mode (`12-e2e-continue.err`: "KILLED after 45 min"). On the next turn the child finished the gate itself in 4.5 minutes.

Fix:
```md
// now: plugins/moku-web/skills/e2e/SKILL.md, UX gate step: spawn the ux-reviewer and wait for its report
// fix
Run the ux-reviewer in the foreground. If it returns without a complete capture, do not message it
and wait. Finish the capture yourself and continue to the review.
```

---

**5. Brainstorm did not trigger on "let's discuss the idea"**

Issue: turn 04 answered in one model turn with zero tool calls. No `moku:brainstorm`, no challenger, no context file. The ideas were good, but the station was not tested at all. Same root cause as finding 1. Also the first change was size M, and only size L has brainstorm in its route.

Fix:
```md
// now: plugins/moku/skills/moku/SKILL.md
4. Open the first change, size M or L, type `project`
// fix
4. Open the first change, size L, type `project`
```

---

**6. The child skipped design for a UI project by itself**

Issue: `moku-rails skip design --reason "Alex chose go over design-first; direction agreed in chat"` (02, call 62). The first build looked bad, in Alex's words. Design ran only in turn 05 after the user asked to "draw it". The child also took "go" as approval of a spec the user never saw.

Fix:
```md
// now: plugins/moku/skills/moku/SKILL.md
`brainstorm`, `design`, `e2e` and `release` are optional.
// fix
`brainstorm`, `design`, `e2e` and `release` are optional. A change with UI skips design or e2e only
when the person says so. A yes given before the spec exists does not approve the spec: show its summary and wait.
```

---

**7. Clean deleted the Astra triage record and the design spec with no copy**

Issue: `rm -rf STATE.md app-spec.md astra build design e2e changes` (18, call 643). `DECISIONS.md` §7 says rejections are written down. After clean they are gone: `triage.md`, `concept-spec.md`, the art originals and the prompt manifest in `.planning/design/site-fun/assets/`.

Fix:
```md
// now: plugins/moku/skills/clean/SKILL.md treats `astra/` and `design/` as ephemeral
// fix
Before removal, move `astra/triage.md`, `design/*/concept-spec.md` and `design/*/assets/manifest.json`
to `.planning/archive/`. Only screenshots, prototypes and scripts are ephemeral.
```

---

**8. "Check it in the browser, and on a phone" did not start the e2e station**

Issue: turn 10 wrote its own Playwright script. No `moku-web:e2e`, no agents, no Astra gate, no `moku-rails enter e2e`. The station ran in turn 11 only because the user said `e2e`, a word the child had taught them in turn 09.

Fix:
```md
// now: plugins/moku-web/skills/e2e/SKILL.md description (not verified word by word)
// fix: add the plain phrases to `description`
Use when someone asks to check the app in a browser, on a phone or on mobile, to click through it, or to test how it looks.
```

---

**9. Init copies a worker `ci.yml` into a static site**

Issue: `cp node_modules/@moku-labs/ci/examples/app/ci.yml` (02, call 55). The file calls `build:worker` and `migrate:remote`, which the site does not have. The child found it itself and fixed it in turn 14 after asking.

Fix:
```md
// now: plugins/moku/skills/init/SKILL.md copies `examples/app/ci.yml` as is
// fix
After copying, remove `build_worker_script` and `migrate_script` when package.json has no such scripts.
```

---

**10. `MAX_PARALLEL_AGENTS=2` was ignored**

Issue: verify spawned 5 validators in one message three times (07 calls 401–405, 08 calls 460–464). Whether they ran at once or in pairs: not verified.

Fix:
```md
// now: plugins/moku/skills/verify/SKILL.md fans out all validators
// fix
Read `CLAUDE_PLUGIN_OPTION_MAX_PARALLEL_AGENTS`. Spawn validators in batches of that size.
```

---

**11. Small things**

- The child offered slash commands and station names to the user: `e2e` (09), `/moku:clean` (17).
- `moku-astra` is called by absolute path to the plugin `bin/`, not by name (05, call 275). It works, but only with `--plugin-dir`.
- `lefthook.yml` could not be written in headless mode: permission denial on a sensitive file (02, 14). Environment, not plugin. The reminder came back in 5 turns.
- The S change `2026-09-19-hero-cta` has no folder and no `outcome.md` in the archive (18).
- `check verify` passed for the S change with no verify station run in that change (15, call 634). Whether the rails accept this by design: not verified.
- The child wrote to its own auto-memory outside `<moku>/site` (03). Harness feature, not plugin.

## What worked well

- Verify is the best station. 5 validators, 2 skeptics per finding, one finding dropped with a cited reason, fix cycles until PASS, and it refused to touch a finding that was not on the approved list (08).
- Design plus Astra worked end to end without the user naming Astra. Images are on brand and are used.
- E2E produced 13 spec files, 273 passing tests on three profiles, 30 visual baselines, and found 3 real bugs in `@moku-labs/web` 2.3.1: lost `#hash` on SPA navigation, stale canonical and meta after navigation, no reload on a 404 address. They are only recorded in `.planning/decisions.md`.
- Close, archive, the S route and the write gate refusal worked exactly as designed.
- Nothing was pushed. `git remote -v` in `<moku>/site` is empty. No other repo was written to.

## The result

Checked by the operator after the run, in `/Users/moku/projects/moku/site`, at commit `1063055`.

| Check in <moku>/site | Result |
|---|---|
| `bun run typecheck` | pass |
| `bun run lint` | pass, 73 files |
| `bun run test` | pass, 71 of 71 |
| `bun run build` | pass, 2 pages, `dist/` 912 KB |
| `bun run test:e2e` | not run by the operator. Child reported 273 passed, 26 skipped, 0 failed (15). |
| `/` opens | 200 |
| `/docs/plugins/` opens | 200 |
| unknown address | 404 with the site shell |
| Console errors | none except the expected 404 resource on the 404 page |
| Git | 4 local commits, no remote, `lefthook.yml` untracked |

Screenshots: `docs/revival/e2e-logs/shots/desktop-home.png`, `desktop-docs.png`, `desktop-404.png`, `mobile-home.png`, `mobile-docs.png`, `mobile-404.png`.

Good: the site looks like the deck, the hero terminal and Kernel Bouncer are funny and use real kernel error texts, the copy is short.
Good: facts match the READMEs. The child caught one contradiction in `web/llms.txt` line 12 by itself.
Embarrassing: the first build in turn 2 had no design pass and used the wrong palette from the brief.
Embarrassing: the docs page is TS data, not Markdown, so the next docs page needs code.
Embarrassing: no pre-commit hooks, and the vendored `public/llms.txt` must be updated by hand.

Next: Alex should fix finding 1 first. A `UserPromptSubmit` hook that puts the rails status and the conductor in front of every turn removes findings 2, 5 and 8 at the same time. Then finding 3, because it is where the money went.
