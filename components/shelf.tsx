"use client";
import { useEffect, useState } from "react";
import type { Project, Layer } from "@/lib/project";
import { download, uid } from "@/lib/project";
import {
  listParts,
  listBuilds,
  savePart,
  saveBuild,
  deletePart,
  deleteBuild,
} from "@/lib/storage";
import type { StoredBuild, StoredPart } from "@/lib/storage";
import Dialog from "./dialog";
import Icon from "./icon";
import BuildPreview from "./build-preview";
import { comparisonBounds } from "@/lib/comparison";
type Props = {
  project: Project;
  layer?: Layer;
  initialTab: "builds" | "parts";
  close: () => void;
  load: (project: Project) => void;
  add: (layer: Layer) => void;
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
  p.layers
    .slice(1)
    .reduce((sum, l) => sum + l.price, 0)
    .toLocaleString("ja-JP");
export default function Shelf({
  project,
  layer,
  initialTab,
  close,
  load,
  add,
}: Props) {
  const [tab, setTab] = useState(initialTab);
  const [buildName, setBuildName] = useState(project.name);
  const [parts, setParts] = useState<StoredPart[]>([]);
  const [builds, setBuilds] = useState<StoredBuild[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [comparison, setComparison] = useState<StoredBuild | null>(null);
  async function refresh() {
    const [p, b] = await Promise.all([listParts(), listBuilds()]);
    setParts(p.sort((a, b) => b.savedAt - a.savedAt));
    setBuilds(b.sort((a, b) => b.savedAt - a.savedAt));
  }
  useEffect(() => {
    refresh()
      .catch(() => setMessage("ライブラリを読み込めませんでした。"))
      .finally(() => setBusy(false));
  }, []);
  async function action(fn: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await refresh();
      setMessage(success);
    } catch {
      setMessage(
        "保存先にアクセスできません。空き容量を確認し、JSONをバックアップしてください。",
      );
    } finally {
      setBusy(false);
    }
  }
  const exportJson = (value: unknown, name: string) =>
    download(
      new Blob([JSON.stringify(value)], { type: "application/json" }),
      `${name}.json`,
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
        <span className="eyebrow">YOUR COLLECTION</span>
        <h2>ビルド・パーツライブラリ</h2>
        <div className="shelf-tabs">
          <button
            className={`mini-button ${tab === "builds" ? "toggled" : ""}`}
            onClick={() => {
              setTab("builds");
              setComparison(null);
            }}
          >
            保存したビルド ({builds.length})
          </button>
          <button
            className={`mini-button ${tab === "parts" ? "toggled" : ""}`}
            onClick={() => {
              setTab("parts");
              setComparison(null);
            }}
          >
            登録したパーツ ({parts.length})
          </button>
        </div>
        <div className="shelf-save">
          {tab === "builds" && (
            <label className="field-label">
              保存名
              <input
                value={buildName}
                maxLength={100}
                onChange={(e) => setBuildName(e.target.value)}
              />
            </label>
          )}
          <button
            className="button primary"
            disabled={
              busy || (tab === "builds" ? !project.layers.length : !layer)
            }
            onClick={() =>
              action(
                async () => {
                  if (tab === "builds")
                    await saveBuild({
                      id: uid(),
                      project: {
                        ...project,
                        name: buildName.trim() || project.name,
                      },
                      savedAt: Date.now(),
                    });
                  else if (layer)
                    await savePart({
                      id: layer.id,
                      layer,
                      savedAt: Date.now(),
                    });
                },
                tab === "builds"
                  ? "現在のビルドを保存しました。"
                  : "選択パーツを登録しました。同じアイテムの再登録は更新になります。",
              )
            }
          >
            {tab === "builds"
              ? "現在のビルドを別名保存"
              : "選択アイテムをパーツ登録"}
          </button>
          <p className="hint">
            {tab === "builds"
              ? `「${project.name}」を独立したスナップショットとして保存します。`
              : "画像・実寸・価格・商品URLを再利用できます。登録するアイテムを先に選択してください。"}
          </p>
        </div>
        {message && (
          <p role="status" className="shelf-message">
            {message}
          </p>
        )}
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
                    パーツ {Math.max(0, p.layers.length - 1)} 点 · ¥{total(p)}
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
          {tab === "builds"
            ? builds.map((build) => (
                <article className="shelf-card" key={build.id}>
                  <BuildPreview project={build.project} />
                  <h3>{build.project.name}</h3>
                  <p>
                    {date(build.savedAt)} · パーツ{" "}
                    {Math.max(0, build.project.layers.length - 1)} 点
                  </p>
                  <div className="shelf-card-actions">
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
              ))
            : parts.map((part) => (
                <article className="shelf-card" key={part.id}>
                  <div className="shelf-part-image">
                    <img src={part.layer.src} alt={part.layer.name} />
                  </div>
                  <h3>{part.layer.name}</h3>
                  <p>
                    {part.layer.category} · {part.layer.mm.toFixed(1)} mm · ¥
                    {part.layer.price.toLocaleString("ja-JP")}
                  </p>
                  <div className="shelf-card-actions">
                    <button
                      className="mini-button"
                      disabled={busy || project.layers.length >= 60}
                      onClick={() => add(part.layer)}
                    >
                      ビルドに追加
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        exportJson(
                          { type: "part_data", part: part.layer },
                          part.layer.name,
                        )
                      }
                    >
                      JSON保存
                    </button>
                  </div>
                  <button
                    className="text-button delete-saved"
                    disabled={busy}
                    onClick={() => {
                      if (confirm === part.id) {
                        void action(
                          () => deletePart(part.id),
                          "登録パーツを削除しました。",
                        );
                        setConfirm(null);
                      } else setConfirm(part.id);
                    }}
                  >
                    {confirm === part.id
                      ? "もう一度押すと削除"
                      : "登録パーツを削除"}
                  </button>
                </article>
              ))}
        </div>
        {!busy && !(tab === "builds" ? builds.length : parts.length) && (
          <div className="shelf-empty">
            {tab === "builds"
              ? "まだビルドが保存されていません。上のボタンから現在の状態を保存できます。"
              : "まだパーツが登録されていません。選択アイテムを登録して使い回せます。"}
          </div>
        )}
        <p className="hint">
          ライブラリはこのブラウザー・URL内に保存されます。JSON保存でバックアップできます。ビルドを開く前の編集状態は「元に戻す」で復元できます。
        </p>
      </div>
    </Dialog>
  );
}
