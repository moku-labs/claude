# Tooling Configuration Reference

Exact configurations from moku_core. Use these as the reference when scaffolding new projects.

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
  "engines": { "node": ">=22.0.0", "bun": ">=1.3.8" },
  "devDependencies": {
    "@arethetypeswrong/cli": "0.18.2",
    "@arethetypeswrong/core": "0.18.2",
    "@biomejs/biome": "2.4.2",
    "@types/bun": "1.3.9",
    "@vitest/coverage-istanbul": "4.0.18",
    "eslint": "9",
    "eslint-config-biome": "2.1.3",
    "eslint-plugin-jsdoc": "62.6.0",
    "eslint-plugin-sonarjs": "4.0.0",
    "eslint-plugin-unicorn": "63.0.0",
    "globals": "17.3.0",
    "jiti": "2.6.1",
    "lefthook": "2.1.1",
    "publint": "0.3.17",
    "tsdown": "0.20.3",
    "typescript": "5.9.3",
    "typescript-eslint": "8.56.0",
    "vitest": "4.0.18"
  },
  "scripts": {
    "build": "tsdown",
    "validate": "publint && attw --pack . --profile node16",
    "lint": "biome check . && eslint .",
    "lint:fix": "biome check --write . && eslint --fix .",
    "format": "biome format --write .",
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:coverage": "vitest run --project unit --project integration --coverage"
  }
}
```

## biome.json

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.2/schema.json",
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
    ignores: ["dist/**", "coverage/**", "bun.lock", ".claude/**", ".planning/**", "node_modules/**"]
  },

  // 2. TypeScript parser for all TS files
  tseslint.configs.base,

  // 3. Unicorn recommended
  eslintPluginUnicorn.configs.recommended,

  // 4. SonarJS recommended
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
      "jsdoc/require-jsdoc": ["error", {
        require: {
          ArrowFunctionExpression: true,
          ClassDeclaration: true,
          FunctionDeclaration: true,
          FunctionExpression: true,
          MethodDefinition: true
        },
        contexts: ["TSInterfaceDeclaration", "TSTypeAliasDeclaration"]
      }],
      "jsdoc/require-description": "error",
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/require-example": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "unicorn/require-module-specifiers": "off"
    }
  },

  // 7. Test files: relaxed rules
  {
    files: ["tests/**/*.ts"],
    rules: {
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-description": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-example": "off",
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
    "skipLibCheck": true
  },
  "include": ["src", "tests", "declarations.d.ts", "*.config.ts"]
}
```

## tsconfig.build.json

Extends the main tsconfig for build output with declaration emit. Used by tsdown.

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "emitDeclarationOnly": true,
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
      { test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      { test: { name: "integration", include: ["tests/integration/**/*.test.ts"] } }
    ],
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.ts"],
      exclude: ["src/**/types.ts", "src/**/types/**"],
      reporter: ["text", "lcov"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 }
    }
  }
});
```

## lefthook.yml

```yaml
pre-commit:
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
1.3.8
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
- Unit tests: `tests/unit/**/*.test.ts`
- Integration tests: `tests/integration/**/*.test.ts`
- 90% coverage threshold

## Moku Development Toolkit

This project uses the **moku** Claude Code plugin for development workflows. Below are the available commands, skills, and agents.

### Commands (slash commands)

**Planning:**
- `/moku:plan_framework` — 3-stage gated workflow to design a framework: analyze requirements, create skeleton structure, write plugin specifications. Output goes to `specifications/` directory.
- `/moku:plan_app` — Design a Layer 3 consumer application. Analyzes requirements, researches available plugins, performs gap analysis, outputs `.planning/app-spec.md`.

**Building:**
- `/moku:build_framework` — Build all plugins and framework files from specifications in `specifications/` directory. Resumes if partially built.
- `/moku:build_plugin [name-or-spec]` — Create a single plugin from a description or spec reference. Handles tier detection, file structure, tests, and validation.
- `/moku:build_app` — Build a consumer app from `.planning/app-spec.md`. Creates entry point, custom plugins, and validates everything.

**Setup:**
- `/moku:init` — Initialize a new Moku project with full tooling (used to create this project).

### Skills (automatic context)

Skills are loaded automatically when relevant topics come up. You can also reference them explicitly:

- **moku-core** — Architecture rules, factory chain, lifecycle, event system, context tiers. Use when working with `createCoreConfig`, `createCore`, `createApp`, or discussing the three-layer model.
- **moku-plugin** — Plugin structure specification, complexity tiers (Nano → VeryComplex), file organization, wiring harness pattern. Use when creating or reviewing plugin code.
- **moku-web** — Web patterns: Preact components, CSS architecture (@scope, @layer, tokens), island pattern. Use when building web-facing UI.

### Agents (validation)

Agents run autonomously to validate code. They are called automatically by build commands, but can also be triggered manually:

- **moku-spec-validator** — Validates Moku Core specification compliance: three-layer separation, factory chain, config system, lifecycle, events, error formats.
- **moku-plugin-spec-validator** — Validates plugin structure: correct tier, file organization, JSDoc coverage, test existence, no anti-patterns (no explicit generics on `createPlugin`, no unnecessary `onStart`/`onStop`).
- **moku-jsdoc-validator** — Validates JSDoc completeness: all exports have descriptions, `@param`, `@returns`, and `@example` tags.

### Typical Workflows

**New framework from scratch:**
1. `/moku:plan_framework` — design plugins and structure (3 approval gates)
2. `/moku:build_framework` — implement everything from specs
3. Validators run automatically after each plugin

**Add a single plugin:**
1. `/moku:build_plugin auth` — describe what you need, it handles the rest

**New consumer app:**
1. `/moku:plan_app` — design the app composition
2. `/moku:build_app` — implement from the plan

**Manual validation:**
- Ask Claude to "run the spec validator" or "validate JSDoc" on specific files

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

## Key Conventions

- **Package manager:** bun (not npm/yarn)
- **Formatter:** Biome (2-space, double quotes, semicolons, no trailing commas)
- **Linter:** ESLint 9 flat config + Biome (biome-config-biome must be LAST in ESLint array)
- **TypeScript:** Strict mode with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`
- **Testing:** Vitest with unit + integration projects, 90% coverage threshold
- **Git hooks:** Lefthook pre-commit (build, format, lint, test)
- **Import style:** `import type` enforced via `@typescript-eslint/consistent-type-imports`
- **JSDoc:** Required on all source exports (functions, types, interfaces) with descriptions, params, returns, and examples
