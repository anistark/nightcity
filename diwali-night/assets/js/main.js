/* Diwali Night: the moonless night of Diwali, from a rooftop. Someone sits on the ledge with their back to us, in the middle of a city
   lit by hand, with bulbs and paper lanterns on the balconies, diyas on every rail, and fireworks going up here and there.
   Every choice comes from the shared seeded generator in ../assets/js/nightcity.js, so no two Diwalis go the same way. */
(()=>{
'use strict';
const cv=document.getElementById('scene');
const ctx=cv.getContext('2d');
const N=NightCity;
const{R,rr,ri,pick,chance,expo,wpick,noise,fbm,shuffle}=N;

/* ---------- helpers ---------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
const mix=(a,b,k)=>[lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k)];
const css=(c,a=1)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
const ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return[c,c.getContext('2d')];}
const B4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>v/16);
const bayer=(x,y)=>B4[(y&3)*4+(x&3)];
const quant=(v,x,y,s=5)=>clamp(Math.round((v+(bayer(x,y)-.5)*s)/s)*s,0,255);
// Static detail comes from a seeded hash of its position, so a resize repaints the same city without drawing new numbers.
const SALT=Math.floor(R()*4294967296);
function hash(a,b,c){let h=Math.imul(a|0,374761393)+Math.imul(b|0,668265263)+Math.imul((c|0)+SALT,2246822519);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296;}
const hi=(a,b,c,lo,up)=>lo+Math.floor(hash(a,b,c)*(up-lo+1));
const hp=(list,a,b,c)=>list[Math.floor(hash(a,b,c)*list.length)];
function vn(x,y,s,k){
  const gx=x/s,gy=y/s,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
  const ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
  return lerp(lerp(hash(ix,iy,k),hash(ix+1,iy,k),ux),lerp(hash(ix,iy+1,k),hash(ix+1,iy+1,k),ux),uy);
}
function glowSprite(r,c,amax){
  const S=r*2+1;const[cn,g]=mk(S,S);const img=g.createImageData(S,S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const d=Math.hypot(x-r,y-r)/r;if(d>=1)continue;const i=(y*S+x)*4;img.data[i]=c[0];img.data[i+1]=c[1];img.data[i+2]=c[2];img.data[i+3]=255*amax*(1-d)*(1-d);}
  g.putImageData(img,0,0);return cn;
}
const glows={};
function glow(r,c,a){r=Math.max(1,Math.round(r));const k=r+'|'+c+'|'+a;return glows[k]||(glows[k]=glowSprite(r,c,a));}
// Colours in the hot paths come from fixed palettes, so each keeps its CSS string.
const dot=(x,y,c,a=1)=>{ctx.globalAlpha=a;ctx.fillStyle=c.s||(c.s=css(c));ctx.fillRect(Math.round(x),Math.round(y),1,1);};
function bloom(x,y,r,c,a){const s=glow(r,c,1);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=clamp(a,0,1);ctx.drawImage(s,Math.round(x-s.width/2),Math.round(y-s.height/2));ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}

/* ---------- the night, picked once ---------- */
const WALLS=[[196,156,116],[178,116,102],[140,164,152],[198,190,164],[150,136,172],[192,150,86],[122,152,184],[172,130,144],[206,176,150]];
const TRIMS=[[216,208,192],[200,194,178],[182,176,166],[208,190,170]];
const WARMW=[[255,198,112],[255,182,92],[255,216,150],[255,170,84]];
const TUBEW=[[210,236,240],[186,224,232]];
const CURTC=[[176,46,70],[60,110,120],[190,130,50],[120,70,130],[70,120,80]];
const FAIRY=[[255,190,90],[255,206,120],[255,176,70]];
const MULTI=[[255,70,78],[90,232,120],[90,170,255],[255,200,70],[255,110,210]];
const TRI=[[255,120,50],[255,244,214],[90,232,120]];
const PAL=[[FAIRY,6],[MULTI,4],[[[255,70,78],[255,200,70]],2],[[[90,170,255],[230,240,255]],1],[[[255,110,210],[255,200,70]],1],[TRI,1]];
const LANTC=[[230,50,70],[250,150,40],[240,70,170],[60,180,220],[250,210,70],[120,210,110]];
const side=chance(.5)?-1:1;
const WORLD={
  side,gap:rr(.34,.44),haze:rr(.45,.95),temple:chance(.8)?rr(-.3,.3):null,
  off:[0,1,2,3,4,5,6,7].map(()=>rr(0,3000)),neon:pick([[255,70,170],[80,240,255],[190,110,255]]),
  rangoli:{cols:shuffle([[226,44,120],[250,150,30],[250,214,60],[40,170,110],[60,110,220],[200,40,50]]),petals:pick([8,10,12])},
};

/* ---------- layout ---------- */
// We are inside the city, so it is built around us in depth: rows of blocks going on until they close off the view, a row of flats along a
// side street in the gap, the near blocks and the street below them, neighbouring walls at both edges, and our own roof in front of it all.
// u scales the whole city to the window.
let S=2,W=0,H=0,u=1,hz=0,roofY=0,baseY=0,fgH=0,floorY=0,gapC=0,gapW=0,seatX=0;
let skyC,farC,carpetC,roofC,roofL,rimC,hazeC,vig,grain,grainT=0,gx=0,gy=0,scratch,sctx;
let stars=[],beacons=[],crowns=[],carpetBulbs=[],carpetRoofs=[],lamps=[],roofDiyas=[],rangoli=null,tankX=0;
let near=null,flats=null,close=null;
function layout(){
  S=Math.max(2,Math.round(Math.min(innerWidth/500,innerHeight/290)));
  W=Math.ceil(innerWidth/S);H=Math.ceil(innerHeight/S);
  cv.width=W;cv.height=H;cv.style.width=W*S+'px';cv.style.height=H*S+'px';
  ctx.imageSmoothingEnabled=false;
  const tall=H>W*1.1;
  u=clamp(Math.sqrt(W*H)/380,.7,1.35);
  fgH=Math.round(clamp(H*.21,34,112));roofY=H-fgH;
  baseY=roofY-Math.round(25*u);
  hz=Math.round(H*(tall?.34:.385));
  gapC=Math.round(W*(.5-WORLD.side*.06));gapW=Math.round(W*WORLD.gap);
  seatX=Math.round(W*(.5+WORLD.side*(tall?.08:.14)));
  flats=makeRow(Math.round(14*u),baseY-Math.round(7*u));
  near=makeRow(Math.round(20*u),baseY);
  close=makeRow(Math.round(30*u),roofY+Math.round(30*u));
  paintSky();
  genFlats(flats);genNear(near);genClose(close);
  paintCity();
  paintStreet(near);paintGround(flats);
  bakeRow(flats);bakeRow(near);bakeRow(close);
  paintRoof();paintHaze();
  paintGrade();
  [scratch,sctx]=mk(W,H);
  layoutWho();
  rowsReset();
}

/* ---------- the sky: no moon tonight ---------- */
const SKY=[[0,[3,4,14]],[.4,[8,8,28]],[.72,[28,18,46]],[.92,[74,40,58]],[1,[122,66,60]]];
function skyCol(f){for(let i=1;i<SKY.length;i++)if(f<=SKY[i][0]){const[f0,c0]=SKY[i-1],[f1,c1]=SKY[i];return mix(c0,c1,(f-f0)/(f1-f0));}return SKY[SKY.length-1][1];}
function paintSky(){
  let g;[skyC,g]=mk(W,H);
  const img=g.createImageData(W,H),d=img.data;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const f=Math.min(1,y/(hz*.8));let c=skyCol(f);
    // The smoke of the evening lies over the city in long low banks, lit from underneath.
    const s=vn(x,y*3.2,46,11)*.6+vn(x,y*3.2,19,12)*.4,b=clamp((f-.4)/.6,0,1);
    c=mix(c,[176,96,64],b*b*clamp(s*1.6-.3,0,1)*.6*WORLD.haze);
    const i=(y*W+x)*4;d[i]=quant(c[0],x,y,3);d[i+1]=quant(c[1],x,y,3);d[i+2]=quant(c[2],x,y,3);d[i+3]=255;
  }
  g.putImageData(img,0,0);
  // Only the brightest stars get through the smoke and the city's light.
  stars=[];
  for(let i=0,n=Math.round(W*hz/420);i<n;i++){const y=Math.floor(Math.pow(hash(i,2,21),1.5)*hz*.8);stars.push({x:Math.floor(hash(i,1,21)*W),y,b:(.2+.8*Math.pow(hash(i,3,21),2.2))*(1-y/hz),ph:hash(i,4,21)*500,c:hash(i,5,21)<.2?[190,210,255]:[255,240,220]});}
}

/* ---------- the city around us ---------- */
// There is no skyline to look at, because we are inside it. The same blocks go on in every direction, row behind row, with taller ones
// among them at every distance, until they close off the view. Roofs below eye level show their tops, and taller blocks only a parapet.
function paintCity(){
  let g0,g1;[farC,g0]=mk(W,H);[carpetC,g1]=mk(W,H);carpetBulbs=[];carpetRoofs=[];beacons=[];crowns=[];
  const haze=[92,58,70],rows=[.34,.42,.52,.64,.78,.95],n=rows.length,occ=[],cap=Math.round(H*.15);
  rows.forEach((sc,r)=>{
    const g=r<2?g0:g1,k=r/(n-1),fh=Math.max(3,Math.round(10*u*sc)),y0=Math.round(lerp(H*.33,H*.43,k)),hz2=(1-k)*.38,top=new Int16Array(W).fill(H);
    let x=-hi(r,1,50,0,20),i=0;
    while(x<W){
      const id=r*1000+i,w=Math.round((22+hash(id,1,51)*48)*u*sc*1.4),tall=hash(id,17,51)<.22,nf=tall?hi(id,2,51,5,10):hi(id,2,51,0,4),ty=Math.max(cap,y0-nf*fh+hi(id,3,51,0,2));
      const rs=ty>hz?Math.max(1,Math.round(3.4*sc*u)):1;
      const wall=mix(mix(hp(WALLS,id,4,51),[10,10,18],.8),haze,hz2),roof=mix(mix(hp(TRIMS,id,5,51),[18,16,28],.72),haze,hz2);
      g.fillStyle=css(wall);g.fillRect(x,ty,w,H-ty);
      g.fillStyle=css(mix(wall,[6,6,12],.4));g.fillRect(x+w-Math.max(1,Math.round(4*sc*u)),ty,Math.max(1,Math.round(4*sc*u)),H-ty);
      g.fillStyle=css(roof);g.fillRect(x,ty,w,rs);
      g.fillStyle=css(mix(roof,[8,8,14],.5));g.fillRect(x,ty+rs,w,1);
      for(let xx=Math.max(0,x);xx<Math.min(W,x+w);xx++)top[xx]=Math.min(top[xx],ty);
      // Slabs mark the floors on the nearer blocks, the same way they do on the blocks across the street.
      if(r>=2&&hash(id,19,51)<.7){g.fillStyle=css(mix(roof,wall,.6));for(let y=ty+rs+fh;y<baseY;y+=fh)g.fillRect(x,y,w,1);}
      // Windows, tube-white and warm.
      const ww=Math.max(1,Math.round(2.6*sc*u)),wh=Math.max(1,Math.round(3.4*sc*u));
      for(let y=ty+rs+2;y<baseY;y+=fh)for(let xx=x+2;xx+ww<x+w-1;xx+=ww+Math.max(2,Math.round(4*sc*u))){
        if(hash(xx,y,52)>.5)continue;
        const c=hash(xx,y,53)<.72?hp(WARMW,xx,y,54):hp(TUBEW,xx,y,54);g.fillStyle=css(mix(c,haze,hz2*.5));g.globalAlpha=.55+.45*hash(xx,y,55);g.fillRect(xx,y,ww,wh);g.globalAlpha=1;
      }
      // Black water tanks and stair boxes stand on the roofs, the way they do on every roof in the city.
      if(hash(id,6,51)<.6){const tw=Math.max(2,Math.round(5*sc*u)),th=Math.max(2,Math.round(6*sc*u)),tx=x+hi(id,7,51,1,Math.max(1,w-tw-1));g.fillStyle=css(mix([10,10,16],haze,hz2*.7));g.fillRect(tx,ty-th+1,tw,th);g.fillStyle=css(mix([30,28,38],haze,hz2*.7));g.fillRect(tx,ty-th+1,tw,1);for(let xx=tx;xx<tx+tw;xx++)if(xx>=0&&xx<W)top[xx]=Math.min(top[xx],ty-th+1);}
      if(w>14*u*sc&&hash(id,8,51)<.4){const bw=Math.round(9*sc*u),bh=Math.round(7*sc*u),bx=x+hi(id,9,51,1,Math.max(1,w-bw-1));g.fillStyle=css(mix(wall,[8,8,14],.3));g.fillRect(bx,ty-bh,bw,bh+1);g.fillStyle=css(roof);g.fillRect(bx,ty-bh,bw,1);for(let xx=bx;xx<bx+bw;xx++)if(xx>=0&&xx<W)top[xx]=Math.min(top[xx],ty-bh);}
      // Strings along the parapets, and now and then a whole wall of them hanging like a curtain.
      const pal=wpickH(PAL,id,10),hasStr=hash(id,11,51)<.72,mode=hi(id,12,51,0,3),ph=hash(id,13,51)*40;
      if(hasStr)for(let xx=x+1;xx<x+w-1;xx+=2)carpetBulbs.push({x:xx,y:ty+rs,r,c:pal[(xx>>1)%pal.length],mode,ph:ph+xx*.4,a:.5+.5*sc});
      if(hash(id,14,51)<.12+r*.03){
        const gold=hash(id,15,51)<.7,gap=Math.max(2,Math.round(3*sc*u));
        for(let xx=x+1;xx<x+w-1;xx+=gap){const len=fh*hi(id,xx,56,2,5);for(let y=ty+rs+1;y<ty+rs+len;y+=2)carpetBulbs.push({x:xx,y,r,c:gold?FAIRY[(xx+y)%3]:pal[(xx+(y>>1))%pal.length],mode:4,ph:ph+xx*.9-y*.25,a:.75});}
      }
      // The tallest blocks carry a red light for aircraft, and a few a line of neon along the top.
      if(tall&&hash(id,20,51)<.45)beacons.push({x:x+(w>>1),y:ty-1,r,per:rr0(id,21,1.6,3.2),ph:hash(id,22,51)*9});
      if(tall&&hash(id,23,51)<.22)crowns.push({x,y:ty,w,r,c:WORLD.neon,ph:hash(id,24,51)*20});
      if(ty>hz&&r>=n-2&&w>18*u)carpetRoofs.push({x:x+2,w:w-4,y:ty+rs-1,r,h:Math.max(5,Math.round(10*u*sc)),id});
      x+=w+hi(id,16,51,0,2);i++;
    }
    occ[r]=top;
    if(WORLD.temple!==null&&r===3)paintTemple(g,Math.round(gapC+WORLD.temple*gapW),y0+Math.round(16*u),sc);
  });
  // Anything hidden behind a nearer row of blocks is left out.
  const seen=(x,y,r)=>{if(x<0||x>=W)return false;for(let q=r+1;q<n;q++)if(y>=occ[q][x])return false;return true;};
  carpetBulbs=carpetBulbs.filter(b=>seen(b.x,b.y,b.r));beacons=beacons.filter(b=>seen(b.x,b.y,b.r));crowns=crowns.filter(c=>seen(c.x+(c.w>>1),c.y,c.r));
}
function wpickH(list,a,b){let s=0;for(const it of list)s+=it[1];let r=hash(a,b,57)*s;for(const it of list){r-=it[1];if(r<=0)return it[0];}return list[0][0];}
// A temple spire picked out in gold bulbs: every neighbourhood has one, and tonight it outshines the blocks around it.
function paintTemple(g,cx,base,sc){
  const h=Math.round(66*u*sc),hw=Math.round(17*u*sc),top=base-h;
  for(let y=top;y<base+4;y++){
    const k=clamp((y-top)/h,0,1),w=Math.round(hw*(.14+.86*Math.pow(k,.72))*(1+.08*Math.sin(k*19)));
    g.fillStyle=css(mix([86,62,70],[132,92,78],.5+.5*Math.sin(y*1.7)));g.fillRect(cx-w,y,w*2+1,1);
    if(y%2===0)for(const s of[-1,1])carpetBulbs.push({x:cx+s*w,y,r:3,c:FAIRY[y%3],mode:0,ph:y,a:1});
  }
  for(let y=top-5;y<top;y++)carpetBulbs.push({x:cx,y,r:3,c:[255,226,150],mode:0,ph:0,a:1});
  g.fillStyle='#e06a2a';g.fillRect(cx+1,top-5,3,2);
}

/* ---------- the blocks ---------- */
// Each row is painted as flat colour first, then lit in one pass. A row keeps three pictures: every electric light on, all of them off
// for a power cut, and the current one with this moment's windows. Its front layer holds the rails and everything else that stands in front of people.
function makeRow(fh,base){return{fh,k:fh/20,base,top:base,blocks:[],balc:[],wins:[],lights:[],strings:[],lanterns:[],diyas:[],people:[],roofs:[],A:new Uint8ClampedArray(W*H*4),E:new Uint8ClampedArray(W*H*4),F:new Uint8ClampedArray(W*H*4)};}
const pa=(B,x,y,c,a=255)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;const i=(y*W+x)*4;B[i]=c[0];B[i+1]=c[1];B[i+2]=c[2];B[i+3]=a;};
const box=(B,x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)pa(B,x+i,y+j,c);};
function addString(row,b,x0,y0,x1,y1,sag,step,pal,mode,ph){
  const n=Math.max(2,Math.round(Math.hypot(x1-x0,y1-y0)/step)),pts=[];
  for(let i=0;i<=n;i++){const s=i/n;pts.push({x:Math.round(lerp(x0,x1,s)),y:Math.round(lerp(y0,y1,s)+sag*4*s*(1-s)),c:pal[i%pal.length]});}
  row.strings.push({b,pts,mode,ph,rate:.2+hash(x0,y0,61)*.4});
}
function genFlats(row){
  const k=row.k,fh=row.fh,span=gapW*1.5;
  let x=Math.round(gapC-span/2),i=0,top=row.base;
  while(x<gapC+span/2){
    const id=300+i,nb=hi(id,1,7,2,3),bw=Math.round((30+hash(id,2,7)*8)*k),edge=Math.round(4*k),w=nb*bw+edge*2,floors=hi(id,3,7,3,6);
    const b=addBlock(row,{id,x,w,bw,edge,nb,floors,gh:Math.round(fh*1.1)});
    top=Math.min(top,b.top);x+=w+hi(id,4,7,2,12);i++;
  }
  row.top=top;
}
function genNear(row){
  const k=row.k,fh=row.fh;
  for(const d of[-1,1]){
    let x=gapC+d*gapW/2,i=0;
    while(d<0?x>-30:x<W+30){
      const id=(d<0?100:200)+i,nb=hi(id,1,7,2,4),bw=Math.round((34+hash(id,2,7)*10)*k),edge=Math.round(5*k),w=nb*bw+edge*2;
      const want=H*(lerp(.12,.24,hash(id,3,7))-Math.min(i,2)*.07),gh=Math.round(fh*1.3),floors=clamp(Math.floor((row.base-gh-want)/fh),2,40);
      addBlock(row,{id,x:d<0?Math.round(x-w):Math.round(x),w,bw,edge,nb,floors,gh});
      x+=d*(w+(hash(id,4,7)<.5?hi(id,5,7,3,10):0));i++;
    }
  }
}
// The buildings right beside us run past the top of the frame, close enough to see into, so the view is shut in on both sides.
function genClose(row){
  const k=row.k,fh=row.fh,vis=Math.round(clamp(W*.13,22,120));
  for(const d of[-1,1]){
    const id=d<0?400:401,bw=Math.round((34+hash(id,2,7)*8)*k),edge=Math.round(5*k),nb=Math.max(1,Math.ceil((vis-edge*2)/bw)),w=nb*bw+edge*2,gh=Math.round(fh*.9);
    addBlock(row,{id,x:d<0?vis-w:W-vis,w,bw,edge,nb,floors:Math.ceil(row.base/fh)+1,gh});
  }
}
function addBlock(row,o){
  const{id}=o,par=Math.max(2,Math.round(3*row.k));
  const b=Object.assign(o,{par,top:row.base-o.gh-o.floors*row.fh-par,wall:hp(WALLS,id,8,7),trim:hp(TRIMS,id,9,7),solid:hash(id,10,7)<.45,dens:rr0(id,11,.45,.8),power:1,
    bays:Array.from({length:o.nb},(_,i)=>hash(id,12+i,7)<.74?'balc':'win')});
  if(o.nb>2&&hash(id,20,7)<.45)b.bays[hi(id,21,7,0,o.nb-1)]='stair';
  if(!b.bays.includes('balc'))b.bays[0]='balc';
  row.blocks.push(b);paintBlock(row,b);return b;
}
const rr0=(a,b,lo,up)=>lerp(lo,up,hash(a,b,7));
function paintBlock(row,b){
  const{A,F,fh,k}=row,dk=mix(b.wall,[44,36,48],.6);
  for(let y=b.top;y<row.base;y++)for(let x=b.x;x<b.x+b.w;x++){
    const n=vn(x,y,8,b.id)*.5+vn(x,y*.22,3,b.id+1)*.5;
    pa(A,x,y,mix(b.wall,dk,clamp((n-.36)*1.2,0,.75)));
  }
  // Corners and the parapet catch what light there is.
  box(F,b.x-1,b.top,b.w+2,b.par,b.trim);box(F,b.x-1,b.top+b.par,b.w+2,1,mix(b.trim,[20,18,26],.6));
  const y1=b.top+b.par;
  for(let f=0;f<b.floors;f++){
    const fy=y1+f*fh;
    box(A,b.x,fy,b.w,Math.max(1,Math.round(1.5*k)),mix(b.trim,dk,.3));
    for(let i=0;i<b.nb;i++){
      const x=b.x+b.edge+i*b.bw,kind=b.bays[i];
      if(kind==='balc')paintBalcony(row,b,x+1,fy,b.bw-2,f,i);
      else if(kind==='win')paintWinBay(row,b,x,fy,b.bw,f,i);
      else paintStair(row,b,x,fy,b.bw,f,i);
    }
  }
  // Drain pipes run down the wall between the bays.
  for(let i=1;i<b.nb;i++)if(hash(b.id,i,33)<.5){const x=b.x+b.edge+i*b.bw;for(let y=y1;y<row.base;y++)pa(A,x,y,hash(x,y>>2,34)<.1?[70,66,70]:[56,54,60]);}
  paintShops(row,b);
  paintRoofTop(row,b);
  // Some blocks hang strings of bulbs from the parapet down the face of the building.
  const pal=wpickH(PAL,b.id,22);
  addString(row,b,b.x,b.top+b.par,b.x+b.w,b.top+b.par,0,3*k+1,pal,hi(b.id,23,7,0,2),hash(b.id,24,7)*30);
  if(hash(b.id,25,7)<.55){
    const gold=hash(b.id,26,7)<.65,bay=hi(b.id,27,7,0,b.nb-1),x0=b.x+(hash(b.id,28,7)<.5?0:b.w-b.edge-2),x1=x0+b.edge+1;
    const down=Math.round(b.floors*fh*rr0(b.id,29,.5,1));
    for(let x=x0;x<=x1;x+=2)addString(row,b,x,b.top+b.par+1,x,b.top+b.par+down*(.8+.2*hash(x,b.id,62)),0,3,gold?FAIRY:pal,5,x*.7);
  }
}
function paintBalcony(row,b,x,y,w,fl,bay){
  const{A,F,fh,k}=row,id=b.id*131+fl*17+bay*5;
  const sl=Math.max(1,Math.round(2*k)),floorY=y+fh-1,rh=Math.max(4,Math.round(fh*.36)),railY=floorY-rh+1,iy=y+sl;
  const back=mix(b.wall,[30,26,34],.4),sideC=mix(b.wall,[14,12,18],.7),floorC=mix(b.trim,[44,36,42],.5);
  box(A,x,iy,w,fh-sl,back);
  for(let j=0;j<3;j++)box(A,x,iy+j,w,1,mix(back,[8,7,12],.55-j*.16));
  const sw=Math.max(1,Math.round(2*k));box(A,x,iy,sw,fh-sl,sideC);box(A,x+w-sw,iy,sw,fh-sl,sideC);
  box(A,x+sw,floorY-1,w-sw*2,2,floorC);
  // The door on one side and a window on the other.
  const dw=Math.max(5,Math.round(8*k)),dh=Math.min(fh-sl-2,Math.round(fh*.72)),left=hash(id,1,5)<.5,dx=left?x+sw+Math.round(3*k):x+w-sw-dw-Math.round(3*k),dy=floorY-dh;
  const wood=hp([[96,60,38],[74,46,34],[120,84,52],[60,74,84]],id,2,5);
  box(A,dx-1,dy-1,dw+2,dh+1,mix(wood,[20,16,20],.5));box(A,dx,dy,dw,dh,wood);box(A,dx+1,dy+1,dw-2,Math.round(dh*.4),mix(wood,[220,190,150],.12));pa(A,left?dx+dw-2:dx+1,dy+Math.round(dh*.55),[210,190,130]);
  const wx=left?dx+dw+Math.round(4*k):x+sw+Math.round(3*k),ww=Math.max(4,Math.min(Math.round(11*k),(left?x+w-sw-Math.round(2*k):dx-Math.round(4*k))-wx)),wy=dy+Math.round(1*k),wh=Math.max(3,Math.round(dh*.5));
  paintWindow(row,b,wx,wy,ww,wh,id+3);
  // A garland of marigolds over the door.
  if(hash(id,3,5)<.75)for(let i=-1;i<=dw;i++){const c=(i&1)?[250,160,40]:[252,204,60];pa(A,dx+i,dy-1+((i+id)%3===0?1:0),c);}
  // The rail: solid plaster with a ledge, or iron bars with a flat top.
  const rail=mix(b.trim,[60,54,60],.2);
  if(b.solid){box(F,x,railY,w,rh,mix(b.wall,b.trim,.35));box(F,x,railY,w,1,rail);box(F,x,railY+1,w,1,mix(b.wall,[20,18,26],.45));}
  else{box(F,x,railY,w,1,[64,58,62]);box(F,x,floorY-1,w,1,[44,40,46]);for(let i=1;i<w-1;i+=Math.max(2,Math.round(3*k)))box(F,x+i,railY+1,1,rh-2,[40,36,42]);}
  box(F,x-1,y,w+2,sl,b.trim);box(F,x-1,y+sl,w+2,1,mix(b.trim,[16,14,20],.7));
  const B={row,b,fl,x,w,y,sw,floorY,railY,dx,dw,dh,dy,left,door:0,doorT:0,busy:false,id,diyas:[],name:ORD[Math.min(ORD.length-1,b.floors-fl)]};
  row.balc.push(B);
  const cx=x+w/2;
  const clip=[x,iy,w,fh-sl],lit=hash(id,90,5)<.72;
  if(lit)row.lights.push({x:cx,y:iy+fh*.3,r:fh*.75,c:[255,168,84],k:1.15,el:true,clip});
  // Decoration differs balcony to balcony: bulbs along the slab, a paper lantern, diyas or candles on the rail, plants and washing.
  if(hash(id,4,5)<.68){const pal=wpickH(PAL,id,5);addString(row,b,x+1,iy+1,x+w-2,iy+1,Math.round(fh*.12),Math.max(2,3*k),pal,hi(id,6,5,0,3),hash(id,7,5)*30);row.lights.push({x:cx,y:iy+3,r:fh*.7,c:pal[0],k:.7,el:true,clip});row.lights.push({x:cx,y:iy+fh*.9,r:fh*.8,c:pal[0],k:.09,el:true});}
  if(hash(id,8,5)<.32){const c=hp(LANTC,id,9,5),lx=Math.round(left?x+w*.7:x+w*.3);B.lantern=true;row.lanterns.push({b,x:lx,y:iy,len:Math.round(fh*.2),c,a:0,v:0,ph:hash(id,10,5)*9,star:hash(id,11,5)<.55});row.lights.push({x:lx,y:iy+fh*.34,r:fh*.6,c,k:.8,el:true,clip});row.lights.push({x:lx,y:iy+fh*.5,r:fh*.7,c,k:.16,el:true});}
  const n=hash(id,12,5)<.8?hi(id,13,5,2,Math.max(2,Math.round(w/(5*k)))):0;
  for(let i=0;i<n;i++){const px=Math.round(lerp(x+2,x+w-3,(i+.5+(hash(id,14+i,5)-.5)*.5)/n)),candle=hash(id,30+i,5)<.2;B.diyas.push({x:px,y:railY-1,lit:hash(id,40+i,5)<.82,ph:hash(id,50+i,5)*50,candle,fuel:.5+.5*hash(id,55+i,5)});row.diyas.push(B.diyas[B.diyas.length-1]);row.lights.push({x:px,y:railY-2,r:fh*.32,c:[255,150,60],k:.8,el:false});pa(F,px-1,railY-1,[130,70,40]);pa(F,px,railY-1,[150,84,48]);pa(F,px+1,railY-1,[130,70,40]);}
  if(hash(id,15,5)<.45){const px=Math.round(left?x+w-sw-3*k:x+sw+2*k),green=[[46,96,52],[34,76,44],[60,116,60]];box(F,px-1,railY-Math.round(2*k),Math.max(3,Math.round(4*k)),Math.round(2*k),[120,70,44]);for(let i=0;i<9*k;i++)pa(F,px+hi(id,60+i,5,-2,3),railY-Math.round(2*k)-hi(id,70+i,5,1,Math.round(5*k)),hp(green,id,80+i,5));}
  if(hash(id,16,5)<.22){const c0=hp(CURTC,id,17,5),n2=hi(id,18,5,1,3),cy=iy+Math.round(2*k);box(A,x+sw,cy,w-sw*2,1,[30,28,34]);for(let i=0;i<n2;i++){const cx2=x+sw+hi(id,19+i,5,2,w-sw*2-6),cw=hi(id,23+i,5,3,5),ch=hi(id,27+i,5,4,Math.round(9*k)),c=i?mix(c0,[220,214,200],.5):c0;box(A,cx2,cy+1,cw,ch,c);}}
}
const GOODS=[[[236,120,150],[250,220,120],[240,236,220],[236,170,70]],[[214,50,50],[240,190,60],[236,120,40]],[[60,150,140],[210,70,120],[230,190,90],[120,90,170]]];
const ORD=['ground-floor','first-floor','second-floor','third-floor','fourth-floor','fifth-floor','sixth-floor','seventh-floor','eighth-floor','high'];
function paintWindow(row,b,x,y,w,h,id){
  const{A,E,k}=row,on=hash(id,1,9)<b.dens,tube=hash(id,2,9)<.26,c=hp(tube?TUBEW:WARMW,id,3,9),cur=hp(CURTC,id,4,9),drawn=hash(id,5,9);
  box(A,x-1,y-1,w+2,h+2,mix(b.trim,[30,26,32],.45));box(A,x,y,w,h,[20,24,36]);box(A,x-1,y+h+1,w+2,1,b.trim);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const u0=(i+.5)/w,cl=drawn*.42,edge=u0<cl||u0>1-cl*.7,fold=(i&1)?.86:1,v=j/h;
    let q=edge?mix(cur,c,.42):mix(c,[255,250,235],.15*(1-v));
    q=[q[0]*(edge?fold:1),q[1]*(edge?fold:1),q[2]*(edge?fold:1)];
    pa(E,x+i,y+j,q);
  }
  if(w>6*k)for(let j=0;j<h;j++)pa(E,x+(w>>1),y+j,mix(c,[40,30,30],.65));
  for(let i=0;i<w;i+=2)for(let j=1;j<h;j+=Math.max(3,Math.round(3*k)))pa(E,x+i,y+j,mix(c,[40,30,30],.3));
  const W0={x:x-1,y:y-1,w:w+2,h:h+2,on,b,tv:hash(id,6,9)<.1,ix:x,iy:y,iw:w,ih:h,ph:hash(id,7,9)*40};
  row.wins.push(W0);
  if(on)row.lights.push({x:x+w/2,y:y+h/2,r:Math.max(w,h)*.9,c,k:.16,el:true});
}
function paintWinBay(row,b,x,y,w,f,i){
  const{A,F,fh,k}=row,id=b.id*173+f*19+i*7,two=w>30*k,top=y+Math.round(5*k),wh=Math.round(fh*.5),ww=Math.round((two?10:14)*k);
  if(two){paintWindow(row,b,x+Math.round(w*.14),top,ww,wh,id+1);paintWindow(row,b,x+Math.round(w*.58),top,ww,wh,id+2);}
  else paintWindow(row,b,x+Math.round((w-ww)/2),top,ww,wh,id+1);
  // A concrete hood over the windows, and sometimes an air conditioner.
  box(F,x+2,top-Math.round(3*k),w-4,1,mix(b.trim,[40,36,42],.25));
  if(hash(id,1,11)<.4){const ax=x+hi(id,2,11,3,Math.max(3,w-14)),ay=top+wh+Math.round(2*k);box(A,ax,ay,Math.round(9*k),Math.round(5*k),[120,120,122]);box(A,ax+1,ay+1,Math.round(5*k),Math.round(3*k),[56,58,64]);}
}
function paintStair(row,b,x,y,w,f,i){
  // The stairwell is a column of pierced concrete, with the landing light showing through.
  const{A,E,fh,k}=row,id=b.id*211+f*23+i,sx=x+Math.round(w*.25),sw=Math.round(w*.5),on=hash(id,1,13)<.8,step=Math.max(2,Math.round(3*k));
  box(A,sx-1,y+1,sw+2,fh-1,mix(b.trim,[40,36,44],.3));
  for(let yy=y+2;yy<y+fh-1;yy+=step)for(let xx=sx;xx<sx+sw;xx+=step){pa(A,xx,yy,[18,16,22]);if(on)pa(E,xx,yy,[255,204,130]);}
  if(on)row.lights.push({x:sx+sw/2,y:y+fh/2,r:fh*.5,c:[255,190,110],k:.18,el:true});
}
function paintShops(row,b){
  const{A,E,F,fh,k}=row,y=row.base-b.gh,bh=Math.max(3,Math.round(5*k));
  box(F,b.x-1,y-1,b.w+2,Math.max(1,Math.round(2*k)),b.trim);
  for(let i=0;i<b.nb;i++){
    const id=b.id*59+i,x=b.x+b.edge+i*b.bw+1,w=b.bw-2,open=hash(id,1,15)<.62,c=hp([[190,44,50],[40,120,90],[230,170,60],[40,90,150],[150,50,130]],id,2,15),by=y+1;
    box(A,x,y,w,b.gh,[24,22,28]);
    if(open){
      // An open shop: a board with a line of script and a warm room behind it.
      for(let yy=by;yy<by+bh;yy++)for(let xx=x;xx<x+w;xx++)pa(E,xx,yy,mix(c,[255,240,210],yy===by?.3:.06));
      let px=x+2;while(px<x+w-3){const l=hi(px,id,16,3,6);for(let j=0;j<l&&px+j<x+w-2;j++)pa(E,px+j,by+1,[255,244,214]);for(let j=0;j<l;j+=2)if(px+j<x+w-2){pa(E,px+j,by+2,[255,244,214]);if(bh>4&&hash(px+j,id,17)<.6)pa(E,px+j,by+3,[255,244,214]);}px+=l+2;}
      const iy=by+bh+1,sh=Math.max(4,Math.round(5*k)),cnt=row.base-Math.max(3,Math.round(4*k)),gp=hp(GOODS,id,18,15);
      for(let yy=iy;yy<row.base;yy++)for(let xx=x+1;xx<x+w-1;xx++)pa(E,xx,yy,yy===iy?[255,240,214]:yy>=cnt?[86,54,36]:mix([206,146,84],[150,96,58],(yy-iy)/(cnt-iy)));
      for(let yy=iy+sh;yy<cnt;yy+=sh){
        for(let xx=x+1;xx<x+w-1;xx++)pa(E,xx,yy,[96,60,40]);
        let gx0=x+2;while(gx0<x+w-3){const l=hi(gx0,yy,19,2,4),c0=hp(gp,gx0,yy,20),th=hi(gx0,yy,21,1,Math.max(1,sh-2));if(hash(gx0,yy,22)<.8)for(let j=0;j<l&&gx0+j<x+w-2;j++)for(let q=1;q<=th;q++)pa(E,gx0+j,yy-q,q===th?mix(c0,[255,255,255],.2):c0);gx0+=l+hi(gx0,yy,23,1,2);}
      }
      row.lights.push({x:x+w/2,y:row.base+2,r:w*.55,c:[255,186,104],k:.8,el:true});
      row.wins.push({x,y:by,w,h:row.base-by,on:true,b,shop:true,ix:x,iy:by,iw:w,ih:row.base-by,ph:0});
    }else{
      // A rolled-down shutter.
      for(let yy=by;yy<row.base;yy++)for(let xx=x;xx<x+w;xx++)pa(A,xx,yy,((yy-by)&1)?[92,90,94]:[72,70,76]);
      box(A,x,by,w,1,c);
    }
  }
}
function paintRoofTop(row,b){
  const{A,k}=row,y=b.top;
  for(let i=0,n=hi(b.id,30,7,1,2);i<n;i++){
    const tw=Math.round((11+hash(b.id,31+i,7)*5)*k),th=Math.round((13+hash(b.id,33+i,7)*5)*k),tx=b.x+hi(b.id,35+i,7,4,Math.max(4,b.w-tw-4)),st=Math.round(3*k);
    box(A,tx+1,y-st,1,st+1,[30,28,32]);box(A,tx+tw-2,y-st,1,st+1,[30,28,32]);
    for(let yy=0;yy<th;yy++)for(let xx=0;xx<tw;xx++){const v=xx/tw;pa(A,tx+xx,y-st-th+yy,yy%Math.max(3,Math.round(4*k))===0?[34,34,40]:mix([44,44,52],[16,16,22],Math.abs(v-.32)*1.4));}
    box(A,tx+2,y-st-th-1,tw-4,1,[50,50,58]);
  }
  if(hash(b.id,37,7)<.6){const bw=Math.round(18*k),bh=Math.round(12*k),bx=b.x+hi(b.id,38,7,3,Math.max(3,b.w-bw-3));box(A,bx,y-bh,bw,bh+1,mix(b.wall,[40,34,44],.25));box(A,bx-1,y-bh-1,bw+2,1,b.trim);row.roofs.push({b,x:bx+bw/2});}
  row.roofs.push({b,x:b.x+b.w/2});
}

