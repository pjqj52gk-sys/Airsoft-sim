export type PartCategory = {
  id: string;
  label: string;
  keyword: string;
  genreId?: string;
  layerCategory?: string;
};
export type PartCategoryGroup = {
  id: string;
  label: string;
  layerCategory: string;
  children: PartCategory[];
};
export const partCategoryGroups: PartCategoryGroup[] = [
  {
    id: "guns",
    label: "エアガン本体",
    layerCategory: "本体",
    children: [
      {
        id: "gun-assault-rifle",
        label: "アサルトライフル",
        keyword: "アサルトライフル",
        genreId: "213685",
      },
      {
        id: "gun-submachine-gun",
        label: "サブマシンガン",
        keyword: "サブマシンガン",
        genreId: "213685",
      },
      {
        id: "gun-light-machine-gun",
        label: "ライトマシンガン",
        keyword: "ライトマシンガン",
        genreId: "213685",
      },
      {
        id: "gun-sniper-rifle",
        label: "スナイパーライフル",
        keyword: "スナイパーライフル",
        genreId: "213685",
      },
      {
        id: "gun-shotgun",
        label: "ショットガン",
        keyword: "ショットガン",
        genreId: "213685",
      },
      {
        id: "gun-handgun",
        label: "ハンドガン",
        keyword: "ハンドガン",
        genreId: "213685",
      },
      {
        id: "gun-revolver",
        label: "リボルバー",
        keyword: "リボルバー",
        genreId: "213685",
      },
    ],
  },
  {
    id: "optics",
    label: "光学機器",
    layerCategory: "光学機器",
    children: [
      { id: "dot-sight", label: "ドットサイト", keyword: "ドットサイト" },
      { id: "scope", label: "スコープ", keyword: "スコープ" },
      { id: "holographic", label: "ホロサイト", keyword: "ホロサイト" },
      { id: "magnifier", label: "マグニファイア", keyword: "マグニファイア" },
      {
        id: "lens-protector",
        label: "レンズプロテクター",
        keyword: "レンズプロテクター",
      },
    ],
  },
  {
    id: "muzzle",
    label: "マズル",
    layerCategory: "外装",
    children: [
      { id: "suppressor", label: "サプレッサー", keyword: "サプレッサー" },
      {
        id: "muzzle-brake",
        label: "マズルブレーキ",
        keyword: "マズルブレーキ",
      },
      {
        id: "flash-hider",
        label: "フラッシュハイダー",
        keyword: "フラッシュハイダー",
      },
      { id: "tracer", label: "トレーサー", keyword: "トレーサー" },
    ],
  },
  {
    id: "grips",
    label: "グリップ・バイポッド",
    layerCategory: "グリップ",
    children: [
      { id: "foregrip", label: "フォアグリップ", keyword: "フォアグリップ" },
      {
        id: "angled-grip",
        label: "アングルグリップ",
        keyword: "アングルグリップ",
      },
      { id: "hand-stop", label: "ハンドストップ", keyword: "ハンドストップ" },
      {
        id: "pistol-grip",
        label: "ピストルグリップ",
        keyword: "ピストルグリップ",
      },
      {
        id: "bipod",
        label: "バイポッド",
        keyword: "バイポッド",
        layerCategory: "外装",
      },
      {
        id: "bipod-adapter",
        label: "バイポッドアダプター",
        keyword: "バイポッド アダプター",
        layerCategory: "外装",
      },
    ],
  },
  {
    id: "stocks",
    label: "ストック",
    layerCategory: "ストック",
    children: [
      { id: "stock", label: "ストック", keyword: "ストック" },
      { id: "stock-pad", label: "ストックパッド", keyword: "ストックパッド" },
      {
        id: "stock-adapter",
        label: "ストックアダプター",
        keyword: "ストックアダプター",
      },
    ],
  },
  {
    id: "handguards",
    label: "ハンドガード",
    layerCategory: "外装",
    children: [
      { id: "handguard", label: "ハンドガード", keyword: "ハンドガード" },
      { id: "rail-cover", label: "レールカバー", keyword: "レールカバー" },
      { id: "rail-panel", label: "レールパネル", keyword: "レールパネル" },
    ],
  },
  {
    id: "mounts",
    label: "マウント",
    layerCategory: "外装",
    children: [
      {
        id: "scope-mount",
        label: "スコープマウント",
        keyword: "スコープマウント",
      },
      { id: "mount-ring", label: "マウントリング", keyword: "マウントリング" },
      {
        id: "rail-adapter",
        label: "レールアダプター",
        keyword: "レールアダプター",
      },
    ],
  },
  {
    id: "lights",
    label: "ライト・レーザー",
    layerCategory: "外装",
    children: [
      {
        id: "weapon-light",
        label: "ウェポンライト",
        keyword: "ウェポンライト",
      },
      {
        id: "flashlight",
        label: "フラッシュライト",
        keyword: "フラッシュライト",
      },
      {
        id: "remote-switch",
        label: "リモートスイッチ",
        keyword: "リモートスイッチ",
      },
      {
        id: "laser-sight",
        label: "レーザーサイト",
        keyword: "レーザーサイト",
        layerCategory: "光学機器",
      },
      {
        id: "laser-light",
        label: "レーザーライト",
        keyword: "レーザー ライト",
        layerCategory: "光学機器",
      },
    ],
  },
  {
    id: "magazines",
    label: "マガジン",
    layerCategory: "外装",
    children: [
      { id: "magazine", label: "マガジン全般", keyword: "マガジン" },
      {
        id: "standard-magazine",
        label: "ノーマルマガジン",
        keyword: "ノーマルマガジン",
      },
      {
        id: "high-cap-magazine",
        label: "多弾マガジン",
        keyword: "多弾マガジン",
      },
      {
        id: "drum-magazine",
        label: "ドラムマガジン",
        keyword: "ドラムマガジン",
      },
      {
        id: "short-magazine",
        label: "ショートマガジン",
        keyword: "ショートマガジン",
      },
      {
        id: "long-magazine",
        label: "ロングマガジン",
        keyword: "ロングマガジン",
      },
    ],
  },
];
export function partCategory(id: string) {
  for (const group of partCategoryGroups) {
    const category = group.children.find((child) => child.id === id);
    if (category)
      return {
        ...category,
        group: group.label,
        layerCategory: category.layerCategory ?? group.layerCategory,
      };
  }
  return undefined;
}
