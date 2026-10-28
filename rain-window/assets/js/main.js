/* Rain Window: slow rain on a window at night, in front of a city out of focus.
   Drops land on the glass, sit, join their neighbours and, once heavy enough, run down, sweeping up what lies in their
   path and leaving a clear trail. Every drop and every light comes from one generator seeded with the moment the page
   opens, so the glass never looks the same twice. No libraries, no image files: everything is drawn to a Canvas. */
(()=>{
'use strict';
const cv=document.getElementById('scene');
const ctx=cv.getContext('2d');
const RM=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
// ?embed runs the scene as a background on another site: no overlay, no wake lock, lower quality unless q=high,
// and the host page can pause and resume it with postMessage({nightcity:'pause'}) and {nightcity:'play'}.
const QS=new URLSearchParams(location.search),EMBED=QS.has('embed'),LOWQ=EMBED&&QS.get('q')!=='high';
const SPEED=Math.max(.1,Math.min(16,parseFloat(QS.get('speed'))||1));
let PAUSED=false;
if(EMBED){document.documentElement.classList.add('embed');addEventListener('message',e=>{const m=e.data&&e.data.nightcity;if(m==='pause')PAUSED=true;if(m==='play')PAUSED=false;});}
// nightcity.step(dt) advances one frame and draws it, for frame-exact recordings.
if(EMBED)window.nightcity={step(dt){PAUSED=true;for(let d=dt;d>1e-9;d-=1/60)update(Math.min(d,1/60));draw();}};

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
function wpick(list){let s=0;for(const it of list)s+=it[1];let r=R()*s;for(const it of list){r-=it[1];if(r<=0)return it[0];}return list[0][0];}
const NT=new Float32Array(4096);for(let i=0;i<4096;i++)NT[i]=R();
function noise(x){const i=Math.floor(x),f=x-i,u=f*f*(3-2*f),a=NT[i&4095],b=NT[(i+1)&4095];return a+(b-a)*u;}
function fbm(x){return noise(x)*.55+noise(x*2.031+17.3)*.3+noise(x*4.97+91.1)*.15;}

/* ---------- helpers ---------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const sstep=(a,b,v)=>{const k=clamp((v-a)/(b-a),0,1);return k*k*(3-2*k);};
const ease=(dt,tau)=>1-Math.exp(-dt/tau);
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return[c,c.getContext('2d')];}
function hex(c){const n=parseInt(c.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
const rgba=(c,a)=>{const[r,g,b]=hex(c);return`rgba(${r},${g},${b},${a})`;};
function mixHex(a,b,k){const x=hex(a),y=hex(b);return'#'+x.map((v,i)=>Math.round(v+(y[i]-v)*k).toString(16).padStart(2,'0')).join('');}
const tint=(c,a)=>mixHex(c,chance(.5)?'#000000':'#ffffff',rr(0,a));
// A fixed hash for things painted on every resize, like which windows are lit, so a resize repaints the same city.
const h3=(a,b,c)=>{const v=Math.sin(a*12.9898+b*78.233+c*37.719)*43758.5453;return v-Math.floor(v);};
const fmt2=n=>String(n).padStart(2,'0');
const fmtTime=(d,s)=>fmt2(d.getHours())+':'+fmt2(d.getMinutes())+(s?':'+fmt2(d.getSeconds()):'');

/* Separable box blur, three passes come close to a gaussian. Only runs on small canvases when the scene is built. */
function blur(c,r,passes){
  if(r<1)return;
  const w=c.width,h=c.height,g=c.getContext('2d'),img=g.getImageData(0,0,w,h),a=img.data,f=new Float32Array(a),b=new Float32Array(a.length),inv=1/(2*r+1);
  const run=(src,dst,n,m,str,lin)=>{for(let j=0;j<m;j++){const base=j*lin;for(let ch=0;ch<3;ch++){let s=0;
    for(let i=-r;i<=r;i++)s+=src[(base+clamp(i,0,n-1)*str)*4+ch];
    for(let i=0;i<n;i++){dst[(base+i*str)*4+ch]=s*inv;s+=src[(base+Math.min(n-1,i+r+1)*str)*4+ch]-src[(base+Math.max(0,i-r)*str)*4+ch];}}}};
  for(let p=0;p<passes;p++){run(f,b,w,h,1,w);run(b,f,h,w,w,1);}
  // A touch of ordered dither keeps the dark sky from banding.
  for(let i=0;i<a.length;i+=4){const px=i>>2,dd=(((px%w)&1)*2+(((px/w)|0)&1)-1.5)*.35;a[i]=f[i]+dd;a[i+1]=f[i+1]+dd;a[i+2]=f[i+2]+dd;}
  g.putImageData(img,0,0);
}

/* ---------- sprites ---------- */
// An out-of-focus point light: a flat disc with a slightly brighter rim and faint rings, like a real lens draws it.
const BOK={};
function bokeh(col){
  if(BOK[col])return BOK[col];
  const S=96,[c,g]=mk(S,S),img=g.createImageData(S,S),d=img.data,[r,gg,b]=hex(col);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const nx=(x+.5-S/2)/(S/2-1),ny=(y+.5-S/2)/(S/2-1),q=Math.hypot(nx,ny);
    const a=(.72+.14*sstep(.55,.97,q)+.012*Math.sin(q*23)-.04*ny)*(1-sstep(.84,1,q));
    const i=(y*S+x)*4,wh=.25*(1-sstep(0,.7,q));d[i]=r+(255-r)*wh;d[i+1]=gg+(255-gg)*wh;d[i+2]=b+(255-b)*wh;d[i+3]=clamp(a,0,1)*255;}
  g.putImageData(img,0,0);return BOK[col]=c;
}
// A small sharp glow, for lights as a drop sees them.
const GLO={};
function glow(col){
  if(GLO[col])return GLO[col];
  const S=32,[c,g]=mk(S,S),rg=g.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
  rg.addColorStop(0,'rgba(255,255,255,1)');rg.addColorStop(.12,rgba(col,1));rg.addColorStop(.35,rgba(col,.35));rg.addColorStop(1,rgba(col,0));
  g.fillStyle=rg;g.fillRect(0,0,S,S);return GLO[col]=c;
}
// The shading inside a drop: a dark rim where the curved water bends light away, a bright rim along the bottom
// where it gathers light, and a small glint at the top left.
const SHADE=(()=>{const S=128,[c,g]=mk(S,S),img=g.createImageData(S,S),d=img.data;
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const nx=(x+.5-S/2)/(S/2),ny=(y+.5-S/2)/(S/2),q=Math.hypot(nx,ny),i=(y*S+x)*4;
    if(q>1.02){d[i+3]=0;continue;}
    const top=clamp(-ny,0,1),bot=clamp(ny,0,1);
    const dark=Math.pow(sstep(.5,1.02,q),1.8)*.7+top*sstep(.4,.95,q)*.12;
    let lite=Math.exp(-Math.pow((q-.82)/.1,2))*Math.pow(bot,1.2)*.55+.05*(1-q);
    lite+=Math.exp(-((nx+.32)**2/.011+(ny+.47)**2/.005))*.95;
    lite+=Math.exp(-((nx-.3)**2/.004+(ny-.62)**2/.0018))*.3;
    const a=clamp(dark+lite,0,1),w=lite/(dark+lite+1e-6);
    d[i]=255*w;d[i+1]=247*w;d[i+2]=234*w;d[i+3]=a*255;}
  g.putImageData(img,0,0);return c;})();
