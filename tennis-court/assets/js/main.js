/* Tennis Court: a singles match under the floodlights at night, on grass, clay or a hard court, in isometric view.
   Every choice comes from one generator seeded with the moment the page opens. The ball flies with drag and spin,
   bounces the way the night's surface makes it and clips the net cord. Each shot is aimed, not decided: the hitter picks a target, a pace and
   a spin, and an error that grows with pressure and difficulty decides where it really goes. The rules then judge
   what the ball did, so no two points, games or matches play the same way. */
(()=>{
'use strict';
const cv=document.getElementById('scene');
let ctx=cv.getContext('2d');
// Seed, frame loop, embed mode and overlay come from the shared runtime, ../assets/js/nightcity.js.
// ?speed=8 runs the simulation faster, which helps when checking how matches play out.
const{RM,LOWQ,DEBUG,R,rr,ri,pick,chance,expo,gauss,wpick,noise,fbm,sfc32,cyrb128,seed:SEED_STR}=NightCity;

/* ---------- helpers ---------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,u)=>a+(b-a)*u;
const hyp=Math.hypot;
const cap=s=>s[0].toUpperCase()+s.slice(1);
const ease=u=>u*u*(3-2*u);

/* ---------- court geometry, in metres ----------
   x runs across the court, z along it with the net at z=0, h is height. An ITF singles court with the doubles
   alleys painted, on a club lawn fenced in on all four sides. */
const CT={L:11.885,S:4.115,D:5.485,SV:6.4,post:6.4};
const NET={c:.914,p:1.07};
const netH=x=>{const u=Math.min(1,Math.abs(x)/CT.post);return NET.c+(NET.p-NET.c)*u*u;};
const FENCE={x:8.6,z:17.4,h:3.6,gap:.62,screen:1.8};
const BR=.0335,G=9.81,DRAG=.0204,MAG=.009;
const CHAIR={x:7.25,z:[-1.25,1.25],h:.46};
const UMP={x:-7.15,z:0,h:1.85};
const inCourt=(x,z)=>Math.abs(x)<=CT.S+BR&&Math.abs(z)<=CT.L+BR;
// How far outside the singles court a bounce landed, in metres. Negative means in.
const outBy=(x,z)=>Math.max(Math.abs(x)-CT.S-BR,Math.abs(z)-CT.L-BR);
// A serve from the end with sign e, from the deuce (sd=1) or ad (sd=-1) side, must land in the box diagonally across.
const boxOut=(x,z,e,sd)=>Math.max(-x*-e*sd-BR,x*-e*sd-CT.S-BR,z*e-BR,-z*e-CT.SV-BR);
const mph=v=>Math.round(v*3.6)+' km/h';

/* ---------- palettes ---------- */
/* Three surfaces, each with its own look and its own bounce. ev is how much height a bounce keeps and eh how much
   pace, kick is how much more topspin adds to both, roll is how fast a rolling ball stops, bad is how much worn
   spots throw the ball off line, and net is how much the surface rewards coming in.
   Grass is fast and low, clay slow and high, hard courts in between and true. */
const SURFACES={
  grass:{kind:'grass',ev:.71,eh:.8,kick:.06,roll:2,bad:1,net:1.15,looks:[
    {name:'fresh grass',a:'#2f6d38',b:'#3a7d40',wear:.25,line:'#f2f4ec'},
    {name:'midseason grass',a:'#2c6634',b:'#37763c',wear:.55,line:'#eef0e6'},
    {name:'worn grass',a:'#2e6233',b:'#3a713a',wear:.9,line:'#ecece0'},
    {name:'deep green grass',a:'#285f34',b:'#317040',wear:.4,line:'#f0f2ea'}]},
  clay:{kind:'clay',ev:.79,eh:.66,kick:.1,roll:3,bad:.4,net:.6,looks:[
    {name:'red clay',a:'#b4532d',b:'#a54a28',wear:.5,line:'#efe8dc'},
    {name:'dark red clay',a:'#9a4427',b:'#8c3d23',wear:.7,line:'#ebe2d4'},
    {name:'fresh red clay',a:'#c25e33',b:'#b3552e',wear:.3,line:'#f2ece2'},
    {name:'green clay',a:'#5c7a5a',b:'#536f51',wear:.5,line:'#eef0e8'}]},
  hard:{kind:'hard',ev:.75,eh:.73,kick:.07,roll:1.3,bad:0,net:.9,looks:[
    {name:'blue hard court',a:'#2b5a92',b:'#24497a',out:'#2e6a52',wear:.5,line:'#f4f6fa'},
    {name:'blue hard court',a:'#2a5890',b:'#1f3d66',out:'#1f3d66',wear:.4,line:'#f4f6fa'},
    {name:'green hard court',a:'#2f6e4c',b:'#285f42',out:'#7a3b33',wear:.6,line:'#f4f6f2'},
    {name:'green hard court',a:'#3a7a54',b:'#2f6646',out:'#264f3a',wear:.5,line:'#f4f6f2'},
    {name:'purple hard court',a:'#4b3d7c',b:'#3e3268',out:'#2a5a6a',wear:.4,line:'#f4f2fa'}]}
};
const SKIN=['#f1c9a5','#e0ac7e','#c68a5e','#a0673f','#7a4a2a','#5a3420'];
const HAIR=['#1a1410','#2e2018','#5a3a1e','#8a5a2a','#d8b060','#cfcfd8','#14100e'];
const COATS=[['black','#1c1b27','#1c1b27'],['orange','#c8742f','#e3a160'],['grey','#6c7084','#8d91a6'],['white','#d6d4de','#eeeef4'],['tabby','#8a6a48','#a8875e'],['tuxedo','#1c1b27','#e4e4ec']];
// ?debug&clay (or grass, hard) forces a surface, after the draw so the rest of the night stays the same.
const SURF_PICK=wpick([['grass',1.1],['clay',1],['hard',.9]]);
const SURF=SURFACES[(DEBUG&&['grass','clay','hard'].find(s=>new URLSearchParams(location.search).has(s)))||SURF_PICK];
const COURT=pick(SURF.looks);
const STRIPE=rr(1.05,1.6);

/* ---------- helpers ---------- */
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return[c,c.getContext('2d')];}
function hex(c){const n=parseInt(c.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
function shade(c,f){const v=hex(c).map(x=>f<0?x*(1+f):x+(255-x)*f);return'#'+v.map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('');}
function hueOf(c){const[r,g,b]=hex(c).map(v=>v/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx===mn)return 0;let h=mx===r?60*((g-b)/(mx-mn)):mx===g?60*((b-r)/(mx-mn)+2):60*((r-g)/(mx-mn)+4);return(h+360)%360;}
function hsv(h,s,v){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;const[r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return[(r+m)*255,(g+m)*255,(b+m)*255].map(Math.round);}
const toHex=a=>'#'+a.map(v=>v.toString(16).padStart(2,'0')).join('');

/* ---------- event log ---------- */
// Each entry also gets a signature from its type, first words and numbers, which counts how many distinct things happened.
let t=0;
const seen=new Set();const stats={events:0,points:0,shots:0,aces:0,longest:0};
let scoreDirty=true;const scoreEl=document.getElementById('score');
function log(type,text,params){
  const sig=type+'|'+text.split(' ').slice(0,3).join(' ')+'|'+JSON.stringify(params||{},(k,v)=>typeof v==='number'?+v.toFixed(2):v);
  stats.events++;seen.add(sig);
  NightCity.log(text);
}

/* ---------- players ----------
   Outfits are drawn fresh each night around a neon accent colour, which also names the player. Some nights the
   club asks for whites, and the accent shows only in the trim. */
const TRIMS=[['cyan','#38d8ff'],['blue','#3b7bff'],['red','#ff3b4f'],['orange','#ff8a3d'],['pink','#ff4fa3'],['lime','#8be05a'],['violet','#a06bff'],['yellow','#f2c83a']];
const WHITES=chance(.4);
const HAIRDOS=['short','buzz','curly','bun','long','fade','ponytail'];
// plain: everyday clothes for passersby, with no neon and no tennis kit.
function mkLook(tr,plain){
  const[name,col]=tr,h=hueOf(col);
  const top=plain?wpick([['hoodie',1.2],['tee',2],['jacket',2]]):wpick([['polo',2.4],['tee',2],['tank',1.2],['dress',.8]]);
  const kitCol=WHITES?'#eceee6':pick([toHex(hsv(h,.7,.6)),'#eceee6','#16161e',toHex(hsv(h,.3,.12)),toHex(hsv(h,.25,.3))]);
  const topCol=plain?pick(['#4a4068','#2f5a4e','#6a3440','#34405a','#5a4a32','#3c3e4a','#7a6a52','#1c1b27','#8a8a96']):kitCol;
  const bottom=plain?'pants':top==='dress'?'skirt':wpick([['shorts',3],['skirt',1]]);
  const botCol=plain?pick(['#1c1b27','#2a2f4a','#3a3a4a','#4a3e32','#3a4a5a']):top==='dress'?topCol:WHITES?'#eceee6':pick(['#16161e','#eceee6',toHex(hsv(h,.6,.45)),toHex(hsv(h,.3,.15))]);
  const light=hex(topCol).reduce((a,b)=>a+b,0)>420;
  const hairdo=pick(HAIRDOS);
  return{name:cap(name),col,white:false,hue:h,trim:plain?null:[col,toHex(hsv((h+28)%360,.85,1))],
    top,topCol,hood:plain&&top==='hoodie'&&chance(.4)?'up':plain&&top==='hoodie'?'down':null,bottom,botCol,
    socks:plain?null:pick(['#f2f2f5','#f2f2f5',col]),
    shoes:plain?pick(['#e8ecff','#1c1b27','#6a4a32','#8a8a96']):pick(['#f2f2f5','#f2f2f5','#1a1b24',col]),
    sole:plain?'#c8c8d0':pick(['#e8ecff',col]),
    skin:pick(SKIN),hairCol:pick(HAIR),hairdo,
    headwear:plain?wpick([[null,4],['cap',1]]):wpick([[null,2],['cap',1.2],['visor',.8],['headband',1.2],['bandana',.5]]),capBack:chance(.35),
    shades:null,beard:plain||chance(.6)?null:pick(['goatee','full']),
    wrist:!plain&&chance(.6)?pick([col,'#f2f2f5','#16161e']):null,
    racket:pick(['#16161e','#e8ecff',col,toHex(hsv(h,.5,.35)),'#c8c8d0']),
    number:null,numCol:light?col:'#e8ecff',neck:null,avatarURL:null};
}
function pickTrims(){
  const a=pick(TRIMS);let b=pick(TRIMS),n=0;
  const far=(x,y)=>Math.min(Math.abs(hueOf(x[1])-hueOf(y[1])),360-Math.abs(hueOf(x[1])-hueOf(y[1])))>70;
  while((b===a||!far(a,b))&&n++<50)b=pick(TRIMS);
  return[a,b];
}
const TEAM=pickTrims(),LOOKS=[mkLook(TEAM[0]),mkLook(TEAM[1])];
function mkPlayer(id,look){
  const p={id,name:look.name,col:look.col,look,
    hgt:rr(1.68,1.98),speed:rr(5.2,7),react:rr(.12,.24),power:rr(.35,.95),control:rr(.35,.82),serve:rr(.3,.9),
    net:rr(.1,.9),spin:rr(.2,.9),slice:rr(.1,.8),touch:rr(.2,.85),nerve:rr(.2,.9),temper:rr(0,1),
    hand:chance(.12)?-1:1,two:chance(.62),bounceN:ri(2,5),hops:rr(.35,.6),
    x:0,z:0,vx:0,vz:0,face:0,j:0,jv:0,air:false,crouch:0,gait:rr(0,6),fatigue:0,conf:0,
    arm:'carry',sw:null,plan:null,planAt:0,tgt:null,pose:null,sit:false,act:'idle',actT:0,balls:0,dhand:1,tie:0,
    path:null,lunge:0,mood:0,moodArm:null};
  p.reach=p.hgt*1.33;
  return p;
}
const players=[mkPlayer(0,LOOKS[0]),mkPlayer(1,LOOKS[1])];
const other=p=>players[1-p.id];
function describe(p){
  const tr=[p.hgt.toFixed(2)+' m'];
  if(p.speed>6.4)tr.push('quick');
  if(p.serve>.75)tr.push('a big serve');
  if(p.power>.8)tr.push('heavy hitter');
  if(p.control>.78)tr.push('steady');
  if(p.net>.68)tr.push('likes the net');
  else if(p.net<.25)tr.push('stays back');
  if(p.slice>.65)tr.push('loves the slice');
  if(p.touch>.72)tr.push('soft hands');
  tr.push(p.two?'two-handed backhand':'one-handed backhand');
  if(p.hand<0)tr.push('left-handed');
  return p.name+': '+tr.join(', ');
}

/* ---------- the match ----------
   Best of three sets, a tiebreak at six games all. end[i] is the sign of z on player i's side of the net. */
const match={sets:[],games:[0,0],pts:[0,0],tb:false,tbFirst:0,server:ri(0,1),end:chance(.5)?[1,-1]:[-1,1],
  phase:'between',phaseT:0,serveNo:1,matches:1,sitNext:false,changeNext:false,setFirst:0,rest:0,next:null};
match.setFirst=match.server;
// The point being played: who hit last, how many times the ball has bounced since, and the shots in the rally.
const rally={last:null,bounces:0,shots:0,serve:false,over:false,winner:null,how:'',lastShot:null,cord:false,side:0};
// Balls: the one in play, plus any lying around the court or flying back to the server between points.
const ball={x:0,z:0,h:BR,vx:0,vz:0,vh:0,s:0,spin:0,held:null,live:false,trail:[]};
const loose=[];

/* ---------- world drawing state ----------
   The canvas runs at full device resolution. Static parts are drawn once per resize as real geometry,
   in metres, through isometric transforms, so lines stay smooth at any size. */
let W=0,H=0,DPR=1,k=10,kh=8,ox=0,oy=0,horizon=-1;
let floorC=null,fenceC=null,marksC=null;
// Clay keeps a record: every bounce leaves a ball mark and every slide a streak, until the lines are swept between sets.
const MARKS=[];let marksA=1;
const LIGHTS=[{x:-10.4,z:-15,h:10,I:1,mode:null,until:0},{x:10.4,z:-15,h:10,I:1,mode:null,until:0},{x:-10.4,z:15,h:10,I:1,mode:null,until:0},{x:-10.4,z:0,h:10,I:1,mode:null,until:0}];
const sx=(x,z)=>ox+(x-z)*k;
const sy=(x,z,h)=>oy+(x+z)*k*.5-(h||0)*kh;
const P3=(x,z,h)=>[sx(x,z),sy(x,z,h)];
let blinkers=[];
// Under these transforms, canvas units are metres: on the ground at height h, or on a vertical plane.
const toGround=(g,h)=>g.setTransform(k,k*.5,-k,k*.5,ox,oy-(h||0)*kh);
const toPlaneZ=(g,z)=>g.setTransform(k,k*.5,0,-kh,ox-z*k,oy+z*k*.5);
const toPlaneX=(g,x)=>g.setTransform(-k,k*.5,0,-kh,ox+x*k,oy+x*k*.5);
const reset=g=>g.setTransform(1,0,0,1,0,0);
const poolOf=L=>({x:L.x*.55,z:L.z*.55});
// Wear behind each baseline and, more faintly, where serves and volleys land. On grass and clay, worn spots bounce less true.
const WEAR=[];
for(const e of[1,-1]){
  WEAR.push({x:rr(-.5,.5),z:e*(CT.L+rr(.4,.9)),rx:.9+2.4*COURT.wear,rz:.8+.7*COURT.wear,a:.85*COURT.wear});
  WEAR.push({x:rr(-.4,.4),z:e*(CT.L-rr(.6,1.4)),rx:.5+1.6*COURT.wear,rz:.5+.5*COURT.wear,a:.45*COURT.wear});
  WEAR.push({x:0,z:e*rr(4.5,6.2),rx:.6+.8*COURT.wear,rz:.5,a:.25*COURT.wear});
}
const wearAt=(x,z)=>{let w=0;for(const p of WEAR){const d=((x-p.x)/p.rx)**2+((z-p.z)/p.rz)**2;if(d<1)w=Math.max(w,p.a*(1-d));}return w;};

function build(){
  DPR=LOWQ?1:Math.min(2,devicePixelRatio||1);
  W=Math.max(320,Math.round(innerWidth*DPR));H=Math.max(240,Math.round(innerHeight*DPR));
  cv.width=W;cv.height=H;ctx.imageSmoothingEnabled=true;
  // Frame the court and a little of the run-off. On narrow screens the far corners of the lawn crop, never the court.
  const pts=[[-7,-14.6,0],[7,-14.6,0],[-7,14.6,0],[7,14.6,0],[0,-12.4,3.4],[-8.6,-17.4,1.5]];
  let a=1e9,b=-1e9,c=1e9,d=-1e9;
  for(const[x,z,h]of pts){const X=x-z,Y=(x+z)*.5-h*.82;a=Math.min(a,X);b=Math.max(b,X);c=Math.min(c,Y);d=Math.max(d,Y);}
  k=Math.min(H*.92/(d-c),W*.97/36);kh=k*.82;
  ox=W/2-(a+b)/2*k;oy=H*.53-(c+d)/2*k;
  horizon=Math.round(oy-17.6*k);
  blinkers=[];
  paintFloor();paintFence();paintMarks();
}

function noiseCanvas(T,n,alpha){const[c,g]=mk(n,n);const img=g.createImageData(n,n);for(let i=0;i<img.data.length;i+=4){const v=T()*255;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=alpha;}g.putImageData(img,0,0);return c;}
function pick2(T,a){return a[Math.floor(T()*a.length)];}
function paintFloor(){
  const[c,g]=mk(W,H);floorC=c;
  // A separate generator for textures, so a resize repaints the same lawn without touching the match's randomness.
  const T=sfc32(...cyrb128(SEED_STR+'/lawn'));const tr=(a,b)=>a+(b-a)*T();
  const top=Math.max(0,horizon);
  if(horizon>0){
    const sg=g.createLinearGradient(0,0,0,horizon);sg.addColorStop(0,'#03030c');sg.addColorStop(.65,'#0e0c28');sg.addColorStop(1,'#2a1838');
    g.fillStyle=sg;g.fillRect(0,0,W,horizon+2);
    for(let i=0;i<140;i++){g.globalAlpha=tr(.15,.7);g.fillStyle='#fff';const s=tr(.6,1.5)*DPR;g.fillRect(tr(0,W),tr(0,horizon*.75),s,s);}
    g.globalAlpha=1;
    for(const layer of [{col:'#1a1636',hmax:.85,win:.12,a:.55},{col:'#0b0a1c',hmax:.62,win:.22,a:1}]){
      for(let x=-20;x<W;){
        const w=tr(26,110)*DPR,h=tr(.18,layer.hmax)*horizon;
        g.globalAlpha=layer.a;g.fillStyle=layer.col;g.fillRect(x,horizon-h,w,h+2);
        for(let wy=horizon-h+5*DPR;wy<horizon-3*DPR;wy+=5*DPR)for(let wx=x+3*DPR;wx<x+w-4*DPR;wx+=5*DPR)if(T()<layer.win){g.fillStyle=pick2(T,['#ffd27a','#ffbf66','#cfe2ff','#ffe3a6','#ff9ad0']);g.globalAlpha=layer.a*tr(.35,.9);g.fillRect(wx,wy,2*DPR,2.4*DPR);}
        if(layer.a===1&&h>horizon*.42&&T()<.4)blinkers.push({x:x+w/2,y:horizon-h-6*DPR,per:tr(1.4,2.6),ph:tr(0,9)});
        x+=w+tr(0,8)*DPR;
      }
    }
    g.globalAlpha=1;
    const hg=g.createLinearGradient(0,horizon-40*DPR,0,horizon+6*DPR);hg.addColorStop(0,'rgba(255,120,170,0)');hg.addColorStop(1,'rgba(255,140,120,.16)');g.fillStyle=hg;g.fillRect(0,horizon-40*DPR,W,46*DPR);
  }
  // The ground outside the fence, a path and a row of trees beyond the two far fences.
  const gg=g.createLinearGradient(0,top,0,H);gg.addColorStop(0,'#08100c');gg.addColorStop(1,'#040806');g.fillStyle=gg;g.fillRect(0,top,W,H-top);
  toGround(g);
  g.fillStyle='#1c1f25';g.fillRect(-24,-FENCE.z-1.6,48,1.6);g.fillRect(-FENCE.x-1.6,-FENCE.z-1.6,1.6,44);
  // Floodlight spills through the fence onto the path outside.
  {const a=g.createLinearGradient(0,-FENCE.z-1.6,0,-FENCE.z);a.addColorStop(0,'rgba(255,225,185,0)');a.addColorStop(1,'rgba(255,225,185,.07)');g.fillStyle=a;g.fillRect(-24,-FENCE.z-1.6,48,1.6);
   const b=g.createLinearGradient(-FENCE.x-1.6,0,-FENCE.x,0);b.addColorStop(0,'rgba(255,225,185,0)');b.addColorStop(1,'rgba(255,225,185,.07)');g.fillStyle=b;g.fillRect(-FENCE.x-1.6,-FENCE.z-1.6,1.6,44);}
  reset(g);
  const tree=(x,z,s)=>{for(let i=0;i<5;i++){const p=P3(x+tr(-.6,.6)*s,z+tr(-.6,.6)*s,tr(2,5.5)*s);g.fillStyle=pick2(T,['#08130d','#0a1710','#06100a','#0c1a12']);g.beginPath();g.ellipse(p[0],p[1],tr(1.2,2)*s*k,tr(1,1.6)*s*k*.9,0,0,Math.PI*2);g.fill();}};
  for(let x=-22;x<20;x+=tr(2.6,4.4))tree(x,-FENCE.z-tr(3.4,5),tr(.8,1.3));
  for(let z=-FENCE.z;z<26;z+=tr(2.6,4.4))tree(-FENCE.x-tr(3.4,5),z,tr(.8,1.3));
  paintSurface(g,T,tr);
  // A low concrete kerb where the court meets the path on the two near sides.
  g.fillStyle='#1a2420';g.fillRect(FENCE.x,-FENCE.z,.22,FENCE.z*2+.22);g.fillRect(-FENCE.x,FENCE.z,FENCE.x*2,.22);
  g.fillStyle='rgba(0,0,0,.25)';g.fillRect(FENCE.x-.3,-FENCE.z,.3,FENCE.z*2);g.fillRect(-FENCE.x,FENCE.z-.3,FENCE.x*2,.3);
  // Court lines. The baselines are twice as wide as the rest.
  toGround(g);
  g.strokeStyle=COURT.line;g.globalAlpha=.9;g.lineCap='butt';
  g.lineWidth=.05;
  g.strokeRect(-CT.D,-CT.L,CT.D*2,CT.L*2);
  g.beginPath();
  for(const s of[1,-1]){g.moveTo(s*CT.S,-CT.L);g.lineTo(s*CT.S,CT.L);g.moveTo(-CT.S,s*CT.SV);g.lineTo(CT.S,s*CT.SV);}
  g.moveTo(0,-CT.SV);g.lineTo(0,CT.SV);
  g.moveTo(0,-CT.L);g.lineTo(0,-CT.L+.1);g.moveTo(0,CT.L);g.lineTo(0,CT.L-.1);
  g.stroke();
  g.lineWidth=.1;g.beginPath();g.moveTo(-CT.D,-CT.L+.05);g.lineTo(CT.D,-CT.L+.05);g.moveTo(-CT.D,CT.L-.05);g.lineTo(CT.D,CT.L-.05);g.stroke();
  // Where the grass is worn through, the paint is too. On clay, loose clay drifts over the tapes.
  g.globalAlpha=1;
  const dust=SURF.kind==='grass'?'96,80,50':hex(COURT.a).join(',');
  if(SURF.kind!=='hard')for(const w of WEAR)if(Math.abs(w.z)>CT.L){const wg=g.createRadialGradient(w.x,Math.sign(w.z)*CT.L,0,w.x,Math.sign(w.z)*CT.L,w.rx*.6);wg.addColorStop(0,`rgba(${dust},${(w.a*.6).toFixed(3)})`);wg.addColorStop(1,`rgba(${dust},0)`);g.fillStyle=wg;g.fillRect(w.x-w.rx,Math.sign(w.z)*CT.L-.3,w.rx*2,.6);}
  // The net's shadow, faint through the mesh with the tape darker, thrown away from each floodlight.
  for(const L of LIGHTS){
    const sh=(x,h)=>{const u=h/(L.h-h);return[x+(x-L.x)*u,-L.z*u];};
    g.fillStyle='rgba(0,8,0,.08)';g.beginPath();g.moveTo(-CT.post,0);
    for(let x=-CT.post;x<=CT.post+.01;x+=.8){const p=sh(x,netH(x));g.lineTo(p[0],p[1]);}
    g.lineTo(CT.post,0);g.closePath();g.fill();
    g.strokeStyle='rgba(0,8,0,.14)';g.lineWidth=.06;g.beginPath();for(let x=-CT.post,i=0;x<=CT.post+.01;x+=.8,i++){const p=sh(x,netH(x));if(i)g.lineTo(p[0],p[1]);else g.moveTo(p[0],p[1]);}g.stroke();
  }
  // Floodlight pools: warm light added on top, strongest toward the middle of the court.
  g.globalCompositeOperation='lighter';
  for(const L of LIGHTS){const p=poolOf(L);const lg=g.createRadialGradient(p.x,p.z,0,p.x,p.z,15);lg.addColorStop(0,'rgba(255,230,190,.16)');lg.addColorStop(.55,'rgba(255,220,180,.06)');lg.addColorStop(1,'rgba(255,220,180,0)');g.fillStyle=lg;g.fillRect(p.x-16,p.z-16,32,32);}
  g.globalCompositeOperation='source-over';
  reset(g);
  // A soft vignette pulls the eye to the court.
  const vg=g.createRadialGradient(sx(0,0),sy(0,0),Math.min(W,H)*.3,sx(0,0),sy(0,0),Math.max(W,H)*.8);vg.addColorStop(0,'rgba(0,0,6,0)');vg.addColorStop(1,'rgba(0,0,6,.6)');g.fillStyle=vg;g.fillRect(0,0,W,H);
}

// The playing surface: a lawn mown in stripes, brushed clay, or a painted hard court, each worn in its own way
// where players run most.
function paintSurface(g,T,tr){
  const S=SURF.kind,X=FENCE.x,Z=FENCE.z;
  toGround(g);
  if(S==='hard'){g.fillStyle=COURT.out;g.fillRect(-X,-Z,X*2,Z*2);g.fillStyle=COURT.a;g.fillRect(-CT.D-1.2,-CT.L-2.6,(CT.D+1.2)*2,(CT.L+2.6)*2);}
  else{g.fillStyle=COURT.a;g.fillRect(-X,-Z,X*2,Z*2);}
  if(S==='grass'){g.fillStyle=COURT.b;for(let z=-Z,i=0;z<Z;z+=STRIPE,i++)if(i%2)g.fillRect(-X,z,X*2,STRIPE);}
  reset(g);g.save();
  toGround(g);g.beginPath();g.rect(-X,-Z,X*2,Z*2);reset(g);g.clip();
  g.globalCompositeOperation='overlay';g.globalAlpha=S==='hard'?.07:.1;g.fillStyle=g.createPattern(noiseCanvas(T,96,255),'repeat');g.fillRect(0,0,W,H);
  g.globalCompositeOperation='source-over';g.globalAlpha=1;
  const dots=Math.min(26000,Math.round(W*H/90));
  if(S==='grass'){
    // Blades of grass, a few pixels each, lighter and darker than the stripe under them.
    g.lineWidth=Math.max(1,.6*DPR);
    for(let i=0;i<dots;i++){const[px,py]=P3(tr(-X,X),tr(-Z,Z),0),l=tr(.6,1.8)*DPR;g.strokeStyle=T()<.5?'rgba(150,210,120,.12)':'rgba(0,20,0,.16)';g.beginPath();g.moveTo(px,py);g.lineTo(px+tr(-.6,.6)*DPR,py-l);g.stroke();}
  }else if(S==='clay'){
    // The drag mat leaves faint sweeping arcs, and loose grains lie everywhere.
    toGround(g);g.lineWidth=.4;
    for(let i=0;i<30;i++){const cx=tr(-12,12),cz=tr(-20,20),r=tr(3,9),a=tr(0,6.3);g.strokeStyle=T()<.5?'rgba(255,210,170,.05)':'rgba(60,20,5,.06)';g.beginPath();g.arc(cx,cz,r,a,a+tr(1,2.5));g.stroke();}
    reset(g);
    for(let i=0;i<dots;i++){const[px,py]=P3(tr(-X,X),tr(-Z,Z),0);g.fillStyle=T()<.5?'rgba(255,215,180,.16)':'rgba(50,15,5,.18)';g.fillRect(px,py,DPR,DPR);}
  }
  // Wear: bare earth on grass, scuffed and smeared clay, or black rubber streaks and a polished sheen on hard courts.
  toGround(g);
  for(const w of WEAR){
    for(let i=0;i<34;i++){
      const a=tr(0,Math.PI*2),r=Math.sqrt(T()),x=w.x+Math.cos(a)*r*w.rx,z=w.z+Math.sin(a)*r*w.rz,sz=tr(.15,.55)*Math.min(w.rx,w.rz+.4),al=w.a*(1-r*.7);
      if(S==='hard'){
        g.strokeStyle=`rgba(8,8,12,${(al*tr(.15,.35)).toFixed(3)})`;g.lineWidth=tr(.02,.05);g.lineCap='round';const d=tr(0,Math.PI*2),l=tr(.15,.5);g.beginPath();g.moveTo(x,z);g.quadraticCurveTo(x+Math.cos(d)*l*.5+tr(-.05,.05),z+Math.sin(d)*l*.5,x+Math.cos(d)*l,z+Math.sin(d)*l);g.stroke();
        continue;
      }
      const col=S==='grass'?'98,90,62':T()<.55?'240,170,120':'70,25,10',m=S==='grass'?.7:T()<.55?.3:.22;
      const wg=g.createRadialGradient(x,z,0,x,z,sz);wg.addColorStop(0,`rgba(${col},${(al*m).toFixed(3)})`);wg.addColorStop(1,`rgba(${col},0)`);g.fillStyle=wg;g.fillRect(x-sz,z-sz,2*sz,2*sz);
    }
    if(S==='hard'){const wg=g.createRadialGradient(w.x,w.z,0,w.x,w.z,w.rx);wg.addColorStop(0,`rgba(255,255,255,${(w.a*.06).toFixed(3)})`);wg.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=wg;g.fillRect(w.x-w.rx,w.z-w.rx,w.rx*2,w.rx*2);}
  }
  g.restore();
}

function drawMark(g,m){
  toGround(g);
  if(m.k==='ball'){g.save();g.translate(m.x,m.z);g.rotate(m.a);g.fillStyle='rgba(60,20,8,.32)';g.beginPath();g.ellipse(0,0,m.l,.035,0,0,Math.PI*2);g.fill();g.strokeStyle='rgba(255,215,185,.16)';g.lineWidth=.012;g.stroke();g.restore();}
  else{g.strokeStyle='rgba(255,210,175,.13)';g.lineWidth=.09;g.lineCap='round';g.beginPath();g.moveTo(m.x,m.z);g.lineTo(m.x1,m.z1);g.stroke();g.strokeStyle='rgba(60,20,8,.12)';g.lineWidth=.03;g.stroke();}
  reset(g);
}
function paintMarks(){const[c,g]=mk(W,H);marksC=c;for(const m of MARKS)drawMark(g,m);}
function addMark(m){if(SURF.kind!=='clay')return;MARKS.push(m);if(MARKS.length>700){MARKS.splice(0,200);paintMarks();}else drawMark(marksC.getContext('2d'),m);}

function paintFence(){
  const[c,g]=mk(W,H);fenceC=c;
  const FH=FENCE.h,SC=FENCE.screen,SB=FENCE.gap;
  g.lineCap='round';
  // Chain-link mesh with a dark green windscreen hung across it, clear of the ground, on the two far sides.
  const mesh=len=>{g.beginPath();for(let u=-FH;u<len;u+=.1){g.moveTo(u,0);g.lineTo(u+FH,FH);g.moveTo(u+FH,0);g.lineTo(u,FH);}};
  const side=(plane,a0,a1)=>{
    g.save();plane(g);g.beginPath();g.rect(a0,0,a1-a0,FH);g.clip();
    g.save();g.translate(a0,0);mesh(a1-a0);g.strokeStyle='rgba(150,170,180,.2)';g.lineWidth=.012;g.stroke();g.restore();
    const sg=g.createLinearGradient(0,SB,0,SC);sg.addColorStop(0,'#0b1d14');sg.addColorStop(1,'#14301f');g.fillStyle=sg;g.globalAlpha=.94;g.fillRect(a0,SB,a1-a0,SC-SB);
    // Slack in the windscreen between the posts.
    g.globalAlpha=.25;g.strokeStyle='#000';g.lineWidth=.02;for(let u=a0+1.45;u<a1;u+=2.9){g.beginPath();g.moveTo(u-.5,SC-.15);g.quadraticCurveTo(u,(SB+SC)/2,u+.5,SC-.15);g.stroke();}
    g.globalAlpha=.5;g.fillStyle='#2a4a34';g.fillRect(a0,SC-.05,a1-a0,.05);g.fillRect(a0,SB,a1-a0,.04);
    g.restore();
  };
  side(g=>toPlaneZ(g,-FENCE.z),-FENCE.x,FENCE.x);
  side(g=>toPlaneX(g,-FENCE.x),-FENCE.z,FENCE.z);
  const post=(a,b)=>{g.strokeStyle='#3a4250';g.lineWidth=.06*k;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();g.strokeStyle='rgba(200,220,255,.16)';g.lineWidth=.02*k;g.beginPath();g.moveTo(a[0]-.015*k,a[1]);g.lineTo(b[0]-.015*k,b[1]);g.stroke();};
  for(let x=-FENCE.x;x<=FENCE.x+.01;x+=FENCE.x/3)post(P3(x,-FENCE.z,0),P3(x,-FENCE.z,FH));
  for(let z=-FENCE.z+FENCE.z/6;z<=FENCE.z+.01;z+=FENCE.z/6)post(P3(-FENCE.x,z,0),P3(-FENCE.x,z,FH));
  post(P3(-FENCE.x,-FENCE.z,FH),P3(FENCE.x,-FENCE.z,FH));post(P3(-FENCE.x,-FENCE.z,FH),P3(-FENCE.x,FENCE.z,FH));
  // Floodlight poles just outside the fence.
  for(const L of LIGHTS){
    const a=P3(L.x,L.z,0),b=P3(L.x,L.z,L.h);
    const pg=g.createLinearGradient(a[0]-.1*k,0,a[0]+.1*k,0);pg.addColorStop(0,'#1c1b2a');pg.addColorStop(.4,'#4a4a62');pg.addColorStop(1,'#16151f');
    g.strokeStyle=pg;g.lineWidth=.18*k;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();
  }
}

/* ---------- ball physics ----------
   Drag slows the ball and spin bends it: topspin dips, slice floats. Grass is fast and low, so the ball skids through
   with most of its pace, and the worn patches bounce less true. */
let wind=0,windT=0;
// The flight forces alone, for any ball state b.
function fly(b,dt){
  const v=hyp(b.vx,b.vz,b.vh),vxz=hyp(b.vx,b.vz)||1e-6,ux=b.vx/vxz,uz=b.vz/vxz,m=MAG*b.s*v;
  b.vx+=(-DRAG*v*b.vx+m*b.vh*ux+wind*.12)*dt;
  b.vz+=(-DRAG*v*b.vz+m*b.vh*uz)*dt;
  b.vh+=(-G-DRAG*v*b.vh-m*vxz)*dt;
  b.x+=b.vx*dt;b.z+=b.vz*dt;b.h+=b.vh*dt;
}
// One step with everything the ball can hit: the net, the grass and the fences. avg uses mean values instead of
// random ones, so players can read where the ball is going without drawing numbers from the generator.
function ballStep(b,dt,avg){
  const pz=b.z,ph=b.h;fly(b,dt);let ev='';
  if((pz<0)!==(b.z<0)&&Math.abs(b.x)<CT.post){
    const u=pz/(pz-b.z),hc=ph+(b.h-ph)*u,nh=netH(b.x);
    if(hc-BR<nh){
      if(hc>nh-BR*.5){
        // The tape: it trickles over or drops back.
        const over=hc>nh+BR*.3||(avg?hc>nh:chance(clamp((hc-nh)/BR*.5+.5,.15,.85)));
        if(over){b.vz*=avg?.45:rr(.2,.65);b.vh=Math.abs(b.vh)*.25+(avg?.7:rr(.1,1.5));b.vx*=.8;b.h=nh+BR;}
        else{b.z=pz<0?-BR:BR;b.vz=-b.vz*.06;b.vh=Math.abs(b.vh)*.2+(avg?.4:rr(0,.9));b.vx*=.5;b.h=nh;}
        ev='cord';
      }else{b.z=pz<0?-BR*1.5:BR*1.5;b.vz=-b.vz*.05;b.vx*=.3;b.vh=Math.min(b.vh,0)*.3;ev='net';}
    }
  }
  if(b.h<BR){
    if(b.vh<-.5){
      const w=wearAt(b.x,b.z)*SURF.bad;
      const e=(avg?SURF.ev:SURF.ev+rr(-.04,.04))+SURF.kick*b.s-(avg?0:w*rr(0,.14));
      b.vh=-b.vh*Math.max(.4,e);
      const f=SURF.eh+SURF.kick*.8*b.s;b.vx*=f;b.vz*=f;
      b.bad=0;if(!avg&&w>.2){const kx=gauss()*w*.5;b.vx+=kx;b.bad=Math.abs(kx);}
      b.s*=.4;b.h=BR;b.rolling=false;ev=ev||'bounce';
    }else{if(!b.rolling){b.rolling=true;ev=ev||'roll';}b.h=BR;b.vh=0;b.s=0;const sp=hyp(b.vx,b.vz),dec=SURF.roll*dt,f=sp>dec?(sp-dec)/sp:0;b.vx*=f;b.vz*=f;}
  }
  if(Math.abs(b.x)>FENCE.x-BR){b.x=Math.sign(b.x)*(FENCE.x-BR);b.vx=-b.vx*.15;b.vz*=.4;b.vh*=.5;ev=ev||'fence';}
  if(Math.abs(b.z)>FENCE.z-BR){b.z=Math.sign(b.z)*(FENCE.z-BR);b.vz=-b.vz*.15;b.vx*=.4;b.vh*=.5;ev=ev||'fence';}
  return ev;
}
// Where the ball in play will be over the next T seconds: one sample every 1/120 s, with its bounce count so far.
function predict(T){
  const b={x:ball.x,z:ball.z,h:ball.h,vx:ball.vx,vz:ball.vz,vh:ball.vh,s:ball.s},out=[];let n=0,net=false;
  for(let tt=1/120;tt<T;tt+=1/120){
    for(let i=0;i<2;i++){const e=ballStep(b,1/240,true);if(e==='bounce'||e==='roll')n++;if(e==='net')net=true;}
    out.push({t:t+tt,x:b.x,z:b.z,h:b.h,vh:b.vh,n,net});
    if(n>=2)break;
  }
  return out;
}

/* ---------- aiming ----------
   A shot fired from c along (ux,uz) at elevation th and speed v with spin s: where it first comes down,
   how far it clears the net, and how long it takes. */
function flight(c,ux,uz,v,th,s){
  const b={x:c[0],z:c[1],h:c[2],vx:ux*v*Math.cos(th),vz:uz*v*Math.cos(th),vh:v*Math.sin(th),s};
  let clear=null,tt=0;
  for(let i=0;i<1400;i++){
    const pz=b.z,ph=b.h;fly(b,1/200);tt+=1/200;
    if(clear===null&&(pz<0)!==(b.z<0)){const u=pz/(pz-b.z);clear=ph+(b.h-ph)*u-netH(b.x)-BR;}
    if(b.h<=BR)break;
  }
  return{x:b.x,z:b.z,d:hyp(b.x-c[0],b.z-c[1]),clear:clear===null?-9:clear,t:tt};
}
// The elevation that lands a shot of speed v on the target, found by bisection.
function solveAngle(c,tg,v,s){
  const dx=tg[0]-c[0],dz=tg[1]-c[1],D=hyp(dx,dz)||1,ux=dx/D,uz=dz/D;
  let lo=-.45,hi=.7;
  if(flight(c,ux,uz,v,hi,s).d<D)return{fail:'slow'};
  if(flight(c,ux,uz,v,lo,s).d>D)return{fail:'fast'};
  for(let i=0;i<20;i++){const m=(lo+hi)/2;if(flight(c,ux,uz,v,m,s).d<D)lo=m;else hi=m;}
  const th=(lo+hi)/2;return{th,v,ux,uz,f:flight(c,ux,uz,v,th,s)};
}
// The speed that lands a shot of elevation th on the target: lobs and drop shots.
function solveSpeed(c,tg,th,s){
  const dx=tg[0]-c[0],dz=tg[1]-c[1],D=hyp(dx,dz)||1,ux=dx/D,uz=dz/D;
  let lo=1.5,hi=60;
  if(flight(c,ux,uz,hi,th,s).d<D)return{fail:'slow'};
  for(let i=0;i<20;i++){const m=(lo+hi)/2;if(flight(c,ux,uz,m,th,s).d<D)lo=m;else hi=m;}
  const v=(lo+hi)/2;return{th,v,ux,uz,f:flight(c,ux,uz,v,th,s)};
}
const AIM={sig:1.85,side:.7,depth:.9,pace:.4};
// Strike the ball from c toward the shot's target. The ideal stroke is solved first, adjusted until it clears the
// net, then the error spreads it: sideways, in depth and in pace.
function strike(c,sh){
  let sol=null,v=sh.v,th=sh.th;
  for(let i=0;i<10;i++){
    sol=sh.arc?solveSpeed(c,sh.tg,th,sh.s):solveAngle(c,sh.tg,v,sh.s);
    if(sol.fail==='slow'){if(sh.arc)th=Math.min(1.1,th+.08);else v*=1.12;continue;}
    if(sol.fail==='fast'){v*=.88;continue;}
    if(sol.f.clear<sh.clear){if(sh.arc)th+=.06;else v*=.9;continue;}
    break;
  }
  if(!sol||sol.fail){const dx=sh.tg[0]-c[0],dz=sh.tg[1]-c[1],D=hyp(dx,dz)||1;sol={th:.12,v,ux:dx/D,uz:dz/D};}
  const sig=sh.sig*AIM.sig;
  const a=Math.atan2(sol.uz,sol.ux)+gauss()*sig*AIM.side,e=sol.th+(gauss()-(sh.low||0))*sig*AIM.depth,sp=sol.v*(1+gauss()*sig*AIM.pace);
  ball.held=null;ball.live=true;ball.x=c[0];ball.z=c[1];ball.h=c[2];
  ball.vx=Math.cos(a)*sp*Math.cos(e);ball.vz=Math.sin(a)*sp*Math.cos(e);ball.vh=sp*Math.sin(e);ball.s=sh.s;
  return sp;
}

/* ---------- scoring ----------
   Points, games and sets, called the way players call them: the server's score first. */
const CALL=['love','15','30','40'];
const endOf=p=>match.end[p.id];
function server(){return players[match.server];}
function receiver(){return other(server());}
// The deuce court is the server's right, so it's the side when an even number of points has been played.
function serveSide(){return(match.pts[0]+match.pts[1])%2===0?1:-1;}
function scoreCall(){
  const s=match.server,a=match.pts[s],b=match.pts[1-s];
  if(match.tb)return`${a}-${b}`;
  if(a>=3&&b>=3){if(a===b)return'Deuce';return`Advantage ${players[a>b?s:1-s].name}`;}
  if(a===b)return CALL[a]+' all';
  return CALL[a]+'-'+CALL[b];
}
// Who is close to winning what, for the log and for nerves.
function stakes(){
  const s=match.server,r=1-s,P=match.pts,G=match.games;
  const gp=i=>match.tb?P[i]>=6&&P[i]>P[1-i]:P[i]>=3&&P[i]>P[1-i];
  const sp=i=>gp(i)&&(match.tb||(G[i]>=5&&G[i]>G[1-i])||(G[i]===6&&G[1-i]===5));
  const won=i=>match.sets.filter(x=>x[i]>x[1-i]).length;
  const mp=i=>sp(i)&&won(i)===1;
  for(const i of[r,s]){
    if(mp(i))return{who:i,what:'Match point'};
    if(sp(i))return{who:i,what:'Set point'};
    if(gp(i)&&i===r&&!match.tb)return{who:i,what:'Break point'};
  }
  return null;
}
function pressure(p){const st=stakes();return st?(st.who===p.id?.5:1):(match.pts[0]>=3&&match.pts[1]>=3?.4:0);}
function setsLine(w){return match.sets.map(x=>x[w]+'-'+x[1-w]).join(' ');}
// Award the point, then see whether it wins a game, a set or the match.
function awardPoint(w,how){
  const l=1-w,P=match.pts,G=match.games;
  stats.points++;scoreDirty=true;
  stats.longest=Math.max(stats.longest,rally.shots);
  players[w].conf=clamp(players[w].conf+.08,-1,1);players[l].conf=clamp(players[l].conf-.06,-1,1);
  P[w]++;
  const tbOver=match.tb&&P[w]>=7&&P[w]-P[l]>=2,gameOver=!match.tb&&P[w]>=4&&P[w]-P[l]>=2;
  const tail=rally.shots>=12?` after a ${rally.shots}-shot rally`:'';
  if(!tbOver&&!gameOver){
    log('point',`${how}${tail}. ${scoreCall()}`,{w});
    const st=stakes();if(st&&chance(.7))log('stakes',`${st.what}, ${players[st.who].name}`,{w:st.what});
    if(match.tb&&(P[0]+P[1])%6===0){match.changeNext=true;match.sitNext=false;}
    if(match.tb&&(P[0]+P[1])%2===1)match.server=1-match.server;
    return;
  }
  // A game, and maybe a set.
  const broke=!match.tb&&w!==match.server;
  G[w]++;
  log('point',`${how}${tail}`,{w});
  const setOver=match.tb||(G[w]>=6&&G[w]-G[l]>=2)||G[w]===7;
  P[0]=P[1]=0;
  const total=G[0]+G[1];
  if(!setOver){
    if(G[0]===6&&G[1]===6){match.tb=true;match.tbFirst=1-match.server;log('tb','Six games all. Tiebreak',{});}
    log('game',`Game ${players[w].name}${broke?', a break of serve':''}. ${G[w]===G[l]?`${G[w]} all`:`${players[G[0]>G[1]?0:1].name} leads ${Math.max(...G)}-${Math.min(...G)}`}`,{g:G[w],b:broke});
    match.server=match.tb?match.tbFirst:1-match.server;
    match.changeNext=total%2===1;match.sitNext=total>1&&!match.tb;
    return;
  }
  // The set.
  match.sets.push([G[0],G[1]]);
  const won=i=>match.sets.filter(x=>x[i]>x[1-i]).length;
  const firstTB=match.tb;
  match.server=firstTB?1-match.tbFirst:1-match.server;
  match.tb=false;match.games=[0,0];
  match.changeNext=total%2===1;match.sitNext=true;match.sweep=SURF.kind==='clay';
  if(won(w)===2){
    log('match',`Game, set and match, ${players[w].name}. ${setsLine(w)}`,{s:match.sets.length});
    match.over=w;match.changeNext=false;
    return;
  }
  log('set',`Set ${players[w].name}, ${Math.max(G[w],G[l])}-${Math.min(G[w],G[l])}${firstTB?' in the tiebreak':''}`,{});
}

/* ---------- movement ---------- */
function steer(p,tx,tz,spd,dt,acc){
  const dx=tx-p.x,dz=tz-p.z,d=hyp(dx,dz);
  if(p.air||p.tie>0)return d;
  p.steered=true;
  const s=d<.03?0:Math.min(spd*(1-.25*p.fatigue),d*2.8);
  const ux=d>1e-4?dx/d:0,uz=d>1e-4?dz/d:0;
  const dvx=ux*s-p.vx,dvz=uz*s-p.vz,dl=hyp(dvx,dvz),m=Math.min(dl,(acc||10)*dt);
  if(dl>1e-6){p.vx+=dvx/dl*m;p.vz+=dvz/dl*m;}
  // Static friction: a player easing to a stop actually stops, instead of creeping.
  if(s<.05&&hyp(p.vx,p.vz)<.3){p.vx=0;p.vz=0;}
  return d;
}
function faceTo(p,ang,dt,rate){let d=ang-p.face;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;p.face+=clamp(d,-(rate||9)*dt,(rate||9)*dt);}
const angTo=(p,x,z)=>Math.atan2(z-p.z,x-p.x);
function jump(p,power,hx,hz){if(p.air)return;const jh=p.hops*power*(1-.3*p.fatigue);p.jv=Math.sqrt(2*G*Math.max(.05,jh));p.air=true;if(hx!==undefined){p.vx=hx;p.vz=hz;}p.fatigue=Math.min(1,p.fatigue+.004);}
function integrate(p,dt){
  p.x+=p.vx*dt;p.z+=p.vz*dt;
  if(p.air){p.j+=p.jv*dt;p.jv-=G*dt;if(p.j<=0){p.land=Math.min(.25,.08+Math.abs(p.jv)*.03);p.j=0;p.jv=0;p.air=false;p.vx*=.4;p.vz*=.4;}}
  else{
    const sp=hyp(p.vx,p.vz);p.fatigue=clamp(p.fatigue+dt*(sp>3.5?.0035:-.0012),0,1);
    // Ground friction: with nothing driving them, shoes grip and the player stops.
    if(!p.steered){const f=Math.exp(-dt*7);p.vx*=f;p.vz*=f;if(hyp(p.vx,p.vz)<.2){p.vx=0;p.vz=0;}}
  }
  p.steered=false;
  p.x=clamp(p.x,-FENCE.x+.3,FENCE.x+3);p.z=clamp(p.z,-FENCE.z+.3,FENCE.z+3);
}
/* Feet stay planted where they land and only lift for a step. A foot steps when the body has moved far enough
   from it, swings to where the body will be, and plants again, so feet never skate across the floor. */
function updateFeet(p,dt){
  const fx=Math.cos(p.face),fz=Math.sin(p.face),wx=-fz,wz=fx;
  const c=clamp((p.cr||0)+(p.land||0)*2.2,0,1),st=.1+.18*c,sp=hyp(p.vx,p.vz),run=clamp(sp/5,0,1);
  const spot=(i,ahead)=>{const s=i?-1:1;return[p.x+p.vx*ahead+wx*s*st,p.z+p.vz*ahead+wz*s*st];};
  if(!p.fp)p.fp=[0,1].map(i=>{const n=spot(i,0);return{x:n[0],z:n[1],h:0,sw:false,u:0,fx:n[0],fz:n[1],tx:n[0],tz:n[1]};});
  const F=p.fp;
  if(p.air||p.sit){F.forEach((f,i)=>{const n=spot(i,0);f.x=f.fx=f.tx=n[0];f.z=f.fz=f.tz=n[1];f.sw=false;f.h=0;});return;}
  const T=clamp(.34-sp*.032,.16,.34),lift=.04+.13*run+.03*Math.min(1,sp);
  // How far a planted foot can trail the hip before the leg runs out of length.
  const leg=p.hgt*.52,hipJh=p.hgt*.53*(1-.24*c)+p.j-.05,reachH=Math.sqrt(Math.max(.01,(leg*.97)**2-hipJh*hipJh));
  const start=i=>{const f=F[i],n=spot(i,T*1.55);f.sw=true;f.u=0;f.fx=f.x;f.fz=f.z;f.tx=n[0];f.tz=n[1];p.lastStep=i;};
  let swinging=false;
  F.forEach((f,i)=>{
    if(!f.sw)return;
    swinging=true;
    f.u+=dt/T;const u=Math.min(1,f.u),e=u*u*(3-2*u);
    // Keep aiming at where the body will be when this foot comes down.
    const n=spot(i,T*(1-u)+T*.55);f.tx=lerp(f.tx,n[0],.25);f.tz=lerp(f.tz,n[1],.25);
    f.x=lerp(f.fx,f.tx,e);f.z=lerp(f.fz,f.tz,e);f.h=Math.sin(Math.PI*u)*lift;
    if(f.u>=1){f.sw=false;f.h=0;f.x=f.tx;f.z=f.tz;}
    p.gait=(i?Math.PI:0)+Math.PI*u;
  });
  // A planted foot about to overstretch lifts at once, even mid-stride: the flight phase of a run.
  F.forEach((f,i)=>{if(f.sw)return;const s=i?-1:1,hx=p.x+wx*s*.1,hz=p.z+wz*s*.1;if(hyp(f.x-hx,f.z-hz)>reachH*.92)start(i);});
  if(swinging||F.some(f=>f.sw))return;
  // Both feet down: step with the one that has drifted furthest from where it belongs, alternating when moving.
  let best=-1,err=0;
  F.forEach((f,i)=>{const n=spot(i,T*.5),e=hyp(f.x-n[0],f.z-n[1])*(sp>.4&&i===p.lastStep?.6:1);if(e>err){err=e;best=i;}});
  const thr=sp>.4?Math.max(.06,sp*T*.55):.13;
  if(best>=0&&err>thr)start(best);
}

// Two-bone IK: the middle joint of a limb from a to b, with segment lengths l1 and l2, bending toward bend.
function ik2(a,b,l1,l2,bend){
  const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L=Math.max(1e-4,hyp(d[0],d[1],d[2]));
  const u=[d[0]/L,d[1]/L,d[2]/L],dl=Math.min(L,(l1+l2)*.999);
  const x=(l1*l1-l2*l2+dl*dl)/(2*dl),y=Math.sqrt(Math.max(0,l1*l1-x*x));
  const bd=bend[0]*u[0]+bend[1]*u[1]+bend[2]*u[2],v=[bend[0]-u[0]*bd,bend[1]-u[1]*bd,bend[2]-u[2]*bd],vl=hyp(v[0],v[1],v[2])||1;
  return[a[0]+u[0]*x+v[0]/vl*y,a[1]+u[1]*x+v[1]/vl*y,a[2]+u[2]*x+v[2]/vl*y];
}

/* ---------- poses ----------
   Each frame a player's body is rebuilt in world space from its state: feet, knees, hips, shoulders, head, hands
   and the racket. A stroke is a path of keyframes for the racket hand and the racket's direction, from the
   backswing through contact to the follow-through, played by the swing's progress u from -1 to 1.
   Keyframes are in the body frame: forward, toward the side the ball is struck on, and height. */
const RL=.5;   // grip to the middle of the strings
const STROKES={
  fh:(c,s,d)=>({b:[[-.4,.55,c+.3],[-.5,.45,.6]],c:[[.2,.45,c],[.45,.85,.05]],f:[[.05,-.3,s+.12],[-.5,-.2,.7]],free:[[.35,-.35,s-.1],[.1,-.35,s-.35],[0,.1,s-.2]]}),
  bh:(c,s,d)=>({b:[[-.25,.35,c+.2],[-.6,.3,.45]],c:[[.3,.5,c],[.4,.85,0]],f:[[.2,.55,s+.3],[-.3,.2,.9]],free:[null,[-.2,-.4,s-.1],[-.35,-.5,s]]}),
  bh2:(c,s,d)=>({b:[[-.2,.3,c+.2],[-.6,.3,.45]],c:[[.25,.4,c],[.45,.85,0]],f:[[0,-.25,s+.15],[-.5,-.3,.7]],free:[null,null,null]}),
  slice:(c,s,d)=>({b:[[-.3,.45,s+.05],[-.4,.3,.85]],c:[[.25,.45,c],[.45,.85,.15]],f:[[.45,.15,c-.1],[.6,.5,.2]],free:[[.1,-.3,s-.15],[-.2,-.4,s-.1],[-.3,-.45,s-.05]]}),
  volley:(c,s,d)=>({b:[[.1,.45,c+.1],[.1,.6,.75]],c:[[.4,.42,c],[.4,.75,.4]],f:[[.55,.35,c-.05],[.5,.7,.3]],free:[[.3,-.25,s-.2],[.2,-.35,s-.2],[.15,-.35,s-.25]]}),
  smash:(c,s,d)=>({b:[[-.15,.3,d-.05],[-.2,.1,-.95]],c:[[.2,.12,c-RL*.95],[.25,.05,.95]],f:[[.3,-.35,s-.45],[.2,-.3,-.9]],free:[[.3,-.1,d+.35],[.15,-.2,s-.2],[.1,-.25,s-.4]]}),
  feed:(c,s,d)=>({b:[[.05,.4,c],[.3,.7,.2]],c:[[.35,.4,c+.05],[.5,.6,.45]],f:[[.45,.35,c+.2],[.4,.4,.7]],free:[[.25,-.25,s-.3],[.2,-.3,s-.35],[.2,-.3,s-.35]]})
};
STROKES.serve=STROKES.smash;
const nrm=v=>{const l=hyp(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l];};
const mix3=(a,b,u)=>[lerp(a[0],b[0],u),lerp(a[1],b[1],u),lerp(a[2],b[2],u)];
// Where the strings meet the ball at contact, in the body frame, for a stroke at contact height c.
function contactOff(kind,c,p){const K=STROKES[kind](c,p.hgt*.82,p.hgt+.05).c,dn=nrm(K[1]);return[K[0][0]+dn[0]*RL,K[0][1]+dn[1]*RL,K[0][2]+dn[2]*RL];}
function poseOf(p){
  const fx=Math.cos(p.face),fz=Math.sin(p.face),wx=-fz,wz=fx;
  const Hh=p.hgt,j=p.j,sp=hyp(p.vx,p.vz),run=clamp(sp/5,0,1);
  const at=(fw,sd,h)=>[p.x+fx*fw+wx*sd,p.z+fz*fw+wz*sd,h];
  const dirW=(f,sd,h)=>nrm([fx*f+wx*sd,fz*f+wz*sd,h]);
  if(p.sit){
    const ch=CHAIR.h+.04,hip=[p.x,p.z,ch],sh=[p.x+fx*.06,p.z+fz*.06,ch+Hh*.3],head=[sh[0],sh[1],sh[2]+Hh*.12];
    const feet=[at(.46,.14,0),at(.46,-.14,0)];
    let hands=[at(.32,.16*p.hand,ch+.14),at(.32,-.16*p.hand,ch+.14)],rk={dir:dirW(.2,.3*p.hand,-.95)};
    if(p.arm==='drink')hands[1]=[head[0]+fx*.12,head[1]+fz*.12,head[2]-.02];
    if(p.arm==='towel'){hands=[[head[0]+fx*.14+wx*.08,head[1]+fz*.14+wz*.08,head[2]],[head[0]+fx*.14-wx*.08,head[1]+fz*.14-wz*.08,head[2]]];}
    rk.away=true;
    return{feet,hip,sh,head,hands,rk};
  }
  const c=clamp((p.cr===undefined?p.crouch:p.cr)+(p.land||0)*2.2,0,1);
  // The body bobs with the stride, leans into speed and folds forward as it crouches.
  const bob=p.air?0:.022*Math.cos(2*p.gait)*clamp(sp/2,0,1);
  const lean=clamp(sp*.035,0,.22)+c*.12;
  const hipH=Hh*.53*(1-.26*c)+j+bob;
  const hip=[p.x-fx*c*.05,p.z-fz*c*.05,hipH];
  const sh=[p.x+fx*lean,p.z+fz*lean,hipH+Hh*.29*(1-.1*c)];
  const head=[sh[0]+fx*.03,sh[1]+fz*.03,sh[2]+Hh*.12-bob*.4];
  const feet=[];
  if(p.fp)for(const q of p.fp)feet.push([q.x,q.z,q.h]);
  else for(const s of[1,-1])feet.push(at(0,s*.12,0));
  if(p.air){for(let i=0;i<2;i++){feet[i]=at(i?-.08:.06,(i?-1:1)*.13,Math.max(0,j-.04-i*.08));}}
  if(p.walker){
    const swing=-Math.sin(p.gait)*(clamp(sp*.12,0,.5)*.75+.03),raise=.04+.3*run;let hands;
    if(p.arm==='pockets')hands=[at(.1,.19,hipH-.03),at(.1,-.19,hipH-.03)];
    else if(p.arm==='phone')hands=[at(.3,.05,sh[2]-.14),at(-swing*.6,-.22,hipH-.04)];
    else hands=[at(swing,.22,hipH-.04+Math.max(0,swing)*raise*3),at(-swing,-.22,hipH-.04+Math.max(0,-swing)*raise*3)];
    return{feet,hip,sh,head,hands,rk:null};
  }
  // Racket hand first, the free hand second. sd is toward the racket side.
  const R=p.hand,swing=-Math.sin(p.gait)*(clamp(sp*.12,0,.5)*.75+.03);
  let rh,rd,fh,arm=p.arm;
  const sw=p.sw;
  if(sw){
    const K=STROKES[sw.kind](sw.ch,sh[2]-p.j,head[2]-p.j+.1),side=sw.side,u=sw.u;
    const seg=u<0?[K.b,K.c,ease(u+1)]:[K.c,K.f,ease(u)];
    const hh=mix3(seg[0][0],seg[1][0],seg[2]),dd=mix3(seg[0][1],seg[1][1],seg[2]);
    // Near contact, the hand reaches for where the ball actually is.
    const a=sw.adj,wgt=a?Math.max(0,1-Math.abs(u)*2.2):0;
    rh=at(hh[0]+(a?a[0]*wgt:0),hh[1]*side+(a?a[1]*wgt*side:0),hh[2]+p.j+(a?a[2]*wgt:0));
    rd=dirW(dd[0],dd[1]*side,dd[2]);
    const fk=u<0?(K.free[0]&&K.free[1]?mix3(K.free[0],K.free[1],ease(u+1)):K.free[1]):(K.free[1]&&K.free[2]?mix3(K.free[1],K.free[2],ease(u)):K.free[2]);
    if(fk)fh=at(fk[0],fk[1]*side,fk[2]+p.j);
    else if(sw.kind==='bh2'||u<-.3)fh=[rh[0]+rd[0]*.13,rh[1]+rd[1]*.13,rh[2]+rd[2]*.13];
    else fh=at(-.2,-.4*side,sh[2]-.1);
    if(sw.kind==='serve'&&u<-.2&&sw.toss)fh=at(.3,-.1*side,head[2]+.4+(sw.tossUp||0));
  }else if(arm==='ready'){
    rh=at(.34,.16*R,hipH+.12);rd=dirW(.75,-.2*R,.55);fh=[rh[0]+rd[0]*.25,rh[1]+rd[1]*.25,rh[2]+rd[2]*.25];
  }else if(arm==='bounce'){
    rh=at(.2,.24*R,hipH+.02);rd=dirW(.6,.1*R,.25);
    fh=ball.held===p?[ball.x,ball.z,ball.h+BR*.6]:at(.3,-.12*R,hipH+.1);
  }else if(arm==='pick'){
    rh=at(.15,.26*R,hipH-.05);rd=dirW(.5,.2*R,-.6);fh=p.pickAt?[p.pickAt[0],p.pickAt[1],.06]:at(.38,-.14*R,.08);
  }else if(arm==='catch'){
    rh=at(.15,.26*R,hipH);rd=dirW(.5,.2*R,-.5);fh=at(.42,-.1*R,hipH+.3);
  }else if(arm==='shake'){
    rh=at(.48,.06*R,hipH+.28);rd=dirW(.4,.3*R,-.8);fh=at(.05,-.24*R,hipH-.04);
  }else if(arm==='fist'){
    rh=at(.08,.24*R,hipH);rd=dirW(.3,.2*R,-.9);const pm=.08*Math.sin(t*16);fh=at(.22,-.25*R,sh[2]+.12+pm);
  }else if(arm==='slam'){
    const u=clamp(p.actT/.5,0,1);rh=at(.3,.22*R,lerp(sh[2]+.3,hipH-.2,ease(u)));rd=dirW(.3,.1*R,lerp(.9,-1,ease(u)));fh=at(.05,-.24*R,hipH-.04);
  }else{
    // Carrying the racket while walking: head down, the free arm swinging.
    rh=at(swing*.6+.04,.25*R,hipH-.06);rd=dirW(.35,.12*R,-.92);
    fh=at(-swing,-.22*R,hipH-.04+Math.max(0,-swing)*(.04+.3*run)*3);
  }
  return{feet,hip,sh,head,hands:[rh,fh],rk:{dir:rd}};
}
// Knees and elbows, solved from the hips, shoulders, feet and hands with two-bone IK.
// The racket arm always hangs from the racket-side shoulder, even when the swing crosses the body.
function limbsOf(p,P){
  const fx=Math.cos(p.face),fz=Math.sin(p.face),wx=-fz,wz=fx,Hh=p.hgt;
  const thigh=Hh*.26,shin=Hh*.26,upper=Hh*.17,fore=Hh*.16;
  const kneeBend=p.sit?[fx,fz,.6]:p.air?[fx,fz,.5]:[fx,fz,.12];
  P.hipJ=P.feet.map((f,i)=>{const s=i?-1:1;return[P.hip[0]+wx*s*.1,P.hip[1]+wz*s*.1,P.hip[2]-.05];});
  P.knees=P.feet.map((f,i)=>ik2(P.hipJ[i],f,thigh,shin,kneeBend));
  const shJ=P.hands.map((h,i)=>{const s=i?-p.hand:p.hand;return[P.sh[0]+wx*s*.19,P.sh[1]+wz*s*.19,P.sh[2]-.04,s];});
  // A hand can't be further from its shoulder than the arm is long.
  P.hands=P.hands.map((h,i)=>{const s=shJ[i],d=[h[0]-s[0],h[1]-s[1],h[2]-s[2]],l=hyp(d[0],d[1],d[2]),m=(upper+fore)*.995;return l>m?[s[0]+d[0]/l*m,s[1]+d[1]/l*m,s[2]+d[2]/l*m]:h;});
  P.elb=P.hands.map((h,i)=>{const s=shJ[i][3];return ik2(shJ[i],h,upper,fore,[wx*s*.55-fx*.45,wz*s*.55-fz*.45,-.45]);});
  P.shJ=shJ.map(v=>[v[0],v[1],v[2]]);
  if(!P.rk)return P;
  const d=P.rk.dir,h=P.hands[0];
  P.rk.grip=h;P.rk.head=[h[0]+d[0]*RL,h[1]+d[1]*RL,h[2]+d[2]*RL];
  return P;
}
// Ease the hips, shoulders, head and hands toward their new places, relative to the body, so changes of stance
// blend instead of snapping. Feet are never eased: they stay planted in the world.
const EASE={hip:22,sh:16,head:14,hands:18};   // hands ease much faster mid-swing, set in update
function easePose(p,raw,dt){
  const ox_=p.x,oz_=p.z,oh=p.j;p.ease=p.ease||{};
  const out={};
  for(const key in raw){
    const v=raw[key];if(!EASE[key]){out[key]=v;continue;}
    const multi=Array.isArray(v[0]),list=multi?v:[v],prev=p.ease[key],a=1-Math.exp(-dt*EASE[key]);
    const rel=list.map((pt,i)=>{const r=[pt[0]-ox_,pt[1]-oz_,pt[2]-oh],q=prev&&prev[i];
      if(!q||hyp(q[0]-r[0],q[1]-r[1],q[2]-r[2])>1.2)return r;return[lerp(q[0],r[0],a),lerp(q[1],r[1],a),lerp(q[2],r[2],a)];});
    p.ease[key]=rel;
    const abs=rel.map(r=>[r[0]+ox_,r[1]+oz_,r[2]+oh]);
    out[key]=multi?abs:abs[0];
  }
  return out;
}

/* ---------- shot selection ----------
   The hitter picks a target, a pace, a spin and a net clearance from the situation: how hard the ball was to reach,
   where the opponent is, the score and their own game. Riskier shots aim closer to the lines. */
const faceNet=p=>Math.atan2(-endOf(p),0);
const SIDE_NAME=(kind,side,p)=>kind==='fh'||kind==='bh'||kind==='bh2'?(side===p.hand?'forehand':'backhand'):kind==='slice'?(side===p.hand?'forehand slice':'backhand slice'):kind==='volley'?(side===p.hand?'forehand volley':'backhand volley'):kind;
function chooseShot(p,c,sw,diff){
  const q=other(p),oe=-endOf(p),kind=sw.kind,press=pressure(p);
  const oppNet=Math.abs(q.z)<7.5,short=Math.abs(c[1])<CT.L-3.2;
  // Long rallies wear on patience: the longer it goes, the more each player goes for it.
  const aggr=clamp(.3+.4*p.power+.2*p.conf-.55*diff+(short?.25:0)-press*(1-p.nerve)*.25+Math.min(.35,rally.shots*.02),.05,1);
  const deep=d=>oe*(CT.L-d);
  const lineM=lerp(1.6,.45,aggr);
  const awayX=-Math.sign(q.x||rr(-1,1));
  const bhX=-q.hand*endOf(q);    // the opponent's backhand side
  let name=SIDE_NAME(kind,sw.side,p),sh={s:.3,v:24,th:0,arc:false,clear:.3,tg:[0,deep(2)],mul:1};
  let what='drive';
  if(kind==='smash'){
    what='smash';sh.v=lerp(26,38,p.power);sh.s=.05;sh.clear=.08;sh.tg=[awayX*rr(1.2,CT.S-.6),deep(rr(1,5))];sh.mul=.9;
  }else if(kind==='volley'){
    what='volley';
    if(c[2]<.7){sh.tg=[rr(-1.5,1.5),deep(rr(1.5,3))];sh.v=lerp(13,19,p.power);sh.s=-.3;sh.clear=.3;sh.mul=1.2;}
    else if(chance(.12+.25*p.touch*(Math.abs(q.z)>CT.L?1:.2))){what='drop volley';sh.arc=true;sh.th=rr(.25,.45);sh.s=-.7;sh.tg=[awayX*rr(1,3.5),oe*rr(1.2,3)];sh.clear=.08;sh.mul=1.3;}
    else{sh.tg=[awayX*rr(1.5,CT.S-lineM*.7),deep(rr(1.2,5))];sh.v=lerp(16,27,p.power*aggr);sh.s=-.25;sh.clear=.15;}
  }else{
    // Ground strokes.
    const w=[['drive',1],['pass',oppNet?1.4:0],['lob',oppNet?.35+.4*clamp((7.5-Math.abs(q.z))/5,0,1):diff>.8?diff*.5:.02],
      ['drop',Math.abs(q.z)>CT.L+.5&&Math.abs(c[1])<CT.L?.12*p.touch:0],['approach',short&&!oppNet?(.4+p.net)*SURF.net:0]];
    what=wpick(w);
    const sl=kind==='slice';
    if(what==='lob'){sh.arc=true;sh.th=rr(.8,.98);sh.s=sl?-.3:.5;sh.tg=[rr(-2.5,2.5),deep(rr(.9,3.2))];sh.clear=.5;sh.mul=1.1;name='lob';}
    else if(what==='drop'){sh.arc=true;sh.th=rr(.32,.5);sh.s=-.8;sh.tg=[awayX*rr(.5,3),oe*rr(1.3,3.2)];sh.clear=.1;sh.mul=1.4;name='drop shot';}
    else if(what==='pass'){sh.v=lerp(22,34,p.power)*(1-.25*diff);sh.s=sl?-.4:lerp(.4,.95,p.spin);sh.clear=.2;sh.mul=1.15;
      sh.tg=chance(.25)?[q.x+rr(-.4,.4),deep(rr(2,4))]:[awayX*(CT.S-lerp(1.2,.35,aggr)),deep(rr(2.5,6))];}
    else{
      // A drive or an approach: cross-court, down the line, or at the opponent's backhand.
      const dir=wpick([['cross',1.2],['line',.35+.4*aggr],['middle',.6*(1-aggr)],['bh',.5]]);
      const xs=dir==='cross'?-Math.sign(c[0]||1):dir==='line'?Math.sign(c[0]||1):dir==='bh'?bhX:0;
      const xx=dir==='middle'?rr(-1.2,1.2):xs*(CT.S-lineM*rr(.8,1.4));
      sh.tg=[xx,deep(what==='approach'?rr(.9,2.6):rr(lerp(1.6,.7,aggr),lerp(4.6,2.2,aggr)))];
      sh.v=(sl?lerp(16,23,p.power):lerp(19,33,p.power*.6+aggr*.4))*(1-.22*diff);
      sh.s=sl?-lerp(.35,.8,p.slice):lerp(.25,.9,p.spin);sh.clear=lerp(.5,.1,aggr);
      if(what==='approach'){p.toNet=true;sh.mul=1.05;}
    }
  }
  if(what==='drive'||what==='approach'||what==='pass'){const fromX=c[0],toX=sh.tg[0];sh.dir=Math.abs(fromX)>.9&&Math.abs(toX)>1.2?(Math.sign(fromX)===Math.sign(toX)?'down the line':'cross-court'):'';}
  if(what==='pass'&&!/pass/.test(name))name+=' pass';
  if(what==='approach')name+=' approach';
  sh.sig=.016*(1.28-p.control)*(1+2.6*diff)*(1+.6*p.fatigue)*(1+press*(1-p.nerve)*.9)*(1-.15*p.conf)*(1+Math.min(.5,rally.shots*.015))*sh.mul*(sh.arc?1:clamp(sh.v/24,.7,1.5));
  // A low or hard ball tends to be pulled down into the net rather than sent long.
  sh.low=sh.arc?0:.45+.9*diff+(c[2]<.6?.5:0);
  sh.name=name;sh.what=what;
  return sh;
}
// A serve: flat, slice or kick, out wide, into the body or down the T.
function chooseServe(p,first){
  const e=endOf(p),sd=serveSide(),bx=-e*sd,press=pressure(p);
  const aggr=clamp((first?.55:.15)+.35*p.serve+.15*p.conf-press*(1-p.nerve)*.3,.05,1);
  const spot=wpick([['wide',1],['T',1],['body',first?.45:.8]]);
  const m=lerp(.9,.18,aggr);
  const x=spot==='wide'?bx*(CT.S-m):spot==='T'?bx*(m*.6+.08):bx*rr(1.4,2.6);
  const kind=first?wpick([['flat',1+p.power],['slice',.8],['kick',.3]]):wpick([['kick',1.4],['slice',.8],['flat',.15]]);
  const v=(kind==='flat'?lerp(35,52,p.serve*.7+p.power*.3):kind==='slice'?lerp(32,46,p.serve):lerp(28,39,p.serve))*(first?rr(.95,1.03):rr(.88,.97));
  const s=kind==='kick'?rr(.65,.95):kind==='slice'?rr(.1,.3):rr(-.05,.12);
  return{tg:[x,-e*(CT.SV-lerp(1.4,.3,aggr)*rr(.6,1.2))],v,s,th:0,arc:false,clear:first?.08:lerp(.4,.2,p.serve),spot,kind,
    sig:.0085*(1.3-.5*p.serve-.4*p.control)*(first?1.2:.75)*(1+press*(1-p.nerve)*.9)*(1+.4*p.fatigue)*clamp(v/42,.75,1.3),mul:1,name:kind+' serve'};
}

/* ---------- reading the ball ----------
   The receiver predicts the ball's flight and picks where and when to meet it: a volley or smash before the bounce,
   or a ground stroke after it at a comfortable height, as early as they can get there. The stance is wherever the
   body must stand for the strings to meet the ball at that moment. */
function stanceFor(p,kind,side,s){
  const f0=faceNet(p),fx=Math.cos(f0),fz=Math.sin(f0),wx=-fz,wz=fx,o=contactOff(kind,s.h,p);
  return[s.x-fx*o[0]-wx*o[1]*side,s.z-fz*o[0]-wz*o[1]*side];
}
function groundKind(p,side,h){
  if(side===p.hand)return 'fh';
  return(p.slice>.55&&h<.75)||(p.slice>.35&&h>1.45)||(!p.two&&h>1.6)?'slice':p.two?'bh2':'bh';
}
function planReturn(p){
  const e=endOf(p),S=predict(3.2),now=t,delay=Math.max(0,p.planAt-now);
  const f0=faceNet(p),wx=-Math.sin(f0),wz=Math.cos(f0);
  let best=null,bestSc=1e9,near=null,gap=1e9,bounce=null;
  // Bounces already made count too: after the first, the next one ends the point.
  const done=rally.bounces;
  for(const s of S){
    if(s.net)break;
    const n=s.n+done;
    if(n===1&&!done&&!bounce)bounce=s;
    if(n>=2)break;
    if(s.z*e<=.4)continue;
    const pre=n===0;
    let kind;
    if(pre){
      if(rally.serve)continue;
      if(s.h>2.05&&s.h<p.reach+RL+.25)kind='smash';
      else if(s.h>.3&&s.h<=2.05&&(Math.abs(p.z)<7.5||p.toNet)&&Math.abs(s.z)<Math.abs(p.z)+1.5)kind='volley';
      else continue;
    }else{
      if(s.h<.2||s.h>2.3)continue;
      kind=s.h>2&&Math.abs(s.z)<10?'smash':'ground';
    }
    const lat=(s.x-p.x)*wx+(s.z-p.z)*wz;
    const side=kind==='smash'?p.hand:lat*p.hand>-.3?p.hand:-p.hand;
    const sk=kind==='ground'?groundKind(p,side,s.h):kind;
    const st=stanceFor(p,sk,side,s),d=hyp(st[0]-p.x,st[1]-p.z);
    const avail=s.t-now-delay,need=Math.max(0,d-.3)/(p.speed*(1-.25*p.fatigue))+(d>.3?.1:0);
    const sc=Math.abs(s.h-(pre?1.15:.95))*1.2+Math.max(0,Math.abs(s.z)-CT.L-1)*.6+(s.t-now)*.35;
    const pl={tc:s.t,x:st[0],z:st[1],ch:s.h,bx:s.x,bz:s.z,side,kind:sk,pre};
    if(need<=avail){if(sc<bestSc){bestSc=sc;best=pl;}}
    else if(need-avail<gap){gap=need-avail;near=pl;}
  }
  const pl=best||near;
  if(!pl){p.plan={none:true};return;}
  pl.reach=!!best;pl.rushed=best?0:clamp(gap,0,1);
  // Leave a ball that is going out, if they read it that way. Volleyers at the net can't always tell.
  if(bounce){
    const o=rally.serve?boxOut(bounce.x,bounce.z,-e,serveSide()):outBy(bounce.x,bounce.z);
    if(!pl.pre&&o+p.judge>.04)pl.leave=true;
    if(pl.pre&&o>.6+p.judge*3)pl.leave=true;
  }
  p.plan=pl;
}
function startSwing(p,pl){
  const fwd=pl.kind==='smash'?.24:pl.kind==='volley'?.12:pl.kind==='slice'?.2:.18;
  p.sw={kind:pl.kind,side:pl.side,tc:pl.tc,ch:pl.ch,u:-.3,prep:pl.kind==='volley'?.15:.32,fwd,fol:pl.kind==='volley'?.25:.42,hit:false};
}
function updateSwing(p,dt){
  const sw=p.sw;if(!sw)return;
  if(t<sw.tc-sw.fwd){sw.u=Math.max(-1,sw.u-dt/sw.prep);sw.u0=sw.u;}
  else if(t<sw.tc){if(sw.u0===undefined)sw.u0=sw.u;sw.u=lerp(sw.u0,0,clamp((t-(sw.tc-sw.fwd))/sw.fwd,0,1));}
  else{sw.u=Math.min(1,Math.max(sw.u,(t-sw.tc)/sw.fol));if(sw.u>=1)p.sw=null;}
}
// Body-frame position of a world point, relative to the player standing square to the net.
function bodyRel(p,x,z,h){const f0=faceNet(p),fx=Math.cos(f0),fz=Math.sin(f0),wx=-fz,wz=fx,dx=x-p.x,dz=z-p.z;return[dx*fx+dz*fz,dx*wx+dz*wz,h];}
function contactPoint(p,sw){const f0=faceNet(p),fx=Math.cos(f0),fz=Math.sin(f0),wx=-fz,wz=fx,o=contactOff(sw.kind,sw.ch,p);return[p.x+fx*o[0]+wx*o[1]*sw.side,p.z+fz*o[0]+wz*o[1]*sw.side,o[2]];}
function tryHit(p){
  const pl=p.plan,sw=p.sw;
  if(!pl||!sw||sw.hit||pl.leave)return;
  const cp=contactPoint(p,sw);
  // The ball can cover half a metre in a frame, so measure to the whole path it took since the last one.
  const b1=[ball.x,ball.z,ball.h],b0=sw.bp||b1;sw.bp=b1;
  const sd=[b1[0]-b0[0],b1[1]-b0[1],(b1[2]-b0[2])*1.2],L2=sd[0]**2+sd[1]**2+sd[2]**2;
  const u=L2>1e-9?clamp(((cp[0]-b0[0])*sd[0]+(cp[1]-b0[1])*sd[1]+(cp[2]-b0[2])*1.2*sd[2])/L2,0,1):1;
  const Q=[b0[0]+(b1[0]-b0[0])*u,b0[1]+(b1[1]-b0[1])*u,b0[2]+(b1[2]-b0[2])*u];
  const d=hyp(Q[0]-cp[0],Q[1]-cp[1],(Q[2]-cp[2])*1.2),prev=sw.dPrev??1e9;sw.dPrev=hyp(ball.x-cp[0],ball.z-cp[1],(ball.h-cp[2])*1.2);
  // Keep the swing in time with the ball as it comes in, so the strings meet it at the middle of the stroke.
  if(d<5&&t>pl.tc-.6&&(sw.u0===undefined||t<sw.tc))sw.tc=t+d/Math.max(4,hyp(ball.vx,ball.vz,ball.vh));
  if(t<pl.tc-.25)return;
  // Strike at the closest approach, if it comes within reach.
  if(d<.6+p.lunge&&u<1){ball.x=Q[0];ball.z=Q[1];ball.h=Q[2];hitBall(p,cp,d);return;}
  if(t>pl.tc+.12&&sw.dPrev>prev){
    sw.hit=true;p.plan={none:true};rally.whiff=p.id;
    if(chance(.4))log('miss',pick([`${p.name} lunges but can't reach it`,`${p.name} swings and misses`,`${p.name} gets there late`]),{});
  }
}
function hitBall(p,cp,dMiss){
  const pl=p.plan,sw=p.sw,q=other(p);
  const c=[ball.x,ball.z,ball.h];
  const inV=hyp(ball.vx,ball.vz,ball.vh);
  const rel=bodyRel(p,c[0],c[1],c[2]),o=contactOff(sw.kind,sw.ch,p);
  sw.adj=[rel[0]-o[0],(rel[1]-o[1]*sw.side)*sw.side,rel[2]-o[2]];
  const diff=clamp(Math.max(0,inV-18)/38+dMiss*.6+(pl.ch<.4?.3:0)+(pl.ch>1.6&&sw.kind!=='smash'?.25:0)+hyp(p.vx,p.vz)*.05+(p.lunge?.35:0)+(pl.rushed||0)*.8+(ball.bad||0)*.6,0,1.6);
  sw.hit=true;sw.tc=Math.min(sw.tc,t);
  const sh=chooseShot(p,c,sw,diff);
  const v=strike(c,sh);
  rally.last=p.id;rally.bounces=0;rally.shots++;rally.serve=false;rally.cord=false;rally.hitT=t;
  rally.lastShot={by:p.id,name:sh.name,dir:sh.dir||'',diff,what:sh.what,v,x0:c[0],z0:c[1]};
  stats.shots++;
  if(chance(.0015)){p.string=true;log('string',`${p.name} breaks a string`,{});}
  p.plan=null;p.lunge=0;
  // Recover toward the middle of the angles the opponent now has, or close in on the net.
  const e=endOf(p);
  p.home=p.toNet||sh.what==='drop volley'?[clamp(sh.tg[0]*.4,-2,2),e*rr(1.9,3.4)]:[clamp(sh.tg[0]*.3,-2.2,2.2),e*(CT.L+rr(.2,1.4)-(p.net>.6?.6:0))];
  q.plan=null;q.planAt=t+q.react*(1+.5*q.fatigue);q.judge=gauss()*.06*(1.3-q.control);q.lunge=0;
}

/* ---------- the rules ----------
   The ball does what it does, and the rules judge it: where it bounced, how many times, and who touched it last. */
function placeName(sh){return(sh.dir?sh.name+' '+sh.dir:sh.name);}
function anOf(w){return /^[aeiou]/i.test(w)?'an':'a';}
function errName(o,x,z){if(o.net)return pick(['into the net','into the tape','into the bottom of the net']);
  const d=outBy(x,z),cm=Math.round(d*100);const where=Math.abs(z)-CT.L>Math.abs(x)-CT.S?'long':'wide';
  return cm<4?`just ${where}`:cm<25?`${where} by ${cm} cm`:where;}
function endRally(w,how){
  if(rally.over)return;
  rally.over=true;rally.winner=w;rally.how=how;
  awardPoint(w,how);
  match.phase='after';match.phaseT=0;match.afterT=rr(1.2,2.4);
  for(const p of players){p.plan=null;p.lunge=0;}
}
function fault(why){
  const s=server(),r=receiver();
  if(match.serveNo===1){
    match.serveNo=2;rally.over=true;
    log('fault',`Fault, ${why}`,{w:why.split(' ')[0]});
    match.phase='after';match.phaseT=0;match.afterT=rr(.7,1.4);match.second=true;
  }else{
    match.serveNo=1;
    endRally(r.id,`Double fault from ${s.name}`);
  }
}
function ruleEvent(ev){
  if(!ball.live||rally.over||rally.last===null)return;
  const A=players[rally.last],B=other(A),side=ball.z>=0?1:-1;
  if(ev==='cord')rally.cord=true;
  if(ev==='net')rally.net=true;
  if(ev==='bounce'||ev==='roll'){
    if(side===endOf(A)){
      // Back on the hitter's own side: it never got over.
      if(rally.serve){fault(rally.net||rally.cord?'into the net':'it never got over');return;}
      const ls=rally.lastShot;
      endRally(B.id,ls&&ls.diff>.6?`${B.name} forces the error. ${A.name}'s ${ls.name} goes into the net`:`${A.name}'s ${ls?ls.name:'shot'} goes ${errName({net:true})}`);
      return;
    }
    rally.bounces++;
    if(rally.bounces===1){
      if(rally.serve){
        const o=boxOut(ball.x,ball.z,endOf(A),serveSide());
        if(SURF.kind==='clay'&&o>0&&o<.07)match.mark={x:ball.x,z:ball.z,by:B.id,o};
        if(o>0){fault(o<.04?'just out':Math.abs(ball.z)>CT.SV?`long${o>.04&&o<.3?' by '+Math.round(o*100)+' cm':''}`:'wide');return;}
        if(rally.cord){rally.over=true;log('let','Let. The serve clips the net cord',{});match.phase='after';match.phaseT=0;match.afterT=rr(.8,1.4);match.let=true;return;}
        if(o>-.03&&chance(.6))log('line','The serve catches the line',{});
        return;
      }
      const o=outBy(ball.x,ball.z);
      if(SURF.kind==='clay'&&o>-.03&&o<.07)match.mark={x:ball.x,z:ball.z,by:B.id,o};
      if(o>0){
        const ls=rally.lastShot;
        endRally(B.id,ls&&ls.diff>.7?`${A.name} is stretched and the ${ls.name} goes ${errName({},ball.x,ball.z)}`:`${A.name}'s ${ls?ls.name:'shot'} goes ${errName({},ball.x,ball.z)}`);
        return;
      }
      if(o>-.03&&chance(.6))log('line',`${pick(['It clips the line','Right on the line','It catches the back of the line','Chalk flies'])}`,{});
      if(rally.cord&&chance(.8))log('cord','It clips the net cord and trickles over',{});
      if(ball.bad>.25&&chance(.7))log('bad',SURF.kind==='clay'?'The ball skids off a ridge of loose clay':'A bad bounce off the worn grass',{});
      return;
    }
    // The second bounce: whoever hit it last wins the point.
    winPoint(A,B);
  }
  if(ev==='fence'){
    if(rally.bounces===0&&!rally.serve){const ls=rally.lastShot;endRally(B.id,`${A.name}'s ${ls?ls.name:'shot'} flies long`);}
    else if(rally.bounces===0&&rally.serve)fault('long');
    else if(rally.bounces>=1)winPoint(A,B);
  }
}
function winPoint(A,B){
  const ls=rally.lastShot;
  if(rally.shots===1&&rally.serveV){
    const sp=mph(rally.serveV);
    if(rally.whiff===B.id){endRally(A.id,`An unreturnable serve from ${A.name}, ${sp}`);return;}
    stats.aces++;
    endRally(A.id,`${A.name} serves an ace ${rally.spot==='wide'?'out wide':rally.spot==='T'?'down the T':'into the body'}, ${sp}`);
    return;
  }
  if(rally.whiff===B.id)endRally(A.id,`${A.name}'s ${ls.name} is too good for ${B.name}`);
  else{const nm=placeName(ls);endRally(A.id,ls.what==='drop'||ls.what==='drop volley'?`${A.name} wins it with ${anOf(nm)} ${nm}`:`${cap(anOf(nm))} ${nm} winner from ${A.name}`);}
}

/* ---------- between points ----------
   Every ball that ended a point lies somewhere. Each player picks up the ones on their side, the receiver hits
   theirs back to the server, and the server keeps two before serving. */
function liftBall(){if(ball.live||ball.toss){loose.push({x:ball.x,z:ball.z,h:ball.h,vx:ball.vx,vz:ball.vz,vh:ball.vh,s:ball.s,spin:ball.spin});}ball.live=false;ball.toss=false;ball.held=null;}
function homeFor(p){
  const e=endOf(p),sd=serveSide(),s=server();
  if(p===s)return[e*sd*rr(.25,1),e*(CT.L+.12)];
  const big=s.serve*.6+s.power*.4;
  return[e*sd*rr(2.2,3.3),e*(CT.L+lerp(-.4,1.6,big)+rr(-.3,.3))];
}
function betweenTick(dt){
  const s=server(),r=receiver();
  match.phaseT+=dt;
  for(const p of players){
    p.crouch=0;
    if(p.path&&p.path.length){walkPath(p,dt);continue;}
    if(p.pickT>0){p.arm='pick';p.crouch=.85;steer(p,p.x,p.z,0,dt);p.pickT-=dt;if(p.pickT<=0){const b=p.fetch;const i=loose.indexOf(b);if(i>=0){loose.splice(i,1);p.balls++;}p.fetch=null;p.pickAt=null;}continue;}
    if(p.sw){updateSwing(p,dt);steer(p,p.x,p.z,0,dt);if(p.feedQ&&t>=p.feedAt){loose.push(p.feedQ);p.feedQ=null;}continue;}
    if(p.tieT>0){p.tieT-=dt;p.arm='pick';p.crouch=.9;p.pickAt=p.fp?[p.fp[0].x,p.fp[0].z]:null;steer(p,p.x,p.z,0,dt);continue;}
    // A ball coming back from a feed: go and catch it.
    const fb=loose.find(b=>b.feed===p.id);
    if(fb){const lead=.35;steer(p,fb.x+fb.vx*lead-Math.cos(faceNet(p))*.4,fb.z+fb.vz*lead-Math.sin(faceNet(p))*.4,2.4,dt);faceTo(p,Math.atan2(fb.z-p.z,fb.x-p.x),dt,6);p.arm='catch';
      if(hyp(fb.x-p.x,fb.z-p.z)<.75&&fb.h<1.5&&fb.h>.3){loose.splice(loose.indexOf(fb),1);p.balls++;}
      else if(hyp(fb.vx,fb.vz,fb.vh)<.4)fb.feed=null;
      continue;}
    // The nearest still ball on their side of the net.
    if(!p.fetch&&match.serveNo===1){let bd=1e9;for(const b of loose){if(b.feed!=null||hyp(b.vx,b.vz)>1.5||b.h>.3)continue;const mine=(b.z>=0?1:-1)===endOf(p);const d=hyp(b.x-p.x,b.z-p.z);if(mine&&d<bd){bd=d;p.fetch=b;}}}
    if(p.fetch){
      if(loose.indexOf(p.fetch)<0){p.fetch=null;continue;}
      const b=p.fetch,d=steer(p,b.x-Math.cos(p.face)*.38,b.z-Math.sin(p.face)*.38,rr(1.8,2.6),dt);faceTo(p,Math.atan2(b.z-p.z,b.x-p.x),dt,5);p.arm='carry';
      if(d<.12||hyp(b.x-p.x,b.z-p.z)<.45){p.pickT=rr(.45,.8);p.pickAt=[b.x,b.z];}
      continue;
    }
    // The receiver sends their balls back to the server.
    if(p===r&&match.serveNo===1&&p.balls>0&&s.balls<2&&!loose.some(b=>b.feed!=null)&&hyp(p.vx,p.vz)<.3&&match.phaseT>.6){
      feedBall(p,s);continue;
    }
    if(!p.home)p.home=homeFor(p);
    const d=steer(p,p.home[0],p.home[1],1.7,dt);
    faceTo(p,d>.4?Math.atan2(p.home[1]-p.z,p.home[0]-p.x):faceNet(p),dt,5);p.arm='carry';
  }
  const ready=players.every(p=>!p.path?.length&&!p.fetch&&!(p.pickT>0)&&!p.sw&&p.home&&hyp(p.x-p.home[0],p.z-p.home[1])<.3);
  const spare=r.balls+loose.length;
  if(ready&&s.balls>=1&&(match.serveNo===2||s.balls>=2||spare===0||match.phaseT>25)&&match.phaseT>rr(.8,2.5)){
    match.phase='serve';match.phaseT=0;match.step=0;match.stepT=0;match.bounces=0;match.bounceN=Math.max(1,s.bounceN+ri(-1,2));
    ball.held=s;ball.live=false;s.balls--;ball.ph=0;
  }
  // If the balls are stuck somewhere, start over with them back in the server's pocket.
  if(match.phaseT>60){s.balls=3;r.balls=0;loose.length=0;for(const p of players){p.fetch=null;p.pickT=0;p.path=null;}}
}
function walkPath(p,dt){
  const g=p.path[0],d=steer(p,g[0],g[1],g[2]||1.7,dt);faceTo(p,Math.atan2(g[1]-p.z,g[0]-p.x),dt,5);p.arm='carry';
  if(d<.25)p.path.shift();
}
function feedBall(p,s){
  p.balls--;
  const f0=faceNet(p),sw={kind:'feed',side:p.hand,tc:t+.25,ch:.95,u:-.5,prep:.2,fwd:.2,fol:.4,hit:true};p.sw=sw;
  const tgt=[s.x+rr(-.6,.6),s.z-endOf(s)*rr(2,3.5)];
  const c=[p.x+Math.cos(f0)*.5+(-Math.sin(f0))*.6*p.hand,p.z+Math.sin(f0)*.5+Math.cos(f0)*.6*p.hand,.95];
  const sol=solveSpeed(c,tgt,rr(.5,.75),0);
  const b={x:c[0],z:c[1],h:c[2],vx:0,vz:0,vh:0,s:0,spin:0,feed:s.id};
  if(!sol.fail){b.vx=sol.ux*sol.v*Math.cos(sol.th)*rr(.95,1.05);b.vz=sol.uz*sol.v*Math.cos(sol.th)*rr(.95,1.05);b.vh=sol.v*Math.sin(sol.th);}
  p.feedQ=b;p.feedAt=t+.25;
}

/* ---------- the serve ----------
   A few bounces, a look at the receiver, the toss, and the swing. A bad toss gets caught and tried again. */
function serveTick(dt){
  const s=server(),r=receiver();
  match.phaseT+=dt;match.stepT+=dt;
  // The receiver waits in a ready crouch, swaying.
  r.arm='ready';r.crouch=.4;steer(r,r.home[0]+.15*Math.sin(t*1.7),r.home[1],1,dt,4);faceTo(r,faceNet(r),dt,6);
  const f0=faceNet(s),fx=Math.cos(f0),fz=Math.sin(f0),wx=-fz,wz=fx,R=s.hand;
  steer(s,s.x,s.z,0,dt);
  if(match.step===0){
    s.arm='bounce';faceTo(s,f0,dt,6);
    ball.ph+=dt*2.1;
    if(ball.ph>=1){ball.ph-=1;match.bounces++;if(match.bounces>=match.bounceN){match.step=1;match.stepT=0;match.wait=rr(.3,1.1);ball.ph=0;}}
    const top=s.hgt*.53+.12,h=BR+(top-BR)*Math.abs(Math.cos(Math.PI*ball.ph));
    ball.x=s.x+fx*.32-wx*.12*R;ball.z=s.z+fz*.32-wz*.12*R;ball.h=h;
    return;
  }
  if(match.step===1){
    s.arm='bounce';faceTo(s,f0+R*.5,dt,4);ball.ph=0;
    ball.x=s.x+fx*.3-wx*.1*R;ball.z=s.z+fz*.3-wz*.1*R;ball.h=s.hgt*.53+.12;
    if(match.stepT>match.wait){
      // The toss.
      const bad=chance(.035);
      const ch=s.reach+RL*.9+rr(-.04,.08),apex=ch+rr(.25,.7);
      const fw=bad?rr(-.4,.9):rr(.25,.55),sd=bad?rr(-.6,.6):rr(-.02,.15);
      ball.held=null;ball.toss=true;ball.x=s.x+fx*.3+wx*.15*R;ball.z=s.z+fz*.3+wz*.15*R;ball.h=s.hgt*.95;
      const up=Math.sqrt(2*G*(apex-ball.h)),T=(up+Math.sqrt(2*G*(apex-ch)))/G;
      // Where the toss will come down to contact height, relative to the body.
      const tx=s.x+fx*fw+wx*sd*R,tz=s.z+fz*fw+wz*sd*R;
      ball.vx=(tx-ball.x)/T;ball.vz=(tz-ball.z)/T;ball.vh=up;ball.s=0;
      match.toss={bad,ch,tc:t+T,catchT:t+T+.15};
      startSwing(s,{kind:'serve',side:R,tc:t+T,ch,pre:true});s.sw.prep=.55;s.sw.fwd=.26;s.sw.toss=true;s.sw.u=-.2;
      if(bad){s.sw.fwd=99;}
      match.step=2;match.stepT=0;
    }
    return;
  }
  if(match.step===2){
    updateSwing(s,dt);
    const sw=s.sw;
    faceTo(s,f0+(sw&&sw.u<0?R*.9*(-sw.u):-R*.4*(sw?sw.u:1)),dt,8);
    s.crouch=sw&&sw.u<-.3&&t<match.toss.tc-.2?.35:0;
    if(match.toss.bad){
      // Catch it and start again.
      s.arm='catch';if(sw)s.sw=null;
      if(ball.vh<0&&ball.h<s.hgt*1.05){ball.toss=false;ball.held=s;match.step=0;match.bounces=match.bounceN-1;ball.ph=.5;log('toss',`${s.name} doesn't like the toss and catches it`,{});}
      return;
    }
    if(sw&&!sw.hit&&t>=match.toss.tc-.03){
      const cp=contactPoint(s,sw),d=hyp(ball.x-cp[0],ball.z-cp[1],ball.h-cp[2]);
      sw.hit=true;
      if(d>.45){fault('a mistimed swing');return;}
      const sh=chooseServe(s,match.serveNo===1);
      // A little hop into the court on a big serve.
      if(sh.kind!=='kick'||chance(.5))jump(s,.25,fx*1.2,fz*1.2);
      ball.toss=false;
      const v=strike([ball.x,ball.z,ball.h],sh);
      Object.assign(rally,{hitT:t,last:s.id,bounces:0,shots:1,serve:true,over:false,cord:false,net:false,whiff:null,touched:false,serveV:v,spot:sh.spot,lastShot:{by:s.id,name:'serve',diff:0,what:'serve',v}});
      stats.shots++;
      match.phase='rally';match.phaseT=0;
      // Serve and volley, now and then.
      s.toNet=chance(s.net*s.net*SURF.net*(match.serveNo===1?.7:.35));
      s.home=s.toNet?[clamp(sh.tg[0]*.3,-1.5,1.5),endOf(s)*rr(5.8,7.2)]:[rr(-.4,.4),endOf(s)*(CT.L+rr(.3,1))];
      r.plan=null;r.planAt=t+r.react*.6;r.judge=gauss()*.05*(1.3-r.control);r.lunge=0;
    }
  }
}

/* ---------- the rally ---------- */
function rallyTick(dt){
  match.phaseT+=dt;
  for(const p of players){
    const q=other(p),f0=faceNet(p);
    const receiving=rally.last!==p.id&&!rally.over;
    if(receiving){
      if(!p.plan&&t>=p.planAt){planReturn(p);p.replanAt=t+.3;}
      else if(p.plan&&!p.plan.none&&!(p.sw&&t>p.sw.tc-p.sw.fwd)&&t>p.replanAt){const keep=p.sw;planReturn(p);p.replanAt=t+.3;if(keep&&p.plan&&!p.plan.none){keep.tc=p.plan.tc;keep.ch=p.plan.ch;if(keep.kind!==p.plan.kind||keep.side!==p.plan.side){p.sw=null;}}}
      const pl=p.plan;
      if(pl&&!pl.none&&!pl.leave){
        const d=hyp(pl.x-p.x,pl.z-p.z),left=pl.tc-t;
        const spd=d/Math.max(.05,left-.08)>p.speed*.7||!pl.reach?p.speed:Math.max(1.5,d/Math.max(.1,left-.1)*1.25);
        steer(p,pl.x,pl.z,spd,dt,SURF.kind==='clay'?8:10);
        if(!pl.reach&&left<.35&&d>.45)p.lunge=Math.min(.45,p.lunge+dt*2);
        if(!p.sw&&left<(pl.kind==='volley'?.4:.75))startSwing(p,pl);
        if(rally.serve&&p.sw)rally.touched=true;
        p.crouch=pl.ch<.55?.75:pl.kind==='volley'?.45:.32;
        p.arm='ready';
      }else{
        // Nothing to play yet: a split step and a ready crouch while the opponent hits.
        if(!p.home)p.home=[0,endOf(p)*(CT.L+.8)];
        steer(p,p.home[0],p.home[1],pl&&pl.leave?1.2:p.speed*.7,dt,9);p.arm='ready';p.crouch=.35;
        if(pl&&pl.leave&&!pl.said&&ball.z*endOf(p)>0&&Math.abs(ball.z)>6){pl.said=true;if(chance(.15))log('leave',`${p.name} lets it go`,{});}
      }
      tryHit(p);
    }else{
      // Recovering after a shot.
      if(!p.home)p.home=[0,endOf(p)*(CT.L+.8)];
      steer(p,p.home[0],p.home[1],p.speed*(p.toNet?.95:.75),dt,9);p.arm='ready';p.crouch=hyp(p.vx,p.vz)>2.5?.12:.3;
    }
    updateSwing(p,dt);
    const sw=p.sw,twist=sw?(sw.kind==='feed'?0:sw.u<0?sw.side*.85*(-sw.u)*(sw.kind==='volley'?.4:1):-sw.side*.5*sw.u*(sw.kind==='volley'?.3:1)):0;
    const look=hyp(ball.x-p.x,ball.z-p.z)>1.5?Math.atan2(ball.z-p.z,ball.x-p.x):f0;
    faceTo(p,sw?f0+twist:(Math.abs(angDiff(look,f0))<1.2?lerpAng(f0,look,.4):f0),dt,sw?14:7);
    void q;
  }
}
const angDiff=(a,b)=>{let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;};
const lerpAng=(a,b,u)=>a+angDiff(b,a)*u;

/* ---------- after the point ---------- */
function afterTick(dt){
  match.phaseT+=dt;
  for(const p of players){
    updateSwing(p,dt);
    const mk_=match.mark;
    if(mk_&&mk_.by===p.id&&!p.sw){
      // A close call on clay: walk over and look at the mark.
      const d=steer(p,mk_.x-Math.cos(p.face)*.4,mk_.z-Math.sin(p.face)*.4,2.2,dt);faceTo(p,Math.atan2(mk_.z-p.z,mk_.x-p.x),dt,6);
      if(d<.2||hyp(mk_.x-p.x,mk_.z-p.z)<.5){p.arm='pick';p.crouch=.8;p.pickAt=[mk_.x,mk_.z];
        if(!mk_.seen){mk_.seen=t;log('mark',mk_.o>0?pick([`${p.name} circles the mark. Out`,`${p.name} points to the mark, just out`,`${p.name} checks the mark. Out by a whisker`]):pick([`${p.name} checks the mark. It caught the line`,`${p.name} looks at the mark and shrugs. Good`]),{o:mk_.o>0});}}
      else p.arm='carry';
      match.afterT=Math.max(match.afterT,Math.min(7,match.phaseT+(mk_.seen?Math.max(0,1.4-(t-mk_.seen)):.5)));
      continue;
    }
    steer(p,p.x,p.z,0,dt,5);p.crouch=0;
    if(p.mood>0){p.mood-=dt;p.arm=p.moodArm;}else if(!p.sw)p.arm='carry';
  }
  if(match.phaseT===dt){
    // Reactions: a fist pump on a big point, a slammed racket now and then on a loose one.
    const w=players[rally.winner],l=w?other(w):null;
    if(w&&(rally.shots>9||stakes()===null&&rally.how.includes('ace')||chance(.12))){w.mood=rr(.8,1.6);w.moodArm='fist';}
    if(l&&/goes|net/.test(rally.how)&&!/forces|stretched/.test(rally.how)&&chance(.1*l.temper+.02)){l.mood=.6;l.moodArm='slam';l.actT=0;if(chance(.5))log('temper',`${l.name} smacks the racket against the ${SURF.kind==='hard'?'court':SURF.kind}`,{});}
  }
  if(match.phaseT<match.afterT)return;
  for(const p of players){p.sw=null;p.plan=null;p.mood=0;p.toNet=false;p.home=null;p.pickAt=null;}
  match.mark=null;
  liftBall();
  if(match.let){match.let=false;match.phase='between';match.phaseT=0;return;}
  if(match.second){match.second=false;match.phase='between';match.phaseT=0;return;}
  match.serveNo=1;
  if(match.over!==undefined&&match.over!==null){startEnd();return;}
  if(match.changeNext){startChange();return;}
  match.phase='between';match.phaseT=0;
}

/* ---------- changeovers, set breaks and the end of a match ---------- */
function startChange(){
  match.changeNext=false;const sit=match.sitNext;match.sitNext=false;
  for(const p of players){const e=endOf(p);p.path=[[6.7,e*2.2]];if(sit)p.path.push([CHAIR.x-.05,CHAIR.z[e>0?1:0],1.4]);p.goSit=sit;p.rest=0;}
  if(!sit){match.end=match.end.map(e=>-e);for(const p of players)p.path.push([6.7,endOf(p)*2.2]);match.phase='between';match.phaseT=0;return;}
  match.phase='change';match.phaseT=0;match.rest=rr(22,55);
  if(chance(.4))log('change','Changeover. Both head for their chairs',{});
}
function changeTick(dt){
  match.phaseT+=dt;
  let seated=0;
  for(const p of players){
    if(p.sit){seated++;p.rest+=dt;p.fatigue=Math.max(0,p.fatigue-dt*.02);
      if(p.drinkT>0){p.drinkT-=dt;p.arm='drink';}else if(p.towelT>0){p.towelT-=dt;p.arm='towel';}else{p.arm='carry';if(chance(dt*.12))p.drinkT=rr(1.2,2.6);else if(chance(dt*.06))p.towelT=rr(1.5,3);}
      continue;}
    if(p.path&&p.path.length){walkPath(p,dt);if(!p.path.length&&p.goSit){p.sit=true;p.face=Math.PI;p.vx=p.vz=0;p.x=CHAIR.x-.04;p.z=CHAIR.z[p.z>0?1:0];p.fp=null;}}
    else steer(p,p.x,p.z,0,dt);
  }
  // At a set break on clay the marks fade as the court is dragged and the lines swept.
  if(seated===2&&match.sweep&&match.phaseT>match.rest*.3){if(marksA===1)log('sweep','The court is dragged and the lines swept during the set break',{});marksA-=dt/6;if(marksA<=0){match.sweep=false;marksA=1;MARKS.length=0;paintMarks();}}
  if(seated===2&&match.phaseT>match.rest){
    match.end=match.end.map(e=>-e);
    for(const p of players){p.sit=false;p.x-=.35;p.goSit=false;p.drinkT=p.towelT=0;
      if(p.string){p.string=false;log('racket',`${p.name} pulls a fresh racket from the bag`,{});}
      p.path=[[6.7,endOf(p)*2.2]];}
    match.phase=match.ending?'newmatch':'between';match.phaseT=0;
    if(match.ending)newMatch();
  }
}
function startEnd(){
  match.phase='end';match.phaseT=0;match.shake=false;
  for(const p of players)p.path=[[rr(-.3,.3)+(p.x>0?.4:-.4),endOf(p)*.45,1.6]];
}
function endTick(dt){
  match.phaseT+=dt;
  for(const p of players){
    if(p.path&&p.path.length){walkPath(p,dt);continue;}
    steer(p,p.x,p.z,0,dt);faceTo(p,Math.atan2(other(p).z-p.z,other(p).x-p.x),dt,6);p.arm=match.shake?'shake':'carry';
  }
  if(!match.shake&&players.every(p=>!p.path.length)){match.shake=true;match.shakeT=match.phaseT;log('shake','They meet at the net and shake hands',{});}
  if(match.shake&&match.phaseT-match.shakeT>1.6){
    for(const p of players){const e=endOf(p);p.path=[[6.4,e*1.6],[CHAIR.x-.05,CHAIR.z[e>0?1:0],1.4]];p.goSit=true;p.rest=0;}
    match.phase='change';match.phaseT=0;match.rest=rr(35,80);match.ending=true;
  }
}
function newMatch(){
  match.ending=false;match.over=null;match.sets=[];match.games=[0,0];match.pts=[0,0];match.tb=false;match.matches++;
  match.server=ri(0,1);match.serveNo=1;scoreDirty=true;
  for(const p of players){p.conf=0;p.fatigue=0;}
  log('newmatch',`Match ${match.matches}. ${players[1-match.server].name} spins the racket, and ${players[match.server].name} will serve`,{});
  match.phase='between';match.phaseT=0;
}

/* ---------- ambient events on their own timers ---------- */
const E={cats:[],walkers:[],leaves:[],bats:[],planes:[],ravens:[]};
const SCHED={cat:{m:120,f:25},walker:{m:70,f:8},flicker:{m:140,f:40},leaves:{m:160,f:30},bats:{m:210,f:50},plane:{m:200,f:20},tie:{m:320,f:150},raven:{m:240,f:60}};
for(const kk in SCHED)SCHED[kk].next=expo(SCHED[kk].f);
const SPAWN={
  cat(){
    if(E.cats.length)return false;
    // The court is fenced all round, so a cat can only come up to the far fences from outside.
    const coat=pick(COATS),lane=chance(.5)?'z':'x',span=lane==='z'?13:22,half=lane==='z'?FENCE.x:FENCE.z,dir=chance(.5)?1:-1;
    E.cats.push({lane,span,half,dir,u:-dir*span,off:rr(1,1.6),offGoal:.22,goal:rr(-.75,.75)*half,spd:rr(.5,.85),
      state:'walk',step:'approach',tries:ri(1,3),scratched:false,coat,T:0,dur:0,ph:rr(0,5),x:0,z:0,face:0});
    log('cat',`${cap(anOf(coat[0]))} ${coat[0]} cat pads up to the ${lane==='z'?'far':'side'} fence`,{c:coat[0],l:lane});
  },
  walker(){
    if(E.walkers.length>1)return false;
    // Everyone has their own pace: a stroll, a walk, a brisk walk, a jog or the odd run.
    const kind=wpick([['stroll',2],['walk',3],['brisk',1.4],['jog',1.2],['run',.3],['dog',1.6],['pair',.9]]);
    const base={stroll:rr(.7,1.05),walk:rr(1.05,1.45),brisk:rr(1.45,1.85),jog:rr(2.3,3.3),run:rr(3.6,4.6),dog:rr(.9,1.4),pair:rr(.8,1.2)}[kind];
    const back=chance(.5),dir=chance(.5)?1:-1;
    const lane=back?{fixed:'z',v:-FENCE.z-rr(.8,1.5)}:{fixed:'x',v:-FENCE.x-rr(.8,1.5)};
    const fast=kind==='jog'||kind==='run';
    const n=kind==='pair'?2:1,people=[];
    for(let i=0;i<n;i++){const q=mkWalker();q.arm=fast?'side':wpick([['side',3],['pockets',1.4],['phone',kind==='pair'?.2:1]]);people.push(q);}
    const span=back?22:26;
    const w={lane,u:-dir*span,end:dir*span,dir,kind,base,v:base,seed:rr(0,500),
      stop:!fast&&chance(.4)?rr(-8,8):null,stopT:rr(3,10),people,ph:rr(0,6),dogCol:pick(['#8a6a48','#1c1b27','#d6d4de','#c8742f'])};
    E.walkers.push(w);
    const what={stroll:'Someone strolls past',walk:'Someone walks past',brisk:'Someone hurries past',jog:'A jogger runs past',run:'A runner sprints past',dog:'Someone walks a dog past',pair:'Two people stroll past'}[kind];
    log('walker',`${what} ${back?'behind the far fence':'along the side fence'}`,{k:kind,b:back});
  },
  flicker(){
    const L=pick(LIGHTS);if(L.mode)return false;
    if(chance(.25)){L.mode='out';L.until=t+rr(8,30);log('light','One of the floodlights cuts out',{});}
    else{L.mode='flicker';L.until=t+rr(1,3.5);log('light','A floodlight flickers and buzzes',{});}
  },
  leaves(){
    const n=ri(5,16),dir=wind>=0?1:-1;
    for(let i=0;i<n;i++)E.leaves.push({x:dir>0?rr(-12,-9):rr(9,12),z:rr(-16,16),h:rr(0,.6),vx:dir*rr(1.4,3.2),vz:rr(-.6,.6),ph:rr(0,6),col:pick(['#8a5a2a','#a87a3a','#6a4a22','#b8903a'])});
    log('leaves','A gust sends leaves skittering across the court',{n});
  },
  bats(){
    const n=ri(1,3),dir=chance(.5)?1:-1;
    for(let i=0;i<n;i++)E.bats.push({x:dir>0?-14:14,z:rr(-12,12),h:rr(6,10),vx:dir*rr(4,7),vz:rr(-1.5,1.5),ph:rr(0,6),wob:rr(1,3)});
    log('bats',n>1?'Bats flit over the lights':'A bat flits over the lights',{n});
  },
  plane(){
    if(horizon<40)return false;
    const dir=chance(.5)?1:-1;E.planes.push({x:dir>0?-20:W+20,y:rr(.08,.5)*horizon,v:dir*rr(25,50)*DPR,ph:rr(0,2)});
    log('plane','A plane blinks across the sky',{});
  },
  raven(){
    if(E.ravens.length)return false;
    // A raven drops in to perch on the empty umpire's chair: on the backrest or the seat.
    const top=chance(.6),from=chance(.5)?1:-1;
    E.ravens.push({state:'fly',x:-14,z:from*rr(6,16),h:rr(8,11),tx:UMP.x+(top?-.25:0),tz:UMP.z+rr(-.15,.15),th:top?UMP.h+.62:UMP.h+.05,
      T:0,dur:expo(45)+20,ph:rr(0,6),look:chance(.5)?1:-1,lookT:rr(1,4),act:null,actT:0,vx:0,vz:0,vh:0});
    log('raven',`A raven glides down and perches on the umpire's ${top?'chair':'seat'}`,{t:top});
  },
  tie(){
    if(match.phase!=='between')return false;
    const p=pick(players);if(p.tieT>0||p.path?.length)return false;
    p.tieT=rr(3,6);log('tie',`${p.name} stops to tie a shoelace`);
  }
};
// What a cat at the fence does next: scratch, try another spot, sit and give up, then wander off.
function catNext(c){
  c.T=0;
  if(c.step==='leave'){c.gone=true;return;}
  if(c.step==='approach'||c.step==='spot'){
    c.state='scratch';c.step='scratch';c.dur=rr(2,5.5);
    log('catscratch',c.scratched?'The cat tries another spot along the fence':'The cat paws at the fence, trying to find a way in',{});c.scratched=true;return;
  }
  if(c.step==='scratch'){
    if(--c.tries>0){c.state='walk';c.step='spot';c.goal=clamp(c.u+(chance(.5)?1:-1)*rr(1.5,4),-c.half*.9,c.half*.9);return;}
    c.state=chance(.5)?'groom':'sit';c.step='tired';c.dur=rr(4,9);
    log('cattired','No way in. The cat gives up and sits a while',{});return;
  }
  if(c.step==='tired'){
    c.state='walk';c.step='leave';c.goal=(chance(.5)?1:-1)*c.span;c.offGoal=rr(.8,1.4);
    if(chance(.5))log('catleave','The cat wanders off into the dark',{});
  }
}
function mkWalker(){
  return{walker:true,hgt:rr(1.55,1.92),look:mkLook(['grey','#8a8a96'],true),hand:1,
    x:0,z:0,vx:0,vz:0,face:0,j:0,jv:0,air:false,crouch:0,cr:0,gait:rr(0,6),arm:'side',tie:0,sit:false,dhand:1};
}
function runSched(){
  for(const kk in SCHED){const s=SCHED[kk];if(t<s.next)continue;
    if(SPAWN[kk]()===false){s.next=t+rr(2,6);continue;}
    s.next=t+expo(s.m);
  }
}
function updateAmbient(dt){
  windT+=dt;wind=(fbm(windT*.02+40)-.5)*2.4;
  for(const L of LIGHTS){
    if(L.mode==='flicker'){L.I=chance(.5)?rr(.2,1):L.I;if(t>L.until){L.mode=null;L.I=1;}}
    else if(L.mode==='out'){L.I=t>L.until-.8?(chance(.5)?1:.1):.05;if(t>L.until){L.mode=null;L.I=1;log('light','The floodlight hums back on',{});}}
    else L.I=1-.03*Math.sin(t*50+L.x);
  }
  // Cats stay outside the fence. One paws at the mesh in a spot or two, finds no way in, gets tired and leaves.
  for(const c of E.cats){
    c.T+=dt;
    if(c.state==='walk'||c.state==='run'){
      const v=c.state==='run'?3.2:c.spd,d=c.goal-c.u;
      c.u+=Math.sign(d)*Math.min(Math.abs(d),v*dt);c.off+=clamp(c.offGoal-c.off,-.6*dt,.6*dt);
      if(Math.abs(d)<.05&&Math.abs(c.offGoal-c.off)<.05)catNext(c);
    }else if(c.T>c.dur)catNext(c);
    if(c.lane==='z'){c.x=c.u;c.z=-FENCE.z-c.off;}else{c.x=-FENCE.x-c.off;c.z=c.u;}
    const along=Math.sign(c.goal-c.u)||c.dir;
    c.face=c.state==='walk'||c.state==='run'?(c.lane==='z'?(along>0?0:Math.PI):(along>0?Math.PI/2:-Math.PI/2)):(c.lane==='z'?Math.PI/2:0);
    // A ball slamming into the fence close by sends it running.
    if(c.state!=='run'&&(ball.live||loose.length)&&hyp(ball.x-c.x,ball.z-c.z)<1.4&&hyp(ball.vx,ball.vz)>2.5){
      c.state='run';c.step='leave';c.goal=(c.u>=0?1:-1)*c.span;c.offGoal=1.4;log('catball','A ball smacks into the fence and the cat bolts',{});}
  }
  E.cats=E.cats.filter(c=>!c.gone);
  // The raven flies in, sits a while, preens, hops, looks about and caws, and leaves when play comes too close.
  for(const r of E.ravens){
    r.T+=dt;r.ph+=dt;
    if(r.state==='fly'){
      const dx=r.tx-r.x,dz=r.tz-r.z,dh=r.th-r.h,d=hyp(dx,dz,dh),v=Math.min(7,1.2+d*1.4);
      if(d<.05){r.state='perch';r.T=0;r.x=r.tx;r.z=r.tz;r.h=r.th;continue;}
      r.vx=dx/d*v;r.vz=dz/d*v;r.vh=dh/d*v;r.x+=r.vx*dt;r.z+=r.vz*dt;r.h+=r.vh*dt;
    }else if(r.state==='perch'){
      r.lookT-=dt;if(r.lookT<=0){r.look=-r.look;r.lookT=rr(.8,5);}
      if(r.act){r.actT-=dt;if(r.actT<=0)r.act=null;}
      else if(chance(dt*.25)){r.act=wpick([['preen',1],['caw',.7],['hop',.5],['ruffle',.5]]);r.actT=r.act==='caw'?rr(.8,1.6):r.act==='hop'?.35:rr(1.2,3);
        if(r.act==='caw'&&chance(.5))log('caw',pick(['The raven caws into the night','The raven croaks at the players','A hoarse caw from the umpire\'s chair']),{});
        if(r.act==='hop')r.look=-r.look;}
      const scare=(ball.live&&hyp(ball.x-r.x,ball.z-r.z,ball.h-r.h)<2.2)||players.some(p=>hyp(p.x-r.x,p.z-r.z)<1.6);
      if(scare||r.T>r.dur){r.state='leave';r.T=0;const a=rr(-2.6,-1.2);r.vx=Math.cos(a)*5;r.vz=Math.sin(a)*5;r.vh=2.2;
        log('ravenoff',scare?'Something startles the raven and it flaps away':'The raven flaps off into the dark',{s:scare});}
    }else{r.x+=r.vx*dt;r.z+=r.vz*dt;r.h+=r.vh*dt;r.vh=Math.min(3.5,r.vh+dt*.6);if(r.h>14||Math.abs(r.x)>20||Math.abs(r.z)>24)r.gone=true;}
  }
  E.ravens=E.ravens.filter(r=>!r.gone);
  // Walkers drift a little faster and slower, ease into and out of a stop, and turn to watch when they do.
  for(const w of E.walkers){
    w.ph+=dt;
    let target=w.base*(1+.36*(noise(t*.15+w.seed)-.5));
    if(w.stop!==null){
      const left=(w.stop-w.u)*w.dir;
      if(left<=w.v*w.v/3.2+.05)target=0;
      if(w.v<.05&&left<1){w.stopT-=dt;if(!w.logged){w.logged=true;if(chance(.5))log('watch','They stop for a moment to watch',{});}if(w.stopT<=0)w.stop=null;}
    }
    w.v+=clamp(target-w.v,-1.6*dt,1.2*dt);
    w.u+=w.dir*w.v*dt;w.dph=(w.dph||0)+dt*w.v*4.5;
    const moving=w.v>.08;
    w.people.forEach((p,i)=>{
      const off=i*.55;
      const toCourt=w.lane.fixed==='z'?Math.PI/2:0;
      if(w.lane.fixed==='z'){p.x=w.u-w.dir*off;p.z=w.lane.v+i*.35;p.vx=w.dir*w.v;p.vz=0;}
      else{p.z=w.u-w.dir*off;p.x=w.lane.v-i*.35;p.vz=w.dir*w.v;p.vx=0;}
      const heading=w.lane.fixed==='z'?(w.dir>0?0:Math.PI):(w.dir>0?Math.PI/2:-Math.PI/2);
      faceTo(p,moving?heading:toCourt,dt,4);
      updateFeet(p,dt);p.pose=limbsOf(p,poseOf(p));
    });
    if((w.dir>0&&w.u>w.end)||(w.dir<0&&w.u<w.end))w.gone=true;
  }
  E.walkers=E.walkers.filter(w=>!w.gone);
  for(const l of E.leaves){l.x+=(l.vx+wind*.6)*dt;l.z+=l.vz*dt;l.ph+=dt*6;l.h=Math.max(0,l.h+Math.sin(l.ph)*.4*dt);l.vz+=rr(-.5,.5)*dt;}
  E.leaves=E.leaves.filter(l=>l.x>-14&&l.x<14);
  for(const b of E.bats){b.x+=b.vx*dt;b.z+=b.vz*dt+Math.sin(t*b.wob)*.03;b.ph+=dt*14;}
  E.bats=E.bats.filter(b=>Math.abs(b.x)<15);
  for(const p of E.planes){p.x+=p.v*dt;p.ph+=dt;}
  E.planes=E.planes.filter(p=>p.x>-40&&p.x<W+40);
}

/* ---------- update ---------- */
const TICK={between:betweenTick,serve:serveTick,rally:rallyTick,after:afterTick,change:changeTick,end:endTick};
function update(dt){
  t+=dt;
  runSched();
  for(const p of players)p.actT+=dt;
  if(TICK[match.phase])TICK[match.phase](dt);
  // Keep the two players from walking through each other.
  const a=players[0],b=players[1],dx=b.x-a.x,dz=b.z-a.z,d=hyp(dx,dz);
  if(d<.5&&d>1e-4&&!a.sit&&!b.sit){const push=(.5-d)/2;a.x-=dx/d*push;a.z-=dz/d*push;b.x+=dx/d*push;b.z+=dz/d*push;}
  for(const p of players){
    if(!p.sit)integrate(p,dt);
    p.land=Math.max(0,(p.land||0)-dt);p.cr=lerp(p.cr===undefined?p.crouch:p.cr,p.crouch,1-Math.exp(-dt*6));
    // On clay a hard stop turns into a slide: planted feet skid along with the body.
    const sp=hyp(p.vx,p.vz),dec=((p.lastSp||0)-sp)/dt;p.lastSp=sp;
    if(SURF.kind==='clay'&&!p.air&&!p.sit&&sp>1.6&&dec>4)p.slideT=.28;
    if(p.slideT>0&&p.fp){p.slideT-=dt;for(const f of p.fp)if(!f.sw){const x0=f.x,z0=f.z;f.x+=p.vx*dt*.9;f.z+=p.vz*dt*.9;f.fx=f.tx=f.x;f.fz=f.tz=f.z;addMark({k:'slide',x:x0,z:z0,x1:f.x,z1:f.z});}}
    updateFeet(p,dt);
    EASE.hands=p.sw?90:18;p.pose=limbsOf(p,easePose(p,poseOf(p),dt));
  }
  // The ball in play, or on its way up from the toss.
  if(!ball.held&&(ball.live||ball.toss)){
    for(let i=0;i<4;i++){const ev=ballStep(ball,dt/4,false);if(ev==='bounce'&&ball.live)addMark({k:'ball',x:ball.x,z:ball.z,a:Math.atan2(ball.vz,ball.vx),l:.05+hyp(ball.vx,ball.vz)*.002});if(ev&&ball.live)ruleEvent(ev);}
    ball.spin+=hyp(ball.vx,ball.vz)*dt*5;
    ball.trail.unshift([ball.x,ball.z,ball.h]);if(ball.trail.length>5)ball.trail.pop();
    if(rally.net&&ball.live&&!ball.netHit){ball.netHit=true;netShake=1;}
  }else ball.trail.length=0;
  for(const lb of loose)if(lb.h>BR+1e-3||hyp(lb.vx,lb.vz,lb.vh)>.02){for(let i=0;i<2;i++)ballStep(lb,dt/2,false);lb.spin=(lb.spin||0)+hyp(lb.vx,lb.vz)*dt*5;}
  netShake*=Math.pow(.03,dt);
  watchdog(dt);
  updateAmbient(dt);
}
let netShake=0;
// If play ever stops moving, set up a fresh point rather than freezing.
let lastPhase='',phaseT=0;
function watchdog(dt){
  if(match.phase!==lastPhase){lastPhase=match.phase;phaseT=0;}else phaseT+=dt;
  if(match.phase==='rally'&&!rally.over&&t-rally.hitT>12){const A=players[rally.last];endRally(A.id,`The point goes to ${A.name}`);return;}
  if(phaseT<150)return;
  stats.resets=(stats.resets||0)+1;phaseT=0;
  liftBall();loose.length=0;
  for(const p of players){p.sw=null;p.plan=null;p.path=null;p.fetch=null;p.pickT=0;p.tieT=0;p.sit=false;p.air=false;p.j=0;p.home=null;p.balls=0;}
  server().balls=3;match.serveNo=1;match.phase='between';match.phaseT=0;
}

/* ---------- drawing ---------- */
const P2=v=>[sx(v[0],v[1]),sy(v[0],v[1],v[2])];
function line(a,b,w,col){ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}
function poly(pts,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();ctx.fill();}
function glowLine(a,b,w,col,blur){ctx.save();ctx.shadowColor=col;ctx.shadowBlur=blur;line(a,b,w,col);ctx.restore();}
const off=(p,v,s)=>[p[0]+v[0]*s,p[1]+v[1]*s];

// Soft floor shadows: a tight contact shadow plus one long shadow away from each floodlight.
function shadowsFor(x,z,len,width,dark){
  toGround(ctx);
  for(const L of LIGHTS){
    if(L.I<.15)continue;
    const dx=x-L.x,dz=z-L.z,dl=hyp(dx,dz)||1,ux=dx/dl,uz=dz/dl;
    ctx.save();ctx.translate(x+ux*len*.5,z+uz*len*.5);ctx.rotate(Math.atan2(uz,ux));ctx.scale(len*.5,width);
    const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(0,0,6,${(.3*dark*L.I).toFixed(3)})`);g.addColorStop(1,'rgba(0,0,6,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  const g=ctx.createRadialGradient(x,z,0,x,z,width*1.4);g.addColorStop(0,`rgba(0,0,6,${(.5*dark).toFixed(3)})`);g.addColorStop(1,'rgba(0,0,6,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,z,width*1.4,0,Math.PI*2);ctx.fill();
  reset(ctx);
}

/* A person, rebuilt from their pose each frame and dressed from their look: a hoodie, tank, tee or jacket,
   shorts with socks or joggers, shoes, and a head with hair, headwear, shades and a beard to match. */
function drawPerson(p){
  const P=p.pose,L=p.look;if(!P)return;
  const fx=Math.cos(p.face),fz=Math.sin(p.face),wx=-fz,wz=fx;   // facing and the body's side, in world space
  const side=[(wx-wz)*k,(wx+wz)*k*.5],sl=hyp(side[0],side[1])||1,sv=[side[0]/sl,side[1]/sl];
  const toCam=Math.cos(p.face-Math.PI/4);              // 1 when facing the viewer, -1 when facing away
  const faceDir=[(fx-fz),(fx+fz)*.5];
  const W3=(b,s,d,f,up)=>[b[0]+wx*s*d+fx*(f||0),b[1]+wz*s*d+fz*(f||0),b[2]+(up||0)];
  const head=P2(P.head);
  const depth=v=>v[0]+v[1];
  const fo=depth(P.feet[0])<depth(P.feet[1])?[0,1]:[1,0];
  const ao=depth(P.hands[0])<depth(P.hands[1])?[0,1]:[1,0];
  const mix=(a,b,u)=>[lerp(a[0],b[0],u),lerp(a[1],b[1],u)];
  ctx.lineCap='round';ctx.lineJoin='round';
  const legW=.15*k,armW=.1*k,c=p.cr||0;
  const rkFront=P.rk&&!P.rk.away&&depth(P.rk.head)>depth(P.hip)+.04;
  const sleeved=L.top==='hoodie'||L.top==='jacket';
  const leg=(i,far)=>{
    const ft=P.feet[i],s=i?-1:1,A=P2(P.hipJ[i]),K=P2(P.knees[i]),F=P2(ft);
    const dk=col=>far?shade(col,-.4):col;
    if(L.bottom==='shorts'||L.bottom==='skirt'){
      line(A,K,legW*.82,dk(L.skin));line(K,F,legW*.74,dk(L.skin));
      line(mix(F,K,.3),F,legW*.78,dk(L.socks));
      if(L.bottom==='shorts')line(A,mix(A,K,.82),legW*1.2,dk(L.botCol));
      if(!far){ctx.globalAlpha=.18;line(off(K,sv,s*legW*.2),off(mix(K,F,.6),sv,s*legW*.2),legW*.2,'#fff');ctx.globalAlpha=1;}
    }else{
      line(A,K,legW,dk(L.botCol));line(K,F,legW*.82,dk(L.botCol));
      if(!far){ctx.globalAlpha=.2;line(off(A,sv,s*legW*.22),off(K,sv,s*legW*.22),legW*.22,'#fff');ctx.globalAlpha=1;}
      crease(A,K,F,legW,far);
    }
    // Shoe, pointing the way the player faces.
    const fl=Math.hypot(faceDir[0],faceDir[1])||1,fd=[faceDir[0]/fl,faceDir[1]/fl];
    ctx.save();ctx.translate(F[0]+fd[0]*.05*k,F[1]+fd[1]*.05*k);ctx.rotate(Math.atan2(fd[1],fd[0]));
    ctx.fillStyle=dk(L.shoes);ctx.beginPath();ctx.ellipse(0,0,.15*k,.065*k,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=L.sole;ctx.fillRect(-.15*k,.03*k,.3*k,.03*k);
    if(L.trim){ctx.fillStyle=L.trim[0];ctx.globalAlpha=.9;ctx.fillRect(-.06*k,-.03*k,.08*k,.025*k);ctx.globalAlpha=1;}
    ctx.restore();
  };
  const arm=(i,far)=>{
    const hd=P.hands[i],S=P2(P.shJ[i]),E2=P2(P.elb[i]),Hd=P2(hd);
    const dk=col=>far?shade(col,-.3):col;
    if(sleeved){
      line(S,E2,armW*1.2,dk(L.topCol));line(E2,Hd,armW,dk(L.topCol));
      crease(S,E2,Hd,armW,far);
      if(L.trim&&!far)glowLine(S,E2,.016*k,L.trim[1],.1*k);
    }else{
      line(S,E2,armW*1.02,dk(L.skin));line(E2,Hd,armW*.9,dk(L.skin));
      if(L.top==='tee'||L.top==='polo')line(S,mix(S,E2,.55),armW*1.4,dk(L.topCol));
    }
    if(L.wrist&&i===0)line(mix(E2,Hd,.78),mix(E2,Hd,.94),armW*1.3,dk(L.wrist));
    ctx.fillStyle=dk(L.skin);ctx.beginPath();ctx.arc(Hd[0],Hd[1],.055*k,0,Math.PI*2);ctx.fill();
  };
  if(P.rk&&!rkFront&&!P.rk.away)drawRacket(p,P,true);
  leg(fo[0],true);arm(ao[0],true);
  // A hood worn down bunches up behind the neck.
  const neckP=P2([P.sh[0],P.sh[1],P.sh[2]+.02]);
  if(L.hood==='down'){const b=P2([P.sh[0]-fx*.1,P.sh[1]-fz*.1,P.sh[2]+.06]);ctx.fillStyle=shade(L.topCol,-.15);ctx.beginPath();ctx.ellipse(b[0],b[1],.17*k,.1*k,0,0,Math.PI*2);ctx.fill();}
  // Torso: broad at the shoulders, tapering to the waist. A jacket or hoodie hangs below the hips and trails when running.
  const tanky=L.top==='tank'||L.top==='dress',shoW=tanky?.17:.24;
  const sR=P2(W3(P.sh,1,.19,0,-.04)),sLft=P2(W3(P.sh,-1,.19,0,-.04)),sR2=P2(W3(P.sh,1,shoW,0,-.12)),sL2=P2(W3(P.sh,-1,shoW,0,-.12));
  const wR=P2(W3(P.hip,1,.16,0,.16)),wL=P2(W3(P.hip,-1,.16,0,.16));
  const long=sleeved?1:0;
  const trail=s=>{const q=W3(P.hip,s,.17+.02*long*Math.sin(t*9+s),0,(long?-.1:-.03)+long*Math.min(.06,hyp(p.vx,p.vz)*.012));return P2([q[0]-p.vx*.035*long,q[1]-p.vz*.035*long,q[2]]);};
  const hR=trail(1),hL=trail(-1);
  if(!sleeved){
    // Bare shoulders and neck under a tank or tee.
    ctx.fillStyle=shade(L.skin,-.1);ctx.beginPath();ctx.ellipse(neckP[0],neckP[1]+.02*k,.2*k,.07*k,0,0,Math.PI*2);ctx.fill();
    line(neckP,[lerp(neckP[0],head[0],.6),lerp(neckP[1],head[1],.6)],.09*k,L.skin);
  }
  const tg=ctx.createLinearGradient(neckP[0],neckP[1],(hR[0]+hL[0])/2,(hR[1]+hL[1])/2);tg.addColorStop(0,shade(L.topCol,.2));tg.addColorStop(1,shade(L.topCol,-.28));
  ctx.fillStyle=tg;ctx.beginPath();
  if(tanky){const nR=mix(sR,neckP,.45),nL=mix(sLft,neckP,.45);ctx.moveTo(sR[0],sR[1]);ctx.lineTo(nR[0],nR[1]);ctx.quadraticCurveTo(neckP[0],neckP[1]+.08*k,nL[0],nL[1]);ctx.lineTo(sLft[0],sLft[1]);}
  else{ctx.moveTo(sR[0],sR[1]);ctx.quadraticCurveTo(neckP[0],neckP[1]-(sleeved?.04:-.03)*k,sLft[0],sLft[1]);}
  ctx.quadraticCurveTo(sL2[0],sL2[1]-.03*k,sL2[0],sL2[1]);ctx.lineTo(wL[0],wL[1]);ctx.lineTo(hL[0],hL[1]);
  ctx.lineTo(hR[0],hR[1]);ctx.lineTo(wR[0],wR[1]);ctx.lineTo(sR2[0],sR2[1]);ctx.quadraticCurveTo(sR2[0],sR2[1]-.03*k,sR[0],sR[1]);ctx.closePath();ctx.fill();
  // Folds: creases from the armpits toward the waist and across it, deeper as the body bends or twists.
  {const fold=clamp(.25+c*.9+hyp(p.vx,p.vz)*.06,0,1),w=mix(wR,wL,.5);
   ctx.globalAlpha=.3*fold;ctx.lineWidth=.014*k;ctx.strokeStyle='#000';ctx.beginPath();
   for(const[a,u]of[[sR2,.35],[sL2,.65]]){ctx.moveTo(a[0],a[1]);ctx.quadraticCurveTo(lerp(a[0],w[0],.5),lerp(a[1],w[1],.5)+.04*k,lerp(wR[0],wL[0],u),lerp(wR[1],wL[1],u));}
   ctx.moveTo(wR[0],wR[1]);ctx.quadraticCurveTo(w[0],w[1]+.05*k*fold,wL[0],wL[1]);ctx.stroke();ctx.globalAlpha=1;}
  // A skirt flares from the waist.
  if(L.bottom==='skirt'){const k0=P2(W3(P.hip,1,.17,0,.05)),k1=P2(W3(P.hip,-1,.17,0,.05)),m0=P2(W3(P.hip,1,.26,0,-.16-.02*Math.sin(t*7))),m1=P2(W3(P.hip,-1,.26,0,-.16-.02*Math.cos(t*7)));
    const sg=ctx.createLinearGradient(0,k0[1],0,m0[1]);sg.addColorStop(0,shade(L.botCol,.05));sg.addColorStop(1,shade(L.botCol,-.25));ctx.fillStyle=sg;
    ctx.beginPath();ctx.moveTo(k0[0],k0[1]);ctx.lineTo(m0[0],m0[1]);ctx.quadraticCurveTo((m0[0]+m1[0])/2,(m0[1]+m1[1])/2+.05*k,m1[0],m1[1]);ctx.lineTo(k1[0],k1[1]);ctx.closePath();ctx.fill();
    ctx.globalAlpha=.25;ctx.strokeStyle='#000';ctx.lineWidth=.012*k;ctx.beginPath();for(const u of[.3,.5,.7]){const a=mix(k0,k1,u),b=mix(m0,m1,u);ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}ctx.stroke();ctx.globalAlpha=1;}
  // Light from above-left catches one edge.
  const lit=sv[0]<0?1:-1;ctx.globalAlpha=.16;line(lit>0?sR2:sL2,lit>0?wR:wL,.035*k,'#fff');ctx.globalAlpha=1;
  if(L.trim){
    if(sleeved){
      glowLine(mix(sR,sLft,.25),mix(hR,hL,.3),.022*k,L.trim[0],.14*k);
      glowLine(mix(sR,sLft,.8),mix(hR,hL,.72),.018*k,L.trim[1],.12*k);
      if(toCam>-.2){ctx.globalAlpha=.6;line(mix(sR,sLft,.5),mix(hR,hL,.5),.012*k,'#000');ctx.globalAlpha=1;}
    }else{
      // Piping round the neckline and down the sides.
      ctx.save();ctx.shadowColor=L.trim[0];ctx.shadowBlur=.08*k;ctx.strokeStyle=L.trim[0];ctx.lineWidth=.014*k;
      ctx.beginPath();ctx.moveTo(mix(sR,neckP,.45)[0],mix(sR,neckP,.45)[1]);ctx.quadraticCurveTo(neckP[0],neckP[1]+.08*k,mix(sLft,neckP,.45)[0],mix(sLft,neckP,.45)[1]);
      ctx.moveTo(sR2[0],sR2[1]);ctx.lineTo(hR[0],hR[1]);ctx.moveTo(sL2[0],sL2[1]);ctx.lineTo(hL[0],hL[1]);ctx.stroke();ctx.restore();
    }
  }
  // Jersey number, on the chest or the back.
  if(L.number){const m=mix(neckP,mix(wR,wL,.5),.5);ctx.save();ctx.font=`800 ${Math.max(6,Math.round(.17*k))}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=L.numCol;ctx.globalAlpha=Math.abs(toCam)>.15?.95:.6;ctx.fillText(L.number,m[0],m[1]);ctx.restore();}
  if(L.top==='polo'){ctx.fillStyle=shade(L.topCol,.12);for(const s of[-1,1]){ctx.beginPath();ctx.moveTo(neckP[0]+s*.02*k,neckP[1]+.01*k);ctx.lineTo(neckP[0]+s*.13*k,neckP[1]-.01*k);ctx.lineTo(neckP[0]+s*.06*k,neckP[1]+.09*k);ctx.closePath();ctx.fill();}}
  // Scarf, or a high collar, wrapped at the neck.
  if(L.neck){const n=[(neckP[0]*2+head[0])/3,(neckP[1]*2+head[1])/3];ctx.fillStyle=L.top==='jacket'?shade(L.topCol,-.1):L.neck;ctx.beginPath();ctx.ellipse(n[0],n[1],.13*k,(L.top==='jacket'?.09:.07)*k,0,0,Math.PI*2);ctx.fill();}
  leg(fo[1],false);
  drawHead(p,head,sv,toCam,faceDir);
  arm(ao[1],false);
  if(rkFront)drawRacket(p,P,false);
}
// A fold of fabric at a bent knee or elbow: a short dark crease across the inside of the bend.
function crease(a,m,b,w,far){
  const u=[a[0]-m[0],a[1]-m[1]],v=[b[0]-m[0],b[1]-m[1]],ul=hyp(u[0],u[1])||1,vl=hyp(v[0],v[1])||1;
  const bend=1-Math.abs((u[0]*v[0]+u[1]*v[1])/(ul*vl)+1);   // 0 when straight
  if(bend<.08)return;
  const bis=[u[0]/ul+v[0]/vl,u[1]/ul+v[1]/vl],bl=hyp(bis[0],bis[1])||1,n=[-bis[1]/bl,bis[0]/bl];
  ctx.globalAlpha=Math.min(.55,bend*.9)*(far?.6:1);ctx.strokeStyle='#000';ctx.lineWidth=Math.max(.8,w*.12);
  ctx.beginPath();for(const o of[-.15,.15]){const c0=[m[0]+bis[0]/bl*w*.3+n[0]*w*o,m[1]+bis[1]/bl*w*.3+n[1]*w*o];ctx.moveTo(c0[0]-n[0]*w*.25,c0[1]-n[1]*w*.25);ctx.lineTo(c0[0]+n[0]*w*.25,c0[1]+n[1]*w*.25);}
  ctx.stroke();ctx.globalAlpha=1;
}
function drawHead(p,head,sv,toCam,faceDir){
  const L=p.look,r=.12*k,up=L.hood==='up';
  const fl=Math.hypot(faceDir[0],faceDir[1])||1,fd=[faceDir[0]/fl,faceDir[1]/fl];
  const fc=[head[0]+fd[0]*r*.35*Math.max(0,toCam),head[1]+fd[1]*r*.2];
  const hair=L.hairCol;
  if(up){
    // Hood: a peaked shell around the head, open toward the face. Its peak sways back with speed.
    const peak=[head[0]-fd[0]*r*.5-(p.vx-p.vz)*k*.012,head[1]-r*1.9-(p.vx+p.vz)*k*.006];
    const hg=ctx.createLinearGradient(head[0],peak[1],head[0],head[1]+r);hg.addColorStop(0,shade(L.topCol,.22));hg.addColorStop(1,shade(L.topCol,-.2));
    ctx.fillStyle=hg;ctx.beginPath();
    ctx.moveTo(head[0]+sv[0]*r*1.35,head[1]+r*1.05);
    ctx.quadraticCurveTo(head[0]+sv[0]*r*1.6,head[1]-r*.6,peak[0],peak[1]);
    ctx.quadraticCurveTo(head[0]-sv[0]*r*1.6,head[1]-r*.6,head[0]-sv[0]*r*1.35,head[1]+r*1.05);
    ctx.closePath();ctx.fill();
    if(L.trim){ctx.save();ctx.shadowColor=L.trim[0];ctx.shadowBlur=.1*k;ctx.strokeStyle=L.trim[0];ctx.lineWidth=.016*k;ctx.beginPath();ctx.moveTo(peak[0],peak[1]+r*.25);ctx.lineTo(head[0]-fd[0]*r*.2+sv[0]*r*.35,head[1]-r*.4);ctx.stroke();ctx.restore();}
  }else if(L.hairdo==='ponytail'&&toCam>-.25){
    drawTail(L,head,r,fd);
  }else if(L.hairdo==='long'){
    // Long hair falls behind the head to the shoulders.
    ctx.fillStyle=shade(hair,-.1);ctx.beginPath();ctx.ellipse(head[0]-fd[0]*r*.3,head[1]+r*.5,r*.95,r*1.2,0,0,Math.PI*2);ctx.fill();
  }
  if(toCam>-.25){
    // Face, shaded on the side away from the light, darker up under a hood.
    const fw=r*(.55+.35*Math.max(0,toCam)),fh=r*.95;
    const sg=ctx.createLinearGradient(fc[0]-fw,fc[1],fc[0]+fw,fc[1]);sg.addColorStop(0,shade(L.skin,.08));sg.addColorStop(1,shade(L.skin,-.35));
    ctx.fillStyle=sg;ctx.beginPath();ctx.ellipse(fc[0],fc[1]+r*.1,fw,fh,0,0,Math.PI*2);ctx.fill();
    if(up){
      const dg=ctx.createLinearGradient(0,fc[1]-fh,0,fc[1]+fh*.2);dg.addColorStop(0,'rgba(0,0,0,.6)');dg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=dg;ctx.beginPath();ctx.ellipse(fc[0],fc[1]+r*.1,fw,fh,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=hair;ctx.lineWidth=.02*k;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(fc[0]+i*fw*.3,fc[1]-fh*.7);ctx.lineTo(fc[0]+i*fw*.35+fd[0]*r*.1,fc[1]-fh*.25);ctx.stroke();}
    }else drawHair(L,head,r,fd,true);
    if(L.shades&&toCam>0){
      // Shades with the neon city reflected in them.
      const ey=fc[1]-r*.05,ew=fw*.95,eh=r*(L.shades==='wrap'?.24:.3);
      const a0=L.trim?L.trim[0]:'#38c8ff',a1=L.trim?L.trim[1]:'#ffcf7a';
      const lg=ctx.createLinearGradient(fc[0]-ew,ey-eh,fc[0]+ew,ey+eh);lg.addColorStop(0,a0);lg.addColorStop(.5,'#0a0a14');lg.addColorStop(1,a1);
      ctx.fillStyle=lg;
      if(L.shades==='wrap'){ctx.beginPath();ctx.ellipse(fc[0],ey,ew,eh,0,0,Math.PI*2);ctx.fill();}
      else{for(const s of[-1,1]){ctx.beginPath();ctx.ellipse(fc[0]+s*ew*.48,ey,ew*.45,eh,0,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='#0a0a12';ctx.lineWidth=.012*k;ctx.beginPath();ctx.moveTo(fc[0]-ew*.1,ey-eh*.3);ctx.lineTo(fc[0]+ew*.1,ey-eh*.3);ctx.stroke();}
      ctx.fillStyle='rgba(255,255,255,.75)';ctx.fillRect(fc[0]-ew*.6,ey-eh*.55,ew*.25,eh*.25);
    }else if(toCam>.2){
      // Eyes, when there are no shades.
      ctx.fillStyle='#120c10';for(const s of[-1,1]){ctx.beginPath();ctx.ellipse(fc[0]+s*fw*.38,fc[1]-r*.02,r*.07,r*.05,0,0,Math.PI*2);ctx.fill();}
    }
    if(toCam>.1){
      if(L.beard==='goatee'){ctx.fillStyle=hair;ctx.beginPath();ctx.ellipse(fc[0],fc[1]+r*.72,fw*.28,r*.18,0,0,Math.PI*2);ctx.fill();ctx.fillRect(fc[0]-fw*.35,fc[1]+r*.38,fw*.7,r*.06);}
      else if(L.beard==='full'){ctx.fillStyle=hair;ctx.globalAlpha=.85;ctx.beginPath();ctx.ellipse(fc[0],fc[1]+r*.6,fw*.9,r*.45,0,0,Math.PI);ctx.fill();ctx.globalAlpha=1;}
      ctx.strokeStyle=shade(L.skin,-.55);ctx.lineWidth=.012*k;ctx.beginPath();ctx.arc(fc[0],fc[1]+r*.3,fw*.28,.25*Math.PI,.75*Math.PI);ctx.stroke();
    }
  }else if(!up){
    // The back of the head.
    if(L.hairdo==='buzz'||L.hairdo==='fade'){ctx.fillStyle=L.skin;ctx.beginPath();ctx.arc(head[0],head[1],r,0,Math.PI*2);ctx.fill();}
    drawHair(L,head,r,fd,false);
  }else if(L.trim){glowLine([head[0],head[1]-r*1.3],[head[0],head[1]+r*.6],.016*k,L.trim[1],.1*k);}
  if(!up&&L.headwear)drawHeadwear(L,head,r,fd,toCam);
}
function drawHair(L,head,r,fd,front){
  const c=L.hairCol;ctx.fillStyle=c;
  const top=(rx,ry,dy)=>{ctx.beginPath();ctx.ellipse(head[0],head[1]-r*(dy||.35),r*rx,r*ry,0,Math.PI,2*Math.PI);ctx.fill();};
  if(!front&&L.hairdo!=='buzz'&&L.hairdo!=='fade'){ctx.beginPath();ctx.arc(head[0],head[1],r*1.02,0,Math.PI*2);ctx.fill();}
  switch(L.hairdo){
    case 'buzz':ctx.globalAlpha=.85;top(1,.6,.3);ctx.globalAlpha=1;break;
    case 'fade':top(1,.75,.38);ctx.fillStyle=shade(c,.25);ctx.globalAlpha=.5;top(1.04,.45,.15);ctx.globalAlpha=1;break;
    case 'curly':for(let i=-2;i<=2;i++){ctx.beginPath();ctx.arc(head[0]+i*r*.42,head[1]-r*(.55+.15*(2-Math.abs(i))*.5),r*.38,0,Math.PI*2);ctx.fill();}break;
    case 'ponytail':top(1.04,.82);if(!front)drawTail(L,head,r,fd);break;
    case 'bun':top(1.03,.78);ctx.beginPath();ctx.arc(head[0]-fd[0]*r*.4,head[1]-r*1.1,r*.32,0,Math.PI*2);ctx.fill();break;
    default:top(1.04,.82);
  }
}
function drawTail(L,head,r,fd){const sw=Math.sin(t*5)*r*.25;ctx.fillStyle=shade(L.hairCol,-.05);ctx.beginPath();ctx.ellipse(head[0]-fd[0]*r*1.05+sw,head[1]+r*.35,r*.28,r*.75,sw/r*.4,0,Math.PI*2);ctx.fill();}
function drawHeadwear(L,head,r,fd,toCam){
  if(L.headwear==='visor'||L.headwear==='bandana'){
    const col=L.headwear==='bandana'?L.trim[0]:L.topCol;
    if(L.headwear==='bandana'){ctx.fillStyle=shade(col,-.1);ctx.beginPath();ctx.ellipse(head[0],head[1]-r*.42,r*1.06,r*.72,0,Math.PI,2*Math.PI);ctx.fill();ctx.beginPath();ctx.arc(head[0]-fd[0]*r*1,head[1]-r*.35,r*.16,0,Math.PI*2);ctx.fill();return;}
    ctx.save();ctx.strokeStyle=col;ctx.lineWidth=r*.26;ctx.beginPath();ctx.ellipse(head[0],head[1]-r*.45,r*1.02,r*.32,0,Math.PI*.05,Math.PI*.95,true);ctx.stroke();ctx.restore();
    ctx.fillStyle=shade(col,-.25);ctx.beginPath();ctx.ellipse(head[0]+fd[0]*r*.8,head[1]-r*.4+fd[1]*r*.3,r*.75,r*.22,Math.atan2(fd[1],fd[0])*.3,0,Math.PI*2);ctx.fill();
    return;
  }
  if(L.headwear==='headband'){
    ctx.save();ctx.strokeStyle=L.trim?L.trim[0]:'#e8ecff';ctx.lineWidth=r*.28;if(L.trim){ctx.shadowColor=L.trim[0];ctx.shadowBlur=.06*k;}
    ctx.beginPath();ctx.ellipse(head[0],head[1]-r*.45,r*1.02,r*.32,0,Math.PI*.05,Math.PI*.95,true);ctx.stroke();ctx.restore();
    return;
  }
  // Cap: a dome over the head and a brim, worn forward or backward.
  const col=L.trim&&!L.white?L.topCol:L.topCol,b=L.capBack?-1:1;
  ctx.fillStyle=shade(col,.05);ctx.beginPath();ctx.ellipse(head[0],head[1]-r*.4,r*1.08,r*.85,0,Math.PI,2*Math.PI);ctx.fill();
  ctx.fillStyle=shade(col,-.3);ctx.beginPath();ctx.ellipse(head[0]+fd[0]*r*.75*b,head[1]-r*.38+fd[1]*r*.3*b,r*.75,r*.22,Math.atan2(fd[1],fd[0])*.3,0,Math.PI*2);ctx.fill();
  if(L.trim){ctx.fillStyle=L.trim[0];ctx.beginPath();ctx.arc(head[0],head[1]-r*1.2,r*.12,0,Math.PI*2);ctx.fill();}
  void toCam;
}
// The avatar beside the score: the player drawn large, head and shoulders, facing the viewer.
function renderAvatar(p){
  const S=128,[c,g]=mk(S,S),keep={ctx,k,kh,ox,oy};
  const d={...p,x:0,z:0,vx:0,vz:0,face:Math.PI/4,j:0,jv:0,air:false,crouch:0,cr:0,arm:'carry',sw:null,sit:false,tie:0,fp:null,ease:null,land:0,gait:0};
  d.pose=limbsOf(d,poseOf(d));
  k=S*1.55;kh=k*.82;ox=S/2;oy=S*.46+d.pose.head[2]*kh;ctx=g;
  const bg=g.createRadialGradient(S/2,S*.4,4,S/2,S/2,S*.72);bg.addColorStop(0,shade(p.look.col,-.5));bg.addColorStop(1,'#05050c');g.fillStyle=bg;g.fillRect(0,0,S,S);
  drawPerson(d);
  ({ctx,k,kh,ox,oy}=keep);
  p.look.avatarURL=c.toDataURL();scoreDirty=true;
}
function drawCat(c){
  const moving=c.state==='walk'||c.state==='run';
  const [px,py]=P3(c.x,c.z,0),s=.5*k;
  const dirS=Math.cos(c.face)-Math.sin(c.face)>=0?1:-1;
  const ph=(t+c.ph)*(c.state==='run'?14:6);
  ctx.save();ctx.translate(px,py);ctx.scale(dirS,1);
  ctx.fillStyle=c.coat[1];ctx.strokeStyle=c.coat[1];ctx.lineCap='round';
  if(c.state==='scratch'){
    const pw=Math.sin((t+c.ph)*9);
    ctx.lineWidth=s*.07;ctx.beginPath();ctx.moveTo(-s*.12,-s*.05);ctx.quadraticCurveTo(-s*.45,0,-s*.42,-s*.12+Math.sin((t+c.ph)*2)*s*.04);ctx.stroke();
    ctx.beginPath();ctx.ellipse(s*.02,-s*.36,s*.15,s*.33,.35,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(s*.17,-s*.72,s*.13,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.moveTo(s*.1,-s*.8);ctx.lineTo(s*.12,-s*.95);ctx.lineTo(s*.18,-s*.82);ctx.moveTo(s*.21,-s*.82);ctx.lineTo(s*.28,-s*.94);ctx.lineTo(s*.28,-s*.78);ctx.fill();
    ctx.lineWidth=s*.06;ctx.beginPath();ctx.moveTo(s*.12,-s*.55);ctx.lineTo(s*.32,-s*.82-pw*s*.1);ctx.moveTo(s*.1,-s*.5);ctx.lineTo(s*.33,-s*.7+pw*s*.1);ctx.stroke();
    ctx.fillStyle=c.coat[2];ctx.beginPath();ctx.ellipse(s*.08,-s*.32,s*.06,s*.16,.35,0,Math.PI*2);ctx.fill();
    ctx.restore();return;
  }
  if(c.state==='sit'||c.state==='groom'){
    ctx.beginPath();ctx.ellipse(0,-s*.32,s*.2,s*.3,0,0,Math.PI*2);ctx.fill();
    const hy=c.state==='groom'?-s*.42:-s*.66;
    ctx.beginPath();ctx.arc(s*.08,hy,s*.13,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.moveTo(s*.0,hy-s*.08);ctx.lineTo(s*.04,hy-s*.22);ctx.lineTo(s*.1,hy-s*.1);ctx.moveTo(s*.12,hy-s*.1);ctx.lineTo(s*.19,hy-s*.22);ctx.lineTo(s*.2,hy-s*.06);ctx.fill();
    ctx.lineWidth=s*.07;ctx.beginPath();ctx.moveTo(-s*.15,-s*.05);ctx.quadraticCurveTo(-s*.45,0,-s*.35,-s*.25);ctx.stroke();
    ctx.fillStyle=c.coat[2];ctx.beginPath();ctx.ellipse(s*.08,-s*.3,s*.08,s*.15,0,0,Math.PI*2);ctx.fill();
  }else{
    ctx.lineWidth=s*.07;
    for(const[lx,o]of[[-.22,0],[-.12,Math.PI],[.16,Math.PI],[.24,0]]){const sw=moving?Math.sin(ph+o)*s*.07:0;ctx.beginPath();ctx.moveTo(s*lx,-s*.2);ctx.lineTo(s*lx+sw,0);ctx.stroke();}
    ctx.beginPath();ctx.ellipse(0,-s*.26,s*.32,s*.13,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(s*.34,-s*.42,s*.12,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.moveTo(s*.27,-s*.5);ctx.lineTo(s*.29,-s*.64);ctx.lineTo(s*.35,-s*.52);ctx.moveTo(s*.38,-s*.52);ctx.lineTo(s*.45,-s*.62);ctx.lineTo(s*.45,-s*.46);ctx.fill();
    ctx.lineWidth=s*.06;ctx.beginPath();ctx.moveTo(-s*.3,-s*.3);ctx.quadraticCurveTo(-s*.55,-s*.5+Math.sin(ph*.3)*s*.08,-s*.5,-s*.7);ctx.stroke();
    ctx.fillStyle=c.coat[2];ctx.beginPath();ctx.ellipse(s*.1,-s*.18,s*.16,s*.05,0,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle='#c8ff6a';const ex=c.state==='sit'||c.state==='groom'?s*.13:s*.4,ey=c.state==='sit'?-s*.68:c.state==='groom'?-s*.44:-s*.44;
  if(c.state!=='groom'){ctx.beginPath();ctx.arc(ex,ey,s*.025,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
// The raven: a glossy black bird with a heavy beak. Wings beat in flight. Perched, it turns its head, preens and caws.
function drawRaven(r){
  const[px,py]=P3(r.x,r.z,r.h),s=.55*k,fly=r.state!=='perch';
  const sv=fly?(r.vx-r.vz):r.look,dir=sv>=0?1:-1;
  ctx.save();ctx.translate(px,py);ctx.scale(dir,1);ctx.shadowColor='rgba(255,232,200,.45)';ctx.shadowBlur=Math.max(2*DPR,.04*k);
  const body='#0c0c14',sheen='rgba(120,140,220,.35)';
  if(fly){
    const f=Math.sin(r.ph*(r.state==='leave'?14:9));
    ctx.fillStyle=body;
    ctx.beginPath();ctx.ellipse(0,0,s*.32,s*.1,-.08,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(s*.32,-s*.04,s*.08,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.moveTo(s*.38,-s*.06);ctx.lineTo(s*.5,-s*.02);ctx.lineTo(s*.38,0);ctx.fill();
    ctx.beginPath();ctx.moveTo(-s*.28,0);ctx.lineTo(-s*.5,-s*.06);ctx.lineTo(-s*.5,s*.07);ctx.closePath();ctx.fill();
    for(const w of[1,-1]){ctx.beginPath();ctx.moveTo(-s*.08,0);ctx.quadraticCurveTo(-s*.05,-f*s*.45*w,-s*.32,-f*s*.5*w-s*.05);ctx.lineTo(s*.12,-s*.02);ctx.closePath();ctx.globalAlpha=w>0?1:.7;ctx.fill();}
    ctx.globalAlpha=1;
  }else{
    const caw=r.act==='caw',preen=r.act==='preen',hop=r.act==='hop'?Math.sin(Math.PI*clamp(1-r.actT/.35,0,1))*s*.18:0,puff=r.act==='ruffle'?1.15+.05*Math.sin(t*30):1;
    ctx.translate(0,-hop);
    ctx.strokeStyle='#2a2a30';ctx.lineWidth=Math.max(1,s*.025);ctx.beginPath();ctx.moveTo(-s*.03,0);ctx.lineTo(-s*.05,-s*.12);ctx.moveTo(s*.05,0);ctx.lineTo(s*.03,-s*.12);ctx.stroke();
    ctx.fillStyle=body;
    ctx.beginPath();ctx.moveTo(-s*.12,-s*.2);ctx.lineTo(-s*.38,-s*.04);ctx.lineTo(-s*.32,-s*.0);ctx.lineTo(-s*.06,-s*.14);ctx.fill();
    ctx.beginPath();ctx.ellipse(0,-s*.26,s*.16*puff,s*.13*puff,-.5,0,Math.PI*2);ctx.fill();
    const hx=preen?s*.02:s*.14,hy=preen?-s*.24:-s*.42;
    ctx.beginPath();ctx.arc(hx,hy,s*.085,0,Math.PI*2);ctx.fill();
    const open=caw?.5+.5*Math.abs(Math.sin(t*9)):0;
    ctx.beginPath();ctx.moveTo(hx+s*.06,hy-s*.03);ctx.lineTo(hx+s*.2,hy+s*.0-open*s*.05);ctx.lineTo(hx+s*.06,hy+s*.02);ctx.fill();
    if(open){ctx.beginPath();ctx.moveTo(hx+s*.06,hy+s*.02);ctx.lineTo(hx+s*.18,hy+s*.06*open+s*.01);ctx.lineTo(hx+s*.06,hy+s*.04);ctx.fill();}
    ctx.strokeStyle=sheen;ctx.lineWidth=Math.max(.6,s*.02);ctx.beginPath();ctx.ellipse(0,-s*.27,s*.12,s*.08,-.5,Math.PI*1.1,Math.PI*1.7);ctx.stroke();
    ctx.fillStyle='rgba(255,240,200,.8)';ctx.beginPath();ctx.arc(hx+s*.03,hy-s*.02,Math.max(.6,s*.015),0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawDog(x,z,col,ph){
  const[px,py]=P3(x,z,0),s=.55*k;ctx.save();ctx.translate(px,py);
  ctx.fillStyle=col;ctx.strokeStyle=col;ctx.lineCap='round';ctx.lineWidth=s*.08;
  for(const[lx,o]of[[-.2,0],[-.1,Math.PI],[.16,Math.PI],[.24,0]]){ctx.beginPath();ctx.moveTo(s*lx,-s*.22);ctx.lineTo(s*lx+Math.sin(ph*9+o)*s*.08,0);ctx.stroke();}
  ctx.beginPath();ctx.ellipse(0,-s*.3,s*.3,s*.13,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(s*.32,-s*.46,s*.13,s*.1,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.moveTo(-s*.28,-s*.34);ctx.lineTo(-s*.42,-s*.5+Math.sin(ph*12)*s*.05);ctx.stroke();
  ctx.restore();
}
// The racket: a grip, a throat and an oval head with strings, placed in 3D from the hand and the racket's direction.
function drawRacket(p,P,far){
  const rk=P.rk,d=rk.dir,G0=rk.grip,L=p.look;
  const pt=(u,v,a2)=>P2([G0[0]+d[0]*u+a2[0]*v,G0[1]+d[1]*u+a2[1]*v,G0[2]+d[2]*u+a2[2]*v]);
  // The face of the strings looks the way the body faces.
  const f=[Math.cos(p.face),Math.sin(p.face),0];
  let a2=[d[1]*f[2]-d[2]*f[1],d[2]*f[0]-d[0]*f[2],d[0]*f[1]-d[1]*f[0]];
  const al=hyp(a2[0],a2[1],a2[2]);a2=al>.15?[a2[0]/al,a2[1]/al,a2[2]/al]:[-f[1],f[0],0];
  const col=far?shade(L.racket,-.3):L.racket;
  ctx.lineCap='round';
  // A blur of the head through a fast swing.
  const sw=p.sw;
  if(sw&&Math.abs(sw.u)<.45&&sw.kind!=='feed'&&p.rkTrail&&p.rkTrail.length>1){ctx.globalAlpha=.16;ctx.strokeStyle='#fff';ctx.lineWidth=.22*k;ctx.beginPath();p.rkTrail.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.stroke();ctx.globalAlpha=1;}
  line(pt(-.07,0,a2),pt(.12,0,a2),.035*k,'#14141a');
  line(pt(.1,0,a2),pt(.27,0,a2),.022*k,col);
  const ring=[];for(let i=0;i<20;i++){const a=i/20*Math.PI*2;ring.push(pt(RL+Math.cos(a)*.17,Math.sin(a)*.13,a2));}
  // Throat: the frame splits around the bottom of the head.
  line(pt(.27,0,a2),pt(RL-.15,.07,a2),.02*k,col);line(pt(.27,0,a2),pt(RL-.15,-.07,a2),.02*k,col);
  ctx.fillStyle='rgba(225,230,240,.1)';ctx.beginPath();ring.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();ctx.fill();
  ctx.save();ctx.clip();ctx.strokeStyle='rgba(235,240,250,.3)';ctx.lineWidth=Math.max(.5,.006*k);ctx.beginPath();
  for(let i=-3;i<=3;i++){const a=pt(RL-.2,i*.035,a2),b=pt(RL+.2,i*.035,a2);ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);const c=pt(RL+i*.045,-.15,a2),e=pt(RL+i*.045,.15,a2);ctx.moveTo(c[0],c[1]);ctx.lineTo(e[0],e[1]);}
  ctx.stroke();ctx.restore();
  ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,.024*k);ctx.beginPath();ring.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();ctx.stroke();
  if(L.trim){ctx.globalAlpha=.7;ctx.strokeStyle=L.trim[0];ctx.lineWidth=Math.max(.6,.01*k);ctx.beginPath();for(let i=4;i<=8;i++)i===4?ctx.moveTo(ring[i][0],ring[i][1]):ctx.lineTo(ring[i][0],ring[i][1]);ctx.stroke();ctx.globalAlpha=1;}
}
// The ball: fuzzy optic yellow, a little larger than life so it reads at any size, with a streak when it flies fast.
function drawBall(b,trail){
  const r=Math.max(1.6*DPR,BR*k*1.9),[px,py]=P3(b.x,b.z,b.h);
  if(trail&&trail.length>2){const q=P3(...trail[trail.length-1]);const g=ctx.createLinearGradient(q[0],q[1],px,py);g.addColorStop(0,'rgba(220,250,90,0)');g.addColorStop(1,'rgba(220,250,90,.5)');ctx.strokeStyle=g;ctx.lineWidth=r*1.5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(q[0],q[1]);ctx.lineTo(px,py);ctx.stroke();}
  const g=ctx.createRadialGradient(px-r*.35,py-r*.4,r*.1,px,py,r);g.addColorStop(0,'#f6ff9a');g.addColorStop(.6,'#d4ec3c');g.addColorStop(1,'#7c9418');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
  if(r>3){ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=Math.max(.6,r*.14);const s=b.spin||0;ctx.beginPath();ctx.ellipse(px,py,r*.7,r*.7*Math.abs(Math.cos(s)),s*.3,0,Math.PI);ctx.stroke();}
}
// The net is drawn once to its own layer, then in slices sorted with everything else, so a player can stand in front
// of one end and behind the other.
let netC=null;
const NETSEG=12;
function paintNet(){
  const[c,g]=mk(W,H);netC=c;
  g.save();toPlaneZ(g,0);
  g.beginPath();g.moveTo(-CT.post,0);for(let x=-CT.post;x<=CT.post+.01;x+=.4)g.lineTo(x,netH(x));g.lineTo(CT.post,0);g.closePath();
  g.fillStyle='rgba(8,12,10,.38)';g.fill();g.clip();
  g.strokeStyle='rgba(30,40,34,.9)';g.lineWidth=.008;g.beginPath();
  for(let x=-CT.post;x<=CT.post;x+=.08){g.moveTo(x,0);g.lineTo(x,1.1);}
  for(let h=0;h<=1.1;h+=.08){g.moveTo(-CT.post,h);g.lineTo(CT.post,h);}
  g.stroke();g.restore();
  // The tape along the top, the centre strap and the posts.
  toPlaneZ(g,0);
  g.strokeStyle='#f2f4ee';g.lineWidth=.06;g.beginPath();for(let x=-CT.post,i=0;x<=CT.post+.01;x+=.2,i++){const h=netH(x)-.03;i?g.lineTo(x,h):g.moveTo(x,h);}g.stroke();
  g.fillStyle='#e8eae4';g.fillRect(-.025,0,.05,NET.c);
  g.fillStyle='#d8dad4';g.fillRect(-CT.post,.02,CT.post*2,.03);
  reset(g);
  for(const s of[-1,1]){const a=P3(s*CT.post,0,0),b=P3(s*CT.post,0,NET.p+.04);g.lineCap='round';g.strokeStyle='#1d3a28';g.lineWidth=.08*k;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();g.strokeStyle='rgba(200,255,220,.18)';g.lineWidth=.02*k;g.beginPath();g.moveTo(a[0]-.02*k,a[1]);g.lineTo(b[0]-.02*k,b[1]);g.stroke();
    g.fillStyle='#c8ccc4';g.beginPath();g.ellipse(b[0],b[1],.05*k,.03*k,0,0,Math.PI*2);g.fill();}
}
function drawNetSeg(i){
  const x0=-CT.post-.2+i*(CT.post*2+.4)/NETSEG,x1=x0+(CT.post*2+.4)/NETSEG;
  ctx.save();ctx.beginPath();
  const a=P3(x0,0,-.05),b=P3(x1,0,-.05),c=P3(x1,0,1.25),d=P3(x0,0,1.25);
  ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.lineTo(d[0],d[1]);ctx.closePath();ctx.clip();
  ctx.drawImage(netC,0,netShake>.05?Math.sin(t*38)*netShake*.025*k:0);
  ctx.restore();
}
// The players' chairs, each with a bag, a bottle and a towel, and the umpire's tall chair, empty tonight.
function drawChair(i,part){
  const x=CHAIR.x,z=CHAIR.z[i],h=CHAIR.h;
  const ln=(a,b,w,col)=>line(P3(...a),P3(...b),w*k,col);
  if(part==='base'){
    for(const dx of[-.2,.2])for(const dz of[-.2,.2])ln([x+dx,z+dz,0],[x+dx,z+dz,h],.035,'#2a3038');
    toGround(ctx,h);ctx.fillStyle='#3a4a40';ctx.fillRect(x-.23,z-.23,.46,.46);ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(x-.23,z-.23,.46,.12);reset(ctx);
    // Bag on the grass, a bottle beside it.
    const bg=P3(x+.15,z+i*0+(i?.6:-.6),.14);ctx.fillStyle=i?'#2a2238':'#1c2a36';ctx.beginPath();ctx.ellipse(bg[0],bg[1],.42*k,.16*k,-.46,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=players[0].look.col;ctx.globalAlpha=.6;ctx.fillRect(bg[0]-.25*k,bg[1]-.02*k,.5*k,.03*k);ctx.globalAlpha=1;
    const bt=P3(x-.32,z+(i?.32:-.32),0);line(bt,[bt[0],bt[1]-.24*kh],.07*k,'#7ad0ff');line([bt[0],bt[1]-.24*kh],[bt[0],bt[1]-.29*kh],.04*k,'#e8ecff');
  }else{
    ln([x+.21,z-.22,h],[x+.21,z-.22,h+.48],.035,'#2a3038');ln([x+.21,z+.22,h],[x+.21,z+.22,h+.48],.035,'#2a3038');
    toPlaneX(ctx,x+.21);ctx.fillStyle='#34443a';ctx.fillRect(z-.23,h+.2,.46,.26);reset(ctx);
    // A towel over the back when nobody is sitting.
    if(!players.some(p=>p.sit&&Math.abs(p.z-z)<.5)){toPlaneX(ctx,x+.23);ctx.fillStyle='#e8e8ee';ctx.globalAlpha=.85;ctx.fillRect(z-.12,h+.05,.24,.42);ctx.globalAlpha=1;reset(ctx);}
  }
}
function drawUmp(){
  const x=UMP.x,z=UMP.z,h=UMP.h;
  const ln=(a,b,w,col)=>line(P3(...a),P3(...b),w*k,col);
  for(const dx of[-.35,.35])for(const dz of[-.3,.3])ln([x+dx,z+dz,0],[x+dx*.6,z+dz*.6,h],.05,'#2c3a32');
  for(let s=.35;s<h;s+=.35)ln([x+.33,z-.28,s],[x+.33,z+.28,s],.03,'#3a4a40');
  toGround(ctx,h);ctx.fillStyle='#2e4436';ctx.fillRect(x-.3,z-.3,.6,.6);reset(ctx);
  ln([x-.25,z-.25,h],[x-.25,z-.25,h+.6],.04,'#2c3a32');ln([x-.25,z+.25,h],[x-.25,z+.25,h+.6],.04,'#2c3a32');
  toPlaneX(ctx,x-.25);ctx.fillStyle='#3a5244';ctx.fillRect(z-.26,h+.25,.52,.35);reset(ctx);
}
function draw(){
  reset(ctx);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.drawImage(floorC,0,0);
  if(MARKS.length){ctx.globalAlpha=marksA;ctx.drawImage(marksC,0,0);ctx.globalAlpha=1;}
  // Sky details: antenna lights and the odd plane.
  for(const b of blinkers)if(((t+b.ph)%b.per)<.18){ctx.fillStyle='#ff4a4a';ctx.beginPath();ctx.arc(b.x,b.y,1.6*DPR,0,Math.PI*2);ctx.fill();}
  for(const p of E.planes){ctx.fillStyle='#e8ecff';ctx.beginPath();ctx.arc(p.x,p.y,1.4*DPR,0,Math.PI*2);ctx.fill();if((p.ph%1)<.15){ctx.fillStyle='#ff4a4a';ctx.beginPath();ctx.arc(p.x-4*DPR,p.y,1.4*DPR,0,Math.PI*2);ctx.fill();}}
  // A floodlight that is dimmed or out takes its pool of light with it.
  for(const L of LIGHTS)if(L.I<.97){const p=poolOf(L);toGround(ctx);const g=ctx.createRadialGradient(p.x,p.z,0,p.x,p.z,15);g.addColorStop(0,`rgba(2,2,10,${(.45*(1-L.I)).toFixed(3)})`);g.addColorStop(1,"rgba(2,2,10,0)");ctx.fillStyle=g;ctx.fillRect(p.x-16,p.z-16,32,32);reset(ctx);}
  // People walking behind the fence, then the fence itself.
  const behind=[];for(const w of E.walkers)for(const p of w.people)behind.push(p);
  behind.sort((a,b)=>(a.x+a.z)-(b.x+b.z));
  for(const p of behind){shadowsFor(p.x,p.z,1.2,.22,.6);drawPerson(p);}
  for(const w of E.walkers)if(w.kind==='dog'){const p=w.people[0];const dx=w.lane.fixed==='z'?w.dir*.7:0,dz=w.lane.fixed==='x'?w.dir*.7:0;drawDog(p.x+dx,p.z+dz+(w.lane.fixed==='z'?.3:0),w.dogCol,w.dph||0);}
  // A faint rim of floodlight keeps a dark cat readable against the path.
  for(const c of E.cats){shadowsFor(c.x,c.z,.5,.14,.6);ctx.save();ctx.shadowColor='rgba(255,232,200,.6)';ctx.shadowBlur=Math.max(3*DPR,.06*k);drawCat(c);ctx.restore();}
  ctx.drawImage(fenceC,0,0);
  // Light heads, their beams and glare, and moths.
  for(const L of LIGHTS){
    const[hx,hy]=P3(L.x,L.z,L.h);if(L.I<.05)continue;
    const p=poolOf(L),a=P3(p.x-4,p.z+4,0),b=P3(p.x+4,p.z-4,0);
    ctx.globalCompositeOperation='lighter';
    const cg=ctx.createLinearGradient(hx,hy,(a[0]+b[0])/2,(a[1]+b[1])/2);cg.addColorStop(0,`rgba(255,226,180,${(.1*L.I).toFixed(3)})`);cg.addColorStop(1,'rgba(255,226,180,0)');
    poly([[hx,hy],a,b],cg);
    const bg=ctx.createRadialGradient(hx,hy,0,hx,hy,.9*k);bg.addColorStop(0,`rgba(255,240,210,${(.85*L.I).toFixed(3)})`);bg.addColorStop(.25,`rgba(255,220,170,${(.3*L.I).toFixed(3)})`);bg.addColorStop(1,'rgba(255,220,170,0)');
    ctx.fillStyle=bg;ctx.fillRect(hx-.9*k,hy-.9*k,1.8*k,1.8*k);
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#1e1d2c';ctx.fillRect(hx-.4*k,hy-.12*k,.8*k,.24*k);
    ctx.globalAlpha=L.I;ctx.fillStyle='#fff8e6';for(let i=0;i<3;i++)ctx.fillRect(hx-.34*k+i*.25*k,hy-.07*k,.18*k,.14*k);ctx.globalAlpha=1;
    if(L.I>.5){ctx.fillStyle='rgba(240,230,200,.8)';for(let m=0;m<6;m++){const an=t*(1.4+m*.37)+m*2+L.x,r=(.4+(m%3)*.25)*k;ctx.beginPath();ctx.arc(hx+Math.cos(an)*r,hy+.2*k+Math.sin(an*1.3)*r*.6,.9*DPR,0,Math.PI*2);ctx.fill();}}
  }
  // Leaves skitter across the floor.
  for(const l of E.leaves){const[px,py]=P3(l.x,l.z,l.h);ctx.save();ctx.translate(px,py);ctx.rotate(l.ph);ctx.fillStyle=l.col;ctx.beginPath();ctx.ellipse(0,0,.07*k,.035*k,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  // Shadows, then everything else sorted from back to front.
  for(const p of players)shadowsFor(p.x,p.z,p.hgt*.8*(1+p.j*.3),.24,1-.5*Math.min(1,p.j));
  const balls=loose.slice();if(ball.live||ball.toss||ball.held)balls.push(ball);
  for(const b of balls)shadowsFor(b.x,b.z,.12+b.h*.08,.05,clamp(1-b.h*.25,.1,1));
  const list=[];
  for(let i=0;i<NETSEG;i++){const xc=-CT.post-.2+(i+.5)*(CT.post*2+.4)/NETSEG;list.push({d:xc,f:()=>drawNetSeg(i)});}
  for(let i=0;i<2;i++){list.push({d:CHAIR.x+CHAIR.z[i]-.3,f:()=>drawChair(i,'base')});list.push({d:CHAIR.x+CHAIR.z[i]+.3,f:()=>drawChair(i,'back')});}
  list.push({d:UMP.x+UMP.z,f:drawUmp});
  for(const r of E.ravens)list.push({d:r.state==='perch'?UMP.x+UMP.z+.05:r.x+r.z,f:()=>drawRaven(r)});
  for(const p of players){
    if(p.pose&&p.pose.rk&&p.pose.rk.head){const h=P2(p.pose.rk.head);p.rkTrail=p.rkTrail||[];p.rkTrail.unshift(h);if(p.rkTrail.length>4)p.rkTrail.pop();}
    list.push({d:p.x+p.z,f:()=>drawPerson(p)});
  }
  for(const b of balls)list.push({d:b.x+b.z+(b===ball&&ball.held?.15:0),f:()=>drawBall(b,b===ball?ball.trail:null)});
  list.sort((a,b)=>a.d-b.d);
  for(const it of list)it.f();
  for(const b of E.bats){const[px,py]=P3(b.x,b.z,b.h);const up=Math.sin(b.ph),s=.22*k;ctx.fillStyle='#05050c';ctx.beginPath();ctx.moveTo(px,py);ctx.quadraticCurveTo(px-s*.5,py-s*up,px-s,py-s*.3*up);ctx.quadraticCurveTo(px-s*.5,py+s*.1,px,py+s*.15);ctx.quadraticCurveTo(px+s*.5,py+s*.1,px+s,py-s*.3*up);ctx.quadraticCurveTo(px+s*.5,py-s*up,px,py);ctx.fill();}
}

/* ---------- the scoreboard ----------
   Beside the title on the scene page: each player's avatar and name, the sets, the games and the points, with a
   dot by whoever is serving. Only the scene page has it, not the embed. */
function ptText(i){
  const a=match.pts[i],b=match.pts[1-i];
  if(match.tb)return String(a);
  if(a>=3&&b>=3)return a>b?'AD':'40';
  return CALL[Math.min(3,a)].replace('love','0');
}
function updateUI(){
  NightCity.stats({events:stats.events,distinct:seen.size,points:stats.points,aces:stats.aces});
  if(!scoreEl||!scoreDirty)return;
  scoreDirty=false;scoreEl.textContent='';
  for(const p of players){
    const row=document.createElement('span');row.className='row';
    const im=document.createElement('img');if(p.look.avatarURL)im.src=p.look.avatarURL;im.alt='';im.style.borderColor=p.col;
    const nm=document.createElement('b');nm.style.color=p.col;nm.textContent=p.name;
    const sv=document.createElement('i');sv.className='serve';if(match.server!==p.id||match.over!=null)sv.style.visibility='hidden';
    row.append(im,nm,sv);
    for(const s of match.sets){const c=document.createElement('span');c.className='set'+(s[p.id]>s[1-p.id]?' won':'');c.textContent=s[p.id];row.append(c);}
    if(match.over==null){const g=document.createElement('span');g.className='games';g.textContent=match.games[p.id];const q=document.createElement('span');q.className='pts';q.textContent=ptText(p.id);row.append(g,q);}
    scoreEl.append(row);
  }
}

/* ---------- start ---------- */
// ?debug exposes the live state for poking at in the console.
if(DEBUG)window.GC={get paused(){return NightCity.paused;},set paused(v){NightCity.paused=v;},proj:(x,z,h)=>P3(x,z,h),match,rally,players,ball,loose,E,stats,AIM,logArr:NightCity.entries,get t(){return t;},
  run(sec){for(let i=0;i<sec*60;i++)update(1/60);draw();NightCity.refresh();},
  step(n){for(let i=0;i<n;i++)update(1/60);},draw,
  // Draw the scene around a point at a larger scale into an image on top of the page, for checking details.
  closeup(x,z,zoom,h){const keep={k,kh,ox,oy};k*=zoom;kh=k*.82;ox=W/2-(x-z)*k;oy=H/2-(x+z)*k*.5+(h??.9)*kh;paintFloor();paintFence();paintNet();draw();const url=cv.toDataURL();({k,kh,ox,oy}=keep);paintFloor();paintFence();paintNet();
    let im=document.getElementById('closeup');if(!im){im=document.createElement('img');im.id='closeup';im.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:9;object-fit:contain;background:#000';im.onclick=()=>im.remove();document.body.append(im);}im.src=url;},
  // Hit n shots of one kind from (x, z) at contact height h, with difficulty diff, and count where they land.
  testShot(x,z,h,diff,n,kind){const p=players[0],q=players[1],e=endOf(p),res={in:0,net:0,long:0,wide:0,v:0};
    for(let i=0;i<n;i++){p.x=x;p.z=e*Math.abs(z);q.x=rr(-2,2);q.z=-e*(CT.L+1);const sw={kind:kind||'fh',side:p.hand};const sh=chooseShot(p,[x,p.z,h],sw,diff||0);res.v+=strike([x,p.z,h],sh)/n;
      ball.live=true;let bz=null,net=false;for(let s=0;s<1200;s++){const ev=ballStep(ball,1/240,false);if(ev==='net')net=true;if(ev==='bounce'||ev==='roll'){bz=[ball.x,ball.z];break;}}
      if(net&&(!bz||Math.sign(bz[1])===e))res.net++;else if(bz){const o=outBy(bz[0],bz[1]);if(o<=0)res.in++;else if(Math.abs(bz[1])-CT.L>Math.abs(bz[0])-CT.S)res.long++;else res.wide++;}}
    ball.live=false;return res;},
  testServe(first,n){const p=server(),e=endOf(p),sd=serveSide(),res={in:0,net:0,out:0,v:0};
    for(let i=0;i<n;i++){p.x=e*sd*.6;p.z=e*(CT.L+.12);const c=[p.x,p.z-e*.3,p.reach+RL*.9];const sh=chooseServe(p,first);res.v+=strike(c,sh)/n*3.6;let bz=null,net=false;
      for(let s=0;s<1200;s++){const ev=ballStep(ball,1/240,false);if(ev==='net'||ev==='cord')net=true;if(ev==='bounce'){bz=[ball.x,ball.z];break;}}
      if(!bz||Math.sign(bz[1])===e)res.net++;else if(boxOut(bz[0],bz[1],e,sd)<=0)res.in++;else res.out++;}
    ball.live=false;return res;}};
build();paintNet();
for(const p of players)renderAvatar(p);
for(const p of players)log('player',describe(p),{h:p.hgt,s:p.speed});
log('rules',`${cap(COURT.name)}${WHITES?', whites only tonight':''}. Best of three sets, tiebreak at six all. ${players[1-match.server].name} spins the racket, and ${players[match.server].name} will serve`,{});
// Start with both players at their ends, the server holding two balls and the receiver one.
for(const p of players){const e=endOf(p);p.x=rr(-1.5,1.5);p.z=e*(CT.L+rr(1,2.5));p.face=faceNet(p);p.balls=p===server()?2:1;p.pose=limbsOf(p,poseOf(p));}
// Reduced motion: play a while out of sight, then show one still frame.
if(RM)for(let i=0;i<900;i++)update(1/30);
NightCity.run({step:1/60,update,draw,ui:updateUI});
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{build();paintNet();draw();},200);});
})();
