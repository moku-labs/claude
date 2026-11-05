#!/usr/bin/env bash
# F2 plan fixture: a 4-plugin framework plan with five seeded holes for moku-plan-checker.
# H1 requirement "export notes as Markdown" has no spec.  H2 03-search depends on 04-notify (later order).
# H3 02-sync emits sync:failed, declared nowhere.  H4 04-notify hooks search:indexed, emitted nowhere.
# H5 03-search has no Verification section.
set -euo pipefail
mkdir -p .planning/specs
printf 'type: framework\nname: notes\ncore_version: 1.7.6\n' > .planning/moku.md
cat > .planning/context-notes.md <<'MD'
# notes — a framework for offline-first note apps

## Requirements
- R1 Store notes locally, keyed by id, with created/updated timestamps.
- R2 Sync local notes to a remote endpoint when online; retry with backoff.
- R3 Full-text search over titles and bodies, updated as notes change.
- R4 Notify the app (an event) when a sync finishes or fails, and when search is re-indexed.
- R5 Export notes as Markdown files, one file per note.
MD
spec() { cat > ".planning/specs/$1"; }
spec 01-storage.md <<'MD'
# 01 storage
## Overview
Tier: Standard. Implementation order: 1. Keeps notes in memory with an optional persistence adapter.
## Config
`{ adapter: "memory" | "indexeddb" }`, default `{ adapter: "memory" }`.
## State
`{ notes: Map<string, Note> }`.
## API
- `put(note: Note): void`
- `get(id: string): Note | undefined`
- `all(): Note[]`
## Events
`storage:changed` — payload `{ id: string }`, registered with `register<{ id: string }>("a note was stored")`.
## Dependencies
None.
## Hooks
None.
## Lifecycle
onInit: open the adapter. onStart: none. onStop: flush the adapter.
## Communication
Emits `storage:changed`. Listens to nothing. Requires nothing.
## Package Dependencies
None.
## Testing Strategy
Unit: put/get/all. Integration: changed is emitted on put.
## Code Example
```ts
export const storagePlugin = createPlugin("storage", { config: { adapter: "memory" }, createState: () => ({ notes: new Map() }) });
```
## Verification
- [ ] put then get returns the note
- [ ] put emits storage:changed with the id
MD
spec 02-sync.md <<'MD'
# 02 sync
## Overview
Tier: Complex. Implementation order: 2. Pushes changed notes to the remote endpoint with exponential backoff.
## Config
`{ endpoint: string, maxRetries: number }`, default `{ endpoint: "", maxRetries: 5 }`.
## State
`{ queue: string[], online: boolean }`.
## API
- `flush(): Promise<void>`
- `pending(): number`
## Events
`sync:finished` — payload `{ count: number }`, registered with `register<{ count: number }>("a sync round finished")`.
## Dependencies
storage — reads notes with `get`.
## Hooks
`storage:changed` — queues the id.
## Lifecycle
onInit: none. onStart: start the online listener. onStop: stop it.
## Communication
Emits `sync:finished` after a round, and `sync:failed` with `{ error: string }` when retries are exhausted. Listens to `storage:changed`. Requires storage.
## Package Dependencies
None.
## Testing Strategy
Unit: backoff timing with a fake clock. Integration: a changed note is pushed.
## Code Example
```ts
export const syncPlugin = createPlugin("sync", { depends: [storagePlugin], config: { endpoint: "", maxRetries: 5 } });
```
## Verification
- [ ] a changed note is pushed on the next round
- [ ] retries stop after maxRetries and sync:failed is emitted
MD
spec 03-search.md <<'MD'
# 03 search
## Overview
Tier: Standard. Implementation order: 3. Keeps an inverted index of note titles and bodies.
## Config
`{ minTermLength: number }`, default `{ minTermLength: 2 }`.
## State
`{ index: Map<string, Set<string>> }`.
## API
- `query(text: string): string[]`
## Events
None.
## Dependencies
storage — reads notes with `all`. notify — tells the app the index was rebuilt.
## Hooks
`storage:changed` — re-indexes that note.
## Lifecycle
onInit: build the index from `all()`. onStart: none. onStop: none.
## Communication
Emits nothing. Listens to `storage:changed`. Requires storage and notify.
## Package Dependencies
None.
## Testing Strategy
Unit: tokenizing and querying. Integration: a stored note is found.
## Code Example
```ts
export const searchPlugin = createPlugin("search", { depends: [storagePlugin, notifyPlugin], config: { minTermLength: 2 } });
```
MD
spec 04-notify.md <<'MD'
# 04 notify
## Overview
Tier: Micro. Implementation order: 4. Forwards framework events to one app callback.
## Config
`{ onNotice: (notice: Notice) => void }`, default `{ onNotice: () => {} }`.
## State
None.
## API
None.
## Events
None.
## Dependencies
None.
## Hooks
`sync:finished` — forwards a "synced" notice. `search:indexed` — forwards an "indexed" notice.
## Lifecycle
onInit: none. onStart: none. onStop: none.
## Communication
Emits nothing. Listens to `sync:finished` and `search:indexed`. Requires nothing.
## Package Dependencies
None.
## Testing Strategy
Unit: each hook calls onNotice. Integration: a finished sync reaches onNotice.
## Code Example
```ts
export const notifyPlugin = createPlugin("notify", { config: { onNotice: () => {} } });
```
## Verification
- [ ] a finished sync calls onNotice with "synced"
- [ ] a re-index calls onNotice with "indexed"
MD
printf '# STATE\n## Phase: plan-complete\n## Target: framework notes\n## Next Action: build\n' > .planning/STATE.md
