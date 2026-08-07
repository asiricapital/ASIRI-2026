import {dedupeTracks,moveQueueItem,removeQueueItem,resolveDriverQueue} from './driver-mode-core.js?v=20260808-driver-v1';

const $=selector=>document.querySelector(selector);
const DRIVER_QUEUE_KEY='driverMode.queue';
const DRIVER_ENABLED_KEY='driverMode.enabled';
let bridge=null;
const state={enabled:false,queue:[],source:'',internalQueueUpdate:false};

function waitForBridge(){
  return new Promise(resolve=>{
    if(window.AsiriMusicBridge)return resolve(window.AsiriMusicBridge);
    const ready=()=>{window.removeEventListener('asiri:bridge-ready',ready);resolve(window.AsiriMusicBridge)};
    window.addEventListener('asiri:bridge-ready',ready);
  });
}

function trackArtist(track){
  return (track?.artists||[]).map(artist=>artist.name).filter(Boolean).join('، ')||'فنان غير معروف';
}

function savedDriverQueue(){
  return bridge?.getStorage(DRIVER_QUEUE_KEY)?.tracks||[];
}

function lastSession(){
  return bridge?.getStorage('aiDj.lastSession')||null;
}

function persistQueue(){
  bridge?.setStorage(DRIVER_QUEUE_KEY,{tracks:state.queue,updatedAt:Date.now(),source:state.source||'driver-mode'});
}

function updateModeUI(){
  document.body.classList.toggle('driver-mode-active',state.enabled);
  const toggle=$('#carModeToggle');
  if(toggle)toggle.checked=state.enabled;
  const badge=$('#driverModeBadge');
  if(badge){
    badge.textContent=state.enabled?'جاهز للقيادة':'وضع التجهيز';
    badge.dataset.enabled=state.enabled?'1':'0';
  }
}

function setDriverStatus(text,ok=true){
  const status=$('#carStatus');
  if(!status)return;
  status.textContent=text;
  status.dataset.ok=ok?'1':'0';
}

function createQueueRow(track,index){
  const row=document.createElement('article');
  row.className='driver-queue-row';
  row.dataset.trackId=track.id||'';

  const number=document.createElement('span');
  number.className='driver-queue-number';
  number.textContent=String(index+1);

  const cover=document.createElement('img');
  cover.className='driver-queue-cover';
  cover.alt='';
  cover.loading='lazy';
  cover.src=track.album?.images?.[0]?.url||'';

  const info=document.createElement('div');
  info.className='driver-queue-info';
  const name=document.createElement('strong');
  name.textContent=track.name||'بدون اسم';
  const artist=document.createElement('span');
  artist.textContent=trackArtist(track);
  info.append(name,artist);

  const actions=document.createElement('div');
  actions.className='driver-queue-actions';
  const up=document.createElement('button');
  up.type='button';up.textContent='↑';up.title='تحريك للأعلى';up.disabled=index===0;
  up.addEventListener('click',()=>reorder(index,-1));
  const down=document.createElement('button');
  down.type='button';down.textContent='↓';down.title='تحريك للأسفل';down.disabled=index===state.queue.length-1;
  down.addEventListener('click',()=>reorder(index,1));
  const remove=document.createElement('button');
  remove.type='button';remove.textContent='✕';remove.title='إزالة من Smart Queue';remove.className='driver-remove';
  remove.addEventListener('click',()=>removeTrack(index));
  actions.append(up,down,remove);

  row.append(number,cover,info,actions);
  return row;
}

function renderQueue(){
  const root=$('#driverQueueList');
  if(!root)return;
  root.innerHTML='';
  state.queue.forEach((track,index)=>root.appendChild(createQueueRow(track,index)));
  const count=$('#driverQueueCount');
  if(count)count.textContent=state.queue.length?state.queue.length+' أغنية':'فارغة';
  const empty=$('#driverQueueEmpty');
  if(empty)empty.hidden=state.queue.length>0;
  const start=$('#driverStart');
  if(start)start.disabled=!state.queue.length;
  const exportButton=$('#exportCarPlaylist');
  if(exportButton)exportButton.disabled=!state.queue.length;
}

function applyQueue(tracks,{source='driver-mode',syncBridge=true}={}){
  state.queue=dedupeTracks(tracks);
  state.source=source;
  persistQueue();
  renderQueue();
  if(syncBridge&&state.queue.length&&bridge?.replaceQueue){
    state.internalQueueUpdate=true;
    try{bridge.replaceQueue(state.queue,{startIndex:0,source:'driver-mode'})}
    finally{state.internalQueueUpdate=false}
  }
  setDriverStatus(state.queue.length?'Smart Queue جاهزة — '+state.queue.length+' أغنية. جهّزها قبل بدء القيادة.':'أنشئ جلسة AI DJ أو ابحث عن أغنيات لتجهيز Smart Queue.',Boolean(state.queue.length));
}

function reorder(index,direction){
  applyQueue(moveQueueItem(state.queue,index,direction),{source:'driver-reorder'});
}

