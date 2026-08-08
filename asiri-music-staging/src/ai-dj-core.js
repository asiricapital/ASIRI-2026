const ARABIC_DIGITS={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};

const SIGNALS=[
  {key:'travel',kind:'context',pattern:/سفر|رحلة|طريق|سيارة|قيادة/i,label:'سفر',query:'أغاني سفر خليجية'},
  {key:'coffee',kind:'context',pattern:/قهوة|صباح|فطور/i,label:'قهوة',query:'طرب قهوة خليجي'},
  {key:'night',kind:'context',pattern:/ليلية|ليلي|ليل|مساء|سهر/i,label:'ليلي',query:'طرب خليجي ليلي'},
  {key:'workout',kind:'context',pattern:/نادي|رياضة|تمرين|جيم/i,label:'رياضة',query:'أغاني عربية حماسية'},
  {key:'calm',kind:'mood',pattern:/هادئة|هادئ|هدوء|رايقة|رايق|استرخاء/i,label:'هادئ',query:'طرب خليجي هادئ'},
  {key:'energy',kind:'mood',pattern:/حماسية|حماسي|حماس|نشاط|حفلة/i,label:'حماسي',query:'أغاني خليجية حماسية'},
  {key:'classic',kind:'mood',pattern:/كلاسيكيات|كلاسيك|قديم|قديمة|زمن جميل|طرب/i,label:'طرب',query:'طرب سعودي كلاسيكي'}
];

const STRIP_WORDS=/جلسة|شغل(?:ي)?|ابغى|أبغى|ابي|أبي|أريد|اريد|أعمل|اعمل|سو(?:ي)?|موسيقى|أغاني|اغاني|أغنية|اغنية|لمدة|مدة|حوالي|تقريباً|تقريبا|سفر|رحلة|طريق|سيارة|قيادة|قهوة|صباح|فطور|ليلية|ليلي|ليل|مساء|سهر|نادي|رياضة|تمرين|جيم|هادئة|هادئ|هدوء|رايقة|رايق|استرخاء|حماسية|حماسي|حماس|نشاط|حفلة|كلاسيكيات|كلاسيك|قديم|قديمة|زمن جميل|طرب|خليجية|خليجي|عربية|عربي/g;

function clamp(value,min,max){return Math.min(max,Math.max(min,value))}
function unique(values){const seen=new Set();return values.filter(value=>{const key=String(value).trim().toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true})}
function latinDigits(value){return String(value||'').replace(/[٠-٩۰-۹]/g,digit=>ARABIC_DIGITS[digit]||digit).replace(/٫/g,'.')}

export function normalizeSessionPrompt(value){
  return String(value||'').trim().replace(/[ـ]/g,'').replace(/\s+/g,' ');
}

export function parseDurationMinutes(prompt,fallback=60){
  const text=latinDigits(normalizeSessionPrompt(prompt));
  let match=text.match(/(\d+(?:\.\d+)?)\s*(?:دقيقة|دقائق)/i);
  if(match)return clamp(Math.round(Number(match[1])*1),15,120);
  if(/ساعة\s*(?:و\s*)?نصف/i.test(text))return 90;
  if(/نصف\s+ساعة/i.test(text))return 30;
  if(/ربع\s+ساعة/i.test(text))return 15;
  match=text.match(/(\d+(?:\.\d+)?)\s*(?:ساعة|ساعات)/i);
  if(match)return clamp(Math.round(Number(match[1])*60),15,120);
  if(/ساعتين|ساعتان/i.test(text))return 120;
  if(/ثلاث\s*ساعات|ثلاثة\s*ساعات/i.test(text))return 120;
  if(/ساعة/i.test(text))return 60;
  return clamp(Number(fallback)||60,15,120);
}

function stripDuration(value){
  return latinDigits(value)
    .replace(/\d+(?:\.\d+)?\s*(?:دقيقة|دقائق|ساعة|ساعات)/gi,' ')
    .replace(/ساعة\s*(?:و\s*)?نصف|نصف\s+ساعة|ربع\s+ساعة|ساعتين|ساعتان|ثلاثة?\s*ساعات/gi,' ');
}

