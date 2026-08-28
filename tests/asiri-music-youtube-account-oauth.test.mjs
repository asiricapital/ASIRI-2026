import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../asiri-music-staging/'+path,import.meta.url),'utf8');

test('YouTube account sign-in uses Google OAuth and never requests a password',async()=>{
  const auth=await read('src/youtube-auth.js');
  const hub=await read('src/youtube-hub.js');
  assert.match(auth,/accounts\.google\.com\/gsi\/client/);
  assert.match(auth,/youtube\.readonly/);
  assert.match(auth,/initTokenClient/);
  assert.match(auth,/mine:'true'/);
  assert.match(hub,/تسجيل الدخول بحساب YouTube/);
  assert.match(hub,/لا نطلب كلمة مرور Google/);
  assert.doesNotMatch(auth,/password/i);
});

test('OAuth client id and access token stay on the device instead of the repository',async()=>{
  const auth=await read('src/youtube-auth.js');
  assert.match(auth,/localStorage\.setItem\(CLIENT_ID_KEY/);
  assert.match(auth,/sessionStorage\.setItem\(TOKEN_KEY/);
  assert.doesNotMatch(auth,/\.apps\.googleusercontent\.com/);
});

test('persistent YouTube mini-player still targets the player card after account card insertion',async()=>{
  const css=await read('youtube-hub.css');
  assert.match(css,/nth-of-type\(2\)/);
  assert.match(css,/has-active-video/);
});
