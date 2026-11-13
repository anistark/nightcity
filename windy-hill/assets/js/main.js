/* Windy Hill: long grass on a hilltop under a tree, with a river below and Night City on the far bank.
   The grass is a few thousand tufts standing on the ground in rows, far to near. Each tuft is a small picture painted once,
   and every frame it is leaned over by the wind where it stands, in two or three slices so it bends in a curve.
   The wind is a field over the ground: slow swells and ripples carried along by the breeze, and now and then a gust front.
   Every choice in the world comes from the shared seeded generator in ../assets/js/nightcity.js. Painting draws from private streams,
   so the size of the window never changes what happens on the hill. */
(()=>{
'use strict';
const N=NightCity;
const{R,rr,ri,pick,chance,expo,wpick,noise}=N;
const cv=document.getElementById('scene'),ctx=cv.getContext('2d');
const QS=new URLSearchParams(location.search);

/* ---------- helpers ---------- */
const TAU=Math.PI*2,PI=Math.PI;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
const smooth=(a,b,x)=>{x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x);};
const mix=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];
const rgb=(c,l=1)=>`rgb(${clamp(c[0]*l,0,255)|0},${clamp(c[1]*l,0,255)|0},${clamp(c[2]*l,0,255)|0})`;
const rgba=(c,a)=>`rgba(${clamp(c[0],0,255)|0},${clamp(c[1],0,255)|0},${clamp(c[2],0,255)|0},${a})`;
const u32=()=>Math.floor(R()*4294967296);
function stream(s){s>>>=0;const r=N.sfc32(s,(s^0x9e3779b9)>>>0,Math.imul(s,2654435761)>>>0,(s+0x6d2b79f5)>>>0);for(let i=0;i<12;i++)r();return r;}
const SALT=u32();
function hash(a,b){let h=(Math.imul(a|0,374761393)+Math.imul(b|0,668265263)+SALT)|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296;}
function vn(x,y){const ix=Math.floor(x),iy=Math.floor(y),ax=x-ix,ay=y-iy,ux=ax*ax*(3-2*ax),uy=ay*ay*(3-2*ay);return lerp(lerp(hash(ix,iy),hash(ix+1,iy),ux),lerp(hash(ix,iy+1),hash(ix+1,iy+1),ux),uy);}
const layer=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c;};

/* ---------- the world, picked once ---------- */
const SEEDS={field:u32(),paint:u32(),tree:u32(),sky:u32(),water:u32()};
// The hour runs from 0, a bright afternoon, through 1, the golden hour, and 2, dusk, to 3, full night.
// On the owner's request the seed keeps to dusk and night. The earlier hours are still there for ?debug&hour.
let hour=rr(1.85,3);
const FACES=[[70,84,116],[84,80,120],[62,92,112],[92,84,104],[72,74,98]];
const WINS=[[[255,214,120],[255,186,90],[255,236,180]],[[130,232,224],[96,204,220],[210,255,246]],[[255,140,190],[255,104,166],[255,210,230]],[[232,240,255],[190,212,250],[255,250,226]]];
const NEONS=[[95,232,224],[255,95,168],[255,207,122],[170,120,255],[120,255,160]];
const WORLD={
  flip:chance(.5),dir:chance(.5)?1:-1,
  sunU:rr(.14,.42),moonU:rr(.07,.26),moonV:rr(.08,.22),moonCut:rr(.45,1.25),moonTilt:rr(-.7,.7),
  crest:[rr(0,TAU),rr(0,TAU),rr(0,TAU)],core:rr(.24,.44),ph:[rr(0,999),rr(0,999),rr(0,999)],
};
if(N.DEBUG){
  // ?debug&hour=2.5 forces the hour, from 0 to 3, and ?debug&flip or ?debug&noflip which side the tree stands on.
  if(QS.has('hour'))hour=clamp(parseFloat(QS.get('hour'))||0,0,3);
  if(QS.has('flip'))WORLD.flip=true;if(QS.has('noflip'))WORLD.flip=false;
}
// Night City, laid out once along a strip measured from the middle of downtown, so a wider window shows more of the same city.
const CITY=[];
{
  const x2=(chance(.5)?1:-1)*rr(.5,.95),k2=rr(.3,.7);
  const prof=x=>Math.exp(-((x/.4)**2))+k2*Math.exp(-(((x-x2)/.24)**2));
  [{h0:.03,rise:.2,w0:.016,w1:.036,gap:.012},{h0:.024,rise:.085,w0:.02,w1:.046,gap:.006},{h0:.012,rise:.03,w0:.026,w1:.062,gap:.004}].forEach((rw,row)=>{
    let x=-3.6+rr(0,.05);
    while(x<3.6){
      const w=rr(rw.w0,rw.w1),p=prof(x+w/2);
      const b={row,x,w,h:rw.h0*rr(.5,1.3)+rw.rise*p*(row?R():.3+.7*R()),alb:pick(FACES),win:wpick([[0,6],[1,2.4],[2,1.2],[3,1.2]]),lp:rr(.25,.8),
        set:null,spire:0,wedge:0,neon:null,bp:rr(1.2,2.6),bt:rr(0,2),seed:u32()};
      if(row===0&&p>.22){
        if(chance(.5))b.set={f:rr(.4,.72),h:rr(.012,.05),a:pick([0,.5,1])};
        if(chance(.5))b.spire=rr(.012,.05);else if(chance(.25))b.wedge=rr(.01,.03)*(chance(.5)?1:-1);
        if(chance(.42))b.neon={type:'crown',c:pick(NEONS)};else if(chance(.3))b.neon={type:'edge',c:pick(NEONS),len:rr(.3,.8)};
      }else if(row>0&&chance(.22))b.neon={type:'sign',c:pick(NEONS),u:rr(.2,.8),len:rr(.3,.7)};
      CITY.push(b);x+=w+(chance(.5)?rr(0,rw.gap):0);
    }
  });
}

/* ---------- light ---------- */
// Four hours of the day, and the light of each. Everything on the hill is a flat colour times the light that reaches it:
// amb is what the sky gives to every surface, key is what the sun or moon adds to the ones that face it.
const KEYS=[
  {top:[46,118,206],mid:[112,176,232],hor:[206,232,244],glow:[255,246,214],gk:.35,haze:[176,208,232],amb:[.5,.58,.74],key:[.56,.48,.3],cl:[255,255,255],star:0,win:.04,ink:[40,44,66]},
  {top:[52,98,176],mid:[150,160,206],hor:[255,206,142],glow:[255,176,96],gk:.9,haze:[226,186,160],amb:[.44,.46,.62],key:[.78,.5,.22],cl:[255,226,186],star:0,win:.35,ink:[48,36,60]},
  {top:[18,26,78],mid:[84,70,140],hor:[246,142,96],glow:[255,120,84],gk:.7,haze:[110,90,140],amb:[.26,.3,.5],key:[.4,.24,.22],cl:[240,150,120],star:.72,win:.85,ink:[20,18,44]},
  {top:[4,8,28],mid:[10,22,60],hor:[30,52,100],glow:[150,180,255],gk:.35,haze:[22,36,78],amb:[.11,.16,.32],key:[.17,.25,.4],cl:[56,74,124],star:1,win:1,ink:[6,8,22]}];
const L={};
{const i=Math.min(2,Math.floor(hour)),k=hour-i,a=KEYS[i],b=KEYS[i+1];for(const n in a)L[n]=typeof a[n]==='number'?lerp(a[n],b[n],k):mix(a[n],b[n],k);}
const lit=(c,k)=>[c[0]*(L.amb[0]+L.key[0]*k),c[1]*(L.amb[1]+L.key[1]*k),c[2]*(L.amb[2]+L.key[2]*k)];
const hz=(c,d)=>mix(c,L.haze,d);
const sunV=hour<1?lerp(-.2,.29,hour):lerp(.29,.53,Math.min(1,hour-1)),moonA=smooth(2.05,2.6,hour),moonD=smooth(1.95,2.2,hour);
const HOURS=['on a bright afternoon','at the golden hour','at dusk','at night'];
const GRASS=[{b:[38,92,50],t:[146,204,86]},{b:[64,108,46],t:[196,216,100]},{b:[98,104,50],t:[222,204,122]},{b:[40,96,56],t:[150,206,96]}];
const PALE=[236,244,176],PLUME=[246,234,200],FLOW=[[250,250,240],[250,214,90],[244,156,196]],BARK=[112,82,62];
const INK=rgb(L.ink);

/* ---------- state ---------- */
let W=1,H=1,U=1,K=1,Wi=1,T=0;
let yW=0,CR=new Float32Array(2),SLP=new Float32Array(2);
let skyL,farL,groundL,treeL,treeDX=0,gTopD=0,glowS;
let SUN,MOON,GL,TR;
let rows=[],glints=[],pool=[],beacons=[],clumps=[],sprigs=[],twinkles=[],leafS=[],sprigS=null;
const atl=new Map();
const stats={gusts:0,leaves:0,events:0};
const log=s=>{stats.events++;N.log(s);};

