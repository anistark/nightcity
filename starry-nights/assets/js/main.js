/* Starry Nights: Van Gogh's The Starry Night, repainted stroke by stroke over the Night City skyline.
   Nothing is stored. The sky is a flow made of swirls, stars and wind, and short brush strokes follow it, each one painted over the ones before,
   so the canvas is never cleared and never finished. The city stands on a canvas of its own in front.
   Every choice in the world comes from the shared seeded generator in ../assets/js/nightcity.js. The brush draws from a private stream,
   so the size of the window never changes what happens in the sky. */
(()=>{
'use strict';
const N=NightCity;
const{R,rr,ri,pick,chance,expo,wpick,noise}=N;
const cv=document.getElementById('scene'),ctx=cv.getContext('2d');
// The city is painted on a second canvas above the sky, so the sky's strokes never have to work around it.
const cvC=document.createElement('canvas');cvC.className='city';cvC.setAttribute('aria-hidden','true');cv.after(cvC);
const cg=cvC.getContext('2d');
const QS=new URLSearchParams(location.search);

/* ---------- helpers ---------- */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
const smooth=(a,b,x)=>{x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x);};
const mix=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];
const rgb=(c,l=1)=>`rgb(${clamp(c[0]*l,0,255)|0},${clamp(c[1]*l,0,255)|0},${clamp(c[2]*l,0,255)|0})`;
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
// A row of colours, evenly spaced, read at any point from 0 to 1.
function ramp(...stops){const n=stops.length,cs=stops.map(hex);return v=>{v=clamp(v,0,1)*(n-1);const i=Math.min(n-2,v|0);return mix(cs[i],cs[i+1],v-i);};}
function stream(s){s>>>=0;const r=N.sfc32(s,(s^0x9e3779b9)>>>0,Math.imul(s,2654435761)>>>0,(s+0x6d2b79f5)>>>0);for(let i=0;i<12;i++)r();return r;}
const SALT=Math.floor(R()*4294967296);
// The brush: where each stroke starts and how its colour wavers. It is private, so painting never moves the world's random numbers.
const P=stream(Math.floor(R()*4294967296));
const pr=(a,b)=>a+(b-a)*P();
function hash(a,b){let h=(Math.imul(a|0,374761393)+Math.imul(b|0,668265263)+SALT)|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296;}
function vn(x,y){const ix=Math.floor(x),iy=Math.floor(y),ax=x-ix,ay=y-iy,ux=ax*ax*(3-2*ax),uy=ay*ay*(3-2*ay);return lerp(lerp(hash(ix,iy),hash(ix+1,iy),ux),lerp(hash(ix,iy+1),hash(ix+1,iy+1),ux),uy);}

/* ---------- the palette ---------- */
const SKY=ramp('#070f2e','#0c1a4c','#122a6c','#1b3f8c','#2a5aa8','#4079bc','#6498cc','#8fb6d8','#b9d2dc','#dbe4cc','#f0e9a8','#f6d862');
// A halo runs from its core out to the sky around it. The kinds are a yellow star, a white one and an orange one.
const HALOS=[ramp('#fff6c0','#fbe26a','#f4c844','#f0d470','#e2e4b0','#b4d2cc','#7fa8d0'),ramp('#fffdf0','#fbf4c4','#f4e890','#e6eab8','#cfe2d0','#a8cad8','#7aa4d0'),ramp('#ffe9a0','#f8b840','#ee9428','#f2c050','#e6dc98','#b8d0c0','#7fa8d0')];
const KINDS=['yellow','white','orange'];
const MOONH=ramp('#f8e890','#f6d858','#f2c848','#eedc78','#dfe2a8','#b6d2c4','#80aad0');
const ORANGE=ramp('#d8741c','#ee9426','#f6b23a','#f8cc58'),INNER=ramp('#f4ec98','#e6e69a','#cfdc9c');
const HILLS=[ramp('#142a62','#1f4488','#3565a6','#5f8abc','#93b0d0'),ramp('#0d1c4a','#173272','#274f94','#4474ac','#7398c0'),ramp('#081230','#10244f','#1b3d6c','#2a6070','#4c8480')];
const GROUND=ramp('#04090f','#0a1620','#10282a','#1b3a30','#34482a','#56562e');
const CYP=ramp('#030607','#08110d','#101e16','#192c1c','#28381e','#3c4022','#254a3c');
const TEAL=[70,150,140],PALE=[255,250,225],RIDGE=[10,16,44],OCHRE=[106,82,40],SLATE=[40,74,102];
const FACES=[[[26,40,100],4],[[34,60,132],4],[[52,48,120],3],[[26,74,96],3],[[70,48,116],2],[[44,58,94],3],[[66,50,64],1]];
const HAZE=[50,84,150],PALEB=[120,150,200],OUT='#070a1a',TINTS=[[24,70,96],[70,44,120],[30,60,140]];
const WINS=[[[246,216,96],[242,176,64],[255,236,168]],[[140,232,224],[96,200,216],[214,255,244]],[[255,140,190],[255,96,160],[255,214,230]],[[232,240,255],[180,206,250],[255,250,220]]];
const NEONS=[[95,232,224],[255,95,168],[255,214,90],[170,120,255],[120,255,160]];

