import test from 'node:test';
import assert from 'node:assert/strict';
import { fitImageViewport, moveGuideControls, zoomViewport } from '../lib/edit-viewport.ts';
import { lassoPolygon } from '../lib/image-edit.ts';
test('cube controls can move beyond every edge of the image without changing the Y shape', () => {
  const points=[{x:20,y:30},{x:0,y:10},{x:70,y:0},{x:20,y:80}];
  const moved=moveGuideControls(points,0,-100,200);
  assert.deepEqual(moved,points.map(p=>({x:p.x-100,y:p.y+200})));
  assert.deepEqual(moveGuideControls(points,1,-50,-60)[1],{x:-50,y:-50});
  assert.deepEqual(moveGuideControls(points,1,-50,-60)[2],points[2]);
});
test('fit includes the image and all off-image cube corners with usable margins', () => {
  const corners=[{x:-300,y:-400},{x:1800,y:1200}];
  const view=fitImageViewport(500,436,corners);
  for (const p of [...corners,{x:0,y:0},{x:500,y:436}]) {
    assert.ok(p.x>view.x && p.x<view.x+view.w && p.y>view.y && p.y<view.y+view.h);
  }
});
test('zoom keeps the pointer anchored and enforces usable zoom limits', () => {
  const view={x:-100,y:-80,w:700,h:600}, anchor={x:120,y:160};
  const next=zoomViewport(view,.8,anchor,50,10000);
  assert.ok(Math.abs((anchor.x-view.x)/view.w-(anchor.x-next.x)/next.w)<1e-10);
  assert.ok(Math.abs((anchor.y-view.y)/view.h-(anchor.y-next.y)/next.h)<1e-10);
  assert.equal(zoomViewport(view,.0001,anchor,50,10000).w,50);
  assert.equal(zoomViewport(view,1000,anchor,50,10000).w,10000);
});
test('freehand accepts curved, concave and self-crossing selections while rejecting clicks and straight lines', () => {
  for (const path of [[{x:0,y:0},{x:80,y:0},{x:40,y:40}], [{x:0,y:0},{x:80,y:80},{x:0,y:80},{x:80,y:0}], [{x:0,y:0},{x:80,y:0},{x:40,y:10},{x:80,y:80},{x:0,y:80}]]) assert.equal(lassoPolygon(path),path);
  for(const path of [[],[{x:0,y:0}],[{x:0,y:0},{x:1,y:1},{x:2,y:2}],[{x:0,y:0},{x:1,y:2},{x:Infinity,y:5}]]) assert.throws(()=>lassoPolygon(path));
});
