/**
 * Which files a shell command writes.
 *
 * One concern: read a command the way a shell would, far enough to name its write targets. A redirect
 * writes the word after it; `tee`, `touch`, `mv`, `cp`, `install`, `ln`, `sed -i`, `perl -i` and `dd of=`
 * write the files they name, also behind `xargs` and `find -exec`. Text that is only data (a heredoc body,
 * a quoted pattern, a `2>&1`) names nothing, unless a shell or an interpreter runs it: `bash -c '...'` and a
 * heredoc fed to `bash` are read as commands, and the script of `node -e`, `python3 -c` or a heredoc fed to
 * `python3 -` names every path it holds when it calls a write function.
 */

import { posix } from "node:path";

/**
 * @typedef {object} Frame one command line being read: the top level, or the inside of `$(...)`, `(...)` or backticks
 * @property {string[]} words words of the segment read so far
 * @property {string[]} redirects redirect targets of the segment read so far
 * @property {string | null} word the word in progress; null between words
 * @property {"target" | "skip" | null} expect what the next word is: a redirect target, or the operand of `<`
 * @property {string | null} quote the open quote character
 * @property {boolean} backtick true for a frame opened by a backtick
 */

/** @typedef {{ words: string[], redirects: string[], piped: boolean }} Segment `piped`: its output feeds the next segment */

