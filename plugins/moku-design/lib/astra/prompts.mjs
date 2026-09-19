/**
 * Prompt builders for the three Astra modes.
 *
 * Pure text assembly. Astra is a second opinion on user experience,
 * so the prompts ask for observations a user would feel, not for taste.
 */

/**
 * @param {{ designContext?: string, focus?: string }} input
 * @returns {string}
 * @example
 * reviewPrompt({ focus: "checkout flow on mobile" });
 */
export function reviewPrompt({ designContext, focus }) {
  const parts = [
    "You are reviewing screenshots of a running web app as a second, independent reviewer of user experience.",
    "Report problems a real user would feel: confusing hierarchy, unreadable text, broken or cramped layout, inconsistent controls, weak responsive behavior, accessibility gaps, and places where the screens depart from the agreed design.",
    "State each problem as an observation with its location. Do not report personal taste. Do not comment on code.",
    "Order findings by severity. An empty list is a valid answer when the screens are sound.",
  ];

  if (focus) parts.push(`Focus: ${focus}`);
  if (designContext) parts.push(`The agreed design context (a specification, not source code) follows.\n\n${designContext}`);

  return parts.join("\n\n");
}

/**
 * @param {{ brief: string, outDir: string, transparent: boolean, size: string }} input
 * @returns {string}
 * @example
 * generatePrompt({ brief: "6 habit icons, flat, 2px stroke", outDir: "assets/icons", transparent: true, size: "1024x1024" });
 */
export function generatePrompt({ brief, outDir, transparent, size }) {
  return [
    "Generate image assets with your image generation tool and save them as files.",
    `Brief: ${brief}`,
    `Save every image into the directory "${outDir}" (create it if needed). Use lowercase kebab-case file names that describe the content.`,
    `Size: ${size}. Background: ${transparent ? "transparent PNG" : "opaque"}.`,
    "Keep one consistent visual style across the whole set.",
    "When done, answer with the manifest of what you wrote, including the exact prompt used for each image.",
  ].join("\n\n");
}

/**
 * @param {{ instruction: string, outDir: string }} input
 * @returns {string}
 * @example
 * editPrompt({ instruction: "make the flame icon match the stroke weight of the others", outDir: "assets/icons" });
 */
export function editPrompt({ instruction, outDir }) {
  return [
    "Edit the attached image(s) with your image generation tool.",
    `Instruction: ${instruction}`,
    `Save the result into "${outDir}" next to the original, adding the suffix "-v2" to the file name. Never overwrite the original.`,
    "When done, answer with the manifest of what you wrote.",
  ].join("\n\n");
}
