# The design check

The comparison of what was built against the approved prototype. It runs by itself at the end of the
build station and again in the e2e station (`moku-web:e2e`, `moku-game:playtest`), whenever a
`design-context.md` belongs to the change. Nobody has to ask for it. A build with a design context and
no passed design check is not finished.

It is a measurement, not an opinion. "Looks close" is not a result: the result is a table of numbers.

## What is compared to what

| Side | Source |
|---|---|
| Expected | The approved prototype: `.planning/design/{slug}/index.html` and `styles.scss`, at the frame of the **Measurement reference** table in §5 of `design-context.md` |
| Actual | The running build: the app in a real browser, or the game in the editor |
| Conversion | The **Conversion** line of the same table (`× 1` for web, `× 1080 / 390` for a portrait game) |
| Scope | Every row of the §6 inventory, tables A to G, in every state §6 names |
| Intended differences | §9 "What differs from the decided design", and the entries of `.planning/decisions.md` that name the design |

A generated image is on neither side. It is compared to nothing.

## Step 1 — measure the prototype

Serve `.planning/design/{slug}/` and open `index.html` in the browser pane at the prototype frame. For
each inventory row bring the screen into the state the row names, take one screenshot, and read the
numbers from the DOM with one script: `getBoundingClientRect()` and `getComputedStyle()` of the element.

Per element: `x`, `y`, `width`, `height`, `border-radius`, `box-shadow`, `background-color`.
Per text element also: `font-family`, `font-weight`, `font-size`, `line-height`, `letter-spacing`,
`color`, `text-shadow`, `text-align`, and the words.

Write them to `.planning/design/{slug}/check/expected.json`, the shots to `check/expected/<row>.png`.
The prototype does not change after capture, so measure it once and reuse the file in later runs.

## Step 2 — measure the build

The same rows, the same states, the same frame, the same demo data (§8).

- **Web.** The running app in the browser pane, the same script, the app's own elements.
- **Game.** The game in the editor. Bounds in reference units come from the element card or from
  `capture { legend: true }`; the text style of an element comes from its card and its
  `defineTextStyles` entry. How to read them: `moku-game:playtest` → "The design check".

Write them to `check/actual.json`, the shots to `check/actual/<row>.png`.

## Step 3 — compare

One row per element and property. Expected is the prototype value times the conversion.

| Property | Passes when |
|---|---|
| Position (`x`, `y`) | within 2 prototype px, converted |
| Size, gap, radius, shadow offset and blur | within 1 prototype px, converted |
| Colour | the same value |
| Font family and weight | exactly the same face and weight |
| Font size, line height, letter spacing | within 1 prototype px, converted |
| Words | the same string, from the string table |
| Present | the element exists in the state the inventory names |

Then look at each pair of shots side by side, expected next to actual. A difference the eye sees and the
table missed is a finding too: add the missing property to the table and measure it.

## Fonts first

Fonts are the first block of the report, before layout, because a wrong face changes every other number.

1. Every face of the **Typography** table in §2 is in the build as a font file with its licence. A
   fallback face that rendered because the real one did not load is a FAIL, not a near match.
2. Family and weight of every text element equal the prototype's. Size, line height and letter spacing
   pass the table above.
3. Every locale the design context plans has its glyphs in the font. A face without them is reported
   with the locale it fails.

## Text is text

Words on the screen are drawn by a font from the string table. They are never baked into an image, a
sprite or an atlas, because a baked word cannot be translated, resized or read by a screen reader.

- Check: every word of §8 "Copy" is found as live text in the build (a DOM text node; a text element of
  the game's `ui` door). A word that exists only as pixels is a FAIL.
- The one exception is lettering that is art: a logo or a hand-drawn title, listed by name in the
  **Lettering as art** line of §2. Anything not on that line is text.
- An effect on text (a lip, a shadow, an outline, a gradient) is built with the text style, not by
  drawing the word into the art.

## Step 4 — fix, then check again

A row that fails is a defect of the build. Fix the source, measure the touched rows again, re-shoot.
At most **two rounds**. After two rounds list what is still open and ask the person; do not start a
third round alone, and do not call the check passed.

A row is not a defect in two cases, and both are written into the report with the source:

- **By decision.** §9 or an entry of `decisions.md` says the build differs on purpose.
- **Not measurable.** The prototype does not hold the value. Ask; never guess and never take it from an image.

Never move the prototype, and never widen a tolerance, to clear a row.

## The report

`.planning/design/{slug}/check/design-check.md`, rewritten on every run:

```markdown
# Design check — {slug} — {date}
Verdict: PASS | FAIL    Rows: {n}    Pass: {n}    By decision: {n}    Open: {n}
Prototype: .planning/design/{slug}/index.html    Frame: 390×693    Conversion: × 1080 / 390

## Fonts
| Element | Expected | Actual | Result |
|---|---|---|---|
| Title | Fredoka 700, 58 px → 161 | Fredoka 700, 161 | pass |

## Text is text
| Words | Drawn by | Result |
|---|---|---|
| Play again | font `ui.font-body` | pass |

## Layout
| Row | Element | Property | Expected | Actual | Result |
|---|---|---|---|---|---|
| A3 | tray | x, y | 41, 194 → 114, 537 | 114, 537 | pass |

## Shots
| Row | Expected | Actual |
|---|---|---|
| A3 | check/expected/a3-board.png | check/actual/a3-board.png |
```

`Verdict: PASS` needs zero open rows. Show the person the verdict line, the open rows and the pairs of
shots; the full table stays in the file.
