const CLIENT_ID='3ac122f971744e508bfd33ad0637d421';
const SCOPES=['user-read-private','user-read-email','streaming','user-read-playback-state','user-modify-playback-state','user-library-read','user-library-modify','playlist-read-private','playlist-modify-private','playlist-modify-public'];
const NS='asiri-music-pro.v1.';
const $=selector=>document.querySelector(selector);
const get=key=>{try{return JSON.parse(localStorage.getItem(NS+key)||'null')?.value??null}catch{return null}};
const set=(key,value)=>localStorage.setItem(NS+key,JSON.stringify({envelopeVersion:1,savedAt:Date.now(),value}));
const remove=key=>localStorage.removeItem(NS+key);
let currentQueue=[];
let currentIndex=-1;
let playbackEngine=null;

function base64url(input){return btoa(String.fromCharCode(...new Uint8Array(input))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
async function sha256(text){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))}
function randomString(length=64){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~',values=crypto.getRandomValues(new Uint8Array(length));return Array.from(values,value=>chars[value%chars.length]).join('')}

async function login(){
  const verifier=randomString();
  const challenge=base64url(await sha256(verifier));
  set('spotify.codeVerifier',verifier);
  const redirectUri=new URL('callback.html',location.href).href;
  location.href='https://accounts.spotify.com/authorize?'+new URLSearchParams({client_id:CLIENT_ID,response_type:'code',redirect_uri:redirectUri,scope:SCOPES.join(' '),code_challenge_method:'S256',code_challenge:challenge,show_dialog:'true'});
}

async function refresh(){
  const refreshToken=get('spotify.refreshToken');
  if(!refreshToken)return null;
  const response=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CLIENT_ID,grant_type:'refresh_token',refresh_token:refreshToken})});
  if(!response.ok)return null;
  const payload=await response.json();
  set('spotify.accessToken',payload.access_token);
  set('spotify.expiresAt',Date.now()+payload.expires_in*1000-60000);
  if(payload.refresh_token)set('spotify.refreshToken',payload.refresh_token);
  return payload.access_token;
}

async function token(){
  const accessToken=get('spotify.accessToken');
  const expiresAt=Number(get('spotify.expiresAt')||0);
  return accessToken&&Date.now()<expiresAt?accessToken:refresh();
}

