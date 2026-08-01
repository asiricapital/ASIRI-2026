const CLIENT_ID='3ac122f971744e508bfd33ad0637d421';
const SCOPES=['user-read-private','user-read-email','streaming','user-read-playback-state','user-modify-playback-state','user-library-read','user-library-modify','playlist-read-private','playlist-modify-private','playlist-modify-public'];
const NS='asiri-music-pro.v1.';
const $=s=>document.querySelector(s);
const get=k=>{try{return JSON.parse(localStorage.getItem(NS+k)||'null')?.value??null}catch{return null}};
const set=(k,v)=>localStorage.setItem(NS+k,JSON.stringify({envelopeVersion:1,savedAt:Date.now(),value:v}));
const remove=k=>localStorage.removeItem(NS+k);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let sdkPlayer=null,deviceId=null,searchQueue=[],currentQueueIndex=-1,transitionPromise=null,connectPromise=null;

function base64url(input){return btoa(String.fromCharCode(...new Uint8Array(input))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
async function sha256(text){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))}
function randomString(length=64){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~',values=crypto.getRandomValues(new Uint8Array(length));return Array.from(values,v=>chars[v%chars.length]).join('')}
async function login(){const verifier=randomString(),challenge=base64url(await sha256(verifier));set('spotify.codeVerifier',verifier);const redirectUri=new URL('callback.html',location.href).href;location.href='https://accounts.spotify.com/authorize?'+new URLSearchParams({client_id:CLIENT_ID,response_type:'code',redirect_uri:redirectUri,scope:SCOPES.join(' '),code_challenge_method:'S256',code_challenge:challenge,show_dialog:'true'})}
async function refresh(){const rt=get('spotify.refreshToken');if(!rt)return null;const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CLIENT_ID,grant_type:'refresh_token',refresh_token:rt})});if(!r.ok)return null;const p=await r.json();set('spotify.accessToken',p.access_token);set('spotify.expiresAt',Date.now()+p.expires_in*1000-60000);if(p.refresh_token)set('spotify.refreshToken',p.refresh_token);return p.access_token}
async function token(){const t=get('spotify.accessToken'),e=Number(get('spotify.expiresAt')||0);return t&&Date.now()<e?t:refresh()}
async function api(path,options={}){const t=await token();if(!t)throw new Error('AUTH_REQUIRED');const r=await fetch('https://api.spotify.com/v1'+path,{...options,headers:{Authorization:'Bearer '+t,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});if(r.status===401){remove('spotify.accessToken');throw new Error('AUTH_REQUIRED')}if(!r.ok){let d='';try{d=(await r.json())?.error?.message||''}catch{}const error=new Error(d||'SPOTIFY_'+r.status);error.status=r.status;throw error}return r.status===204?null:r.json()}
function health(ok,text){$('#healthCard').classList.toggle('ok',ok);$('#healthCard').classList.toggle('warn',!ok);$('#healthStatus').textContent=text}
function status(text){$('#statusText').textContent=text}
function showPlayer(track){if(!track)return;$('#playerBar').classList.remove('hidden');$('#playerCover').src=track.album?.images?.[0]?.url||'';$('#playerTitle').textContent=track.name||'جارٍ التشغيل';$('#playerArtist').textContent=track.artists?.map(a=>a.name).join('، ')||'';$('#playButton').textContent='⏸'}
function syncQueueIndex(track){if(!track||!searchQueue.length)return;const index=searchQueue.findIndex(item=>(track.uri&&item.uri===track.uri)||(track.id&&item.id===track.id));if(index>=0)currentQueueIndex=index}
async function destroyPlayer(){deviceId=null;connectPromise=null;if(sdkPlayer){try{sdkPlayer.disconnect()}catch{}sdkPlayer=null}await wait(150)}
async function initPlayer(force=false){
  if(force)await destroyPlayer();
  if(deviceId&&sdkPlayer)return deviceId;
  if(connectPromise)return connectPromise;
  if(!window.Spotify?.Player)return null;
  connectPromise=(async()=>{
    sdkPlayer=new Spotify.Player({name:'Asiri Music Professional',getOAuthToken:async cb=>cb(await token()),volume:.8,enableMediaSession:true});
    sdkPlayer.addListener('ready',({device_id})=>{deviceId=device_id;health(true,'Spotify Player جاهز');status('المشغل متصل وجاهز.')});
    sdkPlayer.addListener('not_ready',()=>{deviceId=null;health(false,'المشغل غير متصل')});
    sdkPlayer.addListener('initialization_error',({message})=>health(false,message||'تعذر تهيئة المشغل'));
    sdkPlayer.addListener('authentication_error',()=>health(false,'يلزم تسجيل الدخول مجددًا'));
    sdkPlayer.addListener('account_error',()=>health(false,'التشغيل المباشر يتطلب Premium'));
    sdkPlayer.addListener('playback_error',({message})=>{console.error(message);health(false,'تعذر تشغيل Spotify')});
    sdkPlayer.addListener('player_state_changed',state=>{if(!state)return;const track=state.track_window.current_track;syncQueueIndex(track);showPlayer(track);$('#playButton').textContent=state.paused?'▶':'⏸';window.dispatchEvent(new CustomEvent('asiri:player-state',{detail:{track,paused:state.paused,position:state.position,duration:state.duration}}))});
    const connected=await sdkPlayer.connect();
    if(!connected)throw new Error('تعذر ربط مشغل Spotify');
    for(let i=0;i<40&&!deviceId;i++)await wait(200);
    return deviceId;
  })().finally(()=>{connectPromise=null});
  return connectPromise;
}
async function activateFromGesture(){await initPlayer();if(sdkPlayer?.activateElement){try{await sdkPlayer.activateElement()}catch(error){console.warn('activateElement',error)}}}
async function ensureDevice(){let id=await initPlayer();if(id)return id;id=await initPlayer(true);if(!id)throw new Error('لم يجهز مشغل Spotify. اضغط تشغيل مرة أخرى.');return id}
async function transferPlayback(id){await api('/me/player',{method:'PUT',body:JSON.stringify({device_ids:[id],play:true})});await wait(700);try{await sdkPlayer?.resume()}catch{}await wait(250)}
async function playOnDevice(track,index,id){if(Number.isInteger(index))currentQueueIndex=index;await transferPlayback(id);await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({uris:[track.uri||`spotify:track:${track.id}`],position_ms:0})})}
async function startTrack(track,index){showPlayer(track);status('جارٍ تجهيز مشغل Spotify…');let id=await ensureDevice();try{await playOnDevice(track,index,id)}catch(error){const recoverable=error.status===404||/device not found|no active device|جهاز/i.test(error.message||'');if(!recoverable)throw error;health(false,'جارٍ إعادة إنشاء جهاز التشغيل…');id=await initPlayer(true);if(!id)throw error;if(sdkPlayer?.activateElement){try{await sdkPlayer.activateElement()}catch{}}await playOnDevice(track,index,id)}health(true,'Spotify Player جاهز');status(`يعمل الآن: ${track.name} — ${currentQueueIndex+1} من ${searchQueue.length||1}`)}
function runTransition(task){if(transitionPromise)return transitionPromise;transitionPromise=Promise.resolve().then(task).catch(error=>{console.error(error);$('#playButton').textContent='▶';status(error.message||'تعذر التشغيل');health(false,error.message||'تعذر التشغيل')}).finally(()=>{transitionPromise=null});return transitionPromise}
async function playFromUser(track,index){showPlayer(track);await activateFromGesture();return runTransition(()=>startTrack(track,index))}
function moveQueue(direction){if(!searchQueue.length){status('لا توجد جلسة تشغيل حالية.');return}const base=currentQueueIndex>=0?currentQueueIndex:0;const next=(base+direction+searchQueue.length)%searchQueue.length;const track=searchQueue[next];showPlayer(track);status(direction>0?'جارٍ الانتقال إلى الأغنية التالية…':'جارٍ الرجوع إلى الأغنية السابقة…');runTransition(()=>startTrack(track,next))}
function replaceQueue(tracks,{startIndex=0,source='smart'}={}){const clean=[...new Map((tracks||[]).filter(t=>t?.id).map(t=>[t.id,t])).values()];if(!clean.length)throw new Error('لا توجد أغنيات صالحة للجلسة');searchQueue=clean;currentQueueIndex=Math.min(Math.max(startIndex,0),clean.length-1);window.dispatchEvent(new CustomEvent('asiri:queue-changed',{detail:{tracks:[...clean],source,currentIndex:currentQueueIndex}}));return [...clean]}
async function playQueue(tracks,{startIndex=0,source='smart',userGesture=false}={}){const queue=replaceQueue(tracks,{startIndex,source});showPlayer(queue[currentQueueIndex]);if(userGesture)await activateFromGesture();await runTransition(()=>startTrack(queue[currentQueueIndex],currentQueueIndex));return queue}
function render(track,index){const fragment=$('#trackTemplate').content.cloneNode(true);const card=fragment.querySelector('.track');card.dataset.trackId=track.id||'';fragment.querySelector('.cover').src=track.album?.images?.[0]?.url||'';fragment.querySelector('.name').textContent=track.name||'';fragment.querySelector('.artist').textContent=track.artists?.map(a=>a.name).join('، ')||'';fragment.querySelector('.album').textContent=track.album?.name||'';fragment.querySelector('.open').href=track.external_urls?.spotify||'';fragment.querySelector('.play').addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();searchQueue=searchQueue.length?searchQueue:[track];await playFromUser(track,index)});queueMicrotask(()=>window.dispatchEvent(new CustomEvent('asiri:track-rendered',{detail:{card,track}})));return fragment}
async function load(){health(true,'تم تحميل النواة الاحترافية');if(!get('spotify.accessToken')&&!get('spotify.refreshToken')){health(false,'بانتظار تسجيل الدخول');return}try{const me=await api('/me');$('#profileName').textContent=me.display_name||me.id;$('#profilePlan').textContent=me.product==='premium'?'Spotify Premium':'Spotify متصل';$('#profileCard').classList.remove('hidden');$('#loginButton').classList.add('hidden');health(true,'النظام متصل ومستقر');status('اضغط تشغيل على أي أغنية لتهيئة الصوت.');await initPlayer()}catch(error){console.error(error);health(false,'يلزم تسجيل الدخول مجددًا')}}
$('#loginButton').addEventListener('click',login);
$('#searchForm').addEventListener('submit',async event=>{event.preventDefault();const q=$('#searchInput').value.trim();if(!q)return;$('#results').innerHTML='';status('جارٍ البحث…');try{const data=await api('/search?'+new URLSearchParams({q,type:'track',limit:'10',offset:'0'}));searchQueue=data.tracks?.items||[];currentQueueIndex=-1;searchQueue.forEach((track,index)=>$('#results').appendChild(render(track,index)));$('#resultCount').textContent=searchQueue.length+' نتيجة';status(searchQueue.length?'اضغط تشغيل على أي أغنية.':'لا توجد نتائج.')}catch(error){console.error(error);status(error.message==='AUTH_REQUIRED'?'سجّل الدخول أولًا.':error.message)}});
$('#playButton').addEventListener('click',async event=>{event.preventDefault();await activateFromGesture();if(sdkPlayer&&deviceId){try{await sdkPlayer.togglePlay()}catch{if(searchQueue[currentQueueIndex])await playFromUser(searchQueue[currentQueueIndex],currentQueueIndex)}}else if(searchQueue[currentQueueIndex])await playFromUser(searchQueue[currentQueueIndex],currentQueueIndex)});
$('#prevButton').addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();await activateFromGesture();moveQueue(-1)});
$('#nextButton').addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();await activateFromGesture();moveQueue(1)});
window.onSpotifyWebPlaybackSDKReady=()=>initPlayer().catch(console.error);
window.addEventListener('online',()=>{if(!deviceId)initPlayer().catch(console.error)});
window.addEventListener('pageshow',()=>{if(!deviceId)initPlayer().catch(console.error)});
window.addEventListener('error',event=>{console.error(event.error||event.message);health(false,'تم عزل خطأ دون إيقاف التطبيق')});
window.addEventListener('unhandledrejection',event=>{console.error(event.reason);health(false,'تم احتواء خطأ غير متوقع')});
window.AsiriMusicBridge={api,playQueue,replaceQueue,activateFromGesture,getQueue:()=>[...searchQueue],getCurrentIndex:()=>currentQueueIndex,setStatus:status,getStorage:get,setStorage:set,reconnectPlayer:()=>initPlayer(true)};
window.dispatchEvent(new CustomEvent('asiri:bridge-ready'));
load();