/* ---------- the world, picked once ---------- */
// Positions are fractions of the window, sizes are in units of S, the square root of its area, so the picture holds on any screen.
const WORLD={
  dir:chance(.82)?1:-1,
  moon:{u:rr(.85,.92),v:rr(.1,.16),r:rr(.085,.105),horn:Math.PI+rr(-.8,.8),cut:rr(.78,.95),o:rr(0,999),spin:chance(.5)?1:-1},
  cyp:{side:-1,off:0,u:rr(.115,.15),tip:rr(.05,.12),w:rr(.92,1.12),lobe:rr(.36,.5),o:[rr(0,999),rr(0,TAU),rr(0,TAU)]},
  core:rr(.64,.8),
  hills:[0,1,2].map(()=>[rr(0,TAU),rr(0,TAU),rr(0,TAU)]),hd:[0,1,2].map(()=>chance(.5)?1:-1),
  ph:[rr(0,TAU),rr(0,TAU),rr(0,999),rr(0,999),rr(0,999),rr(0,999),rr(0,TAU),rr(0,TAU)],
  swirls:[],stars:[],trees:[],
};
{
  // The cypresses. The tall one on the left is always there. Some nights one or two shorter ones stand beside it,
  // each a different height and narrower the shorter it is, and now and then another stands at the right edge, under the moon.
  const c=WORLD.cyp,tree=(side,off,u,tip)=>WORLD.trees.push({side,off,u,tip,w:c.w*rr(.85,1.1)*(.45+.55*(1-tip)/(1-c.tip)),lobe:chance(.7)?rr(.36,.6):2,o:[rr(0,999),rr(0,TAU),rr(0,TAU)]});
  WORLD.trees.push(c);
  let off=0;
  // ?debug&trees=2 forces that many beside the tall one, and ?debug&right the one at the right edge.
  const more=wpick([[0,5],[1,3.2],[2,1.8]]),right=chance(.22),dbg=N.DEBUG&&QS.has('trees');
  for(let n=dbg?clamp(+QS.get('trees')||0,0,2):more;n>0;n--){off+=rr(1.3,2.1);tree(-1,chance(.8)?off:-off*.6,0,rr(.2,.58));}
  if(right||N.DEBUG&&QS.has('right'))tree(1,0,rr(.9,.97),rr(.4,.62));
}
{
  // Two great swirls that curl into each other, and a few small ones around them.
  const o=()=>[rr(0,999),rr(0,999),rr(0,999),rr(0,999)];
  const A={u:rr(.38,.46),v:rr(.29,.35),r:rr(.135,.16),g:rr(2.3,2.9),amp:.05,main:1,f:rr(.012,.022),o:o()};
  const B={u:A.u+rr(.15,.19),v:A.v+rr(.09,.12),r:rr(.09,.11),g:rr(2,2.6),amp:.045,main:1,f:rr(.014,.026),o:o()};
  WORLD.swirls.push(A,B);
  for(let i=ri(3,5);i>0;i--)WORLD.swirls.push({u:rr(.05,.8),v:rr(.06,.48),r:rr(.04,.065),g:(chance(.7)?1:-1)*rr(1.2,2),amp:.08,main:0,f:rr(.015,.03),o:o()});
  // The stars. The first is the white one low beside the cypress, the rest go wherever they are farthest from everything else.
  const c=WORLD.cyp,m=WORLD.moon,star=(u,v,r,k)=>WORLD.stars.push({u,v,r,k,spin:chance(.5)?1:-1,o:rr(0,999),f:rr(.03,.09),fl:null});
  star(c.u+rr(.09,.13),rr(.34,.42),rr(.04,.05),1);
  const far=(u,v)=>{
    let d=Math.hypot((u-m.u)*1.5,v-m.v)-.1;
    for(const s of WORLD.stars)d=Math.min(d,Math.hypot((u-s.u)*1.5,v-s.v));
    for(const s of[A,B])d=Math.min(d,Math.hypot((u-s.u)*1.5,v-s.v)-s.r*.8);
    return d;
  };
  for(let i=ri(9,11);i>0;i--){
    let best=null,bd=-1;
    for(let j=0;j<14;j++){
      const u=rr(.03,.82),v=rr(.04,.5);
      if(WORLD.trees.some(t=>(t.side>0||!t.off)&&Math.abs(u-t.u)<.07&&v>t.tip-.02))continue;
      const d=far(u,v);if(d>bd){bd=d;best=[u,v];}
    }
    if(best)star(best[0],best[1],rr(.022,.046),wpick([[0,5],[1,3],[2,2]]));
  }
}

/* ---------- the city, laid out once along a strip ---------- */
// Three rows of buildings, measured in window heights from the middle of downtown, so a wider window only shows more of the same city.
const CITY=[];
{
  const x2=(chance(.5)?1:-1)*rr(.42,.8),k2=rr(.3,.65);
  const prof=x=>Math.exp(-((x/.33)**2))+k2*Math.exp(-(((x-x2)/.22)**2));
  const ROWS=[{top:.8,rise:.14,w0:.032,w1:.068,gap:.028,cell:.0155},{top:.86,rise:.045,w0:.04,w1:.085,gap:0,cell:.017},{top:.93,rise:.02,w0:.05,w1:.11,gap:0,cell:.02}];
  ROWS.forEach((rw,row)=>{
    let x=-3.2+rr(0,.05);
    while(x<3.2){
      const w=rr(rw.w0,rw.w1),p=prof(x+w/2);
      const top=rw.top-rw.rise*p*(row?R():.4+.6*R())-rr(-.015,.03);
      const b={row,x,w,top,cell:rw.cell,face:mix(wpick(FACES),HAZE,row===0?.22:row===1?.08:0),cols:clamp(Math.round(w/(rw.cell*1.2)),2,7),
        win:wpick([[0,6],[1,2],[2,1.2],[3,1]]),set:null,spire:0,su:rr(.3,.7),beacon:false,bp:rr(1.3,2.4),bt:rr(0,2),bon:false,neon:null,roof:null,pitch:0,
        seed:Math.floor(R()*4294967296),dark:false,vis:false};
      if(row===0&&p>.3){
        if(chance(.5)){const f=rr(.42,.7);b.set={f,h:rr(.015,.045),a:pick([0,(1-f)/2,1-f])};}
        if(chance(.55)){b.spire=rr(.015,.05);b.beacon=chance(.65);}
        if(chance(.45))b.neon={type:chance(.6)?'crown':'edge',c:pick(NEONS),on:1,len:rr(.05,.14)};
      }else if(row===0){if(chance(.15))b.spire=rr(.01,.03);}
      else{
        if(chance(row===1?.22:.3))b.neon={type:'sign',c:pick(NEONS),on:1,u:rr(.2,.8),v:rr(.012,.03),len:rr(.025,.055),n:ri(3,5)};
        if(chance(.3))b.roof={u:rr(.1,.5),f:rr(.25,.45),h:rr(.008,.02)};
        else if(row===2&&chance(.28))b.pitch=rr(.014,.03);
        else if(chance(.15))b.spire=rr(.012,.03);
      }
      // Which windows are lit: a loose grid, whole floors, or only a few.
      const style=wpick([['grid',5],['bands',2],['sparse',2]]),lp=style==='sparse'?rr(.05,.2):rr(.15,.6);
      b.lit=new Uint8Array(b.cols*64);
      for(let r=0;r<64;r++){const band=R()<lp;for(let c=0;c<b.cols;c++)b.lit[r*b.cols+c]=(style==='bands'?(band&&R()<.85):R()<lp)?1:0;}
      CITY.push(b);
      x+=w+(rw.gap&&chance(.6)?rr(0,rw.gap):0);
    }
  });
}

/* ---------- state ---------- */
let W=1,H=1,S=1,K=1,Wi=1,Hi=1,CU=1,WS=6,FS=4,OW=2;
let T=0;
const stats={strokes:0,swirls:0,events:0};
const log=s=>{stats.events++;N.log(s);};
// Slow envelopes that events start: each rises, holds and falls.
const E={gust:null,calm:null,unwind:null,mist:null,moon:null};
const ev=e=>e?smooth(0,e.up,e.age)*(1-smooth(e.dur-e.down,e.dur,e.age)):0;
let dir=WORLD.dir,dirT=WORLD.dir,wind=WORLD.dir,U0=50,A1=0,A2=0,K1=0,K2=0,K2y=0,ph1=WORLD.ph[0],ph2=WORLD.ph[6],bandPh=WORLD.ph[1],mistK=1,moodK=0,BK=0,NK=0,HB=0;
const trav=[];
let vis=[],rowsVis=[[],[],[]],beacons=[],blackout=null,flick=null;

