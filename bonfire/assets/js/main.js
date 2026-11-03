/* Bonfire: a pixel-art campfire in a clearing deep in the mountains, with Night City glowing far away between the ridges.
   Every choice comes from the shared seeded generator in ../assets/js/nightcity.js, so no two nights burn the same way. */
(()=>{
'use strict';
const cv=document.getElementById('scene');
const ctx=cv.getContext('2d');
const N=NightCity;
const{R,rr,ri,pick,chance,expo,gauss,wpick,noise,fbm}=N;

/* ---------- helpers ---------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
const mix=(a,b,k)=>[lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k)];
const css=(c,a=1)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return[c,c.getContext('2d')];}
const B4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>v/16);
const bayer=(x,y)=>B4[(y&3)*4+(x&3)];
// Static detail comes from a seeded hash of its position, so a resize repaints the same world without drawing new numbers.
const SALT=Math.floor(R()*4294967296);
function hash(a,b,c){let h=Math.imul(a|0,374761393)+Math.imul(b|0,668265263)+Math.imul((c|0)+SALT,2246822519);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296;}
function vn(x,y,s,k,wy){
  const gx=x/s,gy=y/s,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
  const ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
  const y0=wy?iy%wy:iy,y1=wy?(iy+1)%wy:iy+1;
  return lerp(lerp(hash(ix,y0,k),hash(ix+1,y0,k),ux),lerp(hash(ix,y1,k),hash(ix+1,y1,k),ux),uy);
}
function glowSprite(r,c,amax){
  const S=r*2+1;const[cn,g]=mk(S,S);const img=g.createImageData(S,S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const d=Math.hypot(x-r,y-r)/r;if(d>=1)continue;const i=(y*S+x)*4;img.data[i]=c[0];img.data[i+1]=c[1];img.data[i+2]=c[2];img.data[i+3]=255*amax*(1-d)*(1-d);}
  g.putImageData(img,0,0);return cn;
}
// Colours in the hot paths come from fixed palettes, so each keeps its CSS string.
const dot=(x,y,c,a=1)=>{ctx.globalAlpha=a;ctx.fillStyle=c.s||(c.s=css(c));ctx.fillRect(Math.round(x),Math.round(y),1,1);};

/* ---------- the world, picked once ---------- */
const GLOWS=[['amber',[255,150,70]],['rose',[232,90,140]],['teal',[70,190,210]],['sodium',[255,118,40]],['violet',[150,96,235]]];
const BEASTS=[[['fox',[214,255,140],2,1,1,'A fox pauses at the edge of the trees, eyes shining'],4],[['wolves',[226,240,170],2,2,4,'Wolves watch from the treeline'],3],[['deer',[170,255,170],3,1,3,'Deer eyes glint between the trees'],3],[['cat',[255,186,90],3,1,1,'Something large and quiet watches from the dark'],1],[['owl',[255,214,120],1,1,1,'An owl\'s eyes catch the firelight'],2]];
const STARC=[[255,255,255],[190,210,255],[255,226,190]];
const NEON=[[255,80,170],[80,240,255],[190,110,255],[120,255,160]];
const WINC=[[[255,204,128],[255,178,96]],[[196,222,255],[160,200,255]],null];
const side=chance(.5)?-1:1;
const WORLD={
  side,cityX:.5+side*rr(.2,.26),size:rr(.8,1.2),shape:wpick([['core',3],['twin',2],['sprawl',2]]),
  glowA:pick(GLOWS),glowB:pick(GLOWS),glowK:rr(.5,1),sprawl:rr(.5,1),
  moon:chance(.55)?{x:side<0?rr(.58,.9):rr(.1,.42),y:rr(.12,.4),phase:rr(.25,1),r:ri(6,8)}:null,
  milky:{a:rr(-.2,.7),b:rr(-.2,.7),w:rr(.07,.14)},
  off:[0,1,2,3,4,5,6,7].map(()=>rr(0,3000)),
  runway:chance(.5)?1:-1,airport:rr(1.1,1.5),highway:chance(.75),
  props:[],
  edge:[],stones:[],logs:[],tongues:[],cons:[],
};
for(const s of[-1,1]){const n=ri(1,2);for(let i=0;i<n;i++)WORLD.edge.push({u:s<0?rr(-.06,.05):rr(.95,1.06),h:rr(.85,1.4),w:rr(.75,1)});}
for(let i=ri(2,4);i>0;i--){
  const pts=[[0,0]];let a=rr(0,6.28),x=0,y=0;
  for(let j=ri(3,6);j>0;j--){a+=rr(-1.3,1.3);const l=rr(6,13);x+=Math.cos(a)*l;y+=Math.sin(a)*l*.8;pts.push([x,y]);}
  WORLD.cons.push({u:rr(.06,.94),v:rr(.08,.55),pts,b:rr(.55,.8)});
}
// The camp: logs to sit on at their own angles, sometimes two side by side, maybe a stump and a woodpile.
// Each sits at an angle round the fire, never straight in front of it.
{
  const slots=N.shuffle([-2.75,-2.05,-1.1,-.4,.3,2.85]),take=()=>slots.pop();
  for(let i=wpick([[0,1],[1,3],[2,4],[3,2]]);i>0;i--){
    const a=take(),pair=chance(.3);
    WORLD.props.push({kind:'log',a,d:rr(1.5,2.2),len:rr(18,30),th:rr(5,7),tilt:rr(-.35,.35),pair,gap:rr(1.1,1.5),tilt2:rr(-.25,.25)});
  }
  if(chance(.7))WORLD.props.push({kind:'stump',a:take(),d:rr(1.5,2.1),mug:chance(.6)});
  if(chance(.7))WORLD.props.push({kind:'pile',a:take(),d:rr(2,2.6),rows:ri(2,3)});
}
const BUILD=[];
{
  const centers=WORLD.shape==='twin'?[-rr(.3,.5),rr(.3,.5)]:[rr(-.15,.15)];
  const n=Math.round(rr(30,46)*WORLD.size);
  for(let i=0;i<n;i++){
    const u=WORLD.shape==='sprawl'?rr(-1.1,1.1):clamp(pick(centers)+gauss()*.33,-1.2,1.2);
    const core=Math.max(...centers.map(c=>Math.exp(-(((u-c)/(WORLD.shape==='sprawl'?.6:.32))**2))));
    BUILD.push({u,w:ri(2,4)+(core>.6&&chance(.4)?1:0),h:3+core*rr(4,24)+rr(0,4),tone:R(),win:wpick([[0,6],[1,3],[2,1]]),neon:pick(NEON),dens:rr(.2,.65),ant:false,beacon:0});
  }
  for(let i=ri(1,3);i>0;i--)BUILD.push({u:pick(centers)+rr(-.15,.15),w:ri(3,5),h:rr(26,42),tone:rr(.5,1),win:wpick([[0,5],[1,4],[2,1]]),neon:pick(NEON),dens:rr(.3,.6),ant:chance(.7),beacon:rr(1,2.2),crown:chance(.4)?pick(NEON):null});
  BUILD.sort((a,b)=>a.tone-b.tone);
}
{
  const n=ri(9,13);
  for(let i=0;i<n;i++)WORLD.stones.push({a:i/n*Math.PI*2+rr(-.15,.15),w:rr(5,9),h:rr(.55,.8),tone:rr(.85,1.25)});
  // A low stack over the coals, like a real campfire: thick logs lying across, and short ones on top pointing at us, cut ends showing.
  // Positions are in fire units, one unit to a pixel at the standard size.
  WORLD.logs.push({type:'lie',x1:-rr(15,20),y1:-5+rr(-1,1),x2:rr(15,20),y2:-5+rr(-1.5,1.5),th:rr(6,7),front:false});
  // The front log lies across one side only, so the coals show on the other.
  const fs=chance(.5)?-1:1;
  WORLD.logs.push({type:'lie',x1:fs*rr(17,22),y1:3+rr(-1,1),x2:-fs*rr(-4,4),y2:-rr(0,2.5),th:rr(6,7.5),front:true});
  const ends=ri(2,4);
  for(let i=0;i<ends;i++)WORLD.logs.push({type:'end',x:lerp(-11,11,ends>1?i/(ends-1):.5)+rr(-2.5,2.5),y:-rr(5,8.5),r:rr(3.2,4.6),charred:chance(.35),front:chance(.8)});
  if(chance(.5))WORLD.logs.push({type:'lie',x1:-rr(8,14),y1:-rr(7,11),x2:rr(6,13),y2:-rr(3,8),th:rr(4,5.5),front:true});
  // Flames rise in a few tongues from the gaps between the logs.
  for(let i=ri(4,6);i>0;i--)WORLD.tongues.push({x:rr(-15,15),w:rr(1.5,3),s:rr(.55,1),ph:rr(0,100)});
}

/* ---------- layout ---------- */
let S=2,W=0,H=0,hz=0,pd=0,vk=1,hk=1,spread=40,cx=0,fx=0,fy=0,gy=0,fk=1,ax=0,ry=0,rl=10;
let vig,grain,grainT=0,gx=0,gy2=0;
let farC,farG,nearC,fgB,fgBL,fgF,fgFL,scratch,sctx,skyLim,stars=[],cityWins=[],beacons=[],crowns=[],road=null;
let airGlow,landGlow,coalGlow,moonGlow;
const ridgeTop=[];
function layout(){
  S=Math.max(2,Math.round(Math.min(innerWidth/500,innerHeight/290)));
  W=Math.ceil(innerWidth/S);H=Math.ceil(innerHeight/S);
  cv.width=W;cv.height=H;cv.style.width=W*S+'px';cv.style.height=H*S+'px';
  const tall=H>W*1.1;
  vk=clamp(H/300,.8,1.5);hk=clamp(H/300,.85,1.3);
  hz=Math.round(H*(tall?.4:.5));pd=Math.round(13*vk);
  spread=Math.round(clamp(W*.17,28,80)*WORLD.size);
  cx=Math.round(W*(tall?.5+WORLD.side*.19:WORLD.cityX));
  ax=Math.round(cx-WORLD.side*spread*WORLD.airport);ry=hz+Math.round(pd*.4);rl=Math.round(10*vk);
  fk=clamp(H/220,1,2.6);
  fireAlloc(Math.round(clamp(H*.114,26,60)),Math.round(46*fk/2)*2);
  fx=Math.round(W/2);fy=Math.round(H*(tall?.8:.85));
  gy=hz+pd+Math.round(36*vk);
  airGlow=glowSprite(Math.round(H*.22),[255,120,50],.2);
  coalGlow=glowSprite(Math.round(30*fk),[255,90,40],.4);
  landGlow=glowSprite(4,[255,250,230],.6);
  moonGlow=glowSprite(Math.round((WORLD.moon?WORLD.moon.r:4)*3.5),[200,210,255],.2);
  [scratch,sctx]=mk(FW*2,FH*2);
  paintGrade();
  ctx.imageSmoothingEnabled=false;
  paintFar();paintNear();paintFg();
}

/* ---------- sky, far mountains and the city ---------- */
const SKY=[[0,[3,4,12]],[.55,[8,10,28]],[1,[26,22,48]]];
function skyCol(f){for(let i=1;i<SKY.length;i++)if(f<=SKY[i][0]){const[f0,c0]=SKY[i-1],[f1,c1]=SKY[i];return mix(c0,c1,(f-f0)/(f1-f0));}return SKY[2][1];}
function glowAt(x,y){return WORLD.glowK*Math.exp(-(((x-cx)/(spread*2.6))**2)-(((y-hz)/(hz*.45))**2));}
function glowCol(y){return mix(WORLD.glowA[1],WORLD.glowB[1],clamp((hz-y)/(hz*.5),0,1));}
function quant(v,x,y){return clamp(Math.round((v+(bayer(x,y)-.5)*6)/6)*6,0,255);}
function backTop(x){const v=Math.exp(-(((x-cx)/(spread*1.4))**2));return hz-(6+26*fbm(x/60+WORLD.off[0]))*vk*(1-.55*v);}
function paintFar(){
  [farC,farG]=mk(W,H);
  skyLim=new Int16Array(W);
  const tops=new Float32Array(W);
  for(let x=0;x<W;x++){tops[x]=backTop(x);skyLim[x]=Math.floor(tops[x]);}
  const img=farG.createImageData(W,H),d=img.data;
  const m=WORLD.milky,ma=m.a*hz,mb=m.b*hz,mlen=Math.hypot(W,mb-ma),mw=m.w*Math.max(W,hz);
  const moon=WORLD.moon,mx=moon?moon.x*W:0,my=moon?moon.y*hz:0;
  for(let y=0;y<hz+pd+2;y++)for(let x=0;x<W;x++){
    let c;
    const g=glowAt(x,y);
    if(y<tops[x]){
      c=skyCol(y/hz);
      const dist=Math.abs((mb-ma)*x-W*(y-ma))/mlen;
      const band=Math.exp(-((dist/mw)**2))*(.35+.65*vn(x,y,7,31))*(1-.6*vn(x+50,y,4,32))*(1-clamp(g*1.6,0,1));
      c=mix(c,[54,52,82],band*.45);
      if(moon){const md=Math.hypot(x-mx,y-my)/(hz*.7);c=mix(c,[34,40,70],Math.max(0,1-md)*.35);}
    }else if(y<hz){
      const depth=clamp((y-tops[x])/14,0,1);
      c=mix([30,28,52],[16,15,30],depth);
      if(y-tops[x]<1&&moon)c=mix(c,[70,74,104],.5);
    }else{
      c=mix([14,13,24],[8,8,16],(y-hz)/pd);
    }
    const gc=glowCol(y);c=[c[0]+gc[0]*g*.32,c[1]+gc[1]*g*.32,c[2]+gc[2]*g*.32];
    const i=(y*W+x)*4;d[i]=quant(c[0],x,y);d[i+1]=quant(c[1],x,y);d[i+2]=quant(c[2],x,y);d[i+3]=255;
  }
  farG.putImageData(img,0,0);
  // Stars thin out in the city's glow. Most are faint and a few are bright, and each one dims now and then on its own slow clock.
  stars=[];
  const hidden=(x,y)=>x<0||y<0||x>=W||y>=skyLim[x]-1||(moon&&Math.hypot(x-mx,y-my)<moon.r+1.5);
  const addStar=(x,y,b,i)=>{const h=hash(i,4,21);stars.push({x,y,b,c:h<.15?STARC[1]:h>.92?STARC[2]:STARC[0],ph:hash(i,5,21)*500,rate:.05+hash(i,6,21)*.25,depth:.3+hash(i,7,21)*.6});};
  const n=Math.round(W*hz/150);
  for(let i=0;i<n;i++){
    const x=Math.floor(hash(i,1,21)*W),y=Math.floor(Math.pow(hash(i,2,21),1.35)*hz),b=Math.pow(hash(i,3,21),2.4);
    if(!hidden(x,y)&&b>=glowAt(x,y)*.6-.05)addStar(x,y,b,i);
  }
  // A few loose groups of slightly brighter stars, with nothing drawn between them.
  WORLD.cons.forEach((c,ci)=>c.pts.forEach(([dx,dy],j)=>{const x=Math.round(c.u*W+dx*vk),y=Math.round(c.v*hz+dy*vk);if(!hidden(x,y))addStar(x,y,c.b*(.8+.4*hash(ci,j,22)),1e5+ci*16+j);}));
  if(moon)paintMoon(mx,my);
  // The city: buildings across the plain, windows a pixel each, and the lights of the suburbs spreading toward us.
  cityWins=[];beacons=[];crowns=[];
  for(let y=hz+1;y<hz+pd;y++){
    const f=(y-hz)/pd,reach=spread*(1.4+f*1.6)*(.6+WORLD.sprawl*.6);
    for(let x=Math.max(0,Math.floor(cx-reach*1.6));x<Math.min(W,cx+reach*1.6);x++){
      const p=.42*Math.exp(-(((x-cx)/reach)**2))*(1-f*.5);
      const h=hash(x,y,41);if(h>p)continue;
      const c=hash(x,y,42);farG.globalAlpha=.35+.6*hash(x,y,43);
      farG.fillStyle=c<.7?'#ffb060':c<.9?'#fff0d0':'#8ae8ff';farG.fillRect(x,y,1,1);
    }
  }
  farG.globalAlpha=1;
  BUILD.forEach((b,bi)=>{
    const base=hz+Math.round(b.tone*pd*.25),h=Math.round(b.h*hk),bx=Math.round(cx+b.u*spread-b.w/2),top=base-h;
    const col=mix([30,28,48],[10,10,20],b.tone);
    farG.fillStyle=css(col);farG.fillRect(bx,top,b.w,h);
    for(let x=bx;x<bx+b.w;x++)if(x>=0&&x<W)skyLim[x]=Math.min(skyLim[x],top);
    const wc=WINC[b.win]||[b.neon,mix(b.neon,[255,255,255],.4)];
    for(let y=top+1;y<base-1;y+=2)for(let x=bx+(b.w>2?1:0);x<bx+b.w-(b.w>3?1:0);x+=b.w>4?2:1){
      const on=hash(x,y,bi+50)<b.dens;const c=hash(x,y,bi+90)<.5?wc[0]:wc[1];
      const w={x,y,c,bc:col,on};cityWins.push(w);
      if(on){farG.fillStyle=css(c);farG.fillRect(x,y,1,1);}
    }
    if(b.ant){
      const ah=Math.round(rr0(b,3,7)*hk),x=bx+(b.w>>1);
      farG.fillStyle=css(col);farG.fillRect(x,top-ah,1,ah);beacons.push({x,y:top-ah,per:b.beacon,ph:b.u*7});
      if(x>=0&&x<W)skyLim[x]=Math.min(skyLim[x],top-ah);
    }
    else if(b.beacon)beacons.push({x:bx+(b.w>>1),y:top-1,per:b.beacon,ph:b.u*7});
    if(b.crown)crowns.push({x:bx,y:top,w:b.w,c:b.crown,ph:b.u*11});
  });
  // Runway lights and the highway out of the city.
  for(let i=0;i<=rl;i+=2){farG.fillStyle='#7aa8ff';farG.fillRect(ax-rl/2+i,ry,1,1);}
  road=WORLD.highway?{x0:cx-WORLD.side*spread*.2,y0:hz+2,x1:WORLD.side<0?-8:W+8,y1:hz+pd-1}:null;
  if(road){road.x1=road.x0+(road.x1-road.x0)*1;road.len=Math.hypot(road.x1-road.x0,road.y1-road.y0);}
}
// The antenna height comes from the building, so it stays the same through a resize.
function rr0(b,a,c){return a+(c-a)*((b.u*7919%1+1)%1);}
// Only the lit part of the moon is drawn. Its dark side still hides the stars behind it.
function paintMoon(mx,my){
  const m=WORLD.moon,r=m.r;
  farG.globalCompositeOperation='lighter';farG.drawImage(moonGlow,Math.round(mx-moonGlow.width/2),Math.round(my-moonGlow.height/2));farG.globalCompositeOperation='source-over';
  for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){
    if(x*x+y*y>r*r+r*.6)continue;
    const span=Math.sqrt(Math.max(0,r*r-y*y)),term=(1-2*m.phase)*span;
    if(x<term)continue;
    const edge=Math.hypot(x,y)/r,mare=vn(x+20,y+20,3,61);
    farG.fillStyle=mare>.62?'#c9c2ab':x-term<1.2||edge>.92?'#dcd5bf':'#f0eada';
    farG.fillRect(Math.round(mx)+x,Math.round(my)+y,1,1);
  }
}

/* ---------- the ridges between us and the city ---------- */
const RIDGE=[[1,16,50,1.5,.35],[8,20,42,1.9,.55],[18,22,34,2.3,.75],[30,16,26,2.8,.9]];
function paintNear(){
  [nearC]=mk(W,H);const g=nearC.getContext('2d');
  const img=g.createImageData(W,H),d=img.data;
  const haze=mix([34,30,56],WORLD.glowA[1],.08);
  RIDGE.forEach(([b,a,f,gw,dark],j)=>{
    const base=hz+pd+b*vk,amp=a*vk,top=new Float32Array(W);
    for(let x=0;x<W;x++){const v=Math.exp(-(((x-cx)/(spread*gw))**2));top[x]=base-amp*fbm(x/f+WORLD.off[j+1])*(1-.97*v);}
    // Pines along the nearer ridgelines, shorter down in the valley.
    if(j>=1)for(let x=-4;x<W+4;x+=2+Math.floor(hash(x,j,71)*3)){
      const v=Math.exp(-(((x-cx)/(spread*gw))**2)),th=(1.5+hash(x,j,72)*3)*(j*.9)*vk*(1-.6*v),hw=Math.max(1,th*.3);
      const ty=top[clamp(x,0,W-1)];
      for(let dx=-Math.ceil(hw);dx<=Math.ceil(hw);dx++){const xx=x+dx;if(xx<0||xx>=W)continue;top[xx]=Math.min(top[xx],ty-th*(1-Math.abs(dx)/(hw+1)));}
    }
    ridgeTop[j]=top;
    const c0=mix(haze,[6,7,12],dark);
    for(let x=0;x<W;x++)for(let y=Math.max(0,Math.floor(top[x]));y<H;y++){
      const deep=Math.min(1,(y-top[x])/40),mist=Math.exp(-(((base+4*vk-y)/(8*vk))**2))*.3;
      const gc=glowAt(x,hz)*.12;
      let c=mix(c0,[c0[0]*.6,c0[1]*.6,c0[2]*.6],deep*.6);c=mix(c,haze,mist);
      const gl=glowCol(hz);c=[c[0]+gl[0]*gc*(1-dark),c[1]+gl[1]*gc*(1-dark),c[2]+gl[2]*gc*(1-dark)];
      const i=(y*W+x)*4;d[i]=quant(c[0],x,y);d[i+1]=quant(c[1],x,y);d[i+2]=quant(c[2],x,y);d[i+3]=255;
    }
  });
  g.putImageData(img,0,0);
}

/* ---------- the clearing, lit by the fire ---------- */
const NEEDLE=[22,36,28],NEEDLE2=[30,48,34],TRUNK=[40,28,22];
// Objects remember where they stand on the ground, so the light falls off with depth as well as across the screen.
let curDep=0;
function buf(d){const b=new Uint8ClampedArray(W*H*4);if(d)b.dep=new Float32Array(W*H);return b;}
function put(b,x,y,c){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;const i=(y*W+x)*4;if(b.dep)b.dep[y*W+x]=curDep;b[i]=c[0];b[i+1]=c[1];b[i+2]=c[2];b[i+3]=255;}
function pine(b,x,base,h,hw,id){
  const top=base-h,trunkH=h*.14,tiers=Math.max(3,Math.round(h/10)),tw=Math.max(1,Math.round(hw*.12));
  for(let y=Math.round(base-trunkH*1.5);y<base;y++)for(let xx=-tw;xx<tw;xx++)put(b,x+xx,y,TRUNK);
  for(let y=Math.round(top);y<base-trunkH;y++){
    const p=(y-top)/(h-trunkH),q=(p*tiers)%1;
    const r=Math.round(hw*(.1+.9*p)*(.45+.55*q)+(hash(id,y,3)-.5)*1.6);
    for(let xx=-r;xx<=r;xx++)put(b,x+xx,y,hash(x+xx,y,id)<.12?NEEDLE2:NEEDLE);
  }
}
function blob(b,x0,y0,rx,ry,fn){
  for(let y=Math.floor(-ry);y<=Math.ceil(ry);y++)for(let x=Math.floor(-rx);x<=Math.ceil(rx);x++){
    const nx=x/rx,ny=y/ry;if(nx*nx+ny*ny>1)continue;put(b,x0+x,y0+y,fn(nx,ny,x,y));
  }
}
function shadow(sh,ox,oy,len,w,str){
  let dx=ox-fx,dy=(oy-fy)*2.6;const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
  const ux=dx,uy=dy/2.6,ul=Math.hypot(ux,uy);const dX=ux/ul,dY=uy/ul;
  const ccx=ox+dX*len*.5,ccy=oy+dY*len*.5,R0=Math.max(len,w);
  for(let y=Math.floor(ccy-R0);y<=ccy+R0;y++)for(let x=Math.floor(ccx-R0);x<=ccx+R0;x++){
    if(x<0||y<0||x>=W||y>=H)continue;
    const px=x-ccx,py=y-ccy,al=(px*dX+py*dY)/(len*.5),ac=(px*-dY+py*dX)/(w*.5),r=al*al+ac*ac;
    if(r<1)sh[y*W+x]=Math.max(sh[y*W+x],str*(1-r*r));
  }
}
function groundTop(x){return gy+Math.round((fbm(x/40+WORLD.off[6])-.5)*5*vk);}
function paintFg(){
  const gb=buf(),ob=buf(1),of=buf(1),sh=new Float32Array(W*H);
  const ringX=30*fk,ringY=ringX*.32,CU=34*fk;
  for(let x=0;x<W;x++)for(let y=Math.max(0,groundTop(x));y<H;y++){
    const far=clamp((y-gy)/(H-gy),0,1);
    let c=mix([20,24,20],[30,34,24],far);
    const h=hash(x,y,81);c=mix(c,[38,40,28],h*.35);
    c=mix(c,[14,16,14],vn(x,y*2.5,16,86)*.55+clamp(1-(y-gy)/(10*vk),0,1)*.5);
    if(vn(x,y*2.5,9,87)>.72)c=mix(c,[42,50,30],.5);
    const e=Math.hypot((x-fx)/(CU*1.7),(y-fy)/(CU*.5));
    if(e<1)c=mix(c,[46,36,28],clamp((1-e)*2.2,0,1));
    if(e<.55)c=mix(c,[42,38,36],.6);
    if(e>1.1&&hash(x,y,82)<.05)c=[46,58,34];
    if(hash(x,y,83)<.004)c=[72,68,62];
    put(gb,x,y,c);
  }
  // Grass tufts.
  for(let i=0,n=Math.round(W*(H-gy)/90);i<n;i++){
    const x=Math.floor(hash(i,1,84)*W),y=gy+Math.floor(hash(i,2,84)*(H-gy));
    if(Math.hypot((x-fx)/(CU*1.8),(y-fy)/(CU*.55))<1.1)continue;
    const h=1+Math.floor(hash(i,3,84)*3*vk);
    for(let j=0;j<h;j++){put(gb,x,y-j,[40,54,32]);if(j<h-1&&hash(i,j,85)<.5)put(gb,x+(hash(i,4,84)<.5?-1:1),y-j-1,[34,46,28]);}
  }
  // Forest edge behind the clearing, open where the view reaches the city.
  const gap=spread*1.9;
  for(let x=-6;x<W+6;x+=4+Math.floor(hash(x,1,11)*8)){
    const open=Math.abs(x-cx)-gap;if(open<0)continue;
    const h=(28+hash(x,2,11)*52)*vk*clamp(open/30,.3,1),base=groundTop(clamp(x,0,W-1))+Math.round(hash(x,3,11)*6*vk);
    curDep=base;
    pine(ob,x,base,h,Math.max(3,h*.2),x+300);
  }
  // Stones round the fire, the back half behind it and the front half in front.
  for(const st of WORLD.stones){
    const x=fx+Math.cos(st.a)*ringX,y=fy+1+Math.sin(st.a)*ringY,w=st.w*fk,h=w*st.h;
    const b=Math.sin(st.a)>0?of:ob;
    curDep=y;
    blob(b,x,y,w/2,h,(nx,ny)=>{const t=st.tone;return ny<-.35?[150*t,142*t,134*t]:ny>.4?[74*t,68*t,66*t]:[112*t,106*t,100*t];});
    shadow(sh,x,y+h*.5,w*1.2,w,.7);
  }
  // Logs, a stump and a woodpile, wherever this night's camp put them.
  const LOGC={top:[86,62,44],dark:[34,24,18],bark:[[46,32,24],[60,42,30]],cut:[[128,98,64],[100,74,48]]};
  function groundLog(cx,cy,len,th,ga,id){
    const gx=Math.cos(ga),gz=Math.sin(ga),vx=gx*len,vy=gz*len*.3,steps=Math.ceil(Math.hypot(vx,vy)*2)+1;
    const b=cy>fy+2?of:ob;curDep=cy;
    for(let i=0;i<=steps;i++){
      const s=i/steps-.5,px=cx+vx*s,py=cy+vy*s,k=Math.round(s*len);
      for(let j=0;j<th;j++)put(b,px,py-th+j+1,j===0?LOGC.top:j===th-1?LOGC.dark:LOGC.bark[hash(k,j,id)<.3?0:1]);
    }
    const ne=vy>=0?1:-1,ex=cx+vx*.5*ne,ey=cy+vy*.5*ne-th/2+.5;
    blob(b,ex,ey,Math.max(1,th*.5*(.3+.7*Math.abs(gz))),th/2-.2,(nx,ny)=>Math.hypot(nx,ny)<.45?LOGC.cut[1]:LOGC.cut[0]);
    shadow(sh,cx,cy+1,len*.5,Math.max(len*Math.abs(gx)*.8,th*2),.7);
  }
  WORLD.props.forEach((p,pi)=>{
    const ringR=CU*p.d,cx=fx+Math.cos(p.a)*ringR,cy=fy+Math.sin(p.a)*ringR*.3;
    if(p.kind==='log'){
      const ga=p.a+Math.PI/2+p.tilt,len=p.len*fk,th=Math.max(4,Math.round(p.th*fk));
      groundLog(cx,cy,len,th,ga,900+pi);
      if(p.pair){const o=th*p.gap*.9;groundLog(cx+Math.cos(p.a)*o*1.6,cy+Math.sin(p.a)*o*.5+1,len*.9,th,ga+p.tilt2,950+pi);}
    }else if(p.kind==='stump'){
      const w=Math.max(6,Math.round(9*fk)),h=Math.max(4,Math.round(6*fk)),b=cy>fy+2?of:ob;
      curDep=cy;
      for(let x=0;x<w;x++)for(let y=0;y<h;y++)put(b,cx-w/2+x,cy-h+y,hash(x,y,93)<.25?[44,30,22]:x<2?[48,34,26]:[64,46,32]);
      blob(b,cx-.5,cy-h,w/2,Math.max(1.5,w*.18),(nx,ny)=>Math.hypot(nx,ny)>.75?[88,66,46]:Math.abs(Math.hypot(nx,ny)-.45)<.12?[110,84,58]:[132,102,70]);
      if(p.mug){const mx=cx+Math.round(w*.15),my=cy-h-1;for(let y=0;y<3;y++)for(let x=0;x<2;x++)put(b,mx+x,my-y,y===2?[150,156,164]:[112,118,128]);put(b,mx+2,my-1,[100,106,116]);}
      shadow(sh,cx,cy,w,w,.8);
    }else{
      const r=Math.max(2,Math.round(2.4*fk)),b=cy>fy+2?of:ob,rows=p.rows===3?[[0,0],[2,0],[4,0],[1,-1.6],[3,-1.6],[2,-3.2]]:[[1,0],[3,0],[2,-1.6]];
      curDep=cy;
      for(const[a,bq]of rows)blob(b,cx+(a-2)*r,cy+bq*r,r,r,(nx,ny)=>Math.hypot(nx,ny)<.35?[104,78,50]:Math.hypot(nx,ny)>.85?[50,36,26]:[136,104,68]);
      shadow(sh,cx,cy+r,r*5,r*6,.75);
    }
  });
  // Big pines at the edges of the frame, closest of all.
  curDep=H;
  WORLD.edge.forEach((e,i)=>{const h=e.h*H;pine(of,Math.round(e.u*W),H+2,h,Math.min(h*.22*e.w,W*.1),i+700);});
  [fgB,fgBL]=bake(gb,ob,sh);[fgF,fgFL]=bake(null,of,null);
}
// Every lit layer is painted twice, once in the cold of the night and once with the fire at full strength.
// Each frame draws the cold one, then the lit one on top at the fire's brightness, so the clearing flickers with the flames.
function bake(gb,ob,sh){
  const amb=WORLD.moon?[.22,.24,.34]:[.16,.17,.26],fire=[1.9,1.1,.5],R0=Math.max(H*.17,W*.07);
  const ly=fy-FH*.3;
  const[bc,bg]=mk(W,H),[lc,lg]=mk(W,H);
  const bi=bg.createImageData(W,H),li=lg.createImageData(W,H),b=bi.data,l=li.data;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4;let src=null,L=0;
    if(ob[i+3]){
      src=ob;const dx=fx-x,dy=ly-y,dl=Math.hypot(dx,dy)||1,dd=Math.hypot(dx,(ob.dep[y*W+x]-fy)*2.6,dy*.6);
      const qx=Math.round(x+dx/dl*2),qy=Math.round(y+dy/dl*2);
      const rim=qx<0||qy<0||qx>=W||qy>=H||!ob[(qy*W+qx)*4+3]?1:.3;
      L=rim/(1+(dd/R0)**2);
    }else if(gb&&gb[i+3]){
      src=gb;const d=Math.hypot(x-fx,(y-fy)*2.6);L=(1-(sh?sh[y*W+x]:0)*.9)/(1+(d/R0)**2);
    }
    if(!src)continue;
    for(let j=0;j<3;j++){const a=src[i+j],base=a*amb[j];b[i+j]=base;l[i+j]=base+a*fire[j]*L*1.6;}
    b[i+3]=l[i+3]=255;
  }
  bg.putImageData(bi,0,0);lg.putImageData(li,0,0);
  return[bc,lc];
}

