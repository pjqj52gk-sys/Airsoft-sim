import type { CatalogProduct } from "./catalog-match.ts";
type Evidence = {
  powers: string[];
  modes: string[];
  ages: string[];
  generations: string[];
};
const unique = (values: string[]) => [...new Set(values)];
const roman: Record<string, string> = {
  I: "1",
  II: "2",
  III: "3",
  IV: "4",
  V: "5",
};
function evidence(input: string): Evidence {
  const text = input.normalize("NFKC").toUpperCase();
  const modes: string[] = [];
  const add = (mode: string, pattern: RegExp) => {
    if (pattern.test(text)) modes.push(mode);
  };
  add("nextgeneration", /次世代|NEXT[\s-]*GEN(?:ERATION)?|\bNGRS\b/);
  add("highcycle", /ハイサイ(?:クル)?|HIGH[\s-]*CYCLE|\bHC\b/);
  add("plus", /電動ガン(?:プラス|\s*PLUS|\s*\+)/);
  add("boys", /\bBOYS\b|ボーイズ/);
  add("lightpro", /ライトプロ|LIGHT[\s-]*PRO/);
  add(
    "electric-blowback",
    /電動ブローバック|ELECTRIC[\s-]*BLOW[\s-]*BACK|\bEBB\b/,
  );
  if (
    modes.includes("electric-blowback") &&
    /フルオート|FULL[\s-]*AUTO/.test(text)
  )
    modes[modes.indexOf("electric-blowback")] = "electric-blowbackauto";
  add("handgun", /電動(?:ガン\s*)?ハンドガン|電動ガン\s*ハンドガンタイプ/);
  add("compact", /電動コンパクト/);
  add("mini", /ミニ電動ガン/);
  add("rseries", /電動ガン\s*Rシリーズ/);
  if (!modes.includes("plus"))
    add("standard", /電動.*(?:スタンダード|標準)|スタンダード.*電動/);
  const electric = modes.length > 0 || /電動|\b(?:AEG|ERG)\b/.test(text);
  const gas =
    /ガスガン|ガス式|ガスブロ|ガスリボルバー|ガスショットガン|固定スライド|\bNBB\b|\bCO2\b|GAS[\s-]*(?:BLOW[\s-]*BACK|GUN|POWERED)|\bGBB(?:R)?\b/.test(
      text,
    );
  const air =
    /エアコキ|エアー?(?:コッキング|ハンドガン|ライフル|リボルバー|ショットガン)|ボルトアクション|BOLT[\s-]*ACTION|SPRING[\s-]*(?:POWERED|GUN)/.test(
      text,
    );
  if (gas) {
    add("gas-co2", /\bCO2\b/);
    add("gas-fixed", /固定スライド|FIXED[\s-]*SLIDE|\bNBB\b/);
    add("gas-blowback", /ガスブロ|GAS[\s-]*BLOW[\s-]*BACK|\bGBB(?:R)?\b/);
    add("gas-rseries", /ガスブローバック[・\s-]*Rシリーズ/);
    if (modes.includes("gas-rseries"))
      modes.splice(
        modes.indexOf("gas-blowback"),
        modes.includes("gas-blowback") ? 1 : 0,
      );
  }
  const ages = unique(
    [...text.matchAll(/(?<!\d)(10|14|18)\s*(?:[才歳]|禁)/g)].map((m) => m[1]),
  );
  const generations = unique([
    ...[
      ...text.matchAll(
        /(?<![A-Z])GEN(?:ERATION)?[.\s-]*(III|II|IV|I|V|[1-5])\b/g,
      ),
    ].map((m) => "gen" + (roman[m[1]] || m[1])),
    ...[
      ...text.matchAll(
        /第\s*([1-5])\s*世代|([1-5])(?:ST|ND|RD|TH)?\s*ジェネレーション|ジェネレーション\s*([1-5])/g,
      ),
    ].map((m) => "gen" + (m[1] || m[2] || m[3])),
    ...[...text.matchAll(/\b(?:V|VER(?:SION)?[.\s-]*)([1-9])\b/g)].map(
      (m) => "v" + m[1],
    ),
  ]);
  return {
    powers: [
      electric ? "electric" : "",
      gas ? "gas" : "",
      air ? "air" : "",
    ].filter(Boolean),
    modes: unique(modes),
    ages,
    generations,
  };
}
const cache = new WeakMap<CatalogProduct, Evidence>();
function catalogEvidence(product: CatalogProduct): Evidence {
  const cached = cache.get(product);
  if (cached) return cached;
  const result = evidence(product.name + " " + (product.series || ""));
  const path = new URL(product.url).pathname;
  if (product.manufacturer === "東京マルイ") {
    const match = path.match(
      /^\/products\/(electric|gas|aircocking)\/([^/]+)\//,
    );
    if (match) {
      const [, power, group] = match;
      result.powers = [power === "aircocking" ? "air" : power];
      if (power === "electric") {
        const mode = /【電動ガンプラス】/.test(product.name)
          ? "plus"
          : (
              {
                standard: "standard",
                nextgeneration: "nextgeneration",
                highcycle: "highcycle",
                boys: "boys",
                lightpro: "lightpro",
                handgun: "handgun",
                compact: "compact",
                blowback: "electric-blowback",
                blowbackauto: "electric-blowbackauto",
                mini: "mini",
                rseries: "rseries",
              } as Record<string, string>
            )[group];
        result.modes = mode ? [mode] : [];
      }
      const age = group.match(/(?:handgun|rifle_smg)(10|18)$/)?.[1];
      if (age) result.ages = [age];
    }
  }
  cache.set(product, result);
  return result;
}
// A barcode is strong identity evidence, but must not override explicit variant conflicts.
export function bodyVariantMatcher(title: string) {
  const actual = evidence(title);
  return (product: CatalogProduct, nameOnly = false) => {
    if (product.category !== "本体") return true;
    const expected = catalogEvidence(product);
    if (actual.powers.length > 1 || actual.ages.length > 1) return false;
    if (
      actual.powers.length &&
      expected.powers.length &&
      actual.powers[0] !== expected.powers[0]
    )
      return false;
    if (
      actual.ages.length &&
      expected.ages.length &&
      actual.ages[0] !== expected.ages[0]
    )
      return false;
    if (
      actual.modes.some(
        (mode) =>
          !expected.modes.includes(mode) &&
          !(mode === "standard" && expected.modes.includes("plus")) &&
          !(mode === "gas-blowback" && expected.modes.includes("gas-rseries")),
      )
    )
      return false;
    if (actual.generations.some((g) => !expected.generations.includes(g)))
      return false;
    if (
      nameOnly &&
      expected.generations.some((g) => !actual.generations.includes(g))
    )
      return false;
    return true;
  };
}
export function bodyVariantCompatible(
  title: string,
  product: CatalogProduct,
  nameOnly = false,
) {
  return bodyVariantMatcher(title)(product, nameOnly);
}

export function bodyVariantIdentity(product: CatalogProduct) {
  return JSON.stringify(catalogEvidence(product));
}
