import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the branch-backed /asiri-music entry serves the current Music build',async()=>{
  const staging=await readFile('asiri-music-staging/index.html','utf8');
  const live=await readFile('asiri-music/index.html','utf8');
  const stagingCallback=await readFile('asiri-music-staging/callback.html','utf8');
  const liveCallback=await readFile('asiri-music/callback.html','utf8');
  const base='  <base href="../asiri-music-staging/">\n';
  assert.match(live,/id="smartMixPanel"/);
  assert.match(live,/النسخة الحية عبر GitHub Pages/);
  assert.match(live,/<base href="\.\.\/asiri-music-staging\/">/);
  assert.equal(live.replace(base,''),staging);
  assert.equal(liveCallback,stagingCallback);
  assert.match(liveCallback,/redirectUri=new URL\('callback\.html',location\.href\)\.href/);
  assert.match(liveCallback,/location\.replace\('\.\/'\)/);
});
