---
description: Create a comprehensive framework specification plan
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [description-or-codebase-path]
---

Create a comprehensive framework specification based on the user's input. The input (`$ARGUMENTS`) can be:

- A description of a new framework idea
- A path to existing code to migrate to Moku Core

## Process

### Step 1: Understand Requirements

If given a description:
- Ask clarifying questions about the domain
- Identify the target use case (web app, CLI, game, build tool, etc.)
- Determine what plugins are needed

If given existing code:
- Read and analyze the codebase
- Identify domain concepts that map to plugins
- Identify shared state, events, and communication patterns

### Step 2: Design the Framework

Using the **moku-core** and **moku-plugin** skills for guidance, design:

1. **Framework Identity** — Name, ID, description, target domain
2. **Config Shape** — Global config type with all required and optional fields
3. **Events Contract** — All global events with payload types
4. **Plugin List** — Complete list of all plugins needed

### Step 3: Specify Each Plugin

For each plugin, document:

1. **Number** — Sequential ID (Plugin #1, #2, etc.)
2. **Implementation Order** — Which to build first, second, etc. (based on dependencies)
3. **Name** — camelCase plugin name
4. **Tier** — Nano/Micro/Standard/Complex/VeryComplex
5. **Description** — What it does, why it exists
6. **Config** — Complete config type with defaults
7. **State** — State shape (if any)
8. **API** — Public methods with full signatures
9. **Events** — Per-plugin events with payload types (if any)
10. **Dependencies** — Which other plugins it depends on (with instance refs)
11. **Hooks** — Which events it listens to
12. **Lifecycle** — What happens in onInit, onStart, onStop
13. **Package Dependencies** — npm packages needed (with versions)

### Step 4: Plan Testing Strategy

1. **Unit Testing** — For each plugin's domain files (state, api, handlers)
2. **Integration Testing** — For each plugin's wiring
3. **End-to-End Testing** — For the complete framework with all plugins

### Step 5: Plan Communication

Document how plugins communicate:
- Which plugins depend on which (dependency graph)
- Which events flow between plugins
- Which APIs are called cross-plugin via `require`
- Draw the communication map

### Step 6: Write the Specification

Save the complete specification to `.planning/framework-spec.md` (or a user-specified path).

The spec must include:

```markdown
# Framework Specification: [Name]

## Overview
[Domain, purpose, target users]

## Global Config
[Type definition with descriptions]

## Global Events
[Event map with payload types and descriptions]

## Plugin List

### Plugin #1: [name] (implement first)
[Full specification per Step 3]

### Plugin #2: [name]
[Full specification]

...

## Dependency Graph
[Visual or textual representation]

## Communication Map
[How plugins talk to each other]

## Testing Strategy
[Unit, integration, e2e plans]

## Implementation Order
1. Plugin #N — [name] — [reason it's first]
2. Plugin #N — [name] — [reason it's second]
...

## Example: Final Public API
[Complete code example of consumer using the framework]
```

### Step 7: Validate

Use the **moku-spec-validator** agent to verify the specification follows all Moku Core rules.

## Rules

- Follow `specification/15-PLUGIN-STRUCTURE` complexity tiers strictly
- Every plugin must have an implementation order number
- Plugin #1 should be implementable WITHOUT depending on other plugins
- Each subsequent plugin should only depend on already-numbered plugins
- Include ALL package.json dependencies for every plugin
- Include example of the final consumer API showing all plugin methods typed
- The spec must be self-contained — someone reading it should be able to implement the entire framework
