# Natural-language argument resolution

How `/moku:brainstorm`, `/moku:plan`, and `/moku:init` turn free-form intent into their structured
arguments. These three are the **idea/scaffold entry points** with rich syntax (verbs, types, flags,
descriptions), so they accept plain language and translate it. The other moku commands take very
simple arguments and do not use this protocol.

> **Goal:** users never have to memorize the `verb type "name" --flags` syntax. They describe what
> they want; the command converts it. If it genuinely can't, it asks for just the missing piece —
> never a full restatement.

## The contract

`$ARGUMENTS` (the text after the slash command) is one of: **empty**, **exact structured syntax**,
or **natural language**. Resolve in this order:

1. **Empty** → use the command's documented no-arg behavior (e.g. `plan` resumes from STATE.md,
   `init` targets the current directory). Do not ask.
2. **Already structured** → if the input already matches the command's documented patterns/flags,
   use it **verbatim**. Skip interpretation, skip the echo. Structured syntax always wins — never
   "reinterpret" a valid invocation.
3. **Natural language** → map the intent onto the command's documented verbs / types / flags /
   description slot (the patterns listed in the command body), then:
   - **Confident + complete** → echo one line `Interpreting as: …` and proceed.
   - **Confident but a required value is missing** → fill what you can, then ask **only** for the gap.
   - **Ambiguous** (maps to >1 plausible pattern) → ask the user to pick between the candidates.
   - **Unmappable** (the intent doesn't fit this command) → say so and point to the command that
     does fit (or ask).

## Echo format

When NL was interpreted (case 3, confident), print exactly one line **before** doing the work:

```
Interpreting as: /moku:<command> <canonical args>
```

This lets the user catch a mis-parse and teaches the structured form over time. Do **not** echo for
empty or already-structured input.

## Asking (only when you must)

Ask for the **smallest** missing piece — not a full restatement. All three commands have
`AskUserQuestion` in their tools: offer the candidate interpretations as options, recommended
candidate first. Never invent a required value (a plugin name, a path, a description) just to avoid
asking — a wrong guess on a required value is worse than one more question.

## Safety — NL never bypasses gates

Mapping NL onto an action does **not** skip the command's own gates. The interpreted invocation still
runs the normal flow:

- `plan` still hits its per-stage user checkpoints (analysis → specs → skeleton).
- `brainstorm` still runs its Present → Challenge → Decide loop and approval gates.
- A mapped flag (`--quick`, `--deep`, `--context`) is honored **only** if the user's words clearly
  imply it ("quick pass", "go deep"). Ambiguity → ask or omit the flag.

## Mapping guidance

- **Verbs (synonyms → vocabulary):** "make / scaffold / start a new …" → `create`; "change /
  modify / tweak / adjust" → `update`; "add a … plugin" → `add plugin`; "port / bring over / convert
  existing code" → `migrate`; "continue / pick up where I left off" → `resume`.
- **Types:** map the noun — "tool / engine / library / SSG / framework" → `framework`; "app /
  service / server / game / site" → `app`; "plugin" → `plugin`.
- **Description slot:** the descriptive part of the sentence fills the command's
  description/requirements argument, e.g. `plan add plugin auth "JWT auth with refresh tokens"`.
- **Flags from intent:** "quick / rough pass" → `--quick`; "go deep / thorough" → `--deep`; "use the
  brainstorm context / from that context file" → `--context <file>`; "set it up in <path>" → the
  `init` path argument.
- Prefer the **most specific** pattern that fully satisfies the request; don't widen scope beyond
  what was asked.

## Examples

| User typed | Command | Interpreting as |
|---|---|---|
| `/moku:plan start a new static site generator` | plan | `/moku:plan create framework "static site generator"` |
| `/moku:plan add a JWT auth plugin with refresh tokens` | plan | `/moku:plan add plugin auth "JWT auth with refresh tokens"` |
| `/moku:plan change the router to support nested routes` | plan | `/moku:plan update plugin router "support nested routes"` |
| `/moku:plan port my existing app at ~/proj` | plan | `/moku:plan migrate app ~/proj` |
| `/moku:plan update the router` *(no detail)* | plan | **ask:** "What change to the router plugin?" |
| `/moku:plan` *(empty)* | plan | resume from STATE.md (documented no-arg) |
| `/moku:brainstorm a caching layer with TTL` | brainstorm | `/moku:brainstorm "a caching layer with TTL"` (free-form passes through) |
| `/moku:brainstorm explore auth options, go deep` | brainstorm | `/moku:brainstorm "auth options" --deep` |
| `/moku:init set it up in ~/Projects/blog` | init | `/moku:init ~/Projects/blog` |
| `/moku:init` *(empty)* | init | initialize in the current directory |
