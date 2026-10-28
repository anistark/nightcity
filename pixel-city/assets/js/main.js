/* Pixel City: a procedural pixel-art night city.
   Every event is generated on the fly from a generator seeded with the moment the page opens,
   so the scene never loops. No libraries, no image files: everything is drawn to a Canvas. */
(()=>{
'use strict';
const cv=document.getElementById('scene');
const ctx=cv.getContext('2d');
const RM=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
// ?embed runs the scene as a background on another site: no overlay, no wake lock, lower quality unless q=high,
// and the host page can pause and resume it with postMessage({nightcity:'pause'}) and {nightcity:'play'}.
const QS=new URLSearchParams(location.search),EMBED=QS.has('embed'),LOWQ=EMBED&&QS.get('q')!=='high';
let PAUSED=false;
if(EMBED){document.documentElement.classList.add('embed');addEventListener('message',e=>{const m=e.data&&e.data.nightcity;if(m==='pause')PAUSED=true;if(m==='play')PAUSED=false;});}
// nightcity.step(dt) advances one frame and draws it, for frame-exact recordings.
if(EMBED)window.nightcity={step(dt){PAUSED=true;t+=dt;update(dt);draw();}};

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
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function wpick(list){let s=0;for(const it of list)s+=it[1];let r=R()*s;for(const it of list){r-=it[1];if(r<=0)return it[0];}return list[0][0];}
const NT=new Float32Array(4096);for(let i=0;i<4096;i++)NT[i]=R();
function noise(x){const i=Math.floor(x),f=x-i,u=f*f*(3-2*f),a=NT[i&4095],b=NT[(i+1)&4095];return a+(b-a)*u;}
function fbm(x){return noise(x)*.55+noise(x*2.031+17.3)*.3+noise(x*4.97+91.1)*.15;}

/* ---------- palettes ---------- */
const FARC=['#121133','#13143a','#100f2c','#141236'];
const MIDC=['#1d1a3d','#211e47','#1a2142','#25203f','#1c2338','#201a36'];
const WARM=['#ffd27a','#ffbf66','#ffe3a6','#f7c27a','#ffd9a0'];
const COOL=['#cfe2ff','#b8d4ff','#e0f0ff'];
const ODD=['#b9ffd2','#ffb3c8'];
const CARC=[['red','#a8384a'],['white','#c9cdd9'],['silver','#868ca3'],['blue','#3a5aa8'],['black','#25242f'],['green','#2f7356'],['mustard','#c9a23c'],['orange','#c4682f'],['teal','#2b8288'],['maroon','#6a2a3c'],['grey','#5a5d6e'],['sky blue','#6a9ad0']];
const BUSC=[['red','#b8434e'],['green','#3f8a5a'],['blue','#3c64b0'],['white','#cfd3de'],['orange','#d0793a']];
const BOXC=[['white','#b9bdca'],['blue','#3b5a92'],['silver','#9aa0b2'],['green','#3f7a5a'],['brown','#7a5a42']];
const COATS=[['black','#1c1b27','#1c1b27'],['orange','#c8742f','#e3a160'],['grey','#6c7084','#8d91a6'],['white','#d6d4de','#eeeef4'],['tabby','#8a6a48','#a8875e'],['tuxedo','#1c1b27','#e4e4ec'],['ginger-and-white','#c8742f','#eeeef4']];
const NEONC=[['pink','#ff4fa3'],['cyan','#4ff0ff'],['red','#ff4a4a'],['violet','#b46bff'],['green','#6bff9a']];
const FWC=['#ff6b8a','#ffd36b','#7bdcff','#b48bff','#8bffb0','#ffffff','#ff9b5a'];
const VK=[['car',46],['taxi',12],['van',9],['bus',7],['truck',8],['moto',8],['scooter',5],['police',2],['ambulance',2]];
const WORDS=['HOTEL','BAR','OPEN','24H','RAMEN','MOTEL','SUSHI','DINER','NOODLE'];
const FONT={A:['010','101','111','101','101'],B:['110','101','110','101','110'],D:['110','101','101','101','110'],E:['111','100','110','100','111'],H:['101','101','111','101','101'],I:['111','010','010','010','111'],L:['100','100','100','100','111'],M:['101','111','111','101','101'],N:['110','101','101','101','101'],O:['111','101','101','101','111'],P:['110','101','110','100','100'],R:['110','101','110','101','101'],S:['011','100','010','001','110'],T:['111','010','010','010','010'],U:['101','101','101','101','111'],'2':['110','001','010','100','111'],'4':['101','101','111','001','001']};
const CAT={
  walkA:['......b.b.','......bbbb','......bbeb','..bbbbbbb.','..bbbbbbb.','..l.l.l.l.'],
  walkB:['......b.b.','......bbbb','......bbeb','..bbbbbbb.','..bbbbbbb.','...l.l.l..'],
  look: ['......b.b.','......bbbb','......bebe','..bbbbbbb.','..bbbbbbb.','..l.l.l.l.'],
  sit:  ['.....b.b..','.....bbbb.','.....bbeb.','.....bbb..','....bbbb..','...bbbbbl.'],
  groom:['..........','.....b.b..','.....bbbb.','.....bbbb.','....bbbbb.','...bbbbbl.']
};
const WALK_T=[[[1,3],[0,2],[0,1]],[[1,3],[1,2],[1,1]],[[1,3],[0,2],[1,1]]];
const SIT_T=[[[2,5],[1,5],[0,5]],[[2,5],[1,5],[0,4]],[[2,5],[1,4],[0,3]]];
const PERSON=['.hh.','.hh.','bbbb','bbbb','bbbb','bbbb','.bb.','.bb.','.b.b'];
const an=w=>/^[aeiou]/i.test(w)?'an':'a';

/* ---------- helpers ---------- */
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return[c,c.getContext('2d')];}
function rect(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(Math.floor(x),Math.floor(y),w,h);}
function hex(c){const n=parseInt(c.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
function shade(c,f){const v=hex(c).map(x=>f<0?x*(1+f):x+(255-x)*f);return'#'+v.map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('');}
function glowSprite(r,rgb,amax){const S=r*2+1;const[c,g]=mk(S,S);for(let y=0;y<S;y++)for(let x=0;x<S;x++){const d=Math.hypot(x-r,y-r);if(d<=r){g.fillStyle=`rgba(${rgb},${(amax*Math.pow(1-d/r,1.5)).toFixed(3)})`;g.fillRect(x,y,1,1);}}return c;}
const glowLamp=glowSprite(6,'255,170,90',.32);
const glowRed=glowSprite(2,'255,60,70',.5);
const glowWarm=glowSprite(7,'255,205,140',.3);
const glowHead=glowSprite(3,'255,240,200',.35);
const glowBlue=glowSprite(3,'190,220,255',.6);
const fmt2=n=>String(n).padStart(2,'0');
const fmtTime=(d,s)=>fmt2(d.getHours())+':'+fmt2(d.getMinutes())+(s?':'+fmt2(d.getSeconds()):'');

/* ---------- world state ---------- */
let W=0,H=0,fg=30,u=1,ledgeY=0,roadY=0,trackY=0,t=0,wind=0;
let skyC,farC,midC,nearC,parC,propsC,roadC,moonC;
let stars=[],farWins=[],midWins=[],blinkers=[],roofBlinkers=[],lamps=[],pillarsX=[];
let neon=null,near=null,shed=null,vent=null,line=null,ac=null,moon=null;
const E={veh:[],trains:[],cats:[],flocks:[],planes:[],helis:[],shoot:[],sats:[],fw:[],fwShows:[],clouds:[],drops:[],parts:[]};
let smoker=null;
const weather={level:0,target:0,until:0,acc:0};
let steamAcc=0;

/* ---------- event log ---------- */
const logArr=[];const seen=new Set();const stats={events:0,lights:0};
const $=id=>document.getElementById(id);
const ui={clock:$('clock'),btn:$('logBtn'),panel:$('log'),list:$('logList'),ev:$('stEvents'),di:$('stDistinct'),li:$('stLights'),seed:$('seed'),hud:$('hud')};
ui.seed.textContent=SEED_STR;
let uiDirty=true;
function log(type,text,params){
  const sig=type+'|'+text.split(' ')[0]+'|'+JSON.stringify(params,(k,v)=>typeof v==='number'?+v.toFixed(4):v);
  stats.events++;seen.add(sig);
  logArr.unshift({time:fmtTime(new Date(),true),text});
  if(logArr.length>40)logArr.pop();
  uiDirty=true;
}
function updateUI(){
  ui.clock.textContent=fmtTime(new Date());
  ui.ev.textContent=stats.events;ui.di.textContent=seen.size;ui.li.textContent=stats.lights;
  if(uiDirty&&!ui.panel.hidden){
    ui.list.textContent='';
    for(const e of logArr.slice(0,30)){const li=document.createElement('li');const tm=document.createElement('time');tm.textContent=e.time;const sp=document.createElement('span');sp.textContent=e.text;li.append(tm,sp);ui.list.append(li);}
    uiDirty=false;
  }
}

/* ---------- world generation ---------- */
const SKY=[[0,[4,5,24]],[.4,[13,13,48]],[.72,[34,24,70]],[.9,[60,34,82]],[1,[86,44,84]]];
const B4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function skyCol(f){for(let i=1;i<SKY.length;i++){if(f<=SKY[i][0]){const[f0,c0]=SKY[i-1],[f1,c1]=SKY[i];const k=(f-f0)/(f1-f0);return c0.map((v,j)=>v+(c1[j]-v)*k);}}return SKY[SKY.length-1][1];}
function paintSky(){
  let g;[skyC,g]=mk(W,H);const img=g.createImageData(W,H);const d=img.data;
  for(let y=0;y<H;y++){const c=skyCol(Math.min(1,y/roadY));for(let x=0;x<W;x++){const th=(B4[(y&3)*4+(x&3)]/16-.5)*7;const i=(y*W+x)*4;for(let j=0;j<3;j++)d[i+j]=Math.max(0,Math.min(255,Math.round((c[j]+th)/6)*6));d[i+3]=255;}}
  g.putImageData(img,0,0);
}
function genStars(){stars=[];const n=Math.round(W*H/80);for(let i=0;i<n;i++)stars.push({x:ri(0,W-1),y:ri(0,Math.round(roadY*.78)),b:rr(.25,1),r:rr(.2,1.4),ph:rr(0,900),c:chance(.2)?'#bcd3ff':chance(.12)?'#ffe6c0':'#ffffff'});}
function genMoon(){
  if(!moon)moon={r:ri(4,6),phase:rr(.18,1),x0:R(),y:rr(.07,.18)};
  const r=moon.r,S=r*2+14,c=S/2;let g;[moonC,g]=mk(S,S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const d=Math.hypot(x+.5-c,y+.5-c);if(d>r&&d<r+6){g.fillStyle=`rgba(225,215,255,${(.11*(1-(d-r)/6)).toFixed(3)})`;g.fillRect(x,y,1,1);}}
  const scx=c-2*r*moon.phase;
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const px=x+.5,py=y+.5;if(Math.hypot(px-c,py-c)<=r){const lit=Math.hypot(px-scx,py-c)>r;g.fillStyle=lit?(chance(.12)?'#d7cfb2':'#f1ead0'):'#1d1b3c';g.fillRect(x,y,1,1);}}
}
function winColor(){const r=R();return r<.72?pick(WARM):r<.95?pick(COOL):pick(ODD);}
function genFar(){
  let g;[farC,g]=mk(W,H);farWins=[];
  let x=-ri(0,6);
  while(x<W){
    const w=ri(6,16);let h=ri(Math.round(H*.18),Math.round(H*.46));if(chance(.08))h=Math.round(H*rr(.5,.62));
    const top=roadY-h,col=pick(FARC);
    rect(g,x,top,w,h+4,col);rect(g,x,top,w,1,'#1e1c48');
    if(h>H*.48){const sx=x+Math.floor(w/2),sh=ri(5,12);rect(g,sx,top-sh,1,sh,col);blinkers.push({x:sx,y:top-sh-1,per:rr(1.4,2.8),ph:rr(0,9)});}
    for(let yy=top+2;yy<roadY-1;yy+=2)for(let xx=x+1;xx<x+w-1;xx+=2)if(chance(.2))farWins.push({x:xx,y:yy,lit:chance(.45),next:t+expo(rr(200,900))});
    x+=w+(chance(.25)?ri(1,3):0);
  }
}
function genMid(){
  let g;[midC,g]=mk(W,H);midWins=[];neon=null;const blds=[];
  let x=-ri(0,8);
  while(x<W){
    const w=ri(10,26),h=ri(Math.round(H*.12),Math.round(H*.42)),top=roadY-h,col=pick(MIDC),cap='rgba(190,180,255,.13)';
    rect(g,x,top,w,h+6,col);rect(g,x,top,1,h,'rgba(255,255,255,.05)');rect(g,x+w-1,top,1,h,'rgba(0,0,0,.18)');rect(g,x,top,w,1,cap);
    if(w>14&&chance(.35)){
      const sw=ri(5,w-7),sh=ri(3,9),sx=x+ri(2,w-sw-2);rect(g,sx,top-sh,sw,sh,col);rect(g,sx,top-sh,sw,1,cap);
      if(chance(.5)){const ax=sx+ri(1,sw-2),ah=ri(3,8);rect(g,ax,top-sh-ah,1,ah,'#2a2650');blinkers.push({x:ax,y:top-sh-ah-1,per:rr(1.3,2.7),ph:rr(0,9)});}
    }else if(h>H*.24&&chance(.45)){const ax=x+ri(2,w-3),ah=ri(4,10);rect(g,ax,top-ah,1,ah,'#2a2650');blinkers.push({x:ax,y:top-ah-1,per:rr(1.3,2.7),ph:rr(0,9)});}
    if(chance(.22)){const tw=ri(4,6),tx=x+ri(1,Math.max(1,w-tw-1));rect(g,tx+1,top-2,1,2,'#16142b');rect(g,tx+tw-2,top-2,1,2,'#16142b');rect(g,tx,top-6,tw,4,'#1f1a30');rect(g,tx+1,top-7,tw-2,1,'#1f1a30');}
    const ww=chance(.5)?1:2,sx=ww+2+ri(0,1),sy=ri(3,4);
    for(let yy=top+3;yy<roadY-1;yy+=sy)for(let xx=x+2;xx+ww<=x+w-2;xx+=sx){rect(g,xx,yy,ww,2,'rgba(150,140,230,.09)');midWins.push({x:xx,y:yy,w:ww,h:2,lit:chance(.36),col:winColor(),tv:chance(.08),ph:rr(0,999),next:t+expo(rr(150,800))});}
    blds.push({x,w,h,top});
    x+=w+(chance(.18)?ri(1,4):0);
  }
  const cands=shuffle(blds.filter(b=>b.x>=0&&b.x+b.w<=W&&b.w>=8));
  for(const b of cands){
    const fit=WORDS.filter(wd=>b.top+3+wd.length*6+1<trackY-1);if(!fit.length)continue;
    const word=pick(fit),nx=b.x+ri(1,Math.max(1,b.w-6)),ny=b.top+3,nc=pick(NEONC),nh=word.length*6+1;
    rect(g,nx,ny,5,nh,'#0b0917');rect(g,nx+2,ny-2,1,2,'#2a2650');
    midWins=midWins.filter(w=>!(w.x+w.w>nx-1&&w.x<nx+6&&w.y+w.h>ny-1&&w.y<ny+nh+1));
    neon={x:nx,y:ny,word,col:nc[1],colName:nc[0],out:-1,outUntil:0,flickUntil:0};break;
  }
}
function genRoad(){
  let g;[roadC,g]=mk(W,H);
  rect(g,0,roadY+1,W,ledgeY-roadY,'#0c0a18');
  const gh=Math.max(1,ledgeY-(roadY+4));
  for(let i=0;i<gh;i++){g.fillStyle=`rgba(255,138,70,${(Math.pow(i/gh,1.4)*.24).toFixed(3)})`;g.fillRect(0,roadY+4+i,W,1);}
  for(let x=ri(4,18);x<W;x+=ri(28,40))rect(g,x,roadY+4,3,ledgeY-roadY,'#100d1e');
  rect(g,0,roadY+1,W,3,'#201d39');rect(g,0,roadY+1,W,1,'#36315c');
  for(let x=ri(0,3);x<W;x+=4)rect(g,x,roadY+2,1,1,'#4b4573');
  rect(g,0,roadY+4,W,1,'#09081a');
  lamps=[];for(let x=ri(6,20);x<W;x+=ri(26,40))lamps.push({x,ph:rr(0,99),flickUntil:0,offUntil:0});
  pillarsX=[];for(let x=ri(4,20);x<W;x+=ri(26,34))pillarsX.push(x);
}
function genNear(){
  const nw=Math.max(26,Math.round(W*rr(.15,.23))),left=chance(.5);
  const nx=left?-ri(0,4):W-nw+ri(0,4),top=ledgeY-Math.round(H*rr(.28,.4));
  let g;[nearC,g]=mk(W,H);
  rect(g,nx,top,nw,ledgeY-top+4,'#171430');
  for(let i=0;i<nw*(ledgeY-top)/9;i++)rect(g,nx+ri(0,nw-1),ri(top,ledgeY),1,1,chance(.5)?'#1c1838':'#13102a');
  for(let y=top+4;y<ledgeY;y+=3)for(let x=nx+((y/3|0)%2?0:2);x<nx+nw;x+=4)rect(g,x,y,1,1,'#120f26');
  rect(g,nx-1,top-2,nw+2,2,'#25213f');rect(g,nx-1,top-2,nw+2,1,'#3a3463');rect(g,nx,top,nw,1,'#0e0c1e');
  rect(g,left?nx+nw-1:nx,top,1,ledgeY-top,'#221e40');
  const cols=Math.max(1,Math.floor((nw-4)/9)),span=cols*9-3,x0=nx+Math.floor((nw-span)/2),wins=[],fire=chance(.6);
  for(let y=top+5;y+7<ledgeY-1;y+=11){
    for(let c=0;c<cols;c++){
      const x=x0+c*9;rect(g,x-1,y-1,8,9,'#0c0a1a');rect(g,x,y,6,7,'#0f1126');rect(g,x+4,y+1,1,2,'#1b2040');rect(g,x-1,y+8,8,1,'#2b2650');
      const lit=chance(.42),cur=lit&&chance(.3)?rr(.2,.6):0;
      wins.push({x,y,w:6,h:7,lit,col:pick(WARM),tv:lit&&chance(.15),ph:rr(0,999),curtain:cur,ct:cur,occ:null,next:t+expo(rr(80,400))});
    }
    if(fire){const fy=y+10;rect(g,x0-2,fy,span+4,1,'#2a2547');for(let x=x0-2;x<x0+span+2;x+=2)rect(g,x,fy-2,1,2,'#221e3c');rect(g,x0-2,fy-2,span+4,1,'#2a2547');}
  }
  near={x:nx,w:nw,top,wins,left};
}
function genRoof(){
  let g;[parC,g]=mk(W,H);
  rect(g,0,ledgeY+4,W,H-ledgeY-4,'#15132a');
  for(let y=ledgeY+7;y<H;y+=ri(4,7))rect(g,0,y,W,1,'#1b1934');
  for(let i=0;i<W*(H-ledgeY)/14;i++)rect(g,ri(0,W-1),ri(ledgeY+5,H-1),1,1,chance(.5)?'#1d1b37':'#110f22');
  rect(g,0,ledgeY,W,4,'#2a2649');rect(g,0,ledgeY,W,1,'#4a447a');rect(g,0,ledgeY+4,W,1,'#0c0a1a');
  for(let x=ri(0,7);x<W;x+=8)rect(g,x,ledgeY+1,1,3,'#231f40');
  let q;[propsC,q]=mk(W,H);
  shed=vent=line=ac=null;roofBlinkers=[];
  const kinds=shuffle(['tank','vent','ac','line','mast','plants']);kinds.splice(ri(0,2),0,'shed');
  const widths={shed:Math.round(18*u),tank:Math.round(12*u)+2,vent:4,ac:Math.round(10*u),line:Math.round(30*u),mast:5,plants:Math.round(10*u)};
  let x=ri(2,10);const items=[];
  for(const k of kinds){const w=widths[k];if(x+w>W-2)continue;items.push({k,x,w,base:Math.max(ledgeY+10,H-2-ri(0,Math.round(fg*.28)))});x+=w+ri(3,12);}
  items.sort((a,b)=>a.base-b.base);
  for(const it of items){
    const{x,w}=it,b=it.base;
    if(it.k==='shed'){
      const h=Math.round(14*u),top=b-h;
      rect(q,x,top,w,h,'#221e3b');rect(q,x,top,1,h,'#2c2849');
      rect(q,x-1,top-2,w+2,2,'#2f2a50');rect(q,x-1,top-2,w+2,1,'#3d3768');
      const dw=Math.max(3,Math.round(4*u)),dh=Math.max(6,Math.round(9*u)),dx=x+w-dw-Math.max(2,Math.round(3*u));
      rect(q,dx-1,b-dh-1,dw+2,dh+1,'#1a1730');rect(q,dx,b-dh,dw,dh,'#110e20');
      rect(q,x+Math.round(3*u),top+Math.round(3*u),Math.max(2,Math.round(4*u)),Math.max(2,Math.round(3*u)),'#0f0d1d');
      const lampX=dx+Math.floor(dw/2),lampY=b-dh-3;rect(q,lampX-1,lampY,3,1,'#4a4565');
      shed={x,w,b,top,dx,dw,dh,lampX,lampY};
    }else if(it.k==='tank'){
      const tw=w-2,bh=Math.round(11*u),lh=Math.round(9*u),tx=x+1,btop=b-lh-bh;
      rect(q,tx+1,b-lh,1,lh,'#2a2540');rect(q,tx+tw-2,b-lh,1,lh,'#2a2540');
      for(let i=0;i<lh;i++)rect(q,tx+2+Math.round(i/lh*(tw-5)),b-lh+i,1,1,'#221e36');
      rect(q,tx,b-lh,tw,1,'#332e4c');
      rect(q,tx,btop,tw,bh,'#3b2c2e');for(let sx=tx+2;sx<tx+tw;sx+=3)rect(q,sx,btop,1,bh,'#33262a');
      rect(q,tx,btop+Math.round(bh/3),tw,1,'#4b3d40');rect(q,tx,btop+Math.round(2*bh/3),tw,1,'#4b3d40');rect(q,tx+tw-1,btop,1,bh,'#4a3a3c');
      const ch=Math.max(2,Math.round(3*u));for(let k=0;k<ch;k++){const half=Math.round((k+1)/ch*tw/2);rect(q,tx+tw/2-half,btop-ch+k,half*2,1,'#2f2433');}
      rect(q,tx+Math.floor(tw/2),btop-ch-1,1,1,'#4a3a44');
    }else if(it.k==='vent'){
      const vx=x+1,h=Math.round(10*u);rect(q,vx,b-h,2,h,'#3a3656');rect(q,vx-1,b-h-1,4,1,'#4a4570');rect(q,vx-1,b-h-3,4,1,'#2e2a48');rect(q,vx,b-h-2,1,1,'#2e2a48');
      vent={x:vx+1,y:b-h-3};
    }else if(it.k==='ac'){
      const h=Math.round(7*u);rect(q,x,b-h,w,h,'#35324f');rect(q,x,b-h,w,1,'#48446c');
      for(let gx=x+1;gx<x+Math.floor(w/2)-1;gx+=2)rect(q,gx,b-h+2,1,h-3,'#24213a');
      const r=Math.max(2,Math.floor(h/2)-1),cx=x+Math.floor(w*.72),cy=b-Math.floor(h/2);
      for(let yy=-r;yy<=r;yy++)for(let xx=-r;xx<=r;xx++){const d=Math.hypot(xx,yy);if(d<=r+.3)rect(q,cx+xx,cy+yy,1,1,d>r-.8?'#1e1b33':'#14122a');}
      ac={cx,cy,r,ph:rr(0,6)};
    }else if(it.k==='line'){
      const ph=Math.round(14*u);rect(q,x,b-ph,1,ph,'#3a3555');rect(q,x+w-1,b-ph,1,ph,'#3a3555');
      const n=ri(3,5),cl=[];const CL=['#7a4a5a','#4a6a8a','#8a7a4a','#5a7a5a','#9a9aaa','#a0605a','#5a5a8a'];
      for(let i=0;i<n;i++)cl.push({p:(i+.5+rr(-.25,.25))/n,w:Math.max(2,Math.round(rr(2,4)*u*.8)),h:Math.max(3,Math.round(rr(3,6)*u)),col:pick(CL),ph:rr(0,6)});
      line={x1:x,x2:x+w-1,y:b-ph+1,cl};
    }else if(it.k==='mast'){
      const mx=x+2,h=Math.round(fg*1.15);rect(q,mx,b-h,1,h,'#3a3555');
      for(let y=b-h+4;y<b-2;y+=Math.max(3,Math.round(5*u)))rect(q,mx-1,y,3,1,'#3a3555');
      rect(q,mx-2,b-h+2,5,1,'#433e63');roofBlinkers.push({x:mx,y:b-h-1,per:rr(1.6,2.4),ph:rr(0,9)});
    }else if(it.k==='plants'){
      let px=x;const n=ri(2,3);
      for(let i=0;i<n;i++){const pw=Math.max(3,Math.round(3*u)),ph=Math.max(2,Math.round(3*u));rect(q,px,b-ph,pw,ph,'#4a2c25');rect(q,px,b-ph,pw,1,'#5c372e');
        const lh=ri(3,Math.max(3,Math.round(7*u)));for(let k=0;k<lh*3;k++)rect(q,px+ri(-1,pw),b-ph-ri(1,lh),1,1,chance(.5)?'#2c5038':'#3b6a48');px+=pw+ri(1,2);}
    }
  }
}
function makeCloud(){
  const w=ri(18,46),h=ri(6,12);const[c,g]=mk(w,h);const f=new Uint8Array(w*h);
  for(let b=0,n=ri(3,6);b<n;b++){const cx=rr(w*.15,w*.85),cy=rr(h*.45,h*.8),rx=rr(w*.12,w*.3),ry=rr(h*.3,h*.55);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)f[y*w+x]=1;}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(f[y*w+x]){const top=y===0||!f[(y-1)*w+x];g.fillStyle=top?'#3a3468':(y>h*.7?'#1b1838':'#26224a');g.fillRect(x,y,1,1);}
  return c;
}
function newCloud(){const img=makeCloud();const dir=wind>=0?1:-1;return{img,dir,x:dir>0?-img.width:W,y:rr(2,H*.33),speed:rr(.8,2.6),a:rr(.55,.9)};}
function build(){
  const vw=innerWidth,vh=innerHeight,P=Math.max(2,Math.round(Math.min(vw,vh)/150));
  W=Math.max(60,Math.ceil(vw/P));H=Math.max(60,Math.ceil(vh/P));
  cv.width=W;cv.height=H;ctx.imageSmoothingEnabled=false;
  fg=Math.max(22,Math.round(H*.2));u=Math.max(.8,fg/30);
  ledgeY=H-fg;roadY=ledgeY-9;trackY=roadY-18;
  blinkers=[];
  paintSky();genStars();genMoon();genFar();genMid();genRoad();genNear();genRoof();
  for(const k in E)E[k]=[];smoker=null;
  for(let i=0,n=ri(1,3);i<n;i++){const c=newCloud();c.x=rr(-c.img.width,W);E.clouds.push(c);}
  for(let i=0,n=ri(2,4);i<n;i++){const dir=chance(.5)?1:-1;const v=makeVehicle(wpick(VK.slice(0,7)),dir);v.x=rr(0,W-v.L);if(E.veh.some(o=>o.lane===v.lane&&Math.abs(o.x-v.x)<o.L+v.L+8))continue;E.veh.push(v);logVeh(v);}
}

/* ---------- vehicles ---------- */
function makeVehicle(kind,dir){
  const v={kind,dir,lane:dir>0?0:1,ph:rr(0,99)};const c=pick(CARC);
  switch(kind){
    case'car':Object.assign(v,{L:ri(8,10),col:c[1],name:c[0],label:pick(['car','hatchback','sedan','coupe']),want:rr(18,30)});break;
    case'taxi':Object.assign(v,{L:9,col:'#d9ac2f',name:'yellow',label:'taxi',want:rr(20,31),sign:chance(.6)});break;
    case'van':Object.assign(v,{L:ri(10,11),col:c[1],name:c[0],label:'van',want:rr(16,25)});break;
    case'bus':{const b=pick(BUSC),L=ri(18,22),lit=[];for(let k=2;k<L-3;k+=3)lit.push(chance(.7));Object.assign(v,{L,col:b[1],name:b[0],label:'bus',want:rr(12,18),lit});break;}
    case'truck':{const b=pick(BOXC);Object.assign(v,{L:ri(14,17),col:c[1],box:b[1],name:b[0]+' box',label:'truck',want:rr(12,20)});break;}
    case'moto':Object.assign(v,{L:5,col:c[1],name:c[0],label:'motorbike',want:rr(24,38)});break;
    case'scooter':Object.assign(v,{L:5,col:'#c94b3a',name:'',label:'delivery scooter',want:rr(20,30)});break;
    case'police':Object.assign(v,{L:9,col:'#e2e4ec',name:'',label:'police car',want:rr(30,40)});break;
    case'ambulance':Object.assign(v,{L:11,col:'#e2e4ec',name:'',label:'ambulance',want:rr(30,40)});break;
  }
  v.dark=shade(v.col,-.32);v.cab=shade(v.col,-.14);v.speed=v.want;return v;
}
function logVeh(v){
  let s=`${v.name?v.name+' ':''}${v.label} heading ${v.dir>0?'east':'west'}`;
  if(v.kind==='bus')s+=`, ${v.lit.filter(Boolean).length} windows lit`;
  if(v.kind==='police'||v.kind==='ambulance')s+=RM?', lights on':', lights flashing';
  if(v.kind==='taxi')s+=v.sign?', for hire':', occupied';
  log('vehicle',s,{k:v.kind,L:v.L,s:v.want,c:v.col});
}
function drawVehicle(v){
  const x=Math.round(v.x),yb=v.lane===0?roadY:roadY-2,L=v.L,d=v.dir;
  const P=(lx,ly,w,h,c)=>{const gx=d>0?x+lx:x+L-lx-w;ctx.fillStyle=c;ctx.fillRect(gx,yb-ly-h+1,w,h);};
  const wheel='#0b0a12',glass='#3e4a6e',head='#fff4cc',tail='#ff3344';
  let hy=2;
  switch(v.kind){
    case'car':case'taxi':case'police':
      P(0,1,L,2,v.col);P(0,1,L,1,v.dark);P(2,3,L-4,1,v.cab);P(3,3,L-6,1,glass);P(1,0,2,1,wheel);P(L-3,0,2,1,wheel);
      if(v.kind==='taxi')P(Math.floor(L/2)-1,4,2,1,v.sign?'#ffe27a':'#6a5a2a');
      if(v.kind==='police'){P(0,2,L,1,'#2a3e88');const f=RM?0:Math.floor(t*7+v.ph)%2;P(Math.floor(L/2)-1,4,1,1,f?'#ff3a3a':'#5a1a1a');P(Math.floor(L/2),4,1,1,f?'#2a2a5a':'#4a7aff');}
      break;
    case'van':case'ambulance':
      P(0,1,L,3,v.col);P(0,1,L,1,v.dark);P(L-3,3,2,1,glass);P(1,0,2,1,wheel);P(L-3,0,2,1,wheel);
      if(v.kind==='ambulance'){P(0,2,L-3,1,'#c8323c');const f=RM?0:Math.floor(t*6+v.ph)%2;P(L-4,4,1,1,f?'#ff3a3a':'#5a1a1a');P(L-5,4,1,1,f?'#2a2a5a':'#4a7aff');}
      break;
    case'bus':
      P(0,1,L,4,v.col);P(0,1,L,1,v.dark);
      v.lit.forEach((on,i)=>P(2+i*3,3,2,2,on?'#ffe1a0':'#2a3050'));
      P(L-3,4,2,1,'#ffb347');P(2,0,2,1,wheel);P(L-5,0,2,1,wheel);hy=1;
      break;
    case'truck':
      P(L-5,1,5,3,v.col);P(L-3,3,2,1,glass);P(0,1,L-6,5,v.box);P(0,1,L-6,1,shade(v.box,-.3));P(L-6,1,1,2,'#141220');
      P(1,0,2,1,wheel);P(L-9,0,2,1,wheel);P(L-3,0,2,1,wheel);P(0,5,1,1,'#ffb347');hy=1;
      break;
    case'moto':case'scooter':
      P(0,0,1,1,wheel);P(4,0,1,1,wheel);P(1,1,3,1,v.col);P(2,2,1,2,'#151320');P(2,4,1,1,v.kind==='moto'?shade(v.col,.2):'#e8e8f0');
      if(v.kind==='scooter')P(0,2,2,2,'#c94b3a');hy=1;
      break;
  }
  P(L-1,hy,1,1,head);P(0,hy,1,1,tail);
  for(let i=1;i<=9;i++){ctx.globalAlpha=.2*(1-i/10);P(L-1+i,hy,1,1,'#fff1c0');if(hy>1)P(L-1+i,hy-1,1,1,'#fff1c0');}
  ctx.globalAlpha=.5;ctx.drawImage(glowHead,(d>0?x+L-1:x)-3,yb-hy-3);ctx.globalAlpha=1;
}

/* ---------- spawners ---------- */
const SPAWN={
  vehicle(){
    const dir=chance(.5)?1:-1,lane=dir>0?0:1;
    for(const o of E.veh){if(o.lane!==lane)continue;if(dir>0&&o.x<8)return false;if(dir<0&&o.x+o.L>W-8)return false;}
    const v=makeVehicle(wpick(VK),dir);v.x=dir>0?-v.L-1:W+1;E.veh.push(v);logVeh(v);return true;
  },
  train(){
    if(E.trains.length)return false;
    const dir=chance(.5)?1:-1,cars=ri(3,6);
    const tr={dir,cars,speed:rr(38,62),hx:dir>0?-1:W+1,lit:Array.from({length:cars*4},()=>chance(.75)),lc:Array.from({length:cars*4},()=>chance(.8)?'#ffe8b0':'#cfe0ff'),stripe:pick(['#d24a5a','#3fa0d6','#e0a23a','#5ac27a']),spark:0,sc:0};
    E.trains.push(tr);log('train',`metro, ${cars} cars, rattling ${dir>0?'east':'west'}`,{c:cars,s:tr.speed,l:tr.lit.filter(Boolean).length});return true;
  },
  cat(){
    if(E.cats.length)return false;
    const dir=chance(.5)?1:-1,[cn,coat,paws]=pick(COATS);
    const c={x:dir>0?-8:W+8,dir,coat,paws,name:cn,state:'walk',timer:rr(2,6),want:rr(7,12),anim:0,tf:0,tailT:0,blink:false,blinkT:rr(2,5),gt:0};
    c.speed=c.want;E.cats.push(c);log('cat',`${an(cn)} ${cn} cat hops onto the ledge`,{w:c.want,d:dir,t:c.timer});return true;
  },
  birds(){
    const n=ri(3,9),dir=chance(.5)?1:-1,yhi=Math.max(H*.14,Math.min(H*.4,trackY-10));
    const f={x:dir>0?-16:W+16,y:rr(H*.12,yhi),dir,speed:rr(13,22),m:Array.from({length:n},()=>({dx:rr(-12,12),dy:rr(-5,5),ph:rr(0,6.28),fr:rr(9,13)}))};
    E.flocks.push(f);log('birds',`${n} pigeons flap across the skyline`,{n,y:f.y,s:f.speed});return true;
  },
  plane(){
    const dir=chance(.5)?1:-1,y=ri(3,Math.round(H*.2));
    E.planes.push({x:dir>0?-6:W+6,y,dir,speed:rr(4.5,9),ph:rr(0,2)});
    log('plane',`a plane blinks across, ${y<H*.1?'high':'low'}, to the ${dir>0?'east':'west'}`,{y,s:E.planes[E.planes.length-1].speed});return true;
  },
  heli(){
    if(E.helis.length)return false;
    const dir=chance(.5)?1:-1,h={x:dir>0?-10:W+10,y:rr(H*.14,H*.3),dir,want:rr(4,9),ph:rr(0,99),beam:chance(.75),ba:rr(-.45,.45)};
    E.helis.push(h);log('heli',`a helicopter drifts over${h.beam?' sweeping a searchlight':''}`,{y:h.y,w:h.want,a:h.ba});return true;
  },
  star(){
    if(weather.level>.25)return true;
    const dir=chance(.5)?1:-1,a=rr(.25,.6),sp=rr(70,120);
    E.shoot.push({x:rr(W*.1,W*.9),y:rr(2,H*.22),vx:dir*Math.cos(a)*sp,vy:Math.sin(a)*sp,age:0,life:rr(.5,.9)});
    log('star','a shooting star',{a,sp});return true;
  },
  sat(){
    if(weather.level>.3)return true;
    const dir=chance(.5)?1:-1,vx=dir*rr(3,6);
    E.sats.push({x:dir>0?-1:W+1,y:rr(2,H*.3),vx,vy:rr(-.5,.5)});log('sat','a satellite slides between the stars',{vx});return true;
  },
  fireworks(){
    if(RM||E.fwShows.length||weather.level>.3)return true;
    const n=ri(3,9),cx=rr(W*.2,W*.8);E.fwShows.push({n,next:t+rr(.5,1.5),cx});
    log('fireworks',`fireworks past the towers, ${n} bursts`,{n,cx:cx/W});return true;
  },
  weather(){
    if(weather.target>0)return true;
    if(chance(.35)){weather.target=rr(.35,1);weather.until=t+60+expo(200);log('rain',weather.target>.7?'heavy rain rolls in':'a light rain starts',{i:weather.target,d:weather.until-t});}
    return true;
  },
  cloud(){if(E.clouds.length>=(weather.level>.3?7:4))return false;E.clouds.push(newCloud());return true;},
  smoker(){
    if(!shed)return true;if(smoker)return false;
    smoker={phase:'open',tp:0,dur:rr(15,50),nextDrag:rr(1.5,4),drag:0,px:0,puff:-1};
    log('smoker','someone steps out onto the roof for a smoke',{d:smoker.dur});return true;
  },
  neon(){
    if(!neon)return true;
    if(RM||chance(.6)){const i=ri(0,neon.word.length-1);neon.out=i;neon.outUntil=t+rr(5,50);log('neon',`the ${neon.colName} “${neon.word}” sign loses its ${neon.word[i]}`,{i,d:neon.outUntil-t});}
    else{neon.flickUntil=t+rr(.8,3);log('neon',`the ${neon.colName} “${neon.word}” sign stutters`,{d:neon.flickUntil-t});}
    return true;
  },
  occupant(){
    const lit=near?near.wins.filter(w=>w.lit&&!w.occ):[];if(!lit.length)return true;
    const w=pick(lit),i=near.wins.indexOf(w),r=R();
    if(r<.55){const fromL=chance(.5);w.occ={x:fromL?-2:w.w,v:(fromL?1:-1)*rr(1.5,4)};log('occupant','someone walks past a lit window',{i,v:w.occ.v});}
    else if(r<.8){const c=w.curtain>.5?rr(0,.3):rr(.6,1);w.ct=c;log('curtain',c>.5?'curtains drawn across a window':'curtains pulled open',{i,c});}
    else{w.tv=!w.tv;w.ph=rr(0,999);log('tv',w.tv?'a TV flickers on behind a window':'a TV goes dark',{i,p:w.ph});}
    return true;
  },
  lamp(){
    if(!lamps.length)return true;const l=pick(lamps);
    if(chance(.25)){l.offUntil=t+rr(20,120);log('lamp','a street lamp goes out',{x:l.x,d:l.offUntil-t});}
    else{l.flickUntil=t+rr(2,12);log('lamp','a street lamp sputters',{x:l.x,d:l.flickUntil-t});}
    return true;
  }
};
const SCHED={vehicle:{m:4.2,f:.6},train:{m:80,f:14},cat:{m:60,f:5},birds:{m:42,f:11},plane:{m:55,f:7},heli:{m:200,f:70},star:{m:85,f:25},sat:{m:120,f:40},fireworks:{m:780,f:260},weather:{m:160,f:110},cloud:{m:26,f:3},smoker:{m:170,f:30},neon:{m:32,f:12},occupant:{m:13,f:4},lamp:{m:95,f:45}};
for(const k in SCHED)SCHED[k].next=expo(SCHED[k].f);
function runSched(){
  for(const k in SCHED){const s=SCHED[k];if(t<s.next)continue;
    if(SPAWN[k]()===false){s.next=t+rr(1,4);continue;}
    let m=s.m;if(k==='vehicle')m*=.45+1.5*noise(t*.006+300);
    s.next=t+expo(m)+(k==='vehicle'?.4:0);
  }
}

/* ---------- cat ---------- */
function decideCat(c){
  const r=R();
  if(r<.3){c.state='sit';c.timer=rr(3,16);c.gt=rr(1,3);log('cat',`the ${c.name} cat sits down on the ledge`,{x:c.x,d:c.timer});}
  else if(r<.47){c.state='look';c.timer=rr(.8,3);log('cat',`the ${c.name} cat stops to stare at the street`,{x:c.x,d:c.timer});}
  else if(r<.57){c.dir*=-1;c.timer=rr(1.5,5);c.speed=c.want;log('cat',`the ${c.name} cat turns around`,{x:c.x,d:c.timer});}
  else if(r<.66){c.state='trot';c.speed=c.want*rr(1.6,2.2);c.timer=rr(.8,2);log('cat',`the ${c.name} cat breaks into a trot`,{x:c.x,s:c.speed});}
  else{c.state='walk';c.speed=c.want*rr(.8,1.15);c.timer=rr(2,6);}
}
function updateCats(dt){
  for(const c of E.cats){
    c.tailT-=dt;if(c.tailT<=0){c.tf=ri(0,2);c.tailT=rr(.25,1.6);}
    c.blinkT-=dt;if(c.blinkT<=0){c.blink=!c.blink;c.blinkT=c.blink?.15:rr(2,6);}
    const onScreen=c.x>6&&c.x<W-6;
    if(c.state==='walk'||c.state==='trot'){
      c.x+=c.dir*c.speed*dt;c.anim+=dt*c.speed*.45;c.timer-=dt;
      if(c.timer<=0){if(!onScreen){c.state='walk';c.speed=c.want;c.timer=rr(1,3);}else decideCat(c);}
    }else{
      c.timer-=dt;
      if(c.state==='sit'||c.state==='groom'){c.gt-=dt;if(c.gt<=0){c.state=c.state==='sit'&&chance(.4)?'groom':'sit';c.gt=rr(1,4);}}
      if(c.timer<=0){c.state='walk';c.speed=c.want;c.timer=rr(2,7);if(chance(.22)){c.dir*=-1;log('cat',`the ${c.name} cat changes its mind and heads back`,{x:c.x,d:c.timer});}}
    }
  }
  E.cats=E.cats.filter(c=>c.x>-14&&c.x<W+14);
}
function drawCat(c){
  const walking=c.state==='walk'||c.state==='trot',sitting=c.state==='sit'||c.state==='groom';
  const spr=walking?(Math.floor(c.anim)%2?CAT.walkB:CAT.walkA):c.state==='look'?CAT.look:c.state==='groom'?CAT.groom:CAT.sit;
  const x0=Math.round(c.x)-5,y0=ledgeY-6;
  const put=(i,r,col)=>{ctx.fillStyle=col;ctx.fillRect(c.dir>0?x0+i:x0+9-i,y0+r,1,1);};
  for(let r=0;r<6;r++)for(let i=0;i<10;i++){const ch=spr[r][i];if(ch==='.')continue;put(i,r,ch==='e'?(c.blink?c.coat:'#ffd45e'):ch==='l'?c.paws:c.coat);}
  for(const[i,r]of(sitting?SIT_T:WALK_T)[c.tf])put(i,r,c.coat);
}

/* ---------- update ---------- */
function update(dt){
  wind=(fbm(t*.04+500)-.5)*2.2;
  for(const w of midWins)if(t>=w.next){w.lit=!w.lit;if(w.lit){w.col=winColor();w.tv=chance(.09);w.ph=rr(0,999);}w.next=t+expo(w.lit?rr(180,900):rr(120,700));stats.lights++;}
  for(const w of farWins)if(t>=w.next){w.lit=!w.lit;w.next=t+expo(rr(250,1200));stats.lights++;}
  if(near)for(const w of near.wins){
    if(t>=w.next){w.lit=!w.lit;if(w.lit){w.col=pick(WARM);w.tv=chance(.15);w.curtain=w.ct=chance(.3)?rr(.2,.6):0;}w.occ=null;w.next=t+expo(rr(90,500));stats.lights++;}
    if(w.curtain!==w.ct){const s=Math.sign(w.ct-w.curtain);w.curtain+=s*dt*.25;if((s>0&&w.curtain>=w.ct)||(s<0&&w.curtain<=w.ct))w.curtain=w.ct;}
    if(w.occ){w.occ.x+=w.occ.v*dt;if(w.occ.x<-3||w.occ.x>w.w+1)w.occ=null;}
  }
  runSched();
  // weather
  if(weather.target>0&&t>weather.until){log('rain','the rain eases off',{d:t-weather.until,i:weather.target});weather.target=0;}
  const dl=weather.target-weather.level;weather.level+=Math.sign(dl)*Math.min(Math.abs(dl),dt*.03);
  // vehicles
  for(const lane of[0,1]){
    const d=lane===0?1:-1,arr=E.veh.filter(v=>v.lane===lane).sort((a,b)=>d>0?b.x-a.x:a.x-b.x);
    for(let i=0;i<arr.length;i++){const v=arr[i];let target=v.want;
      if(i>0){const Ld=arr[i-1],gap=d>0?Ld.x-(v.x+v.L):v.x-(Ld.x+Ld.L);if(gap<10)target=Math.min(target,Ld.speed*(gap<4?.85:1));}
      v.speed+=(target-v.speed)*Math.min(1,dt*1.5);v.x+=d*v.speed*dt;}
  }
  E.veh=E.veh.filter(v=>v.dir>0?v.x<W+14:v.x>-v.L-14);
  for(const tr of E.trains){tr.hx+=tr.dir*tr.speed*dt;if(tr.spark>0)tr.spark-=dt;else if(chance(dt*.35)){tr.spark=.12;tr.sc=ri(0,tr.cars-1);}}
  E.trains=E.trains.filter(tr=>tr.dir>0?tr.hx-tr.cars*17<W+4:tr.hx+tr.cars*17>-4);
  updateCats(dt);
  for(const f of E.flocks)f.x+=f.dir*f.speed*dt;E.flocks=E.flocks.filter(f=>f.x>-30&&f.x<W+30);
  for(const p of E.planes)p.x+=p.dir*p.speed*dt;E.planes=E.planes.filter(p=>p.x>-10&&p.x<W+10);
  for(const h of E.helis)h.x+=h.dir*h.want*(.15+.85*noise(t*.07+h.ph))*dt;E.helis=E.helis.filter(h=>h.x>-14&&h.x<W+14);
  for(const s of E.shoot){s.age+=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;}E.shoot=E.shoot.filter(s=>s.age<s.life);
  for(const s of E.sats){s.x+=s.vx*dt;s.y+=s.vy*dt;}E.sats=E.sats.filter(s=>s.x>-2&&s.x<W+2);
  for(const c of E.clouds)c.x+=c.dir*c.speed*dt;E.clouds=E.clouds.filter(c=>c.x>-c.img.width-2&&c.x<W+2);
  // fireworks
  for(const s of E.fwShows)if(t>=s.next&&s.n>0){E.fw.push({rocket:true,x:s.cx+rr(-W*.15,W*.15),y:roadY-H*.2,vy:-rr(40,60),ty:rr(H*.1,H*.32),col:pick(FWC),col2:chance(.3)?pick(FWC):null});s.n--;s.next=t+rr(.6,3);}
  E.fwShows=E.fwShows.filter(s=>s.n>0);
  const born=[];
  for(const p of E.fw){
    if(p.rocket){p.y+=p.vy*dt;if(p.y<=p.ty){p.dead=true;const k=ri(18,34),sp=rr(10,20);for(let i=0;i<k;i++){const a=i/k*6.283+rr(-.1,.1),s=sp*rr(.7,1);born.push({x:p.x,y:p.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,age:0,life:rr(1.1,2),col:p.col2&&i%2?p.col2:p.col});}}}
    else{p.age+=dt;p.vy+=7*dt;p.vx*=1-dt*.8;p.vy*=1-dt*.4;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.age>p.life)p.dead=true;}
  }
  E.fw=E.fw.filter(p=>!p.dead).concat(born);
  // steam
  if(vent){steamAcc+=dt*(1.2+3.5*noise(t*.2+40));while(steamAcc>1){steamAcc--;E.parts.push({x:vent.x+rr(-.5,.5),y:vent.y,vx:0,vy:-rr(3,6),age:0,life:rr(2,4),col:'#8a87a6',a:.45,wind:5,grow:true});}}
  // smoker
  if(smoker&&shed){
    const s=smoker;s.tp+=dt;
    const pace={open:.8,out:1.2,back:1.2,close:.6};
    if(s.phase==='open'&&s.tp>=pace.open){s.phase='out';s.tp=0;}
    else if(s.phase==='out'){s.px=Math.min(1,s.tp/pace.out);if(s.tp>=pace.out){s.phase='stay';s.tp=0;}}
    else if(s.phase==='stay'){
      if(s.tp>=s.nextDrag){s.drag=1.2;s.nextDrag=s.tp+rr(4,9);s.puff=s.tp+1.6;}
      if(s.drag>0)s.drag-=dt;
      if(s.puff>0&&s.tp>=s.puff){s.puff=-1;const sc=Math.max(1,Math.round(u)),hx=Math.round(shed.dx-5*sc)+2*sc,hy=shed.b-8*sc;for(let i=0,n=ri(3,6);i<n;i++)E.parts.push({x:hx+rr(-1,1),y:hy+rr(-1,1),vx:rr(-1,1),vy:-rr(2,4),age:0,life:rr(3,5),col:'#9d9ab4',a:.38,wind:4,grow:true});}
      if(s.tp>=s.dur){s.phase='back';s.tp=0;}
    }
    else if(s.phase==='back'){s.px=Math.max(0,1-s.tp/pace.back);if(s.tp>=pace.back){s.phase='close';s.tp=0;}}
    else if(s.phase==='close'&&s.tp>=pace.close){log('smoker','they head back inside',{d:s.dur,n:s.nextDrag});smoker=null;}
  }
  // rain
  if(weather.level>.01){weather.acc+=dt*weather.level*W*1.4;while(weather.acc>1){weather.acc--;E.drops.push({x:rr(-10,W+10),y:rr(-4,0),vy:rr(95,130),vx:wind*18,end:chance(.4)?ledgeY:rr(ledgeY+5,H)});}}
  for(const d of E.drops){d.x+=d.vx*dt;d.y+=d.vy*dt;if(d.y>=d.end){d.dead=true;if(chance(.3))E.parts.push({x:d.x,y:d.end-1,vx:rr(-8,8),vy:-rr(6,14),age:0,life:.25,col:'#a9b6ea',a:.7,g:60});}}
  E.drops=E.drops.filter(d=>!d.dead);
  for(const p of E.parts){p.age+=dt;if(p.g)p.vy+=p.g*dt;if(p.wind)p.vx+=(wind*p.wind-p.vx)*dt*.6;p.x+=p.vx*dt;p.y+=p.vy*dt;}
  E.parts=E.parts.filter(p=>p.age<p.life);
}

