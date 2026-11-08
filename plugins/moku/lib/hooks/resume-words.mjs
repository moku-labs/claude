/**
 * Resume words: whether a prompt asks for the saved sessions back, typed fast and with typos ("востонови все 4 моку
 * сесии", "верни сессии", "restor my sesions").
 *
 * One concern: read a prompt as words. The text is lower-cased, `ё` read as `е` and a letter typed twice read once,
 * so "сессии", "сесии" and "сесси" are one word. A request is a restoring verb and the word for the sessions within a
 * few words of each other; a verb stem of six letters or more may be one letter off. A session that is part of the
 * app being built (a session cookie, the sessions table, сессии пользователей) is not the person's sessions.
 */

/** Restoring verbs: a stem of six letters or more matches one letter off, a short one only as written. */
const LONG_VERBS = ["востанов", "востанав", "возобнов", "продолж", "разверн", "restor", "resum", "reopen", "recover", "continu"];
const SHORT_VERBS = new Set(["верни", "верните", "вернуть", "вернешь", "открой", "откройте", "открыть", "подними", "поднимите", "поднять", "back"]);

/** The word for sessions, after the doubled letters are read once: "сеси…" in Russian, "sesions" in English. */
const RU_SESSIONS = /^(се|си|са)с[иыийяюь]/;
const EN_SESSIONS = /^ses+i?on?s$|^sesions$|^sesisons$|^sessoins$/;

/** Words after "sessions" that make them part of the app being built. */
const APP_WORDS = /^(cookie|cookies|table|tables|storage|store|token|tokens|timeout|timeouts|middleware|api|endpoint|endpoints|ttl|id|ids|пользовател|логин|авториз|куки|таблиц|токен|юзер|клиент)/;

/** How many words may stand between the verb and the sessions. */
const WINDOW = 5;

/**
 * The prompt as words: lower case, `ё` as `е`, a letter typed twice or more read once, anything else a space.
 *
 * @param {string} text
 * @returns {string[]}
 * @example
 * words("Восстанови СЕССИИ!"); // ["востанови", "сеси"]
 */
export function words(text) {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/(\p{L})\1+/gu, "$1")
    .split(" ")
    .filter(Boolean);
}

/**
 * Whether a prompt asks for the saved sessions back.
 *
 * @param {string} text the person's prompt
 * @returns {boolean}
 * @example
 * asksToResume("востонови все 4 моку сесии"); // true
 * asksToResume("восстанови удалённый файл"); // false
 */
export function asksToResume(text) {
  const list = words(text);

  for (let index = 0; index < list.length; index += 1) {
    if (!isSessions(list[index]) || APP_WORDS.test(list[index + 1] ?? "")) continue;

    const near = list.slice(Math.max(0, index - WINDOW), index).concat(list.slice(index + 1, index + 1 + 2));
    if (near.some(isVerb)) return true;
  }

  return false;
}

/**
 * Whether the prompt speaks of sessions only as part of the app being built: every word for sessions is followed by
 * one that makes it so (the sessions table, a session cookie, сессии пользователей).
 *
 * @param {string} text
 * @returns {boolean}
 * @example
 * appSessionsOnly("restore the sessions table from the backup"); // true
 */
export function appSessionsOnly(text) {
  const list = words(text);
  const at = list.map((word, index) => (isSessions(word) || /^session$/.test(word) ? index : -1)).filter((index) => index >= 0);

  return at.length > 0 && at.every((index) => APP_WORDS.test(list[index + 1] ?? ""));
}

/**
 * @param {string} word
 * @returns {boolean}
 */
function isSessions(word) {
  return RU_SESSIONS.test(word) || EN_SESSIONS.test(word) || (word.length >= 7 && word.endsWith("s") && distance(word, "sesions") <= 1);
}

/**
 * A restoring verb, as written or with one letter off.
 *
 * @param {string} word
 * @returns {boolean}
 */
function isVerb(word) {
  if (SHORT_VERBS.has(word)) return true;

  return LONG_VERBS.some((stem) => word.length >= stem.length - 1 && [stem.length - 1, stem.length, stem.length + 1].some((length) => distance(word.slice(0, length), stem) <= 1));
}

/**
 * The edit distance of two words: letters inserted, deleted, replaced or two neighbours swapped.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function distance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }

  return rows[a.length][b.length];
}