/* ---------- the street ---------- */
function paintStreet(row){
  const{A,F,k}=row,pv=Math.round(5*k),base=row.base;
  row.pave=base+pv;
  for(let y=base;y<roofY+3;y++)for(let x=0;x<W;x++){
    let c;
    if(y<base+pv-1){c=((x>>2)+(y>>1))&1?[112,102,96]:[100,92,90];if(hash(x,y,41)<.05)c=[84,78,78];}
    else if(y===base+pv-1)c=[150,140,124];
    else{c=mix([48,46,54],[36,34,42],vn(x,y*2.8,14,42));if(hash(x,y,43)<.03)c=[58,56,62];if(vn(x,y*3,5,44)>.74)c=mix(c,[30,28,34],.6);}
    pa(A,x,y,c);
  }
  // Street lamps and the wires between them.
  lamps=[];
  const step=Math.round(lerp(110,150,hash(1,2,45))*k),h=Math.round(row.fh*3.2),poles=[];
  for(let x=gapC%step-step;x<W+step;x+=step){
    const px=x+hi(x,1,45,-8,8),py=base+pv-1,ty=py-h,dir=hash(x,2,45)<.5?-1:1;
    box(F,px,ty,Math.max(1,Math.round(1.4*k)),h,[38,36,42]);
    const al=Math.round(9*k);box(F,dir<0?px-al:px,ty,al,1,[46,44,50]);
    const lx=px+dir*al;box(F,lx-1,ty+1,3,1,[255,214,150]);
    lamps.push({x:lx,y:ty+2,ph:hash(x,3,45)*50,bad:hash(x,4,45)<.18});
    row.lights.push({x:lx,y:py+Math.round(7*k),r:h*.62,c:[255,158,70],k:1.05,el:true,sq:2.6});
    poles.push({x:px,y:ty+2});
  }
  for(let i=0;i+1<poles.length;i++){
    const a=poles[i],b=poles[i+1];
    for(let w=0;w<3;w++){
      const sag=(5+w*2+hash(i,w,46)*3)*k,y0=a.y+w*2,y1=b.y+w*2;
      for(let x=a.x;x<=b.x;x++){const s=(x-a.x)/(b.x-a.x);pa(F,x,lerp(y0,y1,s)+sag*4*s*(1-s),[20,18,24]);}
    }
    // Bulbs across the street on a wire, the way a lane decorates itself for the festival.
    if(hash(i,5,46)<.75){const pal=wpickH(PAL,i,47),y=a.y+1;row.strings.push({b:{power:1},pts:Array.from({length:Math.floor((b.x-a.x)/(4*k))},(_,j)=>{const s=(j+.5)*4*k/(b.x-a.x);return{x:Math.round(lerp(a.x,b.x,s)),y:Math.round(y+(9*k)*4*s*(1-s)),c:pal[j%pal.length]};}),mode:hi(i,6,46,0,2),ph:hash(i,7,46)*30,rate:.3});}
  }
}
// In the gap a side street runs off past the flats, with a few old trees at the kerb wound with fairy lights.
function paintGround(row){
  const{A,F,k}=row;
  for(let y=row.base;y<baseY+1;y++)for(let x=0;x<W;x++)pa(A,x,y,((x>>2)+(y>>1))&1?[104,96,92]:[92,86,84]);
  for(let i=0,x=gapC-gapW;x<gapC+gapW;i++){
    const r=(12+hash(i,1,49)*11)*k,cy=baseY-r*1.5+hash(i,2,49)*3,blobs=[];
    for(let j=0;j<7;j++)blobs.push([x+(hash(i,j,50)-.5)*r*1.7,cy+(hash(i,j+9,50)-.5)*r*1.1,r*(.42+hash(i,j+19,50)*.34)]);
    box(F,Math.round(x),Math.round(cy),Math.max(2,Math.round(2.4*k)),baseY-Math.round(cy),[34,26,24]);
    for(const[bx,by,br]of blobs)for(let yy=-br;yy<=br;yy++)for(let xx=-br;xx<=br;xx++){
      if(xx*xx+yy*yy>br*br)continue;const px=Math.round(bx+xx),py=Math.round(by+yy),n=vn(px,py,3,58);if(n<.26)continue;
      pa(F,px,py,n>.68?[52,78,52]:n>.46?[36,58,42]:[26,42,34]);
    }
    if(hash(i,3,49)<.8){for(let j=0;j<3;j++){const[bx,by,br]=blobs[j*2];addString(row,{power:1},bx-br,by,bx+br,by+1,br*.5,2.4,FAIRY,2,hash(i,j,59)*30);}row.lights.push({x,y:cy,r:r*.9,c:[255,180,90],k:.16,el:true});}
    x+=r*(4+hash(i,4,49)*5);
  }
}

