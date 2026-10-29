/* Bus Stop: a late-night bus stop, seen from across the street, in the style of a hand-painted anime film.
   Long empty stretches, buses that go by without stopping, and now and then one person who waits, checks the road and
   finally gets on. Every choice comes from one generator seeded with the moment the page opens, so no two nights play
   the same way. No libraries, no image files: painted backgrounds and cel-shaded people, all drawn to a Canvas. */
(()=>{
'use strict';
const cv=document.getElementById('scene');
const ctx=cv.getContext('2d');
// Seed, frame loop, embed mode and overlay come from the shared runtime, ../assets/js/nightcity.js.
const{LOWQ,DEBUG,R,rr,ri,pick,chance,expo,wpick,shuffle,noise,fbm}=NightCity;

/* ---------- helpers ---------- */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
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
function rrP(x,y,w,h,r){const p=new Path2D();r=Math.max(0,Math.min(r,w/2,h/2));p.moveTo(x+r,y);p.arcTo(x+w,y,x+w,y+h,r);p.arcTo(x+w,y+h,x,y+h,r);p.arcTo(x,y+h,x,y,r);p.arcTo(x,y,x+w,y,r);p.closePath();return p;}
function ellP(x,y,rx,ry){const p=new Path2D();p.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);return p;}
function ell(g,x,y,rx,ry,col){g.fillStyle=col;g.beginPath();g.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);g.fill();}
function seg(g,a,b,w,col){g.strokeStyle=col;g.lineWidth=w;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();}
function lin(g,x0,y0,x1,y1,stops){const gr=g.createLinearGradient(x0,y0,x1,y1);for(const[o,c]of stops)gr.addColorStop(o,c);return gr;}
function rad(g,x,y,r0,r1,stops){const gr=g.createRadialGradient(x,y,r0,x,y,r1);for(const[o,c]of stops)gr.addColorStop(o,c);return gr;}
const SANS='"Helvetica Neue",Helvetica,Arial,sans-serif';
// Cel shading: a flat fill, one darker tone with a hard edge on the side away from the light, and an inked outline.
const INK='#1a1628';
function cel(g,p,base,dark,shadeFn,lw){g.fillStyle=base;g.fill(p);if(dark&&shadeFn){g.save();g.clip(p);g.fillStyle=dark;shadeFn(g);g.restore();}if(lw!==0){g.strokeStyle=INK;g.lineWidth=lw||.22;g.stroke(p);}}
// A limb as a chain of round strokes: ink first, then the colour, then a strip of shadow down one side.
function limb(g,pts,w1,w2,col,dark){g.lineCap='round';g.lineJoin='round';
  for(const pass of[0,1]){g.strokeStyle=pass?col:INK;for(let i=0;i<pts.length-1;i++){g.lineWidth=(i?w2:w1)+(pass?0:.44);g.beginPath();g.moveTo(pts[i][0],pts[i][1]);g.lineTo(pts[i+1][0],pts[i+1][1]);g.stroke();}}
  if(dark){g.strokeStyle=dark;for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,w=i?w2:w1,nx=dy/l*w*.27,ny=-dx/l*w*.27;g.lineWidth=w*.42;g.beginPath();g.moveTo(a[0]+nx,a[1]+ny);g.lineTo(b[0]+nx,b[1]+ny);g.stroke();}}}
function inkEll(g,x,y,rx,ry,col,lw){ell(g,x,y,rx,ry,col);g.strokeStyle=INK;g.lineWidth=lw||.18;g.stroke();}

/* ---------- a 3x5 font, for the dot-matrix signs on the buses ---------- */
const FONT={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111',
  0:'111101101101111',1:'010110010010111',2:'110001010100111',3:'110001010001110',4:'101101111001001',5:'111100110001110',6:'011100111101111',7:'111001010010010',8:'111101111101111',9:'111101111001110'};
const textW=s=>s.length*4-1;
// Lit dots for the text, with its top-left corner at (x, y). d is the gap between dots.
function led(g,s,x,y,d,col){g.fillStyle=col;for(let i=0;i<s.length;i++){const f=FONT[s[i]];if(f)for(let k=0;k<15;k++)if(f[k]==='1'){g.beginPath();g.arc(x+(i*4+k%3+.5)*d,y+((k/3|0)+.5)*d,d*.36,0,TAU);g.fill();}}}

/* ---------- the street ---------- */
// The view is a window onto an 800 unit wide street. A unit is about 8.5 cm, so a person is about 20 units tall.
// Heights are in units above the bottom of the screen: the near lane, the far lane, the far kerb, the pavement,
// the bench, the back of the shelter and the building line.
const WW=800,MID=400,NEAR=12,FAR=26,CURB=36,WALK=38,SIT=43,BACK=44,BASE=48;
const FD=chance(.5)?1:-1; // which way the far lane runs. Buses for this stop come in from the -FD side.
const PSEED=rr(0,999);
const MOODS=[
  [{name:'A clear, cold night',sky:['#06092a','#173068','#3e5c94'],glow:'#c88a78',cloud:['#24305e','#5a6ea8','#d8a890'],amb:[.24,.28,.46],stars:1,moon:.75,cold:1,rain:.06,clouds:.5,mist:.15},3],
  [{name:'A cloudy night',sky:['#0c1030','#243464','#5a5a86'],glow:'#e0946a',cloud:['#2a2c52','#4a4a78','#e8a070'],amb:[.28,.27,.4],stars:.3,moon:.3,cold:.3,rain:.45,clouds:1,mist:.35},3],
  [{name:'A damp, misty night',sky:['#0a1630','#1e3a5e','#4e7088'],glow:'#a8b0b0',cloud:['#1e3048','#3e5a74','#c8b8a0'],amb:[.26,.31,.42],stars:.35,moon:.35,cold:.6,rain:.7,clouds:.8,mist:.8},2]
];
const MOOD=wpick(MOODS);
const AMB=MOOD.amb;
const STOP=pick([['DOCK RD','Dock Road'],['CANAL ST','Canal Street'],['MILL LANE','Mill Lane'],['ARCADE','the Arcade'],['KILN ST','Kiln Street'],['MARKET ROW','Market Row'],['NORTH QUAY','North Quay'],['ELM PARADE','Elm Parade'],['LANTERN ST','Lantern Street'],['FOUNDRY ST','Foundry Street']]);
const ROUTES=shuffle(['N7','N12','42','N29','118','N5','9','N88','23','N3']).slice(0,ri(2,3)).map(n=>({n,dest:pick(['CENTRAL','DOCKS','DEPOT','AIRPORT','MARKET','UPTOWN','HARBOUR','EAST END','NORTH','ARENA'])}));
// Bus colours: the lower body, the cream above the windows, a stripe, and the company name.
const FLEET=pick([['#2f8a78','#f0e8d4','#e8b84a','GREENLINE'],['#c8483a','#f2ead6','#2a3a5a','CITYLINK'],['#2c5c9e','#f0e8d4','#e8c84a','METRO'],['#d89a32','#f4ecd8','#7a3a2a','TRANSIT'],['#5e8a3a','#efe8d2','#c8483a','NIGHT LINE']]);
const STOPCOL=pick(['#c8342e','#2a5ec0','#1f8050']);
const routeList=ROUTES.map(r=>r.n).join(ROUTES.length>2?', ':' and ').replace(/, ([^,]*)$/,' and $1');

// The shelter, the stop pole at its downstream end, the poster in its back wall, the bench and a bin.
const SH={w:ri(54,64)};SH.x=Math.round(MID-SH.w/2+rr(-20,20));
const POLE=FD>0?SH.x+SH.w+ri(9,12):SH.x-ri(9,12);
const AD={w:14,h:22,yu:BACK+3};AD.x=chance(.5)?SH.x+3:SH.x+SH.w-17;
const BENCH=[SH.x+3,SH.x+SH.w-4];
const BIN=FD>0?SH.x-ri(6,9)-6:SH.x+SH.w+ri(6,9);
const doorX=v=>v.front-v.d*9;
// Street lamps: one on the upstream side of the shelter, then every 230-290 units.
const LAMPS=[];
{const x0=FD>0?SH.x-ri(22,40):SH.x+SH.w+ri(22,40);LAMPS.push({x:x0,h:ri(78,86),arm:FD>0?7:-7,stop:true});
  for(let x=x0-ri(230,290);x>10;x-=ri(230,290))LAMPS.push({x,h:ri(78,86),arm:chance(.5)?7:-7});
  for(let x=x0+ri(230,290);x<WW-10;x+=ri(230,290))LAMPS.push({x,h:ri(78,86),arm:chance(.5)?7:-7});}
const SLAMP=LAMPS[0];
// Utility poles along the kerb, with wires slung between them.
const UPOLES=[];
{let x=ri(10,120);while(x<WW+60){const clash=Math.abs(x-POLE)<14||(x>SH.x-12&&x<SH.x+SH.w+12)||LAMPS.some(l=>Math.abs(l.x-x)<14);if(!clash)UPOLES.push({x,h:ri(110,124),tr:chance(.35)});x+=ri(150,210);}}

// The buildings across the street: shops at street level, flats above.
const FACADES=[['#b0745a','brick'],['#a8644e','brick'],['#c8b494','render'],['#9aa8b0','render'],['#b8a0b4','render'],['#94b09a','render'],['#d2c09a','render'],['#a0a2a8','concrete'],['#c49a7a','render']];
const B=[];
{let x=ri(-40,0);while(x<WW+30){
  if(B.length&&chance(.14)){x+=ri(6,10);continue;}
  const w=ri(64,140),[col,mat]=pick(FACADES),tall=chance(.2);
  const b={i:B.length,x,w,gh:ri(40,46),fh:ri(32,36),fl:tall?ri(4,8):ri(1,3),col,mat,kind:wpick([['shutter',4],['door',3],['dark',3]]),lit:rr(.15,.5),s:ri(1,99999),roof:wpick([['plain',3],['tank',1],['aerial',1.5],['ac',1.5]])};
  b.ww=ri(11,14);b.wh=ri(15,18);b.n=Math.max(1,Math.floor((w-8)/(b.ww+7)));
  b.gap=b.n>1?Math.floor((w-10-b.n*b.ww)/(b.n-1)):0;
  b.wx0=x+Math.floor((w-(b.n*b.ww+(b.n-1)*b.gap))/2);
  b.door=x+ri(10,w-11);
  B.push(b);x+=w;}}
const winX=(b,c)=>b.wx0+c*(b.ww+b.gap),winY=(b,f)=>BASE+b.gh+f*b.fh+Math.floor((b.fh-b.wh)/2)+1;
const behind=b=>b.x<SH.x+SH.w+8&&b.x+b.w>SH.x-8;
// One all-night shop, close enough to light the pavement near the stop. It closes at some point in the night.
const shop=(()=>{const c=B.filter(b=>!behind(b)&&b.w>=72&&Math.abs(b.x+b.w/2-MID)<210);const b=c.length?pick(c):B.filter(b=>!behind(b)&&b.w>=72)[0]||B[0];
  b.kind='shop';
  return{b,wx:b.x+5,ww:Math.min(52,b.w-22),name:pick(['24H MART','DELI','FOOD & WINE','NITE MART','OPEN 24','MINI MART']),neon:pick(['#ff4f7a','#ff6a3a','#4fff9a']),on:1,neonOn:1,close:0,closing:null,closed:false};})();
shop.door=shop.wx+shop.ww+3;
// Sometimes a launderette, always lit.
{const c=B.filter(b=>b.kind!=='shop'&&!behind(b)&&b.w>=64);if(c.length&&chance(.55)){const b=pick(c);b.kind='laundry';b.drum=ri(0,4);}}
// A drinks machine glowing against a wall.
const VEND=(()=>{const c=B.filter(b=>!behind(b)&&b.kind!=='laundry'&&b.w>=64);if(!c.length)return null;const b=pick(c),x=b===shop.b?shop.door+12:b.x+b.w-13;if(x+9>b.x+b.w-1)return null;return{x,col:pick(['#d8343a','#2a6ac8','#eeeef2','#2a9a6a'])};})();
// A street tree, some nights.
const TREE=(()=>{if(!chance(.65))return null;for(let i=0;i<30;i++){const x=ri(40,WW-40);if(Math.abs(x-MID)<200&&!(x>SH.x-34&&x<SH.x+SH.w+34)&&Math.abs(x-POLE)>24&&!LAMPS.some(l=>Math.abs(l.x-x)<24)&&!UPOLES.some(u=>Math.abs(u.x-x)<24)&&!(VEND&&Math.abs(VEND.x-x)<20)&&!(x>shop.b.x-26&&x<shop.b.x+shop.b.w+26))return{x,h:rr(76,92),r:rr(17,23),s:rr(0,99)};}return null;})();
// A neon blade sign on the side of a taller building.
const blade=(()=>{if(!chance(.65))return null;const c=B.filter(b=>b.fl>=2&&b.kind!=='shop');if(!c.length)return null;const b=pick(c),word=pick(['HOTEL','BAR','RAMEN','KTV','CAFE','PHO','NOODLE','LIVE']);
  if(word.length*5.4+4>b.fl*b.fh-6)return null;return{b,x:b.x+b.w-4,yu:BASE+b.gh+5,word,col:pick(['#ff4fa3','#4ff0ff','#ff4a4a','#b46bff','#ffcf4a']),bad:ri(0,word.length-1),s:rr(0,99)};})();
// Windows that change through the night. The rest stay as they are.
const WARM=['#ffd68a','#ffc46a','#ffe6b4','#f8ae5e','#fff0c8'];
const CURTAINS=['#c8584a','#5a8ab8','#e8c860','#7aa860','#b878a8','#e8e0d0'];
const DYNW=[],DYNSET=new Set();
{const all=[];for(const b of B)for(let f=0;f<b.fl;f++)for(let c=0;c<b.n;c++)all.push([b,f,c]);
  for(const[b,f,c]of shuffle(all).slice(0,Math.min(20,Math.round(all.length*.3)))){const tv=chance(.12);
    DYNW.push({b,f,c,tv,col:tv?'#9ab8f0':pick(WARM),on:0,want:chance(.5)?1:0,rate:rr(.3,1.5),s:rr(0,99),spr:null});DYNSET.add(b.i*10000+f*100+c);}
  for(const w of DYNW)w.on=w.want;}
// The skyline far behind, with red lights on the tallest towers.
const TOWERS=[];
{let x=-10;while(x<WW+10){const w=ri(16,44);TOWERS.push({x,w,h:Math.round(ri(60,220)*(chance(.2)?1.4:1)),col:mixC(MOOD.sky[1],MOOD.sky[2],rr(.15,.5)),lit:rr(.05,.22),s:ri(1,9999),spire:chance(.25)});x+=w+ri(-8,5);}}
const BEACONS=TOWERS.slice().sort((a,b)=>b.h-a.h).slice(0,3).map(s=>({x:s.x+s.w/2,yu:BASE+20+s.h+(s.spire?14:2),per:rr(1.4,2.6),ph:rr(0,1)}));
// The moon's phase runs from a thin crescent (-1) through half (0) to full (1), lit from one side.
const MOON=chance(MOOD.moon)?{x:MID+ri(-90,90),y:ri(14,34),r:rr(3.6,4.4),ph:rr(-.75,.95),side:chance(.5)?1:-1}:null;
const BANKS=[];for(let i=ri(1,3);i>0;i--)BANKS.push({x:MID+rr(-260,260),y:rr(18,70),w:rr(90,200),h:rr(16,30),s:rr(0,99)});
const PUDDLES=[];for(let i=ri(3,6);i>0;i--)PUDDLES.push({x:ri(0,WW),yu:pick([rr(10,19),rr(27,33),rr(39,46)]),w:rr(7,18)});

/* ---------- state ---------- */
let VW=0,VH=0,S=1,CW=0,CH=0,BH=0,BANDU=96,ox=0;
let t=0,wind=0,wet=0,rainK=0,raining=false,warming=false;
let SKY,SKYL,S0,LC,SC,M0,ML,MS,LMW=1,LMH=1,PROPS,PROPE,SHOPI,VIG,grainPat;
let dyn,dctx,emi,ectx,tmp,tctx,lmc,lmx;
let people=[],veh=[],parts=[],drops=[],clouds=[],planes=[],litter=[];
const tube={lv:1,seq:null,out:0};
const ads={cur:null,next:null,k:0};
const stats={passed:0,boarded:0,cars:0};
let lastLog={},PID=0;
const WO=rr(0,500),TO=rr(0,500);
function log(text){if(!warming)NightCity.log(text);}
// Logs at most once every gap seconds for a given key.
function logOnce(key,gap,text){if(t-(lastLog[key]??-1e9)<gap)return;lastLog[key]=t;log(text);}
const edge=s=>s<0?ox-14:ox+VW+14;
// Drawing is done in street units: Y turns a height into a row from the top of the view. W_ sets a full-view canvas
// to street units, WB_ the canvases that only hold the street band, where people and vehicles are.
const Y=yu=>VH-yu;
const W_=g=>g.setTransform(S,0,0,S,-ox*S,0);
const WB_=g=>g.setTransform(S,0,0,S,-ox*S,-(VH-BANDU)*S);

/* ---------- light ---------- */
// Each light adds its colour, falling off with distance. hw stretches a light sideways, dn and up squash it below and above.
function addLight(o,Ls,x,y){for(const L of Ls){const dx=Math.max(0,Math.abs(x-L.x)-L.hw);if(dx>=L.R)continue;const dy=(y-L.y)*(y<L.y?L.dn:L.up),d=Math.hypot(dx,dy);if(d>=L.R)continue;
  const f=L.s*(1-d/L.R)**2;o[0]+=L.c[0]*f;o[1]+=L.c[1]*f;o[2]+=L.c[2]*f;}}
function lightSets(){
  const st=[],tu=[],sp=[];
  for(const l of LAMPS)st.push({x:l.x+l.arm,y:l.h-2,hw:0,dn:.42,up:1.8,R:105,s:1.2,c:[1,.78,.5]});
  st.push({x:AD.x+AD.w/2,y:AD.yu+AD.h/2,hw:5,dn:.8,up:.8,R:22,s:.5,c:[.7,.88,1]});
  for(const b of B){if(b.kind==='door')st.push({x:b.door,y:BASE+28,hw:0,dn:.6,up:1.4,R:26,s:.75,c:[1,.8,.5]});
    if(b.kind==='laundry')st.push({x:b.x+b.w/2,y:BASE+16,hw:b.w/2-8,dn:.8,up:2,R:52,s:.85,c:[.85,.96,1]});}
  if(VEND)st.push({x:VEND.x+4.5,y:BASE+12,hw:3,dn:.8,up:1.5,R:30,s:.7,c:[.8,.92,1]});
  if(blade)st.push({x:blade.x+3,y:blade.yu+blade.word.length*2.7,hw:0,dn:.6,up:.6,R:30,s:.4,c:hex(blade.col).map(v=>v/255)});
  tu.push({x:SH.x+SH.w/2,y:73,hw:SH.w/2-5,dn:.55,up:3,R:38,s:.95,c:[.82,.96,1]});
  sp.push({x:shop.wx+shop.ww/2,y:BASE+16,hw:shop.ww/2,dn:.85,up:2.2,R:56,s:.95,c:[.88,.96,1]});
  return{st,tu,sp};
}

/* ---------- sprites ---------- */
function glowSprite(col){const n=128,[c,g]=mk(n,n);g.fillStyle=rad(g,64,64,0,64,[[0,rgba(col,1)],[.12,rgba(col,.6)],[.4,rgba(col,.16)],[1,rgba(col,0)]]);g.fillRect(0,0,n,n);return c;}
const GL={warm:glowSprite('#ffc078'),white:glowSprite('#fff2dc'),red:glowSprite('#ff2a1a'),amber:glowSprite('#ffa020'),cool:glowSprite('#bfe6ff'),soft:glowSprite('#ffffff')};
function glow(g,spr,x,y,rx,a,ry){if(a<=0)return;g.globalAlpha=Math.min(1,a);g.drawImage(spr,x-rx,y-(ry??rx),2*rx,2*(ry??rx));g.globalAlpha=1;}
// A fine noise tile, and a blotchy one like watercolour paper, for painted surfaces and film grain.
const NOISE=(()=>{const n=160,[c,g]=mk(n,n),img=g.createImageData(n,n);for(let i=0;i<img.data.length;i+=4){const v=R()*255;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=255;}g.putImageData(img,0,0);return c;})();
const PAPER=(()=>{const[s,sg]=mk(40,40),img=sg.createImageData(40,40);for(let i=0;i<img.data.length;i+=4){const v=R()*255;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=255;}sg.putImageData(img,0,0);
  const[c,g]=mk(320,320);g.imageSmoothingEnabled=true;g.drawImage(s,0,0,320,320);g.globalAlpha=.35;g.drawImage(NOISE,0,0,320,320);return c;})();
