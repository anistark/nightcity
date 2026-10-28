/* Shoreline: looking down at bare feet on wet sand at night, while waves run up the beach under the moon.
   Each wave picks how far it reaches, so some wash over the toes, some run past and some fall just short.
   Foam laces the water and dissolves, the sand darkens where it has been wet and dries again, and now and then
   a crab scuttles by or small clams surface in the backwash. Sand, foam and skin are generated pixel by pixel once,
   and every frame composites them through masks that follow the water. No libraries, no image files. */
(()=>{
'use strict';
// ?gl runs the WebGL prototype in gl.js instead. It must start before this file takes a 2D context on the canvas.
if(new URLSearchParams(location.search).has('gl')&&!window.SHORELINE_2D){const s=document.createElement('script');s.src=document.currentScript.src.replace(/main\.js(\?.*)?$/,'gl.js');document.body.append(s);return;}
const cv=document.getElementById('scene');
const ctx=cv.getContext('2d');
// Seed, frame loop, embed mode and overlay come from the shared runtime, ../assets/js/nightcity.js.
const{RM,LOWQ,DEBUG,R,rr,ri,pick,chance,expo,wpick,noise,fbm}=NightCity;

/* ---------- helpers ---------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
const sstep=(a,b,v)=>{const k=clamp((v-a)/(b-a),0,1);return k*k*(3-2*k);};
const ease=(dt,tau)=>1-Math.exp(-dt/tau);
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return[c,c.getContext('2d')];}
const rgb=(c,a)=>a===undefined?`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`:`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
const mixc=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
// A fixed per-pixel hash, so textures repaint the same way on every resize without drawing from the generator.
function h2(x,y,s){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,982451653))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296;}
// Value noise that wraps every P lattice cells, for textures that tile without seams.
function ptable(P,Q){Q=Q||P;const t=new Float32Array(P*Q);for(let i=0;i<t.length;i++)t[i]=R();return{t,P,Q};}
function pn(T,x,y){const{t,P}=T,Q=T.Q||P,xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const x0=((xi%P)+P)%P,y0=((yi%Q)+Q)%Q,x1=(x0+1)%P,y1=(y0+1)%Q,a=t[y0*P+x0],b=t[y0*P+x1],c=t[y1*P+x0],d=t[y1*P+x1];
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
// Draws only the blurred shadow of a shape, far away from the shape itself: a soft brush that works in every browser.
function soft(g,blur,col,fn){const a=g.getTransform().a;g.save();g.shadowColor=col;g.shadowBlur=blur;g.shadowOffsetX=20000;g.translate(-20000/a,0);fn();g.restore();}

/* ---------- the night ---------- */
const SANDS=[
  [{name:'pale',a:[196,180,156],b:[160,142,118]},4],
  [{name:'golden',a:[204,174,132],b:[168,134,96]},3],
  [{name:'grey',a:[164,158,150],b:[122,116,110]},2],
  [{name:'dark',a:[124,116,108],b:[84,78,74]},1]];
const SAND=wpick(SANDS);
const MOONS=[[{name:'cold',c:[124,136,164]},3],[{name:'silver',c:[134,141,158]},3],[{name:'pale',c:[144,145,152]},2]];
const MOON=wpick(MOONS);
const MOON_B=rr(.9,1.12);
const SKINS=[['fair',[228,192,168]],['light',[216,174,142]],['medium',[188,138,104]],['tan',[164,114,82]],['brown',[124,84,58]],['deep',[90,58,42]]];
const POLISH=[[150,28,46],[30,42,70],[196,164,214],[232,226,216],[44,108,100],[210,90,60]];
// Where the sea starts, how lively the surf is tonight, and a slow tide that creeps up or back over minutes.
const SEA={y:rr(.05,.12),energy:rr(.8,1.2),tide:rr(-1,1),tideO:rr(0,500),gladeX:rr(.32,.68),gladeW:rr(.08,.16)};
function makePerson(main){
  const[skinName,skin]=pick(SKINS);
  return{skinName,skin:skin.map(v=>v*rr(.96,1.04)),hair:chance(.5)?rr(.25,1):rr(0,.12),
    nails:chance(main?.25:.5)?pick(POLISH):null,anklet:chance(.25)?(chance(.5)?-1:1):0,
    size:rr(.94,1.06),spread:rr(.1,.2),splay:rr(.03,.14),seed:R()*1e4};}
const people=[makePerson(true)];
if(chance(.3)){const p=makePerson(false);p.side=chance(.5)?-1:1;p.size*=rr(.86,.96);p.rot=p.side*rr(.12,.26);p.back=rr(-.08,.05);people.push(p);}
// Per-foot details drawn once from the generator, so a resize redraws the same feet.
for(const p of people){p.feet=[-1,1].map(s=>{
  const hairs=[];for(let i=0;i<Math.round(520*p.hair);i++)hairs.push([rr(-.3,.3),rr(1.02,3.2),rr(.01,.026),rr(-.7,.7),rr(.18,.45)]);
  const toeHairs=[];if(p.hair>.4)for(let i=0;i<ri(4,14);i++)toeHairs.push([ri(0,1),rr(.45,.8),rr(-.3,.3)]);
  return{s,hairs,toeHairs,tw:[0,1,2,3,4].map(()=>rr(.94,1.06)),wet:0,sink:rr(0,.12),ring:0,cover:0,px:0,py:0,spr:null};});}

/* ---------- state ---------- */
let CW=0,CH=0,DPR=1,W=0,H=0,t=0,U=1,L=100,toeY=0,ankleY=0;
const MS=1/3,WS=1/6;
let baseDry,baseWet,glade,vig,sandTiles=null,foamTiles=null,patDense,patSparse,patDenseD,patSparseD;
let wet,wtx,mDense,mdx,mSparse,msx,scratch,sx,fscr,fsx;
let foamOX=0,foamOY=0,lastFront=0,bright=1,brightTo=1,wetT=0,grainT=0,gox=0,goy=0;
const waves=[],strands=[],crabs=[],clams=[],holes=[],shells=[],sparkles=[];
const stats={waves:0,reached:0,short:0};
const NX=96;let XS=new Float32Array(NX),FRONT=new Float32Array(NX);

/* ---------- textures ---------- */
const SAND_T=[ptable(6),ptable(16),ptable(48)];
const WAVE_T=ptable(12);
// Sand: two scales of soft blotches, grain-level jitter, and the odd dark, bright or coloured grain.
// The wet version is darker, more even and a little cooler, because water fills the gaps between grains.
function makeSand(S){
  const[d,dg]=mk(S,S),[w,wg]=mk(S,S),di=dg.createImageData(S,S),wi=wg.createImageData(S,S),D=di.data,Wd=wi.data;
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const u=x/S,v=y/S,n1=pn(SAND_T[0],u*6,v*6),n2=pn(SAND_T[1],u*16,v*16),n3=pn(SAND_T[2],u*48,v*48);
    const base=mixc(SAND.a,SAND.b,clamp(.5+(n1-.5)*1.1+(n2-.5)*.6,0,1));
    const r=h2(x,y,11),g=(h2(x,y,7)-.5)*.3+(h2(x>>1,y>>1,8)-.5)*.16+(n3-.5)*.16;
    let k=1+g,tint=null;
    if(r<.035)k*=.5;else if(r>.985)k*=1.4;else if(r>.5&&r<.504)tint=[120,72,58];else if(r>.6&&r<.603)tint=[40,38,40];
    let c=base.map(v=>v*k);if(tint)c=mixc(c,tint,.7);
    const i=(y*S+x)*4;D[i]=c[0];D[i+1]=c[1];D[i+2]=c[2];D[i+3]=255;
    const cw=mixc(base.map(v=>v*(1+g*.45)*.6),[84,92,100],.12);if(tint)cw[0]=lerp(cw[0],tint[0]*.6,.5);
    Wd[i]=cw[0];Wd[i+1]=cw[1];Wd[i+2]=cw[2];Wd[i+3]=255;}
  dg.putImageData(di,0,0);wg.putImageData(wi,0,0);
  // Scattered bits a few pixels across: pebbles, shell fragments and dark grains, each with a small shadow, wrapped at the tile edge.
  const bits=Math.round(S*S/420),sc=Math.max(1,S/512);
  for(const[g2,wetK]of[[dg,1],[wg,.62]])for(let n=0;n<bits;n++){const x=h2(n,1,301)*S,y=h2(n,2,301)*S,r=(.6+Math.pow(h2(n,3,301),3)*2.6)*sc,kind=h2(n,4,301);
    const col=kind<.25?SAND.b.map(v=>v*.6):kind<.7?mixc(SAND.a,[240,236,228],.6):kind<.9?[96,88,84]:[176,120,96];
    for(const ox of[0,-S,S])for(const oy of[0,-S,S]){const X=x+ox,Y=y+oy;if(X<-6||X>S+6||Y<-6||Y>S+6)continue;
      g2.fillStyle=`rgba(0,0,0,${.35*wetK})`;g2.beginPath();g2.ellipse(X+r*.3,Y+r*.4,r,r*.8,0,0,7);g2.fill();
      g2.fillStyle=rgb(col.map(v=>v*wetK));g2.beginPath();g2.ellipse(X,Y,r,r*(.6+.4*h2(n,5,301)),h2(n,6,301)*3,0,7);g2.fill();
      if(r>1.2){g2.fillStyle=`rgba(255,255,255,${.25*wetK})`;g2.beginPath();g2.arc(X-r*.3,Y-r*.3,r*.35,0,7);g2.fill();}}}
  return{dry:d,wet:w};
}
// Foam: a sheet of bubbles with round holes punched through it, like surf drying on sand. Holes come from two sizes
// of jittered cells, each with its own radius, and the sample point is warped first so no hole is a clean circle.
// Dense and sparse use the same holes at two sizes, so as the foam thins the same holes grow and join up.
// A broad noise thins whole patches out, and fine noise and a slope term shade it so it reads as bubbles.
function makeFoam(S,cell){
  const G=Math.max(3,Math.round(S/cell)),G2=G*3,P=ptable(5),Q=ptable(14),WP=ptable(9);
  const near=(gx,gy,G,s)=>{const cx=Math.floor(gx),cy=Math.floor(gy);let best=9,rad=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=cx+dx,ny=cy+dy,wx=((nx%G)+G)%G,wy=((ny%G)+G)%G;
      const d=Math.hypot(gx-(nx+.1+.8*h2(wx,wy,s)),gy-(ny+.1+.8*h2(wx,wy,s+1)))-h2(wx,wy,s+2)*.45;if(d<best){best=d;rad=h2(wx,wy,s+3);}}
    return[best,rad];};
  const A=new Float32Array(S*S),Ar=new Float32Array(S*S),B=new Float32Array(S*S),Br=new Float32Array(S*S),Pt=new Float32Array(S*S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const u=x/S,v=y/S,wx=(pn(WP,u*9,v*9)-.5)*1.5,wy=(pn(WP,u*9+4.3,v*9+2.1)-.5)*1.5,i=y*S+x;
    const[a,ar]=near(u*G+wx,v*G+wy,G,31),[b,br]=near(u*G2+wx*2,v*G2+wy*2,G2,57);A[i]=a;Ar[i]=ar;B[i]=b;Br[i]=br;Pt[i]=pn(P,u*5,v*5)*.7+pn(Q,u*14,v*14)*.3;}
  const make=(big,small,patchy)=>{const[c,g]=mk(S,S),img=g.createImageData(S,S),D=img.data;
    for(let y=0;y<S;y++)for(let x=0;x<S;x++){const i=y*S+x;
      const r1=big[0]+big[1]*Ar[i],r2=small[0]+small[1]*Br[i];
      let f=sstep(r1-.02,r1+.06,A[i])*sstep(r2-.03,r2+.08,B[i]);
      f*=sstep(patchy-.12,patchy+.12,Pt[i]);
      const rim=1-sstep(0,.12,A[i]-r1),lum=.86+.1*h2(x,y,91)+.06*(h2(x>>1,y>>1,92)-.5)+.08*rim;
      const o=i*4;D[o]=246*lum;D[o+1]=249*lum;D[o+2]=252*lum;D[o+3]=255*clamp(f,0,1);}
    g.putImageData(img,0,0);return c;};
  const dense=make([-.02,.48],[-.32,.34],.06),sparse=make([.08,.55],[-.05,.45],.4);
  // Shadow versions: the same alpha in black, for the shade foam casts on the sand through thin water.
  const dark=src=>{const[c,g]=mk(S,S);g.drawImage(src,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#000';g.fillRect(0,0,S,S);return c;};
  return{dense,sparse,denseD:dark(dense),sparseD:dark(sparse),cell};
}
// The moon's path on the water: a soft column, broken into short bright streaks by the ripples.
function makeGlade(){
  const w=Math.max(8,Math.round(CW/6)),h=Math.max(8,Math.round(CH/6)),[c,g]=mk(w,h),img=g.createImageData(w,h),D=img.data,P=ptable(24);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h,col=Math.exp(-(((u-SEA.gladeX)/(SEA.gladeW*(1+v*.8)))**2));
    const rip=pn(P,u*10,v*40),a=col*(.25+.75*sstep(.45,.8,rip))*(1-.55*v);const i=(y*w+x)*4;D[i]=D[i+1]=D[i+2]=255;D[i+3]=255*clamp(a,0,1);}
  g.putImageData(img,0,0);return c;
}

/* ---------- feet ---------- */
// One foot and its leg, drawn into its own canvas in foot units (L = foot length). Toes point up the screen,
// the leg runs down out of the frame. s=1 is a right foot, -1 a left foot, mirrored so the big toe is on the inside.
const TOES={cx:[-.125,-.035,.03,.09,.142],by:[.215,.205,.228,.256,.29],len:[.18,.135,.12,.102,.084],wid:[.118,.074,.068,.062,.056],ang:[.04,.06,.1,.15,.22]};
function legHW(y){return .136+Math.max(0,y-1.04)*.11;}
// Seen from above and a little behind, the foot is foreshortened: everything along it is squashed by SQ.
const SQ=.8;
function footPath(g,yb){
  g.moveTo(-.19,.205);
  g.bezierCurveTo(-.215,.27,-.215,.36,-.2,.42);g.bezierCurveTo(-.185,.5,-.16,.62,-.155,.74);
  g.bezierCurveTo(-.152,.82,-.172,.86,-.165,.92);g.bezierCurveTo(-.158,.97,-.135,1,-.136,1.04);
  g.lineTo(-legHW(yb),yb);g.lineTo(legHW(yb),yb);g.lineTo(.138,1.04);
  g.bezierCurveTo(.14,1,.168,.98,.168,.93);g.bezierCurveTo(.168,.86,.18,.8,.19,.7);
  g.bezierCurveTo(.2,.6,.212,.5,.205,.42);g.bezierCurveTo(.2,.36,.19,.32,.17,.3);
  g.bezierCurveTo(.12,.26,.02,.2,-.06,.2);g.bezierCurveTo(-.12,.2,-.17,.2,-.19,.205);g.closePath();
}
function toeGeom(i,f,p){
  const a=TOES.ang[i]+p.splay*(i-1)*.25,len=TOES.len[i]*f.tw[i],w=TOES.wid[i],bx=TOES.cx[i],by=TOES.by[i];
  const dx=Math.sin(a),dy=-Math.cos(a),nx=Math.cos(a),ny=Math.sin(a);
  return{a,len,w,bx,by,dx,dy,nx,ny,tx:bx+dx*(len-w*.5),ty:by+dy*(len-w*.5)};
}
function toePath(g,T){
  const{w,bx,by,dx,dy,nx,ny,tx,ty}=T,hw=w*.5;
  g.moveTo(bx-nx*hw*1.05-dx*.03,by-ny*hw*1.05-dy*.03);g.lineTo(tx-nx*hw,ty-ny*hw);
  g.bezierCurveTo(tx-nx*hw+dx*w*.62,ty-ny*hw+dy*w*.62,tx+nx*hw+dx*w*.62,ty+ny*hw+dy*w*.62,tx+nx*hw,ty+ny*hw);
  g.lineTo(bx+nx*hw*1.05-dx*.03,by+ny*hw*1.05-dy*.03);g.closePath();
}
function makeFoot(p,f,Lp,legLen){
  const s=f.s,k=Lp*DPR,ky=k*SQ,ww=1.2+legLen*.25,hh=legLen+.12,[c,g]=mk(ww*k,hh*ky);
  const into=gg=>{gg.setTransform(k*s,0,0,ky,ww*k/2,.07*ky);};
  const yb=legLen;
  const skin=p.skin,dark=skin.map(v=>v*.55),light=mixc(skin,[255,240,228],.28);
  const silhouette=gg=>{gg.beginPath();footPath(gg,yb);gg.fill();for(let i=4;i>=0;i--){gg.beginPath();toePath(gg,toeGeom(i,f,p));gg.fill();}};
  into(g);
  // The leg and the top of the foot.
  g.fillStyle=rgb(skin);g.beginPath();footPath(g,yb);g.fill();
  g.save();g.beginPath();footPath(g,yb);g.clip();
  let gr=g.createLinearGradient(-.24,0,.24,0);gr.addColorStop(0,rgb(dark,.75));gr.addColorStop(.22,rgb(dark,0));gr.addColorStop(.62,rgb(light,.18));gr.addColorStop(.8,rgb(dark,0));gr.addColorStop(1,rgb(dark,.8));
  g.fillStyle=gr;g.fillRect(-.6,0,1.2,yb+1);
  gr=g.createLinearGradient(0,.2,0,yb);gr.addColorStop(0,rgb(light,.25));gr.addColorStop(.25/yb,rgb(light,0));gr.addColorStop(.85/yb,rgb(dark,.16));gr.addColorStop(1.3/yb,rgb(dark,.06));gr.addColorStop(1,rgb(dark,.2));
  g.fillStyle=gr;g.fillRect(-1,0,2,yb+1);
  // Tendons fanning from the toes to the front of the ankle, raised just enough to catch the light.
  for(let i=0;i<5;i++){const T=toeGeom(i,f,p),w=i?.012:.022,a=i?.025:.05;
    soft(g,.012*k,rgb(light,a),()=>{g.lineWidth=w;g.beginPath();g.moveTo(T.bx,T.by+.06);g.quadraticCurveTo(T.bx*.6,.62,-.01+i*.008,.98);g.stroke();});
    soft(g,.014*k,rgb(dark,a*.8),()=>{g.lineWidth=w*.8;g.beginPath();g.moveTo(T.bx+.02,T.by+.07);g.quadraticCurveTo(T.bx*.6+.02,.63,.01+i*.008,.98);g.stroke();});}
  // The knuckles of the foot behind the toes, the ankle bones, and a faint vein across the top.
  for(let i=0;i<5;i++){const T=toeGeom(i,f,p);soft(g,.03*k,rgb(light,.22),()=>{g.beginPath();g.ellipse(T.bx,T.by+.07,T.w*.42,.035,0,0,7);g.fill();});}
  soft(g,.035*k,rgb(light,.3),()=>{g.beginPath();g.ellipse(-.15,.9,.03,.05,0,0,7);g.ellipse(.155,.94,.028,.045,0,0,7);g.fill();});
  soft(g,.01*k,'rgba(60,70,110,.09)',()=>{g.lineWidth=.008;g.beginPath();g.moveTo(-.15,.66);g.bezierCurveTo(-.08,.55,.06,.54,.16,.62);g.stroke();});
  soft(g,.012*k,rgb(dark,.22),()=>{g.lineWidth=.006;for(let j=0;j<3;j++){g.beginPath();g.moveTo(-.12,1+j*.018);g.quadraticCurveTo(0,1.025+j*.018,.12,1+j*.018);g.stroke();}});
  // Leg hair grows down the shin, sparse on the top of the foot.
  g.lineCap='round';
  for(const[hx,hy,hl,hc,ha]of f.hairs){const x=hx*legHW(hy)/.3;g.strokeStyle=rgb(skin.map(v=>v*.22),ha);g.lineWidth=.0018;g.beginPath();g.moveTo(x,hy);g.quadraticCurveTo(x+hc*hl*.5,hy+hl*.5,x+hc*hl*.3,hy+hl);g.stroke();}
  g.restore();
  // Toes, little to big so each overlaps the next. Each has its own roundness, a crease, knuckle lines and a nail.
  for(let i=4;i>=0;i--){const T=toeGeom(i,f,p),{w,len,bx,by,dx,dy,nx,ny,tx,ty}=T;
    soft(g,.016*k,rgb(dark.map(v=>v*.5),.75),()=>{g.beginPath();toePath(g,T);g.fill();});
    g.save();g.beginPath();toePath(g,T);g.fillStyle=rgb(skin);g.fill();g.clip();
    let q=g.createLinearGradient(bx-nx*w*.6,by-ny*w*.6,bx+nx*w*.6,by+ny*w*.6);q.addColorStop(0,rgb(dark,.6));q.addColorStop(.35,rgb(light,.1));q.addColorStop(.6,rgb(light,.22));q.addColorStop(1,rgb(dark,.65));
    g.fillStyle=q;g.fillRect(-.6,-.2,1.2,.8);
    q=g.createLinearGradient(bx,by,tx+dx*w*.5,ty+dy*w*.5);q.addColorStop(0,rgb(dark,.45));q.addColorStop(.3,rgb(dark,0));q.addColorStop(.8,rgb(light,.15));q.addColorStop(1,rgb(light,.25));
    g.fillStyle=q;g.fillRect(-.6,-.2,1.2,.8);
    const kn=i?[.42,.62]:[.5];
    for(const fk of kn){const cx=bx+dx*len*(1-fk),cy=by+dy*len*(1-fk);g.strokeStyle=rgb(dark,.28);g.lineWidth=.004;g.beginPath();g.moveTo(cx-nx*w*.32,cy-ny*w*.32);g.quadraticCurveTo(cx-dx*.01,cy-dy*.01,cx+nx*w*.32,cy+ny*w*.32);g.stroke();
      g.strokeStyle=rgb(light,.18);g.beginPath();g.moveTo(cx-nx*w*.3+dx*.008,cy-ny*w*.3+dy*.008);g.quadraticCurveTo(cx+dx*.002,cy+dy*.002,cx+nx*w*.3+dx*.008,cy+ny*w*.3+dy*.008);g.stroke();}
    // The nail: curved, smooth, lighter than the skin, with a cuticle line and a glint where it faces the moon.
    const nl=len*(i?.34:.36),nw=w*(i?.66:.74),ncx=tx+dx*(w*.32-nl*.5),ncy=ty+dy*(w*.32-nl*.5);
    g.save();g.translate(ncx,ncy);g.rotate(T.a);
    const nailC=p.nails||mixc(skin,[236,206,196],.55);
    g.beginPath();g.ellipse(0,0,nw*.5,nl*.5,0,0,7);g.fillStyle=rgb(nailC);g.fill();
    g.clip();q=g.createLinearGradient(-nw*.5,0,nw*.5,0);q.addColorStop(0,rgb(nailC.map(v=>v*.62),.8));q.addColorStop(.4,'rgba(255,255,255,.12)');q.addColorStop(1,rgb(nailC.map(v=>v*.6),.85));
    g.fillStyle=q;g.fillRect(-nw,-nl,nw*2,nl*2);
    if(!p.nails){g.fillStyle='rgba(255,248,240,.35)';g.beginPath();g.ellipse(0,-nl*.5,nw*.5,nl*.13,0,0,7);g.fill();}
    g.strokeStyle=rgb(dark,.45);g.lineWidth=.004;g.beginPath();g.ellipse(0,nl*.08,nw*.5,nl*.5,0,.15*Math.PI,.85*Math.PI);g.stroke();
    g.fillStyle=p.nails?'rgba(255,255,255,.45)':'rgba(255,255,255,.3)';g.beginPath();g.ellipse(-nw*.12,-nl*.12,nw*.1,nl*.22,-.2,0,7);g.fill();
    g.restore();
    for(const[ti,fy,fx]of f.toeHairs)if(ti===(i?1:0)&&i<2){const cx=bx+dx*len*fy+nx*w*fx,cy=by+dy*len*fy+ny*w*fx;g.strokeStyle=rgb(skin.map(v=>v*.25),.5);g.lineWidth=.0025;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+.008,cy+.022);g.stroke();}
    g.restore();}
  // An anklet: a fine silver chain over the front of the ankle.
  if(p.anklet===s){for(let j=0;j<26;j++){const u=j/25,x=lerp(-.15,.15,u),y=1.0+Math.sin(u*Math.PI)*.035;g.fillStyle='rgba(30,30,36,.5)';g.beginPath();g.arc(x,y+.004,.007,0,7);g.fill();
    g.fillStyle='rgb(206,210,220)';g.beginPath();g.arc(x,y,.0065,0,7);g.fill();g.fillStyle='rgba(255,255,255,.8)';g.beginPath();g.arc(x-.002,y-.002,.002,0,7);g.fill();}}
  soft(g,.03*k,rgb(skin.map((v,i)=>i?v*.7:Math.min(255,v*1.1)),.25),()=>{g.lineWidth=.02;g.beginPath();footPath(g,1.04);g.stroke();});
  // Fine skin texture.
  g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-atop';
  const img=g.getImageData(0,0,c.width,c.height),D=img.data,ps=Math.max(1,Math.round(DPR));
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(!D[i+3])continue;const n=(h2(x/ps|0,y/ps|0,p.seed+s)-.5)*.07+(h2(x>>2,y>>2,p.seed+9)-.5)*.05;
    D[i]*=1+n;D[i+1]*=1+n;D[i+2]*=1+n;}
  g.putImageData(img,0,0);g.globalCompositeOperation='source-over';
  // Masks for the water: the silhouette, a soft ring around it for foam, a contact shadow, wet gloss and a band of sand for sinking in.
  const[m,mg]=mk(c.width,c.height);into(mg);mg.fillStyle='#fff';silhouette(mg);
  const[sh,shg]=mk(c.width,c.height);shg.shadowColor='rgba(0,0,0,.62)';shg.shadowBlur=.05*k;shg.shadowOffsetX=20000;shg.shadowOffsetY=.035*ky;shg.translate(-20000,0);shg.drawImage(m,0,0);
  shg.setTransform(1,0,0,1,0,0);shg.shadowColor='rgba(0,0,0,.75)';shg.shadowBlur=.016*k;shg.shadowOffsetY=.006*ky;shg.translate(-20000,0);shg.drawImage(m,0,0);
  const[rg,rgg]=mk(c.width,c.height);rgg.shadowColor='#fff';rgg.shadowBlur=.05*k;rgg.shadowOffsetX=20000;rgg.translate(-20000,0);for(let j=0;j<3;j++)rgg.drawImage(m,0,0);
  rgg.setTransform(1,0,0,1,0,0);rgg.shadowColor='transparent';rgg.globalCompositeOperation='destination-out';rgg.drawImage(m,0,0);
  const[gl,glg]=mk(c.width,c.height);into(glg);
  for(let i=0;i<5;i++){const T=toeGeom(i,f,p);soft(glg,.008*k,'rgba(255,255,255,.55)',()=>{glg.beginPath();glg.ellipse(T.tx-T.nx*T.w*.15,T.ty+.01,T.w*.12,T.len*.18,T.a,0,7);glg.fill();});}
  soft(glg,.06*k,'rgba(255,255,255,.18)',()=>{glg.beginPath();glg.ellipse(-.02,.42,.1,.16,0,0,7);glg.fill();});
  for(let j=0;j<14;j++){const x=(h2(j,1,p.seed+s)-.5)*.3,y=.25+h2(j,2,p.seed+s)*.7,r=.003+.004*h2(j,3,p.seed);soft(glg,r*2*k,'rgba(255,255,255,.35)',()=>{glg.beginPath();glg.arc(x,y,r,0,7);glg.fill();});}
  glg.setTransform(1,0,0,1,0,0);glg.globalCompositeOperation='destination-in';glg.drawImage(m,0,0);
  const[bu,bug]=mk(c.width,c.height);bug.drawImage(m,0,0);bug.globalCompositeOperation='destination-out';
  const[bl,blg]=mk(c.width,c.height);blg.shadowColor='#fff';blg.shadowBlur=.03*k;blg.shadowOffsetX=20000;blg.translate(-20000,0);blg.drawImage(m,0,0);blg.drawImage(m,0,0);
  bug.drawImage(bl,0,0);bug.globalCompositeOperation='source-in';bug.fillStyle=bug.createPattern(sandTiles.wet,'repeat');bug.fillRect(0,0,c.width,c.height);
  bug.globalCompositeOperation='destination-out';bug.fillRect(0,1.06*ky,c.width,c.height);
  // The foot without the leg, for the water that washes over the top of it.
  const[tp,tpg]=mk(c.width,c.height);tpg.drawImage(m,0,0);tpg.globalCompositeOperation='destination-out';
  const fade=tpg.createLinearGradient(0,.85*ky,0,1.08*ky);fade.addColorStop(0,'rgba(0,0,0,0)');fade.addColorStop(1,'#000');tpg.fillStyle=fade;tpg.fillRect(0,0,c.width,c.height);
  return{img:c,mask:m,top:tp,shadow:sh,ring:rg,gloss:gl,bury:bu,w:c.width,h:c.height,ox:ww*k/2,oy:.07*ky};
}

