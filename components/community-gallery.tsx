"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import Icon from "./icon";
import Dialog from "./dialog";
import PurchaseLink from "./purchase-link";
import LoadingOverlay from "./loading-overlay";
import CommunityLikeButton from "./community-like-button";
import { copyCommunityShoppingPlan } from "@/lib/shopping";
import {
  gunTypes,
  type CommunityBuild,
  type CommunityList,
  type CommunityCard,
  type CommunityLike,
} from "@/lib/community";
import { communityRequest } from "@/lib/community-client";
import { parseProject, uid } from "@/lib/project";
import { readDraft, saveBuild, writeDraft } from "@/lib/storage";
const CommunityPublish = dynamic(() => import("./community-publish"));
const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
const message = (error: unknown) =>
  error instanceof Error ? error.message : "通信に失敗しました。";

export default function CommunityGallery({
  initialId = "",
}: {
  initialId?: string;
}) {
  const [query, setQuery] = useState(""),
    [filters, setFilters] = useState({
      q: "",
      type: "",
      budget: "",
      sort: "new",
      mine: false,
    });
  const [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0),
    [data, setData] = useState<CommunityList | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [detailId, setDetailId] = useState(initialId),
    [detail, setDetail] = useState<CommunityBuild | null>(null);
  const [detailLoading, setDetailLoading] = useState(false),
    [publish, setPublish] = useState(false),
    [busy, setBusy] = useState(false);
  const [likes, setLikes] = useState<Record<string, CommunityLike>>({});
  const [likePending, setLikePending] = useState<Set<string>>(new Set());
  const likeRequests = useRef(new Set<string>());
  const likeRevision = useRef(0);
  const [likeError, setLikeError] = useState("");
  async function toggleLike(build: CommunityCard) {
    if (!build.published || likeRequests.current.has(build.id)) return;
    likeRequests.current.add(build.id);
    likeRevision.current++;
    setLikePending(new Set(likeRequests.current));
    setLikeError("");
    try {
      const result = await communityRequest<CommunityLike>(
        `/api/community/${build.id}/like`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            liked: !(likes[build.id]?.liked ?? build.liked),
          }),
        },
      );
      likeRevision.current++;
      setLikes((previous) => ({ ...previous, [build.id]: result }));
    } catch (error) {
      setLikeError(message(error));
    } finally {
      likeRequests.current.delete(build.id);
      setLikePending(new Set(likeRequests.current));
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    const revision = likeRevision.current;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      q: filters.q,
      type: filters.type,
      budget: filters.budget,
      sort: filters.sort,
      mine: filters.mine ? "1" : "0",
      page: String(page),
    });
    communityRequest<CommunityList>(`/api/community?${params}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        // New list reads can replace local counts unless a vote raced the read.
        if (revision === likeRevision.current) setLikes({});
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(message(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, page, refresh]);
  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    setError("");
    setDetail(null);
    communityRequest<CommunityBuild>(
      `/api/community/${encodeURIComponent(detailId)}`,
      { signal: controller.signal },
    )
      .then(setDetail)
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(message(error));
          setDetailId("");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [detailId]);
  function filter(next: Partial<typeof filters>) {
    setPage(1);
    setFilters((value) => ({ ...value, ...next }));
  }
  async function tryBuild() {
    if (!detail || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const copy = await parseProject(detail.project),
        draft = await readDraft();
      if (draft) {
        const current = await parseProject(draft);
        if (current.layers.length)
          await saveBuild({ id: uid(), savedAt: Date.now(), project: current });
      }
      await writeDraft({
        ...copyCommunityShoppingPlan(copy),
        name: `${detail.title} のコピー`,
      });
      window.location.assign("/");
    } catch (error) {
      setNotice(message(error));
      setBusy(false);
    }
  }
  async function changeVisibility() {
    if (!detail || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const updated = await communityRequest<CommunityBuild>(
        `/api/community/${detail.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ published: !detail.published }),
        },
      );
      setDetail(updated);
      setRefresh((n) => n + 1);
      setNotice(
        updated.published ? "再公開しました。" : "公開を取り下げました。",
      );
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="community-page">
      <header className="community-header">
        <Link className="community-back" href="/">
          ← エディター
        </Link>
        <h1>みんなのカスタム</h1>
        <button
          className="button primary"
          onClick={() => setPublish(true)}
          disabled={!data?.configured || loading}
        >
          <Icon name="plus" />
          カスタムを公開
        </button>
      </header>
      <section className="community-toolbar" aria-label="カスタムを検索">
        <form
          className="community-search"
          onSubmit={(event) => {
            event.preventDefault();
            filter({ q: query });
          }}
        >
          <label className="sr-only" htmlFor="community-query">
            カスタムを検索
          </label>
          <Icon name="search" />
          <input
            id="community-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
            placeholder="M4、パーツ名、タグで検索"
          />
          <button className="button primary">検索</button>
        </form>
        <div className="community-filters">
          <label>
            銃種
            <select
              value={filters.type}
              onChange={(e) => filter({ type: e.target.value })}
            >
              <option value="">すべての銃種</option>
              {gunTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            登録価格の合計
            <select
              value={filters.budget}
              onChange={(e) => filter({ budget: e.target.value })}
            >
              <option value="">指定なし</option>
              <option value="30000">3万円以下</option>
              <option value="50000">5万円以下</option>
              <option value="100000">10万円以下</option>
            </select>
          </label>
          <label>
            並び順
            <select
              value={filters.sort}
              onChange={(e) => filter({ sort: e.target.value })}
            >
              <option value="new">新しい順</option>
              <option value="likes">いいねが多い順</option>
              <option value="budget">価格が低い順</option>
            </select>
          </label>
          <button
            className={`button secondary ${filters.mine ? "community-selected" : ""}`}
            aria-pressed={filters.mine}
            onClick={() => filter({ mine: !filters.mine })}
          >
            自分の投稿
          </button>
        </div>
      </section>
      {error ? (
        <div className="community-error" role="alert">
          {error}
          <button
            className="button secondary"
            onClick={() => setRefresh((n) => n + 1)}
          >
            再読み込み
          </button>
        </div>
      ) : null}
      {likeError && !detail ? (
        <p className="community-error" role="alert">
          {likeError}
        </p>
      ) : null}
      {data && !data.configured ? (
        <div className="community-empty">
          <Icon name="layers" size={32} />
          <h2>公開機能は準備中です</h2>
          <Link className="button secondary" href="/">
            エディターに戻る
          </Link>
        </div>
      ) : null}
      {!loading && data?.configured && !error ? (
        <>
          <div className="community-results-label">
            <span>{filters.mine ? "自分の投稿" : "公開カスタム"}</span>
            <span>
              {data.items.length}件{data.hasMore ? "＋" : ""}
            </span>
          </div>
          {data.items.length ? (
            <div className="community-grid">
              {data.items.map((build) => (
                <article className="community-card" key={build.id}>
                  <button
                    className="community-card-open"
                    onClick={() => {
                      setNotice("");
                      setDetailId(build.id);
                    }}
                  >
                    <div className="community-card-image">
                      <Image
                        unoptimized
                        width={960}
                        height={480}
                        loading="lazy"
                        src={build.preview}
                        alt={`${build.title}の外観`}
                      />
                      <span className="community-type">
                        {build.published ? build.gunType : "非公開"}
                      </span>
                    </div>
                    <div className="community-card-body">
                      <h2>{build.title}</h2>
                      <p className="community-base-name">{build.baseName}</p>
                      <div className="community-card-meta">
                        <span>{build.partCount}パーツ</span>
                        <strong>
                          {build.budget ? yen(build.budget) : "価格未登録"}
                        </strong>
                      </div>
                      <div className="community-tags">
                        {build.tags.map((tag) => (
                          <span key={tag}>#{tag}</span>
                        ))}
                      </div>
                      <footer>
                        <span>{build.author}</span>
                        <time dateTime={build.createdAt}>
                          {new Date(build.createdAt).toLocaleDateString(
                            "ja-JP",
                          )}
                        </time>
                      </footer>
                    </div>
                  </button>
                  <div className="community-card-reactions">
                    <CommunityLikeButton
                      build={{ ...build, ...likes[build.id] }}
                      pending={likePending.has(build.id)}
                      onClick={() => toggleLike(build)}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="community-empty">
              <Icon name="layers" size={32} />
              <h2>
                {filters.mine
                  ? "投稿はまだありません"
                  : filters.q || filters.type || filters.budget
                    ? "一致するカスタムがありません"
                    : "最初のカスタムを公開しよう"}
              </h2>
              <button
                className="button secondary"
                onClick={() => setPublish(true)}
              >
                カスタムを公開
              </button>
            </div>
          )}
          <nav className="community-pagination" aria-label="ページ切り替え">
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              前へ
            </button>
            <span>{page}</span>
            <button
              className="button secondary"
              disabled={!data.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              次へ
            </button>
          </nav>
        </>
      ) : null}
      {publish ? (
        <CommunityPublish
          close={() => setPublish(false)}
          published={(build) => {
            setPublish(false);
            setRefresh((n) => n + 1);
            setNotice("公開しました。");
            setDetailId(build.id);
          }}
        />
      ) : null}
      {detail ? (
        <Dialog
          label={detail.title}
          close={() => {
            if (!busy) {
              setDetailId("");
              setNotice("");
            }
          }}
          wide
        >
          <div className="community-dialog-heading">
            <div>
              <p className="community-note">
                {detail.author} · {detail.gunType}
                {!detail.published ? " · 非公開" : ""}
              </p>
              <h2>{detail.title}</h2>
            </div>
            <button
              className="icon-button"
              aria-label="閉じる"
              disabled={busy}
              onClick={() => {
                setDetailId("");
                setNotice("");
              }}
            >
              <Icon name="close" />
            </button>
          </div>
          <Image
            unoptimized
            width={960}
            height={480}
            className="community-detail-image"
            src={detail.preview}
            alt={`${detail.title}の外観`}
          />
          <div className="community-detail-actions">
            <CommunityLikeButton
              build={{ ...detail, ...likes[detail.id] }}
              pending={likePending.has(detail.id)}
              disabled={busy}
              onClick={() => toggleLike(detail)}
            />
            <button
              className="button primary"
              onClick={tryBuild}
              disabled={busy}
            >
              編集画面で試す <Icon name="arrow" />
            </button>
            <button
              className="button secondary"
              disabled={!detail.published || busy}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/community?build=${detail.id}`,
                  );
                  setNotice("共有リンクをコピーしました。");
                } catch {
                  setNotice("共有リンクをコピーできませんでした。");
                }
              }}
            >
              <Icon name="copy" />
              共有リンク
            </button>
            {detail.owned ? (
              <button
                className="button secondary"
                onClick={changeVisibility}
                disabled={busy}
              >
                {detail.published ? "公開を取り下げる" : "再公開する"}
              </button>
            ) : null}
          </div>
          {likeError ? (
            <p className="community-error" role="alert">
              {likeError}
            </p>
          ) : null}
          <p className="community-note">
            編集中のカスタムは、ライブラリに保存してから開きます。
          </p>
          {notice ? (
            <p className="community-notice" role="status">
              {notice}
            </p>
          ) : null}
          {detail.description ? (
            <p className="community-description">{detail.description}</p>
          ) : null}
          <div className="community-tags">
            {detail.tags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setQuery(tag);
                  filter({ q: tag });
                  setDetailId("");
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
          <div className="community-parts-heading">
            <h3>使用パーツ</h3>
            <strong>登録価格の合計 {yen(detail.budget)}</strong>
          </div>
          <ul className="community-parts">
            {detail.project.layers.map((layer, index) => (
              <li key={layer.id}>
                <Image
                  unoptimized
                  width={88}
                  height={64}
                  loading="lazy"
                  src={layer.src}
                  alt=""
                />
                <div>
                  <small>{index ? "パーツ" : "本体"}</small>
                  <strong>
                    <PurchaseLink url={layer.url} label={layer.name} />
                  </strong>
                </div>
                <span>{layer.price ? yen(layer.price) : "価格未登録"}</span>
              </li>
            ))}
          </ul>
        </Dialog>
      ) : null}
      {loading || detailLoading || busy ? (
        <LoadingOverlay
          label={busy ? "カスタムを準備中…" : "カスタムを読み込み中…"}
        />
      ) : null}
    </main>
  );
}