const GRAIN=(()=>{const n=160,[c,g]=mk(n,n),img=g.createImageData(n,n);for(let i=0;i<img.data.length;i+=4){const v=R()-.5;img.data[i]=img.data[i+1]=img.data[i+2]=v>0?255:0;img.data[i+3]=Math.abs(v)*2*22;}g.putImageData(img,0,0);return c;})();
function pattern(g,src,scale){const p=g.createPattern(src,'repeat');p.setTransform(new DOMMatrix().scale(scale));return p;}
// A cone of lamplight through damp air, from the lamp down to the road.
const CONE=(()=>{const w=128,h=256,[c,g]=mk(w,h);for(let y=0;y<h;y++){const k=y/h,half=8+k*56,a=.5*(1-k)**1.2;g.fillStyle=lin(g,w/2-half,0,w/2+half,0,[[0,'rgba(255,200,130,0)'],[.5,`rgba(255,200,130,${a})`],[1,'rgba(255,200,130,0)']]);g.fillRect(w/2-half,y,2*half,1);}return c;})();
// A light's reflection on the wet road: a soft streak running toward the viewer, broken up by ripples.
function streak(col){const w=32,h=128,[c,g]=mk(w,h);for(let y=0;y<h;y++){const k=y/h,a=(1-k)**1.4*(.55+.45*Math.sin(y*.9+k*7)**2);g.fillStyle=lin(g,0,0,w,0,[[0,rgba(col,0)],[.5,rgba(col,a)],[1,rgba(col,0)]]);g.fillRect(0,y,w,1);}return c;}
const STREAK={warm:streak('#ffb868'),cool:streak('#cfe8ff'),white:streak('#fff0d8'),red:streak('#ff3020')};
// Clouds as soft stretched wisps that run together: pale where the moon catches their tops, warm underneath
// where the city lights them.
function cloudCanvas(w,h,s){
  const k=Math.max(2,S*.6),[c,g]=mk(w*k,h*k);g.scale(k,k);const[c0,c1,c2]=MOOD.cloud;
  for(let i=0,n=Math.round(10+w/7);i<n;i++){const u=h3(i,s,1),bulge=Math.sin(u*Math.PI),cx=w*(.08+.84*u),rx=Math.min(h*(.35+.45*h3(i,s,3))*(1+bulge),cx,w-cx)*.96,
    ry=Math.min(rx*(.28+.42*bulge*h3(i,s,4)),h*.45),cy=Math.max(ry,h*.74-ry*.55-bulge*h*.18*h3(i,s,2));
    g.save();g.translate(cx,cy);g.scale(rx,ry);g.fillStyle=rad(g,0,0,0,1,[[0,rgba(c0,.7)],[.55,rgba(c0,.45)],[1,rgba(c0,0)]]);g.beginPath();g.arc(0,0,1,0,TAU);g.fill();g.restore();}
  g.globalCompositeOperation='source-atop';
  g.fillStyle=lin(g,0,0,0,h,[[0,rgba(shade(c1,.25),.9)],[.35,rgba(c1,.45)],[.6,rgba(c0,0)],[.85,rgba(c2,.35)],[1,rgba(c2,.6)]]);g.fillRect(0,0,w,h);
  g.globalCompositeOperation='source-over';
  return c;
}
// The moon, drawn once: the lit side, a terminator that bows in or out with the phase, a few grey seas, and
// the dark side left faintly visible against the sky.
function moonCanvas(r){
  const k=Math.max(8,S*2),n=Math.ceil((2*r+1)*k),[c,g]=mk(n,n),{ph,side}=MOON;g.translate(n/2,n/2);g.scale(k*side,k);
  g.fillStyle='#fff6dc';g.beginPath();g.arc(0,0,r,-Math.PI/2,Math.PI/2);g.closePath();g.fill();
  g.globalCompositeOperation=ph>=0?'source-over':'destination-out';g.beginPath();g.ellipse(0,0,r*Math.abs(ph)+.001,r,0,0,TAU);g.fill();
  g.globalCompositeOperation='source-atop';
  for(let i=0;i<6;i++)ell(g,(h3(i,1,9)-.5)*r*1.3,(h3(i,2,9)-.5)*r*1.3,r*(.14+h3(i,3,9)*.2),r*(.11+h3(i,4,9)*.16),'rgba(196,184,150,.4)');
  g.fillStyle=rad(g,0,0,r*.6,r,[[0,'rgba(255,255,255,0)'],[1,'rgba(220,200,160,.35)']]);g.fillRect(-r,-r,2*r,2*r);
  g.globalCompositeOperation='destination-over';g.fillStyle='rgba(190,205,240,.13)';g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
  return{c,size:n/k};
}

/* ---------- people ---------- */
const COATS=[['black','#2e2f3a'],['navy','#2c4278'],['olive','#6a7440'],['maroon','#88303e'],['camel','#c08c50'],['grey','#7a7e88'],['mustard','#d8a838'],['teal','#2e8a84'],['red','#c83c3e'],['cream','#e8e0c8'],['purple','#6a4a90'],['green','#3a7e4a'],['yellow','#e8c840']];
const PANTS=['#2a3048','#34487a','#4a4a54','#5a5040','#22222a','#5a6074'];
const SKIN=['#fbdcc2','#f0c4a0','#d8a07a','#b07a54','#86583c','#5e3e2a'];
const HAIR=['#221a1e','#4a2e20','#7a5434','#d8b46a','#a8a8b0','#e8e8ec','#d85a8a','#4a8ae0','#b84a30'];
function makeLook(){
  // Now and then, someone dressed like the Night City logo.
  if(chance(.03))return{coat:'#1c1c26',pants:'#1e1e28',skin:pick(SKIN),hair:'#18161c',shoes:'#ececf2',hoodie:true,hood:true,trim:true,shades:true,puffer:false,hat:null,hatC:'#000000',bag:null,bagC:'#000000',long:false,longHair:false,desc:'someone in a black hoodie with yellow and cyan trim, wearing sunglasses at night'};
  const[cn,coat]=pick(COATS),garment=wpick([['coat',3],['jacket',3],['hoodie',2],['puffer jacket',1.5],['raincoat',1]]);
  return{coat,pants:pick(PANTS),skin:pick(SKIN),hair:pick(HAIR),shoes:chance(.3)?'#e8e8ee':'#22222a',hoodie:garment==='hoodie',hood:garment==='hoodie'&&chance(.3),trim:false,shades:false,puffer:garment==='puffer jacket',
    hat:wpick([[null,5],['beanie',2],['cap',1]]),hatC:pick(['#c8483a','#2c4278','#3a3a44','#e0b040','#2e8a74','#e8e8e8']),bag:wpick([[null,3],['backpack',2],['bag',1]]),bagC:pick(['#2a2a36','#6a4430','#5a6a3a','#2c4270','#e8e2d0']),
    long:garment==='coat'||garment==='raincoat',longHair:chance(.3),desc:`someone in ${an(cn)} ${garment}`};
}
function body(o){const h=rr(19,22);return{o,h,
  C:{coat:o.coat,coatD:shade(o.coat,-.3),coatL:shade(o.coat,.2),pants:o.pants,pantsD:shade(o.pants,-.32),pantsL:shade(o.pants,.15),skin:o.skin,skinD:mixC(o.skin,'#b05a5a',.28),hair:o.hair,hairD:shade(o.hair,-.35),hairL:shade(o.hair,.4),shoes:o.shoes,shoesD:shade(o.shoes,-.35),hat:o.hatC,hatD:shade(o.hatC,-.3),bag:o.bagC,bagD:shade(o.bagC,-.3)}};}
function newPerson(kind,o){const p=Object.assign(body(o||makeLook()),{id:PID++,kind,x:0,y:41,state:'idle',dir:1,head:0,ph:0,sp:0,sit:false,phone:false,tb:expo(3)});
  if(raining&&kind!=='alight'){if(p.o.hoodie)p.o.hood=true;if(chance(.45))p.umb=pick(['#22222c','#c8483a','#2c4278','#e8e4d8','#e8c840']);}
  people.push(p);return p;}
function go(p,tx,sp,then){p.state='walk';p.tx=tx;p.sp=sp;p.then=then;}

// Proportions, from height: head radius, hip height, hip to shoulder, neck, half the shoulders and hips, and arm length.
// Heads are a little large, as anime draws them.
const D=h=>({hr:h*.082,leg:h*.46,torso:h*.28,neck:h*.03,sh:h*.11,hip:h*.08,arm:h*.39});
function shoe(g,C,x,y,dx){cel(g,ellP(x+dx,y-.45,1.05,.48),C.shoes,C.shoesD,gg=>gg.fillRect(x+dx-2,y-.4,4,1),.18);}
// Facing the street, standing or sitting. x is the middle of the feet, y0 the ground row. eg takes what glows.
function drawFront(g,eg,p,x,y0){
  const d=D(p.h),C=p.C,o=p.o;g.lineCap='round';g.lineJoin='round';let hip;
  if(p.sit){
    for(const s of[-1,1]){const lx=x+s*1.1,lp=new Path2D();lp.moveTo(lx-.8,y0-6.4);lp.lineTo(lx+.8,y0-6.4);lp.lineTo(lx+.58,y0-.8);lp.lineTo(lx-.58,y0-.8);lp.closePath();
      cel(g,lp,C.pants,C.pantsD,gg=>gg.fillRect(lx+.15,y0-7,2,7));shoe(g,C,lx,y0,0);}
    cel(g,rrP(x-d.hip-.8,y0-7.9,2*(d.hip+.8),2.1,1),C.pants,C.pantsD,gg=>gg.fillRect(x-d.hip-1,y0-6.6,2*d.hip+2,1));
    hip=y0-7.3;
  }else{
    hip=y0-d.leg;
    for(const s of[-1,1]){const lx=x+s*d.hip*.55,lp=new Path2D();lp.moveTo(lx-.95,hip);lp.lineTo(lx+.95,hip);lp.lineTo(lx+.62,y0-.8);lp.lineTo(lx-.62,y0-.8);lp.closePath();
      cel(g,lp,C.pants,C.pantsD,gg=>gg.fillRect(lx+(s>0?-.2:.25),hip-1,2,d.leg+1));shoe(g,C,lx,y0,s*.3);}
  }
  const sh=hip-d.torso*(p.sit?.95:1),hem=p.sit?hip+.5:o.long?hip+d.leg*.45:hip+1,sw=d.sh+(o.puffer?.3:0),hw=d.hip+.35+(o.long&&!p.sit?.7:0);
  const cp=new Path2D();cp.moveTo(x-sw+.8,sh);cp.quadraticCurveTo(x-sw-.2,sh+.1,x-sw-.1,sh+1.7);cp.lineTo(x-hw,hem);cp.quadraticCurveTo(x,hem+.4,x+hw,hem);cp.lineTo(x+sw+.1,sh+1.7);cp.quadraticCurveTo(x+sw+.2,sh+.1,x+sw-.8,sh);cp.quadraticCurveTo(x,sh-.5,x-sw+.8,sh);cp.closePath();
  cel(g,cp,C.coat,C.coatD,gg=>{gg.fillRect(x+sw*.32,sh-2,sw*2,40);gg.fillRect(x-sw-2,hem-1.2,sw*4,2);});
  g.save();g.clip(cp);g.strokeStyle=C.coatL;g.lineWidth=.3;g.beginPath();g.moveTo(x-sw+.5,sh+1.2);g.lineTo(x-sw+.4,hem-1.5);g.stroke();
  if(o.puffer){g.strokeStyle=C.coatD;g.lineWidth=.2;for(let yy=sh+1.6;yy<hem-.3;yy+=1.3){g.beginPath();g.moveTo(x-sw,yy);g.quadraticCurveTo(x,yy+.35,x+sw,yy);g.stroke();}}
  g.restore();
  seg(g,[x+.1,sh+1.2],[x+.1,hem-.2],.14,INK);
  g.fillStyle=C.coatD;g.beginPath();g.moveTo(x-1.3,sh-.2);g.lineTo(x,sh+1.4);g.lineTo(x+1.3,sh-.2);g.closePath();g.fill();
  if(o.bag==='backpack')for(const s of[-1,1])limb(g,[[x+s*(sw-1.3),sh+.1],[x+s*(sw-.8),sh+3.8]],.45,.45,C.bag,null);
  if(o.bag==='bag'&&!p.sit){seg(g,[x-sw+1,sh+.1],[x+sw-.2,hip-.4],.3,INK);cel(g,rrP(x+sw-1.2,hip-1.4,2.6,3,.5),C.bag,C.bagD,gg=>gg.fillRect(x+sw-1.2,hip+.4,3,2));}
  if(o.trim&&eg){eg.save();eg.shadowColor='#ffd23f';eg.shadowBlur=.8*S;seg(eg,[x-.5,sh+.6],[x-.5,hem-.3],.22,'#ffd23f');eg.shadowColor='#38d8ff';seg(eg,[x+.7,sh+.6],[x+.7,hem-.3],.18,'#38d8ff');eg.restore();}
  // Arms: hanging, resting on the lap, or holding a phone.
  for(const s of[-1,1]){const S_=[x+s*(sw-.55),sh+1];let E,Hd;
    if(p.phone&&s>0){E=[x+s*(sw-.1),sh+d.arm*.55];Hd=[x+s*.5,sh+d.arm*.36];}
    else if(p.sit){E=[x+s*(sw+.15),sh+d.arm*.5];Hd=[x+s*(d.hip-.1),hip-.5];}
    else{E=[x+s*(sw+.1),sh+d.arm*.48];Hd=[x+s*(sw-.1),sh+d.arm*.93];}
    limb(g,[S_,E,Hd],1.3,1.1,C.coat,s>0?C.coatD:null);inkEll(g,Hd[0],Hd[1]+.25,.5,.55,C.skin,.16);
    if(o.trim&&eg){eg.fillStyle='#38d8ff';eg.beginPath();eg.arc(Hd[0],Hd[1]-.4,.3,0,TAU);eg.fill();}
    if(p.phone&&s>0&&eg){eg.fillStyle='#e0f4ff';rrect(eg,Hd[0]-.55,Hd[1]-1.4,1,1.5,.15);eg.fill();}}
  g.fillStyle=C.skin;g.fillRect(x-.5,sh-d.neck-.8,1,d.neck+1.2);g.fillStyle=C.skinD;g.fillRect(x-.5,sh-d.neck-.8,1,.5);
  drawHeadF(g,eg,p,x,sh-d.neck-d.hr*.95,d.hr);
}
function hairFront(hx,hy,r,l){const hp=new Path2D(),sx=l*r*.2;hp.moveTo(hx-r*1.02,hy+r*.35);hp.bezierCurveTo(hx-r*1.22,hy-r*1.4,hx+r*1.22,hy-r*1.4,hx+r*1.02,hy+r*.35);
  for(const[a,b]of[[.92,.05],[.64,-.4],[.4,-.08],[.12,-.48],[-.16,-.1],[-.44,-.44],[-.7,-.06],[-.94,.05]])hp.lineTo(hx+a*r+sx*(1-Math.abs(a)*.5),hy+b*r);hp.closePath();return hp;}
