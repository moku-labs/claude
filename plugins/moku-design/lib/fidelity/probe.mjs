/**
 * The in-page probe of the design check: one function that runs inside the page (the prototype or the build)
 * and returns the measurement of every inventory element, plus the page facts the adaptation rules need.
 *
 * It is serialized with `toString()`, so it uses nothing from this module's scope. Three sources, in order:
 * 1. A moku game page (`globalThis.doors` and `globalThis.game`): the `game.ui` tree, by key; views by
 *    `{ projection, key }` through `game.locate`. Lengths in reference units.
 * 2. `window.__layout` (the stand-in door of the research harness): `{ id: { x, y, w, h, drawn, fill, stroke, … } }`
 *    in game units.
 * 3. The DOM: `getBoundingClientRect()` and `getComputedStyle()`; CSS px.
 *
 * The same function runs through playwright (`moku-fidelity measure`) or pasted into the browser pane
 * (`moku-fidelity probe`), so the two measure the same way.
 */

/**
 * Runs in the page.
 *
 * @param {{ elements?: Record<string, { selector?: string, game?: { key?: string, projection?: string } }> | null, reference?: number, origin?: string, fonts?: Record<string, { family: string, weight?: string }> }} input
 *   `origin`: a selector whose top-left corner is 0,0 (a frame inside a gallery page); `{origin}` in an element's
 *   selector stands for it, so one selector serves every frame (`{origin} .head h2`)
 * @returns {Record<string, any>}
 */
