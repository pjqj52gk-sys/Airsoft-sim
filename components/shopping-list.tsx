"use client";
import { useState } from "react";
import type { Project } from "@/lib/project";
import { shoppingSummary } from "@/lib/shopping";
import PurchaseLink from "./purchase-link";
import type { WishlistState } from "./use-wishlist";
import "./shopping-list.css";
const yen = (value: number) => `¥${value.toLocaleString("ja-JP")}`;
export default function ShoppingList({
  project,
  select,
  setOwned,
  disabled,
  wishlist,
  openWishlist,
}: {
  project: Project;
  select: (id: string) => void;
  setOwned: (id: string, owned: boolean) => void;
  disabled: boolean;
  wishlist: WishlistState;
  openWishlist: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const summary = shoppingSummary(project);
  const items = project.layers.filter(
    (layer) =>
      filter === "all" || (layer.owned === true) === (filter === "owned"),
  );
  return (
    <div className="shopping-list">
      <div className="shopping-budget">
        <span>カスタム総額</span>
        <strong>{yen(summary.total)}</strong>
        <small>{project.layers.length}点</small>
      </div>
      <button className="mini-button full-width" onClick={openWishlist}>
        ほしいものリスト（{wishlist.items.length}）
      </button>
      {wishlist.error && <p role="alert">{wishlist.error}</p>}
      <div className="shopping-filter" aria-label="アイテムの表示">
        {[
          { id: "all", label: "すべて" },
          { id: "unowned", label: "未所有" },
          { id: "owned", label: "所有済み" },
        ].map(({ id, label }) => (
          <button
            key={id}
            className={`mini-button ${filter === id ? "toggled" : ""}`}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {items.map((layer) => (
        <div className="shopping-entry" key={layer.id}>
          <div className="shopping-row">
            <span>
              <PurchaseLink url={layer.url} label={layer.name} />
              <small>
                {layer.category}
                {!layer.visible ? " · 非表示" : ""}
              </small>
            </span>
            <strong>{layer.price ? yen(layer.price) : "価格未登録"}</strong>
          </div>
          <div className="shopping-entry-actions">
            <button
              className={`mini-button ${wishlist.has(layer) ? "toggled" : ""}`}
              disabled={disabled || !wishlist.ready || wishlist.pending}
              onClick={() =>
                void wishlist.toggle({
                  name: layer.name,
                  url: layer.url,
                  price: layer.price,
                  category: layer.category,
                  image: layer.src,
                })
              }
            >
              {wishlist.has(layer) ? "✓ 追加済み" : "ほしいものリストに追加"}
            </button>
            <button
              className="text-button"
              aria-label={`編集：${layer.name}`}
              onClick={() => select(layer.id)}
            >
              編集
            </button>
            <label>
              <input
                type="checkbox"
                checked={layer.owned === true}
                disabled={disabled}
                onChange={(e) => setOwned(layer.id, e.target.checked)}
              />
              所有済み
            </label>
          </div>
        </div>
      ))}
      {!items.length && <p className="hint">該当するアイテムはありません。</p>}
      <p className="hint">
        本体・非表示パーツを含みます。価格未登録は合計に含まれません。
      </p>
    </div>
  );
}
