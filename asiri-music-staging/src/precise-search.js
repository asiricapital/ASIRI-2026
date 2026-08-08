import {artistMatchInQuery,buildSearchVariants,cleanKeyword,isSearchCandidate,mergeUniqueTracks,normalizeArabic} from './search-core.js';

const $=selector=>document.querySelector(selector);
const MUSIC_SEARCH_TYPES='track,artist,album,playlist';
const MAX_TRACK_RESULTS=30;

function waitForBridge(){
  return new Promise(resolve=>{
    if(window.AsiriMusicBridge)return resolve(window.AsiriMusicBridge);
    const ready=()=>{window.removeEventListener('asiri:bridge-ready',ready);resolve(window.AsiriMusicBridge)};
    window.addEventListener('asiri:bridge-ready',ready);
  });
}

function searchStatus(text){
  const node=$('#searchStatusText');
  if(node)node.textContent=text;
}

function artistMatches(track,artistName){
  const wanted=normalizeArabic(artistName);
  return(track.artists||[]).some(artist=>normalizeArabic(artist.name||'')===wanted);
}

function trackText(track){return normalizeArabic(`${track.name||''} ${track.album?.name||''}`)}
function keywordScore(track,keyword){
  if(!keyword)return 0;
  const text=trackText(track),words=cleanKeyword(keyword).split(' ').filter(Boolean);
  let score=0;
  for(const word of words){
    if(text.includes(word))score+=20;
    if(word==='موال'&&/(موال|موالات|جلسه|جلسات|عود)/.test(text))score+=15;
    if(word==='شيله'&&/(شيله|شيلات)/.test(text))score+=15;
  }
  return score;
}

async function searchArtists(bridge,candidate){
  const data=await bridge.api('/search?'+new URLSearchParams({q:candidate,type:'artist',limit:'10',offset:'0'}));
  const wanted=normalizeArabic(candidate);
  return(data.artists?.items||[]).find(artist=>normalizeArabic(artist.name||'')===wanted)||null;
}

async function findArtistAnywhere(bridge,query){
  const words=query.trim().split(/\s+/).filter(Boolean),spans=[];
  for(let size=Math.min(4,words.length);size>=1;size--){
    for(let start=0;start<=words.length-size;start++)spans.push({start,size,text:words.slice(start,start+size).join(' ')});
  }
  for(const span of spans){
    const artist=await searchArtists(bridge,span.text);
    if(!artist)continue;
    const remainder=[...words.slice(0,span.start),...words.slice(span.start+span.size)].join(' ');
    return{artist,keyword:cleanKeyword(remainder)};
  }
  return null;
}

async function catalogSearch(bridge,q){
  return bridge.api('/search?'+new URLSearchParams({q,type:MUSIC_SEARCH_TYPES,limit:'10',offset:'0'}));
}

async function trackPage(bridge,q,offset=0){
  const data=await bridge.api('/search?'+new URLSearchParams({q,type:'track',limit:'10',offset:String(offset)}));
  return data.tracks?.items||[];
}

async function broadTrackSearch(bridge,query,initial=[]){
  const variants=buildSearchVariants(query),requests=[];
  if(variants[0]){
    requests.push(trackPage(bridge,variants[0],10));
    requests.push(trackPage(bridge,variants[0],20));
  }
  for(const variant of variants.slice(1))requests.push(trackPage(bridge,variant,0));
  const batches=await Promise.all(requests);
  return mergeUniqueTracks(initial,...batches).slice(0,MAX_TRACK_RESULTS);
}

async function pagedTrackSearch(bridge,q,pages=2){
  const all=[];
  for(let page=0;page<pages;page++){
    const items=await trackPage(bridge,q,page*10);
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
    if(keyword.includes('شيله'))queries.push(`${artist.name} شيلات`);
  }
  queries.push(`artist:"${artist.name}"`);
  queries.push(originalQuery);
  const collected=[];
  for(const q of [...new Set(queries)].slice(0,4))collected.push(...await pagedTrackSearch(bridge,q,2));
  const strict=mergeUniqueTracks(collected.filter(track=>artistMatches(track,artist.name)));
  strict.sort((a,b)=>keywordScore(b,keyword)-keywordScore(a,keyword)||(b.popularity||0)-(a.popularity||0));
  return strict.slice(0,MAX_TRACK_RESULTS);
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
    try{
      await bridge.playQueue(queue,{startIndex:index,source:'universal-search',userGesture:true});
      searchStatus(`يعمل الآن «${track.name}» داخل Asiri Music.`);
    }catch(error){searchStatus(error.message||'تعذر تشغيل الأغنية.')}
  });
  queueMicrotask(()=>window.dispatchEvent(new CustomEvent('asiri:track-rendered',{detail:{card,track}})));
  return fragment;
}

const ENTITY_META={
  artist:{title:'الفنانون',label:'ARTIST',icon:'🎤'},
  album:{title:'الألبومات',label:'ALBUM',icon:'💿'},
  playlist:{title:'قوائم التشغيل',label:'PLAYLIST',icon:'♫'}
};

function entitySubtitle(item,type){
  if(type==='artist')return'فنان على Spotify';
  if(type==='album')return(item.artists||[]).map(artist=>artist.name).filter(Boolean).join('، ')||'ألبوم';
  if(type==='playlist')return item.owner?.display_name?`بواسطة ${item.owner.display_name}`:'قائمة Spotify';
  return'';
}

