/* Washed-up beach for the 404 page, seen from straight above at night.
   One seed from the clock picks the shoreline and what washed up where. Waves then arrive on
   exponentially distributed gaps with random reach and shape, so the tide never plays the same way twice.
   Sand darkens where the water reached and dries over a few seconds, and waves wipe out footprints. */
(()=>{
'use strict';
const PX=4; // CSS px per beach pixel
const cv=document.getElementById('beach');
const ctx=cv.getContext('2d');
const RM=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ---------- randomness, same generator and seed format as Pixel City ---------- */
function sfc32(a,b,c,d){return()=>{a>>>=0;b>>>=0;c>>>=0;d>>>=0;let x=(a+b)|0;a=b^(b>>>9);b=(c+(c<<3))|0;c=(c<<21)|(c>>>11);d=(d+1)|0;x=(x+d)|0;c=(c+x)|0;return(x>>>0)/4294967296;};}
function cyrb128(s){let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;for(let i=0;i<s.length;i++){const k=s.charCodeAt(i);h1=h2^Math.imul(h1^k,597399067);h2=h3^Math.imul(h2^k,2869860233);h3=h4^Math.imul(h3^k,951274213);h4=h1^Math.imul(h4^k,2716044539);}h1=Math.imul(h3^(h1>>>18),597399067);h2=Math.imul(h4^(h2>>>22),2869860233);h3=Math.imul(h1^(h3>>>17),951274213);h4=Math.imul(h2^(h4>>>19),2716044539);h1^=(h2^h3^h4);h2^=h1;h3^=h1;h4^=h1;return[h1>>>0,h2>>>0,h3>>>0,h4>>>0];}
const p2=n=>String(n).padStart(2,'0');
const NOW=new Date();
const SEED_STR=NOW.getFullYear()+'-'+p2(NOW.getMonth()+1)+'-'+p2(NOW.getDate())+' '+p2(NOW.getHours())+':'+p2(NOW.getMinutes())+':'+p2(NOW.getSeconds())+'.'+String(NOW.getMilliseconds()).padStart(3,'0');
let R;
const rr=(a,b)=>a+(b-a)*R();
const ri=(a,b)=>Math.floor(rr(a,b+1));
const chance=p=>R()<p;
const pick=a=>a[Math.floor(R()*a.length)];
const expo=m=>-Math.log(1-R())*m;
const NT=new Float32Array(4096);
function noise(x){const i=Math.floor(x),f=x-i,u=f*f*(3-2*f),a=NT[i&4095],b=NT[(i+1)&4095];return a+(b-a)*u;}
function fbm(x){return noise(x)*.55+noise(x*2.031+17.3)*.3+noise(x*4.97+91.1)*.15;}
// Integer hash for per-pixel sparkle that changes over time without using up the generator.
let SALT=0;
function hash(x,y,t){let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(t,1442695041)+SALT)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}

/* ---------- palette ---------- */
const hex=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
const pack=([r,g,b])=>((255<<24)|(b<<16)|(g<<8)|r)>>>0;
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
const SAND=[hex('#3b3452'),hex('#433b5c'),hex('#332d48')];
const WET=hex('#221d36');
const SURF=hex('#2d5a86'),SHALLOW=hex('#1b3863'),MID=hex('#0e1a3f'),DEEP=hex('#070b24');
const FOAM=pack(hex('#cfe2ff')),FOAM2=pack(hex('#8fb0d8')),GLINT=pack(hex('#f1ead0'));
const SWASH=pack(mix(WET,SURF,.5)),SHEEN=pack(hex('#6a7aa8'));
const LUTN=64,LUT=new Uint32Array(LUTN);
for(let k=0;k<LUTN;k++){const d=k/(LUTN-1);LUT[k]=pack(d<.1?mix(SURF,SHALLOW,d/.1):d<.45?mix(SHALLOW,MID,(d-.1)/.35):mix(MID,DEEP,(d-.45)/.55));}

/* ---------- the beach ---------- */
let W=0,H=0,img,buf,shore,edge,foamW,dry,item,kind,wetT,glintX,glintW;
let waves=[],nextWave=0,crab=null,nextCrab=0;
const FOOTPRINT=1;

function put(x,y,c,k=0){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H||y<shore[x]+2)return;const i=y*W+x;item[i]=c;kind[i]=k;}