/* ---------- waves ---------- */
// A wave picks how far up the beach it runs: short of the toes, over the feet, or past them, with the tide nudging it.
// Its front is a set of lobes across the beach that rises fast, slows, holds and drains back.
function tideBias(){return(fbm(t*.0015+SEA.tideO)-.5)*.12+SEA.tide*Math.min(1,t/1800)*.06;}
function newWave(){
  const kind=wpick([['short',.42],['touch',.4],['past',.18]]);
  const reach=kind==='short'?toeY-CH*rr(.015,.14):kind==='touch'?lerp(toeY,ankleY,rr(.05,.95)):ankleY+CH*rr(.03,.25);
  const target=clamp(reach+tideBias()*CH*SEA.energy,SEA.y*CH+CH*.12,CH*1.15);
  const w={kind,t0:t,up:rr(2.4,3.8),hold:rr(.2,.7),down:rr(4,6.5),reach:target,
    a1:CH*rr(.01,.035),l1:rr(.6,1.4),p1:rr(0,6.3),a2:CH*rr(.006,.02),l2:rr(2.5,4.5),p2:rr(0,6.3),nO:rr(0,500),
    obl:rr(-.5,.5),lace:rr(.55,1),dense:rr(.7,1),stranded:false,touched:false,logged:false,max:null,clamsDone:false};
  w.max=new Float32Array(NX);waves.push(w);stats.waves++;
}
function phase(w,tt){const x=tt-w.t0;if(x<0)return[0,0];if(x<w.up){const k=x/w.up;return[1-Math.pow(1-k,2.3),0];}
  if(x<w.up+w.hold)return[1,1];const k=(x-w.up-w.hold)/w.down;return k>=1?[0,3]:[1-Math.pow(k,1.7)*(1-.15*Math.sin(k*Math.PI)),2];}
