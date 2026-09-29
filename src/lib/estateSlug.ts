import { BELGROVE_PLOTS } from "./belgroveData";

export const ESTATE_SLUGS: Record<string, string> = {
  "aurum-residence": "Aurum Residence",
  "belgrove-peninsula": "Belgrove Peninsula",
  "starlight-estate": "Starlight Estate",
  "sunrise-estate": "Sunrise Estate",
  "downtown-golf-resort": "Downtown Golf Resort",
};

export function estateNameFromSlug(slug: string): string | null {
  return ESTATE_SLUGS[slug] ?? null;
}

export function slugFromEstateName(name: string): string | null {
  for (const [slug, n] of Object.entries(ESTATE_SLUGS)) if (n === name) return slug;
  return null;
}

export function getPlotsForEstate(estateName: string) {
  return BELGROVE_PLOTS.filter((p) => p.estate === estateName);
}

export function getPlotBySlug(estateSlug: string, plotSlug: string) {
  const estateName = estateNameFromSlug(estateSlug);
  if (!estateName) return null;
  // plotSlug matches plot.id (kebab, e.g. peninsula-150)
  return BELGROVE_PLOTS.find((p) => p.estate === estateName && p.id === plotSlug) ?? null;
}

export function getAllEstateSlugs() {
  return Object.keys(ESTATE_SLUGS);
}
