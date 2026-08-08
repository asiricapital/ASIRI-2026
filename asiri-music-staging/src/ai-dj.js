import {
  buildSessionQueries,
  describeSessionIntent,
  parseSessionIntent,
  rankSessionTracks,
  selectSessionTracks,
  sessionDurationMinutes
} from './ai-dj-core.js?v=20260808-ai-dj-v2';

const $=selector=>document.querySelector(selector);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const TASTE_KEY='asiri-music-pro.v1.taste.profile';
const state={tracks:[],busy:false,prompt:'',intent:null,currentTrackId:'',currentIndex:-1,savedSessionId:''};

function getBridge(){return window.AsiriMusicBridge}
function waitForBridge(){
  return new Promise(resolve=>{
    if(getBridge())return resolve(getBridge());
    const done=()=>{
      window.removeEventListener('asiri:bridge-ready',done);
      resolve(getBridge());
    };
    window.addEventListener('asiri:bridge-ready',done);
  });
}
function normalizePrompt(prompt){return String(prompt||'').trim().replace(/\s+/g,' ')}

function loadTaste(){
  try{return JSON.parse(localStorage.getItem(TASTE_KEY)||'{"tracks":{},"artists":{},"events":[]}')}
  catch{return{tracks:{},artists:{},events:[]}}
}
function saveTaste(data){
  localStorage.setItem(TASTE_KEY,JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('asiri:taste-updated',{detail:data}));
}
function rateTrack(track,value){
  const data=loadTaste();
  const previous=data.tracks?.[track.id]?.value;
  data.tracks=data.tracks||{};
  data.artists=data.artists||{};
  const artists=(track.artists||[]).map(artist=>artist.name).filter(Boolean);
  const adjust=(name,type,delta)=>{
    const current=data.artists[name]||{likes:0,dislikes:0,score:0};
    if(type==='like')current.likes=Math.max(0,(current.likes||0)+delta);
    else current.dislikes=Math.max(0,(current.dislikes||0)+delta);
    current.score=(current.score||0)+(type==='like'?2:-2)*delta;
    data.artists[name]=current;
  };
  if(previous===value){
    delete data.tracks[track.id];
    artists.forEach(name=>adjust(name,value,-1));
  }else{
    if(previous)artists.forEach(name=>adjust(name,previous,-1));
    artists.forEach(name=>adjust(name,value,1));
    data.tracks[track.id]={
      id:track.id,
      name:track.name,
      artist:artists.join('، '),
      cover:track.album?.images?.[0]?.url||'',
      uri:track.uri||'spotify:track:'+track.id,
      value,
      updatedAt:Date.now()
    };
  }
  saveTaste(data);
  renderPreview();
}

function persist(){
  const session={
    prompt:state.prompt,
    intent:state.intent,
    tracks:state.tracks,
    createdAt:Date.now(),
    savedSessionId:state.savedSessionId||''
  };
  getBridge()?.setStorage('aiDj.lastSession',session);
  window.dispatchEvent(new CustomEvent('asiri:session-updated',{detail:session}));
}
function ratingFor(id){return loadTaste().tracks?.[id]?.value||''}

async function playFrom(index){
  const bridge=getBridge();
  if(!bridge||!state.tracks[index])return;
  state.currentIndex=index;
  $('#aiDjStatus').textContent='جارٍ تشغيل الأغنية '+(index+1)+' من '+state.tracks.length+'…';
  try{
    await bridge.playQueue(state.tracks,{startIndex:index,source:'ai-dj',userGesture:true});
    state.currentTrackId=state.tracks[index].id;
    renderPreview();
    $('#aiDjStatus').textContent='يعمل الآن: '+state.tracks[index].name+' — '+(index+1)+' من '+state.tracks.length;
  }catch(error){
    console.error(error);
    $('#aiDjStatus').textContent=error.message||'تعذر تشغيل الأغنية.';
  }
}

function moveTrack(index,direction){
  const target=index+direction;
  if(target<0||target>=state.tracks.length)return;
  [state.tracks[index],state.tracks[target]]=[state.tracks[target],state.tracks[index]];
  state.currentIndex=state.tracks.findIndex(track=>track.id===state.currentTrackId);
  persist();
  renderPreview();
  $('#aiDjStatus').textContent='تم تحديث ترتيب الجلسة.';
}

