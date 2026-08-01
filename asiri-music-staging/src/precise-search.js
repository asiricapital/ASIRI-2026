const $=selector=>document.querySelector(selector);

function waitForBridge(){
  return new Promise(resolve=>{
    if(window.AsiriMusicBridge)return resolve(window.AsiriMusicBridge);
    const ready=()=>{window.removeEventListener('asiri:bridge-ready',ready);resolve(window.AsiriMusicBridge)};
    window.addEventListener('asiri:bridge-ready',ready);
  });
}

function normalizeArabic(value=''){
  return value.toLowerCase().normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا')
    .replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}

function isSearchCandidate(query){
  const q=query.trim();
  return q.length>=2 && q.length<=80 && !/[-–—:،,\/\\]/.test(q);
}

function artistMatches(track,artistName){
  const wanted=normalizeArabic(artistName);
  return (track.artists||[]).some(artist=>normalizeArabic(artist.name||'')===wanted);
}

function textMatches(track,keyword){
  if(!keyword)return true;
  const wanted=normalizeArabic(keyword);
  const text=normalizeArabic(`${track.name||''} ${track.album?.name||''}`);
  return wanted.split(' ').every(word=>word.length<2||text.includes(word));
}

async function findArtistAndKeyword(bridge,query){
  const words=query.trim().split(/\s+/).filter(Boolean);
  for(let size=Math.min(words.length,4);size>=1;size--){
    const candidate=words.slice(0,size).join(' ');
    const data=await bridge.api('/search?'+new URLSearchParams({q:candidate,type:'artist',limit:'10',offset:'0'}));
    const artists=data.artists?.items||[];
    const wanted=normalizeArabic(candidate);
    const exact=artists.find(artist=>normalizeArabic(artist.name||'')===wanted);
    if(exact)return {artist:exact,keyword:words.slice(size).join(' ')};
  }
  return null;
}

async function fetchArtistTracks(bridge,artist,keyword){
  const collected=[];
  const searchText=keyword?`artist:"${artist.name}" ${keyword}`:`artist:"${artist.name}"`;
  for(const offset of [0,10,20]){
    const data=await bridge.api('/search?'+new URLSearchParams({q:searchText,type:'track',limit:'10',offset:String(offset)}));
    const items=data.tracks?.items||[];
    collected.push(...items);
    if(items.length<10)break;
  }
  let strict=[...new Map(collected.filter(track=>track?.id&&artistMatches(track,artist.name)).map(track=>[track.id,track])).values()];
  if(keyword){
    const keywordMatches=strict.filter(track=>textMatches(track,keyword));
    if(keywordMatches.length)strict=keywordMatches;
  }
  return strict;
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
    }catch(error){bridge.setStatus(error.message||'تعذر تشغيل الأغنية.');}
  });
  queueMicrotask(()=>window.dispatchEvent(new CustomEvent('asiri:track-rendered',{detail:{card,track}})));
  return fragment;
}

async function init(){
  const bridge=await waitForBridge();
  $('#searchForm').addEventListener('submit',async event=>{
    const query=$('#searchInput').value.trim();
    if(!isSearchCandidate(query))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    $('#results').innerHTML='';
    $('#resultCount').textContent='';
    bridge.setStatus(`جارٍ تحليل البحث «${query}»…`);
    try{
      const parsed=await findArtistAndKeyword(bridge,query);
      if(!parsed){bridge.setStatus('لم أجد فنانًا مطابقًا. جرّب كتابة اسم الفنان ثم اسم الأغنية.');return;}
      const queue=await fetchArtistTracks(bridge,parsed.artist,parsed.keyword);
      if(!queue.length){
        bridge.setStatus(parsed.keyword?`لم أجد «${parsed.keyword}» ضمن أغاني ${parsed.artist.name}.`:`لم أجد أغاني للفنان ${parsed.artist.name}.`);
        return;
      }
      bridge.replaceQueue(queue,{startIndex:0,source:'precise-artist-search'});
      queue.forEach((track,index)=>$('#results').appendChild(renderTrack(track,index,queue,bridge)));
      $('#resultCount').textContent=`${queue.length} نتيجة دقيقة`;
      bridge.setStatus(parsed.keyword?`نتائج ${parsed.artist.name} المطابقة لـ «${parsed.keyword}» فقط ✓`:`تم عرض أغاني ${parsed.artist.name} فقط ✓`);
    }catch(error){
      console.error('[Precise Search]',error);
      bridge.setStatus(error.message==='AUTH_REQUIRED'?'سجّل الدخول أولًا.':error.message||'تعذر تنفيذ البحث الدقيق.');
    }
  },true);
}

init().catch(error=>console.error('[Precise Search isolated]',error));