function build(){
  // Re-seed on every build so a resize keeps the same beach, just refitted.
  R=sfc32(...cyrb128(SEED_STR));for(let i=0;i<20;i++)R();
  for(let i=0;i<4096;i++)NT[i]=R();
  SALT=(R()*4294967296)|0;
  W=Math.ceil(innerWidth/PX);H=Math.ceil(innerHeight/PX);
  cv.width=W;cv.height=H;
  img=ctx.createImageData(W,H);buf=new Uint32Array(img.data.buffer);
  shore=new Float32Array(W);edge=new Float32Array(W);foamW=new Float32Array(W);
  dry=new Uint8Array(W*H*3);item=new Uint32Array(W*H);kind=new Uint8Array(W*H);wetT=new Float32Array(W*H).fill(-1e9);

  const base=rr(.26,.34),o1=rr(0,900),o2=rr(0,900);
  for(let x=0;x<W;x++)shore[x]=H*(base+.1*(fbm(x*.012+o1)-.5))+(fbm(x*.05+o2)-.5)*3;

  // Dry sand: speckled grain plus faint wind ripples.
  const ra=rr(.2,.6),rb=rr(.7,1.1),ro=rr(0,900);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const r=R();let c=r<.12?SAND[1]:r<.24?SAND[2]:SAND[0];
    if(Math.sin(x*ra+y*rb+fbm(x*.03+ro)*7)>.9)c=mix(c,SAND[1],.6);
    const j=(y*W+x)*3;dry[j]=c[0];dry[j+1]=c[1];dry[j+2]=c[2];
  }

  // What washed up. Most of it collects along the wrack line, where the bigger waves stop.
  const wrack=x=>shore[x]+H*rr(.1,.16);
  const sea=[pack(hex('#1f3b33')),pack(hex('#2b5a46')),pack(hex('#3d6b4f'))];
  for(let n=Math.round(W/14);n>0;n--){
    let x=rr(0,W),y=wrack(Math.min(W-1,Math.floor(x)));const c=pick(sea);
    for(let s=ri(4,11);s>0;s--){put(x,y,c);x+=rr(-1,1.2);y+=rr(-.6,.6);}
  }
  const shells=[hex('#d7cfe6'),hex('#c9a6b8'),hex('#e8dcc8')].map(pack);
  for(let n=Math.round(W*H/900);n>0;n--){const x=rr(0,W),y=chance(.6)?wrack(Math.min(W-1,Math.floor(x)))+rr(-6,6):rr(0,H),c=pick(shells);put(x,y,c);if(chance(.4))put(x+1,y,c);}
  const pebbles=[hex('#5a5470'),hex('#4a4560'),hex('#615a78')].map(pack);
  for(let n=Math.round(W*H/700);n>0;n--)put(rr(0,W),rr(0,H),pick(pebbles));
  for(let n=Math.round(W*H/2500);n>0;n--)put(rr(0,W),rr(0,H),pack(hex('#1a1628'))); // crab holes
  const wood=[pack(hex('#5a4636')),pack(hex('#6e5844')),pack(hex('#3f3128'))];
  for(let n=ri(1,2);n>0;n--){
    const x0=rr(W*.1,W*.9),y0=wrack(Math.floor(x0))+rr(2,10),a=rr(-.6,.6),len=ri(9,20),th=ri(1,2);
    for(let s=0;s<len;s++){const x=x0+Math.cos(a)*s,y=y0+Math.sin(a)*s;for(let k=0;k<th;k++)put(x,y+k,k?wood[0]:wood[1]);if(chance(.12))put(x,y,wood[2]);}
  }
  for(let n=ri(0,2);n>0;n--){const x=rr(4,W-4),y=rr(shore[0]+H*.15,H-4),c=pack(hex('#c4682f'));put(x,y,pack(hex('#d0793a')));put(x-1,y,c);put(x+1,y,c);put(x,y-1,c);put(x,y+1,c);}
  if(chance(.35)){const x=rr(6,W-6),y=wrack(Math.floor(x))+rr(0,8),g=pack(hex('#3f7a5a'));for(let k=0;k<5;k++){put(x+k,y,g);put(x+k,y+1,g);}put(x+5,y,pack(hex('#a8875e')));put(x+1,y,pack(hex('#8bffb0')));}
  if(chance(.85)){
    // A walk along the beach: pairs of prints that the waves will wash away.
    let x=rr(0,W),y=rr(H*.55,H-3);const a=rr(-.5,.5)+(x>W/2?Math.PI:0),fp=pack(hex('#2c2642'));
    for(let s=0;x>-2&&x<W+2&&y>0&&y<H;s++){
      const side=s%2?1:-1,px=x-Math.sin(a)*side,py=y+Math.cos(a)*side;
      put(px,py,fp,FOOTPRINT);put(px+Math.cos(a),py+Math.sin(a),fp,FOOTPRINT);
      x+=Math.cos(a)*3;y+=Math.sin(a)*3-rr(0,.6);
    }
  }
  glintX=rr(.2,.8)*W;glintW=W*rr(.06,.12);
  waves=[];crab=null;
}

