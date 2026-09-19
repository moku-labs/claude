# Design mode — `api`

Designing the public API of a plugin or a framework before any of it is written. The output is the API
contract inside `design-context.md`: a specification, not source. The builder writes the real types and
implementation from scratch against it.

The order matters. Usage comes first, types second. An API designed from its types outward reads well to
its author and badly to everyone else; an API designed from a call site inward has to earn its shape.

```
usage snippets (2-3) ──> type sketch per snippet ──> comparison table ──> human pick ──> capture
```

## Before you start

Load the `moku:moku-core` skill with the Skill tool and read the reference it points to for the factory
chain, `ctx`, lifecycle, events and plugin structure. Every alternative has to be expressible in that
spec; an alternative that needs the kernel to change is a brainstorm topic, not a design one.

## Step 1 — Write the usage snippets

Two or three alternatives. Each one is consumer code as a person would actually write it: the plugin
being registered, its config being passed, its api being called, its events being listened to. Real
names, real values, no ellipses where the interesting part is.

```ts
// A — config object, api namespaced by verb
const app = createApp(config, [
  streaksPlugin({ resetAt: "00:00", timezone: "local" }),
]);

app.streaks.mark("morning-run");
app.streaks.current("morning-run");     // 4
app.on("streaks:broken", ({ habit }) => notify(habit));
```

```ts
// B — builder, api returns a handle per entity
const app = createApp(config, [streaksPlugin()]);

const run = app.streaks.track("morning-run", { resetAt: "00:00" });
run.mark();
run.current;                            // 4
run.onBreak((habit) => notify(habit));
```

Keep the same feature in every snippet — the alternatives differ in shape, not in what they can do.

## Step 2 — Sketch the types behind each snippet

For each alternative, the type-level sketch only: `Config`, `State`, `api`, events. Signatures, no bodies.
This is where an ergonomic snippet either holds up or turns out to need explicit generics at the call site.

```ts
type StreaksConfig = { resetAt: string; timezone: "local" | string };
type StreaksState  = { streaks: Record<string, { count: number; lastMark: number }> };

type StreaksApi = {
  mark(habit: string): void;
  current(habit: string): number;
};

type StreaksEvents = {
  "streaks:marked": { habit: string; count: number };
  "streaks:broken": { habit: string; was: number };
};
```

If a sketch needs a type parameter written at the call site, say so — that is a finding, not a detail.

## Step 3 — Compare on named axes

| Axis | What it measures |
|---|---|
| Ergonomics | How the call site reads to someone who has not read the plugin |
| Inference without explicit generics | Whether the consumer ever writes a type parameter by hand |
| Testability | How much setup one behaviour needs in a test, and what has to be mocked |
| Consistency with the Moku Core spec | Factory chain, `ctx` tiers, lifecycle and event naming, plugin structure |

One row per alternative, one concrete sentence per cell. No adjectives without a reason behind them.

| | Ergonomics | Inference | Testability | Spec consistency |
|---|---|---|---|---|
| A | One namespace, verb-first, reads as a sentence | No call-site generics; config infers `StreaksConfig` | Mark and read through `app.streaks`, no handles to keep | Matches the api-on-app shape other plugins use |
| B | Handle per habit; two concepts to learn | Handle type infers, but `track` needs its own generic for typed metadata | Handles must be held across a test, more setup | Handle lifetime is not a shape the spec uses |

State what you would pick and why, in two sentences, before asking. The user decides; a design partner
that has no opinion is not useful.

## Step 4 — The pick

`moku-rails pause --reason "api shape pick"`, then `AskUserQuestion` with one option per alternative plus
a mix option. Capture what the user chose and, when they mixed, exactly which parts came from where.

## Step 5 — Capture it as the contract

Write the picked shape into `design-context.md` as the API contract section: the usage snippets that are
now canonical, the `Config`, `State`, `api` and events sketch, the axes table with the decision, and the
rejected alternatives with the reason each was rejected. History is annotated, not deleted.

It is a spec. The snippets show how the API should read; they are not the implementation, they carry no
error handling, and the builder writes the real plugin from scratch against this contract with all the
project's conventions. Say that in the section, not only here.
