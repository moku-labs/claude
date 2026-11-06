/**
 * PNG reading and the per-element pixel diff of the design check. A diagnostic, never a verdict: it points at
 * the element whose pixels differ most, so a person or the checker looks at that pair of shots first.
 *
 * Reads 8-bit, non-interlaced PNG (greyscale, RGB, RGBA, grey+alpha, palette), which is what a browser
 * screenshot writes. Anything else returns undefined and the diff is skipped.
 */

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

/**
 * @param {string} file
 * @returns {{ width: number, height: number, data: Uint8Array } | undefined} RGBA pixels
 */
export function readPng(file) {
  let bytes;
  try {
    bytes = readFileSync(file);
  } catch {
    return undefined;
  }
  return decodePng(bytes);
}

/**
 * @param {Uint8Array} bytes
 * @returns {{ width: number, height: number, data: Uint8Array } | undefined}
 */
export function decodePng(bytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) return undefined;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let header;
  let palette;
  let transparency;
  const idat = [];
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") header = { width: view.getUint32(offset + 8), height: view.getUint32(offset + 12), depth: body[8], colour: body[9], interlace: body[12] };
    else if (type === "PLTE") palette = body;
    else if (type === "tRNS") transparency = body;
    else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    offset += 12 + length;
  }

  if (!header || header.depth !== 8 || header.interlace !== 0) return undefined;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header.colour];
  if (!channels) return undefined;

  const raw = inflateSync(Buffer.concat(idat));
  const { width, height } = header;
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    unfilter(filter, line, pixels, y, stride, channels);
  }

  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = pixels.subarray(i * channels, (i + 1) * channels);
    const [r, g, b, a] =
      header.colour === 6 ? p
      : header.colour === 2 ? [p[0], p[1], p[2], 255]
      : header.colour === 0 ? [p[0], p[0], p[0], 255]
      : header.colour === 4 ? [p[0], p[0], p[0], p[1]]
      : [palette?.[p[0] * 3] ?? 0, palette?.[p[0] * 3 + 1] ?? 0, palette?.[p[0] * 3 + 2] ?? 0, transparency?.[p[0]] ?? 255];
    data.set([r, g, b, a], i * 4);
  }

  return { width, height, data };
}

/**
 * The share of pixels inside a box that differ between two shots (any channel off by more than 40 of 255,
 * so anti-aliasing and sub-pixel text do not count).
 *
 * @param {{ width: number, height: number, data: Uint8Array }} a
 * @param {{ width: number, height: number, data: Uint8Array }} b
 * @param {{ x: number, y: number, w: number, h: number }} box in shot pixels
 * @returns {number | undefined} percent, or undefined when the box is outside either shot
 */
export function boxDiff(a, b, box) {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(a.width, b.width, Math.ceil(box.x + box.w));
  const y1 = Math.min(a.height, b.height, Math.ceil(box.y + box.h));
  if (x1 <= x0 || y1 <= y0) return undefined;

  let differ = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * a.width + x) * 4;
      const j = (y * b.width + x) * 4;
      const far = Math.max(Math.abs(a.data[i] - b.data[j]), Math.abs(a.data[i + 1] - b.data[j + 1]), Math.abs(a.data[i + 2] - b.data[j + 2]));
      if (far > 40) differ++;
    }
  }

  return Math.round((10000 * differ) / ((x1 - x0) * (y1 - y0))) / 100;
}

/**
 * @param {number} filter
 * @param {Uint8Array} line
 * @param {Uint8Array} out
 * @param {number} y
 * @param {number} stride
 * @param {number} bpp
 */
function unfilter(filter, line, out, y, stride, bpp) {
  const row = y * stride;
  const prev = y > 0 ? row - stride : -1;
  for (let x = 0; x < stride; x++) {
    const left = x >= bpp ? out[row + x - bpp] : 0;
    const up = prev >= 0 ? out[prev + x] : 0;
    const corner = prev >= 0 && x >= bpp ? out[prev + x - bpp] : 0;
    let value = line[x];
    if (filter === 1) value += left;
    else if (filter === 2) value += up;
    else if (filter === 3) value += (left + up) >> 1;
    else if (filter === 4) value += paeth(left, up, corner);
    out[row + x] = value & 255;
  }
}

/** @param {number} a @param {number} b @param {number} c */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