// A soft dark ring just outside a drop, where it meets the glass.
const HALO=(()=>{const S=96,[c,g]=mk(S,S),img=g.createImageData(S,S),d=img.data;
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const nx=(x+.5-S/2)/(S/2),ny=(y+.5-S/2)/(S/2),q=Math.hypot(nx,ny),i=(y*S+x)*4;
    d[i+3]=255*clamp(.34*Math.exp(-Math.pow((q-.79)/.07,2))+.12*Math.exp(-Math.pow((q-.86)/.12,2))*(ny>0?1:.4),0,1);}
  g.putImageData(img,0,0);return c;})();
// Film grain, made once.
const GRAIN=(()=>{const S=160,[c,g]=mk(S,S),img=g.createImageData(S,S),d=img.data;
  for(let i=0;i<d.length;i+=4){const v=R()-.5;d[i]=d[i+1]=d[i+2]=v>0?255:0;d[i+3]=Math.abs(v)*2*36;}
  g.putImageData(img,0,0);return c;})();
const grainPat=ctx.createPattern(GRAIN,'repeat');

/* ---------- the city behind the glass ---------- */
const MOODS=[
  [{name:'blue hour',sky:['#2c4253','#4d6878','#7c8a92'],glow:'#e0956a',far:'#3f5463',mid:'#1c2733',ground:'#0b1119',haze:'#8aa2b0'},4],
  [{name:'deep night',sky:['#060a14','#101a2b','#263040'],glow:'#a2663c',far:'#1c2636',mid:'#0d131e',ground:'#05070c',haze:'#3a4a60'},3],
  [{name:'sodium haze',sky:['#14141d','#2e2830','#5e4535'],glow:'#d27a3c',far:'#30282c',mid:'#18151b',ground:'#09080b',haze:'#806050'},2],
  [{name:'cold rain',sky:['#0d1726','#22364a','#4a5f72'],glow:'#a59088',far:'#2a3c4e',mid:'#141f2c',ground:'#070b12',haze:'#61798e'},3]
];
const MOOD=wpick(MOODS);
MOOD.sky=MOOD.sky.map(c=>tint(c,.07));
const LIGHTS=[['#ffb257',5],['#ff8a3d',3],['#ffd9a6',4],['#f3f1ff',2],['#ff4b3e',.8],['#5fe3e0',.4],['#7dffa0',.25],['#ff5aa5',.35]];
const WARM=['#ffcf86','#ffc06a','#ffe2b0','#f6a95a'];
// World units: x in px from the centre at a 1600px wide window, heights in px above the skyline's foot.
const city={yb:rr(.5,.6),street:0,glowX:rr(-350,350),glowW:rr(500,1000),glowH:rr(140,260),glowA:rr(.35,.7),far:[],mid:[],lights:[],dyn:[],beacon:null,neon:null,bridge:null};
city.street=rr(city.yb+.2,Math.min(.92,city.yb+.32));
{let x=-1250;while(x<1250){const w=rr(36,150),near=Math.exp(-(((x-city.glowX)/520)**2));const h=rr(50,190)+near*rr(80,520)*(chance(.25)?1.35:1);
  city.far.push({x,w,h,col:tint(MOOD.far,.08),lit:rr(.06,.32),gx:rr(5,9),gy:rr(6,11),s:R()*999});x+=w*rr(.5,1.05);}}
{let x=-1250;while(x<1250){const w=rr(70,240),h=rr(-40,230);
  city.mid.push({x,w,h,col:tint(MOOD.mid,.06),lit:rr(.12,.5),gx:rr(8,14),gy:rr(9,15),s:R()*999,warm:rr(.5,1)});x+=w*rr(.85,1.3);}}
{let x=rr(-.1,.05);const gap=rr(.1,.2);while(x<1.1){city.lights.push({fx:x,y:city.street-rr(.015,.05),col:pick(['#ffb257','#ff9a45','#ffd29a']),r:rr(.8,1.15),a:rr(.45,.8),lamp:true});x+=gap*rr(.8,1.25);}}
for(let i=ri(40,80);i>0;i--)city.lights.push({fx:rr(-.03,1.03),y:city.yb-.06+Math.pow(R(),.75)*(1.02-city.yb),col:wpick(LIGHTS),r:rr(.4,1.45),a:rr(.12,.65)});
if(chance(.65)){const x=rr(.15,.7),y=rr(city.yb+.1,city.street+.06),col=pick(['#ff9a3d','#ffb257','#ff7a2e']),sp=rr(.6,.85),a=rr(.3,.5);
  for(let i=ri(6,14);i>0;i--)city.lights.push({fx:x,k:i*sp,y:y+rr(-.003,.003),col,r:rr(.85,1.05),a:a*rr(.8,1.1)});}
for(const b of[...city.far].sort((a,b)=>b.h-a.h).slice(1,5))city.lights.push({x:b.x+b.w/2,y:-1,wy:b.h,col:pick(['#ff4b3e','#f3f1ff']),r:.4,a:.5});
if(chance(.45)){city.bridge={y:rr(city.yb+.03,city.yb+.12)};for(let i=-40,k=-84;i<=40;i++,k+=rr(1.6,3.4))if(chance(.55))city.lights.push({fx:.5,k,y:city.bridge.y+rr(-.002,.002),col:'#ffcf86',r:rr(.35,.55),a:rr(.06,.14)});}
{const tall=city.far.reduce((a,b)=>b.h>a.h?b:a);city.beacon={x:tall.x+tall.w/2,wy:tall.h+4,per:rr(1.6,3)};}
if(chance(.7))city.neon={x:rr(.08,.8),y:rr(city.yb+.08,city.street-.03),col:pick(['#ff4fa3','#4ff0ff','#ff4a4a','#b46bff','#6bff9a']),n:ri(2,4),f:1,flick:null};
for(const b of city.mid)if(b.h>70)for(let i=ri(0,3);i>0;i--)city.dyn.push({x:b.x+b.w*rr(.12,.88),wy:b.h*rr(.1,.9),col:pick(WARM),on:0,want:0,rate:rr(.5,2.5)});
for(const d of city.dyn)d.on=d.want=chance(.55)?1:0;

