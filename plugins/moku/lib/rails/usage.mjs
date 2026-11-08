/**
 * Usage: one line per `moku-rails` command, printed for `--help` or `-h` before the command runs, so asking how a
 * command works never runs it.
 */

/** The usage line of every command, by name. */
export const COMMAND_USAGE = {
  session: "moku-rails session start [--root <dir>]  (puts the directory on the rails)",
  status: "moku-rails status  (where the project stands)",
  open: "moku-rails open <id> --size Q|S|M|L --type <type> --title <title>",
  enter: "moku-rails enter <station> [--change <id>]",
  done: "moku-rails done <station> [--change <id>] [--design <slug>] [--no-design-check]",
  skip: "moku-rails skip <station> --reason <why>",
  check: "moku-rails check tests|verify|docs  (confirms a closing-checklist item; tests runs the test script)",
  close: "moku-rails close [--change <id>]",
  pause: "moku-rails pause --reason <why>",
  park: "moku-rails park <id> --reason <why>",
  resume: "moku-rails resume <id>  (a parked change; for saved sessions see resume-checkpoint)",
  adopt: "moku-rails adopt [<id>] [--type framework|consumer|tools|game]",
  checkpoint: "moku-rails checkpoint [--since <hours>] [--config-dir <dir>] [--include-temp] [--account <uuid> --org <uuid>]  (saves every open session before a new sign-in; writes no second file when nothing changed)",
  "resume-checkpoint":
    "moku-rails resume-checkpoint [<file>] [--desktop|--cli] [--config-dir <dir>]  (the steps that continue each saved session)\n" +
    "  --open    the person's step, with the app open: adds gone worktrees again, frees branches, opens the sessions parents first, prints the titles and messages left\n" +
    "  --carry   copies uncommitted files to the folder the app opened a session in, overwriting nothing that changed\n" +
    "  --relink  the person's step, from Terminal.app with the app closed: writes the parents and permission modes the app did not keep, after a backup",
  continue: "moku-rails continue [--change <id>] [--note <what>]",
  scope: "moku-rails scope <what is new> [--change <id>]",
  stages: "moku-rails stages [set --milestone <name> | done --evidence <what the DoD check showed>]",
  idea: "moku-rails idea <text>",
  tier: "moku-rails tier <project-relative files...> [--misses <n>]",
  waves: "moku-rails waves [--done <wave number>]",
  tests: "moku-rails tests  (the test runs of this checkout)",
  init: "moku-rails init <begin|done>",
  "allow-planning": "moku-rails allow-planning [--apply]",
  guard: "moku-rails guard <file-path>",
  "guard-bash": "moku-rails guard-bash <command line>",
  "may-stop": "moku-rails may-stop",
};

/** Commands whose arguments are free text: there only a first `--help` or `-h` asks for help. */
const FREE_TEXT = new Set(["guard", "guard-bash", "idea", "scope"]);

/**
 * Whether the arguments of a command ask for help: `--help` or `-h`, anywhere except inside free text.
 *
 * @param {string} name the command
 * @param {string[]} argv its arguments
 * @returns {boolean}
 * @example
 * asksForHelp("checkpoint", ["--help"]); // true
 * asksForHelp("guard-bash", ["ls", "-h"]); // false
 */
export function asksForHelp(name, argv) {
  const help = (/** @type {string | undefined} */ token) => token === "--help" || token === "-h";
  return FREE_TEXT.has(name) ? help(argv[0]) : argv.some(help);
}
