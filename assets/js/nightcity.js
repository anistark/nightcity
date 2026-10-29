/* Night City scene runtime: the parts every scene shares, so a scene's own main.js holds only its world.
   Load it before the scene's main.js. It gives each scene, on window.NightCity:
   - one seeded generator: the moment the page opened, formatted YYYY-MM-DD HH:MM:SS.mmm, hashed with cyrb128 into sfc32
   - the frame loop, with reduced motion, ?speed, the low-quality embed mode and pause and play from a host page
   - the event log and counters, which scene-ui.js shows in the overlay
   - a screen wake lock outside embeds */
(()=>{
'use strict';
const QS=new URLSearchParams(location.search);
const RM=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
// A scene's embed page, or ?embed on the full page, runs the scene as a background on another site: no overlay,
// no wake lock, lower quality unless q=high, and the host page can pause and resume it with
// postMessage({nightcity:'pause'}) and {nightcity:'play'}.
const EMBED=QS.has('embed')||document.documentElement.hasAttribute('data-embed');
const LOWQ=EMBED&&QS.get('q')!=='high';
// ?speed=8 runs a scene faster, which helps when checking how it plays out.
const SPEED=Math.max(.1,Math.min(16,parseFloat(QS.get('speed'))||1));
if(EMBED)document.documentElement.classList.add('embed');

/* ---------- randomness ---------- */
function sfc32(a,b,c,d){return()=>{a>>>=0;b>>>=0;c>>>=0;d>>>=0;let x=(a+b)|0;a=b^(b>>>9);b=(c+(c<<3))|0;c=(c<<21)|(c>>>11);d=(d+1)|0;x=(x+d)|0;c=(c+x)|0;return(x>>>0)/4294967296;};}
/* The seed is the moment the page opened: date + time down to the millisecond.
   cyrb128 hashes that string into four 32-bit words to fill the generator's whole state. */
const p2=n=>String(n).padStart(2,'0');
const NOW=new Date();
const SEED_STR=NOW.getFullYear()+'-'+p2(NOW.getMonth()+1)+'-'+p2(NOW.getDate())+' '+p2(NOW.getHours())+':'+p2(NOW.getMinutes())+':'+p2(NOW.getSeconds())+'.'+String(NOW.getMilliseconds()).padStart(3,'0');
function cyrb128(s){let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;for(let i=0;i<s.length;i++){const k=s.charCodeAt(i);h1=h2^Math.imul(h1^k,597399067);h2=h3^Math.imul(h2^k,2869860233);h3=h4^Math.imul(h3^k,951274213);h4=h1^Math.imul(h4^k,2716044539);}h1=Math.imul(h3^(h1>>>18),597399067);h2=Math.imul(h4^(h2>>>22),2869860233);h3=Math.imul(h1^(h3>>>17),951274213);h4=Math.imul(h2^(h4>>>19),2716044539);h1^=(h2^h3^h4);h2^=h1;h3^=h1;h4^=h1;return[h1>>>0,h2>>>0,h3>>>0,h4>>>0];}
const R=sfc32(...cyrb128(SEED_STR));
for(let i=0;i<20;i++)R();
const rr=(a,b)=>a+(b-a)*R();
const ri=(a,b)=>b<=a?Math.round(a):Math.floor(rr(a,b+1));
const pick=a=>a[Math.floor(R()*a.length)];
const chance=p=>R()<p;
const expo=m=>-Math.log(1-R())*m;
const gauss=()=>(R()+R()+R()+R()-2)*1.732;
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function wpick(list){let s=0;for(const it of list)s+=it[1];let r=R()*s;for(const it of list){r-=it[1];if(r<=0)return it[0];}return list[0][0];}
// The noise table is filled straight after the warm-up, so every scene draws the same numbers in the same order as before.
const NT=new Float32Array(4096);for(let i=0;i<4096;i++)NT[i]=R();
function noise(x){const i=Math.floor(x),f=x-i,u=f*f*(3-2*f),a=NT[i&4095],b=NT[(i+1)&4095];return a+(b-a)*u;}
function fbm(x){return noise(x)*.55+noise(x*2.031+17.3)*.3+noise(x*4.97+91.1)*.15;}
const fmtTime=(d,s)=>p2(d.getHours())+':'+p2(d.getMinutes())+(s?':'+p2(d.getSeconds()):'');

/* ---------- event log ---------- */
// The newest entries first. scene-ui.js redraws the list when version changes.
const entries=[],counts={};
function log(text){entries.unshift({time:fmtTime(new Date(),true),text});if(entries.length>50)entries.pop();NC.logVersion++;}
function stats(o){Object.assign(counts,o);}

/* ---------- frame loop ---------- */
let hostPaused=false;
// o.update(dt) and o.draw() run the scene. o.step is a fixed substep in seconds, or 0 to pass each frame's time as it is.
// o.ui() refreshes scene-only parts of the overlay. o.still: show one still frame for reduced motion (the default).
function run(o){
  const advance=dt=>{if(o.step){for(let d=dt;d>1e-9;d-=o.step)o.update(Math.min(d,o.step));}else o.update(dt);};
  const refresh=()=>{if(o.ui)o.ui();NC.ui.refresh();};
  NC.refresh=refresh;
  if(EMBED){
    addEventListener('message',e=>{const m=e.data&&e.data.nightcity;if(m==='pause')hostPaused=true;if(m==='play')hostPaused=false;});
    // nightcity.step(dt) advances by exactly dt and draws, for frame-exact recordings.
    window.nightcity={step(dt){hostPaused=true;advance(dt);o.draw();}};
  }
  o.draw();refresh();
  if(RM&&o.still!==false)return;
  let last=performance.now(),uiT=0,lastDraw=0;
  function frame(now){
    requestAnimationFrame(frame);
    if(hostPaused){last=now;return;}
    if(LOWQ&&now-lastDraw<32)return;
    lastDraw=now;
    const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
    if(!NC.paused)advance(dt*SPEED);
    o.draw();NC.ui.tick();
    uiT+=dt;if(uiT>.5){uiT=0;refresh();}
  }
  requestAnimationFrame(frame);
}

async function wake(){try{if('wakeLock'in navigator&&document.visibilityState==='visible')await navigator.wakeLock.request('screen');}catch(e){}}
if(!EMBED){wake();document.addEventListener('visibilitychange',wake);}

// scene-ui.js replaces ui with the overlay's own tick and refresh. Embeds have no overlay, so these stay empty.
// paused freezes a scene for ?debug tools, refresh() redraws the overlay once a scene is running.
const NC=window.NightCity={RM,EMBED,LOWQ,SPEED,DEBUG:QS.has('debug'),seed:SEED_STR,
  sfc32,cyrb128,R,rr,ri,pick,chance,expo,gauss,shuffle,wpick,NT,noise,fbm,p2,fmtTime,
  log,stats,entries,counts,logVersion:0,run,paused:false,refresh(){},ui:{tick(){},refresh(){}}};
})();
