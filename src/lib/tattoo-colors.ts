// Master tattoo colour palette — shared by the design-step UI and the
// server-side prompt builder so swatches and AI prompts never drift.
export interface TattooColor {
  name: string;
  hex: string;       // e.g. "#0A0A0A"
  usage: string;     // short tattooist-facing note used in the AI prompt
}

export const TATTOO_COLORS: readonly TattooColor[] = [
  { name: "Deep Black",         hex: "#0A0A0A", usage: "Outlines, shading, blackout, lettering" },
  { name: "Charcoal Grey",      hex: "#555555", usage: "Realism shading, gradients" },
  { name: "Pure White",         hex: "#F5F5F5", usage: "Highlights, contrast details" },
  { name: "Blood Red",          hex: "#B11226", usage: "Traditional, Japanese, symbolic tattoos" },
  { name: "Crimson Red",        hex: "#8B0000", usage: "Darker dramatic work" },
  { name: "Royal Blue",         hex: "#0057B8", usage: "Japanese waves, neo-traditional" },
  { name: "Navy Blue",          hex: "#1B2951", usage: "Depth shading and contrast" },
  { name: "Emerald Green",      hex: "#008C45", usage: "Nature, dragons, snakes" },
  { name: "Olive Green",        hex: "#556B2F", usage: "Military, earthy palettes" },
  { name: "Golden Yellow",      hex: "#F2C300", usage: "Highlights, traditional tattoos" },
  { name: "Burnt Orange",       hex: "#CC5500", usage: "Neo-traditional, sunsets, flames" },
  { name: "Purple Violet",      hex: "#6A0DAD", usage: "Floral and fantasy designs" },
  { name: "Hot Pink / Magenta", hex: "#E0115F", usage: "Modern anime/pop tattoos" },
  { name: "Brown Sepia",        hex: "#704214", usage: "Vintage and realism tones" },
  { name: "Skin / Flesh Tone",  hex: "#C68642", usage: "Realism blending and repair work" },
] as const;

export function getColorsByHex(hexes: string[]): TattooColor[] {
  const set = new Set(hexes.map((h) => h.toUpperCase()));
  return TATTOO_COLORS.filter((c) => set.has(c.hex.toUpperCase()));
}