/* ---------- lighting a row ---------- */
const AMB=[.18,.15,.23];
function bakeRow(row){
  const n=W*H,Lon=new Float32Array(n*3),Lall=new Float32Array(n*3),{A,E,F}=row;
  for(const l of row.lights){
    const R0=l.r*3,cl=l.clip,x0=Math.max(0,Math.floor(l.x-R0),cl?cl[0]:0),x1=Math.min(W-1,Math.ceil(l.x+R0),cl?cl[0]+cl[2]-1:W),y0=Math.max(0,Math.floor(l.y-R0),cl?cl[1]:0),y1=Math.min(H-1,Math.ceil(l.y+R0),cl?cl[1]+cl[3]-1:H);
    const L=l.el?Lon:Lall,cr=l.c[0]/255*l.k,cg=l.c[1]/255*l.k,cb=l.c[2]/255*l.k;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const d=Math.hypot(x-l.x,(y-l.y)*(l.sq||1))/l.r,f=1/(1+d*d)**2-.012;if(f<=0)continue;const i=(y*W+x)*3;L[i]+=cr*f;L[i+1]+=cg*f;L[i+2]+=cb*f;}
  }
  const[on,og]=mk(W,H),[off,fg]=mk(W,H),[fr,rg]=mk(W,H),oi=og.createImageData(W,H),fi=fg.createImageData(W,H),ri2=rg.createImageData(W,H),o=oi.data,f=fi.data,r=ri2.data;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const p=y*W+x,i=p*4,l=p*3;
    if(A[i+3]||E[i+3]){
      for(let j=0;j<3;j++){
        // Lights add up, but a wall never burns out to white however many of them are near it.
        const a=A[i+j],lo=Lall[l+j],la=lo+Lon[l+j],base=a*(AMB[j]+lo/(1+lo*.8)),lit=a*(AMB[j]+la/(1+la*.8));
        f[i+j]=quant(base,x,y,4);o[i+j]=quant(E[i+3]?E[i+j]*.92+lit*.15:lit,x,y,4);
      }
      f[i+3]=o[i+3]=255;
    }
    if(F[i+3]){for(let j=0;j<3;j++){const la=Lall[l+j]*.6+Lon[l+j]*.55;r[i+j]=quant(F[i+j]*(AMB[j]+la/(1+la*1.3)),x,y,4);}r[i+3]=255;}
  }
  og.putImageData(oi,0,0);fg.putImageData(fi,0,0);rg.putImageData(ri2,0,0);
  row.onC=on;row.offC=off;row.frontC=fr;
  const[al,ag]=mk(W,H),ai=ag.createImageData(W,H);for(let i=0;i<W*H*4;i+=4){if(A[i+3]){ai.data[i]=A[i];ai.data[i+1]=A[i+1];ai.data[i+2]=A[i+2];ai.data[i+3]=255;}else if(F[i+3]){ai.data[i]=F[i];ai.data[i+1]=F[i+1];ai.data[i+2]=F[i+2];ai.data[i+3]=255;}}ag.putImageData(ai,0,0);row.albC=al;
  [row.curC,row.curG]=mk(W,H);row.curG.drawImage(on,0,0);
  for(const w of row.wins)if(!w.on)row.curG.drawImage(off,w.x,w.y,w.w,w.h,w.x,w.y,w.w,w.h);
  row.A=row.E=row.F=null;
}

/* ---------- our roof ---------- */
function paintRoof(){
  const A=new Uint8ClampedArray(W*H*4),lh=Math.max(3,Math.round(5*u));
  floorY=roofY+lh+Math.round(fgH*.36);
  for(let y=roofY;y<H;y++)for(let x=0;x<W;x++){
    let c;
    if(y<roofY+lh){const n=vn(x,y*2,9,71);c=y===roofY?[176,166,150]:mix([146,136,124],[118,110,104],n);if(hash(x,y,72)<.04)c=[100,94,90];}
    else if(y<floorY){
      const n=vn(x,y,11,73)*.6+vn(x,y*.3,4,74)*.4;c=mix([122,112,104],[80,74,74],clamp((n-.3)*1.4,0,1));
      if(y<roofY+lh+2)c=mix(c,[30,26,30],.55);
      if(vn(x,y*.15,2.5,75)>.8)c=mix(c,[50,44,46],.4);
    }else{
      // Cement tiles, running away from us.
      const v=(y-floorY)/(H-floorY),sc=.55+v*.9,tx=(x-W/2)/sc,row2=Math.floor(Math.pow(v,.7)*6);
      c=mix([96,90,88],[70,66,68],vn(x,y*3,13,76));
      if(Math.abs(((tx+row2*10)%34+34)%34)<1.1||(y-floorY)===Math.round(Math.pow((row2+1)/6,1/.7)*(H-floorY)))c=mix(c,[34,32,36],.5);
      if(y<floorY+2)c=mix(c,[24,22,26],.55);
    }
    pa(A,x,y,c);
  }
  // A black tank on a brick stand at the far side of the roof.
  tankX=Math.round(W*(.5-WORLD.side*.42));
  {
    const tw=Math.round(50*u),th=Math.round(58*u),by=floorY+Math.round(fgH*.1),ty=by-th-Math.round(8*u);
    box(A,tankX-tw/2+2,by-Math.round(8*u),tw-4,Math.round(9*u),[96,62,52]);
    for(let y=by-Math.round(8*u);y<by;y+=2)for(let x=-tw/2+2;x<tw/2-2;x+=4)pa(A,tankX+x+((y>>1)&1)*2,y,[60,40,36]);
    for(let y=0;y<th;y++){
      const e=y/th,sq=e<.08?Math.sqrt(1-((.08-e)/.08)**2):1;
      for(let x=-tw/2;x<tw/2;x++){
        const nx=(x+.5)/(tw/2);if(Math.abs(nx)>sq)continue;
        let c=mix([150,150,172],[46,46,60],clamp(Math.abs(nx+.28)*1.15,0,1));
        if(y%Math.round(9*u)<1)c=mix(c,[14,14,20],.7);else if(y%Math.round(9*u)<2)c=mix(c,[210,210,226],.14);
        pa(A,tankX+x,ty+y,c);
      }
    }
    box(A,tankX-Math.round(6*u),ty-3,Math.round(12*u),4,[96,96,112]);
    // A pipe down to the floor.
    box(A,tankX+Math.round(tw*.42),by-4,2,Math.round(8*u),[112,112,116]);
  }
  // Plants in old paint tins by the wall, on the side away from the tank.
  for(let i=0,n=hi(1,1,77,2,3);i<n;i++){
    const px=Math.round(W*(.5+WORLD.side*(.3+i*.06+hash(i,2,77)*.03))),py=floorY+Math.round(5*u)+i*3,pw=Math.round(9*u),ph=Math.round(10*u);
    for(let k=0;k<70*u;k++){const a=hash(i,k,78)*3.14,l=(6+hash(i,k,79)*18)*u,x=px+pw/2+Math.cos(a)*l*.7,y=py-Math.sin(a)*l;pa(A,x,y,hash(i,k,80)<.5?[60,110,60]:[40,84,50]);}
    box(A,px,py,pw,ph,hash(i,3,77)<.5?[160,84,54]:[130,60,50]);box(A,px-1,py,pw+2,2,[176,110,78]);
  }
  // A rangoli on the floor, laid out in coloured powder and foreshortened by the view.
  const rside=-WORLD.side,rcx=Math.round(W*(.5+rside*.2)),rcy=floorY+Math.round((H-floorY)*.62),rx=Math.round(clamp(50*u,30,W*.2)),ry=Math.max(7,Math.round((H-floorY)*.46));
  const RC=WORLD.rangoli.cols,petals=WORLD.rangoli.petals;
  rangoli={x:rcx,y:rcy,rx,ry};
  for(let y=-ry;y<=ry;y++)for(let x=-rx;x<=rx;x++){
    const nx=x/rx,ny=y/ry,r=Math.hypot(nx,ny);if(r>1)continue;
    const a=Math.atan2(ny,nx),p=Math.abs(Math.cos(a*petals/2)),p2=Math.abs(Math.cos(a*petals/2+Math.PI/2));
    let c=null;
    if(r<.14)c=RC[2];else if(r<.19)c=[240,236,226];
    else if(r<.2+.3*p)c=r<.13+.26*p?RC[0]:RC[1];
    else if(r<.56)c=RC[3];else if(r<.61)c=[240,236,226];
    else if(r<.62+.3*p2)c=r<.6+.2*p2?RC[2]:RC[4];
    else if(r<.97)c=RC[5];else c=[240,236,226];
    if(c&&hash(x,y,81)>.04)pa(A,rcx+x,rcy+y,c);
  }
  // Diyas: along the ledge, in ones and twos, and in a ring round the rangoli.
  roofDiyas=[];
  const s=Math.max(1,Math.round(u));
  for(let x=hi(2,2,82,6,18),i=0;x<W;i++){
    if(Math.abs(x-seatX)>20*u&&Math.abs(x-tankX)>30*u)roofDiyas.push({x,y:roofY,ph:hash(i,1,83)*60,lit:hash(i,2,83)<.9,s,ledge:true,fuel:.6+.4*hash(i,7,83)});
    x+=Math.round((hash(i,3,83)<.3?11:26+hash(i,4,83)*30)*u);
  }
  for(let i=0,n=hi(3,3,82,7,10);i<n;i++){const a=i/n*6.283+hash(i,5,83)*.2;roofDiyas.push({x:Math.round(rcx+Math.cos(a)*rx*1.06),y:Math.round(rcy+Math.sin(a)*ry*1.06)+1,ph:hash(i,6,83)*60,lit:true,s,fuel:.6+.4*hash(i,8,83)});}
  for(const d of roofDiyas){
    const hw=2+s*1.2;
    for(let y=0;y<2+s;y++){const w=Math.round(hw*(1-y*.22));for(let x=-w;x<=w;x++)pa(A,d.x+x,d.y-1-(1+s)+y+1,y===0?[186,110,66]:x<0?[150,84,50]:[120,64,40]);}
  }
  // Paint it twice: cold, and with every diya burning. Each frame draws the cold one, then the warm one on top at the diyas' flicker.
  const[c0,g0]=mk(W,H),[c1,g1]=mk(W,H),i0=g0.createImageData(W,H),i1=g1.createImageData(W,H),d0=i0.data,d1=i1.data,amb=[.19,.17,.27];
  const Lr=clamp(17*u,12,34);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4;if(!A[i+3])continue;
    let L=0;for(const d of roofDiyas){if(!d.lit)continue;const dd=Math.hypot(x-d.x,(y-d.y+3)*(d.ledge?1.3:2.2))/Lr;if(dd<5)L+=1/(1+dd*dd)**1.5;}
    if(y>=roofY+lh&&y<floorY)L*=.3;
    L=Math.min(1.3,L);
    for(let j=0;j<3;j++){const a=A[i+j],b=a*amb[j];d0[i+j]=quant(b,x,y,4);d1[i+j]=quant(b+a*L*[1.15,.68,.3][j],x,y,4);}
    d0[i+3]=d1[i+3]=255;
  }
  g0.putImageData(i0,0,0);g1.putImageData(i1,0,0);roofC=c0;roofL=c1;
  // Fireworks are in front of us, so they only catch the top of the ledge and the rim of the tank.
  const[c2,g2]=mk(W,H),i2=g2.createImageData(W,H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(!A[i+3])continue;const top=y>0&&!A[((y-1)*W+x)*4+3],edge=y<roofY+lh&&y>=roofY;if(!top&&!edge)continue;i2.data[i]=A[i];i2.data[i+1]=A[i+1];i2.data[i+2]=A[i+2];i2.data[i+3]=255;}
  g2.putImageData(i2,0,0);rimC=c2;
}

/* ---------- lo-fi grade ---------- */
function paintGrade(){
  let g;[vig,g]=mk(W,H);
  const img=g.createImageData(W,H),d=img.data,rv=Math.hypot(W*.62,H*.7);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const r=Math.hypot(x-W/2,y-H*.5)/rv,a=clamp((r-.5)/.5,0,1),i=(y*W+x)*4;
    d[i]=8;d[i+1]=4;d[i+2]=14;d[i+3]=Math.round(255*clamp(a*a*.5+(bayer(x,y)-.5)*.03,0,1));
  }
  g.putImageData(img,0,0);
  [grain,g]=mk(W+64,H+64);
  const gi=g.createImageData(W+64,H+64),gd=gi.data;
  for(let i=0;i<gd.length;i+=4){const v=hash(i,7,151);gd[i]=gd[i+1]=gd[i+2]=v<.5?0:255;gd[i+3]=Math.round(Math.abs(v-.5)*2*hash(i,8,151)*26);}
  g.putImageData(gi,0,0);
}

/* ---------- smoke over the city ---------- */
// Long banks of smoke, wrapped so they can drift sideways forever.
function paintHaze(){
  let g;[hazeC,g]=mk(W,H);
  const img=g.createImageData(W,H),d=img.data,n=Math.max(4,Math.round(W/44)),s=W/n;
  const wn=(x,y,k)=>{const gx=x/s,gy=y/9,ix=Math.floor(gx),iy=Math.floor(gy),fx=ease(gx-ix),fy=ease(gy-iy),a=((ix%n)+n)%n,b=(a+1)%n;return lerp(lerp(hash(a,iy,k),hash(b,iy,k),fx),lerp(hash(a,iy+1,k),hash(b,iy+1,k),fx),fy);};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const f=Math.exp(-(((y-hz+8*u)/(H*.12))**2)),v=wn(x,y,91)*.65+wn(x*2,y*2,92)*.35,a=f*clamp(v*1.9-.55,0,1)*.36+(bayer(x,y)-.5)*.04;
    if(a<=.01)continue;const i=(y*W+x)*4;d[i]=150;d[i+1]=92;d[i+2]=84;d[i+3]=255*a;
  }
  g.putImageData(img,0,0);
}

/* ---------- lights that move ---------- */
let t=0,DT=1/60,wind=0,gust=null,act=1,warming=false,cut=null,hazeAmt=.7,hazeX=0;
function drawBulbs(){
  for(const b of carpetBulbs){
    let a=b.a;const m=b.mode;
    if(m===1)a*=.62+.38*Math.sin(t*.45+b.ph);
    else if(m===2)a*=.5+.5*noise(t*.3+b.ph);
    else if(m===3)a*=.7+.3*Math.sin(t*.3+b.ph*.3);
    else if(m===4)a*=.35+.65*Math.pow(((b.ph*.11+t*.1)%1+1)%1,3);
    dot(b.x,b.y,b.c,a);
  }
  ctx.globalAlpha=1;
}
function drawStrings(row){
  const halo=row===near;
  for(const s of row.strings){
    const pw=s.b.power;if(pw<.05)continue;
    const n=s.pts.length,m=s.mode,ph=s.ph,r=s.rate;
    for(let i=0;i<n;i++){
      const p=s.pts[i];let a=.95;
      if(m===1)a=.6+.4*Math.sin(t*r-i*.5+ph);
      else if(m===2)a=.45+.55*noise(t*r+i*5.3+ph);
      else if(m===3)a=.66+.34*Math.sin(t*r+ph+(i&1)*3.14);
      else if(m===5){const k=((i/n-t*.05+ph)%1+1)%1;a=.3+.7*k**5;}
      a*=pw;dot(p.x,p.y,p.c,a);
      if(halo&&a>.4){const h=a*.2;dot(p.x-1,p.y,p.c,h);dot(p.x+1,p.y,p.c,h);dot(p.x,p.y-1,p.c,h);dot(p.x,p.y+1,p.c,h);}
    }
  }
  ctx.globalAlpha=1;
}
const FLAME=[[255,250,214],[255,214,110],[255,150,46],[226,84,24]];
// A small flame on a rail. It leans with the wind and shrinks in a gust.
function drawSmallDiyas(row){
  const big=row.k>.8;
  for(const d of row.diyas){
    if(d.candle){dot(d.x,d.y,[226,216,196],1);if(big)dot(d.x,d.y-1,[226,216,196],1);}
    if(!d.lit)continue;
    const n=noise(t*.5+d.ph),top=d.candle?(big?2:1):0,lean=Math.round(clamp(wind*.7,-1,1)*(.4+n*.6));
    dot(d.x,d.y-1-top,FLAME[1],.9);
    if(big)dot(d.x+lean,d.y-2-top,FLAME[2],.34+.16*n);
    ctx.globalCompositeOperation='lighter';const s=glow(big?4:3,[255,150,60],.55);ctx.globalAlpha=.68+.12*n;ctx.drawImage(s,d.x-s.width/2+.5|0,d.y-1-top-s.height/2+.5|0);ctx.globalCompositeOperation='source-over';
  }
  ctx.globalAlpha=1;
}
function stepLanterns(row,dt){for(const l of row.lanterns){const f=wind*.8+(noise(t*.22+l.ph)-.5)*(.35+Math.abs(wind));l.v+=(-3.2*Math.sin(l.a)+f*1.1-l.v*1.1)*dt;l.a+=l.v*dt;}}
const LBIG=['...#...','..###..','#######','.#####.','..###..','.##.##.'],LHEX=['.#####.','#######','#######','#######','.#####.'],LSM=['..#..','.###.','#####','.###.','..#..'];
function drawLantern(row,l){
  const pw=l.b.power,sh=LS(row,l),w=sh[0].length,len=l.len,sx=Math.sin(l.a),bx=l.x+sx*len*1.6,by=l.y+Math.cos(l.a)*len;
  for(let i=0;i<=len;i++)dot(lerp(l.x,bx,i/len),lerp(l.y,by,i/len),[30,28,32],1);
  const c=l.c,hot=mix(c,[255,240,200],.55),dim=mix(c,[30,20,30],.45),X=Math.round(bx-w/2),Y=Math.round(by);
  sh.forEach((r,j)=>{for(let i=0;i<w;i++)if(r[i]==='#'){const e=Math.hypot(i-w/2+.5,j-sh.length/2+.5)/(w/2);dot(X+i,Y+j,pw>.5?(e<.5?(l.hot||(l.hot=hot)):c):(l.dim||(l.dim=dim)),1);}});
  // Paper tails hang under it and trail behind the swing.
  const ty=Y+sh.length,tails=row.k>.8?3:1;for(let i=0;i<tails;i++){const tx=X+Math.round(w/2)-1+i;dot(tx-sx*2,ty,c,.9);dot(tx-sx*3,ty+1,c,.6);}
  ctx.globalAlpha=1;
  if(pw>.5)bloom(bx,by+sh.length/2,row.k>.8?11:7,c,.34+.06*noise(t*.4+l.ph));
}
const LS=(row,l)=>row.k<.8?LSM:l.star?LBIG:LHEX;
function drawDoors(row){
  for(const B of row.balc){
    if(B.door<.02)continue;
    const w=Math.max(1,Math.round(B.dw*B.door)),x=B.left?B.dx:B.dx+B.dw-w,dark=B.b.power<.5;
    ctx.fillStyle=dark?'#3a2418':'#ffc98a';ctx.fillRect(x,B.dy,w,B.dh);
    ctx.fillStyle=dark?'#2a1a14':'#ffae66';ctx.fillRect(x,B.dy+Math.round(B.dh*.6),w,B.dh-Math.round(B.dh*.6));
    if(!dark)bloom(x+w/2,B.floorY-3,row.fh*.8,[255,170,90],.28*B.door);
  }
}
// A lit window with a television behind it, and now and then someone crossing the room behind the curtain.
function drawWindows(row){
  for(const w of row.wins){
    if(!w.on||w.shop||w.b.power<.5)continue;
    if(w.tv){ctx.globalAlpha=.1+.2*noise(t*.9+w.ph);ctx.fillStyle='#5a90ff';ctx.fillRect(w.ix,w.iy,w.iw,w.ih);}
    if(w.sh){
      const k=w.sh.age/w.sh.dur,x=lerp(w.ix-3,w.ix+w.iw+3,w.sh.dir>0?k:1-k),hw=Math.max(1,row.k*2.2)|0,y=w.iy+Math.round(w.ih*.2);
      ctx.globalAlpha=.6;ctx.fillStyle='#2a1a1c';const x0=Math.max(w.ix,Math.round(x-hw)),x1=Math.min(w.ix+w.iw,Math.round(x+hw));if(x1>x0)ctx.fillRect(x0,y,x1-x0,w.iy+w.ih-y);
    }
  }
  ctx.globalAlpha=1;
}
function drawLamps(){
  const cutOn=cut&&cut.street;
  for(const l of lamps){
    let a=.8;if(l.bad){const n=noise(t*.3+l.ph);a=n<.3?.2:.75;}
    if(cutOn)continue;
    bloom(l.x,l.y,14*u,[255,170,90],a*.5);dot(l.x,l.y-1,[255,226,170],a);
  }
  ctx.globalAlpha=1;
}
function drawRow(row){
  ctx.drawImage(row.curC,0,0);
  for(const b of row.blocks)if(b.power<.99){const y=Math.max(0,b.top-30),h=Math.min(H,row.base)-y;ctx.globalAlpha=1-b.power;ctx.drawImage(row.offC,b.x,y,b.w,h,b.x,y,b.w,h);}
  ctx.globalAlpha=1;
  drawWindows(row);drawDoors(row);
  for(const p of row.people)drawFig(p);
  ctx.drawImage(row.frontC,0,0);
  for(const p of row.people){for(const a of p.arm)if(a.rail)dot(a.x,a.y,p.c.skin,p.show);if(p.after)p.after(p);}
  ctx.globalAlpha=1;
  drawStrings(row);drawSmallDiyas(row);
  for(const l of row.lanterns)drawLantern(row,l);
}

