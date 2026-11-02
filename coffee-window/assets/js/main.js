/* Coffee Window: a window seat in a late-night cafe in Night City. The inside of the cafe is painted as realistically as
   a Canvas allows, and the neon street outside, drawn in the flat look of a cyberpunk anime, sits softly out of focus
   beyond the glass. A cup of coffee steams on the counter. Outside, cars and people pass under the signs, flyers cross the sky and now and
   then a dog trots by. Inside, the coffee goes down a sip at a time, a little robot rolls out of the counter to refill it, and sometimes a
   cat climbs onto the counter and curls up to sleep. Every choice comes from one generator seeded with the moment the
   page opens, so no two nights play the same way. No libraries, no image files: everything is drawn to a Canvas. */
(async()=>{
'use strict';
const SRC=document.currentScript.src;
const cv=document.getElementById('scene');
const ctx=cv.getContext('2d');
// Seed, frame loop, embed mode and overlay come from the shared runtime, ../assets/js/nightcity.js.
const{LOWQ,DEBUG,R,rr,ri,pick,chance,expo,wpick,shuffle,noise}=NightCity;

/* ---------- helpers ---------- */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
const ease=k=>{k=clamp(k,0,1);return k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;};
const sstep=(a,b,v)=>{const k=clamp((v-a)/(b-a),0,1);return k*k*(3-2*k);};
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return[c,c.getContext('2d')];}
function hex(c){const n=parseInt(c.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
const toHex=a=>'#'+a.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
const mixC=(a,b,k)=>{const x=hex(a),y=hex(b);return toHex(x.map((v,i)=>v+(y[i]-v)*k));};
const shade=(c,k)=>mixC(c,k<0?'#000000':'#ffffff',Math.abs(k));
const rgba=(c,a)=>`rgba(${hex(c).join(',')},${a})`;
const cap=s=>s[0].toUpperCase()+s.slice(1);
const an=w=>(/^[aeiou]/.test(w)?'an ':'a ')+w;
// A fixed hash for details painted on every resize, so a resize paints the same street.
const h3=(a,b,c)=>{const v=Math.sin(a*12.9898+b*78.233+c*37.719)*43758.5453;return v-Math.floor(v);};
function rrect(g,x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function ell(g,x,y,rx,ry,col){g.fillStyle=col;g.beginPath();g.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);g.fill();}
function poly(g,pts){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.closePath();}
function lin(g,x0,y0,x1,y1,stops){const gr=g.createLinearGradient(x0,y0,x1,y1);for(const[o,c]of stops)gr.addColorStop(o,c);return gr;}
function rad(g,x,y,r0,r1,stops){const gr=g.createRadialGradient(x,y,r0,x,y,r1);for(const[o,c]of stops)gr.addColorStop(o,c);return gr;}
function glow(g,x,y,r,col,a){g.fillStyle=rad(g,x,y,0,r,[[0,rgba(col,a)],[.35,rgba(col,a*.35)],[1,rgba(col,0)]]);g.fillRect(x-r,y-r,r*2,r*2);}
const SANS='"Helvetica Neue",Helvetica,Arial,sans-serif';
// The street outside is cel shaded: flat fills and an inked outline on the nearest figures.
const INK='#120c1c';
// A limb as round strokes: ink first, then the colour.
function limb(g,pts,w,col,lw){g.lineCap='round';g.lineJoin='round';
  for(const pass of[0,1]){if(!pass&&!lw)continue;g.strokeStyle=pass?col:INK;g.lineWidth=w+(pass?0:lw*2);g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.stroke();}}

// Points along a chain of cubic curves, so a shape's outline can be walked as well as filled.
function bez(a,b,c,d,n,out){for(let i=out.length?1:0;i<=n;i++){const s=i/n,u=1-s;out.push([u*u*u*a[0]+3*u*u*s*b[0]+3*u*s*s*c[0]+s*s*s*d[0],u*u*u*a[1]+3*u*u*s*b[1]+3*u*s*s*c[1]+s*s*s*d[1]]);}return out;}
// Smooth 2D value noise from the fixed hash, for textures painted once.
function vn2(x,y,sd){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=h3(xi,yi,sd),b=h3(xi+1,yi,sd),c=h3(xi,yi+1,sd),e=h3(xi+1,yi+1,sd);return a+(b-a)*u+(c-a)*v+(a-b-c+e)*u*v;}
function chain(segs,n){const out=[];for(const q of segs)bez(q[0],q[1],q[2],q[3],n||8,out);return out;}
function ptsPath(pts){const p=new Path2D();p.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)p.lineTo(pts[i][0],pts[i][1]);p.closePath();return p;}
// The outline of a tube round a centre line, tapering from w0 to w1, with a rounded tip.
function tube(c,w0,w1){const L=[],Rt=[],n=c.length;
  for(let i=0;i<n;i++){const a=c[Math.max(0,i-1)],b=c[Math.min(n-1,i+1)],tx=b[0]-a[0],ty=b[1]-a[1],l=Math.hypot(tx,ty)||1,w=lerp(w0,w1,i/(n-1))/2;L.push([c[i][0]-ty/l*w,c[i][1]+tx/l*w]);Rt.push([c[i][0]+ty/l*w,c[i][1]-tx/l*w]);}
  const e=c[n-1],q=c[n-2],tx=e[0]-q[0],ty=e[1]-q[1],l=Math.hypot(tx,ty)||1;
  return L.concat([[e[0]+tx/l*w1*.45,e[1]+ty/l*w1*.45]],Rt.reverse());}
const HASF=typeof ctx.filter==='string';

/* ---------- the night ---------- */
const NEON=['#ff2a7a','#2af0ff','#f3e600','#b14bff','#ff4a3a','#3bff9a'];
const MOODS=[
  [{name:'A clear night over Night City',sky:['#05051a','#1c0b40','#5e1a62','#d03a6a'],haze:'#ff3a7a',rain:.1,smog:.25},3],
  [{name:'A wet neon night',sky:['#030818','#0a1a3a','#163a5e','#2a8a9e'],haze:'#2af0ff',rain:.75,smog:.45},3],
  [{name:'A smoggy yellow night',sky:['#0a0712','#24141e','#5e3a1c','#d8a020'],haze:'#f3c600',rain:.3,smog:.75},2]
];
const MOOD=wpick(MOODS);
const CAFE=pick(['COFFEE','CAFE','ESPRESSO','OPEN LATE','LAST CUP','NIGHT OWL','BEANS','CAFE 24']);
const CAFECOL=pick(['#ff2a7a','#2af0ff','#f3e600']);
// The cup, the arm you reach with, and the barista on tonight.
// The cup, and the robot that refills it.
// About three nights in ten it's iced coffee in a tall glass instead: cold brew, an iced latte, an iced americano or an
// espresso tonic.
// With ?debug, ?iced forces it and ?hot rules it out, for checking.
const ICED=(chance(.3)||(DEBUG&&new URLSearchParams(location.search).has('iced')))&&!(DEBUG&&new URLSearchParams(location.search).has('hot'));
// Hot coffee comes in one of three cups, each a real kind of modern cup: a double-walled titanium cup coloured by
// its oxide, a faceted porcelain cup in a matte glaze over a raw clay foot, or a double-walled glass cup in which the
// coffee seems to float. Iced coffee comes in a heavy, wide tumbler whose thick cut base splits the neon outside into
// colours, with a big ice sphere or two large cubes.
const CUP=ICED?pick([{name:'cold brew',tint:['#050200','#120702','#221005']},{name:'iced latte',milk:true,tint:['#1e0f06','#3e2210','#5a341a']},{name:'iced americano',tint:['#060301','#160803','#281206']},{name:'espresso tonic',tonic:true,tint:['#060301','#1a0b04','#2e1608']}])
  :pick([{name:'titanium cup',kind:'ti'},{name:'faceted porcelain cup',kind:'facet',body:pick(['#2b2b31','#e2ded6','#3c434c','#4e2626'])},{name:'double-walled glass cup',kind:'dwg'}]);
if(ICED){CUP.kind='rocks';CUP.sphere=chance(.5);CUP.straw=chance(.4);}
const BOT={body:pick(['#e8c21a','#e8e4dc','#d8345a','#3a9ab0','#e07a2a']),eye:pick(['#2af0ff','#ff2a7a','#3bff9a','#f3e600']),name:pick(['little robot','tiny robot','pour bot','robot'])};

/* ---------- the street, generated once ---------- */
// The view is in units: the window spans 100 units of height on landscape screens. Heights are units above the bottom
// of the screen. Eye level, where the street's horizon sits, is HZ. Things further away stand on higher ground lines:
// the far pavement, the far lane, the near lane and the near pavement just outside the glass.
const WORLDW=360,HZ=50,BB=44.5,FWK=43.7,FKERB=42.8,FLN=41.5,LANE=39.9,NLN=38.1,KERB=35.5,NWK=32,SILL=25.5;
const upm=g=>(HZ-g)/1.2; // units per metre at a ground line, seen from a seat 1.2 m up
// A big screen high on a tower in the distance.
const BILL={x:rr(10,30),w:rr(22,30),y:rr(70,80),h:rr(26,34),mode:pick(['koi','text','bars']),t:0,word:pick(['SYNTH 9','NEW YOU','DREAM ON','CHROME SALE','NIGHT AIR','SLEEP IS OPTIONAL']),col:pick(NEON),col2:pick(NEON)};
// The skyline: a far layer of slim towers fading into the smog, and a nearer layer of taller ones with their own
// rooftops (stepped, spired, slanted or crowned in neon). Both rise past the top of the window.
const FARL=[];
{let x=ri(-20,-4);while(x<WORLDW){const w=ri(7,20);FARL.push({x,w,top:rr(70,250)*(chance(.25)?1.3:1),col:pick(['#1a1838','#201a3a','#16203a','#241a34']),lit:rr(.03,.12),s:ri(1,99999)});x+=w+ri(-3,3);}}
const TOW=[];
{let x=ri(-24,-4);while(x<WORLDW){const w=ri(14,38);TOW.push({x,w,top:rr(95,240),col:pick(['#141a34','#1e1434','#10222e','#22182c']),strip:chance(.4)?pick(NEON):null,ant:chance(.35),lit:rr(.1,.32),s:ri(1,99999),
    roof:wpick([['flat',3],['step',2],['spire',1.2],['crown',1],['slant',1]]),rh:rr(8,30),crown:pick(NEON)});x+=w+ri(-8,6);}
  TOW.push({x:BILL.x-5,w:BILL.w+10,top:BILL.y+BILL.h+rr(14,50),col:'#160f2a',strip:null,ant:true,lit:.12,s:ri(1,99999),roof:'flat',rh:0,crown:null,bill:true});}
// Some nights the moon hangs in a corner of the window, and some nights the sky is full of stars, more often when
// it's clear. On a smoggy night the moon looks warm.
const NIGHT={moon:chance(MOOD.smog<.5?.6:.4),moonLeft:chance(.5),phase:rr(.15,1),moonR:rr(3.4,4.8),moonCol:MOOD.smog>.6?'#ffd59a':'#f1ede2',stars:chance(MOOD.rain<.5?.8:.35)};
const FACADES=['#1a2436','#251a36','#162a30','#2e2034','#1e2238','#30221e','#202a26','#2a1a26'];
const SHOPS=shuffle([['RAMEN','#ff6a2a'],['BAR','#ff2a7a'],['24/7','#2af0ff'],['NOODLES','#f3e600'],['CLINIC','#3bff9a'],['ARCADE','#b14bff'],['PHARMACY','#3bff9a'],['DUMPLINGS','#ff4a3a'],['KARAOKE','#ff2a7a'],['TATTOO','#2af0ff'],['PAWN','#f3e600'],['IMPLANTS','#2af0ff'],['SUSHI','#ff4a3a'],['LAUNDRY','#c8e0ff']]);
const BLD=[],SIGNS=[],WINS=[];
{let x=ri(-30,-8),si=0;
  while(x<WORLDW){
    const w=ri(30,64),fh=rr(12,13.5),gh=15;let fl=wpick([[1,4],[2,2.5],[3,.7],[4,.3],[6,.15]]);
    // Keep the building in front of the big screen low enough to show it.
    if(x<BILL.x+BILL.w&&x+w>BILL.x)fl=Math.max(1,Math.min(fl,Math.floor((BILL.y-3-BB-gh)/fh)));
    const b={x,w,fl,fh,gh,col:pick(FACADES),s:ri(1,99999),kind:wpick([['shop',6],['shutter',1.5],['dark',1.2]]),shop:SHOPS[si++%SHOPS.length],fire:chance(.4),ac:ri(0,3),tag:chance(.5)?pick(NEON):null};
    b.top=BB+gh+fl*fh;BLD.push(b);
    const ww=5,wh=7.5,n=Math.max(1,Math.floor((w-6)/9)),gap=n>1?(w-8-n*ww)/(n-1):0;
    for(let f=0;f<fl;f++)for(let c=0;c<n;c++){const lit=chance(.4);
      WINS.push({x:x+4+(n>1?c*(ww+gap):(w-8-ww)/2),y:BB+gh+f*fh+(fh-wh)/2,w:ww,h:wh,lit:lit?1:0,want:lit?1:0,rate:rr(.4,2),col:wpick([['#ffcf7a',4],['#ff7ab0',1.5],['#7af0ff',1.5],['#c8d8ff',1.5],['#f3e600',.6]]),blind:chance(.35),fig:chance(.1)?rr(.2,.8):0,f});}
    if(b.kind==='shop')SIGNS.push({kind:'board',x:x+w/2,y:BB+gh-3.6,word:b.shop[0],col:b.shop[1],size:3.2});
    if(fl>=3&&chance(.5)){const word=pick(['HOTEL','BAR','LIVE','CLUB','RAMEN','OPEN','LOVE','DOLLS']);if(word.length*3.9<fl*fh-6)SIGNS.push({kind:'blade',x:x+(chance(.5)?2.5:w-2.5),y:BB+gh+4,word,col:pick(NEON),size:3.2});}
    if(fl>=2&&chance(.3))SIGNS.push({kind:'roof',x:x+w/2,y:b.top+1.6,word:pick(['MOTEL','NOODLES','24H','DRINK','CHROME','NO VACANCY']),col:pick(NEON),size:4.2});
    x+=w+(chance(.38)?ri(6,20):0);}}
for(const s of SIGNS){s.on=1;s.flick=null;s.bad=chance(.15)?ri(0,s.word.length-1):-1;}
const FLOORS=['first','second','third','fourth','fifth','sixth'];

/* ---------- the cafe ---------- */
// Bulbs hang in front of the window. Their places are fractions of the screen width.
const BULBS=[];{const n=ri(3,5);for(let i=0;i<n;i++)BULBS.push({f:(i+rr(.25,.75))/n,drop:rr(10,30),sw:rr(0,TAU),on:1,flick:null,warm:pick(['#ffb347','#ffc46a','#ffa040'])});}
// About one night in 42 the cafe's lights are off and a candle burns beside the flower instead. The flower stands at
// one end of the counter and a small bookshelf at the other. Usually there is just the coffee, sometimes a book or a
// notepad beside it.
// With ?debug, ?dark forces the dark night, for checking. The chance is drawn either way, so the rest stays the same.
const DARK=chance(1/42)||(DEBUG&&new URLSearchParams(location.search).has('dark'));
const PROPS={candle:DARK,vase:true,flowerLeft:chance(.5),extra:wpick([['none',3],['book',1.5],['notepad',1.5]]),flower:pick(['#f6f2ea','#f4dbe2','#f6e6a8']),cover:pick(['#3a2a22','#22303a','#4a1e22','#2a3a2a']),ribbon:pick(['#a8242a','#2a4a8a','#c8a040']),
  ink:pick(['#1c2a5a','#2a2a2e','#3a1a4a']),pen:pick(['#14141a','#8a1e24','#1e3a6a','#c8c8d0'])};
// The bookshelf's books, left to right: width and height in centimetres, colour, and a band or two on the spine.
const BOOKCOLS=['#6a1e22','#1e3a52','#2a4a32','#c8b48a','#3a2a4a','#8a5a2a','#1a1a1e','#a8442a','#4a5a6a','#d8d0c0','#5a3a1a','#2a5a5a'];
const SHELF={wood:pick(['#5a3420','#3a2414','#7a5232']),books:[]};
// Classics on the shelf, from ../library.json: each title and author in its own language and script, with English
// names beside the rest. Japanese and Chinese spines stack their characters top to bottom. The rest run down the spine
// in their own typeface. If the list can't be loaded, the books stand untitled.
const LIBRARY=await fetch(new URL('../library.json',SRC)).then(r=>r.ok?r.json():[]).catch(()=>[]);
const SERIF='Georgia,"Times New Roman",serif',BFONT={latin:SERIF,cyrillic:SERIF,greek:SERIF,devanagari:'"Kohinoor Devanagari","Noto Serif Devanagari","Noto Sans Devanagari",Mangal,serif',bengali:'"Kohinoor Bangla","Noto Serif Bengali","Noto Sans Bengali",Vrinda,serif',
  tamil:'"Tamil Sangam MN","Noto Serif Tamil","Noto Sans Tamil",Latha,serif',japanese:'"Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK JP",serif',chinese:'"Songti TC","Songti SC","Noto Serif CJK TC",serif',arabic:'"Geeza Pro","Noto Naskh Arabic",serif'};
// Between two and four books, and sometimes the last one leans over. The shelf is as wide as its books need.
{const n=ri(2,4),lib=shuffle(LIBRARY.slice());for(let i=0;i<n;i++)SHELF.books.push({w:rr(2.4,4.2),h:rr(16,21.5),col:pick(BOOKCOLS),bands:ri(0,2),book:lib[i],s:ri(1,9999)});
  if(n>=3&&chance(.5))SHELF.lean=SHELF.books.pop();
  SHELF.inner=SHELF.books.reduce((a,b)=>a+b.w+.05,0)+(SHELF.lean?SHELF.lean.h*Math.sin(.32)+SHELF.lean.w*Math.cos(.32)+.3:1.4)+.3;}

/* ---------- state ---------- */
let t=0,warming=false,raining=false,rainK=0,wet=0;
const stats={sips:0,refills:0,cars:0,people:0};
const coffee={level:rr(.5,.95),temp:ICED?0:rr(.7,1),ice:rr(.75,1)};
// A sip in progress: how much is still to go, and how fast it goes down.
const sip={left:0,rate:0};
const bot={state:'off',k:0,dur:0,x:0,arm:0,tank:1};
let cat=null,refillAt=-1;
const cars=[],walkers=[],flyers=[],glassDrops=[],runners=[],streaks=[];
function log(text){if(!warming)NightCity.log(text);}
const lastLog={};
function logOnce(key,gap,text){if(t-(lastLog[key]??-1e9)<gap)return;lastLog[key]=t;log(text);}

/* ---------- canvases and layout ---------- */
let CW=1,CH=1,S=1,OS=.5,OW=1,OH=1,RH=1,VW=100,VH=100,XWR=70,WTOP=94,CUPX=60,CANDX=40,VASEX=30,EDGE=10;
const CANDY=19;
// The street is drawn at half resolution into OUT and laid in softly blurred, like a camera focused on the counter.
let FAR,fctx,NEAR,nctx,WET,wctx,OUT,octx,REFL,rctx,IN,ictx,VIG,grainPat,STM,stc,STW=1,STH=1;
// Light from the street catches the edges of things inside.
const RIM=mixC('#c8e8ff',CAFECOL,.3);
const Y=yu=>VH-yu;
const sc=yu=>1.3-yu/42; // how big things on the counter look at a depth: near the screen's bottom edge or by the glass

/* ---------- painting the far city ---------- */
// How high the city stands at a point across the street, the tallest of anything there.
function skyAt(x,r,only){let top=0;for(const L of only||[FARL,TOW,BLD])for(const b of L)if(x+r>b.x&&x-r<b.x+b.w){const h=topOf(b)+(b.roof==='spire'||b.roof==='step'?b.rh:0);if(h>top)top=h;}return top;}
// A skyline tower right under the moon is drawn a little shorter, so the moon always shows clear in its corner.
// The big screen's tower can be shortened too, but never below the screen itself.
function topOf(b){if(!MOONAT||!b.roof)return b.top;const[mx,my]=MOONAT,r=NIGHT.moonR;if(!(b.x<mx+r+6&&b.x+b.w>mx-r-6))return b.top;const cut=Math.min(b.top,my-r-5-(b.roof==='spire'||b.roof==='step'?b.rh:0));return b.bill?Math.max(cut,BILL.y+BILL.h+4):cut;}
let MOONAT=null,TWK=[];
function paintFar(g){
  g.setTransform(OS,0,0,OS,0,0);
  const[s0,s1,s2,s3]=MOOD.sky;
  g.fillStyle=lin(g,0,0,0,Y(HZ-4),[[0,s0],[.45,s1],[.8,s2],[1,s3]]);g.fillRect(0,0,VW,VH);
  // Stars, a few of them tinted, the brightest with a little glow.
  const n=NIGHT.stars?260:40;
  for(let i=0;i<n;i++){const x=h3(i,1,7)*VW,yu=HZ+12+h3(i,2,7)*(VH-HZ),a=(NIGHT.stars?.2:.1)+h3(i,3,7)*(NIGHT.stars?.65:.3),r=.14+h3(i,4,7)*.26;
    g.fillStyle=h3(i,5,7)<.15?`rgba(200,220,255,${a.toFixed(2)})`:h3(i,5,7)<.25?`rgba(255,220,200,${a.toFixed(2)})`:`rgba(255,248,255,${a.toFixed(2)})`;g.beginPath();g.arc(x,Y(yu),r,0,TAU);g.fill();
    if(NIGHT.stars&&h3(i,6,7)<.06){g.globalCompositeOperation='lighter';glow(g,x,Y(yu),r*6,'#dfe8ff',.25);g.globalCompositeOperation='source-over';}}
  // The moon, in a top corner of the window where no tower stands in front of it.
  MOONAT=null;
  if(NIGHT.moon){const r=NIGHT.moonR,yu=WTOP-4.5-r,fixed=[BLD,[{x:BILL.x-5,w:BILL.w+10,top:BILL.y+BILL.h+4}]];
    // On a narrow screen the title sits in the top-left corner, so the moon prefers the right there.
    for(const left of VW<100?[false,true]:[NIGHT.moonLeft,!NIGHT.moonLeft]){const x0=left?r+5:VW-r-5;for(let d=0;d<=30&&!MOONAT;d+=2){const x=x0+(left?d:-d);if(skyAt(x,r+6,fixed)<yu-r-2)MOONAT=[x,yu];}if(MOONAT)break;}
    if(MOONAT){const[x,yu]=MOONAT,y=Y(yu),c=NIGHT.moonCol;
      // The sun has set, so the lit side faces down and to one side, 45 degrees below level. A crescent's horns point up.
      const f=NIGHT.phase,sd=NIGHT.moonLeft?-1:1,dx=sd*Math.SQRT1_2,dy=Math.SQRT1_2;
      // The glow comes from the lit part, so a thin crescent glows less and off to its side.
      {const o=r*(1-f)*.6;g.globalCompositeOperation='lighter';glow(g,x+dx*o,y+dy*o,r*7,c,.06+.1*f);glow(g,x+dx*o,y+dy*o,r*2.4,c,.08+.17*f);g.globalCompositeOperation='source-over';}
      // Only the lit part is drawn: the limb on the sunny side, closed by the terminator, an ellipse whose width follows
      // the phase. The unlit part is left as sky.
      const lit=new Path2D(),tp=new Path2D();
      tp.moveTo(0,-r);tp.arc(0,0,r,-Math.PI/2,Math.PI/2);tp.ellipse(0,0,r*Math.abs(1-2*f),r,0,Math.PI/2,-Math.PI/2,f<.5);tp.closePath();
      lit.addPath(tp,new DOMMatrix([dx,dy,-sd*dy,sd*dx,x,y]));
      g.save();g.clip(lit);
      g.fillStyle=rad(g,x-r*.3,y-r*.3,0,r*1.2,[[0,shade(c,.15)],[.7,c],[1,shade(c,-.15)]]);g.fillRect(x-r,y-r,r*2,r*2);
      g.fillStyle=rgba(shade(c,-.35),.35);for(let i=0;i<7;i++){const a=h3(i,1,31)*TAU,d=h3(i,2,31)*r*.7;g.beginPath();g.ellipse(x+Math.cos(a)*d,y+Math.sin(a)*d,r*(.12+h3(i,3,31)*.2),r*(.1+h3(i,4,31)*.15),a,0,TAU);g.fill();}
      // The light falls off toward the terminator.
      g.fillStyle=lin(g,x+dx*r,y+dy*r,x-dx*r,y-dy*r,[[0,'rgba(0,0,0,0)'],[Math.max(.05,f*.85),'rgba(0,0,0,0)'],[Math.min(1,f*1.05+.05),`rgba(0,0,0,${(.35-.25*f).toFixed(3)})`],[1,`rgba(0,0,0,${(.35-.25*f).toFixed(3)})`]]);g.fillRect(x-r,y-r,r*2,r*2);
      g.restore();}}
  // The far layer, faded toward the sky by the distance and the smog.
  for(const tw of FARL){if(tw.x>VW+10||tw.x+tw.w<-10)continue;const top=topOf({...tw,roof:'flat'}),y0=Y(top),y1=Y(BB+4);
    g.fillStyle=mixC(tw.col,s2,.3);g.fillRect(tw.x,y0,tw.w,y1-y0);g.fillStyle=lin(g,0,y0,0,y1,[[0,rgba(s2,.15)],[1,rgba(MOOD.haze,.35*MOOD.smog+.12)]]);g.fillRect(tw.x,y0,tw.w,y1-y0);
    for(let yy=top-2;yy>BB+8;yy-=2.2)for(let xx=tw.x+1;xx<tw.x+tw.w-1;xx+=1.8){const hsh=h3(xx*2.3,yy*1.3,tw.s);if(hsh<tw.lit){g.fillStyle=hsh<tw.lit*.4?'rgba(255,200,140,.45)':'rgba(170,220,255,.4)';g.fillRect(xx,Y(yy),.7,.9);}}}
  // The nearer towers, with their rooftops.
  for(const tw of TOW){if(tw.x>VW+10||tw.x+tw.w<-10)continue;
    const top=topOf(tw),y0=Y(top),y1=Y(BB+4),rh=tw.rh;g.fillStyle=tw.col;g.fillRect(tw.x,y0,tw.w,y1-y0);
    if(tw.roof==='step'){g.fillRect(tw.x+tw.w*.18,Y(top+rh*.5),tw.w*.64,rh*.5);g.fillRect(tw.x+tw.w*.34,Y(top+rh),tw.w*.32,rh*.5);}
    else if(tw.roof==='spire'){poly(g,[[tw.x+tw.w*.35,y0],[tw.x+tw.w*.65,y0],[tw.x+tw.w*.5,Y(top+rh)]]);g.fill();}
    else if(tw.roof==='slant'){poly(g,[[tw.x,y0],[tw.x+tw.w,y0],[tw.x+tw.w,Y(top+rh*.4)]]);g.fill();}
    g.fillStyle=shade(tw.col,.12);g.fillRect(tw.x,y0,tw.w*.18,y1-y0);
    g.fillStyle=lin(g,0,y0,0,y1,[[0,rgba(MOOD.haze,0)],[1,rgba(MOOD.haze,.28*MOOD.smog+.08)]]);g.fillRect(tw.x,y0,tw.w,y1-y0);
    for(let yy=top-3;yy>BB+8;yy-=2.8)for(let xx=tw.x+1.4;xx<tw.x+tw.w-1.4;xx+=2.4){const hsh=h3(xx*3.1,yy*1.7,tw.s);if(hsh<tw.lit){g.fillStyle=hsh<tw.lit*.25?'#ff7ab0':hsh<tw.lit*.5?'#7af0ff':'#ffcf7a';g.globalAlpha=.55+h3(xx,yy,3)*.4;g.fillRect(xx,Y(yy),1,1.3);g.globalAlpha=1;}}
    if(tw.strip){g.fillStyle=tw.strip;g.fillRect(tw.x+tw.w-1.2,y0+2,.5,y1-y0-2);g.globalCompositeOperation='lighter';g.fillStyle=lin(g,tw.x+tw.w-4,0,tw.x+tw.w+3,0,[[0,rgba(tw.strip,0)],[.5,rgba(tw.strip,.25)],[1,rgba(tw.strip,0)]]);g.fillRect(tw.x+tw.w-4,y0,7,y1-y0);g.globalCompositeOperation='source-over';}
    if(tw.roof==='crown'){g.globalCompositeOperation='lighter';g.fillStyle=rgba(tw.crown,.85);g.fillRect(tw.x,y0,tw.w,.5);g.fillRect(tw.x,y0+2.2,tw.w,.4);g.fillStyle=lin(g,0,y0-3,0,y0+5,[[0,rgba(tw.crown,0)],[.5,rgba(tw.crown,.22)],[1,rgba(tw.crown,0)]]);g.fillRect(tw.x-2,y0-3,tw.w+4,8);g.globalCompositeOperation='source-over';}
    if(tw.ant){g.strokeStyle='#0c0a18';g.lineWidth=.5;g.beginPath();g.moveTo(tw.x+tw.w*.5,y0);g.lineTo(tw.x+tw.w*.5,y0-8);g.stroke();}}
  // The screen's frame. What it shows is drawn each frame.
  g.fillStyle='#08060e';g.fillRect(BILL.x-1,Y(BILL.y+BILL.h)-1,BILL.w+2,BILL.h+2);
  // City glow at the horizon.
  g.globalCompositeOperation='lighter';g.fillStyle=lin(g,0,Y(HZ+40),0,Y(HZ-4),[[0,rgba(MOOD.haze,0)],[1,rgba(MOOD.haze,.22)]]);g.fillRect(0,Y(HZ+40),VW,44);g.globalCompositeOperation='source-over';
  // A few stars in the open sky twinkle. Pick them now that the skyline is known.
  TWK=[];if(NIGHT.stars)for(let i=0;i<260&&TWK.length<26;i++){const x=h3(i,1,7)*VW,yu=HZ+12+h3(i,2,7)*(VH-HZ);if(h3(i,8,7)<.3&&yu<VH-2&&skyAt(x,.5)<yu-1)TWK.push([x,yu,h3(i,9,7)*50]);}
}

/* ---------- painting the street across the road ---------- */
function paintNear(g){
  g.setTransform(OS,0,0,OS,0,0);g.clearRect(0,0,VW,VH);
  for(const b of BLD){if(b.x>VW+10||b.x+b.w<-10)continue;
    const y0=Y(b.top),y1=Y(BB),gy=Y(BB+b.gh);
    g.fillStyle=b.col;g.fillRect(b.x,y0,b.w,y1-y0);
    // Cel shade: one hard shadow band down the side away from the street lights, and a lit cornice.
    g.fillStyle=shade(b.col,-.35);g.fillRect(b.x+b.w*.82,y0,b.w*.18,y1-y0);
    g.fillStyle=shade(b.col,.25);g.fillRect(b.x,y0,b.w,1);
    g.strokeStyle=INK;g.lineWidth=.3;g.strokeRect(b.x,y0,b.w,y1-y0);
    g.fillStyle=shade(b.col,-.2);for(let f=1;f<=b.fl;f++)g.fillRect(b.x,Y(BB+b.gh+f*b.fh)-.3,b.w,.6);
    // Air conditioners, a fire escape, and a tag sprayed on the ground floor.
    for(let i=0;i<b.ac;i++){const ax=b.x+3+h3(i,b.s,1)*(b.w-9),ay=Y(BB+b.gh+Math.floor(h3(i,b.s,2)*b.fl)*b.fh+1.2);g.fillStyle='#3a3a4a';g.fillRect(ax,ay-3,5,3);g.strokeStyle=INK;g.lineWidth=.2;g.strokeRect(ax,ay-3,5,3);g.fillStyle='#22222e';g.fillRect(ax+.6,ay-2.4,2,1.8);}
    if(b.fire&&b.fl>=2){const fx=b.x+b.w*.55,fw=Math.min(16,b.w*.35);g.strokeStyle='#0a0810';g.lineWidth=.35;
      for(let f=1;f<b.fl;f++){const fy=Y(BB+b.gh+f*b.fh);g.strokeRect(fx,fy-.5,fw,.5);g.beginPath();g.moveTo(fx+(f%2?fw-1:1),fy);g.lineTo(fx+(f%2?1:fw-1),fy-b.fh+.5);g.stroke();for(let r=fx;r<fx+fw;r+=1.2){g.beginPath();g.moveTo(r,fy-.5);g.lineTo(r,fy-2.4);g.stroke();}g.beginPath();g.moveTo(fx,fy-2.4);g.lineTo(fx+fw,fy-2.4);g.stroke();}}
    // Ground floor.
    const sx=b.x+2,sw=b.w-4,sh=b.gh-6;
    if(b.kind==='shop'){const c=b.shop[1];
      g.fillStyle=lin(g,0,gy+5,0,y1,[[0,mixC(c,'#ffffff',.55)],[1,mixC(c,'#1a1020',.25)]]);g.fillRect(sx,gy+5,sw,sh+1);
      g.fillStyle=rgba('#120c1c',.55);for(let i=0;i<3;i++){const px=sx+2+h3(i,b.s,5)*(sw-8);g.fillRect(px,y1-4-h3(i,b.s,6)*3,2+h3(i,b.s,7)*3,4+h3(i,b.s,6)*3);}
      g.fillStyle='#0c0812';g.fillRect(sx,gy,sw,4.6);g.fillRect(sx+sw*.72,gy+5,.6,sh+1);
      g.strokeStyle=INK;g.lineWidth=.3;g.strokeRect(sx,gy+5,sw,sh+1);}
    else if(b.kind==='shutter'){g.fillStyle='#4a4a5a';g.fillRect(sx,gy+3,sw,sh+3);g.fillStyle='#34343e';for(let yy=gy+3.6;yy<y1;yy+=1)g.fillRect(sx,yy,sw,.3);
      if(b.tag){g.strokeStyle=b.tag;g.lineWidth=.55;g.beginPath();const tx=sx+sw*.2,ty=gy+8;for(let i=0;i<9;i++)g.lineTo(tx+i*sw*.07,ty+Math.sin(i*1.9+b.s)*2.2+h3(i,b.s,8)*1.5);g.stroke();}}
    else{g.fillStyle='#0a0c16';g.fillRect(sx,gy+3,sw,sh+3);g.fillStyle=rgba('#7af0ff',.08);g.fillRect(sx,gy+3,sw*.3,sh+3);}
    // Unlit windows. Lit ones are drawn each frame, so they can come and go.
    g.fillStyle='#0a0b16';for(const w of WINS)if(w.x>=b.x&&w.x<b.x+b.w){g.fillRect(w.x,Y(w.y+w.h),w.w,w.h);}
  }
  // Far pavement, road and the near pavement outside the cafe.
  g.fillStyle='#1c1a2a';g.fillRect(0,Y(BB),VW,BB-FKERB);
  g.fillStyle='#2e2a3e';g.fillRect(0,Y((FKERB+.2)),VW,.4);
  g.fillStyle=lin(g,0,Y(FKERB),0,Y(KERB),[[0,'#11121e'],[1,'#191a2a']]);g.fillRect(0,Y(FKERB),VW,FKERB-KERB);
  g.fillStyle='#d8d4c0';for(let x=-(h3(1,2,3)*12);x<VW;x+=12){g.fillRect(x,Y(LANE),5,.28);}
  g.fillStyle='#8a8670';g.fillRect(0,Y(FKERB-.4),VW,.18);
  g.fillStyle='#3a3648';g.fillRect(0,Y(KERB),VW,1);
  g.fillStyle=lin(g,0,Y(KERB-1),0,Y(SILL-2),[[0,'#25233a'],[1,'#33304a']]);g.fillRect(0,Y(KERB-1),VW,KERB-1-SILL+2);
  g.fillStyle='#1e1c2e';for(let yy=KERB-2.2,k=1.4;yy>SILL;yy-=k,k*=1.18)g.fillRect(0,Y(yy),VW,.2);
  // The cafe's own light on the pavement under each pane.
  g.globalCompositeOperation='lighter';
  g.fillStyle=lin(g,0,Y(KERB-1),0,Y(SILL),[[0,'rgba(255,170,80,0)'],[1,'rgba(255,170,80,.22)']]);g.fillRect(0,Y(KERB-1),XWR,KERB-1-SILL);
  // Shops spill their light on the far pavement.
  for(const b of BLD)if(b.kind==='shop'&&b.x<VW+10&&b.x+b.w>-10){g.fillStyle=rgba(b.shop[1],.3);g.fillRect(b.x+2,Y(BB),b.w-4,BB-(FKERB+.2));}
  g.globalCompositeOperation='source-over';
}

// Reflections in the wet road, faded in with the rain.
function paintWet(g){
  g.setTransform(OS,0,0,OS,0,0);g.clearRect(0,0,VW,VH);g.globalCompositeOperation='lighter';
  const y0=Y(FKERB),y1=Y(KERB);
  for(const b of BLD)if(b.kind==='shop'&&b.x<VW+10&&b.x+b.w>-10){g.fillStyle=lin(g,0,y0,0,y1,[[0,rgba(b.shop[1],.4)],[1,rgba(b.shop[1],0)]]);g.fillRect(b.x+3,y0,b.w-6,y1-y0);}
  for(const s of SIGNS){if(s.x<-10||s.x>VW+10)continue;const w=s.kind==='blade'?2.4:s.word.length*s.size*.7;
    g.fillStyle=lin(g,0,y0,0,y1,[[0,rgba(s.col,.5)],[1,rgba(s.col,0)]]);for(let i=0;i<3;i++)g.fillRect(s.x-w/2+i*w/3+.3,y0,w/3-.6,(y1-y0)*(.6+h3(i,s.x,1)*.4));}
  g.globalCompositeOperation='source-over';
}

// A neon sign, glow and all, baked once. vertical stacks the letters.
function bakeSign(word,col,size,vertical,mirror,px){
  const fs=size*px,pad=fs*1.1;
  const tw=vertical?fs*1.25:word.length*fs*.72+fs*.2,th=vertical?word.length*fs*1.15:fs*1.2;
  const[c,g]=mk(tw+pad*2,th+pad*2);
  g.translate(pad,pad);if(mirror){g.translate(tw,0);g.scale(-1,1);}
  g.font=`700 ${fs}px ${SANS}`;g.textAlign='center';g.textBaseline='middle';
  const put=(fn)=>{if(vertical)for(let i=0;i<word.length;i++)fn(word[i],tw/2,fs*.6+i*fs*1.15);else fn(word,tw/2,th/2);};
  if(!vertical){g.fillStyle='rgba(10,6,16,.7)';rrect(g,-fs*.2,0,tw+fs*.4,th,fs*.15);g.fill();}
  else{g.fillStyle='rgba(10,6,16,.75)';rrect(g,0,0,tw,th,fs*.15);g.fill();}
  g.shadowColor=col;g.shadowBlur=fs*.9;g.lineJoin='round';g.lineWidth=fs*.12;g.strokeStyle=col;
  put((s,x,y)=>g.strokeText(s,x,y));g.shadowBlur=fs*.4;put((s,x,y)=>g.strokeText(s,x,y));
  g.shadowBlur=0;g.lineWidth=fs*.045;g.strokeStyle=mixC(col,'#ffffff',.75);put((s,x,y)=>g.strokeText(s,x,y));
  return{c,w:c.width/px,h:c.height/px};
}

/* ---------- painting the inside of the cafe ---------- */
// The ceiling beam, the window frame, the sill and the walnut counter, with holes where the glass is.
function paintIn(g){
  g.setTransform(S,0,0,S,0,0);g.clearRect(0,0,VW,VH);
  const top=Y(WTOP),bot=Y(SILL);
  // A timber beam over the glass, lit from below by the bulbs.
  g.fillStyle=lin(g,0,0,0,top,[[0,'#0c0705'],[.7,'#1e130c'],[1,'#3a2416']]);g.fillRect(0,0,VW,top);
  g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=.12;for(let i=0;i<8;i++){const yy=top*(i+.5)/8;g.beginPath();g.moveTo(0,yy);for(let x=0;x<=VW;x+=4)g.lineTo(x,yy+(noise(x*.05+i*7)-.5)*.8);g.stroke();}
  // The frame: a top rail and slim steel mullions across the whole width.
  g.fillStyle=lin(g,0,top-.6,0,top+2.4,[[0,'#08060a'],[.55,'#18131a'],[1,'#3a2c28']]);g.fillRect(0,top-.6,VW,3);
  const n=Math.max(1,Math.round(VW/58));
  for(let i=1;i<n;i++){const x=VW*i/n;g.fillStyle=lin(g,x-1.1,0,x+1.1,0,[[0,rgba(RIM,.3)],[.18,'#141016'],[.7,'#221a1c'],[1,'rgba(255,170,90,.4)']]);g.fillRect(x-1.1,top+2.4,2.2,bot-top-2.4);}
  // The glass: a faint tint and a few broad, soft reflections.
  g.fillStyle='rgba(30,50,70,.1)';g.fillRect(0,top+2.4,VW,bot-top-2.4);
  g.save();g.beginPath();g.rect(0,top+2.4,VW,bot-top-2.4);g.clip();g.globalCompositeOperation='lighter';
  for(let i=0;i<n;i++){const x=VW*(i+.35)/n;g.fillStyle=lin(g,x-14,0,x+10,0,[[0,'rgba(255,255,255,0)'],[.5,'rgba(255,255,255,.03)'],[1,'rgba(255,255,255,0)']]);poly(g,[[x,top],[x+12,top],[x-12,bot],[x-24,bot]]);g.fill();}
  g.restore();
  // The sill: a rounded wooden ledge.
  g.fillStyle=lin(g,0,Y(SILL+.9),0,Y(SILL-1.6),[[0,'#1e1008'],[.3,'#6a3e22'],[.45,'#a8704a'],[.6,'#5a3018'],[1,'#2a160a']]);g.fillRect(0,Y(SILL+.9),VW,2.5);
  // The counter: walnut boards running along the window, wider apart as they come toward you. Every pixel of the wood
  // is worked out from the board it falls on: long wandering streaks of grain, fine fibre, open pores, a tone of its
  // own for each board, and bevelled seams. The grain stretches as it comes toward you, as it would in perspective.
  const cTop=Y(SILL-1.6),seams=[];for(let yy=SILL-1.6,k=2.2;yy>-3;yy-=k,k*=1.28)seams.push(yy);
  {const y0=Math.floor(cTop*S),H=CH-y0,sc2=Math.min(1,Math.sqrt(1.4e6/(CW*H))),tw=Math.ceil(CW*sc2),th=Math.ceil(H*sc2);
    const[wc,wx]=mk(tw,th),id=wx.createImageData(tw,th),d=id.data,DK=[38,19,9],MD=[94,52,26],LT=[140,86,46];
    for(let py=0;py<th;py++){
      const yu=VH-(y0+py/sc2)/S;let j=0;while(j+1<seams.length&&yu<seams[j+1])j++;
      const ya=seams[j],yb=j+1<seams.length?seams[j+1]:ya-6,v=clamp((ya-yu)/(ya-yb),0,1),w=v*6,per=1/Math.max(.35,sc(Math.max(0,yu)));
      const tone=.84+h3(j,1,2)*.3,warm=h3(j,2,2)*.12,edge=Math.min(v,1-v)*(ya-yb)*S*sc2,lum=.5+.55*sstep(-2,SILL*.7,yu);
      for(let px=0;px<tw;px++){
        const ux=(px/sc2/S-VW/2)*per+j*37.3,dist=vn2(ux*.035,w*.55,j)*2.4+vn2(ux*.12,w*1.3,j+7)*.7;
        let k=.5+.5*Math.sin((w*1.9+dist)*TAU*.8);k=k*k*(3-2*k);
        const fib=vn2(ux*.8,w*13,j+3)-.5,pore=vn2(ux*2.4,w*34,j+11);
        let m=(.35+.55*k)*tone+fib*.12;if(pore>.8)m-=(pore-.8)*1.6;
        let r,gg,b;if(m<.5){const f=m/.5;r=DK[0]+(MD[0]-DK[0])*f;gg=DK[1]+(MD[1]-DK[1])*f;b=DK[2]+(MD[2]-DK[2])*f;}else{const f=Math.min(1,(m-.5)/.5);r=MD[0]+(LT[0]-MD[0])*f;gg=MD[1]+(LT[1]-MD[1])*f;b=MD[2]+(LT[2]-MD[2])*f;}
        let L=lum*(1+warm);
        // Seams: a dark gap, then the bevel of the nearer board catching the light.
        if(edge<1.1)L*=.35;else if(edge<2.4&&v<.5)L*=1.25;
        const o=(py*tw+px)*4;d[o]=r*L;d[o+1]=gg*L*(1-warm*.3);d[o+2]=b*L*(1-warm*.5);d[o+3]=255;}}
    wx.putImageData(id,0,0);g.save();g.setTransform(1,0,0,1,0,0);g.imageSmoothingQuality='high';g.drawImage(wc,0,y0,CW,H);g.restore();}
  // Varnish: the window's glow along the back of the counter, and the bulbs' reflections.
  g.globalCompositeOperation='lighter';
  g.fillStyle=lin(g,0,cTop,0,Y(SILL-12),[[0,'rgba(170,190,230,.14)'],[1,'rgba(170,190,230,0)']]);g.fillRect(0,cTop,VW,10.4);
  if(!DARK)for(const b of BULBS){const x=b.f*VW;g.save();g.translate(x,Y(SILL-6));g.scale(1,2.6);g.fillStyle=rad(g,0,0,0,4,[[0,'rgba(255,190,110,.2)'],[1,'rgba(255,190,110,0)']]);g.fillRect(-4,-4,8,8);g.restore();
    g.fillStyle=rad(g,x,Y(SILL-10),0,22,[[0,'rgba(255,150,60,.12)'],[1,'rgba(255,150,60,0)']]);g.fillRect(x-22,Y(SILL-10)-22,44,44);}
  for(const s of SIGNS){if(s.x<-6||s.x>VW+6)continue;const w=s.kind==='blade'?2:Math.min(9,s.word.length*1.6);g.fillStyle=lin(g,0,cTop,0,cTop+9,[[0,rgba(s.col,.1)],[1,rgba(s.col,0)]]);g.fillRect(s.x-w/2,cTop,w,9);}
  g.globalCompositeOperation='source-over';
  g.fillStyle=lin(g,0,Y(10),0,VH,[[0,'rgba(10,4,2,0)'],[1,'rgba(10,4,2,.45)']]);g.fillRect(0,Y(10),VW,10);
  if(DARK){g.globalCompositeOperation='source-atop';g.fillStyle='rgba(6,4,10,.45)';g.fillRect(0,0,VW,VH);g.globalCompositeOperation='source-over';}
}

/* ---------- people, dogs and cars outside ---------- */
// One leg's walking cycle, u from 0 to 1. For the first 60% the foot is planted and the leg sweeps back at a steady rate
// while the body passes over it, then the knee lifts and the leg swings forward. Returns its angle from the vertical
// (forward is positive) and how far the knee bends.
function gl(u,A,f=.6,bm=.95){u=((u%1)+1)%1;if(u<f)return[A-2*A*u/f,0];const v=(u-f)/(1-f),e=v*v*(3-2*v);return[-A+2*A*e,Math.sin(v*Math.PI)*bm];}
// A planted foot sweeps 2 L sin(A) in the stance part f of a cycle, so for the foot not to slide over the ground the
// phase turns at pi f speed / (L sin A), with L the leg's length. Walking keeps a foot down 60% of the time, running 36%.
const gaitRate=(L,A,f=.6)=>Math.PI*f/(L*Math.sin(A));
// A tail as a chain of short segments from its root. A wave runs from root to tip and swings the tip most.
function tailChain(root,base,seg,amp,freq,lag,ph){const pts=[root.slice()];let x=root[0],y=root[1];
  for(let i=0;i<base.length;i++){const f=i/(base.length-1),a=base[i]+Math.sin(t*freq-i*lag+ph)*amp*(.2+f*.8);x+=Math.cos(a)*seg;y+=Math.sin(a)*seg;pts.push([x,y]);}return pts;}
const COATS=['#1a1626','#22182e','#141c24','#2a1a1a','#1c2420','#2e2a36','#3a1a2a','#16222e'];
const SKINS=['#e8b896','#c88a64','#8a5a3a','#f0c8a8','#5a3a28','#d8a07a'];
const HAIRS=['#1a1420','#f3e600','#ff2a7a','#2af0ff','#e8e0d8','#6a3a20','#b14bff','#2a1a10'];
// Dog breeds, by build: height to the top of the head in metres, and in units of that height the leg length, half the
// body's length and depth, head radius and snout. Their usual gait, how often they turn up, ears, tail and colours.
const BREEDS=[
  {name:'terrier',h:[.3,.38],leg:40,bl:30,bh:13,hr:12,sn:8,ear:'up',tail:'up',cols:[['#e8dcc0','#8a6a4a'],['#2a2228','#8a6a4a'],['#d8d0c0','#d8d0c0']],w:1.6},
  {name:'corgi',h:[.27,.32],leg:22,bl:44,bh:16,hr:14,sn:9,ear:'up',tail:'down',cols:[['#d8863a','#f4ece0']],socks:true,w:1},
  {name:'dachshund',h:[.22,.27],leg:18,bl:48,bh:14,hr:12,sn:14,ear:'flop',tail:'down',cols:[['#7a3a1a','#7a3a1a'],['#2a1a14','#a8642a']],w:.8},
  {name:'labrador',h:[.55,.62],leg:46,bl:40,bh:16,hr:14,sn:11,ear:'flop',tail:'wag',cols:[['#e8c48a','#e8c48a'],['#1e1a1c','#1e1a1c'],['#6a3e22','#6a3e22']],w:2},
  {name:'shepherd',h:[.58,.66],leg:46,bl:42,bh:16,hr:14,sn:12,ear:'up',tail:'down',cols:[['#a8743a','#2a1e18']],saddle:true,w:1.4},
  {name:'husky',h:[.52,.6],leg:45,bl:40,bh:16,hr:14,sn:10,ear:'up',tail:'curl',cols:[['#8a8e96','#ece8e0'],['#2a2a30','#ece8e0']],socks:true,w:1.4},
  {name:'greyhound',h:[.68,.76],leg:56,bl:38,bh:11,hr:11,sn:15,ear:'flop',tail:'down',cols:[['#9a9aa4','#9a9aa4'],['#c8a07a','#c8a07a']],w:.6},
  {name:'pug',h:[.28,.32],leg:30,bl:30,bh:16,hr:15,sn:3,ear:'flop',tail:'curl',cols:[['#d8b88a','#2a2228']],w:.8}
];
// Gaits: swing in radians, stance fraction, knee bend, speed in metres a second, and when each leg starts its cycle
// (near or far, front or hind). A walk moves one leg after another, a trot moves diagonal pairs, a gallop bounds.
const GAITS={walk:{A:.36,f:.65,b:.8,sp:[.9,1.4],o:{nf:.75,nh:.5,ff:.25,fh:0}},trot:{A:.42,f:.5,b:.95,sp:[1.7,3],o:{nf:0,nh:.5,ff:.5,fh:0}},gallop:{A:.62,f:.32,b:1.3,sp:[5,8.5],o:{nf:.55,nh:.08,ff:.45,fh:0}}};
// A dog of some breed. With no speed it picks its own gait and pace; on a lead it keeps to its owner's.
function makeDog(u,spd){const B=wpick(BREEDS.map(b=>[b,b.w])),hm=rr(B.h[0],B.h[1]),c=pick(B.cols),sz=clamp(Math.sqrt(hm/.55),.65,1.1);let G;
  if(spd==null){G=GAITS[wpick([['walk',.35],['trot',.53],['gallop',B.name==='greyhound'?.5:.12]])];spd=rr(G.sp[0],G.sp[1])*(G===GAITS.gallop?1:sz);}
  else G=spd<1.3?GAITS.walk:spd<3.6?GAITS.trot:GAITS.gallop;
  return{B,G,h:hm*u,col:c[0],col2:c[1],seed:rr(0,9),ph:rr(0,TAU),sp:spd*u};}
// Paces for people in metres a second. Someone who stands around walks to a spot, waits a while and goes on.
const PACES={stroll:[.7,1],walk:[1.05,1.5],brisk:[1.5,1.9],run:[2.6,4.2],stand:[.9,1.3]};
function newWalker(near,dog){
  const lane=near?NWK:FWK,u=upm(lane),dir=chance(.5)?1:-1,mode=wpick([['stroll',2],['walk',5],['brisk',2],['run',.9],['stand',1.2]]),run=mode==='run';
  const p={kind:'person',near,lane,u,dir,mode,run,h:rr(1.58,1.92)*u,sp:rr(PACES[mode][0],PACES[mode][1])*u,ph:rr(0,TAU),coat:pick(COATS),pants:pick(['#141218','#1e1e2a','#2a2420','#0e1218']),skin:pick(SKINS),hair:pick(HAIRS),trim:pick(NEON),rim:pick(NEON),
    long:!run&&chance(.35),hood:chance(run?.5:.22),visor:chance(.2),implant:chance(.3),bag:!run&&chance(.25),phone:!run&&chance(mode==='stand'?.6:.22),umb:!run&&raining&&chance(.7),umbCol:pick(NEON),stop:0,look:0};
  p.x=dir>0?-p.h*.6-4:VW+p.h*.6+4;
  if(mode==='stand'){p.standAt=rr(VW*.15,VW*.85);p.standFor=rr(6,25);}
  if(dog&&!run)p.dog=makeDog(u,p.sp/u);
  walkers.push(p);stats.people++;return p;}
function newDog(near){
  const lane=near?NWK:FWK,u=upm(lane),dir=chance(.5)?1:-1,D=makeDog(u);
  const d={kind:'dog',near,lane,u,dir,...D,rim:pick(NEON),stop:0,sniffed:false,looked:false};
  d.x=dir>0?-d.h*2:VW+d.h*2;walkers.push(d);return d;}

// A person in profile, facing +x, 100 units tall. Backlit, with a rim of neon round their edges.
function personParts(g,p,col,skin,hair,lw){
  const moving=p.stop<=0,u=p.ph/TAU,GA=p.run?[.62,.36,1.4]:[.42,.6,.95],near=moving?gl(u,...GA):[0,0],far=moving?gl(u+.5,...GA):[0,0];
  const hip=[0,-49],legs=[far,near];
  const legPts=([a,b])=>{const k=[hip[0]+Math.sin(a)*24,hip[1]+Math.cos(a)*24],f=[k[0]+Math.sin(a-b)*25,k[1]+Math.cos(a-b)*25];return[hip,k,f,[f[0]+5,f[1]]];};
  limb(g,legPts(legs[0]),7,col.pants2,lw);
  const ar=-near[0]*(p.run?1.3:1.05),sh=[2,-80],bendA=p.run?1.5:.35;
  const armPts=a=>{const e=[sh[0]+Math.sin(a)*16,sh[1]+Math.cos(a)*16],h=[e[0]+Math.sin(a+bendA)*15,e[1]+Math.cos(a+bendA)*15];return[sh,e,h];};
  if(!p.umb&&!p.phone)limb(g,armPts(-ar),5.5,col.coat2,lw);
  limb(g,legPts(legs[1]),7,col.pants,lw);
  // Body: a jacket, longer for a coat.
  g.beginPath();g.moveTo(-9,-84);g.quadraticCurveTo(-11,-70,-9,p.long?-30:-46);g.lineTo(p.long?13:10,p.long?-30:-46);g.quadraticCurveTo(12,-70,10,-84);g.quadraticCurveTo(1,-88,-9,-84);
  g.fillStyle=col.coat;g.fill();if(lw){g.strokeStyle=INK;g.lineWidth=lw;g.stroke();}
  if(col.trim){g.strokeStyle=col.trim;g.lineWidth=1.3;g.beginPath();g.moveTo(9.5,-82);g.lineTo(p.long?12.5:9.8,p.long?-32:-48);g.stroke();}
  if(p.bag){g.fillStyle=col.coat2;g.fillRect(-12,-62,7,9);g.strokeStyle=col.coat2;g.lineWidth=1;g.beginPath();g.moveTo(-8,-62);g.lineTo(6,-84);g.stroke();}
  // Head.
  g.beginPath();g.arc(3,-92,7.6,0,TAU);g.fillStyle=skin;g.fill();if(lw){g.strokeStyle=INK;g.lineWidth=lw;g.stroke();}
  g.beginPath();if(p.hood){g.arc(2,-92,9.4,Math.PI*.55,Math.PI*2.15);g.closePath();g.fillStyle=col.coat;}else{g.arc(2.2,-93.4,8,Math.PI*.82,Math.PI*1.95);g.quadraticCurveTo(-1,-90,-5,-84);g.closePath();g.fillStyle=hair;}g.fill();
  if(p.visor&&col.trim){g.fillStyle=col.trim;g.fillRect(4,-95,7,2.2);}
  if(p.implant&&col.trim){g.fillStyle=col.trim;g.fillRect(6.5,-90,.9,3.6);}
  // The near arm: swinging, or holding an umbrella or a phone.
  if(p.umb){limb(g,[sh,[8,-76],[11,-86]],5.5,col.coat,lw);g.strokeStyle='#0a0810';g.lineWidth=1.2;g.beginPath();g.moveTo(11,-84);g.lineTo(11,-122);g.stroke();
    g.beginPath();g.moveTo(-17,-112);g.quadraticCurveTo(11,-140,39,-112);g.quadraticCurveTo(11,-118,-17,-112);g.fillStyle=col.umb;g.fill();if(col.umbLed){g.strokeStyle=col.umbLed;g.lineWidth=1.4;g.beginPath();g.moveTo(-17,-112);g.quadraticCurveTo(11,-118,39,-112);g.stroke();}}
  else if(p.phone){limb(g,[sh,[9,-70],[13,-84]],5.5,col.coat,lw);g.fillStyle=col.phone||col.coat2;g.fillRect(11.5,-90,3,5.5);}
  else limb(g,armPts(ar),5.5,col.coat,lw);
}
function drawPerson(g,p){
  const k=p.h/100,gy=Y(p.lane);
  // The body rides highest over a straight planted leg and drops a little between steps.
  // Running, both feet leave the ground between strides, so the body lifts instead. Standing, it sways a little.
  const u=p.ph/TAU,uf=((u%1)+1)%1,GA=p.run?[.62,.36]:[.42,.6],down=uf<GA[1]?gl(u,...GA)[0]:((uf+.5)%1)<GA[1]?gl(u+.5,...GA)[0]:null;
  const bob=p.stop>0?0:down===null?3:-49*(1-Math.cos(down)),sway=p.stop>0&&p.stopKind==='idle'?Math.sin(t*.7+p.ph)*.8:0;
  g.save();g.translate(p.x,gy);g.scale(k*p.dir,k);g.translate(sway,-bob);if(p.run&&p.stop<=0)g.rotate(.13);
  const dim=p.near?.25:.45;
  // Rim pass: the whole figure in the backlight colour, then the figure itself nudged down and forward over it.
  const R0={coat:p.rim,coat2:p.rim,pants:p.rim,pants2:p.rim,trim:null,umb:p.rim,umbLed:null,phone:p.rim};
  if(p.umb){g.save();g.translate(-1.6,-1.2);personParts(g,p,R0,p.rim,p.rim,0);g.restore();}
  else{g.save();g.translate(-1.4,-1.1);personParts(g,p,R0,p.rim,p.rim,0);g.restore();}
  const C={coat:shade(p.coat,-dim*.4),coat2:shade(p.coat,-dim-.2),pants:shade(p.pants,-dim*.3),pants2:shade(p.pants,-dim-.2),trim:p.trim,umb:shade(p.umbCol,-.55),umbLed:p.umbCol,phone:'#c8f0ff'};
  personParts(g,p,C,mixC(shade(p.skin,-.35),p.rim,.12),shade(p.hair,-.25),p.near?.9:0);
  g.restore();
  // A phone lights its owner's face.
  if(p.phone){g.save();g.globalCompositeOperation='lighter';glow(g,p.x+13*k*p.dir,gy-87*k-bob*k,9*k,'#9ad8ff',.35);g.restore();}
  if(p.umb){g.save();g.globalCompositeOperation='lighter';g.strokeStyle=rgba(p.umbCol,.35);g.lineWidth=3*k;g.beginPath();const ux=p.x+11*k*p.dir,uy=gy-115*k-bob*k;g.moveTo(ux-28*k,uy+3*k);g.quadraticCurveTo(ux,uy-3*k,ux+28*k,uy+3*k);g.stroke();g.restore();}
  if(p.dog){const dx=p.x+p.dir*(p.h*.42),dk=p.dog.h/100,B=p.dog.B,cx=dx+p.dir*dk*(B.bl+B.hr*.2),cy=gy-dk*(B.leg+B.bh*1.5),hx=p.x+p.dir*7*k,hy=gy-48*k-bob*k;
    g.strokeStyle=rgba(p.rim,.55);g.lineWidth=Math.max(.15,.6*k);g.beginPath();g.moveTo(hx,hy);g.quadraticCurveTo((hx+cx)/2,Math.max(hy,cy)+3*k,cx,cy);g.stroke();
    drawDogAt(g,p.dog,dx,gy,p.dir,p.near,p.rim,p.stop<=0);}
}
function dogParts(g,d,col,lw,moving){
  const B=d.B,G=d.G,L=B.leg,bl=B.bl,bh=B.bh,hr=B.hr,u=d.ph/TAU,by=-(L+bh*.55),gal=G===GAITS.gallop,o=G.o,lwL=Math.max(5,hr*.55);
  const ink=()=>{if(lw){g.strokeStyle=INK;g.lineWidth=lw;g.stroke();}};
  const leg=(x,off,c,paw)=>{const[a,bd]=moving?gl(u+off,G.A,G.f,G.b):[0,0],kn=[x+Math.sin(a)*L*.5,-L+Math.cos(a)*L*.5],f=[kn[0]+Math.sin(a-bd)*L*.5,kn[1]+Math.cos(a-bd)*L*.5];
    limb(g,[[x,-L],kn,f],lwL,c,lw);g.beginPath();g.ellipse(f[0]+lwL*.3,f[1]-.5,lwL*.62,lwL*.34,0,0,TAU);g.fillStyle=paw||c;g.fill();ink();};
  leg(-bl*.72,o.fh,col.leg,col.paw?shade(col.paw,-.2):null);leg(bl*.68,o.ff,col.leg,col.paw?shade(col.paw,-.2):null);
  // The tail: up, low, curled over the back, or waving, faster when it's pleased or has stopped.
  const fast=d.stop>0||B.tail==='wag',tb={up:[-2.2,-2.05,-1.9,-1.8,-1.7,-1.65],down:[2.6,2.45,2.3,2.2,2.1,2.05],curl:[-1.9,-1.4,-.9,-.3,.3,.9],wag:[-2.8,-2.75,-2.7,-2.6,-2.5,-2.4]}[B.tail];
  const tail=tailChain([-bl*.92,by-bh*.4],tb,bl*(B.tail==='curl'?.12:.16),fast?.5:.2,fast?11:moving?4:2,.5,d.seed);
  g.beginPath();const tp=tube(tail,hr*.55,hr*.22);g.moveTo(tp[0][0],tp[0][1]);for(const q of tp)g.lineTo(q[0],q[1]);g.closePath();g.fillStyle=col.body;g.fill();ink();
  // The body, deep at the chest, pitching a little when it gallops.
  g.save();g.translate(0,by);g.rotate(moving&&gal?Math.sin(u*TAU)*.06:0);
  g.beginPath();g.moveTo(-bl,0);g.quadraticCurveTo(-bl-2,-bh,-bl*.4,-bh);g.quadraticCurveTo(bl*.4,-bh-2,bl*.85,-bh*.9);g.quadraticCurveTo(bl+4,0,bl*.8,bh*.9);g.quadraticCurveTo(0,bh*.75,-bl*.6,bh*.6);g.quadraticCurveTo(-bl-1,bh*.5,-bl,0);g.closePath();
  g.fillStyle=col.body;g.fill();ink();
  g.save();g.clip();g.fillStyle=col.mark;
  if(B.saddle){g.beginPath();g.ellipse(-bl*.1,-bh*.6,bl*.7,bh*.6,0,0,TAU);g.fill();}
  else if(d.col2!==d.col){g.beginPath();g.ellipse(bl*.55,bh*.55,bl*.45,bh*.6,0,0,TAU);g.fill();}
  g.restore();
  // Neck and head, low to the ground when it sniffs.
  const hx=bl+hr*.5,hy=-bh-hr*.6+(d.sniff?L*.55:0)+(gal?bh*.3:0);
  g.beginPath();g.moveTo(bl*.5,-bh*.75);g.lineTo(hx-hr*.5,hy-hr*.2);g.lineTo(hx+hr*.2,hy+hr*.7);g.lineTo(bl*.95,bh*.2);g.closePath();g.fillStyle=col.body;g.fill();
  g.beginPath();g.arc(hx,hy,hr,0,TAU);g.fill();ink();
  g.beginPath();g.ellipse(hx+hr*.55+B.sn*.5,hy+hr*.35,B.sn*.55+hr*.35,hr*.42,.08,0,TAU);g.fillStyle=B.name==='pug'?col.mark:col.body;g.fill();ink();
  g.fillStyle=col.ear;g.beginPath();
  if(B.ear==='up'){g.moveTo(hx-hr*.55,hy-hr*.5);g.lineTo(hx-hr*.25,hy-hr*1.75);g.lineTo(hx+hr*.25,hy-hr*.7);}else{g.moveTo(hx-hr*.7,hy-hr*.5);g.quadraticCurveTo(hx-hr*1.05,hy+hr*.8,hx-hr*.4,hy+hr*1);g.lineTo(hx+hr*.1,hy-hr*.4);}
  g.closePath();g.fill();ink();
  if(lw&&col.nose){g.fillStyle=col.nose;g.beginPath();g.arc(hx+hr*.35,hy-hr*.15,hr*.14,0,TAU);g.fill();g.beginPath();g.arc(hx+hr*.55+B.sn+hr*.3,hy+hr*.2,hr*.2,0,TAU);g.fill();}
  g.restore();
  leg(-bl*.6,o.nh,col.near,col.paw);leg(bl*.78,o.nf,col.near,col.paw);
}
function drawDogAt(g,d,x,gy,dir,near,rim,moving){
  const k=d.h/100;g.save();g.translate(x,gy);g.scale(k*dir,k);
  g.save();g.translate(-1.8,-1.8);dogParts(g,d,{body:rim,leg:rim,ear:rim,near:rim,mark:rim,paw:null,nose:null},0,moving);g.restore();
  const dim=near?.3:.5;
  dogParts(g,d,{body:shade(d.col,-dim),leg:shade(d.col,-dim-.18),near:shade(d.col,-dim),ear:shade(d.B.ear==='flop'?d.col:d.col,-dim-.25),mark:shade(d.col2,-dim),paw:d.B.socks?shade(d.col2,-dim):null,nose:'#0a0810'},near?1.4:0,moving);
  g.restore();}
function drawWalker(g,p){if(p.kind==='dog')drawDogAt(g,p,p.x,Y(p.lane),p.dir,p.near,p.rim,p.stop<=0);else drawPerson(g,p);}

// Cars are drawn once into a sprite, in metres, at the screen's resolution for their lane.
const KINDS={
  sedan:{L:4.5,H:1.42,w:[.9,3.62],r:.34,body:[[0,.3],[0,.78],[.2,.96],[1.15,1.02],[1.55,1.4],[3.0,1.42],[3.62,1.0],[4.42,.86],[4.5,.52],[4.44,.28]],glass:[[1.65,1.02],[1.72,1.32],[2.95,1.34],[3.45,1.02]]},
  sport:{L:4.4,H:1.16,w:[.85,3.55],r:.34,body:[[0,.28],[0,.72],[.35,.86],[1.5,.94],[2.05,1.16],[2.9,1.16],[3.55,.84],[4.36,.62],[4.4,.3]],glass:[[2.1,.96],[2.15,1.1],[2.86,1.1],[3.32,.88]]},
  taxi:{L:4.6,H:1.5,w:[.92,3.7],r:.35,body:[[0,.3],[0,.8],[.22,.98],[1.2,1.04],[1.6,1.42],[3.05,1.44],[3.7,1.02],[4.52,.88],[4.6,.52],[4.54,.28]],glass:[[1.7,1.04],[1.77,1.34],[3.0,1.36],[3.52,1.04]]},
  van:{L:5,H:2.1,w:[.95,4.0],r:.36,body:[[0,.34],[0,1.98],[.16,2.1],[3.6,2.1],[4.4,1.38],[4.98,1.2],[5,.34]],glass:[[3.66,1.96],[4.3,1.38],[3.66,1.38]]},
  truck:{L:7,H:3,w:[1.1,2.4,6.1],r:.42,body:[[0,.45],[0,3.0],[5,3.0],[5,2.4],[6.1,2.4],[6.9,1.5],[7,.45]],glass:[[5.9,2.25],[5.9,1.6],[6.75,1.6],[6.25,2.25]]},
  bike:{L:2.1,H:1.6,w:[.32,1.78],r:.33}
};
const CARCOLS=['#f3e600','#ff2a7a','#1a1a26','#2af0ff','#e8e8f0','#7a2aff','#ff5a1a','#2a3a4a','#c8c8d0'];
function carSprite(v){
  const K=KINDS[v.kind],ppm=v.u*OS,pad=.5;
  const[c,g]=mk((K.L+pad*2)*ppm,(K.H+.9+pad)*ppm);
  g.setTransform(ppm,0,0,-ppm,pad*ppm,(K.H+.9)*ppm);// metres, y up, ground at 0
  const lw=.06,col=v.col,dark=shade(col,-.45);
  if(v.kind==='bike'){
    for(const wx of K.w){g.beginPath();g.arc(wx,K.r,K.r,0,TAU);g.fillStyle='#0c0a12';g.fill();g.strokeStyle=v.trim;g.lineWidth=.04;g.stroke();}
    poly(g,[[.25,.5],[.7,.82],[1.3,.86],[1.75,.62],[1.95,.85],[1.6,.98],[1.05,.95],[.55,.95],[.15,.75]]);g.fillStyle=col;g.fill();g.strokeStyle='#08060c';g.lineWidth=lw;g.stroke();
    g.fillStyle=dark;poly(g,[[.25,.5],[.7,.7],[1.75,.62],[1.3,.5]]);g.fill();
    // The rider, leaning over the tank, helmet and visor.
    g.fillStyle=v.rider;poly(g,[[.55,.95],[.7,1.5],[1.25,1.42],[1.5,1.05],[1.2,.9]]);g.fill();g.stroke();
    g.beginPath();g.arc(1.32,1.5,.17,0,TAU);g.fillStyle='#14121c';g.fill();g.stroke();g.fillStyle=v.trim;g.fillRect(1.36,1.46,.14,.08);
    g.strokeStyle=v.rider;g.lineWidth=.12;g.beginPath();g.moveTo(1.2,1.35);g.lineTo(1.62,1.0);g.stroke();
    return c;}
  poly(g,K.body);g.fillStyle=col;g.fill();
  g.save();poly(g,K.body);g.clip();g.fillStyle=dark;g.fillRect(-1,-1,K.L+2,(v.kind==='truck'?1.1:.62)+1);
  g.fillStyle=shade(col,.35);g.fillRect(-1,K.H-.07,K.L+2,.3);
  if(v.kind==='taxi'){g.fillStyle='#14121c';for(let i=0;i<10;i++)if(i%2)g.fillRect(1.2+i*.22,.72,.22,.1);else g.fillRect(1.2+i*.22,.62,.22,.1);}
  if(v.kind==='truck'){g.fillStyle=v.trim;g.fillRect(.4,1.4,4.2,.14);g.fillStyle=shade(v.trim,-.2);g.beginPath();g.arc(1.4,2.2,.42,0,TAU);g.fill();g.fillRect(2.1,2.1,2.4,.2);g.fillRect(2.1,1.82,1.6,.16);}
  if(v.stripe){g.fillStyle=v.trim;g.fillRect(-1,.74,K.L+2,.06);}
  g.restore();
  poly(g,K.body);g.strokeStyle='#08060c';g.lineWidth=lw;g.stroke();
  if(K.glass){poly(g,K.glass);g.fillStyle='#0c1424';g.fill();g.save();poly(g,K.glass);g.clip();g.fillStyle=rgba(v.trim,.55);poly(g,[[K.glass[0][0]+.3,0],[K.glass[0][0]+.55,0],[K.glass[0][0]+1.1,3],[K.glass[0][0]+.85,3]]);g.fill();g.restore();poly(g,K.glass);g.strokeStyle='#08060c';g.lineWidth=lw;g.stroke();
    if(v.kind==='sedan'||v.kind==='taxi'){g.fillStyle=col;g.fillRect(2.3,1.0,.1,.36);}}
  if(v.kind==='taxi'){g.fillStyle='#f3e600';g.fillRect(2.0,1.44,.75,.2);g.strokeStyle='#08060c';g.lineWidth=.04;g.strokeRect(2.0,1.44,.75,.2);}
  // A thin rim of neon along the roofline.
  g.strokeStyle=v.rim;g.lineWidth=.05;g.beginPath();const top=K.body.filter(p=>p[1]>K.H*.8);g.moveTo(top[0][0],top[0][1]);for(const p of top)g.lineTo(p[0],p[1]);g.stroke();
  for(const wx of K.w){g.beginPath();g.arc(wx,K.r,K.r,0,TAU);g.fillStyle='#0c0a12';g.fill();g.strokeStyle='#08060c';g.lineWidth=lw;g.stroke();g.beginPath();g.arc(wx,K.r,K.r*.55,0,TAU);g.fillStyle=v.hub;g.fill();if(v.hubGlow){g.strokeStyle=v.trim;g.lineWidth=.03;g.stroke();}}
  return c;}
function newCar(){
  const far=chance(.5),lane=far?FLN:NLN,u=upm(lane),dir=far?-1:1;
  const kind=wpick([['sedan',4],['taxi',2],['sport',1.6],['van',1.4],['bike',1.6],['truck',.6]]);
  const v={kind,far,lane,u,dir,col:kind==='taxi'?'#f3d400':pick(CARCOLS),trim:pick(NEON),rim:pick(NEON),hub:pick(['#2a2a36','#8a8a9a','#c8a040']),hubGlow:chance(.3),stripe:chance(.3),under:chance(.25)?pick(NEON):null,rider:pick(COATS)};
  // Each kind keeps its own pace in metres a second. A taxi in the near lane sometimes pulls over outside.
  const PACE={sedan:[5,11],taxi:[3.5,8],sport:[9,16],van:[5,9],bike:[8,17],truck:[4,7.5]}[kind];
  v.L=KINDS[kind].L*u;v.vmax=rr(PACE[0],PACE[1])*u;v.cur=v.vmax;
  if(kind==='taxi'&&!far&&chance(.25))v.stopAt=rr(VW*.3,VW*.8);
  v.x=dir>0?-v.L-6:VW+6;v.spr=carSprite(v);
  // Keep a gap behind whatever is ahead in the lane.
  for(const c of cars){if(c.lane!==lane)continue;const gap=dir>0?c.x-(v.x+v.L):v.x-(c.x+c.L);if(gap<8*u)v.cur=Math.min(v.cur,c.cur);}
  cars.push(v);stats.cars++;return v;}
function drawCar(g,v){
  const K=KINDS[v.kind],ppm=v.u,pad=.5,w=v.spr.width/OS,h=v.spr.height/OS,gy=Y(v.lane);
  if(v.under){g.save();g.globalCompositeOperation='lighter';g.fillStyle=rad(g,0,0,0,1,[[0,rgba(v.under,.5)],[1,rgba(v.under,0)]]);g.translate(v.x+v.L/2,gy+.3);g.scale(v.L*.6,1.6*ppm/10+1);g.fillRect(-1,-1,2,2);g.restore();}
  g.save();g.translate(v.x+(v.dir>0?0:v.L),gy);g.scale(v.dir,1);g.drawImage(v.spr,-pad*ppm,-(K.H+.9)*ppm,w,h);g.restore();
}
function drawCarLights(g,v){
  const K=KINDS[v.kind],u=v.u,gy=Y(v.lane),front=v.dir>0?v.x+v.L:v.x,back=v.dir>0?v.x:v.x+v.L;
  const hy=gy-(v.kind==='bike'?.82:v.kind==='truck'?.9:.68)*u,ty=gy-(v.kind==='bike'?.86:v.kind==='truck'?1:.8)*u;
  // Headlight: a hot point and a long beam down the road.
  g.fillStyle=lin(g,front,0,front+v.dir*14*u,0,[[0,'rgba(255,250,220,.35)'],[1,'rgba(255,250,220,0)']]);
  poly(g,[[front,hy-.12*u],[front+v.dir*14*u,hy-1*u],[front+v.dir*14*u,gy+.5*u],[front,hy+.15*u]]);g.fill();
  glow(g,front-v.dir*.1*u,hy,1.6*u,'#fff6e0',.9);
  glow(g,back+v.dir*.06*u,ty,(v.brake||v.stopT!=null?1.8:1.2)*u,'#ff2a3a',v.brake||v.stopT!=null?1:.75);
  if(v.stopT!=null&&t%1<.5){glow(g,front-v.dir*.2*u,hy,1.3*u,'#ffa020',.9);glow(g,back+v.dir*.2*u,ty,1.3*u,'#ffa020',.9);}
  if(v.kind==='taxi')glow(g,v.x+v.L/2+(v.dir>0?-.1:.1)*u,gy-1.55*u,1.1*u,'#f3e600',.5);
}

/* ---------- the sky ---------- */
function newFlyer(){const dir=chance(.5)?1:-1,y=rr(76,Math.max(84,Math.min(VH-8,150))),L=rr(5,10)*(1-(y-76)/200);
  flyers.push({dir,y,L,x:dir>0?-L-4:VW+4,v:rr(8,22)*dir,col:pick(['#1a1626','#2a2a3a','#3a1a2a']),light:pick(NEON),bob:rr(0,TAU)});}
function drawFlyer(g,f){
  const y=Y(f.y)+Math.sin(t*1.3+f.bob)*.5,L=f.L;g.save();g.translate(f.x+L/2,y);g.scale(f.dir,1);
  g.fillStyle=f.col;g.beginPath();g.moveTo(-L/2,0);g.quadraticCurveTo(-L*.2,-L*.24,L*.3,-L*.16);g.lineTo(L/2,0);g.quadraticCurveTo(0,L*.12,-L/2,0);g.fill();
  g.fillStyle=rgba(f.light,.9);g.fillRect(-L*.1,-L*.14,L*.3,L*.05);g.restore();
  g.save();g.globalCompositeOperation='lighter';const blink=(t*1.5+f.bob)%1<.12;glow(g,f.x+(f.dir>0?0:L),y,L*.35,'#ff7a6a',.7);if(blink)glow(g,f.x+L/2,y-L*.15,L*.6,'#ffffff',.6);glow(g,f.x+(f.dir>0?L:0),y,L*.5,'#aaf0ff',.5);g.restore();}

/* ---------- the big screen ---------- */
function drawBill(g){
  const x=BILL.x,y=Y(BILL.y+BILL.h),w=BILL.w,h=BILL.h;if(x>VW)return;
  g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
  g.fillStyle=mixC(BILL.col,'#05030a',.82);g.fillRect(x,y,w,h);
  const bt=BILL.t;
  if(BILL.mode==='koi'){
    // A koi turning slow circles.
    const a=bt*.5,cx=x+w/2+Math.cos(a)*w*.22,cy=y+h/2+Math.sin(a)*h*.22,dir=a+Math.PI/2;
    g.translate(cx,cy);g.rotate(dir);const L=Math.min(w,h)*.42,wag=Math.sin(bt*5)*.35;
    g.fillStyle='#ff6a2a';g.beginPath();g.ellipse(0,0,L*.5,L*.17,0,0,TAU);g.fill();
    g.fillStyle='#fff0e0';g.beginPath();g.ellipse(L*.1,-L*.03,L*.16,L*.09,0,0,TAU);g.fill();g.beginPath();g.ellipse(-L*.2,L*.04,L*.1,L*.06,0,0,TAU);g.fill();
    g.fillStyle='#ff6a2a';g.save();g.translate(-L*.48,0);g.rotate(wag);g.beginPath();g.moveTo(0,0);g.lineTo(-L*.3,-L*.2);g.lineTo(-L*.22,0);g.lineTo(-L*.3,L*.2);g.closePath();g.fill();g.restore();
    g.setTransform(OS,0,0,OS,0,0);
    g.globalCompositeOperation='lighter';for(let i=0;i<5;i++){const r=((bt*.3+i/5)%1)*w*.6;g.strokeStyle=rgba(BILL.col2,.35*(1-r/(w*.6)));g.lineWidth=.4;g.beginPath();g.arc(x+w/2,y+h/2,r,0,TAU);g.stroke();}
  }else if(BILL.mode==='text'){
    g.font=`900 ${h*.5}px ${SANS}`;g.textBaseline='middle';const tw=g.measureText(BILL.word).width+w*.4,off=(bt*w*.25)%tw;
    g.fillStyle=BILL.col;for(let k=-1;k<3;k++)g.fillText(BILL.word,x+w-off+k*tw-w,y+h*.45);
    g.fillStyle=BILL.col2;g.fillRect(x,y+h*.82,w,h*.04);g.fillRect(x+((bt*8)%w),y+h*.12,w*.2,h*.04);
  }else{
    const n=9,bw=w/n;for(let i=0;i<n;i++){const v=noise(bt*1.6+i*3.1)*.8+.15;g.fillStyle=i%2?BILL.col:BILL.col2;g.fillRect(x+i*bw+.4,y+h-v*h,bw-.8,v*h);}
    g.fillStyle='rgba(255,255,255,.8)';g.beginPath();g.arc(x+w/2,y+h*.25,Math.min(w,h)*.08*(1+Math.sin(bt*3)*.3),0,TAU);g.fill();
  }
  g.restore();
  g.fillStyle='rgba(0,0,0,.25)';for(let yy=y;yy<y+h;yy+=.8)g.fillRect(x,yy,w,.25);
  g.save();g.globalCompositeOperation='lighter';g.fillStyle=rgba(BILL.col,.12);g.fillRect(x-6,y-6,w+12,h+12);g.restore();
}

/* ---------- the counter ---------- */
// (x, yu) is the middle of the cup's base on the counter. Each cup has its own proportions: top radius, height, the
// depth of its ellipse, and the radius at its foot.
function cupGeom(x,y,k){const G={ti:[4,8.6,1.3,3.6],facet:[4.2,7.4,1.35,3.3],dwg:[4.3,8.8,1.35,4],rocks:[4.9,7.4,1.5,4.7]}[CUP.kind];return{x,y,k,rx:G[0]*k,h:G[1]*k,ry:G[2]*k,bx:G[3]*k};}
// A soft shadow on the counter, an ellipse that fades out.
function softShadow(g,x,y,rx,ry,a){g.save();g.translate(x,y);g.scale(1,ry/rx);g.fillStyle=rad(g,0,0,0,rx,[[0,`rgba(12,5,2,${a})`],[.6,`rgba(12,5,2,${a*.45})`],[1,'rgba(12,5,2,0)']]);g.fillRect(-rx,-rx,rx*2,rx*2);g.restore();}
// The bulbs (or, on a dark night, the candle) as reflections, placed by where each light is.
function glints(cx){if(DARK)return PROPS.candle?[[CANDX,'#ffb060',.7]]:[];return BULBS.map(b=>[b.f*VW,'#fff2d8',.85*b.on]).sort((a,b)=>Math.abs(a[0]-cx)-Math.abs(b[0]-cx)).slice(0,2);}
// What's behind a glass, seen squeezed through its curve: copied from what's already drawn and laid back in narrower.
function seeThrough(g,x,y,x0,y0,w,h,sq,a){const sx=Math.round((x+x0-w*(sq-1)/2)*S),sy=Math.round((y+y0)*S),sw=Math.round(w*sq*S),sh=Math.round(h*S);
  if(sw>2&&sh>2&&sx>=0&&sy>=0&&sx+sw<=CW&&sy+sh<=CH){g.globalAlpha=a;g.drawImage(g.canvas,sx,sy,sw,sh,x0,y0,w,h);g.globalAlpha=1;}}
// Hot coffee seen from a little above: dark at the heart, a crema toward the wall with fine bubbles, a bright
// meniscus where it meets the cup, and one soft reflection of the nearest light.
function hotCoffee(g,cy,cr,cry,k,x){
  g.fillStyle=rad(g,-cr*.1,cy,0,cr,[[0,'#1c0c04'],[.55,'#2a1307'],[.82,'#4e2a12'],[.95,'#7a4a24'],[1,'#94603a']]);g.beginPath();g.ellipse(0,cy,cr,cry,0,0,TAU);g.fill();
  g.fillStyle='rgba(190,140,96,.18)';for(let i=0;i<60;i++){const a=h3(i,1,43)*TAU,d=Math.sqrt(h3(i,2,43))*.95;g.fillRect(Math.cos(a)*d*cr,cy+Math.sin(a)*d*cry,.06*k,.05*k);}
  g.strokeStyle='rgba(200,150,105,.55)';g.lineWidth=.1*k;g.beginPath();g.ellipse(0,cy,cr*.985,cry*.97,0,0,TAU);g.stroke();
  const gl0=glints(x)[0];if(gl0){const[lx,col,a]=gl0,gx=clamp((lx-x)/(VW*.35),-1,1)*cr*.45;g.save();g.translate(gx,cy-cry*.3);g.scale(1,.42);g.fillStyle=rad(g,0,0,0,cr*.28,[[0,rgba(col,a*.5)],[.3,rgba(col,a*.2)],[1,rgba(col,0)]]);g.fillRect(-cr*.28,-cr*.28,cr*.56,cr*.56);g.restore();}}
// The rim and the inside of an open cup, then the coffee, lower as it goes down. lip is the rim's colour, wall the
// inside's.
function cupMouth(g,c,level,lip,wall){
  const{rx,h,ry,bx,k}=c,iw=rx*.9,ir=ry*.82;
  g.fillStyle=lin(g,-rx,0,rx,0,[[0,shade(lip,-.2)],[.45,shade(lip,.12)],[1,shade(lip,-.12)]]);g.beginPath();g.ellipse(0,-h,rx,ry,0,0,TAU);g.fill();
  g.fillStyle=lin(g,0,-h-ry,0,-h+ry,[[0,shade(wall,-.55)],[.6,shade(wall,-.3)],[1,shade(wall,-.08)]]);g.beginPath();g.ellipse(0,-h+.08*k,iw,ir,0,0,TAU);g.fill();
  if(level>.01){g.save();g.beginPath();g.ellipse(0,-h+.08*k,iw,ir,0,0,TAU);g.clip();
    const drop=(1-level)*h*.78,cr=lerp(iw,bx*.92,(1-level)*.85),cy=-h+drop,cry=ry*.82*(cr/rx);
    g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.ellipse(0,cy-cry*.6,cr,cry,0,Math.PI,TAU);g.fill();
    hotCoffee(g,cy,cr,cry,k,c.x);g.restore();}
  g.strokeStyle='rgba(255,252,245,.22)';g.lineWidth=.1*k;g.beginPath();g.ellipse(0,-h+.04*k,rx-.1*k,ry-.07*k,0,Math.PI*.08,Math.PI*.92);g.stroke();}
// The radius of a cup at a height up its side, between its foot and its rim.
const rAt=(c,yy)=>lerp(c.bx,c.rx,clamp(-yy/c.h,0,1));
// A band round a cup at a height is not a straight line but the front half of an ellipse, dipping toward you in the
// middle, because we look down on the cup a little.
function bandArc(g,c,yy){g.ellipse(0,yy,rAt(c,yy),c.ry*.9,0,0,Math.PI);}
// Handles, one for each kind of cup, all on the right.
function cupHandle(g,c){
  const{rx,h,bx,k}=c;
  if(CUP.kind==='ti'){
    // A flat strap of titanium, bent into a D and riveted on, coloured by the same oxide as the cup.
    const hc=[];bez([rx*.96,-h*.8],[rx+3.4*k,-h*.82],[rx+3.3*k,-h*.22],[bx*.98,-h*.24],14,hc);const hp=ptsPath(tube(hc,1.05*k,1.05*k));
    g.fillStyle=lin(g,0,-h*.85,0,-h*.2,[[0,'#3a4a92'],[.5,'#6a3e7e'],[1,'#9a7444']]);g.fill(hp);
    g.save();g.clip(hp);g.fillStyle=lin(g,rx,0,rx+3.6*k,0,[[0,'rgba(0,0,0,.45)'],[.6,'rgba(255,255,255,.08)'],[1,'rgba(0,0,0,.3)']]);g.fillRect(rx-k,-h,5*k,h);g.restore();
    g.strokeStyle='rgba(220,226,236,.35)';g.lineWidth=.08*k;g.beginPath();for(let i=1;i<13;i++){const q=hc[i];g.lineTo(q[0],q[1]-.42*k);}g.stroke();
    for(const q of[hc[1],hc[13]]){g.fillStyle=rad(g,q[0]-.1*k,q[1]-.1*k,0,.32*k,[[0,'#d8dce4'],[1,'#5a5e66']]);g.beginPath();g.arc(q[0]-.3*k,q[1],.28*k,0,TAU);g.fill();}}
  else if(CUP.kind==='facet'){
    // A squared handle, flat-sided like the facets, in the same matte glaze: lit on top, darker on its side.
    const B=CUP.body,pts=[[rx*.92,-h*.78],[rx+2.6*k,-h*.82],[rx+3.1*k,-h*.7],[rx+3.1*k,-h*.36],[rx+2.5*k,-h*.26],[bx*.98,-h*.26]];
    const hp=ptsPath(tube(pts,1.35*k,1.25*k));g.fillStyle=lin(g,0,-h*.85,0,-h*.2,[[0,shade(B,.05)],[1,shade(B,-.3)]]);g.fill(hp);
    g.save();g.clip(hp);g.fillStyle=lin(g,rx+2.4*k,0,rx+3.6*k,0,[[0,'rgba(0,0,0,0)'],[1,'rgba(0,0,0,.35)']]);g.fillRect(rx,-h,5*k,h);g.restore();
    g.strokeStyle=rgba(mixC(B,'#e8dcc8',.55),.45);g.lineWidth=.08*k;g.beginPath();for(const q of pts.slice(0,4))g.lineTo(q[0],q[1]-.6*k);g.stroke();}
  else{
    // A clear glass loop, seen through, its edges catching the light.
    const hc=[];bez([rx*.97,-h*.78],[rx+3.5*k,-h*.84],[rx+3.4*k,-h*.2],[bx*.99,-h*.22],14,hc);const tp=tube(hc,1.3*k,1.15*k),hp=ptsPath(tp);
    g.fillStyle='rgba(205,225,235,.1)';g.fill(hp);g.strokeStyle='rgba(235,245,250,.35)';g.lineWidth=.08*k;g.stroke(hp);
    g.strokeStyle='rgba(255,255,255,.45)';g.lineWidth=.1*k;g.beginPath();for(let i=2;i<12;i++){const q=hc[i];g.lineTo(q[0]-.1*k,q[1]-.38*k);}g.stroke();}
}
function drawCup(g,c,level){
  if(ICED)return drawRocks(g,c,level);
  const{x,rx,h,ry,bx,k}=c,y=Y(c.y);g.save();g.translate(x,y);
  const body=new Path2D();body.moveTo(-rx,-h);body.lineTo(-bx,0);body.ellipse(0,0,bx,ry*.85,0,Math.PI,0,true);body.lineTo(rx,-h);body.closePath();
  cupHandle(g,c);
  if(CUP.kind==='ti'){
    // Titanium, coloured by the oxide on it: bare metal at the foot, then bronze, violet and blue toward the lip.
    // Brushed round its circumference, so the lights spread into soft vertical sheens rather than points.
    // The oxide is laid on in thin rings from the foot up, each ring an ellipse, so the colour bands curve round.
    const OX=[[0,'#7c7e86'],[.1,'#9a7444'],[.32,'#8a5a3a'],[.48,'#6a3e7e'],[.68,'#3a4892'],[.86,'#2a5a8e'],[1,'#7e828c']],oxAt=f=>{for(let i=1;i<OX.length;i++)if(f<=OX[i][0])return mixC(OX[i-1][1],OX[i][1],(f-OX[i-1][0])/(OX[i][0]-OX[i-1][0]));return OX[OX.length-1][1];};
    g.save();g.clip(body);
    for(let i=0;i<=48;i++){const f=i/48,yy=-f*h+ry*.9;g.fillStyle=oxAt(f);g.beginPath();g.ellipse(0,yy-ry*.9,rAt(c,yy-ry*.9)+.05*k,ry*.9+.05*k,0,0,TAU);g.fill();}
    g.fillStyle=lin(g,-rx,0,rx,0,[[0,'rgba(0,0,0,.62)'],[.14,'rgba(0,0,0,.3)'],[.4,'rgba(255,255,255,.06)'],[.52,'rgba(255,255,255,.1)'],[.64,'rgba(0,0,0,.06)'],[.9,'rgba(0,0,0,.48)'],[1,'rgba(0,0,0,.62)']]);g.fillRect(-rx,-h,rx*2,h+ry);
    // Brushed round the cup: each fine line follows the curve.
    g.lineWidth=.04*k;for(let i=0;i<110;i++){const yy=-h3(i,1,51)*h,a=.025+h3(i,2,51)*.045;g.strokeStyle=h3(i,3,51)<.5?`rgba(255,255,255,${a.toFixed(3)})`:`rgba(0,0,0,${a.toFixed(3)})`;g.beginPath();bandArc(g,c,yy);g.stroke();}
    for(const[lx,col,a]of glints(x)){const gx=clamp((lx-x)/(VW*.35),-1,1)*rx*.55;g.fillStyle=lin(g,gx-rx*.12,0,gx+rx*.12,0,[[0,rgba(col,0)],[.5,rgba(col,a*.16)],[1,rgba(col,0)]]);g.fillRect(gx-rx*.12,-h,rx*.24,h);}
    g.fillStyle=rgba(RIM,.14);g.fillRect(rx*.9,-h,rx*.1,h+ry);g.fillRect(-rx,-h,rx*.07,h+ry);
    g.fillStyle=lin(g,0,-h*.25,0,ry,[[0,'rgba(0,0,0,0)'],[1,'rgba(0,0,0,.4)']]);g.fillRect(-rx,-h*.25,rx*2,h*.25+ry);
    g.restore();
    // A rolled lip of bare metal.
    cupMouth(g,c,level,'#9a9ca4','#5a5c64');
    g.strokeStyle='rgba(30,30,36,.6)';g.lineWidth=.12*k;g.beginPath();g.ellipse(0,-h+.3*k,rx*.99,ry*.98,0,Math.PI*.05,Math.PI*.95);g.stroke();}
  else if(CUP.kind==='facet'){
    // Eight flat facets, each lit by how it faces the light. The glaze thins and pales along the edges, and stops
    // short of the foot, which is left as raw clay.
    const B=CUP.body,N=8,off=.2,foot=.9*k,fs=[];
    for(let i=0;i<N;i++){const a0=off+i/N*TAU,a1=off+(i+1)/N*TAU,m=(a0+a1)/2;if(Math.sin(m)>-.1)fs.push([a0,a1,m]);}
    fs.sort((p,q)=>Math.sin(p[2])-Math.sin(q[2]));
    const at=(a,top)=>[Math.cos(a)*(top?rx:bx),(top?-h:0)+Math.sin(a)*(top?ry:ry*.85)];
    for(const[a0,a1,m]of fs){const L=.5+.5*(Math.cos(m)*-.55+Math.sin(m)*.62),t0=at(a0,1),t1=at(a1,1),b0=at(a0,0),b1=at(a1,0);
      const fp=new Path2D();fp.moveTo(...t0);fp.lineTo(...t1);fp.lineTo(...b1);fp.lineTo(...b0);fp.closePath();
      g.fillStyle=lin(g,0,-h,0,0,[[0,shade(B,(L-.55)*.6+.04)],[1,shade(B,(L-.55)*.6-.12)]]);g.fill(fp);
      // The glaze stops at a line that runs straight across each flat facet, from corner to corner round the cup.
      const fr=lerp(bx,rx,foot/h),f0=[Math.cos(a0)*fr,-foot+Math.sin(a0)*ry*.87],f1=[Math.cos(a1)*fr,-foot+Math.sin(a1)*ry*.87];
      g.save();g.clip(fp);poly(g,[f0,f1,[b1[0],b1[1]+ry],[b0[0],b0[1]+ry]]);g.fillStyle=lin(g,0,-foot,0,ry,[[0,shade('#a88a68',(L-.6)*.5)],[1,shade('#8a6e52',(L-.6)*.5)]]);g.fill();
        g.strokeStyle=rgba(shade(B,-.4),.5);g.lineWidth=.1*k;g.beginPath();g.moveTo(...f0);g.lineTo(...f1);g.stroke();
        for(let i=0;i<30;i++){g.fillStyle=`rgba(255,255,255,${(.02+h3(i,m*7,3)*.04).toFixed(3)})`;g.fillRect((h3(i,m*7,1)*2-1)*rx,-h3(i,m*7,2)*h,.06*k,.06*k);}g.restore();
      g.strokeStyle=rgba(mixC(B,'#e8dcc8',.55),.5);g.lineWidth=.09*k;g.beginPath();g.moveTo(...t0);g.lineTo(...b0);g.stroke();}
    for(const[lx,col,a]of glints(x)){const gx=clamp((lx-x)/(VW*.35),-1,1)*rx*.5;g.fillStyle=rgba(col,a*.08);g.fillRect(gx-rx*.08,-h*.9,rx*.16,h*.6);}
    cupMouth(g,c,level,mixC(B,'#e8dcc8',.25),B);}
  else{
    // Double-walled glass: the coffee sits in the inner wall and seems to float, with clear air beneath it.
    const gap=.5*k,base=1.9*k,top=-base-(h-base-.4*k)*(.06+.86*level),iTop=-h+.25*k;
    const inner=new Path2D();inner.moveTo(-(rx-gap),iTop);inner.lineTo(-(bx-gap),-base);inner.ellipse(0,-base,bx-gap,ry*.75,0,Math.PI,0,true);inner.lineTo(rx-gap,iTop);inner.closePath();
    g.save();g.clip(body);seeThrough(g,x,y,-rx,-h,rx*2,h+ry,1.2,.85);g.fillStyle='rgba(200,222,232,.06)';g.fill(body);g.restore();
    if(level>.01){g.save();g.clip(inner);g.beginPath();g.rect(-rx,top,rx*2,h);g.clip();
      g.fillStyle=lin(g,-rx,0,rx,0,[[0,'#120804'],[.4,'#2a1408'],[.62,'#3c1e0c'],[1,'#100602']]);g.fillRect(-rx,top,rx*2,-top);
      g.fillStyle=lin(g,0,-base-1.5*k,0,-base+ry,[[0,'rgba(0,0,0,0)'],[1,'rgba(110,60,25,.35)']]);g.fillRect(-rx,-base-1.5*k,rx*2,1.5*k+ry);g.restore();
      const cr=lerp(bx-gap,rx-gap,(-top-base)/(h-base))*.98;hotCoffee(g,top,cr,ry*.8*(cr/rx),k,x);}
    g.strokeStyle='rgba(220,236,244,.28)';g.lineWidth=.08*k;g.stroke(inner);
    // The two walls fuse in a rounded lip.
    g.strokeStyle='rgba(235,245,250,.32)';g.lineWidth=.1*k;g.beginPath();g.ellipse(0,-h,rx,ry,0,0,TAU);g.stroke();g.beginPath();g.ellipse(0,-h+.12*k,rx-gap,ry*.82,0,0,TAU);g.stroke();
    g.fillStyle='rgba(255,255,255,.1)';poly(g,[[-rx*.62,-h*.95],[-rx*.52,-h*.95],[-bx*.5,-h*.08],[-bx*.6,-h*.08]]);g.fill();
    g.fillStyle=rgba(RIM,.12);poly(g,[[rx*.84,-h],[rx*.94,-h],[bx*.94,0],[bx*.84,0]]);g.fill();
    g.strokeStyle='rgba(225,240,248,.22)';g.lineWidth=.08*k;g.stroke(body);}
  g.restore();
}
// An ice cube: a rounded, glassy block catching the light along its top edge.
function iceCube(g,x,y,s,a){g.save();g.translate(x,y);g.rotate(a);rrect(g,-s/2,-s/2,s,s,s*.18);g.fillStyle='rgba(222,236,242,.24)';g.fill();
  g.strokeStyle='rgba(240,248,252,.4)';g.lineWidth=s*.04;g.stroke();g.fillStyle='rgba(255,255,255,.4)';g.fillRect(-s*.34,-s*.36,s*.32,s*.05);g.fillStyle='rgba(255,255,255,.14)';g.fillRect(-s*.36,-s*.22,s*.05,s*.4);g.restore();}
// A clear ice sphere: lit round its upper edge, a bright point, and the coffee dark through it.
function iceSphere(g,x,y,r){g.fillStyle=rad(g,x-r*.2,y-r*.3,r*.1,r,[[0,'rgba(230,242,248,.3)'],[.8,'rgba(210,228,236,.18)'],[1,'rgba(240,248,252,.45)']]);g.beginPath();g.arc(x,y,r,0,TAU);g.fill();
  g.strokeStyle='rgba(240,248,252,.35)';g.lineWidth=r*.05;g.beginPath();g.arc(x,y,r*.96,Math.PI*1.1,Math.PI*1.75);g.stroke();g.fillStyle='rgba(255,255,255,.6)';g.beginPath();g.ellipse(x-r*.38,y-r*.42,r*.12,r*.07,-.6,0,TAU);g.fill();}
// The heavy tumbler for iced coffee. Its base is thick cut glass: rows of facets, each bending a different part of
// the street into it, so the base glints in separate neon colours and throws small coloured patches on the wood.
function drawRocks(g,c,level){
  const{x,rx,h,ry,bx,k}=c,y=Y(c.y),T=CUP.tint,base=1.9*k,wall=.35*k,top=-base-(h-base)*(.06+.84*level),sr=lerp(bx,rx,-top/h)-wall,ice=coffee.ice;
  const cols=[...new Set(SIGNS.filter(s=>s.x>-10&&s.x<VW+10).map(s=>s.col))].concat(['#ffcf7a','#9ad8ff']);
  // Light through the cut base, split into colours on the wood.
  g.save();g.globalCompositeOperation='lighter';for(let i=0;i<6;i++){const a=.25+h3(i,1,61)*(Math.PI-.5),d=bx*(1.1+h3(i,2,61)*.5),px=x+Math.cos(a)*d,py=y+Math.sin(a)*ry*1.4+ry*.3,col=cols[(i*2)%cols.length],r=(.9+h3(i,3,61)*.8)*k;
    g.save();g.translate(px,py);g.scale(1,.3);g.fillStyle=rad(g,0,0,0,r,[[0,rgba(col,.14)],[1,rgba(col,0)]]);g.fillRect(-r,-r,r*2,r*2);g.restore();}g.restore();
  g.save();g.translate(x,y);
  const glass=new Path2D();glass.moveTo(-rx,-h);glass.lineTo(-bx,0);glass.ellipse(0,0,bx,ry*.85,0,Math.PI,0,true);glass.lineTo(rx,-h);glass.closePath();
  g.save();g.clip(glass);seeThrough(g,x,y,-rx,-h,rx*2,h+top,1.15,.85);g.restore();
  g.fillStyle='rgba(200,220,230,.06)';g.fill(glass);
  const inside=new Path2D();inside.moveTo(-rx+wall,-h);inside.lineTo(-bx+wall,-base);inside.ellipse(0,-base,bx-wall,ry*.75,0,Math.PI,0,true);inside.lineTo(rx-wall,-h);inside.closePath();
  if(level>.01){g.save();g.clip(inside);g.beginPath();g.rect(-rx,top,rx*2,-top);g.clip();
    if(CUP.tonic)g.fillStyle=lin(g,0,top,0,-base,[[0,T[0]],[.45,T[1]],[1,T[2]]]);else g.fillStyle=lin(g,-rx,0,rx,0,[[0,T[0]],[.38,T[1]],[.62,T[2]],[1,T[0]]]);g.fillRect(-rx,top,rx*2,-top);
    if(CUP.milk)for(let i=0;i<7;i++){const f=i/6,cx=Math.sin(t*.15+i*1.7)*sr*.45,cy=top+(-top-base)*(.15+f*.7),r=(1.4+h3(i,7,11)*1.6)*k;g.fillStyle=rad(g,cx,cy,0,r*1.6,[[0,'rgba(214,186,150,.18)'],[1,'rgba(214,186,150,0)']]);g.fillRect(cx-r*1.6,cy-r*1.6,r*3.2,r*3.2);}
    if(CUP.tonic){g.fillStyle='rgba(220,200,170,.35)';for(let i=0;i<24;i++){const ph=(t*(.12+h3(i,2,17)*.12)+h3(i,3,17))%1,bx2=(h3(i,4,17)-.5)*sr*1.6,by2=-base-ph*(-base-top);g.beginPath();g.arc(bx2,by2,(.06+h3(i,5,17)*.06)*k,0,TAU);g.fill();}}
    g.restore();
    g.fillStyle=rgba(T[2],.9);g.beginPath();g.ellipse(0,top,sr,ry*.8*(sr/rx),0,0,TAU);g.fill();
    // Ice: one big sphere, or two large cubes, floating nine tenths under.
    g.save();g.clip(inside);
    const iz=(.55+.45*ice);
    if(CUP.sphere){const r=sr*.55*iz;iceSphere(g,(h3(1,1,63)-.5)*sr*.3,top+r*.8,r);}else{for(let i=0;i<2;i++){const s2=sr*.62*iz;iceCube(g,(i?.32:-.3)*sr,top+s2*.42+(i?.3*k:0),s2,(h3(i,6,11)-.5)*.6);}}
    g.fillStyle=rgba(T[1],.7);g.fillRect(-rx,top,rx*2,-top-base);g.restore();
    if(CUP.sphere){const r=sr*.55*iz,cx=(h3(1,1,63)-.5)*sr*.3;g.save();g.beginPath();g.rect(-rx,-h-2*k,rx*2,top+h+2*k);g.clip();iceSphere(g,cx,top+r*.8,r);g.restore();}
    else for(let i=0;i<2;i++){const s2=sr*.62*iz,cy2=top+s2*.42+(i?.3*k:0);g.save();g.beginPath();g.rect(-rx,-h-2*k,rx*2,top+h+2*k);g.clip();iceCube(g,(i?.32:-.3)*sr,cy2,s2,(h3(i,6,11)-.5)*.6);g.restore();}
    g.fillStyle='rgba(255,225,180,.18)';g.beginPath();g.ellipse(sr*.3,top-ry*.15,sr*.2,ry*.12,0,0,TAU);g.fill();}
  // The thick cut base: two rows of facets, each glinting a different colour bent in from outside.
  {g.save();g.clip(glass);g.beginPath();g.rect(-rx,-base,rx*2,base+ry);g.clip();
    // Mostly clear: the wood behind shows through, flipped and squeezed by the solid glass. Faint coffee colour
    // from above, crisp facet edges, and only a few facets catching a glint of neon, brightest along one edge.
    g.save();g.scale(-1,1);seeThrough(g,x,y,-rx,-base,rx*2,base+ry,1.4,.7);g.restore();
    g.fillStyle=lin(g,0,-base,0,ry,[[0,rgba(T[1],.45)],[.35,'rgba(200,215,225,.08)'],[1,'rgba(200,215,225,.14)']]);g.fillRect(-rx,-base,rx*2,base+ry);
    // A diamond cut all the way round: crossing diagonal cuts, so across the front the diamonds narrow toward the sides
    // and their points follow the curve of the glass. Only the ones facing us are drawn.
    const n=14,pt=(a,yy)=>[Math.cos(a)*bx,yy+Math.sin(a)*ry*.85],y0=-base,ym=-base*.5,y1=0;
    for(let i=0;i<n;i++){const a0=i/n*TAU,a1=a0+TAU/n,m=(a0+a1)/2,face=Math.sin(m);if(face<.05)continue;
      const fp=[pt(a0,ym),pt(m,y0),pt(a1,ym),pt(m,y1)];poly(g,fp);
      const r=h3(i,0,65);if(r<.3){const col=cols[(i*3)%cols.length];g.fillStyle=lin(g,fp[1][0],y0,fp[3][0],y1,[[0,rgba(col,.45*face)],[.5,rgba(col,.12)],[1,rgba(col,0)]]);g.fill();}
      else{g.fillStyle=`rgba(225,236,244,${(.02+r*.06*face).toFixed(3)})`;g.fill();}
      // Each diamond is cut as two sloping faces, so one half catches more light than the other.
      poly(g,[fp[0],fp[1],fp[3]]);g.fillStyle=`rgba(255,255,255,${(.03*face).toFixed(3)})`;g.fill();
      poly(g,fp);g.strokeStyle=`rgba(240,248,252,${(.1+.18*face).toFixed(3)})`;g.lineWidth=.04*k;g.stroke();
      if(h3(i,0,67)<.2){const c0=pt(m,ym-base*.1);g.fillStyle='rgba(255,255,255,.7)';g.fillRect(c0[0]-.08*k*face,c0[1],.16*k*face,.06*k);}}
    g.restore();}
  // Walls: thick glass, darker just inside each side, with soft highlights; the rim.
  g.fillStyle='rgba(10,16,22,.24)';poly(g,[[-rx,-h],[-rx+wall,-h],[-bx+wall,-base],[-bx,-base]]);g.fill();poly(g,[[rx-wall,-h],[rx,-h],[bx,-base],[bx-wall,-base]]);g.fill();
  g.fillStyle=lin(g,-rx,0,rx,0,[[0,'rgba(255,255,255,.1)'],[.06,'rgba(255,255,255,.02)'],[.94,'rgba(255,255,255,.02)'],[1,'rgba(255,255,255,.12)']]);g.fill(glass);
  g.fillStyle='rgba(255,255,255,.1)';poly(g,[[-rx*.55,-h*.92],[-rx*.46,-h*.92],[-bx*.44,-base*1.1],[-bx*.53,-base*1.1]]);g.fill();
  g.fillStyle=rgba(RIM,.14);poly(g,[[rx*.84,-h],[rx*.93,-h],[bx*.93,-base],[bx*.84,-base]]);g.fill();
  g.strokeStyle='rgba(240,248,252,.34)';g.lineWidth=.12*k;g.beginPath();g.ellipse(0,-h,rx,ry,0,0,TAU);g.stroke();g.strokeStyle='rgba(240,248,252,.18)';g.beginPath();g.ellipse(0,-h+.1*k,rx-wall,ry*.82,0,0,TAU);g.stroke();
  // Condensation on the cold part, below the coffee's surface.
  {g.save();g.clip(glass);const ct=Math.min(top+1*k,-h*.3);g.fillStyle=lin(g,0,ct,0,ry,[[0,'rgba(225,236,242,.02)'],[.3,'rgba(225,236,242,.06)'],[1,'rgba(225,236,242,.05)']]);g.fillRect(-rx,ct,rx*2,-ct+ry);
    for(let i=0;i<110;i++){const v=h3(i,1,13),yy=ct+v*(-ct+ry*.6),half=lerp(bx,rx,-yy/h),xx=(h3(i,2,13)*2-1)*half*.96,big=h3(i,4,13)<.12,r=(big?.3+h3(i,3,13)*.2:.07+h3(i,3,13)*.12)*k;
      g.fillStyle='rgba(205,222,232,.1)';g.beginPath();g.ellipse(xx,yy,r,r*(big?1.3:1.1),0,0,TAU);g.fill();g.fillStyle='rgba(255,255,255,.55)';g.beginPath();g.arc(xx-r*.32,yy-r*.38,r*(big?.22:.3),0,TAU);g.fill();}
    g.restore();}
  // A steel straw, sometimes.
  if(CUP.straw){const ax=-sr*.2,ay=top,sx1=rx*.6,sy1=-h-4*k,w=.5*k,dx=sx1-ax,dy=sy1-ay,dl=Math.hypot(dx,dy),nx=-dy/dl,ny=dx/dl,mx=(ax+sx1)/2,my=(ay+sy1)/2;
    g.fillStyle=lin(g,mx-nx*w/2,my-ny*w/2,mx+nx*w/2,my+ny*w/2,[[0,'#3a3e46'],[.3,'#e8ecf2'],[.5,'#9aa0aa'],[1,'#2a2e36']]);g.fill(ptsPath(tube([[ax,ay],[sx1,sy1]],w,w)));
    g.save();g.translate(sx1,sy1);g.rotate(Math.atan2(dy,dx)+Math.PI/2);g.fillStyle='#16181c';g.beginPath();g.ellipse(0,0,w*.5,w*.22,0,0,TAU);g.fill();g.strokeStyle='#c8ccd4';g.lineWidth=.05*k;g.stroke();g.restore();}
  g.restore();
}
// Steam: a few tapering ribbons that rise and wander on smooth noise, thin out as they climb, and are softened with
// a blur, drawn at half resolution into their own small canvas.
function drawSteam(g,x,y,k,str){
  if(str<.02||!STM)return;
  const s=S*.5,wU=STW/s,hU=STH/s,H=hU*.94,lean=(noise(t*.05+3)-.5)*6*k;
  stc.setTransform(1,0,0,1,0,0);stc.clearRect(0,0,STW,STH);stc.setTransform(s,0,0,s,STW/2,STH-1);
  for(let r=0;r<4;r++){const sd=r*13.7,N=28,c=[];
    // Two scales of drift, both carried upward over time, so each wisp bends and curls as it climbs.
    for(let i=0;i<=N;i++){const f=i/N,amp=(1+f*6)*k;c.push([(r-1.5)*.7*k*(1-f)+(noise(f*3.6-t*.42+sd)-.5)*amp*1.7+(noise(f*9-t*1.1+sd*3)-.5)*f*3.2*k+Math.sin(f*7-t*1.3+sd)*f*1.1*k+lean*f*f,-f*H]);}
    const gr=stc.createLinearGradient(0,0,0,-H);
    for(let j=0;j<=10;j++){const f=j/10,a=str*(r===3?.14:.38)*sstep(0,.12,f)*Math.pow(1-f,1.1)*(.25+.75*noise(f*5-t*.6+sd*2));gr.addColorStop(f,`rgba(248,238,228,${a.toFixed(3)})`);}
    stc.fillStyle=gr;stc.fill(ptsPath(tube(c,(.45+r*.1)*k,(r===3?4.6:2.2+r*.4)*k)));}
  g.save();g.setTransform(1,0,0,1,0,0);if(HASF)g.filter=`blur(${Math.max(1,S*.22*k).toFixed(1)}px)`;
  g.drawImage(STM,(x-wU/2)*S,(y-hU)*S+1,STW*2,STH*2);g.restore();
}
// A votive: amber glass, wax inside lit by the flame, and a flame that breathes and leans.
function drawCandle(g){
  if(!PROPS.candle)return;const k=sc(CANDY)*1.25,x=CANDX,y=Y(CANDY),f1=noise(t*5.2),f2=noise(t*13+4),R2=2.9*k,H=6.2*k,ry=.85*k;
  softShadow(g,x+.3*k,y+.4*k,4.6*k,1.3*k,.5);
  g.save();g.translate(x,y);
  const glass=new Path2D();glass.moveTo(-R2,-H);glass.lineTo(-R2*.95,0);glass.ellipse(0,0,R2*.95,ry,0,Math.PI,0,true);glass.lineTo(R2,-H);glass.closePath();
  g.fillStyle=lin(g,-R2,0,R2,0,[[0,'rgba(120,52,14,.85)'],[.3,'rgba(214,120,40,.7)'],[.55,'rgba(250,170,80,.62)'],[1,'rgba(110,46,12,.85)']]);g.fill(glass);
  g.save();g.clip(glass);
  const wy=-H*.42;g.fillStyle=lin(g,0,wy,0,ry,[[0,'rgba(255,232,196,.85)'],[1,'rgba(214,160,100,.85)']]);g.fillRect(-R2,wy,R2*2,-wy+ry);
  g.fillStyle=rad(g,0,wy-k,0,R2*1.7,[[0,`rgba(255,220,140,${(.45+f1*.2).toFixed(3)})`],[1,'rgba(255,160,60,0)']]);g.fillRect(-R2,-H,R2*2,H+ry);
  g.fillStyle='rgba(255,250,232,.42)';g.fillRect(-R2*.64,-H*.94,R2*.11,H*.86);g.fillStyle='rgba(255,250,232,.18)';g.fillRect(R2*.48,-H*.9,R2*.07,H*.8);
  g.fillStyle='rgba(60,20,4,.35)';g.fillRect(-R2,-.6*k,R2*2,ry+.6*k);
  g.restore();
  g.fillStyle=rad(g,0,wy,0,R2,[[0,'#fff3d4'],[1,'#e2bf86']]);g.beginPath();g.ellipse(0,wy,R2*.88,ry*.82,0,0,TAU);g.fill();
  g.strokeStyle='rgba(255,226,180,.55)';g.lineWidth=.15*k;g.beginPath();g.ellipse(0,-H,R2,ry,0,0,TAU);g.stroke();
  g.strokeStyle='#2a1a10';g.lineWidth=.2*k;g.beginPath();g.moveTo(0,wy);g.quadraticCurveTo(.12*k,wy-.5*k,.2*k,wy-.85*k);g.stroke();
  const fh=(2.5+f1*.9)*k,lean=(f2-.5)*.45*k,fb=wy-.6*k;
  g.globalCompositeOperation='lighter';
  g.fillStyle=rad(g,lean*.5,fb-fh*.45,0,fh,[[0,'rgba(255,160,60,.32)'],[1,'rgba(255,110,30,0)']]);g.beginPath();g.ellipse(lean*.5,fb-fh*.45,fh*.6,fh,0,0,TAU);g.fill();
  const flame=new Path2D();flame.moveTo(-.5*k,fb);flame.bezierCurveTo(-.72*k,fb-fh*.45,lean-.14*k,fb-fh*.8,lean,fb-fh);flame.bezierCurveTo(lean+.14*k,fb-fh*.8,.72*k,fb-fh*.45,.5*k,fb);flame.closePath();
  g.fillStyle=lin(g,0,fb,0,fb-fh,[[0,'rgba(80,110,255,.5)'],[.14,'rgba(255,200,110,.9)'],[.45,'rgba(255,238,196,1)'],[1,'rgba(255,160,60,.5)']]);g.fill(flame);
  g.fillStyle='rgba(255,255,245,.8)';g.beginPath();g.ellipse(lean*.2,fb-fh*.32,.2*k,fh*.22,0,0,TAU);g.fill();
  g.restore();
}
// A small bud vase of clear glass with a little water, and a daisy on a bent stem.
// A leaf: a pointed blade with a finely toothed edge, a pale midrib and side veins. Curled, it shows its paler underside.
function leaf(g,x0,y0,x1,y1,wd,under){
  const dx=x1-x0,dy=y1-y0,L=Math.hypot(dx,dy),nx=-dy/L,ny=dx/L,pts=[];
  for(const side of[1,-1]){const row=[];for(let i=0;i<=16;i++){const f=i/16,w=Math.sin(Math.PI*Math.pow(f,.8))*wd*(1-f*.15)*(i%2&&i<15?1.08:1)*side;row.push([x0+dx*f+nx*w,y0+dy*f+ny*w]);}pts.push(side>0?row:row.reverse());}
  const p=ptsPath(pts[0].concat(pts[1]));
  g.fillStyle=lin(g,x0+nx*wd,y0+ny*wd,x0-nx*wd,y0-ny*wd,under?[[0,'#7a9a62'],[1,'#56784a']]:[[0,'#5e8e44'],[.5,'#3e6a2e'],[1,'#26461c']]);g.fill(p);
  g.save();g.clip(p);g.strokeStyle=under?'rgba(220,240,200,.35)':'rgba(190,230,160,.4)';g.lineWidth=wd*.08;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();
  g.strokeStyle='rgba(190,230,160,.2)';g.lineWidth=wd*.04;for(let i=1;i<7;i++){const f=i/8,px=x0+dx*f,py=y0+dy*f;for(const sd of[1,-1]){g.beginPath();g.moveTo(px,py);g.quadraticCurveTo(px+dx*.05+nx*wd*.4*sd,py+dy*.05+ny*wd*.4*sd,px+dx*.1+nx*wd*.8*sd,py+dy*.1+ny*wd*.8*sd);g.stroke();}}
  g.fillStyle=lin(g,x0,y0,x1,y1,[[0,'rgba(0,0,0,0)'],[1,rgba(RIM,.18)]]);g.fill(p);g.restore();
  g.strokeStyle=rgba(RIM,.35);g.lineWidth=wd*.05;g.beginPath();for(const q of pts[0])g.lineTo(q[0],q[1]);g.stroke();}
// A daisy turned a little toward you: white petals backlit by the window, glowing at their edges, with fine veins;
// a domed centre packed with florets in a spiral, and the shadow it casts on the petals round it.
function daisy(g,x,y,r,col){
  g.save();g.translate(x,y);g.rotate(.2);
  const n=22;
  for(const back of[1,0])for(let i=0;i<n;i++){const a=i/n*TAU+h3(i,1,5)*.14,sa=Math.sin(a);if((sa<0)!==!!back)continue;const l=r*(.86+h3(i,2,5)*.24),w=r*(.15+h3(i,3,5)*.04),foreshort=.55+.45*Math.abs(Math.cos(a));
    g.save();g.scale(1,.62);g.rotate(a);g.scale(1,1/foreshort*.9);
    const pp=new Path2D();pp.moveTo(r*.22,0);pp.bezierCurveTo(l*.45,-w*1.2,l*.9,-w,l,-w*.2);pp.lineTo(l*.97,0);pp.lineTo(l,w*.2);pp.bezierCurveTo(l*.9,w,l*.45,w*1.2,r*.22,0);
    const lit=sa>0?1:.72;g.fillStyle=lin(g,r*.2,0,l,0,[[0,mixC(col,'#c8c890',.35)],[.25,shade(col,-.1*(1-lit))],[1,shade(col,(lit-1)*.35)]]);g.fill(pp);
    g.save();g.clip(pp);g.strokeStyle='rgba(150,140,120,.22)';g.lineWidth=r*.012;for(const o of[-.4,0,.4]){g.beginPath();g.moveTo(r*.3,o*w*.4);g.quadraticCurveTo(l*.6,o*w*.7,l*.95,o*w*.3);g.stroke();}
      g.fillStyle=rgba(RIM,.18*lit);g.fillRect(l*.55,-w*1.3,l*.5,w*2.6);g.restore();
    g.restore();}
  // Shadow of the centre on the petals, then the domed centre with its spiral of florets.
  g.fillStyle=rad(g,r*.05,r*.08,0,r*.5,[[0,'rgba(60,40,10,.35)'],[1,'rgba(60,40,10,0)']]);g.beginPath();g.ellipse(r*.05,r*.08,r*.5,r*.34,0,0,TAU);g.fill();
  g.fillStyle=rad(g,-r*.08,-r*.1,0,r*.34,[[0,'#f6cc4a'],[.6,'#d6941c'],[1,'#8a560c']]);g.beginPath();g.ellipse(0,0,r*.32,r*.24,0,0,TAU);g.fill();
  for(let i=0;i<70;i++){const a=i*2.39996,d=Math.sqrt(i/70)*r*.29,fx=Math.cos(a)*d,fy=Math.sin(a)*d*.75,sz=r*.022*(1.1-d/(r*.32)*.4);g.fillStyle=d<r*.1?'#f8d860':'#c8841a';g.beginPath();g.arc(fx,fy,sz,0,TAU);g.fill();g.fillStyle='rgba(255,240,180,.5)';g.fillRect(fx-sz*.4,fy-sz*.6,sz*.5,sz*.4);}
  g.fillStyle='rgba(255,250,220,.25)';g.beginPath();g.ellipse(-r*.08,-r*.09,r*.12,r*.06,0,0,TAU);g.fill();
  g.restore();
}
function drawVase(g){
  if(!PROPS.vase)return;const k=sc(21)*2,x=VASEX,y=Y(21),top=[.6*k,-12.4*k];
  softShadow(g,x+.3*k,y+.3*k,3.2*k,.95*k,.5);
  // Light through the glass and the water pools on the wood in front of it.
  g.save();g.globalCompositeOperation='lighter';g.translate(x+.2*k,y+.6*k);g.scale(1,.3);g.fillStyle=rad(g,0,0,0,2.4*k,[[0,'rgba(220,240,255,.14)'],[1,'rgba(220,240,255,0)']]);g.fillRect(-2.4*k,-2.4*k,4.8*k,4.8*k);g.restore();
  g.save();g.translate(x,y);
  const v=new Path2D();v.moveTo(-.55*k,-6.4*k);v.bezierCurveTo(-.6*k,-4.6*k,-2.2*k,-3.8*k,-2.2*k,-1.8*k);v.bezierCurveTo(-2.2*k,-.4*k,-1.4*k,0,0,0);v.bezierCurveTo(1.4*k,0,2.2*k,-.4*k,2.2*k,-1.8*k);v.bezierCurveTo(2.2*k,-3.8*k,.6*k,-4.6*k,.55*k,-6.4*k);v.closePath();
  // What's behind the vase, squeezed and flipped by the round belly of water, the way a glass of water bends it.
  const sx0=Math.round((x-2.6*k)*S),sy0=Math.round((y-4*k)*S),sw=Math.round(5.2*k*S),sh=Math.round(4*k*S);
  if(sx0>=0&&sy0>=0&&sx0+sw<=CW){g.save();g.clip(v);g.beginPath();g.rect(-2.3*k,-3.7*k,4.6*k,3.7*k);g.clip();g.translate(0,0);g.scale(-1,1);g.globalAlpha=.7;g.drawImage(g.canvas,sx0,sy0,sw,sh,-2.2*k,-3.7*k,4.4*k,3.7*k);g.globalAlpha=1;g.restore();}
  g.fillStyle='rgba(200,225,235,.08)';g.fill(v);
  g.save();g.clip(v);
  // Water, and the stem inside it, shifted sideways where it enters, as the water bends the light.
  g.fillStyle=lin(g,0,-3.6*k,0,0,[[0,'rgba(150,200,210,.16)'],[1,'rgba(70,120,130,.3)']]);g.fillRect(-3*k,-3.6*k,6*k,4*k);
  g.strokeStyle='rgba(70,110,50,.85)';g.lineWidth=.32*k;g.lineCap='round';g.beginPath();g.moveTo(.35*k,-.5*k);g.lineTo(.6*k,-3.6*k);g.stroke();
  g.strokeStyle='rgba(66,104,46,.75)';g.lineWidth=.3*k;g.beginPath();g.moveTo(.1*k,-3.6*k);g.lineTo(.15*k,-6.4*k);g.stroke();
  g.strokeStyle='rgba(235,250,255,.65)';g.lineWidth=.1*k;g.beginPath();g.ellipse(0,-3.6*k,1.92*k,.3*k,0,0,TAU);g.stroke();
  g.fillStyle=lin(g,-2.2*k,0,2.2*k,0,[[0,'rgba(20,30,40,.45)'],[.12,'rgba(0,0,0,0)'],[.88,'rgba(0,0,0,0)'],[1,'rgba(20,30,40,.45)']]);g.fillRect(-2.3*k,-6.5*k,4.6*k,6.6*k);
  // The thick glass base.
  g.fillStyle='rgba(210,230,238,.22)';g.beginPath();g.ellipse(0,-.35*k,1.6*k,.4*k,0,0,TAU);g.fill();
  g.restore();
  g.lineCap='round';g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=.12*k;g.beginPath();g.moveTo(-1.4*k,-3.4*k);g.quadraticCurveTo(-1.95*k,-2*k,-1.35*k,-.7*k);g.stroke();
  g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=.06*k;g.beginPath();g.moveTo(-.9*k,-3.8*k);g.quadraticCurveTo(-1.2*k,-2.6*k,-.95*k,-1.4*k);g.stroke();
  g.strokeStyle=rgba(RIM,.45);g.lineWidth=.1*k;g.beginPath();g.moveTo(1.6*k,-3*k);g.quadraticCurveTo(1.95*k,-1.9*k,1.5*k,-.9*k);g.stroke();
  g.strokeStyle='rgba(230,245,250,.4)';g.lineWidth=.08*k;g.beginPath();g.ellipse(0,-6.4*k,.6*k,.16*k,0,0,TAU);g.stroke();
  // The stem: a slender tube, lit on one side, with fine hairs; two leaves, one curled to show its underside.
  const sc3=[];bez([.15*k,-6.4*k],[.3*k,-8.4*k],[.95*k,-10*k],top,10,sc3);
  g.fillStyle=lin(g,-.2*k,0,.4*k,0,[[0,'#7aa858'],[.5,'#4a7a34'],[1,'#2a4a1e']]);g.fill(ptsPath(tube(sc3,.34*k,.24*k)));
  g.strokeStyle='rgba(200,230,170,.35)';g.lineWidth=.03*k;for(let i=1;i<sc3.length-1;i++){const q=sc3[i];g.beginPath();g.moveTo(q[0]-.14*k,q[1]);g.lineTo(q[0]-.26*k,q[1]-.1*k);g.stroke();}
  leaf(g,sc3[3][0],sc3[3][1],sc3[3][0]-2.4*k,sc3[3][1]-1.4*k,.45*k,false);
  leaf(g,sc3[5][0],sc3[5][1],sc3[5][0]+1.8*k,sc3[5][1]-.7*k,.35*k,true);
  daisy(g,top[0],top[1]-.4*k,2*k,PROPS.flower);
  g.restore();
}
// An open hardback, its pages bowing up toward the spine, lines of print, and a ribbon marker.
function drawBook(g){
  if(PROPS.extra!=='book')return;const k=sc(6)*1.55,x=Math.max(9*k,CUPX-20*k),y=Y(6),W=8.6*k,D=4.4*k,T=.7*k,cov=PROPS.cover;
  softShadow(g,x+.8*k,y+.2*k,11*k,2.4*k,.55);
  g.save();g.translate(x,y);g.rotate(-.035);
  g.fillStyle=shade(cov,-.45);poly(g,[[-W-.5*k,.15*k],[W+.5*k,.15*k],[W+.42*k,.6*k],[-W-.42*k,.6*k]]);g.fill();
  g.fillStyle=lin(g,0,-D,0,.2*k,[[0,shade(cov,-.2)],[1,cov]]);poly(g,[[-W-.5*k,.15*k],[W+.5*k,.15*k],[W*.95+.45*k,-D-.35*k],[-W*.95-.45*k,-D-.35*k]]);g.fill();
  for(const sg of[-1,1]){
    // The edge of the page block, lots of thin pages.
    g.fillStyle='#d6cab0';poly(g,[[sg*W,-T],[sg*W,0],[0,.05*k],[0,-T*.2]]);g.fill();
    g.strokeStyle='rgba(120,100,70,.35)';g.lineWidth=.04*k;for(let i=1;i<5;i++){const f=i/5;g.beginPath();g.moveTo(sg*W,-T*f);g.lineTo(0,-T*.2*f+.05*k*(1-f));g.stroke();}
    const pg=new Path2D();pg.moveTo(sg*W,-T);pg.lineTo(sg*W*.95,-D-T*.6);pg.bezierCurveTo(sg*W*.5,-D-T*1.5,sg*1.8*k,-D-T*1.7,0,-D+.3*k);pg.lineTo(0,-T*.2);pg.bezierCurveTo(sg*1.6*k,-T*1.9,sg*W*.5,-T*1.5,sg*W,-T);pg.closePath();
    g.fillStyle=lin(g,0,0,sg*W,0,[[0,'#a8987a'],[.12,'#e2d6bc'],[.4,'#f2e9d6'],[1,'#ece2cc']]);g.fill(pg);
    g.save();g.clip(pg);
    // Print: rows of words that rise a little toward the spine.
    g.fillStyle='rgba(58,48,40,.5)';
    for(let r=0;r<11;r++){const f=(r+.6)/11.5,yr=lerp(-T-.45*k,-D-T*.25,f),th=.12*k*(1-f*.35);let xx=sg*W*.9;
      while(sg>0?xx>1.3*k:xx<-1.3*k){const wl=(.5+h3(r,xx*3,sg)*1.6)*k*(1-f*.1),x2=xx-sg*wl,rise=Math.pow(1-Math.abs(xx)/W,3)*T*1.6;
        if(sg>0?x2<1.3*k:x2>-1.3*k)break;g.fillRect(Math.min(xx,x2),yr-rise-th/2,wl,th);xx=x2-sg*.35*k;}
      if(r===4)r+=1;}
    g.fillStyle=lin(g,0,0,sg*2.4*k,0,[[0,'rgba(60,40,20,.35)'],[1,'rgba(60,40,20,0)']]);g.fillRect(Math.min(0,sg*2.4*k),-D-2*k,2.4*k,D+2*k);
    g.restore();}
  g.strokeStyle='rgba(90,70,50,.5)';g.lineWidth=.06*k;g.beginPath();g.moveTo(0,-D+.3*k);g.lineTo(0,-T*.2);g.stroke();
  g.strokeStyle=PROPS.ribbon;g.lineWidth=.42*k;g.lineCap='butt';g.beginPath();g.moveTo(.1*k,-D*.6);g.bezierCurveTo(.4*k,-D*.2,-.3*k,0,.2*k,1.6*k);g.stroke();
  g.restore();}

// A spiral notepad lying flat, ruled, with a few lines of handwriting and a pen across it.
function drawNotepad(g){
  if(PROPS.extra!=='notepad')return;const k=sc(6)*1.5,x=Math.max(8*k,CUPX-18*k),y=Y(6),W=5.4*k,D=3.8*k;
  softShadow(g,x+.4*k,y+.4*k,8*k,2.2*k,.5);
  g.save();g.translate(x,y);g.rotate(-.07);
  g.fillStyle='#4e4034';poly(g,[[-W-.25*k,.32*k],[W+.25*k,.32*k],[W*.92+.25*k,-D-.25*k],[-W*.92-.25*k,-D-.25*k]]);g.fill();
  g.fillStyle='#ddd6c6';poly(g,[[-W,0],[W,0],[W,.3*k],[-W,.3*k]]);g.fill();
  g.strokeStyle='rgba(140,128,110,.5)';g.lineWidth=.03*k;for(let i=1;i<4;i++){g.beginPath();g.moveTo(-W,i*.075*k);g.lineTo(W,i*.075*k);g.stroke();}
  const pg=[[-W,0],[W,0],[W*.92,-D],[-W*.92,-D]];
  g.fillStyle=lin(g,0,-D,0,0,[[0,'#e6e0d0'],[.6,'#f4f0e4'],[1,'#ece6d6']]);poly(g,pg);g.fill();
  g.save();poly(g,pg);g.clip();
  // Ruled lines, closer together toward the far edge, and the margin.
  const rows=[];for(let i=1;i<10;i++){const f=i/10,yy=-D*(1-Math.pow(1-f,1.15))+.2*k;rows.push(yy);g.strokeStyle='rgba(110,140,190,.4)';g.lineWidth=.04*k;g.beginPath();g.moveTo(-W,yy);g.lineTo(W,yy);g.stroke();}
  g.strokeStyle='rgba(200,80,80,.45)';g.beginPath();g.moveTo(-W*.68,0);g.lineTo(-W*.63,-D);g.stroke();
  // Handwriting: loose, joined strokes along a few of the lines.
  g.strokeStyle=rgba(PROPS.ink,.55);g.lineWidth=.05*k;g.lineCap='round';g.lineJoin='round';
  for(let r=1;r<7;r++){if(r===4)continue;const yy=rows[9-r]-.1*k,x0=-W*.6,len=W*(.8+h3(r,3,1)*.7)*(r===6?.5:1);g.beginPath();
    for(let xx=0;xx<=len;xx+=.08*k){const loop=Math.sin(xx/k*14+r),wob=loop*.09*k*(.6+.4*Math.sin(xx/k*3.1+r))-(h3(Math.floor(xx/k*1.6),r,2)<.15?.1*k:0);if(h3(Math.floor(xx/k*1.9),r,5)<.16){g.moveTo(x0+xx+.12*k,yy);continue;}g.lineTo(x0+xx+loop*.04*k,yy+wob*(1-.3*r/7));}g.stroke();}
  g.restore();
  // The spiral along the far edge.
  g.strokeStyle='#8a8e96';g.lineWidth=.1*k;for(let i=0;i<15;i++){const xx=-W*.88+i*(W*1.76/14);g.beginPath();g.ellipse(xx,-D-.05*k,.16*k,.28*k,0,Math.PI*.9,Math.PI*2.1);g.stroke();}
  // The pen.
  g.save();g.translate(W*.32,-D*.45);g.rotate(-.5);
  g.fillStyle=lin(g,0,-.3*k,0,.3*k,[[0,shade(PROPS.pen,.45)],[.4,PROPS.pen],[1,shade(PROPS.pen,-.5)]]);rrect(g,-3.4*k,-.24*k,6.2*k,.48*k,.22*k);g.fill();
  g.fillStyle='#c8ccd4';g.beginPath();g.moveTo(2.8*k,-.2*k);g.lineTo(3.8*k,0);g.lineTo(2.8*k,.2*k);g.closePath();g.fill();g.fillStyle='#2a2a30';g.fillRect(3.6*k,-.04*k,.25*k,.08*k);
  g.fillStyle='#b8bcc6';g.fillRect(-3*k,-.36*k,2.4*k,.12*k);g.fillStyle='rgba(255,255,255,.4)';g.fillRect(-3.2*k,-.14*k,5.8*k,.06*k);
  g.restore();
  g.restore();
}
// The title and author on a spine, sized to fit, in gold on dark cloth or dark ink on pale.
function spine(g,b,w,h){
  if(!b.book)return;
  const{title,author,script}=b.book,vert=script==='japanese'||script==='chinese',light=hex(b.col).reduce((a,v)=>a+v,0)>420,ink=light?'rgba(40,28,20,.85)':'rgba(226,196,124,.92)',font=BFONT[script]||SERIF;
  g.save();g.fillStyle=ink;g.textAlign='center';g.textBaseline='middle';
  if(vert){
    // Characters stacked top to bottom, the author smaller at the foot.
    // The title takes the upper 56% of the spine and the author the lowest 22%, so they never meet.
    const tc=[...title],ac=[...author],fs=Math.min(w*.62,h*.56/(tc.length*1.08)),as=Math.min(fs*.72,w*.5,h*.22/(ac.length*1.08));
    g.font=`600 ${fs.toFixed(3)}px ${font}`;tc.forEach((ch,i)=>g.fillText(ch,w/2,-h+h*.08+fs*.54+i*fs*1.08));
    g.font=`${as.toFixed(3)}px ${font}`;ac.forEach((ch,i)=>g.fillText(ch,w/2,-h*.06-as*.54-(ac.length-1-i)*as*1.08));
  }else{
    // Running down the spine: title from the top, author at the foot.
    g.translate(w/2,-h);g.rotate(Math.PI/2);const L=h*.84;let fs=w*.44,as=fs*.66;
    const wf=(s,f,wt)=>{g.font=`${wt} ${f.toFixed(3)}px ${font}`;return g.measureText(s).width;};
    let tw=wf(title,fs,600),aw=wf(author,as,400);const need=tw+aw+fs*1.2;if(need>L){const k=L/need;fs*=k;as*=k;}
    g.textAlign='left';g.font=`600 ${fs.toFixed(3)}px ${font}`;g.fillText(title,h*.08,0);
    g.textAlign='right';g.font=`${as.toFixed(3)}px ${font}`;g.fillText(author,h*.93,0);
  }
  g.restore();
}
// A small open bookshelf standing on the counter: two side boards and a base, and a row of books, one leaning.
const SHELF_YU=23;
function shelfGeom(){let c=sc(SHELF_YU)*1.6;const w=(SHELF.inner+2.8)*c;if(w>VW*.32)c*=VW*.32/w;const W=(SHELF.inner+2.8)*c,x=PROPS.flowerLeft?VW-EDGE-W/2+2:EDGE+W/2-2;return{c,W,x};}
function drawShelf(g){
  const{c,W,x}=shelfGeom(),y=Y(SHELF_YU),H=20*c,bt=1.6*c,sd=1.4*c,wood=SHELF.wood;
  softShadow(g,x,y+.4*c,W*.62,2.6*c,.55);
  // The back of the shelf, in shadow.
  g.fillStyle=lin(g,0,y-H,0,y,[[0,shade(wood,-.55)],[1,shade(wood,-.7)]]);g.fillRect(x-W/2+sd,y-H+1*c,W-sd*2,H-bt-1*c);
  // Books, standing on the base.
  let bx=x-W/2+sd+.15*c;const base=y-bt;
  const book=(b,x0,ang)=>{const w=b.w*c,h=b.h*c;g.save();g.translate(x0,base);g.rotate(ang||0);
    g.fillStyle=lin(g,0,0,w,0,[[0,shade(b.col,-.5)],[.25,shade(b.col,.12)],[.45,b.col],[1,shade(b.col,-.45)]]);g.fillRect(0,-h,w,h);
    g.fillStyle='#e8e0cc';g.fillRect(w*.08,-h-.35*c,w*.84,.38*c);g.fillStyle=shade(b.col,-.2);g.fillRect(0,-h-.12*c,w,.14*c);
    const gold=mixC(b.col,'#d8b060',.7);for(let i=0;i<b.bands;i++){g.fillStyle=rgba(gold,.75);g.fillRect(0,-h+(1.4+i*.7)*c,w,.22*c);g.fillRect(0,-(2+i*.7)*c,w,.22*c);}
    spine(g,b,w,h);
    g.fillStyle=lin(g,0,-h,0,0,[[0,'rgba(255,200,140,.12)'],[.4,'rgba(0,0,0,0)'],[1,'rgba(0,0,0,.25)']]);g.fillRect(0,-h,w,h);
    g.restore();};
  for(const b of SHELF.books){book(b,bx,0);bx+=b.w*c+.05*c;}
  // The last one leans over against the side board.
  if(SHELF.lean)book(SHELF.lean,bx+.05*c,.32);
  // The side boards and the base, wood lit from above with the window's cool light on their edges.
  const board=(x0,w,y0,h)=>{g.fillStyle=lin(g,x0,0,x0+w,0,[[0,rgba(RIM,.35)],[.15,shade(wood,.15)],[.6,wood],[1,shade(wood,-.35)]]);g.fillRect(x0,y0,w,h);
    g.strokeStyle='rgba(20,10,4,.25)';g.lineWidth=.06*c;for(let i=1;i<4;i++){g.beginPath();g.moveTo(x0+w*i/4,y0);g.lineTo(x0+w*i/4+.1*c,y0+h);g.stroke();}};
  board(x-W/2,sd,y-H,H);board(x+W/2-sd,sd,y-H,H);
  g.fillStyle=lin(g,0,y-bt,0,y,[[0,shade(wood,.2)],[1,shade(wood,-.3)]]);g.fillRect(x-W/2,y-bt,W,bt);
  g.fillStyle=shade(wood,.35);g.fillRect(x-W/2,y-H,sd,.25*c);g.fillRect(x+W/2-sd,y-H,sd,.25*c);
}

/* ---------- the cup ---------- */
function cupRest(){const k=sc(8)*1.45;return{x:CUPX,y:8,k};}
// How far the cup or glass is raised: by its saucer, or by the LED coaster under a glass.

/* ---------- the refill robot ---------- */
// A hatch in the counter opens and a little robot rises out of it on a lift. It rolls over to the cup, swings its
// spout over the rim and pours from the tank on its back, then rolls home and sinks out of sight.
const BOT_YU=13,BOT_D={open:.8,rise:1.1,go:0,pour:3,back:0,sink:1.1,shut:.8};
const botK=()=>sc(BOT_YU)*1.3;
function botStop(){const c=cupRest(),G=cupGeom(c.x,c.y,c.k);return c.x+G.rx+7*botK();}
function hatchX(){return Math.min(VW-7*botK(),botStop()+13*botK());}
function drawHatch(g){
  const k=botK(),x=hatchX(),y=Y(BOT_YU),w=9.5*k,d=1.7*k;
  let o=0;if(bot.state==='open')o=ease(bot.k);else if(bot.state==='shut')o=1-ease(bot.k);else if(bot.state!=='off')o=1;
  // A brushed steel rim set flush in the wood, and a lid that slides away to show a lit shaft.
  g.strokeStyle='rgba(12,5,2,.4)';g.lineWidth=.1;rrect(g,x-w,y-d,w*2,d*2,.5*k);g.stroke();
  g.strokeStyle='rgba(200,170,140,.12)';g.lineWidth=.08;rrect(g,x-w+.1,y-d+.12,w*2-.2,d*2-.2,.45*k);g.stroke();
  if(o<=0)return;
  g.save();rrect(g,x-w,y-d,w*2,d*2,.5*k);g.clip();
  g.fillStyle=lin(g,0,y-d,0,y+d,[[0,'#020103'],[1,'#120a0a']]);g.fillRect(x-w,y-d,w*2*o,d*2);
  g.globalCompositeOperation='lighter';g.fillStyle=lin(g,0,y-d,0,y-d*.2,[[0,rgba(BOT.eye,.4*o)],[1,rgba(BOT.eye,0)]]);g.fillRect(x-w,y-d,w*2*o,d);g.globalCompositeOperation='source-over';
  g.fillStyle=lin(g,0,y-d,0,y+d,[[0,'#6a3a1e'],[1,'#4a2612']]);g.fillRect(x-w+w*2*o,y-d,w*2,d*2);
  g.fillStyle='rgba(20,8,2,.5)';g.fillRect(x-w+w*2*o-.25,y-d,.25,d*2);
  g.restore();
}
function drawBot(g){
  if(bot.state==='off'||bot.state==='open'||bot.state==='shut')return;
  const k=botK(),gy=Y(BOT_YU),x=bot.x,hx=hatchX();
  let rise=1;if(bot.state==='rise')rise=ease(bot.k);else if(bot.state==='sink')rise=1-ease(bot.k);
  const by=gy+(1-rise)*15*k,roll=(hx-x)/(1.9*k);
  g.save();
  if(rise<1){g.beginPath();g.rect(0,0,VW,gy+1.2*k);g.clip();}
  if(rise>.9)softShadow(g,x,gy+.3*k,8*k,1.6*k,.5);
  g.translate(x,by);g.scale(k,k);
  const C=BOT.body;
  // Rubber wheels with metal hubs.
  for(const wx of[-4,4]){g.fillStyle=rad(g,wx-.5,-2.4,0,2.1,[[0,'#3a363e'],[.75,'#1a171c'],[1,'#0a080a']]);g.beginPath();g.arc(wx,-1.9,1.9,0,TAU);g.fill();
    g.strokeStyle='rgba(80,76,86,.6)';g.lineWidth=.12;for(let i=0;i<8;i++){const a=roll+i*TAU/8;g.beginPath();g.moveTo(wx+Math.cos(a)*1.55,-1.9+Math.sin(a)*1.55);g.lineTo(wx+Math.cos(a)*1.85,-1.9+Math.sin(a)*1.85);g.stroke();}
    g.fillStyle=lin(g,0,-2.8,0,-1,[[0,'#e8ecf2'],[.5,'#8a909a'],[1,'#4a4e56']]);g.beginPath();g.arc(wx,-1.9,.75,0,TAU);g.fill();}
  // Body: glossy moulded plastic, lit from above, with a rubber bumper and a seam.
  const bp=new Path2D();bp.moveTo(-6+1.8,-11);bp.arcTo(6,-11,6,-2.8,1.8);bp.arcTo(6,-2.8,-6,-2.8,1.2);bp.arcTo(-6,-2.8,-6,-11,1.2);bp.arcTo(-6,-11,6,-11,1.8);bp.closePath();
  g.fillStyle=lin(g,0,-11,0,-2.8,[[0,shade(C,.3)],[.25,C],[.75,shade(C,-.25)],[1,shade(C,-.5)]]);g.fill(bp);
  g.save();g.clip(bp);
  g.fillStyle=lin(g,-6,0,6,0,[[0,'rgba(0,0,0,.25)'],[.25,'rgba(0,0,0,0)'],[.8,'rgba(0,0,0,0)'],[1,'rgba(0,0,0,.35)']]);g.fillRect(-6,-11,12,8.2);
  g.fillStyle='rgba(255,255,255,.4)';rrect(g,-4.6,-10.6,9.2,.55,.3);g.fill();
  g.fillStyle=lin(g,0,-4.4,0,-2.8,[[0,'#2a262c'],[1,'#121014']]);g.fillRect(-6,-4.4,12,1.6);
  g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=.08;g.beginPath();g.moveTo(1.2,-11);g.lineTo(1.2,-4.4);g.stroke();
  g.fillStyle=rgba(RIM,.25);g.fillRect(4.9,-11,1.1,6.6);
  g.restore();
  // Its face, a dark glass screen with two lit eyes that blink.
  g.fillStyle=lin(g,0,-10.2,0,-6.8,[[0,'#1a1a22'],[1,'#050508']]);rrect(g,-5.6,-10.2,5,3.4,.9);g.fill();
  g.fillStyle='rgba(255,255,255,.12)';poly(g,[[-5.2,-10],[-3.4,-10],[-4.4,-7],[-5.4,-7]]);g.fill();
  const blink=(t*.7+x)%4<.12;g.fillStyle=BOT.eye;if(blink){g.fillRect(-4.8,-8.5,1.4,.22);g.fillRect(-2.6,-8.5,1.4,.22);}else{rrect(g,-4.8,-9.4,1.4,1.6,.4);g.fill();rrect(g,-2.6,-9.4,1.4,1.6,.4);g.fill();}
  // The coffee tank on its back: clear glass, a steel cap, coffee going down as it pours.
  const tk=new Path2D();tk.moveTo(-1.6,-16.6);tk.lineTo(4,-16.6);tk.quadraticCurveTo(4.4,-16.6,4.4,-16.2);tk.lineTo(4.4,-11.4);tk.quadraticCurveTo(4.4,-10.8,3.8,-10.8);tk.lineTo(-1.4,-10.8);tk.quadraticCurveTo(-2,-10.8,-2,-11.4);tk.lineTo(-2,-16.2);tk.quadraticCurveTo(-2,-16.6,-1.6,-16.6);tk.closePath();
  g.fillStyle='rgba(190,220,235,.16)';g.fill(tk);
  g.save();g.clip(tk);const lv=-10.8-5.4*bot.tank;g.fillStyle=lin(g,-2,0,4.4,0,[[0,'#1a0c04'],[.4,'#4a2610'],[1,'#1e0e06']]);g.fillRect(-3,lv,9,8);
  g.fillStyle='rgba(160,100,60,.6)';g.fillRect(-2,lv,6.4,.25);
  g.fillStyle=lin(g,-2,0,4.4,0,[[0,'rgba(0,0,0,.35)'],[.2,'rgba(0,0,0,0)'],[.8,'rgba(0,0,0,0)'],[1,'rgba(0,0,0,.4)']]);g.fillRect(-2,-16.6,6.4,5.8);g.restore();
  g.fillStyle='rgba(255,255,255,.55)';g.fillRect(-1.2,-15.8,.32,4.2);g.fillStyle=rgba(RIM,.4);g.fillRect(3.7,-15.6,.22,3.8);
  g.fillStyle=lin(g,0,-17.5,0,-16.3,[[0,'#e4e8ee'],[.5,'#8a9098'],[1,'#3e424a']]);rrect(g,-2.3,-17.5,7,1.2,.4);g.fill();
  // Antenna with a blinking tip.
  g.strokeStyle='#5a5e66';g.lineWidth=.2;g.beginPath();g.moveTo(4.8,-11);g.lineTo(5.4,-14.8);g.stroke();
  g.restore();
  g.save();g.globalCompositeOperation='lighter';
  glow(g,x+5.4*k,by-15*k,1.4*k,BOT.eye,(t*2)%1<.5?.8:.25);glow(g,x-2.8*k,by-8.6*k,3.2*k,BOT.eye,.35);
  g.restore();
  // The arm: steel, from the top of the body, folded at rest and out over the cup when it pours.
  const sh=[x-1.6*k,by-11*k],c=cupRest(),G=cupGeom(c.x,c.y,c.k),mouth=[c.x+.8*c.k,Y(c.y)-G.h];
  const fold=[x-3.6*k,by-14.6*k],reach=[mouth[0]+1.4*k,mouth[1]-3.4*k],a=bot.arm;
  const tip=[lerp(fold[0],reach[0],a),lerp(fold[1],reach[1],a)],mid=[(sh[0]+tip[0])/2+.6*k,Math.min(sh[1],tip[1])-(2.6+a*2.4)*k];
  g.lineCap='round';g.lineJoin='round';
  for(const[w,col]of[[1.15,'#3a3e46'],[.8,'#9aa0aa'],[.28,'rgba(255,255,255,.6)']]){g.strokeStyle=col;g.lineWidth=w*k;g.beginPath();g.moveTo(sh[0],sh[1]-(w<.5?.25*k:0));g.lineTo(mid[0],mid[1]-(w<.5?.25*k:0));g.lineTo(tip[0],tip[1]-(w<.5?.25*k:0));g.stroke();}
  g.fillStyle=rad(g,mid[0]-.2*k,mid[1]-.2*k,0,.8*k,[[0,shade(C,.3)],[1,shade(C,-.35)]]);g.beginPath();g.arc(mid[0],mid[1],.75*k,0,TAU);g.fill();
  g.save();g.translate(tip[0],tip[1]);g.rotate(-.3-a*.9);g.fillStyle=lin(g,0,-.6*k,0,.7*k,[[0,'#d8dce4'],[.5,'#6a707a'],[1,'#2a2e36']]);rrect(g,-2.2*k,-.6*k,2.6*k,1.3*k,.4*k);g.fill();g.restore();
  if(bot.state==='pour'&&a>.95&&bot.k<.88){const nx=tip[0]-1.6*k,ny=tip[1]+.9*k;
    g.strokeStyle=lin(g,nx,0,nx+.5*k,0,[[0,'#2a1206'],[.5,'#6a3a18'],[1,'#2a1206']]);g.lineWidth=.55*k;g.lineCap='round';g.beginPath();g.moveTo(nx,ny);g.quadraticCurveTo(nx-.3*k,(ny+mouth[1])/2,mouth[0],mouth[1]+1.2*c.k);g.stroke();
    g.strokeStyle='rgba(255,220,180,.4)';g.lineWidth=.12*k;g.stroke();}
}

/* ---------- the cat ---------- */
// The cat walks along the counter by the glass, curls up somewhere and sleeps, then stretches and goes.
const CATS=[
  {name:'ginger cat',base:'#bd7840',light:'#e0a66a',dark:'#6e3c1c',belly:'#ead0ae',stripes:true},
  {name:'black cat',base:'#221e24',light:'#4a4248',dark:'#0b090c'},
  {name:'grey tabby',base:'#7a787c',light:'#a8a5a9',dark:'#403e44',belly:'#c8c4c0',stripes:true},
  {name:'white cat',base:'#e2dcd2',light:'#faf6ee',dark:'#a29a8e'},
  {name:'brown tabby',base:'#7a5c40',light:'#a8875e',dark:'#3a2818',belly:'#ccb290',stripes:true},
  {name:'tuxedo cat',base:'#242026',light:'#4a444c',dark:'#0d0b0e',belly:'#ebe5da',paws:'#ebe5da'}
];
function newCat(){
  // It settles at the flower's end of the counter, never in the middle.
  const left=PROPS.flowerLeft,d=PROPS.candle?28:20,best=left?Math.min(VW*.35,VASEX+d):Math.max(VW*.65,VASEX-d);
  cat={x:left?-18:VW+18,dir:left?1:-1,sp:rr(7,11),target:best,state:'walk',ph:0,k:0,sleep:rr(60,260),C:pick(CATS),eyes:pick(['#c8a83a','#86b04a','#d8902a','#8ab8c8']),stay:chance(.8),seed:ri(1,9999)};
  log(pick([`A ${catName()} jumps up onto the counter`,`A ${catName()} hops onto the counter by the window`,`A ${catName()} pads along the counter`]));}
function catName(){return cat?cat.C.name:'cat';}
// Fur: a shape lit from above, strands drawn over it, a fringe of hairs round its edge, and the window's light caught
// in the hairs along the top. The strands come from a fixed hash, so they stay put from frame to frame.
function fur(g,pts,C,seed,o){
  o=o||{};const p=ptsPath(pts);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const[x,y]of pts){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  const cx=(x0+x1)/2,cy=(y0+y1)/2,w=x1-x0,h=y1-y0;
  g.fillStyle=lin(g,0,y0,0,y1,[[0,C.light],[.5,C.base],[1,C.dark]]);g.fill(p);
  g.save();g.clip(p);
  if(o.belly&&C.belly){const[bx,by,brx,bry]=o.belly;g.save();g.translate(bx,by);g.scale(1,bry/brx);g.fillStyle=rad(g,0,0,0,brx,[[0,rgba(C.belly,.85)],[.6,rgba(C.belly,.55)],[1,rgba(C.belly,0)]]);g.fillRect(-brx,-brx,brx*2,brx*2);g.restore();}
  // Tabby markings: wide, faint bands that waver over the body and fade toward the belly.
  if(C.stripes&&o.stripes!==false){g.lineCap='round';for(let i=0;i<Math.ceil(w/6);i++){const sx=x0+i*6+h3(i,seed,9)*3;
      g.strokeStyle=rgba(C.dark,(.16+h3(i,seed,6)*.12).toFixed(3));g.lineWidth=2.2+h3(i,seed,8)*2.6;g.beginPath();g.moveTo(sx,y0-2);
      for(let j=1;j<=4;j++){const yy=y0-2+j*h*.16;g.lineTo(sx+(h3(i,seed,j+20)-.5)*3+j*.6,yy);}g.stroke();}}
  const n=o.n||Math.min(240,Math.round(w*h/12)),ang=o.ang||0;
  for(const[col,al,key]of[[C.dark,.28,1],[C.light,.24,2],[C.base,.4,3]]){g.strokeStyle=rgba(col,al);g.lineWidth=.38;g.beginPath();
    for(let i=0;i<n;i++){const x=x0+h3(i,seed,key)*w,y=y0+h3(i,seed,key+10)*h,a=ang+(h3(i,seed,key+20)-.5)*.7,l=1.6+h3(i,seed,key+30)*2.6;g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);}g.stroke();}
  // Roundness: light on the upper back, falling away toward the outline, darker underneath.
  g.fillStyle=rad(g,cx-w*.08,y0+h*.3,0,Math.max(w,h)*.62,[[0,'rgba(255,236,210,.16)'],[.55,'rgba(0,0,0,0)'],[1,'rgba(0,0,0,.3)']]);g.fillRect(x0,y0,w,h);
  g.fillStyle=lin(g,0,y1-h*.4,0,y1,[[0,'rgba(0,0,0,0)'],[1,'rgba(0,0,0,.38)']]);g.fillRect(x0,y1-h*.4,w,h*.4);
  g.restore();
  if(o.inner)return;
  // The window behind catches the top edge: a soft rim of light just inside the outline.
  g.save();g.clip(p);g.strokeStyle=lin(g,0,y0,0,y0+h*.5,[[0,rgba(RIM,.32)],[1,rgba(RIM,0)]]);g.lineWidth=2.4;g.stroke(p);g.restore();
  // A fringe of short, fine hairs round the edge, in the fur's own colour.
  g.lineCap='round';g.beginPath();
  for(let i=1;i<pts.length-1;i++){const[a,b]=pts[i],tx=pts[i+1][0]-pts[i-1][0],ty=pts[i+1][1]-pts[i-1][1],l=Math.hypot(tx,ty)||1;let nx=ty/l,ny=-tx/l;if(nx*(a-cx)+ny*(b-cy)<0){nx=-nx;ny=-ny;}
    for(let j=0;j<2;j++){const L=.4+h3(i,seed,40+j)*1,sl=(h3(i,seed,50+j)-.5)*1.2;g.moveTo(a-nx*.5+tx/l*sl,b-ny*.5+ty/l*sl);g.lineTo(a+nx*L+tx/l*(sl+.4),b+ny*L+ty/l*(sl+.4));}}
  g.strokeStyle=rgba(mixC(C.base,C.light,.25),.4);g.lineWidth=.4;g.stroke();
}
// A slow blink every few seconds.
const catBlink=sd=>((t+sd*7.3)%4.7)<.16;
function catEye(g,x,y,w,h,col,open){
  if(!open){g.strokeStyle='rgba(18,10,8,.85)';g.lineWidth=.8;g.lineCap='round';g.beginPath();g.moveTo(x-w,y);g.quadraticCurveTo(x,y+h*.9,x+w,y-.3);g.stroke();return;}
  const p=new Path2D();p.moveTo(x-w,y);p.quadraticCurveTo(x,y-h*1.25,x+w,y-.4);p.quadraticCurveTo(x,y+h,x-w,y);
  g.fillStyle=rad(g,x+.3,y,0,w,[[0,shade(col,.35)],[.6,col],[1,shade(col,-.5)]]);g.fill(p);
  g.save();g.clip(p);g.fillStyle='#080404';g.beginPath();g.ellipse(x+.4,y-.15,w*.17,h*.95,0,0,TAU);g.fill();g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x-w,y-h*1.3,w*2,h*.75);g.restore();
  g.strokeStyle='rgba(14,8,6,.9)';g.lineWidth=.5;g.stroke(p);
  g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.arc(x-.5,y-.7,.45,0,TAU);g.fill();
}
function catNose(g,x,y,s){g.fillStyle=lin(g,0,y-s,0,y+s,[[0,'#d49090'],[1,'#9a5656']]);g.beginPath();g.moveTo(x-s,y-s*.5);g.lineTo(x+s*.6,y-s*.6);g.lineTo(x,y+s*.6);g.closePath();g.fill();}
function whiskers(g,x,y){g.strokeStyle='rgba(240,236,228,.5)';g.lineWidth=.22;g.lineCap='round';g.beginPath();for(let i=0;i<4;i++){g.moveTo(x,y+i*.6);g.quadraticCurveTo(x+9,y-1.4+i*1.2,x+17,y-2+i*2.6);}g.stroke();}
const innerEar=g=>'rgba(206,138,138,.55)';
// A head in profile facing +x, centred on (x, y), about 30 units across.
function catHead(g,x,y,C,sd,open){
  g.save();g.translate(x,y);
  const tw=Math.sin(t*8)*(Math.sin(t*.41+sd)>.94?1.5:0),D={...C,base:shade(C.base,-.2),light:shade(C.light,-.2)};
  fur(g,chain([[[-8,-6],[-9,-15],[-7,-22],[-5+tw*.5,-24]],[[-5+tw*.5,-24],[-1,-18],[2,-13],[3,-10]]],5).concat([[-5,-6]]),D,sd+5,{n:24,stripes:false});
  fur(g,chain([[[-11,2],[-13,-12],[8,-15],[12,-6]],[[12,-6],[15,-2],[20,0],[19,4]],[[19,4],[18,9],[10,11],[2,10]],[[2,10],[-8,10],[-11,6],[-11,2]]],8),C,sd+6,{n:110,belly:C.belly?[14,7,7,4]:null});
  fur(g,chain([[[0,-10],[3,-18],[6,-23],[8+tw,-25]],[[8+tw,-25],[10,-18],[11,-12],[10,-6]]],5).concat([[3,-7]]),C,sd+7,{n:24,stripes:false});
  g.fillStyle=innerEar();g.beginPath();g.moveTo(3.4,-10);g.quadraticCurveTo(7,-20,8,-21.5);g.quadraticCurveTo(9.4,-15,9,-9);g.closePath();g.fill();
  g.fillStyle=rgba(C.belly||C.light,.45);g.beginPath();g.ellipse(14,3,6,4,0,0,TAU);g.fill();
  catEye(g,8.6,-2,3.4,2.2,cat.eyes,open&&!catBlink(sd));catNose(g,18.4,0,1.5);whiskers(g,15,3.6);
  g.restore();
}
// Asleep: a curled oval with the head tucked on its paws and the tail wrapped round the front.
function catCurl(g,C,sd,state){
  const br=1+Math.sin(t*1.5)*.02;
  g.save();g.scale(1,br);
  fur(g,chain([[[-44,0],[-58,-4],[-56,-38],[-24,-44]],[[-24,-44],[2,-49],[28,-42],[38,-26]],[[38,-26],[44,-14],[40,0],[30,0]],[[30,0],[8,2],[-22,2],[-44,0]]],12),C,sd,{belly:C.belly?[8,-4,28,7]:null});
  g.restore();
  {const tw=Math.pow(Math.max(0,Math.sin(t*.5+sd*2)),10),base=[1.2,.7,.35,.15,.05,0,-.05,-.1,-.15,-.2,-.25,-.3].map((a,i)=>i>8?a-tw*(i-8)*.35:a);
    fur(g,tube(tailChain([-46,-6],base,6,.04,.7,.4,sd),12,6),C,sd+1,{});}
  if(C.paws){g.fillStyle=C.paws;g.beginPath();g.ellipse(30,-1.5,7,3,0,0,TAU);g.fill();}
  const tw=Math.sin(t*9)*(Math.sin(t*.37+sd)>.93?2:0),D={...C,base:shade(C.base,-.15),light:shade(C.light,-.15)};
  fur(g,chain([[[24,-24],[21,-34],[23,-42],[26+tw,-44]],[[26+tw,-44],[31,-38],[34,-33],[36,-30]]],6).concat([[30,-25]]),D,sd+2,{n:30,stripes:false});
  fur(g,chain([[[40,-30],[44,-38],[48,-44],[50,-45]],[[50,-45],[52,-36],[52,-30],[51,-24]]],6).concat([[44,-24]]),D,sd+3,{n:30,stripes:false});
  g.fillStyle=innerEar();g.beginPath();g.moveTo(27.5,-28.5);g.quadraticCurveTo(26,-37,26.5,-40);g.quadraticCurveTo(31,-34,33,-30);g.closePath();g.fill();
  g.beginPath();g.moveTo(43.5,-27.5);g.quadraticCurveTo(48,-38,49,-41);g.quadraticCurveTo(50,-34,49.2,-27.5);g.closePath();g.fill();
  fur(g,chain([[[20,-16],[18,-32],[52,-36],[54,-16]],[[54,-16],[55,-2],[22,0],[20,-16]]],10),C,sd+4,{n:120,belly:C.belly?[39,-8,9,5]:null});
  g.fillStyle=rgba(C.belly||C.light,.4);g.beginPath();g.ellipse(39,-9,6.5,4,0,0,TAU);g.fill();
  for(const ex of[31,46])catEye(g,ex,-16.5,3.6,2,cat.eyes,state==='wake'&&cat.k>1&&!catBlink(sd));
  catNose(g,39,-11.4,1.9);whiskers(g,41,-9);
  g.save();g.scale(-1,1);whiskers(g,-37,-9);g.restore();
}
const rot=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];
const darker=(C,k)=>({...C,base:shade(C.base,-k),light:shade(C.light,-k),dark:shade(C.dark,-k*.8)});
// Sitting up in profile: a round haunch, a deep chest, front legs straight down and the tail round its paws.
function catSit(g,C,sd,state){
  const groom=state==='groom',lick=groom?Math.sin(t*7):0,br=Math.sin(t*1.7+sd)*.014;
  // Breathing: the chest and flank swell a little and settle.
  g.save();g.translate(0,-30);g.scale(1+br*.4,1+br);g.translate(0,30);
  fur(g,chain([[[-26,0],[-40,-2],[-40,-28],[-27,-40]],[[-27,-40],[-18,-50],[-4,-58],[4,-62]],[[4,-62],[14,-60],[21,-52],[21,-40]],[[21,-40],[21,-30],[18,-24],[17,-14]],[[17,-14],[17,-6],[20,-1],[22,0]],[[22,0],[6,1],[-12,1],[-26,0]]],10),C,sd,{ang:-1.1,belly:C.belly?[16,-38,7,16]:null});
  // The near haunch, blended in, and the line of the near front leg.
  fur(g,chain([[[-36,-6],[-40,-24],[-22,-32],[-10,-23]],[[-10,-23],[-2,-14],[-6,-2],[-16,0]],[[-16,0],[-26,1],[-34,0],[-36,-6]]],8),{...C,light:mixC(C.light,C.base,.4)},sd+3,{ang:-.6,n:100,inner:true});
  g.restore();
  g.strokeStyle=rgba(C.dark,.35);g.lineWidth=1.2;g.lineCap='round';g.beginPath();g.moveTo(8,-32);g.quadraticCurveTo(7,-16,9,-2);g.stroke();
  g.strokeStyle=rgba(C.light,.25);g.lineWidth=.8;g.beginPath();g.moveTo(10,-30);g.quadraticCurveTo(9,-16,11,-3);g.stroke();
  if(C.paws){g.fillStyle=C.paws;for(const px of[12,19]){g.beginPath();g.ellipse(px,-1.6,4.4,2,0,0,TAU);g.fill();}}
  // Tail round the paws. Now and then the tip lifts, flicks and taps down again.
  {const flick=Math.pow(Math.max(0,Math.sin(t*.9+sd)),6),base=[2.7,2.2,1.4,.6,.2,.05,0,0,0,-.05,-.1,-.15].map((a,i)=>i>8?a-flick*(i-8)*.45:a);
    fur(g,tube(tailChain([-34,-3],base,6,.06,1.4,.4,sd),9,4.6),C,sd+1,{});}
  // It looks about slowly, the head turning a little this way and that.
  g.save();g.translate(12,-64);g.rotate(groom?.35+lick*.06:(noise(t*.13+sd)-.5)*.42);g.scale(1.15,1.15);catHead(g,2,-8,C,sd,!groom||lick<0);g.restore();
  if(groom)fur(g,tube([[16,-40],[22,-52+lick*1.5],[24,-62+lick*2]],8,6),C,sd+12,{n:30,stripes:false});
}
// Walking or stretching in profile. Each leg runs hip, knee, hock and paw, thick at the top and fine at the foot.
function catWalk(g,C,sd,state){
  const walking=state==='walk',st=state==='stretch'?Math.sin(clamp(cat.k/2.4,0,1)*Math.PI):0,u=cat.ph/TAU,w=walking?1:0;
  // The hips and shoulders rise over whichever leg is planted beneath them, twice a stride, the shoulders a quarter
  // cycle behind the hips, and the near shoulder blade rolls up through the back as its leg takes the weight. The
  // body's outline is built round those points, so the back flexes as it walks. Stretching, the front goes down.
  const hy=-40-w*1.5*Math.cos(4*Math.PI*u)-st*4,sy=-40-w*1.5*Math.cos(4*Math.PI*(u+.25))+st*12,mid=(hy+sy)/2,scap=w*Math.max(0,Math.sin(TAU*(u+.4)))*2.4;
  const hind=(hx,off,far)=>{const[a,bd]=walking?gl(u+off,.38):[0,0],lift=bd*3.5,hip=[hx,hy];
    const knee=[hip[0]+rot([5,20],-a)[0],hip[1]+rot([5,20],-a)[1]],hock=[knee[0]+rot([-9,11],-a*.6)[0],knee[1]+rot([-9,11],-a*.6)[1]],paw=[hock[0]+3+Math.sin(a)*4,-1-lift];
    fur(g,tube([hip,knee,hock,paw],15,4.8),far?darker(C,.25):C,sd+Math.round(hx)+(far?7:0),{ang:Math.PI/2,n:60,stripes:false});
    if(C.paws){g.fillStyle=far?shade(C.paws,-.25):C.paws;g.beginPath();g.ellipse(paw[0]+2,paw[1]-.5,3.8,1.8,0,0,TAU);g.fill();}return{hip,knee};};
  const fore=(hx,off,far)=>{const[a,bd]=walking?gl(u+off,.4):[0,0],lift=bd*3.5,sh=[hx,sy+2];
    const elbow=[sh[0]+rot([-1,15],-a)[0]+st*8,sh[1]+rot([-1,15],-a)[1]-st*4],wrist=[elbow[0]+rot([2,16],-a*.9)[0]+st*12,elbow[1]+rot([2,16],-a*.9)[1]],paw=[wrist[0]+3+st*4,-1-lift];
    fur(g,tube([sh,elbow,wrist,paw],11,4.6),far?darker(C,.25):C,sd+Math.round(hx)+(far?9:0),{ang:Math.PI/2,n:50,stripes:false});
    if(C.paws){g.fillStyle=far?shade(C.paws,-.25):C.paws;g.beginPath();g.ellipse(paw[0]+2,paw[1]-.5,3.8,1.8,0,0,TAU);g.fill();}return{sh,elbow};};
  // Legs first, so they come out from under the body.
  hind(-20,.5,true);fore(20,.75,true);
  // Tail held up in a question mark, rising and falling with the hips and swaying a beat behind them.
  fur(g,tube(tailChain([-33,hy-9],[3.5,3.75,4,4.25,4.45,4.6,4.75,4.9,5.2,5.5],4.6,.2,1.6,.45,sd),8,4.2),C,sd+1,{});
  const nh=hind(-16,0,false),nf=fore(24,.25,false);
  // A short, deep body: rounded rump, a back that dips behind the shoulders, a deep chest and the belly tucking up
  // toward the hind legs.
  fur(g,chain([[[-38,hy-1],[-42,hy-14],[-30,hy-19],[-16,hy-17]],[[-16,hy-17],[-4,mid-15],[8,sy-16-scap*.4],[18,sy-17-scap]],[[18,sy-17-scap],[27,sy-18-scap*.5],[33,sy-14],[35,sy-4]],
    [[35,sy-4],[37,sy+6],[28,sy+13],[16,sy+13]],[[16,sy+13],[4,mid+12],[-8,mid+8],[-18,hy+4]],[[-18,hy+4],[-30,hy+9],[-39,hy+7],[-38,hy-1]]],10),C,sd,{belly:C.belly?[6,mid+10,18,5]:null});
  // The near thigh and shoulder, muscle over the top of the leg, blended into the body so the legs grow out of it.
  fur(g,tube([[nh.hip[0]+3,nh.hip[1]-9],nh.hip,nh.knee],21,11),{...C,light:mixC(C.light,C.base,.65),dark:mixC(C.dark,C.base,.3)},sd+21,{ang:Math.PI/2,n:70,inner:true,stripes:!!C.stripes});
  fur(g,tube([[nf.sh[0]-1,nf.sh[1]-9],nf.sh,nf.elbow],16,10),{...C,light:mixC(C.light,C.base,.65),dark:mixC(C.dark,C.base,.3)},sd+23,{ang:Math.PI/2,n:50,inner:true,stripes:false});
  // The head rides low and bobs a beat behind the shoulders.
  catHead(g,44,sy-16+w*.9*Math.cos(4*Math.PI*(u+.12)),C,sd,true);
}
// The cat is drawn into its own canvas and laid in with a slight blur, so its fur reads soft rather than drawn.
let CATC=null,catx=null;
let CATP=null,catp=null;
function catPose(c,state){if(state==='curl'||state==='wake')catCurl(c,cat.C,cat.seed,state);else if(state==='sit'||state==='groom')catSit(c,cat.C,cat.seed,state);else catWalk(c,cat.C,cat.seed,state);}
function drawCat(g){
  if(!cat)return;const k=sc(22)*.34,x=cat.x,y=Y(22),walk=cat.state==='walk'||cat.state==='stretch';
  softShadow(g,x,y+.2,(walk?56:50)*k,7*k,.5);
  const W=150*k,H=130*k,pw=Math.ceil(W*S),ph=Math.ceil(H*S);
  if(!CATC||CATC.width!==pw||CATC.height!==ph){[CATC,catx]=mk(pw,ph);[CATP,catp]=mk(pw,ph);}
  const paint=(c,state)=>{c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,pw,ph);c.setTransform(S*k*cat.dir,0,0,S*k,pw/2,ph-6*k*S);catPose(c,state);};
  paint(catx,cat.state);
  // Changing pose, the old one fades out as the new one fades in, over half a second.
  const fade=cat.prev&&cat.tr<1;if(fade)paint(catp,cat.prev);
  const px=Math.round((x-W/2)*S),py=Math.round((y+6*k-H)*S);
  g.save();g.setTransform(1,0,0,1,0,0);if(HASF)g.filter=`blur(${Math.max(.5,S*.06).toFixed(2)}px)`;
  // The old pose lingers and the new one arrives quickly, so the cat stays nearly solid through the change.
  if(fade){const e=ease(cat.tr);g.globalAlpha=1-e*e;g.drawImage(CATP,px,py);g.globalAlpha=Math.min(1,e*1.6);}
  g.drawImage(CATC,px,py);g.restore();
}