function renderEntity(item,type){
  const meta=ENTITY_META[type],link=document.createElement('a');
  link.className='search-entity';
  link.href=item.external_urls?.spotify||'#';
  link.target='_blank';link.rel='noopener';
  const art=document.createElement('span');art.className='search-entity-art';
  const image=item.images?.[0]?.url;
  if(image){const img=document.createElement('img');img.src=image;img.alt='';art.appendChild(img)}else art.textContent=meta.icon;
  const text=document.createElement('span'),kind=document.createElement('em'),name=document.createElement('strong'),sub=document.createElement('small');
  kind.textContent=meta.label;name.textContent=item.name||meta.title;sub.textContent=entitySubtitle(item,type);
  text.append(kind,name,sub);link.append(art,text);
  return link;
}

function createGroup(title,detail){
  const section=document.createElement('section');section.className='search-group';
  const head=document.createElement('div');head.className='search-group-head';
  const heading=document.createElement('h3');heading.textContent=title;
  const meta=document.createElement('span');meta.textContent=detail;
  head.append(heading,meta);section.appendChild(head);
  return section;
}

function appendTrackGroup(root,tracks,bridge){
  if(!tracks.length)return;
  const section=createGroup('الأغاني',`${tracks.length} نتيجة • التشغيل داخل Asiri`),grid=document.createElement('div');
  grid.className='search-track-grid';
  tracks.forEach((track,index)=>grid.appendChild(renderTrack(track,index,tracks,bridge)));
  section.appendChild(grid);root.appendChild(section);
}

function appendEntityGroup(root,items,type){
  const visible=(items||[]).filter(Boolean).slice(0,6);
  if(!visible.length)return;
  const section=createGroup(ENTITY_META[type].title,`${visible.length} نتائج`),grid=document.createElement('div');
  grid.className='search-entity-grid';
  visible.forEach(item=>grid.appendChild(renderEntity(item,type)));
  section.appendChild(grid);root.appendChild(section);
}

function renderResults(catalog,tracks,bridge){
  const root=$('#results');root.innerHTML='';
  const artists=(catalog.artists?.items||[]).filter(Boolean),albums=(catalog.albums?.items||[]).filter(Boolean),playlists=(catalog.playlists?.items||[]).filter(Boolean);
  appendTrackGroup(root,tracks,bridge);
  appendEntityGroup(root,artists,'artist');
  appendEntityGroup(root,albums,'album');
  appendEntityGroup(root,playlists,'playlist');
  const visibleEntities=Math.min(6,artists.length)+Math.min(6,albums.length)+Math.min(6,playlists.length),total=tracks.length+visibleEntities;
  $('#resultCount').textContent=total?`${total} نتيجة معروضة`:'';
  if(!total){const empty=document.createElement('div');empty.className='search-empty';empty.textContent='لا توجد نتائج مطابقة. جرّب اسمًا أو كلمة أخرى.';root.appendChild(empty)}
  return{artists:Math.min(6,artists.length),albums:Math.min(6,albums.length),playlists:Math.min(6,playlists.length),total};
}

function summary(tracks,counts,parsed){
  if(!counts.total)return'لم أجد نتائج لهذه العبارة في كتالوج Spotify الحالي.';
  const parts=[];
  if(tracks.length)parts.push(`${tracks.length} أغنية`);
  if(counts.artists)parts.push(`${counts.artists} فنان`);
  if(counts.albums)parts.push(`${counts.albums} ألبوم`);
  if(counts.playlists)parts.push(`${counts.playlists} قائمة`);
  const understood=parsed?.artist?` • تعرّفت أيضًا على الفنان ${parsed.artist.name}${parsed.keyword?` + «${parsed.keyword}»`:''}`:'';
  return`وجدت ${parts.join(' + ')}${understood}.`;
}

async function init(){
  const bridge=await waitForBridge(),form=$('#searchForm');
  if(!form)return;
  form.addEventListener('submit',async event=>{
    event.preventDefault();event.stopImmediatePropagation();
    const query=$('#searchInput').value.trim();
    if(!isSearchCandidate(query)){searchStatus('اكتب كلمة أو اسمًا للبحث.');return}
    $('#results').innerHTML='';$('#resultCount').textContent='';searchStatus(`أبحث في Spotify بالكامل عن «${query}»…`);
    try{
      const catalog=await catalogSearch(bridge,query),catalogArtists=(catalog.artists?.items||[]).filter(Boolean);
      const broadPromise=broadTrackSearch(bridge,query,catalog.tracks?.items||[]);
      let artist=artistMatchInQuery(query,catalogArtists),parsed=null;
      if(artist){
        const normalizedQuery=normalizeArabic(query),normalizedArtist=normalizeArabic(artist.name);
        const keyword=cleanKeyword(normalizedQuery.replace(normalizedArtist,' '));
        parsed={artist,keyword};
      }else parsed=await findArtistAnywhere(bridge,query);
      const broad=await broadPromise,precise=parsed?await fetchArtistTracks(bridge,parsed.artist,parsed.keyword,query):[];
      const tracks=mergeUniqueTracks(precise,broad).slice(0,MAX_TRACK_RESULTS),counts=renderResults(catalog,tracks,bridge);
      searchStatus(summary(tracks,counts,parsed));
    }catch(error){
      console.error('[Universal Search]',error);
      searchStatus(error.message==='AUTH_REQUIRED'?'سجّل الدخول إلى Spotify أولًا.':error.message||'تعذر تنفيذ البحث الآن.');
    }
  },true);
}

init().catch(error=>console.error('[Universal Search isolated]',error));
