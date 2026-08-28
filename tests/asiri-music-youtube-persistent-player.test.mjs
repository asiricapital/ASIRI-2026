import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../asiri-music-staging/'+path,import.meta.url),'utf8');

test('YouTube player stays mounted when navigating away from the YouTube page',async()=>{
  const hub=await read('src/youtube-hub.js');
  const css=await read('youtube-hub.css');
  assert.match(hub,/setPersistentPlayer\(true\)/);
  assert.match(hub,/setPersistentPlayer\(false\)/);
  assert.match(hub,/has-active-video/);
  assert.match(css,/has-active-video:not\(\.is-active\)/);
  assert.match(css,/display:block!important/);
});

test('closing the YouTube player clears the iframe source',async()=>{
  const hub=await read('src/youtube-hub.js');
  assert.match(hub,/function closeVideo\(\)/);
  assert.match(hub,/frame\.src=''/);
  assert.match(hub,/youtubeClosePlayer.*closeVideo/s);
});
