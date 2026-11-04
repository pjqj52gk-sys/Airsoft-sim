"use client";
import { useEffect, useRef, useState } from "react";
import Dialog from "./dialog";
import LoadingOverlay from "./loading-overlay";
import {
  initialCylinderGuide,
  cylinderGeometry,
  moveCylinderHandle,
  type CylinderGuide,
} from "@/lib/cylinder-guide";
import { fitImageViewport, zoomViewport } from "@/lib/edit-viewport";
import { rectifyImage } from "@/lib/image-processing";
import type { Layer } from "@/lib/project";
import type { Point, Rect } from "@/lib/image-edit";
import "./cylinder-workbench.css";
export default function CylinderWorkbench({
  layer,
  close,
  apply,
  useCube,
}: {
  layer: Layer;
  close: () => void;
  apply: (patch: Partial<Layer>) => void;
  useCube: () => void;
}) {
  const [guide, setGuide] = useState(() =>
    initialCylinderGuide(layer.width, layer.height),
  );
  const [view, setView] = useState(() =>
    fitImageViewport(layer.width, layer.height),
  );
  const [lengthScale, setLengthScale] = useState(1);
  const [result, setResult] = useState<Partial<Layer> | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    index: number;
    point: Point;
    guide: CylinderGuide;
    view: Rect;
    client: Point;
    unit: number;
  } | null>(null);
  let geometry: ReturnType<typeof cylinderGeometry> | null = null;
  try {
    geometry = cylinderGeometry(guide, lengthScale);
  } catch {
    /* Display a recoverable invalid guide instead of applying it. */
  }
  const point = (x: number, y: number) => {
    const p = new DOMPoint(x, y).matrixTransform(
      svg.current!.getScreenCTM()!.inverse(),
    );
    return { x: p.x, y: p.y };
  };
  useEffect(() => {
    const root = svg.current;
    if (!root) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (drag.current) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
        root.getScreenCTM()!.inverse(),
      );
      setView((v) =>
        zoomViewport(
          v,
          Math.exp(
            Math.max(
              -120,
              Math.min(
                120,
                e.deltaY *
                  (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1),
              ),
            ) * 0.002,
          ),
          p,
          layer.width / 8,
          layer.width * 32,
        ),
      );
    };
    root.addEventListener("wheel", wheel, { passive: false });
    return () => root.removeEventListener("wheel", wheel);
  }, [layer.width, result]);
  function begin(e: React.PointerEvent<SVGElement>, index: number) {
    if (busy) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = {
      index,
      point: point(e.clientX, e.clientY),
      guide,
      view,
      client: { x: e.clientX, y: e.clientY },
      unit: 1 / svg.current!.getScreenCTM()!.a,
    };
    svg.current!.setPointerCapture(e.pointerId);
  }
  const names = ["根元の中心", "先端の中心", "根元の太さ", "先端の太さ"];
  const radius = Math.max(view.w, view.h) / 65;
  return (
    <Dialog
      wide
      label="円筒のパース合わせ"
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="cylinder-heading">
        <h2>パース合わせ</h2>
        <button
          className="icon-button"
          aria-label="閉じる"
          disabled={busy}
          onClick={close}
        >
          ×
        </button>
      </div>
      <div className="shelf-tabs" aria-label="パーツの形状">
        <button className="mini-button" disabled={busy} onClick={useCube}>
          箱型・平面
        </button>
        <button className="mini-button toggled" aria-pressed="true">
          円筒・サプレッサー
        </button>
      </div>
      {!result ? (
        <>
          <p className="editor-instructions">
            両端の中心と、左右の太さを輪郭に合わせる
          </p>
          <div className="perspective-viewport-tools">
            <button
              className="mini-button"
              onClick={() =>
                setView(
                  fitImageViewport(
                    layer.width,
                    layer.height,
                    geometry?.corners,
                  ),
                )
              }
            >
              全体を表示
            </button>
            <button
              className="text-button"
              onClick={() => {
                setGuide(initialCylinderGuide(layer.width, layer.height));
                setError("");
              }}
            >
              ガイドをリセット
            </button>
            <span>余白をドラッグで移動 · ホイールでズーム</span>
          </div>
          <div className="image-edit-surface cylinder-surface">
            <svg
              ref={svg}
              viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
              role="img"
              aria-label="円筒の軸と太さを画像に合わせる"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => begin(e, -2)}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d) return;
                const p = point(e.clientX, e.clientY),
                  dx = p.x - d.point.x,
                  dy = p.y - d.point.y;
                if (d.index === -2)
                  setView({
                    ...d.view,
                    x: d.view.x - (e.clientX - d.client.x) * d.unit,
                    y: d.view.y - (e.clientY - d.client.y) * d.unit,
                  });
                else {
                  try {
                    setGuide(moveCylinderHandle(d.guide, d.index, dx, dy));
                    setError("");
                  } catch {
                    /* Keep current controls until the axis is valid. */
                  }
                }
              }}
              onPointerUp={(e) => {
                drag.current = null;
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              <image
                href={layer.src}
                width={layer.width}
                height={layer.height}
                pointerEvents="none"
              />
              {geometry && (
                <>
                  <polygon
                    points={geometry.corners
                      .map((p) => `${p.x},${p.y}`)
                      .join(" ")}
                    fill="#38bdf826"
                    stroke="#0284c7"
                    strokeWidth={radius / 7}
                    onPointerDown={(e) => begin(e, -1)}
                    style={{ cursor: "move" }}
                  />
                  {[guide.start, guide.end].map((p, i) => (
                    <ellipse
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      rx={(i ? guide.endRadius : guide.startRadius) * 0.22}
                      ry={i ? guide.endRadius : guide.startRadius}
                      transform={`rotate(${(Math.atan2(guide.end.y - guide.start.y, guide.end.x - guide.start.x) * 180) / Math.PI} ${p.x} ${p.y})`}
                      fill="none"
                      stroke={i ? "#0f766e" : "#0369a1"}
                      strokeWidth={radius / 7}
                      pointerEvents="none"
                    />
                  ))}
                  <line
                    x1={guide.start.x}
                    y1={guide.start.y}
                    x2={guide.end.x}
                    y2={guide.end.y}
                    stroke="#0369a1"
                    strokeWidth={radius / 6}
                    strokeDasharray={`${radius} ${radius / 2}`}
                    pointerEvents="none"
                  />
                </>
              )}
              {(geometry?.handles || [guide.start, guide.end]).map((p, i) => (
                <g
                  key={i}
                  onPointerDown={(e) => begin(e, i)}
                  role="button"
                  tabIndex={0}
                  aria-label={names[i]}
                  style={{ cursor: "move" }}
                  onKeyDown={(e) => {
                    const delta: Record<string, [number, number]> = {
                      ArrowLeft: [-1, 0],
                      ArrowRight: [1, 0],
                      ArrowUp: [0, -1],
                      ArrowDown: [0, 1],
                    };
                    if (!delta[e.key]) return;
                    e.preventDefault();
                    const [dx, dy] = delta[e.key];
                    try {
                      setGuide(
                        moveCylinderHandle(
                          guide,
                          i,
                          dx * (e.shiftKey ? 10 : 1),
                          dy * (e.shiftKey ? 10 : 1),
                        ),
                      );
                    } catch {
                      /* Move an endpoint to restore the axis. */
                    }
                  }}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={radius}
                    fill={i < 2 ? "#0369a1" : "white"}
                    stroke="#0ea5e9"
                    strokeWidth={radius / 6}
                  />
                  <text
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={radius * 0.8}
                    fill={i < 2 ? "white" : "#0369a1"}
                    pointerEvents="none"
                  >
                    {["根", "先", "太", "太"][i]}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <label className="cylinder-length">
            長さの補正{" "}
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.01"
              value={lengthScale}
              onChange={(e) => setLengthScale(Number(e.target.value))}
            />
            <output>×{lengthScale.toFixed(2)}</output>
          </label>
          <button className="text-button" onClick={() => setLengthScale(1)}>
            長さを戻す
          </button>
          <details className="hint">
            <summary>合わせ方</summary>
            根元と先端の中心を側面の両端に、太さの点を側面の輪郭に合わせます。斜め撮影で短く見える場合は長さを調整してください。端面や隠れた面、実際の長さは写真だけでは復元できません。適用後に実寸を確認してください。
          </details>
        </>
      ) : (
        <div className="cylinder-results">
          <figure>
            <img src={layer.src} alt="補正前の円筒パーツ" />
            <figcaption>補正前</figcaption>
          </figure>
          <figure>
            <img src={result.src} alt="補正後の円筒パーツ" />
            <figcaption>補正後</figcaption>
          </figure>
        </div>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="cylinder-actions">
        {result ? (
          <>
            <button
              className="button secondary"
              onClick={() => setResult(null)}
            >
              調整に戻る
            </button>
            <button className="button primary" onClick={() => apply(result)}>
              補正を適用
            </button>
          </>
        ) : (
          <button
            className="button primary"
            disabled={busy || !geometry}
            onClick={async () => {
              if (!geometry) return;
              setBusy(true);
              setError("");
              try {
                setResult(
                  await rectifyImage(
                    layer,
                    geometry.corners,
                    geometry.aspect,
                    geometry.map,
                  ),
                );
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "補正できませんでした。",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            補正をプレビュー
          </button>
        )}
      </div>
      {busy && <LoadingOverlay label="円筒パーツを補正中…" />}
    </Dialog>
  );
}
