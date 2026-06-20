---
description: Plan a Moku project — create, update, add plugins, or migrate existing code (3-stage gated workflow). Accepts free-form natural language — no need to memorize exact syntax.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode
argument-hint: {free-form description} or [create|update|add|migrate|resume] [type] {requirements} [--quick] [--context {file}]
disable-model-invocation: true
---

## Moku Core Specification (authoritative)

Before any decision about architecture, the core API, factory chain, config, lifecycle, events, the `ctx` object, types, invariants, or plugin structure — **consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the cited `spec/NN-*.md` file.** The spec is the single source of truth; never rely on memory or guess. Justify any deviation against a cited section, and cite spec section IDs (`spec/NN-*.md §N`) in output. Never stage or commit `.planning/` — it is local-only state.

## Input — natural language first

`$ARGUMENTS` may be **natural language** — you don't need the exact flags or patterns. Resolve intent per **`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/nl-args.md`**: map the request onto this command's documented verbs/types/flags/targets, echo a one-line `Interpreting as: …`, then proceed. If a **required** value is missing or the request is ambiguous, ask only for that gap (don't make the user restate everything). Input that is already exact structured syntax is used verbatim (no echo). NL never bypasses this command's own confirmation gates.

## Project Configuration
!`test -f .claude/moku.local.md && head -20 .claude/moku.local.md || true`

Use configuration values above if present. Validate before using — ignore invalid values and use defaults:

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| `maxParallelAgents` | integer | 1–8 | 5 |
| `gapClosureMaxRounds` | integer | 0–5 | 2 |
| `skipValidation` | boolean | true/false | false |

See `/moku:build` for the complete configuration schema covering all Moku commands.

Create a specification plan for a Moku project. The input (`$ARGUMENTS`) uses a verb-first pattern:

- `create framework "A static site generator"` — new framework from description
- `create tool "A bundler for TypeScript"` — same as framework (tool is a synonym)
- `create app "A personal blog"` — new consumer app
- `create game "A roguelike dungeon crawler"` — same as app (game is a synonym)
- `add plugin auth "JWT-based authentication"` — create a plugin spec for an existing framework (build separately with `/moku:build add`)
- `update plugin router "add nested route support"` — update an existing plugin's spec
- `update app "add caching and offline support"` — update consumer app composition
- `migrate framework ~/Projects/legacy-app` — migrate existing code to Moku
- `migrate app https://github.com/user/repo "convert to Moku consumer"` — migrate from GitHub
- `resume` — continue from saved state
- `framework "A static site generator"` — (backward compat) same as `create framework`

This command runs as a **3-stage gated workflow** with optional discussion, optional research, and plan validation. Each stage ends with a user checkpoint — the user must explicitly approve before proceeding to the next stage.

The `add` verb is special — it runs a lightweight spec-only flow instead of the 3-stage workflow. It creates the plugin spec and recommends `/moku:build add {name}` for implementation.

**`--quick` mode:** If `--quick` is present in arguments, collapse the 3-stage workflow into a single pass — analysis, specs, and skeleton in one invocation with one approval at the end instead of three. Auto-suggested when ≤ 4 plugins/changes are in scope — the auto-suggest check runs **after the plugin/change set is assembled, before the FIRST approval gate of this run**, **and only when QUICK_MODE is not already true** (if `--quick` was passed explicitly, the user has already chosen quick mode — do not offer the choice again). The "first gate" differs by verb: for `create`/`migrate` it is the Stage 1 gate; for `update` (which skips Stage 1 — see `plan-verb-update.md`) it is the Stage 2 gate, so the check fires there using the count of plugins/changes the update touches. This keeps the auto-suggest reachable for every verb, not just the ones that run Stage 1. Use `AskUserQuestion` to offer the choice:
- Question: "Only [N] plugins detected. Switch to quick mode?"
- Header: "Quick mode"
- Options: "Continue with 3-stage workflow" / "Switch to --quick (Recommended)" with descriptions
The `add` verb always runs in quick mode regardless of this flag.

**CRITICAL:** Never use explicit generics on `createPlugin` — all types must be inferred from the spec object. See the moku-plugin skill for the rule and examples. Check every code example before showing to the user.

---

## Intent Normalization (Pre-Parse)

Before strict argument parsing, normalize `$ARGUMENTS` from free-form natural language to structured format. This allows users to type informal descriptions instead of memorizing exact syntax.

**Skip normalization when:** `$ARGUMENTS` is empty, OR the first token (after stripping flags like `--quick`, `--context`) is a recognized VERB keyword (`create`, `update`, `add`, `migrate`, `resume`) or TYPE keyword (see normalization table below). In these cases, arguments are already structured — proceed directly to Step 0.

**When to normalize:** If the first non-flag token is NOT a recognized keyword, treat the entire input as free-form natural language and extract structured arguments:

1. **Strip flags first:** Extract `--quick`, `--deep`, `--context {file}` from anywhere in the text. These are unambiguous and can be detected before intent parsing.

2. **Wrong-command detection:** Check if the user's intent belongs to a different command:
   - Keywords suggesting build intent (`implement`, `compile`, `continue building`, `run build`, `resume build`, `execute the build`, `start the build`) → Tell user: "It sounds like you want to build. Run: `/moku:build resume`" and stop. **Note:** bare `build` alone is NOT a trigger — it fires too many false positives (e.g., "build a static site generator framework" is plan-intent). Only multi-word build phrases or imperative constructs (`run build`, `execute`, `implement`) should redirect. If the input contains `build` followed by an article + noun (`build a/an/the [noun]`), treat as plan-intent and continue normalization.
   - Keywords suggesting brainstorm intent (`brainstorm`, `explore ideas`, `let's think about`, `discuss options`) → Tell user: "It sounds like you want to brainstorm. Run: `/moku:brainstorm {rest of text}`" and stop.
   - If unsure, continue with normalization — don't block on ambiguity.

3. **Extract intent from natural language:**
   - **VERB detection** — evaluate keywords in this exact priority order (first match wins; apply state-based default only if no keyword matches):
     1. "new", "create", "make", "start", "build a new" → `create`
     2. "change", "update", "modify", "refactor", "improve" → `update`
     3. "add", "include", "add a plugin", "new plugin" → `add`
     4. "migrate", "convert", "port", "move to moku" → `migrate`
     5. "continue", "resume", "pick up", "where was I" → `resume`
     6. If no keyword matched → default to `create` for new projects, `update` for existing ones (check if `.planning/STATE.md` exists)
   - **TYPE detection:**
     - "framework", "library", "tool", "engine", "toolkit" → `framework`
     - "app", "application", "site", "game", "service", "server" → `app`
     - "plugin" → `plugin`
     - If not mentioned and VERB is `add` → TYPE defaults immediately to `plugin`. Auto-detect does not run for the `add` verb.
     - If not mentioned and VERB is not `add` → auto-detect (existing Step 0 logic handles this)
   - **NAME/DESCRIPTION:** Everything not consumed by VERB, TYPE, or flag extraction becomes the REQUIREMENTS/DESCRIPTION text.

4. **Reconstruct and log:** Assemble the extracted components into structured format. Log: "Normalized free-form input → VERB={verb}, TYPE={type}, REQUIREMENTS=\"{desc}\"". Proceed to Step 0 with the structured arguments.

**Examples:**
| User types | Normalized to |
|---|---|
| `I want to make a static site generator` | `create framework "a static site generator"` |
| `add auth plugin with JWT support` | `add plugin auth "JWT support"` |
| `update the router to support nested routes` | `update plugin router "support nested routes"` |
| `migrate my express app from ~/Projects/legacy` | `migrate app ~/Projects/legacy` |
| `continue from where we left off` | `resume` |
| `a caching framework with LRU and TTL` | `create framework "a caching framework with LRU and TTL"` |

---

## Step 0: Parse Arguments

Parse `$ARGUMENTS` into six components: **VERB**, **TYPE**, **PATH_OR_LINK**, **REQUIREMENTS**, **QUICK_MODE**, **CONTEXT_FILE**.

**Ordered startup sequence (run in this exact order):**

1. **Filesystem guard (mandatory):** Ensure the planning directory exists:
   ```bash
   mkdir -p .planning/build/
   ```
   (This also creates `.planning/` if it doesn't exist.)
   This MUST execute before creating decisions.md, STATE.md, or any spec files. Also creates `.planning/build/` for ephemeral build artifacts. On fresh projects the directory does not exist and writes will fail without this guard.

2. **Empty-arguments smart prompt:** If `$ARGUMENTS` is empty, check project state before showing usage:
   - If `.planning/STATE.md` exists → read `## Phase:` and `## Next Action:`. Use `AskUserQuestion`: Question: "What would you like to do?" / Header: "Plan" / Options based on state:
     - If phase is `ready` or `build/complete` → "Add a plugin", "Update existing plugin", "Update framework", "Start fresh project"
     - If phase is `stage{N}` → "Resume planning (Recommended)", "Start fresh"
     - Always include: "Other — describe what you need"
   - If no STATE.md exists → Use `AskUserQuestion`: Question: "What would you like to plan?" / Header: "New project" / Options: "New framework", "New app", "Migrate existing project", "Add plugin to existing framework"
   - Set VERB, TYPE from the user's selection and proceed to Step 0 parsing. Do NOT show raw usage syntax.

(The filesystem guard in step 1 runs unconditionally — even if step 2 would stop early. The empty directory is harmless.)

**Multiple contexts → one plan.** `--context {filename}` may appear **more than once** — each occurrence names a brainstorm context (e.g. two features explored in the same session: `--context context-web-parity --context context-client-data`). Collect **all** occurrences into an ordered, de-duplicated list **CONTEXT_FILES** (this is the fix for the incident where a second feature's context collided with the first feature's plan — both now feed one plan). Extract the token following **each** `--context`, then strip **all** `--context {filename}` occurrences from `$ARGUMENTS`. **Resolve and validate every token** with the per-token rules below; a failure on any one token stops the command (do not silently drop a context the user asked for).

   For **each** extracted token, in order:

   **Absolute path guard:** If the token starts with `/`, reject immediately: "Context file must be a relative path within `.planning/`. Example: `--context my-notes` or `--context .planning/context-file.md`." and stop.

   **Metacharacter guard:** If the token contains any of `;`, `|`, `$`, `` ` ``, `(`, `)`, reject: "Context filename contains illegal characters. Use a plain relative path with no shell metacharacters." and stop.

   **Whitespace guard:** If the token is empty or whitespace-only (after trimming), reject: "Context filename cannot be empty or whitespace-only. Provide a file name such as `--context brainstorm-notes`." and stop.

   **Path construction and probe (per token):**
   1. If the token already starts with `.planning/`, use it as-is: CANDIDATE=`{token}`.
   2. Otherwise, set CANDIDATE=`.planning/{token}`.

   **Path traversal guard:** If CANDIDATE (after resolving any `../` sequences) points outside `.planning/`, reject: "Context file path must resolve within `.planning/`. Path traversal (`..`) is not allowed." and stop.

   **File existence probe (per token):** Run `test -f '$CANDIDATE'`. If not found:
   - Try `.planning/{token}.md` (handles plain token inputs such as `brainstorm-notes` → `.planning/brainstorm-notes.md`). If that exists, use it.
   - If still not found, try `.planning/context-{token}.md` (handles brainstorm-generated names such as `.planning/context-site-gen.md`). If that exists, use it.
   - If none of the three paths exist, tell user: "Context file for `{token}` not found (tried `{CANDIDATE}`, `.planning/{token}.md`, `.planning/context-{token}.md`). Run `/moku:brainstorm` first or check the path." and stop.
   Append the resolved path to CONTEXT_FILES (skip if already present — de-duplicate). All bash commands referencing a path must single-quote the variable: `test -f '$CANDIDATE'`.

   **CONTEXT_FILE (compatibility variable):** After building CONTEXT_FILES, set CONTEXT_FILE to its **first** element (so any single-context references downstream still work), or `(none)` if the list is empty. When CONTEXT_FILES has **more than one** entry, log: "Multi-context plan: combining {N} brainstorm contexts into one plan — {comma-separated list}." The create-verb Context Injection Pre-Phase merges all of them (see `plan-verb-create.md`).

   If `--context` is absent, set CONTEXT_FILES=(empty) and CONTEXT_FILE=(none).

**`--context` verb support:** The `--context` flag (one or many) is fully supported for the `create` verb (Context Injection Pre-Phase in `plan-verb-create.md` consumes and **merges all** of CONTEXT_FILES). For `update` and `migrate` verbs, log a warning: "Note: `--context` provides supplementary context for the `{VERB}` workflow but does not skip any phases. The full {VERB} workflow will run." — and these verbs also read **all** of CONTEXT_FILES for additional context (no phases skipped automatically). For `add` verb: `--context` is not applicable — warn: "`--context` is ignored for the `add` verb." and set CONTEXT_FILES=(empty), CONTEXT_FILE=(none).

**Write CONTEXT_FILE(S) to STATE.md:** On the first STATE.md write of this invocation, include `## ContextFile: {comma-separated CONTEXT_FILES}` if CONTEXT_FILES is non-empty (a single entry writes just that one path; multiple entries are comma-separated), else `## ContextFile: (none)`. On resume, load CONTEXT_FILES by splitting STATE.md's `## ContextFile:` field on commas (trim each); CONTEXT_FILE is the first element. **Precedence:** If `--context` is explicitly passed at invocation time (CONTEXT_FILES was set in Step 0 above), it overrides the stored value — skip loading from STATE.md and use the Step 0 list. If `--context` was NOT passed, load from STATE.md's `## ContextFile:` field (or default to empty/`(none)` if absent).

If `--quick` is present anywhere in `$ARGUMENTS`, set QUICK_MODE=true and strip **all occurrences** of `--quick` before further parsing. Otherwise QUICK_MODE=false.

**Write QUICK_MODE to STATE.md immediately:** On the first STATE.md write of this invocation (either the initial creation or the first update), include `## QuickMode: true` if QUICK_MODE=true, else `## QuickMode: false`. Do not wait until stage exit to persist this value — a session drop during Stage 1 must be able to recover QUICK_MODE from STATE.md.

### Token Extraction

**Tokenization:** Follow shell-like semantics — text enclosed in matching single or double quotes is treated as a single token (quotes stripped). This allows paths and descriptions with spaces: `create framework "my static site"`.

**Guard — resume verb:** If the first token (after stripping `--quick`) is `resume`, set VERB=`resume` and skip all remaining Token Extraction steps. Proceed directly to Step 0.1.

1. **Extract VERB** from first word:
   - `create`, `update`, `add`, `migrate`, `resume` → use as VERB, advance to next token
   - If first word is a TYPE keyword (see normalization table) → set VERB=`create` (backward compat). Set TYPE to this word (normalize via table below). Advance token pointer to the word after this one. Continue to step 3 (PATH_OR_LINK extraction).
   - If first word looks like a path (contains `/`, starts with `.`, `~`, or `http`) → set VERB=`migrate`, set PATH_OR_LINK to this token, set TYPE=`framework` (migrate default), skip steps 2 and 3 (TYPE and PATH_OR_LINK are already set), advance token pointer past this token, continue to REQUIREMENTS extraction (step 4).
   - If no recognized word → auto-detect (see below). Do not advance the token pointer on the unrecognized word — leave the full token stream intact for auto-detection to evaluate. When TYPE is resolved via auto-detect (conditions a–d) and no VERB was set during token extraction, set VERB=`create`. **Note:** because the token pointer is not advanced on an unrecognized first word, that word will remain in the token stream and be included in REQUIREMENTS after TYPE resolution. This is intentional — unrecognized words may carry useful context for the planning workflow.

2. **Extract TYPE** from next token:
   - Guard: if the TYPE token matches a VERB keyword (`create`, `update`, `add`, `migrate`, `resume`), do not normalize — tell user: "The verb `{token}` cannot be used as a type. Did you mean `/moku:plan {token} [type] [description]`?" and stop.
   - Match against normalization table → set normalized TYPE
   - If no TYPE found and VERB is `add` → default immediately to `plugin` (auto-detect does not run for `add`)
   - If no TYPE found and VERB is `create` or `update` → auto-detect from working directory
   - If no TYPE found and VERB is `migrate` → default to `framework`

3. **Extract PATH_OR_LINK** (optional):
   - If next token contains `/`, starts with `.`, `~`, or `http` → set as PATH_OR_LINK
   - **Fallback probe (when token does NOT match the sigil checks above):** **Guard: this fallback probe applies only to the `migrate` verb. For all other verbs (`create`, `update`, `add`), skip the fallback probe entirely — the token falls through to REQUIREMENTS (step 4). For the `add` verb specifically: if the token matches a sigil pattern (contains `/`, starts with `.`, `~`, or `http`), reject it as an invalid plugin name — tell user: "Plugin names cannot be paths or URLs. Provide a plain plugin name such as `auth` or `router`."** If VERB is `migrate` and the token is present but did not match any sigil pattern, apply these probes in order:
     1. **Local path probe:** Test if the token exists as a local directory (`test -d '{token}'`) or file (`test -f '{token}'`). If yes → set as PATH_OR_LINK. Log: "Resolved `{token}` to local path `{token}`". Advance past this token.
     2. **Context file probe:** Test if `.planning/context-{token}.md` exists. If yes → set CONTEXT_FILE to `.planning/context-{token}.md`. Log: "Resolved `{token}` to `.planning/context-{token}.md`". Do NOT consume the token as PATH_OR_LINK — the context file provides brainstorm context, not the migration source. PATH_OR_LINK remains unset (the migrate verb will prompt for it if needed). Advance past this token.
     3. **Conflict check:** If BOTH a local path AND a context file would match (i.e., `{token}` is a valid directory/file AND `.planning/context-{token}.md` exists), use `AskUserQuestion`: Question: "The token `{token}` matches both a local path and a context file. Which did you mean?" / Header: "Ambiguous token" / Options: "Use as migration source path (`{token}`)" / "Use as brainstorm context (`.planning/context-{token}.md`)" / "Neither — treat as part of REQUIREMENTS" / multiSelect: false. Set PATH_OR_LINK or CONTEXT_FILE based on the answer, or if "Neither" is chosen do not advance the token pointer (the token falls through to REQUIREMENTS).
     4. **Neither:** Do not advance the token pointer — the token falls through to REQUIREMENTS extraction as before.
   - For `migrate`: PATH_OR_LINK is **required**. If missing after parsing, do NOT route to plan-verb-migrate.md. Instead prompt via `AskUserQuestion`:
     - Question: "What is the path or URL of the project to migrate?"
     - Header: "Migrate source"
     - Options: (free text — no fixed options)
     Set PATH_OR_LINK to the answer. If the answer is empty or whitespace-only, ask once more using the same question. If still empty after the second attempt, stop: "No source path provided. Run `/moku:plan migrate [type] [path]` with an explicit path." Do not route until PATH_OR_LINK is a non-empty value.
   - For `migrate` with a local path (not starting with `http`): verify the path exists and is readable using `test -d '{path}' && test -r '{path}'` (or `test -f '{path}' && test -r '{path}'` if a file path is given). If not, tell user: "Path `{path}` does not exist or is not readable. Provide a valid path to an existing project." and stop.
   - For `migrate` paths: if the path, after resolving with `realpath -e` (or string-normalizing `../` sequences if the path does not yet exist), points outside the current working directory, confirm via `AskUserQuestion` — Question: "The path `{path}` points outside the current working directory. Continue?" / Header: "Path confirmation" / Options: "Yes, use this path" / "No, cancel" (multiSelect: false). If user cancels, stop.
   - For other verbs: skip (not expected)

4. **Remaining tokens** → REQUIREMENTS (free text). After TYPE is resolved (including via auto-detect AskUserQuestion — see below), all tokens not consumed during VERB/TYPE/PATH_OR_LINK extraction become REQUIREMENTS.

5. **PLUGIN_NAME extraction (`add` verb only):** After TYPE is confirmed as `plugin`, extract PLUGIN_NAME from the next token if it is present and is not a path/link token (i.e., does not contain `/` and does not start with `.`, `~`, or `http`). Store as PLUGIN_NAME. Remaining tokens after PLUGIN_NAME become REQUIREMENTS.

   > **NOTE for `update plugin`:** PLUGIN_NAME extraction is handled in `plan-verb-update.md` (it treats the first token of REQUIREMENTS as the plugin name). No extraction is needed here — this step 5 applies to `add` only.

### Type Normalization Table

| Input | Normalized TYPE |
|-------|-----------------|
| `framework`, `tool`, `engine`, `library` | `framework` |
| `app`, `application`, `service`, `server`, `game` | `app` |
| `plugin` | `plugin` |

### Auto-Detection (when TYPE is missing)

If no TYPE keyword is found, evaluate conditions a–d in order; use the first condition that matches (first-match-wins). Stop evaluating once a match is found:
  a. `src/config.ts` exists AND contains `createCoreConfig` → **framework**
  b. `package.json` `dependencies` or `devDependencies` contains a package matching `@moku-labs/*` other than `@moku-labs/core` itself → **app**
  c. Argument looks like a plugin name or spec reference → **plugin**
  d. If still unclear — use `AskUserQuestion`:
     - Question: "What type of project are you planning?"
     - Header: "Project type"
     - Options:
       1. label: "Framework", description: "A reusable plugin-based framework (Layer 2)"
       2. label: "Consumer App", description: "An application built on a framework (Layer 3)"
       3. label: "Plugin", description: "A single plugin to add to an existing framework"
     - multiSelect: false
     Normalize the answer via the Type Normalization Table. After TYPE is resolved, the remaining unparsed tokens (all tokens not consumed during VERB/TYPE/PATH_OR_LINK extraction) become REQUIREMENTS. If user selects "Other" with unrecognized text, ask once more. If still unclear, stop: "Could not determine project type. Please re-run with an explicit type, e.g. `/moku:plan create framework 'description'`."

### REQUIREMENTS Validation

After all tokens are parsed: if REQUIREMENTS is empty and VERB is `create` or `update`, use `AskUserQuestion`:
- Question: "What do you want to build? Provide a brief description."
- Header: "Description"
- Options:
  1. label: "Web framework", description: "e.g. static site generator, SPA framework, component library"
  2. label: "CLI tool", description: "e.g. bundler, linter, code generator"
  3. label: "Game engine", description: "e.g. roguelike, puzzle, real-time strategy"
  4. label: "Other", description: "Describe in your own words"
- multiSelect: false
Treat the user's selection or custom text as REQUIREMENTS and continue.

**Sentinel collision guard:** After REQUIREMENTS is set (whether from arguments or the AskUserQuestion above), trim it and check whether the trimmed value equals `(none)`. If it does, treat REQUIREMENTS as empty and prompt again via `AskUserQuestion` using the same question/options above — the string `(none)` is reserved for internal STATE.md placeholder use and must not be stored as a real description.

For `migrate`: REQUIREMENTS is optional — PATH_OR_LINK is the primary input. The PATH_OR_LINK prompt at step 3 above ensures PATH_OR_LINK is always set before routing, so REQUIREMENTS may remain empty for migrate.

### Verb-Type Validation

| VERB | Allowed TYPEs |
|------|---------------|
| `create` | `framework`, `app`, `plugin` |
| `update` | `framework`, `app`, `plugin` |
| `add` | `plugin` only |
| `migrate` | `framework`, `app` |
| `resume` | (no TYPE needed) |

If invalid combination → tell user: "The `{verb}` verb doesn't support the `{type}` target. Did you mean `{suggestion}`?" To construct `{suggestion}`: if the TYPE is wrong for the VERB, correct the TYPE (e.g., `add framework` → suggest `add plugin`). If the VERB is wrong for the TYPE, correct the VERB to one that accepts the given TYPE.

---

## Step 0.1: Resume from State

**This step runs when VERB is `resume`, or when VERB is not `resume` but `.planning/STATE.md` exists.**

**Guard — add verb:** If VERB is `add`, skip this step entirely. The `add` workflow is self-contained and does not use multi-stage state. The `add` verb does not write or modify STATE.md. If a user runs `resume` after a previous `add`, there will be no STATE.md entry for the add session — any subsequent `resume` invocation will treat the project as having no plan state and show the "no planning state found" message.

If VERB is `resume`:
- Read `.planning/STATE.md` — if it doesn't exist, tell user: "No planning state found. Start with `/moku:plan create [type] [description]`."
- Validate that the file contains all required headers (see State Persistence Protocol below) AND that each header has a non-empty value (not missing, not blank, and not whitespace-only — trim the value before checking). If any header is missing or empty, tell user: "`.planning/STATE.md` is malformed — missing or empty: {list}. Repair it manually or delete it and run `/moku:plan create [type] [description]` to restart."
- Load VERB, TYPE, phase, plugin table, wave grouping, QUICK_MODE, and CONTEXT_FILE from state.
  - **QUICK_MODE:** Load from `## QuickMode:` field. After loading, validate the value: if it is not `true` or `false` (case-insensitive), warn: "STATE.md `## QuickMode:` has unexpected value `{value}` — defaulting to false." and set QUICK_MODE=false. **Precedence:** If `--quick` was explicitly passed at invocation time (QUICK_MODE was already set to true in Step 0), do not overwrite it — the invocation-time flag takes precedence.
  - **CONTEXT_FILE:** If `--context` was explicitly passed at invocation time (CONTEXT_FILE was already set in Step 0), use that value — do not overwrite with STATE.md's stored value. Otherwise load from `## ContextFile:` field. **If `## ContextFile:` is absent from STATE.md (e.g., state file created before this field was introduced), set CONTEXT_FILE=(none) and continue — do not treat a missing ContextFile field as a validation error.**
  - **TYPE:** If TYPE was explicitly resolved during Step 0 normalization and differs from the TYPE stored in STATE.md, prompt via `AskUserQuestion`: Question: "Your input suggests TYPE={normalized} but the existing plan is TYPE={stored}. Which should be used?" / Header: "Type mismatch" / Options: "Use stored type ({stored}) — continue the existing plan" / "Use input type ({normalized}) — override the stored type" / multiSelect: false. Update STATE.md's `## Type:` field if the user selects the normalized value.
- Use the Phase-to-Stage Jump Table below to determine which stage to resume at

If VERB is NOT `resume` but `.planning/STATE.md` exists:
- Validate that the file contains all required headers AND each has a non-empty value (not missing, not blank, and not whitespace-only — trim before checking). If malformed, tell user: "`.planning/STATE.md` is malformed — missing or empty: {list}. Delete it and re-run to start fresh, or repair it manually."
- Read it to understand the current project position
- **Guard — phase none:** If `## Phase:` is `none`, skip the resume prompt and proceed as if no state existed — Phase: none indicates no work has been done yet.
- Use `AskUserQuestion` to present the state:
  - Question: "Found existing plan at [phase]. How would you like to proceed?"
  - Header: "Resume"
  - Options:
    1. label: "Resume (Recommended)", description: "Continue from [phase] — all previous work preserved"
    2. label: "Start fresh", description: "Back up current state and start over from scratch"
    3. label: "Cancel", description: "Don't proceed — leave state as-is"
  - multiSelect: false
  - If user chooses **Resume**: use the Phase-to-Stage Jump Table to determine the resume point.
  - If user chooses **Start fresh**:
    - **Run the Unbuilt-Plan Guard first** (above). If the current specs are an approved-but-unbuilt plan, the user chooses Combine / Archive / Replace; only **Replace** permits deletion. If the guard determined the plan is not at risk (empty specs, or a built/archived phase), continue directly.
    - **Backup guard:** Before backing up, check if `.planning/STATE.md.bak` already exists. If it does, rename it to `.planning/STATE.md.bak.{YYYY-MM-DD}` (using today's date) to preserve the prior backup — do not silently overwrite it. Then back up `.planning/STATE.md` to `.planning/STATE.md.bak`.
    - Then, per the guard's outcome: **Replace** → delete all `.planning/specs/*.md` files (preserve `decisions.md` if present, wipe `.planning/build/` contents); **Archive** → specs already moved to `.planning/archive/{slug}/`; **Combine** → keep specs and carry them into the new cycle. Proceed as the guard's outcome dictates (only Replace/Archive proceed "as if no state existed").
    - Immediately after the backup and delete, write a minimal `.planning/STATE.md` with the following headers so that a session drop during the next stage exit is recoverable:
      `## Phase: none` / `## Verb: {VERB}` / `## Target: {REQUIREMENTS if non-empty, else (none)}` / `## Skeleton: not-started` / `## QuickMode: {QUICK_MODE}` / `## PluginTable: (none)` / `## WaveGrouping: (none)` / `## Next Action: Run /moku:plan {VERB} to begin.`
    - Guard: Phase `none` means no work has been done — any subsequent resume will skip the resume prompt and proceed as a fresh run (per the Jump Table `none` row).
  - If user chooses **Cancel**: stop.
  - If user chose **Resume** and also provided new REQUIREMENTS in the command args, use `AskUserQuestion`:
    - Question: "You provided a new description. Update the target description?"
    - Header: "Update"
    - Options: "Yes, update description" / "No, keep original"
    - multiSelect: false

### Unbuilt-Plan Guard (MANDATORY before any spec deletion)

**This protocol is the single gate every spec-clearing path must pass through. No path in this command (or any verb reference file) may delete or overwrite `.planning/specs/*.md` / `.planning/build/skeleton-spec.md` without running it first.** It exists because an approved-but-**unbuilt** plan is real, user-approved design work — deleting it silently is the incident this guard eliminates.

**Why `complete` + populated specs ⇒ unbuilt:** after a successful build, `/moku:build` (build-final Step 7.5, Cycle Archive) moves the specs into `.planning/archive/cycle-N/` and resets `## Phase:` to `ready` (or `build/complete`). Therefore a `STATE.md` whose `## Phase:` is `complete` (or any `stageN/*`) **with spec files still present in `.planning/specs/`** is, by definition, a plan that was never built. That is exactly the state in which the old behavior deleted the specs.

**Protocol — run before clearing specs:**

1. **Detect an at-risk plan.** It is at risk if BOTH hold:
   - `.planning/specs/` contains at least one `*.md` file (check: `find .planning/specs -maxdepth 1 -name '*.md' -type f 2>/dev/null | head -1`), AND
   - the current `## Phase:` is NOT a built/archived state — i.e. it is one of `stage1*`, `stage2*`, `stage3*`, or `complete` (a plan that build has not yet consumed). If `## Phase:` is `none`, `building`, `build/*`, `ready`, or the specs dir is empty, the plan is NOT at risk — skip the rest of this protocol and proceed with the caller's normal behavior.
2. **Never delete at-risk specs silently.** If at risk, present `AskUserQuestion`:
   - Question: "There is an approved but **unbuilt** plan in `.planning/specs/` (Target: {current Target}, Phase: {phase}). Planning {new Target} would otherwise overwrite it. How do you want to proceed?"
   - Header: "Unbuilt plan"
   - Options:
     1. label: "Combine into one plan (Recommended)", description: "Keep the existing specs and plan the new feature together with them — produces one merged plan + skeleton. Best when both features will be built together."
     2. label: "Archive the existing plan", description: "Move the current specs + skeleton-spec.md + STATE.md to `.planning/archive/{slug}/` (preserved, not deleted), then plan the new feature in a clean slot."
     3. label: "Replace (discard existing)", description: "Permanently drop the existing unbuilt specs and start the new plan fresh. Only choose this if the existing plan is abandoned."
   - multiSelect: false
3. **Route by choice:**
   - **Combine:** Do NOT delete anything. Set COMBINE_MODE=true and record the existing spec set as an input to the new planning cycle. If a brainstorm context backs the existing plan (a `.planning/context-*.md` whose feature matches the current Target), add it to CONTEXT_FILES so the merge is context-driven. Hand off to the verb flow with both the existing specs and the new requirement; Stage 1/2 reconcile them into one numbered spec set (renumber `01..NN` across the union; tag each spec section with its source feature when they overlap a plugin). Set `## Target:` to a combined label (e.g. `{old} + {new}`).
   - **Archive:** Run the **Archive-Plan helper** below, then proceed as a clean new cycle.
   - **Replace:** Only now may specs be deleted. Back up STATE.md to `.planning/STATE.md.bak` first, then delete `.planning/specs/*.md` and `.planning/build/skeleton-spec.md`, and proceed fresh.
4. **Non-interactive / `--quick`:** Never auto-Replace. If the gate cannot be shown, default to **Archive** (non-destructive) and log the archive path.

**Archive-Plan helper:** derive SLUG from the current `## Target:` (slugify: lowercase, `[a-z0-9-]`, spaces→`-`; fallback `plan`); if `.planning/archive/{SLUG}/` already exists, suffix `-2`, `-3`, … Then `mkdir -p .planning/archive/{SLUG}/` and move into it: every `.planning/specs/*.md`, `.planning/build/skeleton-spec.md` (if present), and a copy of `.planning/STATE.md`. Log: "Archived unbuilt plan '{Target}' → `.planning/archive/{SLUG}/` ({N} specs + skeleton + STATE)." The archive is never deleted automatically.

### Phase-to-Stage Jump Table

| Phase value | Resume at |
|---|---|
| `none` or unrecognized | Tell user: "No plan has been started yet (or phase is unrecognized). Run `/moku:plan create [type] [description]` to begin." Stop. |
| `stage1` or `stage1/pending-approval` | Re-run Stage 1 (Analysis + Structure) |
| `stage1/approved` | Start Stage 2 (Specifications) |
| `stage2` or `stage2/pending-approval` | Re-run Stage 2 (Specifications) |
| `stage2/approved` | Start Stage 3 (Skeleton Specification) |
| `stage3` or `stage3/pending-approval` | Re-run Stage 3 (Skeleton Specification) |
| `stage3/approved` | Tell user: "This plan is already complete. Run `/moku:build resume` to begin building." Stop. |
| `complete` (VERB is `resume`, `create`, or `migrate`) | Tell user: "This plan is already complete. Run `/moku:build resume` to begin building." Stop. |
| `complete` (VERB is `update` or `add`) | **Run the Unbuilt-Plan Guard first** (the specs here are an approved-but-unbuilt plan — never delete them silently). Per the user's choice: **Combine** → keep specs, plan the new work together with them (no deletion); **Archive** → run the Archive-Plan helper, then continue; **Replace** → back up `.planning/STATE.md` to `.planning/STATE.md.bak` and delete `.planning/specs/*.md` (preserve decisions.md, wipe `.planning/build/` contents). After the chosen action, in the existing STATE.md change only `## Phase:` to `none` — preserve all other headers unchanged. Do not rewrite the full file. Proceed as a new planning cycle for the given verb. |

**Pending-approval resume note:** When resuming from a phase ending in `/pending-approval`, the stage re-executes its own work and re-presents the approval gate. The stage entry guard (which requires the previous stage to be `/approved`) is bypassed in this case — the stage owns this phase and is resuming mid-run.

### State Persistence Protocol

Every stage reads `.planning/STATE.md` at the start and writes it at the end. This enables:
- Resuming from any stage in a fresh context window
- Running a single stage without re-running previous ones
- Tracking exactly what has been completed and approved

All headers use **inline-colon format**: `## HeaderName: value` — the header name, a colon, a space, and the value all on one line. Never use a bare section heading like `## Next Action` with the value on a separate line.

**Each STATE.md field appears exactly once.** When updating STATE.md, edit the existing field in place — never append a second copy of a `## Header:` that already exists. This applies especially to fields written by *both* plan and build (e.g. `## Git Checkpoint:`, `## Phase:`, `## Skeleton:`): there must be exactly one of each. Before writing, if a field is duplicated, collapse to a single canonical line (the last/most-recent value wins). The build command writes `## Git Checkpoint:` to one canonical location and overwrites it each wave.

**On stage entry:**
1. Read `.planning/STATE.md`
2. Verify `## Phase:` ends with `/approved` (e.g., `stage1/approved`) — if not, tell user: "Stage N cannot start: the previous stage has not been approved. Resume from the pending-approval stage to approve it first." **Exception:** stages reached via the Jump Table from a `/pending-approval` phase skip this check — they are resuming their own pending state.
3. Load context: verb, target type, decisions, plugin table, wave grouping

**On stage exit (before user gate):**
1. Back up current state: copy `.planning/STATE.md` to `.planning/STATE.md.bak`. Then write new content to `.planning/STATE.md.tmp` first (not directly to STATE.md). Validate that the tmp file contains all required headers **before** renaming. If validation passes, rename `.planning/STATE.md.tmp` to `.planning/STATE.md` (atomic replace). If validation fails, delete the tmp file and stop: "STATE.md write failed validation — the `.bak` is intact. Do not proceed until this is resolved." If rename fails, stop: "STATE.md rename failed — tmp file preserved at `.planning/STATE.md.tmp`. The `.bak` is intact. Do not proceed until this is resolved."
2. Update `.planning/STATE.md` (via the tmp→rename procedure above) with (all on the same line as the header, using `## Header: value` format):
   - Current phase status
   - What was completed in this stage
   - Artifacts created (spec files, skeleton files)
   - Next expected action
   - `## QuickMode:` — write `## QuickMode: true` if QUICK_MODE=true, else `## QuickMode: false`
3. Set `## Phase:` to `stage{N}/pending-approval` (e.g., `## Phase: stage1/pending-approval`).
4. When user approves at the gate, update `## Phase:` to `stage{N}/approved` before advancing to the next stage.
5. Validation happens in step 1 (on the tmp file, before rename). The required headers are: `## Phase:`, `## Verb:`, `## Target:`, `## Next Action:`, `## PluginTable:`, `## WaveGrouping:`, `## QuickMode:`, `## Skeleton:`. If any header is missing, the tmp file is deleted and STATE.md remains untouched.

   **Skeleton initial value:** At every stage exit (Stage 1, Stage 2, and Stage 3), preserve the current `## Skeleton:` value from STATE.md if the build command has already advanced it beyond `not-started` (i.e., the current value is `in-progress`, `verified`, or `committed`). If the current value is `not-started` or the field is absent, write `## Skeleton: not-started`. The skeleton field is only advanced by the build command — the plan command must never regress a build-advanced value.

---

## Plan Mode for Analysis

When entering Stage 1 analysis (after any discussion and research phases that write files), use `EnterPlanMode` to activate read-only mode. This ensures no accidental file creation during the analysis phase. The analysis explores the codebase, identifies plugins, and designs the architecture — all read-only operations.

Call `ExitPlanMode` when the Stage 1 analysis is complete and ready for user approval. The plan mode approval UI presents the analysis for the user to review. After approval, proceed to write STATE.md and continue to Stage 2 in normal mode.

**In quick mode:** After `ExitPlanMode` completes at the end of Stage 1, immediately proceed to Stage 2 without a separate approval gate — the single combined approval gate comes at the end of all stages (Stage 3). Do not pause between stages in quick mode.

**When NOT to use Plan Mode:**
- Discussion phase (writes `decisions.md`)
- Research phase (writes `research.md`)
- Stage 2 (writes spec files)
- Stage 3 (writes `skeleton-spec.md`)
- `add` verb (single-pass, writes immediately)

## Output Styles

If the project has output styles configured (test if `.claude/output-styles/` directory exists: `test -d '.claude/output-styles/'`), suggest switching to `moku-planning` at the start of this command for verbose, analytical formatting.

---

## Design Context Detection (spec, not source)

A `/moku:design` run may have captured the design (look, feel, screens) for this work at `.planning/design/{slug}/design-context.md`. Before routing, if VERB is `create` or `update` and no design context is already in CONTEXT_FILES, glob `.planning/design/*/design-context.md`. If one or more exist whose target relates to REQUIREMENTS (match the slug, or the `# {NAME} — Design Context` title), offer via `AskUserQuestion`:
- Question: "A design context for `{slug}` exists. Use it to ground this plan?"
- Header: "Design context"
- Options: "Use it (Recommended)" — description: "Plan to build that design; specs reference its screen/element inventory" · "Skip it" — description: "Plan without it"

If "Use it": append its path to CONTEXT_FILES (the create-verb Context Injection Pre-Phase merges it like any context). A user may also pass it explicitly: `--context design/{slug}/design-context.md`.

**Spec-not-source carry-through (mandatory).** When any CONTEXT_FILE is a design context (a path under `.planning/design/`, or a file that opens with the "spec, not source" §0 callout), its prototype (HTML/CSS/JS or sketch) is **demo-only** and must be **re-implemented from scratch** — never copied, never ported 1:1, never used as a scaffold. The plan MUST forward this so it is internalised, not merely filed:
1. **Into the specs:** every spec for a screen/component derived from the design states, in its Overview/Verification, "Re-implement from the design context honouring ALL Moku conventions — for web: moku-web islands, `@scope`/`@layer` CSS, `data-*` attributes only (no class selectors), the token system, one route table, a node-free client bundle (moku-web Rules R1–R7), readable-code style. Do NOT copy the prototype's CSS/JS/DOM or replicate its bugs." This carries the instruction into `/moku:build`, which reads the specs.
2. **Into any spawned planning agent** (`researcher`, `plan-checker`): include the same instruction in the spawn prompt when a design context grounds the plan — so analysis treats the prototype as a spec, never as code to lift.

The design context describes **WHAT** to build; the specs and conventions define **HOW**.

---

## Route to Workflow

**Guard — unrecognized VERB:** Before routing, verify that VERB (loaded from STATE.md on resume, or parsed from arguments on fresh invocation) is one of: `create`, `update`, `add`, `migrate`. If VERB is any other value:
- **Special case — VERB is `resume`:** Tell user: "`.planning/STATE.md` contains `## Verb: resume`. The `resume` verb is for invocation only and must not be stored. The stored verb should be the original verb used to start this plan (`create`, `update`, `add`, or `migrate`). Edit `## Verb:` to the correct value, or delete `.planning/STATE.md` and run `/moku:plan create [type] [description]` to restart." Stop.
- **All other unrecognized values:** Tell user: "STATE.md contains an unrecognized verb `{VERB}`. Repair `.planning/STATE.md` manually (set `## Verb:` to a valid verb) or delete it and run `/moku:plan create [type] [description]` to restart." Stop.

Based on parsed VERB and TYPE, load and follow the appropriate verb-specific reference:

| VERB | Action |
|------|--------|
| `resume` | Step 0.1 above (read STATE.md, jump to recorded position). After loading, use the **VERB from STATE.md** (not the invocation verb `resume`) to select the verb-specific reference file. The phase determines which stage to re-run within that file — skip all stages that precede the resume point. |
| `add` (plugin) | Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-add.md` and follow it — quick single-pass, self-contained |
| `update` (any) | Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-update.md` and follow it |
| `migrate` (any) | Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-migrate.md` and follow it |
| `create` (any) | Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-create.md` and follow it |

**IMPORTANT:** Load only the one reference file matching the verb. Do not load all of them.

**Context handoff:** All values parsed in Step 0 — VERB, TYPE, PATH_OR_LINK, REQUIREMENTS, PLUGIN_NAME, QUICK_MODE, CONTEXT_FILE, and **CONTEXT_FILES** (the full list) — are available as context variables in the routed reference file. The reference file does not need to re-parse `$ARGUMENTS`.

**Quick mode:** QUICK_MODE is persisted in STATE.md via the `## QuickMode:` header. When `--quick` is passed, write `## QuickMode: true` to STATE.md on the first write of this invocation (before routing — see Step 0 startup sequence). On resume without `--quick`, read QUICK_MODE from STATE.md's `## QuickMode:` field. This allows quick mode to carry across sessions.
- **Precedence:** If `--quick` is explicitly passed at invocation time, it overrides the stored `## QuickMode:` value — set QUICK_MODE=true regardless of what STATE.md contains, and update `## QuickMode: true` in STATE.md on the next write.
- If QUICK_MODE=true and VERB is `create` or `update`: collapse Stages 1+2+3 into a single pass — run all three sequentially without stopping for approval between them. Present one combined summary at the end for a single approval gate. The verb reference files describe the individual stages — in quick mode, just run them back-to-back. **Before presenting that single combined gate, run the plan-checker on the final assembled plan and triage every BLOCKER (Interactive Triage) — the gate must not be shown while unresolved BLOCKERs exist (see the plan-checker rule under Rules).** **Important:** Even in quick mode, write STATE.md at each stage boundary (`stage1/approved`, `stage2/approved`) before proceeding to the next stage. This enables `plan resume` to recover from a session drop mid-quick-mode. The only difference from normal mode is that the user gate is skipped — the STATE.md writes still happen.
- If QUICK_MODE=true and VERB is `resume`: apply quick mode to the **remaining** stages from the resumed position — run all remaining stages back-to-back with one combined approval gate at the end. QUICK_MODE is read from STATE.md if `--quick` was not explicitly passed.
- If QUICK_MODE=true and VERB is `migrate`: QUICK_MODE is passed through to the reference file. Migrate is already a single-pass workflow; no collapse is needed.
- If QUICK_MODE=true and VERB is `add`: no effect — add always runs in quick mode regardless.

---

## Rules

- Follow the moku-plugin skill's complexity tiers strictly
- Every plugin must have an implementation order number
- Every plugin must have a wave assignment for parallel build grouping
- Plugin #1 should be implementable WITHOUT depending on other plugins
- Each subsequent plugin should only depend on already-numbered plugins
- Include ALL package.json dependencies for every plugin
- Include example of the final consumer API showing all plugin methods typed
- The specs must be self-contained — someone reading them should be able to implement the entire framework
- **Never use explicit generics on createPlugin** — see moku-plugin skill
- **NEVER include onStart/onStop unless there is an actual resource to manage** — document why if included, document why NOT if excluded
- **No folders outside src/plugins/** except config.ts and index.ts at src root — justify any exceptions explicitly
- Consumer code NEVER imports from `@moku-labs/core`
- Consumer imports `createApp` and `createPlugin` from the framework package
- Custom plugins must follow the same structure specs as framework plugins
- Full JSDoc on all custom code
- Include testing strategy for all custom plugins
- Include verification criteria for all plugins
- The spec must be complete enough to implement without further questions
- **Run plan-checker agent BEFORE every user gate, and triage BLOCKERs BEFORE the gate is shown — users see validated plans only.** This ordering is mandatory and is NOT relaxed by quick mode: the plan-checker → BLOCKER-triage → fix step must complete *before* the approval `AskUserQuestion` is presented, never after approval. In quick mode the three per-stage gates collapse to ONE combined gate — so run plan-checker on the final assembled plan and resolve every "Fix now" BLOCKER (per `plan-stages.md` Interactive Triage) *before* presenting that single gate. Presenting an approval while unresolved BLOCKERs exist is a defect (this was the recurring deviation in the multi-plan incident: gates were accepted, then BLOCKERs fixed after). If a BLOCKER is found after a gate was already shown, withdraw the gate, fix, re-run plan-checker, and re-present.
- Read `.planning/STATE.md` at the start of every stage, write it at the end — enable cross-session continuity. **Every STATE.md write must refresh the `## Recovery` block** (Last good step / Open blockers / Next action / Updated) per `plan-templates.md` + `memory-schema.md`, so a cold session or `/moku:next` rehydrates in one read.
- **Design context = spec, not source:** when a design context grounds the plan (see "Design Context Detection"), forward the re-implement-from-scratch instruction into the generated specs AND any spawned planning agent — the prototype is demo-only and must never be copied. This is mandatory, not optional.
- After all stages complete, `Next Action` must point to `Run /moku:build resume (build command detects skeleton not-started and runs skeleton build first)`
- **Plan NEVER builds:** The plan command only creates specs, analyzes, and recommends. It must NEVER invoke build steps, read build reference files, or create/modify source code files. After approval, always recommend the appropriate `/moku:build` command for the user to run in a fresh context. This applies to ALL verbs including `add` and `update` — the `add` verb creates a spec and recommends `/moku:build add {name}`, the `update` verb updates specs and recommends `/moku:build resume`.

## Run unattended (optional `/goal`)

`/goal` (Claude Code v2.1.139+) lets a user run the 3-stage workflow to completion without
approving each gate manually. The plugin cannot set it programmatically; **offer this ready-to-paste
line** when the user wants an unattended planning pass (note: this trades the per-stage approval
gates for one completion check):

> ```
> /goal STATE.md shows Phase: complete, every plugin in the plugin table has a .planning/specs/0N-*.md spec, .planning/build/skeleton-spec.md exists and is consistent with the structure, and no files under src/ were created or modified — or stop after 20 turns
> ```

The `no files under src/` clause preserves the plan-never-builds invariant; the turn cap bounds the loop. `/goal clear` cancels it.
