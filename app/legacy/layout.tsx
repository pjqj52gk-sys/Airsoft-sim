export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return <div className="legacy-editor"><nav className="legacy-nav"><a href="/">← 新しいエディターへ</a><span style={{ marginLeft: 24 }}>旧エディター：保存したV1 JSONは新しい画面でも開けます。</span></nav>{children}</div>;
}