// Fills a wave's front, in screen y, at the sample points across the beach.
function waveFront(w,out){
  const sea=SEA.y*CH-CH*.12;let st=0;
  for(let i=0;i<NX;i++){const x=XS[i],u=x/CW,[p,s]=phase(w,t-w.obl*(u-.5));st=Math.max(st,s);
    const lobe=w.a1*Math.sin(u*Math.PI*2*w.l1+w.p1)+w.a2*Math.sin(u*Math.PI*2*w.l2+w.p2)+CH*.012*(noise(u*9+w.nO)-.5);
    out[i]=sea+(w.reach+lobe-sea)*p;}
  return st;
}
function frontAt(x){const i=clamp((x+20)/(CW+40)*(NX-1),0,NX-1),a=Math.floor(i),b=Math.min(NX-1,a+1);return lerp(FRONT[a],FRONT[b],i-a);}

/* ---------- events ---------- */
// Each kind of event waits its own exponentially distributed gap. m is the average gap in seconds, f the first wait.
const SCHED={crab:{m:140,f:35},cloud:{m:220,f:90},wiggle:{m:160,f:120},shell:{m:170,f:60}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
let nextWave=0;
const cm=px=>Math.max(1,Math.round(px/L*25));
const feetWord=()=>people.length>1?'all four feet':'both feet';
function fire(k){
  if(k==='crab'){const side=chance(.5)?-1:1,y=lerp(SEA.y*CH+CH*.18,toeY-L*.4,R());
    crabs.push({x:side<0?-L*.3:CW+L*.3,y,dir:-side,ang:0,s:L*rr(.1,.15),state:'walk',tx:CW*rr(.15,.85),ty:y,pause:0,gait:0,life:rr(10,24),col:mixc(SAND.a,[236,228,214],rr(.3,.6)),burrow:0});
    NightCity.log(`A ghost crab scuttles in from the ${side<0?'left':'right'}, keeping clear of the water`);}
  else if(k==='cloud'){if(brightTo<1)return;brightTo=rr(.5,.72);cloudEnd=t+rr(25,70);NightCity.log('A cloud slides over the moon and the beach goes dim');}
  else if(k==='wiggle'){const f=people[0].feet;if(Math.max(f[0].sink,f[1].sink)<.25)return;for(const p of people)for(const ft of p.feet)ft.sinkTo=0;NightCity.log('Toes wiggle free of the sand they had sunk into');}
  else if(k==='shell'){if(shells.length)return;shells.push({x:CW*rr(.12,.88),y:lerp(toeY-L*.6,toeY+L*.3,R()),a:rr(0,6.3),s:L*rr(.1,.16),hue:rr(0,1),age:0,gone:0,moving:0});
    NightCity.log('A wave leaves a shell behind on the wet sand');}
}
let cloudEnd=0;

/* ---------- update ---------- */
function update(dt){
  t+=dt;
  if(t>=nextWave){newWave();nextWave=t+(4.2+expo(4.8))/SEA.energy;}
  for(const k in SCHED){nextEv[k]-=dt;if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);fire(k);}}
  if(cloudEnd&&t>cloudEnd){brightTo=1;cloudEnd=0;NightCity.log('The cloud passes and the moonlight comes back');}
  bright+=(brightTo-bright)*ease(dt,6);
  // The water's edge right now: the furthest any wave reaches at each point, or the sea itself.
  const sea=SEA.y*CH;for(let i=0;i<NX;i++)FRONT[i]=sea+CH*.006*Math.sin(XS[i]*.01+t*.7);
  let lead=null,leadP=-1;
  for(const w of waves){if(!w.front)w.front=new Float32Array(NX);w.st=waveFront(w,w.front);
    for(let i=0;i<NX;i++){if(w.front[i]>FRONT[i])FRONT[i]=w.front[i];if(w.front[i]>w.max[i])w.max[i]=w.front[i];}
    const[p]=phase(w,t);if(w.st<2&&p>leadP){lead=w;leadP=p;}
    // When a wave turns back, its furthest line keeps a strand of foam, and the sand it leaves bubbles and sometimes stirs.
    if(w.st>=2&&!w.stranded){w.stranded=true;strands.push({pts:Float32Array.from(w.max),t0:t,life:rr(6,14)*w.lace});backwashLife(w);}
    if(w.st>=1&&!w.logged){w.logged=true;logWave(w);}}
  for(let i=waves.length-1;i>=0;i--)if(waves[i].st===3)waves.splice(i,1);
  for(let i=strands.length-1;i>=0;i--)if(t-strands[i].t0>strands[i].life)strands.splice(i,1);
  // The foam lace travels with the water: down with the uprush, back more slowly with the drain.
  const mid=frontAt(CW/2),d=mid-lastFront;lastFront=mid;foamOY+=d>0?d:d*.55;foamOX+=dt*3;
  // Feet: how much water is around each, which keeps them wet and slowly sinks them into the sand.
  for(const p of people)for(const f of p.feet){
    const fr=frontAt(f.px),depth=(fr-f.py)/L,moving=lead&&leadP<1?1:.4;
    f.cover+=(clamp(depth*1.6,0,1)*moving-f.cover)*ease(dt,.25);
    f.ring+=(clamp(depth*3,0,1)-f.ring)*ease(dt,.35);
    if(depth>.05){f.wet=1;if(!f.dunk){f.dunk=true;if(depth>.4)f.sinkTo=Math.min(.6,(f.sinkTo||f.sink)+rr(.04,.09));}}else if(depth<-.05)f.dunk=false;
    f.wet=Math.max(0,f.wet-dt/30);if(f.sinkTo!==undefined)f.sink+=(f.sinkTo-f.sink)*ease(dt,f.sinkTo<f.sink?1.2:3);}
  updateLife(dt);
  // Glints on the water where the moon catches the ripples.
  const n=dt*60*bright;for(let i=0;i<n;i++)if(chance(.6)){const x=CW*(SEA.gladeX+(R()+R()-1)*SEA.gladeW*1.4),y=R()*Math.min(frontAt(x),CH)-6;if(y>0)sparkles.push({x,y,life:rr(.12,.45),age:0,s:rr(.6,1.8)});}
  for(let i=0;i<n*.5;i++)if(chance(.5)){const x=CW*R(),f=frontAt(x),y=f+R()*(toeY+L-f);if(y>f+4)sparkles.push({x,y,life:rr(.08,.3),age:0,s:rr(.3,.8),sand:1});}
  for(let i=sparkles.length-1;i>=0;i--){const s=sparkles[i];s.age+=dt;if(s.age>s.life||(!s.sand&&s.y>frontAt(s.x)-3))sparkles.splice(i,1);}
  // The sand stays wet where water has been, and slowly dries.
  wtx.setTransform(WS,0,0,WS,0,0);wtx.fillStyle='#fff';waterPath(wtx);wtx.fill();
  wetT+=dt;if(wetT>1){wetT=0;wtx.setTransform(1,0,0,1,0,0);wtx.globalCompositeOperation='destination-out';wtx.fillStyle='rgba(0,0,0,.025)';wtx.fillRect(0,0,wet.width,wet.height);wtx.globalCompositeOperation='source-over';
    const gg=wtx.createLinearGradient(0,0,0,wet.height);gg.addColorStop(0,'rgba(255,255,255,1)');gg.addColorStop(.62,'rgba(255,255,255,.75)');gg.addColorStop(1,'rgba(255,255,255,.2)');
    wtx.fillStyle=gg;wtx.globalAlpha=.06;wtx.fillRect(0,0,wet.width,wet.height);wtx.globalAlpha=1;}
}
function logWave(w){
  let near=1e9,hit=0;for(const p of people)for(const f of p.feet){const g=frontAt(f.px)-f.py;near=Math.min(near,-g);if(g>0)hit++;}
  const mx=Math.max(...w.max);
  if(!hit){stats.short++;NightCity.log(pick([`A wave runs up and stops ${cm(near)} cm short of the toes`,`The water slides up and falls ${cm(near)} cm short`,`A wave stops a hand's width from the toes and slips back`].slice(0,near<L*.4?3:2)));}
  else{stats.reached++;const past=mx>ankleY+L*.15;
    NightCity.log(past?`A bigger wave runs past ${feetWord()} and up the beach`:hit>=2*people.length?pick([`A wave washes over ${feetWord()} and pulls back`,`Cold water swirls around ${feetWord()}`]):'A wave just reaches the toes of one foot');}
}
// After a wave drains: tiny holes where air escapes the sand, and sometimes coquina clams surface and dig back in.
function backwashLife(w){
  for(let i=0;i<ri(4,14);i++){const x=CW*R(),y=lerp(SEA.y*CH+CH*.2,frontAt(x),R());holes.push({x,y,r:L*rr(.004,.009),age:0,life:rr(8,30),bub:chance(.4)?rr(.2,2):0});}
  if(holes.length>140)holes.splice(0,holes.length-140);
  if(chance(.22)){const cx=CW*rr(.1,.9),cy=lerp(SEA.y*CH+CH*.25,Math.min(toeY,Math.max(...w.max))-L*.1,R());
    for(let i=ri(3,11);i>0;i--)clams.push({x:cx+rr(-L*.8,L*.8),y:cy+rr(-L*.3,L*.3),a:rr(0,6.3),s:L*rr(.04,.065),col:pick(COQ),age:-rr(0,1.2),life:rr(2.5,5)});
    NightCity.log('Coquina clams surface in the backwash and dig straight back in');}
  for(const s of shells)if(Math.max(...w.max)>s.y+s.s&&chance(.5))s.moving=1;
}
const COQ=[[236,190,200],[212,170,226],[244,222,150],[240,236,226],[230,170,120],[170,190,230]];
function updateLife(dt){
  for(let i=crabs.length-1;i>=0;i--){const c=crabs[i];c.life-=dt;
    const water=frontAt(c.x);const danger=water>c.y-c.s*3;
    if(c.state==='burrow'){c.burrow+=dt/1.5;if(c.burrow>=1){holes.push({x:c.x,y:c.y,r:c.s*.22,age:0,life:60,bub:0});crabs.splice(i,1);}continue;}
    if(danger){c.ty=Math.min(toeY-L*.3,c.y+L*.8);c.pause=0;}
    if(c.pause>0){c.pause-=dt;continue;}
    const dx=c.tx-c.x,dy=c.ty-c.y,dist=Math.hypot(dx,dy),sp=L*(danger?3.4:rr(1.6,2.4));
    if(dist<4){if(c.life<0){if(chance(.5))c.state='burrow';else{c.tx=c.x<CW/2?-L:CW+L;c.life=99;}}else{c.pause=chance(.7)?rr(.4,3):0;c.tx=clamp(c.x+rr(-1,1)*L*2.5,L*.3,CW-L*.3);c.ty=clamp(c.y+rr(-.5,.5)*L,SEA.y*CH+CH*.15,toeY-L*.3);}continue;}
    const step=Math.min(dist,sp*dt);c.x+=dx/dist*step;c.y+=dy/dist*step;c.gait+=step/(c.s*.35);
    // Crabs walk sideways, so the body turns side-on to where it's going.
    const want=Math.atan2(dy,dx)+Math.PI/2;let da=((want-c.ang+Math.PI*3)%(Math.PI*2))-Math.PI;if(Math.abs(da)>Math.PI/2)da=((want+Math.PI-c.ang+Math.PI*3)%(Math.PI*2))-Math.PI;c.ang+=da*ease(dt,.15);
    if(c.x<-L*2||c.x>CW+L*2)crabs.splice(i,1);}
  for(let i=clams.length-1;i>=0;i--){const c=clams[i];c.age+=dt;if(c.age>c.life)clams.splice(i,1);}
  for(let i=holes.length-1;i>=0;i--){const h=holes[i];h.age+=dt;if(h.age>h.life||frontAt(h.x)>h.y+5&&h.age>1)holes.splice(i,1);}
  for(let i=shells.length-1;i>=0;i--){const s=shells[i];s.age+=dt;if(s.moving){s.y-=L*.7*dt;s.a+=dt*1.5;s.gone+=dt/2.5;if(s.gone>=1){shells.splice(i,1);NightCity.log('The backwash rolls the shell back into the sea');}}}
}

