export const SMART_MIX_LIMIT=24;

const clean=value=>String(value||'').trim();
const key=value=>clean(value).toLocaleLowerCase('ar');

export function artistNames(track){
  return (track?.artists||[]).map(artist=>clean(artist?.name)).filter(Boolean);
}

function addArtist(map,name,weight){
  const display=clean(name);
  if(!display||!Number.isFinite(weight)||weight<=0)return;
  const id=key(display);
  const current=map.get(id)||{name:display,weight:0};
  current.weight+=weight;
  map.set(id,current);
}

export function smartMixSeeds(taste={},history=[],limit=4){
  const scores=new Map();
  Object.entries(taste?.artists||{}).forEach(([name,profile])=>{
    const affinity=Math.max(0,Number(profile?.score)||0);
    const likes=Math.max(0,Number(profile?.likes)||0);
    addArtist(scores,name,affinity*12+likes*4);
  });
  Object.values(taste?.tracks||{}).forEach(track=>{
    if(track?.value!=='like')return;
    clean(track.artist).split(/[،,]/).map(clean).filter(Boolean).forEach(name=>addArtist(scores,name,8));
  });
  (Array.isArray(history)?history:[]).slice(0,12).forEach((track,index)=>{
    artistNames(track).forEach(name=>addArtist(scores,name,Math.max(2,12-index)));
  });
  return [...scores.values()]
    .sort((a,b)=>b.weight-a.weight||a.name.localeCompare(b.name,'ar'))
    .slice(0,Math.max(1,limit))
    .map(item=>item.name);
}

export function buildSmartMixQueries(taste={},history=[],limit=4){
  const artistQueries=smartMixSeeds(taste,history,3).map(name=>`artist:"${name.replaceAll('"','')}"`);
  const fallbacks=['أغاني سعودية','أغاني خليجية','طرب خليجي'];
  return [...new Set([...artistQueries,...fallbacks])].slice(0,Math.max(1,limit));
}

function recentArtistWeights(history=[]){
  const weights=new Map();
  history.slice(0,12).forEach((track,index)=>{
    artistNames(track).forEach(name=>weights.set(key(name),(weights.get(key(name))||0)+Math.max(1,8-index/2)));
  });
  return weights;
}

function scoreTrack(track,taste,history){
  if(taste?.tracks?.[track.id]?.value==='dislike')return Number.NEGATIVE_INFINITY;
  const recentArtists=recentArtistWeights(history);
  const recentIds=new Set(history.slice(0,8).map(item=>item?.id).filter(Boolean));
  let score=Math.max(0,Number(track?.popularity)||0);
  for(const name of artistNames(track)){
    const profile=taste?.artists?.[name];
    score+=Math.max(0,Number(profile?.score)||0)*14;
    score+=(recentArtists.get(key(name))||0)*5;
  }
  if(taste?.tracks?.[track.id]?.value==='like')score+=45;
  if(recentIds.has(track.id))score-=18;
  return score;
}

export function personalizeTracks(tracks,{taste={},history=[],limit=SMART_MIX_LIMIT,maxPerArtist=4}={}){
  const unique=[...new Map((tracks||[]).filter(track=>track?.id&&track?.uri&&track?.is_playable!==false).map(track=>[track.id,track])).values()];
  const remaining=unique
    .map((track,index)=>({track,index,score:scoreTrack(track,taste,history)}))
    .filter(item=>Number.isFinite(item.score))
    .sort((a,b)=>b.score-a.score||a.index-b.index);
  const selected=[];
  const artistCounts=new Map();
  while(remaining.length&&selected.length<limit){
    const previous=key(artistNames(selected.at(-1))[0]);
    const allowed=item=>(artistCounts.get(key(artistNames(item.track)[0]))||0)<maxPerArtist;
    let index=remaining.findIndex(item=>allowed(item)&&key(artistNames(item.track)[0])!==previous);
    if(index<0)index=remaining.findIndex(allowed);
    if(index<0)break;
    const [{track}]=remaining.splice(index,1);
    const primary=key(artistNames(track)[0]);
    artistCounts.set(primary,(artistCounts.get(primary)||0)+1);
    selected.push(track);
  }
  return selected;
}
