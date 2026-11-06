# Motion, states and sizes — part of every concept

Motion and effects are part of the design, not a polish item someone remembers later. A design that leaves
them out comes back as "flat" and "there are no animations at all". In the logs, 10 of 27 complaints about
built screens were about motion or states, and no design context had a full motion table: the median one
named 3 of the 8 things a builder needs.

So every concept, from the first round, carries three things beside its look:

1. **A motion table** with eight columns in every row, and the motion playing live in the prototype.
2. **States as addressable frames**: every screen, popup and state of the spec opens by `?state=`.
3. **Target sizes** that open by `?vp=`, with the rules for the sizes between them.

All three live in one JSON block inside the prototype, written by the generator before the code, and
checked by `moku-proto-check`. The person picks a concept with its motion already moving.

## 1. The motion table

One row per animation or effect. The eight columns are the measure; `id`, `kind`, `element` and `state`
sit beside them.

| Column | What it holds | Example |
|---|---|---|
| `trigger` | The event that starts it | `tap Claim`, `popup opens`, `score changes`, `page load` |
| `duration` | Milliseconds, or a range for a family | `320ms`; `loop 2.4s` for an idle |
| `delay` | Delay or stagger, or the order in a group | `0`; `40ms per coin`; `120ms after backdrop` |
| `curve` | A named easing or the four cubic-bezier numbers; a spring with its numbers | `cubic-bezier(.34,1.56,.64,1)`; `spring 300/20` |
| `keys` | Each property: from → peak → to, with the moment of the peak | `scale .6 → 1.08 @60% → 1; opacity 0 → 1` |
| `sequence` | How it joins the others: after, together with, interrupts | `after popup-in; with coins-burst` |
| `sound` | The asset key and its moment, or `none` | `sfx.reward-chime @0ms`; `none` |
| `reduced` | What it becomes under reduced motion | `fade 120ms, no scale`; `none: instant` |

- `id` — a short name, also the `?play=` value: `reward-in`.
- `kind` — the required event it covers (§2): `reward`, `popup-in`, `hover`.
- `element` — the inventory row it moves: `E2.reward-popup`, `A1.coin`.
- `state` — the `?state=` it plays from, when it is not the default.

`none` is a value: it says on purpose that there is no sound or no reduced variant. An empty cell, `—` or
`TBD` is a gap. Write numbers, not adjectives: "bouncy" is the motion character (§3), the row says
`cubic-bezier(.34,1.56,.64,1)`, `scale 1 → 1.12 @40% → 1`.

## 2. The events every concept covers

Each event below gets at least one row, or a line in `noMotion` with the reason (`"idle": "a still board is
the point"`). A row "without animation" is allowed only when it is written down.

**Game — in detail.** Games live on motion; each of these is designed, timed and sequenced:

| `kind` | What to design |
|---|---|
| `screen-in`, `screen-out` | How each screen appears and leaves: what moves first, what follows |
| `popup-in`, `popup-out` | Backdrop, the panel's entrance and exit, the order of its contents |
| `transition` | Screen to screen, level to level: the hand-off between the two |
| `press` | Press and release of every button kind: squash, depth, colour, sound |
| `hover` | Pointer hover where the game runs on desktop; `noMotion` with the reason on touch only |
| `disabled` | A tap on a disabled control: the refusal (shake, dim pulse) |
| `reward` | The reward moment: coins or items flying, the counter they land in, the chime |
| `win` | Victory: the build-up, the peak, what stays on screen |
| `error` | A wrong move or a failed action: shake, flash, sound |
| `particles` | Each effect: count, lifetime, spread, colour over life, what emits it |
| `idle` | What breathes while nothing happens: glow, bob, shimmer, and its loop |
| `counter` | Numbers that change: roll, tick, scale pop, the speed of counting |
| `loading` | Loading and progress: the bar or spinner, how it ends and hands over |

**Web — shorter.** The same eight columns, fewer events:

| `kind` | What to design |
|---|---|
| `page-transition` | Route to route |
| `state-change` | A view changing state in place: tab, filter, expand, empty to full |
| `reveal` | Blocks appearing on load or on scroll |
| `hover`, `focus`, `press` | The three pointer and keyboard states of controls |
| `menu`, `modal` | Menus, drawers and modals: open and close |
| `loading` | Loading, skeletons, progress |

`prefers-reduced-motion` is the `reduced` column of every row, not a row of its own.

## 3. The motion character — part of the art direction

Each concept's art direction carries a **motion character** and a **signature moment**, as distinct as its
palette:

- motion character, in numbers: "springy, 6 % overshoot, 180–260 ms" or "heavy, smooth ease-in-out, 400 ms,
  no bounce" or "crisp, linear-out, 120 ms, nothing travels more than 8 px";
- signature moment: the one animation the concept is remembered by, as a row id: how the main popup opens,
  how the reward falls.

Two concepts with the same motion character fail the round the way two concepts with the same palette do.
Every row of a concept follows its character: a springy concept does not have a linear modal.

## 4. States and target sizes

**States.** Every screen, popup, panel and state the concept spec names has a state id (`shop.default`,
`shop.empty`, `reward.open`, `checkout.error`). `?state=<id>` opens the prototype straight in that state,
with no clicks, and the prototype confirms it with `document.documentElement.dataset.state = id`. The
design check and the builder measure a state they can open; one they cannot open is "not measurable".

**Target sizes.** Declared in the block, each opened by `?vp=WxH`:

- web: at least phone, tablet and desktop, for example `390x844`, `768x1024`, `1440x900`;
- game: at least two aspect ratios with their safe areas, for example `390x844` (9:19.5, safe 47/34),
  `390x693` (9:16, 24/0), `768x1024` (3:4, 24/20). The game prototype draws its frame at that size.