/* ---------- drawing ---------- */
function waterPath(g){g.beginPath();g.moveTo(-40,-40);for(let i=0;i<NX;i++)g.lineTo(XS[i],FRONT[i]);g.lineTo(CW+40,-40);g.closePath();}
function bandPath(g,pts,w0,w1){g.beginPath();g.moveTo(XS[0],pts[0]);for(let i=1;i<NX;i++)g.lineTo(XS[i],pts[i]);for(let i=NX-1;i>=0;i--)g.lineTo(XS[i],pts[i]-lerp(w0,w1,i/(NX-1)));g.closePath();}
// Paints where the foam is, at low resolution so the edges come out soft. Dense foam rides the leading edge,
// lace spreads behind it, both thin as the wave slows and drains, and a strand stays on the line it reached.
function paintFoamMasks(){
  for(const[m,g]of[[mDense,mdx],[mSparse,msx]]){g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,m.width,m.height);g.setTransform(MS,0,0,MS,0,0);}
  msx.globalAlpha=.35;msx.fillStyle='#fff';bandPath(msx,FRONT.map(()=>SEA.y*CH+CH*.03),CH*.25,CH*.25);msx.fill();
  for(const w of waves){if(!w.front)continue;const[p,st]=phase(w,t);
    const up=st===0,k=up?1:Math.pow(Math.max(0,p),1.4);
    mdx.globalAlpha=w.dense*(up?1:.8*k);mdx.fillStyle='#fff';bandPath(mdx,w.front,CH*(up?.035+.05*(1-p):.02*k+.004),CH*(up?.03+.04*(1-p):.015*k+.004));mdx.fill();
    mdx.globalAlpha=Math.min(1,w.dense*1.2*(up?1:k));bandPath(mdx,w.front,CH*.007,CH*.007);mdx.fill();
    msx.globalAlpha=w.lace*(up?1:.85*k);bandPath(msx,w.front,CH*(.12+.18*p),CH*(.1+.16*p));msx.fill();}
  for(const s of strands){const a=1-(t-s.t0)/s.life;mdx.globalAlpha=.55*a*a;bandPath(mdx,s.pts,CH*.008,CH*.006);mdx.fill();msx.globalAlpha=.6*a;bandPath(msx,s.pts,CH*.03,CH*.025);msx.fill();}
  // Foam piles up around the feet while water runs past them.
  for(const p of people)for(const f of p.feet)if(f.ring>.02){mdx.globalAlpha=f.ring*.85;drawSprite(mdx,f,f.spr.ring);msx.globalAlpha=f.ring;drawSprite(msx,f,f.spr.ring);}
  mdx.globalAlpha=msx.globalAlpha=1;
}
function drawSprite(g,f,img){const S=f.spr;g.save();g.translate(f.px,f.py);g.rotate(f.rot);g.drawImage(img,0,0,S.w,S.h,-S.ox/DPR,-S.oy/DPR,S.w/DPR,S.h/DPR);g.restore();}
function foamPass(mask,pat,alpha,dx,dy){
  sx.setTransform(1,0,0,1,0,0);sx.globalCompositeOperation='copy';sx.drawImage(mask,0,0,W,H);
  sx.globalCompositeOperation='source-in';sx.fillStyle=pat;const ox=Math.round(foamOX*DPR),oy=Math.round(foamOY*DPR);sx.translate(ox,oy);sx.fillRect(-ox,-oy,W,H);
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=alpha;ctx.drawImage(scratch,Math.round(dx*DPR),Math.round(dy*DPR));ctx.globalAlpha=1;ctx.setTransform(DPR,0,0,DPR,0,0);
}
// The foam's leading edge: a bright, slightly ragged line on each wave while it's still running up.
function rim(){
  ctx.save();ctx.lineJoin='round';
  for(const w of waves){if(!w.front)continue;const[p,st]=phase(w,t);if(st>1)continue;const a=st===0?.7:.45;
    ctx.beginPath();for(let i=0;i<NX;i++){const y=w.front[i]-1.5+(noise(i*.7+w.nO)-.5)*3;i?ctx.lineTo(XS[i],y):ctx.moveTo(XS[i],y);}
    ctx.strokeStyle=`rgba(250,252,255,${a})`;ctx.lineWidth=2.2;ctx.shadowColor=`rgba(240,246,255,${a*.8})`;ctx.shadowBlur=6;ctx.stroke();void p;}
  ctx.restore();
}
function drawCrab(c){
  const s=c.s,bur=c.burrow;ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.ang);ctx.globalAlpha=1-bur*.9;const sc=1-bur*.4;ctx.scale(sc,sc);
  ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(s*.05,s*.18,s*.75,s*.5,0,0,7);ctx.fill();
  const col=c.col,dk=col.map(v=>v*.62);ctx.strokeStyle=rgb(dk);ctx.lineCap='round';
  for(const side of[-1,1])for(let i=0;i<4;i++){const ph=Math.sin(c.gait+i*1.6+(side>0?Math.PI:0))*.35,y0=-s*.12+i*s*.14,a=side*(1.2+i*.22+ph);
    const kx=side*s*.42,j1x=kx+Math.sin(a)*s*.42,j1y=y0-Math.cos(a)*s*.42*.4+s*.12,j2x=j1x+side*s*.32,j2y=j1y+s*.28;
    ctx.lineWidth=s*.07;ctx.beginPath();ctx.moveTo(kx,y0);ctx.lineTo(j1x,j1y);ctx.stroke();ctx.lineWidth=s*.05;ctx.beginPath();ctx.moveTo(j1x,j1y);ctx.lineTo(j2x,j2y);ctx.stroke();}
  for(const side of[-1,1]){const big=side>0?1.25:1;ctx.fillStyle=rgb(col);ctx.lineWidth=s*.08;ctx.strokeStyle=rgb(dk);ctx.beginPath();ctx.moveTo(side*s*.3,-s*.35);ctx.lineTo(side*s*.42,-s*.6);ctx.stroke();
    ctx.beginPath();ctx.ellipse(side*s*.4,-s*.66,s*.14*big,s*.1*big,side*.4,0,7);ctx.fill();}
  ctx.fillStyle=rgb(col);ctx.beginPath();ctx.moveTo(-s*.46,-s*.36);ctx.lineTo(s*.46,-s*.36);ctx.quadraticCurveTo(s*.52,s*.1,s*.32,s*.38);ctx.quadraticCurveTo(0,s*.46,-s*.32,s*.38);ctx.quadraticCurveTo(-s*.52,s*.1,-s*.46,-s*.36);ctx.fill();
  const gr=ctx.createRadialGradient(-s*.1,-s*.1,0,0,0,s*.55);gr.addColorStop(0,'rgba(255,255,255,.25)');gr.addColorStop(1,rgb(dk,.35));ctx.fillStyle=gr;ctx.fill();
  ctx.fillStyle='#141414';for(const side of[-1,1]){ctx.beginPath();ctx.ellipse(side*s*.36,-s*.38,s*.07,s*.1,0,0,7);ctx.fill();}
  ctx.restore();
}
function drawShell(x,y,a,s,col,ribs){ctx.save();ctx.translate(x,y);ctx.rotate(a);
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(s*.04,s*.08,s*.52,s*.46,0,0,7);ctx.fill();
  ctx.beginPath();ctx.moveTo(0,s*.45);ctx.bezierCurveTo(-s*.62,s*.2,-s*.55,-s*.5,0,-s*.5);ctx.bezierCurveTo(s*.55,-s*.5,s*.62,s*.2,0,s*.45);ctx.fillStyle=rgb(col);ctx.fill();ctx.save();ctx.clip();
  ctx.strokeStyle=rgb(col.map(v=>v*.7),.7);ctx.lineWidth=s*.035;for(let i=0;i<ribs;i++){const an=-1.25+i/(ribs-1)*2.5;ctx.beginPath();ctx.moveTo(0,s*.45);ctx.lineTo(Math.sin(an)*s*.8,s*.45-Math.cos(an)*s);ctx.stroke();}
  const gr=ctx.createRadialGradient(-s*.15,-s*.2,0,0,0,s*.6);gr.addColorStop(0,'rgba(255,255,255,.35)');gr.addColorStop(1,'rgba(0,0,0,.25)');ctx.fillStyle=gr;ctx.fillRect(-s,-s,2*s,2*s);ctx.restore();ctx.restore();}
