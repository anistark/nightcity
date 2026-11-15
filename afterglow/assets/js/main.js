/* Afterglow: a flat beach at low tide in the red light left after sunset. Small waves break far out, and thin sheets of
   water slide up the wet sand, rest, and drain away, over rippled sand at our feet.
   The beach is one world, measured in metres on the ground: waves come in from the horizon, break where the water gets
   shallow, and each one that reaches the shore sends a sheet up the sand. The picture is worked out pixel by pixel into
   a small buffer that the browser scales up. The sky is painted first, and the wet sand and the sea take their colour
   from it, as a mirror would. Three looks draw the same world: a photograph, a painted film and pixel art.
   Every choice in the world comes from the shared seeded generator in ../assets/js/nightcity.js. Painting draws from
   private streams, so the size of the window and the look never change what the sea does. */
(()=>{
'use strict';
const N=NightCity;
const{R,rr,ri,pick,chance,expo,wpick,noise}=N;
const cv=document.getElementById('scene'),ctx=cv.getContext('2d');
// Small things that pass, like birds and a boat, are drawn on a canvas of their own above the picture.
const fxc=document.createElement('canvas');fxc.className='fx';fxc.setAttribute('aria-hidden','true');cv.after(fxc);
const fx=fxc.getContext('2d');
const QS=new URLSearchParams(location.search);

/* ---------- helpers ---------- */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
const smooth=(a,b,x)=>{x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x);};
const rgba=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
const u32=()=>Math.floor(R()*4294967296);
function stream(s){s>>>=0;const r=N.sfc32(s,(s^0x9e3779b9)>>>0,Math.imul(s,2654435761)>>>0,(s+0x6d2b79f5)>>>0);for(let i=0;i<12;i++)r();return r;}
const SEEDS={noise:u32(),sand:u32(),fx:u32()};
// A tile of random values read with smooth interpolation: the one source of texture for the clouds, the water and the sand.
const NZ=new Float32Array(65536);{const p=stream(SEEDS.noise);for(let i=0;i<65536;i++)NZ[i]=p();}
function nz(x,y){
  const xf=Math.floor(x),yf=Math.floor(y);let ax=x-xf,ay=y-yf;ax=ax*ax*(3-2*ax);ay=ay*ay*(3-2*ay);
  const x0=xf&255,x1=(x0+1)&255,y0=(yf&255)<<8,y1=((yf+1)&255)<<8,a=NZ[y0|x0],b=NZ[y0|x1],c=NZ[y1|x0],d=NZ[y1|x1];
  return a+(b-a)*ax+(c-a)*ay+(a-b-c+d)*ax*ay;
}
const fb=(x,y)=>nz(x,y)*.52+nz(x*2.07+31.7,y*2.07+12.3)*.3+nz(x*4.13+77.1,y*4.13+45.9)*.18;
// A patch of smooth noise that tiles, w by h pixels from a cw by ch lattice.
function tileNoise(p,w,h,cw,ch){
  const L=new Float32Array(cw*ch),o=new Float32Array(w*h);for(let i=0;i<L.length;i++)L[i]=p();
  for(let y=0;y<h;y++){
    const v=y/h*ch,y0=v|0,y1=(y0+1)%ch;let ay=v-y0;ay=ay*ay*(3-2*ay);
    for(let x=0;x<w;x++){const u=x/w*cw,x0=u|0,x1=(x0+1)%cw;let ax=u-x0;ax=ax*ax*(3-2*ax);
      const a=L[y0*cw+x0],b=L[y0*cw+x1],c=L[y1*cw+x0],d=L[y1*cw+x1];o[y*w+x]=a+(b-a)*ax+(c-a)*ay+(a-b-c+d)*ax*ay;}
  }
  return o;
}

/* ---------- the looks ---------- */
// Everything a look changes about the picture. The world underneath is the same for all three.
// px is the size of the buffer in pixels, or cell the number of pixel-art cells along the longer side.
// soft is how soft the clouds' edges are, cw and ch how long and how flat they lie, core how much darker their middles are,
// by and bx how far the sky blurs before the sand mirrors it.
const LOOKS={
  photo:{name:'Photo',px:5.6e5,soft:.22,by:.05,bx:.035,ks:.36,core:0,cw:.55,ch:1.6,cHi:[160,84,72],cLo:[196,58,14],lit:[46,24,6],isle:[.62,.6,.62],sand:[.27,.245,.22],tr:[1,.9,.8],
    sd:[.9,.84,.72],sb:[.84,.76,.9],slope:.7,grain:.06,eD:.4,eB:.12,foam:[210,128,108],foamLo:[150,84,72],ink:[64,22,14],lamp:[255,214,160]},
  paint:{name:'Painted',px:5.6e5,soft:.085,by:.012,bx:.004,ks:.88,core:.3,cw:.4,ch:2.1,cHi:[104,54,92],cLo:[150,48,58],lit:[112,64,14],isle:[.5,.5,.74],sand:[.3,.21,.27],tr:[1,.93,.9],
    sd:[.74,.7,.86],sb:[.9,.84,.9],slope:.8,grain:0,eD:.2,eB:.62,foam:[255,228,208],foamLo:[214,150,150],ink:[58,26,50],lamp:[255,232,180]},
  pixel:{name:'Pixel',cell:380,soft:.035,by:0,bx:0,ks:.86,core:0,cw:.5,ch:1.8,cHi:[150,74,60],cLo:[142,52,17],lit:[60,30,8],isle:[.56,.52,.5],sand:[.27,.245,.22],tr:[1,.92,.84],
    sd:[.9,.84,.72],sb:[.84,.76,.9],slope:.9,grain:0,eD:.5,eB:.6,foam:[255,196,166],foamLo:[226,146,122],ink:[38,14,10],lamp:[255,196,166]}
};
const STYLES=Object.keys(LOOKS);
// The colour of the sky by height: 0 at the horizon, 1 near the top of a tall window, and on above it for what the sand mirrors.
const STOPS={
  photo:[[0,150,60,30],[.07,163,66,29],[.14,180,70,26],[.2,202,75,18],[.26,232,82,8],[.33,250,90,3],[.4,254,97,3],[.48,247,91,5],[.6,234,88,13],[.75,215,89,30],[.9,200,89,43],[1.05,190,88,50],[1.6,152,78,60]],
  paint:[[0,132,60,70],[.07,156,64,62],[.14,204,82,48],[.21,240,108,36],[.3,255,140,40],[.4,255,162,60],[.5,252,128,50],[.63,232,96,60],[.78,190,76,82],[.95,142,62,98],[1.1,108,52,100],[1.6,70,42,92]]
};
STOPS.pixel=STOPS.photo;
// The pixel-art palette: a ramp from wine black through red and orange to amber, with mauves for cloud and pinks for foam.
const PAL=[[22,8,10],[38,14,10],[56,22,10],[76,30,12],[98,38,14],[120,45,15],[142,52,17],[160,62,28],[178,68,26],[200,72,16],[222,78,8],[242,86,4],[254,100,6],[255,126,24],
  [150,74,60],[190,90,52],[112,44,40],[226,146,122],[255,196,166],[86,30,34]];
const PAL32=new Uint32Array(PAL.length),QL=new Uint8Array(32768);
{
  PAL.forEach((c,i)=>PAL32[i]=(255<<24|c[2]<<16|c[1]<<8|c[0])>>>0);
  for(let r=0;r<32;r++)for(let g=0;g<32;g++)for(let b=0;b<32;b++){
    let best=0,bd=1e9;
    for(let i=0;i<PAL.length;i++){const c=PAL[i],dr=r*8+4-c[0],dg=g*8+4-c[1],db=b*8+4-c[2],d=dr*dr*.9+dg*dg*1.4+db*db*.7;if(d<bd){bd=d;best=i;}}
    QL[r<<10|g<<5|b]=best;
  }
}
// Finishing a pixel: a little noise so smooth skies don't band, brush marks for the painted look, the palette for pixel art.
const DTH=new Float32Array(4096),BAY=new Float32Array(16);let BRU;
{
  const p=stream(SEEDS.fx);for(let i=0;i<4096;i++)DTH[i]=p();
  const a=tileNoise(p,256,256,10,72),b=tileNoise(p,256,256,40,128);BRU=new Float32Array(65536);for(let i=0;i<65536;i++)BRU[i]=1+.09*(a[i]-.5)+.05*(b[i]-.5);
  [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].forEach((v,i)=>BAY[i]=(v+.5)/16-.5);
}
const pack=(r,g,b)=>(255<<24|(b<0?0:b>255?255:b)<<16|(g<0?0:g>255?255:g)<<8|(r<0?0:r>255?255:r))>>>0;
function finPhoto(r,g,b,x,y){const n=DTH[(y&63)<<6|(x&63)];return pack(r+n,g+n,b+n);}
function finPaint(r,g,b,x,y){const m=BRU[(y&255)<<8|(x&255)],n=DTH[(y&63)<<6|(x&63)];return pack(r*m+n,g*m+n,b*m+n);}
function finPixel(r,g,b,x,y){
  const n=BAY[(y&3)<<2|(x&3)];r=r+n*17|0;g=g+n*10|0;b=b+n*8|0;
  return PAL32[QL[(r<0?0:r>255?31:r>>3)<<10|(g<0?0:g>255?31:g>>3)<<5|(b<0?0:b>255?31:b>>3)]];
}
// fin finishes a pixel worked out from scratch, fin2 one that was read back from the picture and changed.
let fin=finPhoto,fin2=finPhoto;

/* ---------- the world, picked once ---------- */
let style=wpick([['photo',5],['paint',3],['pixel',2]]);
{const s=QS.get('style');if(STYLES.includes(s))style=s;}
const WORLD={
  warm:rr(-.7,.6),           // the colour of the evening: toward crimson below zero, toward gold above
  glowU:rr(.22,.78),        // where along the horizon the light is strongest
  glowEl:rr(.35,.44),cover:rr(.3,.8),wind:(chance(.5)?1:-1)*rr(.35,1),
  swell:rr(.82,1.22),slant:rr(-.2,.2),
  rip:{t1:rr(-.45,.45),t2:(chance(.5)?1:-1)*rr(.6,1.15),lam:rr(.078,.112),o:[rr(0,200),rr(0,200),rr(0,200),rr(0,200)]},
  isle:{u:rr(.1,.9),w:rr(.14,.3),h:rr(.014,.024),o:rr(0,99),trees:rr(.4,1)},
  isle2:chance(.6)?{u:rr(.04,.96),w:rr(.04,.09),h:rr(.006,.01),o:rr(0,99),trees:0}:null,
  lamp:chance(.55)?{p:rr(4,9),two:chance(.4),o:rr(0,9)}:null,
  ph:[rr(0,200),rr(0,200),rr(0,999),rr(0,999),rr(0,999),rr(0,999)]
};
if(N.DEBUG&&QS.has('warm'))WORLD.warm=clamp(parseFloat(QS.get('warm'))||0,-1,1);
// The eye is CAMH metres above the sand and the shore lies DS0 metres ahead. Sheets of water are kept on a strip of
// NX points across the beach, XR metres to each side.
const CAMH=1.5,DS0=10.5,FAR=120,ELMAX=1.55,NL=256,NX=420,XR=14.7,IDX=(NX-1)/(2*XR);
const SHs=new Float32Array(NX),SHt=new Float32Array(NX).fill(DS0);
for(let i=0;i<NX;i++){const X=i/IDX-XR;SHs[i]=1.1*(nz(X*.1+WORLD.ph[0],1.3)-.5)+.25*(nz(X*.6+WORLD.ph[1],5.1)-.5);}

/* ---------- state ---------- */
let W=1,H=1,bw=1,bh=1,cx=0,hy=1,GR=1,f=1,FC=1,D0=2,sh=1,OFF=0,FK=1,q=1,T=0,LK=LOOKS[style],BY=0,BX=0;
let img,o32,skyT,refT,A32,B32,ai,rf,sk,spk,dG,AX,gxc,isl,dsx,ysg,ysI,tmp,sD,sB;
let minS=0,maxS=0,DSm=DS0,rowS=0,rowG=0,strS=1,strG=1,tick=0,quiet=true,grainP=null,lampX=0,lampEl=0;
const LUT=new Float32Array(NL*3),SA=[60,22,6],IS=[90,36,20];
const stats={waves:0,long:0,events:0};
const say=s=>{if(quiet)return;stats.events++;N.log(s);};

/* ---------- the mood of the evening ---------- */
// Slow noise moves the brightness and colour of the glow, the cloud cover and the tide. Events push on top of it.
const E={set:null,lull:null,flare:null,ember:null};
const ev=e=>e?smooth(0,e.up,e.age)*(1-smooth(e.dur-e.down,e.dur,e.age)):0;
const M={cx:WORLD.ph[2],cy:WORLD.ph[3]*.1,mo:0,g:1,w:WORLD.warm,cover:WORLD.cover,tide:0};
function drift(dt){
  M.cx+=WORLD.wind*dt*.0012;M.mo+=dt*.0018;
  M.g=1+.08*(noise(T/53+WORLD.ph[2])-.5)*2+.1*ev(E.flare)-.16*ev(E.ember);
  M.w=clamp(WORLD.warm+.25*(noise(T/97+WORLD.ph[3])-.5)*2+.45*ev(E.flare)-.5*ev(E.ember),-1.2,1.2);
  M.cover=clamp(WORLD.cover+.3*(noise(T/131+WORLD.ph[4])-.5)*2,.1,.95);
  M.tide=1.1*(noise(T/170+WORLD.ph[5])-.5)*2;
}

/* ---------- painting: the sky ---------- */
function buildLUT(){
  const st=STOPS[style],w=M.w,gk=M.g;let s=0,ar=0,ag=0,ab=0,n=0;
  for(let k=0;k<NL;k++){
    const el=k/(NL-1)*ELMAX;while(s<st.length-2&&el>st[s+1][0])s++;
    const a=st[s],b=st[s+1],t=clamp((el-a[0])/(b[0]-a[0]),0,1);
    let r=lerp(a[1],b[1],t),g=lerp(a[2],b[2],t),bl=lerp(a[3],b[3],t);
    // The band of glow is where the evening changes most: brighter or dimmer, toward gold or toward crimson.
    const band=Math.exp(-(((el-WORLD.glowEl)/.2)**2)),k1=1+(gk-1)*(.35+.65*band);r*=k1;g*=k1;bl*=k1;
    if(w>0){g*=1+.24*w*(.4+.6*band);bl+=6*w*band;}else{g*=1+.3*w*(.5+.5*band);bl-=w*(14+18*(1-band));r*=1+.03*w;}
    LUT[k*3]=r;LUT[k*3+1]=g;LUT[k*3+2]=bl;
    if(el>.05&&el<1.25){ar+=r;ag+=g;ab+=bl;n++;}
  }
  // The sand is lit by the whole sky, so it takes the sky's average colour times its own.
  SA[0]=ar/n*LK.sand[0];SA[1]=ag/n*LK.sand[1];SA[2]=ab/n*LK.sand[2];
  IS[0]=LUT[0]*LK.isle[0];IS[1]=LUT[1]*LK.isle[1];IS[2]=LUT[2]*LK.isle[2];
}
// The outline of an island along the horizon, as a height above it, with a few trees on top.
function isleAt(u,I){
  const t=(u-I.u)/I.w;if(t<=-1||t>=1)return 0;const e=Math.pow(1-t*t,.7);
  return I.h*e*(.45+.55*nz(u*9+I.o,3.3))+I.h*I.trees*e*Math.max(0,nz(u*210+I.o,7.7)-.42)*1.7;
}
// One row of sky. Clouds are a deck seen from below: noise stretched along the horizon, finer and flatter the lower it sits.
// A second reading a little lower tells where a cloud's underside is, which is the side the glow lights.
function skyRow(j){
  const el=(j+.5)/hy,kq=Math.min(NL-1.001,el/ELMAX*(NL-1)),k0=kq|0,kf=kq-k0,a=k0*3;
  const R0=LUT[a]+(LUT[a+3]-LUT[a])*kf,G0=LUT[a+1]+(LUT[a+4]-LUT[a+1])*kf,B0=LUT[a+2]+(LUT[a+5]-LUT[a+2])*kf;
  const bd=Math.exp(-(((el-WORLD.glowEl)/.22)**2));
  const p=1/(el+.1),sy=p*LK.ch+M.cy,k1=p*LK.cw/hy,p2=p+.075,sy2=p2*LK.ch+M.cy,k2=p2*LK.cw/hy,ox=M.cx,mo=M.mo,core=LK.core;
  const th=.7-.2*M.cover,is=1/LK.soft,e1=smooth(.2,.8,el),ks=LK.ks*(.45+.55*smooth(0,.14,el));
  const cr=lerp(LK.cLo[0],LK.cHi[0],e1),cg=lerp(LK.cLo[1],LK.cHi[1],e1),cb=lerp(LK.cLo[2],LK.cHi[2],e1);
  const lk=(1-.6*smooth(.3,1,el))*M.g,lr=LK.lit[0]*lk,lg=LK.lit[1]*lk,lb=LK.lit[2]*lk;
  const vis=j<hy,yy=hy-1-j,oo=yy*bw,ot=j*bw,ir=IS[0],ig=IS[1],ib=IS[2];
  for(let x=0;x<bw;x++){
    const dx=x+.5-cx;let u=dx*k1+ox,v=sy;
    const c1=nz(u,v)*.5+nz(u*2.07+31.7+mo*.7,v*2.07+12.3)*.3+nz(u*4.13+77.1-mo*1.9,v*4.13+45.9+mo)*.2;
    u=dx*k2+ox;v=sy2;
    const c0=nz(u,v)*.5+nz(u*2.07+31.7+mo*.7,v*2.07+12.3)*.3+nz(u*4.13+77.1-mo*1.9,v*4.13+45.9+mo)*.2;
    let d1=(c1-th)*is+.5;d1=d1<0?0:d1>1?1:d1;d1=d1*d1*(3-2*d1);
    let d0=(c0-th)*is+.5;d0=d0<0?0:d0>1?1:d0;d0=d0*d0*(3-2*d0);
    const lt=d1>d0?d1-d0:0,gx=gxc[x],kg=1+bd*(.07*gx-.1*(1-gx)),kd=d1*ks;let cc=1;if(core){cc=(c1-th-.05)*is*.5;cc=1-core*(cc<0?0:cc>1?1:cc);}
    let r=R0*kg,g=G0*kg*(1+.1*bd*gx),b=B0;
    r+=(cr*cc-r)*kd+lt*lr;g+=(cg*cc-g)*kd+lt*lg;b+=(cb*cc-b)*kd+lt*lb;
    const ih=isl[x];if(ih>0&&el<ih+.5/hy){let c=(ih-el)*hy+.5;c=c>1?1:c;r+=(ir-r)*c;g+=(ig-g)*c;b+=(ib-b)*c;}
    skyT[ot+x]=pack(r,g,b);
    if(vis)o32[oo+x]=fin(r,g,b,x,yy);
  }
}
// The sky as wet sand shows it: the same row, blurred. Five readings up and down, then five along.
function refRow(j){
  const o=j*bw;
  if(!BY&&!BX){for(let x=0;x<bw;x++)refT[o+x]=skyT[o+x];return;}
  const j0=clamp(j-2*BY,0,sh-1)*bw,j1=clamp(j-BY,0,sh-1)*bw,j3=clamp(j+BY,0,sh-1)*bw,j4=clamp(j+2*BY,0,sh-1)*bw;
  for(let x=0;x<bw;x++){
    const a=skyT[j0+x],b=skyT[j1+x],c=skyT[o+x],d=skyT[j3+x],e=skyT[j4+x],k=x*3;
    tmp[k]=((a&255)+(e&255)+2*((b&255)+(d&255))+3*(c&255))/9;
    tmp[k+1]=((a>>8&255)+(e>>8&255)+2*((b>>8&255)+(d>>8&255))+3*(c>>8&255))/9;
    tmp[k+2]=((a>>16&255)+(e>>16&255)+2*((b>>16&255)+(d>>16&255))+3*(c>>16&255))/9;
  }
  const m=bw-1;
  for(let x=0;x<bw;x++){
    const a=(x-2*BX<0?0:x-2*BX)*3,b=(x-BX<0?0:x-BX)*3,c=x*3,d=(x+BX>m?m:x+BX)*3,e=(x+2*BX>m?m:x+2*BX)*3;
    refT[o+x]=pack((tmp[a]+tmp[e]+2*(tmp[b]+tmp[d])+3*tmp[c])/9,(tmp[a+1]+tmp[e+1]+2*(tmp[b+1]+tmp[d+1])+3*tmp[c+1])/9,(tmp[a+2]+tmp[e+2]+2*(tmp[b+2]+tmp[d+2])+3*tmp[c+2])/9);
  }
}
// The two colours the open sea is mixed from, for each column: the dull sky low over the horizon and the band of glow.
function skyBand(j0,j1,out,tint){
  j0=clamp(j0,0,sh-1);j1=clamp(j1,j0,sh-1);
  for(let x=0;x<bw;x++){let r=0,g=0,b=0,n=0;for(let j=j0;j<=j1;j+=2){const c=skyT[j*bw+x];r+=c&255;g+=c>>8&255;b+=c>>16&255;n++;}tmp[x*3]=r/n;tmp[x*3+1]=g/n;tmp[x*3+2]=b/n;}
  const k=Math.max(1,bw>>4);
  for(let c=0;c<3;c++){
    let s=0,n=0;for(let x=0;x<Math.min(bw,k);x++){s+=tmp[x*3+c];n++;}
    for(let x=0;x<bw;x++){out[x*3+c]=s/n*tint[c];const a=x+k,b=x-k;if(a<bw){s+=tmp[a*3+c];n++;}if(b>=0){s-=tmp[b*3+c];n--;}}
  }
}
function seaCols(){skyBand(Math.round(.02*hy),Math.round(.1*hy),sD,LK.sd);skyBand(Math.round((WORLD.glowEl-.1)*hy),Math.round((WORLD.glowEl+.06)*hy),sB,LK.sb);}

/* ---------- painting: the sand ---------- */
// The shape of the sand, worked out once for the size of the window: broad shallow bars everywhere and, near us, ripple
// marks in two crossing sets. From its slope each pixel gets the place in the sky that it mirrors, how strongly it
// mirrors it, and how much of the sky's light its own colour catches.
function buildGround(){
  const n=bw*GR,p=WORLD.rip,hh=new Float32Array(n),hr=new Float32Array(n);
  ai=new Int32Array(n);rf=new Uint8Array(n);sk=new Uint8Array(n);spk=new Uint8Array(n).fill(255);
  const c1=Math.cos(p.t1)/p.lam,s1=Math.sin(p.t1)/p.lam,c2=Math.cos(p.t2)/(p.lam*1.5),s2=Math.sin(p.t2)/(p.lam*1.5),amp=p.lam*.17;
  for(let g=0;g<GR;g++){
    // Ripples fade out where they would be too fine to draw, and with distance up the beach.
    const d=dG[g],vis=smooth(1.8,4.6,p.lam*FC/(d*d))*smooth(4.7,3.3,d),o=g*bw;
    for(let x=0;x<bw;x++){
      const X=AX[x]*d;let h=.03*(fb(X*.45+p.o[0],d*.9+p.o[1])-.5),r=0;
      if(vis>0){
        const m=smooth(.4,.56,fb(X*.4+p.o[2],d*.4+p.o[3])+.32*smooth(4.3,2.5,d))*vis;
        if(m>0){
          const w=fb(X*1.1+p.o[1],d*1.1+p.o[0])-.5+.16*(nz(X*7+p.o[2],d*7+p.o[0])-.5);
          // An uneven ridge: a long rise and a short fall. Each ridge swells and dies away along its own length.
          let a=d*c1+X*s1+w*4.4,ia=Math.floor(a);a-=ia;let k=a<.66?a/.66:(1-a)/.34;k=k*k*(3-2*k)*(.25+.75*smooth(.22,.62,nz((X*c1-d*s1)*.3+p.o[3],ia*.73+p.o[1])));
          let b=d*c2+X*s2+w*2.6+.4,ib=Math.floor(b);b-=ib;let k2=b<.6?b/.6:(1-b)/.4;k2=k2*k2*(3-2*k2)*(.2+.8*smooth(.25,.65,nz((X*c2-d*s2)*.3+p.o[0],ib*.61+p.o[2])));
          r=m*(k*.6+k2*.4);h+=r*amp;
        }
      }
      hh[o+x]=h;hr[o+x]=r;
    }
  }
  const KS=LK.slope*2*f,gr=LK.grain;
  for(let g=0;g<GR;g++){
    const d=dG[g],o=g*bw,gu=g>0?g-1:0,gd=g<GR-1?g+1:g,idd=1/(dG[gu]-dG[gd]),idx=f/(2*d),c0=CAMH/Math.hypot(CAMH,d);
    // Near the sea the sand is soaked and shines like the water. Up the beach it is only damp.
    const wet=.7+.3*smooth(3.2,7.6,d);
    for(let x=0;x<bw;x++){
      const i=o+x,sd=(hh[gu*bw+x]-hh[gd*bw+x])*idd,sx=(hh[x<bw-1?i+1:i]-hh[x>0?i-1:i])*idx;
      // A slope that faces us mirrors the sky higher up, one that faces away mirrors it lower down, or the beach itself.
      let tr=Math.round(g+sd*KS),tx=Math.round(x+sx*KS*.5),k=1;
      if(tr<0){k=.4;tr=0;}else if(tr>sh-1)tr=sh-1;
      ai[i]=tr*bw+(tx<0?0:tx>bw-1?bw-1:tx);
      let c=c0+sd*.9;c=c<0?0:c>1?1:c;
      let F=(.04+.96*Math.pow(1-c,1.8))*wet*(1-.3*hr[i])*k;
      if(gr)F*=1+gr*(DTH[(g&63)<<6|(x&63)]-.5);
      rf[i]=clamp(F,0,1)*255;sk[i]=clamp(1-sd*1.5-.2*hr[i],.35,1.59)*160;
    }
  }
  // Shells and pebbles, scattered once.
  const ps=stream(SEEDS.sand),ax=bw/2/f;
  for(let n2=0;n2<420;n2++){
    const d=lerp(D0*.96,9.8,Math.pow(ps(),1.3)),X=(ps()-.5)*2*d*ax,sz=.004+.013*ps()*ps(),dk=.25+.32*ps();
    const px=cx+X*f/d,py=FC/d-.5,rx=sz*f/d,ry=Math.max(.45,rx*.5);if(rx<.3)continue;
    for(let g=Math.max(0,Math.floor(py-ry-1));g<=Math.min(GR-1,Math.ceil(py+ry+1));g++)for(let x=Math.max(0,Math.floor(px-rx-1));x<=Math.min(bw-1,Math.ceil(px+rx+1));x++){
      const e=Math.hypot((x+.5-px)/rx,(g+.5-py)/ry),c=clamp((1-e)*Math.max(1,rx)+.3,0,1)*Math.min(1,rx*1.4);
      if(c>0){const i=g*bw+x,v=255*(1-c*dk);if(v<spk[i])spk[i]=v;}
    }
  }
}
// One row of the beach in its two states: A is bare wet sand with its ripples, B the same sand under a film of water,
// which lies flat and mirrors the sky straight.
function groundRow(g){
  const o=g*bw,y=hy+g,c0=CAMH/Math.hypot(CAMH,dG[g]),FB=Math.min(.95,.06+.94*Math.pow(1-c0,1.5)),tj=Math.min(g,sh-1)*bw;
  const t0=LK.tr[0],t1=LK.tr[1],t2=LK.tr[2],ar=SA[0],ag=SA[1],ab=SA[2],wr=ar*.8*(1-FB),wg=ag*.8*(1-FB),wb=ab*.8*(1-FB);
  for(let x=0;x<bw;x++){
    const i=o+x,s=spk[i]*(1/255);let c=refT[tj+x];
    B32[i]=fin(((c&255)*t0*FB+wr)*s,((c>>8&255)*t1*FB+wg)*s,((c>>16&255)*t2*FB+wb)*s,x,y);
    c=refT[ai[i]];const k=rf[i]*(1/255),m=sk[i]*(1/160)*(1-k);
    A32[i]=fin(((c&255)*t0*k+ar*m)*s,((c>>8&255)*t1*k+ag*m)*s,((c>>16&255)*t2*k+ab*m)*s,x,y);
  }
}

/* ---------- layout ---------- */
const gcd=(a,b)=>b?gcd(b,a%b):a;
const stride=n=>{let s=Math.max(1,Math.floor(n*.618));while(gcd(s,n)>1)s++;return s;};
function layout(){
  W=Math.max(1,innerWidth);H=Math.max(1,innerHeight);LK=LOOKS[style];document.documentElement.dataset.look=style;
  let cw=W,ch=H;
  if(style==='pixel'){const cell=clamp(Math.round(Math.max(W,H)/(N.LOWQ?300:LK.cell)),2,12);bw=Math.max(24,Math.ceil(W/cell));bh=Math.max(24,Math.ceil(H/cell));cw=bw*cell;ch=bh*cell;fxc.width=bw;fxc.height=bh;}
  else{
    // The picture is soft, so it is worked out at a fraction of the window's size and scaled up.
    let k=Math.min(1,Math.sqrt((N.LOWQ?2.2e5:LK.px)*q/(W*H)));bw=Math.max(48,Math.round(W*k));bh=Math.max(48,Math.round(H*k));
    k=Math.min(N.LOWQ?1:2,window.devicePixelRatio||1,Math.sqrt(3e6/(W*H)));fxc.width=Math.round(W*k);fxc.height=Math.round(H*k);
  }
  cv.width=bw;cv.height=bh;for(const c of[cv,fxc]){c.style.width=cw+'px';c.style.height=ch+'px';}
  FK=fxc.width/bw;cx=bw/2;hy=Math.round(bh*.43);GR=bh-hy;
  // A tall window sees the sand from two metres off. A wide one looks further out, so the view never opens past 80 degrees.
  f=Math.max(GR*2/CAMH,bw/2/Math.tan(.7));FC=f*CAMH;D0=FC/GR;sh=Math.ceil(hy*ELMAX)+1;OFF=hy*bw;
  BY=Math.round(LK.by*hy);BX=Math.round(LK.bx*bw);
  img=ctx.createImageData(bw,bh);o32=new Uint32Array(img.data.buffer);o32.fill(0xff000000);
  skyT=new Uint32Array(bw*sh);refT=new Uint32Array(bw*sh);A32=new Uint32Array(bw*GR);B32=new Uint32Array(bw*GR);
  dG=new Float32Array(GR);for(let g=0;g<GR;g++)dG[g]=FC/(g+.5);
  AX=new Float32Array(bw);gxc=new Float32Array(bw);isl=new Float32Array(bw);dsx=new Float32Array(bw);ysg=new Float32Array(bw);ysI=new Int32Array(bw);
  tmp=new Float32Array(bw*3);sD=new Float32Array(bw*3);sB=new Float32Array(bw*3);
  const ik=style==='pixel'?1.5:1;let top=0;
  for(let x=0;x<bw;x++){
    const u=(x+.5)/bw;AX[x]=(x+.5-cx)/f;gxc[x]=Math.exp(-(((u-WORLD.glowU)/.6)**2));
    const a=isleAt(u,WORLD.isle)*ik;isl[x]=Math.max(a,WORLD.isle2?isleAt(u,WORLD.isle2)*ik:0);
    if(a>top){top=a;lampX=x;lampEl=a;}
  }
  fin=style==='pixel'?finPixel:style==='paint'?finPaint:finPhoto;fin2=style==='pixel'?finPixel:finPhoto;
  strS=stride(sh);strG=stride(GR);rowS=rowG=0;
  buildGround();shore();
  repaint();grainP=null;
}
function repaint(){buildLUT();for(let j=0;j<sh;j++)skyRow(j);for(let j=0;j<sh;j++)refRow(j);seaCols();for(let g=0;g<GR;g++)groundRow(g);}
// The sky moves slowly, so a few rows of it are painted again each frame, and with them the sand that mirrors it.
// The rows are taken in a scattered order, so the fresh ones never show as a line.
function refresh(){
  buildLUT();
  for(let k=Math.ceil(sh/110*N.SPEED);k>0;k--){skyRow(rowS);refRow(rowS);rowS=(rowS+strS)%sh;}
  for(let k=Math.ceil(GR/110*N.SPEED);k>0;k--){groundRow(rowG);rowG=(rowG+strG)%GR;}
  if(++tick%16===0)seaCols();
}
// Where the shore lies in each column of the picture.
function shore(){
  let d=DSm,mn=1e9,mx=0;
  for(let x=0;x<bw;x++){
    const a=AX[x];
    for(let it=0;it<2;it++){let u=(a*d+XR)*IDX;u=u<0?0:u>NX-1.001?NX-1.001:u;const i=u|0;d=SHt[i]+(SHt[i+1]-SHt[i])*(u-i);}
    dsx[x]=d;const gg=FC/d-.5,gi=Math.floor(gg);ysg[x]=gg;ysI[x]=gi;if(gi<mn)mn=gi;if(gi>mx)mx=gi;
  }
  minS=clamp(mn,0,GR-1);maxS=clamp(mx,0,GR-1);
}

/* ---------- waves and sheets ---------- */
// A wave is a crest line at a distance d, slanted and bent a little. It slows as the water shallows, and breaks
// where its height is most of the depth, sooner where it is taller. When its crest reaches the shore it launches a sheet.
const waves=[],sheets=[];let nextWave=0;
const crest=(w,X)=>w.sl*X+w.bd*(nz(X*.03+w.o,w.o2)-.5)+1.3*(nz(X*.11+w.o2,w.o3)-.5)+.35*(nz(X*.45+w.o3,w.o2)-.5);
function newWave(d,Hh){
  if(Hh===undefined)Hh=rr(.12,.37)*WORLD.swell*(E.set?rr(1.3,1.65):1)*(E.lull?.6:1)*(.8+.4*noise(T/37+WORLD.ph[5]));
  waves.push({d,H:clamp(Hh,.1,.64),sl:WORLD.slant+rr(-.16,.16),bd:rr(2,6),o:rr(0,200),o2:rr(0,200),o3:rr(0,200),o4:rr(0,200),sheet:false});
}
// A sheet runs L metres up the sand from the shore, slowing all the way, rests, and drains back. Its edge stays behind
// as a line on the sand until it fades or a later sheet runs over it. Every point across the beach starts when the
// crest gets there, so a slanted wave sweeps its sheet along the shore.
function launch(w){
  const L0=(2+11.5*Math.pow(w.H,1.15))*rr(.8,1.2),tilt=rr(-.1,.1);
  const s={age:0,L0,Tu:2+.5*L0,hold:rr(.3,1.1),Tb:3.5+.6*L0,soft:rr(.9,2.1),keep:rr(14,38),foam:clamp((w.H-.19)*3.4,0,1)*rr(.55,1),ln:1,end:0,o:rr(0,250),o2:rr(0,250),
    L:new Float32Array(NX),dl:new Float32Array(NX),al:new Float32Array(NX).fill(1),fr:new Float32Array(NX)};
  let mn=1e9,mx=0;
  for(let i=0;i<NX;i++){
    const X=i/IDX-XR,rel=w.d+crest(w,X)-SHt[i];s.dl[i]=rel;if(rel<mn)mn=rel;
    s.L[i]=Math.max(.3,L0*(.7+.6*nz(X*.07+w.o3,w.o4))*(1+.34*(nz(X*.3+s.o,s.o2)-.5)+.07*(nz(X*1.1+s.o2,s.o)-.5)+.012*(nz(X*5+s.o,s.o)-.5))+tilt*X);
  }
  for(let i=0;i<NX;i++){s.dl[i]-=mn;if(s.dl[i]>mx)mx=s.dl[i];s.fr[i]=SHt[i];}
  s.end=mx+s.Tu+s.hold+s.Tb;sheets.push(s);stats.waves++;
  if(L0>7){stats.long++;say(pick(['A long sheet of water slides far up the sand','A big wave sends its water all the way up the beach','The sea comes a long way in and takes its time going back']));}
  else if(chance(.1))say(pick(['A thin sheet of water runs up and soaks away','Foam hisses up the sand and thins to nothing','A small wave spends itself on the flat']));
  return s;
}
function stepSheets(dt){
  for(let k=sheets.length-1;k>=0;k--){
    const s=sheets[k];s.age+=dt;
    for(let i=0;i<NX;i++){const t=s.age-s.dl[i];if(t<=0){s.fr[i]=SHt[i];continue;}const p=t<s.Tu?t/s.Tu:1;s.fr[i]=SHt[i]-s.L[i]*(1-(1-p)*(1-p));}
    if(s.age>s.end){s.ln=.55*(1-(s.age-s.end)/s.keep);if(s.ln<=0)sheets.splice(k,1);}
  }
  // A new sheet wipes out the lines of older ones as it runs over them.
  for(let k=1;k<sheets.length;k++){
    const n=sheets[k];if(n.age>n.end)continue;
    for(let j=0;j<k;j++){const o=sheets[j];for(let i=0;i<NX;i++)if(o.al[i]>0&&n.age>n.dl[i]&&n.fr[i]<o.fr[i]+.03)o.al[i]=Math.max(0,o.al[i]-dt*5);}
  }
}

/* ---------- drawing: the picture ---------- */
// Blend a colour over a pixel of the picture, or darken or brighten it.
function over(i,x,y,r,g,b,a){const c=o32[i],r0=c&255,g0=c>>8&255,b0=c>>16&255;o32[i]=fin2(r0+(r-r0)*a,g0+(g-g0)*a,b0+(b-b0)*a,x,y);}
function shade(i,x,y,k){const c=o32[i];o32[i]=fin2((c&255)*k,(c>>8&255)*k,(c>>16&255)*k,x,y);}
// The sand, then every sheet of water over it, oldest first. In each column a sheet covers the sand from the shore
// down to its front. While it drains, the shine draws back toward the sea with a soft edge and the front stays as a line.
function drawSheets(){
  const g0=minS;o32.set(A32.subarray(g0*bw),OFF+g0*bw);
  const eD=LK.eD,eB=LK.eB,F0=LK.foam[0],F1=LK.foam[1],F2=LK.foam[2];
  for(let k=0;k<sheets.length;k++){
    const s=sheets[k],film=s.age<s.end,fo=s.foam;let d=s.fr[NX>>1];
    for(let x=0;x<bw;x++){
      // Where this column's line of sight meets the front.
      const a=AX[x];
      let u=(a*d+XR)*IDX;u=u<0?0:u>NX-1.001?NX-1.001:u;let i=u|0,t=u-i;d=s.fr[i]+(s.fr[i+1]-s.fr[i])*t;
      u=(a*d+XR)*IDX;u=u<0?0:u>NX-1.001?NX-1.001:u;i=u|0;t=u-i;d=s.fr[i]+(s.fr[i+1]-s.fr[i])*t;
      const gF=FC/d-.5,gS=ysg[x];if(gF<gS+.25)continue;
      let ln=(s.al[i]+(s.al[i+1]-s.al[i])*t)*s.ln;if(ln<.02&&!film)continue;
      const y0=Math.max(g0,Math.ceil(gS)),yF=Math.min(GR-1,Math.floor(gF));
      if(film){
        const tau=s.age-s.dl[i]-(s.dl[i+1]-s.dl[i])*t,tb=tau-s.Tu-s.hold;let g1=yF,g2=yF,sb=0;
        if(tb>0){
          const pb=tb/s.Tb;
          if(pb>=1)g1=g2=-1;
          else{sb=(s.L[i]+(s.L[i+1]-s.L[i])*t+s.soft)*pb*pb;g1=Math.min(yF,Math.floor(FC/(d+sb)-.5));g2=sb>s.soft?Math.min(yF,Math.floor(FC/(d+sb-s.soft)-.5)):yF;ln*=1-.3*pb;}
        }
        let j=y0*bw+x;for(let g=y0;g<=g1;g++,j+=bw)o32[OFF+j]=B32[j];
        for(let g=Math.max(y0,g1+1);g<=g2;g++){const al=(dG[g]-d-sb)/s.soft+1;if(al>0){const j2=g*bw+x,c=B32[j2];over(OFF+j2,x,hy+g,c&255,c>>8&255,c>>16&255,al>1?1:al);}}
        // Foam rides behind the front of a strong sheet, and thins out as the sheet slows.
        if(fo>0&&tau>0&&tau<s.Tu+2.6){
          // The band of foam is kept to 48 rows of the picture, so a front at our feet costs no more than one far off.
          const fm=fo*(1-smooth(s.Tu*.5,s.Tu+2.6,tau)),wf=Math.min(.1+.55*fo,48*d*d/FC);
          for(let g=Math.max(y0,Math.ceil(FC/(d+wf)-.5));g<=yF;g++){
            const sm=dG[g]-d,n=nz(a*dG[g]*24+s.o,sm*30+s.o2);let v=(n-.4)*4.5;
            if(v>0){v=(v>1?1:v)*fm*(1-sm/wf);over(OFF+g*bw+x,x,hy+g,F0,F1,F2,v);}
          }
        }
      }
      // The front itself: a thin dark line where the water's edge curls over, and a pale one just behind it.
      if(ln>.02){
        const rpm=FC/(d*d),wd=Math.max(1.1,.013*rpm),wb=Math.max(1.5,.055*rpm),hd=wd*.5+.6,hb=wb*.5+.6;
        for(let g=Math.max(y0,Math.ceil(gF-wd-wb-.6)),gz=Math.min(GR-1,Math.floor(gF+.6));g<=gz;g++){
          const e=gF-g,j=OFF+g*bw+x,y=hy+g;
          let v=1-Math.abs(e-wd*.5)/hd;if(v>0)shade(j,x,y,1-eD*ln*v);
          v=1-Math.abs(e-wd-wb*.5)/hb;if(v>0)over(j,x,y,F0,F1,F2,eB*ln*v);
        }
      }
    }
  }
}
// The open sea, a row at a time: three layers of noise move toward us across it and mix the dull colour of the low sky
// with the glow. Far rows hold many metres of water each, so the layers fade out there instead of turning to noise.
function drawSea(){
  const kc=1/f;
  for(let g=0;g<=maxS;g++){
    const d=dG[g],y=hy+g,o=g*bw,m=d-DSm,dd=d*d/FC,far=smooth(90,14,m);
    const wB=.1+.42*far,wA=2.2*clamp(.8/(dd*.2),0,1)*(.3+.7*far),wC=1.9*clamp(.8/(dd*1.5),0,1)*far,wE=1.1*clamp(.8/(dd*5),0,1)*far;
    let ty=d*.2+T*.28+WORLD.ph[0];const ya=Math.floor(ty),fy=ty-ya,r0=(ya&255)<<8,r1=((ya+1)&255)<<8;
    ty=d*1.5+T*.9+WORLD.ph[1];const yb=Math.floor(ty),fy2=ty-yb,r2=(yb&255)<<8,r3=((yb+1)&255)<<8;
    ty=d*5+T*1.7+WORLD.ph[0];const yc=Math.floor(ty),fy3=ty-yc,r4=(yc&255)<<8,r5=((yc+1)&255)<<8;
    const k1=d*kc*.03,k2=d*kc*.2,k3=d*kc*.55,full=g<minS;let t1=(.5-cx)*k1+4096+T*.004,t2=(.5-cx)*k2+4096+T*.05*WORLD.wind,t3=(.5-cx)*k3+4096-T*.09*WORLD.wind;
    for(let x=0;x<bw;x++,t1+=k1,t2+=k2,t3+=k3){
      if(!full&&g>ysI[x])continue;
      let i=t1|0,fr=t1-i;i&=255;let j=(i+1)&255;
      const n1=(NZ[r0|i]+(NZ[r0|j]-NZ[r0|i])*fr)*(1-fy)+(NZ[r1|i]+(NZ[r1|j]-NZ[r1|i])*fr)*fy;
      let w=wB+(n1-.5)*wA;
      if(wC>.02){i=t2|0;fr=t2-i;i&=255;j=(i+1)&255;w+=((NZ[r2|i]+(NZ[r2|j]-NZ[r2|i])*fr)*(1-fy2)+(NZ[r3|i]+(NZ[r3|j]-NZ[r3|i])*fr)*fy2-.5)*wC;}
      if(wE>.02){i=t3|0;fr=t3-i;i&=255;j=(i+1)&255;w+=((NZ[r4|i]+(NZ[r4|j]-NZ[r4|i])*fr)*(1-fy3)+(NZ[r5|i]+(NZ[r5|j]-NZ[r5|i])*fr)*fy3-.5)*wE;}
      w=w<0?0:w>1?1:w;
      const p=x*3;let r=sD[p]+(sB[p]-sD[p])*w,gg=sD[p+1]+(sB[p+1]-sD[p+1])*w,b=sD[p+2]+(sB[p+2]-sD[p+2])*w;
      // Close to the shore the water thins to a film and goes flat.
      const ks=(d-dsx[x])*.5;
      if(ks<1){const c=B32[o+x],k=ks<0?0:ks,cr=c&255,cg=c>>8&255,cb=c>>16&255;r=cr+(r-cr)*k;gg=cg+(gg-cg)*k;b=cb+(b-cb)*k;}
      o32[OFF+o+x]=fin(r,gg,b,x,y);
    }
  }
}
// The waves, each drawn down its own columns: the back of the wave turned up to the bright sky, the dark face, foam
// spreading along the crest once it breaks and trailing behind, and the darker trough in front.
// rT and rB are the top and the foot of the face, in rows below the horizon.
function drawWaves(){
  const F0=LK.foam[0],F1=LK.foam[1],F2=LK.foam[2],L0=LK.foamLo[0],L1=LK.foamLo[1],L2=LK.foamLo[2];
  for(let k=0;k<waves.length;k++){
    const w=waves[k],vis=smooth(FAR-2,84,w.d);if(vis<=0)continue;
    let d=w.d+crest(w,AX[0]*w.d);d=w.d+crest(w,AX[0]*d);
    for(let x=0;x<bw;x++){
      // The column before is a good first guess, so one step finds where this line of sight meets the crest.
      const a=AX[x];d=w.d+crest(w,a*d);
      const ds=dsx[x];if(d<ds+.15)continue;
      const X=a*d,m=d-ds,Hx=w.H*(.66+.6*nz(X*.07+w.o3,w.o4)+.16*nz(X*.37+w.o4,w.o)),dbk=(Hx/.8-.03)/.02;
      // br is how far the breaking has got, from 0 for a smooth swell to 1 for a wall of foam.
      // A broken wave does not stay white from end to end: stretches of it die down and pick up again.
      let br=(dbk-m)/4.5;br=br<0?0:br>1?1:br;
      const seg=br>0?smooth(.26,.56,nz(X*.12+w.o2,T*.07+w.o)):1;
      const Hv=br>0?Math.min(Hx,(m*.02+.03)*.9+.04)*(1-.4*(1-seg)*br):Hx*(.45+.55*smooth(dbk+35,dbk,m));
      const fh=f*Hv/d,rB=FC/d,rT=rB-fh,lim=ysI[x],big=fh>3?1:fh>1?(fh-1)*.5:0;
      const y0=Math.max(0,Math.floor(br>0?FC/(d+2.5):rT-fh*1.6)),y1=Math.min(lim,Math.floor(rB+fh*.8));
      const p=x*3,dr=sD[p]*.66,dg=sD[p+1]*.66,db=sD[p+2]*.7,fa=vis*(.5+.5*seg),thr=br>0?br*(.45+.75*seg)+(nz(X*1.9+w.o,T*.5+w.o2)-.5)*.5:-1;
      for(let g=y0;g<=y1;g++){
        const i=OFF+g*bw+x,y=hy+g,t=(g+.5-rT)/fh;
        // How much of this pixel the face covers, so a thin far wave is a faint line and a slanted crest has no steps.
        let fc=(g+1<rB?g+1:rB)-(g>rT?g:rT);fc=fc<0?0:fc>1?1:fc;
        if(g<rT){
          const qb=1+t/1.6,bc=(rT-g>1?1:rT-g)*(1-fc);
          if(qb>0)over(i,x,y,sB[p],sB[p+1],sB[p+2],.55*qb*qb*bc*vis*(1-.5*br));
          // Foam left on the water behind a broken wave, thinning out with distance.
          if(br>.05){const sm=dG[g]-d;if(sm<2.5){const n=nz(X*2.6+w.o,dG[g]*7+w.o2)*.7+.3*NZ[((X*23+w.o)&255)|((dG[g]*31+w.o2)&255)<<8];let v=(n-.25-.5*sm/2.5)*3;if(v>0)over(i,x,y,L0,L1,L2,(v>1?1:v)*br*.75*fa*bc);}}
        }
        if(fc>0){
          const tt=t<0?0:t>1?1:t;
          if(tt<thr){
            // Foam comes down the face from the crest, mottled, with a ragged lower edge.
            const n=nz(X*4.5+w.o3,tt*2.5+w.o4+T*.4)*.65+.35*NZ[((X*29+w.o3)&255)|((tt*9+w.o4)&255)<<8],e=(1-tt/thr)*3,s2=tt*.55+.45*(1-n);
            over(i,x,y,F0+(L0-F0)*s2,F1+(L1-F1)*s2,F2+(L2-F2)*s2,fc*fa*(.6+.4*n)*(e>1?1:e));
          }else{
            over(i,x,y,dr,dg,db,fc*vis*(.5+.4*tt)*(1-.45*br));
            if(tt<.25&&br<.5&&big>0)over(i,x,y,sB[p],sB[p+1],sB[p+2],.45*(1-tt/.25)*fc*vis*big);
          }
        }
        if(g+1>rB){const tc=(g+1-rB>1?1:g+1-rB),q=1-(g+.5-rB)/(fh*.8+1);if(q>0)shade(i,x,y,1-(.13+.1*br*seg)*q*tc*vis);}
      }
    }
  }
}

/* ---------- small things that pass ---------- */
const flocks=[];let boat=null,plane=null;
// Each kind of event has its own timer with exponentially distributed gaps: m is the average gap in seconds, f the average wait for the first.
const SCHED={birds:{m:70,f:18},set:{m:95,f:40},lull:{m:150,f:80},flare:{m:170,f:60},ember:{m:220,f:120},boat:{m:240,f:50},plane:{m:300,f:110}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
function fire(k){
  switch(k){
    case'birds':{
      const d=chance(.5)?1:-1,n=ri(3,12),fl={u:d>0?-.12:1.12,el:rr(.06,.75),v:d*rr(.028,.055),dv:rr(-.004,.004),o:[]};
      // A loose V behind the leader.
      for(let i=0;i<n;i++){const row=Math.ceil(i/2);fl.o.push({du:-d*row*rr(.011,.017),de:(i%2?1:-1)*row*rr(.007,.013)+rr(-.004,.004),ph:rr(0,TAU),f:rr(6.5,9.5)});}
      flocks.push(fl);say(pick(['A line of birds crosses the sky on its way home','Birds fly low along the horizon','A flock passes, black against the glow']));break;
    }
    case'set':E.lull=null;E.set={age:0,dur:rr(24,44),up:1,down:1};say('A set of bigger waves is on its way in');break;
    case'lull':E.set=null;E.lull={age:0,dur:rr(28,55),up:1,down:1};say('The sea goes quiet for a while');break;
    case'flare':E.ember=null;E.flare={age:0,dur:rr(45,90),up:14,down:26};say('The glow flares up along the horizon');break;
    case'ember':E.flare=null;E.ember={age:0,dur:rr(55,100),up:20,down:30};say('The sky sinks toward a deeper red');break;
    case'boat':{if(boat)break;const d=chance(.5)?1:-1;boat={u:d>0?-.06:1.06,v:d*rr(.004,.009),d:rr(420,900),len:rr(8,14),ph:rr(0,TAU),lamp:chance(.7)};say('A fishing boat heads along the horizon');break;}
    case'plane':{if(plane)break;const d=chance(.5)?1:-1;plane={u:d>0?-.1:1.1,el:rr(.5,.95),v:d*rr(.012,.02),dv:rr(-.003,.004)};say('A plane catches the last light, high up');break;}
  }
}

/* ---------- the world, each step ---------- */
function update(dt){
  T+=dt;
  for(const k in SCHED){nextEv[k]-=dt;if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);fire(k);}}
  for(const k in E){const e=E[k];if(e){e.age+=dt;if(e.age>=e.dur)E[k]=null;}}
  drift(dt);
  DSm=DS0+M.tide;for(let i=0;i<NX;i++)SHt[i]=DSm+SHs[i];
  nextWave-=dt;if(nextWave<=0){newWave(FAR);nextWave=(2.2+expo(3.4))*(E.set?.8:1)*(E.lull?1.5:1);}
  for(let k=waves.length-1;k>=0;k--){
    const w=waves[k];w.d-=clamp(.95+.07*(w.d-DSm),.95,5.5)*dt;
    if(w.d<DSm+9){
      let mn=1e9,mx=-1e9;for(let i=0;i<NX;i+=14){const r=w.d+crest(w,i/IDX-XR)-SHt[i];if(r<mn)mn=r;if(r>mx)mx=r;}
      if(!w.sheet&&mn<=0){w.sheet=true;launch(w);}
      if(mx<-.4)waves.splice(k,1);
    }
  }
  stepSheets(dt);
  for(let i=flocks.length-1;i>=0;i--){const b=flocks[i];b.u+=b.v*dt;b.el+=b.dv*dt;if(b.u<-.4||b.u>1.4)flocks.splice(i,1);}
  if(boat){boat.u+=boat.v*dt;if(boat.u<-.1||boat.u>1.1)boat=null;}
  if(plane){plane.u+=plane.v*dt;plane.el+=plane.dv*dt;if(plane.u<-.2||plane.u>1.2)plane=null;}
}

