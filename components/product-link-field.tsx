"use client";
import { useState } from "react";
import { approvedProductUrl } from "@/lib/product-link-policy";
export default function ProductLinkField({
  url,
  save,
}: {
  url: string;
  save: (url: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(url),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="product-link-field"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          const safe = approvedProductUrl(draft.trim(), true);
          setBusy(true);
          if (!(await save(safe)))
            throw new Error("リンクを保存できませんでした。");
          setDraft(safe);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "商品URLを確認してください。",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field-label">
        商品リンク
        <input
          type="url"
          value={draft}
          maxLength={4096}
          placeholder="楽天市場・Yahoo!ショッピング・Amazonの商品URL"
          aria-describedby="product-link-feedback"
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      <button type="submit" className="mini-button full-width" disabled={busy}>
        {busy ? "保存中…" : "商品リンクを保存"}
      </button>
      <small id="product-link-feedback" className="hint">
        楽天市場・Yahoo!ショッピング・Amazonの正規の商品URLに対応。購入リンクには運営の広告IDが使われます。
      </small>
      {error && (
        <p role="alert" className="editor-error">
          {error}
        </p>
      )}
    </form>
  );
}
