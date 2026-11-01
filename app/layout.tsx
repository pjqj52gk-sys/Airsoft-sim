import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AIRSOFT CUSTOM STUDIO — カスタム外観シミュレーター",
  description:
    "エアガンとパーツの画像を実寸に合わせて組み合わせ、カスタムの外観を購入前に比較できるワークスペース。",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
