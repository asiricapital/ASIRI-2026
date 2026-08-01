const $=selector=>document.querySelector(selector);

function waitForBridge(){
  return new Promise(resolve=>{
    if(window.AsiriMusicBridge)return resolve(window.AsiriMusicBridge);
    const ready=()=>{window.removeEventListener('asiri:bridge-ready',ready);resolve(window.AsiriMusicBridge)};
    window.addEventListener('asiri:bridge-ready',ready);
  });
}

function normalizeArabic(value=''){
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g,'')
    .replace(/[أإآ]/g,'ا')
    .replace(/ى/g,'ي')
    .replace(/ة/g,'ه')
    .replace(/ؤ/g,'و')
    .replace(/ئ/g,'ي')
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .trim()
    .replace(/\s+/g,' ');
}

function looksLikeArtistOnly(query){
  const q=query.trim();
  return q.length>=3 && q.length<=45 && !/[-–—:،,\/\\]/.test(q) && q.split(/\s+/).length<=4;
}

function artistMatches(track,artistName){
  const wanted=normalizeArabic(artistName);
  return (track.artists||[]).some(artist=>{
    const actual=normalizeArabic(artist.name||'');
    return actual===wanted || actual.includes(wanted) || wanted.includes(actual);
  });
}

async function exactArtistTracks(bridge,query){
  const artistsData=await bridge.api('/search?'+new URLSearchParams({q:query,type:'artist',limit:'10',offset:'0'}));
  const candidates=artistsData.artists?.items||[];
  const wanted=normalizeArabic(query);
  const exact=candidates.find(artist=>normalizeArabic(artist.name)===wanted);
  const close=exact||candidates.find(artist=>{
    const name=normalizeArabic(artist.name);
    return name.includes(wanted)||wanted.includes(name);
  });
  if(!close)return null;

  const trackData=await bridge.api('/search?'+new URLSearchParams({q:`artist:"${close.name}"`,type:'track',limit:'50',offset:'0'}));
  const strict=(trackData.tracks?.items||[]).filter(track=>artistMatches(track,close.name));
  return {artist:close,tracks:strict};
}

function renderTrack(track,index,queue,bridge){
  const fragment=$('#trackTemplate').content.cloneNode(true);
  const card=fragment.querySelector('.track');
  card.dataset.trackId=track.id||'';
  fragment.querySelector('.cover').src=track.album?.images?.[0]?.url||'';
  fragment.querySelector('.name').textContent=track.name||'';
  fragment.querySelector('.artist').textContent=track.artists?.map(a=>a.name).join('، ')||'';
  fragment.querySelector('.album').textContent=track.album?.name||'';
  fragment.querySelector('.open').href=track.external_urls?.spotify||'';
  fragment.querySelector('.play').addEventListener('click',async event=>{
    event.preventDefault();
    try{
      await bridge.activateFromGesture?.();
      await bridge.playQueue(queue,{startIndex:index,source:'precise-search',userGesture:true});
    }catch(error){
      bridge.setStatus(error.message||'تعذر تشغيل الأغنية.');
    }
  });
  queueMicrotask(()=>window.dispatchEvent(new CustomEvent('asiri:track-rendered',{detail:{card,track}})));
  return fragment;
}

async function init(){
  const bridge=await waitForBridge();
  const form=$('#searchForm');
  form.addEventListener('submit',async event=>{
    const query=$('#searchInput').value.trim();
    if(!looksLikeArtistOnly(query))return;

    event.preventDefault();
    event.stopImmediatePropagation();
    $('#results').innerHTML='';
    $('#resultCount').textContent='';
    bridge.setStatus(`جارٍ التحقق من الفنان «${query}»…`);

    try{
      const result=await exactArtistTracks(bridge,query);
      if(!result?.tracks?.length){
        bridge.setStatus('لم أجد فنانًا مطابقًا بدقة. جرّب كتابة اسم الفنان كاملًا.');
        return;
      }
      const queue=result.tracks;
      bridge.replaceQueue(queue,{startIndex:0,source:'precise-artist-search'});
      queue.forEach((track,index)=>$('#results').appendChild(renderTrack(track,index,queue,bridge)));
      $('#resultCount').textContent=`${queue.length} نتيجة دقيقة`;
      bridge.setStatus(`تم عرض أغاني ${result.artist.name} فقط ✓`);
    }catch(error){
      console.error('[Precise Search]',error);
      bridge.setStatus(error.message==='AUTH_REQUIRED'?'سجّل الدخول أولًا.':error.message||'تعذر تنفيذ البحث الدقيق.');
    }
  },true);
}

init().catch(error=>console.error('[Precise Search isolated]',error));