function removeTrack(index){
  const removed=state.tracks.splice(index,1)[0];
  if(!removed)return;
  if(removed.id===state.currentTrackId){
    state.currentTrackId='';
    state.currentIndex=-1;
  }else{
    state.currentIndex=state.tracks.findIndex(track=>track.id===state.currentTrackId);
  }
  persist();
  renderPreview();
  $('#aiDjStatus').textContent='تم حذف «'+removed.name+'». بقي '+state.tracks.length+' أغنية.';
}

function renderPreview(){
  const wrap=$('#aiDjPreview');
  const count=$('#aiDjCount');
  if(!wrap||!count)return;
  wrap.innerHTML='';
  count.textContent=state.tracks.length?state.tracks.length+' أغنية':'';
  state.tracks.forEach((track,index)=>{
    const item=document.createElement('article');
    item.className='ai-dj-track'+(track.id===state.currentTrackId?' is-playing':'');
    item.dataset.trackId=track.id||'';
    const cover=track.album?.images?.[0]?.url||'';
    const artist=(track.artists||[]).map(entry=>entry.name).join('، ');
    const playing=track.id===state.currentTrackId;
    item.innerHTML=
      '<span class="ai-track-number">'+(index+1)+'</span>'+
      '<img src="'+cover+'" alt="">'+
      '<button type="button" class="ai-track-info"><strong>'+String(track.name||'')+'</strong><small>'+artist+'</small><em>'+(playing?'يعمل الآن':'')+'</em></button>'+
      '<div class="ai-track-actions">'+
      '<button type="button" data-action="play">'+(playing?'⏸':'▶')+'</button>'+
      '<button type="button" data-action="up" '+(index===0?'disabled':'')+'>↑</button>'+
      '<button type="button" data-action="down" '+(index===state.tracks.length-1?'disabled':'')+'>↓</button>'+
      '<button type="button" data-action="like" class="'+(ratingFor(track.id)==='like'?'active':'')+'">♡</button>'+
      '<button type="button" data-action="remove">✕</button></div>';
    item.querySelector('.ai-track-info').addEventListener('click',()=>playFrom(index));
    item.querySelector('.ai-track-actions').addEventListener('click',event=>{
      const action=event.target.closest('button')?.dataset.action;
      if(action==='play')playFrom(index);
      if(action==='up')moveTrack(index,-1);
      if(action==='down')moveTrack(index,1);
      if(action==='like')rateTrack(track,'like');
      if(action==='remove')removeTrack(index);
    });
    wrap.appendChild(item);
  });
}

function renderIntent(intent){
  const node=$('#aiDjIntent');
  if(node)node.textContent=intent?describeSessionIntent(intent):'';
}

async function collectTracks(bridge,queries){
  const tracks=[];
  for(const query of queries){
    const data=await bridge.api('/search?'+new URLSearchParams({q:query,type:'track',limit:'10',offset:'0'}));
    tracks.push(...(data.tracks?.items||[]));
    await sleep(80);
  }
  return tracks;
}

async function generateSession({promptOverride='',seedTrack=null}={}){
  if(state.busy)return[];
  const bridge=getBridge()||await waitForBridge();
  const input=$('#aiDjPrompt');
  const button=$('#aiDjGenerate');
  const message=$('#aiDjStatus');
  const prompt=normalizePrompt(promptOverride||input?.value);
  if(!prompt){
    if(message)message.textContent='اكتب نوع الجلسة التي تريدها.';
    return[];
  }
  const intent=parseSessionIntent(prompt,{seedTrack,defaultMinutes:60});
  state.busy=true;
  state.prompt=prompt;
  state.intent=intent;
  if(input)input.value=prompt;
  if(button){button.disabled=true;button.textContent='جارٍ البناء…'}
  if(message)message.textContent='ASIRI DJ يفهم الطلب ويبحث ويوازن النتائج مع ذوقك…';
  renderIntent(intent);
  try{
    const taste=loadTaste();
    const queries=buildSessionQueries(intent,{seedTrack,taste,maxQueries:6});
    const candidates=await collectTracks(bridge,queries);
    const ranked=rankSessionTracks(candidates,{intent,taste,seedTrack});
    const maxPerArtist=seedTrack?6:(intent.artistHints.length===1?18:6);
    state.savedSessionId='';
    state.tracks=selectSessionTracks(ranked,{targetMinutes:intent.targetMinutes,maxTracks:30,maxPerArtist});
    state.currentIndex=-1;
    state.currentTrackId='';
    persist();
    renderPreview();
    const minutes=sessionDurationMinutes(state.tracks);
    if(message){
      message.textContent=state.tracks.length
        ?'تم بناء «'+prompt+'» — '+state.tracks.length+' أغنية، نحو '+minutes+' دقيقة. شغّلها أو عدّل ترتيبها.'
        :'لم أجد نتائج كافية لهذا الطلب. جرّب وصفًا أبسط.';
    }
    return state.tracks;
  }catch(error){
    console.error('[ASIRI DJ]',error);
    if(message)message.textContent=error.message||'تعذر إنشاء الجلسة الآن.';
    return[];
  }finally{
    state.busy=false;
    if(button){button.disabled=false;button.textContent='✨ إنشاء الجلسة'}
  }
}

