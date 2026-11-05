"use client";
import { useState } from "react";
import type { Layer } from "@/lib/project";
import { collectionLayer } from "@/lib/collection-layer";
import type { CollectionState } from "./use-collection";
import LoadingOverlay from "./loading-overlay";
import PurchaseLink from "./purchase-link";
import WishButton from "./wish-button";
import "./collection-panel.css";
export default function CollectionPanel({
  collection,
  filter = "all",
  scope,
  add,
}: {
  collection: CollectionState;
  filter?: "all" | "owned" | "wishlist";
  scope?: "guns" | "parts";
  add: (layer: Layer, reuse?: boolean) => void | Promise<unknown>;
}) {
  const [query, setQuery] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState("");
  const rows = collection.all.filter(
    (item) =>
      (filter !== "owned" || item.owned) &&
      (filter !== "wishlist" || item.wished) &&
      (!scope ||
        (scope === "guns"
          ? item.category === "本体"
          : item.category !== "本体")) &&
      [item.name, item.category]
        .join(" ")
        .normalize("NFKC")
        .toLowerCase()
        .includes(query.normalize("NFKC").trim().toLowerCase()),
  );
  return (
    <section
      className="collection-panel"
      aria-label={
        filter === "owned"
          ? "所有物一覧"
          : filter === "wishlist"
            ? "ほしいものリスト"
            : "登録済みアイテム"
      }
    >
      <label className="field-label">
        登録済みアイテムを検索
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="collection-summary">
        <span>{rows.length}点</span>
        <strong>
          合計 ¥
          {rows
            .reduce((sum, item) => sum + item.price, 0)
            .toLocaleString("ja-JP")}
        </strong>
      </div>
      {(error || collection.error) && (
        <p role="alert">{error || collection.error}</p>
      )}
      {!collection.ready && <p role="status">読み込み中…</p>}
      <div className="shelf-grid">
        {rows.map((item) => (
          <article
            className="shelf-card collection-card"
            key={item.id}
            aria-label={item.name}
          >
            <div className="shelf-part-image">
              {item.image ? (
                <img src={item.image} alt={item.name} loading="lazy" />
              ) : (
                <span>画像未登録</span>
              )}
            </div>
            <h3>
              <PurchaseLink url={item.url} label={item.name} />
            </h3>
            <p>
              {item.category}
              {item.layer ? ` · ${item.layer.mm.toFixed(1)} mm` : ""}
            </p>
            <strong>¥{item.price.toLocaleString("ja-JP")}</strong>
            <div className="collection-status">
              <label>
                <input
                  type="checkbox"
                  checked={item.owned}
                  disabled={collection.pending}
                  onChange={(e) =>
                    void collection.setOwned(item, e.target.checked)
                  }
                />
                所有済み
              </label>
              <WishButton item={item} wishlist={collection} />
            </div>
            <button
              className="mini-button toggled"
              disabled={!!busy || !item.image}
              onClick={async () => {
                setBusy(item.id);
                setError("");
                try {
                  const result = await collectionLayer(item);
                  await add(result.layer, result.reuse);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "追加できません。");
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === item.id
                ? "画像を読み込み中…"
                : item.category === "本体"
                  ? "本体として追加"
                  : "ビルドに追加"}
            </button>
            {item.layer && (
              <button
                className="text-button"
                onClick={() => {
                  const blob = new Blob(
                    [
                      JSON.stringify({
                        type: "part_data",
                        part: { ...item.layer, owned: item.owned },
                      }),
                    ],
                    { type: "application/json" },
                  );
                  import("@/lib/project").then(({ download }) =>
                    download(blob, `${item.name}.json`),
                  );
                }}
              >
                JSON保存
              </button>
            )}
          </article>
        ))}
      </div>
      {collection.ready && !rows.length && (
        <p className="shelf-empty">
          {filter === "owned"
            ? "「所有済み」を選ぶと、ここに表示されます。"
            : filter === "wishlist"
              ? "「ほしいものリストに追加」で、ここに表示されます。"
              : "該当する登録アイテムはありません。"}
        </p>
      )}
      {busy && <LoadingOverlay label="登録済みの画像を読み込み中…" />}
    </section>
  );
}
