"use client";
import { useEffect, useRef, useState } from "react";
import Dialog from "./dialog";
import Icon from "./icon";
import type { Layer } from "@/lib/project";
import type { Point } from "@/lib/image-edit";
import { rectifyImage } from "@/lib/image-processing";
import {
  makeGuide,
  initialCubeFace,
  guidePoint,
  guideFromY,
  guideFace,
  guideFaces,
  type GuideFaceId,
  yControls,
  projectGuide,
  textureTransform,
  type Angles,
} from "@/lib/perspective-guide";

const zero: Angles = { yaw: 0, pitch: 0, roll: 0 };
const faces = [
  { corners: [4, 5, 6, 7], name: "奥", fill: "#64748b24", stroke: "#64748b" },
  { corners: [0, 1, 5, 4], name: "上", fill: "#67e8f96b", stroke: "#0891b2" },
  { corners: [1, 2, 6, 5], name: "右", fill: "#2563eb70", stroke: "#1d4ed8" },
  { corners: [2, 3, 7, 6], name: "下", fill: "#33415580", stroke: "#334155" },
  { corners: [3, 0, 4, 7], name: "左", fill: "#14b8a650", stroke: "#0f766e" },
];
const names = ["Y字の中心", "幅の点", "奥行きの点", "高さの点"];
const labels = ["＋", "幅", "奥", "高"];
const axisColors = ["#0369a1", "#0891b2", "#1d4ed8", "#0f766e"];
export default function PerspectiveWorkbench({
  layer,
  close,
  apply,
}: {
  layer: Layer;
  close: () => void;
  apply: (patch: Partial<Layer>) => void;
}) {
  const [template] = useState(() =>
    makeGuide(
      initialCubeFace(layer.width, layer.height),
      layer.width,
      layer.height,
      1,
    ),
  );
  const initial = () => yControls(template);
  const [controls, setControls] = useState<Point[]>(initial);
  const [perspective, setPerspective] = useState(0.35);
  const [step, setStep] = useState(0);
  const [angles, setAngles] = useState<Angles>(zero);
  const [results, setResults] = useState<
    Partial<Record<GuideFaceId, Partial<Layer>>>
  >({});
  const [selectedFace, setSelectedFace] = useState<GuideFaceId>("front");
  const [faceErrors, setFaceErrors] = useState<
    Partial<Record<GuideFaceId, string>>
  >({});
  const result = results[selectedFace];
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
    guide = guideFromY(controls, template, perspective);
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
      if (!guide) return;
      const model = guide;
      const images = await Promise.allSettled(
        guideFaces.map(async ({ id }) => {
          const surface = guideFace(model, id);
          return await rectifyImage(layer, surface.imagePoints, surface.aspect);
        }),
      );
      const nextResults: Partial<Record<GuideFaceId, Partial<Layer>>> = {};
      const nextErrors: Partial<Record<GuideFaceId, string>> = {};
      images.forEach((image, i) => {
        const id = guideFaces[i].id;
        if (image.status === "fulfilled") nextResults[id] = image.value;
        else nextErrors[id] = "この向きでは補正できません";
      });
      const first = guideFaces.find(({ id }) => nextResults[id]);
      if (!first)
        throw new Error("面を補正できません。Y字の位置を確認してください。");
      setResults(nextResults);
      setFaceErrors(nextErrors);
      setSelectedFace(nextResults[selectedFace] ? selectedFace : first.id);
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
      to = guideFace(guide, selectedFace).flat;
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
      corners: controls,
      angles,
    };
    svg.current!.setPointerCapture(event.pointerId);
  };
  let cube: Point[] = [];
  const textures: {
    id: GuideFaceId;
    src: string;
    width: number;
    height: number;
    transform: string;
  }[] = [];
  if (guide) {
    if (step === 0)
      cube = [...guide.front, ...guide.back].map((p) => guidePoint(guide!, p));
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
      for (const { id } of guideFaces) {
        const image = results[id];
        if (!image?.src || !image.width || !image.height) continue;
        try {
          const surface = guideFace(guide, id);
          textures.push({
            id,
            src: image.src,
            width: image.width,
            height: image.height,
            transform: textureTransform(
              surface.corners.map((i) => cube[i]),
              image.width,
              image.height,
            ),
          });
        } catch {
          /* Hide faces turned away from the camera. */
        }
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
          ? "中心を角に、3つの枝先をパーツの辺に合わせる"
          : step === 1
            ? "ドラッグで画像と立方体を回転"
            : "採用する面を選択"}
      </p>
      {step === 2 && (
        <div className="face-choice" role="group" aria-label="採用する面">
          {guideFaces.map(({ id, label }) => (
            <button
              key={id}
              className={`face-choice-card ${selectedFace === id ? "selected" : ""}`}
              aria-label={`${label}を採用`}
              aria-pressed={selectedFace === id}
              disabled={!results[id]?.src}
              title={faceErrors[id]}
              onClick={() => {
                setSelectedFace(id);
                if (guide) setAngles(guideFace(guide, id).flat);
              }}
            >
              {results[id]?.src ? (
                <img
                  src={results[id]!.src}
                  alt={`${label}の平面化プレビュー`}
                />
              ) : (
                <span className="face-unavailable">補正できません</span>
              )}
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
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
              else if (d.index === -1 || d.index === 0) {
                const tx = Math.min(
                  layer.width - Math.max(...d.corners.map((v) => v.x)),
                  Math.max(-Math.min(...d.corners.map((v) => v.x)), dx),
                );
                const ty = Math.min(
                  layer.height - Math.max(...d.corners.map((v) => v.y)),
                  Math.max(-Math.min(...d.corners.map((v) => v.y)), dy),
                );
                setControls(
                  d.corners.map((v) => ({ x: v.x + tx, y: v.y + ty })),
                );
              } else
                setControls(
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
                strokeWidth={step === 0 ? handle / 7 : 1.2}
                pointerEvents="none"
              >
                {faces.map((face, i) => (
                  <polygon
                    points={polygon(face.corners)}
                    fill={face.fill}
                    stroke={face.stroke}
                    key={i}
                  >
                    <title>{face.name}の面</title>
                  </polygon>
                ))}
                <polygon
                  points={polygon([4, 5, 6, 7])}
                  fill="none"
                  stroke="#64748b"
                  strokeDasharray={
                    step === 0 ? `${handle / 2} ${handle / 3}` : "5 4"
                  }
                />
              </g>
            )}
            {step === 1 && textures.length > 0 && (
              <foreignObject
                x="0"
                y="0"
                width="800"
                height="440"
                pointerEvents="none"
              >
                <div style={{ position: "relative", width: 800, height: 440 }}>
                  {textures.map((image) => (
                    <img
                      key={image.id}
                      className={`cube-texture cube-texture-${image.id}`}
                      alt=""
                      src={image.src}
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: image.width,
                        height: image.height,
                        maxWidth: "none",
                        transformOrigin: "0 0",
                        transform: image.transform,
                      }}
                    />
                  ))}
                </div>
              </foreignObject>
            )}
            {cube.length > 0 && (
              <polygon
                points={polygon([0, 1, 2, 3])}
                fill={step === 0 ? "#38bdf81f" : "#38bdf808"}
                stroke="#0369a1"
                strokeWidth={step === 0 ? handle / 4 : 2}
                style={{ cursor: "move" }}
                onPointerDown={(e) => begin(e, step === 0 ? -1 : -2)}
              />
            )}
            {step === 0 && (
              <g pointerEvents="none">
                {controls.slice(1).map((p, i) => (
                  <g key={i}>
                    <line
                      x1={controls[0].x}
                      y1={controls[0].y}
                      x2={p.x}
                      y2={p.y}
                      stroke="white"
                      strokeWidth={handle * 0.55}
                      strokeLinecap="round"
                    />
                    <line
                      x1={controls[0].x}
                      y1={controls[0].y}
                      x2={p.x}
                      y2={p.y}
                      stroke={axisColors[i + 1]}
                      strokeWidth={handle * 0.3}
                      strokeLinecap="round"
                    />
                  </g>
                ))}
              </g>
            )}
            {step === 0 &&
              controls.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={i === 0 ? handle * 1.2 : handle}
                    fill={i === 0 ? "#0369a1" : "white"}
                    stroke={axisColors[i]}
                    strokeWidth={handle / 6}
                    tabIndex={0}
                    role="button"
                    aria-label={names[i]}
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
                        if (i === 0) {
                          const dx = Math.min(
                            layer.width - Math.max(...controls.map((p) => p.x)),
                            Math.max(
                              -Math.min(...controls.map((p) => p.x)),
                              v.x * speed,
                            ),
                          );
                          const dy = Math.min(
                            layer.height -
                              Math.max(...controls.map((p) => p.y)),
                            Math.max(
                              -Math.min(...controls.map((p) => p.y)),
                              v.y * speed,
                            ),
                          );
                          setControls(
                            controls.map((q) => ({ x: q.x + dx, y: q.y + dy })),
                          );
                        } else
                          setControls(
                            controls.map((q, n) =>
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
                    fill={i === 0 ? "white" : axisColors[i]}
                    pointerEvents="none"
                  >
                    {labels[i]}
                  </text>
                </g>
              ))}
          </svg>
        )}
      </div>
      {step === 0 && (
        <label className="range-label">
          パースの強さ <span>{Math.round(perspective * 100)}%</span>
          <input
            aria-label="パースの強さ"
            type="range"
            min="0"
            max="100"
            value={Math.round(perspective * 100)}
            disabled={busy}
            onChange={(e) => setPerspective(Number(e.target.value) / 100)}
          />
        </label>
      )}
      {step === 1 ? (
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
      ) : step === 2 ? (
        <p className="hint">平面部分を補正 · 適用後に実寸を確認</p>
      ) : null}
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
            if (step === 0) {
              setControls(initial());
              setPerspective(0.35);
              setSelectedFace("front");
            } else setStep(step - 1);
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
            この面を適用
          </button>
        )}
      </div>
    </Dialog>
  );
}
