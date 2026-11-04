import type { CommunityCard } from "@/lib/community";

export default function CommunityLikeButton({
  build,
  pending,
  disabled,
  onClick,
}: {
  build: Pick<CommunityCard, "title" | "likeCount" | "liked" | "published">;
  pending: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`community-like ${build.liked ? "is-liked" : ""}`}
      aria-label={`${build.liked ? "いいねを取り消す" : "いいね"}：${build.title}（${build.likeCount}件）`}
      aria-pressed={build.liked}
      aria-busy={pending}
      disabled={pending || disabled || !build.published}
      onClick={onClick}
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill={build.liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
      <span>{pending ? "保存中…" : "いいね"}</span>
      <strong>{build.likeCount.toLocaleString("ja-JP")}</strong>
    </button>
  );
}
