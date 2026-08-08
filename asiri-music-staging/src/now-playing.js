const $=selector=>document.querySelector(selector);
let currentTrack=null;
let paused=true;
let position=0;
let duration=0;
let updatedAt=Date.now();
let ticker=null;
let queue=[];
let currentIndex=-1;

function bridge(){return window.AsiriMusicBridge}
function formatTime(ms){
  const seconds=Math.max(0,Math.floor((Number(ms)||0)/1000));
  return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}
function cover(track){return track?.album?.images?.[0]?.url||track?.images?.[0]?.url||''}
function artists(track){return (track?.artists||[]).map(artist=>artist.name).filter(Boolean).join('، ')||'Asiri Music Player'}
function spotifyUrl(track){return track?.external_urls?.spotify||`https://open.spotify.com/track/${encodeURIComponent(track?.id||'')}`}

function setQueue(nextQueue,index){
  if(Array.isArray(nextQueue))queue=nextQueue.filter(track=>track?.id);
  if(Number.isInteger(index))currentIndex=index;
  else if(currentTrack?.id){
    const found=queue.findIndex(track=>track.id===currentTrack.id);
    if(found>=0)currentIndex=found;
  }
}

function livePosition(){
  if(paused||!duration)return position;
  return Math.min(duration,position+(Date.now()-updatedAt));
}

function syncFavorite(){
  const rating=window.AsiriTasteEngine?.getRating?.(currentTrack?.id)||'';
  const active=rating==='like';
  const button=$('#nowFavoriteButton');
  const save=$('#nowSave');
  button?.classList.toggle('active',active);
  save?.classList.toggle('active',active);
  if(button)button.textContent=active?'♥':'♡';
  if(save)save.textContent=active?'♥ ضمن مفضلتي':'♡ أعجبتني';
}

function renderProgress(){
  const value=livePosition();
  const ratio=duration?Math.min(1,Math.max(0,value/duration)):0;
  if($('#nowSeek')&&document.activeElement!==$('#nowSeek'))$('#nowSeek').value=String(Math.round(ratio*1000));
  if($('#nowPosition'))$('#nowPosition').textContent=formatTime(value);
  if($('#nowDuration'))$('#nowDuration').textContent=formatTime(duration);
  if($('#playerProgress'))$('#playerProgress').style.width=(ratio*100)+'%';
}

function queueRow(track,index){
  const row=document.createElement('button');
  row.type='button';
  row.className='now-queue-row';
  row.dataset.trackId=track.id;
  const active=index===currentIndex||track.id===currentTrack?.id;
  row.classList.toggle('is-current',active);
  row.setAttribute('aria-current',active?'true':'false');

  const number=document.createElement('span');
  number.className='now-queue-number';
  number.textContent=active?'♫':String(index+1);
  const image=document.createElement('img');
  image.className='now-queue-cover';
  image.alt='';
  image.loading='lazy';
  image.src=cover(track);
  const info=document.createElement('span');
  info.className='now-queue-info';
  const name=document.createElement('strong');
  name.textContent=track.name||'أغنية';
  const artist=document.createElement('small');
  artist.textContent=artists(track);
  info.append(name,artist);
  const state=document.createElement('em');
  state.textContent=active?'يعمل الآن':index>currentIndex?'التالي':'تم تشغيلها';
  info.append(state);
  row.append(number,image,info);
  row.addEventListener('click',()=>playQueueIndex(index));
  return row;
}

function renderQueue(){
  const root=$('#nowQueueList');
  if(!root)return;
  root.innerHTML='';
  queue.forEach((track,index)=>root.appendChild(queueRow(track,index)));
  const remaining=currentIndex>=0?Math.max(0,queue.length-currentIndex-1):queue.length;
  if($('#nowQueueCount'))$('#nowQueueCount').textContent=queue.length+' أغنية • '+remaining+' تالية';
  if($('#nowQueueEmpty'))$('#nowQueueEmpty').hidden=queue.length>0;
  const toggle=$('#nowQueueToggle');
  if(toggle)toggle.textContent=queue.length?'☷ التالي ('+remaining+')':'☷ التالي';
}

async function playQueueIndex(index){
  const api=bridge();
  if(!api||!queue[index])return;
  try{
    if($('#nowStatus'))$('#nowStatus').textContent='جارٍ الانتقال إلى '+(queue[index].name||'الأغنية')+'…';
    await api.activateFromGesture?.();
    await api.playQueue(queue,{startIndex:index,source:'now-playing-up-next',userGesture:true});
  }catch(error){
    console.error('[Now Playing queue]',error);
    if($('#nowStatus'))$('#nowStatus').textContent=error.message||'تعذر تشغيل الأغنية من القائمة.';
  }
}