function draw(){
  // Sand, then the wet sand wherever water has been.
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='copy';ctx.drawImage(baseDry,0,0);
  sx.setTransform(1,0,0,1,0,0);sx.globalCompositeOperation='copy';sx.drawImage(wet,0,0,W,H);sx.globalCompositeOperation='source-in';sx.drawImage(baseWet,0,0);
  ctx.globalCompositeOperation='source-over';ctx.drawImage(scratch,0,0);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  // Things on the sand: air holes, a shell, clams, crabs.
  for(const h of holes){const a=Math.min(1,h.age*2)*(1-h.age/h.life);ctx.fillStyle=`rgba(20,16,12,${.5*a})`;ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,7);ctx.fill();ctx.strokeStyle=`rgba(255,255,255,${.12*a})`;ctx.lineWidth=h.r*.4;ctx.beginPath();ctx.arc(h.x,h.y-h.r*.2,h.r*1.1,3.6,5.8);ctx.stroke();
    if(h.bub&&h.age<h.bub+.6&&h.age>h.bub){const k=(h.age-h.bub)/.6;ctx.strokeStyle=`rgba(255,255,255,${.5*(1-k)})`;ctx.lineWidth=.8;ctx.beginPath();ctx.arc(h.x,h.y,h.r*(1+k*2),0,7);ctx.stroke();}}
  for(const s of shells){ctx.globalAlpha=1-s.gone;drawShell(s.x,s.y,s.a,s.s,mixc([236,224,206],[214,150,120],s.hue),14);ctx.globalAlpha=1;}
  for(const c of clams){const k=c.age<0?0:c.age<.3?c.age/.3:c.age>c.life-1?(c.life-c.age):1;if(k<=0)continue;
    ctx.fillStyle=`rgba(120,108,92,${.35*k})`;ctx.beginPath();ctx.arc(c.x,c.y,c.s*.9,0,7);ctx.fill();ctx.globalAlpha=k;drawShell(c.x,c.y,c.a+c.age*.6,c.s*(.6+.4*k),c.col,7);ctx.globalAlpha=1;}
  for(const c of crabs)drawCrab(c);
  // The water: the sand seen through it, deepening toward the sea, and the moon's path on the surface.
  const fm=FRONT.reduce((a,b)=>a+b,0)/NX;
  ctx.save();waterPath(ctx);ctx.clip();
  ctx.drawImage(baseWet,0,0,W,H,Math.sin(t*1.3)*.8,Math.sin(t*.9)*1.5,CW,CH);
  const tg=ctx.createLinearGradient(0,0,0,Math.max(fm,SEA.y*CH+40));tg.addColorStop(0,'rgba(20,34,42,.9)');tg.addColorStop(clamp(SEA.y*CH/Math.max(fm,1),0,.9),'rgba(30,48,56,.6)');tg.addColorStop(1,'rgba(48,66,72,.16)');
  ctx.fillStyle=tg;ctx.fillRect(0,0,CW,CH);
  ctx.save();ctx.translate(0,(t*14)%RIP_S);ctx.fillStyle=ripPat;ctx.globalAlpha=.55;ctx.fillRect(0,-RIP_S,CW,CH+RIP_S);ctx.restore();
  ctx.globalCompositeOperation='screen';ctx.globalAlpha=.4*bright;ctx.drawImage(glade,0,0,CW,CH);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.restore();
  ctx.globalCompositeOperation='screen';ctx.globalAlpha=.08*bright;ctx.drawImage(glade,0,0,CW,CH);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  // Foam: lace, then the dense foam on top.
  paintFoamMasks();foamPass(mSparse,patSparseD,.35,1.5,3);foamPass(mDense,patDenseD,.4,1.5,3);foamPass(mSparse,patSparse,1,0,0);foamPass(mDense,patDense,1,0,0);rim();
  // Feet: a shadow on the sand, the feet, sand creeping over them, water running over the toes, and the wet sheen it leaves.
  for(const p of people)for(const f of p.feet){ctx.globalAlpha=1-.4*f.ring;drawSprite(ctx,f,f.spr.shadow);ctx.globalAlpha=1;}
  for(const p of people)for(const f of p.feet){
    drawSprite(ctx,f,f.spr.img);
    if(f.sink>.01){ctx.globalAlpha=Math.min(1,f.sink*1.6);drawSprite(ctx,f,f.spr.bury);ctx.globalAlpha=1;}
    if(f.wet>.01){ctx.globalAlpha=f.wet*.55;drawSprite(ctx,f,f.spr.gloss);ctx.globalAlpha=1;}
    if(f.cover>.01){const S=f.spr;fsx.setTransform(1,0,0,1,0,0);fsx.globalCompositeOperation='copy';fsx.drawImage(S.top,0,0);fsx.globalCompositeOperation='source-in';
      fsx.fillStyle='rgba(40,58,66,.5)';fsx.fillRect(0,0,S.w,S.h);
      ctx.save();waterPath(ctx);ctx.clip();ctx.globalAlpha=f.cover*.3;drawSprite(ctx,f,fscr);ctx.restore();ctx.globalAlpha=1;}}
  // Moonlight over everything, dimmer when a cloud passes.
  ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='saturation';ctx.globalAlpha=.38;ctx.fillStyle='#808080';ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;
  ctx.globalCompositeOperation='multiply';const mb=MOON_B*bright;ctx.fillStyle=rgb(MOON.c.map(v=>Math.min(255,v*mb*1.18)));ctx.fillRect(0,0,W,H);
  ctx.globalCompositeOperation='lighter';ctx.setTransform(DPR,0,0,DPR,0,0);
  for(const s of sparkles){const k=Math.sin(Math.PI*s.age/s.life);ctx.globalAlpha=k*.9*bright;ctx.drawImage(SPARK,s.x-s.s*3,s.y-s.s*3,s.s*6,s.s*6);}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.drawImage(vig,0,0,CW,CH);
  if(++grainT>2){grainT=0;gox=Math.floor(R()*160);goy=Math.floor(R()*160);}
  ctx.setTransform(1,0,0,1,-gox,-goy);ctx.fillStyle=grainPat;ctx.globalAlpha=.32;ctx.fillRect(gox,goy,W,H);ctx.globalAlpha=1;ctx.setTransform(1,0,0,1,0,0);
}
// Ripples: streaky light and dark bands on the water, drifting toward the shore.
const RIP_S=256,RIPPLE=(()=>{const S=RIP_S,[c,g]=mk(S,S),img=g.createImageData(S,S),d=img.data,T=ptable(3,8),T2=ptable(6,20);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const u=x/S,v=y/S,n=(pn(T,u*3,v*8)-.5)*.7+(pn(T2,u*6,v*20)-.5)*.5,i=(y*S+x)*4;d[i]=d[i+1]=d[i+2]=n>0?255:0;d[i+3]=Math.min(255,Math.abs(n)*140);}
  g.putImageData(img,0,0);return c;})();
