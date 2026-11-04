"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Dialog from "./dialog";
import Icon from "./icon";
import LoadingOverlay from "./loading-overlay";
import { gunTypes, type CommunityBuild } from "@/lib/community";
import {
  communityRequest,
  preparePublicBuild,
  submissionBody,
} from "@/lib/community-client";
import { parseProject, type Project } from "@/lib/project";
import { listBuilds, readDraft, type StoredBuild } from "@/lib/storage";

export default function CommunityPublish({
  close,
  published,
}: {
  close: () => void;
  published: (build: CommunityBuild) => void;
}) {
  const [project, setProject] = useState<Project | null>(null),
    [saved, setSaved] = useState<StoredBuild[]>([]);
  const [prepared, setPrepared] = useState<Awaited<
    ReturnType<typeof preparePublicBuild>
  > | null>(null);
  const [title, setTitle] = useState(""),
    [author, setAuthor] = useState(""),
    [description, setDescription] = useState("");
  const [gunType, setGunType] = useState<string>(gunTypes[0]),
    [tags, setTags] = useState(""),
    [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false),
    [preparing, setPreparing] = useState(true),
    [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    let cancelled = false;
    Promise.all([readDraft(), listBuilds()])
      .then(async ([draft, builds]) => {
        if (cancelled) return;
        setSaved(builds.sort((a, b) => b.savedAt - a.savedAt));
        const value = draft || builds[0]?.project;
        if (!value) {
          setError("エディターでカスタムを作成してください。");
          setPreparing(false);
          return;
        }
        const p = await parseProject(value);
        if (!cancelled) {
          setProject(p);
          setTitle(p.name);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("保存したカスタムを読み込めませんでした。");
          setPreparing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setPreparing(true);
    setPrepared(null);
    setError("");
    preparePublicBuild(project)
      .then((value) => {
        if (!cancelled) setPrepared(value);
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      })
      .finally(() => {
        if (!cancelled) setPreparing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!prepared || busy || !agreed) return;
    setBusy(true);
    setError("");
    try {
      const body = submissionBody({
        ...prepared,
        title,
        author,
        description,
        gunType,
        tags: tags.split(/[\s,、]+/).filter(Boolean),
      });
      const result = await communityRequest<CommunityBuild>("/api/community", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestId.current,
        },
        body,
      });
      published(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "公開に失敗しました。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      label="カスタムを公開"
      close={() => {
        if (!busy) close();
      }}
      wide
    >
      <div className="community-dialog-heading">
        <h2>カスタムを公開</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="閉じる"
          onClick={close}
          disabled={busy}
        >
          <Icon name="close" />
        </button>
      </div>
      <form onSubmit={submit} className="community-publish-form">
        <div className="community-publish-preview">
          {prepared ? (
            <Image
              unoptimized
              width={960}
              height={480}
              src={prepared.preview}
              alt="公開するカスタムのプレビュー"
            />
          ) : (
            <div className="community-preview-placeholder">
              {preparing ? "画像を準備中…" : "カスタムがありません"}
            </div>
          )}
          {saved.length > 0 ? (
            <label>
              ライブラリから選ぶ
              <select
                disabled={busy || preparing}
                defaultValue=""
                onChange={async (e) => {
                  const item = saved.find((b) => b.id === e.target.value);
                  if (item) {
                    setProject(item.project);
                    setTitle(item.project.name);
                    requestId.current = crypto.randomUUID();
                  }
                }}
              >
                <option value="" disabled>
                  カスタムを選択
                </option>
                {saved.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.project.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="community-form-fields">
          <label>
            タイトル
            <input
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="community-form-row">
            <label>
              投稿者名
              <input
                maxLength={30}
                placeholder="ゲスト"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </label>
            <label>
              銃種
              <select
                value={gunType}
                onChange={(e) => setGunType(e.target.value)}
              >
                {gunTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            タグ
            <input
              maxLength={125}
              placeholder="M4 ブラック CQB（6個まで）"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </label>
          <label>
            コメント
            <textarea
              maxLength={600}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="community-consent">
            <input
              type="checkbox"
              required
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>画像・パーツ名・価格・購入リンクを公開する</span>
          </label>
          <p className="community-note">
            公開の取り下げ・再公開は、このブラウザーで管理できます。
          </p>
          {error ? (
            <p className="community-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="community-form-actions">
            <button
              className="button secondary"
              type="button"
              onClick={close}
              disabled={busy}
            >
              キャンセル
            </button>
            <button
              className="button primary"
              disabled={!prepared || !agreed || busy || preparing}
            >
              公開する
            </button>
          </div>
        </div>
      </form>
      {busy || preparing ? (
        <LoadingOverlay label={busy ? "公開中…" : "画像を準備中…"} />
      ) : null}
    </Dialog>
  );
}
