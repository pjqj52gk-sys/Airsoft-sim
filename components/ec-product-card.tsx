"use client";
import { useState } from "react";
import type { EcProduct } from "@/lib/ec-products";
import { ecMarket } from "@/lib/ec-products";
import { catalogImageUrl } from "@/lib/catalog-image";
import type { RakutenItem } from "@/lib/rakuten";
import type { WishlistState } from "./use-wishlist";
import PurchaseLink from "./purchase-link";
import WishButton from "./wish-button";
import "./ec-product-card.css";
export default function EcProductCard({
  product,
  wishlist,
  category,
  choose,
  attachLink,
}: {
  product: EcProduct;
  wishlist?: WishlistState;
  category: string;
  choose: (item: RakutenItem) => void;
  attachLink?: (url: string) => void;
}) {
  const [selectedUrl, setSelectedUrl] = useState(product.offers[0].productUrl);
  const item =
    product.offers.find((offer) => offer.productUrl === selectedUrl) ||
    product.offers[0];
  const [imageFailed, setImageFailed] = useState(false);
  const image =
    !imageFailed && product.official?.images.length
      ? catalogImageUrl(product.official, 0)
      : item.image;
  const input = {
    name: product.name,
    url: item.url,
    linkOrigin: "search" as const,
    price: item.price,
    category,
    image,
  };
  return (
    <article className="rakuten-card ec-product-card" aria-label={product.name}>
      <h3>
        <PurchaseLink url={item.url} label={product.name} />
      </h3>
      {!!product.official?.modelNumbers?.length && (
        <small>{product.official.modelNumbers.join(" / ")}</small>
      )}
      <img
        src={image}
        alt={product.name}
        width={200}
        height={150}
        loading="lazy"
        onError={() => setImageFailed(true)}
      />
      <strong>¥{item.price.toLocaleString("ja-JP")}</strong>
      <small>商品価格・送料別途確認</small>
      <fieldset className="ec-offers">
        <legend>販売店（{product.offers.length}件）</legend>
        {product.offers.map((offer) => (
          <label key={offer.productUrl}>
            <input
              type="radio"
              name={"offer-" + product.id}
              checked={offer.productUrl === item.productUrl}
              onChange={() => {
                setSelectedUrl(offer.productUrl);
                setImageFailed(false);
              }}
            />
            <span>
              {ecMarket(offer)}
              <small>{offer.shop}</small>
            </span>
            <b>¥{offer.price.toLocaleString("ja-JP")}</b>
          </label>
        ))}
      </fieldset>
      <WishButton wishlist={wishlist} item={input} />
      {wishlist && (
        <label className="ec-owned">
          <input
            type="checkbox"
            checked={wishlist.get(input)?.owned === true}
            disabled={!wishlist.ready || wishlist.pending}
            onChange={(event) =>
              void wishlist.setOwned(input, event.target.checked)
            }
          />
          所有済み
        </label>
      )}
      <button className="button primary" onClick={() => choose(item)}>
        画像を選んで追加
      </button>
      {product.official && (
        <small>
          公式データあり
          {product.official.dimensions
            .map((d) => " · " + d.label + " " + d.value)
            .join("")}
        </small>
      )}
      <details className="ec-original-title">
        <summary>正式な商品名</summary>
        <PurchaseLink url={item.url} label={item.name} />
      </details>
      {attachLink && (
        <button className="mini-button" onClick={() => attachLink(item.url)}>
          選択中のパーツにリンクのみ設定
        </button>
      )}
    </article>
  );
}
