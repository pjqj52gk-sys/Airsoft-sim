"use client";
import { useEffect, useMemo, useState } from "react";
import Dialog from "./dialog";
import ShopImport from "./shop-import";
import RakutenSearch from "./rakuten-search";
import LoadingOverlay from "./loading-overlay";
import Icon from "./icon";
import catalogData from "@/lib/parts-catalog.json";
import type { CatalogProduct } from "@/lib/catalog-match";
import { referenceCatalogPrice, catalogPriceLabel } from "@/lib/catalog-price";
import {
  matchesPart,
  matchesSearchText,
  normalizeSearch,
  searchTerms,
} from "@/lib/part-search";
import { catalogImageUrl } from "@/lib/catalog-image";
import { listParts, type StoredPart } from "@/lib/storage";
import { readImage, uid, type Layer } from "@/lib/project";
import {
  referenceLengthOptions,
  combinedReferenceLength,
} from "@/lib/product-specs";
const catalog = catalogData as CatalogProduct[];
const searchableCatalog = catalog.map((p) =>
  normalizeSearch(
    [
      p.name,
      p.manufacturer,
      p.category,
      ...(p.janCodes || []),
      ...(p.modelNumbers || []),
      ...p.dimensions.map((d) => d.value),
    ].join(" "),
  ),
);
const manufacturers = [...new Set(catalog.map((p) => p.manufacturer))];

