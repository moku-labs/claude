---
type: llm
---

PASS if the response builds one system app with createApp imported from "@moku-labs/system", takes storePlugin from "@moku-labs/system/store" and notifyPlugin from "@moku-labs/system/notify", starts the app before the first capability call, and handles outcomes by narrowing the returned result (result.ok, result.reason) instead of try/catch or a runtime check. It should say that notify.show() never prompts, so requestPermission() is called explicitly. It may add that the @tauri-apps/* packages are optional peers needed only for the native build, and that stored data does not move between the Tauri store file and IndexedDB.
FAIL if the response imports storePlugin or notifyPlugin from the root "@moku-labs/system" entry, puts the system plugins into the createApp of @moku-labs/web, branches in app code on window.__TAURI__ or ctx.runtime, imports @tauri-apps/* directly or hand-writes localStorage or new Notification() fallbacks, claims that show() prompts for permission or that capability methods throw on environment failures, invents methods such as store.has or notify.send, or uses createCore or a direct @moku-labs/core dependency.
