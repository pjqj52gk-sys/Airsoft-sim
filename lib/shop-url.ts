export function shopUrl(input: string) {
  if (typeof input !== "string" || input.length > 2048)
    throw new Error("商品ページのURLを入力してください。");
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("https:// で始まるURLを入力してください。");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password ||
    !host.includes(".") ||
    host.includes(":") ||
    /^[\d.]+$/.test(host) ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid|example)\.?$/.test(host)
  )
    throw new Error("公開されているHTTPSの商品ページを指定してください。");
  url.hash = "";
  return url;
}
export function publicIPv4(address: string) {
  const p = address.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return false;
  const [a, b, c] = p;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}
