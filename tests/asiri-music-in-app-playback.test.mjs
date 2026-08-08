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
  const sdkReady=html.indexOf('onSpotifyWebPlaybackSDKReady');
  const engine=html.indexOf('src/playback-engine-v2.js');
  const app=html.indexOf('src/app.js');
  assert.ok(sdkReady>=0&&sdk>sdkReady&&engine>sdk&&app>engine);
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

test('Now Playing is wired to the in-app player with seek and taste controls',async()=>{
  const html=await read('index.html');
  const app=await read('src/app.js');
  const nowPlaying=await read('src/now-playing.js');
  assert.match(html,/id="nowPlaying"/);
  assert.match(html,/id="nowSeek"/);
  assert.match(html,/src\/now-playing\.js/);
  assert.match(app,/seekPlayback:async positionMs=>ensurePlaybackEngine\(\)\.seek\(positionMs\)/);
  assert.match(nowPlaying,/asiri:player-state/);
  assert.match(nowPlaying,/AsiriTasteEngine\.rate\(currentTrack,'like'\)/);
});

test('continuous playback sends the remaining Asiri queue to Spotify',async()=>{
  const engine=await read('src/playback-engine-v2.js');
  assert.match(engine,/this\.queue\.slice\(this\.index\)\.map/);
  assert.match(engine,/JSON\.stringify\(\{uris,position_ms:0\}\)/);
  assert.doesNotMatch(engine,/uris:\[track\.uri/);
  assert.match(engine,/التشغيل المستمر مفعّل/);
});

test('Now Playing exposes an interactive Up Next queue inside Asiri',async()=>{
  const html=await read('index.html');
  const nowPlaying=await read('src/now-playing.js');
  const library=await read('src/library.js');
  assert.match(html,/id="nowQueueToggle"/);
  assert.match(html,/id="nowQueueList"/);
  assert.match(nowPlaying,/asiri:queue-changed/);
  assert.match(nowPlaying,/source:'now-playing-up-next'/);
  assert.match(library,/sessionAction\('▶ تشغيل هنا','session-play'/);
});
