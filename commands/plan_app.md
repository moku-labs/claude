---
description: Create a Layer 3 consumer application specification plan
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [description]
---

Create a comprehensive Layer 3 (consumer) application specification plan based on the user's description (`$ARGUMENTS`).

## Process

### Step 1: Understand Requirements

Ask the user about:
- What kind of application they want to build
- What features it needs
- Any specific frameworks they want to use
- Performance requirements
- Target platform

### Step 2: Analyze Available Frameworks and Plugins

Search the project for:
- Framework packages (look for `createApp` and `createPlugin` exports)
- Available plugins (both framework defaults and optional)
- Plugin APIs and their capabilities
- Framework config shape and events

Read all relevant source files to understand what's available.

### Step 3: Gap Analysis

Compare requirements against available plugins:
- Which requirements are covered by existing plugins?
- Which requirements need new consumer-side plugins?
- Which requirements need framework extensions?
- Are there missing dependencies?

### Step 4: Design the Application

1. **Plugin Composition** — Which plugins to include, in what order
2. **Config Overrides** — What global config values to set
3. **Plugin Configs** — Per-plugin configuration
4. **Custom Plugins** — Consumer-side plugins needed (with full specs)
5. **Entry Point** — `createApp` call structure

### Step 5: Plan Documentation

- JSDoc requirements for all custom code
- README for the application
- API documentation for custom plugins
- Integration documentation (how everything connects)

### Step 6: Write the Specification

Save to `.planning/app-spec.md` (or user-specified path):

```markdown
# Application Specification: [Name]

## Overview
[What the app does, target users, domain]

## Framework
[Which framework, version, what it provides]

## Plugin Composition
[Ordered list of all plugins — framework defaults + consumer extras]

## Configuration
### Global Config
[Config overrides with values and rationale]

### Plugin Configs
[Per-plugin config overrides]

## Custom Plugins
### Plugin: [name]
[Full plugin spec: tier, config, state, API, events, deps, tests]

## Missing Plugins (Require Framework Extension)
[Plugins that need to be added to the framework, if any]

## Entry Point (main.ts)
[Complete createApp code example]

## Implementation Order
1. [Custom plugin or setup step]
2. [Next step]
...

## Testing Strategy
[Unit, integration, e2e plans for custom code]

## Documentation Plan
[What docs to write, where they go]

## Dependencies
[Additional npm packages needed]
```

### Step 7: Validate

Use the **moku-spec-validator** agent to verify:
- Plugin ordering satisfies all `depends` constraints
- No imports from `@moku-labs/core`
- Config types match framework expectations
- Custom plugins follow spec

## Rules

- Consumer code NEVER imports from `@moku-labs/core`
- Consumer imports `createApp` and `createPlugin` from the framework package
- Custom plugins must follow the same structure specs as framework plugins
- Full JSDoc on all custom code
- Include testing strategy for all custom plugins
- The spec must be complete enough to implement without further questions
