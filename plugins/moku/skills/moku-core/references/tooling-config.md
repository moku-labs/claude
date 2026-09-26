# Tooling Configuration Reference

Exact configurations from moku_core. Use these as the reference when scaffolding new projects.

> **Stack version: 3** (TypeScript 6 baseline · Node 24 runtime floor). This file is the canonical target stack that
> `/moku:init` scaffolds and `/moku:upgrade` migrates existing projects toward. A machine-readable
> summary lives in `target-stack.md`; the per-version migration steps live in
> `upgrade-migrations.md`. When you change a pinned version or a tsconfig default here, bump the
> stack version in `target-stack.md` and add a migration entry in `upgrade-migrations.md`.

## package.json (devDependencies)

```json
{
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.mts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist", "LICENSE", "README.md"],
  "repository": { "type": "git", "url": "git+https://github.com/<owner>/<repo>.git" },
  "homepage": "https://github.com/<owner>/<repo>#readme",
  "bugs": { "url": "https://github.com/<owner>/<repo>/issues" },
  "engines": { "node": ">=24.0.0", "bun": ">=1.3.14" },
  "devDependencies": {
    "@arethetypeswrong/cli": "0.18.3",
    "@arethetypeswrong/core": "0.18.3",
    "@biomejs/biome": "2.4.16",
    "@types/bun": "1.3.14",
    "@vitest/coverage-istanbul": "4.0.18",
    "eslint": "9.39.3",
    "eslint-config-biome": "2.1.3",
    "eslint-plugin-jsdoc": "62.6.0",
    "eslint-plugin-sonarjs": "4.0.0",
    "eslint-plugin-unicorn": "63.0.0",
    "globals": "17.4.0",
    "jiti": "2.6.1",
    "lefthook": "2.1.1",
    "publint": "0.3.21",
    "tsdown": "0.22.1",
    "typescript": "6.0.3",
    "typescript-eslint": "8.58.0",
    "vitest": "4.0.18"
  },
  "scripts": {
    "lint": "biome check . && eslint .",
    "lint:fix": "biome check --write . && eslint --fix .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:coverage": "vitest run --project unit --project integration --coverage",
    "build": "tsdown",
    "validate": "publint && attw --pack . --profile node16"
  }
}
```

### The script contract

CI and the release commands call scripts by name, so the names are a contract. A package carries all
eight; an app carries the first five.

| Script | Who calls it | Present in |
|---|---|---|
| `lint` | `ci.yml`, lefthook | every project |
| `typecheck` | `ci.yml` | every project |
| `test` | `ci.yml`, lefthook | every project |
| `build` | `ci.yml`, lefthook | every project |
| `validate` | `ci.yml`, lefthook | packages (publint + attw) |
| `release:setup` | the person, once per repository | packages |
| `release:doctor` | the person, before the first release | packages |
| `release` | `publish.yml` and the person | packages |

The three `release:*` scripts come from the `moku-release` bin of `@moku-labs/ci` (a dev dependency):
`moku-release setup`, `moku-release doctor`, `moku-release`.

> **`repository` is required for npm provenance.** Publishing with provenance (automatic under
> OIDC Trusted Publishing — see the `moku:moku-release` skill) fails `E422` unless `package.json`
> declares a `repository.url` matching the GitHub repo. Replace `<owner>/<repo>` with the real
> slug (e.g. `moku-labs/worker`); drop `homepage`/`bugs` if unused, but keep `repository`.

## biome.json

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.16/schema.json",
  "files": {
    "includes": ["src/**", "tests/**", "*.config.ts"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "none",
      "arrowParentheses": "asNeeded",
      "bracketSpacing": true
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noConsole": {
          "level": "warn",
          "options": { "allow": ["assert", "error", "info", "warn"] }
        }
      }
    }
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on",
        "useSortedKeys": "off"
      }
    }
  },
  "overrides": [
    {
      "includes": ["tests/**"],
      "linter": {
        "rules": { "suspicious": { "noConsole": "off" } }
      }
    },
    {
      "includes": ["src/**/__tests__/**"],
      "linter": {
        "rules": { "suspicious": { "noConsole": "off" } }
      }
    },
    {
      "includes": ["*.config.ts"],
      "linter": {
        "rules": { "suspicious": { "noConsole": "off" } }
      }
    }
  ]
}
```

## eslint.config.ts

```typescript
import biomeConfig from "eslint-config-biome";
import jsdocPlugin from "eslint-plugin-jsdoc";
import sonarjs from "eslint-plugin-sonarjs";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

