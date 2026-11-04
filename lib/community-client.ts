import { comparisonBounds } from "./comparison";
import { loadImage, type Project } from "./project";
import { communityBodyLimit, type CommunitySubmission } from "./community";

export async function preparePublicBuild(project: Project) {
  if (!project.layers[0]?.visible)
    throw new Error("本体を表示してから公開してください。");
  const visible = project.layers.filter((l) => l.visible);
  if (!visible.length) throw new Error("公開するカスタムを作成してください。");
  // Publish only the displayed pixels. Original images, hidden layers and editing history stay private.
  const layers = [];
  for (const layer of visible) {
    const image = await loadImage(layer.src),
      canvas = document.createElement("canvas");
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas
      .getContext("2d")!
      .drawImage(image, 0, 0, canvas.width, canvas.height);
    const copy = { ...layer };
    delete copy.owned;
    delete copy.originalSrc;
    delete copy.originalFrame;
    delete copy.referenceOptions;
    layers.push({
      ...copy,
      src: canvas.toDataURL("image/webp", 0.86),
      width: canvas.width,
      height: canvas.height,
    });
  }
  const copy: Project = { version: 2, name: project.name, layers };
  const [x, y, w, h] = comparisonBounds([copy]).split(" ").map(Number);
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 480;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#f3faff";
  context.fillRect(0, 0, 960, 480);
  const scale = Math.min(900 / w, 420 / h);
  context.translate((960 - w * scale) / 2, (480 - h * scale) / 2);
  context.scale(scale, scale);
  context.translate(-x, -y);
  for (const l of layers) {
    const image = await loadImage(l.src),
      height = (l.mm * l.height) / l.width;
    context.save();
    context.translate(l.x + l.mm / 2, l.y + height / 2);
    context.rotate((l.rotation * Math.PI) / 180);
    context.scale(l.flip ? -1 : 1, 1);
    context.drawImage(image, -l.mm / 2, -height / 2, l.mm, height);
    context.restore();
  }
  return { project: copy, preview: canvas.toDataURL("image/webp", 0.85) };
}
export async function communityRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error || "通信に失敗しました。もう一度お試しください。",
    );
  return data;
}
export function submissionBody(input: CommunitySubmission) {
  const body = JSON.stringify(input);
  if (new Blob([body]).size > communityBodyLimit)
    throw new Error(
      "公開する画像の合計サイズが大きすぎます。画像やパーツ数を減らしてください。",
    );
  return body;
}
