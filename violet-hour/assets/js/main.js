/* Violet Hour: a pixel-art dusk over a mountain lake, the moon low between the peaks and pines along the near shore.
   Every pixel is an entry in one small palette. The sky and the mountains are painted once, the clouds are sprites that drift
   over them, the lake mirrors whatever stands above it, and the pines sway in front. Every choice comes from the shared
   seeded generator in ../assets/js/nightcity.js, so no two evenings are the same. */
(()=>{
'use strict';
const cv=document.getElementById('scene'),ctx=cv.getContext('2d');
const N=NightCity;
const{R,rr,ri,chance,expo,wpick,noise,fbm}=N;
const QS=new URLSearchParams(location.search);

/* ---------- helpers ---------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
const smooth=(a,b,v)=>{v=clamp((v-a)/(b-a),0,1);return v*v*(3-2*v);};
// Static detail comes from a seeded hash of its position, and sprites from private streams,
// so a resize repaints the same world without drawing from the shared generator.
const SALT=Math.floor(R()*4294967296);
function hash(a,b,c){let h=Math.imul(a|0,374761393)+Math.imul(b|0,668265263)+Math.imul((c|0)+SALT,2246822519);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296;}
function n1(x,k){const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);return lerp(hash(i,0,k),hash(i+1,0,k),u);}
function f1(x,k){return n1(x,k)*.5+n1(x*2.03+7.1,k+1)*.25+n1(x*4.1+3.3,k+2)*.15+n1(x*8.3+1.7,k+3)*.1;}
function vn(x,y,k){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);return lerp(lerp(hash(ix,iy,k),hash(ix+1,iy,k),ux),lerp(hash(ix,iy+1,k),hash(ix+1,iy+1,k),ux),uy);}
const stream=n=>{const g=N.sfc32(SALT,Math.imul(n+1,2654435761)>>>0,(n^0x9e3779b9)>>>0,(n*7919+1)>>>0);for(let i=0;i<12;i++)g();return g;};

/* ---------- the palette ---------- */
// Entries 0-15 are the ramp everything above the water uses, from the black of the near pines to the white of the moon.
// 16-31 are the same sixteen steps as the lake shows them, with the darks lifted to plum. 32-37 are the few warm lights.
const hex=s=>[parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)];
const RAMP='020a1b 030e25 080b3e 1b0763 2d0386 4e06ca 6d00db 8c00f2 a600ff bc00ff d000ff e600ff fb00ff fc5cff febdff ffffff'.split(' ').map(hex);
const LAKE='22064c 2a0756 36086a 440a78 4c0a8c 5a08b0 6a06c8 8204dc 9100e4 a800f0 bc00ff d400ff ea00ff fc45ff fea6ff ffffff'.split(' ').map(hex);
const WARM='fff0c0 ffcf7a d9843c 7c3c34 d8ff78 7fa850'.split(' ').map(hex);
const LAMP=32,AMBER=33,AMBERW=34,EMBER=35,FLY=36,FLYD=37,NONE=255;
const PAL=new Uint32Array(256);
// The mood turns every purple a few degrees toward blue or toward rose. The warm lights keep their colour.
let moodNow=9;
function setMood(m){
  if(Math.abs(m-moodNow)<.004)return;moodNow=m;
  const a=m*17*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const M=[.213+c*.787-s*.213,.715-c*.715-s*.715,.072-c*.072+s*.928,.213-c*.213+s*.143,.715+c*.285+s*.14,.072-c*.072-s*.283,.213-c*.213-s*.787,.715-c*.715+s*.715,.072+c*.928+s*.072];
  const put=(i,[r,g,b],turn)=>{
    if(turn)[r,g,b]=[M[0]*r+M[1]*g+M[2]*b,M[3]*r+M[4]*g+M[5]*b,M[6]*r+M[7]*g+M[8]*b];
    PAL[i]=(255<<24|clamp(Math.round(b),0,255)<<16|clamp(Math.round(g),0,255)<<8|clamp(Math.round(r),0,255))>>>0;
  };
  RAMP.forEach((c,i)=>put(i,c,true));LAKE.forEach((c,i)=>put(16+i,c,true));WARM.forEach((c,i)=>put(32+i,c,false));
}
// WM turns a colour into the one the lake shows for it. UP and DN step one place along a ramp.
const WM=new Uint8Array(256),UP=new Uint8Array(256),DN=new Uint8Array(256);
for(let i=0;i<256;i++){WM[i]=i<16?i+16:i;UP[i]=i<15||i>15&&i<31?i+1:i;DN[i]=i>0&&i<16||i>16&&i<32?i-1:i;}
WM[LAMP]=AMBERW;WM[AMBER]=AMBERW;WM[AMBERW]=EMBER;WM[FLY]=FLYD;
// Tones are steps along the ramp. A tone between two steps is dithered, but only through the middle of the step,
// so the picture is flat bands with a checkered edge between them.
const D2=[.125,.625,.875,.375];
function q(tn,x,y){const b=Math.floor(tn),f=(tn-b-.3)/.4;return clamp(b+(f>D2[(y&1)*2+(x&1)]?1:0),0,15);}

/* ---------- the world, picked once ---------- */
// Distances across the valley are in units of the window's height, measured from the column the moon stands in.
const XD=2.5;
const WORLD={
  moonX:rr(-.09,.09),moonAlt:rr(.07,.11),moonR:rr(.018,.023),
  tall:chance(.5)?-1:1,walls:[],
  sky:wpick([['streaks',4],['banks',3],['open',2]]),
  wind:(chance(.5)?-1:1)*rr(.7,1.25),
  mood:rr(-.5,.5),haze:rr(.5,1),gap:rr(-.14,.14),
  cabin:chance(.6)?{s:chance(.5)?-1:1,X:rr(.16,.42),smoke:chance(.75),jetty:chance(.6)}:null,
  falls:chance(.5)?{s:chance(.5)?-1:1,xr:rr(.12,.3),top:rr(.4,.75)}:null,
  spits:[],trees:[[],[],[],[]],flies:[],
  off:Array.from({length:16},()=>rr(0,3000)),
};
if(N.DEBUG){
  if(QS.has('sky')&&['streaks','banks','open'].includes(QS.get('sky')))WORLD.sky=QS.get('sky');
  if(QS.has('mood'))WORLD.mood=clamp(parseFloat(QS.get('mood'))||0,-1,1);
  if(QS.has('cabin')&&!WORLD.cabin)WORLD.cabin={s:1,X:.3,smoke:true,jetty:true};
  if(QS.has('falls')&&!WORLD.falls)WORLD.falls={s:-1,xr:.2,top:.6};
}
// Each wall of the valley is a set of ridges, far to near. A far ridge comes down to the water close under the moon
// and a near one stands off to the side, so the two walls open like a V.
for(const s of[-1,1]){
  const n=ri(7,10),big=s===WORLD.tall?rr(1.05,1.3):rr(.8,1),planes=[];
  for(let p=0;p<n;p++){
    const k=p/(n-1);
    planes.push({k,X0:lerp(.02,.62,Math.pow(k,1.25))*rr(.8,1.2),rise:lerp(.28,.85,k)*big*rr(.8,1.2),gam:rr(.85,1.25),
      peaks:rr(.05,.11)*lerp(.5,1.4,k),pf:rr(2,5),swell:rr(.02,.06),rough:lerp(.008,.02,k),off:rr(0,999),id:0});
  }
  WORLD.walls.push({s,planes});
}
for(let i=ri(1,3);i>0;i--)WORLD.spits.push({s:chance(.5)?-1:1,tip:rr(.22,.8),d:rr(.012,.075),hgt:rr(.6,1.2),seed:ri(1,1e6)});
// Small islands stand out in the lake, clear of the moon's path.
for(let i=wpick([[0,2],[1,4],[2,2]]);i>0;i--)WORLD.spits.push({isle:true,X:(chance(.5)?-1:1)*rr(.14,.8),w:rr(.05,.15),d:rr(.02,.09),hgt:rr(.8,1.4),seed:ri(1,1e6)});
WORLD.spits.sort((a,b)=>a.d-b.d);
// Four rows of pines on the near shore, far to near, with a few bare snags and thin larches among them.
{
  const SP=[.02,.034,.058,.1];
  for(let l=0;l<4;l++)for(let X=-XD;X<XD;){
    WORLD.trees[l].push({X,hk:R(),wide:rr(.15,.25),kind:chance(.04)?'snag':chance(.22)?'slim':'fir',seed:ri(1,1e9),ph:rr(0,6.28)});
    X+=SP[l]*rr(.45,1.5)*(l===3&&chance(.22)?rr(2,3.4):1);
  }
  for(let i=0;i<22;i++)WORLD.flies.push({X:rr(-1.3,1.3),v:rr(.05,.95),ph:rr(0,100),rate:rr(.7,1.5),thr:R()});
}

/* ---------- layout ---------- */
let S=2,W=0,H=0,Q=1,F=1,hz=0,wh=0,mx=0,my=0,mr=4,U=1;
let frame,img,out32,base,solid,own,skyT,skyQ,lakeB,stars=[],moonPix=[],fallsPix=[],cabin=null,spits=[],GY=[],vis=[];
const CT=[];
function layout(){
  // A scene pixel is a whole number of device pixels, so it stays sharp on any screen.
  const dpr=window.devicePixelRatio||1;
  const want=Math.max(1.5,Math.min(innerWidth/720,innerHeight/405))*(N.LOWQ?1.5:1);
  S=Math.max(1,Math.round(want*dpr))/dpr;
  // ?debug&px=1 sets the size of a scene pixel in CSS pixels, to look at the picture at one size on any window.
  if(N.DEBUG&&QS.has('px'))S=Math.max(.25,parseFloat(QS.get('px'))||1);
  W=Math.max(16,Math.ceil(innerWidth/S));H=Math.max(16,Math.ceil(innerHeight/S));
  cv.width=W;cv.height=H;cv.style.width=W*S+'px';cv.style.height=H*S+'px';
  // On a tall window the valley is drawn larger than the width alone would allow, so the mountains still stand up.
  Q=Math.min(H,W*1.25);F=Math.min(H,W*1.8);U=Q/400;
  hz=Math.round(H*(H>W?.56:.6));wh=H-hz;
  mx=Math.round(W/2+WORLD.moonX*Q);my=Math.round(hz-WORLD.moonAlt*Q);mr=Math.max(3,Math.round(WORLD.moonR*Q));
  frame=new Uint8Array(W*H);img=ctx.createImageData(W,H);out32=new Uint32Array(img.data.buffer);
  paintSky();paintWalls();paintMoon();paintCabin();paintTones();placeStars();
  buildWater();buildSpits();buildFg();
  for(const c of clouds)c.sp=null;
}

/* ---------- the sky ---------- */
// The light is a lens round the moon that widens as it climbs, over a sky that darkens upward and toward the sides.
// Two layers of stretched noise fray the bands sideways.
function skyTone(x,y){
  const X=(x-mx)/Q,up=(my-y)/Q,alt=(hz-y)/Q,ax=Math.abs(X);
  let tn=7.7-3.3*Math.pow(smooth(0,.62,alt),.8)-1.3*smooth(.55,1.5,alt)-2.5*smooth(.25,1.15,ax);
  const sx=.34+.8*Math.max(0,up);
  tn+=3.6*Math.exp(-((X/sx)**2)-((up/(up>0?.26:.12))**2))+1.9*Math.exp(-((X/.11)**2)-((up/.075)**2));
  tn+=(vn(x/(.1*Q),y/(.011*Q),7)-.5)*1.1+(vn(x/(.035*Q),y/(.006*Q),8)-.5)*.5;
  return Math.max(3.2,tn);
}
function paintSky(){
  skyT=new Float32Array(W*hz);skyQ=new Uint8Array(W*hz);base=new Uint8Array(W*hz);solid=new Uint8Array(W*hz);own=new Uint8Array(W*hz);
  for(let y=0;y<hz;y++)for(let x=0;x<W;x++){const i=y*W+x,tn=skyTone(x,y);skyT[i]=tn;base[i]=skyQ[i]=q(tn,x,y);}
}
const SEAS=[[-.3,-.28,.3],[.2,-.1,.2],[-.05,.38,.17],[.45,.3,.12]];
function paintMoon(){
  moonPix=[];
  for(let dy=-mr-1;dy<=mr+1;dy++)for(let dx=-mr-1;dx<=mr+1;dx++){
    const x=mx+dx,y=my+dy,d=Math.hypot(dx,dy);
    if(d>mr+.45||x<0||x>=W||y<0||y>=hz)continue;
    const i=y*W+x;if(solid[i])continue;
    let sea=false;if(mr>4)for(const[sx,sy,sr]of SEAS)if(Math.hypot(dx-sx*mr,dy-sy*mr)<sr*mr)sea=true;
    base[i]=d>mr-.55||sea&&d<mr-1.2?14:15;
    moonPix.push(i);
  }
}
// The colour a cloud takes depends on where it is: each of its five shades is worked out for every pixel of sky,
// so a cloud lights up from below as it drifts toward the moon.
const CA=[0,1.2,3.2,5.2,7.4,9.6],CB=[0,.11,.26,.34,.46,.49];
function paintTones(){
  for(let s=1;s<=5;s++){
    const b=CT[s]=new Uint8Array(W*hz);
    for(let y=0;y<hz;y++)for(let x=0;x<W;x++){const i=y*W+x;b[i]=q(CA[s]+CB[s]*(skyT[i]-4.5),x,y);}
  }
}
function placeStars(){
  stars=[];
  const n=Math.round(W*hz/380);
  for(let j=0;j<n;j++){
    const x=Math.floor(hash(j,1,21)*W),y=Math.floor(Math.pow(hash(j,2,21),1.5)*hz),i=y*W+x;
    if(solid[i]||skyT[i]>7.4)continue;
    const b=Math.pow(hash(j,3,21),3);
    stars.push({i,tone:clamp(Math.round(skyT[i]+2+b*7),0,14),ph:hash(j,4,21)*500,rate:.08+hash(j,5,21)*.3,big:b>.7&&x>0&&x<W-1&&y>0});
  }
}

/* ---------- the mountains ---------- */
// The height of a ridge above the waterline, in pixels, or -1 where it has not begun.
function crest(pl,s,x){
  const xr=s*(x-mx)/Q-pl.X0;if(xr<=0)return -1;
  const e=Math.min(1,xr/.07);
  let h=pl.rise*Math.pow(xr,pl.gam);
  h+=pl.peaks*(1-Math.abs(2*f1(xr*pl.pf+pl.off,60)-1)-.35)*e+pl.swell*(n1(xr*1.3+pl.off*.7,64)-.5)*2*e+pl.peaks*.45*(1-Math.abs(2*n1(xr*pl.pf*2.9+pl.off*5,66)-1)-.4)*e;
  h+=pl.rough*(f1(xr*24+pl.off*3,70)-.5)*2*Math.min(1,xr/.03);
  return Math.max(0,h)*Q;
}
function paintWalls(){
  const top=new Float32Array(W);
  // The far end of the lake: low hills across the gap, pale with distance.
  for(let x=0;x<W;x++){
    const X=(x-mx)/Q,h=(1.2+6*f1(X*5+WORLD.off[0],50)+3*smooth(.05,.5,Math.abs(X)))*U;
    for(let y=Math.max(0,Math.round(hz-h));y<hz;y++){const i=y*W+x;base[i]=q(skyT[i]-2.9+.7*WORLD.haze,x,y);solid[i]=1;}
  }
  const list=[];
  for(const wl of WORLD.walls)for(const pl of wl.planes)list.push([pl,wl.s]);
  list.sort((a,b)=>a[0].k-b[0].k);
  let id=1;
  for(const[pl,s]of list){
    const k=pl.k,body=lerp(6.2,1.5,Math.pow(k,.6));pl.id=++id;
    for(let x=0;x<W;x++){const h=crest(pl,s,x);top[x]=h<0?hz+1:hz-h;}
    // Pines stand along the nearer ridgelines.
    if(k>.3)for(let wx=Math.floor(-mx/U)-6;wx<(W-mx)/U+6;wx+=2+Math.floor(hash(wx,id,71)*3)){
      const x=Math.round(mx+wx*U),th=(1.2+hash(wx,id,72)*3.2)*lerp(.5,1.5,k)*U,hw=Math.max(1,th*.32);
      const ty=top[clamp(x,0,W-1)];if(ty>=hz-1)continue;
      for(let dx=-Math.ceil(hw);dx<=Math.ceil(hw);dx++){const xx=x+dx;if(xx>=0&&xx<W)top[xx]=Math.min(top[xx],ty-th*(1-Math.abs(dx)/(hw+1)));}
    }
    const rimL=lerp(.02,.055,k)*Q,rimA=lerp(1.2,2.8,k),fw=lerp(.03,.075,k)*Q,take=lerp(.42,.06,k),mist=WORLD.haze*lerp(1.5,.25,k);
    for(let x=0;x<W;x++){
      const tp=top[x];if(tp>=hz)continue;
      const y0=Math.max(0,Math.ceil(tp)),g=skyT[clamp(y0-1,0,hz-1)*W+x],lit=smooth(4.6,8.5,g);
      const fringe=1+(hash(x>>1,id,96)>.6?1:0)+(hash(x>>2,id,97)>.8?1:0);
      for(let y=y0;y<hz;y++){
        const d=y-tp,i=y*W+x;
        let tn=body+(g-6)*take+rimA*lit*Math.exp(-d/rimL)-.4*k*smooth(0,.4*Q,d)+(d<1.6?.9*lit:0);
        // Faces and gullies run down the slope and away from the light.
        const xs=x+s*d*.75+(n1(d/(.03*Q)+pl.off,90)-.5)*.05*Q,fc=n1(xs/fw+pl.off*1.7,91);
        tn+=(fc>.56?.8:fc<.32?-.5:0)*lerp(.25,.9,k)*smooth(0,rimL*.5,d)*(.4+.6*lit);
        // Forest on the lower slopes of the nearer ridges.
        if(k>.4&&vn(x/(2.2*U),y/(1.6*U),98+id)>.62)tn-=.28*smooth(rimL,rimL*3,d);
        // Haze thickens toward the water, most on the far ridges.
        tn+=mist*(Math.exp(-(hz-y)/(.03*Q))+.45*(1-smooth(0,.3*Q,hz-y)));
        if(hz-y<=fringe)tn=Math.min(tn,body+.3)-.9;
        base[i]=q(tn,x,y);solid[i]=1;own[i]=id;
      }
    }
  }
  // A waterfall is a thin line of pale water down one face, kept only where no nearer ridge hides it.
  fallsPix=[];
  const fl=WORLD.falls;
  if(fl){
    // Try the ridges nearest the middle distance, at a few places along each, until enough of the fall is in view.
    const pls=WORLD.walls.find(w=>w.s===fl.s).planes.slice().sort((a,b)=>Math.abs(a.k-.62)-Math.abs(b.k-.62));
    search:for(const pl of pls)for(const dx of[0,.05,-.05,.1,-.1,.16]){
      let x=Math.round(mx+fl.s*(pl.X0+fl.xr+dx)*Q);
      const h=x>=0&&x<W?crest(pl,fl.s,x):-1,pix=[];
      if(h<14*U)continue;
      for(let y=Math.round(hz-h*fl.top);y<hz-1;y++){
        if(hash(y,3,111)>.93)x+=hash(y,4,111)>.5?1:-1;
        if(x>0&&x<W-1&&y>=0&&own[y*W+x]===pl.id)pix.push(y*W+x);
      }
      if(pix.length>=10*U){fallsPix=pix;break search;}
    }
  }
}
// A number between a and b that depends only on the seed it is given, so a resize keeps it.
const rr0=(seed,a,b)=>a+(b-a)*((seed*7919%1+1)%1);
// A cabin on the far shore, with pines beside it, a lamp in the window and sometimes a jetty.
function paintCabin(){
  cabin=null;const cb=WORLD.cabin;if(!cb)return;
  const x=Math.round(mx+cb.s*cb.X*Q);if(x<12||x>W-12)return;
  const set=(px,py,v)=>{if(px<0||px>=W||py<0||py>=hz)return;const i=py*W+px;base[i]=v;solid[i]=1;};
  const hw=Math.max(3,Math.round(5*U)),hh=Math.max(3,Math.round(4.5*U)),rh=Math.max(2,Math.round(3.5*U)),by=hz-1;
  // Pines on both sides, the taller on the side away from the lake's middle.
  for(const[dx,th]of[[-cb.s*(hw+4*U),13*U],[cb.s*(hw+3*U),17*U],[cb.s*(hw+8*U),11*U]]){
    const tx=Math.round(x+dx),n=Math.round(th);
    for(let j=0;j<n;j++){const w=Math.round((j/n)*n*.3*(.6+.4*((j%3)/2)));for(let c=-w;c<=w;c++)set(tx+c,by-n+j+1,1);}
  }
  for(let j=0;j<hh;j++)for(let c=-hw;c<=hw;c++)set(x+c,by-j,1);
  // A gable roof, with the slope toward the moon catching its light.
  for(let j=0;j<rh;j++){const w=Math.round((hw+1.5)*(1-j/(rh+.5)));for(let c=-w;c<=w;c++)set(x+c,by-hh-j,-c*cb.s>=w-1&&w>0?6:0);}
  const chx=x+cb.s*Math.round(hw*.45),chy=by-hh-Math.round(rh*.55);
  for(let j=0;j<=Math.max(2,Math.round(2.5*U));j++)set(chx,chy-j,0);
  // The lamp lights the window that looks on the lake.
  const ww=Math.max(2,Math.round(1.8*U)),wx=x-cb.s*Math.round(hw*.45)-(ww>>1),wy=by-Math.max(1,Math.round(hh*.3)),win=[];
  for(let j=0;j<ww;j++)for(let c=0;c<ww;c++){set(wx+c,wy-j,AMBER);win.push((wy-j)*W+wx+c);}
  cabin={x,win,chx,chy:chy-Math.max(2,Math.round(2.5*U))-1,jetty:cb.jetty?{x0:x+cb.s*(hw+2),len:Math.round(rr0(cb.X,7,13)*U),s:cb.s}:null};
}

/* ---------- clouds ---------- */
// A cloud is a sprite of shades: a dark cap on top, then lighter toward its belly, which is lit from below.
// Higher clouds are nearer, so they are larger and drift faster.
const clouds=[],cloudDue=[];
const KINDS={streak:{len:[100,280],th:[4,9],tiers:1},band:{len:[150,320],th:[11,20],tiers:2},bank:{len:[170,340],th:[20,34],tiers:3}};
const MIX={streaks:[['streak',5],['band',3],['bank',1]],banks:[['streak',2],['band',3],['bank',4]],open:[['streak',5],['band',2],['bank',.6]]};
const COUNT={streaks:56,banks:48,open:26}[WORLD.sky];
function newCloud(X){
  const e=.13+.95*Math.pow(R(),.85),K=KINDS[e<.3?'streak':wpick(MIX[WORLD.sky])];
  return{X,e,sc:lerp(.3,1.4,Math.pow(clamp(e,0,1),1.2)),len:rr(K.len[0],K.len[1]),th:rr(K.th[0],K.th[1]),tiers:K.tiers,seed:ri(1,1e9),sp:null};
}
for(let i=0;i<COUNT;i++)clouds.push(newCloud(rr(-XD,XD)));
clouds.sort((a,b)=>a.e-b.e);
function cloudSprite(c){
  const g=stream(c.seed),r=(a,b)=>a+(b-a)*g(),u=c.sc*U;
  const len=Math.max(8,Math.round(c.len*u)),th=Math.max(1.6,c.th*u),n=c.tiers;
  const pad=2,w=len+pad*2,h=Math.ceil(th*(1.55+.5*(n-1)))+pad*2+2,d=new Uint8Array(w*h);
  for(let k=0;k<n;k++){
    const a=pad+(k?len*r(.02,.3):0),b=w-pad-(k?len*r(.02,.3):0),span=b-a;
    if(span<6)continue;
    // The belly of each tier hangs in scallops, and each tier sits lower and in front of the one before.
    const by=pad+th*(.7+.5*k),tk=th*(k?r(.4,.62):.7),ns=c.seed%977+k*53,f4=k?.34:.2,f3=k?.6:.4,f2=k?.8:.56;
    // Each tier is thickest off to one side and swells in lumps, so no two clouds have the same outline.
    const lean=Math.log(.5)/Math.log(r(.3,.7)),lf=r(2,4.5),shape=u=>Math.pow(Math.sin(Math.PI*Math.pow(u,lean)),.5)*(.5+.5*n1(u*lf+ns,131));
    const puffs=[];for(let x=a;x<b;){const env=Math.sin(Math.PI*clamp((x-a)/span,.05,.95)),rad=Math.max(1.5,th*r(.35,.8)*(.3+.7*env));puffs.push(x+rad*.5,rad);x+=rad*r(.9,1.6);}
    for(let X=Math.ceil(a);X<b;X++){
      const env=shape((X-a)/span);
      let bl=0;for(let j=0;j<puffs.length;j+=2){const dx=X-puffs[j],rad=puffs[j+1];if(dx>-rad&&dx<rad){const v=Math.sqrt(rad*rad-dx*dx)*.72;if(v>bl)bl=v;}}
      const y1=Math.round(by+bl*env-(1-env)*th*.25),y0=Math.round(by-tk*env*(.5+.8*Math.round(f1(X/(th*1.8)+ns,130)*5)/5)),T=y1-y0;
      if(T<0)continue;
      for(let y=Math.max(0,y0);y<=y1&&y<h;y++){
        const dd=y1-y+((X+y)&1)*.6;
        d[y*w+X]=T<2?(y===y1?4:2):dd<1?5:dd<1.2+T*f4?4:dd<1+T*f3?3:dd<T*f2?2:1;
      }
    }
  }
  // Loose wisps trail from the ends.
  for(let i=Math.round(r(2,6));i>0;i--){
    const y=pad+Math.round(r(.25,1)*th*(n>1?1.3:.9)),left=g()<.5,x=Math.round(left?r(0,.3)*len:r(.7,1)*len),L=Math.round(r(.06,.2)*len);
    for(let j=0;j<L;j++){const X=pad+x+(left?-j:j);if(X<0||X>=w||y>=h)break;if((j*7+i*3)%11<8&&!d[y*w+X])d[y*w+X]=j>L*.6?2:3;}
  }
  return{w,h,d};
}
function drawClouds(){
  for(const c of clouds){
    const cxp=mx+c.X*Q,half=c.len*c.sc*U*.5+6;
    if(cxp+half<0||cxp-half>W)continue;
    const sp=c.sp||(c.sp=cloudSprite(c)),w=sp.w,h=sp.h,d=sp.d;
    // Streaks lean toward the point under the moon, as rows of cloud do in perspective.
    const x0=Math.round(cxp-w/2),y0=Math.round(hz*(1-c.e)-h/2),tilt=-.2*c.X*Math.min(1,c.e);
    for(let col=0;col<w;col++){
      const x=x0+col;if(x<0||x>=W)continue;
      const ys=y0+Math.round(tilt*(col-w/2));
      for(let r=0;r<h;r++){const s=d[r*w+col];if(!s)continue;const y=ys+r;if(y<0||y>=hz)continue;const i=y*W+x;if(!solid[i])frame[i]=CT[s][i];}
    }
  }
}

/* ---------- the lake ---------- */
// Two rows of stretched noise slide over each other to break the mirror into dashes. RIP is that noise and THR turns
// a share of the water into the level that cuts it.
const RIP=new Uint8Array(256*64),THR=new Uint8Array(101);
{
  for(let y=0;y<64;y++)for(let x=0;x<256;x++){const gx=x/6.4,ix=Math.floor(gx),f=gx-ix,u=f*f*(3-2*f);RIP[y*256+x]=Math.round(255*lerp(hash(ix%40,y,201),hash((ix+1)%40,y,201),u));}
  const hist=new Uint32Array(256);
  for(let i=0;i<40000;i++)hist[(RIP[Math.floor(hash(i,1,202)*16384)]+RIP[Math.floor(hash(i,2,202)*16384)])>>1]++;
  let acc=0,p=0;for(let v=0;v<256;v++){acc+=hist[v];while(p<=100&&acc>=p*400)THR[p++]=v;}
  while(p<=100)THR[p++]=255;
}
let VR,VR2,KX,BRK,HI,rowOff,ta=0,tb=0,sa=0,sb=0;
function buildWater(){
  VR=new Uint16Array(wh);VR2=new Uint16Array(wh);KX=new Float32Array(wh);BRK=new Uint8Array(wh);HI=new Uint8Array(wh);rowOff=new Int8Array(wh);
  lakeB=new Uint8Array(W*wh);
  for(let d=0;d<wh;d++){
    // Ripples are small and close together far away, long and thick near us.
    const dd=d/U;
    VR[d]=Math.floor(60*Math.log(1+dd/60));VR2[d]=Math.floor(45*Math.log(1+dd/45))+7;KX[d]=1/(U*(1+dd/50));
    BRK[d]=THR[Math.round(100*(.07+.3*smooth(0,.3*Q,d)))];HI[d]=THR[Math.round(100*(.93-.05*smooth(0,.3*Q,d)))];
    // Where the mirror is broken the water shows sky from higher up, which is darker.
    const up=(hz-1-Math.min(hz-1,Math.floor(d*2.2+.03*Q)))*W;
    for(let x=0;x<W;x++)lakeB[d*W+x]=WM[skyQ[up+x]];
  }
}
const rip=(x,d)=>{const u=((x-mx)*KX[d]+4096)|0;return(RIP[((VR[d]+ta)&63)<<8|((u+sa)&255)]+RIP[((VR2[d]+tb)&63)<<8|((u-sb)&255)])>>1;};
function drawWater(){
  ta=Math.floor(t*7);tb=Math.floor(t*4.6)+19;sa=Math.floor(t*6);sb=Math.floor(t*3.4);
  const AMP=.03;
  for(let d=0;d<wh;d++){
    const row=(hz+d)*W,src=(hz-1-Math.min(hz-1,d))*W,amp=.35+d*AMP;
    const off=Math.round((noise(d*.31+t*.8+40)-.5)*2*amp+Math.sin(d*.45-t*1.7)*amp*.4);
    rowOff[d]=off;
    const va=((VR[d]+ta)&63)<<8,vb=((VR2[d]+tb)&63)<<8,kx=KX[d],brk=BRK[d],hi=HI[d],lb=d*W;
    for(let x=0;x<W;x++){
      const u=((x-mx)*kx+4096)|0,v=(RIP[va|((u+sa)&255)]+RIP[vb|((u-sb)&255)])>>1;
      let c;
      if(v<brk)c=lakeB[lb+x];
      else{let xs=x+off;if(xs<0)xs=0;else if(xs>=W)xs=W-1;c=WM[frame[src+xs]];if(v>hi)c=UP[c];}
      frame[row+x]=c;
    }
  }
  // A gust ruffles a patch of water, and the patch travels with it.
  for(const g of gusts)for(const p of g.paws){
    const yc=Math.round(p.v*wh),ry=Math.max(2,Math.round(p.ry*wh)),xc=mx+(g.X+p.dx)*Q,rx=p.rx*Q,a=Math.sin(Math.PI*clamp(g.age/g.life,0,1));
    for(let d=Math.max(0,yc-ry);d<Math.min(wh,yc+ry);d++){
      const k=(d-yc)/ry,hw=rx*Math.sqrt(1-k*k)*(.75+.5*hash(d,p.id,301)),thr=BRK[d]+90*a;
      for(let x=Math.max(0,Math.round(xc-hw));x<Math.min(W,Math.round(xc+hw));x++)if(rip(x+31,d)<thr)frame[(hz+d)*W+x]=lakeB[d*W+x];
    }
  }
}
// The moon's light lies on the water as a column of dashes that widens toward us and never holds still.
let mv=1;
function drawGlitter(){
  const alt=hz-my;
  for(let d=Math.max(1,Math.round(alt*.35));d<wh;d++){
    const on=noise(d*.83+t*1.3+7);if(on<.3)continue;
    const env=smooth(alt*.3,alt*.9,d)*(1-.6*smooth(alt*2.5,alt*7,d));
    const w=(mr*.55+d*.05)*env*mv*(on-.3)/.7*1.5;if(w<.5)continue;
    const c=mx+Math.round((noise(d*.37-t*.9+80)-.5)*(2+d*.03)),row=(hz+d)*W;
    for(let x=Math.max(0,Math.round(c-w));x<=Math.min(W-1,Math.round(c+w));x++)frame[row+x]=Math.abs(x-c)<=w*.5&&mv>.35?31:30;
  }
}
// What stands in the lake is drawn with its own mirror image under it, cut by the same ripples.
function stamp(sp,x0,yb,flip){
  const w=sp.w,h=sp.h,d=sp.d;
  for(let r=0;r<h;r++){const y=yb-h+r;if(y<0||y>=H)continue;for(let c=0;c<w;c++){const v=d[r*w+(flip?w-1-c:c)];if(v!==NONE){const x=x0+c;if(x>=0&&x<W)frame[y*W+x]=v;}}}
  for(let r=0,n=Math.min(h,H-yb);r<n;r++){
    const dd=yb+r-hz;if(dd<0)continue;
    const off=rowOff[dd],thr=Math.min(255,BRK[dd]+24);
    for(let c=0;c<w;c++){const v=d[(h-1-r)*w+(flip?w-1-c:c)];if(v===NONE)continue;const x=x0+c+off;if(x<0||x>=W||rip(x,dd)<thr)continue;frame[(yb+r)*W+x]=WM[v];}
  }
}
// Spits of land reach into the lake from the sides, each with a line of pines.
function buildSpits(){
  spits=[];
  for(const sp of WORLD.spits){
    const xt=sp.isle?0:Math.round(mx+sp.s*sp.tip*Q),xa=Math.round(mx+(sp.X-sp.w/2)*Q),xb=Math.round(mx+(sp.X+sp.w/2)*Q);
    const x0=sp.isle?Math.max(0,xa):sp.s<0?0:xt,x1=sp.isle?Math.min(W,xb):sp.s<0?xt:W;if(x1-x0<4)continue;
    const w=x1-x0,near=smooth(.01,.075,sp.d),h=Math.ceil((9+16*near)*U*sp.hgt)+5,d=new Uint8Array(w*h).fill(NONE),tone=near>.45?1:2,k=sp.seed%89;
    for(let c=0;c<w;c++){
      const x=x0+c,wx=Math.round((x-mx)/U),end=sp.isle?Math.pow(Math.sin(Math.PI*clamp((x-xa)/(xb-xa),0,1)),.6):Math.min(1,Math.abs(x-xt)/(9*U));
      let hh=(1+1.6*f1(wx/45+k,120)+(sp.isle?2.5*end:0))*U*(.6+near)*end;
      for(let j=-2;j<=2;j++){const cell=Math.floor(wx/3)+j,cxw=(cell+hash(cell,k,121))*3,th=(4+9*near)*sp.hgt*hash(cell,k,122)*(hash(cell,k,123)>.25?1:0);hh=Math.max(hh,(th*1.25-Math.abs(wx-cxw)*3.4)*U*end+(end>.2?U:0));}
      for(let j=0,n=Math.min(h,Math.round(hh));j<n;j++)d[(h-1-j)*w+c]=tone;
    }
    spits.push({d:Math.max(2,Math.round(sp.d*Q)),x0,sp:{w,h,d}});
  }
}

/* ---------- the near shore ---------- */
const FB=[.165,.12,.075,.028],FA=[.012,.018,.022,.02],FH=[[.04,.075],[.065,.125],[.11,.21],[.18,.42]],FT=[3,2,1,0];
function treeSprite(tr,h,tone,toMoon){
  const g=stream(tr.seed),r=(a,b)=>a+(b-a)*g();
  const hw=Math.max(2,h*tr.wide*(tr.kind==='slim'?.6:1)),w=(Math.ceil(hw)+3)*2+1,c=w>>1,d=new Uint8Array(w*h).fill(NONE),a=new Int16Array(h).fill(w),b=new Int16Array(h).fill(-1);
  const set=(x,y,v)=>{if(x<0||x>=w||y<0||y>=h)return;d[y*w+x]=v;if(x<a[y])a[y]=x;if(x>b[y])b[y]=x;};
  if(tr.kind==='snag'){
    // A dead tree: a bare trunk with a few broken limbs.
    const t0=Math.round(h*.22);
    for(let y=t0;y<h;y++){set(c,y,tone);if(y>h*.6&&h>30)set(c+1,y,tone);}
    for(let i=Math.round(r(3,6));i>0;i--){const y=Math.round(lerp(t0+2,h*.75,g())),dir=g()<.5?-1:1,L=Math.round(r(2,6)*Math.max(1,h/50));for(let j=1;j<=L;j++)set(c+dir*j,y-Math.floor(j/2.4),tone);}
    return{w,h,d,a,b};
  }
  let y=Math.max(2,Math.round(h*r(.04,.08)));
  for(let i=0;i<y;i++)set(c,i,tone);
  const tierB=Math.max(2.2,h/r(11,16));
  while(y<h){
    // Each bough starts narrow against the trunk and reaches out as it hangs lower.
    const f=y/h,th=Math.max(2,Math.round(lerp(.45,1.1,f)*tierB*r(.8,1.25)));
    const reach=hw*Math.pow(Math.min(1,(y+th)/h),tr.kind==='slim'?.7:.85),L=reach*r(.68,1.1),Rr=reach*r(.68,1.1),neck=f<.4?.18:.5;
    for(let j=0;j<th&&y+j<h;j++){
      const e=neck+(1-neck)*Math.pow((j+1)/th,.8),wl=Math.round(L*e),wr=Math.round(Rr*e);
      for(let x=-wl;x<=wr;x++)set(c+x,y+j,tone);
    }
    // The tips droop, needles hang under the bough, and the side toward the moon catches a little light.
    const yb=y+th,wl=Math.round(L),wr=Math.round(Rr);
    if(yb<h){set(c-wl,yb,tone);set(c+wr,yb,tone);for(let x=-wl+1;x<wr;x++)if(g()<.3)set(c+x,yb,tone);}
    if(th>2&&g()<.7){const xe=toMoon>0?wr:-wl;set(c+xe,yb-1,tone+1);if(th>3&&Math.abs(xe)>3)set(c+xe-toMoon,yb-2,tone+1);}
    y+=th;
  }
  return{w,h,d,a,b};
}
function buildFg(){
  GY=[];vis=[];
  for(let l=0;l<4;l++){
    // The ground of each row, with tufts of grass and low bushes along it.
    const gy=new Int16Array(W);
    for(let x=0;x<W;x++){
      const X=(x-mx)/F,wx=Math.round(X*400);
      let y=H-F*(FB[l]+FA[l]*(f1(X*(3+l)+WORLD.off[4+l],140+l)-.5)*2+.03*(l<3?1:.4)*smooth(.15,.9,Math.abs(X-WORLD.gap)));
      if(hash(wx,l,150)>.62)y-=1+Math.floor(hash(wx,l,151)*(1+l));
      const bc=Math.floor(wx/14),bx=(bc+.2+.6*hash(bc,l,152))*14,br=3+hash(bc,l,153)*(4+2*l),dx=wx-bx;
      if(hash(bc,l,154)>.55&&Math.abs(dx)<br)y-=Math.sqrt(br*br-dx*dx)*.6*F/400;
      gy[x]=clamp(Math.round(y),0,H);
    }
    GY.push(gy);
    const list=[];
    for(const tr of WORLD.trees[l]){
      // Pines are taller toward the sides of the window, so they frame the lake on any shape of screen.
      const x=Math.round(mx+tr.X*F),env=lerp(.45,1,smooth(.02,.62,Math.abs(x-mx-WORLD.gap*Q)/(W*.5)))*(.72+.5*n1(tr.X*(7-l)+WORLD.off[8+l],160+l));
      const h=Math.max(6,Math.round(F*lerp(FH[l][0],FH[l][1],tr.hk)*env));
      if(x+h*.3+4<0||x-h*.3-4>=W)continue;
      list.push({x,y:gy[clamp(x,0,W-1)]+2,sp:treeSprite(tr,h,FT[l],x<mx?1:-1),amp:h*.02+.5,ph:tr.ph});
    }
    vis.push(list);
  }
}
function swayAt(x,ph){
  const X=(x-mx)/Q;
  let s=.45*Math.sin(t*.55+X*3.1+ph*.3)+.6*(noise(t*.35+X*2+ph)-.5)+breeze;
  for(const g of gusts)s+=g.dir*g.amp*Math.sin(Math.PI*clamp(g.age/g.life,0,1))*Math.exp(-(((X-g.X)/g.w)**2))*(.8+.3*Math.sin(t*3.3+ph));
  return s;
}
function drawFg(){
  for(let l=0;l<4;l++){
    for(const tr of vis[l]){
      const sp=tr.sp,w=sp.w,h=sp.h,d=sp.d,x0=tr.x-(w>>1),y0=tr.y-h,sw=swayAt(tr.x,tr.ph)*tr.amp;
      for(let r=0;r<h;r++){
        const y=y0+r;if(y<0)continue;if(y>=H)break;
        const k=1-r/h,xo=x0+Math.round(sw*k*k),row=y*W+xo,sr=r*w;
        for(let c=sp.a[r],e=sp.b[r];c<=e;c++){const v=d[sr+c];if(v!==NONE){const x=xo+c;if(x>=0&&x<W)frame[row+c]=v;}}
      }
    }
    const g0=GY[l],g1=l<3?GY[l+1]:null,tone=FT[l];
    for(let x=0;x<W;x++)for(let y=g0[x],e=g1?g1[x]:H;y<e;y++)frame[y*W+x]=tone;
  }
}

/* ---------- what passes ---------- */
const rings=[],flocks=[],meteors=[],ducks=[],gusts=[],smoke=[];
let canoe=null,owl=null,flash=null,flies=0,fliesTo=0,mist=0,mistTo=0,breeze=0,turn=1,turnTo=1,flow=0,lamp=true,smokeNext=0,covered=false;
const px=(x,y,v)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&x<W&&y>=0&&y<H)frame[y*W+x]=v;};
function drawStars(){
  for(const s of stars){
    const k=noise(t*s.rate+s.ph);if(k<.3)continue;
    frame[s.i]=k<.45?Math.max(skyQ[s.i],s.tone-2):s.tone;
    if(s.big&&k>.7){const v=Math.max(skyQ[s.i]+1,s.tone-4);for(const o of[-1,1,-W,W])if(!solid[s.i+o])frame[s.i+o]=v;}
  }
  for(const m of meteors){
    const k=m.age/m.life,hx=(m.X+m.vx*m.age)*Q+mx,hy=(m.y+m.vy*m.age)*hz,l=Math.hypot(m.vx*Q,m.vy*hz),n=Math.round(m.len*U);
    for(let j=0;j<n;j++){
      const x=Math.round(hx-m.vx*Q/l*j),y=Math.round(hy-m.vy*hz/l*j);if(x<0||x>=W||y<0||y>=hz)continue;
      const i=y*W+x;if(solid[i])continue;
      const b=(1-j/n)*Math.sin(Math.PI*k);if(b>.15)frame[i]=clamp(Math.round(skyT[i]+b*8),0,15);
    }
  }
}
// Heat lightning behind the peaks lifts the sky and the clouds there by a step or two.
function drawFlash(){
  if(!flash)return;
  let a=0;for(const[t0,dur,amp]of flash.beats){const k=(flash.age-t0)/dur;if(k>0&&k<1)a=Math.max(a,amp*(1-k));}
  if(a<.15)return;
  const cx=mx+flash.X*Q,cy=flash.y*hz,r=flash.r*Q;
  for(let y=Math.max(0,Math.round(cy-r*.7));y<Math.min(hz,cy+r*.7);y++)for(let x=Math.max(0,Math.round(cx-r));x<Math.min(W,cx+r);x++){
    const i=y*W+x;if(solid[i])continue;
    // Cloud takes the light, and the bare sky between only a little of it.
    const cloud=frame[i]!==base[i],dd=Math.hypot((x-cx)/r,(y-cy)/(r*.7))*(.7+.6*vn(x/(14*U),y/(7*U),341))+D2[(y&1)*2+(x&1)]*.3;
    if(dd<a*(cloud?1:.55))frame[i]=cloud&&dd<a*.5?UP[UP[frame[i]]]:UP[frame[i]];
  }
}
function drawFalls(){
  for(let j=0;j<fallsPix.length;j++){
    const i=fallsPix[j],v=noise(j*.55-t*7+300);
    frame[i]=v>.7?10:v>.42?8:6;
    if(v>.6&&j>fallsPix.length*.4)frame[i+(hash(j,5,112)>.5?1:-1)]=6;
  }
  // Spray where the fall meets the lake, if its foot is in view.
  const i=fallsPix.length?fallsPix[fallsPix.length-1]:0;
  if(i>(hz-4)*W)for(let dx=-3;dx<=3;dx++)if(noise(t*3+dx*5.1+500)>.52)frame[i+dx-(Math.abs(dx)<2&&noise(t*4+dx)>.6?W:0)]=7;
}
function drawCabin(){
  if(!cabin)return;
  for(let j=0;j<cabin.win.length;j++)frame[cabin.win[j]]=lamp?(noise(t*2.2+j*9+70)>.6?LAMP:AMBER):1;
  for(const s of smoke){const k=s.age/s.life,x=Math.round(cabin.chx+s.dx),y=Math.round(cabin.chy-s.dy);if(x<0||x>=W||y<0||y>=hz)continue;if(hash(x,y,311)>k*.9){const i=y*W+x;frame[i]=UP[frame[i]];}}
}
// Birds are a few dark pixels each, with wings that beat, and the lake mirrors them.
const WING=[[-1,-1,1,-1,-2,-2,2,-2],[-1,-1,1,-1,-2,-1,2,-1],[-1,0,1,0,-2,0,2,0],[-1,0,1,0,-2,1,2,1]];
function drawBirds(){
  for(const f of flocks)for(const b of f.birds){
    const a=f.age-b.lag;if(a<0)continue;
    const x=Math.round(mx+(f.X+f.vx*a)*Q+b.dx*U),y=Math.round((f.y+f.vy*a)*hz+b.dy*U+Math.sin(a*.9+b.ph)*2*U);
    if(y>=hz-1)continue;
    const w=WING[[0,1,2,3,2,1][Math.floor(a*f.rate+b.ph)%6]],n=f.big?8:4;
    px(x,y,1);for(let j=0;j<n;j+=2)px(x+w[j],y+w[j+1],1);
  }
}
function drawLake(){
  // Rings spread from where a fish rose, flattened by the low angle we see the water from.
  for(const r of rings){
    const yc=hz+Math.round(r.v*wh),xc=Math.round(mx+r.X*Q),persp=.2+.22*r.v;
    if(r.age<.35){px(xc,yc-1,31);px(xc,yc-2,30);px(xc-1,yc,30);px(xc+1,yc,30);}
    for(let j=0;j<r.n;j++){
      const a=r.age-j*.6;if(a<=0)continue;
      const rad=a*r.sp*U*(1+r.v),fade=1-a/(r.life-j*.6);if(fade<=0)continue;
      // The near side of a ring catches the light and the far side is in its own shadow.
      for(let s=0,steps=Math.ceil(rad*6.5),last=-1;s<steps;s++){
        const an=s/steps*6.2832,x=Math.round(xc+Math.cos(an)*rad),y=Math.round(yc+Math.sin(an)*rad*persp),i=y*W+x;
        if(i===last||x<0||x>=W||y<=hz||y>=H||fade<.6&&hash(x,y,r.id)>fade/.6)continue;
        last=i;frame[i]=Math.sin(an)>-.25?UP[UP[UP[frame[i]]]]:DN[DN[frame[i]]];
      }
    }
  }
  // Everything standing in the water, far to near.
  const things=[];
  for(const s of spits)things.push([s.d,()=>stamp(s.sp,s.x0,hz+s.d)]);
  if(cabin&&cabin.jetty){const j=cabin.jetty;things.push([0,()=>{for(let c=0;c<j.len;c++){const x=j.x0+j.s*c;px(x,hz,1);if(c%4===3||c===j.len-1){px(x,hz-1,1);px(x,hz+1,17);}}}]);}
  for(const dk of ducks)things.push([Math.round(dk.v*wh),()=>drawDuck(dk)]);
  if(canoe)things.push([Math.round(canoe.v*wh),drawCanoe]);
  things.sort((a,b)=>a[0]-b[0]);
  for(const th of things)th[1]();
}
function wake(tr,spread,life){
  for(const p of tr){
    const k=p.a/life;if(k>=1)continue;
    const y=p.y+Math.round(p.a*.35*U);if(y<=hz||y>=H)continue;
    for(const s of[-1,1]){const x=Math.round(p.x+s*p.a*spread*U);if(x<1||x>=W-1||hash(x,y,321)<k)continue;const i=y*W+x;frame[i]=UP[frame[i]];if(k<.4)frame[i+s]=UP[frame[i+s]];}
  }
}
function drawDuck(dk){
  wake(dk.trail,1.5,7);
  const x=Math.round(dk.x),y=hz+Math.round(dk.v*wh),s=dk.dir;
  px(x,y,1);px(x-s,y,1);px(x+s,y,1);px(x+s,y-1,1);if(U>1.3){px(x-2*s,y,1);px(x,y-1,1);}
  px(x,y+1,16);px(x-s,y+1,16);
}
const CANOE=(()=>{const w=13,h=5,d=new Uint8Array(w*h).fill(NONE),set=(x,y,v)=>d[y*w+x]=v;for(let x=1;x<12;x++)set(x,4,1);for(let x=0;x<13;x++)set(x,3,1);set(5,2,1);set(5,1,1);set(6,2,1);set(5,0,1);set(11,2,AMBER);set(7,2,1);set(8,1,1);return{w,h,d};})();
function drawCanoe(){
  wake(canoe.trail,2.2,9);
  const y=hz+Math.round(canoe.v*wh);
  stamp(CANOE,Math.round(canoe.x)-6,y+1,canoe.dir<0);
  const lx=Math.round(canoe.x)+canoe.dir*5;px(lx,y-2,noise(t*3+9)>.5?LAMP:AMBER);
}
// Mist lies along the far shore as a checkered veil, a step lighter than what it covers.
function drawMist(){
  if(mist<.03)return;
  const top=Math.round(11*U),bot=Math.round(4*U);
  for(let y=hz-top;y<hz+bot;y++){
    if(y<0||y>=H)continue;
    const fall=y<hz?(y-(hz-top))/top:1-(y-hz)/bot;
    for(let x=0;x<W;x++){
      const n=mist*(.4+1.7*vn(x/(46*U)+flow*.03,y/(5*U)+t*.01,331))*fall;
      if(n>.32+D2[(y&1)*2+(x&1)]*.6){const i=y*W+x;frame[i]=UP[frame[i]];}
    }
  }
}
function drawFlies(){
  if(flies<.02)return;
  for(const f of WORLD.flies){
    if(f.thr>flies)continue;
    const b=Math.sin(t*f.rate+f.ph);if(b<.25)continue;
    const x=mx+f.X*F+(noise(t*.11+f.ph)-.5)*70*U,y=H-F*(.015+.2*f.v*f.v)+(noise(t*.13+f.ph+50)-.5)*24*U;
    px(x,y,b>.6?FLY:FLYD);
  }
}
function drawOwl(){
  if(!owl)return;
  const x=Math.round(owl.x),y=Math.round(hz+owl.v*wh+Math.sin(owl.age*1.3)*5*U),s=Math.max(1,Math.round(U)),fl=Math.sin(owl.age*5.5);
  for(let j=-s;j<=s;j++){px(x+j,y,0);px(x+j,y+1,0);}
  px(x+owl.dir*(s+1),y,0);
  for(let j=1;j<=5*s;j++){const lift=Math.round(-fl*j*.55+(j>3*s?fl*.5*(j-3*s):0));px(x-s-j,y+lift,0);px(x+s+j,y+lift,0);if(j<4*s){px(x-s-j,y+lift+1,0);px(x+s+j,y+lift+1,0);}}
}