/* ---------- glass ---------- */
function updateGlass(dt){
  const top=Y(WTOP)+2,bot=Y(SILL),gw=XWR-1.6;
  if(rainK>.05){if(R()<dt*30*rainK)glassDrops.push({x:rr(0,gw),y:rr(top,bot),r:rr(.18,.6),life:rr(30,120)});
    if(R()<dt*.6*rainK)runners.push({x:rr(0,gw),y:rr(top,top+(bot-top)*.5),r:rr(.4,.7),v:rr(2,7),wob:rr(0,TAU),trail:[]});
    for(let i=0;i<dt*120*rainK;i++)if(R()<.9)streaks.push({x:rr(-10,gw+10),y:rr(top-10,bot),l:rr(2,5),life:rr(.15,.4)});}
  for(let i=glassDrops.length-1;i>=0;i--){const d=glassDrops[i];d.life-=dt*(rainK>.05?1:3);if(d.life<=0)glassDrops.splice(i,1);}
  if(glassDrops.length>260)glassDrops.splice(0,glassDrops.length-260);
  for(let i=runners.length-1;i>=0;i--){const r=runners[i];r.y+=r.v*dt*(.6+noise(t*2+r.wob*5)*.8);r.x+=Math.sin(t*1.5+r.wob)*dt*.6;r.trail.push([r.x,r.y]);if(r.trail.length>40)r.trail.shift();if(r.y>bot)runners.splice(i,1);}
  for(let i=streaks.length-1;i>=0;i--){const s=streaks[i];s.life-=dt;s.y+=dt*60;s.x-=dt*8;if(s.life<=0)streaks.splice(i,1);}
}
function drawGlass(g){
  if(!glassDrops.length&&!runners.length&&!streaks.length)return;
  g.save();g.beginPath();g.rect(0,Y(WTOP)+2,XWR-1.6,Y(SILL)-Y(WTOP)-2);g.clip();
  g.strokeStyle='rgba(200,220,255,.28)';g.lineWidth=.12;g.beginPath();for(const s of streaks){g.moveTo(s.x,s.y);g.lineTo(s.x-s.l*.15,s.y+s.l);}g.stroke();
  for(const d of glassDrops){const tint=NEON[Math.floor(h3(d.x,d.r,1)*NEON.length)];ell(g,d.x,d.y,d.r,d.r*1.1,'rgba(8,6,16,.3)');ell(g,d.x,d.y+d.r*.3,d.r*.6,d.r*.5,rgba(mixC(tint,'#c8d8f0',.6),.3));ell(g,d.x-d.r*.3,d.y-d.r*.4,d.r*.22,d.r*.22,'rgba(255,255,255,.6)');}
  for(const r of runners){if(r.trail.length>1){g.strokeStyle='rgba(180,220,255,.16)';g.lineWidth=r.r*1.1;g.lineCap='round';g.beginPath();g.moveTo(r.trail[0][0],r.trail[0][1]);for(const p of r.trail)g.lineTo(p[0],p[1]);g.stroke();}
    ell(g,r.x,r.y,r.r,r.r*1.3,'rgba(8,6,16,.5)');ell(g,r.x,r.y+r.r*.3,r.r*.7,r.r*.8,'rgba(255,120,190,.55)');ell(g,r.x-r.r*.3,r.y-r.r*.5,r.r*.25,r.r*.25,'rgba(255,255,255,.8)');}
  g.restore();}

