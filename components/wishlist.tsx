"use client";
import { wishTotal } from "@/lib/wishlist";
import type { WishlistState } from "./use-wishlist";
import PurchaseLink from "./purchase-link";
export default function Wishlist({ wishlist }: { wishlist: WishlistState }) {
  return (
    <section className="wishlist" aria-label="ほしいものリスト">
      <div className="shopping-budget">
        <span>ほしいものリスト</span>
        <strong>¥{wishTotal(wishlist.items).toLocaleString("ja-JP")}</strong>
        <small>{wishlist.items.length}点</small>
      </div>
      {wishlist.error && <p role="alert">{wishlist.error}</p>}
      {wishlist.items.map((item) => (
        <article className="wishlist-entry" key={item.id}>
          {item.image && <img src={item.image} alt="" width={80} height={60} />}
          <div>
            <h3>
              <PurchaseLink url={item.url} label={item.name} />
            </h3>
            <small>{item.category}</small>
            <strong>
              {item.price
                ? "¥" + item.price.toLocaleString("ja-JP")
                : "価格未登録"}
            </strong>
          </div>
          <button
            className="text-button"
            disabled={wishlist.pending}
            onClick={() => void wishlist.toggle(item)}
            aria-label={`ほしいものリストから外す：${item.name}`}
          >
            リストから外す
          </button>
        </article>
      ))}
      {wishlist.ready && !wishlist.items.length && (
        <p className="hint">
          アイテムの「ほしいものリストに追加」から登録できます。
        </p>
      )}
    </section>
  );
}