/* ---------- drawing: what passes ---------- */
// Drawn in the buffer's own pixels, scaled up to the screen. In pixel art everything lands on whole pixels.
const gfx=stream(SEEDS.fx^0x5bd1e995);
function drawFx(){
  const c=fx,px=style==='pixel',ink=LK.ink;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,fxc.width,fxc.height);c.setTransform(FK,0,0,FK,0,0);
  // The lamp on the island.
  if(WORLD.lamp&&lampEl>0){
    const l=WORLD.lamp,t=(T+l.o)%l.p;
    if(t<.22||(l.two&&t>.55&&t<.77)){
      const x=lampX+.5,y=hy-lampEl*hy-.5;
      if(px){c.fillStyle=rgba(LK.lamp,1);c.fillRect(x|0,Math.round(y-1),1,1);}
      else{const r=Math.max(2.2,.03*hy),g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba(LK.lamp,.95));g.addColorStop(.25,rgba(LK.lamp,.4));g.addColorStop(1,rgba(LK.lamp,0));c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
    }
  }
  if(boat){
    const b=boat,x=b.u*bw,y=hy+FC/b.d+Math.sin(T*.9+b.ph)*.25,wl=Math.max(px?5:4,f*b.len/b.d),hh=Math.max(1.2,wl*.14),dir=b.v>0?1:-1;
    c.fillStyle=rgba(ink,px?1:.82);
    if(px){
      const w2=Math.round(wl),x0=Math.round(x-w2/2),yb=Math.round(y);
      c.fillRect(x0,yb-1,w2,1);c.fillRect(x0+1,yb,w2-2,1);c.fillRect(x0+(dir>0?1:w2-4),yb-3,3,2);c.fillRect(x0+(w2>>1),yb-5,1,4);
      if(b.lamp){c.fillStyle=rgba(LK.lamp,1);c.fillRect(x0+(dir>0?w2-1:0),yb-2,1,1);}
    }else{
      c.beginPath();c.moveTo(x-wl*.5,y-hh);c.lineTo(x+wl*.5,y-hh);c.lineTo(x+wl*.42,y);c.lineTo(x-wl*.42,y);c.closePath();c.fill();
      c.fillRect(x-dir*wl*.3-wl*.12,y-hh*2.4,wl*.24,hh*1.5);c.fillRect(x+dir*wl*.05,y-hh*4.2,Math.max(.5,wl*.03),hh*3.3);
      if(b.lamp){const lx=x+dir*wl*.44,ly=y-hh*1.5,r=Math.max(1.6,wl*.14),g=c.createRadialGradient(lx,ly,0,lx,ly,r);g.addColorStop(0,rgba(LK.lamp,.95));g.addColorStop(.3,rgba(LK.lamp,.35));g.addColorStop(1,rgba(LK.lamp,0));c.fillStyle=g;c.fillRect(lx-r,ly-r,r*2,r*2);
        c.fillStyle=rgba(LK.lamp,.22);c.fillRect(lx-.4,y+hh*.4,.8,hh*3);}
    }
  }
  if(plane){
    const x=plane.u*bw,y=hy*(1-plane.el),dir=plane.v>0?1:-1,len=.07*bw;
    if(px){for(let i=0;i<6;i++){c.fillStyle=rgba(i<2?LK.lamp:LK.foamLo,1);if(i<2||i%2===0)c.fillRect(Math.round(x-dir*i*2),Math.round(y+i*.3),1,1);}}
    else{const g=c.createLinearGradient(x,0,x-dir*len,0);g.addColorStop(0,'rgba(255,214,170,.85)');g.addColorStop(1,'rgba(255,170,110,0)');c.strokeStyle=g;c.lineWidth=Math.max(.6,.005*hy);c.beginPath();c.moveTo(x,y);c.lineTo(x-dir*len,y+len*.05);c.stroke();}
  }
  if(flocks.length){
    c.fillStyle=c.strokeStyle=rgba(ink,px?1:.86);c.lineJoin=c.lineCap='round';
    for(const fl of flocks){
      const s=Math.max(px?1:1.6,hy*.011*(.7+.6*fl.el));
      if(!px){c.lineWidth=Math.max(.55,s*.17);c.beginPath();}
      for(const o of fl.o){
        const x=(fl.u+o.du)*bw,y=hy*(1-fl.el-o.de)+Math.sin(T*.7+o.ph)*s*.25,a=Math.sin(T*o.f+o.ph);
        if(px){const xi=Math.round(x),yi=Math.round(y),up=a>.25?-1:a<-.25?1:0;c.fillRect(xi,yi,1,1);c.fillRect(xi-1,yi+up,1,1);c.fillRect(xi+1,yi+up,1,1);if(s>1.4){c.fillRect(xi-2,yi+up*2,1,1);c.fillRect(xi+2,yi+up*2,1,1);}}
        else{c.moveTo(x-s,y-s*.55*a);c.quadraticCurveTo(x-s*.45,y-s*(.18+.2*a),x,y);c.quadraticCurveTo(x+s*.45,y-s*(.18+.2*a),x+s,y-s*.55*a);}
      }
      if(!px)c.stroke();
    }
  }
  // A photograph has grain. It is one tile of specks laid over the whole picture, at a new offset each frame.
  if(style==='photo'&&!N.LOWQ){
    if(!grainP){
      const t=document.createElement('canvas');t.width=t.height=256;const g=t.getContext('2d'),im=g.createImageData(256,256),p=stream(SEEDS.fx^0x2545f491);
      for(let i=0;i<65536;i++){const v=p(),a=Math.abs(v-.5)*2;im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=v<.5?0:255;im.data[i*4+3]=a*a*a*20;}
      g.putImageData(im,0,0);grainP=c.createPattern(t,'repeat');
    }
    const ox=N.RM?0:gfx()*256|0,oy=N.RM?0:gfx()*256|0;c.setTransform(1,0,0,1,-ox,-oy);c.fillStyle=grainP;c.fillRect(ox,oy,fxc.width,fxc.height);
  }
}