/* ---------- events ---------- */
// It's late, so the street is mostly empty: a car now and then, the odd person, a dog once in a while.
const SCHED={car:{m:22,f:6},walker:{m:110,f:20},near:{m:200,f:45},dog:{m:420,f:120},flyer:{m:75,f:20},sip:{m:40,f:14},cat:{m:300,f:90},rain:{m:420,f:240},window:{m:40,f:10},sign:{m:60,f:20},bill:{m:70,f:30},bulb:{m:200,f:100}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
function fire(k){
  if(k==='car'){const v=newCar();
    if(v.kind==='bike')logOnce('bike',40,'A motorbike tears past outside');else if(v.kind==='taxi')logOnce('taxi',40,'A taxi crawls by, looking for a fare');else if(v.kind==='truck')logOnce('truck',60,'A delivery truck rumbles past the window');else if(v.under)logOnce('under',60,'A car slides by with neon glowing underneath');else logOnce('car',30,pick(['Cars hiss by on the street','Traffic rolls past outside','A car goes by, then another']));}
  else if(k==='walker'){const p=newWalker(false,chance(.12));if(p.dog)log(`Someone walks ${an(p.dog.B.name)} along the far pavement`);else if(p.run)logOnce('run',50,'Someone jogs along the far pavement');else logOnce('walk',40,pick(['People pass on the far side of the street','Someone hurries along across the street','A couple of people drift past the shops across the road']));}
  else if(k==='near'){const p=newWalker(true,chance(.15));
    log(p.dog?`Someone walks past the window with ${an(p.dog.B.name)} on a lead`:p.run?pick(['A jogger runs past the window','Someone runs by outside, breathing hard']):p.mode==='stroll'?'Someone strolls past the window, in no hurry':p.umb?'Someone passes the window under a glowing umbrella':p.phone?'Someone walks past the window, face lit by a phone':p.visor?'Someone in a lit visor walks past the window':pick(['Someone walks right past the window','A figure goes by outside the glass','Someone passes close to the glass']));}
  else if(k==='dog'){const d=newDog(chance(.6)),v=d.G===GAITS.gallop?'races':d.G===GAITS.walk?'ambles':'trots';log(d.near?`${cap(an(d.B.name))} ${v} past outside the window, on its own`:`${cap(an(d.B.name))} ${v} along the far pavement`);}
  else if(k==='flyer'){newFlyer();logOnce('flyer',90,'A flyer drifts across the sky between the towers');}
  else if(k==='sip')startSip();
  // The cat only comes on a hot-drink night.
  else if(k==='cat'){if(!cat&&!ICED)newCat();}
  // Nobody orders iced coffee on a rainy night, so an iced night stays dry.
  else if(k==='rain'){if(raining){raining=false;log('The rain stops');}else if(chance(MOOD.rain+.12)&&!ICED){raining=true;log(pick(['It starts to rain. Drops gather on the glass','Rain starts to tap at the window','A light rain begins, blurring the neon']));}}
  else if(k==='window'){const w=pick(WINS.filter(w=>w.x<VW&&w.x>-6));if(w){w.want=1-w.want;w.rate=rr(.4,2);log(w.want?`A light goes on, ${FLOORS[w.f+1]||'top'} floor across the street`:`A window goes dark across the street`);}}
  else if(k==='sign'){const s=pick(SIGNS.filter(s=>s.x>-4&&s.x<XWR));if(chance(.2)){cafeOut=t+rr(.8,2.5);logOnce('cafe',120,'The sign on the window buzzes and flickers');return;}
    if(s){s.flick={t0:t,d:rr(.8,3),out:chance(.15)?rr(20,90):0};logOnce('sign',80,s.flick.out?`The ${s.word} sign across the street sputters out`:`The ${s.word} sign across the street flickers`);}}
  else if(k==='bill'){BILL.mode=pick(['koi','text','bars'].filter(m=>m!==BILL.mode));BILL.col=pick(NEON);BILL.col2=pick(NEON);BILL.word=pick(['SYNTH 9','NEW YOU','DREAM ON','CHROME SALE','NIGHT AIR','SLEEP IS OPTIONAL','UPGRADE','FEEL MORE']);logOnce('bill',120,'The big screen on the tower changes');}
  else if(k==='bulb'){if(DARK)return;const b=pick(BULBS);b.flick={t0:t,d:rr(.4,1.4)};logOnce('bulb',150,'One of the bulbs over the counter flickers');}
}
// Now and then the coffee starts going down, as if someone out of frame were drinking it, but so slowly that you
// can't see it move: a few percent spread over somewhere between ten seconds and a minute, at a pace that varies.
// You only notice later that there's less in the cup.
function startSip(){
  if(sip.left>0||bot.state!=='off'||coffee.level<.04)return;
  sip.left=Math.min(coffee.level,rr(.05,.14));sip.rate=rr(.0018,.006);stats.sips++;
  const end=coffee.level-sip.left<.04,hot=coffee.temp;
  if(ICED)log(end?pick(['The glass is drained. Just ice left, clinking','The last of the coffee goes, the ice rattling']):CUP.straw?pick(['The level drops as someone takes a long pull through the straw','A slow sip through the straw','The coffee sinks in the glass, the ice settling']):pick(['The ice clinks and the coffee drops','The level in the glass falls a little','A long cold sip']));
  else log(end?pick(['The last of the coffee is drunk','The cup is drained']):hot>.75?pick(['A careful sip. Still hot','The coffee goes down a little','A sip, and the steam swirls']):hot>.4?pick(['A sip','The coffee drops in the cup','Another sip, warm now']):pick(['A sip of lukewarm coffee','The cooling coffee goes down a little','A sip. Nearly cold now']));}
function updateSip(dt){
  if(sip.left<=0)return;const d=Math.min(sip.left,sip.rate*dt);coffee.level=Math.max(0,coffee.level-d);sip.left-=d;
  if(sip.left<=1e-6){sip.left=0;if(coffee.level<.04){coffee.level=0;refillAt=t+rr(8,40);}}}
function updateBot(dt){
  if(bot.state==='off'){if(refillAt>0&&t>=refillAt&&sip.left<=0){refillAt=-1;bot.state='open';bot.k=0;bot.dur=BOT_D.open;bot.x=hatchX();bot.arm=0;bot.tank=1;log(pick([`A hatch slides open in the counter and a ${BOT.name} rises out of it`,`The counter hatch opens. Up comes a ${BOT.name} with fresh coffee`]));}return;}
  bot.k+=dt/bot.dur;
  const k=botK(),stop=botStop(),home=hatchX();
  if(bot.state==='go')bot.x=lerp(home,stop,ease(bot.k));
  if(bot.state==='back')bot.x=lerp(stop,home,ease(bot.k));
  if(bot.state==='pour'){bot.arm=clamp(bot.k*5,0,1)*(bot.k>.88?1-(bot.k-.88)/.12:1);
    if(bot.k>.2&&bot.k<.88){coffee.level=Math.min(.94,coffee.level+dt*.42);if(!ICED)coffee.temp=Math.min(1,coffee.temp+dt*.8);bot.tank=Math.max(.15,bot.tank-dt*.3);}}
  if(bot.k<1)return;
  const next={open:'rise',rise:'go',go:'pour',pour:'back',back:'sink',sink:'shut',shut:'off'}[bot.state];
  if(bot.state==='pour'){stats.refills++;bot.arm=0;if(ICED){coffee.ice=1;log(pick([`The ${BOT.name} tops up your ${CUP.name.replace('glass of ','')} and drops in fresh ice`,'A fresh pour over new ice. The glass beads with cold again']));}else{coffee.temp=1;log(pick([`The ${BOT.name} tops up your cup and beeps once`,'A fresh pour. Steam rises again',`The ${BOT.name} fills your cup to the brim and rolls back home`]));}}
  if(bot.state==='shut')bot.x=0;
  bot.state=next;bot.k=0;bot.dur=next==='go'||next==='back'?Math.max(.6,Math.abs(home-stop)/(4.5*k)):next==='pour'?rr(2.8,4):BOT_D[next]||1;
}
function updateCat(dt){
  if(!cat)return;const s0=cat.state;cat.tr=Math.min(1,(cat.tr??1)+dt/.5);
  stepCat(dt);
  if(cat&&cat.state!==s0){cat.prev=s0;cat.tr=0;}
}
function stepCat(dt){
  const c=cat;
  if(c.state==='walk'){const sp=c.sp*(c.leaving?1.2:1);c.x+=c.dir*sp*dt;c.ph+=dt*sp*gaitRate(30*sc(22)*.34,.4);
    if(!c.leaving&&Math.abs(c.x-c.target)<1){c.state='sit';c.k=0;c.sitT=rr(3,8);}
    if(c.leaving&&(c.x<-20||c.x>VW+20)){cat=null;}return;}
  c.k+=dt;
  if(c.state==='sit'&&c.k>c.sitT){if(c.stay){c.state='curl';c.k=0;log(pick(['The cat turns round twice and curls up to sleep','The cat settles into a tight curl on the counter']));}else if(!c.groomed){c.state='groom';c.k=0;c.groomed=true;}else{c.state='walk';c.leaving=true;c.dir=chance(.5)?1:-1;log('The cat jumps down and wanders off');}}
  else if(c.state==='groom'&&c.k>rr(3,6)){c.state='sit';c.k=0;c.sitT=rr(2,5);}
  else if(c.state==='curl'&&c.k>c.sleep){c.state='wake';c.k=0;}
  else if(c.state==='wake'&&c.k>2){c.state='stretch';c.k=0;log('The cat wakes, stretches and blinks at the street');}
  else if(c.state==='stretch'&&c.k>2.4){c.state='walk';c.leaving=true;c.k=0;c.dir=chance(.5)?1:-1;log('The cat hops down off the counter');}
  if(c.state==='stretch')c.k=Math.min(c.k,2.5);}

/* ---------- update ---------- */
function update(dt){
  t+=dt;BILL.t+=dt;
  if(!warming)for(const k in SCHED){nextEv[k]-=dt;if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);fire(k);}}
  rainK+=((raining?1:0)-rainK)*Math.min(1,dt*.15);wet=clamp(wet+(raining?dt/90:-dt/400),0,1);
  coffee.temp=Math.max(0,coffee.temp-dt/560*(coffee.temp+.2));if(ICED)coffee.ice=Math.max(.3,coffee.ice-dt/900);
  for(const w of WINS)w.lit+=(w.want-w.lit)*Math.min(1,dt*w.rate);
  for(const s of SIGNS){if(!s.flick){s.on=1;continue;}const e=t-s.flick.t0;if(e<s.flick.d)s.on=noise(t*30+s.x)>.45?1:.15;else if(s.flick.out&&e<s.flick.d+s.flick.out)s.on=0;else{s.flick=null;s.on=1;}}
  for(const b of BULBS){if(DARK){b.on=0;continue;}if(!b.flick){b.on=1;continue;}const e=t-b.flick.t0;b.on=e<b.flick.d?(noise(t*40+b.f*9)>.4?1:.3):1;if(e>=b.flick.d)b.flick=null;}
  // Cars keep a gap that grows with speed, ease off behind slower ones, brake to stop and pull away again.
  for(let i=cars.length-1;i>=0;i--){const v=cars[i],u=v.u;let want=v.vmax,gap=1e9,lead=null;
    for(const o of cars){if(o===v||o.lane!==v.lane)continue;const gp=v.dir>0?o.x-(v.x+v.L):v.x-(o.x+o.L);if(gp>-1&&gp<gap){gap=gp;lead=o;}}
    if(lead){const safe=(2.2+v.cur/u*.7)*u;if(gap<safe)want=Math.min(want,lead.cur*Math.max(0,(gap-1.2*u)/(safe-1.2*u)));}
    if(v.stopAt!=null&&v.stopT==null){const d=(v.stopAt-(v.dir>0?v.x+v.L:v.x))*v.dir;if(d<=.3*u){want=0;if(v.cur<.25*u){v.stopT=rr(3,8);if(!warming)log('A taxi pulls over outside, hazards blinking');}}else want=Math.min(want,Math.sqrt(2*4*u*d));}
    if(v.stopT!=null){want=0;v.stopT-=dt;if(v.stopT<=0){v.stopT=null;v.stopAt=null;if(!warming)log('The taxi pulls away again');}}
    const acc=(v.kind==='bike'||v.kind==='sport'?4.5:2.6)*u;v.brake=want<v.cur-.3*u;
    v.cur+=clamp(want-v.cur,-7*u*dt,acc*dt);v.x+=v.cur*v.dir*dt;if(v.x>VW+40||v.x+v.L<-40)cars.splice(i,1);}
  for(let i=walkers.length-1;i>=0;i--){const p=walkers[i];
    if(p.stop>0){p.stop-=dt;if(p.kind==='dog')p.sniff=p.stopKind==='sniff';if(p.stop<=0)p.sniff=false;}
    else{p.x+=p.sp*p.dir*dt;p.ph+=dt*p.sp/p.h*(p.kind==='dog'?gaitRate(p.B.leg/100,p.G.A,p.G.f):p.run?gaitRate(.49,.62,.36):gaitRate(.49,.42));
      if(p.dog)p.dog.ph+=dt*p.sp/p.dog.h*gaitRate(p.dog.B.leg/100,p.dog.G.A,p.dog.G.f);}
    // Someone who means to stand around stops when they reach their spot.
    if(p.standAt!=null&&p.stop<=0&&(p.x-p.standAt)*p.dir>=0){p.stop=p.standFor;p.stopKind='idle';p.standAt=null;if(!warming)logOnce('stand',60,p.near?'Someone stops just outside the window and waits':'Someone across the street stops under the signs and waits around');}
    // A dog on its own may stop to sniff, or look in at the window.
    if(p.kind==='dog'&&!p.sniffed&&p.x>VW*.2&&p.x<XWR*.9&&chance(dt*.4)){p.sniffed=true;if(p.near&&chance(.4)){p.stop=rr(2.5,5);p.stopKind='look';if(!warming)log('The dog stops and looks in through the window');}else{p.stop=rr(1.5,4);p.stopKind='sniff';}}
    if(p.kind==='person'&&p.near&&!p.run&&!p.looked&&p.x>VW*.15&&p.x<XWR*.8&&chance(dt*.05)){p.looked=true;p.stop=rr(1.5,3);if(!warming)logOnce('look',60,'Someone outside glances in at the window and keeps walking');}
    if(p.x<-p.h*2-10||p.x>VW+p.h*2+10)walkers.splice(i,1);}
  for(let i=flyers.length-1;i>=0;i--){const f=flyers[i];f.x+=f.v*dt;if(f.x<-f.L-20||f.x>VW+20)flyers.splice(i,1);}
  updateGlass(dt);updateSip(dt);updateBot(dt);updateCat(dt);
}

