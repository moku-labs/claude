/**
 * Artifacts: keep a local copy of every artifact a session published, so a new sign-in does not lose them.
 *
 * One concern: find the Artifact publishes in one session's transcript, and copy what each published into the
 * checkpoint with a manifest. A private artifact lives on claude.ai under the account that published it, and its
 * source often sits in a scratchpad or `/tmp` folder that does not outlive the session. A source that is gone is
 * rebuilt from the session's own Write and the Edits after it; when that is impossible only the link is kept.
 * Only this session's publishes count, never the other artifacts of the account.
 */

import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, resolve } from "node:path";

/** Larger sources are not copied: an artifact page is at most 16 MB. */
const MAX_BYTES = 16 * 1024 * 1024;

/** An artifact link as the Artifact tool reports it. */
const ARTIFACT_URL = /https:\/\/claude\.ai\/(?:code\/)?artifact\/[\w-]+/;

/**
 * @typedef {object} PublishedFile
 * @property {string} published the path the artifact serves the file at
 * @property {string} source the file the session published, absolute
 */

/**
 * @typedef {object} Publish
 * @property {string} url
 * @property {string} title
 * @property {string} publishedAt the time of the latest publish
 * @property {PublishedFile[]} files
 */

/**
 * @typedef {object} SavedFile
 * @property {string} published
 * @property {string} source
 * @property {string | null} copy the local copy, null when only the link is kept
 * @property {"copied" | "restored" | "partial" | "link-only"} status copied from disk, rebuilt from the transcript,
 *   rebuilt with an Edit that did not apply, or nothing to copy
 */

/**
 * @typedef {object} SavedArtifact
 * @property {string} url
 * @property {string} title
 * @property {string} publishedAt
 * @property {string} dir the folder holding the copies
 * @property {SavedFile[]} files
 */

/**
 * The artifacts a session published, one per link, from its transcript lines. A later publish to the same link
 * replaces the files it names and keeps the others, as the Artifact tool does.
 *
 * @param {Record<string, any>[]} entries the parsed transcript lines, in order
 * @param {string} cwd the folder relative paths are read against
 * @returns {Publish[]}
 * @example
 * findPublishes(entries, "/work/site"); // [{ url: "https://claude.ai/artifact/Hp…", title: "Report", files: [...] }]
 */
export function findPublishes(entries, cwd) {
  const calls = new Map();
  /** @type {Map<string, Publish>} */
  const byUrl = new Map();

  for (const entry of entries) {
    for (const block of blocks(entry)) {
      if (block.type === "tool_use" && block.name === "Artifact" && isPublish(block.input)) calls.set(block.id, { input: block.input, at: entry.timestamp });
      if (block.type !== "tool_result" || !calls.has(block.tool_use_id) || block.is_error) continue;

      const { input, at } = calls.get(block.tool_use_id);
      const result = entry.toolUseResult && typeof entry.toolUseResult === "object" ? entry.toolUseResult : {};
      const url = String(result.url ?? resultText(block).match(ARTIFACT_URL)?.[0] ?? input.url ?? "");
      if (!ARTIFACT_URL.test(url)) continue;

      const known = byUrl.get(url) ?? { url, title: "", publishedAt: "", files: [] };
      const files = new Map(known.files.map((file) => [file.published, file]));
      for (const file of publishedFiles(input, cwd)) files.set(file.published, file);
      byUrl.set(url, {
        url,
        title: String(result.title ?? input.title ?? "") || known.title,
        publishedAt: typeof at === "string" ? at : known.publishedAt,
        files: [...files.values()],
      });
    }
  }

  return [...byUrl.values()];
}

/**
 * Copy what a session published into `dest`, one folder per artifact, and write `dest/manifest.json`.
 * Nothing is written when the session published no artifact.
 *
 * @param {Record<string, any>[]} entries the parsed transcript lines, in order
 * @param {string} cwd
 * @param {string} dest `<checkpoint>/artifacts/<session id>`
 * @returns {SavedArtifact[]}
 */
export function saveArtifacts(entries, cwd, dest) {
  const publishes = findPublishes(entries, cwd);
  if (publishes.length === 0) return [];

  const writes = fileWrites(entries);
  const saved = publishes.map((publish, index) => {
    const dir = join(dest, `${String(index + 1).padStart(2, "0")}-${slug(publish.title || publish.url.split("/").at(-1) || "artifact")}`);
    return { url: publish.url, title: publish.title, publishedAt: publish.publishedAt, dir, files: publish.files.map((file) => saveFile(file, dir, writes)) };
  });

  mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, "manifest.json"), `${JSON.stringify(saved, null, 2)}\n`);
  return saved;
}

/**
 * The latest content of a file as the session wrote it: its last Write, with each later Edit applied in order.
 * Undefined when the session never wrote the whole file.
 *
 * @param {{ kind: "write" | "edit", input: Record<string, any> }[]} history the Write and Edit calls on this file
 * @returns {{ content: string, complete: boolean } | undefined}
 * @example
 * rebuild([{ kind: "write", input: { content: "a b" } }, { kind: "edit", input: { old_string: "b", new_string: "c" } }]);
 * // { content: "a c", complete: true }
 */