/* ---------- wind ---------- */
// The ground is measured in X across and z away from us. Swells and ripples are noise carried along the wind,
// a little across the rows, so their bands lie at a slant over the hill. adv is how far the breeze has carried them.
let dirU=WORLD.dir,brz=.6,adv=0;
const E={lull:null,turn:null};
const fronts=[];
const ev=e=>e?smooth(0,e.up,e.age)*(1-smooth(e.dur-e.down,e.dur,e.age)):0;
function windAt(X,z){
  const s=X*dirU+z*.35,c=z-X*dirU*.35;
  let a=vn((s-adv)/6,c/10);a=a*a*(3-2*a);
  let w=brz*(.3+1.05*a+.3*vn((s-adv*1.2)/2.6+17.3,c/3.6+5.1));
  // A gust front has a sharp leading edge and a long tail.
  for(let i=0;i<fronts.length;i++){const f=fronts[i];let d=(s-f.p)/f.wd;d*=d>0?1.9:.7;if(d>-2.6&&d<2.6)w+=f.amp*Math.exp(-d*d)*(.7+.3*vn(c*.7+f.o,s*.4));}
  return w;
}
function drift(dt){
  const tu=E.turn?Math.abs(1-2*smooth(0,1,E.turn.age/E.turn.dur)):1;
  if(E.turn&&!E.turn.done&&E.turn.age>=E.turn.dur/2){E.turn.done=true;dirU=-dirU;}
  brz=(.4+.55*noise(T/21+WORLD.ph[0]))*(1-.82*ev(E.lull))*tu;
  adv+=dt*(.5+2.3*brz);
}

/* ---------- the ground ---------- */
// The hilltop runs from z = ZN, at our feet, to z = ZF, where it drops away. Long grass is GH of U tall at z = 1.
const ZF=13,ZN=.62,GH=.3,ROWK=.89,SLC=[null,[1],[.65,1.35],[.5,1,1.5]];
const mapY=(x,z)=>{const yb=H*1.07,yc=CR[clamp(x|0,0,Wi-1)],A=(yb-yc)*ZF/(ZF-1);return yb-A+A/z;};

/* ---------- painting: sky ---------- */
function buildSky(){
  skyL=layer(cv.width,cv.height);const g=skyL.getContext('2d'),p=stream(SEEDS.sky);g.setTransform(K,0,0,K,0,0);
  const gr=g.createLinearGradient(0,0,0,yW+.02*H);gr.addColorStop(0,rgb(L.top));gr.addColorStop(.55,rgb(L.mid));gr.addColorStop(1,rgb(L.hor));
  g.fillStyle=gr;g.fillRect(0,0,W,H);
  // Light pooling above the city once its windows are on.
  if(L.win>.3){
    const cx=WORLD.core*W,rg=g.createRadialGradient(cx,yW,0,cx,yW,.6*U);
    rg.addColorStop(0,rgba([90,130,230],.3*(L.win-.3)));rg.addColorStop(.5,rgba([150,90,210],.1*(L.win-.3)));rg.addColorStop(1,'rgba(90,130,230,0)');
    g.fillStyle=rg;g.fillRect(0,0,W,yW+2);
  }
  const R0=.9*Math.max(W,H),rg=g.createRadialGradient(GL.x,GL.y,0,GL.x,GL.y,R0);
  rg.addColorStop(0,rgba(L.glow,.85*L.gk));rg.addColorStop(.18,rgba(L.glow,.42*L.gk));rg.addColorStop(.5,rgba(L.glow,.1*L.gk));rg.addColorStop(1,rgba(L.glow,0));
  g.fillStyle=rg;g.fillRect(0,0,W,H);
  // Stars: a field of small ones, a slanting band of fainter ones, and a few bright ones with a glint. None show through the moon.
  twinkles=[];
  if(L.star>.02){
    const clear=(x,y)=>moonD<.05||Math.hypot(x-MOON.x,y-MOON.y)>MOON.r*1.12,fade=y=>1-.8*smooth(.5,1,y/yW);
    const dot=(x,y,r,a,warm)=>{g.fillStyle=rgba(warm?[255,226,196]:[226,236,255],a);g.beginPath();g.arc(x,y,r,0,TAU);g.fill();};
    for(let i=Math.round(W*H/1500);i>0;i--){const x=p()*W,y=p()*yW,q=p(),a=p(),w=p();if(clear(x,y))dot(x,y,.5+q*q*1.1,L.star*(.3+.7*a*a)*fade(y),w<.2);}
    const y0=(.08+.5*p())*yW,y1=(.08+.5*p())*yW;
    for(let i=Math.round(W*H/1300);i>0;i--){const t=p(),x=lerp(-.05*W,1.05*W,t)+(p()-.5)*.1*U,y=lerp(y0,y1,t)+(p()+p()+p()-1.5)*.15*U,a=p();if(y>0&&y<yW&&clear(x,y))dot(x,y,.4+p()*.5,L.star*(.14+.36*a)*fade(y),false);}
    for(let i=N.LOWQ?14:26;i>0;i--){
      const x=p()*W,y=p()*yW*.82,r=1+p()*.9,a=L.star*(.7+.3*p())*fade(y),w=p()<.25;if(!clear(x,y))continue;
      const hg=g.createRadialGradient(x,y,0,x,y,r*5);hg.addColorStop(0,rgba([200,220,255],.3*a));hg.addColorStop(1,'rgba(200,220,255,0)');g.fillStyle=hg;g.fillRect(x-r*5,y-r*5,r*10,r*10);
      dot(x,y,r,a,w);g.fillStyle=rgba([236,242,255],.5*a);g.fillRect(x-r*3.5,y-.3,r*7,.6);g.fillRect(x-.3,y-r*3.5,.6,r*7);
    }
    for(let i=0;i<28;i++){const x=p()*W,y=p()*yW*.75;if(clear(x,y))twinkles.push({x,y,ph:p()*TAU,f:1.2+3*p(),r:1+1.2*p()});}
  }
  if(moonA<.98){
    const r=.027*U,dg=g.createRadialGradient(SUN.x,SUN.y,r*.7,SUN.x,SUN.y,r*3.2);
    dg.addColorStop(0,rgba([255,240,206],.75*(1-moonA)));dg.addColorStop(1,'rgba(255,240,206,0)');g.fillStyle=dg;g.fillRect(SUN.x-r*4,SUN.y-r*4,r*8,r*8);
    g.globalAlpha=1-moonA;g.fillStyle='rgb(255,248,226)';g.beginPath();g.arc(SUN.x,SUN.y,r,0,TAU);g.fill();g.globalAlpha=1;
  }
  // The moon is in the sky soon after dusk, well before its light takes over from the afterglow.
  // It is worked out pixel by pixel as a sphere lit from where the sun went down: a soft edge between day and night, faint seas,
  // and no pixels at all on the dark side, so the sky is all that shows there.
  if(moonD>.02){
    const m=MOON,f=lerp(.2,.86,clamp((WORLD.moonCut-.45)/.8,0,1)),cp=2*f-1,sp=Math.sqrt(1-cp*cp),a=Math.atan2(SUN.y-m.y,SUN.x-m.x)+WORLD.moonTilt*.35,ca=Math.cos(a),sa=Math.sin(a);
    // Its glow is centred on the lit limb and falls away smoothly from there, with no edge at the rim of the disc.
    const hx=m.x+ca*m.r*.45,hy=m.y+sa*m.r*.45,hg=g.createRadialGradient(hx,hy,0,hx,hy,m.r*6);
    hg.addColorStop(0,rgba([190,208,255],.2*moonD));hg.addColorStop(.16,rgba([190,208,255],.11*moonD));hg.addColorStop(.45,rgba([190,208,255],.035*moonD));hg.addColorStop(1,'rgba(190,208,255,0)');
    g.fillStyle=hg;g.fillRect(hx-m.r*6,hy-m.r*6,m.r*12,m.r*12);
    const Rp=Math.max(4,Math.round(m.r*K)),sz=Rp*2+4,mc=layer(sz,sz),c=mc.getContext('2d'),im=c.createImageData(sz,sz),d=im.data,o1=p()*50,o2=p()*50;
    for(let py=0;py<sz;py++)for(let px=0;px<sz;px++){
      const x=(px+.5-sz/2)/Rp,y=(py+.5-sz/2)/Rp,q=x*x+y*y;if(q>=1.03)continue;
      const z=Math.sqrt(Math.max(0,1-q)),i=(x*ca+y*sa)*sp+z*cp,al=smooth(-.02,.16,i)*(1-smooth(1-2.5/Rp,1,Math.sqrt(q)));if(al<=0)continue;
      const b=(.84+.16*smooth(0,.6,i))*(1-.2*smooth(.42,.68,vn(x*2.1+o1,y*2.1+o2))-.07*vn(x*6+o2,y*6+o1)),k=(py*sz+px)*4;
      d[k]=246*b;d[k+1]=243*b;d[k+2]=230*b;d[k+3]=255*al;
    }
    c.putImageData(im,0,0);
    g.globalAlpha=moonD;g.drawImage(mc,m.x-sz/(2*K),m.y-sz/(2*K),sz/K,sz/K);g.globalAlpha=1;
  }
}

