"use client";
import { canEditLink, protectLinkPatch } from "@/lib/link-policy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { mapConcurrent } from "@/lib/async-control";
import Icon from "./icon";
import Stage from "./stage";
import Dialog from "./dialog";
import ImageEditor from "./image-editor";
import LoadingOverlay from "./loading-overlay";
import type { EditMode } from "./image-editor";
import Shelf from "./shelf";
import ProductLinkField from "./product-link-field";
import PurchaseLink from "./purchase-link";
import {
  applyCollectionOwnership,
  collectionInput,
  collectionKey,
} from "@/lib/collection";
import useWishlist from "./use-wishlist";
import ShoppingList from "./shopping-list";
import { purchaseLink, monetization } from "@/lib/commerce";
import useFileDrop from "./use-file-drop";
import type { DropTarget } from "./use-file-drop";
import { updateLayer } from "@/lib/attachments";
const PartSearch = dynamic(() => import("./part-search"));
import PerspectiveWorkbench from "./perspective-workbench";
import LogoCleanup from "./logo-cleanup";
import PlanComparison from "./plan-comparison";
import {
  createComparisonPlans,
  capturePlan,
  parseComparisonPlans,
  type ComparisonPlans,
  type PlanKey,
} from "@/lib/comparison-plans";
import {
  download,
  emptyProject,
  exportPng,
  Layer,
  parseProject,
  Project,
  readImage,
  removeBackground,
  sampleProject,
  uid,
} from "@/lib/project";
import {
  readDraft,
  writeDraft,
  saveBuild,
  readComparison,
  writeWorkspace,
} from "@/lib/storage";
import {
  prepareAddedLayer,
  trimTransparentLayer,
  restoreLayerImage,
} from "@/lib/layer-image";
const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
export default function Studio() {
  const wishlist = useWishlist();
  const [storedProject, setProject] = useState<Project>(emptyProject);
  const project = useMemo(
    () => applyCollectionOwnership(storedProject, wishlist.all),
    [storedProject, wishlist.all],
  );
  const [plans, setPlans] = useState<ComparisonPlans | null>(null);
  const [logoCleanup, setLogoCleanup] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const livePlans = plans ? capturePlan(plans, project) : null;
  function switchPlan(key: PlanKey) {
    if (!livePlans || key === livePlans.active) {
      setComparisonOpen(false);
      return;
    }
    setPlans({ ...livePlans, active: key });
    setProject(livePlans[key]);
    setHistory({ past: [], future: [] });
    setSelected(null);
    setCompare(false);
    setComparisonOpen(false);
  }
  function openComparison() {
    if (!plans) {
      const next = createComparisonPlans(project, uid(), uid());
      setPlans(next);
      setProject(next.a);
    }
    setComparisonOpen(true);
  }
  const current = useRef(project);
  current.current = project;
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [searchSource, setSearchSource] = useState<"rakuten" | "saved">(
    "rakuten",
  );
  const [search, setSearch] = useState<"parts" | "guns" | null>(null);
  const [addDialog, setAddDialog] = useState<"base" | "part" | null>(null);
  const [grid, setGrid] = useState(true);
  const [compare, setCompare] = useState(false);
  const [tab, setTab] = useState("layers");
  const [history, setHistory] = useState<{
    past: Project[];
    future: Project[];
  }>({ past: [], future: [] });
  const [ready, setReady] = useState(false);
  const [draftRecoveryFailed, setDraftRecoveryFailed] = useState(false);
  const [saved, setSaved] = useState("準備中");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ownershipSaving, setOwnershipSaving] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [help, setHelp] = useState(false);
  const [clearDialog, setClearDialog] = useState(false);
  const [tolerance, setTolerance] = useState(28);
  const [editor, setEditor] = useState<EditMode | null>(null);
  const [shelf, setShelf] = useState<
    "builds" | "parts" | "wishlist" | "owned" | null
  >(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const dragStart = useRef<Project | null>(null);
  const addTarget = useRef<"base" | "part">("part");
  const layer = project.layers.find((l) => l.id === selected);
  const notify = (text: string) => setMessage(text);
  const fileDrop = useFileDrop({
    enabled:
      ready &&
      !busy &&
      !editor &&
      !shelf &&
      !search &&
      !comparisonOpen &&
      !logoCleanup &&
      !addDialog &&
      !help &&
      !clearDialog &&
      !saveDialog,
    add: (files, target) => {
      void addFiles(files, target);
    },
    unavailable: () =>
      notify(
        busy || !ready
          ? "読み込みが終わってから画像をドロップしてください。"
          : "開いているダイアログを閉じてから画像をドロップしてください。",
      ),
  });
  useEffect(() => {
    let cancelled = false;
    Promise.all([readDraft(), readComparison()])
      .then(async ([value, comparison]) => {
        if (value) {
          const draft = await parseProject(value);
          if (!cancelled) {
            setProject(draft);
            setSelected(draft.layers[0]?.id ?? null);
          }
        }
        try {
          const restored = await parseComparisonPlans(comparison);
          if (!cancelled) setPlans(restored);
        } catch {
          if (!cancelled)
            notify(
              "比較案を復元できませんでした。編集データは保持しています。",
            );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDraftRecoveryFailed(true);
          setSaved("復元できません");
          setMessage(
            "自動保存データを復元できません。JSONファイルから読み込めます。",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!ready || (draftRecoveryFailed && project === emptyProject)) return;
    let active = true;
    const t = setTimeout(() => {
      setSaved("保存中…");
      writeWorkspace(project, plans ? capturePlan(plans, project) : null)
        .then(() => {
          if (active) setSaved("このブラウザーに保存済み");
        })
        .catch(() => {
          if (!active) return;
          setSaved("自動保存できません");
          notify(
            "自動保存に失敗しました。「保存」でJSONをダウンロードしてください。",
          );
        });
    }, 700);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [project, plans, ready, draftRecoveryFailed]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(t);
  }, [message]);
  const commit = useCallback((next: Project, previous = current.current) => {
    setHistory((h) => ({ past: [...h.past.slice(-19), previous], future: [] }));
    setProject(next);
  }, []);
  const update = (id: string, updates: Partial<Layer>) => {
    const target = project.layers.find((layer) => layer.id === id);
    if (!target) return;
    commit({
      ...project,
      layers: updateLayer(
        project.layers,
        id,
        protectLinkPatch(target, updates),
      ),
    });
  };
  async function changeOwnership(id: string, owned: boolean) {
    const target = current.current.layers.find((layer) => layer.id === id);
    if (!target) return;
    setOwnershipSaving(true);
    try {
      if (!(await wishlist.setOwned(collectionInput(target), owned)))
        notify("所有状況を保存できませんでした。");
    } finally {
      setOwnershipSaving(false);
    }
  }
  const seeded = useRef(new Set<string>());
  useEffect(() => {
    if (!ready || !wishlist.ready || wishlist.pending) return;
    const missing = project.layers.filter(
      (layer) =>
        !wishlist.get(collectionInput(layer)) &&
        !seeded.current.has(collectionKey(collectionInput(layer))),
    );
    if (!missing.length) return;
    for (const item of missing)
      seeded.current.add(collectionKey(collectionInput(item)));
    void wishlist.seed(missing);
  }, [
    ready,
    project,
    wishlist.ready,
    wishlist.pending,
    wishlist.get,
    wishlist.seed,
  ]);
  const undo = () => {
    if (!history.past.length) return;
    setProject(history.past[history.past.length - 1]);
    setHistory({
      past: history.past.slice(0, -1),
      future: [project, ...history.future],
    });
  };
  const redo = () => {
    if (!history.future.length) return;
    setProject(history.future[0]);
    setHistory({
      past: [...history.past, project],
      future: history.future.slice(1),
    });
  };
  const remove = () => {
    if (!layer) return;
    commit({
      ...project,
      layers: project.layers
        .filter((l) => l.id !== layer.id)
        .map((l) =>
          project.layers[0]?.id === layer.id
            ? { ...l, attachedToBase: false }
            : l,
        ),
    });
    setSelected(null);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("input, textarea, select, [contenteditable]") ||
        help ||
        clearDialog ||
        saveDialog ||
        editor ||
        shelf ||
        search ||
        addDialog ||
        comparisonOpen ||
        logoCleanup ||
        busy
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Escape") setSelected(null);
      if (!layer || compare) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
      const offsets: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (offsets[e.key]) {
        e.preventDefault();
        const [x, y] = offsets[e.key];
        update(layer.id, {
          x: layer.x + x * (e.shiftKey ? 10 : 1),
          y: layer.y + y * (e.shiftKey ? 10 : 1),
        });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function addFiles(
    files: FileList | File[],
    target: DropTarget = addTarget.current,
  ) {
    if (busy || !ready || !files.length) return;
    setBusy(true);
    try {
      const list = Array.from(files);
      if (list.length === 1 && list[0].name.toLowerCase().endsWith(".json")) {
        await importProject(list[0]);
        return;
      }
      if (target === "base" && list.length !== 1)
        throw new Error("本体エリアには画像を1枚ずつドロップしてください。");
      const replacingBase = target === "base" && project.layers.length > 0;
      if (project.layers.length + (replacingBase ? 0 : list.length) > 60)
        throw new Error("レイヤーは60件まで追加できます。");
      const prepared = await mapConcurrent(
        list,
        3,
        async (file, i): Promise<Layer> => {
          const image = await readImage(file);
          const base = target === "base" || (!project.layers.length && i === 0);
          const original: Layer = {
            ...image,
            id: uid(),
            name: file.name.replace(/\.[^.]+$/, ""),
            mm: base ? 800 : 150,
            x: base ? 120 : 430 + i * 25,
            y: base ? 190 : 160 + i * 25,
            rotation: 0,
            flip: false,
            visible: true,
            attachedToBase: !base,
            price: 0,
            url: "",
            linkOrigin: "upload",
            category: base ? "本体" : "その他",
          };
          return prepareAddedLayer(original, base, tolerance);
        },
      );
      const images = prepared;
      if (replacingBase) {
        const base = project.layers[0];
        const replacement = {
          ...base,
          src: images[0].src,
          originalSrc: images[0].originalSrc,
          originalFrame: images[0].originalFrame,
          width: images[0].width,
          height: images[0].height,
          name: images[0].name,
        };
        commit({
          ...project,
          layers: [replacement, ...project.layers.slice(1)],
        });
        setSelected(base.id);
      } else {
        commit({ ...project, layers: [...project.layers, ...images] });
        setSelected(images[images.length - 1].id);
      }
      setTab("layers");
      notify(
        replacingBase
          ? "本体画像を入れ替えました。実寸を確認してください。"
          : `${images.length}枚の画像を追加しました。実寸を入力してサイズを合わせてください。`,
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "画像の追加に失敗しました。",
      );
    } finally {
      setBusy(false);
      addTarget.current = "part";
    }
  }
  async function importProject(file: File) {
    setBusy(true);
    try {
      if (file.size > 80 * 1024 * 1024)
        throw new Error("プロジェクトファイルは80MB以下にしてください。");
      const data = JSON.parse(await file.text());
      let invalidLinks = 0;
      const invalidLink = () => {
        invalidLinks++;
      };
      if (data?.type === "part_data") {
        if (project.layers.length >= 60)
          throw new Error("レイヤーは60件まで追加できます。");
        const imported = await parseProject(
          {
            version: 1,
            baseImg: data.part,
            parts: [],
          },
          invalidLink,
        );
        const part = await prepareAddedLayer(
          {
            ...imported.layers[0],
            attachedToBase: false,
            category: project.layers.length ? "その他" : "本体",
            x: project.layers.length ? 430 : 120,
            y: project.layers.length ? 160 : 190,
          },
          !project.layers.length,
          tolerance,
        );
        commit({ ...project, layers: [...project.layers, part] });
        setSelected(part.id);
        notify(
          invalidLinks
            ? `パーツを追加しました。未対応の商品リンク${invalidLinks}件を無効にしました。`
            : "パーツデータを追加しました。",
        );
      } else {
        const next = await parseProject(data, invalidLink);
        commit(next);
        setSelected(next.layers[0]?.id ?? null);
        setZoom(1);
        notify(
          invalidLinks
            ? `読み込みました。未対応の商品リンク${invalidLinks}件を無効にしました。`
            : "プロジェクトを読み込みました。",
        );
      }
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "プロジェクトを読み込めませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }
  function choose(target: "base" | "part") {
    addTarget.current = target;
    if (fileInput.current) {
      fileInput.current.multiple = target !== "base";
      fileInput.current.click();
    }
  }
  function duplicate() {
    if (!layer || project.layers.length >= 60) return;
    const copy = {
      ...layer,
      id: uid(),
      name: `${layer.name} のコピー`,
      x: layer.x + 20,
      y: layer.y + 20,
      attachedToBase: true,
      category: layer.id === project.layers[0]?.id ? "その他" : layer.category,
    };
    commit({ ...project, layers: [...project.layers, copy] });
    setSelected(copy.id);
  }
  function reorder(direction: number) {
    if (!layer) return;
    const index = project.layers.indexOf(layer);
    const to = index + direction;
    if (to < 1 || index === 0 || to >= project.layers.length) return;
    const layers = [...project.layers];
    [layers[index], layers[to]] = [layers[to], layers[index]];
    commit({ ...project, layers });
  }
  async function background() {
    if (!layer) return;
    const target = { ...layer, ...restoreLayerImage(layer) };
    setBusy(true);
    try {
      const src = await removeBackground(target.src, tolerance);
      const trimmed = await trimTransparentLayer({
        ...target,
        src,
        originalSrc: target.originalSrc || target.src,
      });
      update(target.id, trimmed);
      notify("画像の外周につながる背景色を透過しました。");
    } catch {
      notify("背景を透過できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  async function trimMargins() {
    if (!layer || busy) return;
    setBusy(true);
    try {
      const trimmed = await trimTransparentLayer(layer);
      if (trimmed.src === layer.src)
        notify("詰められる透明な余白はありません。");
      else {
        update(layer.id, trimmed);
        notify("透明な余白を詰めました。");
      }
    } catch {
      notify("余白を処理できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  async function png() {
    setBusy(true);
    try {
      await exportPng(project);
      notify("透過PNGを書き出しました。");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "書き出しに失敗しました。",
      );
    } finally {
      setBusy(false);
    }
  }
  function demo() {
    commit(sampleProject());
    setSelected(null);
    setZoom(1);
  }
  function save() {
    download(
      new Blob([JSON.stringify(project)], { type: "application/json" }),
      `${project.name || "airsoft-project"}.json`,
    );
    notify("画像を含むJSONを保存しました。");
  }
  async function applyImage(updates: Partial<Layer>) {
    if (!layer) return;
    const correcting = editor === "perspective";
    const next = updates.src
      ? await trimTransparentLayer({ ...layer, ...updates })
      : updates;
    update(layer.id, next);
    setEditor(correcting ? "measure" : null);
    notify(
      correcting
        ? "補正しました。続けて実寸を合わせてください。"
        : "画像の編集を適用しました。",
    );
  }
  async function openBuild(savedProject: Project) {
    setBusy(true);
    try {
      const restored = await parseProject(savedProject);
      commit(restored);
      setSelected(restored.layers[0]?.id ?? null);
      setZoom(1);
      setShelf(null);
      notify("保存ビルドを開きました。前の状態は「元に戻す」で復元できます。");
    } catch {
      notify("保存ビルドを開けませんでした。");
    } finally {
      setBusy(false);
    }
  }
  async function addStoredPart(stored: Layer, reuse = false) {
    if (project.layers.length >= 60) {
      notify("レイヤーは60件まで追加できます。");
      return false;
    }
    setBusy(true);
    try {
      const validated = await parseProject({
        version: 2,
        name: "part",
        layers: [stored],
      });
      const isBase = project.layers.length === 0;
      const original: Layer = {
        ...validated.layers[0],
        id: uid(),
        x: isBase ? 120 : 430,
        y: isBase ? 190 : 160,
        rotation: 0,
        visible: true,
        attachedToBase: false,
        category: isBase
          ? "本体"
          : stored.category === "本体"
            ? "その他"
            : stored.category,
      };
      const part = reuse
        ? { ...original, attachedToBase: !isBase }
        : await prepareAddedLayer(original, isBase, tolerance);
      await wishlist.register(collectionInput(part));
      commit({ ...project, layers: [...project.layers, part] });
      setSelected(part.id);
      setShelf(null);
      setTab("layers");
      notify("パーツを追加しました。");
      return true;
    } catch {
      notify("登録パーツを読み込めませんでした。");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function addSearchPart(part: Layer, reuse = false) {
    if (part.category === "本体") {
      const validated = await parseProject({
        version: 2,
        name: "base",
        layers: [part],
      });
      const base = project.layers[0];
      const original: Layer = {
        ...validated.layers[0],
        id: base?.id || uid(),
        category: "本体",
        x: base?.x ?? 120,
        y: base?.y ?? 190,
        mm: reuse ? part.mm : (base?.mm ?? 800),
        rotation: base?.rotation ?? 0,
        flip: base?.flip ?? false,
        visible: true,
        attachedToBase: false,
      };
      const replacement = reuse
        ? original
        : await prepareAddedLayer(original, true, tolerance);
      await wishlist.register(collectionInput(replacement));
      commit({
        ...project,
        layers: [replacement, ...project.layers.slice(1)],
      });
      setSelected(replacement.id);
      setTab("layers");
      notify(
        base
          ? "本体画像を入れ替えました。実寸を確認してください。"
          : "本体画像を追加しました。",
      );
    } else if (!(await addStoredPart(part, reuse)))
      throw new Error("追加できません。レイヤー数と画像を確認してください。");
    setSearch(null);
    setShelf(null);
  }
  const button = (
    name: string,
    title: string,
    onClick: () => void,
    disabled = false,
  ) => (
    <button
      className="icon-button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled || busy}
    >
      <Icon name={name} />
    </button>
  );
  return (
    <main className="studio" aria-busy={busy || !ready} {...fileDrop.handlers}>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={projectInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) void importProject(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            a<span>+</span>
          </span>
          <span>
            AIRSOFT<span className="brand-sub">CUSTOM STUDIO</span>
          </span>
        </Link>
        <div className="header-divider" />
        <div className="project-heading">
          <input
            aria-label="プロジェクト名"
            value={project.name}
            maxLength={100}
            onChange={(e) => commit({ ...project, name: e.target.value })}
          />
        </div>
        <div className="header-actions">
          <button
            className="button secondary"
            aria-label="みんなのカスタム"
            title="みんなのカスタム"
            disabled={!ready || busy || draftRecoveryFailed}
            onClick={async () => {
              setBusy(true);
              try {
                await writeDraft(current.current);
                window.location.assign("/community");
              } catch {
                notify(
                  "カスタムを保存できませんでした。保存し直してからお試しください。",
                );
                setBusy(false);
              }
            }}
          >
            <Icon name="users" />
            みんなのカスタム
          </button>
          <button
            className="button secondary"
            onClick={() => setShelf("builds")}
            disabled={!ready || busy}
          >
            <Icon name="layers" />
            ライブラリ
          </button>
          <span className="save-state">
            <span className="status-dot" />
            {saved}
          </span>
          <button
            className="button secondary"
            onClick={() => projectInput.current?.click()}
            disabled={!ready || busy}
          >
            <Icon name="folder" />
            開く
          </button>
          <button
            className="button primary"
            onClick={() => setSaveDialog(true)}
            disabled={!ready || busy}
          >
            <Icon name="download" />
            保存
          </button>
        </div>
      </header>
      <div className="workspace-layout">
        <aside className="library panel">
          <div className="panel-title">
            <div>
              <h2>レイヤー</h2>
            </div>
            <span className="count">
              {project.layers.length.toString().padStart(2, "0")}
            </span>
          </div>
          <div className="tabs">
            <button
              className={tab === "layers" ? "active" : ""}
              onClick={() => setTab("layers")}
            >
              <Icon name="layers" size={15} />
              レイヤー
            </button>
            <button
              className={tab === "list" ? "active" : ""}
              onClick={() => setTab("list")}
            >
              アイテム
            </button>
          </div>
          <div className="library-content">
            {tab === "layers" ? (
              <>
                <div className="section-label">
                  ベースのエアガン <span>01</span>
                </div>
                {project.layers[0] ? (
                  <button
                    className={`base-card ${selected === project.layers[0].id ? "chosen" : ""} ${fileDrop.target === "base" ? "drop-active" : ""}`}
                    data-drop-target="base"
                    onClick={() => setSelected(project.layers[0].id)}
                  >
                    <div className="base-preview">
                      <img src={project.layers[0].src} alt="本体プレビュー" />
                    </div>
                    <span>{project.layers[0].name}</span>
                    <small>
                      {project.layers[0].mm} mm <span>BASE MODEL</span>
                    </small>
                  </button>
                ) : (
                  <button
                    className={`upload-card ${fileDrop.target === "base" ? "drop-active" : ""}`}
                    data-drop-target="base"
                    onClick={() => setAddDialog("base")}
                    disabled={!ready || busy}
                  >
                    <Icon name="upload" />
                    <strong>本体を追加</strong>
                    <small>ここに画像をドロップしても追加できます</small>
                  </button>
                )}
                <div className="section-label parts-label">
                  パーツ{" "}
                  <span>
                    {Math.max(0, project.layers.length - 1)
                      .toString()
                      .padStart(2, "0")}
                  </span>
                </div>
                <div className="layer-list">
                  {project.layers
                    .slice(1)
                    .reverse()
                    .map((l) => (
                      <div
                        className={`layer-row ${selected === l.id ? "chosen" : ""} ${!l.visible ? "hidden-layer" : ""}`}
                        key={l.id}
                      >
                        <button
                          className="layer-select"
                          onClick={() => setSelected(l.id)}
                        >
                          <span className="part-thumbnail">
                            <img src={l.src} alt="" />
                          </span>
                          <span>
                            <strong>{l.name}</strong>
                            <small>
                              {l.category} · {Math.round(l.mm * 10) / 10} mm
                            </small>
                          </span>
                        </button>
                        {button(
                          "eye",
                          l.visible ? `${l.name}を非表示` : `${l.name}を表示`,
                          () => update(l.id, { visible: !l.visible }),
                        )}
                      </div>
                    ))}
                </div>
                {layer && (
                  <div
                    className="layer-actions"
                    role="toolbar"
                    aria-label="レイヤーの操作"
                  >
                    {button(
                      "copy",
                      "複製",
                      duplicate,
                      project.layers.length >= 60,
                    )}
                    {button(
                      "up",
                      "前面へ",
                      () => reorder(1),
                      project.layers.indexOf(layer) === 0 ||
                        project.layers.indexOf(layer) ===
                          project.layers.length - 1,
                    )}
                    {button(
                      "down",
                      "背面へ",
                      () => reorder(-1),
                      project.layers.indexOf(layer) <= 1,
                    )}
                    {button("eye", "表示を切り替え", () =>
                      update(layer.id, { visible: !layer.visible }),
                    )}
                    {button("trash", "選択アイテムを削除", remove)}
                  </div>
                )}
                <button
                  className={`add-part ${fileDrop.target === "part" ? "drop-active" : ""}`}
                  data-drop-target="part"
                  onClick={() => setAddDialog("part")}
                  disabled={!ready || busy}
                >
                  <Icon name="plus" />
                  パーツを追加
                </button>
              </>
            ) : (
              <ShoppingList
                wishlist={wishlist}
                openWishlist={() => setShelf("wishlist")}
                project={project}
                setOwned={changeOwnership}
                disabled={!ready || busy || ownershipSaving}
              />
            )}
          </div>
        </aside>
        <section className="workspace">
          <div className="workspace-toolbar">
            <div className="toolbar-group">
              {button("undo", "元に戻す (Ctrl+Z)", undo, !history.past.length)}
              {button(
                "redo",
                "やり直す (Ctrl+Shift+Z)",
                redo,
                !history.future.length,
              )}
              <span className="tool-divider" />
              {button("grid", "グリッドの表示切り替え", () => setGrid(!grid))}
              {button("fit", "表示をリセット", () => setZoom(1))}
            </div>
            <div className="view-tabs">
              <button
                onClick={openComparison}
                disabled={!ready || busy || !project.layers.length}
              >
                案A・Bを比較
              </button>
              <button
                className={!compare ? "active" : ""}
                onClick={() => setCompare(false)}
              >
                カスタム
              </button>
              <button
                className={compare ? "active" : ""}
                onClick={() => setCompare(true)}
              >
                本体のみ
              </button>
            </div>
            <button className="help-button" onClick={() => setHelp(true)}>
              <Icon name="info" size={16} />
              使い方
            </button>
          </div>
          {plans && (
            <div className="plan-shortcuts" aria-label="比較案を編集">
              {(["a", "b"] as const).map((key) => (
                <button
                  key={key}
                  className={`mini-button ${plans.active === key ? "toggled" : ""}`}
                  aria-pressed={plans.active === key}
                  disabled={!ready || busy}
                  onClick={() => switchPlan(key)}
                >
                  案{key.toUpperCase()}
                  {plans.active === key ? "を編集中" : "を編集"}
                </button>
              ))}
              <button
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  if (!livePlans) return;
                  setBusy(true);
                  try {
                    const savedAt = Date.now();
                    await Promise.all([
                      saveBuild({
                        id: livePlans.idA,
                        savedAt,
                        project: livePlans.a,
                      }),
                      saveBuild({
                        id: livePlans.idB,
                        savedAt,
                        project: livePlans.b,
                      }),
                    ]);
                    setPlans(null);
                    notify("両案をライブラリに保存して比較を終了しました。");
                  } catch {
                    notify("保存できませんでした。比較案は保持しています。");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                比較を保存して終了
              </button>
            </div>
          )}
          <div className="canvas-wrap">
            <Stage
              layers={project.layers}
              selected={selected}
              zoom={zoom}
              grid={grid}
              compare={compare}
              select={setSelected}
              wheel={(factor) =>
                setZoom((z) => Math.min(2.5, Math.max(0.4, z * factor)))
              }
              move={(id, x, y, done) => {
                if (!dragStart.current) dragStart.current = current.current;
                const next = {
                  ...current.current,
                  layers: updateLayer(current.current.layers, id, { x, y }),
                };
                current.current = next;
                if (done) {
                  commit(next, dragStart.current);
                  dragStart.current = null;
                } else setProject(next);
              }}
            />
            {!project.layers.length && (
              <div className="empty-state">
                <h1>本体を追加</h1>
                <p>画像をドロップしても追加できます</p>
                <button
                  className="button primary"
                  onClick={() => setAddDialog("base")}
                  disabled={!ready || busy}
                >
                  <Icon name="plus" />
                  本体を追加
                </button>
                <button
                  className="demo-button"
                  onClick={demo}
                  disabled={!ready || busy}
                >
                  デモのビルドを試す <Icon name="arrow" size={14} />
                </button>
                <span className="file-types">
                  PNG, JPG, WEBP, GIF · 15MBまで
                </span>
              </div>
            )}
            {fileDrop.target && (
              <div className="file-drop-feedback" role="status">
                <Icon name="upload" size={38} />
                <strong>
                  {fileDrop.target === "base"
                    ? project.layers.length
                      ? "本体画像を入れ替える"
                      : "本体画像を追加する"
                    : project.layers.length
                      ? "パーツ画像を追加する"
                      : "画像を離してビルドをはじめる"}
                </strong>
                <p>
                  {fileDrop.target === "base"
                    ? "本体エリアに画像を1枚ドロップ"
                    : project.layers.length
                      ? "複数の画像をまとめてドロップできます"
                      : "最初の1枚を本体、残りをパーツとして追加します"}
                </p>
              </div>
            )}
            <div className="zoom-controls">
              <button
                onClick={() =>
                  setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(1)))
                }
                aria-label="ズームアウト"
              >
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                onClick={() =>
                  setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(1)))
                }
                aria-label="ズームイン"
              >
                +
              </button>
            </div>
          </div>
        </section>
        <aside className="inspector panel">
          <div className="panel-title">
            <div>
              <h2>選択アイテム</h2>
            </div>
            <Icon name="layers" />
          </div>
          {layer ? (
            <div className="inspector-content" key={layer.id}>
              <div className="selected-preview">
                <img src={layer.src} alt={layer.name} />
                <span>{layer.category}</span>
              </div>
              <label className="field-label">
                アイテム名
                <input
                  value={layer.name}
                  maxLength={100}
                  onChange={(e) => update(layer.id, { name: e.target.value })}
                />
              </label>
              <label className="field-label">
                カテゴリー
                <select
                  value={layer.category}
                  onChange={(e) =>
                    update(layer.id, { category: e.target.value })
                  }
                >
                  {[
                    "本体",
                    "光学機器",
                    "外装",
                    "グリップ",
                    "ストック",
                    "その他",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <div className="inspector-section">
                <div className="section-label">
                  サイズと配置 <span>mm</span>
                </div>
                <NumberField
                  label="画像の横幅（実寸）"
                  value={layer.mm}
                  min={1}
                  max={5000}
                  unit="mm"
                  onChange={(mm) => update(layer.id, { mm })}
                />
                <button
                  className="mini-button full-width"
                  onClick={() => setEditor("measure")}
                >
                  2点で実寸合わせ
                </button>

                <div className="field-grid">
                  <NumberField
                    label="X"
                    value={layer.x}
                    unit="mm"
                    onChange={(x) => update(layer.id, { x })}
                  />
                  <NumberField
                    label="Y"
                    value={layer.y}
                    unit="mm"
                    onChange={(y) => update(layer.id, { y })}
                  />
                </div>
                <NumberField
                  label="回転"
                  value={layer.rotation}
                  min={-360}
                  max={360}
                  unit="°"
                  onChange={(rotation) => update(layer.id, { rotation })}
                />
                <div className="action-row">
                  <button
                    className={`mini-button ${layer.flip ? "toggled" : ""}`}
                    onClick={() => update(layer.id, { flip: !layer.flip })}
                  >
                    <Icon name="flip" size={15} />
                    左右反転
                  </button>
                  {layer.id !== project.layers[0]?.id && (
                    <button
                      className={`mini-button ${layer.attachedToBase ? "toggled" : ""}`}
                      aria-pressed={!!layer.attachedToBase}
                      onClick={() =>
                        update(layer.id, {
                          attachedToBase: !layer.attachedToBase,
                        })
                      }
                      title="本体の移動・回転・反転に追従"
                    >
                      <Icon name="lock" size={15} />
                      {layer.attachedToBase ? "本体から外す" : "本体に固定"}
                    </button>
                  )}
                </div>
              </div>
              <div className="inspector-section">
                <div className="section-label">画像を整える</div>
                <div className="edit-tool-grid">
                  <button
                    className="mini-button"
                    onClick={() => setEditor("erase")}
                  >
                    範囲を消す
                  </button>
                  <button
                    className="mini-button"
                    onClick={() => setEditor("perspective")}
                  >
                    パース補正
                  </button>
                </div>
                <button
                  className="mini-button full-width"
                  onClick={() => setEditor("background")}
                >
                  背景透過をプレビュー
                </button>
                <label className="range-label">
                  背景色の許容差 <span>{tolerance}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                  />
                </label>
                <button
                  className="mini-button full-width"
                  onClick={background}
                  disabled={busy}
                >
                  <Icon name="wand" size={15} />
                  外周の背景を透過
                </button>
                <button
                  className="mini-button full-width"
                  onClick={trimMargins}
                  disabled={busy}
                >
                  透明な余白を詰める
                </button>
                <button
                  className="mini-button full-width"
                  disabled={busy}
                  onClick={() => setLogoCleanup(true)}
                >
                  余白のロゴ・文字を除去
                </button>
                {layer.originalSrc && (
                  <button
                    className="text-button"
                    onClick={() => update(layer.id, restoreLayerImage(layer))}
                  >
                    元の画像に戻す
                  </button>
                )}
              </div>
              <div className="inspector-section">
                <div className="section-label">購入メモ</div>
                <button
                  className="mini-button full-width"
                  onClick={async () => {
                    try {
                      if (!(await wishlist.register(collectionInput(layer))))
                        throw Error();
                      notify(
                        "調整済みパーツを保存しました。「登録パーツ」から再利用できます。",
                      );
                    } catch {
                      notify("パーツを保存できませんでした。");
                    }
                  }}
                >
                  調整済みパーツを保存
                </button>
                <label className="field-label">
                  所有状況
                  <select
                    value={layer.owned ? "owned" : "planned"}
                    disabled={busy || ownershipSaving}
                    onChange={(e) =>
                      changeOwnership(layer.id, e.target.value === "owned")
                    }
                  >
                    <option value="planned">未所有</option>
                    <option value="owned">所有済み</option>
                  </select>
                </label>
                <NumberField
                  label="参考価格"
                  value={layer.price}
                  min={0}
                  max={10000000}
                  unit="円"
                  onChange={(price) => update(layer.id, { price })}
                />
                {canEditLink(layer) && (
                  <ProductLinkField
                    key={layer.id + "-" + layer.url}
                    url={layer.url}
                    save={async (url) => {
                      if (
                        !(await wishlist.register(
                          collectionInput({ ...layer, url }),
                        ))
                      )
                        return false;
                      update(layer.id, { url });
                      notify("商品リンクを保存しました。");
                      return true;
                    }}
                  />
                )}
                <PurchaseLink url={layer.url} label={layer.name} />
                <button
                  className="mini-button full-width"
                  disabled={!wishlist.ready || wishlist.pending}
                  onClick={() => void wishlist.toggle(collectionInput(layer))}
                >
                  {wishlist.has(layer)
                    ? "✓ ほしいものリストに追加済み"
                    : "ほしいものリストに追加"}
                </button>
                {wishlist.error && <p role="alert">{wishlist.error}</p>}
              </div>
              {project.layers[0]?.id === layer.id && (
                <button
                  className="text-button"
                  onClick={() => setAddDialog("base")}
                >
                  本体を変更
                </button>
              )}
            </div>
          ) : (
            <div className="inspector-empty">
              <div className="selection-symbol">
                <Icon name="layers" size={28} />
              </div>
              <h3>アイテムを選択</h3>

              <div className="shortcut-note">
                <span>移動</span>
                <kbd>↑ ↓ ← →</kbd>
                <span>10 mmずつ移動</span>
                <kbd>Shift + 矢印</kbd>
                <span>選択を解除</span>
                <kbd>Esc</kbd>
              </div>
            </div>
          )}
          <div className="inspector-bottom">
            <button
              className="text-button"
              onClick={() => setShelf("builds")}
              disabled={!ready || busy}
            >
              保存ビルドを開く・比較
            </button>
            <Link href="/legacy">旧エディターを開く ↗</Link>
            <button
              className="text-button"
              onClick={() => setClearDialog(true)}
              disabled={!ready || busy}
            >
              新しいビルドを作成
            </button>
          </div>
        </aside>
      </div>
      {project.layers.some((l) => purchaseLink(l.url)?.sponsored) && (
        <div className="affiliate-disclosure">
          広告・アフィリエイトリンクを含みます。
          {monetization.amazonAssociateTag &&
            " Amazonのアソシエイトとして、当サイトは適格販売により収入を得ています。"}
        </div>
      )}
      <footer className="footer">
        <span>
          AIRSOFT CUSTOM STUDIO <small>V0.5</small>
        </span>
      </footer>
      {saveDialog && (
        <Dialog
          label="保存"
          close={() => {
            if (!busy) setSaveDialog(false);
          }}
        >
          <div className="add-source-dialog">
            <button
              className="modal-close icon-button"
              aria-label="閉じる"
              disabled={busy}
              onClick={() => setSaveDialog(false)}
            >
              <Icon name="close" />
            </button>
            <h2>保存</h2>
            <div className="add-source-options">
              <button
                className="button secondary"
                disabled={busy || !project.layers.length}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await saveBuild({
                      id: uid(),
                      savedAt: Date.now(),
                      project,
                    });
                    setSaveDialog(false);
                    notify("ビルドをライブラリに保存しました。");
                  } catch {
                    notify("保存できませんでした。");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Icon name="layers" />
                ライブラリに保存
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  save();
                  setSaveDialog(false);
                }}
              >
                <Icon name="download" />
                JSONで保存
              </button>
              <button
                className="button secondary"
                disabled={busy || !project.layers.length}
                onClick={() => {
                  setSaveDialog(false);
                  void png();
                }}
              >
                <Icon name="image" />
                PNG画像を書き出し
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {addDialog && (
        <Dialog
          label={addDialog === "base" ? "本体を追加" : "パーツを追加"}
          close={() => setAddDialog(null)}
        >
          <div className="add-source-dialog">
            <button
              className="modal-close icon-button"
              aria-label="閉じる"
              onClick={() => setAddDialog(null)}
            >
              <Icon name="close" />
            </button>
            <h2>{addDialog === "base" ? "本体を追加" : "パーツを追加"}</h2>
            <div className="add-source-options">
              <button
                className="button secondary"
                onClick={() => {
                  setSearchSource("rakuten");
                  setSearch(addDialog === "base" ? "guns" : "parts");
                  setAddDialog(null);
                }}
              >
                <Icon name="search" />
                検索して追加
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  const target = addDialog;
                  setAddDialog(null);
                  choose(target);
                }}
              >
                <Icon name="upload" />
                自分の画像を使う
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  setSearchSource("saved");
                  setSearch(addDialog === "base" ? "guns" : "parts");
                  setAddDialog(null);
                }}
              >
                <Icon name="layers" />
                登録済みから追加
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {search && (
        <PartSearch
          wishlist={wishlist}
          initialScope={search}
          initialSource={searchSource}
          close={() => setSearch(null)}
          attachLink={
            layer && canEditLink(layer)
              ? (url) => {
                  update(layer.id, { url, linkOrigin: "search" });
                  void wishlist.register(
                    collectionInput({ ...layer, url, linkOrigin: "search" }),
                  );
                  setSearch(null);
                  notify("購入リンクを設定しました。");
                }
              : undefined
          }
          add={addSearchPart}
        />
      )}
      {editor === "perspective" && layer && (
        <PerspectiveWorkbench
          layer={layer}
          close={() => setEditor(null)}
          apply={applyImage}
        />
      )}
      {editor && editor !== "perspective" && layer && (
        <ImageEditor
          key={`${layer.id}-${editor}`}
          layer={layer}
          mode={editor}
          close={() => setEditor(null)}
          apply={applyImage}
        />
      )}
      {shelf && (
        <Shelf
          project={project}
          layer={layer}
          initialTab={shelf}
          wishlist={wishlist}
          close={() => setShelf(null)}
          load={openBuild}
          add={addSearchPart}
        />
      )}
      {logoCleanup && layer && (
        <LogoCleanup
          layer={layer}
          close={() => setLogoCleanup(false)}
          apply={async (value) => {
            await applyImage(value);
            setLogoCleanup(false);
          }}
        />
      )}
      {comparisonOpen && livePlans && (
        <PlanComparison
          plans={livePlans}
          close={() => setComparisonOpen(false)}
          edit={switchPlan}
        />
      )}
      {busy && <LoadingOverlay label="画像を処理中…" />}
      {message && (
        <div role="status" className="toast">
          <Icon name="info" />
          <span>{message}</span>
          <button onClick={() => setMessage("")} aria-label="通知を閉じる">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {(help || clearDialog) && (
        <Dialog
          label={help ? "使い方" : "新しいビルド"}
          close={() => {
            setHelp(false);
            setClearDialog(false);
          }}
        >
          <button
            className="modal-close icon-button"
            autoFocus
            aria-label="閉じる"
            onClick={() => {
              setHelp(false);
              setClearDialog(false);
            }}
          >
            <Icon name="close" />
          </button>
          {help ? (
            <>
              <span className="eyebrow">QUICK START</span>
              <h2>使い方</h2>
              <ol className="help-steps">
                <li>
                  <strong>本体の横向き画像を追加</strong>
                  <p>画像を追加し、「2点で実寸合わせ」で長さを指定します。</p>
                </li>
                <li>
                  <strong>気になるパーツを追加</strong>
                  <p>「パーツを検索」または画像のドロップで追加します。</p>
                </li>
                <li>
                  <strong>位置と見た目を比較</strong>
                  <p>
                    ドラッグで移動、ホイールでズーム。「本体に固定」で本体の移動・回転・反転に追従します。
                  </p>
                </li>
                <li>
                  <strong>ビルドを保存</strong>
                  <p>
                    自動保存に加え、ライブラリへ複数ビルド・パーツを保存し、同じ縮尺で比較できます。JSONでバックアップ、透過PNGで画像を書き出せます。従来のV1
                    JSONも読み込めます。
                  </p>
                </li>
              </ol>
              <p className="hint">
                画像の角度や余白によりサイズの見え方が異なります。取付可否は商品の仕様をご確認ください。デモ画像は説明用のイラストです。
              </p>
            </>
          ) : (
            <>
              <span className="eyebrow">NEW BUILD</span>
              <h2>新しいビルドをはじめる</h2>
              <p>
                現在のビルドをJSONで保存してから切り替えられます。操作後も「元に戻す」で復元できます。
              </p>
              <div className="dialog-actions">
                <button className="button secondary" onClick={save}>
                  現在のJSONを保存
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    commit({ ...emptyProject, layers: [] });
                    setSelected(null);
                    setClearDialog(false);
                    setZoom(1);
                  }}
                >
                  新規作成
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </main>
  );
}
function NumberField({
  label,
  value,
  onChange,
  min = -10000,
  max = 10000,
  unit,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  unit: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="field-label">
      {label}
      <span className="number-input">
        <input
          type="number"
          aria-label={label}
          value={draft ?? String(Math.round(value * 10) / 10)}
          min={min}
          max={max}
          step="0.1"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const text = draft ?? String(value);
            const n = Number(text);
            if (text.trim() && Number.isFinite(n)) {
              const valid = Math.min(max, Math.max(min, n));
              onChange(valid);
            }
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <span>{unit}</span>
      </span>
    </label>
  );
}
