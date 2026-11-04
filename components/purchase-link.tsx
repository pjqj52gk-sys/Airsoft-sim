import { purchaseLink } from "@/lib/commerce";
export default function PurchaseLink({
  url,
  label,
  sponsored = false,
}: {
  url: string;
  label: string;
  sponsored?: boolean;
}) {
  const link = purchaseLink(url);
  if (!link) return <span>{label}</span>;
  const promoted = sponsored || link.sponsored;
  return (
    <a
      className="product-link"
      href={link.href}
      target="_blank"
      rel={promoted ? "sponsored noopener noreferrer" : "noopener noreferrer"}
    >
      {label} ↗{promoted && <span className="ad-label">広告</span>}
    </a>
  );
}