function drawHeadF(g,eg,p,hx,hy,r){
  const C=p.C,o=p.o,l=p.head||0,fx=hx+l*r*.26;
  if(o.hood)cel(g,ellP(hx,hy+r*.05,r*1.42,r*1.38),C.coat,C.coatD,gg=>gg.fillRect(hx+r*.45,hy-2*r,2*r,4*r));
  else if(o.longHair){const hp=new Path2D();hp.moveTo(hx-r*1.05,hy-r*.3);hp.quadraticCurveTo(hx-r*1.3,hy+r*1.2,hx-r*1.05,hy+r*1.75);hp.lineTo(hx+r*1.05,hy+r*1.75);hp.quadraticCurveTo(hx+r*1.3,hy+r*1.2,hx+r*1.05,hy-r*.3);hp.closePath();cel(g,hp,C.hair,C.hairD,gg=>gg.fillRect(hx+r*.2,hy-r,2*r,3*r));}
  if(!o.hood)for(const s of[-1,1])if(s!==l)inkEll(g,hx+s*r*.92-l*r*.2,hy+r*.18,r*.2,r*.28,C.skin,.14);
  const fp=new Path2D();fp.moveTo(fx-r*.86,hy-r*.2);fp.bezierCurveTo(fx-r*.9,hy+r*.55,fx-r*.38,hy+r*1.02,fx,hy+r*1.06);fp.bezierCurveTo(fx+r*.38,hy+r*1.02,fx+r*.9,hy+r*.55,fx+r*.86,hy-r*.2);fp.bezierCurveTo(fx+r*.86,hy-r*1.15,fx-r*.86,hy-r*1.15,fx-r*.86,hy-r*.2);fp.closePath();
  cel(g,fp,C.skin,C.skinD,gg=>gg.fillRect(fx+r*.42-l*r*.3,hy-2*r,2*r,4*r),.18);
  if(o.shades){g.fillStyle='#0b0b14';rrect(g,fx-r*.76,hy-r*.02,r*1.52,r*.36,r*.14);g.fill();g.fillStyle='rgba(56,216,255,.9)';g.fillRect(fx+r*.18,hy+r*.04,r*.32,r*.08);g.fillStyle='rgba(255,210,63,.8)';g.fillRect(fx-r*.6,hy+r*.04,r*.22,r*.07);}
  else{for(const s of[-1,1]){const ex=fx+s*r*.37+l*r*.06,ey=hy+r*.16;ell(g,ex,ey,r*.12,r*.18,INK);ell(g,ex-r*.035,ey-r*.07,r*.045,r*.055,'#ffffff');}
    g.fillStyle='rgba(255,110,110,.22)';for(const s of[-1,1]){g.beginPath();g.ellipse(fx+s*r*.55+l*r*.05,hy+r*.5,r*.17,r*.08,0,0,TAU);g.fill();}}
  seg(g,[fx-r*.1+l*r*.1,hy+r*.72],[fx+r*.1+l*r*.1,hy+r*.72],r*.06,INK);
  if(o.hood){g.strokeStyle=C.coat;g.lineWidth=r*.34;g.stroke(fp);g.strokeStyle=INK;g.lineWidth=.16;g.stroke(ellP(fx,hy+r*.05,r*1.08,r*1.2));
    g.save();g.clip(fp);g.fillStyle='rgba(30,20,50,.35)';g.fillRect(fx-r,hy-r*1.2,2*r,r*.9);g.restore();}
  else{const hp=hairFront(hx,hy,r,l);cel(g,hp,C.hair,C.hairD,gg=>gg.fillRect(hx+r*.35,hy-2*r,2*r,3*r));
    g.save();g.clip(hp);g.strokeStyle=rgba(C.hairL,.7);g.lineWidth=r*.12;g.beginPath();g.ellipse(hx-r*.1,hy-r*.55,r*.6,r*.32,0,Math.PI*1.08,Math.PI*1.75);g.stroke();g.restore();
    if(o.hat){const hp2=new Path2D();hp2.moveTo(hx-r*1.1,hy-r*.25);hp2.bezierCurveTo(hx-r*1.2,hy-r*1.55,hx+r*1.2,hy-r*1.55,hx+r*1.1,hy-r*.25);hp2.closePath();cel(g,hp2,C.hat,C.hatD,gg=>gg.fillRect(hx+r*.4,hy-2*r,2*r,2*r));
      if(o.hat==='beanie')cel(g,rrP(hx-r*1.12,hy-r*.55,r*2.24,r*.4,r*.15),C.hatD,null,null,.16);
      else cel(g,ellP(hx+l*r*.5,hy-r*.27,r*(1.1+.25*Math.abs(l)),r*.2),C.hatD,null,null,.16);}}
  // A phone lights the face from below.
  if(p.phone&&eg){eg.fillStyle=rad(eg,fx,hy+r*.8,0,r*1.5,[[0,'rgba(170,220,255,.45)'],[1,'rgba(170,220,255,0)']]);eg.fill(fp);}
}
// Side on, facing s. Feet stay planted while the body moves over them. amp is 0 standing, 1 walking, about 1.7 running.
function drawSide(g,eg,p,x,y0,s,ph,amp,umb){
  const d=D(p.h),C=p.C,o=p.o,run=amp>1.3,Ls=7*p.h/20,L1=(d.leg-.7)*.5,L2=L1;g.lineCap='round';g.lineJoin='round';
  const hipX=x+(run?s*.7:0);
  const foot=i=>{if(!amp)return[x+s*(i?-.5:.5),y0,0];const u=((ph+i*Math.PI)%TAU+TAU)%TAU;
    if(u<Math.PI)return[x+s*Ls*(.5-u/Math.PI),y0,0];const k=sstep(0,1,(u-Math.PI)/Math.PI);return[x+s*Ls*(k-.5),y0-Math.sin(k*Math.PI)*(run?2.4:1.2),1];};
  const F=[foot(0),foot(1)];let hh=d.leg;for(const f of F)if(!f[2]){const dx=f[0]-hipX;hh=Math.min(hh,Math.sqrt(Math.max(0,((L1+L2)*.995)**2-dx*dx))+.7);}
  const hip=[hipX,y0-hh];
  const knee=a=>{const dx=a[0]-hip[0],dy=a[1]-.7-hip[1],dd=Math.min(L1+L2-1e-3,Math.hypot(dx,dy)),ang=Math.atan2(dy,dx),off=Math.acos(clamp((L1*L1+dd*dd-L2*L2)/(2*L1*dd),-1,1)),a1=ang-s*off;return[hip[0]+Math.cos(a1)*L1,hip[1]+Math.sin(a1)*L1];};
  const leg=(i,far)=>{const f=F[i],a=[f[0],f[1]-.7],k=knee(f);limb(g,[hip,k,a],1.85,1.4,far?C.pantsD:C.pants,far?null:C.pantsD);
    g.save();g.translate(a[0]+s*.45,a[1]+.3);g.rotate(f[2]?-s*.25:0);cel(g,ellP(0,0,1.15,.48),far?C.shoesD:C.shoes,null,null,.16);g.restore();};
  const lean=run?s*1.2:s*.2,sh=[hip[0]+lean,hip[1]-d.torso];
  const fw=f=>clamp((f[0]-hipX)*s/(Ls*.5),-1,1);
  const arm=(i,far)=>{const sw=amp?-fw(F[i])*.5*amp:.05,S_=[sh[0],sh[1]+1],up=d.arm*.48,lo=d.arm*.5;
    let E=[S_[0]+Math.sin(sw)*s*up,S_[1]+Math.cos(sw)*up],Hd=[E[0]+Math.sin(sw+(run?1.3:.35))*s*lo,E[1]+Math.cos(sw+(run?1.3:.35))*lo];
    if(umb&&!far){E=[S_[0]+s*1.2,S_[1]+2.6];Hd=[S_[0]+s*1.9,S_[1]+.2];}
    limb(g,[S_,E,Hd],1.3,1.1,far?C.coatD:C.coat,far?null:C.coatD);inkEll(g,Hd[0],Hd[1]+.2,.45,.5,far?C.skinD:C.skin,.14);
    if(o.bag==='bag'&&!far&&!umb)cel(g,rrP(Hd[0]-1.3,Hd[1]+.4,2.6,2.8,.4),C.bag,C.bagD,gg=>gg.fillRect(Hd[0],Hd[1],3,4));
    return Hd;};
  leg(1,true);arm(1,true);
  if(o.bag==='backpack')cel(g,rrP(s>0?sh[0]-3.6:sh[0]+.9,sh[1]+.8,2.7,4.8,.9),C.bag,C.bagD,gg=>gg.fillRect(sh[0]-s*3.6-1,sh[1]+4,6,3));
  leg(0,false);
  const hem=o.long?hip[1]+d.leg*.45:hip[1]+.8,sway=o.long&&amp?Math.sin(ph)*.6:0,tp=new Path2D();
  tp.moveTo(sh[0]-s*1.4,sh[1]+.3);tp.quadraticCurveTo(sh[0],sh[1]-.45,sh[0]+s*1.2,sh[1]+.5);tp.quadraticCurveTo(sh[0]+s*1.7,sh[1]+2.2,hip[0]+lean*.4+s*1.35,hip[1]-d.torso*.4);
  tp.lineTo(hip[0]+s*(1.3+(o.long?.9:0))+sway,hem);tp.lineTo(hip[0]-s*(1.4+(o.long?.6:0))+sway*.5,hem);tp.lineTo(hip[0]-s*1.45+lean*.3,hip[1]-d.torso*.5);tp.closePath();
  cel(g,tp,C.coat,C.coatD,gg=>{gg.fillRect(s>0?sh[0]-6:sh[0]+.2,sh[1]-2,5.8,40);gg.fillRect(hip[0]-4,hem-1,8,2);});
  if(o.trim&&eg){eg.save();eg.shadowColor='#ffd23f';eg.shadowBlur=.8*S;seg(eg,[sh[0]+s*1.1,sh[1]+1],[hip[0]+s*1.2,hem-.2],.22,'#ffd23f');eg.restore();}
  const hd=[sh[0]+s*.35,sh[1]-d.neck-d.hr*.95];
  g.fillStyle=C.skin;g.fillRect(sh[0]-.45+s*.2,sh[1]-d.neck-.6,.9,d.neck+1);
  drawHeadS(g,p,hd[0],hd[1],d.hr,s);
  const hand=arm(0,false);
  if(umb){const cx=hand[0],top=hd[1]-d.hr*2.6;seg(g,hand,[cx,top],.24,INK);
    const up=new Path2D();up.moveTo(cx-6.6,top+.5);up.quadraticCurveTo(cx-6.2,top-3,cx,top-3.1);up.quadraticCurveTo(cx+6.2,top-3,cx+6.6,top+.5);
    for(let i=4;i>=-4;i--){const a=cx+i*1.65,b=cx+(i-1)*1.65;up.quadraticCurveTo((a+b)/2,top-.1,b,top+.5);}up.closePath();
    cel(g,up,umb,shade(umb,-.28),gg=>gg.fillRect(cx+1.5,top-4,8,6));g.strokeStyle=INK;g.lineWidth=.12;for(const i of[-3.3,0,3.3]){g.beginPath();g.moveTo(cx,top-3.1);g.quadraticCurveTo(cx+i*1.1,top-2.4,cx+i*2,top+.4);g.stroke();}
    g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=.3;g.beginPath();g.moveTo(cx-4.6,top-.6);g.quadraticCurveTo(cx-4,top-2.4,cx-1.5,top-2.8);g.stroke();}
}
function drawHeadS(g,p,hx,hy,r,s){
  const C=p.C,o=p.o;
  if(o.hood)cel(g,ellP(hx-s*r*.18,hy,r*1.3,r*1.32),C.coat,C.coatD,gg=>gg.fillRect(hx-s*r*3,hy-2*r,2*r,4*r));
  const fp=new Path2D();fp.moveTo(hx-s*r*.9,hy);fp.bezierCurveTo(hx-s*r*.95,hy-r*1.2,hx+s*r*.85,hy-r*1.2,hx+s*r*.86,hy-r*.15);fp.lineTo(hx+s*r*1.12,hy+r*.3);fp.lineTo(hx+s*r*.86,hy+r*.42);
  fp.quadraticCurveTo(hx+s*r*.75,hy+r*1.02,hx+s*r*.1,hy+r*1.04);fp.quadraticCurveTo(hx-s*r*.85,hy+r*.9,hx-s*r*.9,hy);fp.closePath();
  cel(g,fp,C.skin,C.skinD,gg=>gg.fillRect(s>0?hx-r*2:hx+r*.1,hy-2*r,r*1.9,4*r),.18);
  if(o.shades){g.fillStyle='#0b0b14';rrect(g,s>0?hx+r*.25:hx-r*.98,hy-r*.02,r*.73,r*.36,r*.1);g.fill();g.fillStyle='rgba(56,216,255,.9)';g.fillRect(hx+s*r*.62,hy+r*.04,r*.14,r*.08);}
  else{ell(g,hx+s*r*.55,hy+r*.14,r*.08,r*.17,INK);ell(g,hx+s*r*.53,hy+r*.07,r*.03,r*.045,'#ffffff');g.fillStyle='rgba(255,110,110,.2)';g.beginPath();g.ellipse(hx+s*r*.45,hy+r*.5,r*.15,r*.07,0,0,TAU);g.fill();}
  if(o.hood){g.strokeStyle=C.coat;g.lineWidth=r*.34;g.beginPath();g.moveTo(hx+s*r*.5,hy+r*1.05);g.quadraticCurveTo(hx+s*r*.78,hy-r*1.05,hx-s*r*.2,hy-r*1.15);g.stroke();
    cel(g,ellP(hx-s*r*.35,hy-r*.1,r*.8,r*1.1),C.coat,C.coatD,gg=>gg.fillRect(hx-s*r*2-r,hy-2*r,2*r,4*r),.16);return;}
  inkEll(g,hx-s*r*.08,hy+r*.18,r*.2,r*.28,C.skin,.14);
  const hp=new Path2D();hp.moveTo(hx+s*r*.95,hy-r*.12);hp.lineTo(hx+s*r*.66,hy-r*.35);hp.lineTo(hx+s*r*.72,hy-r*.05);hp.lineTo(hx+s*r*.38,hy-r*.42);
  hp.quadraticCurveTo(hx+s*r*.1,hy-r*.15,hx-s*r*.2,hy-r*.1);hp.quadraticCurveTo(hx-s*r*.3,hy+r*.6,hx-s*r*.45,hy+r*(o.longHair?1.9:.7));hp.lineTo(hx-s*r*.95,hy+r*(o.longHair?1.95:.6));
  hp.quadraticCurveTo(hx-s*r*1.25,hy-r*.4,hx-s*r*.6,hy-r*1.1);hp.quadraticCurveTo(hx+s*r*.4,hy-r*1.55,hx+s*r*.95,hy-r*.12);hp.closePath();
  cel(g,hp,C.hair,C.hairD,gg=>gg.fillRect(s>0?hx-r*2:hx+r*.4,hy-2*r,r*1.6,4*r));
  g.save();g.clip(hp);g.strokeStyle=rgba(C.hairL,.7);g.lineWidth=r*.12;g.beginPath();g.ellipse(hx,hy-r*.6,r*.5,r*.3,0,Math.PI*1.1,Math.PI*1.7);g.stroke();g.restore();
  if(o.hat){const hp2=new Path2D();hp2.moveTo(hx-r*1.06,hy-r*.25);hp2.bezierCurveTo(hx-r*1.15,hy-r*1.55,hx+r*1.15,hy-r*1.55,hx+r*1.06,hy-r*.25);hp2.closePath();cel(g,hp2,C.hat,C.hatD,gg=>gg.fillRect(s>0?hx-2*r:hx+r*.3,hy-2*r,1.7*r,2*r));
    if(o.hat==='cap')cel(g,ellP(hx+s*r*1.1,hy-r*.32,r*.72,r*.17),C.hatD,null,null,.14);else cel(g,rrP(hx-r*1.08,hy-r*.55,r*2.16,r*.38,r*.14),C.hatD,null,null,.14);}
}
// Someone sitting in a bus seat, seen through the window, facing the front. y is the seat.
function drawSeated(g,q,x,y){
  const d=D(q.h),C=q.C,sh=[x+.5,y-d.torso];
  cel(g,rrP(x-1.3,sh[1],2.8,d.torso+.4,1),C.coat,C.coatD,gg=>gg.fillRect(x-1.4,sh[1],1.2,d.torso+1));
  limb(g,[[sh[0],sh[1]+1],[x+1.6,y-2.4],[x+3.6,y-1.6]],1.2,1,C.coat,null);
  g.fillStyle=C.skin;g.fillRect(sh[0]-.4,sh[1]-d.neck-.6,.9,d.neck+1);
  drawHeadS(g,q,sh[0]+.3,sh[1]-d.neck-d.hr*.95,d.hr,1);
}
function drawDog(g,dg,x,y0,s,ph){
  const c=dg.col,dk=shade(c,-.32);
  for(const[ox_,k,far]of[[2,0,1],[-2.2,Math.PI,1],[2,Math.PI,0],[-2.2,0,0]]){const sw=Math.sin(ph+k)*.9;limb(g,[[x+s*ox_,y0-3],[x+s*(ox_+sw),y0-.35]],.6,.6,far?dk:c,null);}
  g.strokeStyle=INK;g.lineWidth=.6;g.beginPath();g.moveTo(x-s*3.2,y0-4.1);g.quadraticCurveTo(x-s*4.3,y0-4.6+Math.sin(ph*2)*.3,x-s*4.4,y0-5.8);g.stroke();g.strokeStyle=c;g.lineWidth=.36;g.stroke();
  cel(g,ellP(x,y0-3.7,3.4,1.4),c,dk,gg=>gg.fillRect(x-4,y0-3.4,8,2),.18);
  cel(g,ellP(x+s*3.3,y0-5,1.25,1.05),c,null,null,.18);cel(g,ellP(x+s*4.4,y0-4.65,.85,.5),c,null,null,.16);ell(g,x+s*5.15,y0-4.8,.24,.2,INK);ell(g,x+s*3.6,y0-5.2,.14,.2,INK);
  cel(g,ellP(x+s*2.9,y0-5.4,.45,.9),dk,null,null,.14);
}
function drawCat(g,eg,c,x,y0){
  const col=c.col,dk=shade(col,-.3);
  if(c.state==='sit'){const bp=new Path2D();bp.moveTo(x-1.5,y0);bp.quadraticCurveTo(x-1.9,y0-2.6,x-.9,y0-3.6);bp.lineTo(x+.9,y0-3.6);bp.quadraticCurveTo(x+1.9,y0-2.6,x+1.5,y0);bp.closePath();cel(g,bp,col,dk,gg=>gg.fillRect(x+.4,y0-4,2,4),.16);
    g.strokeStyle=INK;g.lineWidth=.55;g.beginPath();g.moveTo(x+1.3,y0-.3);g.quadraticCurveTo(x+2.8,y0-.3,x+2.8,y0-1.4);g.stroke();g.strokeStyle=col;g.lineWidth=.3;g.stroke();
    const hp=new Path2D();hp.ellipse(x,y0-4.4,1.25,1.05,0,0,TAU);for(const s of[-1,1]){hp.moveTo(x+s*.35,y0-5.2);hp.lineTo(x+s*1.1,y0-6.1);hp.lineTo(x+s*1.2,y0-4.9);hp.closePath();}cel(g,hp,col,null,null,.16);
    if(noise(t*.7+c.s)>.12&&eg){eg.fillStyle='#d8ff8a';for(const s of[-1,1]){eg.beginPath();eg.ellipse(x+s*.45,y0-4.5,.22,.16,0,0,TAU);eg.fill();}}return;}
  const s=c.dir;for(const[ox_,k,far]of[[1.6,0,1],[-1.6,Math.PI,1],[1.6,Math.PI,0],[-1.6,0,0]]){const sw=Math.sin(c.ph+k)*.6;limb(g,[[x+s*ox_,y0-1.8],[x+s*(ox_+sw),y0-.25]],.42,.42,far?dk:col,null);}
  g.strokeStyle=INK;g.lineWidth=.55;g.beginPath();g.moveTo(x-s*2.2,y0-2.6);g.quadraticCurveTo(x-s*3.4,y0-3.2,x-s*3.2,y0-4.6);g.stroke();g.strokeStyle=col;g.lineWidth=.3;g.stroke();
  cel(g,ellP(x,y0-2.3,2.4,.95),col,dk,gg=>gg.fillRect(x-3,y0-2,6,1),.16);
  const hp=new Path2D();hp.ellipse(x+s*2.4,y0-3,.9,.8,0,0,TAU);hp.moveTo(x+s*2.05,y0-3.55);hp.lineTo(x+s*2.25,y0-4.45);hp.lineTo(x+s*2.7,y0-3.7);hp.closePath();cel(g,hp,col,null,null,.15);
}
// A soft shadow on the ground under someone or something, stretched away from the nearest lamp.
function groundShadow(g,x,y0,rx,a){
  g.fillStyle=rad(g,0,0,0,1,[[0,`rgba(10,8,30,${a})`],[1,'rgba(10,8,30,0)']]);
  g.save();g.translate(x,y0);g.scale(rx,rx*.22);g.beginPath();g.arc(0,0,1,0,TAU);g.fill();g.restore();
  let L=null,ld=1e9;for(const l of LAMPS){const d=Math.abs(l.x+l.arm-x);if(d<ld){ld=d;L=l;}}
  if(L&&ld<80){const dir=Math.sign(x-(L.x+L.arm))||1,k=1-ld/80;g.save();g.translate(x+dir*rx*(1+k*.8),y0-.3);g.scale(rx*(1.3+k*1.4),rx*.18);g.globalAlpha=.6*k;g.beginPath();g.arc(0,0,1,0,TAU);g.fill();g.restore();}
}

