export function dedupeTracks(tracks=[]){
  const seen=new Set();
  const result=[];
  for(const track of Array.isArray(tracks)?tracks:[]){
    const id=track?.id;
    if(!id||seen.has(id))continue;
    seen.add(id);
    result.push(track);
  }
  return result;
}

export function resolveDriverQueue({liveQueue=[],lastSession=null,savedQueue=[]}={}){
  const sources=[liveQueue,lastSession?.tracks,savedQueue];
  const source=sources.find(items=>Array.isArray(items)&&items.length)||[];
  return dedupeTracks(source);
}

export function moveQueueItem(tracks,index,direction){
  const queue=dedupeTracks(tracks);
  const from=Number(index);
  const to=from+Number(direction);
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>=queue.length||to<0||to>=queue.length)return queue;
  [queue[from],queue[to]]=[queue[to],queue[from]];
  return queue;
}

export function removeQueueItem(tracks,index){
  const queue=dedupeTracks(tracks);
  const target=Number(index);
  if(!Number.isInteger(target)||target<0||target>=queue.length)return queue;
  queue.splice(target,1);
  return queue;
}
