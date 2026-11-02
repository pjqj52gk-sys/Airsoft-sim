import test from "node:test";
import assert from "node:assert/strict";
import { makeGuide,rotate,textureTransform } from "../lib/perspective-guide.ts";
import { matchesPart } from "../lib/part-search.ts";
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const points=[{x:30,y:20},{x:200,y:35},{x:190,y:140},{x:20,y:160}];
test("the cube front face projects exactly onto the selected image corners",()=>{
  const guide=makeGuide(points,250,180,.5);
  guide.front.forEach((p,i)=>{close(guide.cx+guide.focal*p.x/p.z,points[i].x);close(guide.cy+guide.focal*p.y/p.z,points[i].y);});
});
test("front alignment rotates the selected plane to constant depth",()=>{
  const guide=makeGuide(points,250,180,.5);
  const rotated=guide.front.map((p)=>rotate(p,guide.flat));
  rotated.forEach((p)=>close(p.z,rotated[0].z));
  close(rotated[0].y,rotated[1].y);
});
test("the projective CSS matrix maps all texture corners to the cube face",()=>{
  const m=textureTransform(points,400,200).slice(9,-1).split(',').map(Number);
  [[0,0],[400,0],[400,200],[0,200]].forEach(([x,y],i)=>{const w=m[3]*x+m[7]*y+m[15];close((m[0]*x+m[4]*y+m[12])/w,points[i].x);close((m[1]*x+m[5]*y+m[13])/w,points[i].y);});
});
test("catalog search matches Japanese full-width text and multiple terms",()=>{
  assert.equal(matchesPart("ｍｔｄ マルイ",["MTD（マルイタクティカルドットサイト）"]),true);
  assert.equal(matchesPart("123 サイレンサー",["タクティカルサイレンサー","123 mm"]),true);
  assert.equal(matchesPart("ストック",["フォアグリップ"]),false);
});