/* ---------- vehicles ---------- */
const CARC=[['black','#2a2c38'],['white','#e8e8ee'],['silver','#aab0bc'],['grey','#6e7480'],['blue','#3a5a9a'],['red','#c83c3e'],['green','#3a7a5a'],['beige','#d0bc94'],['teal','#2e8a8a'],['orange','#e0783a'],['mint','#9ad0b8']];
const PAD=3;
// A sprite in the vehicle's own units, facing right, with the ground at y = h.
function spr(L,h){const[c,g]=mk((L+2*PAD)*S,(h+2*PAD)*S);g.setTransform(S,0,0,S,PAD*S,PAD*S);g.lineJoin='round';g.lineCap='round';return[c,g];}
function wheel(g,cx,cy,r){inkEll(g,cx,cy,r,r,'#24242c',.2);inkEll(g,cx,cy,r*.55,r*.55,'#b8bec8',.14);g.fillStyle='#8a909c';g.beginPath();g.arc(cx,cy,r*.55,.2,Math.PI*.9);g.fill();ell(g,cx,cy,r*.16,r*.16,'#4a4e58');}
function carSprite(kind,col){
  const van=kind==='van',L=van?ri(54,60):ri(44,52),h=van?21:17,[c,g]=spr(L,h),wr=van?3.6:3.3,w1=L*.19,w2=L*.8,wy=h-wr,dk=shade(col,-.3);
  const p=new Path2D();
  if(van){p.moveTo(.6,h-3.2);p.lineTo(.6,2.8);p.quadraticCurveTo(.6,1.2,2.2,1.2);p.lineTo(L-13,1.2);p.quadraticCurveTo(L-10,1.4,L-6.5,7);p.lineTo(L-2.4,8.6);p.quadraticCurveTo(L-.4,9.2,L-.4,11.2);}
  else{p.moveTo(.8,h-3.2);p.lineTo(.6,h-7.2);p.quadraticCurveTo(.8,h-9.2,3.2,h-9.4);p.lineTo(L*.24,h-9.8);p.quadraticCurveTo(L*.3,h-15.6,L*.42,h-15.9);p.lineTo(L*.6,h-15.9);p.quadraticCurveTo(L*.67,h-15.6,L*.76,h-10.4);p.lineTo(L-3,h-9.6);p.quadraticCurveTo(L-.4,h-9.2,L-.3,h-6.8);}
  p.lineTo(L-.5,h-3.2);p.lineTo(w2+wr+1.1,h-3.2);p.arc(w2,wy,wr+1.1,0,Math.PI,true);p.lineTo(w1+wr+1.1,h-3.2);p.arc(w1,wy,wr+1.1,0,Math.PI,true);p.closePath();
  cel(g,p,col,dk,gg=>gg.fillRect(-1,h-6.4,L+2,4),0);
  g.save();g.clip(p);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(0,van?h-12:h-9.5,L,.35);g.restore();
  // Windows: flat dark glass with one bright glint.
  const gl=new Path2D();
  if(van){gl.moveTo(L-13.5,2.6);gl.lineTo(L-11,2.6);gl.quadraticCurveTo(L-8.8,3,L-6.8,7.6);gl.lineTo(L-13.5,7.6);gl.closePath();gl.rect(L-24,2.6,8.5,5);}
  else{gl.moveTo(L*.26,h-10.2);gl.quadraticCurveTo(L*.315,h-15,L*.425,h-15.2);gl.lineTo(L*.595,h-15.2);gl.quadraticCurveTo(L*.66,h-15,L*.745,h-10.6);gl.closePath();}
  cel(g,gl,'#2a3a58','#1c2840',gg=>gg.fillRect(0,van?5.6:h-12,L,4),.14);
  g.save();g.clip(gl);g.strokeStyle='rgba(220,235,255,.55)';g.lineWidth=.45;g.beginPath();g.moveTo(L*.4,h-16);g.lineTo(L*.32,h-9);g.moveTo(van?L-10:L*.62,van?2:h-16);g.lineTo(van?L-12:L*.56,van?8:h-9);g.stroke();g.restore();
  if(!van){g.fillStyle=col;g.fillRect(L*.5-.4,h-15.6,.8,5.6);seg(g,[L*.5-.4,h-15.4],[L*.5-.4,h-10.2],.12,INK);seg(g,[L*.5+.4,h-15.4],[L*.5+.4,h-10.2],.12,INK);}
  g.strokeStyle=INK;g.lineWidth=.12;g.beginPath();for(const sx of van?[L*.45,L-15]:[L*.28,L*.5,L*.73]){g.moveTo(sx,van?2:h-10.2);g.lineTo(sx,h-3.6);}g.stroke();
  g.fillStyle=INK;for(const sx of van?[L*.48,L-17]:[L*.42,L*.64])g.fillRect(sx,h-8.4,1.6,.35);
  g.strokeStyle=INK;g.lineWidth=.22;g.stroke(p);
  if(!van)inkEll(g,L*.75,h-10.8,.7,.45,col,.14);
  cel(g,rrP(L-2.4,h-(van?9.4:8.4),2.2,1.3,.4),'#f0f2f4',null,null,.12);cel(g,rrP(.4,h-(van?10:8.8),1.6,1.6,.3),'#8a1a1e',null,null,.12);
  if(kind==='taxi'){cel(g,rrP(L*.47,h-17.4,4.2,1.5,.4),'#f4ead0',null,null,.14);g.fillStyle='#2a2418';g.font=`700 1.1px ${SANS}`;g.textAlign='center';g.fillText('TAXI',L*.47+2.1,h-16.25);}
  wheel(g,w1,wy,wr);wheel(g,w2,wy,wr);
  return{c,L,h,hy:h-(van?8.8:7.8),ty:h-(van?9.2:8),sign:kind==='taxi'?[L*.47,h-17.4,4.2,1.5]:null};
}
function bikeSprite(kind){
  const L=18,h=20,[c,g]=spr(L,h),r=body(makeLook()),C=r.C,col=pick(CARC)[1];
  wheel(g,3.2,h-2.7,2.7);wheel(g,14.6,h-2.7,2.7);
  g.strokeStyle=INK;g.lineWidth=.55;g.beginPath();g.moveTo(3.2,h-2.7);g.lineTo(7,h-6);g.lineTo(13,h-6.5);g.lineTo(14.6,h-2.7);g.moveTo(13,h-6.5);g.lineTo(12.6,h-10.5);g.stroke();
  cel(g,rrP(5,h-8.8,8,3.2,1.4),col,shade(col,-.3),gg=>gg.fillRect(5,h-7,9,2));
  limb(g,[[8,h-9],[11.6,h-6.4],[11,h-3.4]],1.6,1.3,C.pants,C.pantsD);
  cel(g,rrP(6,h-16.4,4,7.6,1.4),C.coat,C.coatD,gg=>gg.fillRect(6,h-16,1.4,8));
  limb(g,[[9,h-15],[12.2,h-11]],1.1,1.1,C.coat,null);inkEll(g,12.4,h-10.8,.45,.45,C.skin,.12);
  const hc=kind==='scooter'?'#eeeef2':pick(['#c8483a','#22222c','#e8c840']);cel(g,ellP(8.4,h-17.9,1.8,1.9),hc,shade(hc,-.3),gg=>gg.fillRect(6,h-17.5,5,3));
  cel(g,ellP(9.5,h-17.7,.9,.7),'#22324a',null,null,.12);
  if(kind==='scooter'){const bc=pick(['#2ad0c0','#ff8a2a','#e84a8a']);cel(g,rrP(.4,h-15,5,6.4,.6),bc,shade(bc,-.3),gg=>gg.fillRect(.4,h-11,5,3));ell(g,2.9,h-12.2,.9,.9,'rgba(255,255,255,.75)');}
  return{c,L,h,hy:h-9.8,ty:h-8.6};
}
// A bus: body with the windows cut out, what the windows show, the glass over it, and a glow for its lit windows.
// A rounded city bus, cream above the windows and coloured below.
function busSprites(L,h,nis){
  const[lower,upper,stripe]=FLEET,wTop=11,wBot=25.5,floor=h-4,win=[],x0=5,x1=L-11,n=Math.max(5,Math.round((x1-x0)/15)),pw=(x1-x0-(n-1)*1.6)/n;
  for(let i=0;i<n;i++)win.push([x0+i*(pw+1.6),wTop,pw,wBot-wTop]);
  const shield=[L-8,4.5,7.2,26],rear=[1.4,wTop,2.4,8];
  const winPath=new Path2D();for(const[a,y,w,hh]of win)winPath.addPath(rrP(a,y,w,hh,1));
  winPath.moveTo(shield[0]+1.6,shield[1]);winPath.lineTo(shield[0]+shield[2]-1.2,shield[1]+.8);winPath.quadraticCurveTo(shield[0]+shield[2],shield[1]+1.4,shield[0]+shield[2],shield[1]+3.4);winPath.lineTo(shield[0]+shield[2],shield[1]+shield[3]);winPath.lineTo(shield[0],shield[1]+shield[3]);winPath.lineTo(shield[0],shield[1]+1.4);winPath.closePath();
  winPath.addPath(rrP(...rear,.6));
  // Body.
  let[c,g]=spr(L,h);
  cel(g,rrP(L*.3,-1.4,L*.24,1.8,.8),'#c8ccd4','#9aa0aa',gg=>gg.fillRect(L*.3,-.6,L*.3,1),.16);
  const bodyP=new Path2D();bodyP.moveTo(3.4,.4);bodyP.lineTo(L-6,.4);bodyP.quadraticCurveTo(L,.4,L,6.4);bodyP.lineTo(L,h-4.4);bodyP.lineTo(0,h-4.4);bodyP.lineTo(0,3.8);bodyP.quadraticCurveTo(0,.4,3.4,.4);bodyP.closePath();
  g.fillStyle=upper;g.fill(bodyP);
  g.save();g.clip(bodyP);
  g.fillStyle=lower;g.fillRect(0,wBot+1.8,L,h);g.fillStyle=stripe;g.fillRect(0,wBot+1.8,L,1.1);
  g.fillStyle=shade(lower,-.3);g.fillRect(0,h-8.6,L,5);g.fillStyle=shade(upper,-.12);g.fillRect(0,.4,L,1.6);
  g.fillStyle='rgba(255,255,255,.4)';g.fillRect(0,2.2,L,.3);g.fillRect(0,wBot+3.2,L,.25);
  g.fillStyle='#22242c';g.fill(rrP(x0-1,wTop-1,x1-x0+2,wBot-wTop+2,1.6));g.fill(rrP(shield[0]-.8,shield[1]-.6,shield[2]+1.6,shield[3]+1.2,1.6));
  g.fillStyle='#0c0c10';g.fill(rrP(L-61,2.4,50,7,.6));g.fill(rrP(1.6,2.4,13,7,.6));
  g.strokeStyle=rgba(INK,.5);g.lineWidth=.14;g.beginPath();for(let x=L*.12;x<L;x+=L*.24){g.moveTo(x,wBot+3);g.lineTo(x,h-4.6);}g.stroke();
  g.fillStyle=upper;g.font=`italic 800 2.6px ${SANS}`;g.textAlign='left';g.fillText(FLEET[3],L*.36,h-10.2);
  g.restore();
  g.strokeStyle=INK;g.lineWidth=.24;g.stroke(bodyP);
  g.globalCompositeOperation='destination-out';g.fill(winPath);g.globalCompositeOperation='source-over';
  g.strokeStyle=INK;g.lineWidth=.12;g.stroke(winPath);
  g.strokeStyle=INK;g.lineWidth=.5;g.beginPath();g.moveTo(L-.2,6);g.quadraticCurveTo(L+2,6.2,L+2.2,8.6);g.stroke();cel(g,rrP(L+1.2,8.4,1.4,3.6,.4),'#3a3e48',null,null,.14);
  cel(g,rrP(L-1.4,h-9.2,1.4,1.8,.4),'#f0f2f4',null,null,.12);cel(g,rrP(0,h-13.6,1.2,4.4,.4),'#8a1a1e',null,null,.12);
  for(const wx of[L*.17,L*.79]){g.fillStyle='#14141a';g.beginPath();g.arc(wx,h-4.6,5.3,Math.PI,TAU);g.fill();wheel(g,wx,h-4.6,4.5);}
  const spr_=c;
  // Inside: a lit ceiling, the far windows dark, seat backs and yellow poles.
  [c,g]=spr(L,h);g.save();g.clip(winPath);
  g.fillStyle=lin(g,0,4,0,floor,[[0,'#fffbe8'],[.18,'#f0e2b8'],[.2,'#26324e'],[.55,'#2c3a58'],[.58,'#e0d4b0'],[1,'#c0b494']]);g.fillRect(0,0,L,h);
  for(let i=0;i<40;i++){const x=h3(i,1,L)*L,y=13+h3(i,2,L)*7;g.fillStyle=`rgba(255,${190+h3(i,3,L)*50|0},120,${.2+h3(i,4,L)*.3})`;g.beginPath();g.arc(x,y,.25+h3(i,5,L)*.5,0,TAU);g.fill();}
  g.fillStyle='#ffffff';g.fillRect(0,wTop,L,.7);
  for(const s of seatsFor(L)){cel(g,rrP(s-3.2,22.4,2.4,5,.9),'#4a6ab0','#334c88',gg=>gg.fillRect(s-2,22,2,6),.12);}
  g.fillStyle='#f0c040';for(let x=16;x<L-14;x+=27)g.fillRect(x,wTop,.35,wBot-wTop);g.fillRect(0,wTop+2.2,L,.3);
  if(nis){g.fillStyle='rgba(10,16,30,.62)';g.fillRect(0,0,L,h);}
  g.restore();const inner=c;
  // The glass: a few bright glints over everything behind it.
  [c,g]=spr(L,h);g.save();g.clip(winPath);
  for(let x=-10;x<L;x+=26){g.fillStyle='rgba(225,235,255,.13)';g.beginPath();g.moveTo(x,0);g.lineTo(x+5,0);g.lineTo(x+1,h);g.lineTo(x-4,h);g.closePath();g.fill();}
  g.restore();const glass=c;
  // A soft glow round the lit windows.
  [c,g]=spr(L,h);g.shadowColor=nis?'rgba(120,140,150,.5)':'rgba(255,240,200,.9)';g.shadowBlur=2.6*S;g.fillStyle=nis?'rgba(60,70,80,.4)':'rgba(255,240,200,.5)';g.fill(winPath);const glow_=c;
  return{spr:spr_,inner,glass,glow:glow_};
}
const seatsFor=L=>{const s=[];for(let x=12;x<=L-22;x+=9)s.push(x);return s;};
function paxFrom(o,C){const q=body(o);if(C)q.C=C;return Object.assign(q,{ox:0,seat:0,tgt:0,walk:false,ph:0,out:false,gone:false});}

function spawnBus(){
  // Buses on one route keep at least a minute apart.
  const lane=chance(.72)?1:0,d=lane?FD:-FD,free=ROUTES.filter(r=>t-(r.last??-1e9)>60),nis=chance(.12)||!free.length,route=nis?null:pick(free),L=ri(118,138),h=ri(40,42);
  const v=newVeh('bus',lane,d,L,h,rr(68,86));if(!v)return;if(route)route.last=t;
  Object.assign(v,busSprites(L,h,nis),{nis,route,pax:[],seats:seatsFor(L),drv:paxFrom(makeLook()),hy:h-8.4,ty:h-12,boarded:0,stopped:false,passed:false,ind:false,indT:0});
  if(!nis){const seats=shuffle(v.seats.slice());for(let i=wpick([[0,3],[1,4],[2,3],[3,1.5],[4,.6]]);i>0;i--){const q=paxFrom(makeLook());q.seat=q.ox=q.tgt=seats.pop();v.pax.push(q);}
    if(lane===1&&v.pax.length&&chance(.22))v.alight=pick(v.pax);}
  if(!lane)log(nis?'A bus marked NOT IN SERVICE goes by the other way':`A ${route.n} goes by the other way`);
}
function spawnCar(){
  const lane=chance(.5)?1:0,d=lane?FD:-FD,kind=wpick([['car',8],['taxi',2],['van',2],['moto',1],['scooter',1.2]]);
  const[cn,col]=kind==='taxi'?['yellow','#e8b83a']:pick(CARC),L_=kind==='moto'||kind==='scooter'?18:kind==='van'?60:52;
  const v=newVeh(kind,lane,d,L_,20,kind==='scooter'?rr(70,95):rr(85,150));if(!v)return;
  const s=kind==='moto'||kind==='scooter'?bikeSprite(kind):carSprite(kind,col);
  Object.assign(v,{spr:s.c,L:s.L,h:s.h,hy:s.hy,ty:s.ty,sign:s.sign,col,free:kind==='taxi'&&chance(.6)});stats.cars++;
  log(kind==='taxi'?(v.free?'A taxi goes by, its roof light on':'A taxi goes by with a fare in the back'):kind==='van'?`${cap(an(cn))} van rumbles past`:kind==='moto'?'A motorbike goes by':kind==='scooter'?'A delivery scooter buzzes past':`${cap(an(cn))} car passes ${pick(['','slowly','quickly'])}`.trim());
}
// Far-lane vehicles start well upstream of the stop, so a bus always has room to slow down for it.
function newVeh(kind,lane,d,L,h,cruise){
  let front=d>0?ox-4:ox+VW+4;if(lane===1)front=d>0?Math.min(front,POLE-280):Math.max(front,POLE+280);
  for(const o of veh)if(o.lane===lane&&(o.front-o.d*o.L-front)*d<24)return null;
  const v={kind,lane,d,L,h,front,v:cruise,cruise,y:lane?FAR:NEAR,s:rr(0,99),state:'drive',brk:false};
  veh.push(v);return v;
}

/* ---------- the bus stop's little stories ---------- */
const BRK=24;
const waiting=()=>people.filter(p=>p.kind==='wait'&&!p.leaving);
function wantsStop(v){return!!v.route&&(!!v.alight||waiting().some(p=>p.route===v.route));}
function who(p){return waiting().length>1?cap(p.o.desc):'They';}
function nextBus(){let best=null,bd=1e9;for(const v of veh)if(v.kind==='bus'&&v.lane===1&&!v.passed){const d=(POLE-v.front)*v.d;if(d>-2&&d<bd){bd=d;best=v;}}return best?[best,bd]:null;}
function busFor(p){return veh.find(v=>v.kind==='bus'&&v.lane===1&&v.route===p.route&&(v.state==='brake'||v.state==='dwell'||v.state==='depart'));}
function seatX(){for(let i=0;i<12;i++){const x=ri(BENCH[0]+4,BENCH[1]-4);if(!people.some(p=>p.kind==='wait'&&Math.abs(p.x-x)<8))return x;}return null;}

function newWaiter(seated){
  const p=newPerson('wait');Object.assign(p,{route:pick(ROUTES),waited:0,patience:rr(480,1300),tl:expo(6),tp:expo(18),ts:expo(60)});
  if(seated){p.x=seatX()??MID;sitDown(p);p.waited=rr(20,200);return p;}
  const side=chance(.5)?-1:1;p.x=edge(side);p.y=41;
  go(p,POLE-FD*3,rr(13,18),()=>atPole(p));
  return p;
}
function atPole(p){
  p.state='read';p.dir=FD;p.rt=rr(2,4.5);
  log(`${cap(p.o.desc)} comes to the stop and reads the timetable`);
  const late=veh.find(v=>v.kind==='bus'&&v.lane===1&&v.route===p.route&&v.state==='drive'&&v.stopped&&(v.front-POLE)*v.d<90);
  if(late)log(`They get there just as the ${late.route.n} pulls away`);
}
function settle(p){
  // If their bus is already here they hurry for it. If it is still pulling in, they wait by the pole.
  const v=busFor(p);if(v&&v.state!=='brake')return hurry(p,v);
  if(v){go(p,POLE-FD*6,12,()=>{p.state='wait';});return;}
  const x=chance(.68)?seatX():null;
  if(x!==null){go(p,x,13,()=>sitDown(p));log(`${who(p)} sit${who(p)==='They'?'':'s'} down to wait for the ${p.route.n}`);}
  else{go(p,clamp(POLE-FD*rr(4,22),BENCH[0],BENCH[1]),12,()=>{p.state='wait';p.dir=FD;});log(`${who(p)} wait${who(p)==='They'?'':'s'} by the pole for the ${p.route.n}`);}
}
function sitDown(p){p.state='sit';p.sit=true;p.y=SIT;p.head=0;}
function stand(p){p.state='wait';p.sit=false;p.y=42;}
function hurry(p,v){
  if(v.state==='depart'){v.state='dwell';v.dw=1;v.ind=false;}
  const far=Math.abs(doorX(v)-p.x)>70;p.board=v;p.phone=false;p.sit=false;p.y=41;
  go(p,doorX(v),far?rr(28,34):rr(17,21),()=>board(p,v));
  if(far)log(`${who(p)} run${who(p)==='They'?'':'s'} for the ${v.route.n}`);
}
function board(p,v){
  if(!veh.includes(v)||(v.state!=='dwell'&&v.state!=='depart')){p.board=null;p.state='wait';log(`The doors close before ${p.o.desc} gets there`);return;}
  p.dead=true;const q=paxFrom(p.o,p.C);q.h=p.h;
  const free=v.seats.filter(s=>!v.pax.some(o=>o.seat===s));q.seat=free.length?pick(free):v.seats[0];q.ox=v.L-14;q.tgt=q.seat;q.walk=true;
  v.pax.push(q);v.boarded++;stats.boarded++;
  const m=Math.round(p.waited/60),w=who(p);
  if(v.boarded>1)return log(`${cap(p.o.desc)} gets on too`);
  log(p.waited>=90?`After ${m} minute${m>1?'s':''}, ${w==='They'?'they':w.toLowerCase()} get${w==='They'?'':'s'} on the ${v.route.n}`:`${w} get${w==='They'?'':'s'} on the ${v.route.n}`);
}
function leave(p,why){
  p.leaving=true;p.alert=null;p.phone=false;p.sit=false;p.y=41;p.head=0;const side=chance(.5)?-1:1;
  go(p,edge(side),rr(13,17),()=>{p.dead=true;});
  if(why==='give up'){const m=Math.round(p.waited/60);log(`After ${m} minutes, ${who(p)==='They'?'they give':p.o.desc+' gives'} up on the ${p.route.n} and walk${who(p)==='They'?'':'s'} off to the ${side<0?'left':'right'}`);}
}
function busArrives(v){
  const w=waiting().filter(p=>p.route===v.route);
  log(w.length?`The ${v.route.n} pulls in`:`The ${v.route.n} pulls in to let someone off`);
  if(v.alight){const q=v.alight;q.walk=true;q.tgt=v.L-14;q.out=true;}
}
function getOff(v,q){
  q.gone=true;v.alight=null;
  const p=newPerson('alight',q.o);p.C=q.C;p.h=q.h;p.x=doorX(v);p.y=41;
  const side=chance(.5)?-1:1;go(p,edge(side),rr(13,17),()=>{p.dead=true;});
  log(`${cap(q.o.desc)} gets off the ${v.route.n} and walks off to the ${side<0?'left':'right'}`);
}
function busLeaves(v){
  if(!v.boarded)return log(`The ${v.route.n} pulls away`);
  log(`The ${v.route.n} pulls away. ${waiting().length?'Someone is still waiting':'The stop is empty again'}`);
}
function busPasses(v){
  const w=waiting();stats.passed++;
  if(v.nis)return log(w.length?`A bus marked NOT IN SERVICE goes by. ${w.length>1?'They both':'They'} watch it go`:'A bus marked NOT IN SERVICE goes by');
  const n=v.route.n;
  if(w.length)return log(`The ${n} goes by. ${w.length>1?'Neither of them is waiting for it':'Not the one they are waiting for'}`);
  log(pick([`The ${n} goes by without stopping. Nobody is waiting`,`The ${n} passes the empty stop`,v.pax.length?`The ${n} goes by with ${v.pax.length===1?'one passenger':v.pax.length+' passengers'} inside`:`An empty ${n} goes by`]));
}

function updWaiter(p,dt){
  p.waited+=dt;
  const nb=nextBus();
  if(nb&&nb[1]<240&&p.alert!==nb[0]&&nb[0]!==p.seen){p.alert=p.seen=nb[0];p.react=rr(.4,1.4);p.phone=false;p.after=null;}
  if(p.alert){
    const v=p.alert;
    if(!veh.includes(v)){p.alert=null;return;}
    p.head=Math.abs(v.front-p.x)<3?0:Math.sign(v.front-p.x);
    if(p.react>0){p.react-=dt;if(p.react<=0&&p.sit){stand(p);p.wasSit=true;}}
    if(v.state==='dwell'&&v.route===p.route){p.alert=null;return hurry(p,v);}
    const rear=v.front-v.d*v.L;
    if(v.passed||(rear-p.x)*v.d>0){
      p.after=(p.after??rr(1.5,3.5))-dt;
      if(p.after<=0){p.after=null;p.alert=null;p.head=0;if(p.wasSit&&chance(.75)&&seatX()!==null)sitDown(p);p.wasSit=false;}
    }
    return;
  }
  if(p.waited>p.patience)return leave(p,'give up');
  // Small things to pass the time, each on its own timer.
  p.tl-=dt;if(p.tl<=0){p.tl=expo(9);if(!p.phone){p.head=chance(.75)?-FD:FD;p.hl=rr(1.2,4);if(p.head===-FD&&chance(.15))logOnce('look',60,`${who(p)} look${who(p)==='They'?'':'s'} up the road for the bus`);}}
  if(p.head&&p.hl!==undefined){p.hl-=dt;if(p.hl<=0){p.head=0;p.hl=undefined;}}
  p.tp-=dt;if(p.tp<=0){p.phone=!p.phone;p.tp=p.phone?rr(6,35):expo(25);if(p.phone)p.head=0;}
  p.ts-=dt;if(p.ts<=0){p.ts=expo(55);
    if(p.sit){stand(p);p.head=-FD;p.hl=rr(4,10);p.phone=false;}
    else if(chance(.6)){const x=seatX();if(x!==null)go(p,x,12,()=>sitDown(p));}
    else{const x=clamp(p.x+rr(-12,12),BENCH[0]+2,BENCH[1]-2);go(p,x,10,()=>{p.state='wait';});}}
}
function updPerson(p,dt){
  if(MOOD.cold>.5){p.tb-=dt;if(p.tb<=0){p.tb=expo(3.2);const d=D(p.h);parts.push({x:p.x+(p.state==='walk'||p.state==='read'?p.dir*1.8:p.head*.8),yu:p.y+(p.sit?7.3+d.torso*.95+d.neck+d.hr*.4:d.leg+d.torso+d.neck+d.hr*.4),age:0,life:rr(1.4,2.4),vx:rr(-.8,.8)});}}
  if(p.state==='walk'){
    const dx=p.tx-p.x,st=p.sp*dt;if(dx)p.dir=Math.sign(dx);
    if(Math.abs(dx)<=st){p.x=p.tx;p.ph=0;p.state='idle';const f=p.then;p.then=null;if(f)f();}
    else{p.x+=Math.sign(dx)*st;p.ph+=dt*p.sp/14*Math.PI*2;}
    if(p.dog)p.dog.ph+=dt*p.sp/6*Math.PI;
    return;
  }
  if(p.state==='read'){p.rt-=dt;if(p.rt<=0)settle(p);return;}
  if(p.kind==='wait'&&(p.state==='sit'||p.state==='wait'))updWaiter(p,dt);
}
function updCat(c,dt){
  if(c.state==='sit'){c.rest-=dt;if(c.rest<=0){c.state='walk';log('The cat gets up and wanders off');}return;}
  c.x+=c.dir*c.sp*dt;c.ph+=dt*c.sp/4*Math.PI;
  if(!c.sat&&c.willSit&&Math.abs(c.x-(BENCH[0]+BENCH[1])/2)<2){c.sat=true;c.state='sit';c.rest=rr(15,60);logOnce('cat',30,'The cat sits down by the bench for a while');}
  if((c.x-edge(c.dir))*c.dir>0)c.dead=true;
}