/* ---------- state ---------- */
let CW=0,CH=0,DPR=1,W=0,H=0,u=1,sc=1,areaK=1,BR=12,t=0,wind=0,I=.3,warming=false;
const FS=.5,FM=72,FILM=.5,ZOOM=4,CELL=24;
let bgBlur,focusStatic,focus,fctx,mist,mctx,film,flctx,scratch,sctx,haze,vig;
let grid=new Float32Array(1),gw=1,gh=1,filmT=0,nextLand=0,nextMist=0,grainT=0,gox=0,goy=0;
const drops=[];
const E={cars:[],planes:[],trains:[],showers:[],lulls:[],gust:null,flash:null,spills:0};
const RAIN={base:rr(.22,.48),o:rr(0,500)};
const X=wx=>CW/2+wx*sc,Y=wy=>CH*city.yb-wy*sc;
const LX=l=>(l.fx!==undefined?l.fx*CW:X(l.x))+(l.k||0)*BR,LY=l=>l.y<0?Y(l.wy):CH*l.y;

/* ---------- event log ---------- */
const logArr=[];const stats={landed:0,merges:0,runs:0};
const $=id=>document.getElementById(id);
const ui={clock:$('clock'),btn:$('logBtn'),panel:$('log'),list:$('logList'),la:$('stLanded'),me:$('stMerges'),ru:$('stRuns'),seed:$('seed'),hud:$('hud')};
ui.seed.textContent=SEED_STR;
let uiDirty=true,lastRunLog=-99;
function log(text){
  if(warming)return;
  logArr.unshift({time:fmtTime(new Date(),true),text});
  if(logArr.length>40)logArr.pop();
  uiDirty=true;
}
// The clock's colon shows for the first half of every second, like a bedside clock. Checked each frame, redrawn only on change.
ui.clock.innerHTML='<span></span><span class="colon">:</span><span></span>';
const[clkH,clkC,clkM]=ui.clock.children;let clkKey='';
function tickClock(blink){
  const d=new Date(),on=!blink||d.getMilliseconds()<500,k=d.getHours()*60+d.getMinutes()+(on?'':'-');
  if(k===clkKey)return;clkKey=k;clkH.textContent=fmt2(d.getHours());clkM.textContent=fmt2(d.getMinutes());clkC.classList.toggle('off',!on);
}
function updateUI(){
  tickClock(!RM);
  ui.la.textContent=stats.landed;ui.me.textContent=stats.merges;ui.ru.textContent=stats.runs;
  if(uiDirty&&!ui.panel.hidden){
    ui.list.textContent='';
    for(const e of logArr.slice(0,30)){const li=document.createElement('li');const tm=document.createElement('time');tm.textContent=e.time;const sp=document.createElement('span');sp.textContent=e.text;li.append(tm,sp);ui.list.append(li);}
    uiDirty=false;
  }
}