/* ---------- events ---------- */
const stats={rises:0,birds:0,events:0};
let t=0,warming=false;
function log(text){if(warming)return;stats.events++;N.log(text);}
const SCHED={rise:{m:8,f:3},birds:{m:80,f:16},gust:{m:60,f:22},meteor:{m:150,f:45},duck:{m:140,f:30},glow:{m:170,f:55},mist:{m:280,f:100},flash:{m:330,f:130},canoe:{m:460,f:160},owl:{m:230,f:85},lamp:{m:320,f:140},turn:{m:1100,f:500}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
const viewX=()=>(rr(0,W)-mx)/Q,edge=dir=>dir>0?-(mx/Q)-.08:(W-mx)/Q+.08;
function fire(k){
  switch(k){
    case'rise':{const n=wpick([[1,3],[2,3],[3,2]]);rings.push({X:viewX(),v:rr(.04,.62),age:0,life:rr(3,5)+n,n,sp:rr(5,8),id:ri(1,9999)});stats.rises++;if(n===3)log('A fish rises and rings spread across the lake');break;}
    case'birds':{
      const dir=chance(.5)?1:-1,big=chance(.4),n=big?ri(1,4):ri(4,13),birds=[];
      // A skein of geese flies as a V, and a few larger birds fly loose.
      for(let i=0;i<n;i++){const side=i%2?1:-1,rank=Math.ceil(i/2);birds.push(big?{dx:rr(-14,14),dy:rr(-8,8),lag:rr(0,1.5),ph:rr(0,6)}:{dx:-dir*rank*rr(3.4,4.4),dy:side*rank*rr(1.6,2.4)+rr(-.5,.5),lag:0,ph:rr(0,6)});}
      flocks.push({X:edge(dir),y:rr(.22,.86),vx:dir*rr(.03,.055)*(big?1.2:1),vy:rr(-.006,.006),rate:big?rr(4,5.5):rr(6,8),big,birds,age:0,life:60});
      stats.birds+=n;log(big?(n>1?n+' herons cross the valley':'A heron crosses the valley on slow wings'):'A skein of '+n+' geese crosses the valley');break;
    }
    case'gust':{
      const dir=chance(.7)?Math.sign(wind)||1:-(Math.sign(wind)||1),paws=[];
      for(let i=ri(1,3);i>0;i--)paws.push({dx:rr(-.25,.25),v:rr(.06,.6),rx:rr(.12,.3),ry:rr(.03,.08),id:ri(1,999)});
      const v=dir*rr(.1,.18),X0=edge(dir)-dir*.3;
      gusts.push({X:X0,v,dir,amp:rr(1.2,2.2),w:rr(.25,.45),paws,age:0,life:((W/Q)+1)/Math.abs(v)});
      log('A gust comes down the valley and ruffles the lake');break;
    }
    case'meteor':{const d=chance(.5)?1:-1,a=rr(.3,.9),sp=rr(.5,.9);meteors.push({X:viewX()*.8,y:rr(.03,.5),vx:d*Math.cos(a)*sp,vy:Math.sin(a)*sp*1.4,len:rr(10,22),age:0,life:rr(.45,.9)});log('A shooting star');break;}
    case'duck':{
      const dir=chance(.5)?1:-1,n=wpick([[1,3],[2,3],[3,1]]),v=rr(.07,.45),sp=rr(5,8);
      for(let i=0;i<n;i++)ducks.push({x:(dir>0?-6:W+6)-dir*i*rr(9,15)*U,v:v+i*.006,dir,sp:sp*U,trail:[],next:0,age:0,life:999});
      log(n>1?n+' ducks paddle across the lake in a line':'A duck paddles across the lake, trailing a wake');break;
    }
    case'glow':fliesTo=rr(.5,1);log('Fireflies come up among the pines');break;
    case'mist':mistTo=rr(.5,1);log('Mist gathers along the far shore');break;
    case'flash':{
      const beats=[];let tt=0;for(let i=ri(2,5);i>0;i--){beats.push([tt,rr(.12,.4),rr(.6,1)]);tt+=rr(.1,.9);}
      flash={X:viewX()*.9,y:rr(.25,.7),r:rr(.2,.36),beats,age:0,life:tt+1};log('Heat lightning flickers behind the peaks, too far away to hear');break;
    }
    case'canoe':{if(canoe)break;const dir=chance(.5)?1:-1;canoe={x:dir>0?-10:W+10,v:rr(.1,.4),dir,sp:rr(3.5,5.5)*U,trail:[],next:0};log('A canoe crosses the lake with a lantern at its bow');break;}
    case'owl':{if(owl)break;const dir=chance(.5)?1:-1;owl={x:dir>0?-14:W+14,v:rr(.02,.3),dir,sp:rr(34,52)*U,age:0};log('An owl glides low over the water');break;}
    case'lamp':{if(!cabin)break;lamp=!lamp;log(lamp?'A lamp is lit in the cabin':'The lamp in the cabin goes out');break;}
    case'turn':turnTo=-turnTo;log('The wind turns and the clouds drift back the way they came');break;
  }
}
let wind=WORLD.wind;
function update(dt){
  t+=dt;
  for(const k in SCHED){nextEv[k]-=dt;if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);fire(k);}}
  setMood(clamp(WORLD.mood+(fbm(t*.004+WORLD.off[1])-.5)*1.7,-1,1));
  // The wind, and the clouds it carries. One that leaves is replaced, after a wait, by a new one upwind.
  turn+=clamp(turnTo-turn,-dt/45,dt/45);
  wind=WORLD.wind*turn*(.7+.6*fbm(t*.01+WORLD.off[2]));
  breeze=(fbm(t*.03+WORLD.off[3])-.5)*.8;flow+=wind*dt;
  const dir=Math.sign(wind)||1;
  for(let i=clouds.length-1;i>=0;i--){
    const c=clouds[i];c.X+=wind*c.sc*dt*.0075;
    if(c.X*dir>XD+c.len*c.sc/800+.05){clouds.splice(i,1);cloudDue.push(expo(10));}
  }
  for(let i=cloudDue.length-1;i>=0;i--)if((cloudDue[i]-=dt)<=0){
    cloudDue.splice(i,1);const c=newCloud(0);c.X=-dir*(XD+c.len*c.sc/800);
    let j=0;while(j<clouds.length&&clouds[j].e<c.e)j++;clouds.splice(j,0,c);
  }
  for(const list of[rings,flocks,meteors,gusts])for(let i=list.length-1;i>=0;i--){const o=list[i];o.age+=dt;if(o.age>o.life)list.splice(i,1);}
  for(const g of gusts)g.X+=g.v*dt;
  const trail=(o,gap)=>{o.x+=o.dir*o.sp*dt;for(const p of o.trail)p.a+=dt;if((o.next-=dt)<=0){o.next=gap;o.trail.push({x:o.x-o.dir*2,y:hz+Math.round(o.v*wh),a:0});if(o.trail.length>40)o.trail.shift();}return o.x<-30*U||o.x>W+30*U;};
  for(let i=ducks.length-1;i>=0;i--)if(trail(ducks[i],.35))ducks.splice(i,1);
  if(canoe&&trail(canoe,.3))canoe=null;
  if(owl){owl.age+=dt;owl.x+=owl.dir*owl.sp*dt;if(owl.x<-20*U||owl.x>W+20*U)owl=null;}
  if(flash){flash.age+=dt;if(flash.age>flash.life)flash=null;}
  // Fireflies and mist come up quickly and fade over a minute or so.
  flies+=clamp(fliesTo-flies,-dt/50,dt/8);if(flies>=fliesTo-.01)fliesTo=0;
  mist+=clamp(mistTo-mist,-dt/70,dt/25);if(mist>=mistTo-.01)mistTo=0;
  if(cabin&&WORLD.cabin.smoke){
    if((smokeNext-=dt)<=0){smokeNext=rr(.25,.6);smoke.push({dx:0,dy:0,age:0,life:rr(5,9),w:rr(-.4,.4)});}
    for(let i=smoke.length-1;i>=0;i--){const s=smoke[i];s.age+=dt;s.dy+=dt*1.7*U;s.dx+=dt*(wind*1.1+s.w)*U*(.4+s.age*.25);if(s.age>s.life)smoke.splice(i,1);}
  }
}