/* ---------- events ---------- */
// Each kind of event waits its own exponentially distributed gap. m is the average gap in seconds, f the first wait.
const SCHED={arrive:{m:150,f:18},bus:{m:75,f:30},car:{m:9,f:3},walker:{m:95,f:45},window:{m:16,f:6},ad:{m:80,f:28},flicker:{m:170,f:60},rain:{m:420,f:200},cat:{m:420,f:130},plane:{m:240,f:90},litter:{m:150,f:70},shop:{m:700,f:400}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
const FLOORS=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh'];
function fire(k){
  if(k==='arrive'){const n=waiting().length;if(n===0||(n===1&&chance(.3)))newWaiter(false);}
  else if(k==='bus')spawnBus();
  // Late at night traffic comes and goes in waves, so some car slots stay empty.
  else if(k==='car'){if(chance(.35+.65*fbm(t*.004+TO)))spawnCar();}
  else if(k==='walker'){if(people.some(p=>p.kind==='pass'))return;const p=newPerson('pass'),side=chance(.5)?-1:1,kind=wpick([['walk',5],['dog',1.5],['jog',1]]);
    p.x=edge(side);p.y=chance(.6)?40:39;if(kind==='dog')p.dog={col:pick(['#d8a868','#3a302a','#f0e8d8','#9a7a5a']),ph:0};
    go(p,edge(-side),kind==='jog'?rr(32,40):rr(12,18),()=>{p.dead=true;});
    log(kind==='dog'?`${cap(p.o.desc)} walks a dog past the stop`:kind==='jog'?'A late jogger runs past the stop':`${cap(p.o.desc)} walks past without stopping`);}
  else if(k==='window'){const w=pick(DYNW);if(!w)return;
    // The night wears on: later on, lights go off more often than they go on.
    if(!w.want&&chance(.45*sstep(0,2400,t)))return;
    w.want=1-w.want;w.rate=rr(.2,1.2);log(w.want?`A light goes on, ${FLOORS[w.f]} floor across the street`:`A window goes dark on the ${FLOORS[w.f]} floor`);}
  else if(k==='ad'){if(ads.next)return;ads.next=makeAd();ads.k=0;logOnce('ad',200,'The poster in the shelter scrolls to the next ad');}
  else if(k==='flicker'){if(tube.out>0||tube.seq)return;const p=[];let s=0;for(let i=ri(2,5)*2;i>0;i--){s+=rr(.05,.4);p.push(s);}tube.seq={t0:t,p};
    if(chance(.15)){tube.out=rr(15,60);log('The light in the shelter flickers and goes out');}else logOnce('flick',90,'The light in the shelter flickers');}
  else if(k==='rain'){if(raining){raining=false;log('The rain stops');}else if(chance(MOOD.rain+.1)){raining=true;log(pick(['It starts to rain','A light rain starts to fall','Rain begins to patter on the shelter roof']));}}
  else if(k==='cat'){const side=chance(.5)?-1:1;people.push({id:PID++,kind:'cat',x:edge(side),y:42,dir:-side,sp:rr(10,16),ph:0,state:'walk',willSit:chance(.6),col:pick(['#26242c','#e8964a','#9a9aa4','#f0e8d8','#6a4a34']),s:rr(0,99)});log('A cat pads along the pavement');}
  else if(k==='plane'){const d=chance(.5)?1:-1;planes.push({x:d>0?ox-10:ox+VW+10,y:rr(6,30),v:rr(8,14)*d,ph:rr(0,1)});log('A plane blinks across the sky');}
  else if(k==='litter'){const d=wind>=0?1:-1;litter.push({x:edge(-d),yu:pick([rr(9,20),rr(24,34),rr(38,46)]),v:rr(18,40)*d,ph:rr(0,9),col:pick(['#e8e4d4','#d8b070','#c07a3a','#f0e8f0']),life:0});logOnce('litter',120,'The wind blows a scrap of paper down the street');}
  else if(k==='shop'){if(shop.closing!==null||shop.closed)return;shop.closing=t;log('The shop across the street switches off its sign and pulls the shutter down');}
}
// A poster for the shelter's lightbox: a colour field, a product and one word.
function makeAd(){
  const k=Math.max(4,S),[c,g]=mk(AD.w*k,AD.h*k);g.scale(k,k);
  const pal=pick([['#ff7a9a','#4a2a7a'],['#5ae0ff','#1a3a7a'],['#ffd86a','#9a3a2a'],['#8aff9a','#1a4a3a'],['#fff4e0','#d84a3a'],['#ff9a4a','#3a2a5a']]),a=pal[0];
  g.fillStyle=lin(g,0,0,0,AD.h,[[0,pal[1]],[1,mixC(pal[1],pal[0],.45)]]);g.fillRect(0,0,AD.w,AD.h);
  const kind=pick(['sun','bottle','phone','wave','can']);
  if(kind==='sun'){g.fillStyle=rad(g,7,13,0,5,[[0,'#ffffff'],[.3,a],[1,rgba(a,0)]]);g.fillRect(0,6,14,14);inkEll(g,7,13,3,3,a,.2);}
  else if(kind==='bottle'){cel(g,rrP(6.2,6,1.6,3,.3),a,shade(a,-.3),gg=>gg.fillRect(7.3,6,1,3),.18);cel(g,rrP(5,8.6,4,10,1.2),a,shade(a,-.3),gg=>gg.fillRect(7.4,8,2,11),.18);g.fillStyle='rgba(255,255,255,.9)';g.fillRect(5,12,4,2.2);}
  else if(kind==='phone'){cel(g,rrP(4,6.5,6,11.5,1),'#16161e',null,null,.18);g.fillStyle=lin(g,0,7,0,17,[[0,a],[1,shade(a,-.4)]]);g.fill(rrP(4.6,7.3,4.8,10,.6));}
  else if(kind==='wave'){const wp=new Path2D();wp.moveTo(0,22);for(let x=0;x<=14;x+=.5)wp.lineTo(x,13+Math.sin(x*.7)*1.6);wp.lineTo(14,22);wp.closePath();cel(g,wp,a,shade(a,-.3),gg=>gg.fillRect(0,17,14,5),.18);}
  else cel(g,rrP(4.5,8,5,9.5,.8),a,shade(a,-.3),gg=>gg.fillRect(7.6,8,2,10),.18);
  const word=pick(['NEW','RUN','GO','ZEN','JOY','EAT','FLY','NOW','YES','WOW','24H','FUN','HOT','ICE','TEA','SKY']);
  g.fillStyle='#ffffff';g.strokeStyle=INK;g.lineWidth=.35;g.font=`800 4.2px ${SANS}`;g.textAlign='center';g.strokeText(word,7,4.8);g.fillText(word,7,4.8);
  g.fillStyle='rgba(255,255,255,.55)';g.fillRect(3,20,8,.4);g.fillRect(4.5,20.8,5,.3);
  return c;
}

/* ---------- painting the street ---------- */
// The backgrounds are painted, like an animated film's: soft colour fields, a little paper texture, few outlines.
// Everything that light falls on is painted flat into A, everything that glows into E. Then A is lit by a light map:
// the steady lights in S0, and what the shelter light and the shop add kept apart in LC and SC, so they can change.
function paint(){
  let g;
  [SKY,g]=mk(CW,CH);W_(g);paintSky(g);
  [SKYL,g]=mk(CW,CH);W_(g);paintSkyline(g);
  const[A,a]=mk(CW,CH),[E,e]=mk(CW,CH);W_(a);W_(e);
  // The backs of the alleys between the buildings.
  a.fillStyle=lin(a,0,Y(BASE+60),0,Y(BASE),[[0,'#2a2a40'],[1,'#3a3850']]);a.fillRect(ox,Y(BASE+60),VW,60);
  for(const b of B)if(b.x<ox+VW+20&&b.x+b.w>ox-20)paintBuilding(a,e,b);
  if(VEND)paintVend(a,e);
  paintGround(a);
  for(const u of UPOLES)if(u.x>ox-20&&u.x<ox+VW+20)paintUPole(a,u);
  if(TREE)paintTree(a,e);
  paintShelter(a);
  a.save();a.setTransform(1,0,0,1,0,0);a.globalCompositeOperation='source-atop';a.globalAlpha=.1;a.fillStyle=pattern(a,PAPER,Math.max(1,S/4));a.fillRect(0,0,CW,CH);a.restore();
  // Lit windows stay behind the shelter: hidden by its roof, dimmed by its glass.
  e.clearRect(SH.x-3,Y(82.4),SH.w+6,9.4);e.globalCompositeOperation='destination-out';e.globalAlpha=.5;e.fillRect(SH.x,Y(BACK+29),SH.w,28);e.globalAlpha=1;e.globalCompositeOperation='source-over';
  paintWires(e);
  // The light maps, one sample per unit, smoothed when drawn over the street.
  const L=lightSets();LMW=Math.ceil(VW)+1;LMH=Math.ceil(VH)+1;
  const m0=new ImageData(LMW,LMH),ml=new ImageData(LMW,LMH),ms=new ImageData(LMW,LMH),l0=[0,0,0],lt=[0,0,0],ls=[0,0,0];
  for(let j=0;j<LMH;j++){const yu=VH-j-.5;for(let i=0;i<LMW;i++){const x=ox+i+.5,q=(j*LMW+i)*4;
    l0[0]=AMB[0];l0[1]=AMB[1];l0[2]=AMB[2];addLight(l0,L.st,x,yu);lt[0]=lt[1]=lt[2]=0;addLight(lt,L.tu,x,yu);ls[0]=ls[1]=ls[2]=0;addLight(ls,L.sp,x,yu);
    for(let ch=0;ch<3;ch++){const v0=Math.min(1,l0[ch]);m0.data[q+ch]=v0*255;ml.data[q+ch]=(Math.min(1,l0[ch]+lt[ch])-v0)*255;ms.data[q+ch]=(Math.min(1,l0[ch]+ls[ch])-v0)*255;}
    m0.data[q+3]=ml.data[q+3]=ms.data[q+3]=255;}}
  const put=d=>{const[c,gg]=mk(LMW,LMH);gg.putImageData(d,0,0);return c;};
  M0=put(m0);ML=put(ml);MS=put(ms);
  const lit=(M,x0,y0,w,h)=>{const[c,gg]=mk(w*S,h*S);gg.setTransform(S,0,0,S,-x0*S,-y0*S);gg.drawImage(A,ox,0,VW,VH);gg.globalCompositeOperation='multiply';gg.imageSmoothingEnabled=true;gg.drawImage(M,ox,0,LMW,LMH);
    gg.globalCompositeOperation='destination-in';gg.drawImage(A,ox,0,VW,VH);gg.globalCompositeOperation='source-over';gg.setTransform(1,0,0,1,0,0);return{c,x:x0,y:y0,w,h};};
  S0=lit(M0,ox,0,VW,VH).c;g=S0.getContext('2d');g.setTransform(1,0,0,1,0,0);g.drawImage(E,0,0);
  LC=lit(ML,SH.x-50,Y(130),SH.w+100,130);
  SC=lit(MS,shop.wx-70,Y(110),shop.ww+150,110);
  // People-height props in front of the pavement, drawn with the people so they're lit the same way.
  [PROPS,g]=mk(CW,BH);WB_(g);paintProps(g);
  [PROPE,g]=mk(CW,BH);WB_(g);paintPropsE(g);
  // Colours for the parts of the shop drawn live, lit as the pavement around them.
  const litC=(col,x,yu)=>{const l=[...AMB];addLight(l,L.st,x,yu);return toHex(hex(col).map((v,i)=>v*Math.min(1,l[i])));};
  shop.shutC=litC('#9a9ca8',shop.wx+shop.ww/2,BASE+16);shop.shutD=litC('#6a6c78',shop.wx+shop.ww/2,BASE+16);shop.signOff=litC('#3a3c48',shop.wx+shop.ww/2,BASE+36);
  for(const w of DYNW)w.spr=null;
  // The edges of the frame fall off a little.
  let vg;[VIG,vg]=mk(CW/4,CH/4);vg.fillStyle=rad(vg,VIG.width/2,VIG.height*.45,Math.min(VIG.width,VIG.height)*.36,Math.hypot(VIG.width,VIG.height)*.62,[[0,'rgba(8,6,30,0)'],[1,'rgba(8,6,30,.45)']]);vg.fillRect(0,0,VIG.width,VIG.height);
  grainPat=ctx.createPattern(GRAIN,'repeat');
}
function paintSky(g){
  const top=Y(VH),c=MOOD.sky;
  g.fillStyle=lin(g,0,Y(Math.max(VH,320)),0,Y(40),[[0,c[0]],[.5,c[1]],[.82,c[2]],[1,mixC(c[2],MOOD.glow,.6)]]);g.fillRect(ox,top,VW,VH);
  for(let i=0,n=Math.round(1600*MOOD.stars);i<n;i++){const x=h3(i,3.1,PSEED)*WW,yu=100+h3(i,7.7,PSEED)*500;if(yu>=VH||x<ox||x>ox+VW)continue;const br=h3(i,1.3,PSEED),r=.08+br**6*.25,y=Y(yu);
    g.fillStyle=`rgba(${br>.8?'255,250,235':'210,220,255'},${.3+br*.6})`;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();
    if(br>.96){g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=.08;g.beginPath();g.moveTo(x-1.4,y);g.lineTo(x+1.4,y);g.moveTo(x,y-1.4);g.lineTo(x,y+1.4);g.stroke();glow(g,GL.soft,x,y,1.8,.3);}}
  if(MOON){const x=MOON.x,y=MOON.y,r=MOON.r;const lit=.55+.45*MOON.ph;glow(g,GL.soft,x,y,34,.14*lit);glow(g,GL.soft,x,y,10,.32*lit);
    const m=moonCanvas(r);g.drawImage(m.c,x-m.size/2,y-m.size/2,m.size,m.size);}
  for(const bk of BANKS){if(bk.x+bk.w<ox||bk.x>ox+VW)continue;g.globalAlpha=.92;g.drawImage(cloudCanvas(bk.w,bk.h,bk.s),bk.x,bk.y,bk.w,bk.h);g.globalAlpha=1;}
  g.save();g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='overlay';g.globalAlpha=.12;g.fillStyle=pattern(g,PAPER,Math.max(1,S/4));g.fillRect(0,0,CW,CH);g.restore();
}
function paintSkyline(g){
  for(const s of TOWERS){if(s.x>ox+VW||s.x+s.w<ox)continue;const top=BASE+20+s.h;
    g.fillStyle=s.col;g.fillRect(s.x,Y(top),s.w,top-BASE);g.fillStyle=rgba(shade(s.col,.15),.6);g.fillRect(s.x,Y(top),s.w*.12,top-BASE);
    if(s.spire){g.fillRect(s.x+s.w/2-.3,Y(top+14),.6,14);g.beginPath();g.moveTo(s.x+s.w*.2,Y(top));g.lineTo(s.x+s.w/2,Y(top+5));g.lineTo(s.x+s.w*.8,Y(top));g.fill();}
    for(let yu=BASE+24;yu<top-2;yu+=2.6)for(let x=s.x+1.5;x<s.x+s.w-1.5;x+=2.2)if(h3(x,yu,s.s)<s.lit){g.fillStyle=h3(yu,x,s.s)<.7?'rgba(255,214,140,.75)':'rgba(170,215,255,.6)';g.fillRect(x,Y(yu),.75,.95);}}
  g.globalCompositeOperation='source-atop';g.fillStyle=lin(g,0,Y(BASE+170),0,Y(BASE),[[0,rgba(MOOD.sky[2],0)],[1,rgba(mixC(MOOD.sky[2],MOOD.glow,.5),.55+MOOD.mist*.2)]]);g.fillRect(ox,Y(BASE+170),VW,170);g.globalCompositeOperation='source-over';
}
function litWindow(g,x,y,w,h,col,s){
  g.fillStyle=lin(g,0,y,0,y+h,[[0,shade(col,.35)],[.6,col],[1,shade(col,-.2)]]);g.fillRect(x,y,w,h);
  const k=h3(s,3,4),cc=CURTAINS[Math.floor(h3(s,5,6)*CURTAINS.length)];
  if(k<.3){g.fillStyle='rgba(120,60,40,.45)';rrect(g,x+w*.12,y+h*.72,w*.55,h*.28,.6);g.fill();}
  else if(k<.5){g.fillStyle='rgba(110,70,40,.75)';g.fillRect(x+w*.62,y+h*.6,w*.04,h*.4);g.fillStyle=rgba(shade(col,.5),.9);g.beginPath();g.moveTo(x+w*.52,y+h*.62);g.lineTo(x+w*.76,y+h*.62);g.lineTo(x+w*.7,y+h*.48);g.lineTo(x+w*.58,y+h*.48);g.closePath();g.fill();}
  if(h3(s,7,8)<.65){for(const sd of[0,1]){const cx=sd?x+w*.72:x,cw=w*.28;g.fillStyle=rgba(cc,.88);g.beginPath();g.moveTo(cx,y);g.lineTo(cx+cw,y);g.quadraticCurveTo(sd?cx+cw*.4:cx+cw*.6,y+h*.6,sd?cx+cw*.9:cx+cw*.1,y+h);g.lineTo(sd?cx+cw:cx,y+h);g.closePath();g.fill();
      g.strokeStyle=rgba(shade(cc,-.3),.6);g.lineWidth=.2;g.beginPath();g.moveTo(cx+cw*.5,y);g.lineTo(cx+cw*(sd?.6:.4),y+h);g.stroke();}}
  else if(h3(s,9,1)<.5){g.fillStyle='rgba(60,40,30,.16)';for(let yy=y+.3;yy<y+h;yy+=.8)g.fillRect(x,yy,w,.3);}
  g.strokeStyle='#e8e0d0';g.lineWidth=.5;g.strokeRect(x,y,w,h);g.beginPath();g.moveTo(x+w/2,y);g.lineTo(x+w/2,y+h);g.stroke();
}
// A few loose bricks painted onto a wall, the way animated backgrounds suggest brick without drawing every one.
function brickHints(a,b,x,yT,w,hgt){
  for(let i=0;i<w*hgt/90;i++){const bx=x+h3(i,b.s,1)*w,by=yT+h3(i,b.s,2)*hgt;
    for(let k=0;k<1+Math.floor(h3(i,b.s,3)*3);k++){const xx=bx+(k%2?1.3:0)+(k>1?2.6:0),yy=by+k*.9;a.fillStyle=rgba(shade(b.col,(h3(i,k,b.s)-.6)*.3),.8);a.fillRect(xx,yy,2.4,.75);a.strokeStyle=rgba(shade(b.col,-.35),.5);a.lineWidth=.1;a.strokeRect(xx,yy,2.4,.75);}}
}
function paintBuilding(a,e,b){
  const top=BASE+b.gh+b.fl*b.fh,yT=Y(top),yB=Y(BASE),x=b.x,w=b.w;
  a.save();a.beginPath();a.rect(x,yT,w,yB-yT);a.clip();
  a.fillStyle=lin(a,0,yT,0,yB,[[0,shade(b.col,-.08)],[1,shade(b.col,.06)]]);a.fillRect(x,yT,w,yB-yT);
  for(let i=0;i<10;i++){const bx=x+h3(i,b.s,1)*w,by=yT+h3(i,b.s,2)*(yB-yT),r=8+h3(i,b.s,3)*22;a.fillStyle=rad(a,bx,by,0,r,[[0,rgba(h3(i,b.s,4)<.5?shade(b.col,-.2):shade(b.col,.15),.35)],[1,rgba(b.col,0)]]);a.fillRect(bx-r,by-r,2*r,2*r);}
  if(b.mat==='brick')brickHints(a,b,x,yT,w,yB-yT);
  if(b.mat==='concrete'){a.strokeStyle=rgba(shade(b.col,-.3),.5);a.lineWidth=.15;a.beginPath();for(let xx=x+16;xx<x+w;xx+=16){a.moveTo(xx,yT);a.lineTo(xx,yB);}a.stroke();}
  a.fillStyle=lin(a,x,0,x+w,0,[[0,'rgba(255,255,255,.08)'],[.06,'rgba(255,255,255,0)'],[.92,'rgba(20,10,40,0)'],[1,'rgba(20,10,40,.3)']]);a.fillRect(x,yT,w,yB-yT);
  // Floor bands and the cornice.
  for(let f=1;f<b.fl;f++){const yy=Y(BASE+b.gh+f*b.fh);a.fillStyle=shade(b.col,.15);a.fillRect(x,yy-.5,w,.7);a.fillStyle=rgba(shade(b.col,-.4),.5);a.fillRect(x,yy+.2,w,.4);}
  a.fillStyle=shade(b.col,.2);a.fillRect(x,yT,w,1.4);a.fillStyle=lin(a,0,yT+1.4,0,yT+3.4,[[0,rgba(shade(b.col,-.5),.6)],[1,rgba(b.col,0)]]);a.fillRect(x,yT+1.4,w,2);
  // Windows: lintel, sill, a plant pot or an air conditioner, and sometimes a little balcony.
  for(let f=0;f<b.fl;f++)for(let c=0;c<b.n;c++){const wx=winX(b,c),wyu=winY(b,f),ww=b.ww,wh=b.wh,wy=Y(wyu+wh),hs=h3(b.s,f*7+3,c);
    if(blade&&blade.b===b&&wx+ww>=blade.x-2)continue;
    a.fillStyle=shade(b.col,.18);a.fillRect(wx-.8,wy-1.2,ww+1.6,1);
    a.fillStyle=shade(b.col,-.45);a.fillRect(wx-.5,wy-.3,ww+1,wh+.6);
    a.fillStyle=lin(a,0,wy+wh+.8,0,wy+wh+6,[[0,rgba(shade(b.col,-.4),.4)],[1,rgba(b.col,0)]]);a.fillRect(wx+ww*.2,wy+wh+.8,ww*.6,5.2);
    a.fillStyle='#e8e2d4';a.fillRect(wx-1,wy+wh,ww+2,.7);a.fillStyle=rgba(shade(b.col,-.5),.5);a.fillRect(wx-1,wy+wh+.7,ww+2,.3);
    if(DYNSET.has(b.i*10000+f*100+c)||h3(b.s,f,c)>=b.lit){a.fillStyle=lin(a,0,wy,0,wy+wh,[[0,'#3a4a70'],[1,'#222c48']]);a.fillRect(wx,wy,ww,wh);
      a.fillStyle='rgba(200,215,255,.14)';a.beginPath();a.moveTo(wx+ww*.15,wy);a.lineTo(wx+ww*.4,wy);a.lineTo(wx+ww*.1,wy+wh);a.lineTo(wx-.01,wy+wh);a.closePath();a.fill();
      a.strokeStyle='#d8d2c4';a.lineWidth=.5;a.strokeRect(wx,wy,ww,wh);a.beginPath();a.moveTo(wx+ww/2,wy);a.lineTo(wx+ww/2,wy+wh);a.stroke();}
    else{litWindow(e,wx,wy,ww,wh,WARM[Math.floor(h3(b.s,c,f)*WARM.length)],b.s+f*31+c);e.save();e.globalCompositeOperation='lighter';glow(e,GL.warm,wx+ww/2,wy+wh/2,ww*1.2,.18,wh*1.1);e.restore();}
    if(hs<.22){const px_=wx+ww*.15+h3(c,f,b.s)*ww*.5;a.fillStyle='#a8583a';a.fillRect(px_,wy+wh-2.2,2.2,2.2);for(let k=0;k<5;k++)ell(a,px_+1.1+(h3(k,c,f)-.5)*2.6,wy+wh-2.6-h3(c,k,f)*1.6,.9,.7,k%2?'#4a7a3a':'#3a6a30');}
    else if(hs<.34){a.fillStyle='#c8ccd0';a.fillRect(wx+ww-6,wy+wh+1.6,6,4);a.strokeStyle=rgba(INK,.5);a.lineWidth=.12;a.strokeRect(wx+ww-6,wy+wh+1.6,6,4);ell(a,wx+ww-3,wy+wh+3.6,1.4,1.4,'#8a9098');}
    else if(hs<.42&&f>0){a.fillStyle=rgba(shade(b.col,-.45),.9);a.fillRect(wx-2,wy+wh+1,ww+4,.6);a.strokeStyle=rgba(shade(b.col,-.45),.9);a.lineWidth=.25;a.beginPath();for(let xx=wx-2;xx<=wx+ww+2;xx+=1.4){a.moveTo(xx,wy+wh-3.6);a.lineTo(xx,wy+wh+1);}a.moveTo(wx-2,wy+wh-3.6);a.lineTo(wx+ww+2,wy+wh-3.6);a.stroke();
      if(h3(f,c,b.s)<.5){a.strokeStyle='rgba(60,50,40,.6)';a.lineWidth=.08;a.beginPath();a.moveTo(wx-2,wy+wh-6);a.quadraticCurveTo(wx+ww/2,wy+wh-5,wx+ww+2,wy+wh-6);a.stroke();for(let k=0;k<3;k++){a.fillStyle=pick2(['#e8e4d8','#d86a5a','#6a9ad0','#e8c860'],k+c);a.fillRect(wx+1+k*3.4,wy+wh-5.7,2.4,3+h3(k,f,c));}}}}
  // Street level.
  const gy=Y(BASE+b.gh);
  a.fillStyle=shade(b.col,-.38);a.fillRect(x,gy,w,9);a.fillStyle=rgba(shade(b.col,-.6),.5);a.fillRect(x,gy+9,w,1.2);
  if(b.kind==='shutter'){const sx=x+3,sw=w-6,sy=gy+10,sh=yB-sy;a.fillStyle=lin(a,0,sy,0,yB,[[0,'#a4a8b0'],[1,'#7a7e88']]);a.fillRect(sx,sy,sw,sh);
    for(let yy=sy+.4;yy<yB;yy+=1){a.fillStyle='rgba(255,255,255,.18)';a.fillRect(sx,yy,sw,.2);a.fillStyle='rgba(40,40,60,.2)';a.fillRect(sx,yy+.5,sw,.22);}
    a.fillStyle='#4a4c56';a.fillRect(sx,yB-1,sw,1);
    if(h3(b.s,9,9)<.6){a.lineCap='round';for(let k=0;k<4;k++){const col=['#e85a9a','#4ad8c8','#f0d050','#9a7ae8','#f4f4f4'][Math.floor(h3(k,4,b.s)*5)],gx=sx+4+h3(k,1,b.s)*(sw-14),gyy=sy+sh*.35+h3(k,2,b.s)*sh*.45;
      a.strokeStyle=rgba(col,.8);a.lineWidth=.5+h3(k,5,b.s)*.6;a.beginPath();a.moveTo(gx,gyy);for(let i=1;i<6;i++)a.quadraticCurveTo(gx+i*1.6-.8,gyy+(h3(k,i,b.s)-.5)*5,gx+i*1.6,gyy+(h3(i,k,b.s)-.5)*3);a.stroke();}}}
  else if(b.kind==='door'){const dx=b.door,dy=Y(BASE+25);
    a.fillStyle=shade(b.col,-.45);a.fillRect(dx-6.2,dy-1.6,12.4,26.6);a.fillStyle=lin(a,dx-5,0,dx+5,0,[[0,'#8a5a3a'],[1,'#6a4028']]);a.fillRect(dx-5,dy+2.6,10,22.4);
    a.strokeStyle=rgba(INK,.45);a.lineWidth=.22;a.strokeRect(dx-3.8,dy+4,7.6,8.6);a.strokeRect(dx-3.8,dy+14,7.6,9.4);ell(a,dx+3.6,dy+14,.4,.4,'#e8c878');
    e.fillStyle=lin(e,0,dy-1,0,dy+2.6,[[0,'rgba(255,214,150,.85)'],[1,'rgba(230,160,90,.7)']]);e.fillRect(dx-5,dy-1,10,3.4);
    a.fillStyle='#8a8894';a.fillRect(dx-7,yB-.8,14,.8);a.fillStyle='#a4a2ac';a.fillRect(dx-6.4,yB-1.6,12.8,.8);
    for(const s of[-1,1])if(h3(b.s,s,5)<.6){a.fillStyle='#b8684a';a.fillRect(dx+s*9-1.4,yB-3.4,2.8,2.6);for(let k=0;k<6;k++)ell(a,dx+s*9+(h3(k,s,b.s)-.5)*3.4,yB-4-h3(s,k,b.s)*3.6,1,.8,k%2?'#4e8a3e':'#3a7230');}
    e.fillStyle=rad(e,dx,Y(BASE+28.2),0,1.2,[[0,'#fffaea'],[1,'rgba(255,210,130,.8)']]);e.beginPath();e.arc(dx,Y(BASE+28.2),.9,0,TAU);e.fill();e.save();e.globalCompositeOperation='lighter';glow(e,GL.warm,dx,Y(BASE+28.2),8,.5);e.restore();
    const wx=dx>x+w/2?x+5:dx+9,ww=Math.min(20,Math.abs((dx>x+w/2?dx-9:x+w-5)-wx));
    if(ww>8){if(h3(b.s,4,4)<.5)litWindow(e,wx,dy+3,ww,14,pick2(WARM,b.i),b.s+7);else{a.fillStyle=lin(a,0,dy+3,0,dy+17,[[0,'#3a4a70'],[1,'#222c48']]);a.fillRect(wx,dy+3,ww,14);a.strokeStyle='#d8d2c4';a.lineWidth=.5;a.strokeRect(wx,dy+3,ww,14);}}}
  else if(b.kind==='dark'){const sx=x+5,sw=w-10,sy=gy+11,sh=yB-sy-2;a.fillStyle=lin(a,0,sy,0,sy+sh,[[0,'#34405e'],[1,'#1e2438']]);a.fillRect(sx,sy,sw,sh);
    a.fillStyle='rgba(20,22,36,.7)';for(let i=0;i<3;i++)a.fillRect(sx+2,sy+sh*(.35+i*.22),sw-4,.5);
    a.fillStyle='rgba(200,215,255,.12)';a.beginPath();a.moveTo(sx+sw*.15,sy);a.lineTo(sx+sw*.32,sy);a.lineTo(sx+sw*.1,sy+sh);a.lineTo(sx-.01,sy+sh);a.closePath();a.fill();
    a.strokeStyle='#2e3240';a.lineWidth=.6;a.strokeRect(sx,sy,sw,sh);a.beginPath();a.moveTo(sx+sw*.62,sy);a.lineTo(sx+sw*.62,sy+sh);a.stroke();}
  else if(b.kind==='shop'){a.fillStyle='#3a3d4a';a.fillRect(shop.wx-1,Y(BASE+31)-1,shop.ww+2,30);a.fillRect(shop.door-1,Y(BASE+26)-1,11,27);}
  else if(b.kind==='laundry'){const sx=x+5,sw=w-10,sy=gy+11,sh=yB-sy-2;a.fillStyle='#2e3240';a.fillRect(sx-1,sy-1,sw+2,sh+2);paintLaundry(e,b,sx,sy,sw,sh);
    e.fillStyle='#1e4a5a';e.fillRect(x+3,gy+1,w-6,7);e.save();e.shadowColor='#7ae8ff';e.shadowBlur=1.2*S;e.fillStyle='#d4f8ff';e.font=`700 4.4px ${SANS}`;e.textAlign='center';e.fillText('LAUNDRY',x+w/2,gy+6.3);e.restore();}
  a.fillStyle=lin(a,0,yB-6,0,yB,[[0,'rgba(20,10,40,0)'],[1,'rgba(20,10,40,.3)']]);a.fillRect(x,yB-6,w,6);
  a.restore();
  // On the roof.
  const rx=x+6+h3(b.s,7,7)*(w-26);
  if(b.roof==='tank'){a.fillStyle='#4a3e34';a.fillRect(rx+1,yT-5,.6,5);a.fillRect(rx+11,yT-5,.6,5);a.fillStyle=lin(a,rx,0,rx+13,0,[[0,'#8a7a64'],[.6,'#7a6a56'],[1,'#5a4a3c']]);rrect(a,rx,yT-16,13,11.4,1.4);a.fill();a.fillStyle='#5a4a3e';a.beginPath();a.moveTo(rx-.4,yT-16);a.lineTo(rx+6.5,yT-20);a.lineTo(rx+13.4,yT-16);a.closePath();a.fill();}
  else if(b.roof==='aerial'){const hh=12+h3(b.s,8,8)*14;a.strokeStyle='#3a3a50';a.lineWidth=.3;a.beginPath();a.moveTo(rx,yT);a.lineTo(rx,yT-hh);for(const k of[.6,.8,1])a.moveTo(rx-3*k,yT-hh*k),a.lineTo(rx+3*k,yT-hh*k);a.stroke();}
  else if(b.roof==='ac'){a.fillStyle=lin(a,0,yT-6,0,yT,[[0,'#b0b4bc'],[1,'#7a7e88']]);a.fillRect(rx,yT-6,10,6);ell(a,rx+3.4,yT-3,2.2,2.2,'#4a4e5a');a.strokeStyle=rgba(INK,.4);a.lineWidth=.2;a.beginPath();for(let k=0;k<4;k++){a.moveTo(rx+6.4,yT-5+k*1.2);a.lineTo(rx+9.4,yT-5+k*1.2);}a.stroke();}
  if(blade&&blade.b===b){const h=blade.word.length*5.4+3;a.fillStyle='#221c2c';rrect(a,blade.x,Y(blade.yu+h),6,h,.6);a.fill();a.fillStyle='#5a5466';a.fillRect(blade.x-1.2,Y(blade.yu+h-2),1.2,.6);a.fillRect(blade.x-1.2,Y(blade.yu+2),1.2,.6);}
}
const pick2=(arr,i)=>arr[Math.abs(Math.floor(i))%arr.length];
function paintLaundry(e,b,sx,sy,sw,sh){
  e.fillStyle=lin(e,0,sy,0,sy+sh,[[0,'#fbfdff'],[.12,'#dcecf0'],[1,'#b8d0d4']]);e.fillRect(sx,sy,sw,sh);
  e.fillStyle='#ffffff';e.fillRect(sx,sy+.6,sw,.6);
  const n=Math.floor((sw-2)/9),fy=sy+sh;b.drumAt=null;
  for(let i=0;i<n;i++){const mx=sx+1.5+i*9;
    for(const[my,mh]of[[fy-9.5,9.5],[fy-17.5,7.6]]){cel(e,rrP(mx,my,8,mh-.3,.4),'#f8fafc','#d4dce2',gg=>gg.fillRect(mx+5.6,my,3,mh),.14);
      const cx=mx+4,cy=my+mh*.56,r=mh*.3;inkEll(e,cx,cy,r+.4,r+.4,'#c8d0d8',.12);
      e.fillStyle=rad(e,cx,cy,0,r,[[0,'#4a7a8a'],[1,'#22404c']]);e.beginPath();e.arc(cx,cy,r,0,TAU);e.fill();
      e.fillStyle='rgba(255,255,255,.5)';e.beginPath();e.ellipse(cx-r*.3,cy-r*.4,r*.4,r*.16,-.5,0,TAU);e.fill();
      if(i===b.drum%n&&mh>8)b.drumAt=[cx,cy,r];}}
}
function paintVend(a,e){
  const x=VEND.x,w=9,h=21,y=Y(BASE+h);
  a.fillStyle=shade(VEND.col,-.35);a.fillRect(x-.6,y,w+1.2,h);
  e.fillStyle=VEND.col;rrect(e,x,y,w,h,.5);e.fill();
  e.fillStyle=lin(e,0,y+1,0,y+12,[[0,'#ffffff'],[1,'#d8eef8']]);e.fillRect(x+.8,y+1,w-1.6,11);
  for(let r=0;r<3;r++)for(let c=0;c<4;c++){const cx=x+1.6+c*1.75,cy=y+1.8+r*3.5;e.fillStyle=pick2(['#e84a4a','#4a8ae8','#f0c040','#5ac87a','#f4f4f8','#e87a3a'],r*4+c+VEND.x);rrect(e,cx,cy,1.2,2.4,.3);e.fill();e.fillStyle='rgba(255,255,255,.6)';e.fillRect(cx+.2,cy+.3,.25,1.6);}
  e.fillStyle='#1e2230';e.fillRect(x+.8,y+12.8,w-1.6,3.2);e.fillStyle='#ff5a4a';for(let k=0;k<4;k++)e.fillRect(x+1.4+k*1.8,y+13.6,.6,.4);
  e.fillStyle='#2a2e3c';e.fillRect(x+1.4,y+17.2,w-2.8,2.2);
  e.strokeStyle=INK;e.lineWidth=.2;rrect(e,x,y,w,h,.5);e.stroke();
  e.save();e.globalCompositeOperation='lighter';glow(e,GL.cool,x+w/2,y+7,10,.35,9);e.restore();
}
function paintUPole(a,u){
  const x=u.x,top=Y(u.h),bot=Y(WALK+.4),pc='#8a8478';
  const pp=new Path2D();pp.moveTo(x-.95,bot);pp.lineTo(x-.6,top);pp.lineTo(x+.6,top);pp.lineTo(x+.95,bot);pp.closePath();cel(a,pp,pc,shade(pc,-.3),gg=>gg.fillRect(x+.15,top,2,u.h),.2);
  for(const dy of[4,9.5]){cel(a,rrP(x-7,top+dy,14,.9,.2),'#6a5a4a',null,null,.16);for(const k of[-6,-2.5,2.5,6])cel(a,rrP(x+k-.35,top+dy-1,.7,1,.2),'#e8e8ee',null,null,.1);}
  if(u.tr)cel(a,rrP(x+1,top+16,4,6.5,1),'#9aa0a8','#7a8088',gg=>gg.fillRect(x+3.4,top+16,2,7),.18);
  a.fillStyle='#e8d84a';a.fillRect(x-.8,bot-14,1.6,.6);a.fillRect(x-.8,bot-13.2,1.6,.3);
  a.fillStyle=INK;for(let k=0;k<6;k++)a.fillRect(x+(k%2?.6:-1.1),bot-24-k*4,.5,.25);
}
// Wires slung from pole to pole, sagging between them, and a few running off to the buildings.
function paintWires(e){
  e.strokeStyle='#1c1828';e.lineCap='round';
  for(let i=0;i<UPOLES.length-1;i++){const a=UPOLES[i],b=UPOLES[i+1];
    for(const[k,dy]of[[-6,4],[-2.5,4],[2.5,4],[6,4],[-4,9.5],[4,9.5]]){const x0=a.x+k,y0=Y(a.h)+dy-1,x1=b.x+k,y1=Y(b.h)+dy-1,sag=(x1-x0)*.05;e.lineWidth=dy>5?.2:.14;e.beginPath();e.moveTo(x0,y0);e.quadraticCurveTo((x0+x1)/2,(y0+y1)/2+sag*2,x1,y1);e.stroke();}}
  for(const u of UPOLES){const bb=B.find(b=>b.x<u.x+30&&b.x+b.w>u.x+30);if(!bb)continue;const bx=u.x+28,by=Y(BASE+bb.gh+bb.fh*.5);e.lineWidth=.12;e.beginPath();e.moveTo(u.x+6,Y(u.h)+3);e.quadraticCurveTo(u.x+18,(Y(u.h)+by)/2+4,bx,by);e.stroke();}
}
function paintTree(a,e){
  const T=TREE,x=T.x,base=Y(WALK+.6),cy=Y(T.h),r=T.r;
  const tp=new Path2D();tp.moveTo(x-1.6,base);tp.quadraticCurveTo(x-.9,base-12,x-.8,cy+r*.5);tp.lineTo(x+.8,cy+r*.5);tp.quadraticCurveTo(x+.9,base-12,x+1.6,base);tp.closePath();
  cel(a,tp,'#5a4434','#3a2a20',gg=>gg.fillRect(x+.2,cy,3,T.h),.2);
  a.strokeStyle='#4a3628';a.lineCap='round';for(const s of[-1,1]){a.lineWidth=.8;a.beginPath();a.moveTo(x,cy+r*.7);a.quadraticCurveTo(x+s*r*.3,cy+r*.3,x+s*r*.55,cy+r*.1);a.stroke();}
  a.fillStyle='#3a2c24';a.fillRect(x-3,base-.3,6,.5);
  // Leaves in clumps: a dark mass, mid-green clusters, and light catching the top.
  const cl=[];for(let i=0;i<34;i++){const an_=h3(i,T.s,1)*TAU,d=Math.sqrt(h3(i,T.s,2))*r*.85,rr_=r*(.22+h3(i,T.s,3)*.18);cl.push([x+Math.cos(an_)*d*1.1,cy+Math.sin(an_)*d*.8,rr_]);}
  for(const[cx,cy_,rr_]of cl){e.save();e.globalCompositeOperation='destination-out';e.beginPath();e.arc(cx,cy_,rr_+.4,0,TAU);e.fill();e.restore();}
  for(const[cx,cy_,rr_]of cl){a.fillStyle='#1e3a34';a.beginPath();a.arc(cx,cy_,rr_+.5,0,TAU);a.fill();}
  for(const[cx,cy_,rr_]of cl){a.fillStyle='#2e5a40';a.beginPath();a.arc(cx-rr_*.15,cy_-rr_*.2,rr_*.82,0,TAU);a.fill();}
  for(const[cx,cy_,rr_]of cl)if(cy_<cy+r*.2){a.fillStyle='#4e8a4c';a.beginPath();a.arc(cx-rr_*.3,cy_-rr_*.38,rr_*.48,0,TAU);a.fill();}
  for(let i=0;i<60;i++){const an_=h3(i,T.s,7)*TAU,d=r*(.75+h3(i,T.s,8)*.3);a.fillStyle=h3(i,T.s,9)<.5?'#2e5a40':'#1e3a34';a.beginPath();a.ellipse(x+Math.cos(an_)*d*1.1,cy+Math.sin(an_)*d*.8,.7,.45,an_,0,TAU);a.fill();}
}
function paintGround(a){
  const x0=ox-2,w=VW+4;
  // Far pavement, kerb and gutter.
  a.fillStyle=lin(a,0,Y(BASE),0,Y(WALK),[[0,'#7a7888'],[1,'#9a98a6']]);a.fillRect(x0,Y(BASE),w,BASE-WALK);
  for(let x=Math.floor(x0/12)*12;x<x0+w;x+=12){a.fillStyle=`rgba(${h3(x,1,PSEED)<.5?'40,30,60':'255,255,255'},${.03+h3(x,2,PSEED)*.05})`;a.fillRect(x,Y(BASE),12,BASE-43);a.fillRect(x+6,Y(43),12,43-WALK);}
  a.fillStyle='rgba(40,34,60,.35)';for(let x=Math.floor(x0/12)*12;x<x0+w;x+=12){a.fillRect(x,Y(BASE),.14,BASE-43);a.fillRect(x+6,Y(43),.14,43-WALK);}a.fillRect(x0,Y(43),w,.14);
  a.fillStyle=lin(a,0,Y(BASE),0,Y(BASE-3),[[0,'rgba(30,20,50,.35)'],[1,'rgba(30,20,50,0)']]);a.fillRect(x0,Y(BASE),w,3);
  a.fillStyle='#c4c2cc';a.fillRect(x0,Y(WALK),w,1);a.fillStyle='#74727f';a.fillRect(x0,Y(CURB+1),w,1);a.fillStyle=rgba(INK,.4);a.fillRect(x0,Y(CURB+1)-.1,w,.12);
  a.fillStyle='rgba(40,34,60,.4)';for(let x=Math.floor(x0/9)*9;x<x0+w;x+=9)a.fillRect(x,Y(WALK),.14,2);
  // The road: asphalt, worn patches, cracks, tyre tracks and markings.
  a.fillStyle=lin(a,0,Y(CURB),0,Y(8),[[0,'#3e3e52'],[1,'#4a4a5e']]);a.fillRect(x0,Y(CURB),w,CURB-8);
  a.globalAlpha=.08;a.fillStyle=pattern(a,NOISE,.14);a.fillRect(x0,Y(CURB),w,CURB-8);a.globalAlpha=1;
  for(let i=0;i<10;i++){const px_=ox+h3(i,1,PSEED)*VW,py=Y(10+h3(i,2,PSEED)*22),pw=8+h3(i,3,PSEED)*28,ph=2+h3(i,4,PSEED)*5;a.fillStyle=`rgba(${h3(i,5,PSEED)<.6?'20,18,34':'110,110,130'},.18)`;rrect(a,px_,py,pw,ph,1.2);a.fill();}
  a.strokeStyle='rgba(20,18,34,.45)';a.lineWidth=.12;a.beginPath();for(let i=0;i<12;i++){let cx=ox+h3(i,6,PSEED)*VW,cy=Y(9+h3(i,7,PSEED)*25);a.moveTo(cx,cy);for(let k=0;k<5;k++){cx+=(h3(i,k,1)-.3)*4;cy+=(h3(k,i,2)-.5)*1.4;a.lineTo(cx,cy);}}a.stroke();
  for(const yu of[FAR+.6,FAR+3.4,NEAR+.6,NEAR+3.4]){a.fillStyle=lin(a,0,Y(yu+1),0,Y(yu-1),[[0,'rgba(20,18,34,0)'],[.5,'rgba(20,18,34,.16)'],[1,'rgba(20,18,34,0)']]);a.fillRect(x0,Y(yu+1),w,2);}
  a.fillStyle=lin(a,0,Y(CURB),0,Y(CURB-1.4),[[0,'#24222f'],[1,'rgba(40,38,54,0)']]);a.fillRect(x0,Y(CURB),w,1.4);
  for(let x=Math.floor(x0/16)*16+3;x<x0+w;x+=16){a.fillStyle='rgba(240,236,220,.7)';a.fillRect(x,Y(20.2),8,.7);}
  {const sx0=Math.min(POLE,POLE-FD*132),sx1=Math.max(POLE,POLE-FD*132);a.fillStyle='rgba(240,200,80,.8)';for(let x=sx0;x<sx1;x+=5)a.fillRect(x,Y(34.6),3,.5);
    a.save();a.fillStyle='rgba(240,200,80,.72)';a.font=`700 4.2px ${SANS}`;a.textAlign='center';a.translate((sx0+sx1)/2,Y(27.6));a.scale(1.6,1);a.fillText('BUS STOP',0,0);a.restore();
    const gx=POLE+FD*12;a.fillStyle='#1c1a26';rrect(a,gx,Y(CURB-.1),6,1,.2);a.fill();a.fillStyle='#4a4858';for(let k=0;k<6;k++)a.fillRect(gx+.5+k,Y(CURB-.25),.3,.6);}
  {const mx=ox+VW*.3+h3(PSEED,4,4)*VW*.4;a.fillStyle='#34323f';a.beginPath();a.ellipse(mx,Y(16),4,1,0,0,TAU);a.fill();a.strokeStyle='rgba(150,150,170,.35)';a.lineWidth=.15;a.beginPath();a.ellipse(mx,Y(16),3.4,.8,0,0,TAU);a.stroke();}
  // Near kerb and pavement.
  a.fillStyle='#b4b2bc';a.fillRect(x0,Y(8),w,1);a.fillStyle=rgba(INK,.35);a.fillRect(x0,Y(7)-.1,w,.12);
  a.fillStyle=lin(a,0,Y(7),0,Y(0),[[0,'#7a7886'],[1,'#5e5c6a']]);a.fillRect(x0,Y(7),w,7);
  a.fillStyle='rgba(40,34,60,.35)';for(let x=Math.floor(x0/14)*14;x<x0+w;x+=14)a.fillRect(x,Y(7),.14,7);
}
function paintShelter(a){
  const x=SH.x,w=SH.w,gb=Y(BACK+1),gt=Y(BACK+28);
  a.fillStyle=lin(a,0,Y(BACK+3),0,Y(BACK-1),[[0,'rgba(20,10,40,0)'],[1,'rgba(20,10,40,.35)']]);a.fillRect(x-3,Y(BACK+3),w+6,5);
  a.fillStyle='rgba(190,225,240,.2)';a.fillRect(x,gt,w,gb-gt);
  for(const[ox_,wd]of[[8,2.6],[12.4,1],[w-22,3.4],[w-16.4,1.2]]){a.fillStyle='rgba(240,250,255,.18)';a.beginPath();a.moveTo(x+ox_,gt);a.lineTo(x+ox_+wd,gt);a.lineTo(x+ox_+wd-7,gb);a.lineTo(x+ox_-7,gb);a.closePath();a.fill();}
  const metal=(xx,yy,ww,hh)=>{a.fillStyle='#8a92a2';a.fillRect(xx,yy,ww,hh);a.fillStyle='#5e6676';a.fillRect(xx,yy+hh*.5,ww,hh*.5);a.strokeStyle=INK;a.lineWidth=.12;a.strokeRect(xx,yy,ww,hh);};
  metal(x,gb-.6,w,.8);metal(x,gt,w,.8);
  for(let k=1;k<3;k++){const mx=x+w*k/3;metal(mx-.3,gt,.6,gb-gt);}
  a.fillStyle='#363a48';rrect(a,AD.x-.8,Y(AD.yu+AD.h)-.8,AD.w+1.6,AD.h+1.6,.5);a.fill();
  // The bench: two wooden slats on metal legs.
  const b0=BENCH[0],bw=BENCH[1]-BENCH[0]+1;
  a.fillStyle='rgba(20,10,40,.35)';a.beginPath();a.ellipse(b0+bw/2,Y(BACK-.2),bw*.55,1.2,0,0,TAU);a.fill();
  for(const lx of[b0+2,b0+bw-2.6]){a.fillStyle='#3a3e4a';a.fillRect(lx,Y(48.6),.6,4.6);a.fillRect(lx-.6,Y(BACK)-.3,1.8,.3);}
  for(const[yu,c0,c1]of[[49.5,'#c8925e','#a07042'],[48.6,'#b07c4c','#845a36']]){cel(a,rrP(b0,Y(yu+.8),bw,.8,.2),c0,c1,gg=>gg.fillRect(b0,Y(yu+.35),bw,.5),.12);}
  // Roof: the fascia with the stop's name, the underside and the light fitting.
  a.fillStyle='#2a2e3e';a.fillRect(x-2,Y(74.2),w+4,1.2);
  a.fillStyle='#a8b0bc';a.fillRect(x+4,Y(73.6),w-8,.6);
  cel(a,rrP(x-2.4,Y(81),w+4.8,7,.4),'#3a4a66','#2c3a54',gg=>gg.fillRect(x-3,Y(77),w+6,3),.16);
  cel(a,rrP(x-3.2,Y(82.4),w+6.4,1.4,.3),'#a8b0c0','#7a8294',gg=>gg.fillRect(x-4,Y(81.7),w+8,1),.14);
  a.fillStyle='#f4f6fa';a.font=`700 4.2px ${SANS}`;a.textAlign='center';a.fillText(STOP[0],x+w/2,Y(75.9));
}
function paintProps(g){
  g.lineCap='butt';
  // Shelter posts.
  for(const px_ of[SH.x,SH.x+SH.w-.7])cel(g,rrP(px_,Y(81),.7,81-40,.1),'#9aa2b2','#6a7282',gg=>gg.fillRect(px_+.35,Y(81),.5,42),.12);
  // The stop pole: flag, route plates and timetable.
  cel(g,rrP(POLE-.28,Y(83),.56,83-39,.1),'#d8dce4','#9aa0aa',gg=>gg.fillRect(POLE,Y(83),.4,45),.12);
  cel(g,rrP(POLE-7,Y(89.4),14,8,1.2),STOPCOL,shade(STOPCOL,-.25),gg=>gg.fillRect(POLE-7,Y(83.2),14,2),.2);g.strokeStyle='#f4f4f8';g.lineWidth=.35;rrect(g,POLE-6.3,Y(88.7),12.6,6.6,.8);g.stroke();
  g.fillStyle='#ffffff';g.font=`800 3.6px ${SANS}`;g.textAlign='center';g.fillText('BUS',POLE,Y(84.6));
  {let yu=81;for(const r of ROUTES){const w=r.n.length*2.3+2.4;yu-=4.6;cel(g,rrP(POLE-w/2,Y(yu+4),w,4,.5),'#1c1e28',null,null,.12);g.fillStyle='#f4f4f8';g.font=`700 3px ${SANS}`;g.fillText(r.n,POLE,Y(yu+1));}}
  cel(g,rrP(POLE-3.6,Y(56),7.2,10,.6),'#9aa0ac','#7a808c',gg=>gg.fillRect(POLE+2,Y(56),2,10),.16);
  g.fillStyle='#f4f6fa';g.fillRect(POLE-2.9,Y(55.3),5.8,8.6);g.fillStyle='rgba(40,40,60,.55)';for(let k=0;k<7;k++)g.fillRect(POLE-2.4,Y(54.4-k*1.1),k%3?3.6:4.6,.3);
  // A bin.
  cel(g,rrP(BIN,Y(48),6,9,1.2),'#4a7a5e','#345a44',gg=>gg.fillRect(BIN+3.6,Y(48),3,9),.18);
  cel(g,rrP(BIN-.3,Y(49.2),6.6,1.6,.6),'#5a8a6e','#3a6a4e',gg=>gg.fillRect(BIN,Y(48.3),7,1),.16);g.fillStyle='#14201a';rrect(g,BIN+1.2,Y(46.8),3.6,.9,.4);g.fill();
  // Street lamps.
  for(const l of LAMPS){if(l.x<ox-30||l.x>ox+VW+30)continue;const hx=l.x+l.arm,top=Y(l.h);
    const pp=new Path2D();pp.moveTo(l.x-.65,Y(38));pp.lineTo(l.x-.32,top);pp.lineTo(l.x+.32,top);pp.lineTo(l.x+.65,Y(38));pp.closePath();cel(g,pp,'#4e5a6a','#36404e',gg=>gg.fillRect(l.x,top,1,l.h),.14);
    cel(g,rrP(l.x-1.2,Y(41),2.4,3,.4),'#4e5a6a','#36404e',gg=>gg.fillRect(l.x+.3,Y(41),1,3),.14);
    g.strokeStyle=INK;g.lineWidth=.8;g.lineCap='round';g.beginPath();g.moveTo(l.x,top+.5);g.quadraticCurveTo(l.x,top-1.8,hx,top-1.4);g.stroke();g.strokeStyle='#4e5a6a';g.lineWidth=.45;g.stroke();
    const hp=new Path2D();hp.moveTo(hx-3.4,top-.4);hp.quadraticCurveTo(hx-3,top-2.4,hx,top-2.4);hp.quadraticCurveTo(hx+3,top-2.4,hx+3.4,top-.4);hp.closePath();cel(g,hp,'#5a6676','#3e4858',gg=>gg.fillRect(hx-4,top-1.2,8,1),.16);}
}
function paintPropsE(g){
  for(const l of LAMPS){if(l.x<ox-30||l.x>ox+VW+30)continue;const hx=l.x+l.arm,y=Y(l.h);
    g.fillStyle=lin(g,0,y-.4,0,y+.5,[[0,'#fffcf0'],[1,'#ffd890']]);g.beginPath();g.ellipse(hx,y-.2,2.8,.55,0,0,Math.PI);g.fill();}
}
// The inside of the shop, drawn once: a bright ceiling, shelves of stock, a lit fridge, and sometimes the shopkeeper.
function makeShopInterior(){
  const w=shop.ww,h=28,k=Math.max(4,S),[c,g]=mk(w*k,h*k);g.scale(k,k);
  g.fillStyle=lin(g,0,0,0,h,[[0,'#fffdf4'],[.15,'#eef2ea'],[1,'#d4dcd4']]);g.fillRect(0,0,w,h);
  for(let x=3;x<w;x+=10){g.fillStyle='#ffffff';g.fillRect(x,.6,6,.7);}
  for(const sy of[9,14.5,20,25.5]){g.fillStyle='#9aa2ae';g.fillRect(0,sy,w-11,.5);
    for(let x=.4;x<w-11.5;){const pw=.6+R()*1.2,ph=1.2+R()*2.6;g.fillStyle=pick(['#f05a5a','#f8c848','#5aa0f0','#6ad07a','#f4f4f8','#d07af0','#ff9a4a','#4a4a5a']);g.fillRect(x,sy-ph,pw,ph);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(x,sy-ph,pw*.3,ph);x+=pw+.15;}}
  g.fillStyle=lin(g,w-10,0,w,0,[[0,'#dff6ff'],[1,'#afe0f4']]);g.fillRect(w-10,2,9.5,h-3);g.strokeStyle='#7a8a96';g.lineWidth=.3;g.strokeRect(w-10,2,9.5,h-3);g.beginPath();g.moveTo(w-5.2,2);g.lineTo(w-5.2,h-1);g.stroke();
  for(let i=0;i<30;i++){g.fillStyle=pick(['#f05a5a','#5aa0f0','#6ad07a','#f8c848','#ffffff']);g.fillRect(w-9.6+R()*8.6,4+Math.floor(R()*5)*4.6,.6,1.8);}
  if(R()<.6){const cx=4+R()*(w-24),p={h:20,o:makeLook(),head:0,sit:false,phone:false};p.C=body(p.o).C;g.save();g.beginPath();g.rect(0,0,w,h-7);g.clip();drawFront(g,null,p,cx,h+4);g.restore();cel(g,rrP(cx-6,h-7,13,7,.4),'#a87a54','#845a3a',gg=>gg.fillRect(cx+3,h-7,5,7),.18);}
  return c;
}

/* ---------- update ---------- */
function update(dt){
  t+=dt;
  wind=(fbm(t*.008+WO)-.5)*2;
  if(!warming)for(const k in SCHED){nextEv[k]-=dt;if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);fire(k);}}
  // Weather: the road takes a while to get wet and much longer to dry.
  wet+=((raining?1:0)-wet)*dt/(raining?40:240);rainK+=((raining?1:0)-rainK)*dt/6;
  if(rainK>.02){const n=rainK*VW*.9*(.7+.6*noise(t*.3+WO))*dt;let k=Math.floor(n)+(R()<n%1?1:0);
    while(k-->0)drops.push({x:ox+rr(-30,VW+30),yu:VH+rr(0,6),vy:rr(110,140),stop:rr(1,BASE)});}
  for(const d of drops){if(d.sp===undefined){d.yu-=d.vy*dt;d.x+=wind*20*dt;if(d.yu<=d.stop){d.yu=d.stop;d.sp=.1;}}else d.sp-=dt;}
  drops=drops.filter(d=>!(d.sp!==undefined&&d.sp<=0));
  // The shelter light: flickers, and now and then goes out for a while.
  if(tube.out>0){tube.out-=dt;if(tube.out<=0){const p=[];let s=0;for(let i=ri(2,4)*2;i>0;i--){s+=rr(.05,.3);p.push(s);}tube.seq={t0:t,p,back:true};log('The shelter light buzzes back on');}}
  tube.lv=tube.out>0?0:1;
  if(tube.seq){const x=t-tube.seq.t0;let on=tube.seq.back?0:1;for(const s of tube.seq.p)if(x>s)on=1-on;tube.lv=on;if(x>tube.seq.p[tube.seq.p.length-1])tube.seq=null;}
  // The shop closing: sign off, lights off, then the shutter rolls down.
  if(shop.closing!==null){const x=t-shop.closing;shop.neonOn=x<.4?1:0;shop.on=1-sstep(1.5,2.5,x);shop.close=sstep(3,8,x);if(x>8){shop.closed=true;shop.closing=null;}}
  for(const w of DYNW)w.on+=(w.want-w.on)*Math.min(1,dt/w.rate*3);
  if(ads.next){ads.k+=dt/1.4;if(ads.k>=1){ads.cur=ads.next;ads.next=null;ads.k=0;}}
  // Vehicles: each keeps its distance from the one ahead. Buses slow for the stop when someone waits for them.
  for(const v of veh){
    let lead=null,gap=1e9;for(const o of veh)if(o!==v&&o.lane===v.lane){const g=(o.front-o.d*o.L-v.front)*v.d;if(g>-2&&g<gap){gap=g;lead=o;}}
    let want=v.cruise*(.85+.3*noise(t*.07+v.s));if(lead)want=Math.min(want,Math.max(0,(gap-10)*1.4));
    if(v.kind==='bus')want=updBus(v,dt,want);
    if(v.state==='dwell'||v.state==='depart')v.v=0;
    else{const acc=v.kind==='bus'?20:45;v.brk=v.v>want+2;v.v=v.v<want?Math.min(want,v.v+acc*dt):Math.max(want,v.v-90*dt);}
    v.front+=v.d*v.v*dt;
    if(v.kind==='bus'&&v.lane===1&&!v.passed&&(v.front-POLE)*v.d>(v.stopped?4:0)){v.passed=true;if(!v.stopped)busPasses(v);}
  }
  veh=veh.filter(v=>{const rear=v.front-v.d*v.L;return v.d>0?rear<ox+VW+60:rear>ox-60;});
  for(const p of people){if(p.kind==='cat')updCat(p,dt);else updPerson(p,dt);}
  people=people.filter(p=>!p.dead);
  for(const q of parts){q.age+=dt;q.x+=(q.vx+wind*2)*dt;q.yu+=2.2*dt;}parts=parts.filter(q=>q.age<q.life);
  for(const c of clouds)c.x+=(c.v+wind*2)*dt;
  clouds=clouds.filter(c=>c.x>ox-c.w-40&&c.x<ox+VW+40);
  if(clouds.length<Math.round(3*MOOD.clouds)&&R()<dt*.05){const c=newCloud();c.x=wind>=0?ox-c.w-20:ox+VW+20;clouds.push(c);}
  for(const p of planes)p.x+=p.v*dt;planes=planes.filter(p=>p.x>ox-30&&p.x<ox+VW+30);
  for(const l of litter){l.x+=(l.v+wind*15)*dt;l.ph+=dt*6;l.life+=dt;}litter=litter.filter(l=>l.x>ox-30&&l.x<ox+VW+30&&l.life<60);
}
function updBus(v,dt,want){
  const dist=(POLE-v.front)*v.d;
  if(v.lane===1&&v.state==='drive'&&!v.stopped&&!v.passed&&wantsStop(v)&&dist>0&&v.v*v.v/(2*BRK)<=dist)v.state='brake';
  if(v.state==='brake'){want=Math.min(want,Math.sqrt(2*BRK*Math.max(0,dist)));v.ind=dist<110;
    if(dist<.6&&v.v<10){v.front=POLE;v.v=0;v.state='dwell';v.dw=rr(1.8,3);v.stopped=true;v.ind=false;busArrives(v);}}
  else if(v.state==='dwell'){v.dwT=(v.dwT||0)+dt;const busy=people.some(p=>p.board===v&&!p.dead)||v.pax.some(q=>q.out)||(v.dwT<10&&waiting().some(p=>p.route===v.route));if(!busy){v.dw-=dt;if(v.dw<=0){v.state='depart';v.dep=rr(.8,1.4);v.ind=true;}}}
  else if(v.state==='depart'){v.dep-=dt;if(v.dep<=0){v.state='drive';v.indT=2.5;busLeaves(v);}}
  if(v.indT>0){v.indT-=dt;if(v.indT<=0)v.ind=false;}
  for(const q of v.pax)if(q.walk){const d=q.tgt-q.ox,st=9*dt;if(Math.abs(d)<=st){q.ox=q.tgt;q.walk=false;q.ph=0;if(q.out)getOff(v,q);}else{q.ox+=Math.sign(d)*st;q.ph+=dt*9/14*Math.PI*2;}}
  v.pax=v.pax.filter(q=>!q.gone);
  return want;
}
function newCloud(){const w=rr(40,80),h=rr(9,15);return{img:cloudCanvas(w,h,rr(0,99)),w,h,x:0,y:rr(4,44),v:rr(.6,2.2)*(wind>=0?1:-1),a:rr(.75,.95)};}

