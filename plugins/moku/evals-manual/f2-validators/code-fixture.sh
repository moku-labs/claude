#!/usr/bin/env bash
# F2 code fixture: a 4-plugin Layer-2 framework with five seeded holes for moku-architecture-validator.
# A1 search <-> notify depend on each other (cycle).  A2 createCore lists sync before storage (order).
# A3 sync emits sync:failed, declared nowhere.  A4 notify hooks search:indexed, emitted nowhere.
# A5 search rebuilds the whole index on every storage:changed (O(n) per change, hot path).
set -euo pipefail
mkdir -p .planning src/plugins/{storage,sync,search,notify}
printf 'type: framework\nname: notes\ncore_version: 1.7.6\n' > .planning/moku.md
printf '{ "name": "@acme/notes", "type": "module", "dependencies": { "@moku-labs/core": "1.7.6" } }\n' > package.json
cat > src/config.ts <<'TS'
import { createCoreConfig } from "@moku-labs/core";

/** The framework's config and its plugin factory. */
export const { createPlugin, createCore } = createCoreConfig("notes", { config: { appName: "notes" }, plugins: [] });
TS
cat > src/index.ts <<'TS'
import { createCore } from "./config";
import { notifyPlugin } from "./plugins/notify";
import { searchPlugin } from "./plugins/search";
import { storagePlugin } from "./plugins/storage";
import { syncPlugin } from "./plugins/sync";

/** The notes framework: storage, sync, search and notices. */
export const { createApp, createPlugin } = createCore({ plugins: [syncPlugin, storagePlugin, searchPlugin, notifyPlugin] });
TS
cat > src/plugins/storage/index.ts <<'TS'
import { createPlugin } from "../../config";

/** A stored note. */
export type Note = { id: string; title: string; body: string; updatedAt: number };

/** Keeps notes in memory and tells others when one changes. */
export const storagePlugin = createPlugin("storage", {
  createState: () => ({ notes: new Map<string, Note>() }),
  events: register => ({ "storage:changed": register<{ id: string }>("a note was stored") }),
  api: ctx => ({
    put(note: Note): void {
      ctx.state.notes.set(note.id, note);
      ctx.emit("storage:changed", { id: note.id });
    },
    get: (id: string): Note | undefined => ctx.state.notes.get(id),
    all: (): Note[] => [...ctx.state.notes.values()]
  })
});
TS
cat > src/plugins/sync/index.ts <<'TS'
import { createPlugin } from "../../config";
import { storagePlugin } from "../storage";

/** Pushes changed notes to the endpoint, with exponential backoff. */
export const syncPlugin = createPlugin("sync", {
  depends: [storagePlugin],
  config: { endpoint: "", maxRetries: 5 },
  createState: () => ({ queue: [] as string[] }),
  events: register => ({ "sync:finished": register<{ count: number }>("a sync round finished") }),
  hooks: ctx => ({ "storage:changed": ({ id }) => void ctx.state.queue.push(id) }),
  api: ctx => ({
    async flush(): Promise<void> {
      for (let attempt = 0; attempt < ctx.config.maxRetries; attempt++) {
        const ok = await fetch(ctx.config.endpoint, { method: "POST", body: JSON.stringify(ctx.state.queue) }).then(r => r.ok, () => false);
        if (ok) {
          ctx.emit("sync:finished", { count: ctx.state.queue.length });
          ctx.state.queue = [];
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 100));
      }
      ctx.emit("sync:failed", { error: "retries exhausted" });
    },
    pending: (): number => ctx.state.queue.length
  })
});
TS
cat > src/plugins/search/index.ts <<'TS'
import { createPlugin } from "../../config";
import { notifyPlugin } from "../notify";
import { storagePlugin } from "../storage";

/** Splits a text into lower-case terms. */
const terms = (text: string): string[] => text.toLowerCase().split(/\W+/).filter(term => term.length > 1);

/** An inverted index of note titles and bodies. */
export const searchPlugin = createPlugin("search", {
  depends: [storagePlugin, notifyPlugin],
  createState: () => ({ index: new Map<string, Set<string>>() }),
  hooks: ctx => ({
    "storage:changed": () => {
      ctx.state.index.clear();
      for (const note of ctx.require(storagePlugin).all()) {
        for (const term of terms(`${note.title} ${note.body}`)) {
          const ids = ctx.state.index.get(term) ?? new Set<string>();
          ids.add(note.id);
          ctx.state.index.set(term, ids);
        }
      }
    }
  }),
  api: ctx => ({ query: (text: string): string[] => [...(ctx.state.index.get(text.toLowerCase()) ?? [])] })
});
TS
cat > src/plugins/notify/index.ts <<'TS'
import { createPlugin } from "../../config";
import { searchPlugin } from "../search";

/** Forwards framework events to one app callback. */
export const notifyPlugin = createPlugin("notify", {
  depends: [searchPlugin],
  config: { onNotice: (_notice: string): void => {} },
  hooks: ctx => ({
    "sync:finished": () => ctx.config.onNotice("synced"),
    "search:indexed": () => ctx.config.onNotice("indexed")
  })
});
TS