export default [
  // 1. Global ignores
  {
    ignores: ["dist/**", "coverage/**", "bun.lock", ".claude/**", ".planning/**", "node_modules/**", "declarations.d.ts"]
  },

  // 2. TypeScript parser for all TS files
  tseslint.configs.base,

  // 3. Unicorn recommended + abbreviation allowlist
  eslintPluginUnicorn.configs.recommended,
  {
    rules: {
      "unicorn/prevent-abbreviations": ["error", {
        // Pre-expanded so builds don't have to widen this mid-flight. See references/glossary.md.
        allowList: {
          ctx: true, fn: true, cb: true, ref: true, args: true, params: true, props: true,
          env: true, i18n: true, l10n: true, spa: true, ssg: true, ssr: true, seo: true,
          api: true, dev: true, prod: true, md: true, dir: true, doc: true, docs: true,
          db: true, util: true, utils: true, pkg: true, src: true, dist: true, config: true,
          cfg: true, e2e: true, cli: true, dom: true, css: true, html: true, url: true, uri: true,
          str: true, num: true, msg: true, err: true, req: true, res: true, opts: true, attr: true
        }
      }]
    }
  },

  // 4. SonarJS recommended
  // NOTE: The `!` non-null assertion is required because sonarjs types mark `configs` as
  // potentially undefined, but the `recommended` preset always exists at runtime.
  // If this causes type errors in future sonarjs versions, use: `sonarjs.configs?.recommended ?? {}`
  // biome-ignore lint/style/noNonNullAssertion: sonarjs types mark configs as possibly undefined but it exists at runtime
  sonarjs.configs!.recommended,

  // 5. JSDoc TypeScript preset
  jsdocPlugin.configs["flat/recommended-typescript-error"],

  // 5b. JSDoc style overrides
  {
    rules: {
      "jsdoc/no-types": "off",
      "jsdoc/tag-lines": ["error", "never", { startLines: 1 }]
    }
  },

  // 6. Source files: strict JSDoc requirements
  {
    files: ["src/**/*.ts"],
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            // API methods are documented on the members of the public `Api` types (block 6b), not
            // on the arrow functions that implement them.
            ArrowFunctionExpression: false,
            ClassDeclaration: true,
            FunctionDeclaration: true,
            FunctionExpression: true,
            MethodDefinition: true
          },
          contexts: ["TSInterfaceDeclaration", "TSTypeAliasDeclaration"]
        }
      ],
      "jsdoc/require-description": "error",
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      // An example is required only where a consumer reads it: see block 6b. A required example on
      // a private function becomes a copy of its signature.
      "jsdoc/require-example": "off",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "unicorn/require-module-specifiers": "off"
    }
  },

  // 6b. The public contract carries the docs and a scenario example. Only `types.ts` ships in the
  // `.d.mts`, so a consumer reads the members of the `…Api` types, never the implementation. API
  // means public, so there is no exemption: a member with no honest example moves off the API into a
  // plain function, or is deleted. Both member forms are covered: `navigate(path: string): R` and
  // `navigate: (path: string) => R`.
  {
    files: ["src/**/types.ts"],
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: true },
          contexts: [
            "TSInterfaceDeclaration",
            "TSTypeAliasDeclaration",
            "TSTypeAliasDeclaration[id.name=/Api$/] > TSTypeLiteral > :matches(TSMethodSignature, TSPropertySignature)",
            "TSInterfaceDeclaration[id.name=/Api$/] > TSInterfaceBody > :matches(TSMethodSignature, TSPropertySignature)"
          ]
        }
      ],
      "jsdoc/require-example": [
        "error",
        {
          contexts: [
            "TSTypeAliasDeclaration[id.name=/Api$/] > TSTypeLiteral > :matches(TSMethodSignature, TSPropertySignature)",
            "TSInterfaceDeclaration[id.name=/Api$/] > TSInterfaceBody > :matches(TSMethodSignature, TSPropertySignature)"
          ]
        }
      ]
    }
  },

  // 6c. No signature echo: an example whose whole body is one call with bare identifiers
  // (`shut(gate);`, `const api = createClockApi(ctx);`) tells the reader nothing. `contexts: ["any"]`
  // makes the rule read type members too; its default reads functions only.
  {
    files: ["src/**/*.ts"],
    rules: {
      "jsdoc/match-description": [
        "error",
        {
          mainDescription: false,
          contexts: ["any"],
          tags: {
            example:
              "^(?!\\s*```(?:ts|typescript)\\n\\s*(?:(?:const|let) \\w+(?:: [\\w.<>\\[\\]]+)? = )?(?:await )?[\\w.]+\\((?:[\\w.]+(?:, [\\w.]+)*)?\\);?\\s*```\\s*$)[\\s\\S]+$"
          }
        }
      ]
    }
  },

  // 7. Test files: relaxed rules
  {
    files: ["tests/**/*.ts", "src/plugins/**/__tests__/**/*.ts"],
    rules: {
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-description": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-example": "off",
      "jsdoc/match-description": "off",
      "unicorn/no-useless-undefined": "off",
      "sonarjs/no-duplicate-string": "off",
      "unicorn/prevent-abbreviations": "off"
    }
  },

  // 8. Config files: relaxed rules
  {
    files: ["*.config.ts"],
    rules: {
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-description": "off",
      "unicorn/no-abusive-eslint-disable": "off"
    }
  },

  // 9. MUST be last: eslint-config-biome disables rules Biome handles
  biomeConfig
];
```

## declarations.d.ts

Ambient module declarations for untyped JS packages. Required because `strict: true` enables `noImplicitAny`, which errors on imports from packages without type definitions.

```typescript
declare module "eslint-config-biome";
```

**Why:** `eslint-config-biome` is a JS-only package — no `.d.ts` files, no `types` field in its `package.json`. The ambient declaration tells TypeScript the module exists and treats its default export as `any`.

## tsconfig.json

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "types": ["bun"]
  },
  "include": ["src", "tests", "declarations.d.ts", "*.config.ts"]
}
```

