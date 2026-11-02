import test from "node:test";
import assert from "node:assert/strict";
import { updateLayer } from "../lib/attachments.ts";
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const base={id:"base",x:0,y:0,mm:200,width:200,height:100,rotation:0,flip:false};
const part={...base,id:"part",x:140,y:0,mm:40,width:40,height:20,rotation:20,attachedToBase:true};
test("attached parts follow base translation and rotation while loose parts stay put",()=>{
  const loose={...part,id:"loose",attachedToBase:false};
  const moved=updateLayer([base,part,loose],"base",{x:20,y:-10});
  close(moved[1].x,160);close(moved[1].y,-10);assert.deepEqual(moved[2],loose);
  const rotated=updateLayer([base,part],"base",{rotation:90});
  close(rotated[1].x,120);close(rotated[1].y,100);close(rotated[1].rotation,110);
  close(rotated[1].mm,40);
});
test("mirroring the base twice restores attached part geometry",()=>{
  const mirrored=updateLayer([base,part],"base",{flip:true});
  close(mirrored[1].x,20);close(mirrored[1].rotation,-20);assert.equal(mirrored[1].flip,true);
  const restored=updateLayer(mirrored,"base",{flip:false});
  for(const key of ["x","y","rotation","mm"])close(restored[1][key],part[key]);
});
test("parts remain individually draggable and image edits do not shift attached parts",()=>{
  const edited=updateLayer([base,part],"part",{x:30});assert.equal(edited[1].x,30);
  const cropped=updateLayer([base,part],"base",{src:"crop",x:20,y:30});assert.deepEqual(cropped[1],part);
});
