"use client";
import WishButton from "./wish-button";
import type { WishlistState } from "./use-wishlist";
import { purchaseLink } from "@/lib/commerce";
import PurchaseLink from "./purchase-link";
import { useEffect, useRef, useState } from "react";
import type { RakutenItem, RakutenResults } from "@/lib/rakuten";
import { readImage, uid, type Layer } from "@/lib/project";
import type { ShopProduct } from "@/lib/shop-product";
import CategoryBrowser from "./category-browser";
import catalogData from "@/lib/parts-catalog.json";
import {
  matchCatalog,
  resolveCatalogMatch,
  type CatalogProduct,
} from "@/lib/catalog-match";
import { catalogImageUrl } from "@/lib/catalog-image";
import {
  mergeDimensions,
  combinedReferenceLength,
  referenceLengthOptions,
  type ReferenceLengthOption,
  type SourcedDimension,
  type ProductDimension,
} from "@/lib/product-specs";
import { partCategory } from "@/lib/part-categories";
const catalog = catalogData as CatalogProduct[];

export default function RakutenSearch({
  attachLink,
  wishlist,
  add,
  onBusy,
  initialScope = "parts",
  provider = "rakuten",
}: {
  attachLink?: (url: string) => void;
  wishlist?: WishlistState;
  add: (layer: Layer) => Promise<void>;
  onBusy: (busy: boolean) => void;
  initialScope?: "parts" | "guns";
  provider?: "rakuten" | "yahoo";
}) {
  const marketName = provider === "yahoo" ? "Yahoo!ショッピング" : "楽天";
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("standard");
  const [scope, setScope] = useState<string>(initialScope);
  const [result, setResult] = useState<RakutenResults | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [submitted, setSubmitted] = useState({
    query: "",
    sort: "standard",
    category: "",
    scope: "parts",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<RakutenItem | null>(null);
  const [selectedLayerCategory, setSelectedLayerCategory] = useState("その他");
  const [images, setImages] = useState<string[]>([]);
  const [photo, setPhoto] = useState(0);
  const [matchMethod, setMatchMethod] = useState("name");
  const [dimensions, setDimensions] = useState<SourcedDimension[]>([]);
  const [selectedOfficial, setSelectedOfficial] =
    useState<CatalogProduct | null>(null);
  const [photoSource, setPhotoSource] = useState<"official" | "shop">("shop");
  const [imageBusy, setImageBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [resolution, setResolution] = useState("");
  const [imageDetails, setImageDetails] = useState<
    NonNullable<ShopProduct["imageDetails"]>
  >([]);
  const [lowResolution, setLowResolution] = useState(false);
  const [referenceMm, setReferenceMm] = useState<number | undefined>();
  const [referenceOptions, setReferenceOptions] = useState<
    ReferenceLengthOption[]
  >([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function loadingImage(value: boolean) {
    setImageBusy(value);
    onBusy(value);
  }
  async function chooseImages(item: RakutenItem, preferOfficial = true) {
    const matched = matchCatalog(
      item.name,
      submitted.scope === "guns"
        ? catalog.filter((p) => p.category === "本体")
        : catalog,
      item.identifiers,
    );
    const official = matched?.product || null;
    const officialDimensions: ProductDimension[] = (
      official?.dimensions || []
    ).map((d) => ({ ...d, kind: "product" }));
    const retailDimensions = item.dimensions || [];
    setMatchMethod(matched?.method || "name");
    setDimensions(mergeDimensions(officialDimensions, retailDimensions));
    setSelectedOfficial(official);
    setPhotoSource("shop");
    setSelected(item);
    setSelectedLayerCategory(
      official?.category ||
        partCategory(submitted.category)?.layerCategory ||
        (submitted.scope === "guns" ? "本体" : "その他"),
    );
    setImages(item.images?.length ? item.images : [item.image]);
    setPhoto(0);
    setResolution("");
    setImageDetails([]);
    setLowResolution(false);
    setReferenceMm(
      combinedReferenceLength(
        officialDimensions,
        retailDimensions,
        official?.lengthMm,
      ),
    );
    setReferenceOptions(
      referenceLengthOptions(
        officialDimensions,
        retailDimensions,
        official?.lengthMm,
      ),
    );
    setError("");
    setNotice("検索画像（小）");
    if (preferOfficial && official?.images.length) {
      setImages(
        official.images.map((_, index) => catalogImageUrl(official, index)),
      );
      setPhotoSource("official");
      setNotice("公式カタログの写真");
    }
    if (!item.productUrl) return;
    loadingImage(true);
    const current = new AbortController();
    controller.current = current;
    try {
      const response = await fetch("/api/shop-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.productUrl }),
        signal: current.signal,
      });
      if (!response.ok) throw new Error();
      const product: ShopProduct = await response.json();
      const chosenMatch = resolveCatalogMatch(
        item,
        product,
        submitted.scope === "guns"
          ? catalog.filter((p) => p.category === "本体")
          : catalog,
      );
      const chosenOfficial = chosenMatch?.product;
      const chosenDimensions = (chosenOfficial?.dimensions || []).map((d) => ({
        ...d,
        kind: "product" as const,
      }));
      const allRetail = [...retailDimensions, ...product.dimensions];
      setDimensions(mergeDimensions(chosenDimensions, allRetail));
      setReferenceMm(
        combinedReferenceLength(
          chosenDimensions,
          allRetail,
          chosenOfficial?.lengthMm,
        ),
      );
      setReferenceOptions(
        referenceLengthOptions(
          chosenDimensions,
          allRetail,
          chosenOfficial?.lengthMm,
        ),
      );
      if (chosenOfficial) {
        setSelectedOfficial(chosenOfficial);
        setMatchMethod(chosenMatch?.method || "name");
        setSelectedLayerCategory(chosenOfficial.category);
        if (preferOfficial && chosenOfficial.images.length) {
          setImages(
            chosenOfficial.images.map((_, i) =>
              catalogImageUrl(chosenOfficial, i),
            ),
          );
          setPhotoSource("official");
          setNotice("公式カタログの写真");
          return;
        }
      } else {
        setSelectedOfficial(null);
        setPhotoSource("shop");
      }
      if (!product.images.length) throw new Error();
      setImages(product.images);
      setImageDetails(product.imageDetails || []);
      setNotice(
        product.imageDetails?.length
          ? "商品ページの写真（大きい順）"
          : "商品ページの写真",
      );
      setResolution("");
    } catch {
      if (!current.signal.aborted)
        setNotice(
          preferOfficial && official?.images.length
            ? "公式カタログの写真（販売店の追加情報は未取得）"
            : "商品ページの写真は取得できません。検索画像（小）を選べます。",
        );
    } finally {
      if (!current.signal.aborted) loadingImage(false);
    }
  }
  async function importImage() {
    if (!selected || !images[photo] || imageBusy) return;
    loadingImage(true);
    setError("");
    const current = new AbortController();
    controller.current = current;
    try {
      const response =
        photoSource === "official"
          ? await fetch(images[photo], { signal: current.signal })
          : await fetch("/api/shop-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: images[photo] }),
              signal: current.signal,
            });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "画像を取得できません。");
      }
      const blob = await response.blob();
      const image = await readImage(
        new File([blob], "rakuten-part", { type: blob.type }),
      );
      await add({
        ...image,
        id: uid(),
        name: selected.name,
        mm: selectedLayerCategory === "本体" ? 800 : 150,
        referenceMm,
        referenceOptions,
        x: 430,
        y: 160,
        rotation: 0,
        flip: false,
        visible: true,
        attachedToBase: false,
        price: selected.price,
        url: selected.url,
        linkOrigin: "search",
        category: selectedLayerCategory,
      });
    } catch (e) {
      if (!current.signal.aborted)
        setError(e instanceof Error ? e.message : "画像を追加できません。");
    } finally {
      if (!current.signal.aborted) loadingImage(false);
    }
  }
  async function search(
    page = 1,
    keyword = query,
    order = sort,
    category = activeCategory,
    searchScope = scope,
  ) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    onBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(
        `/api/${provider}/search?${new URLSearchParams({ q: keyword, sort: order, page: String(page), category, scope: searchScope })}`,
        { signal: current.signal },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "検索できませんでした。");
      setResult(data);
      setSubmitted({
        query: keyword,
        sort: order,
        category,
        scope: searchScope,
      });
    } catch (e) {
      if (!current.signal.aborted)
        setError(e instanceof Error ? e.message : "検索できませんでした。");
    } finally {
      if (!current.signal.aborted) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  return (
    <div className="rakuten-search">
      {selected ? (
        <section
          className="rakuten-photo-picker"
          aria-label={`${marketName}の商品画像を選択`}
        >
          <button
            className="mini-button"
            disabled={imageBusy}
            onClick={() => {
              setSelected(null);
              setError("");
            }}
          >
            ← 検索結果に戻る
          </button>
          <h3>
            <PurchaseLink
              url={selected.url}
              label={selected.name}
              sponsored={selected.sponsored}
            />
          </h3>
          {selectedOfficial && (
            <div className="catalog-match-info">
              <a
                href={selectedOfficial.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {matchMethod === "jan"
                  ? "JAN一致"
                  : matchMethod === "model"
                    ? "型番一致"
                    : "公式候補"}
                ：{selectedOfficial.manufacturer} {selectedOfficial.name} ↗
              </a>
              {!selectedOfficial.dimensions.length && (
                <small>公式寸法は未掲載</small>
              )}
              <div
                className="photo-source-tabs"
                role="group"
                aria-label="画像の取得元"
              >
                <button
                  className={`mini-button ${photoSource === "official" ? "toggled" : ""}`}
                  aria-pressed={photoSource === "official"}
                  disabled={imageBusy || !selectedOfficial.images.length}
                  onClick={() => void chooseImages(selected)}
                >
                  公式写真 ({selectedOfficial.images.length})
                </button>
                <button
                  className={`mini-button ${photoSource === "shop" ? "toggled" : ""}`}
                  aria-pressed={photoSource === "shop"}
                  disabled={imageBusy}
                  onClick={() => void chooseImages(selected, false)}
                >
                  販売店の写真
                </button>
              </div>
            </div>
          )}
          {dimensions.length > 0 && (
            <dl className="part-dimensions sourced-dimensions">
              {dimensions.map((d, i) => (
                <div key={i}>
                  <dt>
                    {d.label}
                    {d.kind === "package"
                      ? "（梱包）"
                      : d.kind === "compatibility"
                        ? "（対応情報）"
                        : ""}
                  </dt>
                  <dd>
                    {d.value}{" "}
                    <small>
                      {d.source === "official"
                        ? "公式"
                        : `${marketName}・販売店`}
                      {d.conflict && "／値に差あり"}
                    </small>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {imageBusy && <p role="status">画像を取得中…</p>}
          {error && (
            <p className="editor-error" role="alert">
              {error}
            </p>
          )}
          <div className="shop-photo-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={images[photo]}
              src={images[photo]}
              alt={`${selected.name}の選択中の写真`}
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
              onError={() => {
                setResolution("プレビューを読み込めません");
                if (photoSource === "official")
                  setError(
                    "公式写真を読み込めません。「販売店の写真」から選べます。",
                  );
              }}
            />
          </div>
          <p className="hint">
            {notice}
            {resolution && ` · ${resolution}`}
          </p>
          {lowResolution && (
            <p className="hint">
              小さい画像です。別の写真を選ぶと鮮明になる場合があります。
            </p>
          )}
          {images.length > 1 && (
            <div className="shop-photo-list">
              {images.map((image, index) => (
                <button
                  key={image}
                  className={index === photo ? "toggled" : ""}
                  aria-label={`写真 ${index + 1}`}
                  aria-pressed={index === photo}
                  disabled={imageBusy}
                  onClick={() => {
                    setPhoto(index);
                    setResolution("");
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt={`写真 ${index + 1}`} />
                  {imageDetails.find((d) => d.url === image) && (
                    <small>
                      {imageDetails.find((d) => d.url === image)!.width} ×{" "}
                      {imageDetails.find((d) => d.url === image)!.height}
                    </small>
                  )}
                </button>
              ))}
            </div>
          )}
          <WishButton
            wishlist={wishlist}
            item={{
              name: selected.name,
              url: selected.url,
              linkOrigin: "search",
              price: selected.price,
              category: selectedLayerCategory,
              image: images[photo],
            }}
          />
          <button
            className="button primary"
            disabled={imageBusy}
            onClick={() => void importImage()}
          >
            {selectedLayerCategory === "本体"
              ? "この画像を本体に使う"
              : "この画像を追加"}
          </button>
        </section>
      ) : (
        <>
          <CategoryBrowser
            initialGroup={initialScope === "guns" ? "guns" : "optics"}
            active={activeCategory}
            disabled={busy}
            choose={(category) => {
              setActiveCategory(category.id);
              setQuery(category.keyword);
              const categoryScope = category.genreId ? "guns" : "parts";
              setScope(categoryScope);
              void search(
                1,
                category.keyword,
                sort,
                category.id,
                categoryScope,
              );
            }}
          />
          <form
            className="part-search-controls"
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <input
              type="search"
              aria-label={`${marketName}の商品名`}
              placeholder="エアガン用品の商品名・メーカー"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveCategory("");
              }}
              required
              maxLength={128}
            />
            <select
              aria-label="検索対象"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setActiveCategory("");
              }}
            >
              <option value="parts">パーツ・用品全般</option>
              <option value="guns">エアガン本体</option>
            </select>
            <select
              aria-label={`${marketName}の並び順`}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="standard">標準</option>
              <option value="+itemPrice">価格が安い順</option>
              <option value="-itemPrice">価格が高い順</option>
            </select>
            <button className="button primary" disabled={busy || !query.trim()}>
              {busy ? "検索中…" : "検索"}
            </button>
          </form>
          <p className="hint">
            検索対象：{scope === "guns" ? "エアガン本体" : "サバゲー・トイガン"}
          </p>
          {error && <p role="alert">{error}</p>}
          <div aria-live="polite">
            {result && (
              <p>
                {partCategory(submitted.category) &&
                  `${partCategory(submitted.category)!.group} › ${partCategory(submitted.category)!.label} · `}
                {result.count.toLocaleString()}件
                {result.items.length === 0 && "：商品が見つかりません。"}
              </p>
            )}
          </div>
          {result && (
            <div className="rakuten-grid">
              {result.items.map((item) => {
                const matched = matchCatalog(
                  item.name,
                  submitted.scope === "guns"
                    ? catalog.filter((p) => p.category === "本体")
                    : catalog,
                  item.identifiers,
                );
                const official = matched?.product;
                return (
                  <article className="rakuten-card" key={item.id}>
                    <a
                      href={purchaseLink(item.url)?.href}
                      target="_blank"
                      rel={
                        purchaseLink(item.url)?.sponsored
                          ? "sponsored noopener noreferrer"
                          : "noopener noreferrer"
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.name}
                        width={128}
                        height={128}
                        loading="lazy"
                      />
                      <span>{item.name}</span>
                    </a>
                    <WishButton
                      wishlist={wishlist}
                      item={{
                        name: item.name,
                        url: item.url,
                        linkOrigin: "search",
                        price: item.price,
                        category:
                          submitted.scope === "guns" ? "本体" : "その他",
                        image: item.image,
                      }}
                    />
                    <button
                      className="button primary"
                      onClick={() => void chooseImages(item)}
                    >
                      画像を選んで追加
                    </button>
                    {official && (
                      <div className="catalog-match-summary">
                        <span>
                          {matched?.method === "jan"
                            ? "JAN一致・公式データあり"
                            : matched?.method === "model"
                              ? "型番一致・公式データあり"
                              : "公式データ候補あり"}
                        </span>
                        {official.dimensions.length > 0 && (
                          <small>
                            {official.dimensions
                              .map((d) => `${d.label} ${d.value}`)
                              .join(" · ")}
                          </small>
                        )}
                      </div>
                    )}
                    {(!official || !official.dimensions.length) &&
                      (item.dimensions || []).some(
                        (d) => d.kind === "product",
                      ) && (
                        <small className="retail-dimension-summary">
                          {item.dimensions
                            .filter((d) => d.kind === "product")
                            .slice(0, 2)
                            .map((d) => `${d.label} ${d.value}`)
                            .join(" · ")}
                          （{marketName}）
                        </small>
                      )}
                    <small>{item.shop}</small>
                    <strong>¥{item.price.toLocaleString()}</strong>

                    {attachLink && (
                      <button
                        className="mini-button"
                        onClick={() => attachLink(item.url)}
                      >
                        選択中のパーツにリンクのみ設定
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          {result && result.pageCount > 1 && (
            <div className="rakuten-pages">
              <button
                className="mini-button"
                disabled={busy || result.page <= 1}
                onClick={() =>
                  void search(
                    result.page - 1,
                    submitted.query,
                    submitted.sort,
                    submitted.category,
                    submitted.scope,
                  )
                }
              >
                前へ
              </button>
              <span>
                {result.page} / {result.pageCount}
              </span>
              <button
                className="mini-button"
                disabled={busy || result.page >= result.pageCount}
                onClick={() =>
                  void search(
                    result.page + 1,
                    submitted.query,
                    submitted.sort,
                    submitted.category,
                    submitted.scope,
                  )
                }
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}
      {provider === "yahoo" ? (
        <span style={{ margin: "15px 15px 15px 15px" }}>
          <a href="https://developer.yahoo.co.jp/sitemap/">
            Webサービス by Yahoo! JAPAN
          </a>
        </span>
      ) : (
        <p className="rakuten-credit">
          <a href="https://developers.rakuten.com/" target="_blank">
            Supported by Rakuten Developers
          </a>
        </p>
      )}
    </div>
  );
}