/* ---------- drawing ---------- */
function dynWinSprite(w){const b=w.b,k=Math.max(4,S),[c,g]=mk(b.ww*k,b.wh*k);g.scale(k,k);litWindow(g,0,0,b.ww,b.wh,w.col,w.s*997|0);return c;}
function drawLive(){
  const g=ctx;W_(g);
  // Windows and signs that change are clipped around the shelter and the tree, which stand in front of them.
  g.save();g.beginPath();g.rect(ox,0,VW,VH);g.rect(SH.x-3,Y(82.4),SH.w+6,82.4-BACK);if(TREE)g.ellipse(TREE.x,Y(TREE.h),TREE.r*1.2,TREE.r*.95,0,0,TAU);g.clip('evenodd');
  for(const w of DYNW){if(w.on<.03)continue;const b=w.b,x=winX(b,w.c),y=Y(winY(b,w.f)+b.wh);if(x>ox+VW||x+b.ww<ox||y>VH)continue;
    if(!w.spr)w.spr=dynWinSprite(w);g.globalAlpha=w.on;g.drawImage(w.spr,x,y,b.ww,b.wh);
    if(w.tv){g.globalCompositeOperation='screen';g.fillStyle=mixC('#2a4ab0','#c0d8ff',noise(t*2.3+w.s*7));g.globalAlpha=w.on*.6;g.fillRect(x,y,b.ww,b.wh);g.globalCompositeOperation='source-over';}
    g.globalAlpha=1;}
  if(blade){const h=blade.word.length*5.4+3;for(let i=0;i<blade.word.length;i++){const on=i!==blade.bad||noise(t*5+blade.s)>.3,y=Y(blade.yu+h)+2.6+i*5.4;
      g.save();g.font=`700 4.4px ${SANS}`;g.textAlign='center';if(on){g.shadowColor=blade.col;g.shadowBlur=1.4*S;g.fillStyle=mixC(blade.col,'#ffffff',.4);}else g.fillStyle='#3a3040';g.fillText(blade.word[i],blade.x+3,y+3.6);g.restore();}}
  // The shop.
  {const s=shop,wy=Y(BASE+31),dy=Y(BASE+26);
    if(s.wx<ox+VW&&s.door+10>ox){g.fillStyle='#161a26';g.fillRect(s.wx,wy,s.ww,28);g.fillRect(s.door,dy,9,25);
      if(s.on>0){g.globalAlpha=s.on;g.drawImage(SHOPI,s.wx,wy,s.ww,28);g.fillStyle=lin(g,0,dy,0,dy+25,[[0,'#f0f8fc'],[1,'#c4dce4']]);g.fillRect(s.door,dy,9,25);g.globalAlpha=1;}
      g.strokeStyle='#3a3d4a';g.lineWidth=.5;g.strokeRect(s.door,dy,9,25);ell(g,s.door+7.6,dy+13,.35,.6,'#9aa4ae');
      const n=s.close*28;if(n>0){g.save();g.beginPath();g.rect(s.wx-.5,wy,s.ww+1,n);g.rect(s.door-.5,dy,10,Math.min(25,n));g.clip();
        g.fillStyle=s.shutC;g.fillRect(s.wx-.5,wy,s.door+10-s.wx,28);g.fillStyle=s.shutD;for(let yy=wy;yy<wy+28;yy+=1)g.fillRect(s.wx-.5,yy+.55,s.door+10-s.wx,.25);g.restore();}
      const sx=s.b.x+3,sw=s.b.w-6,sy=Y(BASE+s.b.gh)+1;g.fillStyle=s.on>.5?lin(g,0,sy,0,sy+7,[[0,'#ffffff'],[1,'#e8eef0']]):s.signOff;g.fillRect(sx,sy,sw,7);
      g.fillStyle=s.on>.5?'#d8403a':'#4a4c58';g.font=`800 4.6px ${SANS}`;g.textAlign='center';g.fillText(s.name,sx+sw/2,sy+5.4);
      if(s.neonOn&&s.on>.5&&noise(t*4+3)>.08){g.save();g.shadowColor=s.neon;g.shadowBlur=1.6*S;g.strokeStyle=mixC(s.neon,'#ffffff',.45);g.lineWidth=.35;g.font=`italic 700 4.6px Georgia,serif`;g.textAlign='left';g.strokeText('Open',s.wx+3,wy+7);g.restore();}}}
  g.restore();
  for(const b of B)if(b.drumAt){const[cx,cy,r]=b.drumAt,an_=t*4.5;g.save();g.beginPath();g.arc(cx,cy,r,0,TAU);g.clip();
    for(let i=0;i<4;i++){const a=an_+i*1.7;ell(g,cx+Math.cos(a)*r*.45,cy+Math.sin(a)*r*.45+r*.15,r*.4,r*.3,['rgba(230,90,80,.8)','rgba(250,250,252,.85)','rgba(90,140,220,.8)','rgba(250,210,90,.8)'][i]);}g.restore();}
  // The poster, scrolling to the next one.
  {const x=AD.x,y=Y(AD.yu+AD.h);g.save();g.beginPath();g.rect(x,y,AD.w,AD.h);g.clip();const o=ads.next?sstep(0,1,ads.k)*AD.h:0;g.drawImage(ads.cur,x,y-o,AD.w,AD.h);if(ads.next)g.drawImage(ads.next,x,y-o+AD.h,AD.w,AD.h);g.restore();}
  if(tube.lv>0){g.fillStyle='#f6ffff';g.fillRect(SH.x+4,Y(73.6),SH.w-8,.6);}
}
function drawWet(){
  const g=ctx;W_(g);
  g.fillStyle=`rgba(14,16,40,${.25*wet})`;g.fillRect(ox,Y(CURB),VW,CURB-8);
  for(const p of PUDDLES){if(p.x>ox+VW||p.x+p.w<ox)continue;const y=Y(p.yu);g.globalAlpha=wet*.85;g.fillStyle=lin(g,0,y-1,0,y+1,[[0,mixC(MOOD.sky[2],'#ffffff',.15)],[1,MOOD.sky[1]]]);g.beginPath();g.ellipse(p.x+p.w/2,y,p.w/2,1,0,0,TAU);g.fill();
    g.strokeStyle='rgba(220,235,255,.4)';g.lineWidth=.15;g.beginPath();g.ellipse(p.x+p.w/2,y,p.w/2,1,0,Math.PI*1.1,Math.PI*1.9);g.stroke();g.globalAlpha=1;}
  g.globalCompositeOperation='lighter';
  for(const l of LAMPS){const x=l.x+l.arm;if(x<ox-10||x>ox+VW+10)continue;g.globalAlpha=wet*.6;g.drawImage(STREAK.warm,x-2.6,Y(CURB),5.2,CURB-7);g.drawImage(STREAK.warm,x-1.4,Y(BASE),2.8,BASE-WALK);}
  if(shop.on>0){g.globalAlpha=wet*.35*shop.on;g.drawImage(STREAK.cool,shop.wx,Y(BASE),shop.ww,BASE-8);}
  if(VEND){g.globalAlpha=wet*.3;g.drawImage(STREAK.cool,VEND.x,Y(BASE),9,BASE-8);}
  for(const b of B)if(b.kind==='laundry'){g.globalAlpha=wet*.3;g.drawImage(STREAK.cool,b.x+5,Y(BASE),b.w-10,BASE-8);}
  g.globalAlpha=1;g.globalCompositeOperation='source-over';
}
function drawVeh(v){
  const L=v.L,h=v.h,left=v.d>0?v.front-L:v.front,top=Y(v.y+h);
  if(left>ox+VW+50||left+L<ox-50)return;
  const T=g=>{WB_(g);g.translate(left,top);if(v.d<0){g.translate(L,0);g.scale(-1,1);}};
  WB_(dctx);groundShadow(dctx,left+L/2,Y(v.y)+.1,L*.55,.6);
  const sp=(g,c)=>g.drawImage(c,-PAD,-PAD,L+2*PAD,h+2*PAD);
  if(v.kind==='bus'){T(ectx);sp(ectx,v.inner);
    if(!v.nis){drawSeated(ectx,v.drv,L-9.5,h-9.4);for(const q of v.pax){if(q.walk)drawSide(ectx,null,q,q.ox,h-4,Math.sign(q.tgt-q.ox)||1,q.ph,1,null);else drawSeated(ectx,q,q.ox,h-10);}}
    sp(ectx,v.glass);}
  T(dctx);sp(dctx,v.spr);
  T(ectx);ectx.globalCompositeOperation='destination-out';sp(ectx,v.spr);ectx.globalCompositeOperation='source-over';
  // Lights.
  const e=ectx,bus=v.kind==='bus',brk=v.brk||v.state==='brake'||v.state==='dwell'||v.state==='depart',blink=v.ind&&(t*1.7)%1<.5;
  e.globalCompositeOperation='lighter';
  e.fillStyle=lin(e,L,0,L+34,0,[[0,'rgba(255,245,215,.34)'],[1,'rgba(255,245,215,0)']]);e.beginPath();e.moveTo(L-.6,v.hy-.6);e.lineTo(L+34,h-.6);e.lineTo(L+34,h+1.4);e.lineTo(L-.6,v.hy+.8);e.closePath();e.fill();
  glow(e,GL.white,L+14,h,16,.3,2.2);
  glow(e,GL.red,.6,v.ty+.6,brk?4.6:2.6,brk?.95:.55);
  if(blink){glow(e,GL.amber,L-.4,v.hy-1.6,3,.9);glow(e,GL.amber,.4,v.ty-1.6,3,.9);}
  if(wet>.05){e.globalAlpha=wet*.5;e.drawImage(STREAK.white,L-2.6,h,2.4,7);e.drawImage(STREAK.red,0,h,2,6);e.globalAlpha=1;}
  e.globalCompositeOperation='source-over';
  e.fillStyle='#fffcf2';rrect(e,L-1.6,v.hy-.5,1.6,bus?1.6:1.1,.4);e.fill();
  e.fillStyle=brk?'#ff6a50':'#f0301e';rrect(e,0,v.ty-.4,1.2,bus?3:1.5,.3);e.fill();
  if(blink){e.fillStyle='#ffb830';e.fillRect(L-.8,v.hy-2,.8,.7);e.fillRect(0,v.ty-1.6,.8,.7);}
  if(v.free&&v.sign){const[a,b_,c,d]=v.sign;e.fillStyle='#fff6c8';rrect(e,a,b_,c,d,.4);e.fill();glow(e,GL.warm,a+c/2,b_+d/2,4,.45);}
  e.setTransform(1,0,0,1,0,0);dctx.setTransform(1,0,0,1,0,0);
  if(bus){
    // The bus's glow and its dot-matrix signs, which read the right way round whichever way it faces.
    T(ectx);ectx.globalCompositeOperation='lighter';ectx.globalAlpha=v.nis?.2:.4;sp(ectx,v.glow);ectx.globalAlpha=1;ectx.globalCompositeOperation='source-over';
    WB_(ectx);const page=Math.floor(t/2.2)%2;let s;
    if(v.nis)s=page?'SERVICE':'NOT IN';else{const full=`${v.route.n} ${v.route.dest}`;s=textW(full)<=48?full:page?v.route.dest:v.route.n;}
    const sx=(rx0,rx1,str)=>{if(!str)return;const a=v.d>0?left+rx0:left+L-rx1,d=.95,w=textW(str)*d;ectx.save();ectx.shadowColor='#ff9a20';ectx.shadowBlur=.6*S;led(ectx,str,a+(rx1-rx0-w)/2,top+3.2,d,'#ffbe48');ectx.restore();};
    sx(L-61,L-11,s);sx(1.6,14.6,v.nis?'':v.route.n);
    ectx.setTransform(1,0,0,1,0,0);
  }
}
function drawActor(p){
  const y0=Y(p.y);if(p.x<ox-20||p.x>ox+VW+20)return;
  if(p.kind==='cat')return drawCat(dctx,ectx,p,p.x,y0);
  if(p.state==='walk'){const run=p.sp>26,um=p.umb&&!(p.x>SH.x-3&&p.x<SH.x+SH.w+2)?p.umb:null;
    if(p.dog){const dx=p.x+p.dir*11,d=D(p.h);drawDog(dctx,p.dog,dx,y0,p.dir,p.dog.ph);dctx.strokeStyle=INK;dctx.lineWidth=.15;dctx.beginPath();dctx.moveTo(p.x+p.dir*1.2,y0-d.leg+1);dctx.quadraticCurveTo(p.x+p.dir*6,y0-d.leg*.4,dx+p.dir*2.6,y0-4.6);dctx.stroke();}
    drawSide(dctx,ectx,p,p.x,y0,p.dir,p.ph,run?1.7:1,um);}
  else if(p.state==='read'||p.state==='idle')drawSide(dctx,ectx,p,p.x,y0,p.dir,0,0,null);
  else drawFront(dctx,ectx,p,p.x,y0);
}
function draw(){
  const g=ctx;g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.imageSmoothingEnabled=true;
  g.drawImage(SKY,0,0);
  W_(g);for(const c of clouds){g.globalAlpha=c.a;g.drawImage(c.img,c.x,c.y,c.w,c.h);}g.globalAlpha=1;
  for(const p of planes){ell(g,p.x,p.y,.18,.18,'#ff4a3a');if((t*1.2+p.ph)%1<.1){g.globalCompositeOperation='lighter';glow(g,GL.white,p.x+.6,p.y,2.4,.9);g.globalCompositeOperation='source-over';}}
  g.setTransform(1,0,0,1,0,0);g.drawImage(SKYL,0,0);
  W_(g);g.globalCompositeOperation='lighter';for(const b of BEACONS)if((t/b.per+b.ph)%1<.3)glow(g,GL.red,b.x,Y(b.yu),2.6,.9);g.globalCompositeOperation='source-over';
  g.setTransform(1,0,0,1,0,0);g.drawImage(S0,0,0);
  W_(g);g.globalCompositeOperation='lighter';
  if(tube.lv>0){g.globalAlpha=tube.lv;g.drawImage(LC.c,LC.x,LC.y,LC.w,LC.h);}
  if(shop.on>0){g.globalAlpha=shop.on;g.drawImage(SC.c,SC.x,SC.y,SC.w,SC.h);}
  g.globalAlpha=1;g.globalCompositeOperation='source-over';
  drawLive();
  if(wet>.02)drawWet();
  // People, props and vehicles are drawn flat, then lit with the same light as the street. Their own lights go on top.
  dctx.setTransform(1,0,0,1,0,0);ectx.setTransform(1,0,0,1,0,0);dctx.clearRect(0,0,CW,BH);ectx.clearRect(0,0,CW,BH);
  WB_(dctx);WB_(ectx);
  const ppl=people.slice().sort((a,b)=>b.y-a.y||a.id-b.id);
  for(const p of ppl)if(p.x>ox-20&&p.x<ox+VW+20)groundShadow(dctx,p.x,Y(p.y)-.2,p.kind==='cat'?2.4:3.2,.42);
  for(const p of ppl)drawActor(p);
  for(const l of litter){dctx.save();dctx.translate(l.x,Y(l.yu)-.5-Math.max(0,Math.sin(l.ph))*.8);dctx.rotate(l.ph);dctx.fillStyle=l.col;dctx.fillRect(-.55,-.35,1.1,.7);dctx.restore();}
  dctx.setTransform(1,0,0,1,0,0);ectx.setTransform(1,0,0,1,0,0);
  dctx.drawImage(PROPS,0,0);ectx.globalCompositeOperation='destination-out';ectx.drawImage(PROPS,0,0);ectx.globalCompositeOperation='source-over';ectx.drawImage(PROPE,0,0);
  for(const v of veh)if(v.lane===1)drawVeh(v);
  for(const v of veh)if(v.lane===0)drawVeh(v);
  lmx.globalCompositeOperation='copy';lmx.globalAlpha=1;lmx.drawImage(M0,0,0);lmx.globalCompositeOperation='lighter';
  if(tube.lv>0){lmx.globalAlpha=tube.lv;lmx.drawImage(ML,0,0);}
  if(shop.on>0){lmx.globalAlpha=shop.on;lmx.drawImage(MS,0,0);}
  // Characters take the street's light, but less than the backgrounds do, so they stay readable as in a film.
  tctx.setTransform(1,0,0,1,0,0);tctx.globalCompositeOperation='copy';tctx.drawImage(dyn,0,0);
  WB_(tctx);tctx.globalCompositeOperation='multiply';tctx.imageSmoothingEnabled=true;tctx.drawImage(lmc,ox,0,LMW,LMH);
  tctx.setTransform(1,0,0,1,0,0);tctx.globalCompositeOperation='destination-in';tctx.drawImage(dyn,0,0);
  g.setTransform(1,0,0,1,0,0);g.drawImage(dyn,0,CH-BH);g.globalAlpha=.72;g.drawImage(tmp,0,CH-BH);g.globalAlpha=1;g.drawImage(emi,0,CH-BH);
  // Glow over everything: lamps and their cones in the damp air, the shelter light, the shop, the poster.
  W_(g);g.globalCompositeOperation='lighter';
  const haze=.05+.08*MOOD.mist+.12*rainK;
  for(const l of LAMPS){const x=l.x+l.arm,y=Y(l.h-.2);if(x<ox-40||x>ox+VW+40)continue;glow(g,GL.warm,x,y,5,.85);glow(g,GL.warm,x,y,24,.25);g.globalAlpha=haze*2.4;g.drawImage(CONE,x-24,y,48,l.h-WALK+4);g.globalAlpha=1;}
  if(tube.lv>0){glow(g,GL.cool,SH.x+SH.w/2,Y(73.4),SH.w*.55,.35*tube.lv,3.4);glow(g,GL.cool,SH.x+SH.w/2,Y(60),SH.w*.6,.1*tube.lv,16);}
  glow(g,GL.cool,AD.x+AD.w/2,Y(AD.yu+AD.h/2),AD.w*1.1,.3,AD.h*.8);
  if(shop.on>0)glow(g,GL.cool,shop.wx+shop.ww/2,Y(BASE+17),shop.ww*.8,.28*shop.on,18);
  for(const v of veh){const left=v.d>0?v.front-v.L:v.front,hx=v.d>0?left+v.L:left,tx=v.d>0?left:left+v.L;if(hx<ox-30||hx>ox+VW+30)continue;
    glow(g,GL.white,hx,Y(v.y+v.h)+v.hy,4.5,.5);glow(g,GL.red,tx,Y(v.y+v.h)+v.ty,2.6,.35);}
  g.globalCompositeOperation='source-over';
  // Breath in the cold, moths round the lamp, and rain, brighter where it falls through lamplight.
  for(const q of parts){const k=q.age/q.life;glow(g,GL.soft,q.x,Y(q.yu),.6+k*1.6,.25*(1-k));}
  {const l=SLAMP,hx=l.x+l.arm,hy=Y(l.h)+1;for(let k=0;k<2;k++)ell(g,hx+Math.sin(t*(2.3+k)+k*3)*3.4+noise(t*1.7+k*9)*2-1,hy+Math.cos(t*(1.9+k*.7)+k)*2.2+2,.16,.16,'#fff2d8');}
  if(drops.length){g.lineCap='round';const sl=wind*.5;
    for(const pass of[0,1]){g.strokeStyle=pass?'rgba(255,225,180,.55)':'rgba(200,215,245,.28)';g.lineWidth=.12;g.beginPath();
      for(const d of drops){let lit=0;for(const l of LAMPS){const dx=Math.abs(d.x-l.x-l.arm);if(dx<26&&d.yu<l.h){lit=1;break;}}if(lit!==pass)continue;
        const y=Y(d.yu);if(d.sp!==undefined){g.moveTo(d.x-.5,y);g.lineTo(d.x-.2,y-.4);g.moveTo(d.x+.5,y);g.lineTo(d.x+.2,y-.4);}else{g.moveTo(d.x,y-2.6);g.lineTo(d.x+sl,y);}}
      g.stroke();}}
  g.setTransform(1,0,0,1,0,0);g.drawImage(VIG,0,0,CW,CH);
  g.globalAlpha=.45;g.fillStyle=grainPat;g.save();g.translate(-((t*137)%160|0),-((t*91)%160|0));g.fillRect(0,0,CW+160,CH+160);g.restore();g.globalAlpha=1;
}