export function pageProbe(input) {
  const out = {};
  const wanted = input?.elements ?? null;
  const reference = Number(input?.reference ?? 1080);
  const originBox = input?.origin ? document.querySelector(input.origin)?.getBoundingClientRect() : undefined;
  const ox = originBox?.x ?? 0;
  const oy = originBox?.y ?? 0;

  const round = (value) => Math.round(value * 100) / 100;
  const css = (value) => (value === "normal" || value === "" || value === undefined ? undefined : Number.parseFloat(value));
  const firstFamily = (family) => String(family ?? "").split(",")[0].trim().replace(/^["']|["']$/g, "");
  const rgba = (num, a = 1) => (typeof num === "number" ? (a === 1 ? `rgb(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255})` : `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${a})`) : num);
  const alphaOf = (colour) => {
    const m = /rgba?\(([^)]*)\)/.exec(String(colour ?? ""));
    if (!m) return colour === "transparent" ? 0 : 1;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    return parts[3] === undefined ? 1 : Number.parseFloat(parts[3]);
  };

  // 1. a moku game page
  const doors = globalThis.doors;
  const game = globalThis.game;
  if (doors && game && doors.sources?.ui) {
    const tree = doors.read(game, doors.sources.ui);
    const byKey = new Map();
    const walk = (node) => {
      if (!node) return;
      if (node.key) byKey.set(node.key, node);
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree);

    // The keys the inventory measures. Paint of any other descendant (a keyed nine-slice body, a sprite
    // child) belongs to the nearest measured ancestor: a row drawn as a sprite child is drawn as an image.
    const measured = new Set(wanted ? Object.entries(wanted).flatMap(([id, el]) => [el?.game?.key ?? id].flat()) : byKey.keys());

    // What draws a ui element is also in the components of its entity and of its descendants up to the
    // next measured element: Sprite and NineSlice are images, Shape is a fill and a stroke. Best effort: a
    // door that answers otherwise leaves the style as the only source.
    const parts = new Map();
    try {
      const snapshot = doors.read(game, doors.sources.entities, {});
      const rows = Array.isArray(snapshot) ? snapshot : (snapshot?.entities ?? []);
      const comps = (row) => (Array.isArray(row.components) ? Object.fromEntries(row.components.map((c) => [c.name ?? c.type, c.value ?? c.data ?? c])) : (row.components ?? {}));
      const keyed = new Set([...measured].map((key) => game.ui?.find?.(key)).filter((id) => id !== undefined));
      const children = new Map();
      for (const row of rows) {
        const parent = comps(row).Parent?.entity;
        if (parent !== undefined) children.set(parent, [...(children.get(parent) ?? []), row]);
      }
      const byId = new Map(rows.map((row) => [row.id, row]));
      for (const key of byKey.keys()) {
        const id = game.ui?.find?.(key);
        if (id === undefined || !byId.has(id)) continue;
        const own = [byId.get(id)];
        for (let i = 0; i < own.length; i++) for (const row of children.get(own[i].id) ?? []) if (!keyed.has(row.id)) own.push(row);
        const found = { drawn: new Set(), fill: undefined, stroke: undefined, image: undefined };
        for (const row of own) {
          const c = comps(row);
          if (c.Sprite && c.Sprite.texture) {
            found.drawn.add("image");
            found.image ??= String(c.Sprite.texture);
          }
          if (c.NineSlice) {
            found.drawn.add("image");
            found.image ??= String(c.NineSlice.texture ?? c.NineSlice.key ?? "nine-slice");
          }
          if (c.Shape && c.Shape.kind !== "arc" && (c.Shape.fillAlpha ?? 1) > 0 && (c.Shape.alpha ?? 1) > 0 && !c.Text) {
            found.drawn.add("fill");
            found.fill ??= rgba(c.Shape.fill, round((c.Shape.fillAlpha ?? 1) * 100) / 100);
          }
          if (c.Shape && (c.Shape.strokeWidth ?? 0) > 0) {
            found.drawn.add("stroke");
            found.stroke ??= { width: c.Shape.strokeWidth, color: rgba(c.Shape.stroke) };
          }
        }
        parts.set(key, found);
      }
    } catch {
      /* the style alone */
    }

    const canvas = document.querySelector("canvas");
    const box = canvas?.getBoundingClientRect();
    const toRef = box ? reference / box.width : 1;
    const ids = wanted ? Object.keys(wanted) : [...byKey.keys()];
    for (const id of ids) {
      // A key may be a list: the first one on screen (one element shown under another key in another state).
      const given = wanted?.[id]?.game ?? { key: id };
      const ref = Array.isArray(given.key) ? { ...given, key: given.key.find((key) => byKey.has(key)) ?? given.key[0] } : given;
      if (ref.projection) {
        const rect = doors.read(game, doors.sources.locate, { target: { projection: ref.projection, key: ref.key } });
        out[id] = rect && box ? { present: true, x: (rect.x - box.x) * toRef, y: (rect.y - box.y) * toRef, w: rect.w * toRef, h: rect.h * toRef, drawn: ref.drawn ?? [], source: "locate" } : { present: false };
        continue;
      }

      const node = byKey.get(ref.key ?? id);
      if (!node) {
        out[id] = { present: false };
        continue;
      }

      const style = { ...(node.style ?? {}) };
      const a = style.alpha ?? 1;
      const drawn = [];
      if (node.type === "image" || node.type === "icon" || style.nineSlice) drawn.push("image");
      if (typeof style.fill === "number" && !style.nineSlice && node.type !== "text") drawn.push("fill");
      if ((style.strokeWidth ?? 0) > 0 && typeof style.stroke === "number" && !style.nineSlice) drawn.push("stroke");
      const fromParts = parts.get(ref.key ?? id);
      for (const kind of fromParts?.drawn ?? []) if (!drawn.includes(kind)) drawn.push(kind);
      let childImage;
      const paintOf = (child) => {
        const cs = child.style ?? {};
        if (child.type === "image" || child.type === "icon" || cs.nineSlice) {
          if (!drawn.includes("image")) drawn.push("image");
          childImage ??= cs.nineSlice ?? child.local?.texture;
        }
        if (child.type !== "text" && typeof cs.fill === "number" && !cs.nineSlice && !drawn.includes("fill")) drawn.push("fill");
        if ((cs.strokeWidth ?? 0) > 0 && typeof cs.stroke === "number" && !cs.nineSlice && !drawn.includes("stroke")) drawn.push("stroke");
        for (const next of child.children ?? []) if (!(next.key && measured.has(next.key))) paintOf(next);
      };
      for (const child of node.children ?? []) if (!(child.key && measured.has(child.key))) paintOf(child);
      const element = {
        present: true,
        x: node.rect.x,
        y: node.rect.y,
        w: node.rect.w,
        h: node.rect.h,
        drawn,
        fill: typeof style.fill === "number" && drawn.includes("fill") && node.type !== "text" ? rgba(style.fill) : (fromParts?.fill ?? "rgba(0, 0, 0, 0)"),
        gradient: null,
        stroke: (style.strokeWidth ?? 0) > 0 && typeof style.stroke === "number" ? { width: style.strokeWidth, color: rgba(style.stroke) } : (fromParts?.stroke ?? null),
        radius: style.radius ?? 0,
        shadow: style.shadow ? `${style.shadow.x ?? 0}px ${style.shadow.y ?? 0}px ${style.shadow.blur ?? 0}px 0px ${rgba(style.shadow.color ?? 0, style.shadow.alpha ?? 1)}` : "none",
        opacity: a,
        image: style.nineSlice ?? fromParts?.image ?? node.local?.texture ?? childImage ?? undefined,
        source: "game.ui",
      };
      if (node.type === "text" && node.content !== undefined) {
        // The ui door names a text style; the drawn object (renderer.sync.displayOf) holds its numbers. Its
        // face is an asset key: `build.fonts` of the spec names the face and weight behind each key.
        let drawnText;
        try {
          const shown = game.renderer?.sync?.displayOf?.(game.ui?.find?.(ref.key ?? id));
          drawnText = [shown, ...(shown?.children ?? [])].find((part) => typeof part?.style?.fontSize === "number");
        } catch {
          /* the style alone */
        }
        if (drawnText) {
          const ts = drawnText.style;
          const face = input?.fonts?.[ts.fontFamily];
          const lines = Math.max(1, String(drawnText.text ?? node.content).split("\n").length);
          Object.assign(style, {
            fontFamily: face?.family ?? ts.fontFamily,
            fontWeight: face?.weight ?? ts.fontWeight,
            fontSize: ts.fontSize,
            lineHeight: ts.lineHeight > 0 ? ts.lineHeight : round(drawnText.height / lines),
            letterSpacing: ts.letterSpacing ?? 0,
            fill: typeof ts.fill === "number" ? ts.fill : style.fill,
          });
        }
        Object.assign(element, {
          text: String(node.content).replace(/\s+/g, " ").trim(),
          family: style.fontFamily ?? style.font,
          weight: String(style.fontWeight ?? style.weight ?? ""),
          size: style.fontSize ?? style.size,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing ?? 0,
          color: rgba(style.fill ?? style.color),
          textStyle: node.textStyle,
        });
      }
      out[id] = element;
    }

    out["@page"] = { scrollW: document.scrollingElement?.scrollWidth ?? 0, innerW: innerWidth, clipped: [] };
    return out;
  }

  // 2. the research harness's stand-in door
  const layout = globalThis.__layout;
  if (layout && typeof layout === "object") {
    const ids = wanted ? Object.keys(wanted) : Object.keys(layout);
    for (const id of ids) {
      const g = layout[id];
      if (!g) {
        out[id] = { present: false };
        continue;
      }

      const gradient = /gradient/.test(String(g.bg ?? g.fill ?? "")) ? String(g.bg ?? g.fill) : g.gradient ?? null;
      const fill = gradient ? "rgba(0, 0, 0, 0)" : (g.fill ?? g.bg ?? "rgba(0, 0, 0, 0)");
      const drawn = Array.isArray(g.drawn) ? g.drawn : [gradient ? "gradient" : alphaOf(fill) > 0 ? "fill" : "", g.image ? "image" : "", (g.stroke?.width ?? 0) > 0 ? "stroke" : ""].filter(Boolean);
      const element = { present: true, x: g.x, y: g.y, w: g.w, h: g.h, drawn, fill, gradient, stroke: g.stroke ?? null, radius: Number(g.radius ?? 0), shadow: g.shadow ?? "none", opacity: g.opacity ?? 1, image: g.image, source: "__layout" };
      if (g.text !== undefined) {
        Object.assign(element, { text: String(g.text).replace(/\s+/g, " ").trim(), family: g.family, weight: String(g.weight), size: Number(g.size), lineHeight: g.lineHeight === undefined ? undefined : Number(g.lineHeight), letterSpacing: Number(g.letterSpacing ?? 0), color: g.color, fontLoaded: [...document.fonts].some((face) => face.family.replace(/["']/g, "") === g.family && face.status === "loaded") });
      }
      out[id] = element;
    }

    out["@page"] = { scrollW: document.scrollingElement?.scrollWidth ?? 0, innerW: innerWidth, clipped: [] };
    return out;
  }

  // 3. the DOM
  const nodes = wanted
    ? Object.entries(wanted).map(([id, def]) => [id, document.querySelector((def.selector ?? `[data-check="${CSS.escape(id)}"]`).replaceAll("{origin}", input?.origin ?? ""))])
    : [...document.querySelectorAll("[data-check]")].map((el) => [el.getAttribute("data-check"), el]);

  const effectiveOpacity = (el) => {
    let value = 1;
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) value *= Number.parseFloat(getComputedStyle(node).opacity || "1");
    return round(value);
  };
  const ownText = (el) => [...el.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join("").replace(/\s+/g, " ").trim();
  // `normal` is the face's own line height: measured on a hidden block with the same font, never guessed as 1.2 em
  const lineHeightOf = (cs) => {
    const value = css(cs.lineHeight);
    if (value !== undefined) return value;
    const probe = document.createElement("span");
    probe.textContent = "Hg";
    probe.style.cssText = `position:absolute;visibility:hidden;display:block;white-space:nowrap;left:-9999px;top:0;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};font-style:${cs.fontStyle};font-stretch:${cs.fontStretch};line-height:normal`;
    document.body.appendChild(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return round(height);
  };
  const strokeOf = (cs) => {
    const sides = ["Top", "Right", "Bottom", "Left"].map((side) => ({ width: css(cs[`border${side}Width`]) ?? 0, style: cs[`border${side}Style`], color: cs[`border${side}Color`] }));
    const drawnSides = sides.filter((side) => side.width > 0 && side.style !== "none" && side.style !== "hidden" && alphaOf(side.color) > 0);
    if (drawnSides.length === 0) {
      const outline = css(cs.outlineWidth) ?? 0;
      return outline > 0 && cs.outlineStyle !== "none" && alphaOf(cs.outlineColor) > 0 ? { width: outline, color: cs.outlineColor, style: `outline ${cs.outlineStyle}` } : null;
    }
    const widest = drawnSides.sort((p, q) => q.width - p.width)[0];
    return { width: widest.width, color: widest.color, style: drawnSides.length === 4 ? widest.style : `${widest.style} (${drawnSides.length} sides)` };
  };

  for (const [id, el] of nodes) {
    if (!id) continue;
    if (!el) {
      out[id] = { present: false };
      continue;
    }

    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const visible = rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && effectiveOpacity(el) > 0;
    if (!visible) {
      out[id] = { present: false };
      continue;
    }

    const bgImage = cs.backgroundImage && cs.backgroundImage !== "none" ? cs.backgroundImage : "";
    const urlImage = /url\(/.test(bgImage);
    const gradient = /gradient\(/.test(bgImage) ? bgImage.replace(/url\([^)]*\),?\s*/g, "").trim() || null : null;
    const replaced = /^(IMG|SVG|CANVAS|VIDEO|PICTURE)$/i.test(el.tagName);
    const stroke = strokeOf(cs);
    const drawn = [];
    if (replaced || urlImage || (cs.maskImage && cs.maskImage !== "none")) drawn.push("image");
    if (alphaOf(cs.backgroundColor) > 0) drawn.push("fill");
    if (gradient) drawn.push("gradient");
    if (stroke) drawn.push("stroke");

    const imageSrc = el.currentSrc || el.getAttribute?.("src") || (/url\(["']?([^"')]+)/.exec(bgImage)?.[1] ?? "");
    const element = {
      present: true,
      x: round(rect.x - ox),
      y: round(rect.y - oy),
      w: round(rect.width),
      h: round(rect.height),
      drawn,
      fill: cs.backgroundColor,
      gradient,
      stroke,
      radius: css(cs.borderTopLeftRadius.endsWith("%") ? `${(Number.parseFloat(cs.borderTopLeftRadius) / 100) * Math.min(rect.width, rect.height)}` : cs.borderTopLeftRadius) ?? 0,
      shadow: cs.boxShadow,
      opacity: effectiveOpacity(el),
      image: imageSrc ? imageSrc.split("/").pop() : undefined,
    };

    const text = ownText(el);
    if (text) {
      const family = firstFamily(cs.fontFamily);
      Object.assign(element, {
        text,
        family,
        weight: cs.fontWeight,
        size: css(cs.fontSize),
        lineHeight: lineHeightOf(cs),
        letterSpacing: css(cs.letterSpacing) ?? 0,
        color: cs.color,
        textShadow: cs.textShadow,
        fontLoaded: document.fonts.check(`${cs.fontWeight} ${cs.fontSize} "${family}"`) && [...document.fonts].some((face) => face.family.replace(/["']/g, "") === family && face.status === "loaded"),
      });
      if (!element.fontLoaded && ![...document.fonts].some((face) => face.family.replace(/["']/g, "") === family)) element.fontLoaded = undefined;
    }
    out[id] = element;
  }

  const clipped = nodes.filter(([, el]) => el && ownText(el) && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible").map(([id]) => id);
  out["@page"] = { scrollW: document.scrollingElement?.scrollWidth ?? 0, innerW: innerWidth, clipped };
  return out;
}

/**
 * The probe as one expression to paste into the browser pane's `javascript_tool`; it evaluates to the JSON text.
 *
 * @param {Record<string, any> | null} elements
 * @param {number} [reference]
 * @param {string} [origin]
 * @returns {string}
 */
export function probeExpression(elements, reference = 1080, origin = undefined, fonts = undefined) {
  return `JSON.stringify((${pageProbe.toString()})(${JSON.stringify({ elements, reference, origin, fonts })}))`;
}
