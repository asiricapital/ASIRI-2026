import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../asiri-music-staging/'+path,import.meta.url),'utf8');

test('unified search wires Spotify and the official YouTube provider side by side',async()=>{
  const search=await read('src/precise-search.js');
  const provider=await read('src/youtube-search-provider.js');
  const css=await read('unified-search.css');
  assert.match(search,/Spotify \+ YouTube/);
  assert.match(search,/searchYouTubeVideos/);
  assert.match(search,/unified-results-grid/);
  assert.match(provider,/www\.googleapis\.com\/youtube\/v3\/search/);
  assert.match(provider,/type:'video'/);
  assert.match(css,/grid-template-columns/);
});

test('YouTube search key remains local and is never committed as a literal credential',async()=>{
  const provider=await read('src/youtube-search-provider.js');
  const hub=await read('src/youtube-hub.js');
  assert.match(provider,/localStorage/);
  assert.match(hub,/مقيّدًا بنطاق asiricapital\.github\.io/);
  assert.doesNotMatch(provider,/AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(hub,/AIza[0-9A-Za-z_-]{20,}/);
});

test('YouTube discovery can render official API results inside Asiri and play them through the existing hub',async()=>{
  const hub=await read('src/youtube-hub.js');
  assert.match(hub,/searchYouTubeVideos/);
  assert.match(hub,/renderInline/);
  assert.match(hub,/playVideo\(video\.id,video\.title\)/);
  assert.match(hub,/window\.AsiriYouTubeHub/);
});

test('AI DJ routes concert and video intents to YouTube when search is connected',async()=>{
  const router=await read('src/ai-dj-source-router.js');
  const provider=await read('src/youtube-search-provider.js');
  const shell=await read('src/os-shell.js');
  assert.match(router,/prefersYoutube/);
  assert.match(router,/hasYoutubeSearchKey/);
  assert.match(router,/searchYouTubeVideos/);
  assert.match(router,/AsiriYouTubeHub\?\.playVideo/);
  assert.match(provider,/حفلة|حفله/);
  assert.match(shell,/ai-dj-source-router\.js/);
});
