import {compactTrack,upsertHistory,safeResumePosition} from './listening-history-core.js?v=20260808-history-v1';

const $=selector=>document.querySelector(selector);
const HISTORY_KEY='listening.history.v1';
const RESUME_KEY='listening.resume.v1';
const RECENT_VISIBLE=6;
let bridge=null;
let lastRecordedId='';
let liveState=null;

function waitForBridge(timeout=5000){
  if(window.AsiriMusicBridge)return Promise.resolve(window.AsiriMusicBridge);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Asiri Music Bridge غير جاهز')),timeout);
    window.addEventListener('asiri:bridge-ready',()=>{clearTimeout(timer);resolve(window.AsiriMusicBridge)},{once:true});
  });
}

function history(){
  const value=bridge?.getStorage(HISTORY_KEY);
  return Array.isArray(value)?value.filter(item=>item?.id):[];
}

function resume(){
  const value=bridge?.getStorage(RESUME_KEY);
  return value?.track?.id?value:null;
}

function formatTime(ms){
  const seconds=Math.max(0,Math.floor((Number(ms)||0)/1000));
  return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}

function relativeTime(timestamp){
  const minutes=Math.max(0,Math.round((Date.now()-(Number(timestamp)||Date.now()))/60000));
  if(minutes<1)return 'الآن';
  if(minutes<60)return 'منذ '+minutes+' د';
  const hours=Math.round(minutes/60);
  if(hours<24)return 'منذ '+hours+' س';
  return 'منذ '+Math.round(hours/24)+' يوم';
}

function artists(track){return (track?.artists||[]).map(artist=>artist.name).filter(Boolean).join('، ')||'Asiri Music'}
function cover(track){return track?.album?.images?.[0]?.url||''}

function normalizedQueue(detail){
  const source=Array.isArray(detail?.queue)&&detail.queue.length?detail.queue:(bridge?.getQueue?.()||[]);
  const compact=source.map(compactTrack).filter(Boolean).slice(0,50);
  const currentId=detail?.track?.id;
  if(!compact.length&&currentId){const current=compactTrack(detail.track);if(current)compact.push(current)}
  return compact;
}

function buildResume(detail,{live=false}={}){
  const track=compactTrack(detail?.track);
  if(!track)return null;
  const queue=normalizedQueue(detail);
  let index=Number.isInteger(detail?.index)?detail.index:queue.findIndex(item=>item.id===track.id);
  if(index<0)index=0;
  let position=Math.max(0,Number(detail?.position)||0);
  if(live&&!detail?.paused)position+=Math.max(0,Date.now()-(Number(detail?.observedAt)||Date.now()));
  return {
    track,queue,index:Math.min(index,Math.max(0,queue.length-1)),position,
    duration:Math.max(0,Number(detail?.duration)||0),paused:Boolean(detail?.paused),updatedAt:Date.now()
  };
}

function persistState(detail){
  if(!bridge||!detail?.track?.id)return;
  liveState={...detail,observedAt:Date.now()};
  const record=buildResume(liveState);
  if(record)bridge.setStorage(RESUME_KEY,record);
  if(detail.track.id!==lastRecordedId){
    bridge.setStorage(HISTORY_KEY,upsertHistory(history(),detail.track));
    lastRecordedId=detail.track.id;
  }
  render();
}

function mediaImage(track,className){
  const image=document.createElement('img');
  image.className=className;
  image.alt='';
  image.loading='lazy';
  image.src=cover(track);
  return image;
}

async function resumeListening(){
  const record=resume();
  if(!record?.queue?.length)return;
  const button=$('#continueListeningButton');
  if(button){button.disabled=true;button.textContent='جارٍ الاستكمال…'}
  try{
    const positionMs=safeResumePosition(record.position,record.duration);
    await bridge.activateFromGesture?.();
    await bridge.playQueue(record.queue,{startIndex:record.index,source:'resume-history',userGesture:true,positionMs});
    window.dispatchEvent(new Event('asiri:open-now-playing'));
  }catch(error){
    console.error('[Listening History resume]',error);
    bridge.setStatus?.(error.message||'تعذر استكمال الاستماع.');
  }finally{if(button){button.disabled=false;button.textContent='▶ متابعة الاستماع'}}
}

async function playAgain(track){
  try{
    await bridge.activateFromGesture?.();
    await bridge.playQueue([track],{startIndex:0,source:'listening-history',userGesture:true});
    window.dispatchEvent(new Event('asiri:open-now-playing'));
  }catch(error){
    console.error('[Listening History play]',error);
    bridge.setStatus?.(error.message||'تعذر تشغيل الأغنية.');
  }
}

function renderContinue(){
  const root=$('#continueListeningContent');
  if(!root)return;
  root.replaceChildren();
  const record=resume();
  if(!record){root.className='listening-empty';root.textContent='ابدأ الاستماع داخل Asiri وسنحفظ آخر نقطة لك هنا.';return}
  root.className='continue-listening-card';
  root.appendChild(mediaImage(record.track,'continue-cover'));
  const info=document.createElement('div');
  info.className='continue-info';
  const title=document.createElement('strong');title.textContent=record.track.name;
  const artist=document.createElement('span');artist.textContent=artists(record.track);
  const time=document.createElement('small');time.textContent=relativeTime(record.updatedAt)+' • '+formatTime(safeResumePosition(record.position,record.duration));
  const progress=document.createElement('span');progress.className='continue-progress';
  const fill=document.createElement('i');
  fill.style.width=record.duration?Math.min(100,Math.max(0,record.position/record.duration*100))+'%':'0%';
  progress.appendChild(fill);info.append(title,artist,time,progress);
  const button=document.createElement('button');button.id='continueListeningButton';button.type='button';button.textContent='▶ متابعة الاستماع';button.addEventListener('click',resumeListening);
  root.append(mediaImage(record.track,'continue-bg'),info,button);
}

function recentRow(track){
  const button=document.createElement('button');
  button.type='button';button.className='recent-listening-row';
  button.appendChild(mediaImage(track,'recent-cover'));
  const info=document.createElement('span');info.className='recent-info';
  const title=document.createElement('strong');title.textContent=track.name||'أغنية';
  const artist=document.createElement('small');artist.textContent=artists(track);
  info.append(title,artist);button.appendChild(info);
  const when=document.createElement('em');when.textContent=relativeTime(track.listenedAt);button.appendChild(when);
  button.addEventListener('click',()=>playAgain(track));
  return button;
}

function renderRecent(){
  const root=$('#recentListeningList');
  if(!root)return;
  root.replaceChildren();
  const items=history().slice(0,RECENT_VISIBLE);
  items.forEach(track=>root.appendChild(recentRow(track)));
  const empty=$('#recentListeningEmpty');
  if(empty)empty.hidden=items.length>0;
  if($('#recentListeningCount'))$('#recentListeningCount').textContent=items.length?items.length+' أخيرة':'جديد';
}

function render(){renderContinue();renderRecent()}

async function init(){
  try{bridge=await waitForBridge();render()}
  catch(error){console.error('[Listening History init]',error);return}
  window.addEventListener('asiri:track-selected',event=>persistState({...event.detail,position:0,duration:0,paused:false}));
  window.addEventListener('asiri:player-state',event=>persistState(event.detail));
  window.addEventListener('storage',render);
  window.addEventListener('pagehide',()=>{
    if(!liveState||!bridge)return;
    const record=buildResume(liveState,{live:true});
    if(record)bridge.setStorage(RESUME_KEY,record);
  },{once:true});
}

init();