/* ---------- draw ---------- */
function tvCol(ph){const n=noise(t*7+ph);return`rgb(${70+80*n|0},${110+90*n|0},${200+55*n|0})`;}
function drawBlinkers(list){for(const b of list){const on=((t+b.ph)%b.per)/b.per<.32;if(on){ctx.globalAlpha=.4;ctx.drawImage(glowRed,b.x-2,b.y-2);ctx.globalAlpha=1;rect(ctx,b.x,b.y,1,1,'#ff4a55');}else rect(ctx,b.x,b.y,1,1,'#4a1a26');}}
function drawNeon(){
  if(!neon)return;const n=neon;const on=t<n.flickUntil?noise(t*30)>.45:true;const hum=.86+.14*noise(t*3+5);
  ctx.fillStyle=n.col;
  for(let i=0;i<n.word.length;i++){
    const gl=FONT[n.word[i]],lx=n.x+1,ly=n.y+1+i*6,lit=on&&!(i===n.out&&t<n.outUntil);
    for(let r=0;r<5;r++)for(let c=0;c<3;c++)if(gl[r][c]==='1'){
      if(lit){ctx.fillStyle=n.col;ctx.globalAlpha=.2*hum;ctx.fillRect(lx+c-1,ly+r,3,1);ctx.fillRect(lx+c,ly+r-1,1,3);ctx.globalAlpha=hum;ctx.fillRect(lx+c,ly+r,1,1);}
      else{ctx.globalAlpha=1;ctx.fillStyle='#2a2233';ctx.fillRect(lx+c,ly+r,1,1);}
    }
  }
  ctx.globalAlpha=1;
}
function drawTrain(tr){
  const y0=trackY-7,hx=Math.round(tr.hx);
  for(let i=0;i<tr.cars;i++){
    const xl=tr.dir>0?hx-(i+1)*16-i:hx+i*17;
    rect(ctx,xl+7,y0-1,2,1,'#2a2e44');rect(ctx,xl+1,y0,14,1,'#3d4664');rect(ctx,xl,y0+1,16,5,'#56617f');rect(ctx,xl,y0+1,16,1,'#6a7596');rect(ctx,xl,y0+5,16,1,tr.stripe);
    [2,5,9,12].forEach((wx,k)=>{const id=i*4+k;rect(ctx,xl+wx,y0+2,2,2,tr.lit[id]?tr.lc[id]:'#2a3049');});
    rect(ctx,xl+7,y0+2,2,3,'#47506e');
    rect(ctx,xl+2,y0+6,3,1,'#100e1e');rect(ctx,xl+11,y0+6,3,1,'#100e1e');
    if(i<tr.cars-1)rect(ctx,tr.dir>0?xl-1:xl+16,y0+3,1,1,'#2a2a40');
    if(i===0){const fx=tr.dir>0?xl+15:xl;rect(ctx,fx,y0+4,1,1,'#fff5d2');ctx.globalAlpha=.6;ctx.drawImage(glowHead,fx-3,y0+1);ctx.globalAlpha=1;}
    if(i===tr.cars-1)rect(ctx,tr.dir>0?xl:xl+15,y0+4,1,1,'#ff4a4a');
    if(tr.spark>0&&i===tr.sc){ctx.drawImage(glowBlue,xl+5,y0-4);rect(ctx,xl+8,y0-1,1,1,'#e4f2ff');}
  }
}
function drawHeli(h){
  const x=Math.round(h.x),y=Math.round(h.y+Math.sin(t*1.3+h.ph)*.8),d=h.dir;
  const P=(lx,ly,w,hh,c)=>{ctx.fillStyle=c;ctx.fillRect(d>0?x+lx:x-lx-w+1,y+ly,w,hh);};
  if(h.beam){
    const a=h.ba+.5*(noise(t*.25+h.ph)-.5),ox=x+(d>0?2:-2)+.5,oy=y+3,dy=roadY-oy,ex=ox+Math.tan(a)*dy;
    const g=ctx.createLinearGradient(ox,oy,ex,roadY);g.addColorStop(0,'rgba(255,245,215,.22)');g.addColorStop(1,'rgba(255,245,215,.05)');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(ox-.5,oy);ctx.lineTo(ox+.5,oy);ctx.lineTo(ex+6,roadY);ctx.lineTo(ex-6,roadY);ctx.closePath();ctx.fill();
    ctx.globalAlpha=.16;rect(ctx,Math.round(ex-6),roadY-2,12,3,'#fff1cc');ctx.globalAlpha=1;
  }
  P(-4,1,4,1,'#1d1b30');P(0,0,5,3,'#1f1d34');P(3,1,2,1,'#5f7aa8');P(0,3,1,1,'#14122a');P(4,3,1,1,'#14122a');P(-1,4,7,1,'#14122a');
  const fr=Math.floor(t*28)%2;ctx.globalAlpha=.65;P(fr?-3:-1,-1,fr?10:6,1,'#3a3858');P(-5,fr?0:1,1,fr?3:1,'#3a3858');ctx.globalAlpha=1;
  if(((t+h.ph)%1.2)<.4){P(-4,0,1,1,'#ff4a55');ctx.globalAlpha=.4;ctx.drawImage(glowRed,(d>0?x-4:x+4)-2,y-2);ctx.globalAlpha=1;}
}
function drawPlane(p){
  const x=Math.round(p.x),y=Math.round(p.y),f=p.dir>0?2:-2;
  ctx.globalAlpha=.55;rect(ctx,x-2,y,5,1,'#3a3a55');ctx.globalAlpha=1;
  rect(ctx,x+f,y,1,1,((t+p.ph)%1.1)<.5?'#ff4a55':'#5a1e28');rect(ctx,x-f,y,1,1,'#3fd98a');
  const s=(t+p.ph*1.7)%1.5;if(s<.06||(s>.16&&s<.22))rect(ctx,x,y-1,1,1,'#ffffff');
}
function drawBirds(f){
  ctx.fillStyle='#0f0d1d';
  for(const m of f.m){const px=Math.round(f.x+m.dx),py=Math.round(f.y+m.dy+Math.sin(t*1.3+m.ph)*1.2);
    if(Math.sin(t*m.fr+m.ph)>0){ctx.fillRect(px,py,1,1);ctx.fillRect(px+2,py,1,1);ctx.fillRect(px+1,py+1,1,1);}
    else{ctx.fillRect(px+1,py,1,1);ctx.fillRect(px,py+1,1,1);ctx.fillRect(px+2,py+1,1,1);}}
}
function drawNear(){
  ctx.drawImage(nearC,0,0);
  for(const w of near.wins){
    if(!w.lit)continue;
    rect(ctx,w.x,w.y,w.w,w.h,w.tv?tvCol(w.ph):w.col);
    if(!w.tv){ctx.globalAlpha=.15;rect(ctx,w.x,w.y+w.h-2,w.w,2,'#3a1d10');ctx.globalAlpha=1;}
    if(w.occ){const ox=Math.round(w.x+w.occ.x);for(let c=0;c<2;c++){const gx=ox+c;if(gx>=w.x&&gx<w.x+w.w)rect(ctx,gx,w.y+(c?2:1),1,w.h-(c?2:1),'#3b2217');}}
    if(w.curtain>.02)rect(ctx,w.x,w.y,w.w,Math.round(w.h*w.curtain),w.tv?'#2b3a66':'#a8693e');
    rect(ctx,w.x+3,w.y,1,w.h,'#1a1626');rect(ctx,w.x,w.y+2,w.w,1,'#1a1626');
  }
}
function drawRoofDynamic(){
  ctx.drawImage(propsC,0,0);
  drawBlinkers(roofBlinkers);
  if(ac){const a=t*11+ac.ph;ctx.fillStyle='#4a4670';for(let k=0;k<3;k++){const an=a+k*2.094;for(let s=1;s<ac.r;s++)ctx.fillRect(ac.cx+Math.round(Math.cos(an)*s),ac.cy+Math.round(Math.sin(an)*s),1,1);}rect(ctx,ac.cx,ac.cy,1,1,'#5a5680');}
  if(line){
    const{x1,x2,y}=line,sag=1.5*u+wind*.5,ly=xx=>y+Math.round(Math.sin(Math.PI*(xx-x1)/(x2-x1))*sag);
    ctx.fillStyle='#4b4668';for(let xx=x1+1;xx<x2;xx++)ctx.fillRect(xx,ly(xx),1,1);
    for(const c of line.cl){const xc=Math.round(x1+c.p*(x2-x1)),hy=ly(xc),sway=wind*2.5+Math.sin(t*1.7+c.ph)*.8;
      for(let r=0;r<c.h;r++)rect(ctx,xc+Math.round(r/c.h*sway),hy+1+r,c.w,1,r===0?shade(c.col,-.3):c.col);}
  }
  if(shed){
    const s=smoker;let L=0;
    if(s){L=s.phase==='open'?s.tp/.8:s.phase==='close'?1-s.tp/.6:1;L=Math.max(0,Math.min(1,L));}
    if(L>0){
      ctx.globalAlpha=L;rect(ctx,shed.dx,shed.b-shed.dh,shed.dw,shed.dh,'#ffcf8a');
      for(let i=0;i<4;i++){if(shed.b+i>=H)break;ctx.globalAlpha=L*.18*(1-i/4);rect(ctx,shed.dx-1-i,shed.b+i,shed.dw+2+2*i,1,'#ffcf8a');}
      ctx.globalAlpha=L;ctx.drawImage(glowWarm,shed.lampX-7,shed.lampY-7);rect(ctx,shed.lampX,shed.lampY,1,1,'#ffe1a8');ctx.globalAlpha=1;
    }
    if(s&&s.phase!=='open'&&s.phase!=='close'){
      const sc=Math.max(1,Math.round(u)),door=shed.dx+Math.floor((shed.dw-4*sc)/2),out=Math.round(shed.dx-5*sc),px=Math.round(door+(out-door)*s.px),top=shed.b-9*sc;
      const col=s.px>.5?'#1c1830':'#0d0b16';
      for(let r=0;r<9;r++)for(let c=0;c<4;c++)if(PERSON[r][c]!=='.')rect(ctx,px+c*sc,top+r*sc,sc,sc,col);
      if(s.px>.5){ctx.globalAlpha=.5;rect(ctx,px+4*sc-1,top+2*sc,1,4*sc,'#ffcf8a');ctx.globalAlpha=1;}
      if(s.phase==='stay'||s.px>.9){const e=s.drag>0?1:.35+.15*noise(t*2),ex=px+4*sc,ey=top+4*sc;ctx.globalAlpha=.3*e;ctx.drawImage(glowRed,ex-2,ey-2);ctx.globalAlpha=1;rect(ctx,ex,ey,1,1,`rgb(255,${120+100*e|0},${40+40*e|0})`);}
    }
  }
}
function draw(){
  const lv=weather.level,sa=1-lv*.92;
  ctx.globalAlpha=1;ctx.drawImage(skyC,0,0);
  if(sa>.02)for(const s of stars){ctx.globalAlpha=s.b*(.45+.55*noise(t*s.r+s.ph))*sa;ctx.fillStyle=s.c;ctx.fillRect(s.x,s.y,1,1);}
  ctx.globalAlpha=1;
  for(const s of E.sats){ctx.globalAlpha=.8*sa;rect(ctx,s.x,s.y,1,1,'#e8e8ff');}ctx.globalAlpha=1;
  for(const s of E.shoot){const f=s.age/s.life,a=f<.15?f/.15:1-(f-.15)/.85,sp=Math.hypot(s.vx,s.vy),ux=s.vx/sp,uy=s.vy/sp;for(let i=0;i<9;i++){ctx.globalAlpha=Math.max(0,a*(1-i/9));rect(ctx,Math.round(s.x-ux*i*1.2),Math.round(s.y-uy*i*1.2),1,1,'#ffffff');}}
  ctx.globalAlpha=1-lv*.7;const mS=moonC.width,mx=((moon.x0*(W+30)+t*.012)%(W+30))-15;ctx.drawImage(moonC,Math.round(mx-mS/2),Math.round(moon.y*H-mS/2));
  for(const c of E.clouds){ctx.globalAlpha=Math.min(1,c.a*(.85+lv*.3));ctx.drawImage(c.img,Math.round(c.x),Math.round(c.y));}
  ctx.globalAlpha=1;
  for(const p of E.fw){if(p.rocket){rect(ctx,p.x,p.y,1,1,'#ffe0b0');ctx.globalAlpha=.4;rect(ctx,p.x,p.y+1,1,2,'#ff9b5a');ctx.globalAlpha=1;}else{const f=p.age/p.life;let a=1-f;if(f>.65&&noise(t*20+p.x)>.5)a*=.3;ctx.globalAlpha=a;rect(ctx,p.x,p.y,1,1,p.col);}}
  ctx.globalAlpha=1;
  for(const p of E.planes)drawPlane(p);
  ctx.drawImage(farC,0,0);
  ctx.fillStyle='#7d6550';for(const w of farWins)if(w.lit)ctx.fillRect(w.x,w.y,1,1);
  for(const h of E.helis)drawHeli(h);
  ctx.drawImage(midC,0,0);
  ctx.globalAlpha=.9;for(const w of midWins){if(!w.lit)continue;ctx.fillStyle=w.tv?tvCol(w.ph):w.col;ctx.fillRect(w.x,w.y,w.w,w.h);}ctx.globalAlpha=1;
  drawNeon();drawBlinkers(blinkers);
  for(const f of E.flocks)drawBirds(f);
  rect(ctx,0,trackY,W,2,'#1a1832');rect(ctx,0,trackY,W,1,'#2c2950');
  for(const px of pillarsX)rect(ctx,px,trackY+2,2,roadY-trackY-1,'#15132a');
  for(const tr of E.trains)drawTrain(tr);
  ctx.drawImage(roadC,0,0);
  for(const l of lamps){rect(ctx,l.x,roadY-11,1,11,'#2b2747');rect(ctx,l.x,roadY-11,3,1,'#2b2747');}
  for(const v of E.veh)if(v.lane===1)drawVehicle(v);
  for(const v of E.veh)if(v.lane===0)drawVehicle(v);
  for(const l of lamps){
    const on=!(t<l.offUntil)&&!(t<l.flickUntil&&noise(t*22+l.ph)<.5),hx=l.x+2,hy=roadY-10;
    if(on){ctx.drawImage(glowLamp,hx-6,hy-6);ctx.globalAlpha=.06;for(let r=1;r<=9;r++){const w=1+Math.floor(r/2);rect(ctx,hx-Math.floor(w/2),hy+r,w,1,'#ffb060');}ctx.globalAlpha=1;rect(ctx,hx,hy,1,1,'#ffc982');}
    else rect(ctx,hx,hy,1,1,'#3a302c');
  }
  drawNear();
  ctx.drawImage(parC,0,0);
  for(const c of E.cats)drawCat(c);
  drawRoofDynamic();
  for(const p of E.parts){const f=p.age/p.life;ctx.globalAlpha=p.a*(1-f);const s=p.grow&&f>.45?2:1;rect(ctx,p.x,p.y,s,s,p.col);}
  ctx.globalAlpha=1;
  if(lv>.01){ctx.globalAlpha=lv*.18;rect(ctx,0,0,W,H,'#0a0d22');ctx.globalAlpha=.5;ctx.fillStyle='#8f9cd8';for(const d of E.drops){const x=Math.round(d.x),y=Math.round(d.y);ctx.fillRect(x,y,1,1);ctx.fillRect(Math.round(d.x-d.vx*.012),y-1,1,1);}ctx.globalAlpha=1;}
}

