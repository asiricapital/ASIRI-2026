const $=selector=>document.querySelector(selector);
const TASTE_KEY='asiri-music-pro.v1.taste.profile';
const SAVED_SESSIONS_KEY='library.savedSessions.v1';
const SPOTIFY_CACHE_KEY='library.spotifyLikes.v1';
const MAX_SPOTIFY_PAGES=10;
let bridge=null;
let libraryTracks=[];
let syncingLibrary=false;

function waitForBridge(){
  return new Promise(resolve=>{
    if(window.AsiriMusicBridge)return resolve(window.AsiriMusicBridge);
    const ready=()=>{
      window.removeEventListener('asiri:bridge-ready',ready);
      resolve(window.AsiriMusicBridge);
    };
    window.addEventListener('asiri:bridge-ready',ready);
  });
}

function readTaste(){
  try{return JSON.parse(localStorage.getItem(TASTE_KEY)||'{"tracks":{},"artists":{},"events":[]}')}
  catch{return{tracks:{},artists:{},events:[]}}
}

function compactTrack(track,savedAt=0){
  if(!track?.id)return null;
  let artists=Array.isArray(track.artists)?track.artists:[];
  if(!artists.length&&track.artist){
    artists=String(track.artist).split('،').map(name=>({name:name.trim()})).filter(item=>item.name);
  }
  artists=artists.map(item=>({name:typeof item==='string'?item:item?.name||''})).filter(item=>item.name);
  const cover=track.album?.images?.[0]?.url||track.cover||'';
  const albumName=track.album?.name||track.albumName||'';
  const spotify=track.external_urls?.spotify||track.url||('https://open.spotify.com/track/'+encodeURIComponent(track.id));
  return{
    id:String(track.id),
    name:track.name||'بدون اسم',
    uri:track.uri||('spotify:track:'+track.id),
    artists,
    album:{name:albumName,images:cover?[{url:cover}]:[]},
    external_urls:{spotify},
    savedAt:Number(savedAt||track.savedAt||track.updatedAt||0)
  };
}

function spotifyCache(){
  const cache=bridge?.getStorage(SPOTIFY_CACHE_KEY);
  return cache&&Array.isArray(cache.tracks)?cache:{tracks:[],syncedAt:0,complete:false};
}

function savedSessions(){
  const value=bridge?.getStorage(SAVED_SESSIONS_KEY);
  return Array.isArray(value)?value:[];
}

function formatDate(value){
  try{return new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}
  catch{return''}
}

function sourceLabel(sources){
  const set=new Set(sources||[]);
  if(set.has('spotify')&&set.has('asiri'))return 'Asiri + Spotify';
  if(set.has('spotify'))return 'محفوظة في Spotify';
  return 'إعجاب داخل Asiri';
}

function combineLibraryTracks(){
  const map=new Map();
  const add=(track,source)=>{
    const next=compactTrack(track,track?.savedAt);
    if(!next)return;
    const current=map.get(next.id);
    if(!current){
      map.set(next.id,{...next,sources:[source]});
      return;
    }
    const nextHasCover=Boolean(next.album?.images?.[0]?.url);
    const merged={
      ...current,
      ...next,
      artists:next.artists.length?next.artists:current.artists,
      album:nextHasCover?next.album:current.album,
      external_urls:next.external_urls?.spotify?next.external_urls:current.external_urls,
      savedAt:Math.max(Number(current.savedAt||0),Number(next.savedAt||0)),
      sources:[...new Set([...(current.sources||[]),source])]
    };
    map.set(next.id,merged);
  };

  Object.values(readTaste().tracks||{})
    .filter(item=>item?.value==='like')
    .forEach(item=>add({...item,savedAt:item.updatedAt||0},'asiri'));

  spotifyCache().tracks.forEach(item=>add(item,'spotify'));
  libraryTracks=[...map.values()].sort((a,b)=>(b.savedAt||0)-(a.savedAt||0)||a.name.localeCompare(b.name,'ar'));
  renderLibraryTracks();
}

function librarySearchText(track){
  return [track.name,track.album?.name,...(track.artists||[]).map(item=>item.name)].join(' ').toLowerCase();
}

