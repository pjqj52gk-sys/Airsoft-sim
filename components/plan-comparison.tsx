"use client";
import { useState } from "react";
import Dialog from "./dialog";
import BuildPreview from "./build-preview";
import { comparisonBounds } from "@/lib/comparison";
import {
  alignComparisonPlans,
  planTotal,
  type ComparisonPlans,
  type PlanKey,
} from "@/lib/comparison-plans";
import { saveBuild } from "@/lib/storage";
import { shoppingSummary } from "@/lib/shopping";
import "./plan-comparison.css";
const yen = (value: number) => `¥${value.toLocaleString("ja-JP")}`;
export default function PlanComparison({
  plans,
  close,
  edit,
}: {
  plans: ComparisonPlans;
  close: () => void;
  edit: (key: PlanKey) => void;
}) {
  const [mode, setMode] = useState("split");
  const [shown, setShown] = useState<PlanKey>(plans.active);
  const [align, setAlign] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [a, b] = align
    ? alignComparisonPlans(plans.a, plans.b)
    : [plans.a, plans.b];
  const viewBox = comparisonBounds([a, b]);
  const difference = planTotal(plans.b) - planTotal(plans.a);
  const additionalDifference =
    shoppingSummary(plans.b).plannedTotal -
    shoppingSummary(plans.a).plannedTotal;
  const rows =
    mode === "split"
      ? [
          { key: "a" as const, project: a },
          { key: "b" as const, project: b },
        ]
      : [{ key: shown, project: shown === "a" ? a : b }];
  return (
    <Dialog
      wide
      label="カスタムを比較"
      close={() => {
        if (!saving) close();
      }}
    >
      <div className="plan-comparison">
        <div className="plan-heading">
          <h2>カスタムを比較</h2>
          <button
            className="icon-button"
            aria-label="閉じる"
            disabled={saving}
            onClick={close}
          >
            ×
          </button>
        </div>
        <div className="plan-controls">
          <div className="shelf-tabs" aria-label="比較の表示方法">
            <button
              className={`mini-button ${mode === "split" ? "toggled" : ""}`}
              aria-pressed={mode === "split"}
              onClick={() => setMode("split")}
            >
              左右に並べる
            </button>
            <button
              className={`mini-button ${mode === "switch" ? "toggled" : ""}`}
              aria-pressed={mode === "switch"}
              onClick={() => setMode("switch")}
            >
              切り替えて比較
            </button>
          </div>
          <label>
            <input
              type="checkbox"
              checked={align}
              onChange={(e) => setAlign(e.target.checked)}
            />{" "}
            本体の位置を揃える
          </label>
        </div>
        {mode === "switch" && (
          <div className="shelf-tabs" aria-label="表示する案">
            {(["a", "b"] as const).map((key) => (
              <button
                key={key}
                aria-pressed={shown === key}
                className={`mini-button ${shown === key ? "toggled" : ""}`}
                onClick={() => setShown(key)}
              >
                案{key.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        <div className={`plan-previews ${mode === "split" ? "is-split" : ""}`}>
          {rows.map(({ key, project }) => (
            <article key={key}>
              <span className="plan-label">
                案{key.toUpperCase()}
                {plans.active === key ? " · 編集中" : ""}
              </span>
              <h3>{project.name}</h3>
              <BuildPreview project={project} viewBox={viewBox} />
              <div className="plan-price">
                <span>合計</span>
                <strong>{yen(planTotal(project))}</strong>
              </div>
              <div className="plan-price">
                <span>購入予定のみ</span>
                <strong>{yen(shoppingSummary(project).plannedTotal)}</strong>
              </div>
              {shoppingSummary(project).missingPrices > 0 && (
                <p className="hint">
                  購入予定に価格未登録 {shoppingSummary(project).missingPrices}
                  点
                </p>
              )}
              <button
                className="button secondary"
                disabled={saving}
                onClick={() => edit(key)}
              >
                案{key.toUpperCase()}を編集
              </button>
            </article>
          ))}
        </div>
        <div className="plan-difference" role="status">
          <div>
            {additionalDifference === 0
              ? "追加費用の差なし"
              : `購入予定：案Bは案Aより ${additionalDifference > 0 ? "+" : "−"}${yen(Math.abs(additionalDifference))}`}
          </div>
          <small>
            構成全体：
            {difference === 0
              ? "価格差なし"
              : `案Bは案Aより ${difference > 0 ? "+" : "−"}${yen(Math.abs(difference))}`}
          </small>
        </div>
        <p className="hint">
          同じ縮尺で表示。合計は登録価格の合計です（本体・非表示パーツを含む）。未登録は0円として計算します。
        </p>
        <div className="plan-footer">
          <button
            className="button primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setMessage("");
              try {
                const savedAt = Date.now();
                await Promise.all([
                  saveBuild({ id: plans.idA, savedAt, project: plans.a }),
                  saveBuild({ id: plans.idB, savedAt, project: plans.b }),
                ]);
                setMessage("案A・案Bをライブラリに保存しました。");
              } catch {
                setMessage(
                  "保存できませんでした。空き容量を確認してください。",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "保存中…" : "A・Bをライブラリへ保存"}
          </button>
        </div>
        {message && <p role="status">{message}</p>}
      </div>
    </Dialog>
  );
}
