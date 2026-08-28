const VIDEO_ID=/^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(input){
  const raw=String(input||'').trim();
  if(VIDEO_ID.test(raw))return raw;
  let url;
  try{url=new URL(raw)}catch{return ''}
  const host=url.hostname.replace(/^www\./,'').toLowerCase();
  let id='';
  if(host==='youtu.be')id=url.pathname.split('/').filter(Boolean)[0]||'';
  else if(host==='youtube.com'||host==='m.youtube.com'||host==='music.youtube.com'||host==='youtube-nocookie.com'){
    if(url.pathname==='/watch')id=url.searchParams.get('v')||'';
    else{
      const parts=url.pathname.split('/').filter(Boolean);
      if(['shorts','embed','live'].includes(parts[0]))id=parts[1]||'';
    }
  }
  return VIDEO_ID.test(id)?id:'';
}

export function youtubeEmbedUrl(input,{autoplay=true}={}){
  const id=youtubeVideoId(input);
  if(!id)return '';
  const params=new URLSearchParams({playsinline:'1',rel:'0',modestbranding:'1'});
  if(autoplay)params.set('autoplay','1');
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

export function youtubeWatchUrl(input){
  const id=youtubeVideoId(input);
  return id?`https://www.youtube.com/watch?v=${id}`:'';
}

export function youtubeSearchUrl(query){
  const q=String(query||'').trim();
  return q?`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`:'';
}

export function rememberYoutube(items,item,limit=12){
  const clean=Array.isArray(items)?items.filter(Boolean):[];
  const id=youtubeVideoId(item?.id||item?.url||'');
  if(!id)return clean.slice(0,limit);
  const next={id,title:String(item?.title||'فيديو YouTube'),playedAt:Number(item?.playedAt)||Date.now()};
  return [next,...clean.filter(entry=>entry?.id!==id)].slice(0,limit);
}
