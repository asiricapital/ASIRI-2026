import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const handoff=fs.readFileSync('asiri-music-staging/src/youtube-premium-handoff.js','utf8');
const shell=fs.readFileSync('asiri-music-staging/src/os-shell.js','utf8');

test('Music OS loads YouTube Premium background handoff',()=>{
  assert.match(shell,/youtube-premium-handoff\.js/);
});

test('Premium handoff keeps the exact YouTube video and prefers the YouTube app',()=>{
  assert.match(handoff,/youtube:\/\/watch\?v=/);
  assert.match(handoff,/https:\/\/www\.youtube\.com\/watch\?v=/);
  assert.match(handoff,/youtubeOpenExternal/);
  assert.match(handoff,/استمر بالخلفية عبر YouTube Premium/);
});

test('Premium handoff has a safe web fallback when the app scheme is unavailable',()=>{
  assert.match(handoff,/visibilityState==='visible'/);
  assert.match(handoff,/setTimeout/);
  assert.match(handoff,/900/);
});
