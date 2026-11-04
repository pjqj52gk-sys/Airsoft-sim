"use client";
import "./image-preparation.css";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Layer } from "@/lib/project";

type Request = {
  original: Layer[];
  prepared: Layer[];
  resolve: (layers: Layer[]) => void;
  reject: (error: Error) => void;
};
export function useImagePreparation() {
  const [request, setRequest] = useState<Request | null>(null);
  function review(original: Layer[], prepared: Layer[]) {
    return new Promise<Layer[]>((resolve, reject) =>
      setRequest({ original, prepared, resolve, reject }),
    );
  }
  const dialog = request ? (
    <PreparationDialog
      original={request.original}
      prepared={request.prepared}
      accept={(layers) => {
        request.resolve(layers);
        setRequest(null);
      }}
      cancel={() => {
        request.reject(new Error("画像の追加をキャンセルしました。"));
        setRequest(null);
      }}
    />
  ) : null;
  return { review, dialog, reviewing: !!request };
}
function PreparationDialog({
  original,
  prepared,
  accept,
  cancel,
}: {
  original: Layer[];
  prepared: Layer[];
  accept: (layers: Layer[]) => void;
  cancel: () => void;
}) {
  const element = useRef<HTMLDialogElement>(null);
  const [usePrepared, setUsePrepared] = useState(original.map(() => true));
  useEffect(() => {
    const dialog = element.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={element}
      className="image-preparation modal modal-wide"
      aria-label="画像の下準備"
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
    >
      <div className="preparation-heading">
        <h2>画像の下準備</h2>
        <button className="icon-button" onClick={cancel} aria-label="閉じる">
          ×
        </button>
      </div>
      <p>背景透過・余白除去の結果を確認してください。</p>
      <div className="preparation-items">
        {original.map((layer, i) => (
          <section key={layer.id}>
            <h3>{layer.name}</h3>
            <div className="preparation-comparison">
              {[layer, prepared[i]].map((image, index) => (
                <figure key={index}>
                  <div className="preparation-image">
                    <Image
                      unoptimized
                      src={image.src}
                      width={image.width}
                      height={image.height}
                      alt={`${index ? "処理後" : "元画像"}：${layer.name}`}
                    />
                  </div>
                  <figcaption>
                    {index ? "処理後" : "元画像"} · {image.width} ×{" "}
                    {image.height} px
                  </figcaption>
                </figure>
              ))}
            </div>
            <label>
              <input
                type="checkbox"
                checked={usePrepared[i]}
                onChange={(e) =>
                  setUsePrepared((previous) =>
                    previous.map((v, n) => (n === i ? e.target.checked : v)),
                  )
                }
              />{" "}
              処理後を使う
            </label>
          </section>
        ))}
      </div>
      <div className="preparation-actions">
        <button className="button secondary" onClick={cancel}>
          キャンセル
        </button>
        <button
          className="button primary"
          onClick={() =>
            accept(
              original.map((layer, i) =>
                usePrepared[i] ? prepared[i] : layer,
              ),
            )
          }
        >
          選んだ画像を追加
        </button>
      </div>
    </dialog>
  );
}
