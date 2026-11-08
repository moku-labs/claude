#!/usr/bin/env bash
# A moku game whose change "daily reward" sits at the design station. The frame is done: the concept spec
# names the screens and states with their ids, the target aspect ratios and the moments the feature needs.
# Round 1 has not been generated yet.
set -euo pipefail
git init -q -b main .
D=.planning/design/daily-reward
mkdir -p "$D/concepts" "$D/screenshots"
printf '{ "name": "moss-ember", "type": "module", "dependencies": { "@moku-labs/game": "0.13.0" }, "devDependencies": { "@moku-labs/editor": "0.9.3" } }\n' > package.json
printf 'type: game\nname: moss-ember\n' > .planning/moku.md
printf '.planning/\nnode_modules/\n' > .gitignore
printf '{ "version": 1, "changes": [{ "id": "2026-11-06-daily-reward", "title": "Daily reward", "type": "feature", "size": "M", "status": "open", "station": "design", "done": ["intake"], "checklist": { "tests": false, "verify": false, "docs": false }, "paused": false }], "ideas": [] }\n' > .planning/state.json
cat > "$D/concept-spec.md" <<'MD'
# Concept Spec: Daily reward

## Scope
element — the daily reward popup over the game hub, and the hub's reward counter it pays into.

## Feature checklist (every concept demonstrates all of these)
- The hub with the coin counter and a pulsing "Daily" button
- The popup opens over a dimmed hub and shows today's chest among the 7-day streak
- Claim: the chest opens, coins fly into the hub counter, the counter rolls up
- Already claimed today: the Claim button is disabled and says when the next one is ready
- No connection: claiming fails with an error and Retry

## Screens / surfaces to include
| State id | What it shows |
|---|---|
| hub.default | The hub: counter 1 240 coins, the Daily button pulsing |
| reward.open | The popup open, day 4 of 7 highlighted, Claim enabled |
| reward.claimed | After the claim: chest open, +150 shown, counter 1 390 |
| reward.disabled | Today already claimed: Claim disabled, "Next reward in 05:12:40" |
| reward.error | Claim failed: "No connection", Retry |
| loading | The hub loading: progress bar at 60 % |

## Target sizes (web and game)
- 390x844 — 9:19.5, safe area 47/34
- 390x693 — 9:16, safe area 24/0
- 768x1024 — 3:4 tablet, safe area 24/20

## Motion (web and game)
All the required game events of design-motion.md §2. This feature must have: the popup entrance, the chest
opening, the coins flying into the counter, the counter roll, the disabled tap, the error, an idle on the
Daily button, the loading bar.

## Demo data (identical across all concepts, frozen)
- Player: Wren, level 12, 1 240 coins
- Streak: day 1 50, day 2 75, day 3 100, day 4 150 (today), day 5 200, day 6 300, day 7 a gem chest
- Next reward in 05:12:40

## Constraints
- Self-contained prototype: one HTML file, inline CSS and JS, Google Fonts only
- Same features and same demo data in every concept; only the design varies
MD
cat > "$D/state.md" <<'MD'
# Design State: daily-reward

## Target: the daily reward popup
## Scope: element
## Modes: ui
## Medium: game
## Stage: round-1-generating
## Round: 1
## Concepts: 0
## Winner: (none)
## ConceptSpec: .planning/design/daily-reward/concept-spec.md
## BrainstormContext: (none)
## Created: 2026-11-06T09:00Z
## Last Updated: 2026-11-06T09:00Z
## Next Action: generate round 1

## Recovery
- Last good step: concept spec written
- Open blockers: none
- Next action: generate round 1
- Updated: 2026-11-06T09:00Z
MD
printf '# Design Index\n\n| Slug | Target | Scope | Medium | Stage | Winner | Updated |\n|---|---|---|---|---|---|---|\n| daily-reward | the daily reward popup | element | game | round-1-generating | (none) | 2026-11-06T09:00Z |\n' > .planning/design/index.md
