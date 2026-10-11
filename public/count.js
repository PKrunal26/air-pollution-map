// Visit and event counts for GoatCounter, sent straight to its count endpoint from this file: no third-party script,
// no cookies. The only thing kept in the browser is the date of the first visit, to tell returning visitors from new ones.
// Off until data-goatcounter names a site code, and never on localhost or in automated browsers.
(()=>{
 const code=(document.currentScript?.dataset.goatcounter||'').trim();
 const local=location.protocol==='file:'||/^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(location.hostname);
 const off=!/^[a-z0-9-]+$/i.test(code)||local||navigator.webdriver;
 function send(path,title,event){
  if(off)return;
  const query=new URLSearchParams({p:path,t:title,s:`${screen.width},${screen.height},${window.devicePixelRatio||1}`,rnd:Math.random().toString(36).slice(2)});
  if(event)query.set('e','true');else query.set('r',document.referrer);
  new Image().src=`https://${code}.goatcounter.com/count?${query}`;
 }
 // Named actions (e.g. "layer/pm2_5"); GoatCounter lists them as events beside the pages.
 window.atlasCount=name=>{try{send(String(name).slice(0,200),String(name),true);}catch{}};
 const embed=/[?&]embed=(1|true|yes)(&|$)/i.test(location.search);
 send(location.pathname+(embed?'?embed':''),document.title,false);
 // New or returning: a visit on a later calendar day than the first one counts as returning. Nothing else is stored.
 if(!embed)try{
  const KEY='air-atlas.first-seen',day=new Date().toISOString().slice(0,10);let first=localStorage.getItem(KEY);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(first||'')){first=day;localStorage.setItem(KEY,day);}
  window.atlasCount(first<day?'visit/returning':'visit/new');
 }catch{}
})();