> **TypeScript 6 note:** TS 6.0 changes two defaults that affect this config.
> (1) `types` now defaults to `[]` (it previously auto-included every `@types/*` package), so
> `"types": ["bun"]` is now **required** — without it `bunx tsc --noEmit` reports
> `Cannot find name 'Bun'`. This matches Bun's official TS6 guidance.
> (2) `rootDir` now defaults to the tsconfig directory; the build config below pins
> `"rootDir": "./src"` so emit layout is stable.
> Every other option here is already on the TS6 forward path: `verbatimModuleSyntax` is the
> replacement for the now-removed `importsNotUsedAsValues`/`preserveValueImports`; `module: Preserve`
> and `moduleResolution: bundler` are modern (not the removed `classic`/`amd`/`umd`); `strict` is now
> the TS6 default. `skipLibCheck: true` also shields the project from the refreshed ESNext lib
> snapshot and from `@types/bun` ↔ `@types/node` lib clashes.

## tsconfig.build.json

Extends the main tsconfig for build output with declaration emit. Used by tsdown.

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "emitDeclarationOnly": true,
    "rootDir": "./src",
    "outDir": "dist"
  }
}
```

**Note:** `isolatedDeclarations` is intentionally omitted. It requires explicit type annotations on all exports, which conflicts with Moku's destructured export pattern (`export const { createApp } = framework`). Regular `declaration: true` infers types from the full project.

## tsdown.config.ts

Build configuration for tsdown. Produces ESM + CJS with declaration files.

```typescript
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts"
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: false,
  tsconfig: "tsconfig.build.json"
});
```

## vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", include: ["tests/unit/**/*.test.ts", "src/plugins/**/__tests__/unit/**/*.test.ts"] } },
      { test: { name: "integration", include: ["tests/integration/**/*.test.ts", "src/plugins/**/__tests__/integration/**/*.test.ts"] } }
    ],
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.ts"],
      exclude: ["src/**/types.ts", "src/**/types/**", "src/**/__tests__/**"],
      reporter: ["text", "lcov"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 }
    }
  }
});
```

## lefthook.yml

```yaml
pre-commit:
  skip:
    - run: test ! -d node_modules
  jobs:
    - name: build-and-validate
      run: bun run build && bun run validate
    - name: biome-format
      glob: "*.{ts,js,mjs,cjs,json,jsonc}"
      run: bunx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true --colors=off {staged_files}
      stage_fixed: true
    - name: eslint-check
      glob: "*.{ts,js,mjs,cjs}"
      run: bunx eslint --no-fix {staged_files}
    - name: test-all
      run: bun run test:unit && bun run test:integration
```

The `skip` line makes the hook step aside in a tree without `node_modules`: a PR snapshot worktree or a
fresh clone cannot run the build, lint or tests, and the checks already passed in the checkout that has
them. In a project whose `lefthook.yml` predates this line, commit such a snapshot with `--no-verify`, and
only there: the tree was checked in the main checkout, so the hook has nothing to add. Everywhere else
`--no-verify` stays forbidden. The moku `verify-before-commit` hook skips its own tsc and lint gate on the
same condition.