async function api(path,options={}){
  const accessToken=await token();
  if(!accessToken)throw new Error('AUTH_REQUIRED');
  const response=await fetch('https://api.spotify.com/v1'+path,{...options,headers:{Authorization:'Bearer '+accessToken,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
  if(response.status===401){remove('spotify.accessToken');throw new Error('AUTH_REQUIRED')}
  if(!response.ok){
    let message='';
    try{message=(await response.json())?.error?.message||''}catch{}
    const error=new Error(message||`SPOTIFY_${response.status}`);
    error.status=response.status;
    throw error;
  }
  return response.status===204?null:response.json();
}

function health(ok,text){
  $('#healthCard')?.classList.toggle('ok',ok);
  $('#healthCard')?.classList.toggle('warn',!ok);
  if($('#healthStatus'))$('#healthStatus').textContent=text;
}
function status(text){if($('#statusText'))$('#statusText').textContent=text}

function setQueue(tracks,{startIndex=0,source='web'}={}){
  currentQueue=[...new Map((tracks||[]).filter(track=>track?.id).map(track=>[track.id,track])).values()];
  currentIndex=currentQueue.length?Math.min(Math.max(startIndex,0),currentQueue.length-1):-1;
  window.dispatchEvent(new CustomEvent('asiri:queue-changed',{detail:{tracks:[...currentQueue],source,currentIndex}}));
  return [...currentQueue];
}

function spotifyUrl(track){
  return track?.external_urls?.spotify||`https://open.spotify.com/track/${encodeURIComponent(track?.id||'')}`;
}

function openTrack(track,index){
  if(!track?.id)throw new Error('الأغنية غير صالحة للتشغيل.');
  if(Number.isInteger(index))currentIndex=index;
  set('lastOpenedTrack',{id:track.id,name:track.name,artist:track.artists?.map(a=>a.name).join('، ')||'',openedAt:Date.now()});
  status(`تم إرسال «${track.name}» إلى تطبيق Spotify.`);
  window.location.href=spotifyUrl(track);
}

function ensurePlaybackEngine(){
  if(playbackEngine)return playbackEngine;
  if(!window.AsiriPlaybackEngineV2)throw new Error('مشغل Asiri لم يكتمل تحميله بعد. أعد المحاولة.');
  playbackEngine=new window.AsiriPlaybackEngineV2({getToken:token,api,onStatus:status,onHealth:health});
  playbackEngine.addEventListener('queue-changed',event=>{
    currentQueue=[...(event.detail?.tracks||[])];
    currentIndex=Number(event.detail?.currentIndex??-1);
  });
  playbackEngine.addEventListener('player-state',event=>updatePlayerBar(event.detail));
  playbackEngine.addEventListener('track-selected',event=>{
    currentIndex=Number(event.detail?.index??currentIndex);
    showPlayerTrack(event.detail?.track,false);
  });
  return playbackEngine;
}

function showPlayerTrack(track,playing){
  if(!track)return;
  const bar=$('#playerBar');
  bar?.classList.remove('hidden');
  bar?.classList.toggle('is-playing',Boolean(playing));
  const image=track.album?.images?.[0]?.url||track.images?.[0]?.url||'';
  if($('#playerCover'))$('#playerCover').src=image;
  if($('#playerTitle'))$('#playerTitle').textContent=track.name||'يعمل الآن';
  if($('#playerArtist'))$('#playerArtist').textContent=(track.artists||[]).map(artist=>artist.name).join('، ');
  if($('#playButton'))$('#playButton').textContent=playing?'⏸':'▶';
}

function updatePlayerBar(detail={}){
  if(Number.isInteger(detail.index))currentIndex=detail.index;
  showPlayerTrack(detail.track,!detail.paused);
}

async function activateFromGesture(){
  return ensurePlaybackEngine().activateFromGesture();
}

async function playQueue(tracks,{startIndex=0,source='web',userGesture=false}={}){
  const queue=setQueue(tracks,{startIndex,source});
  if(!queue.length)throw new Error('لا توجد أغنيات صالحة للتشغيل.');
  const engine=ensurePlaybackEngine();
  if(userGesture)await engine.activateFromGesture();
  await engine.playQueue(queue,{startIndex:currentIndex,source,userGesture:false});
  return queue;
}

function render(track,index,queue){
  const fragment=$('#trackTemplate').content.cloneNode(true);
  const card=fragment.querySelector('.track');
  card.dataset.trackId=track.id||'';
  fragment.querySelector('.cover').src=track.album?.images?.[0]?.url||'';
  fragment.querySelector('.name').textContent=track.name||'';
  fragment.querySelector('.artist').textContent=track.artists?.map(artist=>artist.name).join('، ')||'';
  fragment.querySelector('.album').textContent=track.album?.name||'';
  const openLink=fragment.querySelector('.open');
  openLink.href=spotifyUrl(track);
  openLink.textContent='عرض في Spotify';
  const playButton=fragment.querySelector('.play');
  playButton.textContent='▶ تشغيل هنا';
  playButton.addEventListener('click',async event=>{
    event.preventDefault();
    event.stopPropagation();
    try{await activateFromGesture();await playQueue(queue,{startIndex:index,source:'search'});}
    catch(error){status(error.message||'تعذر تشغيل الأغنية.');}
  });
  queueMicrotask(()=>window.dispatchEvent(new CustomEvent('asiri:track-rendered',{detail:{card,track}})));
  return fragment;
}

async function load(){
  health(true,'Asiri Music جاهز');
  if(!get('spotify.accessToken')&&!get('spotify.refreshToken')){health(false,'بانتظار تسجيل الدخول');return}
  try{
    const me=await api('/me');
    if($('#profileName'))$('#profileName').textContent=me.display_name||me.id;
    if($('#profilePlan'))$('#profilePlan').textContent='Spotify متصل';
    $('#profileCard')?.classList.remove('hidden');
    $('#loginButton')?.classList.add('hidden');
    status('اختر أغنية واستمع إليها داخل Asiri Music.');
    try{await ensurePlaybackEngine().connect();health(true,'Spotify Player جاهز — الاستماع داخل Asiri Music')}
    catch(error){
      console.error(error);
      health(false,error.message||'تعذر تجهيز المشغل الداخلي');
      status('تعذر تشغيل Web Playback الآن. صلاحياتك الحالية محفوظة؛ أعد الربط فقط إذا طلب Spotify ذلك.');
      const button=$('#loginButton');
      if(button){button.classList.remove('hidden');button.textContent='إعادة ربط Spotify'}
    }
  }catch(error){
    console.error(error);
    health(false,'يلزم تسجيل الدخول مجددًا');
    const button=$('#loginButton');
    if(button){button.classList.remove('hidden');button.textContent='الدخول عبر Spotify'}
  }
}

$('#loginButton')?.addEventListener('click',login);
$('#searchForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const query=$('#searchInput')?.value.trim();
  if(!query)return;
  $('#results').innerHTML='';
  status('جارٍ البحث…');
  try{
    const data=await api('/search?'+new URLSearchParams({q:query,type:'track',limit:'10',offset:'0'}));
    const queue=data.tracks?.items||[];
    setQueue(queue,{startIndex:0,source:'general-search'});
    queue.forEach((track,index)=>$('#results').appendChild(render(track,index,queue)));
    $('#resultCount').textContent=queue.length+' نتيجة';
    status(queue.length?'اختر «تشغيل هنا» على أي أغنية.':'لا توجد نتائج.');
  }catch(error){console.error(error);status(error.message==='AUTH_REQUIRED'?'سجّل الدخول أولًا.':error.message)}
});

window.AsiriMusicBridge={
  api,
  playQueue,
  replaceQueue:setQueue,
  activateFromGesture,
  getQueue:()=>[...currentQueue],
  getCurrentIndex:()=>currentIndex,
  setStatus:status,
  getStorage:get,
  setStorage:set,
  reconnectPlayer:async()=>ensurePlaybackEngine().connect(),
  hasInAppPlayback:()=>Boolean(playbackEngine?.deviceId),
  openTrack,
  openTrackNative:openTrack
};
window.dispatchEvent(new CustomEvent('asiri:bridge-ready'));
$('#prevButton')?.addEventListener('click',async()=>{try{await activateFromGesture();await ensurePlaybackEngine().previous()}catch(error){status(error.message)}});
$('#playButton')?.addEventListener('click',async()=>{try{await activateFromGesture();await ensurePlaybackEngine().toggle()}catch(error){status(error.message)}});
$('#nextButton')?.addEventListener('click',async()=>{try{await activateFromGesture();await ensurePlaybackEngine().next()}catch(error){status(error.message)}});
load();