function render(){
  if(!currentTrack)return;
  const image=cover(currentTrack);
  if($('#nowCover'))$('#nowCover').src=image;
  if($('#nowTrack'))$('#nowTrack').textContent=currentTrack.name||'أغنية';
  if($('#nowArtist'))$('#nowArtist').textContent=artists(currentTrack);
  if($('#nowPlayPause'))$('#nowPlayPause').textContent=paused?'▶':'⏸';
  if($('#nowStatus'))$('#nowStatus').textContent=paused?'متوقف مؤقتًا':'يعمل الآن داخل Asiri Music';
  if($('#nowSpotifyLink'))$('#nowSpotifyLink').href=spotifyUrl(currentTrack);
  if($('#nowPlayingBackdrop'))$('#nowPlayingBackdrop').style.backgroundImage=image?`url("${image}")`:'';
  syncFavorite();
  renderProgress();
  renderQueue();
}

function applyState(detail={}){
  if(detail.track)currentTrack=detail.track;
  setQueue(detail.queue,detail.index);
  paused=Boolean(detail.paused);
  position=Number(detail.position)||0;
  duration=Number(detail.duration)||duration||0;
  updatedAt=Date.now();
  render();
}

function open(){
  if(!currentTrack)return;
  $('#nowPlaying')?.classList.remove('hidden');
  document.body.classList.add('player-opened');
  render();
}

function close(){
  $('#nowPlaying')?.classList.add('hidden');
  document.body.classList.remove('player-opened');
}

async function command(action){
  try{
    const api=bridge();
    if(!api)throw new Error('المشغل غير جاهز');
    if(action==='previous')await api.previousTrack();
    if(action==='toggle')await api.togglePlayback();
    if(action==='next')await api.nextTrack();
  }catch(error){
    console.error('[Now Playing]',error);
    if($('#nowStatus'))$('#nowStatus').textContent=error.message||'تعذر تنفيذ الأمر.';
  }
}

async function seek(){
  if(!duration)return;
  const ratio=(Number($('#nowSeek')?.value)||0)/1000;
  const target=Math.round(duration*ratio);
  position=target;
  updatedAt=Date.now();
  renderProgress();
  try{await bridge()?.seekPlayback(target)}
  catch(error){console.error('[Now Playing seek]',error);if($('#nowStatus'))$('#nowStatus').textContent=error.message||'تعذر تغيير موضع التشغيل.'}
}

function previewSeek(){
  if(!duration)return;
  const ratio=(Number($('#nowSeek')?.value)||0)/1000;
  if($('#nowPosition'))$('#nowPosition').textContent=formatTime(duration*ratio);
}

function toggleFavorite(){
  if(!currentTrack||!window.AsiriTasteEngine)return;
  window.AsiriTasteEngine.rate(currentTrack,'like');
  syncFavorite();
}

window.addEventListener('asiri:player-state',event=>applyState(event.detail));
window.addEventListener('asiri:track-selected',event=>{
  if(event.detail?.track)currentTrack=event.detail.track;
  setQueue(event.detail?.queue,event.detail?.index);
  render();
});
window.addEventListener('asiri:queue-changed',event=>{
  setQueue(event.detail?.tracks,event.detail?.currentIndex);
  renderQueue();
});
window.addEventListener('asiri:taste-updated',syncFavorite);

$('#openNowPlaying')?.addEventListener('click',open);
$('#closeNowPlaying')?.addEventListener('click',close);
$('#nowPrevious')?.addEventListener('click',()=>command('previous'));
$('#nowPlayPause')?.addEventListener('click',()=>command('toggle'));
$('#nowNext')?.addEventListener('click',()=>command('next'));
$('#nowSeek')?.addEventListener('input',previewSeek);
$('#nowSeek')?.addEventListener('change',seek);
$('#nowFavoriteButton')?.addEventListener('click',toggleFavorite);
$('#nowSave')?.addEventListener('click',toggleFavorite);
$('#nowQueueToggle')?.addEventListener('click',()=>{
  const panel=$('#nowQueuePanel');
  if(!panel)return;
  const opening=panel.classList.contains('hidden');
  panel.classList.toggle('hidden',!opening);
  $('#nowQueueToggle')?.setAttribute('aria-expanded',opening?'true':'false');
  if(opening)renderQueue();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#nowPlaying')?.classList.contains('hidden'))close()});

ticker=setInterval(()=>{if(!$('#nowPlaying')?.classList.contains('hidden'))renderProgress()},1000);
window.addEventListener('pagehide',()=>clearInterval(ticker),{once:true});