## .github/workflows

Two thin files, scaffolded from the first commit. They call the shared reusable workflows in
`moku-labs/ci`, so the project keeps no pipeline of its own.

| Project kind | Files | Calls |
|---|---|---|
| Package (framework or library) | `ci.yml`, `publish.yml` | `moku-labs/ci/.github/workflows/*@v1` |
| App | `ci.yml` | the app-deploy workflow in the same repository |

Copy the exact YAML from the installed `@moku-labs/ci` package (`node_modules/@moku-labs/ci/examples/`);
this plugin carries no copy of it. Do not write the workflow YAML by hand: the publish
path is tokenless OIDC Trusted Publishing, and a hand-rolled variant breaks provenance. The
rationale and the first-publish bootstrap live in the `moku:moku-release` skill (`references/release-model.md`).

## .editorconfig

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

## bunfig.toml

```toml
[install]
exact = true
```

## .bun-version

```
1.3.14
```

## .gitignore

```
# dependencies
node_modules

# output
out
dist
*.tgz

# code coverage
coverage
*.lcov

# logs
logs
_.log
report.[0-9]_.[0-9]_.[0-9]_.[0-9]_.json

# dotenv environment variable files
.env
.env.development.local
.env.test.local
.env.production.local
.env.local

# caches
.eslintcache
.cache
*.tsbuildinfo

# IntelliJ based IDEs
.idea

# Finder (MacOS) folder config
.DS_Store

# Claude Code
.claude

# Planning artifacts
.planning
```

## CLAUDE.md

Generate a project-specific CLAUDE.md based on the framework name and structure. Template:

```markdown
# [Framework Name]

[One-line description] built on @moku-labs/core.

## Package Manager

Use `bun` exclusively — never npm, yarn, or pnpm.

## Scripts

- `bun run build` — Build with tsdown
- `bun run lint` — Biome check + ESLint
- `bun run lint:fix` — Auto-fix lint issues
- `bun run format` — Format with Biome
- `bun run test` — Run all tests (vitest)
- `bun run test:unit` — Unit tests only
- `bun run test:integration` — Integration tests only
- `bun run test:coverage` — Tests with coverage

## Code Style

- **Formatter:** Biome (2-space indent, double quotes, semicolons, no trailing commas)
- **Linter:** ESLint 9 flat config + Biome (biome-config-biome must be LAST)
- **TypeScript:** Strict mode with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`
- **Imports:** Use `import type` enforced via `@typescript-eslint/consistent-type-imports`
- **JSDoc:** Required on all source exports with descriptions, params, returns, and examples

## Architecture

Three-layer Moku model:
1. `src/config.ts` — `createCoreConfig` (Layer 1: config + events)
2. `src/index.ts` — `createCore` (Layer 2: framework + plugins)
3. Consumer apps use `createApp` (Layer 3)

Plugins go in `src/plugins/`.

## Testing

- Vitest with unit + integration projects
- Framework-level tests: `tests/unit/` and `tests/integration/` (cross-plugin scenarios, createApp validation)
- Plugin-specific tests: `src/plugins/[name]/__tests__/unit/` and `__tests__/integration/` (colocated inside each plugin)
- 90% coverage threshold
- Never put plugin-specific tests in root `tests/` — root tests are for framework-level integration only

## Moku Development Toolkit

This project uses the **moku** Claude Code plugin. Talk to it in plain words — the `moku` conductor
skill works out where the project stands and drives the lifecycle (intake, brainstorm, design, plan,
build, verify, e2e, release, close). You never need to remember a command.

Underneath the conversation, `moku-rails` enforces the order: a source file cannot be written before
the station that is allowed to write it. When a write is refused, the reason names the missing step.

Useful directly:

- `/moku:status` — where the project stands.
- `/moku:check` — diagnostics on the installation and the project.
- `/moku:verify` — the validator fan-out with the auto-fix loop.
- `/moku:upgrade` — move the toolchain to the current target stack.

Knowledge skills load themselves when the topic comes up: **moku-core** (architecture, factory
chain, lifecycle, events), **moku-plugin** (plugin structure and tiers), **moku-common-conventions** (`ctx.log`,
`ctx.env`, the branded CLI rules MC1–MC3), **moku-testing**, **moku-readable-code**, plus the framework pack for
whatever this project uses.

## Specification

