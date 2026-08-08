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
  vm.runInNewContext(source,{window,EventTarget,CustomEvent:StubCustomEvent,console:quietConsole,setTimeout,clearTimeout,URLSearchParams},{filename:'playback-engine-v2.js'});
  return window.AsiriPlaybackEngineV2;
}

const track=id=>({id,name:`Track ${id}`,uri:`spotify:track:${id}`,artists:[{name:'Artist'}],album:{images:[]}});
const stateFor=(id,paused=false)=>({paused,position:100,duration:180000,track_window:{current_track:{id,uri:`spotify:track:${id}`}}});

test('playback preparation no longer transfers and pauses the player before every track',async()=>{
  const Engine=await loadEngine(),calls=[];
  const engine=new Engine({getToken:async()=>'token',api:async(...args)=>{calls.push(args)}});
  engine.connect=async()=>'asiri-device';
  engine.waitUntilDeviceVisible=async()=>true;
  assert.equal(await engine.prepareDevice(),'asiri-device');
  assert.equal(calls.length,0);
});

test('selected track starts directly on the Asiri device with the remaining queue',async()=>{
  const Engine=await loadEngine(),calls=[];
  let current='old';
  const engine=new Engine({
    getToken:async()=>'token',
    api:async(path,options={})=>{
      calls.push({path,options});
      if(path.startsWith('/me/player/play'))current=JSON.parse(options.body).uris[0].split(':').at(-1);
    }
  });
  engine.emit=()=>{};
  engine.prepareDevice=async()=>'asiri-device';
  engine.player={getCurrentState:async()=>stateFor(current),resume:async()=>{}};
  engine.setQueue([track('a'),track('b')],{startIndex:0});
  const played=await engine.playIndex(0);
  const starts=calls.filter(call=>call.path.startsWith('/me/player/play'));
  assert.equal(played.id,'a');
  assert.equal(starts.length,1);
  assert.deepEqual(JSON.parse(starts[0].options.body).uris,['spotify:track:a','spotify:track:b']);
  assert.match(starts[0].path,/device_id=asiri-device/);
});

test('a bad result later in the queue cannot block the requested song',async()=>{
  const Engine=await loadEngine(),calls=[];
  let current='old';
  const engine=new Engine({
    getToken:async()=>'token',
    api:async(path,options={})=>{
      calls.push({path,options});
      if(path.startsWith('/me/player/play')){
        const uris=JSON.parse(options.body).uris;
        if(uris.length>1)throw new Error('queue contains an unavailable item');
        current=uris[0].split(':').at(-1);
      }
    }
  });
  engine.emit=()=>{};
  engine.prepareDevice=async()=>'asiri-device';
  engine.player={getCurrentState:async()=>stateFor(current),resume:async()=>{}};
  engine.setQueue([track('wanted'),track('later')],{startIndex:0});
  const played=await engine.playIndex(0);
  const starts=calls.filter(call=>call.path.startsWith('/me/player/play')).map(call=>JSON.parse(call.options.body).uris);
  assert.equal(played.id,'wanted');
  assert.deepEqual(starts,[['spotify:track:wanted','spotify:track:later'],['spotify:track:wanted']]);
  assert.ok(calls.some(call=>call.path.startsWith('/me/player/queue?')&&call.path.includes('spotify%3Atrack%3Alater')));
});