/* ---------- drawing ---------- */
// On a slow machine the buffer is made smaller, but only in the first seconds, because painting it again is a pause.
let pN=0,pT=0,paced=0;
function draw(){
  const t0=performance.now();
  refresh();shore();drawSheets();drawSea();drawWaves();
  ctx.putImageData(img,0,0);
  drawFx();
  if(paced<2&&style!=='pixel'&&!N.RM&&!N.paused){
    if(++pN>30)pT+=performance.now()-t0;
    if(pN===110){if(pT/80>8.5){q*=.68;paced++;pN=pT=0;layout();}else paced=9;}
  }
}
// With reduced motion there is no frame loop, so the still frame is drawn again here.
function rebuild(){layout();if(N.RM)draw();}
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(rebuild,150);});

/* ---------- the look ---------- */
// A button in the overlay, or the S key, redraws the same evening in the next look. ?style=photo, paint or pixel picks one.
const btn=document.getElementById('look');
function setLook(s,tell){
  style=s;q=1;paced=0;pN=pT=0;rebuild();
  if(btn)btn.textContent=LOOKS[s].name;
  if(tell)N.log({photo:'The evening is shown as a photograph',paint:'The evening is painted, as if for an animated film',pixel:'The evening is redrawn in pixel art'}[s]);
  if(N.refresh&&tell)N.refresh();
}
const nextLook=()=>setLook(STYLES[(STYLES.indexOf(style)+1)%STYLES.length],true);
if(btn){btn.textContent=LOOKS[style].name;btn.addEventListener('click',e=>{e.stopPropagation();nextLook();});}
if(!N.EMBED)addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey||document.querySelector('dialog[open]'))return;if(e.key==='s'||e.key==='S')nextLook();});

