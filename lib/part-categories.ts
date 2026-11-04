export type PartCategory = {
  id: string;
  label: string;
  keyword: string;
  genreId?: string;
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
    label: "フォアグリップ",
    layerCategory: "グリップ",
    children: [
      { id: "foregrip", label: "フォアグリップ", keyword: "フォアグリップ" },
      {
        id: "angled-grip",
        label: "アングルグリップ",
        keyword: "アングルグリップ",
      },
      { id: "hand-stop", label: "ハンドストップ", keyword: "ハンドストップ" },
    ],
  },
  {
    id: "pistol-grips",
    label: "ピストルグリップ",
    layerCategory: "グリップ",
    children: [
      {
        id: "pistol-grip",
        label: "ピストルグリップ",
        keyword: "ピストルグリップ",
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
    label: "ライト",
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
    ],
  },
  {
    id: "bipods",
    label: "バイポッド",
    layerCategory: "外装",
    children: [
      { id: "bipod", label: "バイポッド", keyword: "バイポッド" },
      {
        id: "bipod-adapter",
        label: "バイポッドアダプター",
        keyword: "バイポッド アダプター",
      },
    ],
  },
  {
    id: "lasers",
    label: "レーザーサイト",
    layerCategory: "光学機器",
    children: [
      { id: "laser-sight", label: "レーザーサイト", keyword: "レーザーサイト" },
      {
        id: "laser-light",
        label: "レーザーライト",
        keyword: "レーザー ライト",
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
        layerCategory: group.layerCategory,
      };
  }
  return undefined;
}