/* ---------- painting the backdrop ---------- */
// Paints the city at scale s with an offset, so the same picture can be drawn small for blurring or with a margin for the drops.
function paintCity(g,s,ox,oy,sharp){
  g.setTransform(s,0,0,s,ox,oy);
  const pad=ox/s+2,top=-pad,bot=CH+pad,f=y=>clamp((y*CH-top)/(bot-top),0,1);
  const gr=g.createLinearGradient(0,top,0,bot);
  gr.addColorStop(0,MOOD.sky[0]);gr.addColorStop(f(city.yb*.55),MOOD.sky[1]);gr.addColorStop(f(city.yb),MOOD.sky[2]);gr.addColorStop(f(city.yb+.1),MOOD.ground);gr.addColorStop(1,MOOD.ground);
  g.fillStyle=gr;g.fillRect(-pad,top,CW+2*pad,bot-top);
  const glowAt=(cx,cy,rx,ry,col,a)=>{g.save();g.translate(cx,cy);g.scale(rx/ry,1);const rg=g.createRadialGradient(0,0,0,0,0,ry);rg.addColorStop(0,rgba(col,a));rg.addColorStop(.45,rgba(col,a*.4));rg.addColorStop(1,rgba(col,0));g.fillStyle=rg;g.fillRect(-ry,-ry,2*ry,2*ry);g.restore();};
  glowAt(X(city.glowX),Y(0),city.glowW*sc,city.glowH*sc,MOOD.glow,city.glowA);
  const windows=(b,x0,x1,topY,limit,alpha)=>{
    const gx=b.gx*sc,gy=b.gy*sc,ww=gx*.5,wh=gy*.45;g.globalAlpha=alpha;
    for(let row=0;;row++){const y=topY+gy*(row+.7);if(y>limit)break;
      for(let col=0;;col++){const x=x0+gx*(col+.4);if(x+ww>x1-gx*.15)break;const hs=h3(b.s,row,col);
        if(hs<b.lit){g.fillStyle=WARM[Math.floor(h3(b.s+1,row,col)*WARM.length)];if(h3(b.s+2,row,col)<.18)g.fillStyle='#e6ecff';g.fillRect(x,y,ww,wh);}}}
    g.globalAlpha=1;};
  for(const b of city.far){const x0=X(b.x),x1=X(b.x+b.w),ty=Y(b.h);if(x1<-pad||x0>CW+pad)continue;
    g.fillStyle=b.col;g.fillRect(x0,ty,x1-x0,bot-ty);windows(b,x0,x1,ty,Y(-40),.55);}
  // Mist low over the far skyline, lit from below by the streets.
  {const y0=Y(260),y1=Y(-30),hg=g.createLinearGradient(0,y0,0,y1);hg.addColorStop(0,rgba(MOOD.haze,0));hg.addColorStop(.75,rgba(MOOD.glow,.16));hg.addColorStop(1,rgba(MOOD.haze,.2));g.fillStyle=hg;g.fillRect(-pad,y0,CW+2*pad,y1-y0);}
  for(const b of city.mid){const x0=X(b.x),x1=X(b.x+b.w),ty=Y(b.h);if(x1<-pad||x0>CW+pad)continue;
    g.fillStyle=b.col;g.fillRect(x0,ty,x1-x0,bot-ty);windows(b,x0,x1,ty,bot,.85);}
  // The street: dark ground, a faint wet sheen, and lamp light reflected in long streaks on the road.
  {const y0=CH*(city.yb+.06),gg=g.createLinearGradient(0,y0,0,bot);gg.addColorStop(0,rgba(MOOD.ground,0));gg.addColorStop(.35,rgba(MOOD.ground,.85));gg.addColorStop(1,rgba(MOOD.ground,1));g.fillStyle=gg;g.fillRect(-pad,y0,CW+2*pad,bot-y0);}
  glowAt(CW/2,CH*city.street,CW*.8,CH*.04,MOOD.glow,.14);
  for(const l of city.lights)if(l.lamp){const x=LX(l),y=LY(l),sg=g.createLinearGradient(0,y,0,y+CH*.14);sg.addColorStop(0,rgba(l.col,.0));sg.addColorStop(.15,rgba(l.col,.16*l.a));sg.addColorStop(1,rgba(l.col,0));g.fillStyle=sg;g.fillRect(x-BR*.35,y,BR*.7,CH*.14);}
  for(const l of city.lights){const x=LX(l),y=LY(l);
    if(sharp){const r=2.5+l.r*3;g.globalAlpha=Math.min(1,l.a*1.6);g.drawImage(glow(l.col),x-r,y-r,2*r,2*r);}
    else{const r=BR*l.r*.9;g.globalAlpha=l.a*.5;g.fillStyle=l.col;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();}}
  g.globalAlpha=1;g.setTransform(1,0,0,1,0,0);
}
function paintBackdrops(){
  BR=clamp(Math.min(CW,CH)*.021,7,26);
  // Through the glass: the city painted small, blurred and scaled up, then every light as a soft disc on top.
  const ls=.25,[lo,lg]=mk(CW*ls,CH*ls);paintCity(lg,lo.width/CW,0,0,false);
  blur(lo,clamp(Math.round(Math.min(CW,CH)*ls/55),2,7),3);
  let src=lo;while(src.width*2<W){const[c2,g2]=mk(src.width*2,src.height*2);g2.imageSmoothingQuality='high';g2.drawImage(src,0,0,c2.width,c2.height);src=c2;}
  let bg;[bgBlur,bg]=mk(W,H);bg.imageSmoothingQuality='high';bg.drawImage(src,0,0,W,H);
  bg.setTransform(DPR,0,0,DPR,0,0);bg.globalCompositeOperation='lighter';
  for(const l of city.lights){const x=LX(l),y=LY(l),r=BR*l.r;bg.globalAlpha=l.a;bg.drawImage(bokeh(l.col),x-r,y-r,2*r,2*r);}
  bg.globalAlpha=1;bg.globalCompositeOperation='source-over';
  // The haze that fine mist on the glass scatters: the backdrop blurred much further, thicker toward the bottom of the pane.
  let hz;[haze,hz]=mk(CW*FILM,CH*FILM);
  const[tiny]=mk(CW/24,CH/24);tiny.getContext('2d').drawImage(lo,0,0,tiny.width,tiny.height);blur(tiny,1,2);
  hz.imageSmoothingQuality='high';hz.drawImage(tiny,0,0,haze.width,haze.height);
  const hg=hz.createLinearGradient(0,0,0,haze.height);hg.addColorStop(0,rgba(MOOD.haze,.05));hg.addColorStop(.6,rgba(MOOD.haze,.1));hg.addColorStop(1,rgba(MOOD.haze,.26));
  hz.globalCompositeOperation='screen';hz.fillStyle=hg;hz.fillRect(0,0,haze.width,haze.height);
  // What a drop sees: the same city much sharper, upside down inside the drop. Painted with a margin for drops at the edges.
  let fs;[focusStatic,fs]=mk(CW*FS+2*FM,CH*FS+2*FM);paintCity(fs,FS,FM,FM,true);blur(focusStatic,1,1);{const[cp]=mk(focusStatic.width,focusStatic.height);cp.getContext('2d').drawImage(focusStatic,0,0);fs.globalCompositeOperation='screen';fs.globalAlpha=.55;fs.drawImage(cp,0,0);fs.globalAlpha=1;fs.globalCompositeOperation='source-over';}
  [focus,fctx]=mk(focusStatic.width,focusStatic.height);
  // Vignette: the corners of the pane fall off a little.
  let vg;[vig,vg]=mk(CW/4,CH/4);const vr=vg.createRadialGradient(vig.width/2,vig.height*.45,Math.min(vig.width,vig.height)*.3,vig.width/2,vig.height*.45,Math.hypot(vig.width,vig.height)*.62);
  vr.addColorStop(0,'rgba(0,0,0,0)');vr.addColorStop(1,'rgba(0,0,0,.5)');vg.fillStyle=vr;vg.fillRect(0,0,vig.width,vig.height);
}

