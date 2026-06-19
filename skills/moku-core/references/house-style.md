# Moku House Style — approved conventions validators must NOT block

Validators reason from the spec in isolation, so they sometimes flag a pattern that the project's
own already-verified plugins use everywhere. That is a false positive that costs a whole
investigation cycle. Two rules prevent it:

## The convention-baseline rule (applies to every validator)

> Before raising a pattern as a **BLOCKER**, check whether the same pattern is already used by **two
> or more already-verified plugins** in this repo (verified = committed, or marked `verified` in a
> prior wave). If ≥2 verified plugins use it, it is an established house convention — downgrade to an
> **ADVISORY** ("consider a repo-wide change"), never a per-plugin blocker. Consistency with the repo
> beats an idealized spec reading when the spec does not strictly forbid the pattern.

The `moku-verify` adversarial skeptic pass enforces this automatically (it greps for the pattern in
sibling plugins before letting a blocker stand). Validators should self-apply it too.

## Explicitly approved patterns (never re-flag these as per-plugin violations)

These three were flagged as false-positive blockers in a real build even though all 10 plugins used
them, passed Stage-2 validation, and had clean `tsc`/`expectTypeOf`. They are house style:

1. **`api: createApi` — factory by direct reference.** Passing the API/state factory by direct
   reference (`api: createApi`, `createState: createRouterState`) is the standard wiring form. It does
   NOT break event inference in practice (the sandbox + every plugin prove it). Do **not** demand
   `api: (ctx) => createApi(ctx)`.

2. **Framework-internal `__tests__` may import `createCoreConfig` from `@moku-labs/core`.** A
   framework (Layer 2) legitimately *depends on* core; its own integration tests bootstrap via
   `createCoreConfig`. This is NOT a Layer-3 three-layer violation (that rule is about consumer/app
   code importing core directly). Test files under a framework plugin's `__tests__/` using this
   bootstrap are fine.

3. **Per-event `register<T>()` is house style.** Declaring events individually —
   `events: (register) => ({ "auth:login": register<{…}>("…"), … })` — is the standard. `register.map<Events>()`
   is an optional shorthand, **not required**, even for Standard+ plugins. Do not flag per-event
   registration or demand `register.map`.

> When a build legitimately establishes a NEW cross-cutting convention, add it here (and the builder
> appends the term/pattern as part of "done") so it is never re-flagged.

## Family-level conventions (required, owned outside the vendored spec)

These are REQUIRED rules for how moku projects consume the shared `@moku-labs/common` package. They
are approved house style — treat them as authoritative, not a per-project invention:

4. **`@moku-labs/common` usage — MC1/MC2/MC3.** Render CLI output through the branded kit
   (`@moku-labs/common/cli`), log via `ctx.log` (not raw `console.*`), and read env via `ctx.env`
   (not raw `process.env`). Authoritative, citable rules with rationale + examples + detection +
   the allowed exceptions (brand-kit source, the marked `// @log-sink`, env providers, tests) live
   in [`../../moku-common/references/conventions.md`](../../moku-common/references/conventions.md)
   (the `moku-common` skill); the `moku-common-validator` agent enforces them.