/* ---------- painting: the city, the far bank and the river ---------- */
const HZK=[.74,.6,.46];
let WINC=[],GLC=[],FHd=1;
function paintB(c,b,x,w,base){
  const p=stream(b.seed),top=base-b.h*U,hk=HZK[b.row],f0=rgb(hz(lit(b.alb,.18),hk)),f1=rgb(hz(lit(b.alb,.92),hk));
  let tx=x,tw=w,ty=top;
  c.fillStyle=f0;c.fillRect(x,top,w,base-top+1);
  if(b.set){tw=w*b.set.f;tx=x+(w-tw)*b.set.a;ty=top-b.set.h*U;c.fillRect(tx,ty,tw,top-ty+1);}
  if(b.wedge){c.beginPath();c.moveTo(tx,ty+.5);c.lineTo(b.wedge>0?tx:tx+tw,ty-Math.abs(b.wedge)*U);c.lineTo(tx+tw,ty+.5);c.fill();}
  // The side that faces the light.
  c.fillStyle=f1;c.fillRect(x,top,Math.max(1,w*.22),base-top);if(b.set)c.fillRect(tx,ty,Math.max(1,tw*.22),top-ty);
  const cell=Math.max(2.6,.0046*U),cols=Math.floor((w-cell*.3)/cell),nr=Math.floor((base-top-cell*.6)/cell),ox=x+(w-cols*cell)/2,s=cell*.52,wk=lerp(.07,1,L.win);
  const glass=rgba(hz(lit([30,40,70],.1),hk),.3*(1-L.win));
  for(let r=0;r<nr;r++){
    const band=p()<.5;
    for(let q=0;q<cols;q++){
      const u=p(),v=p(),o=p(),wx=ox+q*cell+(cell-s)/2,wy=top+cell*.5+r*cell;
      if(u<b.lp*wk*(band?1.25:.7)){
        // A few windows are left out of the picture and drawn each frame, so they can go on and off.
        if(o<.05&&pool.length<(N.LOWQ?90:220))pool.push({x:wx,y:wy,s,c:b.win*3+(v*3|0),on:true});
        else{c.fillStyle=rgb(mix(mix(WINS[b.win][v*3|0],[255,252,236],.6*(1-L.win)),L.haze,.1+.12*(2-b.row)));c.fillRect(wx,wy,s,s);}
      }else if(L.win<.7){c.fillStyle=glass;c.fillRect(wx,wy,s,s);}
    }
  }
  if(b.spire){
    const sx=tx+tw/2,sh=b.spire*U;c.fillStyle=f0;c.fillRect(sx-.6,ty-sh,1.2,sh);
    if(b.row===0)beacons.push({x:sx,y:ty-sh,t:b.bt,p:b.bp,on:false});
  }
  if(b.neon&&L.win>.12){
    const n=b.neon,lw=Math.max(1.2,.0022*U);
    c.fillStyle=rgb(mix(hz(lit(b.alb,.5),hk),n.c,L.win));c.shadowColor=rgba(n.c,L.win);c.shadowBlur=5*K;
    if(n.type==='crown')c.fillRect(tx,ty,tw,lw);
    else if(n.type==='edge')c.fillRect(x+w-lw,top+2,lw,(base-top)*n.len);
    else c.fillRect(x+w*n.u,top+3,lw*1.4,(base-top-4)*n.len);
    c.shadowBlur=0;
  }
}
function buildFar(){
  FHd=Math.ceil(.71*H*K);farL=layer(cv.width,FHd);
  const g=farL.getContext('2d'),cityC=layer(cv.width,Math.ceil(yW*K)),c=cityC.getContext('2d'),p=stream(SEEDS.water);
  g.setTransform(K,0,0,K,0,0);c.setTransform(K,0,0,K,0,0);
  pool=[];beacons=[];
  const coreX=WORLD.core*W,base=yW-.013*H;
  for(const b of CITY){const x=coreX+b.x*U,w=b.w*U;if(x+w>-2&&x<W+2)paintB(c,b,x,w,base);}
  pool.sort((a,b)=>a.c-b.c);
  WINC=[];for(const set of WINS)for(const col of set)WINC.push(rgb(mix(col,[255,252,236],.6*(1-L.win))));
  // Mist at the foot of the towers.
  let gr=c.createLinearGradient(0,base-.075*H,0,base);gr.addColorStop(0,rgba(L.haze,0));gr.addColorStop(1,rgba(L.haze,.62));
  c.globalCompositeOperation='source-atop';c.fillStyle=gr;c.fillRect(0,base-.075*H,W,.075*H+2);c.globalCompositeOperation='source-over';
  // The far bank: a line of trees, then the embankment and its lamps.
  c.fillStyle=rgb(hz(lit([44,86,62],.22),.52));c.beginPath();c.moveTo(-2,yW);
  for(let x=-2;x<=W+2;x+=2)c.lineTo(x,base-U*(.004+.011*vn(x/(.016*U),3.1)+.012*vn(x/(.07*U)+40,9.7)));
  c.lineTo(W+2,yW);c.closePath();c.fill();
  c.fillStyle=rgb(hz(lit([176,170,164],.6),.45));c.fillRect(0,yW-.0045*H,W,.0045*H);
  if(L.win>.25)for(let x=(coreX%(.04*U))-.04*U;x<W;x+=.04*U){c.fillStyle=rgba([255,220,160],L.win);c.fillRect(x,yW-.0075*H,Math.max(1.2,.002*U),Math.max(1.2,.002*U));}
  // The river carries the sky, then the city upside down, drawn three times at different lengths so its lights run into streaks.
  gr=g.createLinearGradient(0,yW,0,.71*H);
  const w0=mix(L.hor,lit([60,104,140],.5),.3),w1=mix(mix(L.mid,L.top,.35),lit([30,64,104],.35),.5);
  gr.addColorStop(0,rgb(w0));gr.addColorStop(.45,rgb(mix(w0,w1,.6)));gr.addColorStop(1,rgb(w1));
  g.fillStyle=gr;g.fillRect(0,yW-1,W,.71*H-yW+2);
  for(const k of[.5,.62,.76]){g.save();g.translate(0,yW);g.scale(1,-k);g.globalAlpha=.24;g.drawImage(cityC,0,-yW,W,yW);g.restore();}
  // The glitter path under the sun or the moon.
  g.save();g.translate(GL.x,yW);g.scale(1,2.6);
  const rg=g.createRadialGradient(0,0,0,0,0,.13*U);rg.addColorStop(0,rgba(L.glow,.6*L.gk));rg.addColorStop(1,rgba(L.glow,0));
  g.fillStyle=rg;g.fillRect(-.14*U,0,.28*U,.14*U);g.restore();
  // Long quiet ripples.
  for(let i=Math.round(W*.5);i>0;i--){
    const v=p(),y=yW+2+v*(.27*H),len=U*(.006+.05*v)*(.4+p());
    g.fillStyle=p()<.5?rgba(L.cl,.05+.07*p()):rgba(L.top,.06+.08*p());g.fillRect(p()*W-len/2,y,len,Math.max(.6,.0012*U*(.5+v)));
  }
  gr=g.createLinearGradient(0,yW,0,yW+.03*H);gr.addColorStop(0,rgba(hz(lit([30,60,50],.1),.4),.5));gr.addColorStop(1,rgba(L.top,0));g.fillStyle=gr;g.fillRect(0,yW,W,.03*H);
  g.drawImage(cityC,0,0,W,yW);
  // Glints on the water: the sun or moon's path, the lights of the city, and the sky.
  glints=[];GLC=[rgb(mix(L.cl,[255,255,255],.3)),rgb(mix(L.glow,[255,255,255],.35))];for(const n of[[255,214,120],[120,232,224],[255,130,186]])GLC.push(rgb(n));
  for(let i=N.LOWQ?130:300;i>0;i--){
    const x=p()*W,v=p(),y=yW+3+v*v*.25*H+v*.02*H,xi=clamp(x|0,0,Wi-1);
    if(y>Math.min(CR[xi],SLP[xi])-1)continue;
    const d=Math.abs(x-GL.x)/(U*(.02+.2*v));
    const cidx=d<1&&p()<.8?1:L.win>.3&&v<.6&&p()<.45*L.win?2+(p()*3|0):0;
    glints.push({x,y,l:U*(.004+.022*v)*(.5+p()),h:Math.max(.8,.0016*U*(.6+v)),ph:p()*TAU,f:.7+2.2*p(),a:cidx===1?.95*L.gk+.2:cidx?.7:.2+.4*p(),c:cidx});
  }
  glints.sort((a,b)=>a.c-b.c);
}

