"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { estimateCylinderGuide } from "@/lib/image-contours";
import Dialog from "./dialog";
import LoadingOverlay from "./loading-overlay";
import useCylinderPreview from "./use-cylinder-preview";
import {
  initialCylinderGuide,
  cylinderGeometry,
  moveCylinderHandle,
  setCylinderDimensions,
  cylinderEndRatio,
  cylinderSideSurface,
  type CylinderEnd,
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
  const [ellipseRatio, setEllipseRatio] = useState(0.22);
  const [tapered, setTapered] = useState(false);
  const [excludeEnd, setExcludeEnd] = useState<CylinderEnd>("end");
  const [showOriginal, setShowOriginal] = useState(false);
  const live = useCylinderPreview(
    layer,
    guide,
    lengthScale,
    ellipseRatio,
    excludeEnd,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const initialized = useRef(false),
    touched = useRef(false);
  const [autoMessage, setAutoMessage] = useState("");
  const autoFit = useCallback(() => {
    if (!live.pixels) return;
    const estimated = estimateCylinderGuide(live.pixels);
    if (!estimated) {
      setAutoMessage(
        "輪郭から推定できません。背景を透過するか、手動で合わせてください。",
      );
      return;
    }
    setGuide(estimated);
    setView(
      fitImageViewport(
        layer.width,
        layer.height,
        cylinderGeometry(estimated).corners,
      ),
    );
    setAutoMessage("輪郭に合わせました。端面の位置を確認してください。");
  }, [live.pixels, layer.width, layer.height]);
  useEffect(() => {
    if (!live.pixels || initialized.current) return;
    initialized.current = true;
    if (!touched.current) autoFit();
  }, [live.pixels, autoFit]);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    index: number;
    point: Point;
    guide: CylinderGuide;
    view: Rect;
    client: Point;
    unit: number;
    ellipseRatio: number;
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
  }, [layer.width]);
  function begin(e: React.PointerEvent<SVGElement>, index: number) {
    if (busy) return;
    if (index !== -2) touched.current = true;
    e.preventDefault();
    e.stopPropagation();
    drag.current = {
      index,
      point: point(e.clientX, e.clientY),
      guide,
      view,
      client: { x: e.clientX, y: e.clientY },
      unit: 1 / svg.current!.getScreenCTM()!.a,
      ellipseRatio,
    };
    svg.current!.setPointerCapture(e.pointerId);
  }
  const names = [
    "根元の中心",
    "先端の中心",
    "根元の太さ",
    "先端の太さ",
    "円筒の太さ",
    "端面の開き",
  ];
  const indices = tapered ? [0, 1, 2, 3, 5] : [0, 1, 4, 5];
  const handles = indices.flatMap((index) => {
    if (!geometry)
      return index < 2
        ? [{ index, point: index ? guide.end : guide.start }]
        : [];
    const point =
      index === 4
        ? geometry.map(0.5, 0)
        : index === 5
          ? {
              x:
                guide.end.x +
                ((guide.end.x - guide.start.x) / geometry.length) *
                  (guide.endRadius * ellipseRatio +
                    (Math.max(view.w, view.h) / 65) * 3),
              y:
                guide.end.y +
                ((guide.end.y - guide.start.y) / geometry.length) *
                  (guide.endRadius * ellipseRatio +
                    (Math.max(view.w, view.h) / 65) * 3),
            }
          : geometry.handles[index];
    return [{ index, point }];
  });
  function adjustHandle(
    source: CylinderGuide,
    index: number,
    dx: number,
    dy: number,
    initialRatio = ellipseRatio,
  ) {
    if (index === 5) {
      touched.current = true;
      const g = cylinderGeometry(source);
      setEllipseRatio(
        cylinderEndRatio(
          source.endRadius * initialRatio +
            (dx * (source.end.x - source.start.x) +
              dy * (source.end.y - source.start.y)) /
              g.length,
          source.endRadius,
        ),
      );
    } else {
      touched.current = true;
      setGuide(moveCylinderHandle(source, index, dx, dy));
    }
  }
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
      {
        <>
          <p className="editor-instructions">
            軸の両端で長さ・角度を合わせ、太さと端面の開きを調整
          </p>
          <p className="hint" role="status">
            {autoMessage}
          </p>
          <div className="perspective-viewport-tools">
            <button
              className="mini-button"
              disabled={!live.pixels || busy}
              onClick={autoFit}
            >
              自動で合わせ直す
            </button>
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
                touched.current = true;
                setGuide(initialCylinderGuide(layer.width, layer.height));
                setEllipseRatio(0.22);
                setTapered(false);
                setLengthScale(1);
                setError("");
              }}
            >
              ガイドをリセット
            </button>
            <span>余白をドラッグで移動 · ホイールでズーム</span>
          </div>
          <div className="cylinder-live-workspace">
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
                      adjustHandle(d.guide, d.index, dx, dy, d.ellipseRatio);
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
                        rx={
                          (i ? guide.endRadius : guide.startRadius) *
                          ellipseRatio
                        }
                        ry={i ? guide.endRadius : guide.startRadius}
                        transform={`rotate(${(Math.atan2(guide.end.y - guide.start.y, guide.end.x - guide.start.x) * 180) / Math.PI} ${p.x} ${p.y})`}
                        fill={
                          excludeEnd === "both" ||
                          excludeEnd === (i ? "end" : "start")
                            ? "#f9731633"
                            : "none"
                        }
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
                {handles.map(({ point: p, index: i }) => (
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
                        adjustHandle(
                          guide,
                          i,
                          dx * (e.shiftKey ? 10 : 1),
                          dy * (e.shiftKey ? 10 : 1),
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
                      {["根", "先", "太", "太", "太", "面"][i]}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
            <aside
              className="cylinder-live-preview"
              aria-label="リアルタイムプレビュー"
              aria-busy={live.updating}
            >
              <div className="cylinder-preview-heading">
                <strong>{showOriginal ? "補正前" : "補正後"}</strong>
                <span>{live.updating ? "更新中…" : "自動更新"}</span>
              </div>
              <div className="cylinder-live-image">
                {showOriginal ? (
                  <img src={layer.src} alt="補正前の円筒パーツ" />
                ) : live.preview?.src ? (
                  <img src={live.preview.src} alt="補正後の円筒パーツ" />
                ) : (
                  <p>{live.error || "プレビューを準備中…"}</p>
                )}
              </div>
              <button
                className="mini-button"
                aria-pressed={showOriginal}
                onClick={() => setShowOriginal(!showOriginal)}
              >
                {showOriginal ? "補正後を見る" : "補正前を見る"}
              </button>
              {live.error && (
                <p className="error-text" role="status">
                  {live.error}
                </p>
              )}
            </aside>
          </div>
          <div className="cylinder-dimensions">
            {[
              {
                label: "軸の長さ",
                key: "length" as const,
                value: geometry?.length || 4,
                unit: "px",
                min: 4,
                max: Math.max(layer.width, layer.height) * 4,
              },
              {
                label: "太さ",
                key: "diameter" as const,
                value: guide.startRadius + guide.endRadius,
                unit: "px",
                min: 2,
                max: Math.max(layer.width, layer.height) * 4,
              },
              {
                label: "角度",
                key: "angle" as const,
                value:
                  (Math.atan2(
                    guide.end.y - guide.start.y,
                    guide.end.x - guide.start.x,
                  ) *
                    180) /
                  Math.PI,
                unit: "°",
                min: -180,
                max: 180,
              },
            ].map(({ label, key, value, unit, min, max }) => (
              <label key={key}>
                {label}
                <div>
                  <input
                    type="number"
                    value={Math.round(value * 10) / 10}
                    min={min}
                    max={max}
                    step="1"
                    onChange={(e) => {
                      touched.current = true;
                      const n = e.target.valueAsNumber;
                      if (!Number.isFinite(n) || n < min || n > max) return;
                      try {
                        setGuide(setCylinderDimensions(guide, { [key]: n }));
                        if (key === "diameter") setTapered(false);
                      } catch {
                        /* Keep valid guide. */
                      }
                    }}
                  />
                  {unit}
                </div>
              </label>
            ))}
          </div>
          <label className="cylinder-length">
            端面の開き{" "}
            <input
              type="range"
              min="0"
              max="1"
              step=".01"
              value={ellipseRatio}
              onChange={(e) => setEllipseRatio(Number(e.target.value))}
            />
            <output>{Math.round(ellipseRatio * 100)}%</output>
          </label>
          <label className="cylinder-taper">
            除く端面
            <select
              value={excludeEnd}
              onChange={(e) => setExcludeEnd(e.target.value as CylinderEnd)}
            >
              <option value="end">先端</option>
              <option value="start">根元</option>
              <option value="both">両端</option>
              <option value="none">除かない</option>
            </select>
          </label>
          <p className="hint">
            見えている端面の円の中心に軸の端を合わせます。橙色の端面を除き、側面だけを使います。
          </p>
          <label className="cylinder-taper">
            <input
              type="checkbox"
              checked={tapered}
              onChange={(e) => {
                touched.current = true;
                setTapered(e.target.checked);
                if (!e.target.checked)
                  setGuide(
                    setCylinderDimensions(guide, {
                      diameter: guide.startRadius + guide.endRadius,
                    }),
                  );
              }}
            />
            先細りを個別に合わせる
          </label>
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
            軸の両端をドラッグすると長さと角度が変わります。「太」で直径、「面」で端面の楕円を調整します。除く端面では、楕円の内側の輪郭に沿って側面だけを補正します。隠れた側面や模様は復元しません。適用後に実寸を確認してください。
          </details>
        </>
      }
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="cylinder-actions">
        <button
          className="button primary"
          disabled={
            busy || !geometry || !live.preview || live.updating || !!live.error
          }
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve()),
                ),
              );
              const surface = cylinderSideSurface(
                guide,
                lengthScale,
                ellipseRatio,
                excludeEnd,
              );
              const full = await rectifyImage(
                layer,
                surface.corners,
                surface.aspect,
                surface.map,
                { pixels: live.pixels },
              );
              await apply(full);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "補正できませんでした。",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "適用中…" : "補正を適用"}
        </button>
      </div>
      {busy && <LoadingOverlay label="円筒パーツを補正中…" />}
    </Dialog>
  );
}
