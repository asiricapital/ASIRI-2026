import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const engineUrl=new URL('../asiri-music-staging/src/playback-engine-v2.js',import.meta.url);

async function loadEngine(){
  const source=await readFile(engineUrl,'utf8');
  const window={dispatchEvent(){}};
  const quietConsole={...console,warn(){}};
  class StubCustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail}}
  vm.runInNewContext(source,{window,EventTarget,CustomEvent:StubCustomEvent,console:quietConsole,setTimeout,clearTimeout},{filename:'playback-engine-v2.js'});
  return window.AsiriPlaybackEngineV2;
}

const track=id=>({id,name:`Track ${id}`,uri:`spotify:track:${id}`,artists:[{name:'Artist'}],album:{images:[]}});

test('Asiri playback starts a healthy remaining queue on the selected device',async()=>{
  const Engine=await loadEngine(),calls=[];
  const engine=new Engine({
    getToken:async()=>'token',
    api:async(path,options={})=>{calls.push({path,options})}
  });
  engine.emit=()=>{};
  engine.prepareDevice=async()=>'asiri-device';
  engine.setQueue([track('a'),track('b')],{startIndex:0});
  const played=await engine.playIndex(0);
  const starts=calls.filter(call=>call.path.startsWith('/me/player/play'));
  assert.equal(played.id,'a');
  assert.equal(starts.length,1);
  assert.deepEqual(JSON.parse(starts[0].options.body).uris,['spotify:track:a','spotify:track:b']);
  assert.match(starts[0].path,/device_id=asiri-device/);
});

test('a rejected batch falls back to the requested song and primes the next playable item',async()=>{
  const Engine=await loadEngine(),calls=[];
  const engine=new Engine({
    getToken:async()=>'token',
    api:async(path,options={})=>{
      calls.push({path,options});
      if(path.startsWith('/me/player/play')){
        const uris=JSON.parse(options.body).uris;
        if(uris.length>1){
          const error=new Error('queue contains an unavailable item');
          error.status=400;
          throw error;
        }
      }
    }
  });
  engine.emit=()=>{};
  engine.prepareDevice=async()=>'asiri-device';
  engine.setQueue([track('wanted'),track('later')],{startIndex:0});
  const played=await engine.playIndex(0);
  const starts=calls.filter(call=>call.path.startsWith('/me/player/play')).map(call=>JSON.parse(call.options.body).uris);
  assert.equal(played.id,'wanted');
  assert.deepEqual(starts,[['spotify:track:wanted','spotify:track:later'],['spotify:track:wanted']]);
  assert.ok(calls.some(call=>call.path.startsWith('/me/player/queue?')&&call.path.includes('spotify%3Atrack%3Alater')));
});

test('playback normalizes malformed track URIs before sending them to Spotify',async()=>{
  const Engine=await loadEngine();
  const engine=new Engine({getToken:async()=>'token',api:async()=>null});
  assert.equal(engine.trackUri({id:'abc123',uri:'spotify:episode:abc123'}),'spotify:track:abc123');
  assert.equal(engine.trackUri({id:'bad-id!',uri:''}),'');
});