/* ---------- drops ---------- */
// A drop's outline: round when it sits, a rounded head with a tapered tail when it runs.
function dropPath(c,x,y,w,ht,hb,s){
  const a=.552-.3*s,b=.552-.32*s;
  c.beginPath();c.moveTo(x,y-ht);
  c.bezierCurveTo(x+w*a,y-ht,x+w,y-ht*b,x+w,y);
  c.bezierCurveTo(x+w,y+hb*.552,x+w*.552,y+hb,x,y+hb);
  c.bezierCurveTo(x-w*.552,y+hb,x-w,y+hb*.552,x-w,y);
  c.bezierCurveTo(x-w,y-ht*b,x-w*a,y-ht,x,y-ht);
  c.closePath();
}
// Draws one drop as a lens: the sharp city, turned upside down and shrunk, clipped to the drop, then its shading.
function lens(c,s,x,y,w,ht,hb,st,sa){
  c.save();c.setTransform(s,0,0,s,0,0);dropPath(c,x,y,w,ht,hb,st);c.clip();
  const r0=Math.max(w,ht,hb),ss=2*r0*ZOOM*FS,fx=FM+x*FS,fy=FM+y*FS;
  const sx=clamp(fx-ss/2,0,focus.width-ss),sy=clamp(fy-ss/2,0,focus.height-ss);
  c.setTransform(-s,0,0,-s,x*s,y*s);c.drawImage(focus,sx,sy,ss,ss,-r0,-r0,2*r0,2*r0);
  c.setTransform(s,0,0,s,0,0);c.globalAlpha*=sa;c.drawImage(SHADE,x-w,y-ht,2*w,ht+hb);
  c.restore();
}
function newDrop(x,y,A){return{x,y,A,r:Math.sqrt(A),vx:0,vy:0,run:false,sticky:u*rr(7,10),seed:rr(0,999),fq:rr(.14,.45),asp:rr(.9,1.1),wob:0,wv:0,ox:0,oy:0,str:0,trail:u*rr(18,70),merges:0,into:null,k:1,age:0,dead:false};}
function cellAt(x,y){const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL);return cx<0||cy<0||cx>=gw||cy>=gh?-1:cy*gw+cx;}
// Tiny droplets never move, so they are drawn once into the mist layer and stay there until a running drop wipes them.
function bake(x,y,r){
  mctx.globalCompositeOperation='source-over';
  lens(mctx,DPR,x,y,r*rr(.9,1.1),r*rr(.92,1.02),r,0,clamp(r/(5*u),.3,.8));
  const c=cellAt(x,y);if(c>=0)grid[c]+=Math.PI*r*r;
}
const MIST_CAP=.3*CELL*CELL;
function mistDrop(){const x=rr(0,CW),y=rr(0,CH),c=cellAt(x,y);if(c<0||grid[c]>MIST_CAP)return;bake(x,y,u*(.35+1.3*Math.pow(R(),2.2)));}
// a takes in b. The smaller drop slides into the bigger one over a few frames instead of vanishing.
function merge(a,b){
  const tot=a.A+b.A,w=b.A/tot,pull=a.run?.55:.85;
  a.ox+=(b.x+b.ox-a.x)*w*pull;a.oy+=(b.y+b.oy-a.y)*w*pull;
  if(a.run)a.vy=a.vy*(1-w*.5)+(b.run?b.vy*w:0);
  a.A=tot;a.wv+=rr(1,2.2)*Math.sqrt(w);a.merges+=1+b.merges;
  b.into=a;b.k=1;stats.merges++;
  if(a.run&&b.run&&t-lastRunLog>10){lastRunLog=t;log('Two running drops meet and run on as one');}
}
// After a drop lands or grows, it joins any drop it now touches.
function settle(d){
  for(let n=0;n<4;n++){let hit=null;
    for(const o of drops){if(o===d||o.into||o.dead)continue;const dx=o.x-d.x,dy=o.y-d.y,rs=(o.r+Math.sqrt(d.A))*.82;if(dx*dx+dy*dy<rs*rs&&(!hit||o.A>hit.A))hit=o;}
    if(!hit)return;
    if(hit.A>=d.A||hit.run){merge(hit,d);d=hit;}else merge(d,hit);
  }
}
function land(){
  const x=rr(-8,CW+8),y=rr(-8,CH+8),r=u*(1.3+7*Math.pow(R(),2.2));
  stats.landed++;
  // Some drops shatter a little on impact and throw a few specks around them.
  if(chance(.3))for(let i=ri(2,6);i>0;i--){const an=rr(0,Math.PI*2),dd=r*rr(1.6,4.5);bake(x+Math.cos(an)*dd,y+Math.sin(an)*dd,u*rr(.35,.9));}
  if(r<1.9*u){bake(x,y,r);return;}
  const d=newDrop(x,y,r*r);d.r*=.55;d.wob=rr(.1,.2);
  drops.push(d);settle(d);
  // Too many drops sitting still: the smallest one becomes part of the mist.
  if(drops.length>maxDrops()){let m=null;for(const o of drops)if(!o.run&&!o.into&&!o.dead&&o.age>1&&(!m||o.A<m.A))m=o;if(m){m.dead=true;bake(m.x,m.y,m.r);}}
}
const maxDrops=()=>clamp(Math.round(330*areaK),130,460);
// A running drop wipes the mist and haze from its path and picks up the water it wipes.
function sweep(d,px,py){
  const wdt=d.r*2*(1-.1*d.str);
  mctx.globalCompositeOperation='destination-out';mctx.setTransform(DPR,0,0,DPR,0,0);mctx.lineCap='round';mctx.lineWidth=wdt*1.05;
  mctx.beginPath();mctx.moveTo(px,py);mctx.lineTo(d.x,d.y);mctx.stroke();mctx.globalCompositeOperation='source-over';
  flctx.lineWidth=wdt*1.25;flctx.beginPath();flctx.moveTo(px,py-d.r*.3);flctx.lineTo(d.x,d.y);flctx.stroke();
  const c=cellAt(d.x,d.y);if(c>=0){const dist=Math.hypot(d.x-px,d.y-py),got=grid[c]*Math.min(1,wdt*dist/(CELL*CELL));grid[c]-=got;d.A+=got/Math.PI*.85;}
}
function stepDrop(d,dt){
  d.age+=dt;
  const tr=Math.sqrt(d.A);
  d.r+=(tr-d.r)*ease(dt,.3);
  // A damped spring makes a drop wobble when it lands or swallows another.
  if(dt>1/40){d.wob=0;d.wv=0;}else{const om=2*Math.PI*clamp(6-d.r/u*.25,3,6),z=.28;d.wv+=(-om*om*d.wob-2*z*om*d.wv)*dt;d.wob+=d.wv*dt;}
  if(d.ox||d.oy){const e=ease(dt,.3),mx=d.ox*e,my=d.oy*e;d.x+=mx;d.y+=my;d.ox-=mx;d.oy-=my;if(Math.abs(d.ox)+Math.abs(d.oy)<.01)d.ox=d.oy=0;}
  if(!d.run&&tr>d.sticky&&d.r>d.sticky*.9){d.run=true;d.vy=Math.max(d.vy,u*.6);stats.runs++;}
  if(!d.run){d.str+=(0-d.str)*ease(dt,.25);return;}
  // Running: heavier drops go faster. Water on glass sticks and lets go, so the speed stutters with smooth noise.
  const ex=Math.max(0,tr-d.sticky*.62);
  let target=Math.min(26*u,u*(2+1.7*ex/u));
  const go=Math.max(sstep(.22,.55,noise(t*d.fq+d.seed)),sstep(11*u,17*u,tr));
  target*=.15+.85*go;
  d.vy+=(target-d.vy)*ease(dt,d.vy<target?.8:.45);
  d.vx=((noise(t*.45*d.fq+d.seed+50)-.5)*.32+wind*.3)*d.vy;
  const px=d.x,py=d.y;d.x+=d.vx*dt;d.y+=d.vy*dt;
  const dist=Math.hypot(d.x-px,d.y-py);
  d.str+=(clamp(d.vy/(14*u),0,1)-d.str)*ease(dt,.5);
  if(dist>0)sweep(d,px,py);
  // It loses water to the glass as it goes, and now and then leaves a droplet behind.
  d.A-=dist*.004*tr;d.trail-=dist;
  // Water on glass can only bead so big: past that, a runner spreads the excess into its trail.
  const cap=(12.5*u)**2;if(d.A>cap)d.A-=(d.A-cap)*Math.min(1,dist*.03);
  if(d.trail<=0){d.trail=u*rr(18,75);const ta=d.A*rr(.015,.05),tx=px+rr(-.25,.25)*tr,ty=py-tr*rr(.5,.9);d.A-=ta;
    if(Math.sqrt(ta)<1.7*u)bake(tx,ty,Math.sqrt(ta));else{const n=newDrop(tx,ty,ta);n.sticky*=1.3;drops.push(n);}}
  if(Math.sqrt(d.A)<d.sticky*.55){d.run=false;d.vy=0;d.vx=0;return;}
  // It swallows whatever lies ahead of it.
  for(const o of drops){if(o===d||o.into||o.dead||o.y<d.y-d.r*.3)continue;const dx=o.x-d.x,dy=o.y-d.y,rs=(o.r+d.r)*.8;
    if(dx*dx+dy*dy<rs*rs){if(o.run&&o.A>d.A){merge(o,d);return;}merge(d,o);}}
  if(d.y-d.r*3>CH){d.dead=true;
    if(d.merges>=5&&t-lastRunLog>8){lastRunLog=t;log(`A drop runs off the bottom of the glass, ${d.merges} others gathered on the way`);}}
}