/* ---------- fire ---------- */
// A heat field: every step each cell takes the heat of the cells below it, minus a cooling map that scrolls upward with the flames.
// The holes in the cooling map are what tear tongues of flame loose.
let FW=0,FH=0,heat,cool,CMH=0,scroll=0,edgeCool,coolRow,fireC,fctx,fimg;
const PAL=[null,[110,22,10,140],[168,36,12,210],[214,60,16,240],[240,96,24,255],[252,132,36,255],[255,168,58,255],[255,206,110,255],[255,238,180,255]];
function fireAlloc(h,w){
  if(h===FH&&w===FW)return;
  FH=h;FW=w;
  heat=new Float32Array(FW*FH);
  CMH=Math.ceil(FH*4/12)*12;cool=new Float32Array(FW*CMH);
  for(let y=0;y<CMH;y++)for(let x=0;x<FW;x++){const v=vn(x,y,6,101,CMH/6)*.6+vn(x,y,3,102,CMH/3)*.3+vn(x,y,2,103,CMH/2)*.1;cool[y*FW+x]=v*v*v*3.4;}
  // Extra cooling toward the sides, stronger higher up, gives the flames their taper.
  edgeCool=new Float32Array(FW*FH);for(let y=0;y<FH;y++)for(let x=0;x<FW;x++){const u=(x+.5-FW/2)/(FW/2);edgeCool[y*FW+x]=u**4*(.4+1.6*(1-y/FH)**2);}
  // The cooling map bites less near the base, so the body of the fire stays whole and only the tips tear.
  coolRow=new Float32Array(FH);for(let y=0;y<FH;y++)coolRow[y]=.3+1.1*(1-y/FH)**1.5;
  [fireC,fctx]=mk(FW,FH);fimg=fctx.createImageData(FW,FH);
}
let lightRaw=1,lean=0,fireAcc=0;
function fireStep(){
  scroll=(scroll+1)%CMH;
  const c0=FW/2-.5,tg=WORLD.tongues;
  for(let r=0;r<3;r++){const y=FH-1-r;for(let x=0;x<FW;x++){
    const xu=(x-c0)/fk,u=xu/20,b=Math.max(0,1-u*u);
    let p=.22*b;
    for(const g of tg){const px=g.x+(noise(t*.05+g.ph)-.5)*5,d=(xu-px)/g.w;p+=g.s*Math.exp(-d*d)*(.5+.9*noise(t*.25+g.ph*3));}
    heat[y*FW+x]=fuel*Math.min(1.3,p)*(.7+.5*R())*(1-r*.12);
  }}
  lean=wind*.6+(noise(t*.45+7)-.5)*.45;
  const coolK=2/FH,sgn=lean<0?-1:1,al=Math.abs(lean);
  let sum=0;
  for(let y=0;y<FH-3;y++){
    const up=1-y/FH;let s=R()<al*(.25+.75*up)?sgn:0;if(R()<.02)s+=R()<.5?-1:1;
    const r1=(y+1)*FW,r2=(y+2)*FW,cr=((y+scroll)%CMH)*FW,row=y*FW,kr=coolK*coolRow[y];
    for(let x=0;x<FW;x++){
      const sx=x-s,a=heat[r1+clamp(sx-1,0,FW-1)],b=heat[r1+clamp(sx,0,FW-1)],c=heat[r1+clamp(sx+1,0,FW-1)],d=heat[r2+clamp(sx,0,FW-1)];
      const v=(a+b+b+c+d)*.2-(cool[cr+x]*kr+edgeCool[row+x]*coolK);
      const h=v>0?v:0;heat[row+x]=h;sum+=h;
    }
  }
  // The coals give a steady glow of their own, and the flames add to it.
  lightRaw=.45+sum/(FW*FH)*4.5;
}
function drawFire(){
  const d=fimg.data;
  for(let y=0;y<FH;y++)for(let x=0;x<FW;x++){
    const i=(y*FW+x)*4;let q=Math.floor(Math.pow(heat[y*FW+x],1.05)*8.6+(bayer(x,y)-.5)*.6+.1);
    if(q<=0){d[i+3]=0;continue;}if(q>8)q=8;const p=PAL[q];d[i]=p[0];d[i+1]=p[1];d[i+2]=p[2];d[i+3]=p[3];
  }
  fctx.putImageData(fimg,0,0);
  ctx.drawImage(fireC,fx-FW/2,fy-FH-Math.round(3*fk));
  ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.18;ctx.drawImage(fireC,fx-FW/2,fy-FH-Math.round(3*fk));ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
}
const EMB=[[40,12,8],[96,24,8],[178,52,14],[238,104,28],[255,170,60],[255,226,140]];
const ember=v=>EMB[clamp(Math.floor(v*EMB.length),0,EMB.length-1)];
const LOGTOP=[0,1,2,3,4,5].map(i=>mix([90,40,20],[255,150,60],i/5)),CHAR=[[16,10,8],[36,22,16]],BARK=[[72,46,30],[92,60,38]],CUT=[[118,88,58],[84,60,40]];
// The bed of coals is most of the fire: a wide glow of red embers, flecked with ash, breathing slowly.
const COAL=[[34,10,8],[86,18,8],[150,32,12],[208,56,18],[246,96,32],[255,146,60]],ASH=[[70,62,60],[96,88,84]];
const coal=v=>COAL[clamp(Math.floor(v*COAL.length),0,COAL.length-1)];
function drawCoals(){
  const rx=24*fk,ryc=Math.max(3,5.5*fk);
  ctx.globalCompositeOperation='lighter';ctx.globalAlpha=clamp(.5+light*.4,0,1);
  ctx.drawImage(coalGlow,Math.round(fx-coalGlow.width/2),Math.round(fy-2-coalGlow.height/2));
  ctx.globalCompositeOperation='source-over';
  for(let y=-Math.ceil(ryc);y<=Math.ceil(ryc*.5);y++)for(let x=-Math.ceil(rx);x<=Math.ceil(rx);x++){
    const e=(x/rx)**2+(y/ryc)**2;if(e>1)continue;
    const h=hash(x,y,112);
    if(h<.1&&e>.3){dot(fx+x,fy-1+y,ASH[h<.04?1:0]);continue;}
    const v=clamp((1-e)*.55+noise(t*.25+hash(x,y,111)*60)*.6-.12+fuel*.1,0,1);
    dot(fx+x,fy-1+y,coal(v));
  }
  ctx.globalAlpha=1;
}
// A log lying across the pile: lit along the top, glowing red underneath where it sits in the coals, cut faces at both ends.
function drawLog(g,id){
  const x1=fx+g.x1*fk,y1=fy+g.y1*fk,x2=fx+g.x2*fk,y2=fy+g.y2*fk;
  const len=Math.ceil(Math.hypot(x2-x1,y2-y1)),th=Math.max(3,Math.round(g.th*fk));
  const litTop=LOGTOP[clamp(Math.round((light-.1)*5),0,5)],rx=24*fk;
  for(let i=0;i<=len;i++){
    const px=Math.round(x1+(x2-x1)*i/len),py=Math.round(y1+(y2-y1)*i/len),inCoals=Math.abs(px-fx)<rx*.9;
    for(let j=0;j<th;j++){
      const Y=py-(th>>1)+j,h=hash(id,i,j+120);
      let c=j===0?litTop:j===th-1?CHAR[0]:BARK[hash(id,i>>1,j+140)<.35?0:1];
      if(h<.3&&j>0&&j<th-1)c=CHAR[1];
      if(inCoals&&j>=th-2){const v=clamp(noise(t*.3+h*80+id*9)*1.1+.1,0,1);c=coal(v);}
      else if(h<.06&&j>0){const v=clamp(noise(t*.3+h*80+id*9)*1.2-.1,0,1);c=ember(v*.85);}
      dot(px,Y,c);
    }
  }
  for(const[ex,ey]of[[x1,y1],[x2,y2]])endFace(ex,ey-.5,Math.max(1.5,th*.32),th/2,id,false);
}
// A cut end: bark rim, pale rings of wood, a darker heart, and embers creeping in from the bottom edge.
function endFace(cx0,cy0,rx,ryy,id,charred){
  const shade=clamp(.55+light*.45,.5,1.15);
  for(let y=Math.floor(-ryy);y<=Math.ceil(ryy);y++)for(let x=Math.floor(-rx);x<=Math.ceil(rx);x++){
    const nx=x/rx,ny=y/ryy,d=Math.hypot(nx,ny);if(d>1)continue;
    let c;
    if(d>.8)c=CHAR[1];
    else if(charred)c=hash(id,x+9,y+9)<.22?ember(clamp(noise(t*.35+hash(id,x,y)*70)*1.2,0,1)*.8):CHAR[hash(id,x,y+30)<.5?0:1];
    else{const ring=Math.abs(d-.35)<.09||Math.abs(d-.62)<.08;const b=d<.15?WOOD[2]:ring?WOOD[1]:WOOD[0];c=WOODL[clamp(Math.round(shade*3.5),0,4)][WOOD.indexOf(b)];}
    if(ny>.55&&d>.6)c=ember(clamp(noise(t*.3+id*5+x*.3)*1.1,0,1)*.9);
    dot(cx0+x,cy0+y,c);
  }
}
const WOOD=[[196,136,78],[160,104,60],[120,76,44]],WOODL=[0,1,2,3,4].map(i=>WOOD.map(c=>mix([60,30,16],mix(c,[255,160,90],.3),.35+i*.17)));
// A short log pointing at us: its top runs back into the pile, and its round cut end faces the camera.
function drawEndLog(g,id){
  const cx0=fx+g.x*fk,cy0=fy+g.y*fk,r=Math.max(3,g.r*fk),back=r*.8;
  const litTop=LOGTOP[clamp(Math.round((light-.1)*5),0,5)];
  // The body is the round end swept back and up, so it reads as a cylinder rather than a box.
  for(let y=Math.floor(-r-back);y<=Math.ceil(r);y++)for(let x=Math.floor(-r);x<=Math.ceil(r);x++){
    if(Math.abs(x)>r)continue;
    const half=Math.sqrt(Math.max(0,r*r-x*x)),top=-back-half;if(y<top||y>half)continue;
    if(x*x+y*y<=r*r)continue;
    dot(cx0+x,cy0+y,y<top+1.2?litTop:Math.abs(x)>r*.8?CHAR[0]:g.charred?CHAR[1]:BARK[hash(id,x,y+60)<.4?0:1]);
  }
  endFace(cx0,cy0,r,r,id,g.charred);
}