/* ---------- the land: hills, ground and the cypresses ---------- */
let RY=[],SL=[],hillY,groundY,coverY,cutX=0,cutR=0;
const TREES=WORLD.trees;
// The cypress that covers a point, if one does.
function treeAt(x,yi){for(let i=TREES.length-1;i>=0;i--){const t=TREES[i];if(x>=t.L[yi]&&x<=t.R[yi])return t;}return null;}
// What stands at a point: 0 sky, 1 hills, 2 ground, 3 the cypress, -1 off the canvas or behind the city.
function regionAt(x,y){
  const xi=x|0,yi=y|0;
  if(x<0||y<0||xi>=Wi||yi>=Hi)return-1;
  if(treeAt(x,yi))return 3;
  if(y>=coverY[xi])return-1;
  if(y>=groundY[xi])return 2;
  if(y>=hillY[xi])return 1;
  return 0;
}
// A cypress is a dark flame: a tall tongue, often with a shorter one against its right side, swaying from the root up.
function cypUpdate(){
  let total=0;
  for(const t of TREES){
    if(!t.on){t.area=0;continue;}
    const span=Hi-t.top,w=t.W;
    t.sway=(noise(T*.06+t.o[0])-.5)*1.5+.22*clamp(wind,-2,2);
    let area=0;t.min=1e9;t.max=-1e9;
    for(let y=0;y<Hi;y++){
      if(y<t.top){t.L[y]=1e9;t.R[y]=-1e9;continue;}
      const s=(y-t.top)/span,cx=t.X+w*((1-s)*(1-s)*t.sway+.22*(1-s)*Math.sin(s*7-T*.5+t.o[1]));
      const hw=w*(Math.pow(s,.55)*(.8+.2*Math.sin(s*11-T*.35+t.o[2]))+.3*smooth(.82,1,s));
      let r=cx+hw;
      if(s>t.lobe){const q=(s-t.lobe)/(1-t.lobe),lh=w*.62*Math.sqrt(q)*(.85+.15*Math.sin(q*9-T*.4+t.o[1]));r=Math.max(r,cx+w*(.5+.3*q)+lh);}
      t.L[y]=cx-hw;t.R[y]=r;t.C[y]=cx;area+=r-cx+hw;
      if(cx-hw<t.min)t.min=cx-hw;if(r>t.max)t.max=r;
    }
    t.area=area;total+=area;
  }
  REG[3].area=total;
}

/* ---------- the sky: a flow and a way to colour it ---------- */
// The flow is the sum of a wavy wind and round vortices: the swirls, the stars and the moon. Each vortex is a bump in a stream function,
// so strokes run along its contours, and the same function bands the sky into ribbons of light and dark.
const MAXV=64,VX=new Float64Array(MAXV),VY=new Float64Array(MAXV),VI=new Float64Array(MAXV),VC=new Float64Array(MAXV),VA=new Float64Array(MAXV),VP=new Float64Array(MAXV),VM=new Float64Array(MAXV);
const HX=new Float64Array(24),HY=new Float64Array(24),HR=new Float64Array(24),HK=new Int8Array(24);
let VN=0,HN=0;
function addV(x,y,r,g,sink,glow){if(VN>=MAXV)return;VX[VN]=x;VY[VN]=y;VI[VN]=1/(r*r);VC[VN]=2*g/r;VA[VN]=sink*Math.abs(2*g/r);VP[VN]=g*r*.6;VM[VN]=glow;VN++;}
function fieldUpdate(){
  VN=0;
  const un=1-1.7*ev(E.unwind);
  for(const s of WORLD.swirls){
    const x=(s.u+s.amp*2*(noise(T*s.f+s.o[0])-.5))*W,y=(s.v+s.amp*1.4*(noise(T*s.f*1.13+s.o[1])-.5))*H;
    addV(x,y,s.r*S*(.85+.3*noise(T*s.f*.7+s.o[2])),s.g*(.7+.6*noise(T*s.f*.9+s.o[3]))*(s.main?un:1),.22,s.main?1:.35);
  }
  for(const v of trav){const k=smooth(0,10,v.age)*(1-smooth(v.life-12,v.life,v.age));addV(v.u*W,(v.v+.05*(noise(T*.05+v.o)-.5))*H,v.r*S,v.g*k,.2,.5*k);}
  const m=WORLD.moon,mr=m.r*S*(.9+.2*noise(T*.04+m.o))*(1+.35*ev(E.moon));
  HX[0]=m.u*W;HY[0]=m.v*H;HR[0]=mr;HK[0]=-1;HN=1;addV(HX[0],HY[0],mr*.62,2.8*m.spin,0,0);
  for(const s of WORLD.stars){
    const r=s.r*S*(.8+.4*noise(T*s.f+s.o))*(1+.75*ev(s.fl));
    const x=(s.u+.012*(noise(T*.021+s.o*1.7)-.5))*W,y=(s.v+.012*(noise(T*.017+s.o*2.3)-.5))*H;
    HX[HN]=x;HY[HN]=y;HR[HN]=r;HK[HN]=s.k;HN++;addV(x,y,r*.62,3.2*s.spin,0,0);
  }
}
// The flow at a point, with wind speed 1 as the unit, its stream function for the colour bands, and how deep in a great swirl it is.
let qx=0,qy=0,qpsi=0,qglow=0;
function field(x,y){
  const a1=x*K1+ph1,a2=x*K2+y*K2y+ph2,c1=Math.cos(a1),c2=Math.cos(a2);
  let psi=y+A1*Math.sin(a1)+A2*Math.sin(a2),vx=wind*(1+A2*K2y*c2),vy=-wind*(A1*K1*c1+A2*K2*c2),gl=0;
  for(let i=0;i<VN;i++){
    const dx=x-VX[i],dy=y-VY[i],q=(dx*dx+dy*dy)*VI[i];if(q>6)continue;
    const e=Math.exp(-q),c=VC[i]*e,a=VA[i]*e;
    vx-=c*dy+a*dx;vy+=c*dx-a*dy;psi+=VP[i]*e;gl+=VM[i]*e;
  }
  qx=vx;qy=vy;qpsi=psi;qglow=gl;
}
// A stroke's velocity in pixels a second, by what it is painting.
let fvx=0,fvy=0;
function flow(reg,x,y){
  if(reg===0){field(x,y);const m=Math.sqrt(qx*qx+qy*qy)+1e-6,k=clamp(m,.4,2.3)*U0/m;fvx=qx*k;fvy=qy*k;return;}
  if(reg===1){
    // Hills are painted along their own ridges.
    const xi=clamp(x|0,0,Wi-1),k=y>=RY[2][xi]?2:y>=RY[1][xi]?1:0,d=WORLD.hd[k];
    const vy=d*SL[k][xi]+.28*Math.sin(x*K2*1.7+y*K2y*2.3+T*.15+k*2),m=U0*.32/Math.sqrt(1+vy*vy);fvx=d*m;fvy=vy*m;return;
  }
  if(reg===2){const a=vn(x/(.08*S)+7,y/(.08*S))*TAU*2+T*.05,m=U0*.25;fvx=Math.cos(a)*m;fvy=Math.sin(a)*m*.6;return;}
  // A cypress is painted upward, like flame.
  const t=treeAt(x,clamp(y|0,0,Hi-1)),vx=.6*Math.sin(y*TAU/(.1*S)+x*TAU/(.22*S)-T*.7)+.35*(t?t.sway:0),m=U0*.55/Math.sqrt(1+vx*vx);fvx=vx*m;fvy=-m;
}
// The colour of a stroke that starts here. skyPaint reads what field() last worked out, and sets how long and wide the stroke is.
let kLife=1,kW=1,kS=1;
function skyPaint(x,y){
  kLife=1;kW=1;kS=1;
  const xi=clamp(x|0,0,Wi-1),h=clamp(y/hillY[xi],0,1.1),gl=Math.min(1.2,qglow);
  // Deep blue overhead, a pale band of light over the hills, ribbons along the flow, and more light inside the great swirls.
  let v=.2+.1*h+.3*mistK*smooth(1-.22*mistK,1,h)+moodK;
  v+=Math.sin(qpsi*BK+bandPh+(vn(x*NK,y*NK)-.5)*4)*(.1+.16*Math.min(1,gl))+.19*gl+pr(-.055,.055);
  const a=P();if(a<.07)v+=.22;else if(a<.13)v-=.15;
  let c=SKY(v);
  if(v>.5&&P()<.14)c=mix(c,TEAL,.45);
  for(let i=0;i<HN;i++){
    const dx=x-HX[i],dy=y-HY[i],r=HR[i];if(dx>r||dx<-r||dy>r||dy<-r)continue;
    const dn=Math.sqrt(dx*dx+dy*dy)/r;if(dn>=1.05)continue;
    if(i===0){
      // The moon: an orange crescent round a pale hollow, inside its halo.
      const m=WORLD.moon;
      if(dn+pr(-.03,.03)<.46){const ox=Math.cos(m.horn)*.19*r,oy=Math.sin(m.horn)*.19*r,dc=Math.hypot(dx-ox,dy-oy)/r+pr(-.02,.02);kLife=.5;kW=.7;kS=.2;return dc>.46*m.cut?ORANGE(P()):INNER(P());}
    }
    const d=dn+pr(-.07,.07);if(d>=1)continue;
    c=mix((i?HALOS[HK[i]]:MOONH)(d),c,smooth(.6,1,d));kLife=.55+.3*d;kW=.75+.2*d;kS=.4+.5*d*d;break;
  }
  return c;
}
function hillPaint(x,y){
  const xi=clamp(x|0,0,Wi-1),k=y>=RY[2][xi]?2:y>=RY[1][xi]?1:0,d=y-RY[k][xi];
  if(d<WS*1.1&&P()<.75)return RIDGE;
  return HILLS[k](.36+.26*Math.sin(d*HB+(vn(x*NK*1.5+40,y*NK*1.5)-.5)*5)-.1*smooth(0,.2*H,d)+pr(-.09,.09));
}
const groundPaint=(x,y)=>GROUND(.25+.55*vn(x/(.03*S),y/(.03*S)+9)+pr(-.12,.12));
function cypPaint(x,y){
  const yi=clamp(y|0,0,Hi-1),t=treeAt(x,yi)||TREES[0],e=Math.abs(x-t.C[yi])/((t.R[yi]-t.L[yi])/2+1),a=P();
  if(a<.05)return OCHRE;if(a<.09)return SLATE;
  return CYP(.08+.5*vn(x/(.012*S),y/(.05*S))-(e>.75?.25:0)+pr(-.1,.1));
}

