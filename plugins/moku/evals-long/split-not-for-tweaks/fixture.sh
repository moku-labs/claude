#!/usr/bin/env bash
# An initialized moku consumer app on the rails, no open change: habits with three plugins and a phone UI.
set -euo pipefail
git init -q -b main .
mkdir -p src/plugins/{habits,streaks,reminders} .planning
cat > package.json <<'JSON'
{ "name": "habits", "type": "module", "scripts": { "test": "node -e \"process.exit(0)\"" }, "dependencies": { "@moku-labs/core": "1.7.6", "@moku-labs/web": "0.40.0" } }
JSON
printf 'type: consumer\nname: habits\ncore_version: 1.7.6\nframework: web\n' > .planning/moku.md
printf '{ "version": 1, "changes": [], "ideas": [] }\n' > .planning/state.json
printf '.planning/\nnode_modules/\n' > .gitignore
for p in habits streaks reminders; do
  printf '/**\n * @file The %s plugin.\n */\nexport { %sPlugin } from "./plugin";\n' "$p" "$p" > src/plugins/$p/index.ts
  printf 'import { createPlugin } from "@moku-labs/core";\n\nexport const %sPlugin = createPlugin("%s", { api: () => ({}) });\n' "$p" "$p" > src/plugins/$p/plugin.ts
done
printf '# habits\n\nA habit tracker on @moku-labs/web: habits, streaks, reminders. Phone-first UI.\n' > README.md
mkdir -p src/components src/styles
cat > src/components/habit-card.tsx <<'TSX'
/** The card of one habit on the list screen. */
export function HabitCard({ name }: { name: string }) {
  return (
    <article data-habit-card>
      <h2 data-title>{name}</h2>
      <button data-save type="button">Сохранить</button>
      <button data-delete type="button" aria-label="Удалить"><span data-icon="basket" /></button>
      <button data-ok type="button">Ок</button>
    </article>
  );
}
TSX
cat > src/styles/habit-card.css <<'CSS'
@scope ([data-habit-card]) {
  :scope { padding: 16px; }
  [data-title] { font-size: 18px; }
  [data-save] { background: var(--color-accent-blue); }
}
[data-bottom-bar] { box-shadow: 0 -2px 8px rgb(0 0 0 / 0.2); }
CSS
git add -A
git -c user.name=eval -c user.email=eval@example.test commit -q -m init