/* ---------- sparks, embers, ash and smoke ---------- */
const sparks=[],smoke=[];
let sparkAcc=0,smokeAcc=0,ashAcc=0,sid=0;
function windAt(y){return wind*(1+Math.max(0,fy-y)/(H*.5));}
function flameTop(){
  for(let tries=0;tries<12;tries++){const x=Math.floor(R()*FW),y=Math.floor(R()*FH*.6);if(heat[y*FW+x]>.18)return[x,y];}
  return[FW/2+rr(-3,3),FH*.6];
}
function spark(kind){
  const[x,y]=kind==='pop'?[FW/2+rr(-FW*.25,FW*.25),FH-rr(3,8)*fk]:flameTop();
  const s={kind,id:sid++,x:fx-FW/2+x,y:fy-FH-3*fk+y,px:0,py:0,vx:rr(-4,4)*fk,vy:-rr(7,20)*fk,temp:rr(.8,1),cool:rr(.07,.24),turb:rr(5,18)*fk,buoy:rr(4,11)*fk,ground:0};
  if(kind==='high'){s.cool*=.45;s.buoy*=1.3;}
  if(kind==='pop'){s.vx=rr(-22,22)*fk;s.vy=-rr(18,40)*fk;s.cool=rr(.05,.12);s.ground=fy+rr(-4,16)*fk;}
  if(kind==='ash'){s.vy=-rr(3,7)*fk;s.vx=0;s.temp=rr(.4,.8);s.cool=rr(.08,.15);s.y-=rr(4,14)*fk;}
  s.px=s.x;s.py=s.y;sparks.push(s);
  if(kind!=='ash')stats.sparks++;
}
function burst(n,pops){for(let i=0;i<n;i++)spark(chance(.25)?'high':'spark');for(let i=0;i<pops;i++)spark('pop');}
function updateSparks(dt){
  sparkAcc+=dt*(6+10*fuel)*(.6+.5*light);
  while(sparkAcc>1){sparkAcc--;spark(chance(.22)?'high':'spark');}
  ashAcc+=dt*.6*fuel;while(ashAcc>1){ashAcc--;spark('ash');}
  for(let i=sparks.length-1;i>=0;i--){
    const s=sparks[i];s.px=s.x;s.py=s.y;
    if(s.kind==='pop'){
      if(s.landed){s.temp-=dt*s.cool;}
      else{s.vy+=50*fk*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.temp-=dt*.1;if(s.vy>0&&s.y>=s.ground){s.y=s.ground;s.landed=true;}}
    }else if(s.kind==='ash'){
      s.vx+=(windAt(s.y)*16*fk-s.vx)*.6*dt;s.x+=(s.vx+Math.sin(t+s.id)*3*fk)*dt;s.y+=s.vy*dt;s.temp-=dt*s.cool;
    }else{
      s.vy-=s.buoy*s.temp*dt;s.vy*=1-.6*dt;s.vx*=1-.6*dt;
      s.vx+=(noise(t*1.1+s.id*7.13)-.5)*s.turb*dt*6+(windAt(s.y)*16*fk-s.vx)*.4*dt;
      s.x+=s.vx*dt;s.y+=s.vy*dt;s.temp-=dt*s.cool*(1+noise(t*4+s.id)*.6);
    }
    if(s.temp<=0||s.y<-6||s.x<-20||s.x>W+20)sparks.splice(i,1);
  }
  smokeAcc+=dt*(1.1+1.5*fuel);
  while(smokeAcc>1){smokeAcc--;smoke.push({x:fx+rr(-3,3)*fk+lean*4*fk,y:fy-FH*rr(.7,.95),vx:0,vy:-rr(3.5,6.5)*fk,r:rr(2,4)*fk,gr:rr(.8,1.6)*fk,age:0,life:rr(11,18),a:rr(.05,.11)});}
  for(let i=smoke.length-1;i>=0;i--){
    const p=smoke[i];p.age+=dt;if(p.age>p.life){smoke.splice(i,1);continue;}
    p.vx+=(windAt(p.y)*14*fk-p.vx)*.5*dt;p.vy*=1-.04*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=p.gr*dt;
  }
}
const SPK=[[140,40,20],[226,80,30],[255,148,56],[255,206,100],[255,246,200]];
function sparkCol(v){return SPK[v>.82?4:v>.62?3:v>.42?2:v>.24?1:0];}
function drawSmoke(){
  for(const p of smoke){
    const k=p.age/p.life,a=p.a*clamp(k/.15,0,1)*Math.pow(1-k,1.3);
    const warm=clamp(1-(fy-FH-p.y)/(FH*1.2),0,1)*clamp(light,0,1.2);
    ctx.globalAlpha=a;ctx.fillStyle=css(mix([58,62,78],[150,92,58],warm*.8));
    ctx.beginPath();ctx.arc(Math.round(p.x),Math.round(p.y),p.r,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
}
function drawSparks(){
  for(const s of sparks){
    if(s.kind==='ash'){dot(s.x,s.y,[138,132,126],clamp(s.temp,0,1)*.7);continue;}
    const v=s.landed?s.temp*(.6+.4*noise(t*2+s.id)):s.temp;
    const c=sparkCol(v);
    if(v>.45){const g=.12+.25*(v-.45);ctx.globalCompositeOperation='lighter';dot(s.x-1,s.y,c,g);dot(s.x+1,s.y,c,g);dot(s.x,s.y-1,c,g);dot(s.x,s.y+1,c,g);ctx.globalCompositeOperation='source-over';}
    if(!s.landed&&Math.hypot(s.x-s.px,s.y-s.py)>.4)dot(s.px+(s.px-s.x)*1.5,s.py+(s.py-s.y)*1.5,c,.45);
    dot(s.x,s.y,c,clamp(v*2,0,1));
  }
  ctx.globalAlpha=1;
}

/* ---------- the sky: planes, stars, bats ---------- */
const planes=[],cars=[],meteors=[],sats=[],bats=[],fireworks=[],eyes=[];
let carNext=0;
function arrival(){
  const d=WORLD.runway,sx=ax-d*rr(.55,1.05)*W,sy=hz-rr(.25,.65)*hz,tx=ax-d*rl/2,dist=Math.hypot(tx-sx,ry-sy),sp=rr(6,10)*vk;
  const T1=dist/sp,T2=rr(5,8);
  planes.push({ph:R()*9,age:0,end:T1+T2,pos(a){
    if(a<T1){const k=a/T1;return{x:lerp(sx,tx,k),y:lerp(sy,ry-.5,Math.pow(k,1.08)),ll:.45+.55*k};}
    const k=(a-T1)/T2,e=1-(1-k)*(1-k);return{x:tx+d*rl*e,y:ry-.5,ll:1-k};
  }});
}
function departure(){
  const d=WORLD.runway,x0=ax-d*rl/2,x1=ax+d*rl/2,T0=rr(4,6);
  const p1x=x1+d*rr(60,120)*vk,p1y=ry-rr(15,30)*vk,p2x=ax+(chance(.65)?d:-d)*rr(.55,1.1)*W,p2y=hz-rr(.4,.9)*hz;
  const T1=(Math.hypot(p1x-x1,p1y-ry)+Math.hypot(p2x-p1x,p2y-p1y))/(rr(8,12)*vk);
  planes.push({ph:R()*9,age:0,end:T0+T1,pos(a){
    if(a<T0){const k=a/T0;return{x:lerp(x0,x1,k*k),y:ry-.5,ll:1};}
    const k=(a-T0)/T1,u=1-k;return{x:u*u*x1+2*u*k*p1x+k*k*p2x,y:u*u*ry+2*u*k*p1y+k*k*p2y,ll:k<.45?1:Math.max(0,1-(k-.45)*6)};
  }});
}
function overflight(){
  const d=chance(.5)?1:-1,y=rr(.06,.32)*hz,sp=rr(5,9)*vk,x0=d>0?-6:W+6,T=(W+12)/sp,dy=rr(-.08,.08)*hz;
  planes.push({ph:R()*9,age:0,end:T,high:true,pos(a){const k=a/T;return{x:x0+d*(W+12)*k,y:y+dy*k,ll:0};}});
}
function drawPlanes(){
  for(const p of planes){
    const{x,y,ll}=p.pos(p.age);if(x<-8||x>W+8)continue;
    if(p.high&&y>=skyLim[clamp(Math.round(x),0,W-1)])continue;
    const s=(p.age+p.ph)%1.3,blink=(p.age+p.ph*.7)%1.05<.12;
    if(ll>0){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=ll*.5;ctx.drawImage(landGlow,Math.round(x)-4,Math.round(y)-4);ctx.globalCompositeOperation='source-over';dot(x,y,[255,250,236],.4+.6*ll);}
    else dot(x,y,[60,60,70],.6);
    if(blink)dot(x,y-1,[255,50,64]);
    if(s<.05||(s>.16&&s<.21)){dot(x-1,y,[255,255,255]);dot(x+1,y,[255,255,255]);}
  }
  ctx.globalAlpha=1;
}
function drawCity(){
  for(const b of beacons)if(((t+b.ph)%b.per)/b.per<.35)dot(b.x,b.y,[255,60,70]);
  for(const c of crowns){const a=.55+.45*Math.sin(t*1.7+c.ph);for(let x=0;x<c.w;x++)dot(c.x+x,c.y,c.c,a);}
  // Approach lights run toward the runway, one after another.
  const n=5,step=Math.floor((t*10)%(n+3));
  for(let i=0;i<n;i++){const x=ax-WORLD.runway*(rl/2+3+(n-1-i)*2);dot(x,ry,i===step?[255,255,255]:[90,90,110],i===step?1:.5);}
  for(const c of cars){const x=lerp(road.x0,road.x1,c.s),y=lerp(road.y0,road.y1,c.s);dot(x,y,c.dir>0?[255,90,70]:[255,240,210],.8);}
  for(const f of fireworks)for(const q of f.parts){const k=f.age/f.life;if(k<0||k>1)continue;const x=f.x+q.vx*f.age,y=f.y+q.vy*f.age+3*f.age*f.age;dot(x,y,f.c,(1-k)*.9);}
  ctx.globalAlpha=1;
}
function drawSky(){
  for(const s of stars){
    const dip=clamp((.4-noise(t*s.rate+s.ph))*4,0,1),a=(.12+.88*s.b)*(1-s.depth*dip)*(s.b>.6?.88+.12*noise(t*2.5+s.ph):1);
    dot(s.x,s.y,s.c,a);
    if(s.b>.7){const g=a*.22;dot(s.x-1,s.y,s.c,g);dot(s.x+1,s.y,s.c,g);dot(s.x,s.y-1,s.c,g);dot(s.x,s.y+1,s.c,g);}
  }
  for(const m of meteors){
    for(let i=0;i<m.len;i++){const k=m.age/m.life,x=m.x+m.vx*m.age-m.vx/Math.hypot(m.vx,m.vy)*i,y=m.y+m.vy*m.age-m.vy/Math.hypot(m.vx,m.vy)*i;
      const xi=Math.round(x);if(xi<0||xi>=W||y>=skyLim[xi])continue;dot(x,y,[255,250,235],(1-i/m.len)*Math.sin(Math.PI*k));}
  }
  for(const s of sats){const x=s.x+s.vx*s.age,y=s.y+s.vy*s.age,xi=Math.round(x);if(xi>=0&&xi<W&&y<skyLim[xi])dot(x,y,[220,224,240],.55);}
  ctx.globalAlpha=1;
}
function drawBats(){
  for(const b of bats){
    if(b.age<0)continue;
    const x=b.x+b.vx*b.age,y=b.y+(noise(b.age*1.6+b.id)-.5)*30*vk,flap=Math.floor(b.age*9+b.id)%2;
    const c=[6,6,12];dot(x,y,c);dot(x-1,y-flap,c);dot(x+1,y-flap,c);if(flap)dot(x-2,y-1,c),dot(x+2,y-1,c);else dot(x-2,y+1,c),dot(x+2,y+1,c);
  }
}
// Eyeshine from animals far off in the dark: a pixel per eye, dim, blinking, fading in and out one pair at a time.
function drawEyes(){
  for(const e of eyes)for(const p of e.pairs){
    const age=e.age-p.delay,k=age/p.life;if(k<=0||k>=1)continue;
    const a=e.dim*clamp(Math.min(k/.2,(1-k)/.25),0,1)*(p.blinks.some(b=>Math.abs(age-b)<.12)?0:1);
    if(a<=0)continue;const x=p.x+e.vx*age;
    dot(x,p.y,e.c,a);dot(x+e.gap,p.y,e.c,a);
  }
  ctx.globalAlpha=1;
}

/* ---------- events ---------- */
const stats={sparks:0,flights:0,events:0};
function log(text){stats.events++;N.log(text);}
const DIR=()=>WORLD.side<0?'west':'east';
let gust=null,flare=0,fuel=.8,light=1,wind=0,t=0,warming=false,blackout=null;
const SCHED={crackle:{m:4.5,f:1},settle:{m:150,f:50},gust:{m:75,f:25},arrival:{m:55,f:6},departure:{m:60,f:22},overflight:{m:170,f:70},meteor:{m:160,f:45},satellite:{m:260,f:110},bats:{m:110,f:40},eyes:{m:95,f:45},window:{m:2.5,f:1},blackout:{m:540,f:240},fireworks:{m:780,f:320}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
function fire(k){
  switch(k){
    case'crackle':{const n=ri(6,26);burst(n,ri(1,n>14?7:3));if(n>18&&!warming)log('The fire cracks and throws a shower of sparks');break;}
    case'settle':{
      flare=Math.min(.5,flare+rr(.15,.3));burst(ri(20,45),ri(3,7));
      const g=pick(WORLD.logs);
      if(g.type==='end'){g.y=clamp(g.y+rr(-.5,2),-10,-4);g.x=clamp(g.x+rr(-2,2),-14,14);g.charred=g.charred||chance(.3);}
      else{g.y1=clamp(g.y1+rr(-1,1.5),-12,3);g.y2=clamp(g.y2+rr(-1,1.5),-12,3);}
      const tg=pick(WORLD.tongues);tg.x=clamp(tg.x+rr(-5,5),-15,15);
      log('A log settles into the coals and the fire flares');break;
    }
    case'gust':{const d=chance(.5)?1:-1;gust={age:0,dur:rr(7,14),amp:d*rr(.4,.9)};log(`A gust leans the flames to the ${d>0?'right':'left'}`);break;}
    case'arrival':arrival();stats.flights++;log(`A flight descends toward the city airport`);break;
    case'departure':departure();stats.flights++;log('A flight climbs out of the city');break;
    case'overflight':overflight();stats.flights++;log('A plane passes high over the mountains');break;
    case'meteor':{const d=chance(.5)?1:-1,sp=rr(110,220);const a=rr(.3,.9);meteors.push({x:rr(.1,.9)*W,y:rr(.04,.4)*hz,vx:d*Math.cos(a)*sp,vy:Math.sin(a)*sp,len:ri(6,14),age:0,life:rr(.4,.9)});log('A shooting star');break;}
    case'satellite':{const d=chance(.5)?1:-1,T=rr(50,80);sats.push({x:d>0?-2:W+2,y:rr(.05,.4)*hz,vx:d*(W+4)/T,vy:rr(-.05,.05)*hz/T,age:0,life:T});log('A satellite crosses the stars');break;}
    case'bats':{const n=ri(1,3),d=chance(.5)?1:-1;for(let i=0;i<n;i++)bats.push({id:R()*50,x:d>0?rr(-10,W*.3):rr(W*.7,W+10),y:gy-rr(15,50)*vk,vx:d*rr(18,34)*vk,age:-i*rr(.2,.8),life:rr(6,10)});log(n>1?'Bats flit over the clearing':'A bat flits over the clearing');break;}
    case'eyes':{
      const[name,c,gap,lo,hi,text]=wpick(BEASTS),d=chance(.5)?1:-1,n=ri(lo,hi);
      let x=clamp(fx+d*rr(.22,.46)*W,4,W-8);
      const y0=name==='owl'?gy-rr(14,40)*vk:gy+rr(-1,6)*vk,pairs=[];
      for(let i=0;i<n;i++){
        pairs.push({x,y:Math.round(y0+rr(-2,2)*vk*(i?1:0)),delay:i?rr(.5,4):0,life:rr(5,12),blinks:[rr(1,3),rr(3.5,6),rr(7,10)]});
        x=clamp(x-d*rr(5,13),4,W-8);
      }
      eyes.push({pairs,c,gap,dim:rr(.5,.8),vx:name==='owl'?0:rr(-1,1),age:0,life:20});
      log(text);break;
    }
    case'window':{const w=pick(cityWins);if(!w||blackout&&blackout.list.includes(w))break;w.on=!w.on;farG.fillStyle=css(w.on?w.c:w.bc);farG.fillRect(w.x,w.y,1,1);break;}
    case'blackout':{
      if(blackout||!cityWins.length)break;
      const c=pick(cityWins).x,r=spread*rr(.15,.35);
      blackout={list:cityWins.filter(w=>Math.abs(w.x-c)<r&&w.on),age:0,back:rr(30,110),done:false};
      log('A district of the city goes dark');break;
    }
    case'fireworks':{const n=ri(5,12);for(let i=0;i<n;i++){const parts=[];for(let j=ri(10,18);j>0;j--){const a=R()*Math.PI*2,s=rr(3,7)*vk;parts.push({vx:Math.cos(a)*s,vy:Math.sin(a)*s});}
      fireworks.push({x:cx+rr(-1,1)*spread*.8,y:hz-rr(10,32)*vk,c:pick([[255,110,150],[255,214,110],[120,220,255],[190,140,255],[150,255,170]]),parts,age:-i*rr(.8,3),life:rr(1.4,2.2)});}
      log('Fireworks over the city, too far away to hear');break;}
  }
}
function updateWorld(dt){
  if(!warming)for(const k in SCHED){nextEv[k]-=dt;if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);fire(k);}}
  for(const list of[planes,meteors,sats,bats,eyes,fireworks])for(let i=list.length-1;i>=0;i--){const o=list[i];o.age+=dt;if(o.age>(o.end??o.life))list.splice(i,1);}
  if(road){carNext-=dt;if(carNext<=0){carNext=expo(1.6);const d=chance(.5)?1:-1;cars.push({s:d>0?0:1,dir:d,v:rr(5,10)*vk/road.len});}
    for(let i=cars.length-1;i>=0;i--){const c=cars[i];c.s+=c.dir*c.v*dt;if(c.s<0||c.s>1)cars.splice(i,1);}}
  if(blackout){
    blackout.age+=dt;
    for(const w of blackout.list){const off=blackout.age>hash(w.x,w.y,131)*4&&blackout.age<blackout.back+hash(w.x,w.y,132)*6;if(off===w.on){w.on=!off;farG.fillStyle=css(w.on?w.c:w.bc);farG.fillRect(w.x,w.y,1,1);}}
    if(blackout.age>blackout.back+7){blackout=null;log('The lights come back on across the city');}
  }
}
function update(dt){
  t+=dt;
  let g=0;if(gust){gust.age+=dt;const p=gust.age/gust.dur;if(p>=1)gust=null;else g=gust.amp*Math.sin(Math.PI*p)**2;}
  wind=(fbm(t*.025+WORLD.off[7])-.5)*1.1+g;
  flare=Math.max(0,flare-dt*(flare*.1+.004));
  fuel=clamp(.85+(fbm(t*.008+WORLD.off[5])-.5)*.6+flare,.55,1.4);
  // The flames step about 26 times a second, slower than the frame rate, for a lazy fire.
  fireAcc+=dt*26;while(fireAcc>=1){fireAcc--;fireStep();}
  light+=(clamp(lightRaw,0,1.5)-light)*Math.min(1,dt*3.5);
  updateSparks(dt);updateWorld(dt);
}

/* ---------- lo-fi grade ---------- */
// Faded blacks, a warm tint, a soft vignette and film grain that changes a few times a second, like an old camcorder.
function paintGrade(){
  let g;[vig,g]=mk(W,H);
  const img=g.createImageData(W,H),d=img.data,cxv=W/2,cyv=H*.55,rv=Math.hypot(W*.62,H*.7);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const r=Math.hypot(x-cxv,y-cyv)/rv,a=clamp((r-.45)/.55,0,1);
    const i=(y*W+x)*4;d[i]=8;d[i+1]=4;d[i+2]=14;d[i+3]=Math.round(255*clamp(a*a*.55+(bayer(x,y)-.5)*.03,0,1));
  }
  g.putImageData(img,0,0);
  [grain,g]=mk(W+64,H+64);
  const gi=g.createImageData(W+64,H+64),gd=gi.data;
  for(let i=0;i<gd.length;i+=4){const v=hash(i,7,151);gd[i]=gd[i+1]=gd[i+2]=v<.5?0:255;gd[i+3]=Math.round(Math.abs(v-.5)*2*hash(i,8,151)*40);}
  g.putImageData(gi,0,0);
}
function grade(){
  ctx.globalAlpha=1;
  ctx.globalCompositeOperation='screen';ctx.fillStyle='#181020';ctx.fillRect(0,0,W,H);
  ctx.globalCompositeOperation='multiply';ctx.fillStyle='#fff0dc';ctx.fillRect(0,0,W,H);
  ctx.globalCompositeOperation='source-over';ctx.drawImage(vig,0,0);
  if((grainT+=1)>7){grainT=0;gx=Math.floor(R()*64);gy2=Math.floor(R()*64);}
  ctx.globalAlpha=.45;ctx.drawImage(grain,-gx,-gy2);ctx.globalAlpha=1;
}