/* ---------- draw ---------- */
let cafeSign=null;
// The street, into OUT at half resolution.
function drawOut(o){
  o.setTransform(1,0,0,1,0,0);o.globalCompositeOperation='source-over';o.globalAlpha=1;
  o.drawImage(FAR,0,0);
  o.setTransform(OS,0,0,OS,0,0);
  drawBill(o);
  for(const f of flyers)drawFlyer(o,f);
  o.save();o.globalCompositeOperation='lighter';for(const tw of TOW){if(tw.x>VW+4||tw.x+tw.w<-4)continue;const blink=(t*.8+tw.s)%2<.25;const tp=topOf(tw);if(tw.ant&&blink)glow(o,tw.x+tw.w*.5,Y(tp)-8,1.6,'#ff3a3a',.9);if(tw.roof==='spire'&&(t*.7+tw.s*1.3)%2.4<.3)glow(o,tw.x+tw.w*.5,Y(tp+tw.rh),1.4,'#ff3a3a',.85);}
  for(const[x,yu,p]of TWK){const a=Math.max(0,noise(t*1.6+p)-.45)*1.4;if(a>.02)glow(o,x,Y(yu),1.1,'#e8eeff',a*.6);}o.restore();
  o.setTransform(1,0,0,1,0,0);o.drawImage(NEAR,0,0);o.setTransform(OS,0,0,OS,0,0);
  // Lit windows across the street, some with blinds or someone moving behind them.
  for(const w of WINS){if(w.lit<.02||w.x>VW+4||w.x<-8)continue;const y=Y(w.y+w.h);o.globalAlpha=w.lit;o.fillStyle=w.col;o.fillRect(w.x,y,w.w,w.h);
    if(w.blind){o.fillStyle=rgba(shade(w.col,-.4),.6);for(let yy=y+.6;yy<y+w.h;yy+=1)o.fillRect(w.x,yy,w.w,.35);}
    if(w.fig){const fx=w.x+w.w*(.5+Math.sin(t*.2+w.x)*.35);o.fillStyle=rgba('#1a1020',.7);o.beginPath();o.arc(fx,y+w.h*.45,w.w*.16,0,TAU);o.fill();o.fillRect(fx-w.w*.22,y+w.h*.6,w.w*.44,w.h*.4);}
    o.globalAlpha=1;}
  o.globalCompositeOperation='lighter';
  for(const w of WINS){if(w.lit<.3||w.x>VW+4||w.x<-8)continue;o.fillStyle=rgba(w.col,.08*w.lit);o.fillRect(w.x-1.5,Y(w.y+w.h)-1.5,w.w+3,w.h+3);}
  for(const s of SIGNS){if(s.x<-14||s.x>VW+14||s.on<=0)continue;const sp=s.spr;o.globalAlpha=s.on;o.drawImage(sp.c,s.x-sp.w/2,Y(s.y)-(s.kind==='blade'?sp.h-sp.w*.5:sp.h/2),sp.w,sp.h);}
  o.globalAlpha=1;o.globalCompositeOperation='source-over';
  if(wet>.01){o.setTransform(1,0,0,1,0,0);o.globalAlpha=wet*.9;o.globalCompositeOperation='lighter';o.drawImage(WET,0,0);o.globalAlpha=1;o.globalCompositeOperation='source-over';o.setTransform(OS,0,0,OS,0,0);}
  for(const p of walkers)if(!p.near)drawWalker(o,p);
  for(const v of cars)if(v.far)drawCar(o,v);
  for(const v of cars)if(!v.far)drawCar(o,v);
  o.globalCompositeOperation='lighter';for(const v of cars)drawCarLights(o,v);o.globalCompositeOperation='source-over';
  for(const p of walkers)if(p.near)drawWalker(o,p);
  o.fillStyle=lin(o,0,Y(HZ+20),0,Y(SILL),[[0,rgba(MOOD.haze,0)],[1,rgba(MOOD.haze,.05+.08*MOOD.smog+.05*rainK)]]);o.fillRect(0,Y(HZ+20),VW,HZ+20-SILL);
}
// Bokeh: points of light beyond the glass, out of focus, open into soft discs with a slightly brighter rim.
function bokeh(g,x,y,r,col,a){g.fillStyle=rad(g,x,y,0,r,[[0,rgba(col,a*.55)],[.78,rgba(col,a*.8)],[.92,rgba(col,a*1.25)],[1,rgba(col,0)]]);g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}
function drawBokeh(g){
  g.save();g.beginPath();g.rect(0,Y(WTOP)+2.4,VW,Y(SILL)-Y(WTOP)-2.4);g.clip();g.globalCompositeOperation='lighter';
  for(const s of SIGNS){if(s.on<=0||s.x<-10||s.x>VW+10)continue;const blade=s.kind==='blade',n=blade?3:Math.min(4,1+Math.floor(s.word.length/3));
    for(let i=0;i<n;i++){const x=s.x+(blade?(h3(i,s.x,1)-.5)*2:(h3(i,s.x,1)-.5)*s.word.length*2),y=Y(s.y)+(blade?-h3(i,s.x,2)*s.word.length*3.4:(h3(i,s.x,2)-.5)*2);bokeh(g,x,y,1.3+h3(i,s.x,3)*1.8,s.col,.14*s.on);}}
  for(const w of WINS){if(w.lit<.3||w.x>VW+4||w.x<-8||h3(w.x,w.y,5)>.35)continue;bokeh(g,w.x+w.w/2,Y(w.y+w.h/2),1.4+h3(w.x,w.y,6)*1.4,w.col,.07*w.lit);}
  for(const v of cars){const u=v.u,gy=Y(v.lane),front=v.dir>0?v.x+v.L:v.x,back=v.dir>0?v.x:v.x+v.L;
    bokeh(g,front,gy-.7*u,(v.far?1.6:2.4),'#fff4dc',.22);bokeh(g,back,gy-.8*u,(v.far?1.2:1.8),'#ff3040',.18);}
  g.restore();
}
function draw(){
  drawOut(octx);
  const g=ctx;g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;
  // The street, a little out of focus.
  if(HASF)g.filter=`blur(${Math.max(.6,S*.13).toFixed(2)}px)`;g.drawImage(OUT,0,0,CW,CH);if(HASF)g.filter='none';
  g.setTransform(S,0,0,S,0,0);
  drawBokeh(g);
  // Faint reflections in the glass of the bulbs and the candle behind you.
  g.save();g.beginPath();g.rect(0,Y(WTOP)+2.4,VW,Y(SILL)-Y(WTOP)-2.4);g.clip();g.globalCompositeOperation='lighter';
  for(const b of BULBS){if(b.on<=0)continue;const x=b.f*VW+(b.f-.5)*6,y=b.drop+(VH-100)*.15+4.6;glow(g,x,y,5,b.warm,.08*b.on);glow(g,x,y,1.4,'#fff0c8',.14*b.on);}
  if(PROPS.candle){const f=.8+noise(t*5)*.3;glow(g,CANDX+2,Y(SILL+6),4,'#ffa040',.1*f);}
  g.restore();
  // The cafe's name in neon on the glass, back to front from in here.
  if(cafeSign){const on=cafeFlick();if(on>0){g.globalCompositeOperation='lighter';g.globalAlpha=on;const cs=cafeSign,cx=clamp(VW*.62,cs.w/2+2,VW-cs.w/2-3),cy=Y(Math.min(WTOP-10,SILL+44));g.drawImage(cs.c,cx-cs.w/2,cy-cs.h/2,cs.w,cs.h);g.globalAlpha=1;g.globalCompositeOperation='source-over';}}
  drawGlass(g);
  g.setTransform(1,0,0,1,0,0);g.drawImage(IN,0,0);
  // The varnish on the counter reflects the street, faintly, fading toward you.
  {const sy=Math.max(0,Math.round(Y(SILL+.9)*OS)-RH);rctx.setTransform(1,0,0,1,0,0);rctx.globalCompositeOperation='source-over';rctx.clearRect(0,0,OW,RH);
    rctx.setTransform(1,0,0,-1,0,RH);rctx.drawImage(OUT,0,sy,OW,RH,0,0,OW,RH);rctx.setTransform(1,0,0,1,0,0);
    rctx.globalCompositeOperation='destination-in';rctx.fillStyle=lin(rctx,0,0,0,RH,[[0,'rgba(0,0,0,1)'],[1,'rgba(0,0,0,0)']]);rctx.fillRect(0,0,OW,RH);
    g.globalAlpha=.2;if(HASF)g.filter=`blur(${(S*.2).toFixed(2)}px)`;g.drawImage(REFL,0,Math.round(Y(SILL-1.6)*S),CW,RH*2);if(HASF)g.filter='none';g.globalAlpha=1;}
  g.setTransform(S,0,0,S,0,0);
  // Bulbs on their cords: brass sockets and clear glass round a glowing filament.
  for(const b of BULBS){const x=b.f*VW+Math.sin(t*.5+b.sw)*.3,y=b.drop+(VH-100)*.15;
    g.strokeStyle='#0a0608';g.lineWidth=.28;g.beginPath();g.moveTo(b.f*VW,0);g.lineTo(x,y-4.4);g.stroke();
    g.fillStyle=lin(g,x-.9,0,x+.9,0,[[0,'#3a2410'],[.4,'#c8964a'],[1,'#4a2c12']]);g.fillRect(x-.9,y-4.8,1.8,1.9);
    // A long Edison bulb: a narrow neck, straight sides and a rounded end, with a cage of filaments down its length.
    const bp=new Path2D();bp.moveTo(x-.8,y-3);bp.bezierCurveTo(x-.85,y-2.2,x-1.55,y-1.8,x-1.55,y-.4);bp.lineTo(x-1.5,y+4);bp.bezierCurveTo(x-1.45,y+5.6,x-.7,y+6.4,x,y+6.4);
    bp.bezierCurveTo(x+.7,y+6.4,x+1.45,y+5.6,x+1.5,y+4);bp.lineTo(x+1.55,y-.4);bp.bezierCurveTo(x+1.55,y-1.8,x+.85,y-2.2,x+.8,y-3);bp.closePath();
    g.fillStyle=b.on>0?lin(g,x-1.6,0,x+1.6,0,[[0,rgba(b.warm,.3+.2*b.on)],[.5,rgba('#fff2c8',.35+.5*b.on)],[1,rgba(b.warm,.3+.2*b.on)]]):lin(g,x-1.6,0,x+1.6,0,[[0,'rgba(60,46,36,.55)'],[.5,'rgba(120,100,80,.35)'],[1,'rgba(50,38,30,.6)']]);g.fill(bp);
    g.save();if(b.on>0)g.globalCompositeOperation='lighter';g.strokeStyle=b.on>0?rgba('#fff6d0',.5+.5*b.on):'rgba(90,70,50,.7)';g.lineWidth=.12;g.beginPath();
    for(const d of[-.7,-.25,.25,.7]){g.moveTo(x+d*.3,y-2.4);g.lineTo(x+d,y+.2);for(let j=0;j<6;j++)g.lineTo(x+d+(j%2?.12:-.12),y+.2+j*.75);g.lineTo(x+d*.4,y+5);}
    g.stroke();g.restore();
    g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.ellipse(x-1,y+1.2,.2,2.6,0,0,TAU);g.fill();}
  drawShelf(g);
  drawCat(g);
  drawVase(g);
  drawCandle(g);
  drawHatch(g);drawBot(g);
  const rest=cupRest();
  const str=ICED?0:clamp((coffee.temp-.12)/.8,0,1)*(coffee.level>.03?1:.15);
  {const G=cupGeom(rest.x,rest.y,rest.k);softShadow(g,rest.x+.6*rest.k,Y(rest.y)+.4*rest.k,G.rx*1.5,G.ry*1.4,.55);drawCup(g,G,coffee.level);drawSteam(g,rest.x,Y(rest.y)-G.h,rest.k,str);}
  drawBook(g);drawNotepad(g);
  // Light: bulb halos, the candle's warm pool on the wood.
  g.globalCompositeOperation='lighter';
  for(const b of BULBS){if(b.on<=0)continue;const x=b.f*VW,y=b.drop+(VH-100)*.15+1.6;glow(g,x,y,18,b.warm,.2*b.on);g.save();g.translate(x,y);g.scale(.6,1);glow(g,0,0,7,'#fff0c0',.4*b.on);g.restore();}
  if(PROPS.candle){const k=sc(CANDY)*1.25,f=.8+noise(t*5)*.3;glow(g,CANDX,Y(CANDY)-5*k,22*k,'#ff9a3a',.36*f);g.save();g.translate(CANDX,Y(CANDY));g.scale(1,.3);glow(g,0,0,14*k,'#ffb060',.3*f);g.restore();}
  g.globalCompositeOperation='source-over';
  g.setTransform(1,0,0,1,0,0);g.drawImage(VIG,0,0,CW,CH);
  g.globalAlpha=.35;g.fillStyle=grainPat;g.save();g.translate(-((t*137)%160|0),-((t*91)%160|0));g.fillRect(0,0,CW+160,CH+160);g.restore();g.globalAlpha=1;
}
let cafeOut=0;
function cafeFlick(){return cafeOut>t?(noise(t*25)>.5?.9:.2):.95;}

