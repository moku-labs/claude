---
type: llm
---

PASS if the response declines to use Astra for reviewing code, explains why (Astra is a second opinion on user experience and an image artist, not a code reviewer — a measured comparison showed Codex reviewing Claude's code lowered the pass rate, roughly 91% to 83%), and offers the Claude-side code reviewer (moku-code-reviewer, the verify station or the moku validators) instead.
FAIL if it runs or proposes running `moku-astra` on TypeScript source, treats Astra as a general reviewer, or declines without explaining why and without offering the code-review alternative.