export default function PartSearch({
  close,
  add,
  attachLink,
  initialScope = "parts",
}: {
  close: () => void;
  add: (part: Layer, reuse?: boolean) => Promise<void>;
  attachLink?: (url: string) => void;
  initialScope?: "parts" | "guns";
}) {
  const [visibleCount, setVisibleCount] = useState(48);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [source, setSource] = useState("rakuten");
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
        if (!cancelled) setSaved(rows.sort((a, b) => b.savedAt - a.savedAt));
      })
      .catch(() => {
        if (!cancelled) setError("登録パーツを読み込めません。");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const terms = useMemo(() => searchTerms(query), [query]);
  const results = useMemo(
    () =>
      catalog.filter(
        (p, index) =>
          (initialScope !== "guns" || p.category === "本体") &&
          (!category || p.category === category) &&
          (!manufacturer || p.manufacturer === manufacturer) &&
          (!dimensionOnly || p.dimensions.length > 0) &&
          matchesSearchText(searchableCatalog[index], terms),
      ),
    [category, manufacturer, dimensionOnly, initialScope, terms],
  );
  const stored = useMemo(
    () =>
      saved.filter(
        (p) =>
          (initialScope !== "guns" || p.layer.category === "本体") &&
          (!category || p.layer.category === category) &&
          matchesPart(query, [p.layer.name, p.layer.category]),
      ),
    [saved, category, query, initialScope],
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
        referenceMm: combinedReferenceLength(
          item.dimensions.map((d) => ({ ...d, kind: "product" })),
          [],
          item.lengthMm,
        ),
        referenceOptions: referenceLengthOptions(
          item.dimensions.map((d) => ({ ...d, kind: "product" })),
          [],
          item.lengthMm,
        ),
        x: 430,
        y: 160,
        rotation: 0,
        flip: false,
        visible: true,
        attachedToBase: false,
        price: referenceCatalogPrice(item.price),
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
      label={initialScope === "guns" ? "本体を検索" : "パーツ検索"}
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
      <h2>{initialScope === "guns" ? "本体を検索" : "パーツ検索"}</h2>
      <div className="shelf-tabs" role="tablist" aria-label="検索対象">
        <button
          role="tab"
          aria-selected={source === "rakuten"}
          className={`mini-button ${source === "rakuten" ? "toggled" : ""}`}
          disabled={!!busy}
          onClick={() => setSource("rakuten")}
        >
          楽天市場
        </button>
        <button
          role="tab"
          disabled={!!busy}
          aria-selected={source === "catalog"}
          className={`mini-button ${source === "catalog" ? "toggled" : ""}`}
          onClick={() => setSource("catalog")}
        >
          公式カタログ
        </button>
        <button
          role="tab"
          disabled={!!busy}
          aria-selected={source === "saved"}
          className={`mini-button ${source === "saved" ? "toggled" : ""}`}
          onClick={() => setSource("saved")}
        >
          登録パーツ
        </button>
        <button
          role="tab"
          aria-selected={source === "shop"}
          className={`mini-button ${source === "shop" ? "toggled" : ""}`}
          disabled={!!busy}
          onClick={() => {
            setSource("shop");
            setError("");
          }}
        >
          ショップURL
        </button>
      </div>
      {source === "rakuten" ? (
        <RakutenSearch
          initialScope={initialScope}
          add={add}
          attachLink={attachLink}
          onBusy={(value) => setBusy(value ? "rakuten" : null)}
        />
      ) : source === "shop" ? (
        <ShopImport
          add={add}
          attachLink={attachLink}
          onBusy={(value) => setBusy(value ? "shop" : null)}
        />
      ) : (
        <>
          <div className="part-search-controls">
            {source === "catalog" && (
              <select
                aria-label="メーカーで絞り込み"
                value={manufacturer}
                onChange={(e) => {
                  setManufacturer(e.target.value);
                  setVisibleCount(48);
                }}
              >
                <option value="">すべてのメーカー</option>
                {manufacturers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="search"
              aria-label="パーツ名で検索"
              placeholder="パーツ名・メーカー・寸法"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(48);
              }}
            />
            <select
              aria-label="カテゴリーで絞り込み"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setVisibleCount(48);
              }}
            >
              {[
                "",
                "本体",
                "光学機器",
                "グリップ",
                "ストック",
                "外装",
                "その他",
              ].map((c) => (
                <option key={c} value={c}>
                  {c || "すべて"}
                </option>
              ))}
            </select>
            {source === "catalog" && (
              <label>
                <input
                  type="checkbox"
                  checked={dimensionOnly}
                  onChange={(e) => {
                    setDimensionOnly(e.target.checked);
                    setVisibleCount(48);
                  }}
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
              ? results.slice(0, visibleCount).map((p) => (
                  <article
                    className={`shelf-card ${expanded === p.id ? "photo-expanded-card" : ""}`}
                    key={p.id}
                  >
                    <button
                      className={`shelf-part-image catalog-photo ${expanded === p.id ? "expanded" : ""}`}
                      disabled={!!busy || !p.images.length}
                      aria-label={`${p.name}の写真を${expanded === p.id ? "縮小" : "拡大"}`}
                      aria-expanded={expanded === p.id}
                      onClick={() =>
                        setExpanded(expanded === p.id ? null : p.id)
                      }
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
                            prev[key] === size
                              ? prev
                              : { ...prev, [key]: size },
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
                              [p.id]:
                                ((photos[p.id] || 0) + 1) % p.images.length,
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
                    <p
                      className="hint"
                      title={`公式掲載価格・${p.checkedAt}確認`}
                    >
                      {p.price ? catalogPriceLabel(p.price) : "価格未掲載"}
                    </p>
                    <dl className="part-dimensions">
                      {p.dimensions.length ? (
                        p.dimensions.map((d, i) => (
                          <div key={`${d.label}-${i}`}>
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
                          await add(p.layer, true);
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
          {source === "catalog" && visibleCount < results.length && (
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() => setVisibleCount((count) => count + 48)}
            >
              さらに48件表示（{Math.min(visibleCount, results.length)} /{" "}
              {results.length}件）
            </button>
          )}
          {(source === "catalog" ? results.length : stored.length) === 0 && (
            <p className="shelf-empty">該当するパーツがありません</p>
          )}
          {source === "catalog" && (
            <div className="search-footer">
              <span>
                公式カタログ {catalog.length}件 · {manufacturers.length}メーカー
              </span>
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
          )}{" "}
        </>
      )}
      {busy && <LoadingOverlay label="画像・商品情報を読み込み中…" />}
    </Dialog>
  );
}
