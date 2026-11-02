"use client";
import { useEffect, useRef, useState } from "react";
import type { RakutenResults } from "@/lib/rakuten";

export default function RakutenSearch({
  attachLink,
}: {
  attachLink?: (url: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("standard");
  const [result, setResult] = useState<RakutenResults | null>(null);
  const [submitted, setSubmitted] = useState({ query: "", sort: "standard" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search(page = 1, keyword = query, order = sort) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(
        `/api/rakuten/search?${new URLSearchParams({ q: keyword, sort: order, page: String(page) })}`,
        { signal: current.signal },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "検索できませんでした。");
      setResult(data);
      setSubmitted({ query: keyword, sort: order });
    } catch (e) {
      if (!current.signal.aborted)
        setError(e instanceof Error ? e.message : "検索できませんでした。");
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="rakuten-search">
      <form
        className="part-search-controls"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          type="search"
          aria-label="楽天の商品名"
          placeholder="商品名・メーカー"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          required
          maxLength={128}
        />
        <select
          aria-label="楽天の並び順"
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
      {error && <p role="alert">{error}</p>}
      <div aria-live="polite">
        {result && (
          <p>
            {result.count.toLocaleString()}件
            {result.items.length === 0 && "：商品が見つかりません。"}
          </p>
        )}
      </div>
      {result && (
        <div className="rakuten-grid">
          {result.items.map((item) => (
            <article className="rakuten-card" key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel={
                  item.sponsored
                    ? "sponsored noopener noreferrer"
                    : "noopener noreferrer"
                }
              >
                {/* API thumbnails are displayed as supplied and never imported into the editor. */}
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
              <small>{item.shop}</small>
              <strong>¥{item.price.toLocaleString()}</strong>
              <a
                href={item.url}
                target="_blank"
                rel={
                  item.sponsored
                    ? "sponsored noopener noreferrer"
                    : "noopener noreferrer"
                }
              >
                楽天市場で見る ↗{item.sponsored && "（広告）"}
              </a>
              {attachLink && (
                <button
                  className="mini-button"
                  onClick={() => attachLink(item.url)}
                >
                  購入リンクを設定
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      {result && result.pageCount > 1 && (
        <div className="rakuten-pages">
          <button
            className="mini-button"
            disabled={busy || result.page <= 1}
            onClick={() =>
              void search(result.page - 1, submitted.query, submitted.sort)
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
              void search(result.page + 1, submitted.query, submitted.sort)
            }
          >
            次へ
          </button>
        </div>
      )}
      <p className="rakuten-credit">
        <a href="https://developers.rakuten.com/" target="_blank">
          Supported by Rakuten Developers
        </a>
      </p>
    </div>
  );
}
