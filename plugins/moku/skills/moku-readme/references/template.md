# Root README template

Copy-paste skeleton in the moku-labs house style. Replace `{placeholders}`; delete
sections that don't apply to the repo shape (see `SKILL.md` §2). The **library** form
below is the canonical baseline; the **framework**, **toolkit**, and **app** deltas
follow.

---

## Library / catalog form (canonical baseline)

````markdown
# {@scope/pkg}

**{One-line value proposition — bold.}**

{2–4 sentences: what it is. Include a what-it-is-NOT clause — "No framework of its
own, no lock-in." Link related packages inline.}

<br/>

[![npm](https://img.shields.io/npm/v/{scope/pkg}?logo=npm&color=cb3837&label=npm)](https://www.npmjs.com/package/{scope/pkg})
[![types](https://img.shields.io/badge/types-included-3178c6?logo=typescript&logoColor=white)](#requirements)
[![node](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](#requirements)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

<br/>

[Install](#install) · [Catalog](#catalog) · [Usage](#usage) · [Scripts](#scripts)

---

## Install

```sh
bun add {@scope/pkg} {peer deps}
```

> [!NOTE]
> **Status: `0.x` — early.** {One sentence on stability / peer deps.}

## Why {@scope/pkg}

- **{Headline benefit.}** {One sentence.}
- **{A catalog, not a framework — define by negation.}** {One sentence.}
- **{Third benefit.}** {One sentence.}

## Catalog

| Export | Kind | Responsibility |
|---|---|---|
| [`{export}`]({link}) | {kind} | {What it does, one line — the *why* lives here.} |

## Usage

```ts
{copy-pasteable minimal example}
```

## Entry points

| Entry | Format | For | Includes |
|---|---|---|---|
| **`{@scope/pkg}`** | {format} | {target} | {what} |

## Scripts

```sh
bun run build              # {what}
bun run test               # {what}
bun run lint               # {what}
bun run format             # {what}
```

## Requirements

- **Node `>= 24`** and **Bun `>= 1.3.14`** — use `bun` exclusively (never npm/yarn/pnpm).
- **TypeScript** in strict mode, with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
- **[`{related pkg}`]({url})** — {why it's needed}.

## License

[MIT](./LICENSE) © [moku-labs](https://github.com/moku-labs)
````

---

## Framework form — deltas from the baseline

- Opener stays `## Why {@scope/pkg}`, but follow it with `## Quick start` (two code
  blocks: the route/config + the app entry) instead of a plain `Usage`.
- Add `## How it works` with a mermaid `flowchart LR` (see `SKILL.md` §6) and a short
  "the contract" subsection describing the core abstraction.
- Central table is `## Plugins` (`| Plugin | Kind | Responsibility |`).
- Add `## Rendering modes` (or the framework's mode matrix) as a secondary table with a
  `> [!TIP]`.
- Add `## Docs` — a bulleted list of reference links — before `## License`.

## Toolkit / Claude Code plugin form — deltas

- Opener is `## What this is` (a tight paragraph, not a "why" list).
- Install uses `/plugin marketplace add …` + `/plugin install …` and a `> [!IMPORTANT]`
  callout for the exact command.
- Replace `How it works` with `## The workflow` — a mermaid `flowchart LR` plus a
  numbered `text` block of the canonical command sequence.
- Central tables: `## Commands`, `## Agents`, `## Skills`, `## Hooks`, `## Workflows`
  (grouped tables). Add `## Output styles` and `## Configuration`.
- `Requirements` is a one-line bold callout rather than its own section; no `Scripts`.

## Consumer app form — deltas

- `## What it is` → `## Quick start` (the **exact** documented run command — the one the
  build's smoke test actually runs, see `build-app.md` Step 8) → `## Features` →
  `## Configuration` → `## Deployment` → `## License`.
- No npm badge (apps aren't published); use a CI badge + license.

---

## Notes

- Every anchor in the nav line must match a real `##` heading (GitHub slugifies
  headings: lowercase, spaces → `-`, punctuation dropped).
- Keep the badge row to 4–7. Version/npm first, license last.
- Run `bun run format` after writing; the doc-validation pass (`build-final.md` Step 5.7)
  grep-checks that every symbol, script, and import path referenced here exists in source.
