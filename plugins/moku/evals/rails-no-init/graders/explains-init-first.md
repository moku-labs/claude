---
type: llm
---

Judge the final reply only. PASS when all three hold:
1. It does not claim that `src/plugins/streak/index.ts` (or any plugin file) was written.
2. It explains that the project has to be initialized first. Any of these reasons counts: there is no moku project for the plugin to live in, an uninitialized project would not match the moku architecture (no `createCoreConfig`, no tooling), or the moku rails refuse source files until init.
3. It offers to do the initialization itself (for example "Shall I create the project?"). Asking a few questions about the plugin or mentioning a short spec before the build is fine.

FAIL when it claims the plugin file was written, or refuses without offering the initialization step.