function createLibraryTrackCard(track){
  const card=document.createElement('article');
  card.className='library-track-card';

  const image=document.createElement('img');
  image.className='library-track-cover';
  image.alt='';
  image.loading='lazy';
  image.src=track.album?.images?.[0]?.url||'';

  const info=document.createElement('div');
  info.className='library-track-info';
  const name=document.createElement('strong');
  name.textContent=track.name||'بدون اسم';
  const artist=document.createElement('span');
  artist.textContent=(track.artists||[]).map(item=>item.name).join('، ')||'فنان غير معروف';
  const source=document.createElement('span');
  source.className='library-source';
  source.textContent=sourceLabel(track.sources);
  info.append(name,artist,source);

  const actions=document.createElement('div');
  actions.className='library-track-actions';
  const play=document.createElement('button');
  play.type='button';
  play.textContent='▶ تشغيل هنا';
  play.addEventListener('click',async()=>{
    try{await bridge.activateFromGesture?.();await bridge.playQueue([track],{startIndex:0,source:'library',userGesture:true})}
    catch(error){setLibraryStatus(error.message||'تعذر فتح الأغنية.')}
  });
  const open=document.createElement('a');
  open.href=track.external_urls?.spotify||('https://open.spotify.com/track/'+encodeURIComponent(track.id));
  open.target='_blank';
  open.rel='noopener';
  open.textContent='عرض في Spotify';
  actions.append(play,open);

  card.append(image,info,actions);
  return card;
}

function renderLibraryTracks(){
  const root=$('#libraryTracks');
  if(!root)return;
  const query=($('#librarySearch')?.value||'').trim().toLowerCase();
  const visible=query?libraryTracks.filter(track=>librarySearchText(track).includes(query)):libraryTracks;
  root.innerHTML='';
  visible.forEach(track=>root.appendChild(createLibraryTrackCard(track)));

  if($('#libraryTrackCount'))$('#libraryTrackCount').textContent=libraryTracks.length+' أغنية';
  if($('#libraryTrackMetric'))$('#libraryTrackMetric').textContent=String(libraryTracks.length);
  const empty=$('#libraryTracksEmpty');
  if(empty){
    empty.hidden=visible.length>0;
    empty.textContent=query?'لا توجد نتيجة داخل مكتبتك بهذا الاسم.':'لا توجد أغنيات في المكتبة بعد. استخدم «أعجبتني» أو زامن مكتبة Spotify.';
  }
}

function setLibraryStatus(text){
  if($('#librarySyncStatus'))$('#librarySyncStatus').textContent=text||'';
}

async function syncSpotifyLibrary({silent=false}={}){
  if(syncingLibrary||!bridge)return;
  syncingLibrary=true;
  const button=$('#syncSpotifyLibrary');
  if(button)button.disabled=true;
  if(!silent)setLibraryStatus('جارٍ مزامنة الأغاني المحفوظة في Spotify…');

  try{
    const tracks=[];
    let offset=0;
    let pages=0;
    let hasMore=false;
    do{
      const data=await bridge.api('/me/tracks?limit=50&offset='+offset);
      const items=Array.isArray(data?.items)?data.items:[];
      items.forEach(item=>{
        const savedAt=item?.added_at?Date.parse(item.added_at):0;
        const track=compactTrack(item?.track,savedAt);
        if(track)tracks.push(track);
      });
      pages+=1;
      offset+=items.length;
      hasMore=Boolean(data?.next)&&items.length>0;
      if(items.length<50)hasMore=false;
    }while(hasMore&&pages<MAX_SPOTIFY_PAGES);

    const deduped=[...new Map(tracks.map(track=>[track.id,track])).values()];
    bridge.setStorage(SPOTIFY_CACHE_KEY,{
      tracks:deduped,
      syncedAt:Date.now(),
      complete:!hasMore,
      capped:hasMore
    });
    combineLibraryTracks();
    setLibraryStatus(hasMore?'تم تحميل أحدث '+deduped.length+' أغنية من Spotify.':'تمت المزامنة مع Spotify — '+deduped.length+' أغنية محفوظة.');
  }catch(error){
    console.error('[Music Library sync]',error);
    const message=error?.message==='AUTH_REQUIRED'
      ?'سجّل الدخول إلى Spotify لمزامنة مكتبتك.'
      :(error?.status===403?'أعد تسجيل الدخول لمنح صلاحية قراءة مكتبة Spotify.':error?.message||'تعذر مزامنة Spotify الآن.');
    setLibraryStatus(message);
  }finally{
    syncingLibrary=false;
    if(button)button.disabled=false;
  }
}

function sessionId(){
  if(crypto.randomUUID)return crypto.randomUUID();
  return 'session-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);
}

function defaultSessionName(session){
  const prompt=String(session?.prompt||'').trim();
  if(prompt)return prompt.slice(0,80);
  return 'جلسة Asiri — '+new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium'}).format(new Date());
}

function normalizeSession(session,{id,name,createdAt}={}){
  return{
    id:id||session?.id||sessionId(),
    name:name||session?.name||defaultSessionName(session),
    prompt:String(session?.prompt||'').trim(),
    createdAt:Number(createdAt||session?.createdAt||Date.now()),
    updatedAt:Date.now(),
    tracks:(session?.tracks||[]).map(track=>compactTrack(track)).filter(Boolean)
  };
}

function setSessionStatus(text){
  if($('#saveSessionStatus'))$('#saveSessionStatus').textContent=text||'';
}

