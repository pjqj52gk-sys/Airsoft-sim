"use client";
import { useState } from "react";
import type { Project } from "@/lib/project";
import { shoppingSummary } from "@/lib/shopping";
import PurchaseLink from "./purchase-link";
import "./shopping-list.css";
const yen = (value: number) => `¥${value.toLocaleString("ja-JP")}`;
export default function ShoppingList({
  project,
  select,
  setOwned,
  disabled,
}: {
  project: Project;
  select: (id: string) => void;
  setOwned: (id: string, owned: boolean) => void;
  disabled: boolean;
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
        <span>購入予定の合計</span>
        <strong>{yen(summary.plannedTotal)}</strong>
        <small>
          {summary.plannedCount}点
          {summary.missingPrices
            ? ` · 価格未登録 ${summary.missingPrices}点`
            : ""}
        </small>
      </div>
      <div className="shopping-filter" aria-label="購入リストの表示">
        {[
          { id: "all", label: "すべて" },
          { id: "planned", label: "購入予定" },
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
          <button
            className="shopping-row"
            onClick={() => select(layer.id)}
            aria-label={`編集：${layer.name}`}
          >
            <span>
              {layer.name}
              <small>
                {layer.category}
                {!layer.visible ? " · 非表示" : ""}
              </small>
            </span>
            <strong>{layer.price ? yen(layer.price) : "価格未登録"}</strong>
          </button>
          <div className="shopping-entry-actions">
            <button
              className={`mini-button ${layer.owned ? "toggled" : ""}`}
              aria-label={`所有状況：${layer.name}`}
              aria-pressed={layer.owned === true}
              disabled={disabled}
              onClick={() => setOwned(layer.id, layer.owned !== true)}
            >
              {layer.owned ? "✓ 所有済み" : "購入予定"}
            </button>
            <PurchaseLink
              url={layer.url}
              label={layer.owned ? "商品ページ" : "購入先を見る"}
            />
          </div>
        </div>
      ))}
      {!items.length && (
        <p className="hint">
          {project.layers.length
            ? "該当するアイテムはありません。"
            : "本体やパーツを追加してください。"}
        </p>
      )}
      <div className="shopping-total">
        <span>構成全体</span>
        <strong>{yen(summary.total)}</strong>
      </div>
      <p className="hint">
        本体・非表示パーツを含みます。価格未登録は合計に含まれません。所有状況はこのブラウザーに保存されます。
      </p>
    </div>
  );
}
