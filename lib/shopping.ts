import type { Project } from "./project.ts";
export function shoppingSummary(project: Project) {
  const planned = project.layers.filter((layer) => layer.owned !== true);
  return {
    plannedCount: planned.length,
    ownedCount: project.layers.length - planned.length,
    plannedTotal: planned.reduce((sum, layer) => sum + layer.price, 0),
    total: project.layers.reduce((sum, layer) => sum + layer.price, 0),
    missingPrices: planned.filter((layer) => layer.price === 0).length,
  };
}
export function copyCommunityShoppingPlan(project: Project): Project {
  return {
    ...project,
    layers: project.layers.map((layer) => ({
      ...layer,
      owned: false,
      linkOrigin: "shared",
    })),
  };
}