/* ---------- build ---------- */
function build(){
  const vw=Math.max(200,innerWidth),vh=Math.max(150,innerHeight);
  let dpr=LOWQ?.75:Math.min(2,devicePixelRatio||1);const maxPx=LOWQ?1.2e6:5e6;if(vw*vh*dpr*dpr>maxPx)dpr=Math.sqrt(maxPx/(vw*vh));
  CW=cv.width=Math.round(vw*dpr);CH=cv.height=Math.round(vh*dpr);
  // 100 units tall on a landscape screen, and at least 64 across on a phone. The window runs the full width.
  S=Math.min(CH/100,CW/64);VW=CW/S;VH=CH/S;OS=S/2;OW=Math.ceil(CW/2);OH=Math.ceil(CH/2);
  XWR=VW;WTOP=VH-(VH>110?4:5);
  EDGE=clamp(VW*.08,7,18);CUPX=VW*.6;VASEX=PROPS.flowerLeft?EDGE:VW-EDGE;CANDX=PROPS.flowerLeft?VASEX+9:VASEX-9;
  [FAR,fctx]=mk(OW,OH);[NEAR,nctx]=mk(OW,OH);[WET,wctx]=mk(OW,OH);[OUT,octx]=mk(OW,OH);[IN,ictx]=mk(CW,CH);
  RH=Math.ceil(11*OS);[REFL,rctx]=mk(OW,RH);
  for(const s of SIGNS)s.spr=bakeSign(s.word,s.col,s.size,s.kind==='blade',false,OS);
  cafeSign=bakeSign(CAFE,CAFECOL,Math.min(6,VW*.07),false,true,S);
  paintFar(fctx);paintNear(nctx);paintWet(wctx);paintIn(ictx);
  const K0=cupRest().k;STW=Math.ceil(22*K0*S*.5);STH=Math.ceil(26*K0*S*.5);[STM,stc]=mk(STW,STH);
  let g;[VIG,g]=mk(CW,CH);g.fillStyle=rad(g,CW/2,CH*.5,Math.min(CW,CH)*.35,Math.hypot(CW,CH)*.62,[[0,'rgba(8,2,6,0)'],[1,'rgba(8,2,6,.6)']]);g.fillRect(0,0,CW,CH);
  const[gc,gg]=mk(160,160);const id=gg.createImageData(160,160);for(let i=0;i<160*160;i++){const v=h3(i,7,3)*255;id.data[i*4]=id.data[i*4+1]=id.data[i*4+2]=v;id.data[i*4+3]=12;}gg.putImageData(id,0,0);grainPat=ctx.createPattern(gc,'repeat');
}
function redrawCars(){for(const v of cars)v.spr=carSprite(v);}

