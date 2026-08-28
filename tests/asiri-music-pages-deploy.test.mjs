import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the branch-backed /asiri-music entry loads the canonical Music build without duplicating it',async()=>{
  const staging=await readFile('asiri-music-staging/index.html','utf8');
  const live=await readFile('asiri-music/index.html','utf8');
  const stagingCallback=await readFile('asiri-music-staging/callback.html','utf8');
  const liveCallback=await readFile('asiri-music/callback.html','utf8');
  assert.match(staging,/id="smartMixPanel"/);
  assert.match(staging,/id="playbackRecovery"/);
  assert.match(staging,/playback-engine-v2\.js\?v=20260808-playback-v7/);
  assert.match(live,/fetch\('\.\.\/asiri-music-staging\/index\.html'/);
  assert.match(live,/<base href=\\"\.\.\/asiri-music-staging\/\\">/);
  assert.match(live,/document\.write\(html\)/);
  assert.equal(liveCallback,stagingCallback);
  assert.match(liveCallback,/redirectUri=new URL\('callback\.html',location\.href\)\.href/);
  assert.match(liveCallback,/location\.replace\('\.\/'\)/);
});