/* ---------- people ---------- */
// A figure is a small skeleton, not a sprite. Feet plant and stay planted through each step, knees and elbows come from two-bone
// reach, and hands and heads move on springs toward wherever a behaviour wants them, so nobody snaps from pose to pose.
const SKIN=[[150,100,70],[176,122,86],[124,82,58],[196,146,108],[104,68,50]];
const HAIRC=[[18,14,18],[30,22,22],[44,32,28]];
const FEST=[[206,40,112],[238,142,30],[20,134,144],[30,144,92],[184,30,52],[216,172,70],[234,228,216],[62,72,164],[144,60,164]];
const PLAIN=[[92,102,122],[62,72,82],[152,142,132],[122,62,62],[42,62,92],[202,202,204]];
const night=c=>mix(c,[18,14,28],.3);
let pid=0;
function person(o={}){
  const kid=!!o.kid,wear=o.wear||(kid?wpick([['kurta',3],['frock',3],['shirt',3]]):wpick([['sari',4],['kurta',5],['shirt',3],['salwar',3]]));
  const top=night(o.top||pick(wear==='shirt'?PLAIN:FEST)),leg=night(o.leg||(wear==='sari'||wear==='salwar'||wear==='frock'?top:wear==='kurta'?pick([[226,220,206],[70,70,84],[190,180,160]]):pick([[50,54,70],[70,64,60],[36,40,54]])));
  const skin=night(pick(SKIN)),hair=o.old?pick([[120,118,122],[166,164,166]]):pick(HAIRC);
  const p=Object.assign({id:pid++,x:0,y:0,h:12,v:0,dest:null,maxV:0,ph:R(),wk:0,f:0,fT:0,lean:0,leanT:0,crouch:0,crouchT:0,hf:0,hfT:0,hp:0,hpT:0,show:1,jump:0,jv:0,attT:0,attX:0,attY:0,
    kid,wear,long:rr(.9,1.12),tempo:rr(.75,1.3),wide:rr(.9,1.1),hairS:wear==='sari'||wear==='salwar'||wear==='frock'?pick(['long','bun','long']):'short',phN:rr(0,500),
    c:{top,topD:mix(top,[10,8,16],.42),leg,legD:mix(leg,[10,8,16],.42),skin,skinD:mix(skin,[12,8,12],.42),hair,trim:mix(top,[255,214,120],.45)},
    arm:[0,1].map(()=>({x:0,y:0,vx:0,vy:0,fn:null,rail:false,sx:0,sy:0,ex:0,ey:0})),feet:[{x:0,y:0},{x:0,y:0}],J:{sx:0,sy:0,hx:0,hy:0,ix:0,iy:0,kn:[[0,0],[0,0]]},placed:false},o);
  return p;
}
function ik(ax,ay,bx,by,l,sx){
  const dx=bx-ax,dy=by-ay,d=Math.min(Math.hypot(dx,dy)||.01,l*1.98),m=Math.sqrt(Math.max(0,l*l-d*d/4)),L=Math.hypot(dx,dy)||1;
  let nx=-dy/L,ny=dx/L;if(nx*sx<0){nx=-nx;ny=-ny;}
  return[(ax+bx)/2+nx*m,(ay+by)/2+ny*m];
}
function stepPerson(p,dt){
  const h=p.h;
  let want=0;
  if(p.dest!==null){const d=p.dest-p.x,ad=Math.abs(d);if(ad<.4)p.dest=null;else want=Math.sign(d)*Math.min(p.maxV,ad*1.3+h*.05);}
  p.v+=(want-p.v)*Math.min(1,dt*3.2);p.x+=p.v*dt;
  const sp=Math.abs(p.v),S=h*(p.kid?.26:.24)*p.long;
  p.wk+=((sp>h*.025?1:0)-p.wk)*Math.min(1,dt*5);
  p.ph=(p.ph+sp*dt*.6/S)%1;
  const fT=Math.abs(want)>h*.02?Math.sign(want):p.fT;
  p.f+=(fT-p.f)*Math.min(1,dt*3.2);
  if(p.attT&&t>=p.attT){p.attT=0;p.hfT=clamp((p.attX-p.x)/(W*.22),-1,1);p.hpT=clamp((p.y-p.attY)/(H*.5),0,1);if(!p.busy)p.fT=p.hfT*.35;}
  const k=Math.min(1,dt*(2.2+p.tempo*1.2));
  p.hf+=(p.hfT-p.hf)*k;p.hp+=(p.hpT-p.hp)*k;
  p.lean+=(p.leanT-p.lean)*Math.min(1,dt*2.2);p.crouch+=(p.crouchT-p.crouch)*Math.min(1,dt*2.4);
  if(p.jump>0||p.jv!==0){p.jv+=h*11*dt;p.jump-=p.jv*dt;if(p.jump<=0){p.jump=0;p.jv=0;}}
  // Standing still is not still: weight drifts from foot to foot on a slow clock of its own.
  const af=Math.abs(p.f),dir=p.f>=0?1:-1,sway=(noise(t*.14*p.tempo+p.phN)-.5)*h*.1*(1-p.wk),legL=h*.47;
  const hx=p.x+sway,hy=p.y-p.jump-legL*(1-p.crouch*.6)-Math.abs(Math.sin(p.ph*6.283))*h*.02*p.wk+h*.012*p.wk;
  const sx=hx+dir*af*(p.lean*h*.18+p.wk*h*.014),sy=hy-h*.31*(1-.3*p.lean*(1-af));
  const ix=sx+dir*af*p.lean*h*.07+p.hf*h*.025,iy=sy-h*.12+p.lean*(1-af)*h*.05;
  const J=p.J;J.hipx=hx;J.hipy=hy;J.sx=sx;J.sy=sy;J.hx=ix;J.hy=iy;
  for(let i=0;i<2;i++){
    const q=(p.ph+i*.5)%1;let gx=0,lift=0;
    if(q<.6)gx=S/2-S*(q/.6);else{const s=(q-.6)/.4;gx=-S/2+S*ease(s);lift=Math.sin(Math.PI*s)*h*.09;}
    const nx=(i?1:-1)*h*.06*(1-af*.5),F=p.feet[i];
    F.x=p.x+lerp(nx,gx*dir,p.wk);F.y=p.y-p.jump-lift*p.wk;
    J.kn[i]=ik(hx+(i?1:-1)*h*.05*(1-af),hy,F.x,F.y,legL*.53,af>.3?dir:(i?.4:-.4));
  }
  const sw=h*.125*(1-.72*af)*p.wide,la=h*.2;
  for(let i=0;i<2;i++){
    const a=p.arm[i],s=i?1:-1;a.sx=sx+s*sw;a.sy=sy+h*.015;
    let tx,ty,w=12;
    const q=a.fn&&a.fn(p);
    if(q){tx=q.x;ty=q.y;w=(q.w||11)*.56;}
    else{const sw2=(p.feet[1-i].x-p.x)*.62*p.wk;tx=a.sx+s*h*.035*(1-af)+sw2;ty=a.sy+la*1.9-Math.abs(sw2)*.2;}
    if(!p.placed){a.x=tx;a.y=ty;}
    a.vx+=(w*w*(tx-a.x)-2*w*a.vx)*dt;a.vy+=(w*w*(ty-a.y)-2*w*a.vy)*dt;a.x+=a.vx*dt;a.y+=a.vy*dt;
    [a.ex,a.ey]=ik(a.sx,a.sy,a.x,a.y,la,af>.3?-dir:s);
  }
  p.placed=true;
}
function bar(x0,y0,x1,y1,w,c){
  const n=Math.max(1,Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0))));
  ctx.fillStyle=c.s||(c.s=css(c));
  for(let i=0;i<=n;i++){const k=i/n;ctx.fillRect(Math.round(lerp(x0,x1,k)-(w-1)/2),Math.round(lerp(y0,y1,k)),w,1);}
}
function drawFig(p){
  if(p.show<=0)return;
  const J=p.J,h=p.h,c=p.c,af=Math.abs(p.f),dir=p.f>=0?1:-1,lw=h>=11?2:1,aw=h>=19?2:1;
  ctx.globalAlpha=p.show;
  const fi=dir>0?0:1,ni=1-fi,tw=Math.max(2,Math.round(h*(.15+.12*(1-af))*p.wide));
  // The arm on the far side of the body goes behind it.
  const arm=(i,col)=>{const a=p.arm[i];bar(a.sx,a.sy,a.ex,a.ey,aw,col);bar(a.ex,a.ey,a.x,a.y,aw,col);};
  if(af>.3)arm(fi,c.topD);
  if(p.wear==='sari'){
    const ym=Math.max(p.feet[0].y,p.feet[1].y),mid=(p.feet[0].x+p.feet[1].x)/2,sp=Math.abs(p.feet[0].x-p.feet[1].x)*.45;
    ctx.fillStyle=c.top.s||(c.top.s=css(c.top));
    for(let y=Math.round(J.hipy);y<=ym;y++){const k=(y-J.hipy)/(ym-J.hipy||1),x=lerp(J.hipx,mid,k),w=tw*.5+k*(h*.05+sp);ctx.fillRect(Math.round(x-w),y,Math.max(2,Math.round(w*2)),1);}
    const ym2=Math.round(ym);bar(mid-tw*.5-sp,ym2,mid+tw*.5+sp,ym2,1,c.trim);
  }else{
    for(const i of[fi,ni]){const k=J.kn[i],F=p.feet[i],col=i===fi?c.legD:c.leg,hx=J.hipx+(i?1:-1)*h*.05*(1-af);bar(hx,J.hipy,k[0],k[1],lw,col);bar(k[0],k[1],F.x,F.y,lw,col);if(h>=11)bar(F.x,F.y,F.x+(af>.3?dir*h*.08:0),F.y,1,c.skinD);}
    if(p.wear==='frock'||p.wear==='kurta'){const ln=p.wear==='frock'?h*.19:h*.15;bar(J.hipx,J.hipy,J.hipx+(J.kn[0][0]+J.kn[1][0]-2*J.hipx)*.25,J.hipy+ln,tw+(p.wear==='frock'?1:0),c.top);}
  }
  bar(J.sx,J.sy,J.hipx,J.hipy+1,tw,c.top);
  if(p.wear==='sari'){bar(J.sx-tw*.5*(1-af),J.sy,J.hipx+tw*.4,J.hipy,1,c.trim);}
  if(af<=.3)arm(fi,c.topD);
  drawHead(p);
  arm(ni,c.top);
  // Hands.
  for(const a of p.arm){ctx.fillStyle=c.skin.s||(c.skin.s=css(c.skin));ctx.fillRect(Math.round(a.x),Math.round(a.y),1,1);}
  ctx.globalAlpha=1;
  if(p.flame>0&&!p.isSmoker){const a=p.arm[1];dot(a.x,a.y-1,[255,224,140],1);ctx.globalAlpha=1;bloom(a.x,a.y-1,p.h*.35,[255,170,80],.4);}
  if(p.hold)p.hold(p);
}
function drawHead(p){
  const J=p.J,h=p.h,c=p.c,w=Math.max(2,Math.round(h*(p.kid?.26:.2))),hh=Math.max(2,Math.round(h*(p.kid?.26:.21))),x0=Math.round(J.hx-w/2),y0=Math.round(J.hy-hh/2),af=Math.abs(p.f),dir=p.f>=0?1:-1;
  const look=clamp(p.hf+dir*af*.8,-1,1),sk=c.skin.s||(c.skin.s=css(c.skin)),hr=c.hair.s||(c.hair.s=css(c.hair));
  if(p.hairS==='long'){ctx.fillStyle=hr;ctx.fillRect(x0-(look>.3?1:0),y0,w+(Math.abs(look)<.3?0:1),Math.round(hh+h*.12));}
  ctx.fillStyle=sk;ctx.fillRect(x0,y0,w,hh);
  // Neck.
  ctx.fillRect(Math.round(J.hx),y0+hh,1,1);
  // Hair covers the top of the head, and the back of it once the face turns away. Looking up shows more of the face.
  ctx.fillStyle=hr;
  const hrow=Math.max(1,Math.round(hh*(.42-p.hp*.16)));
  ctx.fillRect(x0,y0,w,hrow);
  if(look>.3)ctx.fillRect(x0,y0,1,hh-1);else if(look<-.3)ctx.fillRect(x0+w-1,y0,1,hh-1);
  if(p.hairS==='bun'){ctx.fillRect(x0+(look>.3?-1:look<-.3?w:(w>>1)),y0-(Math.abs(look)>.3?0:1),1,1);}
  if(p.helmet){ctx.fillStyle='#2a2a34';ctx.fillRect(x0-(w>2?0:1),y0-1,w+1,hrow+1);}
}