/* ---------- strokes ---------- */
// What each kind of stroke needs: how often the canvas is painted over (T, in seconds), and where strokes may start.
const REG=[{T:N.LOWQ?5:3,sp:1.15,life:.72,w:1.05},{T:7,sp:.32,life:1.3,w:.92},{T:9,sp:.25,life:.9,w:.8},{T:4,sp:.55,life:1.15,w:.95}];
for(const g of REG){g.acc=0;g.area=0;g.rate=0;g.sa=1;g.s=null;}
const BRISTLES=!N.LOWQ;
const parts=[];
let sx=0,sy=0;
function mkSamp(top,bot){const cum=new Float64Array(Wi);let a=0;for(let i=0;i<Wi;i++){a+=Math.max(0,bot(i)-top(i));cum[i]=a;}return{cum,area:a,top,bot};}
// A random point of a region, each pixel as likely as any other.
function sample(r){
  if(r===3){
    // Pick a tree by its size, then a point inside it.
    let u=P()*REG[3].area,t=TREES[0];for(const o of TREES){t=o;u-=o.area;if(u<=0)break;}
    for(let i=0;i<3;i++){sx=pr(t.min,t.max);sy=pr(t.top,H);if(regionAt(sx,sy)===3)return true;}return false;
  }
  const s=REG[r].s;if(!s||s.area<=0)return false;
  const u=P()*s.area;let lo=0,hi=Wi-1;
  while(lo<hi){const m=(lo+hi)>>1;if(s.cum[m]<u)lo=m+1;else hi=m;}
  const a=s.top(lo);sx=lo+P();sy=a+P()*(s.bot(lo)-a);
  return regionAt(sx,sy)===r;
}
function rates(){
  for(const g of REG){const w=WS*g.w,l=U0*g.sp*g.life;g.sa=w*(l+w);g.rate=g.area/g.sa*1.5/g.T;}
}
// A stroke carries one colour, a lighter and a darker hair of the brush beside it, and a width that swells and thins along its length.
function spawn(reg,x,y,pre){
  let c,life,w,ks=1;
  if(reg===0){field(x,y);c=skyPaint(x,y);life=pr(.5,1.05)*kLife;w=WS*pr(.8,1.3)*kW;ks=kS;}
  else if(reg===1){c=hillPaint(x,y);life=pr(.9,1.7);w=WS*pr(.7,1.15);}
  else if(reg===2){c=groundPaint(x,y);life=pr(.6,1.2);w=WS*pr(.6,1);}
  else{c=cypPaint(x,y);life=pr(.8,1.5);w=WS*pr(.7,1.2);}
  const l=1+pr(-.07,.07);
  parts.push({x,y,lx:x,ly:y,reg,age:0,life,w,ks,s2:Math.max(6,w*w*.4),c:rgb(c,l),ch:rgb(mix(c,PALE,.28),l),cd:rgb(c,l*.62),o1:pr(-.2,.26),o2:(P()<.5?-1:1)*pr(.32,.42),free:false,has:false,ox:x,oy:y,nx:0,ny:0});
  if(!pre)stats.strokes++;
}
function seg(p,x,y){
  const dx=x-p.lx,dy=y-p.ly,d=Math.sqrt(dx*dx+dy*dy);if(d<.01)return;
  if(p.dash){p.pen=!p.pen;p.has=false;if(!p.pen){p.lx=x;p.ly=y;return;}}
  const a=p.age/p.life,wd=p.flat?p.w:Math.max(1,p.w*(a<.12?.6+.4*a/.12:1-.5*((a-.12)/.88)**2));
  ctx.lineWidth=wd;ctx.strokeStyle=p.c;ctx.beginPath();ctx.moveTo(p.lx,p.ly);ctx.lineTo(x,y);ctx.stroke();
  if(BRISTLES&&wd>2){
    // The hairs are drawn over the length before this one as well, because the round end of each new length covers their tips.
    const nx=-dy/d*wd,ny=dx/d*wd,h=p.has,mx=h?(nx+p.nx)/2:nx,my=h?(ny+p.ny)/2:ny;
    for(let k=0;k<2;k++){
      const o=k?p.o2:p.o1;
      ctx.lineWidth=wd*(k?.2:.22);ctx.strokeStyle=k?p.cd:p.ch;ctx.beginPath();
      if(h){ctx.moveTo(p.ox+p.nx*o,p.oy+p.ny*o);ctx.lineTo(p.lx+mx*o,p.ly+my*o);}else ctx.moveTo(p.lx+nx*o,p.ly+ny*o);
      ctx.lineTo(x+nx*o,y+ny*o);ctx.stroke();
    }
    p.nx=nx;p.ny=ny;p.has=true;
  }
  p.ox=p.lx;p.oy=p.ly;p.lx=x;p.ly=y;
}
// Move every stroke along the flow and paint the length it has covered. A stroke ends with its life, or where its subject ends.
function stepParts(dt){
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];p.age+=dt;
    let dead=p.age>=p.life;
    if(p.free){p.x+=p.vx*dt;p.y+=(p.vy+(p.wob?Math.sin(p.age*p.wf)*p.wob:0))*dt;}
    else{flow(p.reg,p.x,p.y);p.x+=fvx*dt*p.ks;p.y+=fvy*dt*p.ks;}
    if(regionAt(p.x,p.y)!==p.reg){
      // A flying car goes on behind the towers. Anything else stops at the edge of what it paints.
      if(p.ghost){p.lx=p.x;p.ly=p.y;if(p.x<-30||p.x>W+30)dead=true;}else dead=true;
    }else{const dx=p.x-p.lx,dy=p.y-p.ly;if(dead||dx*dx+dy*dy>=p.s2)seg(p,p.x,p.y);}
    if(dead){parts[i]=parts[parts.length-1];parts.pop();}
  }
}
function spawnAll(dt){
  for(let r=0;r<4;r++){const g=REG[r];g.acc+=g.rate*dt;let n=g.acc|0;g.acc-=n;while(n-->0)if(sample(r))spawn(r,sx,sy,false);}
}
// A soft wash of every colour in its place, so no bare canvas shows between the first strokes.
function under(){
  const c=Math.max(5,WS*1.4),uw=Math.ceil(W/c),uh=Math.ceil(H/c);
  const u=document.createElement('canvas');u.width=uw;u.height=uh;
  const g=u.getContext('2d'),im=g.createImageData(uw,uh),d=im.data;
  for(let j=0;j<uh;j++)for(let i=0;i<uw;i++){
    const x=Math.min(W-1,(i+.5)*c),y=Math.min(H-1,(j+.5)*c),reg=regionAt(x,y);
    let col=[8,12,30];
    if(reg===0){field(x,y);col=skyPaint(x,y);}else if(reg===1)col=hillPaint(x,y);else if(reg===2)col=groundPaint(x,y);else if(reg===3)col=cypPaint(x,y);
    const k=(j*uw+i)*4;d[k]=col[0];d[k+1]=col[1];d[k+2]=col[2];d[k+3]=255;
  }
  g.putImageData(im,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(u,0,0,uw*c,uh*c);
}
// Paint the whole picture before anyone sees it: two coats, every stroke run to its end.
function prefill(){
  parts.length=0;
  for(let round=0;round<2;round++){
    for(let r=0;r<4;r++){const g=REG[r];for(let n=g.area/g.sa*1.3|0;n>0;n--)if(sample(r))spawn(r,sx,sy,true);}
    for(let k=0;k<60&&parts.length;k++)stepParts(1/30);
  }
  parts.length=0;
}

/* ---------- painting the city ---------- */
function line(x0,y0,x1,y1){cg.beginPath();cg.moveTo(x0,y0);cg.lineTo(x1,y1);cg.stroke();}
// One stroke of the city's paint, with a lighter and a darker hair of the brush in it, like the strokes of the sky.
function dab(x0,y0,x1,y1,w,c,l,g){
  cg.lineWidth=w;cg.strokeStyle=rgb(c,l);line(x0,y0,x1,y1);
  if(BRISTLES&&w>2.2){
    const dx=x1-x0,dy=y1-y0,d=Math.hypot(dx,dy)||1,nx=-dy/d*w,ny=dx/d*w,o=(g()-.5)*.5;
    cg.lineWidth=w*.2;cg.strokeStyle=rgb(mix(c,PALE,.25),l);line(x0+nx*o,y0+ny*o,x1+nx*o,y1+ny*o);
    cg.strokeStyle=rgb(c,l*.6);line(x0+nx*.38,y0+ny*.38,x1+nx*.38,y1+ny*.38);
  }
}
// A dark outline laid down in short unsteady lengths.
function ink(x0,y0,x1,y1,g){
  const n=Math.max(1,Math.round(Math.hypot(x1-x0,y1-y0)/(.035*H)));
  let px=x0+(g()-.5)*OW,py=y0+(g()-.5)*OW;
  for(let i=1;i<=n;i++){
    const k=i/n,ex=lerp(x0,x1,k)+(g()-.5)*OW*1.1,ey=lerp(y0,y1,k)+(g()-.5)*OW*1.1;
    cg.lineWidth=OW*(.9+.7*g());cg.strokeStyle=g()<.25?'#0d1436':OUT;line(px,py,ex,ey);px=ex;py=ey;
  }
}
// A window is one upright dab of light inside a dark ring. Turning it off paints the wall back over it.
function winDab(b,c,r,on,g){
  const cx=b.px+b.padX+(c+.5)*b.cw,cy=b.py+b.ch*.75+r*b.ch,ww=Math.max(1.5,b.cw*.52),hh=Math.max(.8,b.ch*.34);
  cg.lineCap='butt';
  if(on){
    const pal=WINS[b.win],k=.85+.3*g(),jx=(g()-.5)*ww*.3,jy=(g()-.5)*ww*.3,tilt=(g()-.5)*ww*.3;
    if(g()<.7){cg.lineWidth=ww+OW;cg.strokeStyle=OUT;line(cx,cy-hh-OW*.5,cx,cy+hh+OW*.5);}
    cg.lineWidth=ww*k;cg.strokeStyle=rgb(pal[g()*3|0],.88+.17*g());line(cx+jx-tilt,cy+jy-hh,cx+jx+tilt,cy+jy+hh);
    if(ww>2.6&&g()<.6){cg.lineWidth=ww*.3;cg.strokeStyle=rgb(pal[2]);line(cx+jx-ww*.15,cy+jy-hh*.7,cx+jx-ww*.15,cy+jy+hh*.4);}
  }else{cg.lineCap='round';dab(cx,cy-hh-OW*.4,cx+(g()-.5)*ww*.3,cy+hh+OW*.4,ww+OW*1.5,b.face,.66+.4*g(),g);}
  cg.lineCap='round';
}
function paintNeon(b){
  const n=b.neon;if(!n)return;
  const on=b.dark?0:n.on,c=rgb(mix([18,22,48],n.c,on)),core=rgb(mix([24,28,56],[255,255,255],on*.75)),lw=Math.max(1.6,FS*.9);
  let x0,y0,x1,y1;
  if(n.type==='crown'){x0=b.tx+OW*1.5;x1=b.tx+b.tw-OW*1.5;y0=y1=b.ty+OW*1.8;}
  else if(n.type==='edge'){x0=x1=b.px+OW*1.8;y0=b.py+OW*2;y1=y0+n.len*H;}
  else{x0=x1=b.px+b.pw*n.u;y0=b.py+n.v*H;y1=y0+n.len*H;}
  cg.strokeStyle=c;cg.lineWidth=n.type==='sign'?lw*1.6:lw;line(x0,y0,x1,y1);
  cg.strokeStyle=core;cg.lineWidth=lw*.35;
  if(n.type==='sign')for(let i=0;i<n.n;i++){const y=lerp(y0,y1,(i+.5)/n.n);line(x0-lw*.5,y,x0+lw*.5,y);}
  else line(x0,y0,x1,y1);
}
function beaconDab(b){
  const r=Math.max(1.4,FS*.55);
  cg.fillStyle=b.bon&&!b.dark?'rgb(255,72,58)':'rgb(92,20,30)';cg.beginPath();cg.arc(b.bx,b.by,r,0,TAU);cg.fill();
  if(b.bon&&!b.dark){cg.fillStyle='rgb(255,200,160)';cg.beginPath();cg.arc(b.bx,b.by,r*.45,0,TAU);cg.fill();}
}
// One building: its face in short upright strokes, lighter toward the moon, then windows, a dark outline and whatever stands on its roof.
function paintB(b,g){
  const x=b.px,w=b.pw,y=b.py,yb=b.pb,f=b.face;
  cg.fillStyle=rgb(f,.5);cg.fillRect(x,y,w,yb-y);if(b.set)cg.fillRect(b.tx,b.ty,b.tw,y-b.ty+1);
  cg.save();cg.beginPath();cg.rect(x,y,w,yb-y);if(b.set)cg.rect(b.tx,b.ty,b.tw,y-b.ty+1);cg.clip();
  const fw=FS*1.9;
  for(let n=Math.ceil((w*(yb-y)+(b.set?b.tw*(y-b.ty):0))/(fw*.05*H)*2.4);n>0;n--){
    const cx=x+g()*w,cy=b.ty+g()*(yb-b.ty),len=(.028+.045*g())*H,e=(cx-x)/w,tilt=(g()-.5)*len*.1,a=g();
    dab(cx-tilt,cy-len/2,cx+tilt,cy+len/2,fw*(.7+.6*g()),a<.08?mix(f,PALEB,.3):a<.3?mix(f,TINTS[g()*3|0],.35):f,(.82+.36*smooth(.55,1,e)-.16*smooth(.35,0,e))*(.74+.46*g()),g);
  }
  cg.restore();
  if(!b.dark)for(let r=0;r<b.rows;r++)for(let c=0;c<b.vc;c++)if(b.lit[r*b.cols+c])winDab(b,c,r,true,g);
  // Things on the roof.
  if(b.roof){
    const rx=x+w*b.roof.u,rw=w*b.roof.f,rh=b.roof.h*H;
    for(let c=rx+FS*.5;c<rx+rw;c+=FS*1.2)dab(c,y-rh+FS*.5,c,y,FS*1.6,f,.55+.3*g(),g);
    ink(rx,y,rx,y-rh,g);ink(rx,y-rh,rx+rw,y-rh,g);ink(rx+rw,y-rh,rx+rw,y,g);
  }
  if(b.pitch){
    const ph=b.pitch*H,ax=x+w*b.su;
    cg.fillStyle=rgb(f,.7);cg.beginPath();cg.moveTo(x-1,y+1);cg.lineTo(ax,y-ph);cg.lineTo(x+w+1,y+1);cg.closePath();cg.fill();
    for(let i=0;i<5;i++){const k=.12+.17*i,s=i%2?x:x+w;dab(lerp(ax,s,k),lerp(y-ph,y,k)+FS*.8,lerp(ax,s,k+.2),lerp(y-ph,y,k+.2)+FS*.8,FS*1.3,f,.55+.55*g(),g);}
    ink(x-1,y+1,ax,y-ph,g);ink(ax,y-ph,x+w+1,y+1,g);
  }
  ink(x,yb,x,y,g);
  if(b.set){ink(x,y,b.tx,y,g);ink(b.tx,y,b.tx,b.ty,g);ink(b.tx,b.ty,b.tx+b.tw,b.ty,g);ink(b.tx+b.tw,b.ty,b.tx+b.tw,y,g);ink(b.tx+b.tw,y,x+w,y,g);}
  else ink(x,y,x+w,y,g);
  ink(x+w,y,x+w,yb,g);
  // Moonlight along the right edge and the roof line.
  cg.strokeStyle='rgba(150,185,225,.5)';cg.lineWidth=OW*.6;line(x+w-OW*1.4,y+OW*2,x+w-OW*1.4+(g()-.5)*OW,yb);
  cg.strokeStyle='rgba(150,185,225,.3)';line(b.tx+OW*2,b.ty+OW*1.3,b.tx+b.tw-OW*2,b.ty+OW*1.3);
  if(b.spire){
    cg.strokeStyle='#0c1230';cg.lineWidth=OW;line(b.bx,b.ty,b.bx,b.by);
    cg.strokeStyle='rgba(120,150,200,.5)';cg.lineWidth=OW*.4;line(b.bx+OW*.35,b.ty,b.bx+OW*.35,b.by);
    if(b.beacon)beaconDab(b);
  }
  paintNeon(b);
}
// Repaint one building in fresh strokes, then everything that stands in front of it, so the paint in the city never sits still either.
function boil(b){
  const set=[b];
  for(let r=b.row+1;r<3;r++)for(const o of rowsVis[r])if(set.some(s=>s.row<r&&o.px<s.px+s.pw+3&&o.px+o.pw>s.px-3))set.push(o);
  for(const s of set)paintB(s,P);
}
// Windows and signs only, for when a district loses its power or gets it back.
function lights(b){
  if(!b.vis)return;
  for(let r=0;r<b.rows;r++)for(let c=0;c<b.vc;c++)if(b.lit[r*b.cols+c])winDab(b,c,r,!b.dark,P);
  paintNeon(b);if(b.spire&&b.beacon)beaconDab(b);
}

/* ---------- layout ---------- */
function layout(){
  W=Math.max(1,innerWidth);H=Math.max(1,innerHeight);S=Math.sqrt(W*H);Wi=Math.ceil(W);Hi=Math.ceil(H);
  // The canvas holds at most about 2.6 megapixels: the strokes are far wider than a pixel, so more would only cost time.
  K=Math.min(Math.min(N.LOWQ?1:2.5,devicePixelRatio||1),Math.sqrt((N.LOWQ?9e5:2.6e6)/(W*H)));
  for(const c of[cv,cvC]){c.width=Math.max(1,Math.round(W*K));c.height=Math.max(1,Math.round(H*K));c.style.width=W+'px';c.style.height=H+'px';}
  ctx.setTransform(K,0,0,K,0,0);cg.setTransform(K,0,0,K,0,0);ctx.lineCap='round';cg.lineCap='round';
  WS=clamp(.0062*S,1.8,11);FS=clamp(.0042*S,1.6,6);OW=clamp(.0028*S,1.3,3.6);
  K1=TAU/(.9*S);K2=TAU/(.37*S);K2y=TAU/(.8*S);A2=.014*S;BK=TAU/(.055*S);NK=1/(.12*S);HB=TAU/(.04*S);
  // Three ridges, each nearer and darker than the last, rising toward the right.
  hillY=new Float32Array(Wi);groundY=new Float32Array(Wi);coverY=new Float32Array(Wi).fill(H+10);
  RY=[0,1,2].map(()=>new Float32Array(Wi));SL=[0,1,2].map(()=>new Float32Array(Wi));
  const base=[.615,.665,.715],rise=[.075,.06,.04];
  for(let i=0;i<Wi;i++){
    const u=i/W,xs=i/H;
    for(let k=0;k<3;k++){const p=WORLD.hills[k];RY[k][i]=H*(base[k]-rise[k]*smooth(.2,1,u)+.016*Math.sin(xs*5.1+p[0])+.01*Math.sin(xs*11.3+p[1])+(k?0:.006*Math.sin(xs*23+p[2])));}
    hillY[i]=Math.min(RY[0][i],RY[1][i],RY[2][i]);
    groundY[i]=H*(.87+.02*Math.sin(xs*9+WORLD.ph[7])+.012*Math.sin(xs*21+WORLD.ph[1]));
  }
  for(let k=0;k<3;k++)for(let i=0;i<Wi;i++)SL[k][i]=(RY[k][Math.min(Wi-1,i+1)]-RY[k][Math.max(0,i-1)])/2;
  // The cypresses keep to the edges, and the city stands clear of them.
  const c=WORLD.cyp,cw=Math.min(.068*H,.105*W);
  for(const t of TREES){
    t.W=cw*t.w;t.top=Math.round(t.tip*H);
    if(t===c)t.X=Math.max(c.u*W,t.W*1.45);else if(t.side<0)t.X=Math.max(t.W*.7,c.X+t.off*cw);else t.X=Math.min(W-t.W*.9,t.u*W);
    t.L=new Float32Array(Hi).fill(1e9);t.R=new Float32Array(Hi).fill(-1e9);t.C=new Float32Array(Hi);
  }
  // A narrow window keeps fewer of them, so the city always has at least half the width.
  let on=TREES.length;
  do{
    cutX=0;cutR=W+10;
    for(let i=0;i<on;i++){const t=TREES[i];if(t.side<0)cutX=Math.max(cutX,t.X+t.W*(t===c?2.2:1.9));else cutR=Math.min(cutR,t.X-t.W*1.5);}
  }while(Math.min(W,cutR)-cutX<.5*W&&--on>1);
  TREES.forEach((t,i)=>{t.on=i<on;});
  // Place the buildings in view, and note how high the city covers each column, so no stroke is wasted behind it.
  vis=[];rowsVis=[[],[],[]];beacons=[];
  // Buildings are as wide as the window is tall allows, but narrower on an upright screen, so a phone still sees a skyline.
  CU=Math.min(H,W*1.25);
  const coreX=WORLD.core*W,bot=[.9,.965,1];
  for(const b of CITY){
    let x0=coreX+b.x*CU,x1=x0+b.w*CU;b.vis=false;
    if(x1<cutX+4||x0>Math.min(W+2,cutR-4))continue;
    if(x0<cutX){if(x1-cutX<.03*CU)continue;x0=cutX;}
    if(x1>cutR){if(cutR-x0<.03*CU)continue;x1=cutR;}
    b.vis=true;b.px=x0;b.pw=x1-x0;b.py=b.top*H;b.pb=bot[b.row]*H;
    b.ch=b.cell*H;b.vc=clamp(Math.round(b.pw/(b.ch*1.2)),1,b.cols);b.padX=b.pw*.12;b.cw=(b.pw-2*b.padX)/b.vc;b.rows=clamp(Math.floor((b.pb-b.py-b.ch*.5)/b.ch),0,64);
    if(b.set){b.tw=b.pw*b.set.f;b.tx=b.px+b.pw*b.set.a;b.ty=b.py-b.set.h*H;}else{b.tw=b.pw;b.tx=b.px;b.ty=b.py;}
    b.bx=b.set?b.tx+b.tw/2:b.px+b.pw*b.su;b.by=b.ty-b.spire*H;
    for(let i=Math.max(0,b.px|0),e=Math.min(Wi-1,Math.ceil(b.px+b.pw));i<=e;i++)coverY[i]=Math.min(coverY[i],(i>=b.tx&&i<=b.tx+b.tw?b.ty:b.py)+2);
    vis.push(b);rowsVis[b.row].push(b);if(b.spire&&b.beacon)beacons.push(b);
  }
  REG[0].s=mkSamp(()=>0,i=>Math.min(hillY[i],coverY[i]));
  REG[1].s=mkSamp(i=>hillY[i],i=>Math.min(groundY[i],coverY[i]));
  REG[2].s=mkSamp(i=>groundY[i],i=>Math.min(H,coverY[i]));
  for(let r=0;r<3;r++)REG[r].area=REG[r].s.area;
  drift(0);fieldUpdate();cypUpdate();rates();
  cg.clearRect(0,0,W,H);
  for(const b of vis)paintB(b,stream(b.seed));
  under();prefill();
}

/* ---------- events ---------- */
// Each kind of event has its own timer with exponentially distributed gaps: m is the average gap in seconds, f the average wait for the first.
const SCHED={window:{m:1.2,f:.6},boil:{m:.55,f:.5},flare:{m:38,f:9},curl:{m:55,f:14},gust:{m:75,f:28},av:{m:85,f:24},neon:{m:42,f:16},meteor:{m:125,f:45},mist:{m:140,f:60},moon:{m:170,f:70},unwind:{m:290,f:130},calm:{m:340,f:160},turn:{m:520,f:260},blackout:{m:580,f:250}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
// A loose stroke that keeps its own course: a shooting star or the lights of a flying car.
function loose(o){parts.push(Object.assign({lx:o.x,ly:o.y,ox:o.x,oy:o.y,nx:0,ny:0,has:false,reg:0,age:0,free:true,o1:0,o2:.3,s2:9},o));}
function fire(k){
  switch(k){
    case'window':{
      const b=pick(vis);if(!b||b.dark||b.rows<1)break;
      const c=ri(0,b.vc-1),r=ri(0,b.rows-1),i=r*b.cols+c;b.lit[i]^=1;winDab(b,c,r,!!b.lit[i],P);break;
    }
    case'boil':{const b=pick(vis);if(b)boil(b);break;}
    case'flare':{const s=pick(WORLD.stars);s.fl={age:0,dur:rr(7,13),up:2.5,down:4};log(`${s.k===2?'An':'A'} ${KINDS[s.k]} star swells in its halo`);break;}
    case'curl':{
      const from=wind>=0?-1:1;
      trav.push({u:from<0?-.1:1.1,v:rr(.1,.45),r:rr(.05,.1),g:(chance(.75)?1:-1)*rr(1.6,2.6),age:0,life:rr(80,140),o:rr(0,999)});
      stats.swirls++;log(`A new swirl curls in from the ${from<0?'left':'right'}`);break;
    }
    case'gust':E.gust={age:0,dur:rr(6,12),up:2,down:4,amp:rr(.7,1.4)};log('A gust runs through the sky');break;
    case'av':{
      const d=chance(.5)?1:-1,sp=rr(.07,.11)*S,c=pick(NEONS);
      loose({x:d>0?-10:W+10,y:rr(.3,.52)*H,vx:d*sp,vy:rr(-.012,.012)*S,wob:rr(.004,.012)*S,wf:rr(.3,.8),life:(W+60)/sp,w:Math.max(1.8,WS*.5),flat:true,ghost:true,
        s2:(WS*.8)**2,c:rgb(c),ch:'rgb(255,255,255)',cd:rgb(c,.6)});
      log('A flying car crosses between the towers');break;
    }
    case'neon':{
      const list=vis.filter(b=>b.neon&&!b.dark);if(!list.length)break;
      const b=pick(list);
      if(chance(.5)){b.neon.c=pick(NEONS);paintNeon(b);log('A neon sign changes colour');}
      else if(!flick){flick={b,t:rr(1,3.5),n:0};log('A neon sign flickers');}
      break;
    }
    case'meteor':{
      const d=chance(.5)?1:-1,a=rr(.25,.8),sp=rr(.7,1.1)*S;
      loose({x:rr(.1,.9)*W,y:rr(.03,.3)*H,vx:d*Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rr(.45,.8),w:WS*rr(.7,1),c:'rgb(255,248,210)',ch:'rgb(255,255,255)',cd:'rgb(246,216,98)'});
      log('A shooting star leaves a streak of wet paint');break;
    }
    case'mist':E.mist={age:0,dur:rr(40,80),up:12,down:16};log('Pale cloud rolls in along the hills');break;
    case'moon':E.moon={age:0,dur:rr(20,40),up:6,down:10};log('The halo of the moon widens');break;
    case'unwind':E.unwind={age:0,dur:rr(45,80),up:12,down:14};log('The great swirls unwind, then curl up again');break;
    case'calm':E.calm={age:0,dur:rr(30,60),up:8,down:10};log('The sky slows almost to a stop');break;
    case'turn':dirT=-dirT;log('The wind turns and the sky flows the other way');break;
    case'blackout':{
      if(blackout||!vis.length)break;
      const b0=pick(vis),cx=b0.px+b0.pw/2,r=rr(.1,.24)*CU;
      blackout={list:CITY.filter(b=>b.vis&&Math.abs(b.px+b.pw/2-cx)<r),i:0,j:0,age:0,back:rr(25,90),tick:0};
      log('A district of the city goes dark');break;
    }
  }
}

/* ---------- the world, each step ---------- */
// The slow things: wind, the tempo of the brush, the waves in the wind, the band of light over the hills and the mood of the blues.
function drift(dt){
  dir+=clamp(dirT-dir,-dt/14,dt/14);
  const gu=E.gust?ev(E.gust)*E.gust.amp:0;
  wind=dir*(.85+.3*noise(T/23+WORLD.ph[2]))*(1+gu)*(1-.82*ev(E.calm));
  U0=.05*S*(.9+.2*noise(T/37+WORLD.ph[3]));
  A1=.035*S*(1+.6*gu);
  ph1-=dt*.12*wind;ph2-=dt*.2*wind;bandPh+=dt*.03;
  mistK=.8+.4*noise(T/41+WORLD.ph[4])+.7*ev(E.mist);
  moodK=(noise(T/97+WORLD.ph[5])-.5)*.08;
}
function update(dt){
  T+=dt;
  for(const k in SCHED){nextEv[k]-=dt;if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);fire(k);}}
  for(const k in E){const e=E[k];if(e){e.age+=dt;if(e.age>=e.dur)E[k]=null;}}
  for(const s of WORLD.stars)if(s.fl){s.fl.age+=dt;if(s.fl.age>=s.fl.dur)s.fl=null;}
  // Swirls that came in on the wind ride it across the sky and fade.
  for(let i=trav.length-1;i>=0;i--){const v=trav[i];v.age+=dt;v.u+=wind*.0085*dt;if(v.age>=v.life||v.u<-.25||v.u>1.25)trav.splice(i,1);}
  drift(dt);fieldUpdate();cypUpdate();rates();
  // The city: beacons blink, a sign may be flickering, a district may be dark.
  for(const b of beacons){b.bt-=dt;if(b.bt<=0){b.bon=!b.bon;b.bt=b.bon?.35:b.bp;beaconDab(b);}}
  if(flick){
    flick.t-=dt;flick.n-=dt;
    if(flick.t<=0){flick.b.neon.on=1;paintNeon(flick.b);flick=null;}
    else if(flick.n<=0){flick.n=rr(.05,.28);flick.b.neon.on=flick.b.neon.on>.5?rr(0,.3):1;paintNeon(flick.b);}
  }
  if(blackout){
    const o=blackout;o.age+=dt;o.tick-=dt;
    if(o.tick<=0){
      o.tick=rr(.05,.3);
      if(o.i<o.list.length){const b=o.list[o.i++];b.dark=true;lights(b);}
      else if(o.age>o.back){
        if(o.j<o.list.length){const b=o.list[o.j++];b.dark=false;lights(b);}
        else{log('The lights come back on');blackout=null;}
      }
    }
  }
  spawnAll(dt);stepParts(dt);
}
// Every stroke goes onto the canvas as it moves, so there is nothing left to draw at the end of a frame.
function draw(){}

