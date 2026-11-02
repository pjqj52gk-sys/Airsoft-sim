import type { Project } from "./project";
export function comparisonBounds(projects: Project[]) {
  const bounds = projects.flatMap((p) =>
    p.layers
      .filter((l) => l.visible)
      .map((l) => {
        const w = l.mm,
          h = (l.mm * l.height) / l.width,
          r = (l.rotation * Math.PI) / 180;
        const rw = Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r)),
          rh = Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r));
        return {
          left: l.x + w / 2 - rw / 2,
          right: l.x + w / 2 + rw / 2,
          top: l.y + h / 2 - rh / 2,
          bottom: l.y + h / 2 + rh / 2,
        };
      }),
  );
  if (!bounds.length) return "0 0 1120 620";
  const x = Math.min(...bounds.map((b) => b.left)) - 30,
    y = Math.min(...bounds.map((b) => b.top)) - 30;
  return `${x} ${y} ${Math.max(...bounds.map((b) => b.right)) - x + 30} ${Math.max(...bounds.map((b) => b.bottom)) - y + 30}`;
}
