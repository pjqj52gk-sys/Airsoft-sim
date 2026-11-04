import type { Project } from "@/lib/project";
import { shoppingSummary } from "@/lib/shopping";
import PurchaseLink from "./purchase-link";
export default function CostBreakdown({ project }: { project: Project }) {
  const summary = shoppingSummary(project);
  const missing = project.layers.filter((layer) => !layer.price).length;
  return (
    <section aria-label="カスタムの価格内訳">
      <h2>{project.name}</h2>
      <div className="shopping-budget">
        <span>カスタム総額</span>
        <strong>¥{summary.total.toLocaleString("ja-JP")}</strong>
        {missing > 0 && <small>価格未登録 {missing}点</small>}
      </div>
      <ul className="cost-breakdown">
        {project.layers.map((layer, index) => (
          <li key={layer.id}>
            <div>
              <small>
                {index ? "パーツ" : "本体"}
                {!layer.visible ? " · 非表示" : ""}
              </small>
              <PurchaseLink url={layer.url} label={layer.name} />
            </div>
            <strong>
              {layer.price
                ? "¥" + layer.price.toLocaleString("ja-JP")
                : "価格未登録"}
            </strong>
          </li>
        ))}
      </ul>
      <p className="hint">本体・非表示パーツを含む登録価格の合計です。</p>
    </section>
  );
}
