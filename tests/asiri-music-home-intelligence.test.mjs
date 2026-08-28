import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../asiri-music-staging/',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Music OS loads the one-tap intelligence module without replacing the current shell',async()=>{
  const shell=await read('src/os-shell.js');
  const module=await read('src/home-intelligence.js');
  assert.match(shell,/import '\.\/home-intelligence\.js\?v=20260828-v1'/);
  assert.match(module,/id='asiriOneTap'|section\.id='asiriOneTap'/);
  assert.match(module,/ASIRI ONE-TAP/);
  assert.match(module,/home-intelligence\.css\?v=20260828-v1/);
});

test('one-tap home actions reuse existing session, Smart Mix, and AI DJ engines',async()=>{
  const module=await read('src/home-intelligence.js');
  assert.match(module,/aiDj\.lastSession/);
  assert.match(module,/bridge\.playQueue\(session\.tracks/);
  assert.match(module,/asiri:smart-mix-play-request/);
  assert.match(module,/asiri:ai-dj-prompt/);
  assert.match(module,/asiri:open-now-playing/);
});

test('Smart Mix can build on demand and notify the home intelligence layer',async()=>{
  const smartMix=await read('src/smart-mix.js');
  assert.match(smartMix,/async function playOrBuildMix\(\)/);
  assert.match(smartMix,/if\(!state\.tracks\.length\)await buildMix\(\)/);
  assert.match(smartMix,/asiri:smart-mix-updated/);
  assert.match(smartMix,/asiri:smart-mix-play-request/);
  assert.match(smartMix,/window\.AsiriSmartMix=/);
});

test('one-tap styling stays inside the existing green Music OS visual language',async()=>{
  const css=await read('home-intelligence.css');
  assert.match(css,/\.asiri-one-tap/);
  assert.match(css,/#1ed760/);
  assert.match(css,/@media\(max-width:620px\)/);
});
