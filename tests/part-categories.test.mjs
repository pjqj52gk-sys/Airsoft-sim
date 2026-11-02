import test from 'node:test';
import assert from 'node:assert/strict';
import { partCategoryGroups, partCategory } from '../lib/part-categories.ts';
import { searchParams } from '../lib/rakuten.ts';
test('category shortcuts have unique IDs, valid search terms and supported editor categories',()=>{
  const ids=new Set();
  const editorCategories=['光学機器','グリップ','ストック','外装','その他'];
  for(const group of partCategoryGroups){
    assert.ok(editorCategories.includes(group.layerCategory));
    for(const category of group.children){
      assert.equal(ids.has(category.id),false);ids.add(category.id);
      assert.equal(searchParams(new URLSearchParams({q:category.keyword})).keyword,category.keyword);
      assert.equal(partCategory(category.id).layerCategory,group.layerCategory);
    }
  }
  assert.equal(partCategory('unknown'),undefined);
});
test('optics and muzzle shortcuts search the requested subtype and preserve import grouping',()=>{
  for(const [id,keyword,group,layerCategory] of [
    ['dot-sight','ドットサイト','光学機器','光学機器'],['scope','スコープ','光学機器','光学機器'],['holographic','ホロサイト','光学機器','光学機器'],['suppressor','サプレッサー','マズル','外装'],['muzzle-brake','マズルブレーキ','マズル','外装'],['foregrip','フォアグリップ','グリップ','グリップ']
  ]) assert.deepEqual(partCategory(id),{id,label:keyword,keyword,group,layerCategory});
});