/* ---------- start ---------- */
function state(){
  return{time:+T.toFixed(1),look:style,mood:{glow:+M.g.toFixed(2),warm:+M.w.toFixed(2),cover:+M.cover.toFixed(2),tide:+M.tide.toFixed(2),set:!!E.set,lull:!!E.lull,flare:!!E.flare,ember:!!E.ember},
    sea:{waves:waves.map(w=>({d:+w.d.toFixed(1),H:+w.H.toFixed(2)})),sheets:sheets.map(s=>({age:+s.age.toFixed(1),reach:+s.L0.toFixed(1),foam:+s.foam.toFixed(2),line:+s.ln.toFixed(2),film:s.age<s.end}))},
    air:{flocks:flocks.length,boat:!!boat,plane:!!plane,lamp:!!WORLD.lamp},
    canvas:{W,H,buffer:[bw,bh],horizon:hy,focal:+f.toFixed(1),nearest:+D0.toFixed(2),quality:+q.toFixed(2)},stats:{...stats}};
}
// How long each stage of a frame takes, in milliseconds, averaged over n frames.
function profile(n=40){
  const o={},st={sky:refresh,shore,sheets:drawSheets,sea:drawSea,waves:drawWaves,put:()=>ctx.putImageData(img,0,0),fx:drawFx};let sum=0;
  for(const k in st){const t0=performance.now();for(let i=0;i<n;i++)st[k]();o[k]=+((performance.now()-t0)/n).toFixed(2);sum+=o[k];}
  o.frame=+sum.toFixed(2);return o;
}
// The sea has been running for a while before the page opens, so there are waves on their way in and water on the sand.
drift(0);nextWave=expo(3);
for(let t=0;t<80;t+=.1)update(.1);
quiet=false;stats.waves=stats.long=stats.events=0;
layout();
N.log(`A flat beach at low tide in the last red light, ${{photo:'as a photograph',paint:'painted as if for an animated film',pixel:'in pixel art'}[style]}`);
N.stats(stats);
if(N.DEBUG)window.AG={WORLD,LOOKS,pause(){N.paused=true;},resume(){N.paused=false;},run(s){for(let t=0;t<s;t+=1/30)update(1/30);},step(s){N.paused=true;for(let t=0;t<s;t+=1/60)update(Math.min(1/60,s-t));repaint();draw();},
  draw,fire,state,rebuild,profile,nextEv,M,E,look:s=>STYLES.includes(s)&&setLook(s,false),wave(h=.4,d){newWave(d||DSm+12,h);},waves,sheets};
N.run({update(dt){update(dt);N.stats(stats);},draw,step:1/30});
})();