/* ---------- events ---------- */
// Each kind of event waits its own exponentially distributed gap. m is the average gap in seconds, f the first wait.
const SCHED={shower:{m:260,f:70},lull:{m:320,f:160},gust:{m:130,f:45},spill:{m:150,f:35},lightning:{m:480,f:200},car:{m:25,f:4},bus:{m:120,f:40},window:{m:15,f:6},neon:{m:120,f:40},plane:{m:230,f:60},train:{m:210,f:50}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
const env=e=>{const x=t-e.t0;if(x<0)return 0;if(x<e.a)return sstep(0,e.a,x);if(x<e.a+e.s)return 1;return 1-sstep(e.a+e.s,e.a+e.s+e.r,x);};
const envDone=e=>t>e.t0+e.a+e.s+e.r;
const FLOORS=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth'];
function fire(k){
  if(k==='shower'){E.showers.push({t0:t,a:rr(30,60),s:rr(40,140),r:rr(40,80),amp:rr(.15,.3)});log(pick(['A heavier shower moves in','The rain picks up','A band of heavy rain sweeps over the city']));}
  else if(k==='lull'){E.lulls.push({t0:t,a:rr(10,25),s:rr(25,110),r:rr(15,40),amp:rr(.6,.92)});log(pick(['The rain eases off','The rain thins to a drizzle','The rain almost stops']));}
  else if(k==='gust'){const dir=chance(.5)?-1:1;E.gust={t0:t,a:rr(2,4),s:rr(3,8),r:rr(4,8),dir,amp:rr(.2,.45)};log(`A breeze leans the rain onto the glass from the ${dir>0?'left':'right'}`);}
  else if(k==='spill'){const n=ri(1,3),x0=rr(CW*.1,CW*.9);for(let i=0;i<n;i++){const r=u*rr(8,13),d=newDrop(clamp(x0+rr(-60,60)*u,10,CW-10),-r*rr(1,4),r*r);d.run=true;d.vy=u*rr(2.5,5);drops.push(d);stats.runs++;}
    log(n>1?'Water spills over the top of the frame in a few runs':'Water spills over the top of the frame and runs down');}
  else if(k==='lightning'){if(I<.35){nextEv.lightning=expo(90);return;}const p=[];let s=0;for(let i=ri(1,2);i>0;i--){s+=rr(.3,1.2);p.push([s,rr(.5,1),rr(.8,1.8)]);}E.flash={t0:t,p,amp:rr(.25,.45)};
    log(pick(['Lightning glows softly behind the towers','A far-off glow of lightning','The clouds light up for a moment, far away']));}
  else if(k==='car'||k==='bus'){const kind=k==='bus'?'bus':wpick([['car',8],['taxi',2],['van',2],['motorbike',1.5]]),dir=chance(.5)?1:-1,v=40*Math.exp(rr(0,Math.log(8)))*(kind==='bus'?.6:1);
    E.cars.push({kind,dir,x:-dir*1300,y:city.street+rr(-.005,.02),v,s:rr(0,999),sp:kind==='bus'?rr(1.6,2):kind==='motorbike'?.2:rr(.7,1),b:rr(.7,1)});
    log(`${kind==='bus'?'A bus':kind==='motorbike'?'A motorbike':kind==='taxi'?'A taxi':kind==='van'?'A van':'A car'} ${v<70?'crawls':v<160?'passes':'speeds'} along the street below, ${dir>0?'left to right':'right to left'}`);}
  else if(k==='window'){if(!city.dyn.length)return;const w=pick(city.dyn);w.want=1-w.want;w.rate=rr(1.5,4);const fl=clamp(Math.floor(w.wy/34),0,FLOORS.length-1);
    log(w.want?`A window lights up on the ${FLOORS[fl]} floor across the street`:`A window goes dark on the ${FLOORS[fl]} floor across the street`);}
  else if(k==='neon'){if(!city.neon)return;const p=[];let s=0;for(let i=ri(1,3)*2;i>0;i--){s+=rr(.6,1.8);p.push(s);}city.neon.flick={t0:t,p};log('The neon sign down the street dims and comes back');}
  else if(k==='plane'){const dir=chance(.5)?1:-1;E.planes.push({x:-dir*1300,wy:rr(380,700),v:rr(25,55)*dir,ph:rr(0,1)});log('A plane blinks its way across the clouds');}
  else if(k==='train'){if(!city.bridge)return;const dir=chance(.5)?1:-1;E.trains.push({x:-dir*1500,v:rr(110,180)*dir,n:ri(10,22)});log('A late train crosses the bridge');}
}

/* ---------- update ---------- */
function intensity(){
  let v=RAIN.base+(fbm(t*.0035+RAIN.o)-.5)*.6;
  for(const s of E.showers)v+=s.amp*env(s);
  for(const l of E.lulls)v*=1-l.amp*env(l);
  return clamp(v,.03,.75);
}
function update(dt){
  t+=dt;
  I=intensity();wind=E.gust?E.gust.dir*E.gust.amp*env(E.gust):0;
  if(E.gust&&envDone(E.gust))E.gust=null;
  E.showers=E.showers.filter(e=>!envDone(e));E.lulls=E.lulls.filter(e=>!envDone(e));
  if(!warming)for(const k in SCHED){nextEv[k]-=dt;if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);fire(k);}}
  // Rain lands at random as a Poisson process, so drops come in clumps and gaps on their own.
  const lam=clamp(areaK,.5,1.6)*(.85+1.3*I)*(1+.4*Math.abs(wind));
  nextLand-=dt;while(nextLand<=0){land();nextLand+=expo(1/lam);}
  const mu=areaK*(2+12*I);
  nextMist-=dt;while(nextMist<=0){mistDrop();nextMist+=expo(1/mu);}
  flctx.setTransform(FILM,0,0,FILM,0,0);flctx.lineCap='round';flctx.strokeStyle='rgba(255,255,255,.7)';
  for(let i=0;i<drops.length;i++){const d=drops[i];if(d.dead)continue;
    if(d.into){let a=d.into;while(a.into)a=a.into;d.into=a;const e=ease(dt,.1);d.x+=(a.x-d.x)*e;d.y+=(a.y-d.y)*e;d.k-=dt/.45;if(d.k<=0||a.dead)d.dead=true;continue;}
    stepDrop(d,dt);}
  for(let i=drops.length-1;i>=0;i--)if(drops[i].dead)drops.splice(i,1);
  // Wiped glass mists over again, slowly. Faded in steps big enough to survive 8-bit alpha.
  filmT+=dt;if(filmT>3.5){filmT=0;flctx.setTransform(1,0,0,1,0,0);flctx.globalCompositeOperation='destination-out';flctx.fillStyle='rgba(0,0,0,.075)';flctx.fillRect(0,0,film.width,film.height);flctx.globalCompositeOperation='source-over';}
  // The city.
  for(const w of city.dyn)w.on+=(w.want-w.on)*ease(dt,w.rate);
  for(const c of E.cars)c.x+=c.v*(.7+.6*noise(t*.15+c.s))*c.dir*dt;E.cars=E.cars.filter(c=>Math.abs(c.x)<1400);
  for(const p of E.planes)p.x+=p.v*dt;E.planes=E.planes.filter(p=>Math.abs(p.x)<1400);
  for(const tr of E.trains)tr.x+=tr.v*dt;E.trains=E.trains.filter(tr=>Math.abs(tr.x)<1700);
  if(E.flash&&t-E.flash.t0>12)E.flash=null;
}