function removeTrack(index){
  applyQueue(removeQueueItem(state.queue,index),{source:'driver-remove'});
}

function restoreLastSession(){
  const session=lastSession();
  if(!session?.tracks?.length){setDriverStatus('لا توجد جلسة سابقة. أنشئ جلسة من AI DJ أولًا.',false);return}
  applyQueue(session.tracks,{source:'last-session'});
  setDriverStatus('تم تجهيز Smart Queue من آخر جلسة — '+state.queue.length+' أغنية.');
}

async function openFirstTrack(){
  if(!state.queue.length){setDriverStatus('Smart Queue فارغة.',false);return}
  try{
    setDriverStatus('جارٍ فتح أول أغنية في Spotify…');
    await bridge.playQueue(state.queue,{startIndex:0,source:'driver-mode',userGesture:true});
  }catch(error){
    console.error('[Driver Mode open]',error);
    setDriverStatus(error.message||'تعذر فتح Spotify الآن.',false);
  }
}

function setMode(enabled){
  state.enabled=Boolean(enabled);
  bridge?.setStorage(DRIVER_ENABLED_KEY,state.enabled);
  updateModeUI();
  setDriverStatus(state.enabled?'Driver Mode مفعّل. جهّز القائمة وأكمل التحكم من Spotify أو أزرار السيارة.':'يمكنك ترتيب Smart Queue الآن ثم تفعيل Driver Mode عند الاستعداد.',true);
}

function buildUI(){
  const card=document.createElement('section');
  card.className='card car-connect-card driver-mode-card';
  card.innerHTML=`
    <div class="section-head driver-mode-head">
      <div><span class="eyebrow">DRIVER MODE • SPOTIFY NATIVE</span><h2>Smart Queue للسيارة</h2></div>
      <label class="car-switch" aria-label="تفعيل Driver Mode"><input id="carModeToggle" type="checkbox"><span></span></label>
    </div>
    <div class="driver-mode-summary"><span id="driverModeBadge">وضع التجهيز</span><strong id="driverQueueCount">فارغة</strong></div>
    <p class="muted">رتّب جلستك قبل القيادة، ثم افتحها في Spotify. لا يعتمد هذا الوضع على Web Playback أو التحكم المباشر من المتصفح.</p>
    <div class="driver-primary-actions">
      <button id="driverStart" type="button">▶ فتح أول أغنية في Spotify</button>
      <button id="driverRestoreSession" class="driver-secondary" type="button">↻ استخدام آخر جلسة</button>
      <a id="openSpotify" href="spotify://">فتح تطبيق Spotify</a>
    </div>
    <p id="carStatus" class="muted" aria-live="polite"></p>
    <div id="driverQueueList" class="driver-queue-list"></div>
    <div id="driverQueueEmpty" class="os-empty">Smart Queue فارغة. أنشئ جلسة AI DJ أو نفّذ بحثًا أولًا.</div>`;
  const mount=$('#carMount');
  if(mount)mount.appendChild(card);
  else document.querySelector('main')?.appendChild(card);

  $('#carModeToggle')?.addEventListener('change',event=>setMode(event.target.checked));
  $('#driverStart')?.addEventListener('click',openFirstTrack);
  $('#driverRestoreSession')?.addEventListener('click',restoreLastSession);
}

function loadInitialQueue(){
  const queue=resolveDriverQueue({
    liveQueue:bridge.getQueue?.()||[],
    lastSession:lastSession(),
    savedQueue:savedDriverQueue()
  });
  state.queue=queue;
  state.source='initial';
  if(queue.length)persistQueue();
  renderQueue();
  setDriverStatus(queue.length?'Smart Queue جاهزة — '+queue.length+' أغنية.':'أنشئ جلسة AI DJ أو ابحث عن أغنيات لتجهيز Smart Queue.',Boolean(queue.length));
}

function listenForQueueChanges(){
  window.addEventListener('asiri:queue-changed',event=>{
    if(state.internalQueueUpdate||event.detail?.source==='driver-mode')return;
    const tracks=event.detail?.tracks||[];
    if(tracks.length)applyQueue(tracks,{source:event.detail?.source||'app',syncBridge:false});
  });
  const loadSession=event=>{
    const tracks=event.detail?.tracks||[];
    if(tracks.length)applyQueue(tracks,{source:'session',syncBridge:false});
  };
  window.addEventListener('asiri:session-updated',loadSession);
  window.addEventListener('asiri:session-load',loadSession);
}

async function init(){
  bridge=await waitForBridge();
  state.enabled=Boolean(bridge.getStorage(DRIVER_ENABLED_KEY));
  buildUI();
  updateModeUI();
  loadInitialQueue();
  listenForQueueChanges();
  bridge.isCarMode=()=>state.enabled;
  bridge.getDriverQueue=()=>[...state.queue];
  bridge.restoreDriverQueue=restoreLastSession;
}

init().catch(error=>console.error('[Driver Mode isolated]',error));
