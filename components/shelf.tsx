"use client";
import { useEffect, useState } from "react";
import type { Project, Layer } from "@/lib/project";
import { download, uid } from "@/lib/project";
import { listBuilds, saveBuild, deleteBuild } from "@/lib/storage";
import type { StoredBuild } from "@/lib/storage";
import { collectionInput, applyCollectionOwnership } from "@/lib/collection";
import Dialog from "./dialog";
import CollectionPanel from "./collection-panel";
import type { CollectionState } from "./use-collection";
import CostBreakdown from "./cost-breakdown";
import Icon from "./icon";
import BuildPreview from "./build-preview";
import { comparisonBounds } from "@/lib/comparison";
type Tab = "builds" | "parts" | "owned" | "wishlist";
type Props = {
  project: Project;
  layer?: Layer;
  initialTab: Tab;
  wishlist: CollectionState;
  close: () => void;
  load: (project: Project) => void;
  add: (layer: Layer, reuse?: boolean) => void | Promise<unknown>;
};
const date = (time: number) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
const total = (p: Project) =>
  p.layers.reduce((sum, l) => sum + l.price, 0).toLocaleString("ja-JP");
export default function Shelf({
  project,
  layer,
  initialTab,
  wishlist,
  close,
  load,
  add,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab),
    [buildName, setBuildName] = useState(project.name),
    [builds, setBuilds] = useState<StoredBuild[]>([]),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState<string | null>(null),
    [details, setDetails] = useState<Project | null>(null),
    [comparison, setComparison] = useState<StoredBuild | null>(null);
  async function refresh() {
    setBuilds((await listBuilds()).sort((a, b) => b.savedAt - a.savedAt));
  }
  useEffect(() => {
    let active = true;
    listBuilds()
      .then((rows) => {
        if (active) setBuilds(rows.sort((a, b) => b.savedAt - a.savedAt));
      })
      .catch(() => {
        if (active) setMessage("ライブラリを読み込めません。");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function action(fn: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await refresh();
      setMessage(success);
    } catch {
      setMessage("保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  const exportJson = (value: unknown, name: string) =>
    download(
      new Blob([JSON.stringify(value)], { type: "application/json" }),
      name + ".json",
    );
  const viewBox = comparison
    ? comparisonBounds([project, comparison.project])
    : undefined;
  return (
    <Dialog
      wide
      label="ビルド・パーツライブラリ"
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="shelf">
        <button
          className="modal-close icon-button"
          aria-label="閉じる"
          disabled={busy}
          onClick={close}
        >
          <Icon name="close" />
        </button>
        <h2>ライブラリ</h2>
        <div
          className="shelf-tabs"
          role="tablist"
          aria-label="ライブラリの表示"
        >
          {(
            [
              { id: "builds", label: "保存したビルド", count: builds.length },
              {
                id: "parts",
                label: "登録済みアイテム",
                count: wishlist.all.length,
              },
              {
                id: "owned",
                label: "所有物一覧",
                count: wishlist.owned.length,
              },
              {
                id: "wishlist",
                label: "ほしいものリスト",
                count: wishlist.items.length,
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              className={"mini-button " + (tab === item.id ? "toggled" : "")}
              onClick={() => {
                setTab(item.id);
                setComparison(null);
              }}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>
        {message && <p role="status">{message}</p>}
        {tab !== "builds" ? (
          <>
            {tab === "parts" && layer && (
              <button
                className="mini-button"
                disabled={wishlist.pending}
                onClick={async () => {
                  if (await wishlist.register(collectionInput(layer)))
                    setMessage("選択アイテムを登録しました。");
                }}
              >
                選択アイテムを登録・更新
              </button>
            )}
            <CollectionPanel
              collection={wishlist}
              filter={tab === "parts" ? "all" : tab}
              add={add}
            />
          </>
        ) : (
          <>
            <div className="shelf-save">
              <label className="field-label">
                保存名
                <input
                  value={buildName}
                  maxLength={100}
                  onChange={(e) => setBuildName(e.target.value)}
                />
              </label>
              <button
                className="button primary"
                disabled={busy || !project.layers.length}
                onClick={() =>
                  void action(async () => {
                    await saveBuild({
                      id: uid(),
                      project: {
                        ...project,
                        name: buildName.trim() || project.name,
                      },
                      savedAt: Date.now(),
                    });
                  }, "現在のビルドを保存しました。")
                }
              >
                現在のビルドを別名保存
              </button>
            </div>
            {comparison && (
              <section className="comparison">
                <div className="section-label">
                  同じ縮尺で外観を比較
                  <button
                    className="text-button"
                    onClick={() => setComparison(null)}
                  >
                    比較を閉じる
                  </button>
                </div>
                <div className="comparison-grid">
                  {[
                    { p: project, label: "編集中" },
                    { p: comparison.project, label: "保存済み" },
                  ].map(({ p, label }) => (
                    <article key={label}>
                      <span className="eyebrow">{label}</span>
                      <h3>{p.name}</h3>
                      <BuildPreview project={p} viewBox={viewBox} />
                      <p>
                        パーツ {Math.max(0, p.layers.length - 1)} 点 · 総額 ¥
                        {total(p)}
                      </p>
                    </article>
                  ))}
                </div>
                <p className="hint">
                  入力した実寸で縮尺を統一しています。撮影角度・余白により見え方は異なります。
                </p>
              </section>
            )}
            <div className="shelf-grid">
              {builds.map((build) => (
                <article className="shelf-card" key={build.id}>
                  <BuildPreview project={build.project} />
                  <h3>{build.project.name}</h3>
                  <p>
                    {date(build.savedAt)} · パーツ{" "}
                    {Math.max(0, build.project.layers.length - 1)} 点
                  </p>
                  <p className="shelf-build-total">
                    総額 ¥{total(build.project)}
                  </p>
                  <div className="shelf-card-actions">
                    <button
                      className="mini-button"
                      onClick={() => setDetails(build.project)}
                      aria-label={`詳細：${build.project.name}`}
                    >
                      詳細
                    </button>
                    <button
                      className="mini-button"
                      disabled={busy}
                      onClick={() => load(build.project)}
                    >
                      開く
                    </button>
                    <button
                      className="mini-button"
                      disabled={busy || !project.layers.length}
                      onClick={() => setComparison(build)}
                    >
                      比較
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        exportJson(build.project, build.project.name)
                      }
                    >
                      JSON保存
                    </button>
                  </div>
                  <button
                    className="text-button delete-saved"
                    disabled={busy}
                    onClick={() => {
                      if (confirm === build.id) {
                        void action(
                          () => deleteBuild(build.id),
                          "保存ビルドを削除しました。",
                        );
                        setConfirm(null);
                        if (comparison?.id === build.id) setComparison(null);
                      } else setConfirm(build.id);
                    }}
                  >
                    {confirm === build.id
                      ? "もう一度押すと削除"
                      : "保存ビルドを削除"}
                  </button>
                </article>
              ))}
            </div>
            {!busy && !builds.length && (
              <p className="shelf-empty">まだ保存したビルドはありません。</p>
            )}
          </>
        )}
        {details && (
          <Dialog wide label="カスタムの内訳" close={() => setDetails(null)}>
            <button
              className="modal-close icon-button"
              aria-label="内訳を閉じる"
              onClick={() => setDetails(null)}
            >
              <Icon name="close" />
            </button>
            <CostBreakdown
              project={applyCollectionOwnership(details, wishlist.all)}
            />
          </Dialog>
        )}
        <p className="hint">
          登録済みアイテムの中から「所有済み」「ほしいもの」を選べます。このブラウザーに保存されます。
        </p>
      </div>
    </Dialog>
  );
}
