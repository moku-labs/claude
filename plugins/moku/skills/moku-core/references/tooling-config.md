# Tooling Configuration Reference

Exact configurations from moku_core. Use these as the reference when scaffolding new projects.

> **Stack version: 4** (current lint stack: Biome + oxlint · TypeScript 7 · Node 24 runtime floor).
> This file is the canonical target stack that `/moku:init` scaffolds and `/moku:upgrade` migrates
> existing projects toward. A machine-readable summary lives in `target-stack.md`; the per-version
> migration steps live in
> `upgrade-migrations.md`. When you change a pinned version or a tsconfig default here, bump the
> stack version in `target-stack.md` and add a migration entry in `upgrade-migrations.md`.
>
> **Two lint stacks** (`lint-stacks.md`). Everything above the last section is the **current stack**:
> Biome + oxlint on TypeScript 7. A new project always gets it. The ESLint material lives in
> `## Legacy stack (ESLint, TypeScript 6)` at the end, kept for projects that have `eslint.config.*`.

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
    "eslint-plugin-jsdoc": "65.1.0",
    "eslint-plugin-unicorn": "63.0.0",
    "lefthook": "2.1.1",
    "oxlint": "1.86.0",
    "publint": "0.3.21",
    "tsdown": "0.23.0",
    "typescript": "7.0.2",
    "vitest": "4.0.18"
  },
  "scripts": {
    "lint": "biome check . && oxlint",
    "lint:fix": "biome check --write . && oxlint --fix",
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

Pins that matter:

| Package | Pin | Why |
|---|---|---|
| `typescript` | `7.0.2` | The native compiler. It has no JS API; nothing in this stack needs one. |
| `tsdown` | `0.23.0` | First version whose dts plugin (`rolldown-plugin-dts` 0.28) emits declarations through the TypeScript 7 binary. `0.22.1` fails on TS 7: `Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')`. |
| `oxlint` | `1.86.0` | JS plugins are alpha; re-check the notes under `.oxlintrc.json` on every bump. |
| `eslint-plugin-unicorn` | `63.0.0` | Exact. 70 and later fail to load as an oxlint JS plugin. |
| `eslint-plugin-jsdoc` | `65.1.0` | Loaded by oxlint, not by ESLint. |
| `@arethetypeswrong/cli` / `core` | `0.18.3` | Bundles its own TypeScript 5.6; independent of the project's TS 7. |

`eslint-plugin-jsdoc` declares `eslint` as a peer, so `bun install` adds `eslint` to `node_modules`
on its own. Do not list it in `devDependencies` and never run it. The install also prints
`warn: incorrect peer dependency "typescript@7.0.2"` from the `@typescript-eslint/*` helpers inside
`eslint-plugin-jsdoc`; it is expected and harmless.

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
      "complexity": {
        "noExcessiveCognitiveComplexity": {
          "level": "error",
          "options": { "maxAllowedComplexity": 15 }
        }
      },
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

## .oxlintrc.json

The second linter of the current stack. Plain data: copy the body as is. Biome covers formatting,
imports and its recommended rules; oxlint carries what Biome lacks.

- `unicorn/*`: the 112 rules of unicorn's recommended set, run natively by oxlint.
- `jsdoc-js/*`: every jsdoc rule, through `eslint-plugin-jsdoc` loaded as an oxlint JS plugin. The
  native oxlint jsdoc rules are not used: their ports fire on undocumented inner arrows.
- `unicorn-js/prevent-abbreviations`: the one unicorn rule oxlint lacks, through
  `eslint-plugin-unicorn@63.0.0` as a JS plugin, with the pre-expanded allowList (see
  `glossary.md`). Do not shrink the list.
- `jsdoc` and `unicorn` are reserved plugin names in oxlint, so the JS plugins carry the aliases
  `jsdoc-js` and `unicorn-js`. A disable comment uses the alias:
  `// eslint-disable-next-line jsdoc-js/require-jsdoc -- thin wiring`.
- No sonarjs. Cognitive complexity is Biome's `noExcessiveCognitiveComplexity` (max 15) in `biome.json`.
- No type-aware rules yet (`options.typeAware` stays off).

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": [
    "unicorn",
    "typescript"
  ],
  "jsPlugins": [
    {
      "name": "jsdoc-js",
      "specifier": "eslint-plugin-jsdoc"
    },
    {
      "name": "unicorn-js",
      "specifier": "eslint-plugin-unicorn"
    }
  ],
  "categories": {
    "correctness": "off"
  },
  "env": {
    "builtin": true,
    "es2026": true
  },
  "ignorePatterns": [
    "dist/**",
    "coverage/**",
    ".claude/**",
    ".planning/**",
    "declarations.d.ts"
  ],
  "rules": {
    "jsdoc-js/check-access": "error",
    "jsdoc-js/check-alignment": "error",
    "jsdoc-js/check-param-names": "error",
    "jsdoc-js/check-property-names": "error",
    "jsdoc-js/check-tag-names": [
      "error",
      {
        "typed": true
      }
    ],
    "jsdoc-js/check-types": "error",
    "jsdoc-js/check-values": "error",
    "jsdoc-js/empty-tags": "error",
    "jsdoc-js/escape-inline-tags": "error",
    "jsdoc-js/implements-on-classes": "error",
    "jsdoc-js/multiline-blocks": "error",
    "jsdoc-js/no-defaults": "error",
    "jsdoc-js/no-multi-asterisks": "error",
    "jsdoc-js/reject-any-type": "error",
    "jsdoc-js/reject-function-type": "error",
    "jsdoc-js/require-next-type": "error",
    "jsdoc-js/require-param-description": "error",
    "jsdoc-js/require-param-name": "error",
    "jsdoc-js/require-property": "error",
    "jsdoc-js/require-property-description": "error",
    "jsdoc-js/require-property-name": "error",
    "jsdoc-js/require-returns-check": "error",
    "jsdoc-js/require-returns-description": "error",
    "jsdoc-js/require-throws-type": "error",
    "jsdoc-js/require-yields": "error",
    "jsdoc-js/require-yields-check": "error",
    "jsdoc-js/require-yields-type": "error",
    "jsdoc-js/tag-lines": [
      "error",
      "never",
      {
        "startLines": 1
      }
    ],
    "jsdoc-js/ts-no-empty-object-type": "error",
    "jsdoc-js/valid-types": "error",
    "unicorn-js/prevent-abbreviations": [
      "error",
      {
        "allowList": {
          "ctx": true,
          "fn": true,
          "cb": true,
          "ref": true,
          "args": true,
          "params": true,
          "props": true,
          "env": true,
          "i18n": true,
          "l10n": true,
          "spa": true,
          "ssg": true,
          "ssr": true,
          "seo": true,
          "api": true,
          "dev": true,
          "prod": true,
          "md": true,
          "dir": true,
          "doc": true,
          "docs": true,
          "db": true,
          "util": true,
          "utils": true,
          "pkg": true,
          "src": true,
          "dist": true,
          "config": true,
          "cfg": true,
          "e2e": true,
          "cli": true,
          "dom": true,
          "css": true,
          "html": true,
          "url": true,
          "uri": true,
          "str": true,
          "num": true,
          "msg": true,
          "err": true,
          "req": true,
          "res": true,
          "opts": true,
          "attr": true
        }
      }
    ],
    "unicorn/catch-error-name": "error",
    "unicorn/consistent-assert": "error",
    "unicorn/consistent-date-clone": "error",
    "unicorn/consistent-empty-array-spread": "error",
    "unicorn/consistent-existence-index-check": "error",
    "unicorn/consistent-function-scoping": "error",
    "unicorn/error-message": "error",
    "unicorn/escape-case": "error",
    "unicorn/explicit-length-check": "error",
    "unicorn/filename-case": "error",
    "unicorn/import-style": "error",
    "unicorn/no-abusive-eslint-disable": "error",
    "unicorn/no-accessor-recursion": "error",
    "unicorn/no-anonymous-default-export": "error",
    "unicorn/no-array-callback-reference": "error",
    "unicorn/no-array-for-each": "error",
    "unicorn/no-array-method-this-argument": "error",
    "unicorn/no-array-reduce": "error",
    "unicorn/no-array-reverse": "error",
    "unicorn/no-array-sort": "error",
    "unicorn/no-await-expression-member": "error",
    "unicorn/no-await-in-promise-methods": "error",
    "unicorn/no-console-spaces": "error",
    "unicorn/no-empty-file": "error",
    "unicorn/no-hex-escape": "error",
    "unicorn/no-immediate-mutation": "error",
    "unicorn/no-instanceof-builtins": "error",
    "unicorn/no-invalid-fetch-options": "error",
    "unicorn/no-invalid-remove-event-listener": "error",
    "unicorn/no-lonely-if": "error",
    "unicorn/no-magic-array-flat-depth": "error",
    "unicorn/no-negated-condition": "error",
    "unicorn/no-negation-in-equality-check": "error",
    "unicorn/no-new-array": "error",
    "unicorn/no-new-buffer": "error",
    "unicorn/no-null": "error",
    "unicorn/no-object-as-default-parameter": "error",
    "unicorn/no-process-exit": "error",
    "unicorn/no-single-promise-in-promise-methods": "error",
    "unicorn/no-this-assignment": "error",
    "unicorn/no-unnecessary-array-flat-depth": "error",
    "unicorn/no-unnecessary-array-splice-count": "error",
    "unicorn/no-unnecessary-await": "error",
    "unicorn/no-unnecessary-slice-end": "error",
    "unicorn/no-unreadable-array-destructuring": "error",
    "unicorn/no-unreadable-iife": "error",
    "unicorn/no-useless-collection-argument": "error",
    "unicorn/no-useless-error-capture-stack-trace": "error",
    "unicorn/no-useless-fallback-in-spread": "error",
    "unicorn/no-useless-length-check": "error",
    "unicorn/no-useless-promise-resolve-reject": "error",
    "unicorn/no-useless-spread": "error",
    "unicorn/no-useless-undefined": "error",
    "unicorn/no-zero-fractions": "error",
    "unicorn/numeric-separators-style": "error",
    "unicorn/prefer-add-event-listener": "error",
    "unicorn/prefer-array-find": "error",
    "unicorn/prefer-array-flat": "error",
    "unicorn/prefer-array-some": "error",
    "unicorn/prefer-at": "error",
    "unicorn/prefer-bigint-literals": "error",
    "unicorn/prefer-blob-reading-methods": "error",
    "unicorn/prefer-class-fields": "error",
    "unicorn/prefer-classlist-toggle": "error",
    "unicorn/prefer-code-point": "error",
    "unicorn/prefer-default-parameters": "error",
    "unicorn/prefer-dom-node-append": "error",
    "unicorn/prefer-dom-node-dataset": "error",
    "unicorn/prefer-dom-node-remove": "error",
    "unicorn/prefer-dom-node-text-content": "error",
    "unicorn/prefer-event-target": "error",
    "unicorn/prefer-export-from": "error",
    "unicorn/prefer-global-this": "error",
    "unicorn/prefer-includes": "error",
    "unicorn/prefer-keyboard-event-key": "error",
    "unicorn/prefer-logical-operator-over-ternary": "error",
    "unicorn/prefer-math-min-max": "error",
    "unicorn/prefer-math-trunc": "error",
    "unicorn/prefer-modern-dom-apis": "error",
    "unicorn/prefer-modern-math-apis": "error",
    "unicorn/prefer-module": "error",
    "unicorn/prefer-native-coercion-functions": "error",
    "unicorn/prefer-negative-index": "error",
    "unicorn/prefer-number-properties": "error",
    "unicorn/prefer-object-from-entries": "error",
    "unicorn/prefer-optional-catch-binding": "error",
    "unicorn/prefer-prototype-methods": "error",
    "unicorn/prefer-query-selector": "error",
    "unicorn/prefer-reflect-apply": "error",
    "unicorn/prefer-regexp-test": "error",
    "unicorn/prefer-response-static-json": "error",
    "unicorn/prefer-set-has": "error",
    "unicorn/prefer-set-size": "error",
    "unicorn/prefer-single-call": "error",
    "unicorn/prefer-spread": "error",
    "unicorn/prefer-string-raw": "error",
    "unicorn/prefer-string-replace-all": "error",
    "unicorn/prefer-string-slice": "error",
    "unicorn/prefer-string-starts-ends-with": "error",
    "unicorn/prefer-string-trim-start-end": "error",
    "unicorn/prefer-structured-clone": "error",
    "unicorn/prefer-ternary": "error",
    "unicorn/prefer-top-level-await": "error",
    "unicorn/prefer-type-error": "error",
    "unicorn/relative-url-style": "error",
    "unicorn/require-array-join-separator": "error",
    "unicorn/require-module-attributes": "error",
    "unicorn/require-module-specifiers": "error",
    "unicorn/require-number-to-fixed-digits-argument": "error",
    "unicorn/switch-case-braces": "error",
    "unicorn/text-encoding-identifier-case": "error",
    "unicorn/throw-new-error": "error"
  },
  "overrides": [
    {
      "files": [
        "src/**/*.{ts,tsx}"
      ],
      "rules": {
        "jsdoc-js/require-jsdoc": [
          "error",
          {
            "require": {
              "ArrowFunctionExpression": false,
              "ClassDeclaration": true,
              "FunctionDeclaration": true,
              "FunctionExpression": true,
              "MethodDefinition": true
            },
            "contexts": [
              "TSInterfaceDeclaration",
              "TSTypeAliasDeclaration"
            ]
          }
        ],
        "jsdoc-js/require-description": "error",
        "jsdoc-js/require-param": "error",
        "jsdoc-js/require-param-description": "error",
        "jsdoc-js/require-returns": "error",
        "jsdoc-js/require-returns-description": "error",
        "jsdoc-js/require-example": "off",
        "jsdoc-js/match-description": [
          "error",
          {
            "mainDescription": false,
            "contexts": [
              "any"
            ],
            "tags": {
              "example": "^(?!\\s*```(?:ts|typescript)\\n\\s*(?:(?:const|let) \\w+(?:: [\\w.<>\\[\\]]+)? = )?(?:await )?[\\w.]+\\((?:[\\w.]+(?:, [\\w.]+)*)?\\);?\\s*```\\s*$)[\\s\\S]+$"
            }
          }
        ],
        "unicorn/require-module-specifiers": "off"
      }
    },
    {
      "files": [
        "src/**/types.ts"
      ],
      "rules": {
        "jsdoc-js/require-jsdoc": [
          "error",
          {
            "require": {
              "FunctionDeclaration": true,
              "ClassDeclaration": true,
              "MethodDefinition": true
            },
            "contexts": [
              "TSInterfaceDeclaration",
              "TSTypeAliasDeclaration",
              "TSTypeAliasDeclaration[id.name=/Api$/] > TSTypeLiteral > :matches(TSMethodSignature, TSPropertySignature)",
              "TSInterfaceDeclaration[id.name=/Api$/] > TSInterfaceBody > :matches(TSMethodSignature, TSPropertySignature)"
            ]
          }
        ],
        "jsdoc-js/require-example": [
          "error",
          {
            "contexts": [
              "TSTypeAliasDeclaration[id.name=/Api$/] > TSTypeLiteral > :matches(TSMethodSignature, TSPropertySignature)",
              "TSInterfaceDeclaration[id.name=/Api$/] > TSInterfaceBody > :matches(TSMethodSignature, TSPropertySignature)"
            ]
          }
        ]
      }
    },
    {
      "files": [
        "tests/**/*.{ts,tsx}",
        "src/**/__tests__/**/*.{ts,tsx}"
      ],
      "rules": {
        "jsdoc-js/require-jsdoc": "off",
        "jsdoc-js/require-description": "off",
        "jsdoc-js/require-param": "off",
        "jsdoc-js/require-returns": "off",
        "jsdoc-js/require-example": "off",
        "jsdoc-js/match-description": "off",
        "unicorn/no-useless-undefined": "off",
        "unicorn-js/prevent-abbreviations": "off"
      }
    },
    {
      "files": [
        "*.config.ts"
      ],
      "rules": {
        "jsdoc-js/require-jsdoc": "off",
        "jsdoc-js/require-description": "off",
        "unicorn/no-abusive-eslint-disable": "off"
      }
    }
  ]
}
```

> **oxlint JS plugins are alpha. Re-check on every oxlint bump.** Known with oxlint 1.86.0:
> (1) `eslint-plugin-unicorn` 70 and later fails to load as a JS plugin
> (`Options validation failed for rule 'unicorn-js/logical-assignment-operators'`), so unicorn stays
> pinned at `63.0.0`. (2) `jsdoc-js/tag-lines` reports on a single file but stays silent when oxlint
> lints two or more files; the `moku-style-validator` agent covers the blank line before tags until
> it is fixed. On a bump, run `bunx oxlint` on one file with a missing blank line before `@param`
> and on its folder, and try the newest unicorn.

## declarations.d.ts

Not written for a new project: the current stack imports no untyped JS package. Add the file only
when the project imports a JS-only package without types, put one `declare module "<name>";` line
per package in it, and add `"declarations.d.ts"` to `include` in `tsconfig.json`. `.oxlintrc.json`
already ignores it.

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
  "include": ["src", "tests", "*.config.ts"]
}
```