const ripPat=ctx.createPattern(RIPPLE,'repeat');
const SPARK=(()=>{const[c,g]=mk(24,24),rg=g.createRadialGradient(12,12,0,12,12,12);rg.addColorStop(0,'rgba(255,255,255,1)');rg.addColorStop(.2,'rgba(220,232,255,.6)');rg.addColorStop(1,'rgba(200,220,255,0)');g.fillStyle=rg;g.fillRect(0,0,24,24);return c;})();
const GRAIN=(()=>{const S=160,[c,g]=mk(S,S),img=g.createImageData(S,S),d=img.data;for(let i=0;i<d.length;i+=4){const v=R()-.5;d[i]=d[i+1]=d[i+2]=v>0?255:0;d[i+3]=Math.abs(v)*2*36;}g.putImageData(img,0,0);return c;})();
const grainPat=ctx.createPattern(GRAIN,'repeat');

/* ---------- build ---------- */
function build(){
  CW=Math.max(240,innerWidth);CH=Math.max(240,innerHeight);
  DPR=LOWQ?.75:Math.min(2,devicePixelRatio||1);
  const maxPx=LOWQ?1e6:3.6e6;if(CW*CH*DPR*DPR>maxPx)DPR=Math.sqrt(maxPx/(CW*CH));
  W=cv.width=Math.round(CW*DPR);H=cv.height=Math.round(CH*DPR);
  U=clamp(Math.min(CW,CH)/800,.7,1.4);
  L=Math.min(CH*.25,CW*.42)*(people.length>1?.92:1);
  toeY=CH*.6;ankleY=toeY+L*.95;
  for(let i=0;i<NX;i++)XS[i]=-20+i*(CW+40)/(NX-1);
  // Textures at device resolution, so a grain of sand or a bubble stays about a pixel.
  const ts=Math.round(512*Math.max(1,DPR*.8));
  if(!sandTiles||sandTiles.S!==ts){sandTiles=makeSand(ts);sandTiles.S=ts;}
  const cell=Math.round(26*U*DPR);
  if(!foamTiles||foamTiles.cell!==cell)foamTiles=makeFoam(ts,cell);
  // Base sand: the tile, broad light and dark patches, faint rhomboid marks from old backwash, and a sheen on the wet version.
  const[lv,lg]=mk(CW/6,CH/6),li=lg.createImageData(lv.width,lv.height),LD=li.data;
  for(let y=0;y<lv.height;y++)for(let x=0;x<lv.width;x++){const u=x/lv.width*CW/400,v=y/lv.height*CH/400,n=fbm(u*1.3+3.1+v*7.7)*.5+noise(v*2.1+u*.7+40)*.5-.5;
    const rh=Math.abs(Math.sin((u+v*.6)*24))*Math.abs(Math.sin((u-v*.6)*24));const a=n*.5+(rh>.92?-.05:0),i=(y*lv.width+x)*4;
    LD[i]=LD[i+1]=LD[i+2]=a>0?255:0;LD[i+3]=Math.min(255,Math.abs(a)*255*.6);}
  lg.putImageData(li,0,0);
  let g;[baseDry,g]=mk(W,H);g.fillStyle=g.createPattern(sandTiles.dry,'repeat');g.fillRect(0,0,W,H);g.drawImage(lv,0,0,W,H);
  [baseWet,g]=mk(W,H);g.fillStyle=g.createPattern(sandTiles.wet,'repeat');g.fillRect(0,0,W,H);g.drawImage(lv,0,0,W,H);
  const sg=g.createLinearGradient(0,0,0,H);sg.addColorStop(0,'rgba(200,214,232,.22)');sg.addColorStop(.6,'rgba(200,214,232,.06)');sg.addColorStop(1,'rgba(200,214,232,0)');
  g.globalCompositeOperation='screen';g.fillStyle=sg;g.fillRect(0,0,W,H);g.globalCompositeOperation='source-over';
  glade=makeGlade();
  [wet,wtx]=mk(CW*WS,CH*WS);{const gg=wtx.createLinearGradient(0,0,0,wet.height);gg.addColorStop(0,'#fff');gg.addColorStop(clamp(SEA.y+.3,0,1),'rgba(255,255,255,.6)');gg.addColorStop(1,'rgba(255,255,255,.12)');wtx.fillStyle=gg;wtx.fillRect(0,0,wet.width,wet.height);}
  [mDense,mdx]=mk(CW*MS,CH*MS);[mSparse,msx]=mk(CW*MS,CH*MS);[scratch,sx]=mk(W,H);
  patDense=sx.createPattern(foamTiles.dense,'repeat');patSparse=sx.createPattern(foamTiles.sparse,'repeat');patDenseD=sx.createPattern(foamTiles.denseD,'repeat');patSparseD=sx.createPattern(foamTiles.sparseD,'repeat');
  // Feet: each person's pair around their spot, toes slightly out, legs running down out of the frame.
  let maxW=0,maxH=0;
  people.forEach((p,pi)=>{const Lp=L*p.size,cx=people.length>1?CW/2+(pi?p.side:-people[1].side)*Math.min(CW*.2,L*1.05):CW/2,ty=toeY+(p.back||0)*L,rot=p.rot||0;
    p.feet.forEach(f=>{const off=f.s*(.21+p.spread*.5)*Lp;
      f.px=cx+Math.cos(rot)*off;f.py=ty+Math.sin(rot)*off+(f.s>0?.02:-.01)*Lp;
      // Each leg points at the viewer, below the bottom of the frame, and the toes turn out a little from it.
      const camX=cx+f.s*Lp*.2,camY=CH*2.6,ax=f.px,ay=f.py+.9*Lp*SQ;
      f.rot=Math.atan2(-(camX-ax),camY-ay);
      const legLen=(CH-f.py)/Math.max(.5,Math.cos(f.rot))/Lp/SQ+.4;f.spr=makeFoot(p,f,Lp,legLen);
      maxW=Math.max(maxW,f.spr.w);maxH=Math.max(maxH,f.spr.h);});});
  [fscr,fsx]=mk(maxW,maxH);
  let vg;[vig,vg]=mk(CW/4,CH/4);const vr=vg.createRadialGradient(vig.width/2,vig.height*.55,Math.min(vig.width,vig.height)*.25,vig.width/2,vig.height*.55,Math.hypot(vig.width,vig.height)*.6);
  vr.addColorStop(0,'rgba(0,0,0,0)');vr.addColorStop(1,'rgba(0,0,0,.55)');vg.fillStyle=vr;vg.fillRect(0,0,vig.width,vig.height);
}

/* ---------- start ---------- */
if(DEBUG)window.SH={get tiles(){return foamTiles;},makeFoam,get sand(){return sandTiles;},waves,people,crabs,clams,shells,stats,fire,newWave,get t(){return t;},get paused(){return NightCity.paused;},set paused(v){NightCity.paused=v;},
  draw:()=>draw(),step:dt=>update(dt),run(sec){for(let i=0;i<sec*60;i++)update(1/60);draw();NightCity.refresh();}};
build();
// Start a little way into the night, mid-swash, so the first frame already has water and foam on the sand.
for(let i=0;i<30*14;i++)update(1/30);
stats.waves=stats.reached=stats.short=0;
NightCity.log(`${MOON.name[0].toUpperCase()+MOON.name.slice(1)} moonlight on ${SAND.name} sand. ${people.length>1?'Two pairs':'A pair'} of bare feet at the water's edge`);
NightCity.run({step:1/60,update,draw,ui:()=>NightCity.stats(stats)});
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{build();lastFront=frontAt(CW/2);draw();},200);});
})();
