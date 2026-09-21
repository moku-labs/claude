# JSDoc and `@example`: where the docs live

The single source for where JSDoc and `@example` go in Moku source. Builders write by it,
`moku-style-validator` checks by it, the scaffolded ESLint config enforces the mechanical part.
It overrides `spec/15-PLUGIN-STRUCTURE.md §6` and the sandbox exemplars on this one topic.

## Why

- Only the `…Api` TYPE in `types.ts` ships in the published `.d.mts`. JSDoc on the object literal
  returned by `create…Api` never reaches a consumer: hover on `app.clock.scheduleAt` shows nothing.
- A required `@example` on a private function becomes a copy of its signature
  (`shut(ctx.state.gate);`, `const api = createClockApi(ctx);`). That is noise.
- TypeScript does not check comments. An example nobody verified is often wrong.

## Rules

| Where | Rule |
|---|---|
| Members of the public `…Api` types in `types.ts`, and helpers a consumer calls | The contract lives here: description, `@param`, `@returns`, `@throws`, and a SCENARIO `@example`: one comment line that says when a consumer calls it, a call with literal arguments in `app.<plugin>.<method>(…)` form, the result as a trailing comment. 2–6 lines. |
| Public data types (config, event payloads, results a consumer reads) | one example with a literal value, or the `createApp({ pluginConfigs: … })` line for a config |
| Implementation of an API method inside the `create…Api` object literal | no JSDoc. Ordinary `//` intent comments inside bodies stay. |
| Nano and Micro plugins: inline `api`, no `Api` type | the contract goes on the inline member, because it is the only place |
| A type the consumer implements (a provider, a source, a handler signature) | one type-level example of a realistic implementation; members keep descriptions, no examples |
| Private pure function (no ctx, state, modules or other mutable context parameter) | one line with literals and the result: `passesNarrow({ intent: "merge" }, { intent: "sell" }); // false` |
| Private function that takes ctx / state / modules, every `create…State` and `create…Api` factory, private types (`State`, `…Ctx`, internal records) | description and tags stay, NO `@example` |
| Public member no consumer can call | no example; `@remarks No example: <reason in one sentence>.` Report it as a candidate for a private API. |

## Hard rules

1. An example never repeats the signature with identifiers as arguments. `const x = fn(ctx);` is
   forbidden everywhere.
2. Every example is TRUE. Before writing a call, open the real signature and the real return shape
   (`types.ts`, the implementation, the tests in `__tests__`, the plugin README) and copy real
   argument shapes and real results. Never invent a method, an option, a field or a return value.
   If you are not sure what comes back, read the test that asserts it, or run a probe.
3. Do not lose knowledge: a behaviour note that lived on an implementation method ("a negative
   delay counts as zero") moves to the type member or to the factory description.
4. Do not bloat. No example longer than 6 lines unless it shows an implementation of an interface.
5. Tag order: description, then `@param`, `@returns`, `@throws`, `@remarks`, `@example`.

## The shape

Taken from `@moku-labs/game` (`src/plugins/clock`, `src/plugins/time`).

```ts
// types.ts — the contract
export type Api = {
  /**
   * Replaces the single pending due moment. A moment in the past is not delivered synchronously:
   * it fires on the next macrotask of the source.
   *
   * @param moment - Moment in epoch milliseconds, or `undefined` to cancel.
   * @example
   * ```ts
   * // A generator refills in 60 s. Only one moment is pending: the nearest one.
   * app.clock.scheduleAt(app.clock.now() + 60_000);
   * app.clock.scheduleAt(undefined); // nothing is due any more: cancel
   * ```
   */
  scheduleAt(moment: number | undefined): void;

  /**
   * Pauses the clock: no phase runs and `elapsed` stops advancing. Called by `lifecycle`.
   *
   * @remarks No example: a game pauses through `app.lifecycle.push(reason)`; only `lifecycle`
   * calls this.
   */
  pause(): void;
};
```

```ts
// api.ts — the factory keeps its JSDoc, the members carry none
/**
 * Builds the clock API over the plugin state.
 *
 * @param ctx - Plugin context.
 * @returns The clock API.
 */
export function createClockApi(ctx: ClockCtx): Api {
  return {
    now: (): number => readNow(ctx.state),

    scheduleAt: (moment: number | undefined): void => {
      cancelPending(ctx.state);

      if (moment === undefined) return;

      arm(ctx.state, moment);
    }
  };
}
```

## What lint enforces, and what it cannot

| Check | Enforced by |
|---|---|
| every `…Api` member in `types.ts` has JSDoc | ESLint block 6b, `jsdoc/require-jsdoc` |
| every `…Api` member has `@example` or `@remarks` | ESLint block 6b, `jsdoc/require-example` |
| no example whose whole body is one call with bare identifiers | ESLint block 6c, `jsdoc/match-description` |
| implementation arrows need no JSDoc | ESLint block 6, `ArrowFunctionExpression: false` |
| the example is true; docs sit on the type and not on the implementation; no `@example` on ctx functions | `moku-style-validator` checks E2, E4, E5 |
