import {buildSmartMixQueries,personalizeTracks,smartMixSeeds} from './smart-mix-core.js?v=20260808-smartmix-v1';

const $=selector=>document.querySelector(selector);
const TASTE_KEY='asiri-music-pro.v1.taste.profile';
const HISTORY_KEY='listening.history.v1';
const CACHE_KEY='smartMix.last.v1';
const CACHE_MAX_AGE=24*60*60*1000;
const state={tracks:[],seeds:[],generatedAt:0,busy:false};
let bridge=null;

function waitForBridge(timeout=5000){
  if(window.AsiriMusicBridge)return Promise.resolve(window.AsiriMusicBridge);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Asiri Music Bridge غير جاهز')),timeout);
    window.addEventListener('asiri:bridge-ready',()=>{clearTimeout(timer);resolve(window.AsiriMusicBridge)},{once:true});
  });
}

function loadTaste(){
  try{return JSON.parse(localStorage.getItem(TASTE_KEY)||'{"tracks":{},"artists":{},"events":[]}')}
  catch{return{tracks:{},artists:{},events:[]}}
}

function loadHistory(){
  const history=bridge?.getStorage(HISTORY_KEY);
  return Array.isArray(history)?history:[];
}

function setStatus(message){if($('#smartMixStatus'))$('#smartMixStatus').textContent=message}
function trackArtists(track){return (track?.artists||[]).map(artist=>artist.name).filter(Boolean).join('، ')||'Asiri Music'}
function cover(track){return track?.album?.images?.[0]?.url||''}

function renderSeeds(){
  const root=$('#smartMixSeeds');
  if(!root)return;
  root.replaceChildren();
  const seeds=state.seeds.length?state.seeds:smartMixSeeds(loadTaste(),loadHistory(),4);
  (seeds.length?seeds:['سعودي','خليجي','طرب']).forEach(name=>{
    const chip=document.createElement('span');chip.textContent=name;root.appendChild(chip);
  });
}

function renderTracks(){
  const root=$('#smartMixPreview');
  if(!root)return;
  root.replaceChildren();
  state.tracks.slice(0,6).forEach(track=>{
    const index=state.tracks.indexOf(track);
    const item=document.createElement('button');
    item.type='button';item.className='smart-mix-track';
    const image=document.createElement('img');image.src=cover(track);image.alt='';image.loading='lazy';
    const info=document.createElement('span');
    const title=document.createElement('strong');title.textContent=track.name||'أغنية';
    const artist=document.createElement('small');artist.textContent=trackArtists(track);
    info.append(title,artist);item.append(image,info);
    item.addEventListener('click',()=>playMix(index));
    root.appendChild(item);
  });
  const count=$('#smartMixCount');
  if(count)count.textContent=state.tracks.length?state.tracks.length+' أغنية':'مزيج شخصي';
  const play=$('#smartMixPlay');
  const session=$('#smartMixSession');
  if(play)play.disabled=!state.tracks.length;
  if(session)session.disabled=!state.tracks.length;
}

function render(){renderSeeds();renderTracks()}

async function buildMix(){
  if(state.busy||!bridge)return;
  const button=$('#smartMixGenerate');
  state.busy=true;
  if(button){button.disabled=true;button.textContent='جارٍ بناء مزيجك…'}
  setStatus('أقرأ ذوقك وآخر استماع ثم أرتب مزيجًا جديدًا لك…');
  try{
    const taste=loadTaste(),history=loadHistory();
    const queries=buildSmartMixQueries(taste,history,4);
    const candidates=[];
    for(const query of queries){
      const data=await bridge.api('/search?'+new URLSearchParams({q:query,type:'track',limit:'20',offset:'0'}));
      candidates.push(...(data.tracks?.items||[]));
    }
    state.tracks=personalizeTracks(candidates,{taste,history,limit:24});
    state.seeds=smartMixSeeds(taste,history,4);
    state.generatedAt=Date.now();
    if(!state.tracks.length)throw new Error('لم أجد نتائج كافية لبناء المزيج الآن.');
    bridge.setStorage(CACHE_KEY,{tracks:state.tracks,seeds:state.seeds,generatedAt:state.generatedAt});
    render();
    setStatus('مزيجك جاهز — '+state.tracks.length+' أغنية مرتبة من ذوقك واستماعك الأخير.');
  }catch(error){
    console.error('[Smart Mix build]',error);
    setStatus(error.message==='AUTH_REQUIRED'?'سجّل الدخول إلى Spotify أولًا لإنشاء مزيجك.':(error.message||'تعذر إنشاء المزيج الآن.'));
  }finally{
    state.busy=false;
    if(button){button.disabled=false;button.textContent=state.tracks.length?'↻ تحديث مزيجي':'✨ أنشئ مزيجي'}
  }
}

async function playMix(startIndex=0){
  if(!state.tracks.length)return;
  try{
    await bridge.activateFromGesture?.();
    await bridge.playQueue(state.tracks,{startIndex,source:'smart-mix',userGesture:true});
    window.dispatchEvent(new Event('asiri:open-now-playing'));
    setStatus('يعمل مزيجك الآن داخل Asiri Music.');
  }catch(error){
    console.error('[Smart Mix play]',error);
    setStatus(error.message||'تعذر تشغيل المزيج.');
  }
}

function openAsSession(){
  if(!state.tracks.length)return;
  const session={prompt:'Asiri Smart Mix — مزيج أحمد',tracks:state.tracks,createdAt:Date.now(),savedSessionId:''};
  bridge.setStorage('aiDj.lastSession',session);
  window.dispatchEvent(new CustomEvent('asiri:session-load',{detail:session}));
  window.AsiriMusicOS?.openPage('sessions');
}

async function init(){
  try{bridge=await waitForBridge()}
  catch(error){console.error('[Smart Mix init]',error);return}
  const cached=bridge.getStorage(CACHE_KEY);
  if(cached?.tracks?.length){
    state.tracks=cached.tracks;
    state.seeds=Array.isArray(cached.seeds)?cached.seeds:[];
    state.generatedAt=Number(cached.generatedAt)||0;
    setStatus(Date.now()-state.generatedAt<CACHE_MAX_AGE?'مزيجك جاهز للاستماع.':'مزيجك محفوظ — حدّثه ليعكس آخر استماعك.');
  }else setStatus('أنشئ أول مزيج شخصي من ذوقك وسجل استماعك.');
  render();
  $('#smartMixGenerate')?.addEventListener('click',buildMix);
  $('#smartMixPlay')?.addEventListener('click',()=>playMix(0));
  $('#smartMixSession')?.addEventListener('click',openAsSession);
  window.addEventListener('asiri:taste-updated',()=>{renderSeeds();setStatus('تغيّر ملف ذوقك — حدّث المزيج للحصول على ترتيب أحدث.')});
}

init();
