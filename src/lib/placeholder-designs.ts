import type { DesignVariant } from "@/store/app-store";

const BASE_DESIGNS: Omit<DesignVariant, "id">[] = [
  {
    gradient: "radial-gradient(ellipse at 50% 40%, #4a0080 0%, #1a0030 40%, #0d0010 100%)",
    patternType: "mandala",
    styleName: "Sacred Mandala",
  },
  {
    gradient: "radial-gradient(ellipse at 40% 35%, #8b0000 0%, #3a0000 40%, #0a0000 100%)",
    patternType: "dark",
    styleName: "Dark Gothic",
  },
  {
    gradient: "radial-gradient(ellipse at 60% 55%, #005050 0%, #002020 50%, #000a0a 100%)",
    patternType: "japanese",
    styleName: "Ocean Koi",
  },
  {
    gradient: "radial-gradient(ellipse at 45% 45%, #c9a84c 0%, #6b4800 50%, #1a1000 100%)",
    patternType: "floral",
    styleName: "Golden Rose",
  },
  {
    gradient: "radial-gradient(ellipse at 50% 50%, #1a2a4a 0%, #0a1a2a 50%, #000a0d 100%)",
    patternType: "geometric",
    styleName: "Geometric Compass",
  },
  {
    gradient: "radial-gradient(ellipse at 55% 40%, #1a3a1a 0%, #0a1a08 50%, #000500 100%)",
    patternType: "tribal",
    styleName: "Forest Tribal",
  },
  {
    gradient: "radial-gradient(ellipse at 45% 50%, #2a0a3a 0%, #100018 50%, #040005 100%)",
    patternType: "biomech",
    styleName: "Biomechanical",
  },
  {
    gradient: "radial-gradient(ellipse at 50% 45%, #3a1a00 0%, #1a0800 50%, #050200 100%)",
    patternType: "minimal",
    styleName: "Fine Line Script",
  },
  {
    gradient: "radial-gradient(ellipse at 40% 40%, #002a4a 0%, #001220 50%, #000408 100%)",
    patternType: "japanese",
    styleName: "Irezumi Wave",
  },
  {
    gradient: "radial-gradient(ellipse at 55% 55%, #4a1a00 0%, #200a00 50%, #080200 100%)",
    patternType: "floral",
    styleName: "Neo Traditional",
  },
];

let counter = 0;

export function generateMockDesigns(count = 8): DesignVariant[] {
  counter++;
  return BASE_DESIGNS.slice(0, count).map((d, i) => ({
    ...d,
    id: `design-${counter}-${i}`,
    gradient: d.gradient,
  }));
}

export const BODY_COMPOSITE_GRADIENTS = [
  "linear-gradient(160deg, #1a1a1a 0%, #2a2a2a 100%)",
  "linear-gradient(160deg, #1a0a0a 0%, #2a1a1a 100%)",
  "linear-gradient(160deg, #0a1a1a 0%, #1a2a2a 100%)",
];
