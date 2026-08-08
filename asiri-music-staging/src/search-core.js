const SEARCH_FILLER=new Set([
  'اجمل','افضل','اشهر','اغاني','اغنيه','اغنيات','اعمال','الفنان','للفنان','من','لي',
  'ابغي','اريد','شغل','شغللي','تشغيل','كل','اعطني','ابي','موسيقي'
]);

export function normalizeArabic(value=''){
  return String(value).toLowerCase().normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا')
    .replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}

export function isSearchCandidate(value=''){
  const query=String(value).trim();
  return query.length>=1&&query.length<=160&&/[\p{L}\p{N}]/u.test(query);
}

export function cleanKeyword(value=''){
  const words=normalizeArabic(value).split(' ').filter(Boolean).filter(word=>!SEARCH_FILLER.has(word));
  return words.map(word=>word==='موالات'?'موال':word==='شيلات'?'شيله':word).join(' ').trim();
}

export function buildSearchVariants(value=''){
  const raw=String(value).trim().replace(/\s+/g,' ');
  if(!raw)return[];
  const words=raw.split(' ').filter(Boolean);
  const useful=words.filter(word=>!SEARCH_FILLER.has(normalizeArabic(word)));
  const cleaned=useful.join(' ').trim();
  const singular=useful.map(word=>{
    const normalized=normalizeArabic(word);
    if(normalized==='موالات')return'موال';
    if(normalized==='شيلات')return'شيلة';
    return word;
  }).join(' ').trim();
  return[...new Set([raw,cleaned,singular].filter(Boolean))].slice(0,3);
}

export function artistMatchInQuery(query,artists=[]){
  const normalizedQuery=normalizeArabic(query);
  if(!normalizedQuery)return null;
  const padded=` ${normalizedQuery} `;
  return (artists||[])
    .filter(artist=>artist?.name)
    .map(artist=>({artist,name:normalizeArabic(artist.name)}))
    .filter(item=>item.name&&(item.name===normalizedQuery||padded.includes(` ${item.name} `)))
    .sort((a,b)=>b.name.length-a.name.length)[0]?.artist||null;
}

export function mergeUniqueTracks(...collections){
  const unique=new Map();
  for(const collection of collections){
    for(const track of collection||[]){
      if(!track?.id||!track?.uri||track?.is_playable===false)continue;
      if(!unique.has(track.id))unique.set(track.id,track);
    }
  }
  return[...unique.values()];
}