async function generateSimilarSession(track){
  if(!track?.id)return;
  window.AsiriMusicOS?.openPage?.('sessions');
  const artist=(track.artists||[]).map(entry=>entry.name).filter(Boolean)[0]||'';
  const prompt='جلسة مشابهة لـ '+(track.name||'هذه الأغنية')+(artist?' مع '+artist:'')+' لمدة ساعة';
  const input=$('#aiDjPrompt');
  if(input)input.value=prompt;
  const tracks=await generateSession({promptOverride:prompt,seedTrack:track});
  const message=$('#aiDjStatus');
  if(tracks.length&&message){
    message.textContent='✨ بنيت جلسة حول «'+(track.name||'الأغنية')+'» وذوقك — '+tracks.length+' أغنية، نحو '+sessionDurationMinutes(tracks)+' دقيقة.';
  }
}

async function init(){
  const bridge=await waitForBridge();
  const last=bridge.getStorage('aiDj.lastSession');
  if(last?.tracks?.length){
    state.tracks=last.tracks;
    state.prompt=last.prompt||'';
    state.intent=last.intent||parseSessionIntent(state.prompt);
    state.savedSessionId=last.savedSessionId||'';
    $('#aiDjPrompt').value=state.prompt;
    renderIntent(state.intent);
    renderPreview();
    $('#aiDjStatus').textContent='تم استعادة آخر جلسة. يمكنك تعديل ترتيبها الآن.';
  }
  $('#aiDjGenerate').addEventListener('click',()=>generateSession());
  $('#aiDjPlay').addEventListener('click',()=>playFrom(0));
  document.querySelectorAll('[data-ai-preset]').forEach(button=>button.addEventListener('click',()=>{
    $('#aiDjPrompt').value=button.dataset.aiPreset;
    generateSession();
  }));
  window.addEventListener('asiri:player-state',event=>{
    const track=event.detail?.track;
    if(!track)return;
    state.currentTrackId=track.id||'';
    state.currentIndex=state.tracks.findIndex(item=>item.id===track.id);
    renderPreview();
  });
}

window.addEventListener('asiri:session-load',event=>{
  const session=event.detail;
  if(!session?.tracks?.length)return;
  state.tracks=session.tracks;
  state.prompt=session.prompt||session.name||'';
  state.intent=session.intent||parseSessionIntent(state.prompt);
  state.savedSessionId=session.savedSessionId||session.id||'';
  state.currentTrackId='';
  state.currentIndex=-1;
  const input=$('#aiDjPrompt');
  if(input)input.value=state.prompt;
  renderIntent(state.intent);
  persist();
  renderPreview();
  const message=$('#aiDjStatus');
  if(message)message.textContent='تم تحميل الجلسة المحفوظة. يمكنك تعديل ترتيبها أو حذف أغنيات منها.';
});

window.addEventListener('asiri:more-like-this',event=>generateSimilarSession(event.detail?.track));
window.addEventListener('asiri:ai-dj-prompt',event=>{
  const prompt=normalizePrompt(event.detail?.prompt);
  if(!prompt)return;
  window.AsiriMusicOS?.openPage?.('sessions');
  generateSession({promptOverride:prompt});
});
init().catch(error=>console.error('[ASIRI DJ]',error));