/* ---------- build ---------- */
function build(){
  const vw=Math.max(200,innerWidth),vh=Math.max(150,innerHeight);
  // About 180 units on the short side, more on tall phone screens so the street isn't lost under the sky.
  const k=Math.max(Math.min(vw,vh)/180,vh/300,vw/WW);
  let dpr=LOWQ?.75:Math.min(2,devicePixelRatio||1);const maxPx=LOWQ?1.2e6:5e6;if(vw*vh*dpr*dpr>maxPx)dpr=Math.sqrt(maxPx/(vw*vh));
  CW=cv.width=Math.round(vw*dpr);CH=cv.height=Math.round(vh*dpr);S=k*dpr;VW=CW/S;VH=CH/S;
  ox=clamp((Math.min(SH.x,POLE)+Math.max(SH.x+SH.w,POLE))/2-VW/2,0,Math.max(0,WW-VW));
  BANDU=Math.min(VH,96);BH=Math.ceil(BANDU*S);
  [dyn,dctx]=mk(CW,BH);[emi,ectx]=mk(CW,BH);[tmp,tctx]=mk(CW,BH);
  paint();
  [lmc,lmx]=mk(LMW,LMH);
}
// Vehicle sprites are drawn at the screen's resolution, so a resize redraws the ones on the street.
function redrawVeh(v){if(v.kind==='bus')Object.assign(v,busSprites(v.L,v.h,v.nis));else if(v.kind==='moto'||v.kind==='scooter')v.spr=bikeSprite(v.kind).c;else{const s=carSprite(v.kind,v.col);Object.assign(v,{spr:s.c,L:s.L,h:s.h});}}

