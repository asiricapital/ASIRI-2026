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

const FILLER_WORDS=new Set(['اجمل','افضل','اشهر','اغاني','اغنيه','اغنيات','اعمال','الفنان','للفنان','من','لي','ابغى','اريد','شغل','شغللي','تشغيل','كل']);
function cleanKeyword(value=''){
  const words=normalizeArabic(value).split(' ').filter(Boolean).filter(word=>!FILLER_WORDS.has(word));
  return words.map(word=>word==='موالات'?'موال':word).join(' ').trim();
}
function isSearchCandidate(query){const q=query.trim();return q.length>=2&&q.length<=100&&!/[-–—:،,\/\\]/.test(q)}
function artistMatches(track,artistName){const wanted=normalizeArabic(artistName);return(track.artists||[]).some(artist=>normalizeArabic(artist.name||'')===wanted)}
function trackText(track){return normalizeArabic(`${track.name||''} ${track.album?.name||''}`)}
function keywordScore(track,keyword){if(!keyword)return 0;const text=trackText(track),words=cleanKeyword(keyword).split(' ').filter(Boolean);let score=0;for(const word of words){if(text.includes(word))score+=20;if(word==='موال'&&/(موال|موالات|جلسه|جلسات|عود)/.test(text))score+=15}return score}

async function searchArtists(bridge,candidate){
  const data=await bridge.api('/search?'+new URLSearchParams({q:candidate,type:'artist',limit:'10',offset:'0'}));
  const wanted=normalizeArabic(candidate);
  return(data.artists?.items||[]).find(artist=>normalizeArabic(artist.name||'')===wanted)||null;
}

async function findArtistAnywhere(bridge,query){
  const words=query.trim().split(/\s+/).filter(Boolean);
  const spans=[];
  for(let size=Math.min(4,words.length);size>=1;size--){
    for(let start=0;start<=words.length-size;start++)spans.push({start,size,text:words.slice(start,start+size).join(' ')});
  }
  for(const span of spans){
    const artist=await searchArtists(bridge,span.text);
    if(artist){
      const remainder=[...words.slice(0,span.start),...words.slice(span.start+span.size)].join(' ');
      return{artist,keyword:cleanKeyword(remainder)};
    }
  }
  return null;
}

async function pagedTrackSearch(bridge,q,pages=3){
  const all=[];
  for(let page=0;page<pages;page++){
    const items=(await bridge.api('/search?'+new URLSearchParams({q,type:'track',limit:'10',offset:String(page*10)}))).tracks?.items||[];
    all.push(...items);
    if(items.length<10)break;
  }
  return all;
}

async function fetchArtistTracks(bridge,artist,keyword,originalQuery){
  const queries=[];
  if(keyword){
    queries.push(`${artist.name} ${keyword}`);
    queries.push(`artist:"${artist.name}" ${keyword}`);
    if(keyword.includes('موال'))queries.push(`${artist.name} موالات جلسات عود`);
  }
  queries.push(`artist:"${artist.name}"`);
  queries.push(originalQuery);
  const collected=[];
  for(const q of [...new Set(queries)])collected.push(...await pagedTrackSearch(bridge,q,2));
  const strict=[...new Map(collected.filter(track=>track?.id&&artistMatches(track,artist.name)).map(track=>[track.id,track])).values()];
  strict.sort((a,b)=>keywordScore(b,keyword)-keywordScore(a,keyword)||(b.popularity||0)-(a.popularity||0));
  return strict.slice(0,30);
}

function renderTrack(track,index,queue,bridge){
  const fragment=$('#trackTemplate').content.cloneNode(true),card=fragment.querySelector('.track');
  card.dataset.trackId=track.id||'';
  fragment.querySelector('.cover').src=track.album?.images?.[0]?.url||'';
  fragment.querySelector('.name').textContent=track.name||'';
  fragment.querySelector('.artist').textContent=track.artists?.map(a=>a.name).join('، ')||'';
  fragment.querySelector('.album').textContent=track.album?.name||'';
  fragment.querySelector('.open').href=track.external_urls?.spotify||'';
  fragment.querySelector('.play').addEventListener('click',async event=>{
    event.preventDefault();
    try{await bridge.activateFromGesture?.();await bridge.playQueue(queue,{startIndex:index,source:'precise-search',userGesture:true})}
    catch(error){bridge.setStatus(error.message||'تعذر تشغيل الأغنية.')}
  });
  queueMicrotask(()=>window.dispatchEvent(new CustomEvent('asiri:track-rendered',{detail:{card,track}})));
  return fragment;
}

async function init(){
  const bridge=await waitForBridge();
  $('#searchForm').addEventListener('submit',async event=>{
    const query=$('#searchInput').value.trim();if(!isSearchCandidate(query))return;
    event.preventDefault();event.stopImmediatePropagation();$('#results').innerHTML='';$('#resultCount').textContent='';
    bridge.setStatus(`جارٍ فهم طلبك «${query}»…`);
    try{
      const parsed=await findArtistAnywhere(bridge,query);
      if(!parsed){bridge.setStatus('لم أتعرف على اسم الفنان داخل العبارة. اكتب اسم الفنان بوضوح.');return}
      const queue=await fetchArtistTracks(bridge,parsed.artist,parsed.keyword,query);
      if(!queue.length){bridge.setStatus(`لم يعثر Spotify على أعمال متاحة للفنان ${parsed.artist.name} في حسابك الحالي.`);return}
      bridge.replaceQueue(queue,{startIndex:0,source:'precise-artist-search'});
      queue.forEach((track,index)=>$('#results').appendChild(renderTrack(track,index,queue,bridge)));
      $('#resultCount').textContent=`${queue.length} نتيجة`;
      const matched=parsed.keyword?queue.filter(track=>keywordScore(track,parsed.keyword)>0).length:queue.length;
      bridge.setStatus(parsed.keyword&&matched===0
        ?`تعرفت على الفنان ${parsed.artist.name}، لكن Spotify لا يضع وصف «${parsed.keyword}» في بيانات الأغاني؛ عرضت أقرب أعماله المتاحة.`
        :parsed.keyword?`تم فهم الطلب: ${parsed.artist.name} + «${parsed.keyword}» ✓`:`تم عرض أغاني ${parsed.artist.name} فقط ✓`);
    }catch(error){console.error('[Precise Search]',error);bridge.setStatus(error.message==='AUTH_REQUIRED'?'سجّل الدخول أولًا.':error.message||'تعذر تنفيذ البحث.')}
  },true);
}
init().catch(error=>console.error('[Precise Search isolated]',error));