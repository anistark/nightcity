/* Half Court: one-on-one basketball on an outdoor court at night, in isometric pixel art.
   Every choice comes from one generator seeded with the moment the page opens. Each player runs a state machine
   that draws fresh parameters for every move and shot, the ball follows real physics off the rim, glass and floor,
   and small things happen around the court on independent random timers, so no two games play the same way. */
(()=>{
'use strict';
const cv=document.getElementById('scene');
let ctx=cv.getContext('2d');
const RM=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
// ?embed runs the scene as a background on another site: no overlay, no wake lock, lower quality unless q=high,
// and the host page can pause and resume it with postMessage({nightcity:'pause'}) and {nightcity:'play'}.
const QS=new URLSearchParams(location.search),EMBED=QS.has('embed'),LOWQ=EMBED&&QS.get('q')!=='high';
let PAUSED=false;
if(EMBED){document.documentElement.classList.add('embed');addEventListener('message',e=>{const m=e.data&&e.data.nightcity;if(m==='pause')PAUSED=true;if(m==='play')PAUSED=false;});}
// ?speed=8 runs the simulation faster, which helps when checking how games play out.
const SPEED=Math.max(.25,Math.min(16,+new URLSearchParams(location.search).get('speed')||1));

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
const gauss=()=>(R()+R()+R()+R()-2)*1.732;
function wpick(list){let s=0;for(const it of list)s+=it[1];let r=R()*s;for(const it of list){r-=it[1];if(r<=0)return it[0];}return list[0][0];}
const NT=new Float32Array(4096);for(let i=0;i<4096;i++)NT[i]=R();
function noise(x){const i=Math.floor(x),f=x-i,u=f*f*(3-2*f),a=NT[i&4095],b=NT[(i+1)&4095];return a+(b-a)*u;}
function fbm(x){return noise(x)*.55+noise(x*2.031+17.3)*.3+noise(x*4.97+91.1)*.15;}
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,u)=>a+(b-a)*u;
const hyp=Math.hypot;
const cap=s=>s[0].toUpperCase()+s.slice(1);

/* ---------- court geometry, in metres ----------
   x runs across the court, z from the baseline toward half court, h is height. FIBA half court. */
const HOOP={x:0,z:1.575,h:3.05,r:.2286};
const BOARD={z:1.2,w:1.8,b:2.9,t:3.95};
const POLE={x:0,z:-1.05,h:3.4};
const BALL_R=.121,G=9.81;
const ARC_R=6.75,ARC_X=6.6,ARC_Z=HOOP.z+Math.sqrt(ARC_R*ARC_R-ARC_X*ARC_X);
const KEY={w:4.9,l:5.8},FT_R=1.8,RA_R=1.25;
const FENCE={z:-2.3,x:-9.5,h:3.4};
const BENCH={x:8.75,z0:4.6,z1:7.6,h:.45};
const dHoop=(x,z)=>hyp(x-HOOP.x,z-HOOP.z);
const isThree=(x,z)=>z<ARC_Z?Math.abs(x)>ARC_X:dHoop(x,z)>ARC_R;
const inBounds=(x,z)=>Math.abs(x)<=7.5&&z>=0&&z<=14;

/* ---------- palettes ---------- */
const SURFACES=[
  {name:'blue',floor:'#2c4f8f',key:'#b8532e',apron:'#1d3366',line:'#e8e4f0'},
  {name:'green',floor:'#2f6b4f',key:'#2c4f8f',apron:'#1f4a37',line:'#ecebe0'},
  {name:'terracotta',floor:'#94462f',key:'#2f6b5a',apron:'#6a3122',line:'#efe6dc'},
  {name:'purple',floor:'#4a3a8a',key:'#c8902e',apron:'#33286a',line:'#ece6ff'},
  {name:'grey',floor:'#4a4d5c',key:'#9a3a4a',apron:'#33354a',line:'#e8e8ee'}
];
const SKIN=['#f1c9a5','#e0ac7e','#c68a5e','#a0673f','#7a4a2a','#5a3420'];
const HAIR=['#1a1410','#2e2018','#5a3a1e','#8a5a2a','#d8b060','#cfcfd8','#14100e'];
const COATS=[['black','#1c1b27','#1c1b27'],['orange','#c8742f','#e3a160'],['grey','#6c7084','#8d91a6'],['white','#d6d4de','#eeeef4'],['tabby','#8a6a48','#a8875e'],['tuxedo','#1c1b27','#e4e4ec']];
const CAT={
  walkA:['......b.b.','......bbbb','......bbeb','..bbbbbbb.','..bbbbbbb.','..l.l.l.l.'],
  walkB:['......b.b.','......bbbb','......bbeb','..bbbbbbb.','..bbbbbbb.','...l.l.l..'],
  look: ['......b.b.','......bbbb','......bebe','..bbbbbbb.','..bbbbbbb.','..l.l.l.l.'],
  sit:  ['.....b.b..','.....bbbb.','.....bbeb.','.....bbb..','....bbbb..','...bbbbbl.'],
  groom:['..........','.....b.b..','.....bbbb.','.....bbbb.','....bbbbb.','...bbbbbl.']
};
const DOG={a:['....bb','bbbbbb','b.b.b.'],b:['....bb','bbbbbb','.b.b.b']};
const SURF=pick(SURFACES);

/* ---------- helpers ---------- */
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return[c,c.getContext('2d')];}
function hex(c){const n=parseInt(c.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
function shade(c,f){const v=hex(c).map(x=>f<0?x*(1+f):x+(255-x)*f);return'#'+v.map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('');}
const fmtTime=(d,s)=>p2(d.getHours())+':'+p2(d.getMinutes())+(s?':'+p2(d.getSeconds()):'');
const m1=v=>v.toFixed(1)+' m';

/* ---------- event log ---------- */
let t=0;
const logArr=[];const seen=new Set();const stats={events:0,shots:0,makes:0,kinds:{}};
const $=id=>document.getElementById(id);
const ui={clock:$('clock'),btn:$('logBtn'),panel:$('log'),list:$('logList'),ev:$('stEvents'),di:$('stDistinct'),sh:$('stShots'),mk:$('stMakes'),seed:$('seed'),hud:$('hud'),score:$('score')};
ui.seed.textContent=SEED_STR;
let uiDirty=true,scoreDirty=true;
function log(type,text,params){
  const sig=type+'|'+text.split(' ').slice(0,3).join(' ')+'|'+JSON.stringify(params||{},(k,v)=>typeof v==='number'?+v.toFixed(3):v);
  stats.events++;seen.add(sig);
  logArr.unshift({time:fmtTime(new Date(),true),text});
  if(logArr.length>50)logArr.pop();
  uiDirty=true;
}
function updateUI(){
  ui.clock.textContent=fmtTime(new Date());
  ui.ev.textContent=stats.events;ui.di.textContent=seen.size;ui.sh.textContent=stats.shots;ui.mk.textContent=stats.makes;
  if(scoreDirty){
    ui.score.textContent='';
    const a=players[0],b=players[1];
    const mkB=(p,s)=>{const w=document.createElement('span');w.className='team';const im=document.createElement('img');if(p.look.avatarURL)im.src=p.look.avatarURL;im.alt='';im.style.borderColor=p.col;const e=document.createElement('b');e.style.color=p.col;e.textContent=p.name+' '+s;w.append(im,e);return w;};
    const to=document.createElement('span');to.className='to';to.textContent='To '+game.target;
    ui.score.append(mkB(a,game.score[0]),mkB(b,game.score[1]),to);
    scoreDirty=false;
  }
  if(uiDirty&&!ui.panel.hidden){
    ui.list.textContent='';
    for(const e of logArr.slice(0,40)){const li=document.createElement('li');const tm=document.createElement('time');tm.textContent=e.time;const sp=document.createElement('span');sp.textContent=e.text;li.append(tm,sp);ui.list.append(li);}
    uiDirty=false;
  }
}

/* ---------- players ---------- */
// Outfits are drawn fresh each night around a neon accent colour, which also names the player.
// The Night City logo's look, hood up with aviators and neon trim, is one of the outfits.
const TRIMS=[['cyan','#38d8ff'],['blue','#3b7bff'],['red','#ff3b4f'],['orange','#ff8a3d'],['pink','#ff4fa3'],['lime','#8be05a'],['violet','#a06bff'],['yellow','#f2c83a'],['white','#e8ecff']];
function hueOf(c){const[r,g,b]=hex(c).map(v=>v/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx===mn)return 0;let h=mx===r?60*((g-b)/(mx-mn)):mx===g?60*((b-r)/(mx-mn)+2):60*((r-g)/(mx-mn)+4);return(h+360)%360;}
function hsv(h,s,v){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;const[r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return[(r+m)*255,(g+m)*255,(b+m)*255].map(Math.round);}
const toHex=a=>'#'+a.map(v=>v.toString(16).padStart(2,'0')).join('');
const DARKS=['#14151d','#1c1b27','#22202c','#2a2f4a','#2f3f2f','#3a2a2a','#4a4d5c'];
const HAIRDOS=['short','buzz','curly','bun','long','fade'];
// plain: everyday clothes for passersby, with no neon and no jersey numbers.
function mkLook(tr,plain){
  const[name,col]=tr,white=name==='white',h=hueOf(col);
  const logo=!plain&&chance(.22);
  const top=plain?wpick([['hoodie',1.2],['tee',2],['jacket',2]]):logo?'hoodie':wpick([['hoodie',2.6],['tank',2.4],['tee',2],['jacket',1.3]]);
  const topCol=plain?pick(['#4a4068','#2f5a4e','#6a3440','#34405a','#5a4a32','#3c3e4a','#7a6a52','#1c1b27','#8a8a96']):
    logo?toHex(hsv(h,white?0:.3,.08)):pick([toHex(hsv(h,white?0:.3,.08)),toHex(hsv(h,white?0:.7,.6)),'#e8e8ee','#16161e',toHex(hsv(h,white?0:.25,.25))]);
  const hood=top==='hoodie'?(logo||chance(.55)?'up':'down'):null;
  const bottom=plain?'pants':logo?'joggers':wpick([['shorts',2.6],['joggers',1.4]]);
  const light=hex(topCol).reduce((a,b)=>a+b,0)>420;
  return{name:cap(name),col,white,hue:h,trim:plain?null:[col,white?'#9fb0ff':toHex(hsv((h+28)%360,.85,1))],
    top,topCol,hood,bottom,
    botCol:plain?pick(['#1c1b27','#2a2f4a','#3a3a4a','#4a3e32','#3a4a5a']):pick([...DARKS,toHex(hsv(h,white?0:.6,.45)),'#e8e8ee']),
    socks:bottom==='shorts'?pick(['#f2f2f5','#1c1b27',col]):null,
    shoes:plain?pick(['#e8ecff','#1c1b27','#6a4a32','#8a8a96']):pick(['#f2f2f5','#1a1b24',col,'#e8ecff']),
    sole:plain?'#c8c8d0':pick(['#e8ecff',col,'#1a1b24']),
    skin:logo?'#c98a5e':pick(SKIN),hairCol:pick(HAIR),hairdo:pick(HAIRDOS),
    headwear:hood==='up'?null:plain?wpick([[null,4],['cap',1]]):wpick([[null,2.2],['headband',1],['cap',1]]),capBack:chance(.5),
    shades:logo?'aviator':plain?(chance(.1)?'aviator':null):wpick([[null,2],['aviator',1],['wrap',1]]),
    beard:logo?'goatee':wpick([[null,3],['goatee',1],['full',.8]]),
    number:!plain&&(top==='tank'||top==='tee')?String(ri(0,99)):null,numCol:light?(white?'#1c1b27':col):(white?'#e8ecff':col),
    neck:hood==='up'||top==='jacket'?'#0a0a10':null,avatarURL:null};
}
function pickTrims(){
  const a=pick(TRIMS);let b=pick(TRIMS),n=0;
  const far=(x,y)=>x[0]==='white'||y[0]==='white'||Math.min(Math.abs(hueOf(x[1])-hueOf(y[1])),360-Math.abs(hueOf(x[1])-hueOf(y[1])))>70;
  while((b===a||!far(a,b))&&n++<50)b=pick(TRIMS);
  return[a,b];
}
const TEAM=pickTrims(),LOOKS=[mkLook(TEAM[0]),mkLook(TEAM[1])];
function mkPlayer(id,look){
  const p={id,name:look.name,col:look.col,look,
    hgt:rr(1.72,2.03),speed:rr(4.3,6.3),hops:rr(.4,.95),shoot:rr(.36,.74),handle:rr(.3,.88),defense:rr(.3,.88),react:rr(.1,.3),
    style:[rr(.15,1),rr(.15,1),rr(.15,1),rr(.05,.8)],hand:chance(.12)?-1:1,
    x:0,z:8,vx:0,vz:0,face:-Math.PI/2,j:0,jv:0,air:false,crouch:0,gait:rr(0,6),fatigue:0,hot:0,
    act:'idle',actT:0,arm:'side',plan:null,dr:{side:1,ph:0,rate:2,move:null,from:1},tgt:{x:0,z:8},pose:null,celebrate:0,sit:false,tie:0,dhand:chance(.5)?1:-1};
  p.reach=p.hgt*1.33;
  return p;
}
const players=[mkPlayer(0,LOOKS[0]),mkPlayer(1,LOOKS[1])];
const other=p=>players[1-p.id];
function describe(p){
  const tr=[];
  tr.push(p.hgt.toFixed(2)+' m');
  if(p.speed>5.6)tr.push('quick');
  if(p.hops>.78)tr.push('springy');
  if(p.shoot>.62)tr.push('a shooter');
  if(p.handle>.75)tr.push('tight handle');
  if(p.defense>.75)tr.push('pesky defender');
  const fav=['threes','mid-range','driving','the post'][p.style.indexOf(Math.max(...p.style))];
  tr.push('likes '+fav);
  if(p.hand<0)tr.push('left-handed');
  return p.name+': '+tr.join(', ');
}

/* ---------- game ---------- */
const game={target:pick([7,11,11,15]),winBy2:chance(.5),rule:chance(.5)?'make':'lose',score:[0,0],off:ri(0,1),phase:'check',step:0,stepT:0,
  needClear:false,possT:0,games:1,breakStep:0,breakT:0,deadT:0,spot:null,nextOff:0,streak:[0,0]};
const ball={x:0,z:8,h:BALL_R,vx:0,vz:0,vh:0,holder:null,last:null,shot:null,pass:null,noCatch:0,spin:0,prevH:BALL_R,stuck:0,restT:0};
const rimShake={a:0},net={swish:0};

/* ---------- world drawing state ----------
   The canvas runs at full device resolution. Static parts are drawn once per resize as real geometry,
   in metres, through isometric transforms, so lines stay smooth at any size. */
let W=0,H=0,DPR=1,k=10,kh=8,ox=0,oy=0,horizon=-1;
let floorC=null,fenceC=null;
const LIGHTS=[{x:-10.1,z:-2.9,h:8.6,I:1,mode:null,until:0},{x:10.1,z:-2.9,h:8.6,I:1,mode:null,until:0},{x:-10.1,z:16,h:8.6,I:1,mode:null,until:0}];
const sx=(x,z)=>ox+(x-z)*k;
const sy=(x,z,h)=>oy+(x+z)*k*.5-(h||0)*kh;
const P3=(x,z,h)=>[sx(x,z),sy(x,z,h)];
let blinkers=[];
// Under these transforms, canvas units are metres: on the ground at height h, or on a vertical plane.
const toGround=(g,h)=>g.setTransform(k,k*.5,-k,k*.5,ox,oy-(h||0)*kh);
const toPlaneZ=(g,z)=>g.setTransform(k,k*.5,0,-kh,ox-z*k,oy+z*k*.5);
const toPlaneX=(g,x)=>g.setTransform(-k,k*.5,0,-kh,ox+x*k,oy+x*k*.5);
const reset=g=>g.setTransform(1,0,0,1,0,0);
const poolOf=L=>({x:L.x+(0-L.x)*.42,z:L.z+(6-L.z)*.42});

function build(){
  DPR=LOWQ?1:Math.min(2,devicePixelRatio||1);
  W=Math.max(320,Math.round(innerWidth*DPR));H=Math.max(240,Math.round(innerHeight*DPR));
  cv.width=W;cv.height=H;ctx.imageSmoothingEnabled=true;
  // Frame the part of the court the game uses: the paint, the arc and a little beyond. The far corner crops.
  const pts=[[-7.9,-1.3,0],[7.9,-1.3,0],[-7.9,9.9,0],[7.9,9.9,0],[0,BOARD.z,BOARD.t+.25],[0,POLE.z,POLE.h]];
  let a=1e9,b=-1e9,c=1e9,d=-1e9;
  for(const[x,z,h]of pts){const X=x-z,Y=(x+z)*.5-h*.82;a=Math.min(a,X);b=Math.max(b,X);c=Math.min(c,Y);d=Math.max(d,Y);}
  k=Math.min(W*.97/(b-a),H*.9/(d-c));kh=k*.82;
  ox=W/2-(a+b)/2*k;oy=H*.54-(c+d)/2*k;
  horizon=Math.round(oy-8.5*k);
  paintFloor();paintFence();
}

function noiseCanvas(T,n,alpha){const[c,g]=mk(n,n);const img=g.createImageData(n,n);for(let i=0;i<img.data.length;i+=4){const v=T()*255;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=alpha;}g.putImageData(img,0,0);return c;}
function paintFloor(){
  const[c,g]=mk(W,H);floorC=c;
  // A separate generator for textures, so a resize repaints the same court without touching the game's randomness.
  const T=sfc32(...cyrb128(SEED_STR+'/court'));const tr=(a,b)=>a+(b-a)*T();
  // Sky, stars and the skyline.
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
  // The ground: dark grass, a path behind the fence, the apron and the court.
  const gg=g.createLinearGradient(0,top,0,H);gg.addColorStop(0,'#0b1011');gg.addColorStop(1,'#050708');g.fillStyle=gg;g.fillRect(0,top,W,H-top);
  g.save();g.globalAlpha=.07;g.fillStyle=g.createPattern(noiseCanvas(T,128,255),'repeat');g.fillRect(0,top,W,H-top);g.restore();
  toGround(g);
  g.fillStyle='#15151e';g.fillRect(-16,FENCE.z-1.9,32,1.3);g.fillRect(FENCE.x-1.9,FENCE.z-1.9,1.3,22);
  g.fillStyle=SURF.apron;g.fillRect(-8.9,-1.6,17.8,17);
  g.fillStyle=SURF.floor;g.fillRect(-7.5,0,15,14);
  g.fillStyle=SURF.key;g.fillRect(-KEY.w/2,0,KEY.w,KEY.l);
  // Painted logo at centre court, faded.
  g.save();g.globalAlpha=.12;g.strokeStyle=SURF.line;g.lineWidth=.08;g.beginPath();g.arc(0,14,.6,Math.PI,2*Math.PI);g.stroke();g.restore();
  // Surface texture and wear, clipped to the apron.
  reset(g);g.save();
  toGround(g);g.beginPath();g.rect(-8.9,-1.6,17.8,17);reset(g);g.clip();
  g.globalCompositeOperation='overlay';g.globalAlpha=.08;g.fillStyle=g.createPattern(noiseCanvas(T,96,255),'repeat');g.fillRect(0,0,W,H);
  g.globalCompositeOperation='source-over';g.globalAlpha=1;
  toGround(g);
  for(const[wx,wz,r,a]of[[HOOP.x,HOOP.z+.9,2.6,.09],[0,8.6,2.2,.06],[tr(-4,4),tr(3,9),tr(1,2),.05]]){const wg=g.createRadialGradient(wx,wz,0,wx,wz,r);wg.addColorStop(0,`rgba(255,240,220,${a})`);wg.addColorStop(1,'rgba(255,240,220,0)');g.fillStyle=wg;g.fillRect(wx-r,wz-r,2*r,2*r);}
  g.restore();
  // Court lines.
  toGround(g);
  g.strokeStyle=SURF.line;g.lineWidth=.05;g.lineCap='butt';g.globalAlpha=.92;
  g.strokeRect(-7.5,0,15,14);g.strokeRect(-KEY.w/2,0,KEY.w,KEY.l);
  g.beginPath();g.arc(0,KEY.l,FT_R,0,Math.PI);g.stroke();
  g.setLineDash([.32,.26]);g.beginPath();g.arc(0,KEY.l,FT_R,Math.PI,2*Math.PI);g.stroke();g.setLineDash([]);
  g.beginPath();g.moveTo(-ARC_X,0);g.lineTo(-ARC_X,ARC_Z);g.moveTo(ARC_X,0);g.lineTo(ARC_X,ARC_Z);g.stroke();
  const a0=Math.asin((ARC_Z-HOOP.z)/ARC_R);g.beginPath();g.arc(HOOP.x,HOOP.z,ARC_R,a0,Math.PI-a0);g.stroke();
  g.beginPath();g.arc(HOOP.x,HOOP.z,RA_R,0,Math.PI);g.stroke();
  g.beginPath();g.arc(0,14,FT_R,Math.PI,2*Math.PI);g.stroke();
  g.beginPath();for(const m of[2.1,3.0,3.9,4.8])for(const s of[1,-1]){g.moveTo(s*KEY.w/2,m);g.lineTo(s*(KEY.w/2+.2),m);}g.stroke();
  g.globalAlpha=1;
  // Hairline cracks.
  g.strokeStyle='rgba(4,4,10,.35)';g.lineWidth=.025;g.lineJoin='round';
  for(let n=Math.round(tr(2,5));n>0;n--){let x=tr(-7,7),z=tr(.5,13);g.beginPath();g.moveTo(x,z);for(let s=Math.round(tr(3,7));s>0;s--){x+=tr(-.4,.4);z+=tr(-.4,.4);g.lineTo(x,z);}g.stroke();}
  // Floodlight pools: warm light added on top, strongest toward the middle of the court.
  g.globalCompositeOperation='lighter';
  for(const L of LIGHTS){const p=poolOf(L);const lg=g.createRadialGradient(p.x,p.z,0,p.x,p.z,11.5);lg.addColorStop(0,'rgba(255,214,160,.2)');lg.addColorStop(.55,'rgba(255,200,150,.07)');lg.addColorStop(1,'rgba(255,200,150,0)');g.fillStyle=lg;g.fillRect(p.x-12,p.z-12,24,24);}
  g.globalCompositeOperation='source-over';
  // Bench beside the right sideline, with a bottle and a bag.
  reset(g);
  const bx=BENCH.x,bh=BENCH.h;
  const ln=(a,b,w,col)=>{g.strokeStyle=col;g.lineWidth=w;g.lineCap='round';g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();};
  for(const zz of[BENCH.z0+.25,BENCH.z1-.25])for(const dx of[-.18,.18])ln(P3(bx+dx,zz,0),P3(bx+dx,zz,bh),.05*k,'#2a283c');
  toGround(g,bh);g.fillStyle='#4a3a2e';g.fillRect(bx-.24,BENCH.z0,.48,BENCH.z1-BENCH.z0);g.fillStyle='rgba(255,220,180,.08)';g.fillRect(bx-.24,BENCH.z0,.12,BENCH.z1-BENCH.z0);
  g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=.015;for(let dx=-.12;dx<.24;dx+=.12){g.beginPath();g.moveTo(bx+dx,BENCH.z0);g.lineTo(bx+dx,BENCH.z1);g.stroke();}
  reset(g);
  const bz=BENCH.z0+.45,b0=P3(bx+.05,bz,bh),b1=P3(bx+.05,bz,bh+.25);ln(b0,b1,.07*k,'#38c8ff');ln(b1,P3(bx+.05,bz,bh+.29),.04*k,'#e8ecff');
  const gz=BENCH.z1+.6,gp=P3(bx,gz,.16);g.fillStyle='#1c1e2c';g.beginPath();g.ellipse(gp[0],gp[1],.3*k,.17*k,-.46,0,Math.PI*2);g.fill();
  // A soft vignette pulls the eye to the court.
  const vg=g.createRadialGradient(sx(0,5),sy(0,5),Math.min(W,H)*.25,sx(0,5),sy(0,5),Math.max(W,H)*.75);vg.addColorStop(0,'rgba(0,0,6,0)');vg.addColorStop(1,'rgba(0,0,6,.6)');g.fillStyle=vg;g.fillRect(0,0,W,H);
}
function pick2(T,a){return a[Math.floor(T()*a.length)];}

function paintFence(){
  const[c,g]=mk(W,H);fenceC=c;
  const FH=FENCE.h,x1=10.4,z1=17;
  g.lineCap='round';
  // Chain-link mesh: two families of fine diagonals on each fence plane.
  const mesh=(len)=>{g.beginPath();for(let u=-FH;u<len;u+=.1){g.moveTo(u,0);g.lineTo(u+FH,FH);g.moveTo(u+FH,0);g.lineTo(u,FH);}};
  g.save();toPlaneZ(g,FENCE.z);g.beginPath();g.rect(FENCE.x,0,x1-FENCE.x,FH);g.clip();g.translate(FENCE.x,0);mesh(x1-FENCE.x);g.strokeStyle='rgba(150,160,200,.2)';g.lineWidth=.012;g.stroke();g.restore();
  g.save();toPlaneX(g,FENCE.x);g.beginPath();g.rect(FENCE.z,0,z1-FENCE.z,FH);g.clip();g.translate(FENCE.z,0);mesh(z1-FENCE.z);g.strokeStyle='rgba(150,160,200,.2)';g.lineWidth=.012;g.stroke();g.restore();
  const post=(a,b)=>{g.strokeStyle='#3c3f58';g.lineWidth=.06*k;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();g.strokeStyle='rgba(200,210,255,.18)';g.lineWidth=.02*k;g.beginPath();g.moveTo(a[0]-.015*k,a[1]);g.lineTo(b[0]-.015*k,b[1]);g.stroke();};
  for(let x=FENCE.x;x<=x1;x+=2.5)post(P3(x,FENCE.z,0),P3(x,FENCE.z,FH));
  for(let z=FENCE.z+2.5;z<=z1;z+=2.5)post(P3(FENCE.x,z,0),P3(FENCE.x,z,FH));
  post(P3(FENCE.x,FENCE.z,FH),P3(x1,FENCE.z,FH));post(P3(FENCE.x,FENCE.z,FH),P3(FENCE.x,z1,FH));
  // Floodlight poles just outside the fence.
  for(const L of LIGHTS){
    const a=P3(L.x,L.z,0),b=P3(L.x,L.z,L.h);
    const pg=g.createLinearGradient(a[0]-.1*k,0,a[0]+.1*k,0);pg.addColorStop(0,'#1c1b2a');pg.addColorStop(.4,'#4a4a62');pg.addColorStop(1,'#16151f');
    g.strokeStyle=pg;g.lineWidth=.16*k;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();
  }
  // Hoop stanchion: a padded steel pole and the arm out to the backboard.
  const p0=P3(POLE.x,POLE.z,0),p1=P3(POLE.x,POLE.z,POLE.h);
  const sg=g.createLinearGradient(p0[0]-.12*k,0,p0[0]+.12*k,0);sg.addColorStop(0,'#20222e');sg.addColorStop(.35,'#6a6e86');sg.addColorStop(1,'#1a1c26');
  g.strokeStyle=sg;g.lineWidth=.2*k;g.lineCap='butt';g.beginPath();g.moveTo(p0[0],p0[1]);g.lineTo(p1[0],p1[1]);g.stroke();
  const pad=P3(POLE.x,POLE.z,1.7);const pdg=g.createLinearGradient(p0[0]-.16*k,0,p0[0]+.16*k,0);pdg.addColorStop(0,shade(SURF.key,-.55));pdg.addColorStop(.35,shade(SURF.key,-.1));pdg.addColorStop(1,shade(SURF.key,-.6));
  g.strokeStyle=pdg;g.lineWidth=.3*k;g.beginPath();g.moveTo(p0[0],p0[1]);g.lineTo(pad[0],pad[1]);g.stroke();
  g.lineCap='round';g.strokeStyle='#4a4d64';g.lineWidth=.1*k;
  const arm0=P3(POLE.x,POLE.z,POLE.h-.12),arm1=P3(0,BOARD.z-.08,POLE.h-.12),brace=P3(POLE.x,POLE.z,POLE.h-.75);
  g.beginPath();g.moveTo(arm0[0],arm0[1]);g.lineTo(arm1[0],arm1[1]);g.moveTo(brace[0],brace[1]);g.lineTo(arm1[0],arm1[1]);g.stroke();
}

/* ---------- ball physics ---------- */
function touch(kind){
  const s=ball.shot;
  if(s){
    if(kind==='rim'){s.rim++;s.touched=true;rimShake.a=Math.min(1.5,rimShake.a+.6);}
    if(kind==='board'){s.board++;s.touched=true;}
    if(kind==='pole'){s.pole=true;s.touched=true;}
    if(kind==='floor'&&!s.done)endShot(false);
  }
  if(kind==='rim'||kind==='board')ball.noCatch=Math.min(ball.noCatch,t+.08);
}
function ballStep(dt){
  const b=ball;if(b.holder||b.stuck>0)return;
  b.prevH=b.h;const pz=b.z;
  // Exact under constant gravity, so long shots don't fall short from integration error.
  b.x+=b.vx*dt;b.z+=b.vz*dt;b.h+=b.vh*dt-.5*G*dt*dt;b.vh-=G*dt;
  b.spin+=hyp(b.vx,b.vz)*dt*8;
  // Backboard: the front face of the glass.
  if(b.vz<0&&pz-BALL_R>=BOARD.z-.02&&b.z-BALL_R<BOARD.z&&Math.abs(b.x)<BOARD.w/2+BALL_R*.4&&b.h>BOARD.b-BALL_R*.6&&b.h<BOARD.t+BALL_R*.4){
    b.z=BOARD.z+BALL_R;b.vz=-b.vz*rr(.52,.66);b.vx*=.93;b.vh*=.93;touch('board');
  }
  // Rim: a torus, so test the ball against the closest point on the ring.
  const rx=b.x-HOOP.x,rz=b.z-HOOP.z,rl=hyp(rx,rz)||1e-6;
  if(Math.abs(b.h-HOOP.h)<.4&&Math.abs(rl-HOOP.r)<.4){
    const qx=HOOP.x+rx/rl*HOOP.r,qz=HOOP.z+rz/rl*HOOP.r;
    const dx=b.x-qx,dz=b.z-qz,dh=b.h-HOOP.h,d=hyp(dx,dz,dh),m=BALL_R+.017;
    if(d<m&&d>1e-6){
      const nx=dx/d,nz=dz/d,nh=dh/d;b.x+=nx*(m-d);b.z+=nz*(m-d);b.h+=nh*(m-d);
      const vn=b.vx*nx+b.vz*nz+b.vh*nh;
      if(vn<0){const e=rr(.42,.62);b.vx-=(1+e)*vn*nx;b.vz-=(1+e)*vn*nz;b.vh-=(1+e)*vn*nh;b.vx*=.9;b.vz*=.9;
        if(vn<-.6)touch('rim');
        // Now and then a soft shot settles between the rim and the glass and stays there.
        if(b.shot&&b.shot.board&&rz<-.1&&Math.abs(rx)<.18&&hyp(b.vx,b.vz,b.vh)<2.6&&chance(.04)){b.stuck=rr(2,4.5);b.x=HOOP.x+rr(-.06,.06);b.z=BOARD.z+BALL_R+.01;b.h=HOOP.h+.08;b.vx=b.vz=b.vh=0;log('stuck','The ball wedges between the rim and the glass');}
      }
    }
  }
  // Net: slows the ball as it drops through.
  if(rl<HOOP.r&&b.h<HOOP.h&&b.h>HOOP.h-.45){b.vx*=1-4*dt;b.vz*=1-4*dt;if(b.vh<-2.5)b.vh*=1-2.5*dt;net.swish=Math.max(net.swish,.9);}
  // A make: the ball drops through the ring from above.
  if(b.prevH>=HOOP.h&&b.h<HOOP.h&&rl<HOOP.r-.03&&b.vh<0&&b.shot&&!b.shot.done)endShot(true);
  // Pole.
  const px=b.x-POLE.x,pzz=b.z-POLE.z,pl=hyp(px,pzz);
  if(pl<BALL_R+.09&&b.h<POLE.h){const nx=px/(pl||1),nz=pzz/(pl||1);b.x=POLE.x+nx*(BALL_R+.09);b.z=POLE.z+nz*(BALL_R+.09);const vn=b.vx*nx+b.vz*nz;if(vn<0){b.vx-=1.6*vn*nx;b.vz-=1.6*vn*nz;touch('pole');}}
  // Fences behind the baseline and along the left sideline, soft walls on the open sides.
  if(b.z<FENCE.z+BALL_R){b.z=FENCE.z+BALL_R;b.vz=Math.abs(b.vz)*.25;b.vx*=.6;}
  if(b.x<FENCE.x+BALL_R){b.x=FENCE.x+BALL_R;b.vx=Math.abs(b.vx)*.25;b.vz*=.6;}
  if(b.x>11.2){b.x=11.2;b.vx=-Math.abs(b.vx)*.2;}
  if(b.z>17.2){b.z=17.2;b.vz=-Math.abs(b.vz)*.2;}
  // Floor.
  if(b.h<BALL_R){
    b.h=BALL_R;const hard=Math.abs(b.x)<8.9&&b.z>-1.6&&b.z<15.4;
    if(b.vh<-.7){b.vh=-b.vh*(hard?rr(.7,.76):.45);b.vx*=.92;b.vz*=.92;touch('floor');}
    else{b.vh=0;const sp=hyp(b.vx,b.vz),dec=(hard?.45:2.8)*dt;const f=sp>dec?(sp-dec)/sp:0;b.vx*=f;b.vz*=f;}
  }
}
function ballSpeed(){return hyp(ball.vx,ball.vz,ball.vh);}

/* ---------- shots ---------- */
const SHOTS={
  layup:{jump:.85,arc:[58,68],acc:.55,block:1.3,name:'layup'},
  reverse:{jump:.8,arc:[60,70],acc:.45,block:.9,name:'reverse layup'},
  roll:{jump:.85,arc:[64,74],acc:.5,block:1.1,name:'finger roll'},
  floater:{jump:.45,arc:[62,72],acc:.55,block:.7,name:'floater'},
  jumper:{jump:.6,arc:[47,55],acc:1,block:1,name:'jumper'},
  pullup:{jump:.6,arc:[47,54],acc:.92,block:1,name:'pull-up'},
  stepback:{jump:.5,arc:[48,56],acc:.86,block:.7,name:'step-back'},
  fade:{jump:.5,arc:[50,58],acc:.8,block:.45,back:1,name:'fadeaway'},
  hook:{jump:.35,arc:[55,66],acc:.8,block:.6,name:'hook shot'},
  turn:{jump:.5,arc:[50,57],acc:.86,block:.8,name:'turnaround'},
  set:{jump:.15,arc:[46,53],acc:1.05,block:1.1,name:'set shot'},
  tip:{jump:.9,arc:[60,70],acc:.4,block:.8,name:'putback'},
  heave:{jump:.3,arc:[44,50],acc:.55,block:.4,name:'heave'}
};
function shotName(sh){const three=isThree(sh.x0,sh.z0);const base=SHOTS[sh.kind].name;if(!three)return base;if(sh.kind==='jumper'||sh.kind==='set')return 'three';if(sh.kind==='heave')return 'deep heave';return base+' three';}
function an(w){return /^[aeiou]/i.test(w)?'an':'a';}
function startShot(p,kind){
  const q=other(p),spec=SHOTS[kind];
  p.act='shoot';p.actT=0;p.arm='hold';
  p.sh={kind,spec,gather:kind==='set'?rr(.25,.4):kind==='tip'?.02:rr(.1,.28),jumped:false,relV:rr(-.3,1.1),done:false};
  // The defender decides to contest or go for the block the moment the shot starts.
  const dq=hyp(q.x-p.x,q.z-p.z);
  const front=((q.x-p.x)*(HOOP.x-p.x)+(q.z-p.z)*(HOOP.z-p.z))>0||dHoop(q.x,q.z)<1.8;
  q.contest=0;
  if(dq<1.9&&front&&!q.air&&q.act!=='shoot'){
    q.contest=clamp((1.9-dq)/1.4,0,1);
    const tryBlock=q.defense*.6*q.contest*spec.block*(q.hgt/p.hgt)*(1-q.fatigue*.5);
    q.jumped=false;
    if(chance(tryBlock)){q.act='block';q.actT=0;q.blockAt=Math.max(0,p.sh.gather+rr(-.05,.18));}
    else{q.act='contest';q.actT=0;}
  }
}
function aimAndRelease(p){
  const sh=p.sh,spec=sh.spec,q=other(p);
  const hands=p.pose.hands;let rx=(hands[0][0]+hands[1][0])/2,rz=(hands[0][1]+hands[1][1])/2,rh=Math.max(hands[0][2],hands[1][2])+.05;
  // Close in, the ball leaves the hand before it reaches the ring, never inside the rim itself.
  const close=['layup','reverse','roll','tip'].includes(sh.kind);
  if(close)rh=Math.min(rh,HOOP.h-AIM.under);
  {const ex=rx-HOOP.x,ez=Math.max(rz,BOARD.z+.2)-HOOP.z,el=hyp(ex,ez)||1,minD=close?AIM.minD:.55;if(el<minD){rx=HOOP.x+ex/el*minD;rz=HOOP.z+ez/el*minD;}if(rz<BOARD.z+.2)rz=BOARD.z+.2;}
  const d=dHoop(p.x,p.z);
  sh.x0=p.x;sh.z0=p.z;
  const dq=hyp(q.x-p.x,q.z-p.z);
  const contest=(q.act==='block'||q.act==='contest')?clamp((1.9-dq)/1.4,0,1)*(q.air?1.25:1):clamp((1.2-dq)/1.2,0,1)*.4;
  let sigma=(.016+.011*d)*(1.3-p.shoot-.08*p.hot)*(1+.7*contest)*(1+.6*p.fatigue)/spec.acc;
  if(p.air&&Math.abs(p.jv)>1.2)sigma*=1.25;
  // Aim a touch past the centre of the rim, then add the error.
  const rd=hyp(HOOP.x-rx,HOOP.z-rz)||1,ux=(HOOP.x-rx)/rd,uz=(HOOP.z-rz)/rd;
  sigma*=AIM.sigma;
  let tx=HOOP.x+ux*AIM.bias+gauss()*sigma,tz=HOOP.z+uz*AIM.bias+gauss()*sigma,th=HOOP.h;
  // Bank shots aim at the mirror image of the rim behind the glass.
  const ang=Math.abs(Math.atan2(rx-HOOP.x,rz-HOOP.z));
  const bank=d<5.2&&d>.8&&ang>.35&&ang<1.25&&chance(kind2bank(sh.kind)*AIM.bankMul);
  if(bank){tz=BOARD.z-(HOOP.z-BOARD.z)/AIM.bankE+gauss()*sigma*.8;th=HOOP.h+AIM.bankH;sh.bankTry=true;}
  const dx=tx-rx,dz=tz-rz,dist=Math.max(.05,hyp(dx,dz)),dhh=th-rh;
  let th0=rr(spec.arc[0],spec.arc[1])*Math.PI/180,v=0;
  for(let i=0;i<8;i++){const den=2*Math.cos(th0)**2*(dist*Math.tan(th0)-dhh);if(den>0){v=Math.sqrt(G*dist*dist/den);break;}th0+=.08;}
  if(!v)v=6;
  const vh=v*Math.sin(th0),vxz=v*Math.cos(th0);
  ball.holder=null;ball.x=rx;ball.z=rz;ball.h=rh;
  ball.vx=dx/dist*vxz;ball.vz=dz/dist*vxz;ball.vh=vh;
  ball.last=p.id;ball.pass=null;
  const flight=dist/vxz;
  ball.shot={by:p.id,kind:sh.kind,d,x0:p.x,z0:p.z,val:isThree(p.x,p.z)?2:1,rim:0,board:0,pole:false,touched:false,done:false,made:false,blocked:false,t0:t,tEnd:t+flight*.85,contest,bank};
  ball.noCatch=t+Math.max(.4,flight*.85);
  stats.shots++;
  p.act='follow';p.actT=0;p.arm='follow';
  if(q.act==='contest')q.arm='up';
}
const AIM={bias:.03,sigma:1.8,under:.12,minD:1.2,bankMul:1,bankE:.9,bankH:.05};
function kind2bank(k){return k==='layup'?.45:k==='reverse'?.2:k==='jumper'||k==='pullup'||k==='set'?.12:k==='hook'?.3:.05;}
function endShot(made,shot){
  const s=shot||ball.shot;if(!s||s.done)return;
  const ks=stats.kinds[s.kind]||(stats.kinds[s.kind]={n:0,made:0});ks.n++;if(made)ks.made++;
  s.done=true;s.made=made;
  const p=players[s.by],q=other(p);
  const nm=shotName(s);
  if(made){
    stats.makes++;
    const how=s.dunk?'':s.rim===0&&s.board===0?' Nothing but net.':s.board&&s.rim===0?' Off the glass.':s.board?' Glass, rim, in.':s.rim>2?' It rattles around and drops.':' It rolls in off the rim.';
    const pts=s.val;
    game.score[p.id]+=pts;scoreDirty=true;
    p.hot=Math.min(1,p.hot+.25);game.streak[p.id]++;game.streak[q.id]=0;
    const sc=` ${game.score[p.id]} to ${game.score[q.id]}`;
    if(s.dunk)log('make',`${p.name} throws it down.${sc}`,{k:'dunk'});
    else log('make',`${p.name} hits ${an(nm)} ${nm} from ${m1(s.d)}.${how}${sc}`,{k:s.kind,d:s.d,r:s.rim,b:s.board});
    if(game.streak[p.id]===4)log('streak',`${p.name} has hit four in a row`);
    if(s.contest>.6&&!s.dunk&&chance(.3))log('and1',`Through the contest. ${q.name} shakes their head`);
    game.phase='dead';game.deadT=0;
    game.nextOff=game.rule==='make'?p.id:q.id;
    p.celebrate=chance(.6)?rr(.6,1.6):0;
    checkGameOver(p);
  }else{
    p.hot=Math.max(-1,p.hot-.12);
    const tail=s.blocked?null:s.rim===0&&s.board===0&&!s.pole?'An air ball.':s.pole?'It clangs off the pole.':s.board&&s.rim===0?'Off the glass and out.':s.rim>1?'In and out.':'Off the rim.';
    if(tail)log('miss',`${p.name}'s ${nm} from ${m1(s.d)}. ${tail}`,{k:s.kind,d:s.d,r:s.rim,b:s.board});
  }
}
function checkGameOver(p){
  const q=other(p),a=game.score[p.id],b=game.score[q.id];
  if(a>=game.target&&(!game.winBy2||a-b>=2)){
    game.phase='break';game.breakStep=0;game.breakT=0;
    log('game',`${p.name} wins game ${game.games}, ${a} to ${b}. Time for a breather`,{a,b});
    p.celebrate=rr(1.8,3);
    game.winner=p.id;
  }
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
  p.x=clamp(p.x,-9.1,11.8);p.z=clamp(p.z,-1.9,17.8);
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

/* ---------- poses ----------
   Each frame a player's body is rebuilt in world space from its state: feet, knees, hips, shoulders, head and hands.
   The ball, when held, sits wherever the hands or the dribble put it. */
// Two-bone IK: the middle joint of a limb from a to b, with segment lengths l1 and l2, bending toward bend.
function ik2(a,b,l1,l2,bend){
  const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L=Math.max(1e-4,hyp(d[0],d[1],d[2]));
  const u=[d[0]/L,d[1]/L,d[2]/L],dl=Math.min(L,(l1+l2)*.999);
  const x=(l1*l1-l2*l2+dl*dl)/(2*dl),y=Math.sqrt(Math.max(0,l1*l1-x*x));
  const bd=bend[0]*u[0]+bend[1]*u[1]+bend[2]*u[2],v=[bend[0]-u[0]*bd,bend[1]-u[1]*bd,bend[2]-u[2]*bd],vl=hyp(v[0],v[1],v[2])||1;
  return[a[0]+u[0]*x+v[0]/vl*y,a[1]+u[1]*x+v[1]/vl*y,a[2]+u[2]*x+v[2]/vl*y];
}
function poseOf(p){
  const fx=Math.cos(p.face),fz=Math.sin(p.face),wx=-fz,wz=fx;
  const Hh=p.hgt,j=p.j,sp=hyp(p.vx,p.vz),run=clamp(sp/5,0,1);
  const at=(fw,sd,h)=>[p.x+fx*fw+wx*sd,p.z+fz*fw+wz*sd,h];
  if(p.sit){
    const hip=[p.x,p.z,BENCH.h+.05],sh=[p.x+fx*.06,p.z+fz*.06,BENCH.h+.05+Hh*.3],head=[sh[0],sh[1],sh[2]+Hh*.12];
    const feet=[at(.46,.14,0),at(.46,-.14,0)];
    const drink=p.arm==='drink';
    const hands=[at(.32,.16,BENCH.h+.16),drink?[head[0]+fx*.12,head[1]+fz*.12,head[2]-.02]:at(.32,-.16,BENCH.h+.16)];
    return{feet,hip,sh,head,hands};
  }
  if(p.tie>0)p.arm='tie';
  let c=clamp((p.tie>0?1:(p.cr===undefined?p.crouch:p.cr))+(p.land||0)*2.2,0,1);
  // The body bobs with the stride, leans into speed and folds forward as it crouches.
  const bob=p.air?0:.022*Math.cos(2*p.gait)*clamp(sp/2,0,1);
  const lean=clamp(sp*.035,0,.2)+c*.1;
  const hipH=Hh*.53*(1-.24*c)+j+bob;
  const hip=[p.x-fx*c*.05,p.z-fz*c*.05,hipH];
  const sh=[p.x+fx*lean,p.z+fz*lean,hipH+Hh*.29*(1-.1*c)];
  const head=[sh[0]+fx*.03,sh[1]+fz*.03,sh[2]+Hh*.12-bob*.4];
  const st=.1+.18*c,stride=clamp(sp*.12,0,.5),lift=(.07+.2*run)*Math.min(1,sp/2);
  const feet=[];
  for(const s of [1,-1]){
    let f,h;
    const ph=p.gait+(s>0?0:Math.PI);
    if(p.air){f=s*.05+.04;h=Math.max(0,j-.06-(s>0?.12:.03));}
    else if(p.tie>0&&s>0){f=-.25;h=0;}
    else if(p.fp){const q=p.fp[s>0?0:1];feet.push([q.x,q.z,q.h]);continue;}
    else{f=Math.sin(ph)*stride;h=Math.max(0,Math.cos(ph))*lift;}
    feet.push(at(f,s*st,h));
  }
  let hands,arm=p.arm;
  // Arms swing against the legs, higher and with more bend the faster the player runs.
  const swing=-Math.sin(p.gait)*(stride*.75+.03);
  const ds=p.dr.side*p.hand;
  if(arm==='defend'){const up=.08*Math.sin(t*3+p.id);hands=[at(.2,.5,sh[2]-.02+up*p.dhand),at(.2,-.5,sh[2]-.12-up*p.dhand)];}
  else if(arm==='dribble'){const bh=ball.holder===p?ball.h:hipH;hands=[at(.16,ds*.3,clamp(bh+BALL_R*.8,hipH-.25,hipH+.15)),at(.32,-ds*.14,sh[2]-.12)];if(ds<0)hands.reverse();}
  else if(arm==='hold'){hands=[at(.27,.1,hipH+.16),at(.27,-.1,hipH+.16)];}
  else if(arm==='set'){const u=p.setU||0;hands=[at(lerp(.27,.12,u),.08,lerp(hipH+.16,head[2]+.2,u)),at(lerp(.27,.12,u),-.08,lerp(hipH+.16,head[2]+.14,u))];}
  else if(arm==='follow'){hands=[at(.34,.06,head[2]+.24),at(.3,-.07,head[2]+.2)];}
  else if(arm==='layup'){const s=p.hand;hands=[at(.3,s*.12,head[2]+.36),at(.2,-s*.2,sh[2]-.2)];}
  else if(arm==='up'){hands=[at(.08,.17,head[2]+.44),at(.08,-.17,head[2]+.44)];}
  else if(arm==='reach'){hands=[at(.62,.08*p.dhand,hipH+.05),at(.15,-.35,sh[2]-.1)];}
  else if(arm==='pass'){hands=[at(.48,.1,sh[2]-.08),at(.48,-.1,sh[2]-.08)];}
  else if(arm==='knees'){hands=[at(.24,.16,hipH-.04),at(.24,-.16,hipH-.04)];}
  else if(arm==='tie'){hands=[at(-.2,.14,.18),at(-.18,.04,.18)];}
  else if(arm==='pockets'){hands=[at(.1,.19,hipH-.03),at(.1,-.19,hipH-.03)];}
  else if(arm==='phone'){hands=[at(.3,.05,sh[2]-.14),at(-swing*.6,-.22,hipH-.04)];}
  else{const raise=.04+.3*run;hands=[at(swing,.22,hipH-.04+Math.max(0,swing)*raise*3),at(-swing,-.22,hipH-.04+Math.max(0,-swing)*raise*3)];}
  return{feet,hip,sh,head,hands};
}
// Knees and elbows, solved from the hips, shoulders, feet and hands with two-bone IK.
function limbsOf(p,P){
  const fx=Math.cos(p.face),fz=Math.sin(p.face),wx=-fz,wz=fx,Hh=p.hgt;
  const thigh=Hh*.26,shin=Hh*.26,upper=Hh*.17,fore=Hh*.16;
  const kneeBend=p.sit?[fx,fz,.6]:p.air?[fx,fz,.5]:[fx,fz,.12];
  P.hipJ=P.feet.map((f,i)=>{const s=i?-1:1;return[P.hip[0]+wx*s*.1,P.hip[1]+wz*s*.1,P.hip[2]-.05];});
  P.knees=P.feet.map((f,i)=>ik2(P.hipJ[i],f,thigh,shin,kneeBend));
  const shJ=P.hands.map(h=>{const s=((h[0]-P.sh[0])*wx+(h[1]-P.sh[1])*wz)>=0?1:-1;return[P.sh[0]+wx*s*.19,P.sh[1]+wz*s*.19,P.sh[2]-.04,s];});
  P.elb=P.hands.map((h,i)=>{const s=shJ[i][3];return ik2(shJ[i],h,upper,fore,[wx*s*.55-fx*.55,wz*s*.55-fz*.55,-.45]);});
  P.shJ=shJ.map(v=>[v[0],v[1],v[2]]);
  return P;
}
// Ease the hips, shoulders, head and hands toward their new places, relative to the body, so changes of stance
// blend instead of snapping. Feet are never eased: they stay planted in the world.
const EASE={hip:22,sh:16,head:14,hands:18};
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
function placeHeldBall(){
  const p=ball.holder;if(!p)return;
  const P=p.pose;
  if(p.arm==='dribble'){
    // Dribble: down from the hand to the floor and back up, crossing over when a move is on.
    const fx=Math.cos(p.face),fz=Math.sin(p.face),sxv=-fz,szv=fx;
    const dr=p.dr,from=dr.from*p.hand,to=dr.side*p.hand;
    const top=clamp(p.pose.hip[2]-.02,.6,1.3);
    const hand=s=>[p.x+fx*.18+sxv*s*.3,p.z+fz*.18+szv*s*.3];
    let fp;
    if(dr.move==='between')fp=[p.x+fx*.02,p.z+fz*.02];
    else if(dr.move==='behind')fp=[p.x-fx*.16,p.z-fz*.16];
    else if(dr.move==='cross'||dr.move==='hesi')fp=[p.x+fx*.4,p.z+fz*.4];
    else fp=[p.x+fx*.32+sxv*to*.34,p.z+fz*.32+szv*to*.34];
    const ph=dr.ph;let a,b,u,h;
    if(ph<.5){a=hand(from);b=fp;u=ph/.5;h=top-(top-BALL_R)*Math.pow(u,1.35);}
    else{a=fp;b=hand(to);u=(ph-.5)/.5;h=BALL_R+(top-BALL_R)*(1-(1-u)*(1-u));}
    ball.x=lerp(a[0],b[0],u);ball.z=lerp(a[1],b[1],u);ball.h=h;
  }else{
    const hs=P.hands;ball.x=(hs[0][0]+hs[1][0])/2;ball.z=(hs[0][1]+hs[1][1])/2;ball.h=(hs[0][2]+hs[1][2])/2+(p.arm==='layup'?.1:.04);
    if(p.arm==='layup'){const h=hs[0];ball.x=h[0];ball.z=h[1];ball.h=h[2]+.06;}
  }
  ball.vx=p.vx;ball.vz=p.vz;ball.vh=0;
}
function dribbleTick(p,dt){
  const dr=p.dr,sp=hyp(p.vx,p.vz);
  dr.rate=lerp(1.7,2.7,clamp(sp/5,0,1))*(1+.15*Math.sin(t*.7+p.id*3));
  dr.ph+=dt*dr.rate*(dr.move==='hesi'?.55:1);
  if(dr.ph>=1){dr.ph-=1;dr.from=dr.side;dr.move=null;}
}
function dribbleMove(p,kind){
  if(p.dr.move||p.dr.ph>.2)return false;
  p.dr.move=kind;p.dr.from=p.dr.side;
  if(kind!=='hesi'&&kind!=='inout')p.dr.side=-p.dr.side;
  return true;
}

/* ---------- plans ---------- */
function arcSpot(r){
  const a=rr(-1.45,1.45);let x=HOOP.x+r*Math.sin(a),z=HOOP.z+r*Math.cos(a);
  if(z<.6){z=rr(.5,1.6);x=Math.sign(x||1)*rr(Math.min(7.1,r>ARC_R?6.9:r*.9),7.2);}
  return{x:clamp(x,-7.1,7.1),z:clamp(z,.4,11)};
}
function newPlan(p){
  const o=other(p);
  if(game.needClear){const s=arcSpot(rr(7.2,8.3));return{k:'clear',spot:s,t:0};}
  const kind=wpick([['three',p.style[0]*(1-.4*p.fatigue)*(1+.3*p.hot)],['mid',p.style[1]],['drive',p.style[2]*(1-.5*p.fatigue)],['post',p.style[3]*(p.hgt>o.hgt+.05?1.6:.5)],['iso',.55]]);
  let spot;
  if(kind==='three')spot=arcSpot(rr(7.05,7.9));
  else if(kind==='mid')spot=arcSpot(rr(3.4,5.6));
  else if(kind==='post'){const s=chance(.5)?1:-1;spot={x:s*rr(1.5,2.4),z:rr(1.9,3.3)};}
  else if(kind==='drive')spot={x:HOOP.x+rr(-.6,.6),z:HOOP.z+rr(.4,1)};
  else spot={x:p.x+rr(-1,1),z:p.z+rr(-.5,1)};
  return{k:kind,spot,t:0,arrived:false,size:expo(1.4)+.3,moveCD:rr(.2,.9)};
}
function between(o,q){
  // Is the defender q standing between the offense o and the rim?
  const hx=HOOP.x-o.x,hz=HOOP.z-o.z,hl=hyp(hx,hz)||1;
  const qx=q.x-o.x,qz=q.z-o.z,along=(qx*hx+qz*hz)/hl,lat=Math.abs(qx*hz-qz*hx)/hl;
  return along>0&&along<hl+.5&&lat<.75;
}
function pickMove(p){return wpick([['cross',1],['between',.7*p.handle+.1],['behind',.5*p.handle],['hesi',.6],['inout',.5],['spin',.25*p.handle]]);}
const MOVE_NAMES={cross:'crosses over',between:'goes between the legs',behind:'goes behind the back',hesi:'hits a hesitation',inout:'fakes in and out',spin:'spins'};

/* ---------- offense ---------- */
function offense(p,dt){
  const q=other(p),pl=p.plan;pl.t+=dt;game.possT+=dt;
  const dh=dHoop(p.x,p.z),gap=hyp(q.x-p.x,q.z-p.z),blocked=between(p,q)&&gap<1.4;
  p.arm='dribble';
  {const sp=hyp(p.vx,p.vz);p.crouch=sp>2.5?.12:gap<1.9?.38:.16;}
  const lookHoop=angTo(p,HOOP.x,HOOP.z);
  if(p.spinT>0){p.spinT-=dt;p.face+=dt*15;steer(p,pl.spot.x,pl.spot.z,p.speed*.8,dt,14);return;}
  const doMove=()=>{const m=pickMove(p);if(m==='spin'){if(!p.dr.move){p.spinT=.38;p.dr.move='cross';p.dr.side=-p.dr.side;p.dr.from=-p.dr.side;if(chance(.5))log('move',`${p.name} spins past ${q.name}`,{m});}return;}if(dribbleMove(p,m)&&chance(.22))log('move',`${p.name} ${MOVE_NAMES[m]}`,{m,x:Math.round(p.x),z:Math.round(p.z)});
    // A good move buys a step of space against a slow-reacting defender.
    if(m!=='hesi'&&chance(.3+.4*p.handle-.3*q.defense))q.lag=rr(.25,.6);};
  if(game.possT>15&&pl.k!=='clear'){startShot(p,dh>8.5?'heave':'jumper');return;}
  switch(pl.k){
    case 'clear':{
      const d=steer(p,pl.spot.x,pl.spot.z,p.speed*.6,dt);faceTo(p,angTo(p,pl.spot.x,pl.spot.z),dt);
      if(d<.5||dh>7.2){game.needClear=false;if(chance(.5))log('clear',`${p.name} takes it back past the arc`);p.plan=newPlan(p);}
      return;
    }
    case 'drive':{
      if(!pl.go){pl.go=true;if(chance(.55))doMove();}
      const tx=pl.spot.x+(blocked?(p.x>q.x?.8:-.8):0),tz=pl.spot.z;
      steer(p,tx,tz,p.speed*rr(.85,1),dt,12);faceTo(p,lookHoop,dt);
      if(dh<1.5){finish(p);return;}
      if(blocked&&gap<.85&&dh>2.2&&pl.t>.4){
        const c=wpick([['pullup',.25+p.style[1]*.25],['floater',dh<4.3?.35:0],['stepback',.15*p.handle],['spin',.3*p.handle],['power',.35*p.hgt/q.hgt],['reset',.15]]);
        if(c==='power'){pl.t=-1;q.lag=rr(.1,.3);}
        else if(c==='spin'){doMove();pl.t=0;}
        else if(c==='reset'){p.plan=newPlan(p);if(chance(.4))log('reset',`${q.name} cuts off the drive. ${p.name} backs it out`);}
        else if(c==='stepback')stepBack(p);
        else startShot(p,c);
      }
      if(pl.t>4)p.plan=newPlan(p);
      return;
    }
    case 'post':{
      // Back the defender down: face away from the rim and bump toward the block.
      const d=steer(p,pl.spot.x,pl.spot.z,p.speed*.32,dt,6);faceTo(p,lookHoop+Math.PI,dt,6);
      if((d<.4||pl.t>3.2)&&pl.t>1){
        const c=wpick([['hook',1],['turn',.8],['drop',.6*p.hops],['fade',.5]]);
        if(c==='drop'){p.plan={k:'drive',spot:{x:HOOP.x+(p.x>0?.35:-.35),z:HOOP.z+.5},t:0,go:true};if(chance(.4))log('move',`${p.name} drop-steps baseline`);}
        else{faceTo(p,lookHoop,1,99);startShot(p,c);}
      }
      return;
    }
    default:{
      // three, mid and iso: get to a spot, size the defender up, then decide.
      const d=steer(p,pl.spot.x,pl.spot.z,p.speed*(pl.arrived?.25:.62),dt);faceTo(p,lookHoop,dt);
      if(d<.45)pl.arrived=true;
      if(!pl.arrived&&pl.t<4)return;
      pl.moveCD-=dt;
      if(pl.moveCD<=0){pl.moveCD=rr(.5,1.4);if(chance(.55))doMove();else{pl.spot={x:clamp(p.x+rr(-.8,.8),-7,7),z:clamp(p.z+rr(-.6,.6),.5,10.5)};}}
      const open=gap>1.55||!between(p,q);
      const inRange=dh<(pl.k==='three'?8.3:6.2);
      if(open&&inRange&&chance(dt*2.2)){startShot(p,dh<2.6?'hook':open&&gap>2.4?'set':'jumper');return;}
      if(pl.t>pl.size+(pl.arrived?0:1.5)){
        const c=wpick([['drive',.5+p.style[2]*.6],['stepback',dh>3.5?.08+.12*p.handle:0],['pullup',.2],['fade',dh<5.5?.1:0],['jab',.15],['reset',.12]]);
        if(c==='drive'){p.plan={k:'drive',spot:{x:HOOP.x+rr(-.7,.7),z:HOOP.z+rr(.3,1)},t:0};}
        else if(c==='stepback')stepBack(p);
        else if(c==='jab'){pl.t=pl.size-rr(.6,1.2);p.vx+=Math.cos(lookHoop)*1.2;p.vz+=Math.sin(lookHoop)*1.2;q.lag=rr(.1,.35);}
        else if(c==='reset')p.plan=newPlan(p);
        else startShot(p,c==='pullup'?'pullup':'fade');
      }
    }
  }
}
function stepBack(p){
  const a=angTo(p,HOOP.x,HOOP.z);
  p.vx=-Math.cos(a)*rr(2.4,3.4);p.vz=-Math.sin(a)*rr(2.4,3.4);
  p.stepT=rr(.22,.32);p.act='stepback';p.actT=0;
  if(chance(.35))log('move',`${p.name} steps back`);
}
function finish(p){
  const q=other(p),reachTop=p.reach+p.hops*.9*(1-.3*p.fatigue);
  const crowd=hyp(q.x-HOOP.x,q.z-HOOP.z)<1.6&&hyp(q.x-p.x,q.z-p.z)<1.4;
  if(reachTop>HOOP.h+.18&&chance(.25+.5*(p.hops-.5))&&!crowd){
    p.act='dunk';p.actT=0;p.arm='layup';
    const a=angTo(p,HOOP.x,HOOP.z),d=dHoop(p.x,p.z);
    jump(p,1.05,Math.cos(a)*Math.max(1.4,d*1.6),Math.sin(a)*Math.max(1.4,d*1.6));
    return;
  }
  const kind=wpick([['layup',1],['reverse',Math.abs(p.x)<.9&&p.z<2.6?.6:.1],['roll',.4],['floater',crowd?.5:.05]]);
  startShot(p,kind);
}

/* ---------- defense ---------- */
function defend(q,o,dt){
  const dq=hyp(q.x-o.x,q.z-o.z);
  q.arm=dq<2.6?'defend':'side';q.crouch=dq<2?.55:dq<3?.3:.08;
  // Stay between the ball and the rim, giving more room to a player far from the basket.
  const dh=dHoop(o.x,o.z);
  const gap=clamp(1.05-q.defense*.35+(dh>7.6?.9:0)+.25*Math.sin(t*.35+q.id*2)+(o.hgt>q.hgt+.08?.15:0),.55,2.3);
  const ux=(HOOP.x-o.x)/(dh||1),uz=(HOOP.z-o.z)/(dh||1);
  const ix=o.x+ux*Math.min(gap,dh*.8),iz=o.z+uz*Math.min(gap,dh*.8);
  const tau=q.react+(q.lag||0);
  q.tgt.x+=(ix-q.tgt.x)*Math.min(1,dt/tau);q.tgt.z+=(iz-q.tgt.z)*Math.min(1,dt/tau);
  if(q.lag>0)q.lag=Math.max(0,q.lag-dt);
  steer(q,q.tgt.x,q.tgt.z,q.speed*.95,dt,13);
  faceTo(q,angTo(q,o.x,o.z),dt,10);
  // Reach for the ball now and then.
  const d=hyp(q.x-o.x,q.z-o.z);
  if(ball.holder===o&&o.arm==='dribble'&&d<.95&&!q.air&&q.act==='idle'&&chance(dt*.22*q.defense*(1.15-o.handle))){
    q.act='reach';q.actT=0;
    if(chance(.32*q.defense/(o.handle+.25))){
      ball.holder=null;ball.vx=(q.x-o.x)*rr(.5,2)+rr(-3,3);ball.vz=(q.z-o.z)*rr(.5,2)+rr(-3,3);ball.vh=rr(.5,2.5);ball.last=q.id;ball.noCatch=t+.15;ball.shot=null;
      log('steal',`${q.name} pokes it loose from ${o.name}`,{x:Math.round(o.x),z:Math.round(o.z)});
    }else if(chance(.12)){
      log('foul',`${o.name} calls a foul on the reach. ${pick(['No argument','A little argument','Some grumbling','A long argument'])}`);
      deadBall(o.id,'foul');
    }
  }
}

/* ---------- loose balls and rebounds ---------- */
function chase(p,dt){
  p.arm=ball.h>p.reach-.2?'up':'side';p.crouch=.06;
  const s=ball.shot;
  if(s&&!s.touched&&!s.done&&ball.h>1.8){
    // Shot in the air: crash toward the rim, inside position first.
    const a=Math.atan2(p.z-HOOP.z,p.x-HOOP.x),r=p.id===s.by?rr(1.2,1.8):rr(.9,1.4);
    steer(p,HOOP.x+Math.cos(a)*r,Math.max(HOOP.z+.2,HOOP.z+Math.sin(a)*r),p.speed*.7,dt);
    faceTo(p,angTo(p,ball.x,ball.z),dt);return;
  }
  const dist=hyp(ball.x-p.x,ball.z-p.z),lead=Math.min(.7,dist/p.speed);
  const tx=ball.x+ball.vx*lead,tz=ball.z+ball.vz*lead;
  steer(p,clamp(tx,-9,11.5),clamp(tz,-1.8,17.5),p.speed,dt,14);
  faceTo(p,angTo(p,ball.x,ball.z),dt);
  if(!p.air&&dist<.9&&ball.h>p.reach-.1&&ball.h<p.reach+p.hops&&(ball.vh<1||dist<.5)&&t>=ball.noCatch-.25)jump(p,1,p.vx*.6,p.vz*.6);
}
function canCatch(p){
  if(t<ball.noCatch||ball.holder)return false;
  if(p.act==='shoot'||p.act==='follow'&&p.actT<.25)return false;
  const s=ball.shot;if(s&&!s.touched&&!s.done&&dHoop(ball.x,ball.z)<1.1&&ball.h>HOOP.h-.35)return false;
  const d=hyp(ball.x-p.x,ball.z-p.z);
  const top=p.reach+p.j+(p.air?.15:0);
  // The defender boxes out, so gets a little more reach on rebounds.
  const r=game.phase==='live'&&p.id!==game.off&&ball.shot?.68:.52;
  return d<r&&ball.h<top&&ball.h>.05&&ballSpeed()<15;
}
function gotBall(p){
  ball.holder=p;ball.pass=null;const prev=ball.last;ball.last=p.id;
  const s=ball.shot;ball.shot=null;ball.noCatch=0;
  if(s&&!s.done)endShot(false,s);
  p.dr.ph=0;p.dr.move=null;p.dr.side=p.dr.from=1;
  // Whatever they were doing, the catcher now has the ball.
  p.act='idle';p.actT=0;p.spinT=0;
  if(game.phase!=='live')return;
  const q=other(p);
  if(p.id===game.off){
    if(s&&s.by===p.id&&!s.made){log('oreb',`${p.name} grabs the offensive board`);
      if(dHoop(p.x,p.z)<1.7&&dHoop(p.x,p.z)>.45&&chance(.5)){startShot(p,'tip');return;}}
    p.plan=newPlan(p);
  }else{
    game.off=p.id;game.needClear=true;game.possT=0;
    if(s)log('dreb',`${p.name} pulls down the rebound`);
    else if(prev!==p.id)log('recover',`${p.name} comes up with the loose ball`);
    p.plan=newPlan(p);
  }
}
function deadBall(nextOff,why){
  game.phase='dead';game.deadT=0;game.nextOff=nextOff;game.needClear=false;
  if(ball.holder&&why==='foul'){/* keep the ball where it is */}
  for(const p of players){p.act='idle';p.plan=null;}
}

/* ---------- the game loop for players ---------- */
function updatePlayers(dt){
  for(const p of players){
    p.actT+=dt;
    if(p.celebrate>0)p.celebrate-=dt;
    if(p.tie>0){p.tie-=dt;p.arm='tie';p.vx*=.8;p.vz*=.8;continue;}
    if(p.act==='reach'){p.arm='reach';if(p.actT>.35)p.act='idle';}
  }
  const o=players[game.off],q=other(o);
  if(game.phase==='break'){breakTick(dt);return;}
  if(game.phase==='dead'){deadTick(dt);return;}
  if(game.phase==='check'){checkTick(dt);return;}
  // Live play.
  for(const p of players){
    if(p.act==='shoot'){shootTick(p,dt);continue;}
    if(p.act==='dunk'){dunkTick(p,dt);continue;}
    if(p.act==='stepback'){p.arm='dribble';p.stepT-=dt;faceTo(p,angTo(p,HOOP.x,HOOP.z),dt,14);if(p.stepT<=0){p.act='idle';p.vx*=.2;p.vz*=.2;startShot(p,'stepback');}continue;}
    if(p.act==='follow'){p.arm='follow';if(p.actT>rr(.3,.5)||!ball.shot)p.act='idle';else continue;}
    if(p.act==='block'||p.act==='contest'){blockTick(p,dt);continue;}
    if(ball.holder===p){
      if(p.id===game.off){if(!p.plan)p.plan=newPlan(p);offense(p,dt);}
      else{p.arm='hold';}
    }else if(ball.holder===other(p)&&p.id!==game.off){defend(p,other(p),dt);}
    else if(!ball.holder){if(ball.stuck>0)stuckTick(p,dt);else chase(p,dt);}
    else{p.arm='side';steer(p,p.x,p.z,0,dt);}
  }
  void o;void q;
}
function shootTick(p,dt){
  const sh=p.sh,q=other(p);
  p.crouch=sh.jumped?.05:.5;p.arm='set';p.setU=clamp(p.actT/Math.max(.05,sh.gather+.08),0,1);
  faceTo(p,angTo(p,HOOP.x,HOOP.z),dt,12);
  if(!p.air)steer(p,p.x,p.z,0,dt,14);
  if(!sh.jumped&&p.actT>=sh.gather){
    sh.jumped=true;
    const a=angTo(p,HOOP.x,HOOP.z);
    let hx=p.vx*.5,hz=p.vz*.5;
    if(sh.spec.back){hx=-Math.cos(a)*rr(1.1,1.9);hz=-Math.sin(a)*rr(1.1,1.9);}
    if(sh.kind==='layup'||sh.kind==='reverse'||sh.kind==='roll'||sh.kind==='tip'){const d=dHoop(p.x,p.z);hx=Math.cos(a)*Math.min(2.4,d*1.5);hz=Math.sin(a)*Math.min(2.4,d*1.5);p.arm='layup';}
    jump(p,sh.spec.jump,hx,hz);
  }
  if(sh.kind==='layup'||sh.kind==='reverse'||sh.kind==='roll'||sh.kind==='tip')if(sh.jumped)p.arm='layup';
  // Release near the top of the jump, a little early or late each time.
  if(sh.jumped&&(p.jv<sh.relV||!p.air)){aimAndRelease(p);if(q.act!=='block'&&q.act!=='contest'&&!q.air)q.act='idle';}
}
function dunkTick(p,dt){
  p.arm='layup';p.crouch=.05;faceTo(p,angTo(p,HOOP.x,HOOP.z),dt,12);
  const hd=p.pose.hands[0];
  const dh=hyp(hd[0]-HOOP.x,hd[1]-HOOP.z);
  if(p.air&&dh<.45&&hd[2]>HOOP.h+.08){
    // Slam: the ball goes down through the ring.
    ball.holder=null;ball.x=HOOP.x+rr(-.05,.05);ball.z=HOOP.z+rr(-.05,.05);ball.h=HOOP.h+.16;ball.vx=rr(-.3,.3);ball.vz=rr(-.3,.3);ball.vh=-rr(4,6);
    ball.shot={by:p.id,kind:'layup',d:dHoop(p.x,p.z),x0:p.x,z0:p.z,val:1,rim:0,board:0,touched:true,done:false,made:false,blocked:false,t0:t,tEnd:t,contest:0,dunk:true};
    stats.shots++;ball.last=p.id;ball.noCatch=t+.4;rimShake.a=1.6;
    p.act='follow';p.actT=0;p.arm='up';
    return;
  }
  if(!p.air||p.jv<-1.5){p.sh={kind:'layup',spec:SHOTS.layup,gather:0,jumped:true,relV:9};aimAndRelease(p);}
}
function blockTick(p,dt){
  const o=other(p);
  p.arm=p.air?'up':p.act==='contest'&&p.actT>.15?'up':'defend';p.crouch=p.air?.05:.35;
  faceTo(p,angTo(p,o.x,o.z),dt,12);
  if(!p.air)steer(p,lerp(p.x,o.x,.25),lerp(p.z,o.z,.25),p.speed*.6,dt,12);
  if((p.actT>1.1&&!p.air)||(!ball.shot&&p.actT>.3&&!p.air)){p.act='idle';return;}
  // One jump per block or contest, then land.
  if(p.act==='block'&&!p.air&&!p.jumped&&p.actT>=p.blockAt){p.jumped=true;jump(p,1,(o.x-p.x)*.8,(o.z-p.z)*.8);}
  if(p.act==='contest'&&!p.air&&!p.jumped&&p.actT>.1&&p.actT<.2&&chance(.4)){p.jumped=true;jump(p,.35);}
  // Swat: the ball passes the defender's raised hands early in its flight.
  const s=ball.shot;
  if(s&&!s.done&&!s.blocked&&t-s.t0<.5&&p.air){
    for(const hd of p.pose.hands){
      if(hyp(ball.x-hd[0],ball.z-hd[1],ball.h-hd[2])<.27){
        s.blocked=true;s.done=true;
        const a=Math.atan2(ball.z-p.z,ball.x-p.x)+rr(-.9,.9),v=rr(2.5,7);
        ball.vx=Math.cos(a)*v;ball.vz=Math.sin(a)*v;ball.vh=rr(-2,2.5);ball.last=p.id;ball.noCatch=t+.12;ball.shot=null;
        log('block',`${p.name} ${pick(['blocks','swats','rejects','gets a hand on'])} ${o.name}'s ${shotName(s)}`,{k:s.kind});
        break;
      }
    }
  }
}
function stuckTick(p,dt){
  // One of them jumps to knock a wedged ball free.
  const tapper=players[ball.last===null?0:1-ball.last]||p;
  if(p!==tapper){p.arm='knees';steer(p,p.x,p.z,0,dt);return;}
  steer(p,HOOP.x+.3,HOOP.z+.45,p.speed*.5,dt);faceTo(p,angTo(p,HOOP.x,HOOP.z),dt);
  ball.stuck-=dt;
  if(ball.stuck<=0&&!p.air&&dHoop(p.x,p.z)<.9){jump(p,1);p.arm='up';
    ball.stuck=0;ball.vx=rr(-1,1);ball.vz=rr(.5,1.5);ball.vh=rr(.5,1.5);ball.shot=null;ball.noCatch=t+.3;log('unstuck',`${p.name} jumps and knocks it loose`);}
}

/* ---------- dead balls, checks and breaks ---------- */
function deadTick(dt){
  game.deadT+=dt;
  const off=players[game.nextOff];
  for(const p of players){
    p.crouch=0;
    if(p.celebrate>0){p.arm='up';steer(p,p.x,p.z,0,dt,6);continue;}
    if(ball.holder===p){p.arm='hold';continue;}
    if(!ball.holder&&game.deadT>.4&&ball.h<2.6){
      // Whoever is closer goes and gets the ball.
      const other_=other(p);const mine=hyp(ball.x-p.x,ball.z-p.z)<=hyp(ball.x-other_.x,ball.z-other_.z)+.3;
      if(mine){const d=steer(p,ball.x,ball.z,p.speed*.55,dt);faceTo(p,angTo(p,ball.x,ball.z),dt);p.arm='side';if(d<.5&&ball.h<1.3&&ballSpeed()<5){ball.holder=p;ball.shot=null;ball.pass=null;ball.last=p.id;}}
      else{p.arm='side';steer(p,lerp(p.x,0,.02),lerp(p.z,8,.02),1.2,dt);}
    }else{p.arm='side';steer(p,p.x,p.z,0,dt);}
  }
  if(ball.holder&&game.deadT>1){
    game.phase='check';game.step=0;game.stepT=0;game.off=game.nextOff;game.needClear=false;game.possT=0;
    game.spot={x:rr(-1.6,1.6),z:rr(9.2,10.4)};
    for(const p of players){p.act='idle';p.plan=null;}
  }
  void off;
}
function makePass(a,b,kind){
  const hs=a.pose.hands,sx0=(hs[0][0]+hs[1][0])/2,sz0=(hs[0][1]+hs[1][1])/2,sh0=(hs[0][2]+hs[1][2])/2;
  const tx=b.x+Math.cos(b.face)*.3,tz=b.z+Math.sin(b.face)*.3,th=b.hgt*.6;
  ball.holder=null;ball.x=sx0;ball.z=sz0;ball.h=sh0;
  if(kind==='bounce'){
    const fxp=lerp(sx0,tx,.62),fzp=lerp(sz0,tz,.62),T=rr(.32,.42);
    ball.vx=(fxp-sx0)/T;ball.vz=(fzp-sz0)/T;ball.vh=(BALL_R-sh0+.5*G*T*T)/T;
  }else{
    const T=rr(.38,.6);ball.vx=(tx-sx0)/T;ball.vz=(tz-sz0)/T;ball.vh=(th-sh0+.5*G*T*T)/T;
  }
  ball.pass={to:b.id};ball.last=a.id;ball.noCatch=t+.15;ball.shot=null;
  a.arm='pass';a.act='passing';a.actT=0;
}
function checkTick(dt){
  game.stepT+=dt;
  const o=players[game.off],q=other(o),C=game.spot;
  const ux=(HOOP.x-C.x),uz=(HOOP.z-C.z),ul=hyp(ux,uz)||1;
  const D={x:C.x+ux/ul*1.3,z:C.z+uz/ul*1.3};
  for(const p of players){p.crouch=0;if(p.act==='passing'){p.arm='pass';if(p.actT>.3)p.act='idle';}}
  const recv=p=>{if(ball.pass&&ball.pass.to===p.id&&!ball.holder){steer(p,p.x,p.z,0,dt);p.arm='hold';if(canCatch(p)){ball.holder=p;ball.pass=null;ball.last=p.id;return true;}if(ball.h<BALL_R+.02&&ballSpeed()<.8){ball.pass=null;}}return false;};
  switch(game.step){
    case 0:{
      // The ball has to end up with the offense before the check.
      if(ball.holder===o){game.step=1;game.stepT=0;break;}
      if(ball.holder===q){if(game.stepT>.4&&q.act!=='passing')makePass(q,o,chance(.5)?'bounce':'chest');faceTo(q,angTo(q,o.x,o.z),dt);break;}
      recv(o);
      if(!ball.holder&&!ball.pass){const d=steer(o,ball.x,ball.z,o.speed*.5,dt);if(d<.5&&ball.h<1.3)ball.holder=o;}
      break;
    }
    case 1:{
      const d1=steer(o,C.x,C.z,o.speed*.45,dt),d2=steer(q,D.x,D.z,q.speed*.5,dt);
      o.arm=ball.holder===o&&hyp(o.vx,o.vz)>.6?'dribble':'hold';
      faceTo(o,angTo(o,D.x,D.z),dt);faceTo(q,angTo(q,C.x,C.z),dt);q.arm='side';
      if(d1<.3&&d2<.3&&hyp(o.vx,o.vz)<.5&&ball.holder===o&&game.stepT>.6){game.step=2;game.stepT=0;game.wait=rr(.2,.9);}
      if(game.stepT>12){o.x=C.x;o.z=C.z;q.x=D.x;q.z=D.z;}
      break;
    }
    case 2:{o.arm='hold';q.arm='side';if(game.stepT>game.wait&&ball.holder===o){makePass(o,q,chance(.6)?'bounce':'chest');game.step=3;game.stepT=0;}break;}
    case 3:{if(recv(q)){game.step=4;game.stepT=0;game.wait=rr(.3,1.3);}else if(!ball.pass&&!ball.holder){game.step=0;}break;}
    case 4:{q.arm='hold';o.arm='side';if(game.stepT>game.wait&&ball.holder===q){makePass(q,o,chance(.5)?'bounce':'chest');game.step=5;game.stepT=0;}break;}
    case 5:{
      if(recv(o)){game.phase='live';game.possT=0;o.plan=newPlan(o);q.tgt.x=q.x;q.tgt.z=q.z;if(chance(.25))log('check',`Check ball. ${o.name} has it at the top`);}
      else if(!ball.pass&&!ball.holder){game.step=0;}
      break;
    }
  }
}
function breakTick(dt){
  game.breakT+=dt;
  const win=players[game.winner],lose=other(win);
  if(game.breakStep===0){
    win.arm=win.celebrate>0?'up':'side';lose.arm='knees';lose.crouch=.5;
    for(const p of players)steer(p,p.x,p.z,0,dt,6);
    if(!ball.holder&&ball.h<1.3&&ballSpeed()<4&&game.breakT>1){const d=steer(lose,ball.x,ball.z,1.6,dt);if(d<.5)ball.holder=lose;}
    if(game.breakT>3&&ball.holder){game.breakStep=1;game.breakT=0;}
    else if(game.breakT>3){const d=steer(lose,ball.x,ball.z,2,dt);if(d<.5)ball.holder=lose;}
  }else if(game.breakStep===1){
    // Walk to the bench and sit.
    let seated=0;
    players.forEach((p,i)=>{
      p.crouch=0;p.arm=ball.holder===p?'hold':'side';
      const sz=lerp(BENCH.z0+.6,BENCH.z1-.6,i===game.winner?0:1);
      const d=steer(p,BENCH.x-.05,sz,1.4,dt);faceTo(p,d>.3?angTo(p,BENCH.x,sz):Math.PI,dt);
      if(d<.12){p.sit=true;p.face=Math.PI;p.vx=p.vz=0;seated++;}
    });
    if(seated===2){game.breakStep=2;game.breakT=0;game.rest=rr(10,26);log('bench','Both take a seat on the bench',{});}
  }else if(game.breakStep===2){
    for(const p of players){p.fatigue=Math.max(0,p.fatigue-dt*.03);p.arm=p.drinkT>0?'drink':ball.holder===p?'hold':'side';if(p.drinkT>0)p.drinkT-=dt;else if(chance(dt*.12)){p.drinkT=rr(1.2,2.6);}}
    if(game.breakT>game.rest){
      for(const p of players){p.sit=false;p.x-=.3;}
      game.score=[0,0];game.games++;game.streak=[0,0];scoreDirty=true;
      game.off=game.rule==='make'?game.winner:lose.id;
      if(chance(.3))game.target=pick([7,11,15]);
      log('newgame',`Game ${game.games}, to ${game.target}. ${players[game.off].name} has the ball first`,{g:game.target});
      game.phase='check';game.step=0;game.stepT=0;game.spot={x:rr(-1.6,1.6),z:rr(9.2,10.4)};
      for(const p of players){p.act='idle';p.plan=null;p.hot=0;}
    }
  }
}

/* ---------- ambient events on their own timers ---------- */
const E={cats:[],walkers:[],leaves:[],bats:[],planes:[]};
let wind=0,windT=0;
const SCHED={cat:{m:110,f:18},walker:{m:75,f:9},flicker:{m:130,f:30},leaves:{m:150,f:20},bats:{m:200,f:45},plane:{m:200,f:22},tie:{m:300,f:120}};
for(const kk in SCHED)SCHED[kk].next=expo(SCHED[kk].f);
const SPAWN={
  cat(){
    if(E.cats.length)return false;
    const coat=pick(COATS),side=pick(['right','front','left']);
    let x,z;
    if(side==='right'){x=11.5;z=rr(1,14);}else if(side==='front'){x=rr(-6,9);z=17.5;}else{x=FENCE.x+.3;z=rr(1,14);}
    const across=chance(.3);
    const c={x,z,face:0,coat,state:'walk',T:0,dur:0,goal:null,path:[],spd:rr(.5,.85),across,startled:false,watched:false,ph:rr(0,5)};
    const n=across?2:ri(1,3);
    for(let i=0;i<n;i++)c.path.push(across?{x:rr(-6.5,6.5),z:rr(1,12)}:pick([{x:rr(7.8,8.6),z:rr(1,13)},{x:rr(-7,7),z:rr(14.3,15.2)},{x:rr(-8.7,-7.8),z:rr(1,13)},{x:rr(-6,6),z:rr(-1.4,-.4)}]));
    c.path.push(pick([{x:11.5,z:rr(0,15)},{x:rr(-6,9),z:17.5}]));
    E.cats.push(c);
    log('cat',`${cap(an(coat[0]))} ${coat[0]} cat ${across?'strolls onto the court':'wanders in at the edge of the court'}`,{c:coat[0],a:across});
  },
  walker(){
    if(E.walkers.length>1)return false;
    // Everyone has their own pace: a stroll, a walk, a brisk walk, a jog or the odd run.
    const kind=wpick([['stroll',2],['walk',3],['brisk',1.4],['jog',1.2],['run',.3],['dog',1.6],['pair',.9]]);
    const base={stroll:rr(.7,1.05),walk:rr(1.05,1.45),brisk:rr(1.45,1.85),jog:rr(2.3,3.3),run:rr(3.6,4.6),dog:rr(.9,1.4),pair:rr(.8,1.2)}[kind];
    const back=chance(.65),dir=chance(.5)?1:-1;
    const lane=back?{fixed:'z',v:rr(FENCE.z-1.6,FENCE.z-.8)}:{fixed:'x',v:rr(FENCE.x-1.6,FENCE.x-.8)};
    const fast=kind==='jog'||kind==='run';
    const n=kind==='pair'?2:1,people=[];
    for(let i=0;i<n;i++){const q=mkWalker();q.arm=fast?'side':wpick([['side',3],['pockets',1.4],['phone',kind==='pair'?.2:1]]);people.push(q);}
    const w={lane,u:dir>0?-14:16,end:dir>0?16:-14,dir,kind,base,v:base,seed:rr(0,500),
      stop:!fast&&chance(.35)?rr(-5,8):null,stopT:rr(3,9),people,ph:rr(0,6),dogCol:pick(['#8a6a48','#1c1b27','#d6d4de','#c8742f'])};
    E.walkers.push(w);
    const what={stroll:'Someone strolls past',walk:'Someone walks past',brisk:'Someone hurries past',jog:'A jogger runs past',run:'A runner sprints past',dog:'Someone walks a dog past',pair:'Two people stroll past'}[kind];
    log('walker',`${what} ${back?'behind the baseline fence':'along the side fence'}`,{k:kind,b:back});
  },
  flicker(){
    const L=pick(LIGHTS);if(L.mode)return false;
    if(chance(.3)){L.mode='out';L.until=t+rr(8,30);log('light','One of the floodlights cuts out',{});}
    else{L.mode='flicker';L.until=t+rr(1,3.5);log('light','A floodlight flickers and buzzes',{});}
  },
  leaves(){
    const n=ri(5,16),dir=wind>=0?1:-1;
    for(let i=0;i<n;i++)E.leaves.push({x:dir>0?rr(-12,-9):rr(10,12.5),z:rr(-1,15),h:rr(0,.6),vx:dir*rr(1.4,3.2),vz:rr(-.6,.6),ph:rr(0,6),col:pick(['#8a5a2a','#a87a3a','#6a4a22','#b8903a'])});
    log('leaves','A gust sends leaves skittering across the court',{n});
  },
  bats(){
    const n=ri(1,3),dir=chance(.5)?1:-1;
    for(let i=0;i<n;i++)E.bats.push({x:dir>0?-14:14,z:rr(-2,12),h:rr(5,8.5),vx:dir*rr(4,7),vz:rr(-1.5,1.5),ph:rr(0,6),wob:rr(1,3)});
    log('bats',n>1?'Bats flit over the lights':'A bat flits over the lights',{n});
  },
  plane(){
    if(horizon<40)return false;
    const dir=chance(.5)?1:-1;E.planes.push({x:dir>0?-20:W+20,y:rr(.08,.5)*horizon,v:dir*rr(25,50)*DPR,ph:rr(0,2)});
    log('plane','A plane blinks across the sky',{});
  },
  tie(){
    if(game.phase!=='check'&&game.phase!=='dead')return false;
    const p=pick(players);if(p.tie>0||ball.holder===p)return false;
    p.tie=rr(3,6);log('tie',`${p.name} stops to tie a shoelace`);
  }
};
function mkWalker(){
  return{hgt:rr(1.55,1.92),look:mkLook(['grey','#8a8a96'],true),
    x:0,z:0,vx:0,vz:0,face:0,j:0,jv:0,air:false,crouch:0,cr:0,gait:rr(0,6),arm:'side',dr:{side:1},hand:1,tie:0,sit:false,dhand:1};
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
  // Cats.
  for(const c of E.cats){
    c.T+=dt;
    const bd=hyp(ball.x-c.x,ball.z-c.z),bs=hyp(ball.vx,ball.vz);
    if(!c.startled&&!ball.holder&&bd<1.6&&bs>1.2&&ball.h<1){c.startled=true;c.state='run';c.T=0;c.runA=Math.atan2(c.z-ball.z,c.x-ball.x)+rr(-.6,.6);log('catball',`The cat leaps away from the bouncing ball`,{});}
    for(const p of players)if(hyp(p.x-c.x,p.z-c.z)<.8&&c.state!=='run'){c.state='run';c.T=0;c.runA=Math.atan2(c.z-p.z,c.x-p.x);}
    if(c.state==='run'){const v=3.2;c.x+=Math.cos(c.runA)*v*dt;c.z+=Math.sin(c.runA)*v*dt;c.face=c.runA;if(c.T>.7){c.state='walk';c.T=0;}continue;}
    if(c.state==='walk'){
      const g=c.path[0];if(!g){c.gone=true;continue;}
      const dx=g.x-c.x,dz=g.z-c.z,d=hyp(dx,dz);
      if(d<.15){c.path.shift();if(c.path.length){c.state=wpick([['sit',1],['groom',.6],['look',.8],['walk',.4]]);c.dur=c.state==='walk'?0:expo(5)+1.5;c.T=0;if(c.state==='sit'&&!c.watched&&chance(.5)){c.watched=true;log('catwatch','The cat sits and watches the game',{});}}continue;}
      c.x+=dx/d*c.spd*dt;c.z+=dz/d*c.spd*dt;c.face=Math.atan2(dz,dx);
    }else if(c.T>c.dur){c.state='walk';c.T=0;}
  }
  E.cats=E.cats.filter(c=>!c.gone&&c.x<13&&c.z<19&&c.x>-11);
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
  rimShake.a*=Math.pow(.02,dt);net.swish*=Math.pow(.15,dt);
}

/* ---------- update ---------- */
function update(dt){
  t+=dt;
  runSched();
  updatePlayers(dt);
  // Keep the two players from walking through each other.
  const a=players[0],b=players[1],dx=b.x-a.x,dz=b.z-a.z,d=hyp(dx,dz);
  if(d<.48&&d>1e-4&&!a.sit&&!b.sit){const push=(.48-d)/2;a.x-=dx/d*push;a.z-=dz/d*push;b.x+=dx/d*push;b.z+=dz/d*push;}
  for(const p of players){if(!p.sit)integrate(p,dt);if(ball.holder===p&&p.arm==='dribble')dribbleTick(p,dt);p.land=Math.max(0,(p.land||0)-dt);p.cr=lerp(p.cr===undefined?p.crouch:p.cr,p.crouch,1-Math.exp(-dt*5));updateFeet(p,dt);p.pose=limbsOf(p,easePose(p,poseOf(p),dt));}
  placeHeldBall();
  if(!ball.holder){
    const n=4;for(let i=0;i<n;i++)ballStep(dt/n);
    if(ball.stuck>0){ball.vx=ball.vz=ball.vh=0;}
    // Catches. Passes go to their target, everything else to whoever gets there first.
    if(game.phase==='live'&&!ball.pass){
      const cands=players.filter(canCatch);
      if(cands.length){const p=cands.length>1?(chance(.5+(cands[0].hgt-cands[1].hgt)*2+(cands[0].hops-cands[1].hops))?cands[0]:cands[1]):cands[0];gotBall(p);}
    }
    if(game.phase==='live'&&ball.pass&&!ball.holder){const r=players[ball.pass.to];if(canCatch(r))gotBall(r);}
    // Out of bounds: off whoever touched it last.
    if(game.phase==='live'&&!inBounds(ball.x,ball.z)&&ball.h<.6&&!(ball.shot&&!ball.shot.done)){
      const last=ball.last===null?game.off:ball.last;
      log('oob',`Out of bounds off ${players[last].name}`,{});
      deadBall(1-last,'oob');
    }
    // A loose ball that dies on the floor goes back to the offense.
    if(game.phase==='live'&&ball.h<=BALL_R+.01&&ballSpeed()<.15){ball.restT+=dt;if(ball.restT>2.5){deadBall(game.off,'rest');ball.restT=0;}}else ball.restT=0;
  }
  watchdog(dt);
  updateAmbient(dt);
}
// If play ever stops moving, reset to a fresh check at the top rather than freezing.
let lastPhase='',phaseT=0,lastShots=0,quietT=0;
function watchdog(dt){
  if(game.phase!==lastPhase){lastPhase=game.phase;phaseT=0;quietT=0;}else phaseT+=dt;
  if(stats.shots!==lastShots){lastShots=stats.shots;quietT=0;}else quietT+=dt;
  const stuck=(game.phase==='live'&&quietT>30)||((game.phase==='check'||game.phase==='dead')&&phaseT>30);
  if(!stuck)return;
  stats.resets=(stats.resets||0)+1;
  const o=players[game.phase==='dead'?game.nextOff:game.off];
  for(const p of players){p.act='idle';p.plan=null;p.air=false;p.j=0;p.jv=0;p.tie=0;p.celebrate=0;}
  ball.holder=o;ball.shot=null;ball.pass=null;ball.stuck=0;
  game.off=o.id;game.needClear=false;game.possT=0;game.phase='check';game.step=1;game.stepT=0;
  game.spot={x:rr(-1.6,1.6),z:rr(9.2,10.4)};
  quietT=0;phaseT=0;
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
  const sleeved=L.top==='hoodie'||L.top==='jacket';
  const leg=(i,far)=>{
    const ft=P.feet[i],s=i?-1:1,A=P2(P.hipJ[i]),K=P2(P.knees[i]),F=P2(ft);
    const dk=col=>far?shade(col,-.4):col;
    if(L.bottom==='shorts'){
      line(A,K,legW*.82,dk(L.skin));line(K,F,legW*.74,dk(L.skin));
      line(mix(F,K,.3),F,legW*.78,dk(L.socks));
      line(A,mix(A,K,.82),legW*1.2,dk(L.botCol));
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
      if(L.top==='tee')line(S,mix(S,E2,.55),armW*1.4,dk(L.topCol));
    }
    ctx.fillStyle=dk(L.skin);ctx.beginPath();ctx.arc(Hd[0],Hd[1],.055*k,0,Math.PI*2);ctx.fill();
  };
  leg(fo[0],true);arm(ao[0],true);
  // A hood worn down bunches up behind the neck.
  const neckP=P2([P.sh[0],P.sh[1],P.sh[2]+.02]);
  if(L.hood==='down'){const b=P2([P.sh[0]-fx*.1,P.sh[1]-fz*.1,P.sh[2]+.06]);ctx.fillStyle=shade(L.topCol,-.15);ctx.beginPath();ctx.ellipse(b[0],b[1],.17*k,.1*k,0,0,Math.PI*2);ctx.fill();}
  // Torso: broad at the shoulders, tapering to the waist. A jacket or hoodie hangs below the hips and trails when running.
  const shoW=L.top==='tank'?.17:.24;
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
  if(L.top==='tank'){const nR=mix(sR,neckP,.45),nL=mix(sLft,neckP,.45);ctx.moveTo(sR[0],sR[1]);ctx.lineTo(nR[0],nR[1]);ctx.quadraticCurveTo(neckP[0],neckP[1]+.08*k,nL[0],nL[1]);ctx.lineTo(sLft[0],sLft[1]);}
  else{ctx.moveTo(sR[0],sR[1]);ctx.quadraticCurveTo(neckP[0],neckP[1]-(sleeved?.04:-.03)*k,sLft[0],sLft[1]);}
  ctx.quadraticCurveTo(sL2[0],sL2[1]-.03*k,sL2[0],sL2[1]);ctx.lineTo(wL[0],wL[1]);ctx.lineTo(hL[0],hL[1]);
  ctx.lineTo(hR[0],hR[1]);ctx.lineTo(wR[0],wR[1]);ctx.lineTo(sR2[0],sR2[1]);ctx.quadraticCurveTo(sR2[0],sR2[1]-.03*k,sR[0],sR[1]);ctx.closePath();ctx.fill();
  // Folds: creases from the armpits toward the waist and across it, deeper as the body bends or twists.
  {const fold=clamp(.25+c*.9+hyp(p.vx,p.vz)*.06,0,1),w=mix(wR,wL,.5);
   ctx.globalAlpha=.3*fold;ctx.lineWidth=.014*k;ctx.strokeStyle='#000';ctx.beginPath();
   for(const[a,u]of[[sR2,.35],[sL2,.65]]){ctx.moveTo(a[0],a[1]);ctx.quadraticCurveTo(lerp(a[0],w[0],.5),lerp(a[1],w[1],.5)+.04*k,lerp(wR[0],wL[0],u),lerp(wR[1],wL[1],u));}
   ctx.moveTo(wR[0],wR[1]);ctx.quadraticCurveTo(w[0],w[1]+.05*k*fold,wL[0],wL[1]);ctx.stroke();ctx.globalAlpha=1;}
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
  // Scarf, or a high collar, wrapped at the neck.
  if(L.neck){const n=[(neckP[0]*2+head[0])/3,(neckP[1]*2+head[1])/3];ctx.fillStyle=L.top==='jacket'?shade(L.topCol,-.1):L.neck;ctx.beginPath();ctx.ellipse(n[0],n[1],.13*k,(L.top==='jacket'?.09:.07)*k,0,0,Math.PI*2);ctx.fill();}
  leg(fo[1],false);
  drawHead(p,head,sv,toCam,faceDir);
  arm(ao[1],false);
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
    case 'bun':top(1.03,.78);ctx.beginPath();ctx.arc(head[0]-fd[0]*r*.4,head[1]-r*1.1,r*.32,0,Math.PI*2);ctx.fill();break;
    default:top(1.04,.82);
  }
}
function drawHeadwear(L,head,r,fd,toCam){
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
  const d={...p,x:0,z:0,vx:0,vz:0,face:Math.PI/4,j:0,jv:0,air:false,crouch:0,cr:0,arm:'side',sit:false,tie:0,fp:null,ease:null,land:0,gait:0,dr:{side:1,ph:0,from:1,move:null}};
  d.pose=limbsOf(d,poseOf(d));
  k=S*1.55;kh=k*.82;ox=S/2;oy=S*.46+d.pose.head[2]*kh;ctx=g;
  const bg=g.createRadialGradient(S/2,S*.4,4,S/2,S/2,S*.72);bg.addColorStop(0,shade(p.look.col,-.5));bg.addColorStop(1,'#05050c');g.fillStyle=bg;g.fillRect(0,0,S,S);
  drawPerson(d);
  ({ctx,k,kh,ox,oy}=keep);
  p.look.avatarURL=c.toDataURL();scoreDirty=true;
}
function drawBall(){
  const r=Math.max(2,BALL_R*k*1.02),px=sx(ball.x,ball.z),py=sy(ball.x,ball.z,ball.h);
  const g=ctx.createRadialGradient(px-r*.35,py-r*.4,r*.1,px,py,r);g.addColorStop(0,'#ffb070');g.addColorStop(.55,'#e0702a');g.addColorStop(1,'#7a3410');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.clip();
  ctx.strokeStyle='rgba(30,10,0,.8)';ctx.lineWidth=Math.max(.8,r*.09);
  const s=ball.spin;
  ctx.beginPath();ctx.ellipse(px,py,r,r*Math.abs(Math.cos(s)),0,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.ellipse(px,py,r*Math.abs(Math.sin(s*.7)),r,0,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}
function drawBoard(){
  toPlaneZ(ctx,BOARD.z);
  const w=BOARD.w,b=BOARD.b,h=BOARD.t-BOARD.b;
  ctx.fillStyle='rgba(190,210,255,.13)';ctx.fillRect(-w/2,b,w,h);
  const rg=ctx.createLinearGradient(-w/2,BOARD.t,w/2,b);rg.addColorStop(0,'rgba(255,255,255,0)');rg.addColorStop(.42,'rgba(255,255,255,0)');rg.addColorStop(.5,'rgba(255,255,255,.18)');rg.addColorStop(.58,'rgba(255,255,255,0)');
  ctx.fillStyle=rg;ctx.fillRect(-w/2,b,w,h);
  ctx.strokeStyle='#eef2ff';ctx.lineWidth=.05;ctx.strokeRect(-w/2,b,w,h);
  ctx.strokeStyle='#ff6a3a';ctx.strokeRect(-.295,HOOP.h+.15,.59,.45);
  ctx.fillStyle='#2a2c3a';ctx.fillRect(-w/2,b-.06,w,.06);
  reset(ctx);
  line(P3(0,BOARD.z,HOOP.h-.03),P3(0,HOOP.z-HOOP.r,HOOP.h-.03),.04*k,'#c8501e');
}
function netPoint(i,lv,N){
  const a=(i+(lv%2)*.5)/N*Math.PI*2,u=lv/4;
  const r=HOOP.r*lerp(1,.58,u),sw=(net.swish*.06*Math.sin(t*16+i*.7)+wind*.02)*u;
  return[HOOP.x+r*Math.cos(a)+sw,HOOP.z+r*Math.sin(a),HOOP.h-u*.42+net.swish*.08*u+rimShake.a*.02*Math.sin(t*40)];
}
function drawRim(front){
  // Net: a diamond mesh hanging from the ring, then the ring itself.
  const N=14;
  ctx.strokeStyle=front?'rgba(240,240,250,.85)':'rgba(220,220,235,.45)';ctx.lineWidth=Math.max(.8,.012*k);
  ctx.beginPath();
  for(let lv=0;lv<4;lv++)for(let i=0;i<N;i++){
    const a=netPoint(i,lv,N),isF=a[1]>HOOP.z;if(isF!==front)continue;
    for(const j of lv%2?[i,i+1]:[i-1,i]){const b=netPoint((j+N)%N,lv+1,N);const A=P2(a),B=P2(b);ctx.moveTo(A[0],A[1]);ctx.lineTo(B[0],B[1]);}
  }
  ctx.stroke();
  toGround(ctx,HOOP.h+rimShake.a*.03*Math.sin(t*40));
  ctx.strokeStyle='#ff5a1f';ctx.lineWidth=.035;ctx.beginPath();ctx.arc(HOOP.x,HOOP.z,HOOP.r,front?0:Math.PI,front?Math.PI:Math.PI*2);ctx.stroke();
  ctx.strokeStyle='rgba(255,200,160,.6)';ctx.lineWidth=.01;ctx.beginPath();ctx.arc(HOOP.x,HOOP.z,HOOP.r+.008,front?0:Math.PI,front?Math.PI:Math.PI*2);ctx.stroke();
  reset(ctx);
}
function drawCat(c){
  const moving=c.state==='walk'||c.state==='run';
  const [px,py]=P3(c.x,c.z,0),s=.5*k;
  const dirS=Math.cos(c.face)-Math.sin(c.face)>=0?1:-1;
  const ph=(t+c.ph)*(c.state==='run'?14:6);
  ctx.save();ctx.translate(px,py);ctx.scale(dirS,1);
  ctx.fillStyle=c.coat[1];ctx.strokeStyle=c.coat[1];ctx.lineCap='round';
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
function drawDog(x,z,col,ph){
  const[px,py]=P3(x,z,0),s=.55*k;ctx.save();ctx.translate(px,py);
  ctx.fillStyle=col;ctx.strokeStyle=col;ctx.lineCap='round';ctx.lineWidth=s*.08;
  for(const[lx,o]of[[-.2,0],[-.1,Math.PI],[.16,Math.PI],[.24,0]]){ctx.beginPath();ctx.moveTo(s*lx,-s*.22);ctx.lineTo(s*lx+Math.sin(ph*9+o)*s*.08,0);ctx.stroke();}
  ctx.beginPath();ctx.ellipse(0,-s*.3,s*.3,s*.13,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(s*.32,-s*.46,s*.13,s*.1,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.moveTo(-s*.28,-s*.34);ctx.lineTo(-s*.42,-s*.5+Math.sin(ph*12)*s*.05);ctx.stroke();
  ctx.restore();
}
function draw(){
  reset(ctx);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.drawImage(floorC,0,0);
  // Sky details: antenna lights and the odd plane.
  for(const b of blinkers)if(((t+b.ph)%b.per)<.18){ctx.fillStyle='#ff4a4a';ctx.beginPath();ctx.arc(b.x,b.y,1.6*DPR,0,Math.PI*2);ctx.fill();}
  for(const p of E.planes){ctx.fillStyle='#e8ecff';ctx.beginPath();ctx.arc(p.x,p.y,1.4*DPR,0,Math.PI*2);ctx.fill();if((p.ph%1)<.15){ctx.fillStyle='#ff4a4a';ctx.beginPath();ctx.arc(p.x-4*DPR,p.y,1.4*DPR,0,Math.PI*2);ctx.fill();}}
  // A floodlight that is dimmed or out takes its pool of light with it.
  for(const L of LIGHTS)if(L.I<.97){const p=poolOf(L);toGround(ctx);const g=ctx.createRadialGradient(p.x,p.z,0,p.x,p.z,11.5);g.addColorStop(0,`rgba(2,2,10,${(.5*(1-L.I)).toFixed(3)})`);g.addColorStop(1,'rgba(2,2,10,0)');ctx.fillStyle=g;ctx.fillRect(p.x-12,p.z-12,24,24);reset(ctx);}
  // People walking behind the fence, then the fence itself.
  const behind=[];for(const w of E.walkers)for(const p of w.people)behind.push(p);
  behind.sort((a,b)=>(a.x+a.z)-(b.x+b.z));
  for(const p of behind){shadowsFor(p.x,p.z,1.2,.22,.6);drawPerson(p);}
  for(const w of E.walkers)if(w.kind==='dog'){const p=w.people[0];const dx=w.lane.fixed==='z'?w.dir*.7:0,dz=w.lane.fixed==='x'?w.dir*.7:0;drawDog(p.x+dx,p.z+dz+(w.lane.fixed==='z'?.3:0),w.dogCol,w.dph||0);}
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
  for(const p of players)if(!p.sit)shadowsFor(p.x,p.z,p.hgt*.8*(1+p.j*.3),.24,1-.5*Math.min(1,p.j));
  shadowsFor(ball.x,ball.z,.35+ball.h*.15,.12,clamp(1-ball.h*.18,.15,1));
  for(const c of E.cats)shadowsFor(c.x,c.z,.5,.14,.6);
  const list=[];
  list.push({d:BOARD.z+.05,f:drawBoard});
  list.push({d:HOOP.x+HOOP.z-.2,f:()=>drawRim(false)});
  list.push({d:HOOP.x+HOOP.z+.2,f:()=>drawRim(true)});
  for(const p of players)list.push({d:p.x+p.z+(p.sit?.4:0),f:()=>drawPerson(p)});
  list.push({d:ball.x+ball.z+(ball.holder?.2:0),f:drawBall});
  for(const c of E.cats)list.push({d:c.x+c.z,f:()=>drawCat(c)});
  list.sort((a,b)=>a.d-b.d);
  for(const it of list)it.f();
  // Bats over the court.
  for(const b of E.bats){const[px,py]=P3(b.x,b.z,b.h);const up=Math.sin(b.ph),s=.22*k;ctx.fillStyle='#05050c';ctx.beginPath();ctx.moveTo(px,py);ctx.quadraticCurveTo(px-s*.5,py-s*up,px-s,py-s*.3*up);ctx.quadraticCurveTo(px-s*.5,py+s*.1,px,py+s*.15);ctx.quadraticCurveTo(px+s*.5,py+s*.1,px+s,py-s*.3*up);ctx.quadraticCurveTo(px+s*.5,py-s*up,px,py);ctx.fill();}
}

/* ---------- start ---------- */
// ?debug exposes the live state for poking at in the console.
if(new URLSearchParams(location.search).has('debug'))window.HC={paused:false,proj:(x,z,h)=>P3(x,z,h),game,players,ball,E,logArr,stats,SHOTS,AIM,get t(){return t;},run(sec){for(let i=0;i<sec*60;i++)update(1/60);draw();uiDirty=true;updateUI();},
  step(n){for(let i=0;i<n;i++)update(1/60);},
  // Fire n uncontested shots of one kind from (x, z) and report how many go in and how they miss.
  testShot(kind,x,z,n){const p=players[0],q=players[1],res={made:0,rim:0,board:0,air:0};
    for(let i=0;i<n;i++){q.x=-8;q.z=13;q.act='idle';p.x=x;p.z=z;p.vx=p.vz=0;p.face=angTo(p,HOOP.x,HOOP.z);p.fatigue=0;p.hot=0;
      const lay=['layup','reverse','roll','tip'].includes(kind);p.arm=lay?'layup':'set';p.setU=1;p.j=SHOTS[kind].jump*p.hops*.85;p.air=true;p.jv=0;
      p.pose=limbsOf(p,poseOf(p));ball.holder=p;ball.stuck=0;p.sh={kind,spec:SHOTS[kind]};aimAndRelease(p);
      for(let s=0;s<1200&&ball.shot&&!ball.shot.done;s++)ballStep(1/240);
      const sh=ball.shot;if(sh&&sh.made)res.made++;else if(sh){if(sh.rim)res.rim++;else if(sh.board)res.board++;else res.air++;}
      ball.shot=null;ball.stuck=0;}
    p.air=false;p.j=0;return res;}};
build();
for(const p of players)renderAvatar(p);
for(const p of players)log('player',describe(p),{h:p.hgt,s:p.speed});
log('rules',`${SURF.name[0].toUpperCase()+SURF.name.slice(1)} court. Game to ${game.target}${game.winBy2?', win by two':''}, ${game.rule==='make'?'make it take it':"loser's ball"}. Ones and twos`,{});
// Start with the offense holding the ball at the top and the defender facing up.
{const o=players[game.off],q=other(o);game.spot={x:rr(-1.5,1.5),z:rr(9.2,10.3)};o.x=game.spot.x+rr(-2,2);o.z=game.spot.z+rr(.5,2);q.x=rr(-2,2);q.z=rr(5,7);ball.holder=o;for(const p of players)p.pose=limbsOf(p,poseOf(p));placeHeldBall();}
if(RM){
  // Reduced motion: play a while out of sight, then show one still frame.
  for(let i=0;i<900;i++)update(1/30);
  draw();updateUI();
}else{
  draw();updateUI();
  let last=performance.now(),uiT=0,lastDraw=0;
  function frame(now){
    if(PAUSED){last=now;requestAnimationFrame(frame);return;}
    if(LOWQ&&now-lastDraw<32){requestAnimationFrame(frame);return;}
    lastDraw=now;
    let dt=Math.min(.1,Math.max(0,(now-last)/1000))*SPEED;last=now;
    if(window.HC&&window.HC.paused)dt=0;
    while(dt>0){const s=Math.min(dt,1/60);update(s);dt-=s;}
    draw();uiT+=1/60;if(uiT>.5){uiT=0;updateUI();}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{build();draw();},200);});
const CLOSE_ICON='<svg viewBox="0 0 7 7" width="16" height="16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M0 0h1v1H0zM1 1h1v1H1zM2 2h1v1H2zM3 3h1v1H3zM4 4h1v1H4zM5 5h1v1H5zM6 6h1v1H6zM6 0h1v1H6zM5 1h1v1H5zM4 2h1v1H4zM2 4h1v1H2zM1 5h1v1H1zM0 6h1v1H0z"/></svg>';
function toggleLog(){ui.panel.hidden=!ui.panel.hidden;ui.btn.setAttribute('aria-expanded',String(!ui.panel.hidden));if(ui.panel.hidden){ui.btn.textContent='Log';ui.btn.classList.remove('icon');ui.btn.removeAttribute('aria-label');}else{ui.btn.innerHTML=CLOSE_ICON;ui.btn.classList.add('icon');ui.btn.setAttribute('aria-label','Close log');}uiDirty=true;updateUI();}
ui.btn.addEventListener('click',e=>{e.stopPropagation();toggleLog();});
cv.addEventListener('click',()=>ui.hud.classList.toggle('off'));
addEventListener('keydown',e=>{if(e.key==='l'||e.key==='L')toggleLog();if(e.key==='h'||e.key==='H')ui.hud.classList.toggle('off');});
async function wake(){try{if('wakeLock'in navigator&&document.visibilityState==='visible')await navigator.wakeLock.request('screen');}catch(e){}}
if(!EMBED){wake();document.addEventListener('visibilitychange',wake);}
})();
