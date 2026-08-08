import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../asiri-music-staging/',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Asiri Music requests the official Spotify in-app playback permissions',async()=>{
  const app=await read('src/app.js');
  for(const scope of ['streaming','user-read-playback-state','user-modify-playback-state']){
    assert.match(app,new RegExp(`['"]${scope}['"]`));
  }
  assert.doesNotMatch(app,/scopeVersion|PLAYBACK_AUTH_VERSION/);
  assert.match(app,/ensurePlaybackEngine\(\)\.connect\(\)/);
});

test('the Spotify Web Playback SDK and Asiri playback engine load before the app',async()=>{
  const html=await read('index.html');
  const sdk=html.indexOf('https://sdk.scdn.co/spotify-player.js');
  const engine=html.indexOf('src/playback-engine-v2.js');
  const app=html.indexOf('src/app.js');
  assert.ok(sdk>=0&&engine>sdk&&app>engine);
  assert.match(html,/▶ تشغيل هنا/);
});

test('the regular iPhone shell no longer forces native Spotify playback',async()=>{
  const shell=await read('src/os-shell.js');
  const css=await read('stable-web.css');
  assert.doesNotMatch(shell,/native-playback/);
  assert.doesNotMatch(css,/\.player\s*\{[^}]*display\s*:\s*none/i);
});

test('saved library tracks use the Asiri playback queue',async()=>{
  const library=await read('src/library.js');
  assert.match(library,/play\.textContent='▶ تشغيل هنا'/);
  assert.match(library,/bridge\.playQueue\(\[track\]/);
  assert.match(library,/source:'saved-session',userGesture:true/);
});