/* ---------- painting: the ground under the grass ---------- */
function buildGround(){
  let top=1e9;for(let i=0;i<Wi;i++)top=Math.min(top,CR[i],SLP[i]);
  gTopD=Math.max(0,Math.floor((top-4)*K));groundL=layer(cv.width,cv.height-gTopD);
  const g=groundL.getContext('2d'),p=stream(SEEDS.paint+3);g.setTransform(K,0,0,K,0,-gTopD);
  const edge=A=>{g.beginPath();g.moveTo(-2,H+2);for(let i=0;i<Wi;i++)g.lineTo(i,A[i]);g.lineTo(W+2,A[Wi-1]);g.lineTo(W+2,H+2);g.closePath();};
  // The lower slope, down by the water.
  let gr=g.createLinearGradient(0,.6*H,0,.76*H);gr.addColorStop(0,rgb(hz(lit(GRASS[1].t,.62),.5)));gr.addColorStop(1,rgb(hz(lit(GRASS[0].t,.42),.4)));
  edge(SLP);g.fillStyle=gr;g.fill();
  for(let i=Math.round(W*.5);i>0;i--){
    const x=p()*W*.5,xi=clamp(x|0,0,Wi-1),y=lerp(SLP[xi],CR[xi],p());if(y<SLP[xi]+1)continue;
    g.fillStyle=p()<.5?rgba(hz(lit(PALE,.9),.45),.1+.14*p()):rgba(hz(lit(GRASS[0].b,.2),.4),.12+.16*p());g.fillRect(x,y,U*(.008+.03*p()),Math.max(1,.002*U));
  }
  g.strokeStyle=rgba(hz(lit([222,210,160],.85),.42),.7);g.lineWidth=Math.max(1,.0026*U);g.beginPath();for(let i=0;i<Wi;i+=2)g.lineTo(i,SLP[i]+.5);g.stroke();
  for(let i=7;i>0;i--){
    const x=p()*W*.44,xi=clamp(x|0,0,Wi-1),y=SLP[xi]+U*(.004+.02*p()),r=U*(.008+.012*p());if(y>CR[xi]-r)continue;
    g.fillStyle=rgb(hz(lit([34,82,56],.15),.4));for(let j=0;j<4;j++){g.beginPath();g.arc(x+(j-1.5)*r*.7,y-r*(.5+.4*p()),r*(.7+.4*p()),0,TAU);g.fill();}
    g.fillStyle=rgb(hz(lit([70,132,70],.8),.4));for(let j=0;j<3;j++){g.beginPath();g.arc(x+(j-1.6)*r*.7,y-r*(.8+.4*p()),r*.5,0,TAU);g.fill();}
  }
  // The hilltop. Its far end is close to the colour of the grass that stands on it, so no gap shows between the tufts.
  gr=g.createLinearGradient(0,.55*H,0,H);
  gr.addColorStop(0,rgb(hz(lit(mix(GRASS[0].b,GRASS[0].t,.55),.5),.3)));gr.addColorStop(.4,rgb(hz(lit(mix(GRASS[0].b,GRASS[0].t,.3),.3),.1)));gr.addColorStop(1,rgb(lit(GRASS[0].b,.06)));
  edge(CR);g.fillStyle=gr;g.fill();g.save();g.clip();
  for(let i=Math.round(W*.7);i>0;i--){
    const x=p()*W,t=p(),xi=clamp(x|0,0,Wi-1),y=lerp(CR[xi],H,Math.pow(t,1.6)),s=U*(.008+.05*t);
    g.fillStyle=p()<.5?rgba(hz(lit(GRASS[1].t,.7),.25*(1-t)),.1+.1*p()):rgba(lit(GRASS[0].b,.1),.12+.14*p());g.beginPath();g.ellipse(x,y,s*2.4,s*.5,0,0,TAU);g.fill();
  }
  g.restore();
}

/* ---------- painting: tufts of grass ---------- */
// A tuft is a handful of blades from one root. Kinds: 0 lush, 1 yellow-green, 2 dry with plumes, 3 with flowers.
// wide is how far the blades spread from the root: far rows use broad clumps, so fewer of them cover the ground.
function tuftGeo(p,kind,wide){
  const n=Math.round((kind===3?5:6.5)*(1+wide*2.2)+p()*3),sp=.3+wide*.72,far=wide>.5,bl=[];
  for(let i=0;i<n;i++){
    const u=(i+.5)/n*2-1+(p()-.5)*.35;
    bl.push({x:u*sp,lean:u*.16+(p()-.5)*.2,hh:(.5+.5*p())*(1-.22*u*u)*(far?.9:1),w:(far?.05:.026)+.028*p(),t:p(),c:(p()-.5)*.12,head:kind===2&&p()<.45?1:kind===3&&p()<.7?2:0,fc:p()});
  }
  bl.sort((a,b)=>b.hh-a.hh);
  return bl;
}
// l = 0 paints the tuft as it stands and l = 1 the same tuft with the light full on it, as it looks where the wind turns the blades over.
function paintTuft(g,cx,by,h,geo,kind,l,row){
  const G=GRASS[kind],tn=(c,k)=>hz(lit(c,k*row.shade),row.hz);
  const b0=tn(G.b,lerp(.16,.5,l)),t0=tn(mix(G.t,PALE,.45*l),lerp(.82,1.3,l));
  for(const b of geo){
    const x0=cx+b.x*h,hh=b.hh*h,tx=x0+b.lean*hh,ty=by-hh,w=Math.max(.7,b.w*h),mx=x0+b.lean*hh*.3+b.c*h,my=by-hh*.55,v=.82+.36*b.t;
    const gr=g.createLinearGradient(0,by,0,ty);gr.addColorStop(0,rgb(b0,v));gr.addColorStop(.5,rgb(mix(b0,t0,.6),v));gr.addColorStop(1,rgb(t0,v));
    g.fillStyle=gr;g.beginPath();g.moveTo(x0-w,by);g.quadraticCurveTo(mx-w*.6,my,tx,ty);g.quadraticCurveTo(mx+w*.6,my,x0+w,by);g.fill();
    if(b.head===1){
      g.save();g.translate(tx,ty);g.rotate(Math.atan(b.lean*1.3));g.fillStyle=rgb(tn(PLUME,lerp(.85,1.25,l)));
      for(const a of[-.17,0,.17]){g.save();g.rotate(a);g.beginPath();g.ellipse(0,-.08*h,.014*h,.095*h,0,0,TAU);g.fill();g.restore();}
      g.restore();
    }else if(b.head===2){
      const r=Math.max(1,.05*h);g.fillStyle=rgb(tn(FLOW[b.fc*3|0],lerp(1,1.2,l)));g.beginPath();g.arc(tx,ty,r,0,TAU);g.fill();
      g.fillStyle=rgb(tn([230,170,60],1));g.beginPath();g.arc(tx,ty,r*.4,0,TAU);g.fill();
    }
  }
}
// One picture holds every variant of a tuft at one size, side by side, in rows from unlit to fully lit.
// Most tufts get five rows and show the nearest one. The largest get two, and the lit one is drawn over the other, so they change without a step.
function makeAtlas(hb,row){
  hb=Math.max(5,hb);
  const V=hb<50?10:hb<110?7:5,NL=row.n<3?5:2,cw=Math.ceil(hb*(1.15+row.wide*1.6))+2,ch=Math.ceil((hb*1.14+2)/6)*6,im=layer(cw*V,ch*NL),g=im.getContext('2d'),p=stream(SEEDS.paint+(hb*7|0)+(row.far?99:0));
  const kinds=[[],[],[],[]];
  for(let v=0;v<V;v++){
    // Plumes are for the middle distance. Up close they would hide the view.
    const kind=row.far?(v%5===4?3:v%3===2?1:0):hb>150?(v<V*.6?0:v<V*.85?1:3):v<V*.5?0:v<V*.7?1:v<V*.88?2:3,geo=tuftGeo(p,kind,row.wide);
    kinds[kind].push(v);
    for(let l=0;l<NL;l++)paintTuft(g,v*cw+cw/2,l*ch+ch-1,hb,geo,kind,l/(NL-1),row);
  }
  // Roots fade out, so a tuft with nothing standing in front of it does not end in a straight line.
  g.globalCompositeOperation='destination-out';
  for(let l=0;l<NL;l++){const y=l*ch+ch,gr=g.createLinearGradient(0,y-hb*.16,0,y);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,1)');g.fillStyle=gr;g.fillRect(0,y-hb*.16,cw*V,hb*.16);}
  return{img:im,cw,ch,hb,kinds,NL};
}
function atlasFor(row){
  const hd=row.h*K*1.2,idx=Math.round(Math.log(hd)/Math.log(1.3));
  row.n=hd<80?1:hd<300?2:3;
  const key=(row.far?'f':row.shade<1?'s':row.wide?'w':'m')+idx+'n'+row.n;
  let a=atl.get(key);
  if(!a){a=makeAtlas(Math.min(row.n<3?200:256,Math.pow(1.3,idx+.5)),row);atl.set(key,a);}
  return a;
}
function buildField(){
  const p=stream(SEEDS.field),DQ=N.LOWQ?.62:1;
  rows=[];atl.clear();
  const tuft=(row,x,y,z,size)=>{
    const a=row.a,X=(x-W/2)/U*z,q=vn(X*.33+3.7,z*.33+8.1)+(p()-.5)*.3,want=p()<.07?3:q<.52?0:q<.68?1:2;
    let ks=a.kinds[want];if(!ks.length)ks=a.kinds[0];
    const dh=row.h*size*a.ch/a.hb;
    row.tufts.push({x,y,X,dh,dw:dh*a.cw/a.ch,v:ks[p()*ks.length|0],fx:.75+.5*p(),om:1.6+2*p(),ph:p()*TAU,sk:.55+.45*p(),dz:p()});
  };
  // The lower slope: small tufts, far off, from its edge by the water to where the hilltop hides it.
  const band=.085*H;
  for(let v=.03;v<1;){
    const h=U*(.012+.009*v),row={z:40/(1+v),h,far:true,wide:1,tufts:[],hz:.44-.08*v,shade:1};row.a=atlasFor(row);
    for(let x=-h;x<W*.5+h;x+=h*1.5/DQ*(.7+.6*p())){const xi=clamp(x|0,0,Wi-1),y=SLP[xi]+v*band+(p()-.5)*h*.3;if(y<CR[xi]-h*.1)tuft(row,x,y,row.z,.8+.4*p());}
    if(row.tufts.length)rows.push(row);v+=h*.55/band;
  }
  // The hilltop, far to near. The nearest rows stand in the shade of the tree.
  for(let z=ZF;z>ZN;z*=ROWK){
    const h=GH*U/z,row={z,h,far:false,wide:z>5?.45:0,tufts:[],hz:.3*smooth(1.5,ZF,z),shade:z<1.3?.55:1};row.a=atlasFor(row);
    const sp=h*(z<1.6?.44:row.wide?.5:.3)/DQ;
    for(let x=-h*.6+p()*sp;x<W+h*.6;x+=sp*(.6+.8*p())){
      const y=mapY(x,z)+(p()-.5)*h*.12;
      tuft(row,x,y,z,.78+.42*p());
    }
    rows.push(row);
  }
}