function cleanArtistCandidate(value){
  const cleaned=stripDuration(value)
    .replace(STRIP_WORDS,' ')
    .replace(/(^|\s)(?:مع|من|في|على|إلى|الى|لي)(?=\s|$)/gi,'$1')
    .replace(/[«»"'()\[\]{}:؛;!?؟.]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  return cleaned;
}

export function extractArtistHints(prompt){
  const normalized=normalizeSessionPrompt(prompt);
  const segments=normalized.split(/[،,؛;]/).map(part=>part.trim()).filter(Boolean);
  const source=segments.length>1?segments:[normalized];
  const candidates=[];
  for(const segment of source){
    const cleaned=cleanArtistCandidate(segment);
    if(!cleaned)continue;
    for(const part of cleaned.split(/\s+و\s+|\s+و(?=[\p{L}])|[\/&+]/u).map(item=>item.trim())){
      if(!part||part.length<2)continue;
      const words=part.split(/\s+/).filter(Boolean);
      if(words.length>4)continue;
      if(!/[\p{L}]/u.test(part))continue;
      candidates.push(part);
    }
  }
  return unique(candidates).slice(0,4);
}

function signalLabels(signals){return signals.map(key=>SIGNALS.find(signal=>signal.key===key)?.label).filter(Boolean)}

export function parseSessionIntent(prompt,{seedTrack=null,defaultMinutes=60}={}){
  const normalizedPrompt=normalizeSessionPrompt(prompt);
  const contexts=SIGNALS.filter(signal=>signal.kind==='context'&&signal.pattern.test(normalizedPrompt)).map(signal=>signal.key);
  const moods=SIGNALS.filter(signal=>signal.kind==='mood'&&signal.pattern.test(normalizedPrompt)).map(signal=>signal.key);
  const artists=extractArtistHints(normalizedPrompt);
  const seedArtists=(seedTrack?.artists||[]).map(artist=>artist?.name).filter(Boolean);
  const artistHints=unique([...seedArtists,...artists]).slice(0,4);
  const searchText=stripDuration(normalizedPrompt)
    .replace(/(^|\s)(?:جلسة|شغل(?:ي)?|ابغى|أبغى|ابي|أبي|أريد|اريد|لمدة|مدة|حوالي|تقريباً|تقريبا)(?=\s|$)/gi,'$1')
    .replace(/\s+/g,' ')
    .trim();
  return{
    prompt:normalizedPrompt,
    searchText:searchText||normalizedPrompt,
    targetMinutes:parseDurationMinutes(normalizedPrompt,defaultMinutes),
    contexts,
    moods,
    contextLabels:signalLabels(contexts),
    moodLabels:signalLabels(moods),
    artistHints
  };
}

function tasteArtistNames(taste,excluded=[]){
  const blocked=new Set(excluded.map(name=>String(name).toLowerCase()));
  return Object.entries(taste?.artists||{})
    .filter(([name,data])=>name&&!blocked.has(name.toLowerCase())&&(Number(data?.score)||0)>0)
    .sort((a,b)=>(Number(b[1]?.score)||0)-(Number(a[1]?.score)||0))
    .map(([name])=>name);
}

export function buildSessionQueries(intent,{seedTrack=null,taste=null,maxQueries=6}={}){
  const queries=[];
  const add=query=>{const value=normalizeSessionPrompt(query);if(value&&!queries.some(item=>item.toLowerCase()===value.toLowerCase()))queries.push(value)};
  const style=[...(intent?.moodLabels||[]),...(intent?.contextLabels||[])][0]||'';
  for(const artist of intent?.artistHints||[])add('artist:'+artist);
  for(const artist of (intent?.artistHints||[]).slice(0,2)){
    if(style)add('artist:'+artist+' '+style);
  }
  if(intent?.searchText)add(intent.searchText);
  const signalKeys=[...(intent?.moods||[]),...(intent?.contexts||[])];
  for(const key of signalKeys){
    const signal=SIGNALS.find(item=>item.key===key);
    if(signal)add(signal.query);
  }
  if(seedTrack){
    const seedArtists=(seedTrack.artists||[]).map(artist=>artist?.name).filter(Boolean);
    for(const artist of tasteArtistNames(taste,[...seedArtists,...(intent?.artistHints||[])]).slice(0,3))add('artist:'+artist);
  }
  if(!queries.length)add('أغاني خليجية عربية');
  return queries.slice(0,clamp(Number(maxQueries)||6,1,8));
}

function artistNames(track){return (track?.artists||[]).map(artist=>artist?.name).filter(Boolean)}
function primaryArtist(track){return artistNames(track)[0]||'unknown'}

export function scoreSessionTrack(track,{intent=null,taste=null,seedTrack=null}={}){
  if(!track?.id)return Number.NEGATIVE_INFINITY;
  if(track.is_playable===false)return Number.NEGATIVE_INFINITY;
  if(taste?.tracks?.[track.id]?.value==='dislike')return Number.NEGATIVE_INFINITY;
  if(seedTrack?.id&&seedTrack.id===track.id)return Number.NEGATIVE_INFINITY;
  let score=Number(track.popularity)||0;
  const artists=artistNames(track);
  const haystack=(String(track.name||'')+' '+artists.join(' ')).toLowerCase();
  for(const artist of artists){
    score+=(Number(taste?.artistScores?.[artist])||Number(taste?.artists?.[artist]?.score)||0)*8;
  }
  for(const hint of intent?.artistHints||[]){
    const target=String(hint).toLowerCase();
    if(artists.some(name=>name.toLowerCase()===target))score+=70;
    else if(artists.some(name=>name.toLowerCase().includes(target)||target.includes(name.toLowerCase())))score+=30;
  }
  for(const word of String(intent?.searchText||'').toLowerCase().split(/\s+/)){
    if(word.length>2&&haystack.includes(word))score+=9;
  }
  const seedArtists=new Set(artistNames(seedTrack).map(name=>name.toLowerCase()));
  if(artists.some(name=>seedArtists.has(name.toLowerCase())))score+=35;
  return score;
}

export function rankSessionTracks(tracks,options={}){
  const uniqueTracks=[...new Map((tracks||[]).filter(track=>track?.id).map(track=>[track.id,track])).values()];
  return uniqueTracks
    .map(track=>({track,score:scoreSessionTrack(track,options)}))
    .filter(item=>Number.isFinite(item.score))
    .sort((a,b)=>b.score-a.score)
    .map(item=>item.track);
}

export function sessionDurationMinutes(tracks){
  const milliseconds=(tracks||[]).reduce((sum,track)=>sum+(Number(track?.duration_ms)||210000),0);
  return Math.max(0,Math.round(milliseconds/60000));
}

export function selectSessionTracks(ranked,{targetMinutes=60,maxTracks=30,maxPerArtist=6}={}){
  const targetMs=clamp(Number(targetMinutes)||60,15,120)*60000;
  const limit=clamp(Number(maxTracks)||30,1,50);
  const artistLimit=clamp(Number(maxPerArtist)||6,2,30);
  const counts=new Map();
  const preferred=[];
  const overflow=[];
  for(const track of ranked||[]){
    if(!track?.id)continue;
    const artist=primaryArtist(track).toLowerCase();
    const count=counts.get(artist)||0;
    if(count>=artistLimit){overflow.push(track);continue}
    counts.set(artist,count+1);
    preferred.push(track);
  }
  const selected=[];
  let total=0;
  for(const track of [...preferred,...overflow]){
    if(selected.length>=limit)break;
    selected.push(track);
    total+=Number(track.duration_ms)||210000;
    if(selected.length>=4&&total>=targetMs)break;
  }
  return selected;
}

export function describeSessionIntent(intent){
  const parts=[];
  if(intent?.artistHints?.length)parts.push('🎤 '+intent.artistHints.join('، '));
  if(intent?.contextLabels?.length)parts.push('📍 '+intent.contextLabels.join(' + '));
  if(intent?.moodLabels?.length)parts.push('🎚 '+intent.moodLabels.join(' + '));
  parts.push('⏱ '+(Number(intent?.targetMinutes)||60)+' دقيقة');
  return 'فهمت طلبك: '+parts.join(' • ');
}
