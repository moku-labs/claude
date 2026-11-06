#!/usr/bin/env bash
# A moku web app whose change "pricing page" sits at the design station. The frame is done: the concept spec
# names the states with their ids, the target sizes and the moments the page needs. Round 1 has not been
# generated yet.
set -euo pipefail
git init -q -b main .
D=.planning/design/pricing-page
mkdir -p "$D/concepts" "$D/screenshots"
printf '{ "name": "ledgerly", "type": "module", "dependencies": { "@moku-labs/core": "1.7.1", "@moku-labs/web": "1.12.4" } }\n' > package.json
printf 'type: consumer\nname: ledgerly\n' > .planning/moku.md
printf '.planning/\nnode_modules/\n' > .gitignore
printf '{ "version": 1, "changes": [{ "id": "2026-11-06-pricing", "title": "Pricing page", "type": "feature", "size": "M", "status": "open", "station": "design", "done": ["intake"], "checklist": { "tests": false, "verify": false, "docs": false }, "paused": false }], "ideas": [] }\n' > .planning/state.json
cat > "$D/concept-spec.md" <<'MD'
# Concept Spec: Pricing page

## Scope
page — the pricing page of Ledgerly, a bookkeeping app for freelancers, and its checkout modal.

## Feature checklist (every concept demonstrates all of these)
- Header with the logo, nav (Product, Pricing, Docs) and Sign in; on phones the nav is a menu
- Monthly / yearly toggle; yearly shows "2 months free"
- Three plans: Solo, Studio (highlighted), Agency, each with price, five features and a CTA
- A FAQ with four questions that expand
- Choosing a plan opens the checkout modal: plan summary, email, Pay; paying shows loading, then success or an error

## Screens / surfaces to include
| State id | What it shows |
|---|---|
| pricing.monthly | The page, monthly prices |
| pricing.yearly | The page, yearly prices and the "2 months free" badge |
| pricing.menu | Phone layout with the nav menu open |
| pricing.faq-open | The second FAQ question expanded |
| checkout.open | The checkout modal for Studio |
| checkout.loading | Paying: the Pay button loading |
| checkout.error | "Card declined", try again |
| checkout.success | "You're on Studio", go to dashboard |

## Target sizes (web and game)
- 390x844 phone, 768x1024 tablet, 1440x900 desktop

## Motion (web and game)
All the web events of design-motion.md §2: the page and the plans appearing, the price change on the toggle,
hover, focus and press on the CTAs, the menu, the modal, the FAQ expanding, the loading Pay button.

## Demo data (identical across all concepts, frozen)
- Solo €9 / month, €90 / year — 1 user, 50 invoices, expenses, VAT report, email support
- Studio €24 / month, €240 / year — 5 users, unlimited invoices, expenses, VAT report, priority support
- Agency €59 / month, €590 / year — 20 users, unlimited invoices, client portal, API, a named manager
- FAQ: Can I switch plans? Do you offer refunds? Is my data safe? Do you support VAT MOSS?

## Constraints
- Self-contained prototype: one HTML file, inline CSS and JS, Google Fonts only
- Same features and same demo data in every concept; only the design varies
MD
cat > "$D/state.md" <<'MD'
# Design State: pricing-page

## Target: the pricing page
## Scope: page
## Modes: ui
## Medium: web
## Stage: round-1-generating
## Round: 1
## Concepts: 0
## Winner: (none)
## ConceptSpec: .planning/design/pricing-page/concept-spec.md
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
printf '# Design Index\n\n| Slug | Target | Scope | Medium | Stage | Winner | Updated |\n|---|---|---|---|---|---|---|\n| pricing-page | the pricing page | page | web | round-1-generating | (none) | 2026-11-06T09:00Z |\n' > .planning/design/index.md
