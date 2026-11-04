"use client";
import { useEffect, useRef, useState } from "react";
import type { Layer } from "@/lib/project";
import { readImagePixels } from "@/lib/image-processing";
import { trimTransparentLayer } from "@/lib/layer-image";
import {
  analyzeContours,
  isolatedCandidates,
  removeIsolatedCandidates,
  type ContourAnalysis,
  type IsolatedCandidate,
} from "@/lib/image-contours";
import "./logo-cleanup.css";
export default function LogoCleanup({
  layer,
  close,
  apply,
}: {
  layer: Layer;
  close: () => void;
  apply: (value: Layer) => void | Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [source, setSource] = useState<{
    pixels: ImageData;
    analysis: ContourAnalysis;
    candidates: IsolatedCandidate[];
  } | null>(null);
  const [selected, setSelected] = useState<number[]>([]),
    [preview, setPreview] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const root = dialog.current!;
    root.showModal();
    return () => root.close();
  }, []);
  useEffect(() => {
    let cancelled = false;
    readImagePixels(layer.src)
      .then((pixels) => {
        if (cancelled) return;
        const analysis = analyzeContours(pixels),
          candidates = isolatedCandidates(analysis);
        setSource({ pixels, analysis, candidates });
        setSelected(candidates.map((c) => c.id));
      })
      .catch(() => {
        if (!cancelled) setError("画像を読み込めませんでした。");
      });
    return () => {
      cancelled = true;
    };
  }, [layer.src]);
  useEffect(() => {
    if (!source) return;
    setPreview("");
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      try {
        const data = removeIsolatedCandidates(
          source.pixels,
          source.analysis,
          source.candidates,
          selected,
        );
        const canvas = document.createElement("canvas");
        canvas.width = source.pixels.width;
        canvas.height = source.pixels.height;
        canvas
          .getContext("2d")!
          .putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);
        if (!cancelled) setPreview(canvas.toDataURL("image/png"));
      } catch {
        if (!cancelled) setError("候補を処理できませんでした。");
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [source, selected]);
  return (
    <dialog
      ref={dialog}
      className="modal modal-wide logo-cleanup"
      aria-label="余白のロゴ・文字を除去"
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!busy) close();
      }}
    >
      <div className="logo-cleanup-heading">
        <h2>余白のロゴ・文字を除去</h2>
        <button
          className="icon-button"
          aria-label="閉じる"
          disabled={busy}
          onClick={close}
        >
          ×
        </button>
      </div>
      <p className="hint">
        本体から離れた小さな要素を候補にしています。部品が含まれていないか確認してください。
      </p>
      {!source && !error && <p role="status">候補を探しています…</p>}
      {source && (
        <>
          <div className="logo-cleanup-photos">
            <figure>
              <svg
                viewBox={`0 0 ${layer.width} ${layer.height}`}
                role="img"
                aria-label="削除候補の位置"
              >
                <image
                  href={layer.src}
                  width={layer.width}
                  height={layer.height}
                />
                {source.candidates.map((c) => (
                  <g key={c.id}>
                    <rect
                      x={c.x}
                      y={c.y}
                      width={c.width}
                      height={c.height}
                      fill={selected.includes(c.id) ? "#fb923c44" : "none"}
                      stroke="#f97316"
                      strokeWidth={Math.max(layer.width, layer.height) / 300}
                    />
                    <text
                      x={c.x}
                      y={c.y + Math.max(layer.width, layer.height) / 35}
                      fontSize={Math.max(layer.width, layer.height) / 35}
                      fill="#9a3412"
                    >
                      {c.id + 1}
                    </text>
                  </g>
                ))}
              </svg>
              <figcaption>元画像・削除候補</figcaption>
            </figure>
            <figure>
              {preview ? (
                <img src={preview} alt="余白のロゴ・文字を除去したプレビュー" />
              ) : (
                <p role="status">プレビューを作成中…</p>
              )}
              <figcaption>処理後</figcaption>
            </figure>
          </div>
          <div className="logo-cleanup-candidates">
            {source.candidates.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  disabled={busy}
                  onChange={(e) =>
                    setSelected((ids) =>
                      e.target.checked
                        ? [...ids, c.id]
                        : ids.filter((id) => id !== c.id),
                    )
                  }
                />
                候補{c.id + 1}を除去
              </label>
            ))}
          </div>
          {!source.candidates.length && (
            <p role="status">
              {!source.analysis.transparent
                ? "背景を透過してから、もう一度お試しください。"
                : "自動で除去できる候補がありません。本体に重なった文字は対象外です。"}
            </p>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="logo-cleanup-actions">
        <button className="button secondary" disabled={busy} onClick={close}>
          キャンセル
        </button>
        <button
          className="button primary"
          disabled={busy || !preview || !selected.length || !!error}
          onClick={async () => {
            setBusy(true);
            try {
              await apply(
                await trimTransparentLayer({
                  ...layer,
                  src: preview,
                  originalSrc: layer.originalSrc || layer.src,
                }),
              );
            } catch {
              setError("除去を適用できませんでした。");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "処理中…" : "選んだ候補を除去"}
        </button>
      </div>
    </dialog>
  );
}
