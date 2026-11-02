import test from "node:test";
import assert from "node:assert/strict";
import { productPhotos } from "../lib/catalog-photos.mjs";
import { catalogImageUrl } from "../lib/catalog-image.ts";
const base = "https://www.tokyo-marui.co.jp/appimg/option/";
test("product photos exclude the hero banner and slider-menu thumbnails", () => {
  const html = `<meta property="og:image" content="${base}banner.jpg"><img src="${base}banner.jpg"><ul class="products-Slider_List"><li><img src="${base}photo1.jpg" width="728"></li><li><img src="${base}photo2.jpg"></li></ul><ul class="products-Slider_Menu"><li><img src="${base}thumb.jpg" width="108"></li></ul>`;
  assert.deepEqual(productPhotos(html), [
    base + "photo1.jpg",
    base + "photo2.jpg",
  ]);
  assert.deepEqual(productPhotos(`<img src="${base}banner.jpg">`), []);
});
test("the gallery picks the original or largest listed image without guessing URLs", () => {
  const html = `<ul class='other products-Slider_List'><li><img src='${base}small.jpg' data-original='${base}original.jpg'></li><li><img src='${base}tiny.jpg' srcset='${base}medium.jpg 728w, ${base}large.jpg 1600w'></li><li><img src='${base}original.jpg'></li><li><img src='http://127.0.0.1/private.png'></li></ul>`;
  assert.deepEqual(productPhotos(html), [
    base + "original.jpg",
    base + "large.jpg",
  ]);
});
test("import and preview URLs carry the selected original's revision to avoid old banner caches", () => {
  const item = {
    id: "456",
    images: [base + "photo1.jpg", base + "photo2.jpg"],
  };
  assert.equal(
    catalogImageUrl(item, 1),
    "/api/part-image?id=456&photo=1&v=photo2.jpg",
  );
  assert.equal(catalogImageUrl(item, 99), catalogImageUrl(item, 0));
});