/* ---------- drawing ---------- */
function moonCheck(){
  let n=0;for(let j=0;j<moonPix.length;j++)if(frame[moonPix[j]]>=14)n++;
  const now=moonPix.length?n/moonPix.length:1;
  mv+=(now-mv)*.08;
  if(!covered&&mv<.3){covered=true;log('A cloud crosses the moon and its light leaves the water');}
  else if(covered&&mv>.8){covered=false;log('The moon comes clear again');}
}
function present(){for(let i=0,n=W*H;i<n;i++)out32[i]=PAL[frame[i]];ctx.putImageData(img,0,0);}
const STAGES=[['sky',()=>{frame.set(base);drawStars();}],['clouds',()=>{drawClouds();moonCheck();drawFlash();drawFalls();drawCabin();drawBirds();}],['lake',()=>{drawWater();drawGlitter();drawLake();drawMist();}],['shore',()=>{drawFg();drawFlies();drawOwl();}],['present',present]];
function draw(){for(const s of STAGES)s[1]();}

/* ---------- start ---------- */
setMood(WORLD.mood);
layout();
warming=true;for(let i=0;i<600;i++)update(1/20);warming=false;stats.rises=stats.birds=0;
flies=fliesTo=0;mist=mistTo=0;flash=null;
if(N.DEBUG)window.VH={WORLD,stats,nextEv,clouds,fire,draw,
  pause(){N.paused=true;},resume(){N.paused=false;},
  step(sec=1/30){update(sec);draw();N.refresh();},
  run(sec){for(let i=0;i<sec*30;i++)update(1/30);draw();N.refresh();},
  rebuild(){layout();draw();},
  profile(n=30){const o={};for(const[name,fn]of STAGES){const a=performance.now();for(let i=0;i<n;i++)fn();o[name]=+((performance.now()-a)/n).toFixed(2);}return o;},
  state:()=>({t:+t.toFixed(1),size:[W,H],pixel:S,mood:+moodNow.toFixed(2),wind:+wind.toFixed(2),moon:+mv.toFixed(2),clouds:clouds.length,rings:rings.length,flocks:flocks.length,ducks:ducks.length,gusts:gusts.length,canoe:!!canoe,owl:!!owl,flies:+flies.toFixed(2),mist:+mist.toFixed(2),lamp:cabin?lamp:null,falls:fallsPix.length>0,trees:vis.map(v=>v.length)})};
const SKY={streaks:'under long streaks of cloud',banks:'under heavy banks of cloud',open:'under an open sky'};
N.log(`Dusk settles on the lake ${SKY[WORLD.sky]}, the moon low between the peaks${cabin?', and a lamp is lit in the cabin on the far shore':''}`);
N.stats(stats);
N.run({step:1/30,update,draw,ui:()=>N.stats(stats)});
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{layout();draw();},150);});
})();
