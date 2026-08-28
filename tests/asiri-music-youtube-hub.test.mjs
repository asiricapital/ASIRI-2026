import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rememberYoutube,youtubeEmbedUrl,youtubeSearchUrl,youtubeVideoId,youtubeWatchUrl} from '../asiri-music-staging/src/youtube-core.js';

const read=path=>readFile(new URL('../asiri-music-staging/'+path,import.meta.url),'utf8');

test('YouTube URL parser accepts official watch, short, shorts, live and embed URLs only',()=>{
  const id='dQw4w9WgXcQ';
  assert.equal(youtubeVideoId(id),id);
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v='+id),id);
  assert.equal(youtubeVideoId('https://youtu.be/'+id),id);
  assert.equal(youtubeVideoId('https://www.youtube.com/shorts/'+id),id);
  assert.equal(youtubeVideoId('https://www.youtube.com/live/'+id),id);
  assert.equal(youtubeVideoId('https://www.youtube.com/embed/'+id),id);
  assert.equal(youtubeVideoId('https://example.com/watch?v='+id),'');
});

test('YouTube playback uses privacy-enhanced official embeds and canonical links',()=>{
  const id='dQw4w9WgXcQ';
  assert.match(youtubeEmbedUrl(id),/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
  assert.match(youtubeEmbedUrl(id),/playsinline=1/);
  assert.match(youtubeEmbedUrl(id),/autoplay=1/);
  assert.equal(youtubeWatchUrl(id),'https://www.youtube.com/watch?v='+id);
  assert.equal(youtubeSearchUrl('محمد عبده حفلة'),'https://www.youtube.com/results?search_query='+encodeURIComponent('محمد عبده حفلة'));
});

test('YouTube history is unique and bounded',()=>{
  const a='dQw4w9WgXcQ',b='M7lc1UVf-VE';
  let items=rememberYoutube([],{id:a,title:'A'},2);
  items=rememberYoutube(items,{id:b,title:'B'},2);
  items=rememberYoutube(items,{id:a,title:'A2'},2);
  assert.deepEqual(items.map(item=>item.id),[a,b]);
  assert.equal(items[0].title,'A2');
});

test('Music OS loads the isolated YouTube hub and preserves the Spotify engine',async()=>{
  const shell=await read('src/os-shell.js');
  const hub=await read('src/youtube-hub.js');
  const css=await read('youtube-hub.css');
  assert.match(shell,/youtube-hub\.js\?v=20260829-youtube-v1/);
  assert.match(hub,/dataset\.osPage='youtube'/);
  assert.match(hub,/Spotify \+ YouTube/);
  assert.match(hub,/youtube-nocookie|youtubeEmbedUrl/);
  assert.match(hub,/button\.dataset\.osTarget='youtube'/);
  assert.match(hub,/quick\.dataset\.openPage='youtube'/);
  assert.match(css,/\.youtube-hub-card/);
  assert.doesNotMatch(hub,/api\.youtube\.com|googleapis\.com\/youtube/);
});
