# What earns a test

One rule for every station that writes, reviews or removes a test. It cuts two ways: a test that cannot
catch a bug is not written, and a behaviour that was promised is never left without a test. Neither side
is optional.

Measured in a real build: a game shipped 1049 tests, and 670 of them were removed later without losing one
caught bug. They cost time on every run and hid the tests that mattered.

## The rule

Before you write a test, name the bug it catches, in one sentence: "a tap on a taken cell places a second
piece". If you cannot name one, there is no test to write.

## Not a test

| Kind | Example | What proves it instead |
|---|---|---|
| A constant compared with itself or with a copy | `expect(colors.coral).toBe(0xf4574b)`, a layout number, a duration, a style table | Nothing has to: the value is data. Its effect is seen in a visual baseline or the design check |
| What the compiler proves | "the method exists", "has the right signature", "the config field is a number" | `tsc` |
| The same scenario at a second level | one walk asserted in a unit test, an isolated test and an integration test | The one level that owns it (table below) |
| The framework's own behaviour | "the tokens object is frozen", "the engine's default applies" | The framework's tests |
| Every step of a timeline | each millisecond of an animation | Where the motion starts and where it ends |
| A loop over data that asserts its shape | `it.each(names)("is a whole number")` | The type |
| A test that passes on a stub | green before the code exists | It asserts nothing about behaviour: rewrite it or drop it |

A constant that encodes a rule (the eight winning lines, a price table, a threshold the spec names) is
tested through the behaviour that reads it: "three in the right column wins", "an order of exactly 50.00
ships free". Never by repeating the value in the test: `expect(FREE_SHIPPING_FROM).toBe(5000)` fails only
when someone edits the constant on purpose, and then the behaviour test at the boundary fails too.

## The floor: every promised behaviour has a test

The spec's `## Verification` section is the list of promises. Each line of it that describes behaviour
points at one test that fails when that behaviour breaks. The builder reports the pairs:

```json
"behaviours": [
  { "criterion": "a tap on a taken cell changes nothing", "test": "__tests__/unit/rules.test.ts:42" }
]
```

A criterion with no test is a FAIL of the build, and the quality validator reports it as a BLOCKER. A
criterion that is not behaviour (a file exists, lint is clean) is listed with `"test": "n/a: <what checks it>"`.

Also always tested, whatever the spec says:

- every branch of a rule that decides an outcome (who wins, what is allowed, what is refused);
- every state change an API method or a handler makes, and every event it emits, on the normal path and
  on the path where it must do nothing;
- every error path the code handles on purpose;
- one integration scenario per Standard+ plugin, with the real app and the full lifecycle.

Edge cases are written where the behaviour changes: an empty list that takes another branch, a boundary
where a result flips. An edge case that takes the same path as the normal case is the same test twice.

## One level per behaviour

| What | The one place it is tested |
|---|---|
| A pure function, a rule, a reducer | unit |
| What an API method or handler changes and emits | unit, with a mock context |
| Plugins working together, the lifecycle | integration, the real app |
| Types of the public API | type-level tests, for what a consumer can get wrong (a wrong event name, a wrong payload) |
| Layout, sizes, colours, fonts | visual baselines and the design check. No unit test |

A game adds its own rows in the `moku-game` skill ("Testing").

## The kill check

Words about the value of a test cannot be checked. Breaking the code can. After the tests are green, for
each logic file you wrote or changed (a file with a condition or a computation; not types, data or wiring):

1. Break one line the way a bug would: flip a condition, move a boundary by one, drop an emit, return the
   old value. Pick the line a real mistake is most likely in.
2. Run the tests of that file once.
3. Restore the line, and check the file is exactly as it was.

- **A test fails.** The line is guarded. Record the line and the test.
- **No test fails.** There is a hole. Write the test that fails on the break, or, when tests claimed to
  cover that line, fix or drop them. Then break it again to see the new test fail.

One break per logic file, at most eight per plugin. Report it:

```json
"killed": { "of": 6, "killed": 6, "pairs": [{ "file": "rules.ts", "line": 31, "break": "< to <=", "test": "rules.test.ts:58" }] }
```

Anybody can repeat a pair, and the code reviewer repeats one of them. The last test run of the plugin
happens after the last restore.

## Coverage: 90% is the goal, never the reason

The 90% threshold stays in `vitest.config.ts`. It is reached by tests of behaviour.

- A file of plain data needs no test for coverage: importing it runs every line of it.
- You never edit `coverage.include`, `coverage.exclude` or `thresholds`, and never add an ignore comment,
  on your own.
- When honest tests leave the logic under 90%: write no filler. List the uncovered lines with the reason
  for each (unreachable without the page, a defensive branch, dead code to delete), `moku-rails pause`,
  and ask the person. On their yes, mark each with
  `/* istanbul ignore next -- <reason>, <who> <date> */`. Dead code is deleted, not ignored.
- The build report carries the count of ignore comments, so their growth is seen.

## Removing a test

- New code: a test of the "Not a test" table is simply not written.
- An existing test is never deleted by an agent on its own, also not to make a suite faster or a red test
  go away. The quality validator lists it with its kind and `delete` as the fix; the person decides, in
  one answer for the whole list. A red test is a defect or a wrong expectation: fix the cause.

## The numbers of a report

Every wave report and build report carries one line, so a drop is seen the day it happens:

```
tests: 379   time: 41 s   coverage: 93%   behaviours: 24 of 24   killed: 6 of 6   ignores: 0
```
