"use client";
import { useEffect, useRef, useState } from "react";
import Dialog from "./dialog";
import Icon from "./icon";
import type { Layer } from "@/lib/project";
import type { Point } from "@/lib/image-edit";
import { rectifyImage } from "@/lib/image-processing";
import {
  makeGuide,
  projectGuide,
  textureTransform,
  type Angles,
} from "@/lib/perspective-guide";

const zero: Angles = { yaw: 0, pitch: 0, roll: 0 };
const faces = [
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [1, 2, 6, 5],
  [2, 3, 7, 6],
  [3, 0, 4, 7],
];
const names = ["左上", "右上", "右下", "左下"];
export default function PerspectiveWorkbench({
  layer,
  close,
  apply,
}: {
  layer: Layer;
  close: () => void;
  apply: (patch: Partial<Layer>) => void;
}) {
  const initial = () => [
    { x: layer.width * 0.12, y: layer.height * 0.12 },
    { x: layer.width * 0.88, y: layer.height * 0.12 },
    { x: layer.width * 0.88, y: layer.height * 0.88 },
    { x: layer.width * 0.12, y: layer.height * 0.88 },
  ];
  const [points, setPoints] = useState<Point[]>(initial);
  const [depth, setDepth] = useState(0.55);
  const [step, setStep] = useState(0);
  const [angles, setAngles] = useState<Angles>(zero);
  const [result, setResult] = useState<Partial<Layer> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [turning, setTurning] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const frame = useRef(0);
  const drag = useRef<{
    index: number;
    point: Point;
    corners: Point[];
    angles: Angles;
  } | null>(null);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  let guide: ReturnType<typeof makeGuide> | null = null;
  let geometryError = "";
  try {
    guide = makeGuide(points, layer.width, layer.height, depth);
  } catch (e) {
    geometryError = e instanceof Error ? e.message : "角を合わせてください。";
  }
  const handle = Math.max(layer.width, layer.height) / 65;
  const screenPoint = (x: number, y: number) => {
    const p = new DOMPoint(x, y).matrixTransform(
      svg.current!.getScreenCTM()!.inverse(),
    );
    return { x: p.x, y: p.y };
  };
  const clamp = (p: Point) => ({
    x: Math.min(layer.width, Math.max(0, p.x)),
    y: Math.min(layer.height, Math.max(0, p.y)),
  });
  async function next() {
    setBusy(true);
    setError("");
    try {
      setResult(await rectifyImage(layer, points));
      setAngles(zero);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "補正できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  function flatten() {
    if (!guide) return;
    setTurning(true);
    const start = performance.now(),
      from = angles,
      to = guide.flat;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / 550),
        f = t * t * (3 - 2 * t);
      setAngles({
        yaw: from.yaw + (to.yaw - from.yaw) * f,
        pitch: from.pitch + (to.pitch - from.pitch) * f,
        roll: from.roll + (to.roll - from.roll) * f,
      });
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else {
        setTurning(false);
        setStep(2);
      }
    };
    frame.current = requestAnimationFrame(tick);
  }
  const begin = (event: React.PointerEvent<SVGElement>, index: number) => {
    if (busy || turning || step === 2) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current = {
      index,
      point: screenPoint(event.clientX, event.clientY),
      corners: points,
      angles,
    };
    svg.current!.setPointerCapture(event.pointerId);
  };
  let cube: Point[] = [];
  let texture = "";
  if (guide) {
    if (step === 0)
      cube = [...guide.front, ...guide.back].map((p) => ({
        x: guide!.cx + (guide!.focal * p.x) / p.z,
        y: guide!.cy + (guide!.focal * p.y) / p.z,
      }));
    else {
      const projected = projectGuide(guide, angles);
      const minX = Math.min(...projected.map((p) => p.x)),
        maxX = Math.max(...projected.map((p) => p.x));
      const minY = Math.min(...projected.map((p) => p.y)),
        maxY = Math.max(...projected.map((p) => p.y));
      const scale = Math.min(
        650 / Math.max(1, maxX - minX),
        330 / Math.max(1, maxY - minY),
      );
      cube = projected.map((p) => ({
        x: 400 + (p.x - (minX + maxX) / 2) * scale,
        y: 220 + (p.y - (minY + maxY) / 2) * scale,
      }));
      if (result?.width && result?.height)
        try {
          texture = textureTransform(
            cube.slice(0, 4),
            result.width,
            result.height,
          );
        } catch {
          /* The back of the plane has no image. */
        }
    }
  }
  const polygon = (indices: number[]) =>
    indices.map((i) => `${cube[i].x},${cube[i].y}`).join(" ");
  return (
    <Dialog
      wide
      label="パース合わせ"
      close={() => {
        if (!busy && !turning) close();
      }}
    >
      <button
        className="modal-close icon-button"
        aria-label="閉じる"
        disabled={busy || turning}
        onClick={close}
      >
        <Icon name="close" />
      </button>
      <h2>パース合わせ</h2>
      <ol className="perspective-steps">
        {["面を合わせる", "一緒に回す", "平面化"].map((label, i) => (
          <li key={label} aria-current={step === i ? "step" : undefined}>
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <p className="editor-instructions">
        {step === 0
          ? "4つの角を、パーツの同じ平面に合わせる"
          : step === 1
            ? "ドラッグで画像と立方体を回転"
            : "補正結果を確認"}
      </p>
      <div className="image-edit-surface cube-surface">
        {step === 2 ? (
          <img
            className="flattened-result"
            src={result?.src}
            alt="平面化したパーツ"
          />
        ) : (
          <svg
            ref={svg}
            viewBox={
              step === 0 ? `0 0 ${layer.width} ${layer.height}` : "0 0 800 440"
            }
            role="img"
            aria-label={
              step === 0 ? "立方体の面を画像に合わせる" : "画像付き立方体を回転"
            }
            style={{
              touchAction: "none",
              cursor: step === 1 ? "grab" : undefined,
            }}
            onPointerDown={(e) => {
              if (step === 1) begin(e, -2);
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const p = screenPoint(e.clientX, e.clientY),
                dx = p.x - d.point.x,
                dy = p.y - d.point.y;
              if (step === 1)
                setAngles({
                  ...d.angles,
                  yaw: Math.max(-150, Math.min(150, d.angles.yaw + dx * 0.35)),
                  pitch: Math.max(
                    -150,
                    Math.min(150, d.angles.pitch - dy * 0.35),
                  ),
                });
              else if (d.index === -1) {
                const tx = Math.min(
                  layer.width - Math.max(...d.corners.map((v) => v.x)),
                  Math.max(-Math.min(...d.corners.map((v) => v.x)), dx),
                );
                const ty = Math.min(
                  layer.height - Math.max(...d.corners.map((v) => v.y)),
                  Math.max(-Math.min(...d.corners.map((v) => v.y)), dy),
                );
                setPoints(d.corners.map((v) => ({ x: v.x + tx, y: v.y + ty })));
              } else
                setPoints(
                  d.corners.map((v, i) =>
                    i === d.index ? clamp({ x: v.x + dx, y: v.y + dy }) : v,
                  ),
                );
            }}
            onPointerUp={(e) => {
              drag.current = null;
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            {step === 0 && (
              <image
                href={layer.src}
                width={layer.width}
                height={layer.height}
              />
            )}
            {cube.length > 0 && (
              <g
                fill="#38bdf817"
                stroke="#0284c7"
                strokeWidth={step === 0 ? handle / 7 : 1.2}
                pointerEvents="none"
              >
                {faces.map((face, i) => (
                  <polygon points={polygon(face)} key={i} />
                ))}
              </g>
            )}
            {step === 1 && result?.src && texture && (
              <foreignObject
                x="0"
                y="0"
                width="800"
                height="440"
                pointerEvents="none"
              >
                <div style={{ position: "relative", width: 800, height: 440 }}>
                  <img
                    className="cube-texture"
                    alt=""
                    src={result.src}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: result.width,
                      height: result.height,
                      maxWidth: "none",
                      transformOrigin: "0 0",
                      transform: texture,
                    }}
                  />
                </div>
              </foreignObject>
            )}
            {cube.length > 0 && (
              <polygon
                points={polygon([0, 1, 2, 3])}
                fill={step === 0 ? "#38bdf82b" : "#38bdf811"}
                stroke="#0284c7"
                strokeWidth={step === 0 ? handle / 6 : 1.5}
                style={{ cursor: "move" }}
                onPointerDown={(e) => begin(e, step === 0 ? -1 : -2)}
              />
            )}
            {step === 0 &&
              points.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={handle}
                    fill="white"
                    stroke="#0284c7"
                    strokeWidth={handle / 6}
                    tabIndex={0}
                    role="button"
                    aria-label={`${names[i]}の角`}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => begin(e, i)}
                    onKeyDown={(e) => {
                      const delta: Record<string, Point> = {
                        ArrowLeft: { x: -1, y: 0 },
                        ArrowRight: { x: 1, y: 0 },
                        ArrowUp: { x: 0, y: -1 },
                        ArrowDown: { x: 0, y: 1 },
                      };
                      if (delta[e.key]) {
                        e.preventDefault();
                        const v = delta[e.key],
                          speed = e.shiftKey ? 10 : 1;
                        setPoints(
                          points.map((q, n) =>
                            n === i
                              ? clamp({
                                  x: q.x + v.x * speed,
                                  y: q.y + v.y * speed,
                                })
                              : q,
                          ),
                        );
                      }
                    }}
                  />
                  <text
                    x={p.x}
                    y={p.y + handle * 0.35}
                    textAnchor="middle"
                    fontSize={handle}
                    fill="#0369a1"
                    pointerEvents="none"
                  >
                    {i + 1}
                  </text>
                </g>
              ))}
          </svg>
        )}
      </div>
      {step === 0 ? (
        <label className="range-label">
          立方体の奥行き
          <input
            type="range"
            min="0.1"
            max="1.5"
            step="0.05"
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
          />
        </label>
      ) : step === 1 ? (
        <div className="cube-angle-controls">
          {(["yaw", "pitch", "roll"] as const).map((key, i) => (
            <label key={key}>
              {["左右", "上下", "傾き"][i]}
              <input
                aria-label={`${["左右", "上下", "傾き"][i]}に回転`}
                type="range"
                min="-180"
                max="180"
                value={angles[key]}
                disabled={turning}
                onChange={(e) =>
                  setAngles({ ...angles, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
      ) : (
        <p className="hint">平面部分を補正 · 適用後に実寸を確認</p>
      )}
      {(error || geometryError) && (
        <p className="editor-error" role="alert">
          {error || geometryError}
        </p>
      )}
      <div className="dialog-actions">
        <button
          className="button secondary"
          disabled={busy || turning}
          onClick={() => {
            if (step === 0) setPoints(initial());
            else setStep(step - 1);
          }}
        >
          {step === 0 ? "リセット" : "戻る"}
        </button>
        {step === 0 ? (
          <button
            className="button primary"
            disabled={busy || !!geometryError}
            onClick={() => void next()}
          >
            {busy ? "処理中…" : "画像と一緒に回す"}
          </button>
        ) : step === 1 ? (
          <button
            className="button primary"
            disabled={turning}
            onClick={flatten}
          >
            {turning ? "回転中…" : "正面にして平面化"}
          </button>
        ) : (
          <button
            className="button primary"
            onClick={() => {
              if (result) apply(result);
            }}
          >
            適用
          </button>
        )}
      </div>
    </Dialog>
  );
}
