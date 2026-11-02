import type { Project } from "@/lib/project";
import { comparisonBounds } from "@/lib/comparison";
export default function BuildPreview({
  project,
  viewBox,
}: {
  project: Project;
  viewBox?: string;
}) {
  return (
    <svg
      className="build-preview"
      viewBox={viewBox || comparisonBounds([project])}
      role="img"
      aria-label={`${project.name}の外観`}
    >
      {project.layers
        .filter((l) => l.visible)
        .map((l) => {
          const w = l.mm,
            h = (l.mm * l.height) / l.width;
          return (
            <g
              key={l.id}
              transform={`translate(${l.x + w / 2} ${l.y + h / 2}) rotate(${l.rotation}) scale(${l.flip ? -1 : 1} 1)`}
            >
              <image href={l.src} x={-w / 2} y={-h / 2} width={w} height={h} />
            </g>
          );
        })}
    </svg>
  );
}
