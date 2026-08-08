import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('GitHub Pages publishes the current Asiri Music build at /asiri-music',async()=>{
  const workflow=await readFile('.github/workflows/pages.yml','utf8');
  const music=await readFile('asiri-music-staging/index.html','utf8');
  const callback=await readFile('asiri-music-staging/callback.html','utf8');
  assert.match(workflow,/"asiri-music-staging\/\*\*"/);
  assert.match(workflow,/mkdir -p _site\/asiri-music/);
  assert.match(workflow,/cp -R asiri-music-staging\/\. _site\/asiri-music\//);
  assert.match(workflow,/test -s _site\/asiri-music\/callback\.html/);
  assert.match(workflow,/id="smartMixPanel"/);
  assert.match(music,/النسخة الحية عبر GitHub Pages/);
  assert.match(music,/>Live<\/b>/);
  assert.match(callback,/redirectUri=new URL\('callback\.html',location\.href\)\.href/);
  assert.match(callback,/location\.replace\('\.\/'\)/);
});