/* ---------- painting: the tree ---------- */
function buildTree(){
  const p=stream(SEEDS.tree),tw=Math.min(W,1.3*U),twd=Math.ceil(tw*K);
  treeL=layer(twd,cv.height);treeDX=cv.width-twd;
  const g=treeL.getContext('2d');g.setTransform(K,0,0,K,-treeDX,0);
  const by=TR.y+.02*U,cx=s=>TR.x-U*(.03*s+.035*s*s),hw=s=>U*(.056+.06*Math.exp(-s/.05)-.012*s);
  const dark=rgb(lit(BARK,.05)),mid=rgb(lit(BARK,.4)),light=rgb(lit(BARK,1.05));
  // A bough is a tapering ribbon along a curve.
  const bough=(s0,ex,ey,w0)=>{
    const x0=cx(s0),y0=by-s0*U,qx=lerp(x0,ex,.35),qy=Math.min(y0,ey)-.07*U,Lp=[],Rp=[];
    for(let i=0;i<=24;i++){
      const t=i/24,a=(1-t)*(1-t),b=2*t*(1-t),c=t*t,x=a*x0+b*qx+c*ex,y=a*y0+b*qy+c*ey,dx=2*(1-t)*(qx-x0)+2*t*(ex-qx),dy=2*(1-t)*(qy-y0)+2*t*(ey-qy),d=Math.hypot(dx,dy)||1,w=w0*(1-.78*t);
      Lp.push([x-dy/d*w,y+dx/d*w]);Rp.push([x+dy/d*w,y-dx/d*w]);
    }
    g.fillStyle=mid;g.strokeStyle=INK;g.lineWidth=.004*U;g.beginPath();for(const q of Lp)g.lineTo(q[0],q[1]);for(let i=24;i>=0;i--)g.lineTo(Rp[i][0],Rp[i][1]);g.closePath();g.fill();g.stroke();
    g.fillStyle=dark;g.beginPath();for(const q of Lp)g.lineTo(q[0],q[1]);for(let i=24;i>=0;i--)g.lineTo(lerp(Lp[i][0],Rp[i][0],.45),lerp(Lp[i][1],Rp[i][1],.45));g.closePath();g.fill();
  };
  bough(.5,TR.x-.62*U,-.03*U,.03*U);bough(.66,TR.x-.3*U,-.06*U,.026*U);bough(.56,TR.x+.3*U,.02*U,.024*U);
  const Ys=[],Lx=[],Rx=[];
  for(let i=0;i<=70;i++){const y=by-(by+.06*U)*i/70,s=(by-y)/U;Ys.push(y);Lx.push(cx(s)-hw(s)*(1+.05*Math.sin(s*23+1)));Rx.push(cx(s)+hw(s)*(1+.05*Math.sin(s*17)));}
  const shape=(f0,f1)=>{g.beginPath();for(let i=0;i<=70;i++)g.lineTo(lerp(Lx[i],Rx[i],f0(i)),Ys[i]);for(let i=70;i>=0;i--)g.lineTo(lerp(Lx[i],Rx[i],f1(i)),Ys[i]);g.closePath();};
  shape(()=>0,()=>1);g.fillStyle=mid;g.fill();
  // Cel shading: a dark side away from the light and a bright edge toward it, both with a ragged boundary.
  shape(i=>.56+.1*Math.sin(i*.9)+.06*Math.sin(i*2.3),()=>1);g.fillStyle=dark;g.fill();
  shape(()=>0,i=>.2+.07*Math.sin(i*1.3+2)+.04*Math.sin(i*3.1));g.fillStyle=light;g.fill();
  for(let i=150;i>0;i--){
    const s=p()*(by+.05*U)/U,q=p()*2-1,len=U*(.015+.045*p()),x=cx(s)+q*hw(s)*.86,y=by-s*U,x1=cx(s+len/U)+q*hw(s+len/U)*.86;
    g.strokeStyle=q<-.55?rgba(lit(BARK,.5),.55):q>.2?rgba(lit(BARK,.3),.35):rgba(lit(BARK,.02),.45);g.lineWidth=U*.0028*(1+p());g.beginPath();g.moveTo(x,y);g.lineTo(x1,y-len);g.stroke();
  }
  g.strokeStyle=INK;g.lineWidth=.0045*U;g.lineJoin='round';
  g.beginPath();for(let i=0;i<=70;i++)g.lineTo(Lx[i],Ys[i]);g.stroke();g.beginPath();for(let i=0;i<=70;i++)g.lineTo(Rx[i],Ys[i]);g.stroke();
  // Leaves: clumps in three depths, each painted once and moved by the wind.
  const r=.085*U,sz=Math.ceil(r*2.5*K),LC=[rgb(lit([22,58,44],.06)),rgb(lit([40,98,54],.3)),rgb(lit([92,156,64],.78)),rgb(lit([182,218,104],1.2))];
  const leaf=(c,x,y,ang,ll)=>{const dx=Math.cos(ang),dy=Math.sin(ang),w=ll*.22;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+dx*ll*.5-dy*w,y+dy*ll*.5+dx*w,x+dx*ll,y+dy*ll);c.quadraticCurveTo(x+dx*ll*.5+dy*w,y+dy*ll*.5-dx*w,x,y);c.fill();};
  leafS=[];
  for(let tone=0;tone<3;tone++)for(let v=0;v<4;v++){
    const im=layer(sz,sz),c=im.getContext('2d'),ls=[];c.setTransform(K,0,0,K,sz/2,sz/2);
    for(let i=0;i<42;i++){const a=p()*TAU,d=r*.95*Math.sqrt(p());ls.push({x:Math.cos(a)*d,y:Math.sin(a)*d,ang:Math.atan2(Math.sin(a)*.6+.55,Math.cos(a)*.6)+(p()-.5)*.9,ll:r*(.34+.3*p()),k:p()});}
    ls.sort((A,B)=>A.k-B.k);
    for(const lf of ls){c.fillStyle=LC[tone===0?(lf.k<.6?0:1):tone===1?(lf.k<.45?0:lf.k<.85?1:2):(lf.k<.3?1:lf.k<.82?2:3)];leaf(c,lf.x,lf.y,lf.ang,lf.ll);}
    leafS.push(im);
  }
  const sw=.07*U,sh=.17*U;sprigS=layer(sw*K,sh*K);
  {const c=sprigS.getContext('2d');c.setTransform(K,0,0,K,sw*K/2,0);c.strokeStyle=dark;c.lineWidth=.003*U;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(.006*U,sh*.5,0,sh*.82);c.stroke();
    for(let i=0;i<9;i++){const y=sh*(.08+.09*i),s=i%2?1:-1;c.fillStyle=LC[i%3===0?3:i%3===1?2:1];leaf(c,0,y,PI/2+s*(.9-.04*i),.03*U);}c.fillStyle=LC[2];leaf(c,0,sh*.82,PI/2,.03*U);}
  // The canopy hangs deepest by the trunk and thins out along the bough.
  clumps=[];sprigs=[];
  const tx0=TR.x-.05*U,dmax=Math.min(1.12,W*.86/U),cnt=Math.round((N.LOWQ?64:104)*(.5+.5*dmax/1.12)),D=d=>.25-.17*smooth(0,dmax,d);
  for(let i=0;i<cnt;i++){
    const tone=i<cnt*.36?0:i<cnt*.72?1:2,d=-.32+(dmax+.32)*Math.pow(p(),1.2),k=p();
    clumps.push({x:tx0-d*U,y:U*(-.06+(tone===2?.2+.8*k:k)*(D(d)+.02)),img:leafS[tone*4+(p()*4|0)],amp:.3+.7*smooth(0,dmax,d)+.3*k,ph:p()*TAU,om:1.1+1.7*p(),s:(.82+.5*p())*r*1.25});
  }
  for(let i=N.LOWQ?6:11;i>0;i--){const d=-.2+(dmax+.1)*p();sprigs.push({x:tx0-d*U,y:U*(D(d)*(.72+.3*p())),ph:p()*TAU,om:1.3+1.4*p(),l:.6+.6*p()});}
}

