#!/usr/bin/env bash
# A plugin folder with one file of logic, one file of plain data and one file of types. No tests yet.
# The spec promises four behaviours. The agent is asked for the tests.
set -euo pipefail
git init -q -b main .
P=src/plugins/cart
mkdir -p "$P/__tests__/unit" .planning/specs
printf '{ "name": "shop", "type": "module", "scripts": { "test": "bun test" }, "dependencies": { "@moku-labs/core": "1.7.1" } }\n' > package.json
printf 'type: consumer\nname: shop\ncore_version: 1.7.1\n' > .planning/moku.md
printf '{ "version": 1, "changes": [{ "id": "2026-10-11-cart", "title": "Cart totals", "type": "feature", "size": "S", "status": "open", "station": "build", "done": ["intake"], "checklist": { "tests": false, "verify": false, "docs": false }, "paused": false }], "ideas": [] }\n' > .planning/state.json
printf '.planning/\nnode_modules/\ncoverage/\n' > .gitignore
cat > "$P/rules.ts" <<'TS'
/** An order ships free from this sum, in cents. */
export const FREE_SHIPPING_FROM = 5000;

/** What shipping costs below that sum, in cents. */
export const SHIPPING = 490;

/** One line of a cart. */
export type Line = { price: number; quantity: number };

/**
 * The price of one line.
 *
 * @param line - the line
 * @returns price times quantity, in cents
 * @throws RangeError when the quantity is negative
 */
export function lineTotal(line: Line): number {
  if (line.quantity < 0) throw new RangeError("quantity must not be negative");

  return line.price * line.quantity;
}

/**
 * What the customer pays for a cart, shipping included.
 *
 * @param lines - the lines of the cart
 * @returns the sum in cents; an empty cart pays nothing
 */
export function total(lines: Line[]): number {
  const sum = lines.reduce((running, line) => running + lineTotal(line), 0);
  if (sum === 0) return 0;

  return sum >= FREE_SHIPPING_FROM ? sum : sum + SHIPPING;
}
TS
cat > "$P/tokens.ts" <<'TS'
/** The colours of the cart badge. Plain data. */
export const colors = Object.freeze({ badge: 0xf4574b, ink: 0x5b4a63, paper: 0xfaeeda });
TS
cat > "$P/types.ts" <<'TS'
export type { Line } from "./rules";
TS
cat > .planning/specs/01-cart.md <<'MD'
# cart

## Verification
- A line with a negative quantity is refused with a RangeError.
- An order of 50.00 or more ships free.
- An order under 50.00 pays 4.90 shipping.
- An empty cart totals 0 and pays no shipping.
- `bun test src/plugins/cart` is green.
MD
git add -A
git -c user.name=eval -c user.email=eval@example.test commit -q -m init
