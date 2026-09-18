---
name: moku-readable-code
description: >
  Moku readable-code style: write functions that tell their story by layout —
  blank-line "stanzas" with one-line intent comments, guard clauses first, flat
  primitives, named predicates/constants, balanced helper extraction. Triggers on:
  "readable code", "wall of text", "refactor for readability", "story by layout",
  "stanza style", "make this function readable", "extract function", "guard clause",
  "glued-together / black-box function", or reviewing function-body structure.
---

# Moku Readable Code

The standard for function-body readability across Moku projects. Goal: every
function should **tell its story by layout alone** — a reader skims the blank-line
stanzas and the one-line intent comments and knows what it does *before* reading a
single expression. Hand-crafted, not machine-glued.

This is **behavior-preserving** guidance. Restructuring a function never changes its
public signature, return type, error messages, thrown codes, or runtime behavior.

## The north star

> Code reads like prose. The eye should be able to **count the steps** of a function
> by counting the blank-line-delimited blocks, without reading a token.

Distilled from Martin (*Clean Code* — vertical formatting / newspaper structure),
Ousterhout (*A Philosophy of Software Design* — deep modules, comments at higher
abstraction), Boswell & Foucher (*The Art of Readable Code* — paragraphs / summary
comments), Fowler (*Refactoring* — Extract Function/Variable, Guard Clauses,
Decompose Conditional), and Kernighan & Pike (*The Practice of Programming* — clarity
over cleverness).

## The 10 rules

1. **Stanzas.** Split the body into 3–7 logical steps, one blank line between each
   (gather inputs → derive → transform → assemble → side-effects → return). If you
   can't name the stanzas, the function is doing too much.
2. **Density.** *Within* a stanza, no blank lines — lines that are one thought stay
   glued. A blank line always means "new step starts here," never decoration.
3. **Intent comment per stanza.** One line above each stanza saying *what it
   accomplishes* (the goal), never *how* (the mechanics). It must stay true if the
   implementation were rewritten. If it only paraphrases the next line, delete it and
   rename instead.
4. **Guard clauses first.** Preconditions / early returns / throws go in a leading
   stanza, then the happy path flows flat below. No `else` after a guard.
5. **Flat & primitive.** No nested ternaries (a single flat `a ? b : c` is fine), no
   `if`-pyramids. Invert nesting with guards; replace key→value `if`/`switch` chains
   with a lookup object/Map.
6. **Named predicates.** Never leave a compound boolean inline in `if`/`while`/`?:` —
   lift it to a `const isX = …` or a `function isX(…): boolean` named for the domain
   concept (`isCombiningMark`, `isPublished`).
7. **Named constants.** Hoist non-obvious literals to named consts
   (`const ID_PADDING = 4`). Exempt the self-evident (`0`, `1`, `-1`, `""`).
8. **Extract by semantic distance, not line count.** Where a block needs a mental
   comment to explain its purpose, extract a helper whose *name* is that comment, so
   the caller reads as a list of intention-named steps at one altitude.
9. **Don't over-extract (Ousterhout).** Only extract when the caller gets simpler
   *and* the helper hides real complexity behind a clean signature. No pass-through
   wrappers; never split one cohesive computation into pieces that only make sense
   read together. Prefer fewer, deeper helpers over a swarm of shallow ones.
10. **Active, precise names.** Helpers are verb phrases (`buildRobotsTxt`,
    `collectRelativeUrls`); predicates read as questions (`hasAccess`). Avoid
    `data`/`info`/`temp`/`result`/`handler`/`process`. Match the file's existing
    vocabulary (`route`, not a new `path`/`url` for the same thing).

## Exempt — do NOT force stanzas onto these

- Pure data / object-literal returns, config objects, type definitions.
- Trivial 1–3 line accessors / delegators.
- Functions that are mostly JSX / markup.
- Functions that already read as stanzas with intent comments (comment *wording* is
  out of scope — don't churn a good comment to be "more abstract").

## Moku conventions (keep consistent)

- Helpers are defined **above** the function that uses them (file convention).
- Module-private helpers still get **full JSDoc** (description, `@param`, `@returns`,
  `@example`) per the repo's eslint-plugin-jsdoc rules — `import type`, `@param name -
  desc`, blank line before tags. See [[moku-core]] §JSDoc and the `moku-jsdoc-validator`.
- Don't add abstraction modules or defensive code that wasn't asked for. Cohesion and
  deletion — not accretion — are the tells of hand-crafted code.

## The smell, in one glance

Before — a black box you must read line-by-line:

```ts
const site = ctx.require(sitePlugin);
const i18n = ctx.require(i18nPlugin);
const articles = selectArticles(readCachedContent(ctx), i18n.defaultLocale());
const feed = new Feed({ title: site.name(), /* …8 fields… */ });
const guids: string[] = [];
for (const a of articles) { /* …9 lines building+adding an item… */ }
const result = { rss: feed.rss2(), atom: feed.atom1(), json: feed.json1(), guids };
await mkdir(ctx.config.outDir, { recursive: true });
await Promise.all([/* …3 writeFile calls… */]);
```

After — five stanzas you read as a table of contents:

```ts
// Gather the inputs: site/i18n metadata and the published default-locale articles.
const site = ctx.require(sitePlugin);
const defaultLocale = ctx.require(i18nPlugin).defaultLocale();
const articles = selectArticles(readCachedContent(ctx), defaultLocale);

// Build the channel, then add one item per article, collecting GUIDs in order.
const feed = createFeedChannel(site, defaultLocale);
const guids: string[] = [];
for (const article of articles) {
  guids.push(addArticleItem(feed, article, site));
}

// Serialize the channel to all three formats and persist them to outDir.
const result: FeedsResult = { rss: feed.rss2(), atom: feed.atom1(), json: feed.json1(), guids };
await writeFeedFiles(ctx.config.outDir, result);
```

## Severity (for `moku-readable-code-validator`)

Readability is a **should-fix**, not a behavior bug. The validator emits **WARNING**
(clear wall-of-text — body is dense, multi-concern, no stanzas/intent comments, or has
nested ternaries / deep nesting) and **INFO** (borderline) only — **never BLOCKER**, so
it surfaces readability debt without ever failing a build. Each finding cites
`file:line`, the violated rule number, and a concrete fix (which stanzas to split,
which predicate/constant/helper to extract).
