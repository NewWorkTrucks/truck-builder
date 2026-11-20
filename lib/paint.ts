/**
 * Every paint color the builder knows. Which ones a vehicle offers is its
 * `paints` list in the catalog; bodies and racks offer the same list.
 *
 * Factory colors follow the 2026 lists NWT supplied: Ram 1500 for the RAM and
 * Silverado 1500 for the Chevrolet, leaving out trim-only colors since the
 * builder has no trims. Hex values are sRGB APPROXIMATIONS chosen from each
 * color's name and description, not official manufacturer values; replace
 * them when swatch-matched values are available.
 */
export const PAINT_COLORS = [
  // Ram (2026 Ram 1500)
  { id: "ram-bright-white", name: "Bright White", hex: "#F4F5F2" },
  { id: "ram-diamond-black", name: "Diamond Black Crystal Pearl", hex: "#121314" },
  { id: "ram-forged-blue", name: "Forged Blue Metallic", hex: "#3B5470" },
  { id: "ram-granite-crystal", name: "Granite Crystal Metallic", hex: "#4A4D50" },
  { id: "ram-molten-red", name: "Molten Red Pearl", hex: "#8E1B1F" },
  { id: "ram-serrano-green", name: "Serrano Green Metallic", hex: "#4F5A44" },
  { id: "ram-silver-zynith", name: "Silver Zynith", hex: "#B9BCBE" },
  // Chevrolet (2026 Silverado 1500)
  { id: "chevy-summit-white", name: "Summit White", hex: "#F2F3F1" },
  { id: "chevy-black", name: "Black", hex: "#0F1012" },
  { id: "chevy-sterling-gray", name: "Sterling Gray Metallic", hex: "#5C6066" },
  { id: "chevy-cypress-gray", name: "Cypress Gray", hex: "#7B7D76" },
  { id: "chevy-riptide-blue", name: "Riptide Blue Metallic", hex: "#1F5FA8" },
  { id: "chevy-lakeshore-blue", name: "Lakeshore Blue Metallic", hex: "#23365A" },
  { id: "chevy-red-hot", name: "Red Hot", hex: "#C8102E" },
  { id: "chevy-radiant-red", name: "Radiant Red Tintcoat", hex: "#7E1424" },
  { id: "chevy-white-sands", name: "White Sands", hex: "#E6DFD0" },
  { id: "chevy-polar-white", name: "Polar White Tricoat", hex: "#F0EFEA" },
  // Retired: no longer offered, kept so quotes submitted with them still show their colors.
  { id: "white", name: "White", hex: "#F1F2EF" },
  { id: "nwt-blue", name: "NWT Blue", hex: "#1F5EFF" },
  { id: "safety-orange", name: "Safety Orange", hex: "#E0662B" },
  { id: "charcoal", name: "Charcoal", hex: "#2B2F36" },
  { id: "black", name: "Black", hex: "#111214" },
] as const;

export type PaintColor = (typeof PAINT_COLORS)[number];
export type PaintColorId = PaintColor["id"];

/**
 * The material each GLB paints with (checked by `npm run models:check`):
 * a vehicle's cab and chassis, or a painted upfit (body or rack).
 */
export const PAINT_MATERIAL = { vehicle: "body-paint", upfit: "upfit-paint" } as const;

/** The vehicle's color plus one per upfit id. An upfit without its own color matches the vehicle. */
export type Paint = { vehicle: PaintColorId; upfits: Partial<Record<string, PaintColorId>> };

export const getPaintColor = (id: string) => PAINT_COLORS.find((c) => c.id === id);