> **TypeScript 7 note:** this config runs unchanged on TS 7.0. TS 7 removes the options TS 6
> deprecated; none of them is here. TS 7 is a native binary with no JS API. `tsc` is the same
> command and much faster. A tool that imports `typescript` as a library does not work on it, for
> example `ts.transpileModule` or typescript-eslint. In a test, use `Bun.Transpiler` in place of
> `ts.transpileModule`.
>
> **TypeScript 6 defaults, still true on 7:**
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

**Declarations on TypeScript 7.** tsdown `0.23.0` picks the dts generator by itself: `oxc` when
`isolatedDeclarations` is on, otherwise `tsgo` when TypeScript 7.0 is installed. The `tsgo` generator
runs the TypeScript 7 binary with this tsconfig and reads its output, so no JS API is needed. Each
build prints `TypeScript 7.0 does not yet have a stable API and is experimental. Some options will be
unavailable.`; that line is expected. `rolldown-plugin-dts` accepts `typescript ~7.0.0`, so check its
range before moving TypeScript to 7.1. Do not keep a second `typescript@6` for declarations.

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
    - name: oxlint-check
      glob: "*.{ts,js,mjs,cjs}"
      run: bunx oxlint --no-error-on-unmatched-pattern {staged_files}
    - name: test-all
      run: bun run test:unit && bun run test:integration
