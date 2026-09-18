---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
tags: [core, style]
---

This function in my moku plugin is a wall of text. Make it readable in the moku house style, keep behavior identical:

```ts
export function resolveRoute(routes: Route[], path: string, method: string) {
  if (routes.length > 0) { const clean = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path; for (const route of routes) { if (route.method === method || route.method === "ALL") { const keys: string[] = []; const pattern = new RegExp("^" + route.path.replace(/:(\w+)/g, (_m, k) => { keys.push(k); return "([^/]+)"; }) + "$"); const match = pattern.exec(clean); if (match) { const params: Record<string, string> = {}; keys.forEach((k, i) => { params[k] = decodeURIComponent(match[i + 1]); }); return { route, params }; } } } return undefined; } else { return undefined; }
}
```
