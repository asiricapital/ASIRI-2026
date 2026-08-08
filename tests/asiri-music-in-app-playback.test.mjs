import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {safeResumePosition,upsertHistory} from '../asiri-music-staging/src/listening-history-core.js';

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
  assert.match(engine,/JSON\.stringify\(\{uris,position_ms:startPosition\}\)/);
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

test('listening history keeps recent tracks unique and clamps resume points safely',()=>{
  const track=id=>({id,name:'Track '+id,uri:'spotify:track:'+id,artists:[{name:'Artist'}],album:{name:'Album',images:[]}});
  let items=upsertHistory([],track('a'),1000);
  items=upsertHistory(items,track('b'),2000);
  items=upsertHistory(items,track('a'),3000);
  assert.deepEqual(items.map(item=>item.id),['a','b']);
  assert.equal(items[0].listenedAt,3000);
  assert.equal(safeResumePosition(3500,180000),0);
  assert.equal(safeResumePosition(65000,180000),65000);
  assert.equal(safeResumePosition(175000,180000),0);
});

test('Continue Listening resumes the Asiri queue from its saved position',async()=>{
  const html=await read('index.html');
  const app=await read('src/app.js');
  const engine=await read('src/playback-engine-v2.js');
  const history=await read('src/listening-history.js');
  assert.match(html,/id="continueListeningContent"/);
  assert.match(html,/src\/listening-history\.js/);
  assert.match(app,/positionMs=0/);
  assert.match(engine,/position_ms:startPosition/);
  assert.match(history,/source:'resume-history'/);
  assert.match(history,/asiri:open-now-playing/);
});