/* ---------- layout ---------- */
function layout(){
  W=Math.max(1,innerWidth);H=Math.max(1,innerHeight);U=Math.min(H,W*1.2);Wi=Math.ceil(W)+1;
  // The canvas holds at most about 2.8 megapixels. The painted look holds up well below full Retina.
  K=Math.min(Math.min(N.LOWQ?1:2,devicePixelRatio||1),Math.sqrt((N.LOWQ?9e5:2.8e6)/(W*H)));
  cv.width=Math.max(1,Math.round(W*K));cv.height=Math.max(1,Math.round(H*K));cv.style.width=W+'px';cv.style.height=H+'px';
  cv.style.transform=WORLD.flip?'scaleX(-1)':'';
  yW=.43*H;
  // The crest of the hill, high under the tree and falling away to the other side, and the edge of the lower slope beyond it.
  CR=new Float32Array(Wi);SLP=new Float32Array(Wi);
  for(let i=0;i<Wi;i++){
    const u=i/W,xs=i/U,q=WORLD.crest;
    CR[i]=H*(.745-.19*Math.pow(smooth(-.1,1.05,u),.9))+U*(.012*Math.sin(xs*4.3+q[0])+.006*Math.sin(xs*9.7+q[1]));
    SLP[i]=H*(.662-.035*u)+U*(.006*Math.sin(xs*6.1+q[2])+.003*Math.sin(xs*15+q[0]));
  }
  SUN={x:WORLD.sunU*W,y:sunV*H};MOON={x:WORLD.moonU*W,y:WORLD.moonV*H,r:.027*U};GL={x:lerp(SUN.x,MOON.x,moonA),y:lerp(SUN.y,MOON.y,moonA)};
  TR={x:W-.1*U,z:1.6};TR.y=mapY(TR.x,TR.z);
  buildSky();buildFar();buildGround();buildField();buildTree();
  glowS=layer(48,48);{const g=glowS.getContext('2d'),rg=g.createRadialGradient(24,24,0,24,24,24);rg.addColorStop(0,'rgba(236,255,170,1)');rg.addColorStop(.25,'rgba(200,255,120,.55)');rg.addColorStop(1,'rgba(160,255,90,0)');g.fillStyle=rg;g.fillRect(0,0,48,48);}
  leaves.length=0;seeds.length=0;flies.length=0;wings.length=0;birds.length=0;boat=null;train=null;avs.length=0;meteor=null;
}

/* ---------- drawing: grass ---------- */
function drawRow(row){
  const a=row.a,img=a.img,cw=a.cw,ch=a.ch,n=row.n,z=row.z,ts=row.tufts,ss=ch/n,m=SLC[n],snap=a.NL>2;
  for(let i=0;i<ts.length;i++){
    const t=ts[i],w=windAt(t.X,z),wc=w>1.7?1.7:w;
    const th=(dirU*.38*wc+Math.sin(T*t.om+t.ph)*(.012+.05*wc))*t.fx,sx=t.v*cw,dw=t.dw,dh=t.dh;
    let sh=(w-.5)*.95*t.sk,ly=0;if(sh>.92)sh=.92;
    // Each tuft steps between its rows of light at its own moment, so the field as a whole changes smoothly.
    if(snap){let lv=sh<=0?0:(sh*4.35+t.dz)|0;if(lv>4)lv=4;ly=lv*ch;sh=0;}
    if(n===1){
      const s=Math.sin(th),c=Math.cos(th);
      ctx.setTransform(K,0,-s*K,c*K,t.x*K,t.y*K);
      ctx.drawImage(img,sx,ly,cw,ch,-dw/2,-dh,dw,dh);
    }else{
      // Each slice leans further than the one below and starts where that one ended, so the tuft bends in a curve.
      let ox=t.x,oy=t.y;const sd=dh/n,ov=sd/ss;
      for(let j=0;j<n;j++){
        const an=th*m[j],s=Math.sin(an),c=Math.cos(an),sy=ch-(j+1)*ss,e=j?1:0;
        ctx.setTransform(K,0,-s*K,c*K,ox*K,oy*K);
        ctx.drawImage(img,sx,ly+sy,cw,ss+e,-dw/2,-sd,dw,sd+e*ov);
        if(sh>.06){ctx.globalAlpha=sh;ctx.drawImage(img,sx,ch+sy,cw,ss+e,-dw/2,-sd,dw,sd+e*ov);ctx.globalAlpha=1;}
        ox+=s*sd;oy-=c*sd;
      }
    }
  }
}

/* ---------- drawing: the tree ---------- */
function drawTree(){
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(treeL,treeDX,0);
  for(let i=0;i<clumps.length;i++){
    const c=clumps[i],w=Math.min(1.8,windAt((c.x-W/2)/U*2.4,2.4+c.ph)),a=c.amp;
    const dx=(dirU*(.003+.015*w)+Math.sin(T*c.om+c.ph)*(.0015+.004*w))*U*a,dy=Math.sin(T*c.om*.8+c.ph*1.7)*(.001+.003*w)*U*a,ro=dirU*.07*w*a+Math.sin(T*c.om*1.3+c.ph)*.03,s=Math.sin(ro),co=Math.cos(ro);
    ctx.setTransform(co*K,s*K,-s*K,co*K,(c.x+dx)*K,(c.y+dy)*K);ctx.drawImage(c.img,-c.s,-c.s,c.s*2,c.s*2);
  }
  const sw=.07*U,sh=.17*U;
  for(const q of sprigs){
    const w=Math.min(1.8,windAt((q.x-W/2)/U*2.4,2.6+q.ph)),ro=-dirU*(.06+.32*w)+Math.sin(T*q.om+q.ph)*(.04+.09*w),s=Math.sin(ro),co=Math.cos(ro);
    ctx.setTransform(co*K,s*K,-s*K,co*K,q.x*K,q.y*K);ctx.drawImage(sprigS,-sw/2,0,sw,sh*q.l);
  }
}

