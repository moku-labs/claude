#!/usr/bin/env node
/**
 * Give a git worktree the main checkout's `.planning/`, for detect-moku-project.sh.
 *
 * SessionStart hooks run in parallel, so that script cannot wait for session-rails.mjs to link.
 */

import { linkPlanning } from "../lib/hooks/worktree.mjs";

linkPlanning(process.cwd());