```

**App variant.** An app (and a game) is not published and has no `validate`, `test:unit` or
`test:integration` script, so its hook runs the scripts it has. A game takes its own variant from the
`moku-game` pack, `references/hello-world.md`.

```yaml
pre-commit:
  skip:
    - run: test ! -d node_modules
  jobs:
    - name: build
      run: bun run build
    - name: biome-format
      glob: "*.{ts,tsx,js,mjs,cjs,json,jsonc}"
      run: bunx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true --colors=off {staged_files}
      stage_fixed: true
    - name: oxlint-check
      glob: "*.{ts,tsx,js,mjs,cjs}"
      run: bunx oxlint --no-error-on-unmatched-pattern {staged_files}
    - name: typecheck
      run: bun run typecheck
    - name: test
      run: bun run test
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
- `bun run lint` — Biome check + oxlint
- `bun run lint:fix` — Auto-fix lint issues
- `bun run format` — Format with Biome
- `bun run test` — Run all tests (vitest)
- `bun run test:unit` — Unit tests only
- `bun run test:integration` — Integration tests only
- `bun run test:coverage` — Tests with coverage

## Code Style

- **Formatter:** Biome (2-space indent, double quotes, semicolons, no trailing commas)
- **Linter:** Biome + oxlint (`.oxlintrc.json`: unicorn, jsdoc and abbreviation rules)
- **TypeScript:** 7, strict mode with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`
- **Imports:** Use `import type`, enforced by Biome `useImportType`
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
      "Bash(bunx oxlint:*)",
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
- **Bun:** install, run scripts, test, all bunx tool invocations (tsc, biome, oxlint, vitest, lefthook, publint, attw)
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
    "bun", "bunx", "tsdown", "rolldown", "vite", "vitest", "biome", "oxlint", "oxc", "tsgo", "publint", "lefthook",
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
- **Linter:** Biome + oxlint (`.oxlintrc.json`); the legacy ESLint stack only where `eslint.config.*` exists
- **TypeScript:** 7, strict mode with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`
- **Testing:** Vitest with unit + integration projects, 90% coverage threshold
- **Git hooks:** Lefthook pre-commit (build, format, lint, test)
- **Import style:** `import type`, enforced by Biome `useImportType`
- **JSDoc:** Required on all source exports (functions, types, interfaces) with descriptions, params and returns. API method docs and a scenario `@example` live on the members of the `Api` type in `types.ts`, never on the implementation. No `@example` on functions that take `ctx`. An example never repeats the signature, and every example is true

