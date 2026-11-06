# The design check

The comparison of what was built against the approved prototype. It runs by itself at the end of every
UI unit (the builder runs it before its report, and its stop hook holds it to that), again at the end of
the build station, and in the e2e station (`moku-web:e2e`, `moku-game:playtest`), whenever a
`design-context.md` belongs to the change. Nobody has to ask for it. A build with a design context and no
passed design check is not finished.

It is a measurement, not an opinion, and the tool takes it: `moku-fidelity` (this pack's `bin/`). It
measures the same rows on every run, by the same tolerances. "Looks close" is not a result.

The prototype the person accepted is the reference, not a rigid contract. The build never leaves it
silently: what the project cannot or should not follow becomes a deviation, a question with a proposal,
raised before anything is chosen, and the person decides it.

## What is compared to what

| Side | Source |
|---|---|
| Expected | The approved prototype, `.planning/design/{slug}/index.html`, measured once into `check/expected.json` |
| Actual | The running build: the app in a browser, or the game page (its `game.ui` door) |
| Sizes | Every target size of §5 of `design-context.md`, each one measured: phone, tablet, desktop, or the game's frames with their safe areas |
| States | Every state the prototype can show (`?state=` in its URL), the same on the build |
| Conversion | Web × 1. A game: target units = prototype px × reference / frame width (1080 / 390 for a portrait frame) |
| Intended differences | `deviations.json` with a decision; §9 of the design context and `decisions.md` are entered there as decided deviations |

A generated image is on neither side. It is compared to nothing.

## Step 1 — capture the prototype once: the fixed inventory

`.planning/design/{slug}/spec.json` says what to measure:

```json
{ "schema": "moku-fidelity/spec@1",
  "prototype": "index.html",
  "conversion": { "unit": "px" },
  "sizes":  [{ "w": 390, "h": 844, "safe": { "top": 47, "bottom": 34 } }, { "w": 768, "h": 1024 }, { "w": 1440, "h": 900 }],
  "states": [{ "id": "default", "query": "" }, { "id": "misted", "query": "?state=misted" }],
  "elements": { "title": { "selector": "[data-check=\"title\"]" } } }
```

- `sizes` are the target sizes of §5, all of them. Sizes between targets may be added with `"target": false`.
- A game sets `"conversion": { "unit": "game", "reference": 1080 }`.
- `elements` is optional: without it every `[data-check]` element of the prototype is in the inventory.
  An element of the build is found by `elements.<id>.build` (`{ "selector": … }` on the web, `{ "game": { "key": … } }`
  or `{ "game": { "projection": …, "key": … } }` in a game), else by the same `data-check` id or ui key.
  The `build` side (elements and states) may be written after capture: it does not change the inventory.
- A prototype that shows its states as frames of one board page: give each state `"origin": "#f8"` (the
  frame's selector, its top-left is 0,0) and write element selectors with `{origin}` (`"{origin} .head h2"`).
- A state of the build that needs more than the URL: `"build": { "query": "…" }`, or in a game
  `"build": { "run": [{ "command": "restore", "input": { "bookmark": … } }] }` (door commands, run in order).

```bash
moku-fidelity capture .planning/design/{slug}
```

It measures the prototype at every size × state and fixes the inventory: one row per element ×
property × size × state. An element absent in a state keeps one row, `present`, that expects it absent.
Properties:

| Every element | A text element also |
|---|---|
| `present`, `position`, `size`, `drawn`, `fill`, `stroke`, `radius`, `shadow`, `opacity` | `words`, `font`, `font-size`, `line-height`, `letter-spacing`, `color` |

Page rows per size × state: `no-horizontal-scroll`, `text-not-clipped`, `no-new-overlaps`, and
`inside-safe-area` where the size has one. These are the adaptation rules.

`drawn` is what paints the element: the set of image, fill, gradient and stroke. A panel the prototype
draws as a fill with a rim, built as a sprite, fails `drawn`, `fill` and `stroke` even when its box is
exact. `line-height: normal` is measured on the face itself, never taken as 1.2 em.

The prototype does not change after capture, so the file is reused; `capture` keeps it unless the spec
changed or `--force` is given. The inventory never depends on the build or on who runs the check.

## Step 2 — measure the build and compare

```bash
moku-fidelity check .planning/design/{slug} --url http://localhost:5173/route --start "bun run dev"
moku-fidelity check .planning/design/{slug} --serve dist          # a static build
```

It measures the build on the inventory's rows at every size and state, compares, and writes
`check/actual.json`, `check/result.json` (every row) and `check/design-check.md` (the report). Exit 0 is
PASS. Lengths are compared in prototype px: the build's value divided by the conversion of its size,
unrounded.

| Property | pass | open (borderline) | fail |
|---|---|---|---|
| Position | ≤ 2 px | ≤ 4 px | more |
| Size, radius, shadow, stroke width, font size, line height | ≤ 1 px | ≤ 2 px | more |
| Letter spacing | ≤ 0.25 px | ≤ 0.5 px | more |
| Colour, fill, stroke colour | every channel ±1, alpha ±0.02 | — | else |
| Drawn, font family and weight, words, present | the same | — | else |

A borderline row is open, never a pass: the build is fixed, or the person decides it. A row nobody
measured (an element missing, a size skipped) is `unmeasured` and counts against the verdict too.

**Without playwright in the project** the tool says so (exit 3). Measure in the browser pane instead,
with the same probe:

```bash
moku-fidelity probe .planning/design/{slug} --side actual          # add --frame for a game in the editor
```

Paste the printed expression into `javascript_tool` at each size (`resize_window`) and state, save what it
returns to a file, and `moku-fidelity ingest .planning/design/{slug} --side actual --size 390x844 --state default --file probe.json`.
Then `moku-fidelity compare .planning/design/{slug}`. The prototype side is captured the same way with
`--side expected`.

## Step 3 — what cannot follow the prototype: ask before choosing

A face or weight the project does not have, an effect the engine or the performance budget forbids, a
rule of the project the prototype breaks, §9 of the design context saying one thing and the prototype
another: these are deviations. The one who meets it raises it **before** writing any replacement:

```bash
moku-fidelity deviate .planning/design/{slug} --element help --prop font --kind impossible \
  --reason "weight 800 is not among the vendored faces" --proposal "700, the heaviest vendored face" --by moku-builder
```

Kinds: `impossible`, `conflict`, `stale-context`, `unmeasurable`, `by-design-context`. The entry in
`deviations.json` carries the reason, the kind, the proposal, when it was asked, and the decision
(`null` while it waits). The builder then builds the proposal so the screen is whole, and its rows stay
open until the person answers. The orchestrator asks the person at once (the stop hook tells it), not at
the end of the build, and records the answer:

```bash
moku-fidelity decide .planning/design/{slug} D1 --answer accept --words "700 is fine"
```

An accepted deviation turns its rows into rows by decision. A rejected one leaves them as measured: the
build follows the prototype or a new proposal is raised. §9 and `decisions.md` entries that name the
design are entered once as `by-design-context` deviations with their decision already written.

Never move the prototype, never widen a tolerance, and never mark a row decided on your own.

## Step 4 — fix, then check again

A failing row is a defect of the build. Fix the source, run `check` again. At most **two rounds** after
the builder's own; then list what is still open and ask the person. Do not start a third round alone.

Then look at the **Look at these pairs** list of the report: elements whose pixels differ most while all
their rows pass. It is a diagnostic, never a verdict: open both shots, and a difference the eye sees is a
finding (name the property and fix it, or raise a deviation).

## Fonts first, and text is text

Fonts are read first, because a wrong face changes every other number.

1. Every face of the **Typography** table in §2 is in the build as a font file with its licence. A face
   that did not load is a `font` fail (`(fallback!)`), not a near match.
2. Every locale the design context plans has its glyphs in the font. A face without them is reported
   with the locale it fails.

Words on the screen are drawn by a font from the string table. They are never baked into an image, a
sprite or an atlas: a baked word cannot be translated, resized or read by a screen reader. Every word of
§8 "Copy" is a live text element (a DOM text node; a text element of the game's `ui` door), so it has a
`words` row. The one exception is lettering that is art, listed by name in the **Lettering as art** line
of §2. An effect on text (a lip, a shadow, an outline, a gradient) is built with the text style.

## The report

`check/design-check.md`, rewritten by every `compare`:

```markdown
# Design check — {slug} — {date}
Verdict: FAIL    Rows: 1161    Pass: 1150    By decision: 6    Open: 2    Fail: 3    Unmeasured: 0
Prototype: index.html    Sizes: 390x844, 768x1024, 1440x900    States: default    Conversion: × 1
Waiting on the person: 1 deviation(s)

## Questions for the person
## Fonts · ## Fail · ## Open · ## Unmeasured · ## By decision
## Look at these pairs (pixel diff, a diagnostic)
```

The rails read the `Verdict:` line: it starts a line of its own, exactly `Verdict: PASS` or
`Verdict: FAIL`. PASS needs no failing, open or unmeasured row, every target size measured, and no
deviation waiting on the person. For a change that follows this design, `moku-rails done build` and
`moku-rails done e2e` are refused while the report is missing or says FAIL. Only the person lifts that, in
their own words: `moku-rails done build --no-design-check "<their words>"`. Never pass that flag on your own.

Show the person the verdict line, the questions, the open rows and the pairs of shots; the full table stays
in `check/result.json`.