/* ---------- drawing ---------- */
function flashLevel(){if(!E.flash)return 0;const x=t-E.flash.t0;let v=0;for(const[s,a,dc]of E.flash.p)if(x>=s)v=Math.max(v,a*sstep(0,.35,x-s)*Math.exp(-(x-s)/dc));return v*E.flash.amp;}
// The lights that change: windows, cars, the beacon, the neon, planes and trains. [x, y, colour, alpha, size]
function liveLights(){
  const L=[],add=(x,y,c,a,s)=>{if(a>.004&&x>-80&&x<CW+80)L.push([x,y,c,a,s]);};
  for(const w of city.dyn)add(X(w.x),Y(w.wy),w.col,.4*w.on,.42);
  {const b=city.beacon,ph=(t/b.per)%1;add(X(b.x),Y(b.wy),'#ff2d2d',.65*(sstep(0,.12,ph)-sstep(.3,.75,ph)),.5);}
  if(city.neon){const n=city.neon;let f=1;if(n.flick){const x=t-n.flick.t0;let on=1;for(const s of n.flick.p)if(x>s)on=1-on;f=on?1:.12;if(x>n.flick.p[n.flick.p.length-1])n.flick=null;}
    n.f+=(f-n.f)*.04;for(let i=0;i<n.n;i++)add(n.x*CW+i*BR*.6,CH*n.y,n.col,.22*n.f,1.15);}
  for(const c of E.cars){const x=X(c.x),y=CH*c.y,d=c.dir,s=BR*c.sp;
    add(x+d*s*1.5,y,'#fff1dc',.55*c.b,.85);if(c.kind!=='motorbike')add(x+d*s*1.15,y+BR*.08,'#fff1dc',.35*c.b,.75);
    add(x-d*s*1.5,y+BR*.05,'#ff3a2e',.45*c.b,.7);if(c.kind!=='motorbike')add(x-d*s*1.2,y+BR*.08,'#ff3a2e',.3*c.b,.6);
    if(c.kind==='taxi')add(x,y-BR*.55,'#ffd36b',.35,.4);
    if(c.kind==='bus')for(let i=-2;i<=2;i++)add(x+i*s*.5,y-BR*.55,'#ffe2a8',.32,.75);}
  for(const p of E.planes){const x=X(p.x),y=Y(p.wy),ph=(t*.8+p.ph)%1;add(x,y,'#ff3a3a',.3,.4);add(x+BR*.3,y,'#f3f1ff',.75*(1-sstep(0,.08,ph)),.35);}
  for(const tr of E.trains){const y=CH*city.bridge.y-BR*.15;for(let i=0;i<tr.n;i++)add(X(tr.x)-Math.sign(tr.v)*i*BR*1.05,y,'#ffe7b0',.36,.6);}
  return L;
}
function composeFocus(L){
  fctx.setTransform(1,0,0,1,0,0);fctx.globalCompositeOperation='copy';fctx.drawImage(focusStatic,0,0);
  fctx.globalCompositeOperation='lighter';fctx.setTransform(FS,0,0,FS,FM,FM);
  for(const[x,y,c,a,s]of L){const r=2.5+s*3.5;fctx.globalAlpha=Math.min(1,a*1.8);fctx.drawImage(glow(c),x-r,y-r,2*r,2*r);}
  const fl=flashLevel();if(fl>0){fctx.globalAlpha=fl*.5;fctx.fillStyle='#c9d6ff';fctx.fillRect(-FM/FS,-FM/FS,CW+2*FM/FS,CH*.7);}
  fctx.globalAlpha=1;fctx.globalCompositeOperation='source-over';
}
function drawDrop(d){
  const k=d.into?Math.sqrt(Math.max(0,d.k)):1,r=d.r*k,s=d.str,wb=clamp(d.wob,-.35,.35);
  if(r<.4)return;
  const w=r*d.asp*(1+wb)*(1-.14*s),hb=r*(1-wb*.7)*(1+.04*s),ht=r*(2-d.asp)*.96*(1-wb*.7)*(1+.95*s);
  ctx.globalAlpha=Math.min(1,d.age/.3);
  const cy=d.y+(hb-ht)/2,hh=(ht+hb)/2;ctx.drawImage(HALO,d.x-w*1.3,cy-hh*1.3,w*2.6,hh*2.6);
  lens(ctx,DPR,d.x,d.y,w,ht,hb,s,clamp(r/(5*u),.55,1));
}
function draw(){
  const L=liveLights();
  composeFocus(L);
  // The city through wet glass, with the live lights as soft discs.
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='copy';ctx.drawImage(bgBlur,0,0);
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalCompositeOperation='lighter';
  for(const[x,y,c,a,s]of L){const r=BR*s;ctx.globalAlpha=a;ctx.drawImage(bokeh(c),x-r,y-r,2*r,2*r);}
  const fl=flashLevel();
  if(fl>0){ctx.globalCompositeOperation='screen';const g=ctx.createLinearGradient(0,0,0,CH);g.addColorStop(0,`rgba(200,214,255,${fl*.42})`);g.addColorStop(city.yb,`rgba(200,214,255,${fl*.2})`);g.addColorStop(1,`rgba(200,214,255,${fl*.05})`);ctx.globalAlpha=1;ctx.fillStyle=g;ctx.fillRect(0,0,CW,CH);}
  // Haze everywhere except where running drops have wiped the glass.
  sctx.globalCompositeOperation='copy';sctx.drawImage(haze,0,0);sctx.globalCompositeOperation='destination-out';sctx.drawImage(film,0,0);
  ctx.globalCompositeOperation='screen';ctx.globalAlpha=.16+.16*I;ctx.drawImage(scratch,0,0,CW,CH);
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(mist,0,0);ctx.setTransform(DPR,0,0,DPR,0,0);
  // Drops: those being swallowed first, then sitting drops, then running ones on top.
  for(const d of drops)if(d.into)drawDrop(d);
  for(const d of drops)if(!d.into&&!d.run)drawDrop(d);
  for(const d of drops)if(!d.into&&d.run)drawDrop(d);
  ctx.globalAlpha=1;
  ctx.drawImage(vig,0,0,CW,CH);
  // Grain, moved every other frame.
  if(++grainT>2){grainT=0;gox=Math.floor(R()*160);goy=Math.floor(R()*160);}
  ctx.setTransform(1,0,0,1,-gox,-goy);ctx.fillStyle=grainPat;ctx.globalAlpha=.28;ctx.fillRect(gox,goy,W,H);
  ctx.globalAlpha=1;ctx.setTransform(1,0,0,1,0,0);
}

