import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  buildSessionQueries,
  describeSessionIntent,
  parseDurationMinutes,
  parseSessionIntent,
  rankSessionTracks,
  selectSessionTracks,
  sessionDurationMinutes
} from '../asiri-music-staging/src/ai-dj-core.js';

test('ASIRI DJ understands Arabic artists, mood, context, and duration',()=>{
  const intent=parseSessionIntent('جلسة سفر ليلية، محمد عبده وراشد، هادئة ساعة ونصف');
  assert.equal(intent.targetMinutes,90);
  assert.deepEqual(intent.artistHints,['محمد عبده','راشد']);
  assert.ok(intent.contexts.includes('travel'));
  assert.ok(intent.contexts.includes('night'));
  assert.ok(intent.moods.includes('calm'));
  assert.match(describeSessionIntent(intent),/محمد عبده/);
  assert.match(describeSessionIntent(intent),/90 دقيقة/);
  assert.equal(parseDurationMinutes('جلسة هادئة ٤٥ دقيقة'),45);

  const queries=buildSessionQueries(intent,{maxQueries:6});
  assert.ok(queries.includes('artist:محمد عبده'));
  assert.ok(queries.includes('artist:راشد'));
  assert.ok(queries.length<=6);
});

test('ASIRI DJ ranks taste deterministically and builds toward requested duration',()=>{
  const track=(id,artist,popularity=50,duration=240000)=>({
    id,
    name:'Track '+id,
    uri:'spotify:track:'+id,
    popularity,
    duration_ms:duration,
    is_playable:true,
    artists:[{name:artist}],
    album:{images:[]}
  });
  const seed=track('seed','محمد عبده',95);
  const intent=parseSessionIntent('محمد عبده وراشد ساعة',{seedTrack:seed});
  const taste={
    artists:{'محمد عبده':{score:8},'راشد':{score:4}},
    tracks:{blocked:{id:'blocked',value:'dislike'}}
  };
  const ranked=rankSessionTracks([
    seed,
    track('a','محمد عبده',70),
    track('b','راشد',65),
    track('blocked','محمد عبده',100),
    {...track('unavailable','راشد',100),is_playable:false},
    track('c','عبادي الجوهر',60),
    track('d','راشد',58),
    track('e','محمد عبده',55)
  ],{intent,taste,seedTrack:seed});

  assert.ok(!ranked.some(item=>item.id==='seed'));
  assert.ok(!ranked.some(item=>item.id==='blocked'));
  assert.ok(!ranked.some(item=>item.id==='unavailable'));
  assert.equal(ranked[0].id,'a');

  const selected=selectSessionTracks(ranked,{targetMinutes:15,maxTracks:10,maxPerArtist:2});
  assert.ok(selected.length>=4);
  assert.ok(sessionDurationMinutes(selected)>=15);
});

test('Now Playing can create a more-like-this ASIRI DJ session without duplicate activation',async()=>{
  const html=await readFile('asiri-music-staging/index.html','utf8');
  const dj=await readFile('asiri-music-staging/src/ai-dj.js','utf8');
  const nowPlaying=await readFile('asiri-music-staging/src/now-playing.js','utf8');

  assert.match(html,/id="nowMoreLikeThis"/);
  assert.match(html,/id="aiDjIntent"/);
  assert.match(html,/ASIRI DJ/);
  assert.match(dj,/ai-dj-core\.js\?v=20260808-ai-dj-v2/);
  assert.match(dj,/asiri:more-like-this/);
  assert.match(dj,/source:'ai-dj',userGesture:true/);
  assert.doesNotMatch(dj,/activateFromGesture/);
  assert.match(nowPlaying,/asiri:more-like-this/);
  assert.match(nowPlaying,/source:'now-playing-up-next',userGesture:true/);
  assert.doesNotMatch(nowPlaying,/activateFromGesture/);
});