/* ---------- what people do ---------- */
// Each person runs one small routine, written as a generator that yields once a tick. Timings all come from ranges, so the same
// routine never plays the same way, and two people on a balcony run theirs side by side.
function* wait(s){while(s>0){s-=DT;yield;}}
// Nobody is in a hurry tonight: a walk here is an amble, about half of real walking pace.
function* go(p,x,sp){p.dest=x;p.maxV=(sp||rr(.8,1.15))*p.h*.34;while(p.dest!==null)yield;}
function spawn(row,p,gen){p.row=row;p.co=gen;row.people.push(p);return p;}
function allPeople(){return[...flats.people,...near.people,...close.people,...skyPeople,...street];}
let lastBurst=null;
function notice(x,y,size){for(const p of allPeople())if(chance(.2+size*.4)){p.attT=t+rr(.5,1.8);p.attX=x;p.attY=y;}}
function glance(p){
  if(lastBurst&&t-lastBurst.t<4&&chance(.7)){p.hfT=clamp((lastBurst.x-p.x)/(W*.22),-1,1);p.hpT=rr(.5,1);}
  else{p.hfT=rr(-1,1);p.hpT=rr(-.5,.4);}
  if(!p.busy)p.fT=p.hfT*rr(.1,.45);
}
function* enter(p,B){
  B.doorT=rr(.7,1);yield* wait(rr(.8,1.6));
  p.x=B.dx+B.dw/2;p.y=B.floorY-1;p.show=0;p.fT=0;
  while(p.show<1){p.show=Math.min(1,p.show+DT*1.1);yield;}
}
function* leave(p,B){
  p.busy=false;for(const a of p.arm){a.fn=null;a.rail=false;}p.leanT=0;p.crouchT=0;
  yield* wait(rr(1,2.5));
  yield* go(p,B.dx+B.dw/2);
  p.fT=0;B.doorT=1;
  while(p.show>0){p.show-=DT*1;yield;}
}
const spot=(B,p)=>{const m=B.sw+p.h*.25;return rr(B.x+m,B.x+B.w-m);};
function railHands(p,B,on){
  p.arm.forEach((a,i)=>{a.fn=on?(q=>({x:q.x+(i?1:-1)*q.h*.2,y:B.railY,w:9})):null;a.rail=on;});
  p.leanT=on?rr(.5,1):0;
}
// Time spent at the rail: looking about, shifting, pointing at what goes up, stepping along a little.
function* linger(p,B,dur,hands=true){
  const end=t+dur;
  if(hands&&chance(.6))railHands(p,B,true);
  while(t<end){
    yield* wait(Math.min(end-t,expo(8/p.tempo)+2.5));
    if(t>=end)break;
    const a=wpick([['look',6],['still',8],['step',.8],['point',lastBurst&&t-lastBurst.t<3?2:.1],['chin',1],['hands',.8],['scratch',.3]]);
    if(a==='look')glance(p);
    else if(a==='step'&&!p.arm[0].rail){p.fT=0;yield* go(p,spot(B,p),rr(.5,.8));p.fT=0;}
    else if(a==='point'&&lastBurst){
      const i=lastBurst.x>p.x?1:0,keep=p.arm[i].fn,r=p.arm[i].rail,bx=lastBurst.x;p.arm[i].rail=false;
      p.arm[i].fn=q=>({x:q.J.sx+Math.sign(bx-q.x)*q.h*.4,y:q.J.sy-q.h*.16,w:13});
      p.hfT=clamp((bx-p.x)/(W*.22),-1,1);p.hpT=.9;
      yield* wait(rr(2,4));p.arm[i].fn=keep;p.arm[i].rail=r;
    }
    else if(a==='chin'){const i=ri(0,1),keep=p.arm[i].fn,r=p.arm[i].rail;p.arm[i].rail=false;p.arm[i].fn=q=>({x:q.J.hx,y:q.J.hy+q.h*.09,w:8});yield* wait(rr(6,16));p.arm[i].fn=keep;p.arm[i].rail=r;}
    else if(a==='hands'){if(p.arm[0].rail)railHands(p,B,false);else railHands(p,B,true);}
    else if(a==='scratch'){const i=ri(0,1),keep=p.arm[i].fn,r=p.arm[i].rail;p.arm[i].rail=false;p.arm[i].fn=q=>({x:q.J.hx+(i?1:-1)*q.h*.1+Math.sin(t*7)*.5,y:q.J.hy-q.h*.05,w:12});yield* wait(rr(1.2,2.4));p.arm[i].fn=keep;p.arm[i].rail=r;}
  }
  if(p.arm[0].rail)railHands(p,B,false);
}
function* watch(p,B){
  yield* enter(p,B);
  yield* go(p,spot(B,p));p.fT=0;
  yield* linger(p,B,rr(35,120));
  yield* leave(p,B);
}
function* onPhone(p,B){
  yield* enter(p,B);
  const i=ri(0,1);p.busy=true;
  p.arm[i].fn=q=>({x:q.J.hx+(i?1:-1)*q.h*.12,y:q.J.hy,w:9});
  for(let n=ri(3,6);n>0;n--){
    yield* go(p,spot(B,p),rr(.5,.85));p.fT=rr(-.4,.4);
    yield* wait(expo(9)+3);
    if(chance(.3))p.hfT=rr(-.8,.8);
    if(chance(.25)){const j=1-i;p.arm[j].fn=q=>({x:q.J.sx+(j?1:-1)*q.h*.2+Math.sin(t*2.2)*.8,y:q.J.sy+q.h*.12,w:10});yield* wait(rr(1.5,3.5));p.arm[j].fn=null;}
  }
  yield* leave(p,B);
}
function* filming(p,B){
  yield* enter(p,B);yield* go(p,spot(B,p));p.fT=0;p.busy=true;
  const by=()=>({x:p.J.sx+p.hf*p.h*.14,y:p.J.hy+p.h*.03,w:8});
  p.arm[0].fn=()=>{const q=by();q.x-=.5;return q;};p.arm[1].fn=()=>{const q=by();q.x+=.5;return q;};
  p.hold=q=>{const a=q.arm[1];dot(a.x,a.y-1,[190,214,255],.9);ctx.globalAlpha=1;};
  const end=t+rr(25,60);
  while(t<end){if(lastBurst){p.hfT=clamp((lastBurst.x-p.x)/(W*.22),-1,1);p.hpT=.8;}yield* wait(rr(2,5));}
  p.hold=null;
  yield* leave(p,B);
}
// A man steps out to smoke. The cigarette is the whole routine: light it with cupped hands, then long lazy drags with the rail to lean on,
// the ember brightening on each one, smoke let go a moment later, a tap of ash, and finally the stub flicked over the rail.
function* smoking(p,B){
  p.isSmoker=true;
  yield* enter(p,B);
  const sx=clamp(B.left?B.x+B.w*.68:B.x+B.w*.32,B.x+B.sw+p.h*.3,B.x+B.w-B.sw-p.h*.3);
  yield* go(p,sx,rr(.7,.95));p.fT=rr(-.25,.25);p.busy=true;
  const i=chance(.8)?1:0,o=1-i,hand=p.arm[i];p.cigHand=i;
  const mouth=q=>({x:q.J.hx+clamp(q.hf,-1,1)*q.h*.08,y:q.J.hy+q.h*.07,w:9});
  // Out of the pocket and to the lips.
  hand.fn=q=>({x:q.J.hipx+(i?1:-1)*q.h*.1,y:q.J.hipy,w:10});yield* wait(rr(1.2,2));
  hand.fn=mouth;yield* wait(rr(1.2,1.8));
  const cig=p.cig={ember:0,len:1,pull:0};
  p.hpT=-.6;p.arm[o].fn=mouth;yield* wait(rr(1,1.5));
  for(let n=ri(1,3);n>0;n--){p.flame=.16;yield* wait(rr(.5,.9));}
  p.flame=rr(1.2,1.8);yield* wait(p.flame*.8);cig.ember=1;cig.pull=1;yield* wait(.9);
  p.arm[o].fn=null;p.hpT=0;cig.pull=0;
  const rest=q=>({x:q.J.sx+(i?1:-1)*q.h*.24,y:B.railY-q.h*.04,w:7});
  hand.fn=rest;yield* wait(rr(1.4,2.2));
  exhale(p,rr(1.4,2));
  if(chance(.55)){p.arm[o].fn=q=>({x:q.x+(o?1:-1)*q.h*.2,y:B.railY,w:8});p.arm[o].rail=true;p.leanT=rr(.2,.5);}
  const drags=ri(5,8);
  for(let n=0;n<drags;n++){
    yield* wait(rr(13,30));
    if(chance(.4))glance(p);
    if(chance(.3)){const e=hand.fn;hand.fn=q=>{const r=e(q);r.y+=Math.sin(t*10)*.6;return r;};yield* wait(.9);hand.fn=e;ash(p);}
    hand.fn=mouth;yield* wait(rr(1.2,1.8));
    p.hpT=rr(-.1,.2);cig.pull=1;yield* wait(rr(1.6,2.8));cig.pull=0;cig.len-=.85/drags;
    hand.fn=rest;yield* wait(rr(1.2,2.2));
    p.hpT=rr(.1,.45);exhale(p,rr(1.4,2.2));yield* wait(rr(1.6,2.6));p.hpT=rr(-.2,.2);
  }
  yield* wait(rr(5,12));
  // Flick the stub over the rail. It falls and bounces on the street below, and the ember dies there.
  hand.fn=q=>({x:q.J.sx+(i?1:-1)*q.h*.1,y:q.J.sy+q.h*.2,w:14});yield* wait(.7);
  hand.fn=q=>({x:q.J.sx+(i?1:-1)*q.h*.42,y:B.railY-q.h*.14,w:26});yield* wait(.32);
  p.cig=null;butt(hand.x,hand.y,(i?1:-1)*rr(4,12)*p.h/15,B);
  if(chance(.3))log(`A cigarette end falls away from a ${B.name} balcony`);
  yield* wait(rr(4,12));
  yield* leave(p,B);
}
const cigTip=p=>{const a=p.arm[p.cigHand];return[a.x+(p.f>=0?1:-1)*(p.cig?p.cig.len*.6+.4:.8),a.y];};
function exhale(p,dur){p.exh=dur;}
function ash(p){const[x,y]=cigTip(p);part(air(p),{x,y,vx:rr(-1,1),vy:0,g:30,dr:.6,life:.8,c:[120,116,120],c2:[70,68,72],a:.7});}
function butt(x,y,vx,B){
  const land=near.pave+rr(2,14)*u;
  part(air(B),{x,y,vx,vy:-rr(4,10),g:60*u,dr:.15,life:Math.sqrt(2*(land-y)/(60*u))+.5,c:[255,120,50],c2:[255,90,40],a:1,hot:true,floor:land,bounce:true});
}
function stepSmoker(p,dt){
  if(p.cig){
    const c=p.cig,[x,y]=cigTip(p),T=air(p);
    c.ember+=((c.pull?1:.35+.15*noise(t*3+p.id))-c.ember)*Math.min(1,dt*6);
    // A thin thread from the burning end, while the hand is down.
    p.wa=(p.wa||0)+dt*(c.pull?.6:3.4);while(p.wa>1){p.wa--;wisp(T,x,y-1,.2);}
  }
  if(p.exh>0){
    p.exh-=dt;p.ea=(p.ea||0)+dt*4.5;
    const m=p.f>=0?1:-1;while(p.ea>1){p.ea--;puff(air(p),p.J.hx+m*p.h*.08+p.hf*p.h*.1,p.J.hy+p.h*.07,rr(.5,.9)*p.h/15,rr(.1,.16),rr(2.4,4),m*rr(.5,2)+wind*1.5,-rr(.8,2),[196,196,208]);}
  }
  if(p.flame>0)p.flame-=dt;
}
function drawCig(p){
  if(p.flame>0){const x=p.J.hx,y=p.J.hy+p.h*.1;dot(x,y,[255,230,140],1);dot(x,y-1,[255,170,70],.8);ctx.globalAlpha=1;bloom(x,y,p.h*.6,[255,170,80],.5);}
  if(p.cig){const c=p.cig,[x,y]=cigTip(p);dot(x,y,[255,lerp(70,170,c.ember),lerp(30,80,c.ember)],clamp(.5+c.ember*.6,0,1));ctx.globalAlpha=1;bloom(x,y,lerp(2,p.h*.28,c.ember),[255,110,50],.14+.3*c.ember);}
}
// Someone goes along the rail with a taper, relighting the diyas the wind has put out.
function* lighting(p,B){
  yield* enter(p,B);p.busy=true;
  const i=1,a=p.arm[i];
  a.fn=q=>({x:q.J.sx+q.h*.2,y:q.J.sy+q.h*.14,w:10});
  p.after=q=>{const h=q.arm[i];dot(h.x,h.y-1,[255,214,120],.9);ctx.globalAlpha=1;bloom(h.x,h.y-1,q.h*.3,[255,160,70],.3);};
  for(const d of shuffle(B.diyas.filter(d=>!d.lit))){
    yield* go(p,clamp(d.x-p.h*.12,B.x+B.sw+1,B.x+B.w-B.sw-1),rr(.6,.9));p.fT=0;p.leanT=.8;p.hpT=-.7;
    a.fn=()=>({x:d.x,y:d.y-1,w:9});
    yield* wait(rr(1.8,3));d.lit=true;d.fuel=rr(.6,1);
    yield* wait(rr(.6,1.2));p.leanT=.15;a.fn=q=>({x:q.J.sx+q.h*.2,y:q.J.sy+q.h*.14,w:10});
    yield* wait(rr(1,2));
  }
  p.after=null;p.hpT=.2;
  yield* wait(rr(2,5));
  yield* linger(p,B,rr(12,35),false);
  yield* leave(p,B);
}
// A sparkler, usually a child's: a stick of white fire waved in loops until it burns down.
function* sparkling(p,B){
  yield* enter(p,B);yield* go(p,spot(B,p));p.fT=0;p.busy=true;
  const T=air(p),i=ri(0,1),a=p.arm[i],sz=p.h/15,w=rr(.6,1.2),w2=rr(.9,1.7),amp=rr(.14,.26),ph=R()*6;
  yield* wait(rr(1.5,3));
  const end=t+rr(20,36),pos=q=>({x:q.J.sx+(i?1:-1)*q.h*.26+Math.cos(t*w+ph)*q.h*amp*(1+noise(t*.7)),y:q.J.sy-q.h*.02+Math.sin(t*w*w2+ph)*q.h*amp,w:12});
  a.fn=pos;a.rail=false;
  p.spark=true;p.hpT=.15;
  while(t<end){
    if(chance(.5)){const an=R()*6.283,s=rr(5,20)*sz;part(T,{x:a.x,y:a.y-1,vx:Math.cos(an)*s,vy:Math.sin(an)*s,g:26*sz,dr:2.4,life:rr(.18,.5),c:[255,246,214],c2:[255,170,70],a:1,tw:true});}
    p.gl=.6+.4*noise(t*2+p.id);
    if(p.kid&&chance(.0015))p.jv=-p.h*2.2,p.jump=.01;
    yield;
  }
  p.spark=false;p.gl=0;
  yield* wait(rr(1.5,3));a.fn=null;
  yield* linger(p,B,rr(6,20),false);
  yield* leave(p,B);
}
function drawGlowOf(p){if(p.gl>0){const a=p.arm[0].fn?p.arm[0]:p.arm[1];bloom(a.x,a.y-1,p.h*.75,[255,214,150],.42*p.gl);}}
function* family(p,B,delay){
  yield* wait(delay);
  yield* enter(p,B);yield* go(p,spot(B,p),p.kid?rr(1,1.3):0);p.fT=0;
  const end=t+rr(45,110);
  while(t<end){
    if(p.kid){
      yield* wait(expo(6)+2);
      if(lastBurst&&t-lastBurst.t<3){p.hfT=clamp((lastBurst.x-p.x)/(W*.22),-1,1);p.hpT=1;if(chance(.3)){p.jv=-p.h*rr(1.8,2.4);p.jump=.01;}}
      else if(chance(.2))yield* go(p,spot(B,p),rr(.9,1.2));else glance(p);
      p.fT=0;
    }else yield* linger(p,B,Math.min(end-t,rr(14,34)));
  }
  yield* leave(p,B);
}
// Only a balcony we can actually see will do, so nobody goes out behind a nearer block where they would never be noticed.
function inView(B){
  const cx=B.x+B.w/2,cy=B.floorY-3;
  if(B.y<=4)return false;
  if(B.row===close)return B.x>-B.w*.15&&B.x+B.w<W+B.w*.15;
  if(cx<4||cx>W-4)return false;
  for(const b of close.blocks)if(cx>=b.x-2&&cx<=b.x+b.w+2)return false;
  if(B.row===flats)for(const b of near.blocks)if(cx>=b.x-2&&cx<=b.x+b.w+2&&cy>=b.top)return false;
  return true;
}
function freeBalcony(pred){
  const all=[...near.balc,...near.balc,...flats.balc,...close.balc,...close.balc,...close.balc].filter(B=>!B.busy&&inView(B)&&(!pred||pred(B)));
  return all.length?pick(all):null;
}
function visit(B,list){
  B.busy=true;B.n=list.length;stats.visits++;
  for(const[p,gen]of list){spawn(B.row,p,gen);p.B=B;}
}
const figH=(row,kid)=>row.fh*(kid?rr(.46,.56):rr(.68,.76));