/* ---------- start ---------- */
build();
if(chance(MOOD.rain*.5)&&!ICED){raining=true;rainK=1;wet=1;}
// Start with the street much as it usually is this late: perhaps a car going by, perhaps someone across the road.
if(chance(.4)){const v=newCar();v.x=rr(-v.L,VW);}
if(chance(.35)){const p=newWalker(false,false);p.x=rr(0,VW);}
if(chance(.1)){const p=newWalker(true,false);p.x=rr(VW*.1,XWR*.8);}
if(chance(.3))newFlyer(),flyers[0].x=rr(0,VW);
if(chance(.2)&&!ICED){newCat();cat.x=cat.target;cat.state='curl';cat.k=rr(0,60);}
stats.cars=stats.people=0;
warming=true;for(let i=0;i<120;i++)update(1/60);warming=false;
log(`${MOOD.name}. A window seat at ${CAFE==='CAFE'||CAFE==='COFFEE'?'the cafe':CAFE}, ${ICED?an(CUP.name)+' in a heavy cut tumbler':an(CUP.name)+' of coffee'} in front of you`);
log(ICED?'Ice floats in the glass and beads of water gather on the outside':coffee.temp>.85?'The coffee is hot, still steaming':'The coffee has cooled a little');
if(DARK)log('The lights are off tonight. Just a candle burning beside the flower');
{const t=SHELF.books.concat(SHELF.lean?[SHELF.lean]:[]).filter(b=>b.book).map(b=>b.book.title);if(t.length)log(`On the little shelf: ${t.length>1?t.slice(0,-1).join(', ')+' and '+t[t.length-1]:t[0]}`);}
{const ex={book:'A book lies open beside the cup',notepad:'Your notepad lies beside the cup, a pen across the page'}[PROPS.extra];if(ex)log(ex);}
if(cat)log(`A ${catName()} is already asleep on the counter`);
if(raining)log('Rain runs down the glass');
if(DEBUG)window.CF={stats,coffee,sip,bot,PROPS,CUP,ICED,NIGHT,get moonAt(){return MOONAT;},rebuild(){build();redrawCars();draw();},SHELF,LIBRARY,get cat(){return cat;},cars:()=>cars,walkers:()=>walkers,fire,startSip,refill(){refillAt=t;coffee.level=0;},get t(){return t;},get paused(){return NightCity.paused;},set paused(v){NightCity.paused=v;},draw:()=>draw(),step:dt=>update(dt),
  run(sec){for(let i=0;i<sec*60;i++)update(1/60);draw();NightCity.refresh();}};
NightCity.run({step:1/60,update,draw,ui:()=>NightCity.stats(stats)});
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{build();redrawCars();draw();},200);});
})();
