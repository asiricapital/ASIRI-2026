export const HISTORY_LIMIT=12;

export function compactTrack(track){
  if(!track?.id)return null;
  const image=track.album?.images?.[0]?.url||track.images?.[0]?.url||'';
  const spotify=track.external_urls?.spotify||`https://open.spotify.com/track/${encodeURIComponent(track.id)}`;
  return {
    id:track.id,
    name:track.name||'أغنية',
    uri:track.uri||`spotify:track:${track.id}`,
    artists:(track.artists||[]).map(artist=>({id:artist.id||'',name:artist.name||''})).filter(artist=>artist.name),
    album:{name:track.album?.name||'',images:image?[{url:image}]:[]},
    external_urls:{spotify}
  };
}

export function upsertHistory(history,track,listenedAt=Date.now(),limit=HISTORY_LIMIT){
  const item=compactTrack(track);
  const current=Array.isArray(history)?history:[];
  if(!item)return current.slice(0,limit);
  return [{...item,listenedAt},...current.filter(entry=>entry?.id&&entry.id!==item.id)].slice(0,limit);
}

export function safeResumePosition(position,duration){
  const point=Math.max(0,Number(position)||0);
  const total=Math.max(0,Number(duration)||0);
  if(point<5000)return 0;
  if(total&&point>=Math.max(0,total-10000))return 0;
  return total?Math.min(point,total):point;
}
