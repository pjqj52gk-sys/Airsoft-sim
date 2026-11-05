import { safeImportedProductUrl } from "./product-link-policy.ts";
import type { LinkOrigin } from "./link-policy";
import { mapConcurrent } from "./async-control.ts";
import type { ReferenceLengthOption } from "./product-specs.ts";
export type Layer = {
  libraryId?: string;
  linkOrigin?: LinkOrigin;
  id: string;
  name: string;
  src: string;
  originalSrc?: string;
  originalFrame?: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
  width: number;
  height: number;
  mm: number;
  referenceMm?: number;
  referenceOptions?: ReferenceLengthOption[];
  x: number;
  y: number;
  rotation: number;
  flip: boolean;
  visible: boolean;
  attachedToBase?: boolean;
  price: number;
  owned?: boolean;
  url: string;
  category: string;
};
export type Project = { version: 2; name: string; layers: Layer[] };
export const emptyProject: Project = {
  version: 2,
  name: "マイカスタム 01",
  layers: [],
};
export const uid = () => crypto.randomUUID();
const svg = (body: string, w: number, h: number) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;
export const demoBase = svg(
  `<defs><linearGradient id="a" x2="0" y2="1"><stop stop-color="#555950"/><stop offset="1" stop-color="#222721"/></linearGradient><pattern id="r" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M2 0v12" stroke="#181d18" stroke-width="4"/></pattern></defs><path d="M12 72H152L192 98V142H133L61 181H12Z" fill="url(#a)" stroke="#181c18" stroke-width="5"/><path d="M22 88H108L130 101V126L56 160H22Z" fill="#1b211c"/><rect x="151" y="87" width="85" height="31" rx="8" fill="#252b24"/><path d="M223 73H402V135H350L333 150H262L224 124Z" fill="url(#a)" stroke="#181e18" stroke-width="4"/><path d="M289 133L278 205H313L327 149" fill="#323a2d" stroke="#191f18" stroke-width="4"/><path d="M343 133L352 221Q382 227 403 213L386 131" fill="#30372d" stroke="#171d17" stroke-width="4"/><path d="M360 150L369 209M374 148L384 208" stroke="#4d5546" stroke-width="4"/><path d="M316 132Q336 168 352 137" fill="none" stroke="#1a211a" stroke-width="7"/><rect x="398" y="72" width="225" height="66" rx="8" fill="url(#a)" stroke="#191e19" stroke-width="4"/><rect x="401" y="79" width="218" height="9" fill="url(#r)"/><path d="M417 103h25m16 0h25m16 0h25m16 0h25m16 0h25M420 122h24m16 0h24m16 0h24m16 0h24m16 0h24" stroke="#141b14" stroke-width="8" stroke-linecap="round"/><path d="M232 67H623V76H232Z" fill="url(#r)" stroke="#1c221c" stroke-width="3"/><path d="M623 96H755V111H623Z" fill="#282e27"/><path d="M749 91H786V117H749Z" fill="#1e241e"/><path d="M758 93v22m10-22v22m10-22v22" stroke="#42493d" stroke-width="3"/><rect x="258" y="91" width="65" height="18" rx="4" fill="#181f18"/><path d="M260 111h33" stroke="#6c7363" stroke-width="3"/><circle cx="246" cy="124" r="5" fill="#727968"/><circle cx="381" cy="119" r="4" fill="#727968"/>`,
  800,
  240,
);
export const demoOptic = svg(
  `<path d="M35 65h100v15H35Z" fill="#202720"/><path d="M55 54h60v15H55Z" fill="#424b3c"/><path d="M25 18Q85-4 145 18V55Q85 70 25 55Z" fill="#353e31" stroke="#1b221b" stroke-width="5"/><ellipse cx="145" cy="36" rx="15" ry="21" fill="#3a6656" stroke="#171e18" stroke-width="6"/><path d="M30 22h25v31H30" fill="#242c24"/><path d="M80 6V0h25v10" fill="#273025"/><circle cx="94" cy="33" r="9" fill="#1d251e" stroke="#58634c" stroke-width="3"/>`,
  170,
  85,
);
export function sampleProject(): Project {
  const base: Layer = {
    id: uid(),
    name: "M4 スタイル / デモ本体",
    src: demoBase,
    width: 800,
    height: 240,
    mm: 800,
    x: 120,
    y: 190,
    rotation: 0,
    flip: false,
    visible: true,
    attachedToBase: false,
    price: 0,
    url: "",
    category: "本体",
  };
  return {
    version: 2,
    name: "M4 / オリーブ・ビルド",
    layers: [
      base,
      {
        ...base,
        id: uid(),
        name: "コンパクトサイト / デモ",
        src: demoOptic,
        width: 170,
        height: 85,
        mm: 150,
        x: 430,
        y: 188,
        attachedToBase: true,
        category: "光学機器",
      },
    ],
  };
}
export function dimensions(layer: Layer) {
  return { w: layer.mm, h: (layer.mm * layer.height) / layer.width };
}
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("プロジェクトの形式が正しくありません。");
  return value as Record<string, unknown>;
};
const number = (value: unknown, fallback: number, min = -10000, max = 10000) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
export function safeImage(src: unknown): string {
  if (src === demoBase || src === demoOptic) return src;
  if (
    typeof src !== "string" ||
    !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(src)
  )
    throw new Error(
      "画像データが無効です。PNG / JPEG / WebP の画像を読み込み直してください。",
    );
  return src;
}
export async function parseProject(
  value: unknown,
  onInvalidLink?: () => void,
): Promise<Project> {
  const data = record(value);
  // V1 projects use pixel offsets relative to the base image. Convert to the common millimetre canvas.
  const legacy = data.version === 1 || (data.baseImg && data.version !== 2);
  if (!legacy && data.version !== 2)
    throw new Error("このバージョンのプロジェクトには対応していません。");
  const base = legacy ? record(data.baseImg) : null;
  const values = legacy
    ? [base, ...(Array.isArray(data.parts) ? data.parts : [])]
    : data.layers;
  if (!Array.isArray(values) || values.length > 60)
    throw new Error("レイヤーは60件まで読み込めます。");
  const scale = base
    ? number(base.mm, 800, 1) / number(base.widthPx, 800, 1)
    : 1;
  const layers = await mapConcurrent(values, 3, async (value, index) => {
    const row = record(value);
    const src = safeImage(row.src);
    const image = await loadImage(src);
    const frame = validOriginalFrame(row.originalFrame);
    const pos = row.position ? record(row.position) : {};
    const mm = number(row.mm, index ? 150 : 800, 1, 5000);
    return {
      id: uid(),
      name:
        typeof row.name === "string"
          ? row.name.slice(0, 100)
          : index
            ? `パーツ ${index}`
            : "本体",
      src,
      originalSrc:
        row.originalSrc &&
        typeof row.originalSrc === "string" &&
        /^data:image\/(png|jpeg|webp|gif);base64,/.test(row.originalSrc)
          ? safeImage(row.originalSrc)
          : undefined,
      originalFrame:
        row.originalSrc &&
        frame &&
        frame.offsetX + image.naturalWidth <= frame.width &&
        frame.offsetY + image.naturalHeight <= frame.height
          ? frame
          : undefined,
      width: image.naturalWidth,
      height: image.naturalHeight,
      mm:
        legacy && row.metricType === "height"
          ? (mm * image.naturalWidth) / image.naturalHeight
          : mm,
      referenceMm:
        typeof row.referenceMm === "number" &&
        row.referenceMm > 0 &&
        row.referenceMm <= 5000
          ? row.referenceMm
          : undefined,
      referenceOptions: Array.isArray(row.referenceOptions)
        ? row.referenceOptions.slice(0, 16).flatMap((o: unknown) => {
            if (!o || typeof o !== "object") return [];
            const option = o as Record<string, unknown>;
            return typeof option.mm === "number" &&
              Number.isFinite(option.mm) &&
              option.mm > 0 &&
              option.mm <= 5000 &&
              typeof option.label === "string"
              ? [{ mm: option.mm, label: option.label.slice(0, 120) }]
              : [];
          })
        : undefined,
      x: legacy ? 120 + number(pos.x, 0) * scale : number(row.x, 120),
      y: legacy ? 190 + number(pos.y, 0) * scale : number(row.y, 190),
      rotation: number(row.rotation, 0, -360, 360),
      flip: row.flip === true,
      visible: row.visible !== false,
      attachedToBase: index > 0 && row.attachedToBase === true,
      price: number(row.price, 0, 0, 10000000),
      owned: row.owned === true,
      linkOrigin: ["search", "upload", "shared"].includes(
        String(row.linkOrigin),
      )
        ? (row.linkOrigin as LinkOrigin)
        : undefined,
      libraryId:
        typeof row.libraryId === "string"
          ? row.libraryId.slice(0, 2100)
          : undefined,
      url: safeImportedProductUrl(row.url, onInvalidLink),
      category:
        typeof row.category === "string"
          ? row.category.slice(0, 30)
          : index
            ? "その他"
            : "本体",
    };
  });
  return {
    version: 2,
    name:
      typeof data.name === "string"
        ? data.name.slice(0, 100)
        : "読み込んだカスタム",
    layers,
  };
}
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    img.src = src;
  });
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function readImage(
  file: File,
): Promise<Pick<Layer, "src" | "width" | "height">> {
  if (
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)
  )
    throw new Error("PNG / JPEG / WebP / GIF の画像を選んでください。");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("画像は15MB以下にしてください。");
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("ファイルを読み込めませんでした。"));
    r.readAsDataURL(file);
  });
  const image = await loadImage(src);
  const ratio = Math.min(
    1,
    2000 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * ratio);
  canvas.height = Math.round(image.naturalHeight * ratio);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return {
    src: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}