/* ---------- events ---------- */
function spawnWave(t){
  const up=rr(1.2,2.4);
  waves.push({t0:t,up,down:up*rr(1.5,2.2),reach:3+H*.2*Math.pow(R(),1.6),off:rr(0,4000),tilt:rr(-.3,.3)});
  // Waves often come in sets, so sometimes the next one follows close behind.
  nextWave=t+(chance(.25)?rr(1.2,2.2):Math.max(1.5,expo(5.5)));
}
function spawnCrab(t){
  const dir=chance(.5)?1:-1;
  crab={x:dir>0?-4:W+4,y:rr(H*.5,H-4),dir,speed:rr(5,10),pauseAt:t+rr(1,4),pausedTill:0,last:t};
}

/* ---------- drawing ---------- */
function render(t){
  // Water's edge per column: a gentle lap plus whichever wave reaches furthest there.
  for(let x=0;x<W;x++){
    let reach=Math.sin(t*.9+x*.05)*1.1+Math.sin(t*1.7-x*.11)*.6,fw=1.2;
    for(const w of waves){
      const a=t-w.t0;let p,back=false;
      if(a<w.up)p=1-Math.pow(1-a/w.up,2);
      else{const s=(a-w.up)/w.down;if(s>=1)continue;p=.5+.5*Math.cos(Math.PI*s);back=true;}
      const r=w.reach*p*(.55+.45*noise(x*.05+w.off))*(1+w.tilt*(x/W-.5)*2);
      if(r>reach){reach=r;fw=back?2.6:2;}
    }
    edge[x]=shore[x]+reach;foamW[x]=fw;
  }
  const tf=Math.floor(t*6),tg=Math.floor(t*4),deepD=H*.4;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x,depth=shore[x]-y,fd=edge[x]-y;
    if(fd>0){
      wetT[i]=t;
      if(fd<1){buf[i]=FOAM;}
      else if(fd<1+foamW[x]&&hash(x,y,tf)>.45){buf[i]=FOAM2;}
      else if(depth<=0){buf[i]=SWASH;}
      else{
        let k=Math.min(LUTN-1,(depth/deepD*LUTN)|0);
        // Swell lines rolling toward the shore.
        if(depth>3&&Math.sin(depth*.45+t*1.3+noise(x*.03+33)*6)>.94)k=Math.max(0,k-10);
        buf[i]=LUT[k];
        const dx=Math.abs(x-glintX)/glintW;
        if(dx<1&&depth>2&&hash(x,y,tg)>.972+dx*.025)buf[i]=GLINT;
      }
      if(depth<=0&&kind[i]===FOOTPRINT){item[i]=0;kind[i]=0;}
      continue;
    }
    const w=Math.exp((wetT[i]-t)/7)*.9,j=i*3;
    if(item[i]){buf[i]=item[i];continue;}
    if(w>.45&&hash(x,y,tg)>.996){buf[i]=SHEEN;continue;}
    buf[i]=((255<<24)|((dry[j+2]+(WET[2]-dry[j+2])*w)<<16)|((dry[j+1]+(WET[1]-dry[j+1])*w)<<8)|(dry[j]+(WET[0]-dry[j])*w))>>>0;
  }
  if(crab)drawCrab(t);
  ctx.putImageData(img,0,0);
}

const CRAB=[pack(hex('#d0793a')),pack(hex('#c4682f')),pack(hex('#8a3f22'))];
function drawCrab(t){
  const dt=t-crab.last;crab.last=t;
  if(t>=crab.pauseAt){crab.pausedTill=t+rr(.4,1.8);crab.pauseAt=crab.pausedTill+rr(1,4);}
  const moving=t>=crab.pausedTill;
  if(moving)crab.x+=crab.dir*crab.speed*dt;
  if(crab.x<-6||crab.x>W+6){crab=null;nextCrab=t+5+expo(25);return;}
  const cx=Math.round(crab.x),cy=Math.round(crab.y),step=moving&&Math.floor(t*10)%2;
  const sprite=[[0,0,0],[3,0,0],[0,1,0],[1,1,1],[2,1,1],[3,1,0],[step?0:1,2,2],[step?2:3,2,2]];
  for(const [dx,dy,c] of sprite){const x=cx+dx,y=cy+dy;if(x<0||x>=W||y<0||y>=H||y<edge[x]+1)continue;buf[y*W+x]=CRAB[c];}
}

function frame(ms){
  const t=ms/1000;
  if(t>=nextWave)spawnWave(t);
  if(!crab&&t>=nextCrab)spawnCrab(t);
  waves=waves.filter(w=>t-w.t0<w.up+w.down);
  render(t);
  requestAnimationFrame(frame);
}

build();
const seedEl=document.getElementById('seed');if(seedEl)seedEl.textContent=SEED_STR;
let resizeTimer;
addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{build();if(RM)still();},150);});
function still(){waves=[{t0:0,up:1,down:2,reach:H*.12,off:rr(0,4000),tilt:0}];render(1.4);}
if(RM)still();
else{const t=performance.now()/1000;nextWave=t+rr(.5,2);nextCrab=t+rr(4,12);requestAnimationFrame(frame);}
})();