/* ---------- run ---------- */
build();
for(let i=0;i<90;i++){t+=1/30;update(1/30);}
draw();updateUI();
let last=performance.now(),uiT=0,lastDraw=0;
function frame(now){if(PAUSED){last=now;requestAnimationFrame(frame);return;}if(LOWQ&&now-lastDraw<32){requestAnimationFrame(frame);return;}lastDraw=now;const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;t+=dt;update(dt);draw();uiT+=dt;if(uiT>.5){uiT=0;updateUI();}requestAnimationFrame(frame);}
requestAnimationFrame(frame);

let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{build();draw();},200);});
const CLOSE_ICON='<svg viewBox="0 0 7 7" width="16" height="16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M0 0h1v1H0zM1 1h1v1H1zM2 2h1v1H2zM3 3h1v1H3zM4 4h1v1H4zM5 5h1v1H5zM6 6h1v1H6zM6 0h1v1H6zM5 1h1v1H5zM4 2h1v1H4zM2 4h1v1H2zM1 5h1v1H1zM0 6h1v1H0z"/></svg>';
function toggleLog(){ui.panel.hidden=!ui.panel.hidden;ui.btn.setAttribute('aria-expanded',String(!ui.panel.hidden));if(ui.panel.hidden){ui.btn.textContent='Log';ui.btn.classList.remove('icon');ui.btn.removeAttribute('aria-label');}else{ui.btn.innerHTML=CLOSE_ICON;ui.btn.classList.add('icon');ui.btn.setAttribute('aria-label','Close log');}uiDirty=true;updateUI();}
ui.btn.addEventListener('click',e=>{e.stopPropagation();toggleLog();});
cv.addEventListener('click',()=>ui.hud.classList.toggle('off'));
addEventListener('keydown',e=>{if(e.key==='l'||e.key==='L')toggleLog();if(e.key==='h'||e.key==='H')ui.hud.classList.toggle('off');});
async function wake(){try{if('wakeLock'in navigator&&document.visibilityState==='visible')await navigator.wakeLock.request('screen');}catch(e){}}
if(!EMBED){wake();document.addEventListener('visibilitychange',wake);}
})();