For questions about how things should be implemented, refer to the [Moku Core specification](https://github.com/moku-labs/core/tree/main/specification).
```

## .claude/settings.local.json

Safe default permissions for Claude Code agents working in a Moku project. These cover all common development operations without requiring per-command approval.

```json
{
  "permissions": {
    "allow": [
      "Bash(bun install)",
      "Bash(bun run:*)",
      "Bash(bun test:*)",
      "Bash(bunx tsc:*)",
      "Bash(bunx biome:*)",
      "Bash(bunx eslint:*)",
      "Bash(bunx vitest:*)",
      "Bash(bunx lefthook:*)",
      "Bash(bunx publint:*)",
      "Bash(bunx attw:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git branch:*)",
      "Bash(git show:*)",
      "Bash(git remote:*)",
      "Bash(ls:*)",
      "Bash(tree:*)",
      "Bash(wc:*)",
      "Bash(mkdir:*)",
      "Bash(cat:*)"
    ]
  }
}
```

**What's included:**
- **Bun:** install, run scripts, test, all bunx tool invocations (tsc, biome, eslint, vitest, lefthook, publint, attw)
- **Git (read-only):** status, log, diff, branch, show, remote
- **File system (read-only):** ls, tree, wc, cat, mkdir

**What's NOT included (requires explicit approval):**
- `git add`, `git commit`, `git push` — destructive/shared operations
- `rm`, `mv` — destructive file operations
- `bun add`, `bun remove` — dependency changes

## cspell.json

Pre-seeded spell-check dictionary so the live spell-checker doesn't flag valid moku/domain terms in
comments, docs, and Markdown. Seed `words` from `references/glossary.md` (flatten its grouped lists).

```json
{
  "version": "0.2",
  "language": "en",
  "words": [
    "Moku", "createCoreConfig", "createCore", "createApp", "createPlugin", "createCorePlugin",
    "createState", "pluginConfigs", "onInit", "onStart", "onStop", "ctx", "microkernel",
    "bun", "bunx", "tsdown", "rolldown", "vite", "vitest", "biome", "eslint", "publint", "lefthook",
    "tsc", "noEmit", "monorepo", "frontmatter", "gitignore", "worktree", "argv", "stdout", "stderr",
    "cwd", "dotenv", "cspell", "SSG", "SPA", "SSR", "SEO", "HMR", "preact", "VNode", "hydration",
    "remark", "rehype", "shiki", "satori", "resvg", "hast", "mdast", "Cloudflare", "wrangler",
    "NFKD", "subprocess", "afplay", "paplay", "expectTypeOf", "EISDIR", "antipatterns"
  ],
  "ignorePaths": ["node_modules/**", "dist/**", ".planning/**"]
}
```

## Key Conventions

- **Package manager:** bun (not npm/yarn)
- **Formatter:** Biome (2-space, double quotes, semicolons, no trailing commas)
- **Linter:** ESLint 9 flat config + Biome (biome-config-biome must be LAST in ESLint array)
- **TypeScript:** Strict mode with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`
- **Testing:** Vitest with unit + integration projects, 90% coverage threshold
- **Git hooks:** Lefthook pre-commit (build, format, lint, test)
- **Import style:** `import type` enforced via `@typescript-eslint/consistent-type-imports`
- **JSDoc:** Required on all source exports (functions, types, interfaces) with descriptions, params and returns. API method docs and a scenario `@example` live on the members of the `Api` type in `types.ts`, never on the implementation. No `@example` on functions that take `ctx`. An example never repeats the signature, and every example is true

## Optional: ESLint JSDoc backstop for factory-const exports

Biome (the primary linter) and ESLint's default `jsdoc/require-jsdoc` both IGNORE a
`VariableDeclaration` initialized by a `CallExpression`, so a factory-result export
like `export const routerPlugin = createPlugin("router", {})` ships undocumented while
lint stays green. If a project also runs ESLint, add a `contexts` entry so the
factory-const case is caught at lint time too:

```jsonc
// .eslintrc.json (only if ESLint is in the stack — Biome cannot express this rule)
{
  "rules": {
    "jsdoc/require-jsdoc": ["error", {
      "contexts": ["ExportNamedDeclaration > VariableDeclaration > VariableDeclarator"]
    }]
  }
}
```

This covers Gap B (factory-result consts). It does NOT catch Gap A (destructured
`export const { … } = …`) — no lint rule does; that one is prevented by the
explicit-re-export convention and flagged by `moku-style-validator`. A file-level
`@file` comment must never be treated as satisfying a per-export requirement (Gap C).
