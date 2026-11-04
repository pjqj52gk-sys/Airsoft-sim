import CommunityGallery from "@/components/community-gallery";
import "./community.css";
export const metadata = { title: "みんなのカスタム | AIRSOFT CUSTOM STUDIO" };
export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ build?: string }>;
}) {
  const params = await searchParams;
  return (
    <CommunityGallery
      initialId={typeof params.build === "string" ? params.build : ""}
    />
  );
}