/* ---------- the street ---------- */
const street=[],vehicles=[],skyPeople=[];
function* stroll(p,to){
  // Most people just walk through. Some stop to look up when something opens overhead.
  const sp=rr(.85,1.2);
  while(Math.abs(to-p.x)>1){
    const leg=p.x+Math.sign(to-p.x)*Math.min(Math.abs(to-p.x),rr(50,220)*u);
    yield* go(p,leg,sp);
    if(lastBurst&&t-lastBurst.t<4&&chance(.4)){p.fT=rr(-.3,.3);p.hfT=clamp((lastBurst.x-p.x)/(W*.22),-1,1);p.hpT=1;yield* wait(rr(4,10));p.hpT=0;p.hfT=0;}
    else if(chance(.08)){p.fT=0;yield* wait(rr(3,8));}
  }
}
function walkers(){
  const d=chance(.5)?1:-1,x0=d>0?-14:W+14,x1=d>0?W+14:-14,n=wpick([[1,7],[2,4],[3,1]]),y=near.base+rr(1,4)*near.k;
  const kids=n>1?ri(0,n-1):0;
  for(let i=0;i<n;i++){
    const kid=i>=n-kids,h=near.fh*(kid?rr(.46,.58):rr(.7,.8)),p=person({kid,h,x:x0-d*i*rr(5,11)*u,y:y+rr(-1,3)*u,f:d,fT:d});
    if(i===0&&!kid&&chance(.35))p.arm[1].fn=q=>({x:q.J.sx+(q.f>=0?1:-1)*q.h*.14,y:q.J.sy+q.h*.2,w:10}),p.hold=q=>{const a=q.arm[1];ctx.fillStyle='#e8a050';ctx.fillRect(Math.round(a.x),Math.round(a.y)-1,3,2);};
    p.co=stroll(p,x1-d*i*6);street.push(p);
  }
}
const VEH=[['scooter',5],['bike',3],['auto',4],['car',3],['cycle',2]];
const CARC=[[190,190,200],[70,72,84],[150,40,44],[40,70,120],[210,200,180]];
function vehicle(){
  const kind=wpick(VEH),d=chance(.5)?1:-1,k=near.k,y=near.pave+(d>0?rr(9,12):rr(4,6))*k+(kind==='car'?2:0);
  const sp={scooter:rr(13,20),bike:rr(15,24),auto:rr(11,17),car:rr(13,22),cycle:rr(6,9)}[kind]*u;
  vehicles.push({kind,d,y,x:d>0?-30:W+30,v:sp,c:night(kind==='auto'?[60,120,70]:pick(CARC)),rider:person({h:near.fh*.7,wear:'shirt',helmet:kind==='scooter'||kind==='bike'}),ph:R()*9});
  vehicles.sort((a,b)=>a.y-b.y);
}
function drawVehicle(v){
  const k=near.k,d=v.d,x=Math.round(v.x),y=Math.round(v.y),c=v.c,r=(a,b,w,h,col)=>{ctx.fillStyle=col.s||(col.s=css(col));const px=d>0?x+a:x-a-w+1;ctx.fillRect(px,y-b,w,h);};
  const T=[28,26,30],s=Math.round;
  ctx.globalAlpha=.5;ctx.fillStyle='#0c0a10';ctx.fillRect(x-s(9*k),y+1,s(18*k),1);ctx.globalAlpha=1;
  const lit=(a,b)=>{const px=d>0?x+a:x-a;bloom(px+d*3,b?y-b:y-2,9*u,[255,226,170],.42);dot(px,y-b,[255,244,214],1);ctx.globalAlpha=1;};
  const tail=(a,b)=>{const px=d>0?x+a:x-a;dot(px,y-b,[255,50,50],.9);ctx.globalAlpha=1;};
  if(v.kind==='car'){
    r(s(-9*k),s(5*k),s(18*k),s(4*k),c);r(s(-5*k),s(8*k),s(11*k),s(3*k),mix(c,[10,10,16],.2));r(s(-4*k),s(7.5*k),s(4*k),s(2*k),[40,50,70]);r(s(1*k),s(7.5*k),s(4*k),s(2*k),[40,50,70]);
    r(s(-7*k),s(1.5*k),s(3*k),2,T);r(s(4*k),s(1.5*k),s(3*k),2,T);lit(s(9*k),s(3.5*k));tail(s(-9*k),s(3.5*k));
  }else if(v.kind==='auto'){
    // An auto-rickshaw: green and yellow, canvas top, driver just visible.
    r(s(-6*k),s(4.5*k),s(13*k),s(3.5*k),c);r(s(-6*k),s(10*k),s(12*k),s(2*k),[210,170,50]);r(s(-5*k),s(8.5*k),1,s(4*k),[30,28,30]);r(s(4*k),s(8.5*k),1,s(4*k),[30,28,30]);
    r(s(-2*k),s(8*k),s(3*k),s(3.5*k),v.rider.c.top);r(s(-1*k),s(9*k),s(2*k),s(1.5*k),v.rider.c.skin);
    r(s(-4*k),s(1.5*k),s(2.5*k),2,T);r(s(4*k),s(1.5*k),s(2.5*k),2,T);lit(s(7*k),s(3.5*k));tail(s(-6*k),s(3*k));
  }else{
    // Two wheels and a rider.
    const hd=v.rider.c;
    r(s(-5*k),s(1.5*k),s(3*k),2,T);r(s(4*k),s(1.5*k),s(3*k),2,T);
    r(s(-4*k),s(3.5*k),s(8*k),s(2*k),v.kind==='cycle'?[60,60,66]:c);if(v.kind==='scooter')r(s(3*k),s(6*k),s(2*k),s(4*k),c);
    r(s(-1.5*k),s(10.5*k),s(3*k),s(6*k),hd.top);r(s(-1.5*k),s(4.5*k),s(4.5*k),s(2*k),hd.leg);r(s(1*k),s(9*k),s(4*k),1,hd.topD);
    r(s(-1*k),s(13*k),s(2.5*k),s(2.5*k),v.rider.helmet?[34,34,44]:hd.skin);
    if(v.kind==='cycle')r(s(-1*k),s(13.5*k),s(2.5*k),1,hd.hair);
    if(v.kind!=='cycle'){lit(s(6*k),s(5*k));tail(s(-5*k),s(3.5*k));}
  }
}
// Crackers on the road. Someone sets one down, lights it at arm's length and backs away, and the children stay well back.
function* setCracker(p,x,kind,kids){
  yield* go(p,x-p.h*.3,rr(.9,1.1));p.fT=0;p.busy=true;
  p.crouchT=.9;p.leanT=.8;yield* wait(rr(1.8,3));
  p.arm[1].fn=q=>({x:q.x+q.h*.3,y:q.y-1,w:10});yield* wait(rr(1.2,2));
  p.flame=.9;yield* wait(.8);
  const fuse=rr(3.5,6);
  ground.push({kind,x,y:p.y,age:-fuse,life:kind==='anar'?rr(14,24):kind==='chakri'?rr(9,14):rr(9,16),len:rr(26,60)*u,dir:chance(.5)?1:-1,ph:R()*9,sp:0,cx:x});
  p.crouchT=0;p.leanT=0;p.arm[1].fn=null;p.busy=false;
  yield* go(p,x+(p.x<x?-1:1)*rr(1.6,2.8)*p.h,rr(2.2,2.8));
  p.fT=0;p.hpT=.3;p.hfT=0;
  yield* wait(rr(14,24));
}
function crackers(kind){
  const x=clamp(gapC+rr(-.6,.6)*W*.5,30,W-30),y=near.pave+rr(1,4)*near.k,d=chance(.5)?1:-1,x0=d>0?-14:W+14,n=ri(1,2);
  const a=person({h:near.fh*rr(.7,.8),x:x0,y,f:d,fT:d,wear:pick(['kurta','shirt'])});
  a.co=(function*(){yield* setCracker(a,x,kind);yield* go(a,d>0?W+14:-14);})();street.push(a);
  for(let i=0;i<n;i++){
    const k=person({kid:true,h:near.fh*rr(.46,.58),x:x0-d*rr(6,18)*u,y:y-rr(0,2)*u,f:d,fT:d}),off=rr(1.8,3.4)*near.fh*(chance(.5)?1:-1);
    k.co=(function*(){
      yield* go(k,x+off,rr(1.2,1.5));k.fT=0;
      const end=t+rr(30,50);
      while(t<end){yield* wait(expo(5)+1.5);k.hfT=clamp((x-k.x)/30,-1,1);k.hpT=.2;if(chance(.2)){k.jv=-k.h*rr(1.8,2.4);k.jump=.01;}if(chance(.15)){yield* go(k,x+off+rr(-1,1)*k.h,rr(.9,1.2));k.fT=0;}}
      yield* go(k,d>0?W+14:-14,rr(1,1.3));
    })();street.push(k);
  }
  log({anar:'A flowerpot is set down on the road and lit',ladi:'Someone lays a string of crackers along the road',chakri:'A ground spinner is lit on the road'}[kind]);
}
const ground=[];
function stepGround(dt){
  for(let i=ground.length-1;i>=0;i--){
    const g=ground[i];g.age+=dt;
    if(g.age>g.life){ground.splice(i,1);continue;}
    if(g.age<0){if(chance(.3))part(4,{x:g.x,y:g.y-1,vx:rr(-3,3),vy:-rr(3,8),g:20,dr:1,life:.2,c:[255,200,120],c2:[255,120,50],a:1});continue;}
    const k=g.age/g.life,sz=u;
    if(g.kind==='anar'){
      // A fountain: it climbs, roars for a while, then sputters out.
      const pw=ease(k/.18)*(1-ease((k-.8)/.2))*(.85+.3*noise(t*1.6+g.ph));
      for(let n=Math.round(pw*2.4);n>0;n--){const an=-1.57+rr(-.3,.3),s=rr(50,104)*sz*pw;part(4,{x:g.x,y:g.y-2,vx:Math.cos(an)*s,vy:Math.sin(an)*s,g:90*sz,dr:.4,life:rr(.6,1.3),c:chance(.55)?[255,226,140]:[255,250,230],c2:[255,120,50],a:1,tw:true});}
      if(chance(.12))puff(4,g.x+rr(-2,2),g.y-rr(3,20)*sz,rr(1.5,3.2)*sz,.1,rr(2.5,4.5),rr(-2,2)+wind*5,-rr(4,9),[150,136,140]);
      g.gl=pw;
    }else if(g.kind==='chakri'){
      // A spinner skates about the road, throwing a ring of sparks.
      g.sp+=dt*rr(5,8);g.cx=g.x+Math.sin(g.age*.4+g.ph)*10*sz;
      for(let n=0;n<4;n+=2){const an=g.sp+n*1.57,s=rr(18,40)*sz;part(4,{x:g.cx+Math.cos(an)*2,y:g.y+Math.sin(an),vx:-Math.sin(an)*s,vy:Math.cos(an)*s*.4-rr(2,9),g:40*sz,dr:2,life:rr(.18,.42),c:n&1?[255,120,190]:[140,255,190],c2:[255,220,150],a:1});}
      g.gl=.5;
    }else{
      // A string of crackers: a run of hard white pops along the road, each with its own puff of paper smoke.
      if(chance(.13)){
        const s=clamp(k+rr(-.03,.03),0,1),x=g.x+g.dir*g.len*s,y=g.y+rr(-1,1);
        for(let n=ri(3,7);n>0;n--){const an=rr(-3.14,0),v=rr(10,34)*sz;part(4,{x,y,vx:Math.cos(an)*v,vy:Math.sin(an)*v,g:90*sz,dr:2,life:rr(.1,.3),c:[255,250,230],c2:[255,170,90],a:1});}
        flash(x,y-2,14*u,[255,236,200],rr(.14,.3),4);
        if(chance(.5))puff(4,x,y-2,rr(1.6,3)*sz,.16,rr(1.6,3.4),wind*5+rr(-2,2),-rr(4,9),[150,146,150]);
      }
    }
  }
}
function drawGround(){
  for(const g of ground){
    if(g.kind==='anar'){for(let i=0;i<3;i++){dot(g.x-1+i,g.y-1,[150,70,44],1);if(i===1)dot(g.x,g.y-2,[176,90,50],1);}ctx.globalAlpha=1;if(g.gl>0&&g.age>0){bloom(g.x,g.y-18*u,44*u,[255,190,110],.34*g.gl);}}
    else if(g.kind==='chakri'&&g.age>0){dot(g.cx,g.y,[255,250,220],1);ctx.globalAlpha=1;bloom(g.cx,g.y-1,16*u,[255,150,170],.3);}
    else if(g.kind==='ladi'){const k=clamp(g.age/g.life,0,1);for(let s=k;s<1;s+=.06)dot(g.x+g.dir*g.len*s,g.y,[150,40,44],1);ctx.globalAlpha=1;}
  }
}
// Rockets go up from roofs across the city, each one stood in a bottle and lit by someone who steps smartly back.
function* roofLaunch(p,x,y,row){
  yield* go(p,x+rr(-1,1)*p.h,rr(.7,1));p.fT=0;p.busy=true;
  for(let n=ri(1,2);n>0;n--){
    p.crouchT=.8;p.leanT=.7;yield* wait(rr(1.6,2.8));
    p.flame=.9;yield* wait(.8);
    const lx=p.x+p.h*.2;
    p.crouchT=0;p.leanT=0;p.busy=false;
    const back=p.x+(chance(.5)?1:-1)*rr(1,1.6)*p.h;
    yield* go(p,back,rr(2,2.5));p.fT=0;p.hpT=.9;
    yield* wait(rr(1.5,3));
    const T=row,up=(row<=1?.55:row===2?.5:.42);
    launch({x0:lx,y0:p.y-2,x:lx+rr(-.08,.08)*W,y:y-rr(.2,.7)*H*up,tier:T,r:rr(.4,1)*TIER[T][1]*.7*u,type:pick(['peony','crackle','strobe','peony']),T:rr(.8,1.5)});
    yield* wait(rr(6,12));p.hpT=0;
  }
  while(p.show>0){p.show-=DT*1;yield;}
}
function roofRocket(){
  const spots=[...near.roofs.map(r=>({x:r.x+rr(-.3,.3)*r.b.w,y:r.b.top+1,h:near.fh*.72,T:3})),...flats.roofs.map(r=>({x:r.x+rr(-.3,.3)*r.b.w,y:r.b.top+1,h:flats.fh*.72,T:2})),...carpetRoofs.map(r=>({x:r.x+rr(.15,.85)*r.w,y:r.y,h:r.h,T:1}))].filter(s=>s.x>8&&s.x<W-8&&s.y>H*.12&&clearAt(s.x,s.y-2,s.T));
  if(!spots.length)return;
  const s=pick(spots),p=person({h:s.h*rr(.92,1.05),x:s.x+rr(-1,1)*s.h*2,y:s.y,show:0,wear:pick(['kurta','shirt'])});
  p.co=(function*(){while(p.show<1){p.show=Math.min(1,p.show+DT*1);yield;}yield* roofLaunch(p,s.x,s.y,s.T);})();
  p.roofT=s.T;skyPeople.push(p);
}
// True if nothing nearer than this depth stands in front of the point.
function clearAt(x,y,T){
  if(T<=1)for(const b of flats.blocks)if(x>=b.x-1&&x<=b.x+b.w+1&&y>=b.top-1)return false;
  if(T<=2)for(const b of near.blocks)if(x>=b.x-1&&x<=b.x+b.w+1&&y>=b.top-1)return false;
  return true;
}

/* ---------- fireworks ---------- */
// Depth decides everything about a shell: how big it opens, what stands in front of it, and how much of the city it lights.
// [tier name, radius] from far across the rooftops out to a shell bursting right over the lane.
const TIER=[['far',13],['city',24],['flats',40],['lane',54],['overhead',76]];
const FWC=[[[255,70,60],[255,170,60]],[[255,204,96],[255,130,40]],[[90,235,130],[220,255,160]],[[90,160,255],[200,230,255]],[[200,110,255],[255,140,220]],[[255,255,240],[255,210,120]],[[255,90,170],[255,200,120]],[[60,230,230],[160,255,220]]];
const GOLD=[[255,214,120],[226,120,40]];
const SHELLS=[['peony',6],['chrys',5],['willow',3],['palm',2],['ring',2],['crossette',2],['strobe',2],['crackle',3],['double',3]];
const SNAME={peony:'A round shell',chrys:'A chrysanthemum',willow:'A gold willow',palm:'A palm',ring:'A ring',crossette:'A crossette',strobe:'A shell of strobing stars',crackle:'A crackling shell',double:'A double shell'};
const WHITE=[255,252,240];
// Sparks, stars and smoke all run at about two thirds of real speed. It keeps a shell's bloom and fall slow enough to watch.
const AIR=.62;
const shells=[],parts=[[],[],[],[],[],[]],puffs=[[],[],[],[],[],[]],flashes=[];
const air=o=>o.row===close?5:o.row===near?4:3;
let nParts=0;
function part(T,o){if(nParts>4200&&!o.must)return;nParts++;parts[T].push(Object.assign({age:0,px:o.x,py:o.y,dr:1,g:0,a:1,te:0},o));}
function puff(T,x,y,r,a,life,vx,vy,c){if(puffs[T].length>160)return;puffs[T].push({x,y,r,a,life,vx,vy,c,age:0,gr:r*.5/life+(r<2?.12:.5)*u,ph:R()*9});}
function wisp(T,x,y,a){part(T,{x,y,vx:wind*3+rr(-.4,.4),vy:-rr(4,6.5),g:0,dr:.2,life:rr(1.3,2.6),c:[206,206,218],c2:[160,160,176],a,wv:rr(.8,1.8)});}
function flash(x,y,r,c,a,T){flashes.push({x,y,r,c,a,T});}
function launch(o){shells.push(Object.assign({age:0,T:rr(1.1,2.1),wob:rr(-1,1),ph:R()*50,te:0,cols:pick(FWC)},o));}
function randomShell(T){
  const r=clamp(TIER[T][1]*rr(.7,1.2)*u,8,W*.34),ys=[[.42,.72],[.3,.68],[.24,.6],[.2,.52],[.2,.5]][T];
  const x=T>=4||chance(.2)?rr(.08,.92)*W:gapC+rr(-.62,.62)*gapW,y=rr(ys[0],ys[1])*hz;
  const x0=x+rr(-.06,.06)*W,y0=T>=3?near.pave+2:T===2?flats.base:hz+6;
  launch({x0,y0,x,y,tier:T,r,type:T<1?pick(['peony','peony','strobe']):wpick(SHELLS),T:rr(1,1.5)+T*rr(.1,.26),quiet:T<2});
}
function stepShells(dt){
  for(let i=shells.length-1;i>=0;i--){
    const s=shells[i];s.age+=dt;
    const k=Math.min(1,s.age/s.T),e=1-(1-k)**2.3;
    s.x1=lerp(s.x0,s.x,e)+Math.sin(k*4+s.ph)*s.wob*s.r*.05;s.y1=lerp(s.y0,s.y,e);
    s.te+=dt;
    if(s.te>.022&&k<.96){s.te=0;part(s.tier,{x:s.x1,y:s.y1,vx:rr(-2,2),vy:rr(2,7),g:8,dr:1.5,life:rr(.15,.55),c:[255,226,160],c2:[210,110,50],a:.9*(1-k*.6)});}
    if(k>=1){shells.splice(i,1);burst(s);}
  }
}
function sphere(v){const z=rr(-1,1),a=R()*6.283,s=Math.sqrt(1-z*z);return[Math.cos(a)*s*v,Math.sin(a)*s*v];}
function burst(s){
  const T=s.tier,x=s.x1,y=s.y1,r=s.r,type=s.type,[c1,c2]=s.cols,g=6+r*.42,big=r/76;
  const n=Math.round(clamp(r*2.2,18,180)),V=r*2.5,star=o=>part(T,Object.assign({x,y,dr:2.5,g,c:c1,c2,hot:true,life:rr(.95,1.5)},o));
  stats.shells++;
  flash(x,y,r*2.2,type==='willow'?[255,190,100]:c1,clamp(.3+r/80,.3,1),T);
  // Most of a shell's flash is white, whatever colour its stars are.
  if(T>=1)flash(x,y,r*.7,WHITE,clamp(.3+r/70,.3,.95),T);
  if(T>=1){flash(x,y,r*1.5,c1,.34,T);flashes[flashes.length-1].dk=2.2;}
  lastBurst={x,y,t,r,T};
  if(T>=2)notice(x,y,big);
  if(type==='peony'){for(let i=0;i<n;i++){const[a,b]=sphere(V*rr(.92,1.06));star({vx:a,vy:b});}}
  else if(type==='chrys'){for(let i=0;i<n;i++){const[a,b]=sphere(V*rr(.9,1.08));star({vx:a,vy:b,tr:.045,trl:.32});}}
  else if(type==='willow'){for(let i=0,m=Math.round(n*.7);i<m;i++){const[a,b]=sphere(V*rr(.72,.98));star({vx:a,vy:b,dr:2.1,g:g*1.5,life:rr(2.2,3.4),c:GOLD[0],c2:GOLD[1],tr:.06,trl:.65});}}
  else if(type==='palm'){for(let i=0,m=ri(7,11);i<m;i++){const a=i/m*6.283+rr(-.15,.15),v=V*rr(.95,1.15);star({vx:Math.cos(a)*v,vy:Math.sin(a)*v-r*.1,dr:2,g:g*1.3,life:rr(1.6,2.3),c:c2,c2:GOLD[1],tr:.016,trl:.42});}}
  else if(type==='ring'){const tilt=rr(.25,1),rot=rr(0,3.14),co=Math.cos(rot),si=Math.sin(rot);for(let i=0,m=Math.round(n*.45);i<m;i++){const a=i/m*6.283,u0=Math.cos(a)*V,v0=Math.sin(a)*V*tilt;star({vx:u0*co-v0*si,vy:u0*si+v0*co,life:rr(1.1,1.5)});}for(let i=0;i<n*.15;i++){const[a,b]=sphere(V*.3);star({vx:a,vy:b,c:c2,c2:c1});}}
  else if(type==='crossette'){for(let i=0,m=Math.round(clamp(n*.2,6,22));i<m;i++){const[a,b]=sphere(V*rr(.8,1));star({vx:a,vy:b,life:rr(.6,.8),tr:.03,trl:.25,die:p=>{for(let j=0;j<4;j++){const q=j*1.57+Math.atan2(p.vy,p.vx)+.785,v=r*rr(.6,.9);part(T,{x:p.x,y:p.y,vx:Math.cos(q)*v,vy:Math.sin(q)*v,dr:2.6,g,life:rr(.5,.8),c:p.c,c2:p.c2,hot:true});}}});}}
  else if(type==='strobe'){for(let i=0;i<n*.7;i++){const[a,b]=sphere(V*rr(.5,1));star({vx:a,vy:b,dr:3,g:g*.5,life:rr(1.8,3),c:WHITE,c2:WHITE,strobe:rr(12,26),ph:R()*9});}}
  else if(type==='crackle'){for(let i=0;i<n*.8;i++){const[a,b]=sphere(V*rr(.7,1));star({vx:a,vy:b,c:GOLD[0],c2:GOLD[1],life:rr(.7,1.3),die:p=>{if(chance(.8)){for(let j=0;j<ri(3,5);j++){const[e,f]=sphere(rr(6,16)*(.4+big));part(T,{x:p.x,y:p.y,vx:e,vy:f,dr:3,g:4,life:rr(.1,.28),c:WHITE,c2:[255,220,160]});}}}});}}
  else{for(let i=0;i<n*.6;i++){const[a,b]=sphere(V*.48);star({vx:a,vy:b,c:c2,c2:c1,life:rr(.8,1.1)});}for(let i=0;i<n*.8;i++){const[a,b]=sphere(V*rr(.95,1.08));star({vx:a,vy:b});}}
  // The smoke stays after the stars are gone, and drifts off with the wind.
  for(let i=0,m=Math.round(3+r*.14);i<m;i++){const[a,b]=sphere(r*rr(.2,.75));puff(T,x+a,y+b,r*rr(.12,.26),rr(.05,.11),rr(7,16),a*.2+wind*5,b*.2-rr(.5,2),[116,104,122]);}
  hazeAmt=Math.min(1.25,hazeAmt+r*.0006);
  if(!s.quiet)log(`${SNAME[type]} opens ${where(x,T)}`);
}
function where(x,T){const f=x/W,s=f<.34?'to the left':f>.66?'to the right':'straight ahead';return T>=4?'right over the lane':T===3?`close by, ${s}`:`over the rooftops ${s}`;}
function stepParts(dt){
  const w=wind*7;
  for(let T=0;T<6;T++){
    const L=parts[T];
    for(let i=L.length-1;i>=0;i--){
      const p=L[i];p.age+=dt;
      if(p.age>=p.life){if(p.die)p.die(p);L[i]=L[L.length-1];L.pop();nParts--;continue;}
      const d=Math.exp(-p.dr*dt);p.vx=p.vx*d+w*dt*p.dr*.5;p.vy=p.vy*d+p.g*dt;p.px=p.x;p.py=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;
      if(p.wv)p.x+=Math.sin(p.age*5+p.y*.3)*p.wv*dt;
      if(p.floor&&p.y>p.floor){p.y=p.floor;p.vy*=-.3;p.vx*=.5;}
      if(p.tr){p.te+=dt;if(p.te>p.tr){p.te=0;const k=1-p.age/p.life;part(T,{x:p.x,y:p.y,vx:p.vx*.05,vy:p.vy*.05+1,dr:2,g:p.g*.25,life:p.trl*rr(.6,1),c:p.c,c2:p.c2,a:.7*k+.2});}}
    }
  }
  for(let T=0;T<6;T++){const L=puffs[T];for(let i=L.length-1;i>=0;i--){const p=L[i];p.age+=dt;if(p.age>=p.life){L[i]=L[L.length-1];L.pop();continue;}p.vx+=(wind*7-p.vx)*.25*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=p.gr*dt;}}
  for(let i=flashes.length-1;i>=0;i--){const f=flashes[i];f.a*=Math.exp(-dt*(f.dk||8));if(f.a<.015)flashes.splice(i,1);}
}
function drawParts(T){
  for(const f of flashes)if(f.T===T){const s=glow(48,f.c,1),d=f.r*2;ctx.globalCompositeOperation='lighter';ctx.globalAlpha=clamp(f.a*.5,0,1);ctx.drawImage(s,Math.round(f.x-f.r),Math.round(f.y-f.r),d,d);ctx.globalCompositeOperation='source-over';}
  for(const p of puffs[T]){
    const k=p.age/p.life,a=p.a*Math.min(1,k*5)*(1-k)**1.1,r=Math.max(1,Math.round(p.r)),s=puffSprite(Math.min(r,18),p.c);
    ctx.globalAlpha=a;ctx.drawImage(s,Math.round(p.x-r),Math.round(p.y-r),r*2+1,r*2+1);
  }
  const L=parts[T];
  for(let i=0;i<L.length;i++){
    const p=L[i],k=p.age/p.life;
    if(p.strobe&&Math.sin(p.age*p.strobe+p.ph)<.15)continue;
    let a=p.a*(k<.68?1:(1-k)/.32),c=p.hot&&p.age<.09?WHITE:k<.55?p.c:p.c2;
    if(p.tw)a*=.5+.5*((i*7+Math.floor(t*12))%3>0?1:.2);
    dot(p.x,p.y,c,a);
    if(p.hot&&T>=2&&k<.6){
      // Close shells are big enough for each star to have a body and a tail.
      const dx=p.x-p.px,dy=p.y-p.py,l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l,m=T>=4?3:T===3?2:1;
      for(let j=1;j<=m;j++)dot(p.x-ux*j,p.y-uy*j,p.c,a*(.8-j*.2));
      if(T>=3&&k<.28)dot(p.x+1,p.y,c,a*.8);
    }
  }
  ctx.globalAlpha=1;
  for(const s of shells)if(s.tier===T&&s.x1!==undefined){dot(s.x1,s.y1,[255,240,200],1);ctx.globalAlpha=1;}
}
const puffs0={};
function puffSprite(r,c){
  const k=r+'|'+c;if(puffs0[k])return puffs0[k];
  const S=r*2+1,[cn,g]=mk(S,S),img=g.createImageData(S,S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const d=Math.hypot(x-r,y-r)/(r+.5);if(d>=1)continue;const i=(y*S+x)*4,a=(1-d*d);if(a<bayer(x,y)*.6)continue;img.data[i]=c[0];img.data[i+1]=c[1];img.data[i+2]=c[2];img.data[i+3]=255*a;}
  g.putImageData(img,0,0);return puffs0[k]=cn;
}
// A flash lights what faces it. Each row keeps a flat copy of its colours, tinted here by a soft pool of the flash's own colour.
function wash(alb,minT,maxA){
  let any=false;
  for(const f of flashes)if(f.T>=minT&&f.r>20&&f.a>.05){
    if(!any){any=true;sctx.globalCompositeOperation='source-over';sctx.clearRect(0,0,W,H);sctx.fillStyle='#000';sctx.fillRect(0,0,W,H);sctx.globalCompositeOperation='lighter';}
    const R0=f.r*3.2,gr=sctx.createRadialGradient(f.x,f.y,0,f.x,f.y,R0);gr.addColorStop(0,css(f.c,clamp(f.a*maxA,0,1)));gr.addColorStop(1,css(f.c,0));sctx.fillStyle=gr;sctx.fillRect(f.x-R0,f.y-R0,R0*2,R0*2);
  }
  if(!any)return;
  sctx.globalCompositeOperation='multiply';sctx.drawImage(alb,0,0);
  sctx.globalCompositeOperation='destination-in';sctx.drawImage(alb,0,0);
  ctx.globalCompositeOperation='lighter';ctx.drawImage(scratch,0,0);ctx.globalCompositeOperation='source-over';
}

