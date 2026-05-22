// ============================================================
// CLEOPATRA INK STUDIO — All AI Prompts
// Edit this file to tune what gets sent to the image model.
// ============================================================

import { getColorsByHex } from "@/lib/tattoo-colors";

// ── Types ────────────────────────────────────────────────────

export interface RefinementImage {
  name: string;   // e.g. "Variation 2"
  index: number;  // 1-based position in the input_urls array
}

export interface RefinementInfo {
  text: string;
  selectedImages: RefinementImage[];
}

// ── Helpers ──────────────────────────────────────────────────

function buildPaletteBlock(colorHexes: string[] = []): { directive: string; constraint: string } {
  const palette = getColorsByHex(colorHexes);

  if (palette.length === 0) {
    return {
      directive: "",
      constraint: "- Black & grey only — no colour fills. Pure black ink with grey wash shading.",
    };
  }

  const lines = palette.map((c) => `  - ${c.name} (${c.hex}) — ${c.usage}`).join("\n");

  return {
    directive: `
COLOUR PALETTE — use ONLY these inks, no other hues:
${lines}

- Balance the colours naturally within the composition.
- If one colour is listed, the design must be monochromatic in that ink.
- Render pigments as saturated and freshly tattooed, not faded.
`.trim(),
    constraint: "- Use ONLY the colours in the COLOUR PALETTE above. Any other hue is wrong.",
  };
}

// ── 1. TATTOO DESIGN — Initial Generation ───────────────────

export function buildInitialDesignPrompt(
  description: string,
  style: string,
  hasReferenceImages: boolean,
  colorHexes: string[] = []
): string {
  const styleLabel = style || "fine-line black-and-grey";
  const palette = buildPaletteBlock(colorHexes);
  const hasColors = colorHexes.length > 0;

  const referenceDirective = hasReferenceImages
    ? "Extract the core motifs, composition, and linework character from the reference images and translate them into this tattoo design."
    : "";

  const shadingLine = hasColors
    ? "- Shading: solid colour fills from the COLOUR PALETTE with smooth gradients and confident black outlines"
    : "- Shading: smooth black-and-grey gradients using stippling or hatching";

  return `
Create a single, complete ${styleLabel} tattoo design.

DESCRIPTION: ${description.trim()}

${referenceDirective}

${palette.directive}

STYLE:
- ${styleLabel} tattoo, hand-drawn quality
- Linework: confident black ink strokes — bold outlines with fine interior detail
${shadingLine}
- Composition: balanced and centred, designed to read clearly at small sizes on skin
- Finish: crisp, sharp edges — no smearing or blurriness

OUTPUT:
- Pure white background
${palette.constraint}
- No body parts, skin, hands, or tattoo machines
- No typography, watermarks, or borders
- Single design, square (1:1) aspect ratio
- Professional tattoo studio quality
`.trim();
}

// ── 2. TATTOO DESIGN — Refinement ───────────────────────────

export function buildRefinementPrompt(
  description: string,
  style: string,
  refinement: RefinementInfo,
  colorHexes: string[] = []
): string {
  const styleLabel = style || "fine-line black-and-grey";
  const palette = buildPaletteBlock(colorHexes);

  const imageLabels = refinement.selectedImages
    .map((img) => `  - Image ${img.index}: "${img.name}"`)
    .join("\n");

  return `
Refine this tattoo design based on the selected variations and customer feedback.

ORIGINAL DESCRIPTION: ${description.trim()}

REFERENCE IMAGES (variations the customer liked):
${imageLabels}

CUSTOMER FEEDBACK:
"${refinement.text.trim()}"

${palette.directive}

INSTRUCTIONS:
- Blend the best elements from the reference images according to the customer's feedback
- If one image is selected, use it as the primary basis and apply the feedback on top
- Deliver a complete, standalone tattoo design — not a collage or side-by-side comparison

STYLE: ${styleLabel} tattoo, professional quality.

OUTPUT:
- Pure white background
- No body parts, skin, text, or watermarks
- Single centred design, square (1:1) aspect ratio
- Crisp, sharp linework
${palette.constraint}
`.trim();
}

// ── 3. Unified entry point used by /api/generate ─────────────

export function buildTattooPrompt(
  description: string,
  style: string,
  hasReferenceImages: boolean,
  refinement?: RefinementInfo,
  colorHexes: string[] = []
): string {
  if (refinement && refinement.selectedImages.length > 0) {
    return buildRefinementPrompt(description, style, refinement, colorHexes);
  }
  return buildInitialDesignPrompt(description, style, hasReferenceImages, colorHexes);
}

// ── 4. PLACEMENT — Standard mode ────────────────────────────
// Input images: [tattoo design, body photo (optional)]

export function buildPlacementPrompt(placementDescription: string, hasBodyPhoto: boolean): string {
  const placementClause = placementDescription.trim()
    ? `Place the tattoo on the ${placementDescription.trim()}.`
    : "Place the tattoo in the most aesthetically fitting location visible in the image.";

  const bodyContext = hasBodyPhoto
    ? "Image 1 is the tattoo design. Image 2 is the customer's body photo — composite the tattoo naturally onto it."
    : "Image 1 is the tattoo design. Generate a realistic body showing the placement area and composite the tattoo onto it.";

  return `
Create a realistic tattoo placement preview.

${placementClause}
${bodyContext}

REQUIREMENTS:
- The tattoo ink appears absorbed into the skin surface — follows skin curves, contours, and lighting
- Match the lighting direction and shadows from the body photo
- Preserve the tattoo's linework, detail, and proportions exactly — do not alter the design
- Tattoo edges blend seamlessly into the surrounding skin — no borders or sticker effect
- Scale the tattoo anatomically for the body part
- Add subtle skin highlights and shadows over the tattoo for realism

OUTPUT: The full body photo with the tattoo composited in place — photorealistic, professional tattoo portfolio quality.
`.trim();
}

// ── 5. PLACEMENT — Composite mode ───────────────────────────
// Input images: [composite (position reference), tattoo design (detail reference), body photo (skin/light reference)]
// The composite is the canvas output where the customer manually positioned the tattoo.

export function buildCompositePrompt(): string {
  return `
You have three reference images:
1. The composite — shows the tattoo placed on the body at the exact chosen position, size, and angle
2. The tattoo design — the clean, isolated design with full linework detail
3. The body photo — the original skin with natural lighting and texture

Render the tattoo as genuinely inked onto the skin:
- Use image 1 for exact placement — keep the tattoo at precisely that position, size, and angle
- Use image 2 for design accuracy — preserve every line and element of the tattoo faithfully
- Use image 3 for skin realism — match the natural lighting, shadows, and skin texture
- The tattoo ink sits absorbed into the skin — not floating, not pasted on
- Tattoo edges fade seamlessly into surrounding skin, no harsh borders
- Output is a natural photograph of a real tattoo — same framing and background as image 3
`.trim();
}