export function rebuild(history) {
  const start = history.findLastIndex((call) => call.kind === "write");
  if (start === -1) return undefined;

  let content = String(history[start].input.content ?? "");
  let complete = true;
  for (const { input } of history.slice(start + 1)) {
    const before = String(input.old_string ?? "");
    if (!before || !content.includes(before)) {
      complete = false;
      continue;
    }
    content = input.replace_all ? content.split(before).join(String(input.new_string ?? "")) : content.replace(before, () => String(input.new_string ?? ""));
  }

  return { content, complete };
}

/**
 * Copy one published file, or rebuild it from the transcript, or keep only its link.
 *
 * @param {PublishedFile} file
 * @param {string} dir
 * @param {Map<string, { kind: "write" | "edit", input: Record<string, any> }[]>} writes
 * @returns {SavedFile}
 */
function saveFile(file, dir, writes) {
  const copy = join(dir, file.published);

  if (existsSync(file.source) && statSync(file.source).isFile() && statSync(file.source).size <= MAX_BYTES) {
    mkdirSync(dirname(copy), { recursive: true });
    copyFileSync(file.source, copy);
    return { ...file, copy, status: "copied" };
  }

  const rebuilt = rebuild(writes.get(file.source) ?? []);
  if (!rebuilt) return { ...file, copy: null, status: "link-only" };

  mkdirSync(dirname(copy), { recursive: true });
  writeFileSync(copy, rebuilt.content);
  return { ...file, copy, status: rebuilt.complete ? "restored" : "partial" };
}

/**
 * The Write and Edit calls of the session that succeeded, per absolute file path, in order.
 *
 * @param {Record<string, any>[]} entries
 * @returns {Map<string, { kind: "write" | "edit", input: Record<string, any> }[]>}
 */
function fileWrites(entries) {
  const calls = new Map();
  const failed = new Set();
  for (const entry of entries) {
    for (const block of blocks(entry)) {
      if (block.type === "tool_use" && (block.name === "Write" || block.name === "Edit") && typeof block.input?.file_path === "string") calls.set(block.id, block);
      if (block.type === "tool_result" && block.is_error) failed.add(block.tool_use_id);
    }
  }

  /** @type {Map<string, { kind: "write" | "edit", input: Record<string, any> }[]>} */
  const byFile = new Map();
  for (const [id, block] of calls) {
    if (failed.has(id)) continue;
    const path = normalize(block.input.file_path);
    byFile.set(path, [...(byFile.get(path) ?? []), { kind: block.name === "Write" ? "write" : "edit", input: block.input }]);
  }

  return byFile;
}

/**
 * The files one publish call sent: the page itself, its supporting `files`, or the assets it uploaded.
 *
 * @param {Record<string, any>} input
 * @param {string} cwd
 * @returns {PublishedFile[]}
 */
function publishedFiles(input, cwd) {
  const root = typeof input.root === "string" ? absolute(input.root, cwd) : cwd;
  const files = [];
  const asset = input.asset === true;

  for (const path of [input.file_path, ...(Array.isArray(input.file_paths) ? input.file_paths : [])]) {
    if (typeof path === "string" && path) files.push({ published: safePath(`${asset ? "assets/" : ""}${basename(path)}`), source: absolute(path, cwd) });
  }

  const map = Array.isArray(input.files) ? Object.fromEntries(input.files.map((entry) => [entry?.path, entry?.path])) : input.files;
  for (const [published, from] of Object.entries(map && typeof map === "object" ? map : {})) {
    const source = typeof from === "string" ? from : typeof from?.from === "string" ? from.from : undefined;
    if (published && source) files.push({ published: safePath(published), source: absolute(source, root) });
  }

  return files;
}

/**
 * Whether an Artifact call published content: a publish (the default action) that is not a copy between artifacts.
 *
 * @param {Record<string, any> | undefined} input
 * @returns {boolean}
 */
function isPublish(input) {
  return Boolean(input) && (input.action === undefined || input.action === "publish") && !input.from_url;
}

/**
 * A published path that stays inside its folder.
 *
 * @param {string} path
 * @returns {string}
 */
function safePath(path) {
  return normalize(path).replace(/^(\.\.(\/|\\|$))+/, "").replace(/^[/\\]+/, "") || "file";
}

/**
 * @param {string} path
 * @param {string} base
 * @returns {string}
 */
function absolute(path, base) {
  return normalize(isAbsolute(path) ? path : resolve(base, path));
}

/**
 * @param {string} text
 * @returns {string}
 */
function slug(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40) || "artifact";
}

/**
 * @param {Record<string, any> | undefined} entry
 * @returns {Record<string, any>[]}
 */
function blocks(entry) {
  const content = entry?.message?.content;
  return Array.isArray(content) ? content.filter((block) => block && typeof block === "object") : [];
}

/**
 * @param {Record<string, any>} block
 * @returns {string}
 */
function resultText(block) {
  if (typeof block.content === "string") return block.content;
  return Array.isArray(block.content) ? block.content.map((part) => String(part?.text ?? "")).join("\n") : "";
}
