// Visit and event counts for GoatCounter, sent straight to its count endpoint from this file: no third-party script,
// no cookies, no storage. Off until data-goatcounter names a site code, and never on localhost or in automated browsers.
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
})();