/* ---------- the one on the ledge ---------- */
// The figure on the ledge is close enough to paint a pixel at a time. It is built each frame into a small buffer: back, shoulders, neck,
// head and hair, then a pass that lets the fireworks catch its edges and the diyas warm it from below.
const who={yaw:.1,yawT:.1,pitch:.2,pitchT:.2,lean:0,leanT:0,slump:0,slumpT:0,sip:0,sipT:0,reach:0,reachT:0,rx:0,ry:0,phone:0,phoneT:0,stretch:0,stretchT:0,
  hair:pick(['short','short','bun','braid','long']),hairC:pick(HAIRC),skin:pick(SKIN),top:pick([[132,34,60],[28,86,98],[150,96,30],[62,46,112],[166,62,36],[190,184,170],[40,92,70]]),
  shawl:chance(.5)?pick([[186,150,90],[120,40,60],[60,80,110],[200,192,176]]):null,cs:chance(.5)?1:-1,rs:1,gajra:chance(.5),taper:0};
let WQ=1,PW=0,PH=0,whoC,whoG,whoImg,whoBuf,whoM,cupX=0,bright=[0,0,0],rimDir=0;
function layoutWho(){
  WQ=clamp(H/290,.72,1.5)*clamp(W/330,.72,1);
  PW=Math.round(96*WQ);PH=Math.round(84*WQ);
  [whoC,whoG]=mk(PW,PH);whoImg=whoG.createImageData(PW,PH);whoBuf=whoImg.data;whoM=new Uint8Array(PW*PH);
  cupX=seatX+who.cs*Math.round(27*WQ);
}
function wset(x,y,c,s=1){x=x|0;y=y|0;if(x<0||y<0||x>=PW||y>=PH)return;const i=y*PW+x,j=i*4;whoM[i]=1;whoBuf[j]=c[0]*s;whoBuf[j+1]=c[1]*s;whoBuf[j+2]=c[2]*s;whoBuf[j+3]=255;}
function capsule(x0,y0,x1,y1,r0,r1,fn){
  const L=Math.hypot(x1-x0,y1-y0)||1,R1=Math.max(r0,r1),bx0=Math.floor(Math.min(x0,x1)-R1),bx1=Math.ceil(Math.max(x0,x1)+R1),by0=Math.floor(Math.min(y0,y1)-R1),by1=Math.ceil(Math.max(y0,y1)+R1);
  for(let y=by0;y<=by1;y++)for(let x=bx0;x<=bx1;x++){
    const k=clamp(((x-x0)*(x1-x0)+(y-y0)*(y1-y0))/(L*L),0,1),d=Math.hypot(x-lerp(x0,x1,k),y-lerp(y0,y1,k)),r=lerp(r0,r1,k);
    if(d<=r)fn(x,y,d/r,k);
  }
}
function drawWho(){
  whoBuf.fill(0);whoM.fill(0);
  const q=WQ,w=who,ox=PW/2,oy=PH-2-Math.round(1*q),top=w.top,dk=mix(top,[8,6,12],.5);
  const slump=w.slump*2.5*q-w.stretch*3*q,hgt=35*q-slump,lx=w.lean*9*q;
  const sy=oy-hgt,sx=ox+lx,breath=Math.sin(t*.9+noise(t*.12)*2)*.35*q,shW=13.5*q+breath*.5-w.slump*.5*q;
  const hy0=sy-9.5*q+Math.max(0,w.pitch)*2*q-Math.min(0,w.pitch)*1.4*q+breath,hx=sx+w.yaw*2.2*q;
  const cl=(x,y,c,s)=>{const f=.82+.34*vn((x-sx)*1.4+40,(y-oy)*.45,5,93);wset(x,y,c,f*s);};
  // Which arm holds the cup, and where each hand is.
  const shoulder=i=>[sx+i*(shW-2.5*q),sy+3*q+(i===w.cs?-w.sip*1.5*q:0)];
  const hand=i=>{
    const rest=[ox+i*16.8*q,oy-.5*q];
    if(i===w.cs&&w.sip>.01){const m=[hx+i*3.5*q,hy0+6*q],k=ease(w.sip);return[lerp(rest[0],m[0],k),lerp(rest[1],m[1],k)-Math.sin(k*3.14)*5*q];}
    if(i===w.rs&&w.reach>.01){const k=ease(w.reach);return[lerp(rest[0],w.rx-seatX+ox,k),lerp(rest[1],oy-1*q,k)];}
    if(w.phone>.01){const k=ease(w.phone);return[lerp(rest[0],sx+i*5*q,k),lerp(rest[1],sy+12*q,k)];}
    if(w.stretch>.01){const k=ease(w.stretch);return[lerp(rest[0],sx+i*12*q,k),lerp(rest[1],sy-24*q,k)];}
    return rest;
  };
  const armC=w.shawl&&w.shawl[0]>0?mix(top,w.shawl,.2):top,l=16.6*q;
  const arm=i=>{
    const s=shoulder(i),h=hand(i),up=h[1]<s[1]+16*q&&w.stretch<.3;
    // A hand brought up to the face leaves the elbow hanging down and a little out.
    // Otherwise the arms stay nearly straight, taking the weight on the ledge, not bent like hands on hips.
    let e=ik(s[0],s[1],h[0],h[1],up?l:Math.min(l,Math.hypot(h[0]-s[0],h[1]-s[1])/2+.22*q),i);
    if(up&&e[1]<(s[1]+h[1])/2+l*.3)e=[lerp(e[0],s[0]+i*7*q,.75),s[1]+l*.82];
    return{s,h,e};
  };
  const A={'-1':arm(-1),'1':arm(1)},fore=i=>{const a=A[i];capsule(a.e[0],a.e[1],a.h[0],a.h[1]-1.4*q,3*q,2.2*q,(x,y,d)=>cl(x,y,armC,.82-d*.14));capsule(a.h[0],a.h[1]-1.2*q,a.h[0]+i*.5*q,a.h[1],1.8*q,1.5*q,(x,y)=>wset(x,y,w.skin,.62));};
  const raised=i=>A[i].h[1]<sy+14*q;
  for(const i of[-1,1])if(raised(i))fore(i);
  // The back, from the hips on the ledge to the shoulders.
  const hh=Math.ceil(hgt)+Math.round(3*q);
  for(let j=-Math.round(3*q);j<hh;j++){
    const v=clamp(j/hgt,0,1),y=oy-j,cx=ox+lx*v*v+w.yaw*.6*q*v,hw=j<0?12.5*q:v<.55?lerp(12.5*q,10*q,ease(v/.55)):v<.86?lerp(10*q,shW-1,ease((v-.55)/.31)):lerp(shW-1,shW*.74,ease((v-.86)/.14));
    for(let x=Math.floor(cx-hw);x<=cx+hw;x++){
      const e=Math.abs(x-cx)/hw,spine=Math.abs(x-cx-w.yaw*q*v)<.9*q&&v>.25&&v<.9;
      cl(x,y,top,(1-e*e*.24)*(spine?.84:1));
    }
  }
  // A shawl over the shoulders, with a gold edge along its hem.
  if(w.shawl){
    const c=w.shawl;
    for(let j=Math.round(hgt*.42);j<hh;j++){
      const v=clamp(j/hgt,0,1),y=oy-j,cx=ox+lx*v*v,hw=(v<.86?lerp(10.8*q,shW+.6,ease((v-.42)/.44)):lerp(shW+.6,shW*.7,ease((v-.86)/.14)));
      for(let x=Math.floor(cx-hw);x<=cx+hw;x++){const hem=hgt*(.42+.17*((x-cx)/hw+1)),e=Math.abs(x-cx)/hw;if(j<hem)continue;cl(x,y,j<hem+1.6*q?[214,170,84]:c,1-e*e*.26);}
    }
  }
  // Neck and head.
  capsule(sx+w.yaw*.8*q,sy+1*q,hx,hy0+4*q,2.7*q,2.5*q,(x,y)=>wset(x,y,w.skin,.6));
  const rx=5.6*q,ry=7*q,sgn=w.yaw>=0?1:-1,ay=Math.abs(w.yaw);
  if(w.hair==='long'){const end=sy+12*q+Math.sin(t*.7)*.5;for(let y=Math.round(hy0);y<end;y++){const k=(y-hy0)/(end-hy0),hw=(k<.45?lerp(rx*1.12,rx*.98,k/.45):lerp(rx*.98,rx*.36,ease((k-.45)/.55)))+Math.sin(y*.7+t*.5)*.25,cx=lerp(hx,sx+w.lean*2*q,k);for(let x=Math.floor(cx-hw);x<=cx+hw;x++)wset(x,y,w.hairC,1+1.1*vn((x-cx)*1.5+30,y*.16,2,94)*(1-k*.4));}}
  for(let y=-ry-1;y<=ry+1;y++)for(let x=-rx-1;x<=rx+1;x++){
    const nx=x/rx,ny=y/ry;if(nx*nx+ny*ny>1)continue;
    const cheek=sgn*nx>1.02-ay*1.1&&ny>-.3-w.pitch*.1;
    wset(hx+x,hy0+y,cheek?w.skin:w.hairC,cheek?.8+.2*(sgn*nx):.92+.5*vn(x*1.2+hx*.0,y*.5,2.4,95)*(ny<0?1:.5));
  }
  // The ears shift across the head as it turns.
  for(const i of[-1,1]){
    const ex=hx+i*rx*(1-.08)-w.yaw*rx*.82,vis=Math.abs((ex-hx)/rx)<1.12;
    if(vis)capsule(ex,hy0-.2*q,ex,hy0+1.6*q,1.1*q,.9*q,(x,y)=>wset(x,y,w.skin,.74));
  }
  if(ay>.6){wset(hx+sgn*(rx+.8),hy0+1.4*q,w.skin,.86);wset(hx+sgn*(rx+.2),hy0+3.4*q,w.skin,.8);}
  if(w.hair==='bun'){const bx=hx-w.yaw*2.2*q,by=hy0-rx*.75;capsule(bx,by,bx,by,3.3*q,3.3*q,(x,y,d)=>wset(x,y,w.hairC,1.1-d*.3));if(w.gajra)for(let a=0;a<6.28;a+=.8)wset(bx+Math.cos(a)*3.4*q,by+Math.sin(a)*3.4*q,[232,226,206]);}
  if(w.hair==='braid'){
    let bx=hx,by=hy0+ry-1;
    for(let i=0,n=Math.round(22*q/2);i<n;i++){const nx=bx+Math.sin(t*.6+i*.3)*.12+w.lean*.3,ny=by+2;capsule(bx,by,nx,ny,2*q*(1-i/n*.45),1.8*q*(1-i/n*.45),(x,y)=>wset(x,y,w.hairC,(i&1)?1.5:1));bx=nx;by=ny;}
    if(w.gajra)wset(bx,by+1,[232,226,206]);
  }
  for(const i of[-1,1]){
    const a=A[i];if(!raised(i))fore(i);
    capsule(a.s[0],a.s[1],a.e[0],a.e[1],4.2*q,3.2*q,(x,y,d)=>cl(x,y,armC,1-d*.2));
    if(w.shawl)capsule(a.s[0],a.s[1],lerp(a.s[0],a.e[0],.55),lerp(a.s[1],a.e[1],.55),4.6*q,3.8*q,(x,y,d)=>cl(x,y,w.shawl,1-d*.2));
    // A gap of shadow between the arm and the body.
    if(!raised(i)){const dx=-i;for(let k=.1;k<1;k+=.06){const x=lerp(a.s[0],a.e[0],k)+dx*3.8*q,y=lerp(a.s[1],a.e[1],k);wset(x,y,dk,.7);}}
  }
  // Light: the flashes catch whichever edges face them, the sky lifts the shoulders, and the diyas warm everything low down.
  const[br,bg,bb]=bright,dW=diyaWarm;
  for(let y=0;y<PH;y++)for(let x=0;x<PW;x++){
    const i=y*PW+x;if(!whoM[i])continue;
    const j=i*4,up=y===0||!whoM[i-PW],lf=x===0||!whoM[i-1],rt=x===PW-1||!whoM[i+1],up2=y<2||!whoM[i-PW*2],lf2=x<2||!whoM[i-2],rt2=x>PW-3||!whoM[i+2];
    const rim=(up?1:up2?.45:0)+(rimDir<0?(lf?1:lf2?.45:0):rimDir>0?(rt?1:rt2?.45:0):(lf||rt?.5:0)),low=clamp((y-(PH*.5))/(PH*.5),0,1),e=clamp(Math.abs(x-PW/2)/(15*WQ),0,1),wm=low*low*dW*(.22+.78*e*e);
    const a=.56;
    whoBuf[j]=whoBuf[j]*a+br*rim*.5+(up||lf||rt?16:0)+whoBuf[j]*wm*.95+wm*18;
    whoBuf[j+1]=whoBuf[j+1]*a+bg*rim*.5+(up||lf||rt?12:0)+whoBuf[j+1]*wm*.5+wm*7;
    whoBuf[j+2]=whoBuf[j+2]*(a+.06)+bb*rim*.5+(up||lf||rt?20:0);
  }
  whoG.putImageData(whoImg,0,0);
  const px=seatX-Math.round(ox),py=roofY-Math.round(oy);
  // A soft shadow on the ledge, then the figure, then the glow of a phone in front of it.
  ctx.globalAlpha=.4;ctx.fillStyle='#08060c';ctx.fillRect(seatX-Math.round(14*q),roofY+1,Math.round(28*q),2);ctx.globalAlpha=1;
  if(w.phone>.1){bloom(sx-0+px,hy0+py+10*q,16*q,[160,200,255],.3*w.phone);}
  ctx.drawImage(whoC,px,py);
  if(w.taper>0){const a=A[w.rs],x=a.h[0]+px,y=a.h[1]+py-1;dot(x,y,[255,220,130],1);dot(x,y-1,[255,150,60],.8);ctx.globalAlpha=1;bloom(x,y,9*q,[255,160,70],.5);}
  if(w.sip<.08)drawCup(1);
  else if(w.sip<.6){const a=A[w.cs];drawCup(0,a.h[0]+px,a.h[1]+py);}
}
function drawCup(onLedge,x,y){
  const q=WQ,cw=Math.max(3,Math.round(4.4*q)),ch=Math.max(4,Math.round(6*q)),X=onLedge?cupX-(cw>>1):Math.round(x-cw/2),Y=onLedge?roofY-ch+1:Math.round(y-ch);
  ctx.fillStyle='#8c8f96';ctx.fillRect(X,Y,cw,ch);ctx.fillStyle='#c6c9ce';ctx.fillRect(X,Y,1,ch);ctx.fillStyle='#55575e';ctx.fillRect(X+cw-1,Y,1,ch);ctx.fillStyle='#d8dade';ctx.fillRect(X,Y,cw,1);ctx.fillStyle='#6a3e22';ctx.fillRect(X+1,Y,cw-2,1);
}
function stepWho(dt){
  const w=who,sp=(k,f)=>{const v=k+'V',T=k+'T',e=w[T]-w[k];w[v]=(w[v]||0)+(f*f*e-2*f*(w[v]||0))*dt;w[k]+=w[v]*dt;};
  sp('yaw',2.6);sp('pitch',2.2);sp('lean',1.3);sp('slump',1.1);sp('sip',2.1);sp('reach',2);sp('phone',1.8);sp('stretch',1.5);
  if(w.co)w.co.next();
  // Steam from the cup, while it sits on the ledge.
  w.st=(w.st||0)+dt*1.1;while(w.st>1){w.st--;if(w.sip<.08)part(4,{x:cupX+rr(-1,1),y:roofY-6*WQ,vx:wind*3,vy:-rr(5,9),dr:.2,life:rr(.8,1.7),c:[220,214,206],c2:[170,166,170],a:.2,wv:rr(1,2.4)});}
  // The sum of what's flashing, for the rim of the figure.
  let r=0,g=0,b=0,dx=0;
  for(const f of flashes){if(f.r<20)continue;const k=clamp(f.a*(.5+f.r/90),0,1.4);r+=f.c[0]*k;g+=f.c[1]*k;b+=f.c[2]*k;dx+=(f.x-seatX)*k;}
  bright[0]=Math.min(255,r);bright[1]=Math.min(255,g);bright[2]=Math.min(255,b);rimDir=dx<-5?-1:dx>5?1:0;
}
// The small life of someone sitting still: a sip, a shift of weight, a look down at the road, a look at a phone, a diya the wind took.
function* whoLife(){
  const w=who;
  for(;;){
    yield* wait(expo(18)+6);
    if(w.track>t)continue;
    const a=wpick([['sip',5],['look',6],['shift',4],['down',3],['phone',1.6],['stretch',.8],['relight',roofDiyas.some(reachable)?6:0],['slump',2]]);
    if(a==='sip'){w.yawT*=.3;w.sipT=1;yield* wait(rr(1.6,2.2));w.pitchT=rr(.4,.7);yield* wait(rr(1.8,3.4));w.pitchT=rr(0,.25);w.sipT=0;yield* wait(rr(1.6,2.6));}
    else if(a==='look'){w.yawT=rr(-.7,.7);w.pitchT=rr(-.1,.5);yield* wait(rr(4,10));if(chance(.4)){w.yawT=rr(-.4,.4);w.pitchT=rr(0,.3);}}
    else if(a==='shift'){w.leanT=rr(-.4,.4);yield* wait(rr(6,16));if(chance(.6))w.leanT=rr(-.12,.12);}
    else if(a==='down'){w.yawT=rr(-.6,.6);w.pitchT=-rr(.4,.9);w.leanT=rr(-.1,.1);yield* wait(rr(5,11));w.pitchT=rr(0,.3);}
    else if(a==='phone'){w.phoneT=1;w.pitchT=-.8;w.yawT=0;w.slumpT=.8;const end=t+rr(10,24);while(t<end&&!(lastBurst&&lastBurst.r>50*u&&t-lastBurst.t<.6))yield;w.phoneT=0;w.slumpT=0;w.pitchT=.2;yield* wait(rr(2,4));}
    else if(a==='stretch'){w.stretchT=1;w.pitchT=.7;yield* wait(rr(2.6,4));w.stretchT=0;w.pitchT=.1;yield* wait(rr(2,3.5));log('The one on the ledge stretches and settles again');}
    else if(a==='slump'){w.slumpT=rr(.5,1);yield* wait(rr(14,36));w.slumpT=0;}
    else if(a==='relight'){
      const d=pick(roofDiyas.filter(reachable));
      w.rs=d.x<seatX?-1:1;w.yawT=w.rs*.9;w.pitchT=-.7;yield* wait(rr(1,1.6));
      w.leanT=clamp((d.x-seatX)/(40*WQ),-1,1)*.75;w.rx=d.x;w.reachT=1;w.taper=1;yield* wait(rr(2.2,3.2));
      d.lit=true;d.fuel=rr(.7,1);yield* wait(rr(1,1.8));
      w.reachT=0;w.taper=0;w.leanT=0;w.yawT=rr(-.2,.2);w.pitchT=.2;log('The one on the ledge leans over and relights a diya');yield* wait(rr(2,4));
    }
  }
}
const reachable=d=>d.ledge&&!d.lit&&Math.abs(d.x-seatX)<48*WQ;
// Heads turn to a big shell a moment after it opens, follow it down, and drift back.
function whoSees(x,y,r){
  const w=who;w.track=t+rr(5,9);
  w.seeAt=t+rr(.5,1.2);w.seeX=x;w.seeY=y;w.seeR=r;
}
function stepSee(){
  const w=who;
  if(w.seeAt&&t>=w.seeAt){w.seeAt=0;w.yawT=clamp((w.seeX-seatX)/(W*.32),-.95,.95);w.pitchT=clamp((roofY-w.seeY)/(H*.5),.1,1);w.phoneT=0;}
  if(w.track&&t>w.track){w.track=0;w.pitchT=rr(.05,.35);w.yawT*=rr(.2,.6);}
  else if(w.track)w.pitchT=Math.max(.1,w.pitchT-DT*.05);
}

