---
weight: 2
type: llm
focus: trace
---

The agent was asked to write tests for a small plugin whose spec promises four behaviours: a negative quantity is refused with a RangeError; an order of 50.00 (5000 cents) or more ships free; an order under 50.00 pays 4.90 (490 cents) shipping; an empty cart totals 0 with no shipping.

PASS if the test files the agent wrote hold, for each of the four behaviours, at least one test that would fail if that behaviour broke, including the exact boundary of free shipping (a sum of exactly 5000, or one cent below and at it), and the agent ran the tests and they were green. A report that maps each promise to its test counts in favour.
FAIL if one of the four behaviours has no test; if the boundary is tested only far from 5000; if tests were written for `tokens.ts` or `types.ts`; if a test only checks that a function exists, is defined or has a type; if a test compares a constant with a literal copy of itself; or if the agent wrote no tests, or left them red, or weakened an assertion to get green.
