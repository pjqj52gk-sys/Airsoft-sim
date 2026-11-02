"use client";
import { useEffect, useRef } from "react";
import { dimensions, Layer } from "@/lib/project";
type Props = {
  layers: Layer[];
  selected: string | null;
  zoom: number;
  grid: boolean;
  compare: boolean;
  select: (id: string | null) => void;
  move: (id: string, x: number, y: number, done: boolean) => void;
  wheel: (factor: number, done: boolean) => void;
  locked: () => void;
};
export default function Stage({
  layers,
  selected,
  zoom,
  grid,
  compare,
  select,
  move,
  wheel,
  locked,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const wheelHandler = useRef(wheel);
  wheelHandler.current = wheel;
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    sx: number;
    sy: number;
  } | null>(null);
  useEffect(() => {
    const surface = svg.current?.closest(".canvas-wrap");
    if (!surface) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handler = (event: Event) => {
      const e = event as WheelEvent;
      e.preventDefault();
      if (drag.current || e.deltaY === 0) return;
      const delta =
        e.deltaY *
        (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? surface.clientHeight : 1);
      wheelHandler.current(
        Math.exp(-Math.min(100, Math.max(-100, delta)) * 0.002),
        false,
      );
      clearTimeout(timer);
      timer = setTimeout(() => wheelHandler.current(1, true), 400);
    };
    surface.addEventListener("wheel", handler, { passive: false });
    return () => {
      surface.removeEventListener("wheel", handler);
      clearTimeout(timer);
    };
  }, []);
  const point = (x: number, y: number) => {
    const matrix = svg.current?.getScreenCTM();
    return matrix
      ? new DOMPoint(x, y).matrixTransform(matrix.inverse())
      : { x: 0, y: 0 };
  };
  return (
    <div className="stage">
      <div className="stage-caption">
        <span className="status-dot" /> SIDE VIEW{" "}
        <span className="muted">/</span> 2D WORKSPACE
      </div>
      <svg
        ref={svg}
        className="canvas"
        viewBox={`${520 - 560 / zoom} ${300 - 310 / zoom} ${1120 / zoom} ${620 / zoom}`}
        role="img"
        aria-label="カスタム外観の編集キャンバス"
        onPointerDown={(e) => {
          wheelHandler.current(1, true);
          if (e.target === e.currentTarget) select(null);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const p = point(e.clientX, e.clientY);
          const d = drag.current;
          move(d.id, d.x + p.x - d.sx, d.y + p.y - d.sy, false);
        }}
        onPointerUp={(e) => {
          if (!drag.current) return;
          const p = point(e.clientX, e.clientY);
          const d = drag.current;
          move(d.id, d.x + p.x - d.sx, d.y + p.y - d.sy, true);
          drag.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          if (drag.current) {
            const d = drag.current;
            move(d.id, d.x, d.y, true);
            drag.current = null;
          }
        }}
      >
        <defs>
          <pattern
            id="dots"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".8" fill="#cfdce8" />
          </pattern>
        </defs>
        {grid && (
          <rect
            x="-10000"
            y="-10000"
            width="20000"
            height="20000"
            fill="url(#dots)"
            pointerEvents="none"
          />
        )}
        {layers
          .filter((l, index) => l.visible && (!compare || index === 0))
          .map((l) => {
            const { w, h } = dimensions(l);
            const active = selected === l.id && !compare;
            return (
              <g
                key={l.id}
                transform={`translate(${l.x + w / 2} ${l.y + h / 2}) rotate(${l.rotation})`}
                className={l.locked ? "locked-object" : "canvas-object"}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  wheelHandler.current(1, true);
                  select(l.id);
                  if (l.locked) {
                    locked();
                    return;
                  }
                  if (compare) return;
                  const p = point(e.clientX, e.clientY);
                  drag.current = { id: l.id, x: l.x, y: l.y, sx: p.x, sy: p.y };
                  svg.current?.setPointerCapture(e.pointerId);
                }}
              >
                <image
                  href={l.src}
                  x={-w / 2}
                  y={-h / 2}
                  width={w}
                  height={h}
                  transform={`scale(${l.flip ? -1 : 1} 1)`}
                />
                {active && (
                  <g pointerEvents="none">
                    <rect
                      x={-w / 2 - 4}
                      y={-h / 2 - 4}
                      width={w + 8}
                      height={h + 8}
                      fill="none"
                      stroke="#0ea5e9"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                    {[
                      [-1, -1],
                      [1, -1],
                      [-1, 1],
                      [1, 1],
                    ].map(([x, y]) => (
                      <rect
                        key={`${x}${y}`}
                        x={x * (w / 2 + 4) - 3}
                        y={y * (h / 2 + 4) - 3}
                        width="6"
                        height="6"
                        fill="#0ea5e9"
                      />
                    ))}
                  </g>
                )}
              </g>
            );
          })}
        {!!layers.length && (
          <g
            transform={`translate(${520 - 535 / zoom} ${300 + 210 / zoom})`}
            pointerEvents="none"
            fill="#64748b"
            fontFamily="monospace"
            fontSize={10 / zoom}
          >
            <path
              d="M0 -6V0H100V-6"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text y={17 / zoom}>100 mm</text>
            <text y={32 / zoom} fontSize={8 / zoom}>
              入力寸法による目安
            </text>
          </g>
        )}
      </svg>
      <div className="stage-foot">
        <span>
          {compare ? "本体のみを表示中" : "ドラッグで移動 · ホイールで拡大縮小"}
        </span>
        <span>外観プレビュー</span>
      </div>
    </div>
  );
}