**Adaptation rules** for the sizes between: what stretches, what stays fixed, the breakpoints, the smallest
gaps, how text wraps, what moves into a sheet or a second column. They are checked on boxes: no horizontal
scroll, no new overlap, gaps not below the minimum, no cut-off text, everything inside the safe area.

## 5. The prototype contract

Every concept file carries this block in its `<head>`, written before the markup:

```html
<script type="application/json" id="moku-design">
{
  "concept": "r1c2",
  "medium": "game",
  "motionCharacter": "springy, 6% overshoot, 180-260 ms",
  "signature": "reward-in",
  "viewports": [ { "id": "tall", "size": "390x844", "safe": "47/34" }, { "id": "short", "size": "390x693", "safe": "24/0" } ],
  "adaptation": [ "Board keeps its width, HUD gaps shrink to 8 on short screens", "Popups never leave the safe area" ],
  "states": [ { "id": "shop.default", "label": "Shop" }, { "id": "reward.open", "label": "Reward popup" } ],
  "motion": [
    { "id": "reward-in", "kind": "reward", "element": "E2.reward-popup", "state": "reward.open",
      "trigger": "claim tapped", "duration": "420ms", "delay": "0; coins 40ms apart",
      "curve": "cubic-bezier(.34,1.56,.64,1)", "keys": "scale .6 → 1.08 @60% → 1; opacity 0 → 1",
      "sequence": "after backdrop-in; with coins-burst", "sound": "sfx.reward-chime @0ms", "reduced": "fade 150ms" }
  ],
  "noMotion": { "hover": "touch only" }
}
</script>
```

And it answers these URL parameters:

| Parameter | Does | Confirms with |
|---|---|---|
| `?state=<id>` | opens that state, no clicks | `documentElement.dataset.state = id` |
| `?vp=WxH` | lays out for that target size (a game draws its frame at it) | — |
| `?play=<id>` | plays that motion row from its start | `documentElement.dataset.play = id` |
| `?t=<ms>` | with `?play`, pauses every animation at that time, so a frame can be captured | — |
| `?reduced=1` | behaves as under `prefers-reduced-motion: reduce` | — |

All timings are constants in one place (the block or one `MOTION` object), not scattered through the CSS.
Use the Web Animations API or CSS animations and transitions, so `document.getAnimations()` sees them and
`?t=` can pause them. An effect drawn frame by frame (particles on a canvas) reads its time from one clock
that `?t=` freezes. A minimal runtime:

```js
const q = new URLSearchParams(location.search), root = document.documentElement;
const reduced = q.has("reduced") || matchMedia("(prefers-reduced-motion: reduce)").matches;
const frozen = q.has("t") ? Number(q.get("t")) : null;
const clock = () => frozen ?? performance.now();            // canvas effects read this, never Date.now()
function setState(id) { root.dataset.state = id; render(id); }  // render(id) shows that state
const MOTION = {                                            // one entry per motion row, keyed by its id
  "reward-in": () => panel.animate(
    [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1.08)", offset: .6 }, { transform: "scale(1)", opacity: 1 }],
    reduced ? { duration: 150, fill: "both" } : { duration: 420, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "both" })
};
setState(q.get("state") || "shop.default");
const id = q.get("play");
if (id && MOTION[id]) {
  root.dataset.play = id; MOTION[id]();
  if (frozen !== null) document.getAnimations().forEach((a) => { a.pause(); a.currentTime = frozen; });
}
```

The same `MOTION` entries run on the real triggers (taps, hovers, state changes), so the prototype is also
clickable the normal way. Each concept has a small replay control for its signature moment.

## 6. The check — `moku-proto-check`

```bash
moku-proto-check .planning/design/{slug}/concepts/r1c2.html --out .planning/design/{slug}/screenshots/r1c2
```

- **Static:** the block exists; every motion row has all eight columns; every required event of the medium
  has a row or a `noMotion` reason; the motion character, the signature, the states, the target sizes and
  the adaptation rules are there.
- **Render** (a headless Chrome on the machine, no install): every `?state=` at every `?vp=` opens, is not
  empty, has no console error and no horizontal scroll, and confirms its state; every `?play=` is known and
  moves; `?t=` pauses the signature moment; reduced motion opens without errors.
- One line per frame — words, headings, running animations, flags — so nobody has to look at the pictures to
  know a frame rendered. `--out` saves the PNGs for the gallery.
- The last line is the verdict, `proto-check: PASS — …` or `proto-check: FAIL — …`. Exit 0 pass, 2 findings,
  3 no Chrome found (only the static part ran: open the states in the browser pane instead).

## 7. After the pick

- The person picks a concept with its motion. After the pick motion is **polished** — timing, curve, peak
  values — not added. A new animation after the pick is a new round, or the person's decision written into
  `state.md` under `## Decisions`.
- Polish edits the winner in place. The generator is not run again to polish.
- At capture the station copies the block into `design-context.md`: the motion table into §2b, the states
  and sizes into §5. The prototype stays the reference for the motion, as it is for the layout.

## 8. In the build

- The builder takes every animation from the table — duration, delay, curve, key values, sequence, sound,
  reduced variant — and invents none. What the engine cannot do is an intended difference in the shared
  format, asked before it is chosen (for example "spring not available → ease-out-back, same peak").
- A change with UI and no motion table in its design context does not pass the design check. Each row of the
  table, at the end of the build, either matches or is an asked and decided difference.
- Measuring: web by `document.getAnimations()` and the computed `transition` and `animation` (duration,
  delay, curve, keyframes; values at control points with `currentTime` paused; reduced motion by emulated
  media); a game by stepping the engine's own time (`now`) frame by frame and reading the node's position,
  scale, alpha and frame at the control points — never by wall-clock video. Sounds by the event log: key and
  moment within one frame.
