import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {artistMatchInQuery,buildSearchVariants,isSearchCandidate,mergeUniqueTracks} from '../asiri-music-staging/src/search-core.js';

const root=new URL('../asiri-music-staging/',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('universal search accepts generic Arabic terms and punctuation',()=>{
  assert.equal(isSearchCandidate('شيلات'),true);
  assert.equal(isSearchCandidate('طرب سعودي'),true);
  assert.equal(isSearchCandidate('محمد عبده - الأماكن'),true);
  assert.equal(isSearchCandidate('---'),false);
});

test('natural Arabic requests keep the original query and add useful broad variants',()=>{
  const variants=buildSearchVariants('أبغى أغاني شيلات');
  assert.equal(variants[0],'أبغى أغاني شيلات');
  assert.ok(variants.includes('شيلات'));
  assert.ok(variants.includes('شيلة'));
});

test('artist detection is additive and track merging stays unique and playable',()=>{
  const artists=[{id:'short',name:'محمد'},{id:'exact',name:'محمد عبده'}];
  assert.equal(artistMatchInQuery('أجمل موالات محمد عبده',artists)?.id,'exact');
  const track=id=>({id,uri:`spotify:track:${id}`});
  assert.deepEqual(mergeUniqueTracks([track('a'),track('b')],[track('a'),{id:'x',uri:'spotify:track:x',is_playable:false}]).map(item=>item.id),['a','b']);
});

test('search wiring covers Spotify music catalog types without replacing the active queue',async()=>{
  const html=await read('index.html'),search=await read('src/precise-search.js'),css=await read('search.css');
  assert.match(html,/UNIVERSAL SMART SEARCH/);
  assert.match(html,/id="searchStatusText"/);
  assert.match(html,/search\.css\?v=20260808-universal-v1/);
  assert.match(search,/MUSIC_SEARCH_TYPES='track,artist,album,playlist'/);
  assert.match(search,/broadTrackSearch\(bridge,query/);
  assert.match(search,/source:'universal-search',userGesture:true/);
  assert.doesNotMatch(search,/replaceQueue\(/);
  assert.doesNotMatch(search,/لم أتعرف على اسم الفنان داخل العبارة/);
  assert.match(css,/\.search-entity-grid/);
});
