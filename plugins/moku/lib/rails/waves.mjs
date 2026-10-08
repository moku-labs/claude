/**
 * The build waves of a plan, read from `.planning/STATE.md`.
 *
 * The plan writes two tables: `## Plugins` (wave, tier, dependencies, spec and status of each plugin) and the
 * `| Wave | Plugins | Status |` table. Which wave is next, and whether its plugins may be built at the same
 * time, is read from them and checked: a model that picks the next wave by reading the file picks a wave
 * whose dependency is not built yet once in a while.
 *
 * Pure data and pure checks: the text goes in, nothing is run.
 */

/** @typedef {{ name: string, wave: number, tier: string, dependencies: string[], spec: string, status: string }} PlannedPlugin */
/** @typedef {{ wave: number, status: string, plugins: PlannedPlugin[], framework?: string }} Wave */

/**
 * A wave or a plugin whose status starts with one of these words is finished and can be built on. Plans in
 * the wild add to the word: `done (01288d1)`, `verified, 3/3 green`.
 */
const DONE = /^(verified|done|committed)\b/;

/**
 * Read the plugins and the waves of a STATE.md.
 *
 * A row of the wave table whose Plugins cell is a label in underscores (`_framework: src/index.ts exports_`)
 * is framework work: it has no plugin folder and no builder, the orchestrator does it by hand.
 *
 * @param {string} state the text of `.planning/STATE.md`
 * @returns {{ waves: Wave[], problems: string[] }} waves in order; `problems` names what makes the tables unusable
 * @example
 * readWaves(stateText).waves.map((wave) => wave.plugins.map((plugin) => plugin.name)); // [["log", "env"], ["router"], ["auth"]]
 */
export function readWaves(state) {
  const problems = [];

  // The plugins table: one row per plugin, with the wave the plan gave it
  /** @type {Map<string, PlannedPlugin>} */
  const plugins = new Map();
  for (const cells of tableRows(state, /^\|\s*#\s*\|\s*Wave\s*\|\s*Name\s*\|/i)) {
    const [, wave, name, tier, dependencies, spec, status] = cells;
    if (!name) continue;

    plugins.set(name, {
      name,
      wave: Number(wave),
      tier: tier ?? "",
      dependencies: /^(none|-|)$/i.test(dependencies ?? "") ? [] : (dependencies ?? "").split(",").map((entry) => entry.trim().replace(/\s*\(.*\)$/, "")),
      spec: spec ?? "",
      status: (status ?? "").toLowerCase(),
    });
  }

  // The wave table: the order the build follows
  /** @type {Wave[]} */
  const waves = [];
  const seen = new Set();
  for (const [wave, cell, status] of tableRows(state, /^\|\s*Wave\s*\|\s*Plugins\s*\|\s*Status\s*\|/i)) {
    const row = { wave: Number(wave), status: (status ?? "").toLowerCase(), plugins: /** @type {PlannedPlugin[]} */ ([]) };

    const label = /^_(.+)_$/.exec(cell ?? "");
    if (label) {
      waves.push({ ...row, framework: label[1] });
      continue;
    }

    for (const name of pluginNames(cell ?? "")) {
      if (seen.has(name)) problems.push(`Plugin "${name}" is in two waves.`);
      seen.add(name);

      // A core plugin is in the wave table and may be missing from the plugins table: it has no dependencies
      row.plugins.push(plugins.get(name) ?? { name, wave: row.wave, tier: "", dependencies: [], spec: "", status: row.status });
    }
    waves.push(row);
  }

  if (waves.length === 0) problems.push("STATE.md has no `| Wave | Plugins | Status |` table. The plan station writes it.");

  // A plugin is built after everything it depends on
  const waveOf = new Map(waves.flatMap((wave) => wave.plugins.map((plugin) => [plugin.name, wave.wave])));
  for (const wave of waves) {
    for (const plugin of wave.plugins) {
      for (const dependency of plugin.dependencies) {
        const at = waveOf.get(dependency);
        if (at !== undefined && at >= wave.wave) problems.push(`Plugin "${plugin.name}" is in wave ${wave.wave} and depends on "${dependency}" in wave ${at}. A dependency is built in an earlier wave.`);
      }
    }
  }

  return { waves, problems };
}

/**
 * The plugin names of a wave table cell. A plan may explain a name in brackets, with commas inside:
 * `transport (signaling, guard), session (codeLength)` names `transport` and `session`.
 *
 * @param {string} cell the Plugins cell of a wave row
 * @returns {string[]} the names, in order
 */
function pluginNames(cell) {
  const names = [];
  let depth = 0;
  let current = "";

  for (const char of `${cell},`) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);

    // A comma outside brackets ends a name
    if (char === "," && depth === 0) {
      const name = current.replace(/\s*\(.*$/s, "").trim();
      if (name) names.push(name);
      current = "";
      continue;
    }
    current += char;
  }

  return names;
}

/**
 * The wave to build next: the first one that is not finished.
 *
 * @param {Wave[]} waves in order
 * @returns {Wave | undefined} undefined when every wave is finished
 * @example
 * nextWave(readWaves(stateText).waves)?.wave; // 1
 */
export function nextWave(waves) {
  return waves.find((wave) => !isDone(wave));
}

/**
 * @param {Wave} wave
 * @returns {boolean} whether the wave is finished: its own status says so, or every plugin of it does
 */
export function isDone(wave) {
  if (DONE.test(wave.status)) return true;

  return wave.plugins.length > 0 && wave.plugins.every((plugin) => DONE.test(plugin.status));
}

/**
 * Mark a wave finished in the text of a STATE.md: its row of the wave table, and the rows of its plugins.
 *
 * @param {string} state the text of `.planning/STATE.md`
 * @param {number} wave the wave number
 * @param {string} status the new status, `verified` after a wave passed its checks
 * @returns {string} the text with the statuses changed; unchanged when the wave is not in the table
 * @example
 * markWave(stateText, 1, "verified");
 */
export function markWave(state, wave, status) {
  const names = new Set(readWaves(state).waves.find((entry) => entry.wave === wave)?.plugins.map((plugin) => plugin.name));
  let table = "";

  return state
    .split("\n")
    .map((line) => {
      // Which table the line is in decides which cell is the status
      if (/^\|\s*#\s*\|\s*Wave\s*\|\s*Name\s*\|/i.test(line)) table = "plugins";
      else if (/^\|\s*Wave\s*\|\s*Plugins\s*\|\s*Status\s*\|/i.test(line)) table = "waves";
      else if (!line.trim().startsWith("|")) table = "";
      if (!table || /^\|[\s:|-]+\|$/.test(line.trim())) return line;

      const cells = line.trim().slice(1, -1).split("|").map((cell) => cell.trim());
      const mine = table === "waves" ? Number(cells[0]) === wave && /^\d+$/.test(cells[0]) : names.has(cells[2]);
      if (!mine) return line;

      cells[cells.length - 1] = status;
      return `| ${cells.join(" | ")} |`;
    })
    .join("\n");
}

/**
 * The data rows of the first markdown table whose header line matches.
 *
 * @param {string} text
 * @param {RegExp} header matches the header line of the table
 * @returns {string[][]} the cells of each row, trimmed, without the separator row
 */
function tableRows(text, header) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => header.test(line));
  if (start === -1) return [];

  const rows = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.trim().startsWith("|")) break;
    if (/^\|[\s:|-]+\|$/.test(line.trim())) continue;

    rows.push(line.trim().slice(1, -1).split("|").map((cell) => cell.trim()));
  }

  return rows;
}
