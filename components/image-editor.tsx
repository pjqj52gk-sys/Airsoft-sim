"use client";
import { useRef, useState } from "react";
import Dialog from "./dialog";
import Icon from "./icon";
import LoadingOverlay from "./loading-overlay";
import type { Layer } from "@/lib/project";
import { removeBackground } from "@/lib/project";
import { restoreLayerImage } from "@/lib/layer-image";
import { measuredWidth, distance } from "@/lib/image-edit";
import { rectifyImage, eraseImage } from "@/lib/image-processing";
import type { Point } from "@/lib/image-edit";
export type EditMode = "erase" | "perspective" | "measure" | "background";
const titles = {
  erase: "範囲を消す",
  perspective: "パースを補正",
  measure: "2点で実寸合わせ",
  background: "背景を透過",
};
export default function ImageEditor({
  layer: sourceLayer,
  mode,
  close,
  apply,
}: {
  layer: Layer;
  mode: EditMode;
  close: () => void;
  apply: (updates: Partial<Layer>) => void | Promise<void>;
}) {
  const layer =
    mode === "background"
      ? { ...sourceLayer, ...restoreLayerImage(sourceLayer) }
      : sourceLayer;
  const [points, setPoints] = useState<Point[]>([]);
  const [length, setLength] = useState(
    layer.referenceMm
      ? String(layer.referenceMm)
      : layer.referenceOptions?.length === 1
        ? String(layer.referenceOptions[0].mm)
        : layer.referenceOptions?.length
          ? ""
          : "100",
  );
  const [tolerance, setTolerance] = useState(28);
  const [preview, setPreview] = useState(layer.src);
  const [eraseOutside, setEraseOutside] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [eraseHistory, setEraseHistory] = useState<string[]>([]);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);
  const drawing = useRef(false);
  const strokePoints = useRef<Point[]>([]);
  const max = mode === "perspective" ? 4 : 2;
  const actualPoint = (x: number, y: number) => {
    const m = svg.current!.getScreenCTM()!;
    const p = new DOMPoint(x, y).matrixTransform(m.inverse());
    return {
      x: Math.max(0, Math.min(layer.width, Math.round(p.x * 1000) / 1000)),
      y: Math.max(0, Math.min(layer.height, Math.round(p.y * 1000) / 1000)),
    };
  };
  const handleSize = Math.max(layer.width, layer.height) / 70;
  const changed = preview !== layer.src;
  async function eraseSelection() {
    setBusy(true);
    setError("");
    try {
      const updates = await eraseImage(layer, points, preview, eraseOutside);
      setEraseHistory((history) => [...history, preview].slice(-20));
      setPreview(updates.src!);
      setPoints([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "範囲を消せませんでした。");
    } finally {
      setBusy(false);
    }
  }
  async function backgroundPreview() {
    setBusy(true);
    setError("");
    try {
      setPreview(await removeBackground(layer.src, tolerance));
    } catch {
      setError("画像を処理できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setError("");
    setBusy(true);
    try {
      let updates: Partial<Layer>;
      if (mode === "measure")
        updates = {
          mm: measuredWidth(layer.width, points, Number(length)),
          referenceMm: Number(length),
        };
      else if (mode === "perspective")
        updates = await rectifyImage(layer, points);
      else if (mode === "erase") {
        if (points.length >= 3)
          updates = await eraseImage(layer, points, preview, eraseOutside);
        else if (changed)
          updates = {
            src: preview,
            originalSrc: layer.originalSrc || layer.src,
          };
        else throw new Error("消したい範囲をドラッグしてください。");
      } else {
        if (!changed)
          throw new Error("「透過をプレビュー」で結果を確認してください。");
        updates = {
          ...layer,
          src: preview,
          originalSrc: layer.originalSrc || layer.src,
        };
      }
      await apply(updates);
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理に失敗しました。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      wide
      label={titles[mode]}
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="image-editor">
        <button
          className="modal-close icon-button"
          aria-label="閉じる"
          onClick={close}
          disabled={busy}
        >
          <Icon name="close" />
        </button>
        <span className="eyebrow">IMAGE WORKBENCH</span>
        <h2>{titles[mode]}</h2>
        <p className="editor-instructions">
          {mode === "erase"
            ? eraseOutside
              ? "ドラッグで残したい部分を囲んでください。"
              : "ドラッグで消したい部分を囲んでください。"
            : mode === "perspective"
              ? "画像を平面の長方形に補正します。左上 → 右上 → 右下 → 左下の順に4点を選択。"
              : mode === "measure"
                ? layer.referenceOptions?.length
                  ? "取得した寸法を選び、画像上の対応する2点を選択してください。"
                  : "長さが分かる区間の両端を選び、その区間の実寸を入力してください。"
                : "外周と内側の背景を透過します。"}
        </p>
        <div className="image-edit-surface">
          <svg
            ref={svg}
            viewBox={`0 0 ${layer.width} ${layer.height}`}
            aria-label="画像編集エリア"
            role="img"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              if (busy || mode === "background" || drag.current !== null)
                return;
              const p = actualPoint(e.clientX, e.clientY);
              if (mode === "erase") {
                drawing.current = true;
                strokePoints.current = [p];
                setPoints([p]);
                e.currentTarget.setPointerCapture(e.pointerId);
                setError("");
                return;
              }
              setPoints((prev) => (prev.length >= max ? [p] : [...prev, p]));
              setError("");
            }}
            onPointerMove={(e) => {
              if (busy) return;
              if (drawing.current) {
                const samples = e.nativeEvent.getCoalescedEvents?.() || [];
                const events = samples.length ? samples : [e];
                const path = strokePoints.current;
                for (const event of events) {
                  const p = actualPoint(event.clientX, event.clientY);
                  const last = path[path.length - 1];
                  if (
                    distance(p, last) >=
                    Math.max(0.5, Math.max(layer.width, layer.height) / 1200)
                  ) {
                    if (path.length < 5999) path.push(p);
                    else path[path.length - 1] = p;
                  }
                }
                setPoints([...path]);
                return;
              }
              if (drag.current === null) return;
              const index = drag.current,
                p = actualPoint(e.clientX, e.clientY);
              setPoints((prev) => prev.map((v, i) => (i === index ? p : v)));
            }}
            onPointerUp={(e) => {
              if (drawing.current) {
                drawing.current = false;
                setPoints([
                  ...strokePoints.current,
                  actualPoint(e.clientX, e.clientY),
                ]);
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  e.currentTarget.releasePointerCapture(e.pointerId);
              }
              if (drag.current !== null) {
                drag.current = null;
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
            onPointerCancel={() => {
              drag.current = null;
              if (drawing.current) setPoints([]);
              drawing.current = false;
            }}
          >
            <image href={preview} width={layer.width} height={layer.height} />
            {mode === "erase" && points.length > 1 && (
              <g>
                {eraseOutside && (
                  <path
                    d={`M0 0H${layer.width}V${layer.height}H0Z M${points.map((p) => `${p.x} ${p.y}`).join("L")}Z`}
                    fill="#fb718544"
                    fillRule="evenodd"
                    pointerEvents="none"
                  />
                )}
                <polygon
                  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill={eraseOutside ? "none" : "#fb718544"}
                  fillRule="evenodd"
                  stroke="#e11d48"
                  strokeWidth={handleSize / 5}
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              </g>
            )}
            {mode === "perspective" && points.length > 1 && (
              <polygon
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="#38bdf822"
                stroke="#0284c7"
                strokeWidth={handleSize / 5}
              />
            )}
            {mode === "measure" && points.length === 2 && (
              <line
                x1={points[0].x}
                y1={points[0].y}
                x2={points[1].x}
                y2={points[1].y}
                stroke="#0284c7"
                strokeWidth={handleSize / 4}
              />
            )}
            {mode !== "erase" &&
              points.map((p, index) => (
                <g key={index}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={handleSize}
                    fill="#fff"
                    stroke="#0284c7"
                    strokeWidth={handleSize / 5}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (busy) return;
                      drag.current = index;
                      svg.current!.setPointerCapture(e.pointerId);
                    }}
                  />
                  <text
                    x={p.x}
                    y={p.y + handleSize / 3}
                    textAnchor="middle"
                    fill="#0369a1"
                    fontSize={handleSize}
                    pointerEvents="none"
                  >
                    {index + 1}
                  </text>
                </g>
              ))}
          </svg>
        </div>
        {mode === "measure" && (
          <div className="measurement-fields">
            {!!layer.referenceOptions?.length && (
              <label className="field-label">
                取得した寸法
                <select
                  aria-label="取得した寸法"
                  disabled={busy}
                  value={
                    layer.referenceOptions.some((o) => String(o.mm) === length)
                      ? length
                      : ""
                  }
                  onChange={(e) => setLength(e.target.value)}
                >
                  <option value="">寸法を選択、または下に入力</option>
                  {layer.referenceOptions.map((o) => (
                    <option key={o.mm} value={o.mm}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field-label">
              選択区間の実寸（mm）
              <input
                autoComplete="off"
                type="number"
                min="0.1"
                step="0.1"
                value={length}
                disabled={busy}
                onChange={(e) => setLength(e.target.value)}
              />
            </label>
            <p>
              {points.length === 2
                ? `${distance(points[0], points[1]).toFixed(1)} px を選択中`
                : "2点を選んでください"}
            </p>
          </div>
        )}
        {mode === "background" && (
          <>
            <label className="range-label">
              背景色の許容差：{tolerance}
              <input
                type="range"
                min="0"
                max="100"
                value={tolerance}
                disabled={busy}
                onChange={(e) => {
                  setTolerance(Number(e.target.value));
                  setPreview(layer.src);
                }}
              />
            </label>
            <button
              className="button secondary"
              disabled={busy}
              onClick={backgroundPreview}
            >
              透過をプレビュー
            </button>
          </>
        )}
        {mode === "erase" && (
          <div className="erase-actions">
            <div role="group" aria-label="消す範囲" className="erase-mode">
              <button
                className={`mini-button ${!eraseOutside ? "toggled" : ""}`}
                aria-pressed={!eraseOutside}
                disabled={busy}
                onClick={() => setEraseOutside(false)}
              >
                内側を消す
              </button>
              <button
                className={`mini-button ${eraseOutside ? "toggled" : ""}`}
                aria-pressed={eraseOutside}
                disabled={busy}
                onClick={() => setEraseOutside(true)}
              >
                外側を消す
              </button>
            </div>
            <button
              className="button secondary"
              disabled={busy || points.length < 3}
              onClick={eraseSelection}
            >
              選択範囲を消す
            </button>
            <button
              className="mini-button"
              disabled={busy || !eraseHistory.length}
              onClick={() => {
                setPreview(eraseHistory[eraseHistory.length - 1]);
                setEraseHistory((history) => history.slice(0, -1));
                setPoints([]);
                setError("");
              }}
            >
              ひとつ戻す
            </button>
          </div>
        )}
        {mode === "perspective" && (
          <p className="hint">
            補正後は「2点で実寸合わせ」で縮尺を確認してください。立体の見えない面は復元できません。
          </p>
        )}
        {error && (
          <p role="alert" className="editor-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setPoints([]);
              setPreview(layer.src);
              setEraseHistory([]);
              setError("");
            }}
          >
            選択をリセット
          </button>
          <button
            className="button primary"
            disabled={
              busy ||
              (mode === "measure" &&
                (!Number.isFinite(Number(length)) ||
                  Number(length) <= 0 ||
                  Number(length) > 5000)) ||
              (mode === "background"
                ? !changed
                : mode === "erase"
                  ? !changed && points.length < 3
                  : points.length !== max)
            }
            onClick={submit}
          >
            {busy ? "処理中…" : "適用する"}
          </button>
        </div>
        <p className="hint">
          適用後も「元に戻す」で編集前に戻せます。キャンセルでは変更されません。
        </p>
      </div>
      {busy && <LoadingOverlay label="画像を処理中…" />}
    </Dialog>
  );
}
