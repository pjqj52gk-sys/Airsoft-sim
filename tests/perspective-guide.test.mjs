import test from "node:test";
import assert from "node:assert/strict";
import { makeGuide,rotate,textureTransform,initialCubeFace,yControls,guideFromY,guidePoint } from "../lib/perspective-guide.ts";
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
test("Y handles preserve the initial angled cube and each arm follows its dragged endpoint",()=>{
  const template=makeGuide(initialCubeFace(400,300),400,300,1);
  const handles=yControls(template);
  const original=guideFromY(handles,template);
  [...original.front,...original.back].forEach((p,i)=>{
    const expected=[...template.front,...template.back][i];
    close(p.x,expected.x);close(p.y,expected.y);close(p.z,expected.z);
  });
  for(const index of [1,2,3]){
    const changed=handles.map((p,i)=>i===index?{x:p.x+5,y:p.y+4}:p);
    const actual=yControls(guideFromY(changed,template));
    actual.forEach((p,i)=>{close(p.x,changed[i].x);close(p.y,changed[i].y);});
  }
});
test("moving the Y centre translates all eight projected corners without changing shape",()=>{
  const template=makeGuide(initialCubeFace(400,300),400,300,1);
  const handles=yControls(template);
  const moved=guideFromY(handles.map((p)=>({x:p.x+12,y:p.y-8})),template);
  [...moved.front,...moved.back].forEach((p,i)=>{
    const before=guidePoint(template,[...template.front,...template.back][i]),after=guidePoint(moved,p);
    close(after.x,before.x+12);close(after.y,before.y-8);
  });
  assert.throws(()=>guideFromY([handles[0],handles[0],handles[2],handles[3]],template));
});
