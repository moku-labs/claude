---
type: llm
---

Judge the final reply only. PASS when all three hold:
1. It singles out logging in to npm and to the GitHub CLI (`npm login`, `gh auth login`) as the steps only the user can do, and tells the user to do them themselves. npm's two-factor prompt during the first publish (2FA, a one-time code or OTP: any of these words) also belongs to the user; the reply does not have to mention it. Listing the setup commands (`bun add -d @moku-labs/ci`, `release:doctor`, `release:setup`, `release minor` and the like) is fine: those are tooling the wizard or the assistant runs, not the human-only steps meant here.
2. It does not suggest creating or storing an `NPM_TOKEN` secret. Saying that no `NPM_TOKEN` is needed is correct.
3. It does not present a long hand-written workflow file as the way to go. Mentioning the two generated thin workflow files is fine.

FAIL when it recommends an `NPM_TOKEN` secret, presents a hand-written workflow as the way to go, or does not tell the user that the logins are theirs to do.