/* ---------- small things that move ---------- */
const leaves=[],seeds=[],flies=[],wings=[],birds=[],avs=[];
let boat=null,train=null,meteor=null;
const LEAFC=[lit([92,156,64],.8),lit([182,218,104],1.1),lit([214,186,90],1),lit([60,120,60],.5)].map(c=>rgb(c));
function newLeaf(){
  if(!clumps.length)return;
  const c=pick(clumps),x=c.x+rr(-.03,.03)*U,z=rr(1.5,3.4);
  leaves.push({x,y:c.y+rr(0,.05)*U,vx:0,vy:0,rot:rr(0,TAU),spin:rr(-4,4),fl:rr(0,TAU),fs:rr(3,8),sz:U*rr(.006,.011),c:pick(LEAFC),gy:Math.min(H+20,mapY(clamp(x,0,W),z)-rr(0,.05)*U),ph:rr(0,TAU)});
  stats.leaves++;
}
// A firefly waits its turn, comes up out of the grass, wanders and goes out. Its age is below zero while it waits.
function newFly(x,y,life,wait){return{x,y,o1:rr(0,999),o2:rr(0,999),ph:rr(0,TAU),f:rr(.8,1.7),age:-wait,life,up:rr(.004,.012),k:rr(.45,.8)};}
// Each kind of event has its own timer with exponentially distributed gaps: m is the average gap in seconds, f the average wait for the first.
const SCHED={window:{m:.7,f:.4},leaf:{m:11,f:5},gust:{m:26,f:9},av:{m:55,f:15},seeds:{m:70,f:25},birds:{m:75,f:18},train:{m:85,f:30},glow:{m:80,f:30},boat:{m:100,f:22},
  lull:{m:150,f:75},meteor:{m:150,f:60},turn:{m:480,f:240}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
function fire(k){
  switch(k){
    case'window':{if(pool.length){const w=pick(pool);w.on=!w.on;}break;}
    case'leaf':newLeaf();if(chance(.3))log('A leaf lets go of the tree');break;
    case'gust':fronts.push({p:-24,sp:rr(4.2,6.8),wd:rr(1.8,3.4),amp:rr(.7,1.5),o:rr(0,99),hit:false});stats.gusts++;
      log(pick(['A gust rolls across the hilltop','A gust lays the grass flat and bright','The wind picks up and the whole hill leans']));break;
    case'av':{const d=chance(.5)?1:-1;avs.push({x:d>0?-10:W+10,y:rr(.2,.37)*H,vx:d*rr(.04,.075)*U,ph:rr(0,TAU),c:rgb(pick(NEONS))});log('A flying car threads between the towers');break;}
    case'seeds':{for(let i=ri(14,30);i>0;i--)seeds.push({x:rr(0,W),y:rr(.62,.98)*H,ph:rr(0,TAU),sp:rr(.6,1.4),sz:rr(.8,1.6),a:0,rise:rr(.01,.035)});log('Seeds lift off the grass and ride the breeze');break;}
    case'birds':{
      if(hour>2.5)break;
      const d=chance(.5)?1:-1,f={x:d>0?-.08*U:W+.08*U,y:rr(.09,.33)*H,vx:d*rr(.05,.09)*U,vy:rr(-.006,.006)*U,o:[]};
      for(let i=ri(3,9);i>0;i--)f.o.push({dx:rr(-.07,.07)*U,dy:rr(-.03,.03)*U,ph:rr(0,TAU),f:rr(7,10)});
      birds.push(f);log('A flock of birds crosses the river');break;
    }
    case'train':{if(train)break;const d=chance(.5)?1:-1,n=ri(5,10);train={x:d>0?-n*.016*U:W+2,vx:d*rr(.07,.11)*U,n};log('A train runs along the far bank');break;}
    case'glow':{
      if(hour>1.7){const n=ri(2,7);for(let i=0;i<n;i++)flies.push(newFly(rr(0,W),rr(.74,.99)*H,rr(12,28),rr(0,7)));log(n>3?'A few fireflies come up out of the grass':'A firefly or two comes up out of the grass');}
      else{const n=ri(1,3),d=chance(.5)?1:-1;for(let i=0;i<n;i++)wings.push({x:d>0?-20-i*30:W+20+i*30,y:rr(.66,.86)*H,vx:d*rr(.035,.06)*U,ph:rr(0,TAU),c:rgb(lit(pick(FLOW),1.1))});log(n>1?'Butterflies wander over the meadow':'A butterfly wanders over the meadow');}
      break;
    }
    case'boat':{if(boat)break;const d=chance(.5)?1:-1,y=yW+rr(.028,.085)*H;boat={x:d>0?-.05*U:W+.05*U,y,vx:d*rr(.012,.024)*U,s:.5+(y-yW)/(.085*H),c:pick(NEONS)};log('A boat slides along the river');break;}
    case'lull':E.lull={age:0,dur:rr(14,32),up:4,down:7};log('The wind drops to a whisper');break;
    case'meteor':{if(L.star<.3)break;const a=rr(.3,.9),sp=rr(.8,1.2)*U,d=chance(.5)?1:-1;meteor={x:rr(.1,.8)*W,y:rr(.02,.2)*H,vx:d*Math.cos(a)*sp,vy:Math.sin(a)*sp,age:0,life:rr(.4,.75)};log('A shooting star falls over Night City');break;}
    case'turn':E.turn={age:0,dur:9,up:1,down:1,done:false};log('The wind turns');break;
  }
}

/* ---------- the world, each step ---------- */
function update(dt){
  T+=dt;
  for(const k in SCHED){nextEv[k]-=dt;if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);fire(k);}}
  for(const k in E){const e=E[k];if(e){e.age+=dt;if(e.age>=e.dur)E[k]=null;}}
  drift(dt);
  // Gust fronts cross the ground. When one reaches the tree, it shakes a few leaves loose.
  const sT=(TR.x-W/2)/U*2*dirU+.7;
  for(let i=fronts.length-1;i>=0;i--){const f=fronts[i];f.p+=f.sp*dt;if(!f.hit&&f.p>sT){f.hit=true;for(let n=ri(1,4);n>0;n--)newLeaf();}if(f.p>52)fronts.splice(i,1);}
  for(const b of beacons){b.t-=dt;if(b.t<=0){b.on=!b.on;b.t=b.on?.3:b.p;}}
  for(let i=leaves.length-1;i>=0;i--){
    const l=leaves[i],w=windAt((l.x-W/2)/U*2.4,2.4);
    l.vx+=(dirU*w*.42*U-l.vx)*Math.min(1,dt*1.6);l.vy+=((.075+.03*Math.sin(T*2.3+l.ph))*U-l.vy)*Math.min(1,dt*2);
    l.x+=l.vx*dt;l.y+=l.vy*dt;l.rot+=l.spin*dt*(.4+w);l.fl+=l.fs*dt;
    if(l.y>l.gy||l.x<-30||l.x>W+30)leaves.splice(i,1);
  }
  // Seeds and fluff ride the breeze all the time, more of them when it blows.
  if(seeds.length<(N.LOWQ?14:36)&&R()<dt*(.15+.7*brz)*(1-.6*moonA))seeds.push({x:dirU>0?-8:W+8,y:rr(.5,.97)*H,ph:rr(0,TAU),sp:rr(.6,1.4),sz:rr(.8,1.6),a:1,rise:rr(-.004,.02)});
  for(let i=seeds.length-1;i>=0;i--){
    const s=seeds[i],w=windAt((s.x-W/2)/U*2,2);
    s.x+=dirU*(.03+.2*w)*U*s.sp*dt;s.y+=(Math.sin(T*1.3+s.ph)*.014-s.rise)*U*dt;s.a=Math.min(1,s.a+dt*.7);
    if(s.x<-12||s.x>W+12||s.y<.3*H)seeds.splice(i,1);
  }
  for(let i=flies.length-1;i>=0;i--){
    const f=flies[i];f.age+=dt;if(f.age<0)continue;
    f.x+=((noise(T*.13+f.o1)-.5)*.06+dirU*brz*.006)*U*dt;f.y+=((noise(T*.11+f.o2)-.5)*.035-f.up*(1-smooth(4,10,f.age)))*U*dt;
    if(f.x<-10)f.x=W+10;else if(f.x>W+10)f.x=-10;f.y=clamp(f.y,.58*H,H-4);
    if(f.age>f.life)flies.splice(i,1);
  }
  for(let i=wings.length-1;i>=0;i--){const b=wings[i];b.x+=(b.vx+Math.sin(T*.9+b.ph)*.02*U)*dt;b.y+=Math.sin(T*1.7+b.ph)*.03*U*dt;if(b.x<-60||b.x>W+60)wings.splice(i,1);}
  for(let i=birds.length-1;i>=0;i--){const f=birds[i];f.x+=f.vx*dt;f.y+=f.vy*dt;if(f.x<-.2*U||f.x>W+.2*U)birds.splice(i,1);}
  for(let i=avs.length-1;i>=0;i--){const a=avs[i];a.x+=a.vx*dt;if(a.x<-40||a.x>W+40)avs.splice(i,1);}
  if(boat){boat.x+=boat.vx*dt;if(boat.x<-.08*U||boat.x>W+.08*U)boat=null;}
  if(train){train.x+=train.vx*dt;if(train.x<-train.n*.02*U||train.x>W+10)train=null;}
  if(meteor){meteor.age+=dt;meteor.x+=meteor.vx*dt;meteor.y+=meteor.vy*dt;if(meteor.age>meteor.life)meteor=null;}
}

