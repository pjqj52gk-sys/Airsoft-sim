import { request } from "node:https";
import { lookup } from "node:dns/promises";
import { createGunzip, createInflate, createBrotliDecompress } from "node:zlib";
import { shopUrl, publicIPv4 } from "./shop-url.ts";

export class ShopReadError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
export async function publicAddresses(
  host: string,
  resolver: (host: string) => Promise<string[]> = async (host) =>
    (await lookup(host, { all: true, family: 4 })).map((item) => item.address),
) {
  let timer: ReturnType<typeof setTimeout>;
  const addresses = await Promise.race([
    resolver(host),
    new Promise<string[]>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(new ShopReadError("timeout", "接続がタイムアウトしました。")),
        4000,
      );
    }),
  ])
    .catch((error) => {
      throw error instanceof ShopReadError
        ? error
        : new ShopReadError(
            "network",
            "ショップに接続できませんでした。商品URLを確認してください。",
          );
    })
    .finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some((address) => !publicIPv4(address)))
    throw new ShopReadError(
      "blocked",
      "公開されているショップのURLを指定してください。",
    );
  return addresses;
}
type RemoteFile = { url: string; type: string; bytes: Buffer };
export async function readShopFile(
  input: string,
  kind: "page" | "image",
  redirects = 0,
  deadline = Date.now() + 16000,
): Promise<RemoteFile> {
  const url = shopUrl(input);
  if (redirects > 3)
    throw new ShopReadError(
      "redirect",
      "転送が多いため取得できません。転送先の商品URLを使ってください。",
    );
  const addresses = await publicAddresses(url.hostname);
  const remaining = deadline - Date.now();
  if (remaining <= 0)
    throw new ShopReadError("timeout", "接続がタイムアウトしました。");
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        family: 4,
        agent: false,
        signal: AbortSignal.timeout(remaining),
        lookup: ((_hostname, options, done) => {
          if (typeof options === "object" && options.all)
            done(
              null,
              addresses.map((address) => ({ address, family: 4 })),
            );
          else done(null, addresses[0], 4);
        }) as import("node:net").LookupFunction,
        headers: {
          "User-Agent": "AirsoftCustomStudio/0.5 (product-image-import)",
          Accept:
            kind === "page"
              ? "text/html,application/xhtml+xml"
              : "image/jpeg,image/png,image/webp,image/gif",
          "Accept-Language": "ja,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        if (
          [301, 302, 303, 307, 308].includes(status) &&
          res.headers.location
        ) {
          res.destroy();
          try {
            const next = shopUrl(new URL(res.headers.location, url).href);
            readShopFile(next.href, kind, redirects + 1, deadline).then(
              resolve,
              reject,
            );
          } catch (e) {
            reject(e);
          }
          return;
        }
        if ([401, 403, 429, 503].includes(status)) {
          res.destroy();
          reject(
            new ShopReadError(
              "restricted",
              "このサイトは自動取得を制限しています。画像URLまたは画像ファイルから追加してください。",
            ),
          );
          return;
        }
        if (status < 200 || status >= 300) {
          res.destroy();
          reject(
            new ShopReadError(
              "unavailable",
              "ページを取得できません。商品URLを確認してください。",
            ),
          );
          return;
        }
        const type = res.headers["content-type"] || "";
        const allowed =
          kind === "page"
            ? /^(text\/html|application\/xhtml\+xml)\b/i.test(type)
            : /^image\/(jpeg|png|webp|gif)\b/i.test(type);
        if (!allowed) {
          res.destroy();
          reject(
            new ShopReadError(
              "format",
              kind === "page"
                ? "商品ページのURLを指定してください。"
                : "PNG / JPEG / WebP / GIF の画像URLを指定してください。",
            ),
          );
          return;
        }
        const max = kind === "page" ? 3 * 1024 * 1024 : 4 * 1024 * 1024;
        let raw = 0,
          total = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          raw += chunk.length;
          if (raw > max) {
            req.destroy(
              new ShopReadError(
                "large",
                "取得するデータが大きすぎます。画像ファイルから追加してください。",
              ),
            );
          }
        });
        const encoding = res.headers["content-encoding"];
        const decoder =
          encoding === "gzip"
            ? createGunzip()
            : encoding === "deflate"
              ? createInflate()
              : encoding === "br"
                ? createBrotliDecompress()
                : null;
        const stream = decoder ? res.pipe(decoder) : res;
        stream.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > max) {
            req.destroy(
              new ShopReadError(
                "large",
                "取得するデータが大きすぎます。画像ファイルから追加してください。",
              ),
            );
            if (decoder) decoder.destroy();
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () =>
          resolve({ url: url.href, type, bytes: Buffer.concat(chunks) }),
        );
        stream.on("error", reject);
        res.on("error", reject);
      },
    );
    req.on("error", (e) =>
      reject(
        e instanceof ShopReadError
          ? e
          : new ShopReadError(
              "network",
              "接続できませんでした。画像URLまたは画像ファイルから追加してください。",
            ),
      ),
    );
    req.end();
  });
}
export function decodeShopHtml(file: RemoteFile) {
  const head = file.bytes.subarray(0, 8192).toString("latin1");
  const charset =
    file.type.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] ||
    head.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] ||
    "utf-8";
  try {
    return new TextDecoder(charset).decode(file.bytes);
  } catch {
    return file.bytes.toString("utf8");
  }
}
