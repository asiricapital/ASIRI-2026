const $ = selector => document.querySelector(selector);
const form = $('#aiDjForm');
const input = $('#aiDjInput');
const button = $('#aiDjButton');
const response = $('#aiDjResponse');
const title = $('#aiDjTitle');
const message = $('#aiDjMessage');

const style = document.createElement('style');
style.textContent = `
.ai-dj-card{position:relative;overflow:hidden;margin:22px 0;padding:22px;border:1px solid rgba(87,255,147,.24);border-radius:28px;background:linear-gradient(145deg,rgba(25,53,35,.96),rgba(14,19,16,.98) 58%,rgba(17,15,27,.98));box-shadow:0 24px 70px rgba(0,0,0,.3)}
.ai-dj-card:before{content:"";position:absolute;width:180px;height:180px;border-radius:50%;top:-90px;left:-55px;background:rgba(30,215,96,.16);filter:blur(12px)}
.ai-dj-heading{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.ai-badge{font-size:10px;font-weight:900;letter-spacing:1px;color:#07110a;background:#1ed760;padding:6px 9px;border-radius:999px}.ai-dj-form{position:relative;display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:18px}.ai-dj-form textarea{resize:none;min-width:0;border:1px solid #38443b;background:rgba(4,8,5,.62);color:#fff;border-radius:18px;padding:14px 15px;outline:none;line-height:1.5}.ai-dj-form textarea:focus{border-color:#1ed760}.ai-dj-form button{border:0;border-radius:18px;background:#1ed760;color:#041006;padding:12px 17px;font-weight:900;cursor:pointer}.ai-dj-form button:disabled{opacity:.6}.ai-dj-suggestions{position:relative;display:flex;gap:8px;overflow-x:auto;margin-top:12px;padding-bottom:3px;scrollbar-width:none}.ai-dj-suggestions button{flex:0 0 auto;border:1px solid #344039;background:rgba(255,255,255,.055);color:#e9f0eb;border-radius:999px;padding:9px 12px;font-size:12px}.ai-dj-response{position:relative;display:flex;align-items:center;gap:12px;margin-top:16px;padding:13px;border:1px solid rgba(30,215,96,.22);border-radius:18px;background:rgba(5,12,7,.54)}.ai-dj-avatar{display:grid;place-items:center;flex:0 0 44px;height:44px;border-radius:14px;background:#1ed760;color:#041006;font-size:12px;font-weight:950}.ai-dj-response p{color:#b5c0b8;font-size:13px;line-height:1.6;margin-top:3px}
@media(max-width:620px){.ai-dj-form{grid-template-columns:1fr}.ai-dj-form button{min-height:48px}.ai-dj-card{padding:18px}}
`;
document.head.appendChild(style);

function normalizeArabic(text){
  return text.toLowerCase()
    .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/[ً-ْ]/g,'').replace(/\s+/g,' ').trim();
}

function understandPrompt(raw){
  const text=normalizeArabic(raw);
  const terms=[];
  let mood='جلسة موسيقية مختارة لك';

  const rules=[
    {words:['قهوه','جلسه'],query:'كلاسيكيات خليجية هادئة',label:'جلسة قهوة خليجية'},
    {words:['سياره','طريق','سفر','قياده'],query:'أغاني عربية خليجية حماسية للسيارة',label:'جلسة طريق وحماس'},
    {words:['نوم','استرخاء','هادي','هادئ','هدوء','مساء'],query:'أغاني عربية هادئة استرخاء',label:'جلسة هدوء واسترخاء'},
    {words:['حماس','رياضه','نادي','طاقة'],query:'أغاني عربية حماسية طاقة',label:'جلسة طاقة وحماس'},
    {words:['طرب','اصيل','عود'],query:'طرب خليجي كلاسيكي',label:'جلسة طرب أصيل'},
    {words:['رومانسي','حب','رومانسيه'],query:'أغاني عربية رومانسية هادئة',label:'جلسة رومانسية'},
    {words:['قديم','كلاسيك','زمن جميل'],query:'كلاسيكيات عربية خليجية قديمة',label:'كلاسيكيات الزمن الجميل'},
    {words:['صباح','فطور'],query:'أغاني عربية صباحية هادئة',label:'جلسة صباحية'},
    {words:['محمد عبده'],query:'محمد عبده',label:'مختارات محمد عبده'},
    {words:['عبادي الجوهر'],query:'عبادي الجوهر',label:'مختارات عبادي الجوهر'},
    {words:['رابح صقر'],query:'رابح صقر',label:'مختارات رابح صقر'},
    {words:['عبدالمجيد عبدالله','عبد المجيد عبدالله'],query:'عبدالمجيد عبدالله',label:'مختارات عبدالمجيد عبدالله'}
  ];

  for(const rule of rules){
    if(rule.words.some(word=>text.includes(normalizeArabic(word)))){
      terms.push(rule.query);
      if(mood==='جلسة موسيقية مختارة لك')mood=rule.label;
    }
  }

  const quoted=raw.match(/[«"']([^»"']+)[»"']/);
  if(quoted?.[1])terms.unshift(quoted[1]);
  const similar=raw.match(/تشبه\s+(.+)|مثل\s+(.+)/i);
  if(similar){const seed=(similar[1]||similar[2]||'').trim();if(seed)terms.unshift(seed)}

  if(!terms.length){
    const cleaned=raw.replace(/شغ[ّ]?ل|شغل لي|ابغى|أبغى|اريد|أريد|اعطني|أعطني|موسيقى|اغاني|أغاني|جلسة|جلسه/gi,' ').replace(/\s+/g,' ').trim();
    terms.push(cleaned||raw);
  }

  const unique=[...new Set(terms)].slice(0,3);
  return {query:unique.join(' '),label:mood};
}

function launchSearch(prompt){
  const parsed=understandPrompt(prompt);
  title.textContent=parsed.label;
  message.textContent=`فهمت طلبك. جهزت بحثًا ذكيًا عن: ${parsed.query}`;
  response.classList.remove('hidden');
  const searchInput=$('#searchInput');
  const searchForm=$('#searchForm');
  const searchTab=document.querySelector('.tab[data-view="search"]');
  searchInput.value=parsed.query;
  searchTab?.click();
  setTimeout(()=>searchForm?.requestSubmit(),180);
  setTimeout(()=>{
    const results=$('#results');
    if(results)results.scrollIntoView({behavior:'smooth',block:'start'});
  },900);
}

form?.addEventListener('submit',event=>{
  event.preventDefault();
  const prompt=input.value.trim();
  if(!prompt)return;
  button.disabled=true;
  button.textContent='يفهم طلبك...';
  response.classList.remove('hidden');
  title.textContent='يحلل ذوق الجلسة';
  message.textContent='أحوّل وصفك إلى اختيار موسيقي مناسب...';
  setTimeout(()=>{
    launchSearch(prompt);
    button.disabled=false;
    button.textContent='✨ أنشئ الجلسة';
  },650);
});

document.querySelectorAll('[data-dj-prompt]').forEach(item=>item.addEventListener('click',()=>{
  input.value=item.dataset.djPrompt;
  form.requestSubmit();
}));