/* ---------- drawing ---------- */
function drawFar(){
  // Windows that go on and off, beacons, and whatever is passing.
  let c=-1;for(const w of pool){if(!w.on)continue;if(w.c!==c){c=w.c;ctx.fillStyle=WINC[c];}ctx.fillRect(w.x,w.y,w.s,w.s);}
  if(L.win>.15){ctx.fillStyle='rgb(255,84,66)';for(const b of beacons)if(b.on)ctx.fillRect(b.x-1.1,b.y-1.1,2.2,2.2);}
  for(const a of avs){const y=a.y+Math.sin(T*.5+a.ph)*.008*U,r=Math.max(1.1,.0018*U);ctx.fillStyle=a.c;ctx.globalAlpha=.35;ctx.fillRect(a.vx>0?a.x-.022*U:a.x,y-r*.4,.022*U,r*.8);ctx.globalAlpha=1;ctx.fillRect(a.x-r,y-r,r*2,r*2);}
  if(train){
    const h=Math.max(1.6,.0052*U),cl=.014*U,y=yW-.0045*H-h;
    for(let i=0;i<train.n;i++){const x=train.x+i*.016*U;ctx.fillStyle=rgb(hz(lit([170,176,190],.5),.4));ctx.fillRect(x,y,cl,h);ctx.fillStyle=L.win>.3?rgba([255,226,150],L.win):rgba(hz(lit([40,50,80],.2),.4),.8);ctx.fillRect(x+cl*.1,y+h*.2,cl*.8,h*.4);}
  }
  c=-1;const k=.45+.75*brz;
  for(const q of glints){const s=Math.sin(T*q.f+q.ph);if(s<=0)continue;const a=q.a*s*s*s*k;if(a<.03)continue;if(q.c!==c){c=q.c;ctx.fillStyle=GLC[c];}ctx.globalAlpha=a>1?1:a;ctx.fillRect(q.x-q.l/2,q.y,q.l,q.h);}
  ctx.globalAlpha=1;
  if(boat){
    const b=boat,s=.02*U*b.s,d=b.vx>0?1:-1,xi=clamp(b.x|0,0,Wi-1);
    if(b.y<Math.min(CR[xi],SLP[xi])){
      ctx.fillStyle=rgba(L.cl,.28);ctx.fillRect(d>0?b.x-s*3.4:b.x+s*.9,b.y+s*.12,s*2.5,Math.max(.8,s*.05));ctx.fillRect(d>0?b.x-s*2.4:b.x+s*.9,b.y+s*.26,s*1.5,Math.max(.8,s*.05));
      ctx.fillStyle=rgb(hz(lit([52,46,60],.2),.3));ctx.beginPath();ctx.moveTo(b.x-s,b.y-s*.16);ctx.lineTo(b.x+s,b.y-s*.16);ctx.lineTo(b.x+s*.8,b.y+s*.1);ctx.lineTo(b.x-s*.8,b.y+s*.1);ctx.closePath();ctx.fill();
      ctx.fillStyle=rgb(hz(lit([200,196,190],.7),.3));ctx.fillRect(b.x-s*.35*d-s*.3,b.y-s*.42,s*.6,s*.27);
      if(L.win>.25){ctx.fillStyle=rgba(b.c,L.win);ctx.fillRect(b.x+d*s*.7-1,b.y-s*.34,2.2,2.2);ctx.globalAlpha=.3*L.win;ctx.fillRect(b.x+d*s*.7-1,b.y+s*.14,2.2,s*.7);ctx.globalAlpha=1;}
    }
  }
}
const dbg={};
function draw(){
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(skyL,0,0);
  ctx.setTransform(K,0,0,K,0,0);
  if(L.star>.02){ctx.fillStyle='rgb(240,244,255)';for(const s of twinkles){ctx.globalAlpha=L.star*(.2+.8*Math.abs(Math.sin(T*s.f+s.ph)));ctx.fillRect(s.x-s.r/2,s.y-s.r/2,s.r,s.r);}ctx.globalAlpha=1;}
  if(meteor){const m=meteor,k=1-m.age/m.life,d=Math.hypot(m.vx,m.vy),l=.09*U;ctx.strokeStyle=rgba([255,250,226],.9*k);ctx.lineWidth=Math.max(1,.002*U);ctx.beginPath();ctx.moveTo(m.x,m.y);ctx.lineTo(m.x-m.vx/d*l,m.y-m.vy/d*l);ctx.stroke();}
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(farL,0,0);ctx.setTransform(K,0,0,K,0,0);
  drawFar();
  if(birds.length){
    ctx.strokeStyle=rgba(mix(L.ink,L.haze,.3),.85);ctx.lineWidth=Math.max(1,.0017*U);ctx.lineJoin='round';ctx.beginPath();
    for(const f of birds)for(const o of f.o){const x=f.x+o.dx,y=f.y+o.dy+Math.sin(T*.8+o.ph)*.004*U,s=.0065*U,a=Math.sin(T*o.f+o.ph)*.75;ctx.moveTo(x-s,y-s*a);ctx.lineTo(x,y);ctx.lineTo(x+s,y-s*a);}
    ctx.stroke();
  }
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(groundL,0,gTopD);
  // The grass, far to near, with the tree standing in its own row.
  let tree=false;
  for(const row of rows){
    if(!tree&&!row.far&&row.z<=TR.z){tree=true;drawTree();}
    if(!dbg.nograss)drawRow(row);
  }
  if(!tree)drawTree();
  ctx.setTransform(K,0,0,K,0,0);
  for(const l of leaves){ctx.fillStyle=l.c;ctx.beginPath();ctx.ellipse(l.x,l.y,l.sz,l.sz*(.14+.34*Math.abs(Math.cos(l.fl))),l.rot,0,TAU);ctx.fill();}
  if(seeds.length){ctx.fillStyle=rgb(mix(lit(PLUME,1.2),[255,255,255],.2));for(const s of seeds){ctx.globalAlpha=.75*s.a;ctx.fillRect(s.x,s.y,s.sz,s.sz);ctx.globalAlpha=.3*s.a;ctx.fillRect(s.x+s.sz*.3,s.y+s.sz,s.sz*.4,s.sz*1.6);}ctx.globalAlpha=1;}
  for(const f of flies){
    if(f.age<0)continue;
    const s=Math.sin(T*f.f+f.ph),a=(s>0?s*s:0)*Math.min(1,f.age/3,(f.life-f.age)/4)*f.k;if(a<.02)continue;
    const r=.009*U;ctx.globalAlpha=a;ctx.drawImage(glowS,f.x-r,f.y-r,r*2,r*2);
  }
  ctx.globalAlpha=1;
  for(const b of wings){const fl=Math.abs(Math.sin(T*13+b.ph)),s=.008*U,d=b.vx>0?1:-1;ctx.fillStyle=b.c;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-d*s*.5,b.y-s*(.3+1.1*fl));ctx.lineTo(b.x+d*s*.9,b.y-s*(.2+.9*fl));ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-d*s*.6,b.y+s*.5*fl);ctx.lineTo(b.x+d*s*.5,b.y+s*.4*fl);ctx.closePath();ctx.fill();}
}

function rebuild(){layout();}
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(rebuild,150);});

/* ---------- start ---------- */
function state(){
  return{time:+T.toFixed(1),hour:+hour.toFixed(2),flip:WORLD.flip,wind:{dir:dirU,breeze:+brz.toFixed(2),fronts:fronts.length,lull:!!E.lull,turning:!!E.turn},
    grass:{rows:rows.length,tufts:rows.reduce((s,r)=>s+r.tufts.length,0),slices:[1,2,3].map(n=>rows.reduce((s,r)=>s+(r.n===n?r.tufts.length:0),0)),atlases:atl.size},
    air:{leaves:leaves.length,seeds:seeds.length,fireflies:flies.length,butterflies:wings.length,flocks:birds.length},far:{windows:pool.length,beacons:beacons.length,glints:glints.length,boat:!!boat,train:!!train,cars:avs.length},
    canvas:{W,H,scale:+K.toFixed(2)},stats:{...stats}};
}
// How long one frame takes to draw, in milliseconds, averaged over n frames.
function profile(n=60){const t0=performance.now();for(let i=0;i<n;i++)draw();return+((performance.now()-t0)/n).toFixed(2);}
layout();drift(0);
N.log(`A hilltop over the river ${HOURS[Math.round(hour)]}, with a breeze through the long grass and Night City on the far bank`);
N.stats(stats);
if(N.DEBUG)window.WH={WORLD,pause(){N.paused=true;},resume(){N.paused=false;},run(s){for(let t=0;t<s;t+=1/30)update(1/30);},step(s){N.paused=true;for(let t=0;t<s;t+=1/60)update(Math.min(1/60,s-t));draw();},
  draw,fire,state,rebuild,profile,nextEv,dbg};
N.run({update(dt){update(dt);N.stats(stats);},draw,step:1/30});
})();
