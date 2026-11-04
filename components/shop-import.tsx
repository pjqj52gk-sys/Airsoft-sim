"use client";
import { useRef, useState } from "react";
import type { Layer } from "@/lib/project";
import { readImage, uid } from "@/lib/project";
import type { ShopProduct } from "@/lib/shop-product";
import { referenceCatalogPrice } from "@/lib/catalog-price";
import { shopUrl } from "@/lib/shop-url";
import { catalogImageUrl } from "@/lib/catalog-image";
import {
  referenceLengthOptions,
  combinedReferenceLength,
} from "@/lib/product-specs";

export default function ShopImport({
  add,
  onBusy,
  attachLink,
}: {
  add: (layer: Layer) => Promise<void>;
  onBusy: (value: boolean) => void;
  attachLink?: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [photo, setPhoto] = useState(0);
  const [name, setName] = useState("ショップのパーツ");
  const [length, setLength] = useState("");
  const [category, setCategory] = useState("その他");
  const [imageUrl, setImageUrl] = useState("");
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resolution, setResolution] = useState("");
  const [lowResolution, setLowResolution] = useState(false);
  const [useOfficial, setUseOfficial] = useState(true);
  const official = product?.officialMatch?.product;
  const photos =
    useOfficial && official?.images.length
      ? official.images.map((_, i) => catalogImageUrl(official, i))
      : product?.images || [];
  const calibrationOptions = referenceLengthOptions(
    (official?.dimensions || []).map((d) => ({ ...d, kind: "product" })),
    product?.dimensions || [],
    official?.lengthMm,
  );
  const files = useRef<HTMLInputElement>(null);
  const loading = (value: boolean) => {
    setBusy(value);
    onBusy(value);
  };
  let sourceLink = "";
  try {
    sourceLink = shopUrl(url).href;
  } catch {
    /* Incomplete URL while typing. */
  }
  async function getProduct() {
    loading(true);
    setError("");
    setProduct(null);
    setResolution("");
    try {
      const response = await fetch("/api/shop-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "商品情報を取得できません。");
      const found = data as ShopProduct;
      setProduct(found);
      setUseOfficial(true);
      if (found.officialMatch)
        setCategory(found.officialMatch.product.category);
      setUrl(found.url);
      setName(found.name);
      setPhoto(0);
      const reference = combinedReferenceLength(
        (found.officialMatch?.product.dimensions || []).map((d) => ({
          ...d,
          kind: "product",
        })),
        found.dimensions,
        found.officialMatch?.product.lengthMm,
      );
      setLength(reference ? String(reference) : "");
      if (!found.images.length && !found.linkOnly) {
        setError(
          "商品画像が見つかりません。画像URLまたはファイルから追加してください。",
        );
        setManual(true);
      }
      if (found.linkOnly) setManual(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得できませんでした。");
      setManual(true);
    } finally {
      loading(false);
    }
  }
  async function addFile(file: File) {
    const image = await readImage(file);
    const mm = length.trim() ? Number(length) : undefined;
    if (mm !== undefined && (!Number.isFinite(mm) || mm <= 0 || mm > 5000))
      throw new Error("実寸は0より大きく5000mm以下で入力してください。");
    await add({
      ...image,
      id: uid(),
      name: name.trim() || "ショップのパーツ",
      mm: category === "本体" ? 800 : 150,
      referenceMm: mm,
      referenceOptions: calibrationOptions,
      x: 430,
      y: 160,
      rotation: 0,
      flip: false,
      visible: true,
      attachedToBase: false,
      price: referenceCatalogPrice(official?.price),
      url: sourceLink,
      category,
    });
  }
  async function importUrl(value: string) {
    loading(true);
    setError("");
    try {
      const response = value.startsWith("/api/part-image?")
        ? await fetch(value)
        : await fetch("/api/shop-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: value }),
          });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "画像を取得できません。");
      }
      const blob = await response.blob();
      await addFile(new File([blob], "shop-part.jpg", { type: blob.type }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像を追加できません。");
      setManual(true);
    } finally {
      loading(false);
    }
  }
  async function importFile(file?: File) {
    if (!file || busy) return;
    loading(true);
    setError("");
    try {
      await addFile(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像を追加できません。");
    } finally {
      loading(false);
    }
  }
  return (
    <section className="shop-import" aria-label="ショップから追加">
      <form
        className="shop-url-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void getProduct();
        }}
      >
        <label className="field-label">
          商品URL
          <input
            type="url"
            required
            maxLength={2048}
            value={url}
            disabled={busy}
            placeholder="Amazon・楽天・ショップの商品URL"
            onChange={(e) => {
              setUrl(e.target.value);
              setProduct(null);
              setError("");
            }}
          />
        </label>
        <button
          className="button primary"
          type="submit"
          disabled={busy || !url.trim()}
        >
          {busy ? "取得中…" : "画像を取得"}
        </button>
      </form>
      {sourceLink && (
        <a
          className="product-link"
          href={sourceLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          商品ページを開く ↗
        </a>
      )}
      {error && (
        <p className="editor-error" role="alert">
          {error}
        </p>
      )}
      {product && (
        <div className="shop-product-info">
          <h3>{product.name}</h3>
          <small>{product.site}</small>
          {product.notice && <p className="hint">{product.notice}</p>}
          {sourceLink && (
            <button
              className="button secondary shop-attach-link"
              disabled={busy || !attachLink}
              onClick={() => attachLink?.(sourceLink)}
              title={
                attachLink ? "" : "リンクを付けるパーツを先に選択してください"
              }
            >
              選択中のパーツに購入リンクを設定
            </button>
          )}
          {!!product.dimensions.length && (
            <dl className="part-dimensions">
              {product.dimensions.map((d, i) => (
                <div key={i}>
                  <dt>
                    {d.label}
                    {d.kind === "package" ? "（梱包）" : ""}
                  </dt>
                  <dd>{d.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
      {(product || manual) && (
        <div className="shop-part-fields">
          <label className="field-label">
            パーツ名
            <input
              maxLength={100}
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field-label">
            全長（mm・任意）
            <input
              aria-label="取り込むパーツの全長"
              type="number"
              min="0.1"
              max="5000"
              step="0.1"
              value={length}
              disabled={busy}
              placeholder="不明なら空欄"
              onChange={(e) => setLength(e.target.value)}
            />
          </label>
          <label className="field-label">
            カテゴリー
            <select
              value={category}
              disabled={busy}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                "その他",
                "光学機器",
                "グリップ",
                "ストック",
                "外装",
                "本体",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {!!photos.length && (
        <>
          {official && (
            <div className="catalog-match-info">
              <a href={official.url} target="_blank" rel="noopener noreferrer">
                公式候補：{official.name} ↗
              </a>
              <div
                className="photo-source-tabs"
                role="group"
                aria-label="画像の取得元"
              >
                <button
                  className="mini-button"
                  aria-pressed={useOfficial}
                  disabled={busy}
                  onClick={() => {
                    setUseOfficial(true);
                    setPhoto(0);
                    setResolution("");
                  }}
                >
                  公式写真
                </button>
                <button
                  className="mini-button"
                  aria-pressed={!useOfficial}
                  disabled={busy}
                  onClick={() => {
                    setUseOfficial(false);
                    setPhoto(0);
                    setResolution("");
                  }}
                >
                  販売店の写真
                </button>
              </div>
            </div>
          )}
          <div className="shop-photo-preview">
            <img
              key={photos[photo]}
              src={photos[photo]}
              referrerPolicy="no-referrer"
              alt="選択したショップの商品写真"
              onLoad={(e) => {
                setLowResolution(
                  Math.max(
                    e.currentTarget.naturalWidth,
                    e.currentTarget.naturalHeight,
                  ) < 600,
                );
                setResolution(
                  `${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight} px`,
                );
              }}
              onError={() => setResolution("画像を表示できません")}
            />
          </div>
          <div className="shop-photo-caption">
            <span>{resolution}</span>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void importUrl(photos[photo])}
            >
              この写真を追加
            </button>
          </div>
          {lowResolution && (
            <p className="hint">
              小さい画像です。別の写真や画像URLから追加できます。
            </p>
          )}
          <p className="hint">
            編集・公開には利用許諾のある写真を使ってください。
          </p>
          <div
            className="shop-photo-list"
            role="group"
            aria-label="ショップの写真候補"
          >
            {photos.map((src, i) => (
              <button
                key={src}
                aria-label={`写真${i + 1}を選択`}
                aria-pressed={photo === i}
                disabled={busy}
                onClick={() => {
                  setPhoto(i);
                  setResolution("");
                }}
              >
                <img
                  src={src}
                  referrerPolicy="no-referrer"
                  alt={`商品写真 ${i + 1}`}
                  loading="lazy"
                />
                {product?.imageDetails?.find((d) => d.url === src) && (
                  <small>
                    {product.imageDetails.find((d) => d.url === src)!.width} ×{" "}
                    {product.imageDetails.find((d) => d.url === src)!.height}
                  </small>
                )}
              </button>
            ))}
          </div>
        </>
      )}
      <details
        className="shop-manual"
        open={manual}
        onToggle={(e) => setManual(e.currentTarget.open)}
      >
        <summary>画像URL・ファイルから追加</summary>
        <p className="hint">
          編集には自分の写真・利用許諾のある画像を使ってください。
        </p>
        <form
          className="shop-url-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void importUrl(imageUrl);
          }}
        >
          <label className="field-label">
            画像URL
            <input
              type="url"
              required
              value={imageUrl}
              maxLength={2048}
              disabled={busy}
              placeholder="https://…/image.jpg"
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="button secondary"
            disabled={busy || !imageUrl.trim()}
          >
            画像URLから追加
          </button>
        </form>
        <input
          ref={files}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          className="shop-file-drop"
          disabled={busy}
          onClick={() => files.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={(e) => e.stopPropagation()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void importFile(e.dataTransfer.files[0]);
          }}
        >
          画像ファイルを選択・ドロップ
        </button>
      </details>
    </section>
  );
}