## Legacy stack (ESLint, TypeScript 6)

Kept for projects that have `eslint.config.*`; never written for a new project. A legacy project
keeps working untouched on these pins until its owner runs the opt-in `moku-lint-oxlint` migration in
`/moku:upgrade` (`lint-stacks.md`). typescript-eslint needs the TypeScript JS API, so this stack stays
on TypeScript 6: on TS 7 ESLint crashes with `Cannot read properties of undefined (reading 'Intrinsic')`.

The legacy `biome.json` has no `complexity` block: sonarjs covers cognitive complexity there.
Everything else not listed here is the same as in the current stack, for example
`tsconfig.build.json`, `vitest.config.ts` and the release files.

### devDependencies and scripts

```json
{
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
    "lint:fix": "biome check --write . && eslint --fix ."
  }
}
```

`typescript-eslint` 8.58.0 is the first version that supports TS 6. `tsdown` 0.22.1 is the first whose
`typescript` peer allows `^6`.

### eslint.config.ts

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

### declarations.d.ts and tsconfig include

`eslint-config-biome` is a JS-only package with no types, and `strict` turns on `noImplicitAny`, so
`eslint.config.ts` needs an ambient declaration:

```typescript
declare module "eslint-config-biome";
```

`tsconfig.json` then carries it: `"include": ["src", "tests", "declarations.d.ts", "*.config.ts"]`.

### lefthook and permissions

Both lefthook variants run ESLint in place of oxlint:

```yaml
    - name: eslint-check
      glob: "*.{ts,js,mjs,cjs}"          # "*.{ts,tsx,js,mjs,cjs}" in the app variant
      run: bunx eslint --no-fix {staged_files}
```

`.claude/settings.local.json` allows `Bash(bunx eslint:*)` in place of `Bash(bunx oxlint:*)`. The
CLAUDE.md template says `Biome check + ESLint` and `ESLint 9 flat config + Biome (eslint-config-biome
must be LAST)`, and import style comes from `@typescript-eslint/consistent-type-imports`.

### Optional: ESLint JSDoc backstop for factory-const exports

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