export async function removeBackground(
  src: string,
  tolerance: number,
  preserveTransparency = false,
): Promise<string> {
  const image = await loadImage(src);
  const c = document.createElement("canvas");
  c.width = image.naturalWidth;
  c.height = image.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, c.width, c.height);
  const d = pixels.data;
  if (preserveTransparency) {
    for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return src;
  }
  const seen = new Uint8Array(c.width * c.height);
  const queue = new Int32Array(c.width * c.height);
  let tail = 0;
  const color = [d[0], d[1], d[2]];
  const push = (p: number) => {
    if (seen[p]) return;
    seen[p] = 1;
    const i = p * 4;
    if (
      Math.max(
        Math.abs(d[i] - color[0]),
        Math.abs(d[i + 1] - color[1]),
        Math.abs(d[i + 2] - color[2]),
      ) <= tolerance ||
      d[i + 3] === 0
    )
      queue[tail++] = p;
  };
  for (let x = 0; x < c.width; x++) {
    push(x);
    push((c.height - 1) * c.width + x);
  }
  for (let y = 0; y < c.height; y++) {
    push(y * c.width);
    push(y * c.width + c.width - 1);
  }
  for (let n = 0; n < tail; n++) {
    const p = queue[n];
    d[p * 4 + 3] = 0;
    if (p % c.width) push(p - 1);
    if (p % c.width < c.width - 1) push(p + 1);
    if (p >= c.width) push(p - c.width);
    if (p < c.width * (c.height - 1)) push(p + c.width);
  }
  if (preserveTransparency && tail === c.width * c.height) return src;
  ctx.putImageData(pixels, 0, 0);
  return c.toDataURL("image/png");
}
function validOriginalFrame(value: unknown): Layer["originalFrame"] {
  if (!value || typeof value !== "object") return undefined;
  const f = value as Record<string, unknown>;
  if (
    !["width", "height", "offsetX", "offsetY"].every(
      (k) =>
        typeof f[k] === "number" &&
        Number.isFinite(f[k]) &&
        Number.isInteger(f[k]) &&
        Number(f[k]) >= 0 &&
        Number(f[k]) <= 20000,
    )
  )
    return undefined;
  if (
    Number(f.width) < 1 ||
    Number(f.height) < 1 ||
    Number(f.offsetX) >= Number(f.width) ||
    Number(f.offsetY) >= Number(f.height)
  )
    return undefined;
  return {
    width: Number(f.width),
    height: Number(f.height),
    offsetX: Number(f.offsetX),
    offsetY: Number(f.offsetY),
  };
}
export async function exportPng(project: Project) {
  const layers = project.layers.filter((l) => l.visible);
  if (!layers.length) throw new Error("表示中の画像がありません。");
  const bounds = layers.map((l) => {
    const { w, h } = dimensions(l);
    const r = (l.rotation * Math.PI) / 180;
    return {
      x: l.x + w / 2,
      y: l.y + h / 2,
      w: Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r)),
      h: Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)),
    };
  });
  const left = Math.min(...bounds.map((b) => b.x - b.w / 2)) - 30;
  const top = Math.min(...bounds.map((b) => b.y - b.h / 2)) - 30;
  const width = Math.max(...bounds.map((b) => b.x + b.w / 2)) - left + 30;
  const height = Math.max(...bounds.map((b) => b.y + b.h / 2)) - top + 30;
  const scale = Math.min(2, 4096 / Math.max(width, height));
  const c = document.createElement("canvas");
  c.width = Math.ceil(width * scale);
  c.height = Math.ceil(height * scale);
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  for (const l of layers) {
    const img = await loadImage(l.src);
    const { w, h } = dimensions(l);
    ctx.save();
    ctx.translate(l.x - left + w / 2, l.y - top + h / 2);
    ctx.rotate((l.rotation * Math.PI) / 180);
    ctx.scale(l.flip ? -1 : 1, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNGの作成に失敗しました。"))),
      "image/png",
    ),
  );
  download(blob, `${project.name}.png`);
}
