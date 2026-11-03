"use client";
import { partCategoryGroups } from "@/lib/part-categories";

const locations: Record<
  string,
  { x: number; y: number; point: [number, number]; line: string }
> = {
  guns: { x: 500, y: 333, point: [484, 213], line: "M500 312V260L484 213" },
  stocks: { x: 135, y: 65, point: [196, 194], line: "M135 86V130L196 194" },
  optics: { x: 395, y: 42, point: [447, 142], line: "M395 63V100L447 142" },
  mounts: { x: 600, y: 48, point: [480, 163], line: "M600 69V111L480 163" },
  lights: { x: 790, y: 80, point: [729, 201], line: "M790 101V142L729 201" },
  muzzle: { x: 900, y: 290, point: [892, 190], line: "M900 269V230L892 190" },
  handguards: {
    x: 680,
    y: 315,
    point: [638, 187],
    line: "M680 294V250L638 187",
  },
  grips: { x: 300, y: 315, point: [362, 241], line: "M300 294V270L362 241" },
};

export default function M4PartsMap({
  open,
  active,
  disabled,
  select,
}: {
  open: string;
  active: string;
  disabled: boolean;
  select: (id: string) => void;
}) {
  const partClass = (id: string) =>
    `map-part ${open === id ? "map-part-active" : ""}`;
  const foregrip = open === "grips" && active !== "pistol-grip";
  return (
    <div className="m4-parts-map">
      <svg
        viewBox="0 0 1000 360"
        role="img"
        aria-label="M4カービンのシルエットとパーツの取り付け位置"
      >
        <title>M4カービンのパーツマップ</title>
        <g transform="translate(1000 0) scale(-1 1)">
          <path className="map-baseline" d="M90 207H935" />
          <g
            className={`map-silhouette ${open === "guns" ? "map-body-active" : ""}`}
          >
            <path d="M230 181H330V201H230Z" />
            <g className={partClass("stocks")}>
              <path d="M108 171H203L245 185V208L218 238H119V220H108Z" />
              <path
                className="map-cutout"
                d="M136 187H198L217 195L202 214H136Z"
              />
              <path className="map-detail" d="M113 175V229M129 228H205" />
            </g>
            <path d="M313 166H488L510 179V212H477L469 226H424L414 218H326L310 203Z" />
            <path className="map-cutout" d="M393 214H425L420 230H402Z" />
            <path
              className="map-detail"
              d="M328 194H481M442 178H477V189H442ZM337 178H363"
            />
            <circle className="map-cutout" cx="383" cy="191" r="5" />
            <g
              className={`map-part ${open === "grips" && !foregrip ? "map-part-active" : ""}`}
            >
              <path d="M351 211H383L370 272L342 265Z" />
              <path
                className="map-detail"
                d="M350 236L372 242M347 245L370 251M345 253L368 259"
              />
            </g>
            <path d="M434 219H477L483 254Q492 281 499 292L457 303Q445 281 441 255Z" />
            <path
              className="map-detail"
              d="M443 232H477M445 246L480 242M448 260L485 254M452 275L491 267M458 290L496 280M451 225L464 294M465 224L480 290"
            />
            <g className={partClass("handguards")}>
              <path d="M507 169H743V207H507Z" />
              {[529, 567, 605, 643, 681, 719].map((x) => (
                <rect
                  className="map-cutout"
                  key={x}
                  x={x}
                  y="180"
                  width="20"
                  height="7"
                  rx="2"
                />
              ))}
              <path className="map-detail" d="M519 198H731" />
            </g>
            <path d="M744 184H878V195H744Z" />
            <path d="M778 184L790 145H797L807 184H800L793 163L786 184Z" />
            <g className={partClass("muzzle")}>
              <path d="M873 179H906V200H873Z" />
              <path
                className="map-detail"
                d="M882 182V197M891 182V197M900 182V197"
              />
            </g>
            <g className={partClass("mounts")}>
              <path d="M321 157H743V167H321Z" />
              {Array.from({ length: 27 }, (_, i) => (
                <rect
                  className="map-cutout"
                  key={i}
                  x={327 + i * 15}
                  y="156"
                  width="6"
                  height="4"
                />
              ))}
            </g>
            <path d="M329 153V144H340V157H329Z" />
          </g>
          {open === "optics" && (
            <g className="map-accessory">
              {active === "scope" || active === "magnifier" ? (
                <>
                  <path d="M405 126H473L485 119H500V147H485L473 140H405Z" />
                  <path d="M427 140V156M467 140V156" />
                </>
              ) : active === "holographic" ? (
                <>
                  <path d="M429 153V123L463 115L479 127V153Z" />
                  <path d="M441 145V129L461 124L467 130V145Z" />
                </>
              ) : (
                <>
                  <rect x="430" y="127" width="37" height="27" rx="7" />
                  <path d="M438 153V157H463V153M438 130V149" />
                </>
              )}
            </g>
          )}
          {open === "muzzle" && (
            <g className="map-accessory">
              {active === "muzzle-brake" || active === "flash-hider" ? (
                <>
                  <rect x="874" y="177" width="44" height="25" rx="3" />
                  <path d="M887 181V198M897 181V198M907 181V198" />
                </>
              ) : (
                <>
                  <rect
                    x="872"
                    y="174"
                    width={active === "tracer" ? 57 : 78}
                    height="31"
                    rx="6"
                  />
                  <path d="M884 176V203" />
                </>
              )}
            </g>
          )}
          {foregrip && (
            <g className="map-accessory">
              <path
                d={
                  active === "angled-grip" || active === "hand-stop"
                    ? "M591 208H645L618 233H602Z"
                    : "M610 207H632V260H610Z"
                }
              />
            </g>
          )}
          {open === "lights" && (
            <g className="map-accessory">
              <path d="M705 196H748V212H705Z" />
              <path d="M738 192H750V216H738Z" />
            </g>
          )}
          <g className="map-leaders">
            {partCategoryGroups.map((group) => {
              const point = locations[group.id];
              const gripPoint = group.id === "grips" && foregrip;
              const line = gripPoint ? "M300 294V279H620V232" : point.line;
              const [x, y] = gripPoint ? [620, 232] : point.point;
              return (
                <g key={group.id} className={open === group.id ? "active" : ""}>
                  <path d={line} />
                  <circle cx={x} cy={y} r="5" />
                  <circle className="map-hotspot-ring" cx={x} cy={y} r="10" />
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      <div className="map-labels" aria-label="取り付け位置から選択">
        {partCategoryGroups.map((group) => (
          <button
            key={group.id}
            className={`map-label ${open === group.id ? "selected" : ""}`}
            style={{
              left: `${(1000 - locations[group.id].x) / 10}%`,
              top: `${locations[group.id].y / 3.6}%`,
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
