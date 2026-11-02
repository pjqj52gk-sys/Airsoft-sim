import { purchaseLink } from "@/lib/commerce";
export default function PurchaseLink({
  url,
  label = "商品ページを開く",
}: {
  url: string;
  label?: string;
}) {
  const link = purchaseLink(url);
  if (!link) return null;
  return (
    <a
      className="product-link"
      href={link.href}
      target="_blank"
      rel={
        link.sponsored ? "sponsored noopener noreferrer" : "noopener noreferrer"
      }
    >
      {label} ↗{link.sponsored && <small className="ad-label">広告</small>}
    </a>
  );
}
