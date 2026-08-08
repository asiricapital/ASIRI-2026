export const QUICK_MOMENTS=Object.freeze([
  {id:'morning',emoji:'☀️',label:'صباح',prompt:'جلسة صباحية سعودية وخليجية هادئة لمدة 45 دقيقة'},
  {id:'coffee',emoji:'☕',label:'قهوة',prompt:'جلسة قهوة خليجية رايقة لمدة ساعة'},
  {id:'drive',emoji:'🚗',label:'طريق',prompt:'جلسة طريق سعودية وخليجية متوازنة لمدة ساعة ونصف'},
  {id:'night',emoji:'🌙',label:'ليل',prompt:'جلسة ليلية خليجية هادئة وطربية لمدة ساعة'}
]);

export function momentForHour(hour=new Date().getHours()){
  const numeric=Number(hour);
  const value=Number.isFinite(numeric)?((numeric%24)+24)%24:12;
  if(value>=5&&value<11)return{
    id:'morning',emoji:'☀️',eyebrow:'صباحك الآن',title:'بداية هادئة على ذوقك',
    description:'صباح سعودي وخليجي خفيف، مرتب لبداية اليوم بدون استعجال.',
    prompt:'جلسة صباحية سعودية وخليجية هادئة لمدة 45 دقيقة'
  };
  if(value>=11&&value<16)return{
    id:'coffee',emoji:'☕',eyebrow:'مزاج الظهر',title:'قهوة وموسيقى رايقة',
    description:'طرب خليجي خفيف يرافق القهوة والعمل ويحافظ على المزاج.',
    prompt:'جلسة قهوة خليجية رايقة وطربية لمدة ساعة'
  };
  if(value>=16&&value<20)return{
    id:'drive',emoji:'🚗',eyebrow:'وقت الطريق',title:'خل الطريق أجمل',
    description:'جلسة متوازنة للحركة والطريق، تبدأ بهدوء وترتفع تدريجيًا.',
    prompt:'جلسة طريق سعودية وخليجية متوازنة لمدة ساعة ونصف'
  };
  return{
    id:'night',emoji:'🌙',eyebrow:'مزاج الليل',title:'ليل هادئ بطابع ASIRI',
    description:'اختيار ليلي دافئ يجمع الهدوء والطرب ويترك المساحة للمزاج.',
    prompt:'جلسة ليلية خليجية هادئة وطربية لمدة ساعة'
  };
}

export function personalizeMomentPrompt(prompt,artist=''){
  const cleanPrompt=String(prompt||'').trim();
  const cleanArtist=String(artist||'').trim();
  return cleanArtist?cleanPrompt+' مع لمسة من '+cleanArtist:cleanPrompt;
}