/* ---------- a cat ---------- */
const CATF=[['......#.#.','......####','#.....####','.#######..','.#######..','.#.#..#.#.'],['......#.#.','......####','#.....####','.#######..','.#######..','..#.#.#.#.'],['....#.#...','....####..','#...####..','#...###...','.######...','.#####.#..']];
let cat=null;
function* catWalk(c){
  c.x=c.d>0?-12:W+12;
  const stop=seatX-c.d*rr(38,70)*WQ;
  while(c.d>0?c.x<stop:c.x>stop){c.v=rr(7,10)*u;c.ph+=DT*c.v*.3;c.x+=c.d*c.v*DT;if(c.bolt)break;yield;}
  if(!c.bolt){
    c.sit=true;const end=t+rr(40,110);
    while(t<end&&!c.bolt)yield;
    c.sit=false;
  }
  const dir=c.bolt?-c.d:c.d>0?(chance(.5)?1:-1):(chance(.5)?1:-1);c.d=dir;
  if(c.bolt)log('The cat bolts along the ledge at the noise');
  while(c.x>-14&&c.x<W+14){c.v=c.bolt?rr(40,56)*u:rr(7,10)*u;c.ph+=DT*c.v*.3;c.x+=c.d*c.v*DT;yield;}
  cat=null;
}
function drawCat(c){
  if(Math.abs(c.x-tankX)<27*u)return;
  const f=CATF[c.sit?2:Math.floor(c.ph)%2],col=[20,18,24],hi2=[56,50,56],y=roofY-f.length;
  f.forEach((r,j)=>{for(let i=0;i<r.length;i++)if(r[i]==='#')dot(Math.round(c.x)+(c.d>0?i:r.length-1-i)-5,y+j,j<2?hi2:col,1);});
  if(c.sit&&Math.sin(t*2+c.ph)>.3)dot(Math.round(c.x)+(c.d>0?-6:6),y+3,col,1);
  ctx.globalAlpha=1;
}

/* ---------- the roof's diyas ---------- */
let diyaWarm=.8;
function drawRoofDiyas(){
  let sum=0,n=0;
  // The warm layer is painted with every diya burning, so one that has gone out needs its pool of light taken away again.
  ctx.save();ctx.beginPath();ctx.rect(0,roofY,W,H-roofY);ctx.clip();
  for(const d of roofDiyas)if(!d.lit){const s=glow(Math.round(24*u),[16,14,22],1);ctx.globalAlpha=.6*diyaWarm;ctx.drawImage(s,Math.round(d.x-s.width/2),Math.round(d.y-s.height/2));}
  ctx.restore();
  for(const d of roofDiyas){
    if(!d.lit)continue;n++;
    const f=noise(t*.45+d.ph),gs=clamp(1-Math.abs(wind)*.2,.7,1),hN=(1.8+d.s*1.2)*(.9+.2*f)*gs,lean=clamp(wind*1.1,-1.4,1.4)+(noise(t*.8+d.ph*3)-.5)*.5,x0=d.x,y0=d.y-2-d.s;
    sum+=.86+.14*f;
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.3+.07*f;const s=glow(Math.round(11*u),[255,140,50],.6);ctx.drawImage(s,Math.round(x0-s.width/2),Math.round(y0-3-s.height/2));ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    const hh=Math.ceil(hN);
    for(let i=0;i<hh;i++){
      const k=i/hN,x=x0+lean*k*k,w=k<.35?1:0,c=k<.3?FLAME[0]:k<.6?FLAME[1]:k<.85?FLAME[2]:FLAME[3];
      dot(x,y0-i,c,1);if(w&&d.s>1)dot(x+1,y0-i,FLAME[1],.9);if(w)dot(x-1,y0-i,FLAME[2],.75);
    }
  }
  ctx.globalAlpha=1;
  diyaWarm=n?clamp(sum/Math.max(1,roofDiyas.length)*1.1,.2,1):.1;
}

/* ---------- events ---------- */
const stats={shells:0,visits:0,events:0};
function log(text){if(warming)return;stats.events++;N.log(text);}
const SCHED={far:{m:52,f:6},city:{m:95,f:14},flats:{m:180,f:35},lane:{m:320,f:80},overhead:{m:640,f:150},cake:{m:1200,f:420},rooftop:{m:240,f:60},
  visit:{m:46,f:8},smoker:{m:60,f:.1},phone:{m:210,f:50},film:{m:280,f:80},family:{m:190,f:40},sparkler:{m:130,f:20},diya:{m:120,f:35},
  walkers:{m:78,f:10},vehicle:{m:72,f:14},anar:{m:320,f:70},ladi:{m:760,f:220},chakri:{m:520,f:130},
  window:{m:9,f:3},shadow:{m:18,f:6},gust:{m:280,f:110},powercut:{m:1500,f:600},cat:{m:380,f:90}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
const crowded=()=>near.people.length+flats.people.length+close.people.length>4;
function cake(){
  // A cake: one fuse, a dozen or two tubes, going off in a stutter from one spot.
  const x=gapC+rr(-.5,.5)*gapW,T=chance(.6)?3:2,n=ri(5,11),c=pick(FWC),fan=rr(.05,.28)*W;let dly=0;
  for(let i=0;i<n;i++){
    const k=n>1?i/(n-1):.5,sw=(i%2?1:-1)*k,dx=sw*fan;dly+=expo(1.3)+.5;
    delayed.push({at:t+dly,run:()=>launch({x0:x,y0:T===3?near.pave:flats.base,x:x+dx,y:rr(.26,.56)*hz,tier:T,r:rr(.34,.6)*TIER[T][1]*u,type:pick(['peony','chrys','crackle']),cols:chance(.7)?c:pick(FWC),T:rr(.7,1),quiet:true})});
  }
  log(`A cake of ${n} shots goes off, one after another, ${where(x,T)}`);
}
const delayed=[];
function fire(k){
  switch(k){
    case'far':randomShell(0);break;
    case'city':randomShell(1);break;
    case'flats':randomShell(2);break;
    case'lane':randomShell(3);break;
    case'overhead':randomShell(4);break;
    case'cake':cake();break;
    case'rooftop':roofRocket();break;
    case'visit':{if(crowded())break;const B=freeBalcony();if(!B)break;const p=person({h:figH(B.row)});visit(B,[[p,watch(p,B)]]);if(chance(.25))log(`Someone comes out on a ${B.name} balcony`);break;}
    case'smoker':{
      if(allPeople().some(p=>p.isSmoker))break;
      const B=freeBalcony(b=>b.row!==flats&&!b.lantern&&!b.b.solid)||freeBalcony(b=>b.row!==flats&&!b.lantern)||freeBalcony(b=>b.row!==flats);if(!B)break;
      const p=person({h:figH(B.row),wear:'kurta',top:pick([[226,222,212],[210,206,196],[150,120,90],[120,130,150]]),leg:pick([[226,222,212],[80,80,92],[120,110,100]]),hairS:'short',old:chance(.3)});
      p.after=drawCig;visit(B,[[p,smoking(p,B)]]);log(`A man steps out on a ${B.name} balcony to smoke`);break;
    }
    case'phone':{if(crowded())break;const B=freeBalcony();if(!B)break;const p=person({h:figH(B.row)});visit(B,[[p,onPhone(p,B)]]);break;}
    case'film':{if(crowded())break;const B=freeBalcony();if(!B)break;const p=person({h:figH(B.row)});visit(B,[[p,filming(p,B)]]);log(`Someone on a ${B.name} balcony films the sky on a phone`);break;}
    case'family':{
      if(crowded())break;const B=freeBalcony(b=>b.w>26*u);if(!B)break;
      const n=ri(2,4),list=[];let d=0;
      for(let i=0;i<n;i++){const kid=i>0&&chance(.6),p=person({kid,h:figH(B.row,kid)});list.push([p,family(p,B,d)]);d+=rr(.4,2.4);}
      visit(B,list);log(`A family comes out on a ${B.name} balcony`);break;
    }
    case'sparkler':{
      if(crowded())break;const B=freeBalcony();if(!B)break;const kid=chance(.7),p=person({kid,h:figH(B.row,kid)});p.hold=drawGlowOf;
      visit(B,[[p,sparkling(p,B)]]);log(`${kid?'A child':'Someone'} waves a sparkler on a ${B.name} balcony`);break;
    }
    case'diya':{
      const B=freeBalcony(b=>b.diyas.some(d=>!d.lit));if(!B||crowded())break;const p=person({h:figH(B.row),wear:pick(['sari','sari','salwar','kurta'])});
      visit(B,[[p,lighting(p,B)]]);log(`Someone relights the diyas on a ${B.name} balcony`);break;
    }
    case'walkers':if(street.length<4)walkers();break;
    case'vehicle':if(vehicles.length<2)vehicle();break;
    case'anar':case'ladi':case'chakri':if(street.length<4)crackers(k);break;
    case'window':{
      const row=pick([near,near,near,flats,close]),w=pick(row.wins);if(!w||w.shop||w.b.power<.5)break;
      w.on=!w.on;row.curG.drawImage(w.on?row.onC:row.offC,w.x,w.y,w.w,w.h,w.x,w.y,w.w,w.h);break;
    }
    case'shadow':{const row=pick([near,near,flats,close]),w=pick(row.wins);if(w&&w.on&&!w.shop&&!w.sh)w.sh={age:0,dur:rr(1.2,3.4),dir:chance(.5)?1:-1};break;}
    case'gust':{
      const d=chance(.5)?1:-1;gust={age:0,dur:rr(9,18),amp:d*rr(.4,.8)};
      let n=0;const all=[...near.diyas,...flats.diyas,...close.diyas,...roofDiyas];
      for(const q of all)if(q.lit&&chance(.05*(q.ledge?1.4:1))){q.lit=false;n++;}
      log(n>2?`A gust comes through and takes ${n} diyas with it`:'A gust sets the lanterns swinging');break;
    }
    case'powercut':{
      if(cut)break;
      const list=[...near.blocks,...flats.blocks,...close.blocks].filter(()=>chance(.75));
      cut={list,age:0,back:rr(30,80),street:chance(.6)};for(const b of list)b.powerT=0;
      log('The power goes, and for a while the diyas have the street to themselves');break;
    }
    case'cat':if(!cat&&W>260){cat={x:0,d:chance(.5)?1:-1,ph:0,v:15,sit:false,bolt:false};cat.co=catWalk(cat);log('A cat walks along the ledge');}break;
  }
}
function rowsReset(){
  who.co=who.co||whoLife();
  street.length=0;vehicles.length=0;skyPeople.length=0;ground.length=0;
  if(cat)cat=null;
  for(const row of[near,flats,close])for(const b of row.blocks)b.powerT=1;
}
function stepRow(row,dt){
  stepLanterns(row,dt);
  for(const B of row.balc){B.door+=(B.doorT-B.door)*Math.min(1,dt*2);}
  for(const b of row.blocks)if(b.powerT!==undefined&&b.power!==b.powerT){const d=b.powerT-b.power;b.power=Math.abs(d)<.02?b.powerT:b.power+d*Math.min(1,dt*(b.powerT?1.6:14));}
  for(const w of row.wins)if(w.sh){w.sh.age+=dt;if(w.sh.age>w.sh.dur)w.sh=null;}
  const L=row.people;
  for(let i=L.length-1;i>=0;i--){
    const p=L[i];if(p.co.next().done){
      L.splice(i,1);
      const B=p.B;if(B&&--B.n<=0){B.busy=false;B.doorT=0;}
      continue;
    }
    stepPerson(p,dt);if(p.isSmoker)stepSmoker(p,dt);else if(p.flame>0)p.flame-=dt;
  }
}
function update(dt){
  DT=dt;t+=dt;
  let g=0;if(gust){gust.age+=dt;const p=gust.age/gust.dur;if(p>=1)gust=null;else g=gust.amp*Math.sin(Math.PI*p)**2;}
  wind=(fbm(t*.014+WORLD.off[1])-.5)*.7+g;
  // The whole night breathes: fireworks come and go over minutes, with long stretches of nothing at all.
  act=clamp(fbm(t*.01+WORLD.off[2])*1.7-.15,.08,1.1);
  hazeAmt=Math.max(.35,hazeAmt-dt*.0012);hazeX+=dt*(.5+wind*1.2);
  for(const k in SCHED){
    nextEv[k]-=dt;
    if(nextEv[k]<=0){
      nextEv[k]=expo(SCHED[k].m);
      const fw=k==='far'||k==='city'||k==='flats'||k==='lane'||k==='overhead'||k==='cake';
      if(!fw||R()<act)fire(k);
    }
  }
  for(let i=delayed.length-1;i>=0;i--)if(t>=delayed[i].at){delayed[i].run();delayed.splice(i,1);}
  if(cut){cut.age+=dt;if(cut.age>cut.back){for(const b of cut.list)b.powerT=1;cut=null;log('The lights come back, and a cheer goes up along the street');}}
  stepRow(near,dt);stepRow(flats,dt);stepRow(close,dt);
  for(let i=street.length-1;i>=0;i--){const p=street[i];if(p.co.next().done){street.splice(i,1);continue;}stepPerson(p,dt);if(p.flame>0)p.flame-=dt;}
  for(let i=skyPeople.length-1;i>=0;i--){const p=skyPeople[i];if(p.co.next().done){skyPeople.splice(i,1);continue;}stepPerson(p,dt);if(p.flame>0)p.flame-=dt;}
  for(let i=vehicles.length-1;i>=0;i--){const v=vehicles[i];v.x+=v.d*v.v*dt;if(v.x<-40||v.x>W+40)vehicles.splice(i,1);}
  stepGround(dt);stepShells(dt*AIR);stepParts(dt*AIR);
  // Diyas burn down and go out, slowly, one at a time. Someone will come along for them.
  for(const list of[near.diyas,flats.diyas,close.diyas,roofDiyas])for(const d of list)if(d.lit){d.fuel-=dt*.0016;if(d.fuel<=0&&chance(.02))d.lit=false;}
  stepWho(dt);stepSee();
  if(lastBurst&&lastBurst.r>34*u&&lastBurst.seen!==true){lastBurst.seen=true;whoSees(lastBurst.x,lastBurst.y,lastBurst.r);if(cat&&!cat.bolt&&lastBurst.r>60*u&&chance(.5))cat.bolt=true;}
  if(cat)cat.co.next();
}

/* ---------- drawing ---------- */
function grade(){
  ctx.globalAlpha=1;ctx.drawImage(vig,0,0);
  if((grainT+=1)>13){grainT=0;gx=Math.floor(R()*64);gy=Math.floor(R()*64);}
  ctx.globalAlpha=.4;ctx.drawImage(grain,-gx,-gy);ctx.globalAlpha=1;
}
function drawSky(){
  ctx.drawImage(skyC,0,0);
  for(const s of stars){const a=s.b*(.75+.25*noise(t*.6+s.ph))*(1-Math.min(1,hazeAmt*.4));dot(s.x,s.y,s.c,a);}
  ctx.globalAlpha=1;
}
function drawCity(){
  for(const b of beacons)if(((t+b.ph)%b.per)/b.per<.35)dot(b.x,b.y,[255,60,70],.9);
  for(const c of crowns){const a=.6+.4*Math.sin(t*.4+c.ph);for(let x=0;x<c.w;x++)dot(c.x+x,c.y,c.c,a);}
  ctx.globalAlpha=1;
}
function drawHaze(){
  const x=((hazeX%W)+W)%W;
  ctx.globalAlpha=clamp(hazeAmt,0,1)*WORLD.haze;
  ctx.drawImage(hazeC,Math.round(x),0);ctx.drawImage(hazeC,Math.round(x)-W,0);
  ctx.globalAlpha=1;
}
function draw(){
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  drawSky();
  drawParts(0);
  ctx.drawImage(farC,0,0);
  drawParts(1);
  ctx.drawImage(carpetC,0,0);drawBulbs();drawCity();
  for(const p of skyPeople)if(p.roofT===1)drawFig(p);
  drawHaze();
  drawParts(2);
  for(const p of skyPeople)if(p.roofT===2)drawFig(p);
  drawRow(flats);wash(flats.albC,2,.6);
  drawParts(3);
  for(const p of skyPeople)if(p.roofT===3)drawFig(p);
  drawRow(near);
  drawGround();
  const items=[...street,...vehicles].sort((a,b)=>a.y-b.y);
  for(const o of items){if(o.kind)drawVehicle(o);else{drawFig(o);}}
  drawLamps();
  wash(near.albC,3,.7);
  drawParts(4);
  drawRow(close);wash(close.albC,3,.6);
  drawParts(5);
  ctx.drawImage(roofC,0,0);ctx.globalAlpha=clamp(diyaWarm*.9,0,1);ctx.drawImage(roofL,0,0);ctx.globalAlpha=1;
  wash(rimC,3,.9);
  drawRoofDiyas();
  if(cat)drawCat(cat);
  drawWho();
  grade();
}

/* ---------- start ---------- */
if(N.DEBUG)window.DW={WORLD,stats,who,get seatX(){return seatX;},shells,parts,flashes,get near(){return near;},get flats(){return flats;},get close(){return close;},street,vehicles,ground,get t(){return t;},get wind(){return wind;},get act(){return act;},get roofDiyas(){return roofDiyas;},get cat(){return cat;},fire,launch,burst,draw:()=>draw(),step:dt=>update(dt),
  run(sec){for(let i=0;i<sec*60;i++)update(1/60);draw();N.refresh();}};
layout();
// The scene runs half a minute out of sight first, so it opens on a night already under way.
warming=true;for(const k of['smoker','visit','visit','family','walkers'])fire(k);for(let i=0;i<1800;i++)update(1/60);warming=false;
stats.shells=0;stats.visits=0;stats.events=0;
// One shell in the air for the opening frame, which is the frame viewers with reduced motion keep.
{launch({x0:gapC,y0:flats.base,x:gapC+rr(-.1,.1)*W,y:hz*rr(.34,.5),tier:3,r:TIER[3][1]*u,type:pick(['chrys','peony','willow']),T:.6,quiet:true});warming=true;for(let i=0;i<110;i++)update(1/60);warming=false;stats.shells=0;}
log(`Diwali, and no moon tonight. ${WORLD.temple!==null?'A temple spire shines in gold across the rooftops':'Buildings on every side, all of them lit by hand'}`);
N.stats(stats);
N.run({step:1/60,update,draw,ui:()=>N.stats(stats)});
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{layout();draw();},150);});
})();