/* ---------- drawing ---------- */
function shimmer(){
  const w=Math.round(FW*1.4),h=Math.round(FH*.9),sx=Math.round(fx-w/2),sy=Math.round(fy-FH*1.25);
  sctx.clearRect(0,0,w,h);sctx.drawImage(cv,sx,sy,w,h,0,0,w,h);
  for(let j=0;j<h;j++){const off=Math.round((noise(t*3+j*.45+300)-.5)*2.6*clamp(1-j/h+.3,0,1));if(off)ctx.drawImage(scratch,0,j,w,1,sx+off,sy+j,w,1);}
}
function draw(){
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.drawImage(farC,0,0);
  drawSky();drawCity();drawPlanes();
  ctx.drawImage(nearC,0,0);
  drawBats();
  const la=clamp(.35+.6*light,0,1);
  ctx.drawImage(fgB,0,0);ctx.globalAlpha=la;ctx.drawImage(fgBL,0,0);ctx.globalAlpha=1;
  drawEyes();
  ctx.globalCompositeOperation='lighter';ctx.globalAlpha=clamp(light*.9,0,1);
  ctx.drawImage(airGlow,Math.round(fx-airGlow.width/2),Math.round(fy-FH*.35-airGlow.height/2));
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  shimmer();
  drawCoals();
  WORLD.logs.forEach((g,i)=>{if(!g.front)(g.type==='end'?drawEndLog:drawLog)(g,i);});
  drawFire();
  WORLD.logs.forEach((g,i)=>{if(g.front)(g.type==='end'?drawEndLog:drawLog)(g,i);});
  drawSmoke();
  for(const s of sparks)if(s.landed)drawSpark1(s);
  ctx.drawImage(fgF,0,0);ctx.globalAlpha=la;ctx.drawImage(fgFL,0,0);ctx.globalAlpha=1;
  drawSparks();
  grade();
}
function drawSpark1(s){const v=s.temp*(.6+.4*noise(t*2+s.id));dot(s.x,s.y,sparkCol(v),clamp(v*2,0,1));ctx.globalAlpha=1;}

/* ---------- start ---------- */
if(N.DEBUG)window.BF={WORLD,sparks,smoke,planes,stats,get t(){return t;},get light(){return light;},get fuel(){return fuel;},get heat(){return heat;},get FW(){return FW;},get FH(){return FH;},fire,draw:()=>draw(),step:dt=>update(dt),
  run(sec){for(let i=0;i<sec*60;i++)update(1/60);draw();N.refresh();}};
layout();
warming=true;for(let i=0;i<480;i++)update(1/60);warming=false;stats.sparks=0;
const SHAPE={core:'One bright core',twin:'Two clusters of towers',sprawl:'A wide low sprawl'};
log(`The fire is lit. Far to the ${DIR()}, Night City glows ${WORLD.glowA[0]} between the ridges. ${SHAPE[WORLD.shape]}${WORLD.moon?', under the moon':', under the stars'}`);
N.stats(stats);
N.run({step:1/60,update,draw,ui:()=>N.stats(stats)});
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{layout();draw();},150);});
})();
