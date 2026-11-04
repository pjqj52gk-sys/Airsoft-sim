"use client";
import { partCategoryGroups } from "@/lib/part-categories";

const locations: Record<
  string,
  { x: number; y: number; point: [number, number]; line: string }
> = {
  guns: { x: 535, y: 393, point: [558, 203], line: "M535 372V330L558 203" },
  stocks: { x: 865, y: 72, point: [886, 214], line: "M865 93V150L886 214" },
  optics: { x: 600, y: 45, point: [560, 154], line: "M600 66V108L560 154" },
  mounts: { x: 405, y: 50, point: [470, 154], line: "M405 71V112L470 154" },
  lights: { x: 205, y: 75, point: [307, 192], line: "M205 96V155L307 192" },
  muzzle: { x: 100, y: 322, point: [111, 180], line: "M100 301V260L111 180" },
  handguards: {
    x: 250,
    y: 303,
    point: [350, 189],
    line: "M250 282V252L350 189",
  },
  grips: { x: 365, y: 390, point: [360, 201], line: "M365 369V318L360 201" },
  "pistol-grips": {
    x: 745,
    y: 391,
    point: [620, 265],
    line: "M745 370V339L620 265",
  },
};

export default function M4PartsMap({
  open,
  disabled,
  select,
}: {
  open: string;
  active: string;
  disabled: boolean;
  select: (id: string) => void;
}) {
  return (
    <div className="m4-parts-map">
      <svg
        viewBox="0 0 1000 420"
        role="img"
        aria-label="M4カービンのシルエットとパーツの取り付け位置"
      >
        <title>M4カービンのパーツマップ</title>
        <image
          href="/images/m4-search-silhouette.png"
          x="40"
          y="65"
          width="920"
          height="306.67"
        />
        <g className="map-leaders">
          {partCategoryGroups.map((group) => {
            const point = locations[group.id];
            return (
              <g key={group.id} className={open === group.id ? "active" : ""}>
                <path d={point.line} />
                <circle cx={point.point[0]} cy={point.point[1]} r="5" />
                <circle
                  className="map-hotspot-ring"
                  cx={point.point[0]}
                  cy={point.point[1]}
                  r="10"
                />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="map-labels" aria-label="取り付け位置から選択">
        {partCategoryGroups.map((group) => (
          <button
            key={group.id}
            className={`map-label ${open === group.id ? "selected" : ""}`}
            style={{
              left: `${locations[group.id].x / 10}%`,
              top: `${locations[group.id].y / 4.2}%`,
            }}
            aria-expanded={open === group.id}
            aria-controls="category-options"
            disabled={disabled}
            onClick={() => select(group.id)}
          >
            <span aria-hidden="true">＋</span>
            {group.label}
          </button>
        ))}
      </div>
    </div>
  );
}