/* ---------- start ---------- */
build();
SHOPI=makeShopInterior();
ads.cur=makeAd();
for(let i=Math.round(rr(1,3)*MOOD.clouds);i>0;i--){const c=newCloud();c.x=ox+rr(-20,VW);clouds.push(c);}
if(chance(.2)){shop.closed=true;shop.on=0;shop.neonOn=0;shop.close=1;}
if(chance(MOOD.rain*.5)){raining=true;wet=1;rainK=1;}
const first=chance(.55)?newWaiter(true):null;
warming=true;for(let i=0;i<120;i++)update(1/60);warming=false;
log(`${MOOD.name} at the ${STOP[1]} stop. The ${routeList} stop here`);
log(first?`${cap(first.o.desc)} is already waiting for the ${first.route.n}`:'Nobody is waiting');
if(DEBUG)window.BS={people:()=>people,veh:()=>veh,stats,shop,tube,fire,get t(){return t;},get paused(){return NightCity.paused;},set paused(v){NightCity.paused=v;},draw:()=>draw(),step:dt=>update(dt),
  run(sec){for(let i=0;i<sec*60;i++)update(1/60);draw();NightCity.refresh();}};
NightCity.run({step:1/60,update,draw,ui:()=>NightCity.stats(stats)});
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{build();for(const v of veh)redrawVeh(v);draw();},200);});
})();