function rebuild(){layout();}
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(rebuild,150);});

/* ---------- start ---------- */
function state(){
  return{time:+T.toFixed(1),wind:+wind.toFixed(2),dir:dirT,tempo:+U0.toFixed(1),strokes:parts.length,rate:REG.map(g=>Math.round(g.rate)),
    swirls:WORLD.swirls.length,travellers:trav.length,trees:TREES.filter(t=>t.on).map(t=>+(1-t.tip).toFixed(2)),stars:WORLD.stars.map(s=>KINDS[s.k]),flares:WORLD.stars.filter(s=>s.fl).length,
    envelopes:Object.keys(E).filter(k=>E[k]),city:{buildings:vis.length,beacons:beacons.length,blackout:!!blackout,flicker:!!flick},
    canvas:{W,H,scale:+K.toFixed(2),stroke:+WS.toFixed(1)},stats:{...stats}};
}
layout();
N.log(`Wet paint: ${WORLD.stars.length} stars, a crescent moon, ${TREES.length>1?TREES.length+' cypresses':'one cypress'} and ${WORLD.dir>0?'a westerly':'an easterly'} wind over Night City`);
N.stats(stats);
if(N.DEBUG)window.SN={WORLD,CITY,pause(){N.paused=true;},resume(){N.paused=false;},run(s){for(let t=0;t<s;t+=1/30)update(1/30);},step(s){N.paused=true;for(let t=0;t<s;t+=1/60)update(Math.min(1/60,s-t));},
  draw,fire,state,rebuild,nextEv,get parts(){return parts;}};
N.run({update(dt){update(dt);N.stats(stats);},draw,step:1/60});
})();