const HEREDOC = /(?<!<)<<(?!<)(-?)\s*(['"]?)(\w+)\2/g;
const IN_PLACE = /^(-[a-zA-Z]*i|--in-place)/;
const ASSIGNMENT = /^\w+=/;
const DIGITS = /^\d+$/;

/** Commands whose every operand is written. */
const WRITES_ALL = new Set(["tee", "touch", "mv"]);

/** Commands that write their last operand. */
const WRITES_LAST = new Set(["cp", "install", "ln"]);

/** Shells whose `-c` script, or heredoc on stdin, is a command line of its own. */
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);

/** Interpreters whose inline script (`-e`, `-c`, `-p`, `eval`) or heredoc on stdin can write files. */
const INTERPRETERS = new Set(["node", "python", "python3", "perl", "ruby", "bun", "deno", "tsx", "php"]);
const INLINE_SCRIPT = new Set(["-e", "-c", "-p", "-E", "--eval", "--print", "eval", "-r"]);

/** A write call in a script: Node, Bun, Deno, Python, Ruby, Perl, PHP. */
const WRITE_CALL = /\b(?:write(?:File|FileSync|TextFile|_text|_bytes)?|appendFile(?:Sync)?|createWriteStream|copyFile(?:Sync)?|rename(?:Sync)?|cpSync|file_put_contents|Bun\.write)\s*\(|\bopen\s*\([^)]*,\s*['"][wax+]|\bFile\.(?:write|open)\b|open\s*\(?\s*(?:my\s+)?\$?\w*\s*,\s*['"][>+]/;

/** A quoted literal that reads as a file path. */
const PATH_LITERAL = /(['"`])((?:[\w.@~-]*\/)+[\w.@-]+|[\w-]+\.(?:[cm]?[jt]sx?|json|css|html|md))\1/g;

/** `xargs` options followed by a value of their own. */
const XARGS_VALUE = new Set(["-I", "-n", "-P", "-d", "-L", "-s", "-E", "-a"]);

/** `find` actions that run a command on what was found. */
const FIND_EXEC = new Set(["-exec", "-execdir", "-ok", "-okdir"]);

/**
 * The files a shell command writes, as written in the command. A relative target after `cd <dir>` is
 * joined with that directory, so the caller can place it against the project root.
 *
 * @param {string} command
 * @returns {string[]}
 * @example
 * shellWriteTargets("grep -rn x src/ 2>/dev/null"); // ["/dev/null"]
 * shellWriteTargets("cd ../web && echo x > src/a.ts"); // ["../web/src/a.ts"]
 */
export function shellWriteTargets(command) {
  /** @type {string[]} */
  const targets = [];
  /** @type {string[]} */
  let piped = [];
  let directory = "";

  for (const segment of readSegments(withoutHeredocBodies(command))) {
    const words = commandWords(segment.words);
    const written = [...segment.redirects, ...writtenOperands(words), ...handedOver(words, piped), ...scripted(words)];
    for (const target of written) targets.push(place(directory, target));

    // Later targets are relative to the directory the command moved to
    if (words[0] === "cd" && words[1] && words[1] !== "-") directory = place(directory, words[1]);

    // What this segment prints may become the file list of an `xargs` behind the pipe
    piped = segment.piped ? [...piped, ...words.slice(1)] : [];
  }

  // A heredoc fed to a shell or an interpreter is a script, not data
  for (const { opener, body } of heredocs(command)) {
    const words = commandWords(readSegments(opener).at(-1)?.words ?? []);
    if (SHELLS.has(words[0])) targets.push(...shellWriteTargets(body));
    else if (INTERPRETERS.has(words[0])) targets.push(...scriptPaths(body));
  }

  return targets;
}

/**
 * The files an inline script writes: the `-c` command line of a shell, or the paths of an interpreter's
 * `-e`/`-c` script that calls a write function.
 *
 * @param {string[]} words command name first
 * @returns {string[]}
 */
function scripted([name, ...rest]) {
  const at = rest.findIndex((word) => INLINE_SCRIPT.has(word) || /^-[a-zA-Z]*[ce]$/.test(word));
  const script = at === -1 ? undefined : rest[at + 1];
  if (typeof script !== "string") return [];

  if (SHELLS.has(name)) return shellWriteTargets(script);
  if (INTERPRETERS.has(name)) return scriptPaths(script);

  return [];
}

/**
 * Every path literal of a script that calls a write function. Which one it writes cannot be told without
 * running it, so all are judged: a script that only reads names none.
 *
 * @param {string} script
 * @returns {string[]}
 */
function scriptPaths(script) {
  if (!WRITE_CALL.test(script)) return [];

  return [...script.matchAll(PATH_LITERAL)].map((match) => match[2]);
}

/**
 * The heredocs of a command, each with the text of the line that opens it (up to the `<<`) and its body.
 * A heredoc that never closes has no body: `withoutHeredocBodies` keeps its text as commands.
 *
 * @param {string} command
 * @returns {{ opener: string, body: string }[]}
 */
function heredocs(command) {
  const lines = command.split("\n");
  /** @type {{ opener: string, body: string }[]} */
  const found = [];

  for (let index = 0; index < lines.length; index += 1) {
    for (const match of lines[index].matchAll(HEREDOC)) {
      const [, dash, , delimiter] = match;
      const closes = lines.findIndex((line, at) => at > index && (dash ? line.replace(/^\t+/, "") : line) === delimiter);
      if (closes === -1) continue;

      found.push({ opener: lines[index].slice(0, match.index), body: lines.slice(index + 1, closes).join("\n") });
      index = closes;
    }
  }

  return found;
}

/**
 * The simple commands of a command line, each as its words. The commands inside `$(...)` come before the
 * command that holds them. A heredoc body and quoted text are data and start no command; a redirect is no word.
 *
 * @param {string} command
 * @returns {{ words: string[], piped: boolean }[]} `words` keep leading `VAR=value` assignments; `piped`: its output feeds the next command
 * @example
 * shellCommands("cd app && CI=1 bun run test 2>&1 | tail -5");
 * // [{ words: ["cd", "app"], piped: false }, { words: ["CI=1", "bun", "run", "test"], piped: true }, { words: ["tail", "-5"], piped: false }]
 */
export function shellCommands(command) {
  return readSegments(withoutHeredocBodies(command)).map((segment) => ({ words: segment.words, piped: segment.piped }));
}

/**
 * Drop heredoc bodies: they are data for the command, not commands. A heredoc that never closes is kept,
 * so a fake `<<` cannot hide the rest of the command from the guard.
 *
 * @param {string} command
 * @returns {string}
 */
function withoutHeredocBodies(command) {
  const lines = command.split("\n");
  /** @type {string[]} */
  const kept = [];

  for (let index = 0; index < lines.length; index += 1) {
    kept.push(lines[index]);

    for (const [, dash, , delimiter] of lines[index].matchAll(HEREDOC)) {
      const closes = lines.findIndex((line, at) => at > index && (dash ? line.replace(/^\t+/, "") : line) === delimiter);
      if (closes !== -1) index = closes;
    }
  }

  return kept.join("\n");
}

/**
 * Split a command into simple commands, each with its words and its redirect targets.
 *
 * @param {string} text command without heredoc bodies
 * @returns {Segment[]}
 */
function readSegments(text) {
  /** @type {Segment[]} */
  const segments = [];
  /** @type {Frame[]} */
  const suspended = [];
  let frame = newFrame(false);

  const endWord = () => {
    if (frame.word !== null && frame.expect === "target") frame.redirects.push(frame.word);
    if (frame.word !== null && frame.expect === null) frame.words.push(frame.word);
    if (frame.word !== null) frame.expect = null;
    frame.word = null;
  };
  const endSegment = (piped = false) => {
    endWord();
    if (frame.words.length > 0 || frame.redirects.length > 0) segments.push({ words: frame.words, redirects: frame.redirects, piped });
    frame.words = [];
    frame.redirects = [];
  };
  const open = (/** @type {boolean} */ backtick) => {
    suspended.push(frame);
    frame = newFrame(backtick);
  };
  const close = () => {
    endSegment();
    frame = suspended.pop() ?? newFrame(false);
  };
  const append = (/** @type {string} */ char) => {
    frame.word = (frame.word ?? "") + char;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    // Inside single quotes everything is literal
    if (frame.quote === "'") {
      if (char === "'") frame.quote = null;
      else append(char);
      continue;
    }

    // A command substitution is read as commands of its own, inside double quotes too
    if (char === "$" && next === "(") {
      open(false);
      index += 1;
      continue;
    }

    if (frame.quote === '"') {
      if (char === '"') frame.quote = null;
      else if (char === "\\" && next !== undefined) append(text[(index += 1)]);
      else append(char);
      continue;
    }

    if (char === "\\") {
      if (next !== "\n" && next !== undefined) append(next);
      index += 1;
    } else if (char === "'" || char === '"') {
      frame.quote = char;
      frame.word ??= "";
    } else if (char === "`") {
      if (frame.backtick) close();
      else open(true);
    } else if (char === "(") {
      endWord();
      open(false);
    } else if (char === ")") {
      close();
    } else if (char === " " || char === "\t") {
      endWord();
    } else if (char === "\n" || char === ";") {
      endSegment();
    } else if (char === "#" && frame.word === null) {
      while (index + 1 < text.length && text[index + 1] !== "\n") index += 1;
    } else if (char === "&" && next === ">") {
      endWord();
      frame.expect = "target";
      while (text[index + 1] === ">") index += 1;
    } else if (char === "&" || char === "|") {
      // A single `|`, or `|&`, hands the output to the next segment; `||`, `&&` and `&` do not
      endSegment(char === "|" && next !== "|");
      if (next === "&" || next === "|") index += 1;
    } else if (char === ">" || char === "<") {
      // A number glued to the operator is a file descriptor, not a word
      if (frame.word !== null && DIGITS.test(frame.word)) frame.word = null;
      endWord();
      while (text[index + 1] === char || text[index + 1] === "|" || (char === "<" && text[index + 1] === "-")) index += 1;

      // `2>&1` and `>&-` copy or close a descriptor and name no file
      const duplicates = text[index + 1] === "&" && /[\d-]/.test(text[index + 2] ?? "");
      if (duplicates) {
        index += 1;
        while (/[\d-]/.test(text[index + 1] ?? "")) index += 1;
      } else if (text[index + 1] !== "(") {
        if (text[index + 1] === "&") index += 1;
        frame.expect = char === ">" ? "target" : "skip";
      }
    } else {
      append(char);
    }
  }

  // An unclosed substitution still ends with the command
  while (suspended.length > 0) close();
  endSegment();

  return segments;
}

/**
 * @param {boolean} backtick
 * @returns {Frame}
 */
function newFrame(backtick) {
  return { words: [], redirects: [], word: null, expect: null, quote: null, backtick };
}

/**
 * The command and its arguments, without leading `VAR=value` assignments and `sudo`.
 *
 * @param {string[]} words
 * @returns {string[]}
 */
function commandWords(words) {
  const start = words.findIndex((word) => !ASSIGNMENT.test(word) && word !== "sudo");
  if (start === -1) return [];

  return [posix.basename(words[start]), ...words.slice(start + 1)];
}

/**
 * The operands a command writes, judged by its name.
 *
 * @param {string[]} words command name first
 * @returns {string[]}
 */
function writtenOperands([name, ...rest]) {
  const operands = rest.filter((word) => word !== "" && !word.startsWith("-"));

  if (WRITES_ALL.has(name)) return operands;
  if (WRITES_LAST.has(name)) return operands.slice(-1);
  if (name === "dd") return rest.filter((word) => word.startsWith("of=")).map((word) => word.slice(3));
  if (writes([name, ...rest])) return sedFiles(rest);

  return [];
}

/**
 * The files a writer gets from somewhere else: `xargs <writer>` takes them from the pipe, and
 * `find <paths> -exec <writer>` from the paths it searches. They cannot be known, so every word that
 * could name them is judged. A wrapped command that does not write hands nothing over.
 *
 * @param {string[]} words command name first
 * @param {string[]} piped words of the segments whose output feeds this one
 * @returns {string[]}
 */
function handedOver([name, ...rest], piped) {
  if (name === "xargs") {
    const start = rest.findIndex((word, index) => !word.startsWith("-") && !XARGS_VALUE.has(rest[index - 1]));
    const wrapped = start === -1 ? [] : commandWords(rest.slice(start));

    return writes(wrapped) ? [...piped, ...writtenOperands(wrapped)] : [];
  }

  if (name === "find") {
    const action = rest.findIndex((word) => FIND_EXEC.has(word));
    const wrapped = action === -1 ? [] : commandWords(rest.slice(action + 1));
    const searched = rest.slice(0, rest.findIndex((word) => word.startsWith("-")));

    return writes(wrapped) ? [...searched, ...writtenOperands(wrapped)] : [];
  }

  return [];
}

/**
 * Does this command write the files it is given.
 *
 * @param {string[]} words command name first
 * @returns {boolean}
 */
function writes([name, ...rest]) {
  return WRITES_ALL.has(name) || WRITES_LAST.has(name) || ((name === "sed" || name === "perl") && rest.some((word) => IN_PLACE.test(word)));
}

/**
 * The files of a `sed -i` or `perl -i` call: its operands without the script.
 *
 * @param {string[]} rest arguments after `sed` or `perl`
 * @returns {string[]}
 */
function sedFiles(rest) {
  const takesValue = new Set(["-e", "-f", "--expression", "--file"]);
  const bundled = (/** @type {string | undefined} */ word) => typeof word === "string" && /^-[a-zA-Z]*e$/.test(word);
  const withScript = rest.some((word) => takesValue.has(word) || bundled(word));
  const operands = rest.filter((word, index) => word !== "" && !word.startsWith("-") && !takesValue.has(rest[index - 1]) && !bundled(rest[index - 1]));

  // Without -e or -f the first operand is the script
  return withScript ? operands : operands.slice(1);
}

/**
 * A target as seen from where the command started.
 *
 * @param {string} directory directory the command moved to with `cd`; empty when it did not move
 * @param {string} target
 * @returns {string}
 */
function place(directory, target) {
  const anchored = target.startsWith("/") || target.startsWith("~") || target.startsWith("$");

  return anchored || directory === "" ? target : posix.join(directory, target);
}