function writeSavedSessions(items){
  const sorted=[...items].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  bridge.setStorage(SAVED_SESSIONS_KEY,sorted);
  renderSavedSessions();
  window.dispatchEvent(new CustomEvent('asiri:saved-sessions-updated',{detail:sorted}));
}

function currentSession(){
  return bridge?.getStorage('aiDj.lastSession')||null;
}

function refreshSaveButton(){
  const button=$('#saveCurrentSession');
  if(!button)return;
  const current=currentSession();
  const isSaved=Boolean(current?.savedSessionId&&savedSessions().some(item=>item.id===current.savedSessionId));
  button.classList.toggle('is-saved',isSaved);
  button.textContent=isSaved?'✓ تحديث الجلسة المحفوظة':'♡ حفظ الجلسة';
}

function saveCurrentSession(){
  const current=currentSession();
  if(!current?.tracks?.length){
    setSessionStatus('أنشئ جلسة أولًا ثم اضغط حفظ.');
    return;
  }
  try{
    const items=savedSessions();
    const existingId=current.savedSessionId||'';
    const existingIndex=items.findIndex(item=>item.id===existingId);
    let record;
    if(existingIndex>=0){
      const old=items[existingIndex];
      record=normalizeSession(current,{id:old.id,name:old.name,createdAt:old.createdAt});
      items[existingIndex]=record;
      setSessionStatus('تم تحديث الجلسة المحفوظة ✓');
    }else{
      record=normalizeSession(current,{id:existingId||sessionId()});
      items.unshift(record);
      setSessionStatus('تم حفظ الجلسة في مكتبتك ✓');
    }
    writeSavedSessions(items);
    const active={prompt:record.prompt,tracks:record.tracks,createdAt:Date.now(),savedSessionId:record.id};
    bridge.setStorage('aiDj.lastSession',active);
    window.dispatchEvent(new CustomEvent('asiri:session-load',{detail:{...active,id:record.id,name:record.name}}));
    refreshSaveButton();
  }catch(error){
    console.error('[Saved Sessions save]',error);
    setSessionStatus('تعذر حفظ الجلسة على هذا الجهاز.');
  }
}

function updateSavedFromActive(session){
  const id=session?.savedSessionId;
  if(!id)return;
  const items=savedSessions();
  const index=items.findIndex(item=>item.id===id);
  if(index<0){refreshSaveButton();return}
  const old=items[index];
  items[index]=normalizeSession(session,{id:old.id,name:old.name,createdAt:old.createdAt});
  try{writeSavedSessions(items)}
  catch(error){console.error('[Saved Sessions autosave]',error)}
  refreshSaveButton();
}

function openSessionForEdit(session){
  const active={
    prompt:session.prompt||session.name||'',
    tracks:session.tracks||[],
    createdAt:Date.now(),
    savedSessionId:session.id
  };
  bridge.setStorage('aiDj.lastSession',active);
  window.dispatchEvent(new CustomEvent('asiri:session-load',{detail:{...active,id:session.id,name:session.name}}));
  window.AsiriMusicOS?.openPage('sessions');
  setSessionStatus('تم فتح «'+session.name+'» للتعديل. أي ترتيب أو حذف سيُحفظ تلقائيًا.');
}

async function playSavedSession(session){
  try{
    if(!session.tracks?.length)throw new Error('هذه الجلسة فارغة.');
    setSessionStatus('جارٍ تشغيل «'+session.name+'» داخل Asiri Music…');
    await bridge.activateFromGesture?.();
    await bridge.playQueue(session.tracks,{startIndex:0,source:'saved-session',userGesture:true});
  }catch(error){
    console.error('[Saved Sessions play]',error);
    setSessionStatus(error.message||'تعذر تشغيل الجلسة.');
  }
}

function renameSession(session){
  const name=window.prompt('اسم الجلسة',session.name||defaultSessionName(session));
  if(name===null)return;
  const clean=name.trim().slice(0,80);
  if(!clean)return;
  const items=savedSessions();
  const index=items.findIndex(item=>item.id===session.id);
  if(index<0)return;
  items[index]={...items[index],name:clean,updatedAt:Date.now()};
  writeSavedSessions(items);
}

function deleteSession(session){
  if(!window.confirm('حذف جلسة «'+session.name+'» من مكتبتك؟'))return;
  const items=savedSessions().filter(item=>item.id!==session.id);
  writeSavedSessions(items);
  const active=currentSession();
  if(active?.savedSessionId===session.id){
    bridge.setStorage('aiDj.lastSession',{...active,savedSessionId:''});
  }
  setSessionStatus('تم حذف الجلسة من المكتبة.');
  refreshSaveButton();
}

async function copyText(text){
  if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);
  const area=document.createElement('textarea');
  area.value=text;
  area.style.position='fixed';
  area.style.opacity='0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