/* ---------- build ---------- */
function build(){
  const oldW=CW,oldH=CH;
  CW=Math.max(240,innerWidth);CH=Math.max(240,innerHeight);
  DPR=LOWQ?.75:Math.min(2,devicePixelRatio||1);
  const maxPx=LOWQ?1.2e6:6e6;if(CW*CH*DPR*DPR>maxPx)DPR=Math.sqrt(maxPx/(CW*CH));
  W=cv.width=Math.round(CW*DPR);H=cv.height=Math.round(CH*DPR);
  u=clamp(Math.min(CW,CH)/680,.75,1.4);sc=Math.max(CW/1600,CH/1000);areaK=CW*CH/1e6;
  paintBackdrops();
  [mist,mctx]=mk(W,H);[film,flctx]=mk(CW*FILM,CH*FILM);[scratch,sctx]=mk(CW*FILM,CH*FILM);
  gw=Math.ceil(CW/CELL);gh=Math.ceil(CH/CELL);grid=new Float32Array(gw*gh);
  if(oldW)for(const d of drops){d.x*=CW/oldW;d.y*=CH/oldH;}
}
// Fill the glass before the first frame, so it opens on a window that has been in the rain a while.
function warmup(sec){
  warming=true;composeFocus(liveLights());
  for(let i=Math.round(maxDrops()*.55);i>0;i--)land();
  for(let i=Math.round(areaK*1800);i>0;i--)mistDrop();
  for(let s=0;s<sec*20;s++)update(1/20);
  for(const d of drops){d.age=1;d.wob=d.wv=0;}
  stats.landed=stats.merges=stats.runs=0;warming=false;
}
function remist(){composeFocus(liveLights());warming=true;for(let i=Math.round(areaK*2200);i>0;i--)mistDrop();warming=false;}

/* ---------- start ---------- */
if(QS.has('debug'))window.RW={drops,E,city,stats,logArr,get t(){return t;},get I(){return I;},paused:false,fire,draw:()=>draw(),step:dt=>update(dt),
  run(sec){for(let i=0;i<sec*60;i++)update(1/60);draw();uiDirty=true;updateUI();}};
build();
warmup(180);
log(`${MOOD.name[0].toUpperCase()+MOOD.name.slice(1)} over the city. ${I<.25?'A light rain':I<.5?'Steady rain':'Heavy rain'} on the glass`);
if(RM){
  draw();updateUI();
}else{
  draw();updateUI();
  let last=performance.now(),uiT=0,lastDraw=0;
  function frame(now){
    if(PAUSED){last=now;requestAnimationFrame(frame);return;}
    if(LOWQ&&now-lastDraw<32){requestAnimationFrame(frame);return;}
    lastDraw=now;
    let dt=Math.min(.1,Math.max(0,(now-last)/1000))*SPEED;last=now;
    if(window.RW&&window.RW.paused)dt=0;
    while(dt>0){const s=Math.min(dt,1/60);update(s);dt-=s;}
    draw();tickClock(true);uiT+=1/60;if(uiT>.5){uiT=0;updateUI();}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{build();remist();draw();},200);});
const LOG_ICON='<svg viewBox="0 0 7 7" width="16" height="16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M0 0h5v1H0zM0 1h1v1H0zM4 1h2v1H4zM0 2h1v1H0zM6 2h1v1H6zM0 3h1v1H0zM2 3h3v1H2zM6 3h1v1H6zM0 4h1v1H0zM6 4h1v1H6zM0 5h1v1H0zM2 5h3v1H2zM6 5h1v1H6zM0 6h7v1H0z"/></svg>';
const CLOSE_ICON='<svg viewBox="0 0 7 7" width="16" height="16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M0 0h1v1H0zM1 1h1v1H1zM2 2h1v1H2zM3 3h1v1H3zM4 4h1v1H4zM5 5h1v1H5zM6 6h1v1H6zM6 0h1v1H6zM5 1h1v1H5zM4 2h1v1H4zM2 4h1v1H2zM1 5h1v1H1zM0 6h1v1H0z"/></svg>';
function toggleLog(){ui.panel.hidden=!ui.panel.hidden;ui.btn.setAttribute('aria-expanded',String(!ui.panel.hidden));ui.btn.innerHTML=ui.panel.hidden?LOG_ICON:CLOSE_ICON;ui.btn.setAttribute('aria-label',ui.panel.hidden?'Open log':'Close log');uiDirty=true;updateUI();}
ui.btn.addEventListener('click',e=>{e.stopPropagation();toggleLog();});
cv.addEventListener('click',()=>ui.hud.classList.toggle('off'));
addEventListener('keydown',e=>{if(e.key==='l'||e.key==='L')toggleLog();if(e.key==='h'||e.key==='H')ui.hud.classList.toggle('off');});
async function wake(){try{if('wakeLock'in navigator&&document.visibilityState==='visible')await navigator.wakeLock.request('screen');}catch(e){}}
if(!EMBED){wake();document.addEventListener('visibilitychange',wake);}
})();
