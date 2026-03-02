# Tooling Configuration Reference

Exact configurations from moku_core. Use these as the reference when scaffolding new projects.

## package.json (devDependencies)

```json
{
  "type": "module",
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
    "includes": ["src/**", "tests/**", "*.config.ts"],
    "ignores": ["**/dist", "**/coverage", "**/*.md", "bun.lock"]
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
  sonarjs.configs.recommended,

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
    "noUncheckedIndexAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
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

## Key Conventions

- **Package manager:** bun (not npm/yarn)
- **Formatter:** Biome (2-space, double quotes, semicolons, no trailing commas)
- **Linter:** ESLint 9 flat config + Biome (biome-config-biome must be LAST in ESLint array)
- **TypeScript:** Strict mode with `exactOptionalPropertyTypes` and `noUncheckedIndexAccess`
- **Testing:** Vitest with unit + integration projects, 90% coverage threshold
- **Git hooks:** Lefthook pre-commit (build, format, lint, test)
- **Import style:** `import type` enforced via `@typescript-eslint/consistent-type-imports`
- **JSDoc:** Required on all source exports (functions, types, interfaces) with descriptions, params, returns, and examples
