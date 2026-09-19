import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ASTRA_MODEL, codexArgs } from "../../lib/astra/codex-args.mjs";
import { stampManifest } from "../../lib/astra/manifest.mjs";
import { reviewPrompt } from "../../lib/astra/prompts.mjs";

describe("codexArgs", () => {
  const args = codexArgs({ prompt: "Review these", images: ["a.png", "b.png"], schema: "s.json", output: "o.json", sandbox: "read-only" });

  it("puts `--` between the greedy image list and the prompt", () => {
    const separator = args.indexOf("--");

    assert.equal(args[separator - 1], "a.png,b.png");
    assert.equal(args[separator + 1], "Review these");
    assert.equal(separator, args.length - 2);
  });

  it("asks for Astra in a read-only sandbox with a schema-bound answer", () => {
    assert.deepEqual(args.slice(0, 5), ["exec", "-m", ASTRA_MODEL, "--sandbox", "read-only"]);
    assert.equal(args[args.indexOf("--output-schema") + 1], "s.json");
  });

  it("omits -i when there are no images", () => {
    assert.equal(codexArgs({ prompt: "OK", output: "o.txt", sandbox: "read-only" }).includes("-i"), false);
  });
});

describe("reviewPrompt", () => {
  it("asks for observations, not taste, and carries the design context", () => {
    const prompt = reviewPrompt({ designContext: "Primary action is always bottom-right.", focus: "mobile" });

    assert.match(prompt, /Do not report personal taste/);
    assert.match(prompt, /bottom-right/);
    assert.match(prompt, /Focus: mobile/);
  });
});

describe("stampManifest", () => {
  it("records model, backend and date so the art can be regenerated", () => {
    const stamped = stampManifest({ assets: [{ file: "flame.png" }] }, { model: "gpt-6-astra", backend: "codex", date: "2026-09-19" });

    assert.deepEqual(stamped.generated, { model: "gpt-6-astra", backend: "codex", date: "2026-09-19" });
    assert.equal(stamped.assets.length, 1);
  });
});