async function shareSession(session){
  const lines=(session.tracks||[]).slice(0,20).map((track,index)=>{
    const artist=(track.artists||[]).map(item=>item.name).join('، ');
    const url=track.external_urls?.spotify||('https://open.spotify.com/track/'+encodeURIComponent(track.id));
    return (index+1)+'. '+track.name+(artist?' — '+artist:'')+'\n'+url;
  });
  const text='جلسة «'+session.name+'» من Asiri Music\n'+session.tracks.length+' أغنية\n\n'+lines.join('\n');
  try{
    if(navigator.share){
      await navigator.share({title:'Asiri Music — '+session.name,text});
      setSessionStatus('تم فتح خيارات مشاركة الجلسة.');
    }else{
      await copyText(text);
      setSessionStatus('تم نسخ الجلسة وروابط الأغاني ✓');
    }
  }catch(error){
    if(error?.name!=='AbortError'){
      console.error('[Saved Sessions share]',error);
      setSessionStatus('تعذرت المشاركة الآن.');
    }
  }
}

function sessionAction(label,className,handler){
  const button=document.createElement('button');
  button.type='button';
  button.className=className||'';
  button.textContent=label;
  button.addEventListener('click',handler);
  return button;
}

function createSessionCard(session){
  const card=document.createElement('article');
  card.className='saved-session-card';

  const cover=document.createElement('img');
  cover.className='saved-session-cover';
  cover.alt='';
  cover.loading='lazy';
  cover.src=session.tracks?.[0]?.album?.images?.[0]?.url||'';

  const info=document.createElement('div');
  info.className='saved-session-info';
  const title=document.createElement('strong');
  title.textContent=session.name||'جلسة Asiri';
  const meta=document.createElement('span');
  meta.textContent=(session.tracks?.length||0)+' أغنية'+(session.prompt?' • '+session.prompt:'');
  const date=document.createElement('small');
  date.textContent='آخر تعديل: '+formatDate(session.updatedAt||session.createdAt);
  info.append(title,meta,date);

  const actions=document.createElement('div');
  actions.className='saved-session-actions';
  actions.append(
    sessionAction('فتح وتعديل','session-open',()=>openSessionForEdit(session)),
    sessionAction('▶ Spotify','session-play',()=>playSavedSession(session)),
    sessionAction('تسمية','',()=>renameSession(session)),
    sessionAction('مشاركة','',()=>shareSession(session)),
    sessionAction('حذف','session-delete',()=>deleteSession(session))
  );

  card.append(cover,info,actions);
  return card;
}

function renderSavedSessions(){
  const root=$('#savedSessionsList');
  if(!root)return;
  const items=savedSessions();
  root.innerHTML='';
  items.forEach(session=>root.appendChild(createSessionCard(session)));
  if($('#savedSessionsCount'))$('#savedSessionsCount').textContent=items.length+' جلسة';
  if($('#savedSessionsMetric'))$('#savedSessionsMetric').textContent=String(items.length);
  const empty=$('#savedSessionsEmpty');
  if(empty)empty.hidden=items.length>0;
  refreshSaveButton();
}

function handleStorage(event){
  if(!event.key)return;
  if(event.key===TASTE_KEY||event.key.includes(SAVED_SESSIONS_KEY)||event.key.includes(SPOTIFY_CACHE_KEY)){
    combineLibraryTracks();
    renderSavedSessions();
  }
}

async function init(){
  bridge=await waitForBridge();
  renderSavedSessions();
  combineLibraryTracks();

  $('#saveCurrentSession')?.addEventListener('click',saveCurrentSession);
  $('#syncSpotifyLibrary')?.addEventListener('click',()=>syncSpotifyLibrary());
  $('#librarySearch')?.addEventListener('input',renderLibraryTracks);

  window.addEventListener('asiri:taste-updated',combineLibraryTracks);
  window.addEventListener('asiri:session-updated',event=>updateSavedFromActive(event.detail));
  window.addEventListener('storage',handleStorage);

  const cache=spotifyCache();
  const connected=Boolean(bridge.getStorage('spotify.accessToken')||bridge.getStorage('spotify.refreshToken'));
  if(cache.syncedAt){
    setLibraryStatus('آخر مزامنة مع Spotify: '+formatDate(cache.syncedAt));
  }else{
    setLibraryStatus(connected?'سيتم جلب الأغاني المحفوظة من Spotify.':'سجّل الدخول إلى Spotify لإضافة أغانيه المحفوظة إلى مكتبتك.');
  }
  if(connected&&(!cache.syncedAt||Date.now()-cache.syncedAt>6*60*60*1000)){
    syncSpotifyLibrary({silent:true});
  }
}

init().catch(error=>console.error('[Asiri Music Library isolated]',error));
