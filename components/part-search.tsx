"use client";
import { useEffect, useState } from "react";
import Dialog from "./dialog";
import Icon from "./icon";
import catalog from "@/lib/parts-catalog.json";
import { matchesPart } from "@/lib/part-search";
import { catalogImageUrl } from "@/lib/catalog-image";
import { listParts, type StoredPart } from "@/lib/storage";
import { readImage, uid, type Layer } from "@/lib/project";

export default function PartSearch({
  close,
  add,
}: {
  close: () => void;
  add: (part: Layer) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("catalog");
  const [dimensionOnly, setDimensionOnly] = useState(false);
  const [saved, setSaved] = useState<StoredPart[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [imageSizes, setImageSizes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    listParts()
      .then((rows) => {
        if (!cancelled) setSaved(rows);
      })
      .catch(() => {
        if (!cancelled) setError("登録パーツを読み込めません。");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const results = catalog.filter(
    (p) =>
      (!category || p.category === category) &&
      (!dimensionOnly || p.dimensions.length > 0) &&
      matchesPart(query, [
        p.name,
        p.manufacturer,
        p.category,
        ...p.dimensions.map((d) => d.value),
      ]),
  );
  const stored = saved.filter(
    (p) =>
      (!category || p.layer.category === category) &&
      matchesPart(query, [p.layer.name, p.layer.category]),
  );
  async function importPart(item: (typeof catalog)[number]) {
    setBusy(item.id);
    setError("");
    try {
      const response = await fetch(catalogImageUrl(item, photos[item.id] || 0));
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ||
            "画像を取得できません。公式ページから保存して追加してください。",
        );
      }
      const blob = await response.blob();
      const image = await readImage(
        new File([blob], `${item.id}.jpg`, { type: blob.type }),
      );
      await add({
        ...image,
        id: uid(),
        name: item.name,
        mm: 150,
        referenceMm: item.lengthMm ?? undefined,
        x: 430,
        y: 160,
        rotation: 0,
        flip: false,
        visible: true,
        attachedToBase: false,
        price: 0,
        url: item.url,
        category: item.category,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "追加できませんでした。");
    } finally {
      setBusy(null);
    }
  }
  return (
    <Dialog
      wide
      label="パーツ検索"
      close={() => {
        if (!busy) close();
      }}
    >
      <button
        className="modal-close icon-button"
        aria-label="閉じる"
        disabled={!!busy}
        onClick={close}
      >
        <Icon name="close" />
      </button>
      <h2>パーツ検索</h2>
      <div className="shelf-tabs" role="tablist" aria-label="検索対象">
        <button
          role="tab"
          aria-selected={source === "catalog"}
          className={`mini-button ${source === "catalog" ? "toggled" : ""}`}
          onClick={() => setSource("catalog")}
        >
          公式カタログ
        </button>
        <button
          role="tab"
          aria-selected={source === "saved"}
          className={`mini-button ${source === "saved" ? "toggled" : ""}`}
          onClick={() => setSource("saved")}
        >
          登録パーツ
        </button>
      </div>
      <div className="part-search-controls">
        <input
          type="search"
          aria-label="パーツ名で検索"
          placeholder="パーツ名・メーカー・寸法"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="カテゴリーで絞り込み"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {["", "光学機器", "グリップ", "ストック", "外装", "その他"].map(
            (c) => (
              <option key={c} value={c}>
                {c || "すべて"}
              </option>
            ),
          )}
        </select>
        {source === "catalog" && (
          <label>
            <input
              type="checkbox"
              checked={dimensionOnly}
              onChange={(e) => setDimensionOnly(e.target.checked)}
            />
            寸法あり
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="editor-error">
          {error}
        </p>
      )}
      <p className="search-count" aria-live="polite">
        {source === "catalog" ? results.length : stored.length}件
      </p>
      <div className="shelf-grid search-results">
        {source === "catalog"
          ? results.map((p) => (
              <article
                className={`shelf-card ${expanded === p.id ? "photo-expanded-card" : ""}`}
                key={p.id}
              >
                <button
                  className={`shelf-part-image catalog-photo ${expanded === p.id ? "expanded" : ""}`}
                  disabled={!!busy || !p.images.length}
                  aria-label={`${p.name}の写真を${expanded === p.id ? "縮小" : "拡大"}`}
                  aria-expanded={expanded === p.id}
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                >
                  <img
                    key={photos[p.id] || 0}
                    loading="lazy"
                    src={catalogImageUrl(p, photos[p.id] || 0)}
                    alt={p.name}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      img.parentElement!.removeAttribute("data-error");
                      const key = catalogImageUrl(p, photos[p.id] || 0),
                        size = `${img.naturalWidth} × ${img.naturalHeight} px`;
                      setImageSizes((prev) =>
                        prev[key] === size ? prev : { ...prev, [key]: size },
                      );
                    }}
                    onError={(e) => {
                      e.currentTarget.parentElement!.setAttribute(
                        "data-error",
                        "画像を取得できません",
                      );
                    }}
                  />
                  <span className="photo-expand-label">
                    {expanded === p.id ? "縮小" : "拡大"}
                  </span>
                </button>
                <p className="photo-resolution">
                  {imageSizes[catalogImageUrl(p, photos[p.id] || 0)] || ""}
                </p>
                {p.images.length > 1 && (
                  <div className="photo-controls">
                    <button
                      aria-label={`${p.name}の前の写真`}
                      disabled={!!busy}
                      onClick={() =>
                        setPhotos({
                          ...photos,
                          [p.id]:
                            ((photos[p.id] || 0) + p.images.length - 1) %
                            p.images.length,
                        })
                      }
                    >
                      ‹
                    </button>
                    <span>
                      写真 {(photos[p.id] || 0) + 1} / {p.images.length}
                    </span>
                    <button
                      aria-label={`${p.name}の次の写真`}
                      disabled={!!busy}
                      onClick={() =>
                        setPhotos({
                          ...photos,
                          [p.id]: ((photos[p.id] || 0) + 1) % p.images.length,
                        })
                      }
                    >
                      ›
                    </button>
                  </div>
                )}
                <small>
                  {p.manufacturer} · {p.category}
                </small>
                <h3>{p.name}</h3>
                <dl className="part-dimensions">
                  {p.dimensions.length ? (
                    p.dimensions.map((d) => (
                      <div key={d.label}>
                        <dt>{d.label}</dt>
                        <dd>{d.value}</dd>
                      </div>
                    ))
                  ) : (
                    <div>
                      <dt>寸法</dt>
                      <dd>公式ページに未掲載</dd>
                    </div>
                  )}
                </dl>
                <div className="shelf-card-actions">
                  <a
                    className="mini-button"
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    公式ページ ↗
                  </a>
                  <button
                    className="mini-button toggled"
                    disabled={!!busy || !p.images.length}
                    onClick={() => void importPart(p)}
                  >
                    {busy === p.id ? "読み込み中…" : "この写真を追加"}
                  </button>
                </div>
              </article>
            ))
          : stored.map((p) => (
              <article className="shelf-card" key={p.id}>
                <div className="shelf-part-image">
                  <img src={p.layer.src} alt={p.layer.name} />
                </div>
                <h3>{p.layer.name}</h3>
                <dl className="part-dimensions">
                  <div>
                    <dt>画像横幅</dt>
                    <dd>{p.layer.mm} mm</dd>
                  </div>
                </dl>
                <button
                  className="mini-button toggled"
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy(p.id);
                    setError("");
                    try {
                      await add({ ...p.layer, referenceMm: undefined });
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "追加できませんでした。",
                      );
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  追加
                </button>
              </article>
            ))}
      </div>
      {(source === "catalog" ? results.length : stored.length) === 0 && (
        <p className="shelf-empty">該当するパーツがありません</p>
      )}
      {source === "catalog" && (
        <div className="search-footer">
          <span>東京マルイ {catalog.length}件 · 2026/11/02確認</span>
          <div>
            <a
              href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${query || "エアガン パーツ"} 商品画像`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Webで画像を探す ↗
            </a>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(`${query || "エアガン パーツ"} 全長 寸法 mm`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Webで寸法を探す ↗
            </a>
          </div>
        </div>
      )}
    </Dialog>
  );
}
