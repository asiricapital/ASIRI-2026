import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dedupeTracks,
  moveQueueItem,
  removeQueueItem,
  resolveDriverQueue
} from '../asiri-music-staging/src/driver-mode-core.js';

const track=id=>({id,name:'Track '+id});

test('driver queue removes duplicates and invalid tracks',()=>{
  assert.deepEqual(dedupeTracks([track('a'),track('a'),null,{},track('b')]).map(item=>item.id),['a','b']);
});

test('driver queue prefers the live queue, then latest AI DJ session, then saved driver queue',()=>{
  const saved=[track('saved')];
  const session={tracks:[track('session')]};
  assert.equal(resolveDriverQueue({liveQueue:[track('live')],lastSession:session,savedQueue:saved})[0].id,'live');
  assert.equal(resolveDriverQueue({lastSession:session,savedQueue:saved})[0].id,'session');
  assert.equal(resolveDriverQueue({savedQueue:saved})[0].id,'saved');
});

test('Smart Queue supports safe reorder and removal without mutating the source',()=>{
  const original=[track('a'),track('b'),track('c')];
  const moved=moveQueueItem(original,1,-1);
  const removed=removeQueueItem(moved,1);
  assert.deepEqual(original.map(item=>item.id),['a','b','c']);
  assert.deepEqual(moved.map(item=>item.id),['b','a','c']);
  assert.deepEqual(removed.map(item=>item.id),['b','c']);
});
