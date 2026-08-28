import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../asiri-music-staging/'+path,import.meta.url),'utf8');

test('YouTube personal library uses the existing read-only OAuth session',async()=>{
  const source=await read('src/youtube-library.js');
  assert.match(source,/youtube-auth\.js/);
  assert.match(source,/getYoutubeToken/);
  assert.match(source,/isYoutubeSignedIn/);
  assert.match(source,/myRating:'like'/);
  assert.match(source,/mine:'true'/);
  assert.match(source,/subscriptions/);
});

test('YouTube library merges liked videos, playlists and subscriptions into ASIRI library UI',async()=>{
  const source=await read('src/youtube-library.js');
  assert.match(source,/UNIFIED LIBRARY • YOUTUBE/);
  assert.match(source,/مكتبة YouTube داخل ASIRI/);
  assert.match(source,/data-youtube-library-tab="liked"/);
  assert.match(source,/data-youtube-library-tab="playlists"/);
  assert.match(source,/data-youtube-library-tab="subscriptions"/);
  assert.match(source,/AsiriYouTubeHub\?\.playVideo/);
});

test('unified library styling stays responsive and within existing green identity',async()=>{
  const css=await read('unified-library.css');
  assert.match(css,/#1ed760/);
  assert.match(css,/youtube-library-grid/);
  assert.match(css,/@media\(max-width:700px\)/);
});
