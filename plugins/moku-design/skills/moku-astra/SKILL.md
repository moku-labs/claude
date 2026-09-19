---
name: moku-astra
description: How to use Astra (GPT-6 Astra through the Codex CLI) as a second, independent opinion on user experience and as the artist for image assets. Covers the moku-astra CLI, when a second opinion is worth its cost, the triage protocol for her findings, the fallback when she is unavailable, and the art backends. Use it before calling moku-astra, and whenever someone asks what Astra is for or asks her to review code.
when_to_use: A design round or e2e run needs a second UX opinion, a design needs real image assets, or someone proposes sending code to Astra or Codex for review.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
model: fable
effort: medium
---

# Astra

Astra is GPT-6 Astra, reached through the Codex CLI by `${CLAUDE_PLUGIN_ROOT}/bin/moku-astra`. She has two
jobs in moku: a second, independent opinion on user experience, and the artist who draws image assets.

She is not a taste oracle. Her findings are input to a triage step, not a verdict, and a rejected finding
costs nothing as long as the reason is written down.

She does not review code. A published comparison measured Codex reviewing Claude's code and the pass rate
dropped from 91.4% to 82.8%, so code correctness stays with `moku-code-reviewer` and the moku validators.
When someone asks for a code review from Astra, say that and offer the Claude reviewer instead.

## When to call, when not

| Call her | Skip her |
|---|---|
| Design round review: screenshots of concept prototypes | Code correctness, types, tests, security |
| Asset generation: icons, illustrations, textures for a winner | Architecture, specs, plans, API shape |
| E2E UX gate after functional green, desktop and mobile | Packages with no user-visible surface |
| Design-fidelity check of a build against `design-context.md` | Every build wave — the gate is per station, not per wave |
| Pre-release UX assessment of the whole app | Small non-visual fixes, copy typos, config edits |

The user option `astra` turns her off entirely. Read it before calling: when it is off, take the fallback
path below.

## The CLI

```bash
moku-astra review   --images a.png,b.png [--context design-context.md] [--focus "checkout on mobile"] [--out findings.json]
moku-astra generate --brief "6 habit icons, flat, 2px stroke" [--out assets/icons] [--size 1024x1024] [--transparent]
moku-astra edit     --images assets/icons/flame.png --instruction "match the stroke weight of the set" [--out dir]
moku-astra probe
```

Defaults: `review` writes `.planning/astra/findings.json`, `generate` writes into `assets/generated` plus
`manifest.json` there, `edit` writes next to the original with a `-v2` suffix plus `manifest-edit.json`,
`probe` writes `.planning/astra/probe.txt`. Every mode prints the output path on success.

Exit codes: `0` done, `1` usage error (fix the flags and retry), `3` Astra unavailable for any reason —
not installed, not logged in, timed out, no output file. Treat `3` as one condition with one fallback.
`4` is a partial success of `generate` or `edit`: images were written but the manifest is missing. Keep
the files, which are listed on stderr, and write the manifest by hand.

## The findings schema

`review` answers against `schemas/visual-findings.json`: a `summary` of two sentences, then `findings`,
each with `screen` (the screenshot file), `region` (where, in words), `severity` (`blocker` | `major` |
`minor`), `category` (`layout`, `hierarchy`, `readability`, `consistency`, `interaction`, `responsive`,
`accessibility`, `design-fidelity`), `problem` stated as an observation, and one concrete `suggestion`.

An empty `findings` array is a valid answer.

The same schema is what the e2e station reviews against. There the screenshots come from the ux-reviewer
at `.planning/e2e/shots/<screen>-<desktop|mobile>.png`, so `screen` in a finding is that file name and
the desktop and mobile passes stay distinguishable in one merged list.

## Triage

Fable triages every finding, hers and its own, with four questions:

1. Is it reproducible in the browser right now?
2. Is it consistent with `design-context.md`?
3. Is it consistent with the moku-web rules?
4. Is the fix worth its cost in this change?

A finding that clears all four becomes work. A finding that fails any of them is rejected, and the
rejection is written into `.planning/astra/triage.md` with the reason, so no override is silent:

```markdown
## Round 2 — 2026-09-19
| Finding | Source | Decision | Reason |
|---|---|---|---|
| Card titles clip at 320px | astra | accepted | Reproduced at 320px in the preview |
| Warmer accent colour | astra | rejected | Taste, and design-context.md fixes the accent |
| Filter chips lack focus ring | fable | accepted | Accessibility, cheap fix |
```

At most two review passes per round. If the second pass still disagrees, take the open items to the
human with the gallery instead of running a third.

## Fallback

Exit 3, or the `astra` option off, means Fable reviews alone against the same findings schema. The report
names the reviewer, and the gate is never skipped — a missing second opinion is not a missing review.

Images have no fallback. When generation is unavailable, put SVG or CSS placeholders in the prototype and
write a to-draw list into the asset manifest, so the gap is visible instead of quietly missing.

## Art backends

`codex` is the default because it runs on the user's ChatGPT plan. `api` is the OpenAI Images API and
bills per image; it is used only when the user set the `art_backend` option to `api`. Read
`CLAUDE_PLUGIN_OPTION_ART_BACKEND` to find out which is active.

```bash
test "${CLAUDE_PLUGIN_OPTION_ART_BACKEND:-codex}" = "api" && echo api || echo codex
```

For `api`, the key comes only from the `OPENAI_API_KEY` environment variable. It is never written into a
file, a manifest, a prompt or a commit. See `references/images-api.md` for the request shape.

The plugin never switches to the paid backend on its own. When `codex` fails and `api` would work, stop,
name the reason and the price, and wait for the user to decide.

## Cost

Image turns burn Codex plan limits three to five times faster than text turns, and an image-input review
measured about 16k tokens against about 3.5k for a text-only one. So asset generation is an explicit,
separate step the user agrees to — one batched `generate` call for the whole set, never one call per icon,
and never folded silently into a polish pass.

## The asset manifest

Generated art lives under `assets/**/` with a `manifest.json` beside it, matching
`schemas/asset-manifest.json`: for each asset the `file`, the exact `prompt`, the `size` and whether the
background was `transparent`. That schema is what Astra answers against. The wrapper then stamps a
`generated` block with `model`, `backend` and `date` into the file, because the four schema fields alone
do not say what drew the asset or when. When you write a manifest by hand (exit 4, or the `api`
backend), add the same `generated` block. Image paths passed to `--images` must not contain commas:
the list is comma-separated.

## Gotchas

- `-i` in `codex exec` is greedy and swallows the prompt. `lib/astra/codex-args.mjs` puts `--` between the
  image list and the prompt; keep that shape if you ever build the arguments by hand.
- stdin must be closed. An open stdin makes `codex exec` wait for a prompt forever, which is why the
  wrapper spawns with `stdio: ["ignore", ...]`.
- Screenshots must show real application state. A blank page, a loading skeleton or a 404 produces
  confident findings about nothing. Check each screenshot before sending it.
- `review` runs in a read-only sandbox, `generate` and `edit` in a workspace-write one. Point `--out` at a
  directory inside the repository or the write is refused.
