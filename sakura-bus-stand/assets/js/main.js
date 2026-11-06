/* Sakura Bus Stand: the view from a bench at a bus stand in Night City, under a cherry tree in full bloom. Petals drift
   down slowly and settle on the ground while the street gets on with its night in front of you: people, traffic, cats
   and dogs that come over to look at you and leave, and once in a long while a fight. The look is a hard-edged neon anime:
   heavy blacks, flat cel shading and saturated light. The camera is a real one, at the height of someone sitting down,
   and everything stands on the ground in metres. Every choice comes from one generator
   seeded with the moment the page opens, so no two nights play the same way. No libraries, no image files. */
(()=>{
'use strict';
const cv=document.getElementById('scene');
const ctx=cv.getContext('2d',{alpha:false});
// Seed, frame loop, embed mode and overlay come from the shared runtime, ../assets/js/nightcity.js.
const N=NightCity;
const{LOWQ,DEBUG,R,rr,ri,pick,chance,expo,wpick,shuffle,noise,fbm}=N;
// A private stream from the same seed. Painting on a resize draws from these, so it never moves the world's numbers.
const stream=k=>N.sfc32(...N.cyrb128(N.seed+'/'+k));

/* ---------- helpers ---------- */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
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
function poly(g,pts){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.closePath();}
// A polygon with its corners rounded off, for car bodies.
function rpoly(g,pts,r){const n=pts.length,m=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2],s=m(pts[n-1],pts[0]);g.beginPath();g.moveTo(s[0],s[1]);for(let i=0;i<n;i++){const a=pts[i],e=m(a,pts[(i+1)%n]);g.arcTo(a[0],a[1],e[0],e[1],r);}g.closePath();}
function lin(g,x0,y0,x1,y1,stops){const gr=g.createLinearGradient(x0,y0,x1,y1);for(const[o,c]of stops)gr.addColorStop(o,c);return gr;}
function rad(g,x,y,r0,r1,stops){const gr=g.createRadialGradient(x,y,r0,x,y,r1);for(const[o,c]of stops)gr.addColorStop(o,c);return gr;}
const SANS='"Helvetica Neue",Helvetica,Arial,sans-serif';
// Blurs by shrinking and growing again, which works in every browser. A canvas filter does not.
function soften(src,f){const[a,ga]=mk(src.width/f,src.height/f);ga.imageSmoothingQuality='high';ga.drawImage(src,0,0,a.width,a.height);const[b,gb]=mk(src.width,src.height);gb.imageSmoothingQuality='high';gb.drawImage(a,0,0,b.width,b.height);return b;}
const INK='#150f22';
// A 3x5 dot font, for the bus's sign and the board on the stop's pole.
const FONT={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111',
  0:'111101101101111',1:'010110010010111',2:'110001010100111',3:'110001010001110',4:'101101111001001',5:'111100110001110',6:'011100111101111',7:'111001010010010',8:'111101111101111',9:'111101111001110'};
const textW=s=>s.length*4-1;
function led(g,s,x,y,d,col){g.fillStyle=col;for(let i=0;i<s.length;i++){const f=FONT[s[i]];if(f)for(let k=0;k<15;k++)if(f[k]==='1')g.fillRect(x+(i*4+k%3)*d,y+(k/3|0)*d,d*.8,d*.8);}}

/* ---------- the night ---------- */
// We sit on a bench with our eyes 1.15 m up, looking straight across the road. x runs along the road, z away from us,
// y up, all in metres. These are the depths of the kerb, the near lane, the far lane, the far kerb and the shopfronts.
const EYE=1.15,KERB=3.4,NLANE=5.15,MIDL=6.9,FLANE=8.65,FKERB=10.4,WALL=13.4,ROAD=-.13,UNIT=.085;
// The tree stands on one side of the bench and the shelter's post and the stop's pole on the other. The near lane
// runs toward the pole, so a bus pulling in stops with its door beside it.
const TS=chance(.5)?-1:1,ND=-TS;
const NEON=['#ff2a7a','#2af0ff','#f3e600','#b14bff','#ff5a3a','#3bff9a','#ff8a2a'];
const MOODS=[
  [{name:'A clear spring night',sky:['#06061c','#150c3c','#451a66','#b23a7e'],haze:'#ff5a9a',amb:'#2a2458',sheen:.32,rain:.12,mist:.25,cloud:['#1e1644','#54306e','#e0709a'],stars:1},3],
  [{name:'A damp neon night',sky:['#040a1e','#0a1a3c','#163c60','#2e8aa2'],haze:'#2ad8ff',amb:'#1c2a50',sheen:.62,rain:.65,mist:.5,cloud:['#121e3a','#2e4a6c','#6ad0e0'],stars:.2},3],
  [{name:'A warm, hazy night',sky:['#0c0814','#26142a','#5c3026','#d8963a'],haze:'#ffb04a',amb:'#33242e',sheen:.38,rain:.2,mist:.7,cloud:['#20141e','#54302c','#e8a050'],stars:.3},2]
];
const MOOD=wpick(MOODS);
const HAZE=mixC(MOOD.sky[2],MOOD.haze,.4);
// Two kinds of cherry: the pale one everybody knows, and a deeper double pink.
// Each has five tones from deep shadow to lit, with an edge, a middle and a heart.
const TREES=[
  [{name:'pale pink',tones:[['#4c3266','#402a5c','#34224e'],['#8e5a92','#784a86','#5a3470'],['#dd92bc','#c876ac','#96487e'],['#fbc6dc','#f4a6c8','#c85c90'],['#fff0f5','#ffd8e8','#ee7ca4']]},5],
  [{name:'deep pink',tones:[['#4e2a60','#422454','#361c48'],['#9a4a8a','#823a7c','#642c66'],['#e878ac','#d85c9c','#a43a78'],['#ffa4c8','#f886b6','#d04c8a'],['#ffd4e4','#ffb4d0','#ee5a92']]},2]
];
const TREE=wpick(TREES);
const STOP=pick(['Lantern Street','Canal Street','Tenth Ward','Moon Bridge','Old Market','Harbour Gate','Kiln Row','Spring Lane','Foundry Cross','North Quay']);
const ROUTES=shuffle(['N7','N12','42','N29','118','N5','9','N88','23','N3']).slice(0,ri(2,3)).map(n=>({n,dest:pick(['CENTRAL','DOCKS','DEPOT','AIRPORT','MARKET','UPTOWN','HARBOUR','EAST END','ARENA'])}));
// The buses tonight: the lower body, the upper body, and a stripe of light down the side.
const FLEET=pick([['#1c2a44','#d8dce4','#2af0ff'],['#3a1e3e','#e8dcd8','#ff2a7a'],['#143a3a','#d4e0d8','#3bff9a'],['#2a2430','#e0d8c8','#ff8a2a']]);

/* ---------- the city, generated once in metres ---------- */
// Straight ahead, a side street runs away from us between the shops.
const GAPW=rr(7.4,9),GAPX=-TS*rr(.2,.8),GX0=GAPX-GAPW/2,GX1=GAPX+GAPW/2;
// The zebra crossing comes off the side street's pavement, on the tree's side where it isn't hidden by the post.
const XW=GAPX+TS*(GAPW/2-.9);
const FACADES=['#2e2838','#3a2c44','#262f42','#43303a','#2c3448','#443530','#2a3c36','#3c2a42'];
const SHOPS=shuffle([['RAMEN','#ff6a2a'],['BAR','#ff2a7a'],['24/7','#2af0ff'],['NOODLES','#f3e600'],['CLINIC','#3bff9a'],['ARCADE','#b14bff'],['PHARMACY','#3bff9a'],['KARAOKE','#ff2a7a'],['TATTOO','#2af0ff'],['PAWN','#f3e600'],['IMPLANTS','#2af0ff'],['SUSHI','#ff5a3a'],['LAUNDRY','#c8e0ff'],['TEA','#3bff9a'],['BATHS','#7ad0ff'],['HOTEL','#ff7ab0']]);
const FRONT=[],SIGNS=[],DYNW=[];
function rowOf(x0,d){let x=x0,i=0;
  while(Math.abs(x)<72){
    const w=rr(7.5,15),fl=i===0?ri(5,9):wpick([[1,2],[2,3],[3,2.5],[5,1],[8,.7]]),s=SHOPS[(FRONT.length*3+i)%SHOPS.length],left=d>0?x:x-w;
    const b={x:left,w,fl,fh:3,gh:3.8,col:pick(FACADES),s:ri(1,99999),kind:wpick([['shop',7],['shutter',1.4],['dark',.7]]),shop:s,lit:rr(.25,.6),awn:chance(.45)?pick(NEON):null,roof:wpick([['plain',3],['tank',2],['ac',2],['aerial',1.5]]),tag:chance(.4)?pick(NEON):null};
    b.h=b.gh+fl*b.fh;FRONT.push(b);
    if(b.kind==='shop')SIGNS.push({x:left+w/2,y:b.gh-.5,z:WALL,word:s[0],col:s[1],m:.72,board:true});
    if(fl>=1&&fl<=3&&chance(.4))SIGNS.push({x:left+w/2,y:b.h+.9,z:WALL,word:pick(['MOTEL','NOODLES','24H','DRINK','CHROME','NO VACANCY','SLEEP']),col:pick(NEON),m:1.15,board:false});
    x+=d*(w+(chance(.12)?rr(1,3):0));i++;}}
rowOf(GX1,1);rowOf(GX0,-1);
for(const s of SIGNS){s.on=1;s.seq=null;s.ph=rr(0,99);}
// Windows that change through the night. The rest stay as they are.
const WARM=['#ffd68a','#ffc46a','#ffe6b4','#f8ae5e','#fff0c8','#ffb0c8','#a8d8ff'];
{const all=[];for(const b of FRONT)if(Math.abs(b.x+b.w/2)<34)for(let f=0;f<Math.min(b.fl,4);f++)for(let c=0;c<Math.floor(b.w/2.6);c++)all.push([b,f,c]);
  for(const[b,f,c]of shuffle(all).slice(0,22)){const lit=chance(.5);DYNW.push({b,f,c,col:pick(WARM),on:lit?1:0,want:lit?1:0,rate:rr(.3,1.5)});}}
const winRect=(b,f,c)=>{const n=Math.floor(b.w/2.6),bay=b.w/n;return[b.x+bay*(c+.5)-.62,b.gh+f*b.fh+.72,1.24,1.62];};
// The side street's walls, near to far.
const SS=[[],[]];
for(const i of[0,1]){let z=WALL;while(z<210){const L=rr(9,24);SS[i].push({z0:z,z1:z+L,h:z<40?rr(14,32):rr(18,62),col:pick(FACADES),s:ri(1,99999),lit:rr(.3,.6),shop:pick(SHOPS)});
    z+=L+(chance(.2)?rr(3,6):0);}}
// The skyline at the end of it all, layer behind layer, spread by angle so it fills any shape of window.
const SKYL=[];
for(const[z,n]of[[520,26],[360,22],[240,18]]){let a=-2;while(a<2){const w=rr(.05,.14);SKYL.push({x:a*z,w:w*z,z,h:rr(.22,.72)*z*(chance(.16)?1.45:1),col:pick(['#1a1838','#201a3a','#16203a','#241a34','#1c1a30']),lit:rr(.04,.16),s:ri(1,99999),roof:wpick([['flat',3],['spire',1],['step',1.4],['crown',1]]),crown:pick(NEON)});a+=w+rr(-.01,.02);}}
const LAMPS=[];{const x0=rr(-14,-9);for(let x=x0;x<40;x+=rr(16,21))if(x>GX1+.8||x<GX0-.8)LAMPS.push({x,z:FKERB+.5,h:7.2,arm:chance(.5)?1.5:-1.5});for(let x=x0-rr(16,21);x>-40;x-=rr(16,21))LAMPS.push({x,z:FKERB+.5,h:7.2,arm:chance(.5)?1.5:-1.5});}
const UPOLES=[];{for(const x of[GX0-rr(1.4,3),GX1+rr(1.4,3),GX0-rr(16,22),GX1+rr(16,22)])UPOLES.push({x,z:FKERB+.35,h:rr(10,11.4)});}
const VENDS=[];{for(let i=ri(2,4);i>0;i--){const b=pick(FRONT.filter(b=>Math.abs(b.x)<30&&b.kind!=='shop'||Math.abs(b.x)<18));VENDS.push({x:b.x+rr(1,b.w-1.5),col:pick(['#d8343a','#2a6ac8','#eeeef2','#2a9a6a'])});}}
const MOON=chance(.55)?{r:rr(.03,.042),ph:rr(.3,1),side:chance(.5)?1:-1}:null;

/* ---------- state ---------- */
let CW=1,CH=1,F=1,HY=1,CX=1,TALL=false,POLE=2,QK=1;
let SKY,CITY,REFL,REFY=0,CARPET,cpg,CARY=0,STRIP,SKYH=1,NEONROW=[];
let TRUNK,FG,POLEC,BUSZ={},TRK=[],FGR=[];
let BOUGHS=[];
let t=0,warming=true,raining=false,rainK=0,wet=0,wind=0,gustK=0,gustD=1,gustT=0;
let people=[],veh=[],beasts=[],petals=[],puffs=[],sparks=[],flyers=[],drops=[],clouds=[],sidecars=[],drones=[];
let fight=null,sweeper=null,PID=0,crossHold=false;
const stats={petals:0,cars:0,visits:0};
const lastLog={},WO=rr(0,500),TO=rr(0,500),PO=rr(0,500);
let upcoming={route:pick(ROUTES),at:rr(40,90)};
function log(text){if(!warming)N.log(text);}
function logOnce(key,gap,text){if(t-(lastLog[key]??-1e9)<gap)return;lastLog[key]=t;log(text);}
// Where a point lands on the screen, and how many metres of road the window shows either side of us at a depth.
const PX=(x,z)=>CX+x*F/z,PY=(y,z)=>HY+(EYE-y)*F/z,halfW=z=>CW/2*z/F;
const edgeX=(z,s,m=1.2)=>s*(halfW(z)+m);
const groundAt=z=>z>KERB&&z<FKERB?ROAD:0,nearZ0=()=>EYE*F/(CH-HY)*.96;

/* ---------- painting the sky ---------- */
function Q(g,pts){g.beginPath();for(let i=0;i<pts.length;i++){const p=pts[i],x=PX(p[0],p[2]),y=PY(p[1],p[2]);if(i)g.lineTo(x,y);else g.moveTo(x,y);}g.closePath();}
function glowAt(g,x,y,r,col,a){g.fillStyle=rad(g,x,y,0,r,[[0,rgba(col,a)],[.35,rgba(col,a*.35)],[1,rgba(col,0)]]);g.fillRect(x-r,y-r,r*2,r*2);}
function paintSky(){
  let g;[SKY,g]=mk(CW,SKYH);const[s0,s1,s2,s3]=MOOD.sky;
  g.fillStyle=lin(g,0,0,0,HY,[[0,s0],[.42,s1],[.78,s2],[1,s3]]);g.fillRect(0,0,CW,SKYH);
  const n=Math.round(240*MOOD.stars);
  for(let i=0;i<n;i++){const x=h3(i,1,7)*CW,y=h3(i,2,7)*HY*.75,a=(.2+h3(i,3,7)*.6)*(1-y/HY),r=(.5+h3(i,4,7)*.9)*CH/900;g.fillStyle=h3(i,5,7)<.2?`rgba(200,220,255,${a.toFixed(2)})`:`rgba(255,244,250,${a.toFixed(2)})`;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}
  if(MOON){
    // The moon hangs where the roofs are lowest, on the side away from the tree.
    let bx=CW*.72,by=CH*.16,best=-1e9;const r=MOON.r*CH;
    for(let i=0;i<14;i++){const x=CW*(.5-TS*(.1+i*.028)),top=roofAt(x),clear=top-CH*.08;if(clear>best){best=clear;bx=x;by=Math.max(CH*.12,Math.min(top-r*2.2,CH*.3));}}
    g.globalCompositeOperation='lighter';glowAt(g,bx,by,r*7,'#ffe8f0',.14);glowAt(g,bx,by,r*2.6,'#ffeef4',.22);g.globalCompositeOperation='source-over';
    const[m,mg]=mk(r*2+4,r*2+4),c=r+2;mg.translate(c,c);
    mg.fillStyle=rad(mg,-r*.3,-r*.3,0,r*1.3,[[0,'#fffaf0'],[.7,'#f4ecdc'],[1,'#d8d0c4']]);mg.beginPath();mg.arc(0,0,r,0,TAU);mg.fill();
    mg.globalCompositeOperation='source-atop';for(let i=0;i<7;i++){const a=h3(i,1,31)*TAU,d=h3(i,2,31)*r*.72;ell(mg,Math.cos(a)*d,Math.sin(a)*d,r*(.14+h3(i,3,31)*.2),r*(.1+h3(i,4,31)*.16),'rgba(180,170,160,.4)');}
    mg.globalCompositeOperation='destination-out';mg.fillStyle='#000';mg.beginPath();mg.ellipse(MOON.side*r*2*MOON.ph,0,r*1.25,r*1.25,0,0,TAU);mg.fill();
    g.drawImage(m,bx-c,by-c);
  }
  // Long low banks of smog, lit from under by the city.
  for(let i=0;i<9;i++){const y=HY*(.45+h3(i,1,3)*.5),x=h3(i,2,3)*CW,rx=CW*(.2+h3(i,3,3)*.4),ry=CH*(.015+h3(i,4,3)*.04);g.save();g.translate(x,y);g.scale(rx,ry);g.fillStyle=rad(g,0,0,0,1,[[0,rgba(MOOD.haze,.1+.14*MOOD.mist)],[1,rgba(MOOD.haze,0)]]);g.fillRect(-1,-1,2,2);g.restore();}
}
// The row on the screen where the roofs stop at a column, used to keep the moon clear of them.
function roofAt(px){const x=(px-CX)*WALL/F;let top=CH;for(const b of FRONT)if(x>=b.x&&x<=b.x+b.w)top=Math.min(top,PY(b.h,WALL));if(x>GX0&&x<GX1)top=Math.min(top,CH*.3);return Math.max(0,top);}
function cloudSprite(w,h,s){
  const[c,g]=mk(w,h),[c0,c1,c2]=MOOD.cloud;
  for(let i=0,n=26;i<n;i++){const u=h3(i,s,1),b=Math.sin(u*Math.PI),cx=w*(.08+.84*u),rx=Math.min(h*(.4+.5*h3(i,s,3))*(1+b),cx,w-cx)*.96,ry=Math.min(rx*(.3+.4*b*h3(i,s,4)),h*.45),cy=Math.max(ry,h*.72-ry*.5-b*h*.16*h3(i,s,2));
    g.save();g.translate(cx,cy);g.scale(rx,ry);g.fillStyle=rad(g,0,0,0,1,[[0,rgba(c0,.7)],[.55,rgba(c0,.42)],[1,rgba(c0,0)]]);g.beginPath();g.arc(0,0,1,0,TAU);g.fill();g.restore();}
  g.globalCompositeOperation='source-atop';g.fillStyle=lin(g,0,0,0,h,[[0,rgba(c1,.5)],[.55,rgba(c0,0)],[.85,rgba(c2,.3)],[1,rgba(c2,.55)]]);g.fillRect(0,0,w,h);return c;}

/* ---------- painting the far city ---------- */
const fogK=z=>clamp((z-WALL)/190,0,.86);
function paintSkyline(g){
  for(const b of SKYL){const x=PX(b.x,b.z),w=b.w*F/b.z,top=PY(b.h,b.z);if(x>CW||x+w<0)continue;const base=HY+2,k=b.z>400?.82:b.z>300?.68:.52,col=mixC(b.col,HAZE,k);
    g.fillStyle=col;g.fillRect(x,top,w,base-top);
    if(b.roof==='spire'){poly(g,[[x+w*.42,top],[x+w*.58,top],[x+w*.5,top-w*1.1]]);g.fill();}
    else if(b.roof==='step'){g.fillRect(x+w*.2,top-w*.22,w*.6,w*.24);g.fillRect(x+w*.36,top-w*.42,w*.28,w*.22);}
    else if(b.roof==='crown'){g.fillStyle=rgba(b.crown,.5*(1-k*.5));g.fillRect(x,top,w,Math.max(1,CH*.002));}
    const st=Math.max(2.5,CH*.0052);for(let y=top+st;y<base;y+=st*1.5)for(let xx=x+st*.4;xx<x+w-st*.4;xx+=st){const v=h3(xx*.7,y*.3,b.s);if(v<b.lit){g.fillStyle=v<b.lit*.45?rgba('#ffc890',.5*(1-k*.5)):rgba('#aadcff',.45*(1-k*.5));g.fillRect(xx,y,st*.5,st*.6);}}
    g.fillStyle=lin(g,0,top,0,base,[[0,rgba(HAZE,0)],[1,rgba(MOOD.haze,.3)]]);g.fillRect(x,top,w,base-top);}
}
// The side street: both walls run to the vanishing point in front of us, with shops along the bottom and windows above.
function paintSideStreet(g){
  // A tower stands at the far end of the street.
  {const w=CH*.11,x=CX-w/2+GAPX*F/320,top=-CH*.1;g.fillStyle=mixC('#141430',HAZE,.34);g.fillRect(x,top,w,HY-top);
    const st=CH*.0055;for(let y=top;y<HY;y+=st*1.7)for(let xx=x+st;xx<x+w-st;xx+=st*1.4)if(h3(xx*.3,y*.7,5)<.2){g.fillStyle=rgba('#ffd0a0',.4);g.fillRect(xx,y,st*.6,st*.7);}}
  // Ground, far end first.
  const zF=230;
  g.fillStyle=mixC('#1a1626',HAZE,.25);Q(g,[[GX0,0,WALL],[GX1,0,WALL],[GX1,0,zF],[GX0,0,zF]]);g.fill();
  g.fillStyle=mixC('#100e1a',HAZE,.14);Q(g,[[GX0+1.6,ROAD,WALL],[GX1-1.6,ROAD,WALL],[GX1-1.6,ROAD,zF],[GX0+1.6,ROAD,zF]]);g.fill();
  for(let z=WALL+2;z<120;z+=5.2){g.fillStyle=rgba('#d8d4e0',.3*(1-z/120));Q(g,[[GAPX-.06,ROAD,z],[GAPX+.06,ROAD,z],[GAPX+.06,ROAD,z+2.2],[GAPX-.06,ROAD,z+2.2]]);g.fill();}
  // Walls and what hangs off them, furthest first so the near ones cover them.
  const segs=[];for(const i of[0,1])for(const s of SS[i])segs.push([s,i]);segs.sort((a,b)=>b[0].z0-a[0].z0);
  for(const[s,i]of segs){const xw=i?GX1:GX0,in_=i?-1:1,fm=fogK((s.z0+s.z1)/2),col=mixC(s.col,HAZE,fm),h=s.h;
    g.fillStyle=lin(g,0,PY(h,s.z0),0,PY(0,s.z0),[[0,shade(col,-.14)],[1,shade(col,.1)]]);Q(g,[[xw,0,s.z0],[xw,h,s.z0],[xw,h,s.z1],[xw,0,s.z1]]);g.fill();
    // The wall of the block facing us, where a block stands proud of the one behind.
    g.fillStyle=shade(col,-.2);Q(g,[[xw,0,s.z0],[xw,h,s.z0],[xw-in_*4,h,s.z0],[xw-in_*4,0,s.z0]]);g.fill();
    for(let y=4.6;y<h-1.2;y+=3.1)for(let z=s.z0+1;z<s.z1-1;z+=2.7){const v=h3(z,y,s.s);if(v>s.lit)continue;const c=v<s.lit*.65?pick2(WARM,z,y):pick2(['#9ad8ff','#ffb0d8','#c8d8ff'],z,y);g.fillStyle=rgba(mixC(mixC(c,col,.5),HAZE,fm*.75),.56-fm*.16);Q(g,[[xw,y,z],[xw,y+1.3,z],[xw,y+1.3,z+1.2],[xw,y,z+1.2]]);g.fill();}
    // The shop along the bottom, and its light on the ground.
    const sc=mixC(mixC(s.shop[1],'#fff0dc',.2),HAZE,fm*.7);g.fillStyle=lin(g,0,PY(3.2,s.z0),0,PY(.2,s.z0),[[0,rgba(sc,.95)],[1,rgba(shade(sc,-.5),.9)]]);Q(g,[[xw,.2,s.z0+.5],[xw,3.2,s.z0+.5],[xw,3.2,s.z1-.5],[xw,.2,s.z1-.5]]);g.fill();
    g.fillStyle=rgba(shade(col,-.3),.9);Q(g,[[xw,3.2,s.z0],[xw,4,s.z0],[xw,4,s.z1],[xw,3.2,s.z1]]);g.fill();
    g.fillStyle=rgba(s.shop[1],.26*(1-fm*.6));Q(g,[[xw,0,s.z0],[xw+in_*2.6,0,s.z0],[xw+in_*2.6,0,s.z1],[xw,0,s.z1]]);g.fill();
    g.fillStyle=rgba(s.shop[1],.9*(1-fm*.55));Q(g,[[xw,3.3,s.z0],[xw,3.5,s.z0],[xw,3.5,s.z1],[xw,3.3,s.z1]]);g.fill();}
  // Wires and paper lanterns across the street.
  g.lineCap='round';
  for(let z=WALL+5;z<90;z+=rr2(z,7,14)){const a=[PX(GX0,z),PY(6.4,z)],b=[PX(GX1,z),PY(6.6,z)];g.strokeStyle=rgba('#0c0a14',.8);g.lineWidth=Math.max(.6,F/z*.03);g.beginPath();g.moveTo(a[0],a[1]);g.quadraticCurveTo((a[0]+b[0])/2,(a[1]+b[1])/2+F/z*.5,b[0],b[1]);g.stroke();
    if(h3(z,1,8)<.65)for(let i=1;i<7;i++){const u=i/7,x=lerp(a[0],b[0],u),y=lerp(a[1],b[1],u)+F/z*.5*4*u*(1-u)+F/z*.17,r=F/z*.15,c=mixC(pick2(['#ff5a4a','#ffb040','#ff7ab0'],i,z),HAZE,fogK(z)*.6);g.save();g.globalCompositeOperation='lighter';glowAt(g,x,y,r*3.4,c,.5);g.restore();ell(g,x,y,r*.8,r,c);}}
  // Haze gathers down the length of the street, and the air glows in the slot of sky between the roofs.
  g.fillStyle=rad(g,CX+GAPX*F/320,HY,0,CH*.34,[[0,rgba(MOOD.haze,.42+.2*MOOD.mist)],[.5,rgba(MOOD.haze,.12)],[1,rgba(MOOD.haze,0)]]);g.fillRect(PX(GX0,WALL),0,(GX1-GX0)*F/WALL,PY(0,WALL));
}
const pick2=(a,x,y)=>a[Math.floor(h3(x,y,41)*a.length)];
const rr2=(x,a,b)=>a+(b-a)*h3(x,3,9);

/* ---------- textures ---------- */
// Tiles of grime and road grit, made once. Tileable noise wraps at its period, so the tiles repeat without a seam.
function wrapNoise(x,y,p,sd){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),m=q=>((q%p)+p)%p,a=h3(m(xi),m(yi),sd),b=h3(m(xi+1),m(yi),sd),c=h3(m(xi),m(yi+1),sd),e=h3(m(xi+1),m(yi+1),sd);return a+(b-a)*u+(c-a)*v+(a-b-c+e)*u*v;}
function tile(n,fn){const[c,g]=mk(n,n),im=g.createImageData(n,n),d=im.data,o=[0,0,0,0];for(let y=0;y<n;y++)for(let x=0;x<n;x++){fn(x,y,o);const i=(y*n+x)*4;d[i]=o[0];d[i+1]=o[1];d[i+2]=o[2];d[i+3]=o[3];}g.putImageData(im,0,0);return c;}
// Water stains running down a wall, in long streaks from blotches of dirt.
const GRIME=tile(384,(x,y,o)=>{const n=384,blot=wrapNoise(x/48,y/48,8,3)*.6+wrapNoise(x/16,y/16,24,4)*.4,streak=wrapNoise(x/5,y/96,76.8|0||76,5)*wrapNoise(x/22,y/64,17,6),a=Math.max(0,blot-.5)*260+Math.max(0,streak-.3)*420;o[0]=10;o[1]=8;o[2]=14;o[3]=Math.min(150,a);});
const RUST=tile(256,(x,y,o)=>{const s=wrapNoise(x/4,y/70,64,7)*wrapNoise(x/30,y/40,8,8),a=Math.max(0,s-.34)*520;o[0]=86;o[1]=44;o[2]=30;o[3]=Math.min(120,a);});
// Road grit: pale stones and dark pits, with slow patches of wear.
const GRIT=tile(256,(x,y,o)=>{const r=h3(x,y,11),w=wrapNoise(x/32,y/32,8,12),p=r>.93,q=r<.1;o[0]=o[1]=o[2]=p?200:8;o[2]+=p?12:6;o[3]=p?(16+w*40):q?70:Math.max(0,(w-.55))*90;});

/* ---------- painting the shops across the road ---------- */
const texFill=(g,src,x,y,w,h,scale,ox,oy,a,op)=>{const p=g.createPattern(src,'repeat');p.setTransform(new DOMMatrix().translate(ox,oy).scale(scale));g.save();g.globalAlpha=a;if(op)g.globalCompositeOperation=op;g.fillStyle=p;g.fillRect(x,y,w,h);g.restore();};
function paintWindow(g,x,y,w,h,col,s){
  g.fillStyle=lin(g,0,y,0,y+h,[[0,shade(col,-.02)],[.55,shade(col,-.24)],[1,shade(col,-.48)]]);g.fillRect(x,y,w,h);
  const v=h3(s,x,y);
  if(v<.34){g.fillStyle=rgba(shade(col,-.5),.9);for(let yy=y;yy<y+h*.74;yy+=h*.1)g.fillRect(x,yy,w,h*.05);}
  else if(v<.68){g.fillStyle=rgba(shade(col,-.56),.88);g.fillRect(x,y,w*.3,h);g.fillRect(x+w*.7,y,w*.3,h);g.fillStyle=rgba(shade(col,-.72),.5);g.fillRect(x+w*.27,y,w*.03,h);g.fillRect(x+w*.7,y,w*.03,h);}
  if(h3(s,y,x)<.24){g.fillStyle='rgba(16,10,22,.86)';g.beginPath();g.ellipse(x+w*.5,y+h*.44,w*.12,h*.13,0,0,TAU);g.fill();g.fillRect(x+w*.33,y+h*.56,w*.34,h*.44);}
  g.fillStyle='rgba(10,8,16,.86)';g.fillRect(x+w*.48,y,w*.04,h);g.fillRect(x,y+h*.4,w,Math.max(1,h*.025));
}
function paintShop(g,b,x,y,w,h,k){
  const s=b.shop,c=s[1],hot=mixC(c,'#fff2dc',.5);
  // The frame and the box the shutter rolls into, over every kind of front.
  g.fillStyle=lin(g,0,y,0,y+k*.55,[[0,'#1a1822'],[1,'#0c0a12']]);g.fillRect(x,y,w,k*.55);
  if(b.kind==='shutter'){g.fillStyle=lin(g,0,y,0,y+h,[[0,'#2e2c38'],[.6,'#22202a'],[1,'#141219']]);g.fillRect(x+k*.2,y+k*.55,w-k*.4,h-k*.55);g.fillStyle='rgba(6,4,10,.55)';for(let yy=y+k*.55;yy<y+h;yy+=k*.11)g.fillRect(x+k*.2,yy,w-k*.4,k*.03);g.fillStyle='rgba(180,170,200,.05)';for(let yy=y+k*.6;yy<y+h;yy+=k*.11)g.fillRect(x+k*.2,yy,w-k*.4,k*.012);
    texFill(g,RUST,x+k*.2,y+k*.55,w-k*.4,h-k*.55,k/90,b.s%90,b.s%70,.8);
    if(b.tag){g.save();g.translate(x+w*(.3+.4*h3(b.s,2,5)),y+h*.68);g.rotate(-.05);g.font=`italic 900 ${k*.9}px ${SANS}`;g.textAlign='center';g.lineWidth=k*.14;g.lineJoin='round';g.strokeStyle='rgba(8,6,12,.85)';const word=pick2(['KOI','ZEN','404','N1GHT','RUST','VOID'],b.s,1);g.strokeText(word,0,0);g.fillStyle=rgba(b.tag,.8);g.fillText(word,0,0);g.restore();}return;}
  if(b.kind==='dark'){g.fillStyle=lin(g,0,y,0,y+h,[[0,'#10101a'],[1,'#07070c']]);g.fillRect(x+k*.2,y+k*.55,w-k*.4,h-k*.55);g.fillStyle='rgba(120,130,170,.1)';poly(g,[[x+w*.2,y+k*.55],[x+w*.3,y+k*.55],[x+w*.14,y+h],[x+w*.04,y+h]]);g.fill();g.fillStyle='#16141e';for(let i=1;i<4;i++)g.fillRect(x+w*i/4,y+k*.55,k*.07,h-k*.55);return;}
  // A lit room behind glass: hot under the ceiling, falling off to the floor, with shelves, a counter and a figure or two.
  const gx=x+k*.22,gw=w-k*.44,gy=y+k*.55,gh=h-k*.62;
  g.fillStyle=lin(g,0,gy,0,gy+gh,[[0,hot],[.16,mixC(hot,c,.6)],[.6,shade(c,-.34)],[1,shade(c,-.74)]]);g.fillRect(gx,gy,gw,gh);
  const rows=2+Math.floor(h3(b.s,1,2)*2);
  for(let r=0;r<rows;r++){const yy=gy+gh*(.24+.5*r/rows);g.fillStyle='rgba(8,6,12,.78)';g.fillRect(gx+gw*.03,yy,gw*.94,k*.05);
    for(let i=0;i<Math.floor(gw/(k*.17));i++){const xx=gx+k*.1+i*k*.17,v=h3(i,r,b.s),hh=k*(.1+.22*v);if(v<.78){g.fillStyle=mixC(pick2(['#ff4a3a','#ffb030','#39b0ff','#f0f0ff','#40e090','#ff2a8a'],i,r+b.s),shade(c,-.5),.45);g.fillRect(xx,yy-hh,k*.12,hh);g.fillStyle='rgba(255,255,255,.3)';g.fillRect(xx,yy-hh,k*.03,hh);}}}
  g.fillStyle='rgba(8,6,12,.82)';g.fillRect(gx,gy+gh*.76,gw,gh*.24);g.fillStyle=rgba(hot,.5);g.fillRect(gx,gy+gh*.76,gw,k*.03);
  for(let i=0,n=ri2(b.s,1,3);i<n;i++){const px=gx+gw*(.16+.68*h3(i,b.s,6)),py=gy+gh*.74;g.fillStyle='rgba(8,6,12,.94)';g.beginPath();g.ellipse(px,py-k*.54,k*.13,k*.16,0,0,TAU);g.fill();poly(g,[[px-k*.26,py+k*.3],[px-k*.22,py-k*.32],[px+k*.22,py-k*.32],[px+k*.26,py+k*.3]]);g.fill();}
  if(b.awn){const a=b.awn;g.fillStyle='#0e0c14';poly(g,[[x-k*.12,y+k*.5],[x+w+k*.12,y+k*.5],[x+w+k*.38,y+k*1.16],[x-k*.38,y+k*1.16]]);g.fill();const n=Math.ceil(w/(k*.62));for(let i=0;i<n;i+=2){const u0=i/n,u1=(i+1)/n,t0=x+w*u0,t1=x+w*u1,b0=x-k*.3+(w+k*.6)*u0,b1=x-k*.3+(w+k*.6)*u1;g.fillStyle=lin(g,0,y+k*.5,0,y+k*1.16,[[0,shade(a,-.1)],[1,shade(a,-.56)]]);poly(g,[[t0,y+k*.5],[t1,y+k*.5],[b1,y+k*1.16],[b0,y+k*1.16]]);g.fill();}g.fillStyle=rgba(hot,.55);g.fillRect(x-k*.36,y+k*1.13,w+k*.72,k*.035);}
  else{const n=Math.floor(gw/(k*.46));for(let i=0;i<n;i++){g.fillStyle=lin(g,0,gy,0,gy+k*.66,[[0,shade(c,-.42)],[1,shade(c,i%2?-.62:-.5)]]);g.fillRect(gx+i*k*.46+k*.02,gy,k*.42,k*.66);}}
  g.fillStyle='rgba(255,255,255,.1)';poly(g,[[gx+gw*.16,gy],[gx+gw*.3,gy],[gx+gw*.18,gy+gh],[gx+gw*.04,gy+gh]]);g.fill();poly(g,[[gx+gw*.62,gy],[gx+gw*.66,gy],[gx+gw*.54,gy+gh],[gx+gw*.5,gy+gh]]);g.fill();
  g.fillStyle='#0c0a12';g.fillRect(gx,gy+gh,gw,k*.1);for(let i=1;i<3;i++)g.fillRect(gx+gw*i/3,gy,k*.06,gh);g.fillStyle=rgba(hot,.8);g.fillRect(gx+gw/3-k*.14,gy+gh*.5,k*.05,k*.5);
}
const ri2=(s,a,b)=>a+Math.floor(h3(s,7,3)*(b-a+1));
function paintBuilding(g,b){
  const k=F/WALL,x=PX(b.x,WALL),w=b.w*k,y0=PY(0,WALL),top=PY(b.h,WALL);if(x>CW+40||x+w<-40)return;
  const mat=pick2(['panel','rib','tile','brick','plain'],b.s,2),ty=Math.max(top,-30);
  g.fillStyle=lin(g,0,ty,0,y0,[[0,shade(b.col,-.42)],[.7,shade(b.col,-.14)],[1,shade(b.col,.04)]]);g.fillRect(x,top,w,y0-top);
  // What the wall is made of.
  g.save();g.beginPath();g.rect(x,top,w,y0-top);g.clip();
  if(mat==='panel'){g.strokeStyle='rgba(6,4,10,.55)';g.lineWidth=Math.max(1,k*.025);g.beginPath();for(let xx=x;xx<x+w;xx+=k*1.5){g.moveTo(xx,top);g.lineTo(xx,y0);}for(let yy=y0;yy>ty;yy-=k*1.5){g.moveTo(x,yy);g.lineTo(x+w,yy);}g.stroke();g.fillStyle='rgba(255,255,255,.02)';for(let i=0;i<40;i++){const px=x+Math.floor(h3(i,1,b.s)*w/(k*1.5))*k*1.5,py=y0-Math.floor(h3(i,2,b.s)*12)*k*1.5;g.fillRect(px,py-k*1.5,k*1.5,k*1.5);}}
  else if(mat==='rib'){for(let xx=x;xx<x+w;xx+=k*.26){g.fillStyle='rgba(6,4,10,.34)';g.fillRect(xx,top,k*.09,y0-top);g.fillStyle='rgba(220,210,240,.035)';g.fillRect(xx+k*.1,top,k*.05,y0-top);}}
  else if(mat==='tile'){g.strokeStyle='rgba(6,4,10,.4)';g.lineWidth=Math.max(.7,k*.012);g.beginPath();for(let xx=x;xx<x+w;xx+=k*.34){g.moveTo(xx,top);g.lineTo(xx,y0);}for(let yy=y0;yy>ty;yy-=k*.34){g.moveTo(x,yy);g.lineTo(x+w,yy);}g.stroke();}
  else if(mat==='brick'){g.strokeStyle='rgba(6,4,10,.4)';g.lineWidth=Math.max(.7,k*.012);g.beginPath();let r=0;for(let yy=y0;yy>ty;yy-=k*.17,r++){g.moveTo(x,yy);g.lineTo(x+w,yy);if(k>30)for(let xx=x+(r%2)*k*.2;xx<x+w;xx+=k*.4){g.moveTo(xx,yy);g.lineTo(xx,yy-k*.17);}}g.stroke();}
  texFill(g,GRIME,x,top,w,y0-top,k/70,(b.s*7)%300,(b.s*3)%300,.95);
  g.restore();
  g.fillStyle='rgba(4,3,8,.42)';g.fillRect(x+w-k*.5,top,k*.5,y0-top);g.fillStyle='rgba(255,240,240,.05)';g.fillRect(x,top,k*.1,y0-top);
  // Floors: slab, windows dark or lit, sills, air conditioners dripping down the wall.
  const n=Math.floor(b.w/2.6);
  for(let f=0;f<b.fl;f++){const fy=PY(b.gh+f*b.fh,WALL);g.fillStyle='rgba(6,4,10,.62)';g.fillRect(x,fy,w,Math.max(1,k*.07));g.fillStyle='rgba(220,210,230,.05)';g.fillRect(x,fy+k*.07,w,Math.max(1,k*.02));
    for(let c=0;c<n;c++){const[wx,wy,ww,wh]=winRect(b,f,c),px=PX(wx,WALL),py=PY(wy+wh,WALL),pw=ww*k,ph=wh*k;
      g.fillStyle='#08070c';g.fillRect(px-k*.06,py-k*.06,pw+k*.12,ph+k*.12);g.fillStyle=shade(b.col,.06);g.fillRect(px-k*.1,py+ph+k*.05,pw+k*.2,k*.06);
      const dyn=DYNW.some(d=>d.b===b&&d.f===f&&d.c===c);
      if(!dyn&&h3(f*7+c,b.s,1)<b.lit*.8)paintWindow(g,px,py,pw,ph,pick2(WARM,f+c,b.s),b.s+f*13+c);
      else{g.fillStyle=lin(g,0,py,0,py+ph,[[0,'#141a2c'],[1,'#0a0c16']]);g.fillRect(px,py,pw,ph);g.fillStyle='rgba(170,190,255,.06)';poly(g,[[px+pw*.1,py],[px+pw*.34,py],[px+pw*.12,py+ph],[px,py+ph]]);g.fill();g.fillStyle='rgba(6,4,10,.9)';g.fillRect(px+pw*.48,py,pw*.04,ph);}
      if(h3(f,c,b.s)<.24){const ax=px+pw*.08,ay=py+ph+k*.12,aw=pw*.84,ah=k*.46;g.fillStyle='#34343e';g.fillRect(ax,ay,aw,ah);g.fillStyle='#1a1a22';for(let yy=ay+k*.05;yy<ay+ah-k*.04;yy+=k*.07)g.fillRect(ax+aw*.42,yy,aw*.52,k*.03);ell(g,ax+aw*.22,ay+ah/2,k*.16,k*.16,'#16161e');g.fillStyle='rgba(120,70,50,.3)';g.fillRect(ax+aw*.8,ay+ah,k*.04,k*(.5+h3(c,f,b.s)*.7));}
      else if(b.fl>=2&&h3(c,f,b.s+5)<.13){g.strokeStyle='#0a0810';g.lineWidth=Math.max(1,k*.035);g.beginPath();g.moveTo(px-k*.2,py+ph+k*.1);g.lineTo(px+pw+k*.2,py+ph+k*.1);g.moveTo(px-k*.2,py+ph-k*.52);g.lineTo(px+pw+k*.2,py+ph-k*.52);for(let xx=px-k*.2;xx<=px+pw+k*.2;xx+=k*.16){g.moveTo(xx,py+ph+k*.1);g.lineTo(xx,py+ph-k*.52);}g.stroke();}}}
  // Pipes and bundled cable down the wall.
  const pipes=1+Math.floor(h3(b.s,9,1)*2.4);for(let i=0;i<pipes;i++){const px=x+w*(.06+.88*h3(i,b.s,8)),pw=k*(.07+.08*h3(i,b.s,9));g.fillStyle=lin(g,px,0,px+pw,0,[[0,'#0c0a12'],[.4,'#34323e'],[1,'#0c0a12']]);g.fillRect(px,top,pw,y0-top-k*.2);g.fillStyle='#0a0810';for(let yy=y0-k*1.4;yy>ty;yy-=k*2.3)g.fillRect(px-k*.04,yy,pw+k*.08,k*.08);}
  if(h3(b.s,3,3)<.6){g.strokeStyle='rgba(6,4,10,.9)';g.lineWidth=Math.max(1,k*.03);g.beginPath();const yy=PY(b.gh+.3,WALL);g.moveTo(x,yy);g.quadraticCurveTo(x+w/2,yy+k*.5,x+w,yy-k*.06);g.moveTo(x,yy-k*.14);g.quadraticCurveTo(x+w*.4,yy+k*.4,x+w,yy-k*.2);g.stroke();}
  // The roof.
  g.fillStyle=shade(b.col,-.6);g.fillRect(x-k*.1,top-k*.24,w+k*.2,k*.28);g.fillStyle='rgba(220,210,230,.08)';g.fillRect(x-k*.1,top-k*.24,w+k*.2,Math.max(1,k*.03));
  if(b.roof==='tank'){const tx=x+w*.6;g.fillStyle='#14121c';g.fillRect(tx,top-k*2.1,k*1.7,k*1.5);ell(g,tx+k*.85,top-k*2.1,k*.85,k*.2,'#1e1c28');g.fillRect(tx+k*.2,top-k*.7,k*.1,k*.6);g.fillRect(tx+k*1.4,top-k*.7,k*.1,k*.6);g.fillStyle='rgba(120,70,50,.26)';g.fillRect(tx+k*.4,top-k*2,k*.5,k*1.3);}
  else if(b.roof==='ac'){g.fillStyle='#1a1824';for(let i=0;i<3;i++){g.fillRect(x+w*(.15+.25*i),top-k*.85,k*1,k*.65);g.fillStyle='#0c0a12';g.fillRect(x+w*(.15+.25*i)+k*.1,top-k*.75,k*.8,k*.4);g.fillStyle='#1a1824';}}
  else if(b.roof==='aerial'){g.strokeStyle='#0c0a12';g.lineWidth=Math.max(1,k*.05);g.beginPath();g.moveTo(x+w*.3,top);g.lineTo(x+w*.3,top-k*3);for(let i=1;i<4;i++){g.moveTo(x+w*.3-k*.5,top-k*(1+i*.6));g.lineTo(x+w*.3+k*.5,top-k*(1+i*.6));}g.stroke();}
  paintShop(g,b,x,PY(b.gh,WALL),w,y0-PY(b.gh,WALL),k);
}
function paintVend(g,v){const k=F/(WALL-.5),x=PX(v.x,WALL-.5),y=PY(1.85,WALL-.5),w=.95*k,h=1.85*k;
  g.fillStyle=lin(g,x,0,x+w,0,[[0,shade(v.col,-.4)],[.2,v.col],[1,shade(v.col,-.5)]]);g.fillRect(x,y,w,h);g.fillStyle=lin(g,0,y,0,y+h*.64,[[0,'#f4f8ff'],[1,'#90b0d0']]);g.fillRect(x+w*.08,y+h*.06,w*.84,h*.58);
  for(let r=0;r<3;r++)for(let c=0;c<4;c++){g.fillStyle=pick2(['#d8343a','#2a6ac8','#e8b83a','#3aa86a','#f0f0f0'],r+c*5,v.x);g.fillRect(x+w*(.12+c*.2),y+h*(.1+r*.18),w*.14,h*.12);g.fillStyle='rgba(8,6,12,.7)';g.fillRect(x+w*(.1),y+h*(.22+r*.18),w*.8,h*.012);}
  g.fillStyle='#0a0810';g.fillRect(x+w*.14,y+h*.76,w*.72,h*.12);texFill(g,GRIME,x,y,w,h,k/70,v.x*9,0,.6);
  g.save();g.globalCompositeOperation='lighter';glowAt(g,x+w/2,y+h*.4,k*1.9,'#cfe4ff',.26);g.restore();}
function paintLamp(g,l){const k=F/l.z,x=PX(l.x,l.z),y0=PY(0,l.z),y1=PY(l.h,l.z),hx=PX(l.x+l.arm,l.z);
  g.strokeStyle='#0e0c16';g.lineWidth=Math.max(1.5,k*.11);g.lineCap='round';g.beginPath();g.moveTo(x,y0);g.lineTo(x,y1+k*.3);g.quadraticCurveTo(x,y1,hx,y1);g.stroke();g.strokeStyle='rgba(220,210,230,.12)';g.lineWidth=Math.max(.7,k*.02);g.beginPath();g.moveTo(x-k*.03,y0);g.lineTo(x-k*.03,y1+k*.3);g.stroke();
  g.fillStyle='#1c1a26';g.fillRect(hx-k*.34,y1-k*.04,k*.68,k*.11);
  g.save();g.globalCompositeOperation='lighter';glowAt(g,hx,y1+k*.1,k*.8,'#ffe6c0',.95);glowAt(g,hx,y1+k*.1,k*2.6,'#ffc88a',.24);
  // A hard wedge of lamplight, down to a hard-edged pool on the ground.
  g.fillStyle=lin(g,0,y1,0,y0+k*.5,[[0,'rgba(255,214,160,.13)'],[1,'rgba(255,214,160,.03)']]);poly(g,[[hx-k*.2,y1],[hx+k*.2,y1],[hx+k*2.4,y0+k*.5],[hx-k*2.4,y0+k*.5]]);g.fill();
  g.fillStyle='rgba(255,214,160,.13)';g.beginPath();g.ellipse(hx,y0+k*.42,k*2.5,k*.42,0,0,TAU);g.fill();g.restore();}
function paintUtility(g,u){const k=F/u.z,x=PX(u.x,u.z),y0=PY(0,u.z),y1=PY(u.h,u.z);g.fillStyle=lin(g,x-k*.11,0,x+k*.11,0,[[0,'#08070c'],[.4,'#22202c'],[1,'#08070c']]);g.fillRect(x-k*.11,y1,k*.22,y0-y1);g.fillStyle='#14121c';g.fillRect(x-k*.9,y1+k*.4,k*1.8,k*.09);g.fillRect(x-k*.6,y1+k*1,k*1.2,k*.08);g.fillStyle='#1c1a26';g.fillRect(x-k*.28,y1+k*1.5,k*.56,k*.72);g.fillStyle='#0a0810';g.fillRect(x-k*.2,y1+k*1.6,k*.4,k*.1);for(let i=0;i<5;i++){g.fillStyle=pick2(['#3a3844','#22202c','#c8b040','#4a4a58'],i,u.x);g.fillRect(x-k*.11,y0-k*(1.2+i*.2),k*.22,k*.12);}}
function paintWires(g){
  const P=UPOLES.slice().sort((a,b)=>a.x-b.x);g.lineCap='round';
  for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1];if(a.x<GX0&&b.x>GX1&&b.x-a.x>GAPW+7)continue;
    for(let j=0;j<5;j++){const dx=[-.85,.85,-.55,.55,0][j],dy=j<2?.4:j<4?1:1.9,x0=PX(a.x+dx,a.z),y0=PY(a.h-dy,a.z),x1=PX(b.x+dx,b.z),y1=PY(b.h-dy,b.z);g.strokeStyle='rgba(4,3,8,.92)';g.lineWidth=Math.max(.8,CH*(j===4?.002:.0012));g.beginPath();g.moveTo(x0,y0);g.quadraticCurveTo((x0+x1)/2,(y0+y1)/2+CH*.045,x1,y1);g.stroke();}}}
function paintTrafficLight(g,x,z){const k=F/z,px=PX(x,z),y0=PY(0,z),y1=PY(3.4,z);g.fillStyle='#0e0c16';g.fillRect(px-k*.05,y1,k*.1,y0-y1);g.fillStyle='#08070c';rrect(g,px-k*.17,y1-k*.8,k*.34,k*.9,k*.06);g.fill();
  for(let i=0;i<3;i++){const c=['#40140a','#3a2c08','#2af0a0'][i];ell(g,px,y1-k*(.6-i*.25),k*.09,k*.09,c);}g.save();g.globalCompositeOperation='lighter';glowAt(g,px,y1-k*.1,k*.6,'#2af0a0',.5);g.restore();}
// Bins and crates and bagged rubbish along the far pavement.
function paintClutter(g){for(let i=0;i<16;i++){const z=WALL-.3-h3(i,1,17)*.5,x=(h3(i,2,17)-.5)*56;if(x>GX0-.5&&x<GX1+.5)continue;const k=F/z,px=PX(x,z),py=PY(0,z),kind=Math.floor(h3(i,3,17)*4);
    if(kind===0){const w=k*.7,h=k*.9;g.fillStyle=lin(g,px,0,px+w,0,[[0,'#16222c'],[.5,'#22343e'],[1,'#0c1218']]);g.fillRect(px,py-h,w,h);g.fillStyle='#0a0e12';g.fillRect(px-k*.04,py-h-k*.06,w+k*.08,k*.1);}
    else if(kind===1){for(let j=0;j<3;j++){const q=ellP(px+k*(.1+j*.26),py-k*(.18+(j%2)*.14),k*.24,k*.2);g.fillStyle=j%2?'#14121a':'#1e1c26';g.fill(q);g.fillStyle='rgba(220,220,240,.12)';g.beginPath();g.ellipse(px+k*(.06+j*.26),py-k*(.26+(j%2)*.14),k*.08,k*.04,-.6,0,TAU);g.fill();}}
    else if(kind===2){const w=k*.56;for(let j=0;j<3;j++){g.fillStyle=j%2?'#3a2e20':'#46362a';g.fillRect(px+(j===2?w*.2:j*w*.5),py-k*(j===2?.8:.4),w*.92,k*.38);g.fillStyle='rgba(6,4,10,.5)';g.fillRect(px+(j===2?w*.2:j*w*.5),py-k*(j===2?.62:.22),w*.92,k*.03);}}
    else{g.fillStyle='#14121c';g.fillRect(px,py-k*.95,k*.09,k*.95);ell(g,px+k*.045,py-k*.98,k*.08,k*.08,'#c8a020');}}}

/* ---------- painting the ground ---------- */
function roadTex(g,z0,z1,y,src,a){const n=9;for(let i=0;i<n;i++){const za=lerp(z0,z1,(i/n)**1.5),zb=lerp(z0,z1,((i+1)/n)**1.5),ya=PY(y,za),yb=PY(y,zb),k=F/((za+zb)/2);texFill(g,src,0,Math.min(ya,yb),CW,Math.abs(yb-ya)+1,k/150,0,0,a);}}
function paintGround(g){
  const yW=PY(0,WALL),yK=PY(0,FKERB),yR=PY(ROAD,FKERB),yN=PY(ROAD,KERB),yP=PY(0,KERB);
  g.fillStyle=lin(g,0,yW,0,yK,[[0,'#17141f'],[1,'#221d2b']]);g.fillRect(0,yW,CW,yK-yW+1);
  g.fillStyle=lin(g,0,yR,0,yN,[[0,'#07060c'],[.5,'#0b0a12'],[1,'#100e18']]);g.fillRect(0,yR,CW,yN-yR+1);
  g.fillStyle=lin(g,0,yP,0,CH,[[0,'#2a2432'],[.5,'#262030'],[1,'#1a1622']]);g.fillRect(0,yP,CW,CH-yP);
  roadTex(g,KERB,FKERB,ROAD,GRIT,.9);roadTex(g,nearZ0(),KERB,0,GRIT,.55);
  // Kerb stones, each its own block with its own wear.
  for(const[z,yy]of[[FKERB,yK]]){g.fillStyle='#3a3540';g.fillRect(0,yy,CW,yR-yy+.6);for(let x=-60;x<60;x+=1){const px=PX(x,z),w=F/z;g.fillStyle=`rgba(${h3(x,1,4)<.3?'12,10,16':'230,220,230'},${(.05+.2*h3(x,2,4)).toFixed(2)})`;g.fillRect(px,yy,w*.97,yR-yy+.6);g.fillStyle='rgba(6,4,10,.8)';g.fillRect(px+w*.97,yy,Math.max(1,w*.03),yR-yy+.6);}g.fillStyle='rgba(235,225,235,.34)';g.fillRect(0,yy,CW,1);}
  {const k=F/KERB,kh=Math.max(3,k*.1);for(let x=-30;x<30;x+=1){const px=PX(x,KERB);g.fillStyle=h3(x,3,4)<.25?'#2c2832':'#3e3a44';g.fillRect(px,yP-kh*.5,k*.975,kh);g.fillStyle='rgba(6,4,10,.8)';g.fillRect(px+k*.975,yP-kh*.5,k*.025,kh);}g.fillStyle='rgba(6,4,10,.8)';g.fillRect(0,yP+kh*.5,CW,Math.max(1,k*.02));}
  // The side street's mouth breaks the far pavement.
  g.fillStyle='#09080f';Q(g,[[GX0+1.6,ROAD,WALL],[GX1-1.6,ROAD,WALL],[GX1-1.6,ROAD,FKERB],[GX0+1.6,ROAD,FKERB]]);g.fill();
  // Paving: each slab its own tone, running to the vanishing point.
  {const z0=nearZ0();let r=0;for(let z=z0;z<KERB-.05;r++){const dz=.3+.02*z,z2=Math.min(KERB-.05,z+dz);for(let x=-30+(r%2)*.3;x<30;x+=.6){const px=PX(x,z),px2=PX(x+.6,z);if(px2<-40||px>CW+40)continue;const v=h3(x*3.1,r,6);if(v<.42)continue;g.fillStyle=v<.7?'rgba(235,225,240,.018)':v<.9?'rgba(6,4,10,.13)':'rgba(6,4,10,.24)';Q(g,[[x,0,z],[x+.6,0,z],[x+.6,0,z2],[x,0,z2]]);g.fill();}z=z2;}
    g.strokeStyle='rgba(3,2,6,.6)';g.lineWidth=Math.max(.7,CH*.0011);g.beginPath();r=0;for(let z=z0;z<KERB;r++){const z2=z+.3+.02*z;g.moveTo(0,PY(0,z));g.lineTo(CW,PY(0,z));for(let x=-30+(r%2)*.3;x<30;x+=.6){g.moveTo(PX(x,z),PY(0,z));g.lineTo(PX(x,Math.min(z2,KERB)),PY(0,Math.min(z2,KERB)));}z=z2;}g.stroke();
    // Old gum and stains.
    for(let i=0;i<70;i++){const z=lerp(z0,KERB,h3(i,1,31)),x=(h3(i,2,31)-.5)*2*halfW(z),k=F/z,r2=k*(.012+.03*h3(i,3,31));g.fillStyle=`rgba(4,3,8,${(.2+.3*h3(i,4,31)).toFixed(2)})`;g.beginPath();g.ellipse(PX(x,z),PY(0,z),r2,r2*EYE/z,0,0,TAU);g.fill();}}
  g.strokeStyle='rgba(3,2,6,.5)';g.lineWidth=Math.max(.6,CH*.0009);g.beginPath();for(let x=-50;x<=50;x+=1){if(x>GX0+1.6&&x<GX1-1.6)continue;g.moveTo(PX(x,FKERB),PY(0,FKERB));g.lineTo(PX(x,WALL),PY(0,WALL));}for(const z of[11,11.7,12.4,13]){g.moveTo(0,PY(0,z));g.lineTo(CW,PY(0,z));}g.stroke();
  // Yellow guide tiles along the near kerb, worn through in places.
  {for(let x=-30;x<30;x+=.3){const px=PX(x,3.09);if(px<-30||px>CW+30)continue;const v=h3(x*3,1,8);g.fillStyle=`rgba(216,172,48,${(.3+.34*v).toFixed(2)})`;Q(g,[[x+.01,0,3],[x+.29,0,3],[x+.29,0,3.18],[x+.01,0,3.18]]);g.fill();g.fillStyle='rgba(30,20,10,.5)';for(let i=0;i<4;i++){const zz=3.02+i*.045;g.fillRect(PX(x+.04,zz),PY(0,zz),F/3.1*.22,Math.max(1,F/3.1*.012));}}}
  // Road markings, thin and worn, with the road showing through.
  const paint=(pts,a)=>{g.fillStyle=`rgba(208,204,218,${a})`;Q(g,pts);g.fill();};
  for(let x=-70;x<70;x+=6)paint([[x,ROAD,MIDL-.06],[x+3,ROAD,MIDL-.06],[x+3,ROAD,MIDL+.06],[x,ROAD,MIDL+.06]],.3);
  paint([[-70,ROAD,KERB+.35],[70,ROAD,KERB+.35],[70,ROAD,KERB+.42],[-70,ROAD,KERB+.42]],.2);paint([[-70,ROAD,FKERB-.35],[70,ROAD,FKERB-.35],[70,ROAD,FKERB-.42],[-70,ROAD,FKERB-.42]],.2);
  for(let z=KERB+.5;z<FKERB-.5;z+=.92)paint([[XW-1.5,ROAD,z],[XW+1.5,ROAD,z],[XW+1.5,ROAD,z+.46],[XW-1.5,ROAD,z+.46]],.34);
  roadTex(g,KERB,FKERB,ROAD,GRIT,.7);
  g.strokeStyle=rgba('#e8b830',.46);g.lineWidth=Math.max(1,F/5*.05);Q(g,[[POLE-ND*10,ROAD,KERB+.55],[POLE+ND*2,ROAD,KERB+.55],[POLE+ND*2,ROAD,KERB+2.55],[POLE-ND*10,ROAD,KERB+2.55]]);g.stroke();
  // Tar lines, patches and tyre polish.
  g.strokeStyle='rgba(2,2,4,.8)';g.lineCap='round';for(let i=0;i<16;i++){const z=lerp(KERB+.3,FKERB-.3,h3(i,1,13)),x=(h3(i,2,13)-.5)*2*halfW(z),k=F/z;g.lineWidth=Math.max(1,k*.02);g.beginPath();let px=PX(x,z),py=PY(ROAD,z);g.moveTo(px,py);for(let j=0;j<6;j++){px+=k*(.3+.5*h3(i,j,14));py+=(h3(i,j,15)-.5)*k*.1;g.lineTo(px,py);}g.stroke();}
  for(let i=0;i<7;i++){const z=lerp(KERB+.5,FKERB-.8,h3(i,1,16)),x=(h3(i,2,16)-.5)*30;g.fillStyle=h3(i,3,16)<.5?'rgba(24,22,32,.8)':'rgba(3,3,6,.7)';const w=.8+1.6*h3(i,4,16),d=.4+.8*h3(i,5,16);Q(g,[[x,ROAD,z],[x+w,ROAD,z],[x+w,ROAD,z+d],[x,ROAD,z+d]]);g.fill();}
  for(const z of[NLANE-.7,NLANE+.7,FLANE-.7,FLANE+.7]){g.fillStyle='rgba(2,2,4,.3)';Q(g,[[-70,ROAD,z-.14],[70,ROAD,z-.14],[70,ROAD,z+.14],[-70,ROAD,z+.14]]);g.fill();}
  {const z=MIDL+1.6,x=GAPX+TS*-1.4,k=F/z,cx=PX(x,z),cy=PY(ROAD,z),ry=k*.42*EYE/z;ell(g,cx,cy,k*.44,ry,'#0a0910');ell(g,cx,cy,k*.38,ry*.86,'#1a1822');g.strokeStyle='rgba(120,120,140,.22)';g.lineWidth=1;g.beginPath();for(let i=-3;i<=3;i++){g.moveTo(cx+i*k*.1,cy-ry*.7);g.lineTo(cx+i*k*.1,cy+ry*.7);}g.stroke();}
  // A storm drain at the kerb.
  {const z=KERB+.12,x=GAPX-TS*2.2,k=F/z;Q(g,[[x,ROAD,z],[x+.8,ROAD,z],[x+.8,ROAD,z+.3],[x,ROAD,z+.3]]);g.fillStyle='#050408';g.fill();g.fillStyle='#2a2832';for(let i=0;i<9;i++)g.fillRect(PX(x+i*.09+.02,z),PY(ROAD,z+.3),k*.03,PY(ROAD,z)-PY(ROAD,z+.3));}
}
// The city's colours mirrored in the road, blurred and streaked toward us by the rough surface.
function paintRefl(){
  const by=Math.round(PY(0,WALL)),h=CH-by,s=4,[c,g]=mk(CW/s,h/s);
  g.setTransform(1/s,0,0,-1.6/s,0,by*1.6/s);g.drawImage(CITY,0,0,CW,by,0,0,CW,by);
  let r=soften(soften(soften(c,3),2),2);
  const[o,og]=mk(CW,h);og.imageSmoothingQuality='high';og.drawImage(r,0,0,CW,h);
  og.globalCompositeOperation='destination-in';
  const yK=PY(ROAD,KERB)-by,yR=PY(ROAD,FKERB)-by;
  og.fillStyle=lin(og,0,0,0,h,[[0,'rgba(0,0,0,.7)'],[yR/h,'rgba(0,0,0,1)'],[Math.min(1,yK/h),'rgba(0,0,0,.72)'],[Math.min(1,yK/h+.03),'rgba(0,0,0,.26)'],[1,'rgba(0,0,0,.08)']]);og.fillRect(0,0,CW,h);
  REFL=o;REFY=by;
  const y0=PY(4.6,WALL),y1=PY(0,WALL),[st,sg2]=mk(CW/4,48);sg2.drawImage(CITY,0,y0,CW,y1-y0,0,0,st.width,48);STRIP=soften(soften(st,3),2);
  const[o2,g2]=mk(96,1);g2.imageSmoothingQuality='high';g2.drawImage(CITY,0,y0,CW,y1-y0,0,0,96,1);const d=g2.getImageData(0,0,96,1).data;NEONROW=[];for(let i=0;i<96;i++){const a=[d[i*4],d[i*4+1],d[i*4+2]],m=Math.max(a[0],a[1],a[2],1),b=Math.min(1,.45+m/255);NEONROW.push(a.map(v=>v/m*255*b));}
}
const neonAt=x=>{const u=clamp(PX(x,WALL)/CW,0,.999)*95,i=Math.floor(u),f=u-i,a=NEONROW[i],b=NEONROW[Math.min(95,i+1)];return[lerp(a[0],b[0],f),lerp(a[1],b[1],f),lerp(a[2],b[2],f)];};
// Crisp puddles in the road, each a sharp mirror of what stands over it.
function paintPuddles(g,src,by){
  const r=stream('puddles'),n=Math.round(3+9*MOOD.sheen);
  for(let i=0;i<n;i++){const z=lerp(KERB+.5,FKERB-.5,r()),x=(r()*2-1)*halfW(z)*1.1,k=F/z,w=k*(.5+1.25*r()),h=w*EYE/z*(.36+.26*r()),cx=PX(x,z),cy=PY(ROAD,z);
    g.save();g.beginPath();const m=9;for(let j=0;j<=m;j++){const a=j/m*TAU,q=.72+.5*r();const px=cx+Math.cos(a)*w*q,py=cy+Math.sin(a)*h*q;if(j)g.lineTo(px,py);else g.moveTo(px,py);}g.closePath();g.clip();
    g.setTransform(1,0,0,-1,0,by*2);g.globalAlpha=.86;g.drawImage(src,0,0);g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.fillStyle='rgba(6,6,18,.2)';g.fillRect(cx-w*2,cy-h*2,w*4,h*4);g.restore();
    g.strokeStyle='rgba(200,210,240,.16)';g.lineWidth=Math.max(1,k*.012);g.beginPath();g.ellipse(cx,cy,w*.9,h*.9,0,Math.PI*1.05,Math.PI*1.75);g.stroke();}
}
function paintCity(){
  let g;[CITY,g]=mk(CW,CH);
  paintGround(g);paintSkyline(g);
  // Far things sit a little out of focus, so the eye stays on the street.
  const[a,ag]=mk(CW,CH);paintSideStreet(ag);g.drawImage(soften(a,1.4),0,0);
  for(const b of FRONT)paintBuilding(g,b);
  // Each shop throws hard-edged colour up the wall and out across the pavement.
  g.save();g.globalCompositeOperation='lighter';
  const k=F/WALL,y0=PY(0,WALL),yK=PY(0,FKERB);for(const b of FRONT)if(b.kind==='shop'){const x=PX(b.x,WALL),w=b.w*k,c=b.shop[1],hy=PY(b.gh,WALL);
    g.fillStyle=lin(g,0,hy,0,hy-k*3.4,[[0,rgba(c,.24)],[1,rgba(c,0)]]);poly(g,[[x+k*.2,hy],[x+w-k*.2,hy],[x+w-k*1.4,hy-k*3.4],[x+k*1.4,hy-k*3.4]]);g.fill();
    g.fillStyle=lin(g,0,y0,0,yK+k*.7,[[0,rgba(c,.42)],[1,rgba(c,.05)]]);poly(g,[[x+k*.2,y0],[x+w-k*.2,y0],[PX(b.x+b.w+.4,FKERB),yK+k*.7],[PX(b.x-.4,FKERB),yK+k*.7]]);g.fill();}
  g.restore();
  for(const v of VENDS)paintVend(g,v);paintClutter(g);
  for(const u of UPOLES)paintUtility(g,u);
  paintWires(g);
  for(const l of LAMPS)paintLamp(g,l);
  paintTrafficLight(g,GX0-.5,FKERB+.5);paintTrafficLight(g,GX1+.5,FKERB+.5);
  // The air between us and the far side.
  g.globalCompositeOperation='source-atop';g.fillStyle=lin(g,0,0,0,PY(0,FKERB),[[0,rgba(MOOD.sky[0],.34)],[.6,rgba(MOOD.haze,.02)],[1,rgba(MOOD.haze,.05+.06*MOOD.mist)]]);g.fillRect(0,0,CW,PY(0,FKERB));g.globalCompositeOperation='source-over';
}
// The final grade on the painted city: deeper blacks and harder colour, then bloom from the brightest lights only.
function gradeCity(){
  const g=CITY.getContext('2d'),[c,cg]=mk(CW/5,CH/5);
  g.save();g.globalCompositeOperation='overlay';g.globalAlpha=.5;g.drawImage(CITY,0,0);g.restore();
  cg.imageSmoothingQuality='high';cg.drawImage(CITY,0,0,c.width,c.height);cg.globalCompositeOperation='multiply';cg.drawImage(c,0,0);cg.drawImage(c,0,0);cg.drawImage(c,0,0);
  const b=soften(soften(c,3),2);g.save();g.globalCompositeOperation='lighter';g.globalAlpha=.8;g.imageSmoothingQuality='high';g.drawImage(b,0,0,CW,CH);g.restore();
}

/* ---------- the tree ---------- */
// Five-petalled flowers, one sprite per tone, stamped by the thousand when the tree is painted.
function bloomSprite(c0,c1,c2){
  const n=96,[c,g]=mk(n,n);g.translate(n/2,n/2);
  for(let i=0;i<5;i++){g.save();g.rotate(i*TAU/5);g.beginPath();g.moveTo(0,-6);g.bezierCurveTo(-30,-16,-26,-44,-5,-46);g.lineTo(0,-40);g.lineTo(5,-46);g.bezierCurveTo(26,-44,30,-16,0,-6);g.closePath();
    g.fillStyle=rad(g,0,0,4,47,[[0,c2],[.32,c1],[1,c0]]);g.fill();g.strokeStyle=rgba(c2,.3);g.lineWidth=1.2;g.stroke();g.restore();}
  ell(g,0,0,9,9,c2);g.strokeStyle=rgba('#fff0a8',.7);g.lineWidth=1.3;for(let i=0;i<11;i++){const a=i*TAU/11,r=15+(i%3)*5;g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a)*r,Math.sin(a)*r);g.stroke();ell(g,Math.cos(a)*r,Math.sin(a)*r,2.2,2.2,'#ffe48a');}
  return c;}
const BLOOM=TREE.tones.map(t=>bloomSprite(t[0],t[1],t[2]));
function catmull(P,n){const o=[],q=(a,b,c,d,s)=>.5*(2*b+(c-a)*s+(2*a-5*b+4*c-d)*s*s+(3*b-a-3*c+d)*s*s*s);for(let i=0;i<P.length-1;i++){const a=P[Math.max(0,i-1)],b=P[i],c=P[i+1],d=P[Math.min(P.length-1,i+2)];for(let j=0;j<n;j++){const s=j/n;o.push([q(a[0],b[0],c[0],d[0],s),q(a[1],b[1],c[1],d[1],s)]);}}o.push(P[P.length-1].slice());return o;}
// A tapering, slightly gnarled limb round a centre line.
function limbOutline(c,w0,w1,sd){const L=[],Rr=[],n=c.length;for(let i=0;i<n;i++){const a=c[Math.max(0,i-1)],b=c[Math.min(n-1,i+1)],tx=b[0]-a[0],ty=b[1]-a[1],l=Math.hypot(tx,ty)||1,u=i/(n-1),w=lerp(w0,w1,Math.pow(u,.8))/2,k1=1+.16*(h3(i*.37|0,sd,1)-.5)+.1*Math.sin(i*.9+sd),k2=1+.16*(h3(i*.31|0,sd,2)-.5)+.1*Math.sin(i*.7+sd*2);L.push([c[i][0]-ty/l*w*k1,c[i][1]+tx/l*w*k1]);Rr.push([c[i][0]+ty/l*w*k2,c[i][1]-tx/l*w*k2]);}return{L,R:Rr};}
function paintLimb(g,c,w0,w1,sd){
  const{L,R:Rr}=limbOutline(c,w0,w1,sd),p=new Path2D();p.moveTo(L[0][0],L[0][1]);for(const q of L)p.lineTo(q[0],q[1]);for(let i=Rr.length-1;i>=0;i--)p.lineTo(Rr[i][0],Rr[i][1]);p.closePath();
  g.fillStyle='#1c1320';g.fill(p);g.save();g.clip(p);
  // Dark bark in rings across the limb, the way cherry bark grows, with a warmer tone where the street lights it.
  const lit=TS<0?Rr:L,dk=TS<0?L:Rr;
  for(let i=0;i<c.length-1;i+=1){const a=lit[i],b=lit[i+1],a2=dk[i],b2=dk[i+1],mx=[(a[0]+a2[0])/2,(a[1]+a2[1])/2],mb=[(b[0]+b2[0])/2,(b[1]+b2[1])/2];g.fillStyle=lin(g,a[0],a[1],a2[0],a2[1],[[0,'#5a3c50'],[.25,'#3a2636'],[.6,'#201624'],[1,'#120c16']]);poly(g,[a,b,b2,a2]);g.fill();}
  g.lineCap='round';
  const len=c.length;for(let i=0;i<len*5;i++){const u=h3(i,sd,3),j=Math.min(len-2,Math.floor(u*(len-1))),a=L[j],b=Rr[j],v0=h3(i,sd,4),v1=v0+.1+.34*h3(i,sd,5),x0=lerp(a[0],b[0],v0),y0=lerp(a[1],b[1],v0),x1=lerp(a[0],b[0],Math.min(1,v1)),y1=lerp(a[1],b[1],Math.min(1,v1));g.strokeStyle=h3(i,sd,6)<.68?'rgba(10,6,12,.55)':'rgba(170,130,150,.2)';g.lineWidth=Math.max(.7,w0*.012*(1+h3(i,sd,7)*2));g.beginPath();g.moveTo(x0,y0);g.quadraticCurveTo((x0+x1)/2,(y0+y1)/2+w0*.01,x1,y1);g.stroke();}
  g.restore();
}
// The light in the branches: a street lamp hidden up among them, and the shelter's strip below.
let LAMPAT=[0,0];
// The tree's place is measured out from the middle of the view, in window heights, so a wider window shows more of it
// and an ordinary one none. TREE_IN is as near the middle as any blossom comes, TRUNK_U where the trunk stands.
const TREE_IN=1.03,TRUNK_U=1.2,treeU=x=>(x-CX)*TS/CH,treeInView=()=>CW/2>(TREE_IN-.01)*CH;
// How low the blossom hangs: well down beside the trunk, and higher further out.
function canopyFloor(x){return CH*(.2+.34*clamp(1-Math.abs(treeU(x)-TRUNK_U)/.8,0,1)**1.6);}
function bough(rf,x,y,ang,len,layer){
  const B={layer,segs:[],nodes:[],px:x,py:y,amp:rf(.006,.016)*(layer===2?1.25:1),f:rf(.06,.15),s:rf(0,99)};
  const shoot=(x,y,a,l,w,d)=>{const n=Math.max(3,Math.round(l/(CH*.024))),st=l/n;let px=x,py=y;
    for(let i=0;i<n;i++){a+=rf(-.3,.3);a+=Math.sin(Math.PI/2-a)*.075*(1+d*.8);
      const nx=px+Math.cos(a)*st,ny=py+Math.sin(a)*st,ww=w*(1-i/n*.72);if((ny>canopyFloor(nx)||treeU(nx)<TREE_IN+.03)&&i>0)break;B.segs.push([px,py,nx,ny,ww]);
      if(i>=(d?0:1))B.nodes.push([nx,ny,rf(.75,1.25)]);
      if(d<2&&rf(0,1)<(d?.26:.42)&&i>0&&i<n-1)shoot(nx,ny,a+(rf(0,1)<.5?-1:1)*rf(.45,1.05),l*rf(.42,.7),ww*.7,d+1);
      px=nx;py=ny;}
    B.nodes.push([px,py,rf(.9,1.3)]);};
  shoot(x,y,ang,len,CH*(layer===2?.0052:.004),0);return B;
}
function paintBough(B,rf){
  const sc=.82,cr=CH*(B.layer===0?.017:B.layer===1?.02:.026),br=CH*(B.layer===0?.0058:B.layer===1?.0076:.0105),m=cr*2;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const s of B.segs){x0=Math.min(x0,s[0],s[2]);y0=Math.min(y0,s[1],s[3]);x1=Math.max(x1,s[0],s[2]);y1=Math.max(y1,s[1],s[3]);}
  x0-=m;y0-=m;x1+=m;y1+=m;const[c,g]=mk((x1-x0)*sc,(y1-y0)*sc);g.setTransform(sc,0,0,sc,-x0*sc,-y0*sc);
  // Under the flowers a soft mass, so a branch reads as a cloud of blossom with single flowers on top.
  for(const n of B.nodes){const r=cr*n[2]*1.05,t0=TREE.tones[B.layer===0?0:1][1];g.fillStyle=rad(g,n[0],n[1],0,r,[[0,rgba(t0,B.layer===0?.62:.46)],[.6,rgba(t0,.22)],[1,rgba(t0,0)]]);g.fillRect(n[0]-r,n[1]-r,r*2,r*2);}
  const stamps=[];
  for(const n of B.nodes){const cnt=Math.round((B.layer===0?6:B.layer===1?7:9)*n[2]);
    for(let i=0;i<cnt;i++){const a=rf(0,TAU),d=Math.sqrt(rf(0,1))*cr*n[2],bx=n[0]+Math.cos(a)*d,by=n[1]+Math.sin(a)*d*.86,dl=Math.hypot(bx-LAMPAT[0],by-LAMPAT[1])/(CH*.46);
      // Lit from below and by the hidden lamp, in shadow on top and far from it.
      let k=[.2,.4,.5][B.layer]+.26*(by-n[1])/cr+.34*(1-clamp(dl,0,1))**1.6+rf(-.14,.14)-.1*clamp(1-by/(CH*.2),0,1);
      stamps.push([bx,by,clamp(Math.round(k*4),0,4),br*rf(.72,1.25),rf(0,TAU),rf(.55,1)]);}}
  stamps.sort((a,b)=>a[2]-b[2]);
  const half=Math.floor(stamps.length*.42),stamp=s=>{g.save();g.translate(s[0],s[1]);g.rotate(s[4]);g.scale(s[3]/48,s[3]/48*s[5]);g.drawImage(BLOOM[s[2]],-48,-48);g.restore();};
  for(let i=0;i<half;i++)stamp(stamps[i]);
  g.lineCap='round';for(const s of B.segs){g.strokeStyle=B.layer===0?'#20162a':'#2a1c2c';g.lineWidth=s[4];g.beginPath();g.moveTo(s[0],s[1]);g.lineTo(s[2],s[3]);g.stroke();}
  // Young bronze leaves come out with the last of the flowers.
  for(let i=0;i<B.nodes.length;i+=2){const n=B.nodes[i],a=rf(0,TAU),l=br*rf(.9,1.5);g.save();g.translate(n[0]+Math.cos(a)*cr*.5,n[1]+Math.sin(a)*cr*.5);g.rotate(a);ell(g,l*.5,0,l*.7,l*.24,rgba(mixC('#7a4a3a','#3a5a3a',rf(0,1)),.8));g.restore();}
  for(let i=half;i<stamps.length;i++)stamp(stamps[i]);
  if(B.layer===0){g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-atop';g.fillStyle=rgba(MOOD.sky[1],.34);g.fillRect(0,0,c.width,c.height);}
  B.c=B.layer===2?soften(c,1.7):B.layer===0?soften(c,1.35):c;B.x0=x0;B.y0=y0;B.w=x1-x0;B.h=y1-y0;
}
function paintTree(){
  BOUGHS=[];TRUNK=null;TRK=[];if(!treeInView())return;
  const r=stream('tree'),rf=(a,b)=>a+(b-a)*r();
  const P=(u,v)=>[CX+TS*u*CH,v*CH],j=(u,v,a=.012)=>[CX+TS*(u+rf(-a,a))*CH,(v+rf(-a,a))*CH];
  const thick=CH*.13,T=TRUNK_U;
  LAMPAT=P(T+.1,.1);
  const fork=j(T-.01,.45);
  const limbs=[
    {pts:[P(T,.965),P(T+.01,.8),j(T-.02,.6),fork],w0:thick*1.04,w1:thick*.66,sd:1},
    {pts:[fork,j(T+.16,.3),j(T+.35,.17),j(T+.56,.1),j(T+.78,.12)],w0:thick*.46,w1:thick*.05,sd:2},
    {pts:[j(T-.01,.56),j(T-.06,.47),j(T-.1,.4),j(T-.125,.36)],w0:thick*.3,w1:thick*.04,sd:3},
    {pts:[fork,j(T-.05,.3),j(T-.1,.17),j(T-.13,.06),j(T-.15,-.08)],w0:thick*.4,w1:thick*.12,sd:4},
    {pts:[j(T,.55),j(T+.14,.44),j(T+.3,.38),j(T+.44,.4)],w0:thick*.3,w1:thick*.03,sd:5},
    {pts:[j(T+.35,.17),j(T+.46,.24),j(T+.56,.3)],w0:thick*.12,w1:thick*.02,sd:6},
    {pts:[fork,j(T+.02,.25),j(T+.06,.1),j(T+.02,-.08)],w0:thick*.34,w1:thick*.1,sd:7}
  ];
  for(const l of limbs)l.c=catmull(l.pts,12);
  let g;[TRUNK,g]=mk(CW,CH);
  // The ring of kerb stones round the tree's foot, with fallen petals on it.
  {const[bx,by]=P(T,.965),rw=thick*1.5,rh=thick*.2;g.fillStyle='#28222e';g.beginPath();g.ellipse(bx,by,rw,rh,0,0,TAU);g.fill();g.fillStyle='#120e16';g.beginPath();g.ellipse(bx,by-rh*.1,rw*.82,rh*.72,0,0,TAU);g.fill();g.strokeStyle='rgba(170,150,170,.5)';g.lineWidth=Math.max(1,thick*.02);g.beginPath();g.ellipse(bx,by,rw,rh,0,Math.PI*.95,Math.PI*2.05);g.stroke();
    for(let i=0;i<70;i++){const a=rf(0,TAU),d=Math.sqrt(rf(0,1)),q=BLOOM[3];g.globalAlpha=.8;g.drawImage(q,bx+Math.cos(a)*d*rw*.84-3,by+Math.sin(a)*d*rh*.74-1.5,thick*.045,thick*.02);}g.globalAlpha=1;}
  for(let i=limbs.length-1;i>=0;i--){const l=limbs[i];paintLimb(g,l.c,l.w0,l.w1,l.sd);}
  // Boughs grow from the limbs at every length, above and below them.
    for(let i=1;i<limbs.length;i++){const l=limbs[i],n=l.c.length,step=Math.max(3,Math.round(n/4.6));
    for(let q=2;q<n;q+=step){const[x,y]=l.c[q],dx=l.c[Math.min(n-1,q+1)][0]-l.c[q-1][0],dy=l.c[Math.min(n-1,q+1)][1]-l.c[q-1][1],along=Math.atan2(dy,dx);
      for(const side of[-1,1]){if(r()<.1)continue;const layer=wpick2(r,[[0,3],[1,4],[2,1.4]]),a=along+side*rf(.5,1.3),len=CH*rf(.11,.22)*(layer===2?1.12:1);
        const B=bough(rf,x,y,a,len,layer);BOUGHS.push(B);}}}
  // Extra drooping shoots at the ends of the limbs, so the edge of the tree is soft.
  for(const q of[limbs[1],limbs[2],limbs[4],limbs[5]]){const e=q.c[q.c.length-1];for(let i=0;i<2;i++)BOUGHS.push(bough(rf,e[0],e[1],Math.PI/2+rf(-.8,.8),CH*rf(.08,.14),wpick2(r,[[1,3],[2,1]])));}
  for(const B of BOUGHS)paintBough(B,rf);
  BOUGHS.sort((a,b)=>a.layer-b.layer);
  // A low copy of the whole tree, laid over it to make the flowers glow.
  const s=10,[gc,gg]=mk(CW/s,CH*.62/s);gg.setTransform(1/s,0,0,1/s,0,0);gg.globalCompositeOperation='lighter';
  for(const B of BOUGHS)if(B.layer)gg.drawImage(B.c,B.x0,B.y0,B.w,B.h);
  g.globalCompositeOperation='lighter';g.globalAlpha=.1;g.drawImage(soften(gc,2.5),0,0,CW,CH*.62);g.globalAlpha=1;g.globalCompositeOperation='source-over';
}
const wpick2=(r,list)=>{let s=0;for(const i of list)s+=i[1];let v=r()*s;for(const i of list){v-=i[1];if(v<=0)return i[0];}return list[0][0];};

/* ---------- the shelter, in front of us ---------- */
const ADC=[pick(NEON),pick(NEON)];
function paintFG(){
  let g;[FG,g]=mk(CW,CH);
  const edge=TS<0?CW:0,post=TS<0?CW*(TALL?.93:.925):CW*(TALL?.07:.075),pw=Math.max(5,CH*.016),roofY=CH*.04,sd=TS<0?1:-1;
  // The side wall of the shelter, running past us: scratched, grimy glass with a lightbox in it.
  const top=[[post,roofY],[edge,-CH*.12]],bot=[[post,CH*.965],[edge,CH*1.25]],wall=[top[0],top[1],bot[1],bot[0]],x0=Math.min(post,edge),ww=Math.abs(edge-post);
  g.save();poly(g,wall);g.clip();g.fillStyle=lin(g,post,0,edge,0,[[0,'rgba(150,180,220,.06)'],[1,'rgba(150,180,220,.14)']]);g.fillRect(x0,-CH*.2,ww,CH*1.5);texFill(g,GRIME,x0,0,ww,CH,CH/900,0,0,.8);
  g.strokeStyle='rgba(230,240,255,.14)';g.lineWidth=Math.max(.7,CH*.0009);g.lineCap='round';for(let i=0;i<26;i++){const x=x0+h3(i,1,51)*ww,y=CH*(.1+h3(i,2,51)*.8),l=CH*(.01+.05*h3(i,3,51)),a=h3(i,4,51)*TAU;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();}g.restore();
  const lx=lerp(post,edge,.26),rx=edge,y0=CH*.3,y1=CH*.8,dy0=-CH*.05,dy1=CH*.06,pts=[[lx,y0],[rx,y0+dy0],[rx,y1+dy1],[lx,y1]],[a,b]=ADC,mx=(lx+rx)/2,bw=Math.abs(rx-lx);
  g.save();poly(g,pts);g.clip();const bx=Math.min(lx,rx)-5;
  g.fillStyle=lin(g,0,y0,0,y1,[[0,mixC(a,'#100818',.62)],[.5,mixC(b,'#100818',.42)],[1,mixC(a,'#100818',.82)]]);g.fillRect(bx,-CH*.2,bw+10,CH*1.5);
  // The poster: a hot disc, hard slashes of colour and rows of blocks standing in for small print.
  g.fillStyle=rgba(mixC(b,'#ffffff',.5),.9);g.beginPath();g.arc(mx,CH*.47,bw*.42,0,TAU);g.fill();g.fillStyle=mixC(a,'#100818',.7);g.beginPath();g.arc(mx+sd*bw*.16,CH*.45,bw*.34,0,TAU);g.fill();
  g.fillStyle=rgba(a,.85);for(let i=0;i<4;i++){const yy=CH*(.58+i*.03);poly(g,[[bx,yy],[bx+bw+10,yy-CH*.03],[bx+bw+10,yy-CH*.02],[bx,yy+CH*.01]]);g.fill();}
  g.fillStyle='rgba(255,255,255,.55)';for(let r=0;r<3;r++)for(let c=0;c<5;c++)if(h3(r,c,61)<.75)g.fillRect(bx+bw*(.16+c*.15),CH*(.69+r*.018),bw*.11,CH*.008);
  g.fillStyle='rgba(6,4,10,.28)';for(let yy=-CH*.1;yy<CH*1.1;yy+=Math.max(3,CH*.005))g.fillRect(bx,yy,bw+10,Math.max(1,CH*.0018));
  g.fillStyle=lin(g,lx,0,rx,0,[[0,'rgba(6,4,10,.5)'],[.5,'rgba(255,255,255,.06)'],[1,'rgba(6,4,10,.3)']]);g.fillRect(bx,-CH*.2,bw+10,CH*1.5);g.restore();
  g.strokeStyle='#0e0c14';g.lineWidth=CH*.01;poly(g,pts);g.stroke();g.strokeStyle='rgba(220,220,235,.14)';g.lineWidth=Math.max(1,CH*.0014);poly(g,pts);g.stroke();
  // The post: painted steel, chipped, with a few old stickers.
  g.fillStyle=lin(g,post-pw/2,0,post+pw/2,0,[[0,'#0c0a12'],[.34,'#2c2834'],[.5,'#3c3844'],[1,'#08070c']]);g.fillRect(post-pw/2,roofY-2,pw,CH*.93);
  texFill(g,RUST,post-pw/2,roofY,pw,CH*.93,CH/1400,0,0,.8);for(let i=0;i<5;i++){const yy=CH*(.28+.5*h3(i,1,71)),hh=CH*(.015+.03*h3(i,2,71));g.fillStyle=pick2(['#c82a36','#e8d81a','#e4e4ea','#2a8ae0'],i,7);g.fillRect(post-pw*.42,yy,pw*.84,hh);g.fillStyle='rgba(6,4,10,.5)';g.fillRect(post-pw*.42,yy+hh*.4,pw*.84,hh*.12);}
  for(let yy=roofY+CH*.06;yy<CH*.95;yy+=CH*.17){ell(g,post,yy,pw*.14,pw*.14,'#0a0810');}
  // The roof's edge: panels, rivets, a run of cable, and a strip of light under it.
  const re=treeInView()?CX+TS*CH:CW-edge,ra=Math.min(re,edge),rw=Math.abs(edge-re);
  g.fillStyle=lin(g,0,0,0,roofY,[[0,'#08070c'],[.7,'#16141e'],[1,'#26222e']]);g.fillRect(ra,0,rw,roofY);texFill(g,GRIME,ra,0,rw,roofY,CH/1000,40,0,.8);
  g.fillStyle='rgba(4,3,8,.8)';for(let x=ra;x<ra+rw;x+=CH*.16)g.fillRect(x,0,Math.max(1,CH*.0016),roofY);g.fillStyle='rgba(200,200,220,.16)';for(let x=ra+CH*.01;x<ra+rw;x+=CH*.04)g.fillRect(x,roofY*.72,Math.max(1,CH*.0016),Math.max(1,CH*.0016));
  g.strokeStyle='#04030a';g.lineWidth=Math.max(1,CH*.003);g.beginPath();for(let x=ra;x<ra+rw;x+=CH*.32){g.moveTo(x,roofY*.3);g.quadraticCurveTo(x+CH*.16,roofY*.62,x+CH*.32,roofY*.3);}g.stroke();
  g.fillStyle='#f6fbff';g.fillRect(ra,roofY-CH*.0022,rw,CH*.0022);
  g.save();g.globalCompositeOperation='lighter';g.fillStyle=lin(g,0,roofY,0,roofY+CH*.06,[[0,'rgba(226,240,255,.26)'],[1,'rgba(226,240,255,0)']]);g.fillRect(ra,roofY,rw,CH*.06);g.restore();
  FG=soften(FG,1.5);
}
// The stop's pole, with a lit panel that counts down to the next bus. Drawn once and lettered live.
function paintPole(){
  const z=3.05,k=F/z,w=.56*k,h=.9*k,tot=3*k,[c,g]=mk(w+k*.6,tot+k*.4),cx=c.width/2,y0=tot+k*.2;
  g.fillStyle=lin(g,cx-k*.04,0,cx+k*.04,0,[[0,'#16141c'],[.32,'#5a5664'],[.5,'#7e7a88'],[1,'#121018']]);g.fillRect(cx-k*.035,k*.2,k*.07,tot);
  texFill(g,RUST,cx-k*.035,k*1.4,k*.07,tot-k*1.2,k/320,0,0,.9);
  for(let i=0;i<4;i++){const yy=k*(1.6+h3(i,1,81)*1.1),hh=k*(.05+.09*h3(i,2,81));g.fillStyle=pick2(['#e4e4ea','#e8d81a','#c82a36','#22222c'],i,3);g.fillRect(cx-k*.036,yy,k*.072,hh);}
  g.fillStyle='#1e1c26';poly(g,[[cx-k*.14,y0],[cx+k*.14,y0],[cx+k*.08,y0-k*.08],[cx-k*.08,y0-k*.08]]);g.fill();
  g.fillStyle=lin(g,0,k*.46,0,k*1.46,[[0,'#17151f'],[1,'#0c0a12']]);rrect(g,cx-w/2,k*.5,w,h,k*.03);g.fill();g.strokeStyle='#5a5664';g.lineWidth=Math.max(1,k*.012);g.stroke();g.fillStyle='#04030a';rrect(g,cx-w/2+k*.03,k*.53,w-k*.06,h-k*.06,k*.02);g.fill();for(const q of[[-1,-1],[1,-1],[-1,1],[1,1]])ell(g,cx+q[0]*(w/2-k*.015),k*.5+h/2+q[1]*(h/2-k*.015),k*.008,k*.008,'#8a8894');
  g.fillStyle=lin(g,0,k*.1,0,k*.5,[[0,'#ff4a7c'],[.5,'#e82868'],[1,'#a81448']]);g.beginPath();g.arc(cx,k*.3,k*.21,0,TAU);g.fill();g.save();g.beginPath();g.arc(cx,k*.3,k*.21,0,TAU);g.clip();g.fillStyle='rgba(255,255,255,.18)';g.beginPath();g.ellipse(cx-k*.06,k*.16,k*.2,k*.1,-.4,0,TAU);g.fill();g.restore();g.strokeStyle='#e8e4ea';g.lineWidth=k*.018;g.beginPath();g.arc(cx,k*.3,k*.21,0,TAU);g.stroke();
  g.fillStyle='#fff';g.font=`800 ${k*.17}px ${SANS}`;g.textAlign='center';g.textBaseline='middle';g.fillText('BUS',cx,k*.305);g.textBaseline='alphabetic';
  const[tc,tg]=mk(w,h*.9);POLEC={c,k,w,h,top:k*.5,cx,y0,tc,tg,key:''};
}

/* ---------- petals ---------- */
// A petal: a notched teardrop, in three tones and four amounts of blur for how far it is from where the eye is focused.
const PET=[];
function petalSprite(c0,c1,c2,b){const n=64,[c,g]=mk(n,n);g.translate(n/2,n/2);const p=new Path2D();p.moveTo(0,22);p.bezierCurveTo(-24,8,-20,-20,-5,-24);p.lineTo(0,-17);p.lineTo(5,-24);p.bezierCurveTo(20,-20,24,8,0,22);p.closePath();g.fillStyle=c0;g.fill(p);g.save();g.clip(p);g.translate(5,4);g.fillStyle=c1;g.fill(p);g.translate(4,5);g.fillStyle=c2;g.globalAlpha=.8;g.fill(p);g.globalAlpha=1;g.restore();g.fillStyle=rad(g,0,22,0,17,[[0,c2],[1,rgba(c2,0)]]);g.fill(p);g.strokeStyle=rgba(c2,.5);g.lineWidth=1;g.beginPath();g.moveTo(0,20);g.quadraticCurveTo(-2,2,0,-12);g.moveTo(0,16);g.quadraticCurveTo(-9,0,-8,-14);g.moveTo(0,16);g.quadraticCurveTo(9,0,8,-14);g.stroke();
  if(!b)return c;const[o,og]=mk(n*3,n*3);og.translate(n,n);og.drawImage(c,0,0);return soften(o,[0,5,10,18][b]);}
for(let i=0;i<3;i++){const tn=TREE.tones[i+2];PET.push([0,1,2,3].map(b=>petalSprite(tn[0],tn[1],tn[2],b)));}
function newPetal(x,y,z,vy){
  const p={x,y,z,vx:wind*.4,vy:vy||0,vz:0,ph:rr(0,TAU),fr:rr(.28,.62),sw:rr(.06,.18),fall:rr(.06,.13),size:rr(.024,.038),rot:rr(0,TAU),spin:rr(-.4,.4),flip:rr(0,TAU),fs:rr(.35,1),tone:ri(0,2)};
  petals.push(p);return p;}
const CAP=LOWQ?120:220;
// The crown spreads above and beside the bench, out of sight, so a petal comes in over the top of the view, a little
// more often on the tree's side.
function shed(){
  const z=wpick([[rr(.6,1.5),.55],[rr(1.5,4.5),6],[rr(4.5,9),2.2],[rr(9,12.5),.4]]),sx=CW*(.5+TS*.12+rr(-.7,.7));
  return newPetal((sx-CX)*z/F,EYE+(HY+CH*rr(.02,.14))*z/F,z);
}
function updPetals(dt){
  const rate=(2.2+5.5*fbm(t*.02+PO))*(1+gustK*3)*(raining?1.4:1)*(CAP/260);
  let n=rate*dt;while(n>0){if(R()<n&&petals.length<CAP*(1+gustK))shed();n-=1;}
  for(const p of petals){
    p.ph+=p.fr*dt*TAU*.5;const sway=Math.sin(p.ph),air=wind+.06*Math.sin(t*.2+p.z*.9+p.y*.7)+gustD*gustK*(.6+.25*Math.sin(p.z*1.3+t*.6));
    let wake=0;for(const v of veh){if(Math.abs(p.z-v.z)<2.4){const rear=v.front-v.d*v.L,on=(p.x-rear)*v.d;if(on>-5&&on<v.L+1)wake+=v.d*v.v*.06*(1-Math.abs(p.z-v.z)/2.4);}}
    p.vx+=(air+wake+sway*p.sw-p.vx)*Math.min(1,dt*1.4);p.vz+=(.05*Math.sin(t*.23+p.x)+Math.cos(p.ph*.6)*.05-p.vz)*Math.min(1,dt);
    const fallV=p.fall*(raining?1.7:1)*(.72+.42*Math.cos(p.ph*2)**2)-gustK*.1*Math.abs(Math.sin(p.ph*.5));p.vy+=(-fallV-p.vy)*Math.min(1,dt*2.2);
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.rot+=(p.spin+sway*.9)*dt;p.flip+=p.fs*dt*(1+gustK);
    if(p.y<=groundAt(p.z)+.004){p.dead=true;stats.petals++;land(p);}
    else if(p.z<.3||Math.abs(p.x)>halfW(p.z)+3+p.z*.5)p.dead=true;}
  petals=petals.filter(p=>!p.dead);
}
// A landed petal lies flat, foreshortened by how far away it is. It waits in a queue, drawn live, and joins the carpet with
// the others every so often: the carpet is drawn every frame, and writing to it each time would copy all of it.
let landQ=[],carpetT=0;
function stamp(g,p,oy){const k=F/p.z,x=PX(p.x,p.z),y=PY(groundAt(p.z),p.z)-oy,s=p.size*k/32*1.15;g.setTransform(s*Math.cos(p.rot),s*Math.sin(p.rot)*EYE/p.z*.9,-s*Math.sin(p.rot),s*Math.cos(p.rot)*EYE/p.z*.9,x,y);g.globalAlpha=.92;g.drawImage(PET[p.tone][0],-32,-32);}
function land(p){if(!cpg||p.z<nearZ0())return;const x=PX(p.x,p.z);if(x<-20||x>CW+20)return;landQ.push(p);}
function flushCarpet(){
  const g=cpg;g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='destination-out';
  // Tyres clear a track through the petals on the road, and the sweeper a line through those on the pavement.
  for(const v of veh){if(v.v>1){const y=PY(ROAD,v.z)-CARY,a=PX(v.front-v.d*v.L,v.z),b=PX(v.front,v.z),c=PX(v.wiped??v.front,v.z),x0=Math.min(a,b,c),x1=Math.max(a,b,c);g.fillStyle='rgba(0,0,0,.5)';g.fillRect(x0,y-F/v.z*.5,x1-x0,F/v.z*.6);}v.wiped=v.front;}
  if(sweeper){const s=sweeper,y=PY(0,s.z)-CARY,k=F/s.z,a=PX(s.wiped??s.x,s.z),b=PX(s.x,s.z);g.fillStyle='rgba(0,0,0,.85)';g.fillRect(Math.min(a,b)-k*.3,y-k*.2,Math.abs(b-a)+k*.6,k*.4);s.wiped=s.x;}
  if(Math.floor(t/18)!==Math.floor(carpetT/18)){g.fillStyle='rgba(0,0,0,.05)';g.fillRect(0,0,CW,CH);}
  g.globalCompositeOperation='source-over';for(const p of landQ)stamp(g,p,CARY);landQ.length=0;g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;carpetT=t;
}
// How much of each pale light falls on a spot, for tinting petals as they pass through it.
function drawPetals(g,z0,z1){
  for(const p of petals){if(p.z<z0||p.z>=z1)continue;
    const k=F/p.z,x=CX+p.x*k,y=HY+(EYE-p.y)*k,s=p.size*k,bl=p.z<.95?3:p.z<1.5?2:p.z<2.3?1:0;if(x<-s*5||x>CW+s*5||y<-s*5||y>CH+s*5)continue;
    const fl=Math.cos(p.flip),ca=Math.cos(p.rot),sa=Math.sin(p.rot),a=s/22*(.14+.86*Math.abs(fl)),b=s/22,sp=PET[fl>0?p.tone:Math.max(0,p.tone-1)][bl],hw=sp.width/2;
    g.setTransform(ca*a,sa*a,-sa*b,ca*b,x,y);g.globalAlpha=[.96,.9,.74,.56][bl]*(p.z>9?.8:1);g.drawImage(sp,-hw,-hw);}
  g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;
}

/* ---------- people ---------- */
// Clothes for a hard neon night: dark bases with one loud accent, on long, lean figures about seven and a half heads tall.
const CLOTH=[['black','#24242e'],['graphite','#3a3c46'],['navy','#242e54'],['oxblood','#621f2c'],['olive','#464e36'],['rust','#9a4620'],['bone','#d6cfbe'],['teal','#1f6466'],['violet','#462f76'],['acid yellow','#e2d01e'],['red','#cc2b38'],['white','#e4e4ea']];
const ACCENT=['#f3e600','#ff2a55','#2af0ff','#ff8a1a','#b14bff','#3bff9a','#f0f0f4'];
const PANTS=['#20222e','#2a3350','#3a3a44','#3e3a30','#18181f','#464c5a'];
const SKIN=['#f8d8bc','#ecc09a','#d49c74','#ac7650','#82553a','#5a3c28'];
const HAIR=['#1c1619','#3e2719','#6e4a2c','#d4b066','#a4a4ae','#e6e6ea','#d6588a','#4686dc','#b44828','#2af0ff','#ff2a7a','#f3e600'];
const GARB={bomber:'bomber jacket',trench:'long coat',hoodie:'hoodie',puffer:'puffer jacket',vest:'tech vest'};
function makeLook(tough){
  const[cn,coat]=tough?pick([['black','#24242e'],['oxblood','#621f2c'],['graphite','#3a3c46']]):pick(CLOTH),top=tough?pick(['bomber','vest','trench']):wpick([['bomber',3],['trench',2.4],['hoodie',2.2],['puffer',1.4],['vest',1.4]]),wired=tough||chance(.3);
  const o={top,coat,panel:chance(.6)?pick(ACCENT):null,pants:pick(PANTS),baggy:chance(.35),boots:chance(.6),shoes:chance(.3)?'#d8d8e0':'#1c1c24',skin:pick(SKIN),hair:wired?pick(HAIR):pick(HAIR.slice(0,9)),hs:wpick([['crop',3],['undercut',2],['bob',2],['long',2],['pony',1.6],['spike',1.4]]),hood:top==='hoodie'&&chance(.3),shades:false,
    hat:wpick([[null,7],['beanie',1.2],['cap',1]]),hatC:pick(['#c8343a','#242e54','#2c2c36','#e0b030','#1f6466','#e4e4ea']),bag:wpick([[null,3],['backpack',2],['sling',1.4]]),bagC:pick(['#22222c','#5a3a28','#464e36','#242e54','#d6cfbe']),visor:null,lines:null,chrome:false,mask:false,led:null,desc:`someone in ${an(cn)} ${GARB[top]}`};
  // Plenty of people here have had work done, or dress as if they have.
  if(wired){const n=pick(NEON);o.led=chance(.7)?n:null;o.visor=chance(tough?.5:.3)?n:null;o.lines=chance(.5)?pick(NEON):null;o.chrome=tough?chance(.75):chance(.2);if(tough&&chance(.4)||chance(.06))o.hs='mohawk';o.mask=chance(.14);if(o.hs==='mohawk'){o.hat=null;o.hood=false;}if(o.chrome)o.desc=`someone in ${an(cn)} ${GARB[top]} with a chrome arm`;else if(o.visor)o.desc=`someone in ${an(cn)} ${GARB[top]} and a glowing visor`;}
  // Now and then, someone dressed like the Night City logo.
  if(!tough&&chance(.03))Object.assign(o,{top:'hoodie',coat:'#1c1c26',panel:null,pants:'#1e1e28',hood:true,led:'#ffd23f',shades:true,visor:null,bag:null,hat:null,desc:'someone in a black hoodie with yellow trim, wearing sunglasses at night'});
  return o;
}
function geom(h,b){return{h,b,L1:h*.25,L2:h*.232,ank:h*.03,hipH:h*.502,torso:h*.3,neck:h*.042,hr:h*.0605,up:h*.19,lo:h*.165,foot:h*.15,thigh:h*.044*b,knee:h*.027*b,calf:h*.03*b,ankle:h*.016*b,hipW:h*.05*b,shW:h*.104*b};}
function body(o,h){h=h||rr(19.4,22.6);return{o,h,G:geom(h,rr(.92,1.1))};}

/* A pose is 18 numbers in units around the feet, x forward and y down, so poses can be blended: the hip, the chest, the
   twist between them, the head's offset and tilt, each foot's place and pitch, and where each hand is. */
const PHX=0,PHY=1,CXI=2,CY=3,TW=4,HDX=5,HDY=6,TILT=7,NF=8,FF=11,NH=14,FH=16,PN=18;
// One foot through a stride, u from 0 to 1. Planted for the part f of it, heel first and rolling off the toe, it sweeps
// back at the body's speed. Then the knee lifts it through the air and it swings forward.
function stepFoot(u,A,lift,f,o,i){u=((u%1)+1)%1;let x,y,a;
  if(u<f){const k=u/f;x=A*(1-2*k);a=k<.14?lerp(.3,0,k/.14):k<.56?0:-1.05*sstep(.56,1,k);y=k>.56?-sstep(.56,1,k)*1.5:0;}
  else{const k=(u-f)/(1-f),e=k*k*(3-2*k);x=-A+2*A*e;y=-1.5*(1-sstep(0,.28,k))-lift*Math.sin(Math.PI*Math.min(1,k*1.04))**1.4;a=lerp(-1.05,.3,sstep(.1,1,k));}
  o[i]=x;o[i+1]=y;o[i+2]=a;}
const stepLen=v=>clamp(.33+.17*v,.42,1.2)/UNIT;
// The body over the feet. It rides highest over a straight leg and dips between steps, the shoulders swing against the
// hips, the arms against the legs, a little late, and the head stays level.
function poseWalk(p,o){
  const G=p.G,v=Math.max(.5,p.v),run=sstep(2.1,2.9,v),s=p.ph,f=lerp(.62,.37,run),S=stepLen(v),A=Math.min(S*f,(G.L1+G.L2)*.62),L=G.L1+G.L2,lift=lerp(1.1,3.2,run),limp=p.limp?1:0;
  stepFoot(s,A,lift,f,o,NF);stepFoot(s+.5,A,lift,f,o,FF);
  if(limp){o[NF]*=.62;o[NF+1]*=.5;}
  const low=Math.sqrt(L*L-(A+.5)**2)+G.ank-.05,high=G.hipH-.12,bump=Math.cos(TAU*(s-.04))**2,bob=run?bump*.9*run:0;
  o[PHY]=-lerp(high,low,bump*(1-run))-bob;o[PHX]=lerp(.05,.5,run);
  const lean=.32+.16*v+run*.9;o[CXI]=o[PHX]+lean;o[CY]=o[PHY]-G.torso*(1-.03*run)+Math.cos(TAU*(s-.04)*2)*.03;
  o[TW]=-Math.cos(TAU*s)*(.34+.2*run);o[HDX]=lean*.3;o[HDY]=(1-bump*(1-run))*-.1+(p.limp?Math.sin(TAU*s)*.2:0);o[TILT]=.05*run;
  const Aa=Math.min(.5,.2+.2*v)+.5*run,el=lerp(.34,1.5,run),th=[-Aa*Math.cos(TAU*(s-.05)),Aa*Math.cos(TAU*(s-.05))];
  for(let i=0;i<2;i++){const sx=o[CXI]+(i?-o[TW]*.8:o[TW]),sy=o[CY]+.8,a=th[i],b=a+el*(.75+.25*Math.sin(a*2+.4)),ex=sx+Math.sin(a)*G.up,ey=sy+Math.cos(a)*G.up,j=i?FH:NH;o[j]=ex+Math.sin(b)*G.lo;o[j+1]=ey+Math.cos(b)*G.lo;}
}
// Standing is never quite still: the weight drifts from foot to foot and the chest rises and falls.
function poseStand(p,o){
  const G=p.G,u=t+p.seed,sw=(noise(u*.17)-.5)*1.1,br=Math.sin(u*1.5)*.05;
  o[PHX]=sw*.5;o[PHY]=-(G.hipH-.1)+Math.abs(sw)*.05;o[CXI]=sw*.72+.1;o[CY]=o[PHY]-G.torso+br;o[TW]=sw*.12;o[HDX]=sw*.2+.1;o[HDY]=br*.6;o[TILT]=(noise(u*.11+7)-.5)*.1;
  o[NF]=1.05;o[NF+1]=0;o[NF+2]=0;o[FF]=-.85;o[FF+1]=0;o[FF+2]=0;
  const sy=o[CY]+.8+G.up+G.lo-.2;o[NH]=o[CXI]+.5+sw*.15;o[NH+1]=sy+br;o[FH]=o[CXI]-.4+sw*.1;o[FH+1]=sy+br;
}
function poseAct(p,o){
  poseStand(p,o);const G=p.G,chest=o[CY]+2.2,face=o[CY]-G.neck-.8;
  if(p.state==='phone'){o[NH]=o[CXI]+3.1;o[NH+1]=chest-.5;o[TILT]=.26;o[HDX]+=.2;}
  else if(p.state==='smoke'){if(p.drag>0){o[NH]=o[CXI]+1.5;o[NH+1]=face+.5;o[TILT]=-.06;}else{o[NH]=o[CXI]+2.3;o[NH+1]=chest+1.8;}}
  else if(p.state==='look'){o[TILT]=-.46;o[CXI]-=.25;o[HDX]-=.15;}
  else if(p.state==='photo'){o[TILT]=-.3;o[CXI]-=.2;o[NH]=o[CXI]+4;o[NH+1]=face-1.4;o[FH]=o[CXI]+3.4;o[FH+1]=face-.9;}
  else if(p.state==='watch'){o[TILT]=(noise(t*.5+p.seed)-.5)*.12;}
  if(p.umb&&p.state!=='photo'){o[NH]=o[CXI]+1.9;o[NH+1]=chest-.9;}
}
function ik(a,b,L1,L2,s){const dx=b[0]-a[0],dy=b[1]-a[1],dd=clamp(Math.hypot(dx,dy),.05,L1+L2-.01),ang=Math.atan2(dy,dx),off=Math.acos(clamp((L1*L1+dd*dd-L2*L2)/(2*L1*dd),-1,1)),a1=ang+s*off,e=[a[0]+Math.cos(a1)*L1,a[1]+Math.sin(a1)*L1],a2=Math.atan2(b[1]-e[1],b[0]-e[0]),l=Math.min(L2,Math.hypot(b[0]-e[0],b[1]-e[1]));return[e,[e[0]+Math.cos(a2)*l,e[1]+Math.sin(a2)*l]];}

/* ---------- drawing a body ---------- */
// Three flat tones for a colour under the light at a spot: lit on the side facing the light, the middle, and shadow.
const rgbS=(r,g,b)=>`rgb(${r|0},${g|0},${b|0})`;
function tones(col,L){const c=hex(col),a=L.a,k=L.c,q=L.k,r=c[0]*a[0],g=c[1]*a[1],b=c[2]*a[2];return{l:rgbS(Math.min(255,r+(c[0]*.8+34)*k[0]*q),Math.min(255,g+(c[1]*.8+34)*k[1]*q),Math.min(255,b+(c[2]*.8+34)*k[2]*q)),b:rgbS(r,g,b),d:rgbS(r*.5+L.s[0],g*.5+L.s[1],b*.5+L.s[2])};}
// The light falls on the side away from this shift, so each part of a body is lit along its own edge, not outlined.
let SHX=.2,SHY=.14;
function shadeP(g,p,T,lod,k=1){
  // Far away the light is just a sliver past the shape, drawn with no clip. A clip is the costliest thing a body does.
  if(lod<2){if(lod){g.translate(-SHX*k,-SHY*k);g.fillStyle=T.l;g.fill(p);g.translate(SHX*k,SHY*k);}g.fillStyle=T.b;g.fill(p);return;}
  g.fillStyle=T.l;g.fill(p);g.save();g.clip(p);g.translate(SHX*k,SHY*k);g.fillStyle=T.b;g.fill(p);g.translate(SHX*k*1.5,SHY*k*1.5);g.fillStyle=T.d;g.fill(p);g.restore();}
let INKED=true;
function inkP(g,p,w){if(!INKED)return;g.strokeStyle=INK;g.lineWidth=w||.1;g.stroke(p);}
// A smooth tube through a chain of points, with a half-width at each.
function tubeP(P,W,n){
  const xs=[],ys=[],ws=[],m=P.length;
  for(let i=0;i<m-1;i++){const a=P[Math.max(0,i-1)],b=P[i],c=P[i+1],d=P[Math.min(m-1,i+2)];for(let j=0;j<n;j++){const s=j/n,s2=s*s,s3=s2*s;xs.push(.5*(2*b[0]+(c[0]-a[0])*s+(2*a[0]-5*b[0]+4*c[0]-d[0])*s2+(3*b[0]-a[0]-3*c[0]+d[0])*s3));ys.push(.5*(2*b[1]+(c[1]-a[1])*s+(2*a[1]-5*b[1]+4*c[1]-d[1])*s2+(3*b[1]-a[1]-3*c[1]+d[1])*s3));ws.push(lerp(W[i],W[i+1],s));}}
  xs.push(P[m-1][0]);ys.push(P[m-1][1]);ws.push(W[m-1]);
  const k=xs.length,p=new Path2D(),nx=new Array(k),ny=new Array(k);
  for(let i=0;i<k;i++){const a=Math.max(0,i-1),b=Math.min(k-1,i+1),tx=xs[b]-xs[a],ty=ys[b]-ys[a],l=Math.hypot(tx,ty)||1;nx[i]=-ty/l;ny[i]=tx/l;}
  p.moveTo(xs[0]+nx[0]*ws[0],ys[0]+ny[0]*ws[0]);for(let i=1;i<k;i++)p.lineTo(xs[i]+nx[i]*ws[i],ys[i]+ny[i]*ws[i]);
  const e=k-1,ae=Math.atan2(ny[e],nx[e]);p.arc(xs[e],ys[e],ws[e],ae,ae-Math.PI,true);for(let i=k-1;i>=0;i--)p.lineTo(xs[i]-nx[i]*ws[i],ys[i]-ny[i]*ws[i]);const a0=Math.atan2(-ny[0],-nx[0]);p.arc(xs[0],ys[0],ws[0],a0,a0-Math.PI,true);p.closePath();return p;}
const FOOT=(()=>{const p=new Path2D();p.moveTo(-.2,-.34);p.quadraticCurveTo(-.34,-.1,-.3,.2);p.lineTo(.74,.2);p.quadraticCurveTo(.84,.08,.68,-.02);p.quadraticCurveTo(.38,-.1,.2,-.34);p.closePath();return p;})();
const SOLE=(()=>{const p=new Path2D();p.moveTo(-.31,.13);p.lineTo(.8,.13);p.quadraticCurveTo(.82,.2,.74,.21);p.lineTo(-.3,.21);p.closePath();return p;})();
const HAND=(()=>{const p=new Path2D();p.moveTo(-.1,-.34);p.quadraticCurveTo(.5,-.42,.95,-.18);p.quadraticCurveTo(1.15,0,.95,.2);p.quadraticCurveTo(.5,.42,-.1,.3);p.closePath();p.moveTo(.2,-.34);p.quadraticCurveTo(.58,-.72,.82,-.56);p.quadraticCurveTo(.76,-.3,.45,-.2);p.closePath();return p;})();
function drawLeg(g,p,hip,fx,fy,fa,T,far,lod){
  const G=p.G,o=p.o,A=[fx,fy-G.ank],[K]=ik(hip,A,G.L1,G.L2,-1),b=o.baggy?1.2:1,M=[lerp(K[0],A[0],.42)-.2,lerp(K[1],A[1],.42)],pa=far?T.pantsF:T.pants,sh=far?T.shoesF:T.shoes,n=lod>1?3:lod?2:1;
  g.save();g.translate(A[0],A[1]);g.rotate(fa);g.scale(G.foot,G.foot);if(far){g.fillStyle=sh.b;g.fill(FOOT);}else shadeP(g,FOOT,sh,lod,1/G.foot);if(lod){g.fillStyle=far?T.soleF:T.sole;g.fill(SOLE);}g.restore();
  const path=tubeP([hip,K,M,A],[G.thigh*b,G.knee*b*1.12,G.calf*b,G.ankle*(o.boots?1.6:b*1.25)],n);
  if(far){g.fillStyle=pa.b;g.fill(path);}else{shadeP(g,path,pa,lod);if(lod)inkP(g,path);}
  if(o.boots){const q=tubeP([[lerp(M[0],A[0],.3),lerp(M[1],A[1],.3)],A],[G.calf*1.04,G.ankle*1.7],1);if(far){g.fillStyle=sh.b;g.fill(q);}else{shadeP(g,q,sh,lod);if(lod)inkP(g,q);}}
  if(lod>1&&!far){g.strokeStyle=pa.d;g.lineWidth=.1;g.lineCap='round';g.beginPath();g.moveTo(K[0]+.42,K[1]-.3);g.quadraticCurveTo(K[0],K[1]+.1,K[0]-.5,K[1]+.2);g.moveTo(K[0]+.34,K[1]+.42);g.quadraticCurveTo(K[0],K[1]+.5,K[0]-.34,K[1]+.76);g.moveTo(lerp(hip[0],K[0],.3)+.3,lerp(hip[1],K[1],.3));g.lineTo(lerp(hip[0],K[0],.55)+.42,lerp(hip[1],K[1],.55));g.stroke();}
}
function drawArm(g,p,S,tx,ty,T,far,lod){
  const G=p.G,o=p.o,[E,Hd]=ik(S,[tx,ty],G.up,G.lo,1),chrome=o.chrome&&!far,bare=o.top==='vest',w=o.top==='puffer'?1.4:o.top==='trench'?1.2:1.12,c=chrome?T.metal:far?T.coatF:T.coat,n=lod>1?3:lod?2:1;
  const ang=Math.atan2(Hd[1]-E[1],Hd[0]-E[0]),hs=G.foot*.34;
  g.save();g.translate(Hd[0],Hd[1]);g.rotate(ang);g.scale(hs,hs);const hc=chrome?T.metal:far?T.skinF:T.skin;if(far){g.fillStyle=hc.b;g.fill(HAND);}else{shadeP(g,HAND,hc,lod,1/hs);if(lod)inkP(g,HAND,.1/hs);}g.restore();
  const low=bare&&!chrome?(far?T.skinF:T.skin):c,path=tubeP([S,E,Hd],[.54*w,.4*w,.27*w*(bare?.9:1)],n);
  if(far){g.fillStyle=low.b;g.fill(path);}else{shadeP(g,path,low,lod);if(lod)inkP(g,path);}
  if(bare&&!chrome){const q=tubeP([S,[lerp(S[0],E[0],.7),lerp(S[1],E[1],.7)]],[.6,.46],2);if(far){g.fillStyle=c.b;g.fill(q);}else{shadeP(g,q,c,lod);if(lod)inkP(g,q);}}
  if(lod>1&&!far){
    if(chrome){g.strokeStyle=T.metal.d;g.lineWidth=.07;g.beginPath();for(const k of[.3,.62]){g.moveTo(lerp(S[0],E[0],k)-.4,lerp(S[1],E[1],k));g.lineTo(lerp(S[0],E[0],k)+.4,lerp(S[1],E[1],k));g.moveTo(lerp(E[0],Hd[0],k)-.3,lerp(E[1],Hd[1],k));g.lineTo(lerp(E[0],Hd[0],k)+.3,lerp(E[1],Hd[1],k));}g.stroke();g.fillStyle=T.metal.d;g.beginPath();g.arc(E[0],E[1],.36,0,TAU);g.fill();g.fillStyle=o.led||'#2af0ff';g.beginPath();g.arc(E[0],E[1],.15,0,TAU);g.fill();}
    else{g.strokeStyle=c.d;g.lineWidth=.09;g.lineCap='round';g.beginPath();g.moveTo(E[0]-.3,E[1]-.34);g.quadraticCurveTo(E[0]+.1,E[1]-.06,E[0]+.42,E[1]-.26);g.moveTo(E[0]-.34,E[1]+.1);g.quadraticCurveTo(E[0],E[1]+.28,E[0]+.3,E[1]+.12);g.stroke();
      if(o.panel&&!bare){g.save();g.clip(path);const ax=E[0]-S[0],ay=E[1]-S[1],l=Math.hypot(ax,ay)||1,px=-ay/l*2,py=ax/l*2,m=(q,c)=>{g.fillStyle=c;g.beginPath();g.moveTo(S[0]+ax*q[0]+px,S[1]+ay*q[0]+py);g.lineTo(S[0]+ax*q[1]+px,S[1]+ay*q[1]+py);g.lineTo(S[0]+ax*q[1]-px,S[1]+ay*q[1]-py);g.lineTo(S[0]+ax*q[0]-px,S[1]+ay*q[0]-py);g.closePath();g.fill();};m([.42,.62],T.panel.b);m([.66,.71],T.panel.b);g.restore();}
      g.fillStyle=c.d;g.save();g.translate(lerp(E[0],Hd[0],.9),lerp(E[1],Hd[1],.9));g.rotate(ang);g.fillRect(-.09,-.33,.18,.66);g.restore();}}
  return Hd;
}
function drawTorso(g,p,H,C,J,T,lod){
  const G=p.G,o=p.o,b=G.b,top=o.top,long=top==='trench',puff=top==='puffer'?.34:0,fr=1.22*b+puff,bk=1.3*b+puff,sw=p.cs||0;
  const hemY=long?H[1]+G.L1*1.04:H[1]+(top==='bomber'?.1:top==='hoodie'?.75:.55);
  let hf=H[0]+fr*.96,hb=H[0]-bk*1.0;if(long){const a=Math.max(J[NF],J[FF])*.5,c=Math.min(J[NF],J[FF])*.5;hf=H[0]+Math.max(1.15,a+1)+sw*.5;hb=H[0]+Math.min(-1.35,c-1)+sw;}
  const p2=new Path2D(),cy=C[1];p2.moveTo(C[0]-.2,cy-.6);p2.quadraticCurveTo(C[0]-bk*1.06,cy-.25,C[0]-bk*1.02,cy+1.5);p2.quadraticCurveTo(lerp(C[0],H[0],.62)-bk*.9,lerp(cy,H[1],.62),H[0]-bk*.9,H[1]-.7);p2.lineTo(hb,hemY-(long?.2:0));
  p2.quadraticCurveTo((hb+hf)/2,hemY+.3,hf,hemY);p2.lineTo(H[0]+fr*.9,H[1]-.8);p2.quadraticCurveTo(lerp(C[0],H[0],.55)+fr*1.02,lerp(cy,H[1],.55),C[0]+fr,cy+1.8);p2.quadraticCurveTo(C[0]+fr*.92,cy+.25,C[0]+.5,cy-.55);p2.closePath();
  shadeP(g,p2,T.coat,lod);
  if(lod>1){g.save();g.clip(p2);
    if(o.panel){const yb=lerp(cy,H[1],.34);g.fillStyle=T.panel.b;if(top==='bomber'||top==='vest')g.fillRect(C[0]-bk-.5,yb,bk+fr+1,.62);else{g.beginPath();g.moveTo(C[0]+fr+.4,cy+.4);g.lineTo(C[0]+.2,cy+.4);g.lineTo(H[0]+fr*.2,H[1]+.2);g.lineTo(H[0]+fr+.4,H[1]+.2);g.closePath();g.globalAlpha=.75;g.fill();g.globalAlpha=1;}}
    if(top==='puffer'){g.strokeStyle=T.coat.d;g.lineWidth=.12;for(let y=cy+1;y<hemY;y+=1.05){g.beginPath();g.moveTo(C[0]-bk-1,y);g.quadraticCurveTo(C[0],y+.28,C[0]+fr+1,y);g.stroke();}}
    if(top==='bomber'||top==='hoodie'){g.fillStyle=T.coat.d;g.fillRect(hb-1,hemY-(top==='bomber'?.5:.34),hf-hb+2,.7);if(top==='bomber'){g.strokeStyle=T.coat.b;g.lineWidth=.05;for(let x=hb;x<hf;x+=.22){g.beginPath();g.moveTo(x,hemY-.5);g.lineTo(x,hemY+.2);g.stroke();}}}
    if(top==='hoodie'){g.strokeStyle=T.coat.d;g.lineWidth=.1;g.beginPath();g.moveTo(H[0]+fr*.92,H[1]-1.4);g.quadraticCurveTo(H[0],H[1]-1.2,H[0]-.4,H[1]+.2);g.stroke();}
    if(top==='trench'){g.fillStyle=T.coat.d;g.fillRect(hb-1,H[1]-1.05,hf-hb+2,.44);g.fillStyle=T.metal.b;g.fillRect(H[0]+.5,H[1]-1.08,.46,.5);g.strokeStyle=T.coat.d;g.lineWidth=.09;g.beginPath();g.moveTo(H[0]+.1,H[1]-.5);g.quadraticCurveTo(H[0]+.4+sw*.3,lerp(H[1],hemY,.5),H[0]+.3+sw*.6,hemY);g.moveTo(hb+.8,H[1]+.6);g.quadraticCurveTo(hb+.5+sw*.3,lerp(H[1],hemY,.6),hb+.5+sw*.5,hemY);g.stroke();}
    if(top==='vest'){g.strokeStyle=T.metal.d;g.lineWidth=.22;g.beginPath();g.moveTo(C[0]+.6,cy+.1);g.quadraticCurveTo(C[0]-.2,cy+2.4,H[0]-.8,H[1]-.5);g.stroke();g.fillStyle=T.metal.b;g.fillRect(H[0]+.1,lerp(cy,H[1],.62),fr*.66,.72);g.fillRect(H[0]+.1,lerp(cy,H[1],.8),fr*.66,.6);}
    g.strokeStyle=T.coat.d;g.lineWidth=.1;g.lineCap='round';g.beginPath();g.moveTo(C[0]+fr*.7,cy+2.4);g.quadraticCurveTo(C[0]-.2,lerp(cy,H[1],.45),C[0]-.8,lerp(cy,H[1],.5));g.moveTo(H[0]+fr*.5,H[1]-1.7);g.quadraticCurveTo(H[0]-.2,H[1]-1.2,H[0]-.9,H[1]-1.5);g.stroke();
    g.restore();}
  if(lod)inkP(g,p2);
  if(o.led&&lod){g.strokeStyle=o.led;g.lineWidth=.16;g.lineCap='round';g.beginPath();g.moveTo(C[0]+fr*.72,cy+1.3);g.quadraticCurveTo(lerp(C[0],H[0],.55)+fr*.74,lerp(cy,H[1],.55),H[0]+fr*.62,Math.min(hemY-.3,H[1]+2));g.stroke();}
  // The collar stands up round the neck.
  if(lod>1){if(top==='hoodie'&&!o.hood){const q=new Path2D();q.moveTo(C[0]-1.1,cy+.4);q.quadraticCurveTo(C[0]-1.5,cy-.9,C[0]-.3,cy-.82);q.quadraticCurveTo(C[0]+.3,cy-.7,C[0]+.2,cy+.2);q.closePath();shadeP(g,q,T.coat,lod);inkP(g,q);}
    else if(top!=='hoodie'&&top!=='vest'){const q=new Path2D();q.moveTo(C[0]-.5,cy-.1);q.lineTo(C[0]-.42,cy-.92);q.quadraticCurveTo(C[0]+.22,cy-.62,C[0]+.72,cy-.8);q.lineTo(C[0]+.8,cy+.3);q.closePath();shadeP(g,q,T.coat,lod);inkP(g,q);}}
}
/* Heads are drawn at one unit of head radius, facing +x in profile. */
const HEAD_S=(()=>{const p=new Path2D();p.moveTo(-.05,-1.15);p.bezierCurveTo(.4,-1.18,.74,-.92,.78,-.5);p.lineTo(.75,-.32);p.quadraticCurveTo(.8,-.18,.99,.08);p.quadraticCurveTo(1.03,.17,.8,.2);p.quadraticCurveTo(.87,.3,.84,.36);p.lineTo(.78,.41);p.quadraticCurveTo(.85,.47,.8,.55);p.quadraticCurveTo(.72,.6,.76,.7);p.quadraticCurveTo(.77,.94,.52,.98);p.quadraticCurveTo(.05,.96,-.22,.62);p.quadraticCurveTo(-.42,.46,-.62,.42);p.bezierCurveTo(-1.02,.2,-1,-1.1,-.05,-1.15);p.closePath();return p;})();
const HEAD_F=(()=>{const p=new Path2D();p.moveTo(-.76,-.28);p.bezierCurveTo(-.82,.3,-.56,.72,-.3,.9);p.quadraticCurveTo(-.1,1.06,0,1.06);p.quadraticCurveTo(.1,1.06,.3,.9);p.bezierCurveTo(.56,.72,.82,.3,.76,-.28);p.bezierCurveTo(.8,-1.24,-.8,-1.24,-.76,-.28);p.closePath();return p;})();
const pathOf=f=>{const p=new Path2D();f(p);p.closePath();return p;};
const HAIR_S={
  crop:pathOf(p=>{p.moveTo(.74,-.56);p.bezierCurveTo(.68,-1.34,-.54,-1.46,-1,-.5);p.quadraticCurveTo(-1.08,.04,-.72,.42);p.lineTo(-.4,.3);p.quadraticCurveTo(-.4,-.14,-.12,-.26);p.lineTo(.2,-.44);p.quadraticCurveTo(.46,-.42,.74,-.56);}),
  undercut:pathOf(p=>{p.moveTo(.82,-.6);p.bezierCurveTo(.92,-1.5,-.62,-1.66,-.96,-.74);p.lineTo(-.62,-.6);p.quadraticCurveTo(0,-.74,.3,-.56);p.quadraticCurveTo(.58,-.5,.82,-.6);}),
  bob:pathOf(p=>{p.moveTo(.72,-.6);p.bezierCurveTo(.72,-1.38,-.62,-1.46,-1.04,-.5);p.quadraticCurveTo(-1.22,.42,-.94,.98);p.lineTo(-.2,1.04);p.quadraticCurveTo(-.16,.42,-.06,-.1);p.lineTo(.3,-.42);p.quadraticCurveTo(.52,-.44,.72,-.6);}),
  spike:pathOf(p=>{for(const[i,q]of[[.74,-.6],[.92,-1.02],[.48,-1],[.5,-1.44],[.06,-1.24],[-.06,-1.66],[-.4,-1.3],[-.76,-1.44],[-.88,-1],[-1.24,-.84],[-1.02,-.44],[-1.1,0],[-.72,.38],[-.4,.28],[-.42,-.14],[-.1,-.26],[.22,-.42],[.46,-.42]].entries())if(i)p.lineTo(q[0],q[1]);else p.moveTo(q[0],q[1]);}),
  mohawk:pathOf(p=>{p.moveTo(.62,-.84);p.quadraticCurveTo(.3,-2,-.6,-1.84);p.quadraticCurveTo(-1.3,-1.4,-1.16,-.2);p.lineTo(-.8,-.5);p.quadraticCurveTo(-.5,-1.14,.1,-1.14);p.quadraticCurveTo(.4,-1.08,.62,-.84);})
};
HAIR_S.long=HAIR_S.bob;HAIR_S.pony=HAIR_S.crop;
function drawHairTail(g,p,hd,T,lod,r){
  const s=p.o.hs,h=p.hs||0,c=T.hair;
  if(s==='long'){const q=tubeP([[hd[0]-r*.72,hd[1]-r*.2],[hd[0]-r*1.02+h*.3,hd[1]+r*1.2],[hd[0]-r*.98+h*.8,hd[1]+r*2.7]],[r*.46,r*.5,r*.14],3);shadeP(g,q,c,lod);if(lod)inkP(g,q);}
  else if(s==='pony'){const q=tubeP([[hd[0]-r*.86,hd[1]-r*.3],[hd[0]-r*1.5+h*.4,hd[1]+r*.4],[hd[0]-r*1.56+h*1,hd[1]+r*1.6]],[r*.16,r*.26,r*.05],3);shadeP(g,q,c,lod);if(lod)inkP(g,q);}
}
function drawHeadSide(g,p,hd,tilt,T,lod){
  const G=p.G,o=p.o,r=G.hr,k=1/r;g.save();g.translate(hd[0],hd[1]);g.rotate(tilt);g.scale(r,r);
  if(o.hood){const q=new Path2D();q.moveTo(.62,-1);q.bezierCurveTo(.2,-1.6,-1.3,-1.5,-1.34,-.2);q.quadraticCurveTo(-1.36,.9,-.5,1.34);q.lineTo(.2,1.1);q.closePath();shadeP(g,q,T.coat,lod,k);if(lod)inkP(g,q,.09*k);}
  shadeP(g,HEAD_S,T.skin,lod,k);if(lod)inkP(g,HEAD_S,.08*k);
  if(lod>1){
    if(o.shades){g.fillStyle='#08080e';g.beginPath();g.moveTo(.2,-.28);g.lineTo(.82,-.3);g.lineTo(.76,-.02);g.lineTo(.3,.02);g.closePath();g.fill();g.fillStyle='#2af0ff';g.fillRect(.46,-.2,.2,.05);}
    else if(o.visor){g.fillStyle='#08080e';g.beginPath();g.moveTo(-.2,-.3);g.lineTo(.84,-.34);g.lineTo(.84,-.02);g.lineTo(-.14,.02);g.closePath();g.fill();g.fillStyle=o.visor;g.beginPath();g.moveTo(.1,-.2);g.lineTo(.78,-.24);g.lineTo(.78,-.12);g.lineTo(.14,-.08);g.closePath();g.fill();}
    else{const sh=p.blink?.05:1;g.fillStyle='#f4f0ea';g.beginPath();g.moveTo(.36,-.12);g.quadraticCurveTo(.56,-.26*sh-.06,.76,-.1);g.quadraticCurveTo(.56,.02,.36,-.12);g.fill();if(!p.blink){g.fillStyle='#16101c';g.beginPath();g.ellipse(.61,-.12,.09,.12,0,0,TAU);g.fill();}g.strokeStyle=INK;g.lineWidth=.07;g.lineCap='round';g.beginPath();g.moveTo(.3,-.1);g.quadraticCurveTo(.56,-.3,.78,-.1);g.stroke();g.lineWidth=.08;g.beginPath();g.moveTo(.26,-.38);g.quadraticCurveTo(.5,-.5,.78,-.36);g.stroke();}
    g.strokeStyle=T.skin.d;g.lineWidth=.05;g.beginPath();g.moveTo(.8,.41);g.lineTo(.5,.46);g.stroke();
    if(o.lines){g.strokeStyle=o.lines;g.lineWidth=.045;g.beginPath();g.moveTo(.1,.1);g.lineTo(.4,.3);g.lineTo(.4,.62);g.moveTo(.02,.18);g.lineTo(.22,.32);g.lineTo(.22,.72);g.stroke();}
    if(o.mask){g.fillStyle='#14141c';g.beginPath();g.moveTo(.1,.24);g.lineTo(1.02,.16);g.quadraticCurveTo(.98,.86,.5,1);g.quadraticCurveTo(.1,.9,.1,.24);g.fill();g.fillStyle=o.led||'#ff2a55';g.fillRect(.56,.5,.2,.07);}
  }else if(lod&&!o.visor&&!o.shades){g.fillStyle='#16101c';g.fillRect(.5,-.14,.18,.1);}
  else if(lod&&(o.visor||o.shades)){g.fillStyle=o.visor||'#08080e';g.fillRect(.14,-.2,.66,.14);}
  if(!o.hood){
    if(o.hs==='undercut'||o.hs==='mohawk'){const q=T.hair;g.save();g.clip(HEAD_S);g.fillStyle=q.d;g.globalAlpha=.5;g.fillRect(-1.2,-1.2,1.6,1.5);g.globalAlpha=1;g.restore();}
    if(!(o.hs==='bob'||o.hs==='long')&&lod>1){g.fillStyle=T.skin.b;g.beginPath();g.ellipse(-.14,.02,.14,.24,.1,0,TAU);g.fill();g.strokeStyle=T.skin.d;g.lineWidth=.05;g.stroke();}
    const hp=HAIR_S[o.hs]||HAIR_S.crop;shadeP(g,hp,T.hair,lod,k);if(lod)inkP(g,hp,.08*k);
    if(lod>1&&o.hs!=='mohawk'){g.strokeStyle=T.hair.d;g.lineWidth=.05;g.beginPath();g.moveTo(.3,-1);g.quadraticCurveTo(-.2,-.9,-.62,-.1);g.moveTo(-.1,-1.14);g.quadraticCurveTo(-.56,-.8,-.84,-.2);g.stroke();if(!o.hat){g.strokeStyle=T.hair.l;g.lineWidth=.09;g.lineCap='round';g.beginPath();g.moveTo(.4,-1.02);g.quadraticCurveTo(.1,-1.1,-.14,-1);g.moveTo(-.34,-.92);g.quadraticCurveTo(-.56,-.8,-.7,-.62);g.stroke();}}
    if(o.hat){const q=new Path2D();q.moveTo(.72,-.56);q.bezierCurveTo(.76,-1.44,-.8,-1.5,-1,-.42);q.quadraticCurveTo(0,-.72,.72,-.56);q.closePath();shadeP(g,q,T.hat,lod,k);if(lod)inkP(g,q,.08*k);if(o.hat==='cap'){const v=new Path2D();v.moveTo(.56,-.62);v.quadraticCurveTo(1.2,-.62,1.46,-.42);v.quadraticCurveTo(1,-.5,.56,-.44);v.closePath();g.fillStyle=T.hat.d;g.fill(v);}}
  }else if(lod){const q=new Path2D();q.moveTo(.72,-.72);q.quadraticCurveTo(.1,-1,-.3,-.5);q.quadraticCurveTo(-.5,.2,-.2,.9);q.lineTo(-1,.9);q.quadraticCurveTo(-1.3,-1.3,.2,-1.26);q.closePath();shadeP(g,q,T.coat,lod,k);}
  g.restore();
}
function figSide(g,p,J,T,lod){
  const G=p.G,o=p.o,H=[J[PHX],J[PHY]],C=[J[CXI],J[CY]],tw=J[TW],hipN=[H[0]+tw*-.32,H[1]],hipF=[H[0]+tw*.32,H[1]-.06],shN=[C[0]+tw,C[1]+.8],shF=[C[0]-tw*.8,C[1]+.7],hd=[C[0]+.34+J[HDX],C[1]-G.neck-G.hr*.72+J[HDY]],r=G.hr;
  drawArm(g,p,shF,J[FH],J[FH+1],T,true,lod);drawLeg(g,p,hipF,J[FF],J[FF+1],J[FF+2],T,true,lod);
  if(!o.hood)drawHairTail(g,p,hd,T,lod,r);
  if(o.bag==='backpack'){const bx=lerp(C[0],H[0],.3)-G.b*1.1-1.5,by=C[1]+.9+p.bs*.1;g.save();g.translate(bx+1,by+2.4);g.rotate((C[0]-H[0])*.1);const q=rrP(-1.1,-2.4,2.3,4.9,.8);shadeP(g,q,T.bag,lod);if(lod)inkP(g,q);if(lod>1){g.fillStyle=T.bag.d;g.fillRect(-1.1,-.1,2.3,.14);const f=rrP(-1.25,.1,1.1,1.8,.3);shadeP(g,f,T.bag,lod);inkP(g,f);}g.restore();}
  drawLeg(g,p,hipN,J[NF],J[NF+1],J[NF+2],T,false,lod);drawTorso(g,p,H,C,J,T,lod);
  if(o.bag==='sling'&&lod){g.strokeStyle=T.bag.d;g.lineWidth=.22;g.beginPath();g.moveTo(C[0]+.7,C[1]+.1);g.quadraticCurveTo(C[0]+.5,lerp(C[1],H[1],.5),H[0]-.9,H[1]-.2);g.stroke();const q=rrP(H[0]-2.2,H[1]-1.1+p.bs*.3,2.4,1.9,.4);shadeP(g,q,T.bag,lod);inkP(g,q);}
  const nk=tubeP([[C[0]+.1,C[1]+.1],[hd[0]-.1,hd[1]+r*.3]],[.5,.42],1);shadeP(g,nk,T.skin,lod);
  drawHeadSide(g,p,hd,J[TILT],T,lod);
  const hn=drawArm(g,p,shN,J[NH],J[NH+1],T,false,lod);
  if(p.phone){g.save();g.translate(hn[0]+.25,hn[1]-.2);g.rotate(-.3);g.fillStyle='#0c0c14';rrect(g,-.36,-.72,.72,1.44,.1);g.fill();g.fillStyle='#d8f0ff';rrect(g,-.28,-.62,.56,1.24,.07);g.fill();g.restore();}
  if(p.state==='smoke'){g.fillStyle='#e8e4dc';g.save();g.translate(hn[0]+.4,hn[1]-.1);g.rotate(-.2);g.fillRect(0,-.05,.62,.1);g.fillStyle='#ff8a3a';g.fillRect(.6,-.06,.1,.12);g.restore();}
  if(p.umb)drawUmbrella(g,p,hn,hd,T,lod);
}
function drawUmbrella(g,p,hn,hd,T,lod){
  const cx=hn[0]+.4,top=hd[1]-p.G.hr*3.2,w=6.4,tl=(p.hs||0)*.06;g.save();g.translate(cx,top);g.rotate(tl);seg(g,[0,top*0-(top-hn[1])],[0,-2.6],.14,'#14121c');
  const u=new Path2D();u.moveTo(-w,.3);u.bezierCurveTo(-w*.9,-2.8,w*.9,-2.8,w,.3);for(let i=4;i>0;i--){const a=-w+(5-i)*0,b=w-(4-i+1)*w*.5;u.quadraticCurveTo(b+w*.25,-.34,b,.3);}u.closePath();
  shadeP(g,u,T.umb,lod);if(lod)inkP(g,u);if(lod>1){g.strokeStyle=T.umb.d;g.lineWidth=.08;g.beginPath();for(const i of[-.5,0,.5]){g.moveTo(0,-2.4);g.quadraticCurveTo(i*w*.9,-1.6,i*w*1.1,.1);}g.stroke();}
  g.restore();
}
// From the front or the back: the same stride seen end on, the hips rolling over each foot in turn.
function figFacing(g,p,J,T,toward,lod){
  const G=p.G,o=p.o,amp=p.amp||0,s=p.ph,sw=Math.sin(TAU*(s-.04))*amp,idle=(1-amp)*J[PHX],hy=J[PHY],hW=G.hipW*.92,lat=sw*.3+idle*1.1,tilt=(-sw*.09-idle*.1),hipT=-tilt*.7,cy=J[CY],sW=G.shW*(o.top==='puffer'?1:.86),n=lod>1?3:lod?2:1,f=[0,0,0],cl=lat*.55+idle*.2,long=o.top==='trench',puff=o.top==='puffer'?.32:0;
  const leg=i=>{const u=i?s+.5:s,sd=i?1:-1,hip=[lat+sd*hW,hy+sd*hipT];stepFoot(u,1,1.2,.62,f,0);const fwd=f[0]*amp,li=-f[1]*amp,base=sd*(hW*.86+(1-amp)*.32),ax=base+lat*.14,ay=(toward?fwd:-fwd)*.42-li-G.ank,kn=[lerp(hip[0],ax,.5)+sd*.12,lerp(hip[1],ay,.52)-li*.26],b=o.baggy?1.2:1,fs=G.foot*(1+(toward?fwd:-fwd)*.08);
    g.save();g.translate(ax,ay+G.ank*.62);if(toward){const fp=new Path2D();fp.moveTo(-.46,-.5);fp.quadraticCurveTo(-.62+sd*.12,.2,-.3+sd*.14,.34);fp.lineTo(.3+sd*.14,.34);fp.quadraticCurveTo(.62+sd*.12,.2,.46,-.5);fp.closePath();shadeP(g,fp,T.shoes,lod);if(lod)inkP(g,fp);if(lod>1){g.fillStyle=T.sole;g.fillRect(-.4+sd*.14,.24,.8,.11);}}else{const fp=rrP(-.42,-.56,.84,.92,.3);shadeP(g,fp,T.shoes,lod);if(lod)inkP(g,fp);if(lod>1){g.fillStyle=T.sole;g.fillRect(-.42,.2,.84,.15);}}g.restore();
    const q=tubeP([hip,kn,[ax,ay]],[G.thigh*b*.9,G.knee*b*1.12,G.ankle*(o.boots?1.8:b*1.35)],n);shadeP(g,q,T.pants,lod);if(lod)inkP(g,q);
    if(o.boots){const m=[lerp(kn[0],ax,.42),lerp(kn[1],ay,.42)],b2=tubeP([m,[ax,ay]],[G.calf*.98,G.ankle*1.9],1);shadeP(g,b2,T.shoes,lod);if(lod)inkP(g,b2);}
    if(lod>1){g.strokeStyle=T.pants.d;g.lineWidth=.09;g.lineCap='round';g.beginPath();g.moveTo(kn[0]-.4,kn[1]-.1);g.quadraticCurveTo(kn[0],kn[1]+.24,kn[0]+.4,kn[1]-.14);g.moveTo(lerp(hip[0],kn[0],.2)-sd*.5,lerp(hip[1],kn[1],.2));g.lineTo(lerp(hip[0],kn[0],.5)-sd*.3,lerp(hip[1],kn[1],.5));g.stroke();}};
  const order=Math.sin(TAU*s)>0?[0,1]:[1,0];leg(order[0]);leg(order[1]);
  const hem=long?hy+G.L1*1+.1*Math.sin(TAU*s)*amp:hy+.7,wy=lerp(cy,hy,.72),wx=lerp(cl,lat,.72),wW=G.hipW*1.08+puff,bust=sW*.98+puff*.8,hemW=long?G.hipW*1.9+.5:G.hipW*1.36+puff*.6,tp=new Path2D(),ty=tilt*sW;
  tp.moveTo(cl-sW+.55,cy+ty-.02);tp.quadraticCurveTo(cl-sW-.05,cy+ty+.14,cl-bust,cy+1.9);tp.quadraticCurveTo(cl-bust*.96,lerp(cy,wy,.7),wx-wW,wy);tp.quadraticCurveTo(lerp(wx,lat,.5)-wW*1.04,lerp(wy,hem,.5),lat-hemW,hem);tp.quadraticCurveTo(lat,hem+.3,lat+hemW,hem);tp.quadraticCurveTo(lerp(wx,lat,.5)+wW*1.04,lerp(wy,hem,.5),wx+wW,wy);tp.quadraticCurveTo(cl+bust*.96,lerp(cy,wy,.7),cl+bust,cy+1.9);tp.quadraticCurveTo(cl+sW+.05,cy-ty+.14,cl+sW-.55,cy-ty-.02);tp.quadraticCurveTo(cl,cy-.56,cl-sW+.55,cy+ty-.02);tp.closePath();
  if(!toward&&!o.hood&&o.hs==='long')drawHairBack(g,p,[cl,cy-G.neck-G.hr*.6],T,lod);
  shadeP(g,tp,T.coat,lod);
  if(lod>1){g.save();g.clip(tp);
    if(o.panel){g.fillStyle=T.panel.b;if(toward){g.beginPath();g.moveTo(cl-.46,cy);g.lineTo(cl+.46,cy);g.lineTo(lat+.34,hem);g.lineTo(lat-.34,hem);g.closePath();g.fill();}else{g.fillRect(cl-sW-1,lerp(cy,hy,.26),2*sW+2,.62);g.fillRect(cl-sW-1,lerp(cy,hy,.26)+.84,2*sW+2,.14);}}
    if(o.top==='puffer'){g.strokeStyle=T.coat.d;g.lineWidth=.12;for(let y=cy+1;y<hem;y+=1.05){g.beginPath();g.moveTo(cl-sW-1,y);g.quadraticCurveTo(cl,y+.28,cl+sW+1,y);g.stroke();}}
    if(o.top==='vest'&&toward){g.fillStyle=T.metal.b;g.fillRect(cl-1.1,lerp(cy,hy,.56),.86,.74);g.fillRect(cl+.24,lerp(cy,hy,.56),.86,.74);g.fillRect(cl-1.1,lerp(cy,hy,.72),.86,.6);g.fillRect(cl+.24,lerp(cy,hy,.72),.86,.6);}
    if(o.top==='bomber'||o.top==='hoodie'){g.fillStyle=T.coat.d;g.fillRect(lat-hemW-1,hem-.56,2*hemW+2,.8);}
    if(long){g.fillStyle=T.coat.d;g.fillRect(wx-wW-1,wy-.2,2*wW+2,.44);g.strokeStyle=T.coat.d;g.lineWidth=.1;g.beginPath();g.moveTo(wx-.8,wy+.3);g.quadraticCurveTo(lat-1,lerp(wy,hem,.6),lat-1.3,hem);g.moveTo(wx+.8,wy+.3);g.quadraticCurveTo(lat+1,lerp(wy,hem,.6),lat+1.3,hem);g.stroke();}
    g.strokeStyle=T.coat.d;g.lineWidth=.1;g.lineCap='round';g.beginPath();if(toward){g.moveTo(cl,cy+.2);g.lineTo(lat,hem);}else{g.moveTo(cl,cy+.3);g.quadraticCurveTo(cl+.1,lerp(cy,wy,.5),wx,wy);}g.moveTo(cl-bust*.72,cy+2.2);g.quadraticCurveTo(cl-bust*.34,lerp(cy,wy,.66),wx-wW*.6,wy);g.moveTo(cl+bust*.72,cy+2.2);g.quadraticCurveTo(cl+bust*.34,lerp(cy,wy,.66),wx+wW*.6,wy);g.stroke();g.restore();}
  if(lod)inkP(g,tp);
  if(o.led&&lod&&toward){g.strokeStyle=o.led;g.lineWidth=.14;g.beginPath();g.moveTo(cl-.62,cy+.7);g.lineTo(lat-.5,hem-.3);g.stroke();}
  if(!toward&&o.bag==='backpack'){const q=rrP(cl-sW*.66,cy+.9+p.bs*.08,sW*1.32,5.1,.9);shadeP(g,q,T.bag,lod);if(lod)inkP(g,q);if(lod>1){g.fillStyle=T.bag.d;g.fillRect(cl-sW*.66,cy+3.2,sW*1.32,.14);const fp=rrP(cl-sW*.42,cy+3.5,sW*.84,1.9,.3);shadeP(g,fp,T.bag,lod);inkP(g,fp);for(const sd of[-1,1]){g.strokeStyle=T.bag.b;g.lineWidth=.26;g.beginPath();g.moveTo(cl+sd*sW*.5,cy+.1);g.lineTo(cl+sd*sW*.6,cy+1);g.stroke();}}}
  if(toward&&o.bag==='backpack'&&lod)for(const sd of[-1,1]){g.strokeStyle=T.bag.b;g.lineWidth=.3;g.beginPath();g.moveTo(cl+sd*(sW-.95),cy+.06);g.quadraticCurveTo(cl+sd*(sW-.55),cy+2,cl+sd*(sW-.3),cy+3.7);g.stroke();}
  // Arms hang loosely, a little bent, and swing with the walk.
  for(const sd of[-1,1]){const swing=Math.sin(TAU*s+(sd>0?Math.PI:0))*amp,fw=toward?swing:-swing,S_=[cl+sd*(sW-.34),cy+.82+sd*ty*.5],Ex=[S_[0]+sd*.42,S_[1]+G.up*(1-Math.abs(swing)*.07)],held=p.phone&&sd>0&&toward,Hx=[held?cl+.7:Ex[0]-sd*.26,held?cy+3.2:Ex[1]+G.lo*(1-Math.max(0,fw)*.28)],chrome=o.chrome&&sd>0,c=chrome?T.metal:T.coat,w=o.top==='puffer'?1.36:o.top==='trench'?1.16:1.06;
    const hp=new Path2D();hp.moveTo(Hx[0]-.3,Hx[1]-.1);hp.quadraticCurveTo(Hx[0]-.42,Hx[1]+.5,Hx[0]-.14,Hx[1]+.74);hp.quadraticCurveTo(Hx[0]+.16,Hx[1]+.86,Hx[0]+.3,Hx[1]+.5);hp.lineTo(Hx[0]+.3,Hx[1]-.1);hp.closePath();shadeP(g,hp,chrome?T.metal:T.skin,lod);if(lod)inkP(g,hp);
    const q=tubeP([S_,Ex,Hx],[.56*w,.42*w,.29*w],n);shadeP(g,q,c,lod);if(lod)inkP(g,q);
    if(lod>1){if(o.panel&&!chrome&&o.top!=='vest'){g.save();g.clip(q);g.fillStyle=T.panel.b;g.fillRect(Math.min(S_[0],Ex[0])-1,lerp(S_[1],Ex[1],.45),3,.7);g.restore();}g.strokeStyle=c.d;g.lineWidth=.09;g.lineCap='round';g.beginPath();g.moveTo(Ex[0]-.36,Ex[1]-.1);g.quadraticCurveTo(Ex[0],Ex[1]+.14,Ex[0]+.36,Ex[1]-.12);g.stroke();if(chrome){g.fillStyle=T.metal.d;g.beginPath();g.arc(Ex[0],Ex[1],.34,0,TAU);g.fill();g.fillStyle=o.led||'#2af0ff';g.beginPath();g.arc(Ex[0],Ex[1],.14,0,TAU);g.fill();}}
    if(held){g.fillStyle='#0c0c14';rrect(g,Hx[0]-.42,Hx[1]-1.1,.84,1.4,.1);g.fill();}}
  const hd=[cl+J[HDX]*.15,cy-G.neck-G.hr*.5+J[HDY]],nk=tubeP([[cl,cy+.1],[hd[0],hd[1]+G.hr*.5]],[.56,.48],1);shadeP(g,nk,T.skin,lod);
  // The collar closes round the neck.
  if(lod>1&&o.top!=='vest'){const c=new Path2D();c.moveTo(cl-.92,cy+.06);c.quadraticCurveTo(cl-.74,cy-.72,cl-.42,cy-.8);c.quadraticCurveTo(cl,toward?cy-.12:cy-.62,cl+.42,cy-.8);c.quadraticCurveTo(cl+.74,cy-.72,cl+.92,cy+.06);c.quadraticCurveTo(cl,toward?cy+.74:cy+.3,cl-.92,cy+.06);c.closePath();shadeP(g,c,T.coat,lod);inkP(g,c);}
  if(toward)drawHeadFront(g,p,hd,T,lod);else drawHeadBack(g,p,hd,T,lod);
  if(p.umb){const top=hd[1]-G.hr*3;seg(g,[hd[0]+1.4,hd[1]+3],[hd[0]+1.4,top],.14,'#14121c');const u=ellP(hd[0]+.8,top,6.2,1.9);shadeP(g,u,T.umb,lod);if(lod)inkP(g,u);}
}
function drawHairBack(g,p,hd,T,lod){const r=p.G.hr,h=p.hs||0,q=new Path2D();q.moveTo(hd[0]-r*1,hd[1]);q.quadraticCurveTo(hd[0]-r*1.1+h*.2,hd[1]+r*1.8,hd[0]-r*.76+h*.5,hd[1]+r*3);q.lineTo(hd[0]+r*.76+h*.5,hd[1]+r*3);q.quadraticCurveTo(hd[0]+r*1.1+h*.2,hd[1]+r*1.8,hd[0]+r,hd[1]);q.closePath();shadeP(g,q,T.hair,lod);if(lod)inkP(g,q);}
const FRINGE={crop:[[.62,-.34],[.46,-.14],[.2,-.5],[.04,-.24],[-.26,-.54],[-.42,-.22],[-.64,-.42],[-.86,.12]],undercut:[[.7,-.5],[.3,-.62],[.1,-.34],[-.3,-.6],[-.5,-.4],[-.86,-.3]],bob:[[.78,.5],[.56,-.34],[.3,-.5],[.1,-.3],[-.16,-.52],[-.4,-.36],[-.6,-.34],[-.8,.5],[-.86,.12]],long:[[.74,.7],[.6,-.1],[.22,-.62],[.02,-.74],[-.2,-.6],[-.6,-.1],[-.74,.7],[-.86,.12]],pony:[[.66,-.42],[.3,-.72],[.02,-.78],[-.3,-.72],[-.66,-.42],[-.86,.12]],spike:[[.72,-.44],[.46,-.2],[.28,-.56],[0,-.28],[-.24,-.6],[-.46,-.24],[-.7,-.46],[-.86,.12]]};
function drawHeadFront(g,p,hd,T,lod){
  const G=p.G,o=p.o,r=G.hr,k=1/r,l=p.head||0;g.save();g.translate(hd[0],hd[1]);g.scale(r,r);
  if(o.hood){const q=ellP(0,.04,1.34,1.36);shadeP(g,q,T.coat,lod,k);if(lod)inkP(g,q,.09*k);}else if(o.hs==='long'||o.hs==='bob'){const q=new Path2D();q.moveTo(-1,-.3);q.quadraticCurveTo(-1.3,.9,-1.02,o.hs==='long'?2:1.1);q.lineTo(1.02,o.hs==='long'?2:1.1);q.quadraticCurveTo(1.3,.9,1,-.3);q.closePath();shadeP(g,q,T.hair,lod,k);}
  g.translate(l*.16,0);shadeP(g,HEAD_F,T.skin,lod,k);if(lod)inkP(g,HEAD_F,.08*k);
  if(lod>1){
    if(o.shades){g.fillStyle='#08080e';rrect(g,-.76,-.22,1.52,.36,.12);g.fill();g.fillStyle='#2af0ff';g.fillRect(.16,-.14,.34,.06);}
    else if(o.visor){g.fillStyle='#08080e';rrect(g,-.82,-.26,1.64,.42,.12);g.fill();g.fillStyle=o.visor;rrect(g,-.7,-.16,1.4,.18,.08);g.fill();}
    else{for(const s of[-1,1]){const ex=s*.36;if(p.blink){g.strokeStyle=INK;g.lineWidth=.07;g.beginPath();g.moveTo(ex-.2,-.02);g.lineTo(ex+.2,0);g.stroke();}else{g.fillStyle='#f4f0ea';g.beginPath();g.moveTo(ex-s*.2+0,-.04);g.quadraticCurveTo(ex,-.17,ex+s*.22,-.08);g.quadraticCurveTo(ex,.1,ex-s*.2,-.04);g.fill();g.fillStyle='#16101c';g.beginPath();g.arc(ex+l*.05,-.05,.085,0,TAU);g.fill();g.strokeStyle=INK;g.lineWidth=.06;g.beginPath();g.moveTo(ex-s*.24,-.02);g.quadraticCurveTo(ex,-.2,ex+s*.26,-.1);g.stroke();}g.strokeStyle=INK;g.lineWidth=.075;g.beginPath();g.moveTo(ex-s*.24,-.34);g.quadraticCurveTo(ex,-.42,ex+s*.28,-.3);g.stroke();}}
    g.strokeStyle=T.skin.d;g.lineWidth=.05;g.beginPath();g.moveTo(.04,.14);g.lineTo(.09,.38);g.lineTo(-.04,.4);g.stroke();
    if(o.mask){g.fillStyle='#14141c';g.beginPath();g.moveTo(-.66,.3);g.quadraticCurveTo(0,.14,.66,.3);g.quadraticCurveTo(.44,1,0,1.04);g.quadraticCurveTo(-.44,1,-.66,.3);g.fill();g.fillStyle=o.led||'#ff2a55';g.fillRect(-.3,.6,.18,.07);g.fillRect(.12,.6,.18,.07);}
    else{g.strokeStyle=T.skin.d;g.lineWidth=.06;g.beginPath();g.moveTo(-.16,.66);g.quadraticCurveTo(0,.7,.16,.66);g.stroke();}
    if(o.lines){g.strokeStyle=o.lines;g.lineWidth=.045;g.beginPath();g.moveTo(-.66,.2);g.lineTo(-.42,.36);g.lineTo(-.42,.7);g.stroke();}
  }else if(lod){g.fillStyle=o.visor||'#16101c';if(o.visor||o.shades)g.fillRect(-.7,-.16,1.4,.2);else{g.fillRect(-.46,-.1,.2,.1);g.fillRect(.26,-.1,.2,.1);}}
  if(o.hood){g.fillStyle=rgbS(10,8,16);g.globalAlpha=.3;g.beginPath();g.ellipse(0,-.76,.86,.42,0,0,TAU);g.fill();g.globalAlpha=1;}
  else{const q=new Path2D();q.moveTo(-.86,.12);q.bezierCurveTo(-1.1,-1.46,1.1,-1.46,.86,.12);const fr=FRINGE[o.hs]||FRINGE.crop;if(o.hs==='mohawk'){q.lineTo(.3,-.72);q.lineTo(-.3,-.72);}else{let a=.86;for(let i=0;i<fr.length;i++){const f=fr[i];q.quadraticCurveTo((a+f[0])/2+.05,f[1]-.3,f[0],f[1]);a=f[0];}}q.closePath();
    if(o.hs==='mohawk'){const m=new Path2D();m.moveTo(-.3,-.9);m.quadraticCurveTo(0,-2.1,.3,-.9);m.closePath();shadeP(g,m,T.hair,lod,k);if(lod)inkP(g,m,.08*k);g.globalAlpha=.4;}
    shadeP(g,q,T.hair,lod,k);g.globalAlpha=1;if(lod)inkP(g,q,.08*k);
    if(lod>1&&!o.hat&&o.hs!=='mohawk'){g.strokeStyle=T.hair.l;g.lineWidth=.1;g.lineCap='round';g.beginPath();g.arc(0,-.2,.74,-2.5,-2.05);g.moveTo(.1,-.96);g.arc(0,-.2,.76,-1.45,-1.05);g.stroke();g.strokeStyle=T.hair.d;g.lineWidth=.05;g.beginPath();for(const a of[-.42,0,.4]){g.moveTo(a*.5,-1);g.quadraticCurveTo(a,-.7,a*1.3,-.44);}g.stroke();}
    if(o.hat){const h=new Path2D();h.moveTo(-.98,-.3);h.bezierCurveTo(-1.08,-1.4,1.08,-1.4,.98,-.3);h.quadraticCurveTo(0,-.56,-.98,-.3);h.closePath();shadeP(g,h,T.hat,lod,k);if(lod)inkP(g,h,.08*k);}}
  g.restore();
}
function drawHeadBack(g,p,hd,T,lod){
  const G=p.G,o=p.o,r=G.hr,k=1/r,l=p.head||0;g.save();g.translate(hd[0]+l*r*.1,hd[1]);g.scale(r,r);
  if(o.hood){const q=new Path2D();q.moveTo(-1.16,1.1);q.bezierCurveTo(-1.6,-.8,-.5,-1.5,0,-1.46);q.bezierCurveTo(.5,-1.5,1.6,-.8,1.16,1.1);q.quadraticCurveTo(0,1.7,-1.16,1.1);q.closePath();shadeP(g,q,T.coat,lod,k);if(lod)inkP(g,q,.09*k);if(lod>1){g.strokeStyle=T.coat.d;g.lineWidth=.07;g.beginPath();g.moveTo(0,-1.42);g.quadraticCurveTo(-.08,0,0,1.1);g.moveTo(-.9,.7);g.quadraticCurveTo(-.2,1.1,.5,.9);g.stroke();}g.restore();return;}
  for(const s of[-1,1]){const e=ellP(s*.86,.08,.14,.24);shadeP(g,e,T.skin,lod,k);}
  const q=new Path2D(),len=o.hs==='bob'?1.2:o.hs==='long'?1.2:o.hs==='pony'?.9:.72;q.moveTo(-.86,.5);q.bezierCurveTo(-1.26,-1.46,1.26,-1.46,.86,.5);q.quadraticCurveTo(.6,len+.2,0,len+.24);q.quadraticCurveTo(-.6,len+.2,-.86,.5);q.closePath();
  if(o.hs==='undercut'||o.hs==='mohawk'){const sk=ellP(0,.0,.86,1.06);shadeP(g,sk,T.skin,lod,k);g.globalAlpha=.55;g.fillStyle=T.hair.d;g.fill(sk);g.globalAlpha=1;if(o.hs==='mohawk'){const m=tubeP([[0,-2],[0,-1],[0,.6]],[.02,.3,.2],2);shadeP(g,m,T.hair,lod,k);if(lod)inkP(g,m,.08*k);}else{const tp=new Path2D();tp.moveTo(-.9,-.3);tp.bezierCurveTo(-1,-1.5,1,-1.5,.9,-.3);tp.closePath();shadeP(g,tp,T.hair,lod,k);if(lod)inkP(g,tp,.08*k);}}
  else{shadeP(g,q,T.hair,lod,k);if(lod)inkP(g,q,.08*k);if(lod>1){g.strokeStyle=T.hair.d;g.lineWidth=.05;g.beginPath();g.moveTo(-.46,-.9);g.quadraticCurveTo(-.6,.1,-.42,len);g.moveTo(.1,-1.06);g.quadraticCurveTo(.06,.2,.1,len+.1);g.moveTo(.56,-.86);g.quadraticCurveTo(.66,.1,.46,len);g.stroke();}}
  if(o.hs==='pony'){const h=(p.hs||0)/r,t2=tubeP([[0,.3],[h*.5,1.2],[h*1.2,2.4]],[.18,.28,.06],3);shadeP(g,t2,T.hair,lod,k);if(lod)inkP(g,t2,.08*k);}
  if(o.hat){const h=new Path2D();h.moveTo(-1,-.1);h.bezierCurveTo(-1.2,-1.5,1.2,-1.5,1,-.1);h.quadraticCurveTo(0,.14,-1,-.1);h.closePath();shadeP(g,h,T.hat,lod,k);if(lod)inkP(g,h,.08*k);}
  g.restore();
}
// Everything a body wears, in the light where it stands. Far limbs take the shadow tone.
function figTones(p,L){const o=p.o,T={coat:tones(o.coat,L),pants:tones(o.pants,L),skin:tones(o.skin,L),hair:tones(o.hair,L),shoes:tones(o.shoes,L),metal:tones('#b6bfd0',L),panel:tones(o.panel||o.coat,L),bag:tones(o.bagC,L),hat:tones(o.hatC,L),umb:tones(p.umb||'#22222c',L)};const dk=q=>({l:q.d,b:q.d,d:q.d});T.coatF=dk(T.coat);T.pantsF=dk(T.pants);T.skinF=dk(T.skin);T.shoesF=dk(T.shoes);T.sole=rgbS(10,8,14);T.soleF=rgbS(6,5,10);return T;}
// Moves a body along: phase, the blend between standing and walking, the swing of hair and coats, and blinking.
const POSE_T=new Float32Array(PN),POSE_W=new Float32Array(PN);
function moveBody(p,dt){
  const walking=p.state==='walk';if(!p.J){p.J=new Float32Array(PN);p.B=new Float32Array(PN);p.seed=p.id*7.13;p.amp=walking?1:0;p.v=walking?p.sp:0;poseStand(p,p.B);p.shown=null;p.turn=0;p.hs=0;p.hv=0;p.cs=0;p.cv=0;p.bs=0;p.tb2=expo(3);}
  p.amp+=((walking?1:0)-p.amp)*Math.min(1,dt*8);
  if(walking)p.ph=(p.ph+dt*Math.max(.3,p.v)/(2*stepLen(Math.max(.5,p.v))*UNIT))%1;
  // What the body is doing, eased so nothing snaps into place.
  if(p.fg)poseFight(p,POSE_T);else poseAct(p,POSE_T);
  const r=Math.min(1,dt*(p.fg?20:7)),B=p.B;for(let i=0;i<PN;i++)B[i]+=(POSE_T[i]-B[i])*r;
  if(p.amp>.004){poseWalk(p,POSE_W);const a=p.amp,J=p.J;for(let i=0;i<PN;i++)J[i]=B[i]+(POSE_W[i]-B[i])*a;}else p.J.set(B);
  // Hair and coats trail the body on springs.
  const push=-p.dir*p.v*.6,bob=Math.sin(TAU*p.ph*2)*p.amp*.4;p.hv+=((push+bob-p.hs)*26-p.hv*5.2)*dt;p.hs+=p.hv*dt;p.cv+=((-p.v*.42+bob*.6-p.cs)*14-p.cv*3.6)*dt;p.cs+=p.cv*dt;p.bs=Math.sin(TAU*p.ph*2)*p.amp;
  p.tb2-=dt;if(p.tb2<=0){p.blink=!p.blink;p.tb2=p.blink?.11:expo(3.4);}
  // Turning round: the figure narrows, swaps view and widens again, instead of flipping in one frame.
  const key=p.view==='side'?(p.dir>0?'r':'l'):p.view;if(p.shown===null){p.shown=key;p.sv=p.view;p.sd=p.dir;}
  if(key!==p.shown&&!p.turn)p.turn=1e-3;if(p.turn){const was=p.turn;p.turn+=dt/.32;if(was<.5&&p.turn>=.5){p.shown=key;p.sv=p.view;p.sd=p.dir;}if(p.turn>=1)p.turn=0;}
}
function drawBody(g,p,x,y,U,J,sy=1){
  const lod=sy<0?1:U>11?2:U>3.4?1:0,L=p.L,tk=1-.44*Math.sin(Math.PI*(p.turn||0)),s=p.sd||p.dir,q=p.fg;INKED=lod>1;
  g.setTransform(U*s*tk,0,0,U*sy,x,y);SHX=L.lx*s;SHY=L.ly;
  if(q&&q.dn){g.translate(-1.2*q.dn,-.8*q.dn);g.rotate(-1.54*q.dn);}
  if(p.sv==='side')figSide(g,p,J||p.J,p.T,lod);else figFacing(g,p,J||p.J,p.T,p.sv==='front',lod);
  g.setTransform(1,0,0,1,0,0);
}

/* ---------- light on things that move ---------- */
// The light at a spot on the ground: cool and pale under the shelter, the colours of the shops further out.
function lightAt(x,z){
  const n=neonAt(x),l=neonAt(x-3.2),r=neonAt(x+3.2),pool=Math.exp(-(x*x)/(2*2.6*2.6))*sstep(6.5,3,z),far=sstep(4,11,z),h=hex(MOOD.amb),m=Math.max(h[0],h[1],h[2]),lift=lerp(.66,.86,pool);
  const dl=(r[0]+r[1]+r[2]-l[0]-l[1]-l[2])/360,lx=-clamp(dl,-.3,.3),side=Math.abs(lx)<.12?(lx<0?-.12:.12):lx;
  return{a:h.map(v=>lift*(v/m*.75+.25)),c:n.map(v=>v/255),k:lerp(.5,.72,far),s:[8,6,16],lx:side,ly:.15,x};
}
function shadowOn(x,y,rx,ry,a){ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);ctx.fillStyle=SHAD;ctx.globalAlpha=a;ctx.fillRect(-1,-1,2,2);ctx.restore();}
let SHAD=null;

/* ---------- cats and dogs ---------- */
// Cats and dogs share one four-legged skeleton, drawn in hundredths of the animal's height.
const CATC=[['black','#26242c','#3a3640','#e8c84a'],['ginger','#e0883a','#f6dcb8','#b8d060'],['grey','#8a8a96','#dcdce2','#d8c060'],['white','#ece6dc','#ffffff','#7ac8e8'],['brown tabby','#7a5a3c','#dcc8a8','#c8d060'],['tuxedo','#24222a','#f4f0ea','#d8d860']];
const CATB={name:'cat',cat:true,h:[.25,.3],leg:48,bl:44,bh:13.5,hr:14.5,sn:3,ear:'cat',tail:'cat',stride:30,tl:92,tw:4.2};
// Dog breeds by build: height to the top of the head in metres, and in hundredths of that height the leg, half the body's
// length and depth, the head and the snout. Their ears, tail, stride and colours, and how often they turn up.
const BREEDS=[
  {name:'terrier',h:[.3,.38],leg:42,bl:32,bh:15,hr:14,sn:9,ear:'up',tail:'up',stride:30,tl:24,tw:6,cols:[['#e8dcc0','#8a6a4a'],['#2a2228','#8a6a4a']],w:1.6},
  {name:'corgi',h:[.27,.32],leg:24,bl:46,bh:18,hr:16,sn:10,ear:'up',tail:'stub',stride:24,tl:12,tw:7,cols:[['#d8863a','#f4ece0']],socks:true,w:1.2},
  {name:'labrador',h:[.55,.62],leg:46,bl:40,bh:17,hr:14,sn:12,ear:'flop',tail:'wag',stride:26,tl:44,tw:6,cols:[['#e8c48a','#e8c48a'],['#1e1a1c','#1e1a1c'],['#6a3e22','#6a3e22']],w:2},
  {name:'shepherd',h:[.58,.66],leg:46,bl:42,bh:17,hr:14,sn:13,ear:'up',tail:'low',stride:26,tl:46,tw:8,cols:[['#a8743a','#2a1e18']],saddle:true,w:1.4},
  {name:'husky',h:[.52,.6],leg:45,bl:40,bh:17,hr:14,sn:11,ear:'up',tail:'curl',stride:26,tl:40,tw:10,cols:[['#8a8e96','#ece8e0'],['#2a2a30','#ece8e0']],socks:true,w:1.4},
  {name:'stray',h:[.42,.52],leg:45,bl:37,bh:14,hr:13,sn:12,ear:'flop',tail:'low',stride:26,tl:40,tw:5,cols:[['#8a7458','#c8b89a'],['#5a4a3a','#8a7a64']],w:2}
];
// Footfalls: when each foot starts its stride. A walk puts them down one after another, a trot moves diagonal pairs.
const GAITS={walk:{f:.66,o:[.5,.75,0,.25]},trot:{f:.52,o:[0,.5,.5,0]}};
const TAILS={cat:[-2.5,-2.2,-1.9,-1.7,-1.5,-1.4,-1.3,-1.2],up:[-2,-1.9,-1.8,-1.7,-1.6,-1.5,-1.5,-1.4],wag:[-2.8,-2.8,-2.75,-2.7,-2.6,-2.5,-2.4,-2.3],low:[2.7,2.6,2.5,2.4,2.3,2.25,2.2,2.15],curl:[-1.9,-1.5,-1,-.5,0,.5,1,1.5],stub:[-2.4,-2.4,-2.3,-2.3,-2.2,-2.2,-2.1,-2.1]};
function makeDog(spd){const B=wpick(BREEDS.map(b=>[b,b.w])),c=pick(B.cols);return{B,G:spd>1.5?GAITS.trot:GAITS.walk,hm:rr(B.h[0],B.h[1]),col:c[0],col2:c[1],seed:rr(0,9),ph:R()};}
// Heads are drawn at one unit of head radius, facing +x.
const QHEAD={};
function headOf(B){if(QHEAD[B.name])return QHEAD[B.name];const m=B.sn/B.hr,p=new Path2D();p.moveTo(-.92,.18);p.bezierCurveTo(-.98,-.8,-.14,-1.06,.42,-.76);p.quadraticCurveTo(.62,-.56,.74,-.34);p.quadraticCurveTo(.82+m*.3,-.24,.74+m*.9,-.2);p.quadraticCurveTo(.98+m,-.08,.96+m,.14);p.quadraticCurveTo(.86+m,.34,.6+m*.7,.42);p.quadraticCurveTo(.5,.62,.3,.68);p.quadraticCurveTo(-.3,.98,-.72,.72);p.quadraticCurveTo(-.92,.52,-.92,.18);p.closePath();
  const e=new Path2D();if(B.ear==='flop'){e.moveTo(-.46,-.7);e.quadraticCurveTo(-.1,-.72,-.16,-.1);e.quadraticCurveTo(-.3,.56,-.66,.62);e.quadraticCurveTo(-.96,.3,-.86,-.2);e.quadraticCurveTo(-.82,-.56,-.46,-.7);}else{const k=B.cat?1.05:1.2;e.moveTo(-.62,-.5);e.quadraticCurveTo(-.56,-1.2*k,-.3,-1.66*k);e.quadraticCurveTo(.12,-1.26*k,.26,-.76);}e.closePath();return QHEAD[B.name]={h:p,e,m};}
function earAt(g,b,H,T,lod,k,far){const c=far?T.furF:T.fur;g.save();if(!far)g.rotate(b.ear||0);else g.translate(.26,-.05);if(far){g.fillStyle=c.b;g.fill(H.e);}else{shadeP(g,H.e,c,lod,k);if(lod)inkP(g,H.e,k*QI);if(lod>1&&b.B.ear!=='flop'){g.fillStyle=T.ear;g.beginPath();g.moveTo(-.46,-.62);g.quadraticCurveTo(-.4,-1.1,-.28,-1.4);g.quadraticCurveTo(0,-1.1,.1,-.78);g.closePath();g.fill();}}g.restore();}
const F3=[0,0,0];
const QI=.55;
function quadSide(g,b,T,lod){
  const B=b.B,L=B.leg,bl=B.bl,bh=B.bh,hr=B.hr,a=b.amp,u=b.ph,G=b.G,o=G.o,cat=!!B.cat,A=B.stride*a,lift=L*.2*a,n=lod>1?3:2,br=1+.014*Math.sin(t*2.2+b.seed),Lu=L*.5,Ll=L*.565;
  const bs=Math.sin(TAU*(u*2+.1))*L*.02*a,bh2=Math.sin(TAU*(u*2+.6))*L*.024*a,hip=[-bl*.72,-(L*.98+bh*.1)+bh2],sh=[bl*.68,-(L*.98+bh*.12)+bs];
  const leg=(hind,off,far)=>{stepFoot(u+off,A,lift,G.f,F3,0);const root=hind?hip:sh,sp=far?-L*.03:L*.03,paw=[root[0]+F3[0]+sp+(hind?-L*.05:L*.02),F3[1]*a*.9-bh*.14],[K]=ik(root,paw,Lu,Ll,hind?-1:1),mid=hind?[lerp(K[0],paw[0],.58)-L*.09,lerp(K[1],paw[1],.58)]:[lerp(K[0],paw[0],.74)+L*.02,lerp(K[1],paw[1],.74)],q=tubeP([root,K,mid,paw],hind?[bh*.66,bh*.36,bh*.19,bh*.15]:[bh*.5,bh*.27,bh*.17,bh*.15],n),c=far?T.furF:T.fur;
    if(far){g.fillStyle=c.b;g.fill(q);}else{shadeP(g,q,c,lod,.42);if(lod)inkP(g,q,QI);}
    const pw=ellP(paw[0]+bh*.18,paw[1]+bh*.01,bh*.3,bh*.15),pc=far?T.furF:B.socks?T.fur2:T.fur;if(far){g.fillStyle=pc.b;g.fill(pw);}else{shadeP(g,pw,pc,lod,.3);if(lod)inkP(g,pw,QI);}};
  leg(true,o[2],true);leg(false,o[3],true);
  // The tail swings on its own, a little behind the body.
  {let x=-bl*1,y=hip[1]-bh*.3;const pts=[[x,y]],s=B.tl/8,ws=[B.tw];for(let i=0;i<8;i++){const an=b.ta?b.ta[i]:TAILS[B.tail][i];x+=Math.cos(an)*s;y+=Math.sin(an)*s;pts.push([x,y]);ws.push(lerp(B.tw,B.tw*(B.tail==='curl'?.7:.5),(i+1)/8));}const q=tubeP(pts,ws,lod>1?2:1);shadeP(g,q,T.fur,lod,.36);if(lod)inkP(g,q,QI);}
  leg(true,o[0],false);leg(false,o[1],false);
  const dip=(b.sniffK||0),hb=Math.sin(TAU*(u*2+.32))*L*.014*a,hx=bl*(cat?1.3:1.14)+hr*.52+dip*hr*.7,hy=sh[1]-bh*(cat?.62:.92)-hr*.4+hb+dip*L*.8,H=headOf(B),tilt=(b.tilt||0)+dip*.5;
  const bp=tubeP([[-bl*1,hip[1]+bh*.02],[-bl*.6,hip[1]-bh*.08],[0,lerp(hip[1],sh[1],.5)+(cat?bh*.1:bh*.02)],[bl*.6,sh[1]+bh*.02],[bl*.98,sh[1]-bh*.2],[lerp(bl,hx,.46),lerp(sh[1],hy,.62)],[hx-hr*.3,hy+hr*.14]],[bh*.62*br,bh*.9*br,bh*(cat?.74:.74)*br,bh*.94*br,bh*.76,bh*.54,hr*.6],n);
  shadeP(g,bp,T.fur,lod);
  if(lod>1){g.save();g.clip(bp);
    if(b.stripes){g.strokeStyle=T.fur.d;g.lineWidth=bh*.15;g.lineCap='round';for(let i=0;i<7;i++){const x=-bl*.9+i*bl*.3,y0=lerp(hip[1],sh[1],(i+1)/8)-bh*.56;g.beginPath();g.moveTo(x,y0);g.quadraticCurveTo(x+bh*.14,y0+bh*.4,x-bh*.08,y0+bh*.74);g.stroke();}}
    if(B.saddle){g.fillStyle=T.fur2.b;g.beginPath();g.ellipse(-bl*.1,hip[1]-bh*.72,bl*.82,bh*.72,0,0,TAU);g.fill();}
    else if(b.col2!==b.col){g.fillStyle=T.fur2.b;g.beginPath();g.ellipse(bl*.3,sh[1]+bh*1.05,bl*.72,bh*.5,0,0,TAU);g.fill();}
    g.restore();}
  if(lod)inkP(g,bp,QI);
  // Haunch and shoulder, laid over the top of the near legs with no line, so the legs grow out of the body.
  const hp=ellP(hip[0]-bl*.02,hip[1]+bh*.42,bh*.7,bh*.74),sp=ellP(sh[0],sh[1]+bh*.46,bh*.5,bh*.66);g.fillStyle=T.fur.b;g.fill(hp);g.fill(sp);
  if(lod>1){g.strokeStyle=T.fur.d;g.lineWidth=.5;g.lineCap='round';g.beginPath();g.ellipse(hip[0]-bl*.02,hip[1]+bh*.22,bh*.7,bh*.8,0,-.9,.9);g.moveTo(sh[0]-bh*.5,sh[1]+bh*.1);g.quadraticCurveTo(sh[0]-bh*.6,sh[1]+bh*.7,sh[0]-bh*.3,sh[1]+bh*.9);g.stroke();g.lineWidth=.45;g.beginPath();for(let i=0;i<16;i++){const x=-bl*.92+h3(i,1,b.seed)*bl*1.84,y=lerp(hip[1],sh[1],h3(i,2,b.seed))+(h3(i,3,b.seed)-.5)*bh*1.25;g.moveTo(x,y);g.lineTo(x-bh*.24,y+bh*.08);}g.stroke();}
  g.save();g.translate(hx,hy);g.rotate(tilt);g.scale(hr,hr);const k=1/hr;earAt(g,b,H,T,lod,k,true);
  shadeP(g,H.h,T.fur,lod,k*.8);if(lod)inkP(g,H.h,k*QI);
  if(lod>1){if(b.col2!==b.col&&!cat){g.save();g.clip(H.h);g.fillStyle=T.fur2.b;g.beginPath();g.ellipse(.7+H.m*.6,.22,.5+H.m*.5,.3,0,0,TAU);g.fill();g.restore();}
    const m=H.m;g.fillStyle='#0c0a10';g.beginPath();g.ellipse(.94+m,-.03,.13,.11,0,0,TAU);g.fill();
    if(cat){g.fillStyle=b.eye;g.beginPath();g.moveTo(.2,-.26);g.quadraticCurveTo(.46,-.5,.68,-.26);g.quadraticCurveTo(.46,-.1,.2,-.26);g.fill();if(!b.blinkOn){g.fillStyle='#0a0810';g.beginPath();g.ellipse(.48,-.27,.05,.14,0,0,TAU);g.fill();}else{g.fillStyle=T.fur.b;g.fillRect(.14,-.46,.6,.24);}g.strokeStyle=INK;g.lineWidth=.05;g.beginPath();g.moveTo(.14,-.24);g.quadraticCurveTo(.46,-.54,.72,-.26);g.stroke();g.strokeStyle='rgba(240,236,228,.5)';g.lineWidth=.025;g.beginPath();for(let i=0;i<3;i++){g.moveTo(.72,.2+i*.07);g.quadraticCurveTo(1.2,.1+i*.1,1.7,-.02+i*.2);}g.stroke();}
    else{g.fillStyle='#14100e';g.beginPath();g.ellipse(.42,-.28,.11,.12,0,0,TAU);g.fill();g.fillStyle='#f4f0ea';g.beginPath();g.arc(.45,-.32,.035,0,TAU);g.fill();g.strokeStyle=INK;g.lineWidth=.04;g.beginPath();g.moveTo(.86+m,.28);g.quadraticCurveTo(.5+m*.4,.4,.4,.3);g.stroke();if(b.pant){const q=.6+.4*Math.sin(t*8+b.seed);g.fillStyle='#d8607c';g.beginPath();g.ellipse(.62+m*.5,.46+q*.1,.2,.12+q*.1,.2,0,TAU);g.fill();}}
  }else if(lod){g.fillStyle=cat?b.eye:'#14100e';g.fillRect(.34,-.34,.2,.14);}
  earAt(g,b,H,T,lod,k,false);g.restore();
}
function quadSit(g,b,T,lod){
  const B=b.B,cat=!!B.cat,hr=cat?20:B.hr*1.5,w=cat?22:B.bl*.66,br=1+.016*Math.sin(t*1.9+b.seed),top=cat?-58:-(B.leg*1.18+B.bh*1.1),k=1/hr,n=lod>1?3:2,lk=b.look||0;
  // The tail lies round the feet, its tip alive.
  {const sd=b.tailS||1,tw=Math.sin(t*1.1+b.seed)*(b.wag?0:1),wg=b.wag?Math.sin(t*12+b.seed):0,tip=cat?[sd*(w*1.9+tw*3),-20-tw*5]:[sd*(w*1.4)-sd*wg*w*.3,-B.tw-Math.abs(wg)*6],q=tubeP([[sd*w*.5,-6],[sd*w*1.1,-4],[sd*w*1.6,-7],tip],[B.tw,B.tw*.94,B.tw*.8,B.tw*.5],n);shadeP(g,q,T.fur,lod,1.2);if(lod)inkP(g,q,1);}
  for(const sd of[-1,1]){const q=ellP(sd*w*.74,-w*.56,w*.56,w*.62*br);shadeP(g,q,T.fur,lod,.7);if(lod)inkP(g,q,QI);}
  const bp=new Path2D();bp.moveTo(-w*.86,-1);bp.bezierCurveTo(-w*1.16,top*.52,-w*.66*br,top*.92,-w*.3,top);bp.lineTo(w*.3,top);bp.bezierCurveTo(w*.66*br,top*.92,w*1.16,top*.52,w*.86,-1);bp.closePath();shadeP(g,bp,T.fur,lod,1);
  if(lod>1){g.save();g.clip(bp);if(b.col2!==b.col||cat){g.fillStyle=T.fur2.b;g.beginPath();g.moveTo(-w*.42,top*1.05);g.quadraticCurveTo(-w*.5,top*.5,-w*.1,top*.22);g.lineTo(w*.1,top*.22);g.quadraticCurveTo(w*.5,top*.5,w*.42,top*1.05);g.closePath();g.fill();}if(b.stripes){g.strokeStyle=T.fur.d;g.lineWidth=2.2;g.lineCap='round';for(const sd of[-1,1])for(let i=0;i<3;i++){g.beginPath();g.moveTo(sd*w*.98,top*(.22+i*.2));g.quadraticCurveTo(sd*w*.74,top*(.26+i*.2),sd*w*.56,top*(.2+i*.2));g.stroke();}}g.strokeStyle=T.fur.d;g.lineWidth=.45;g.beginPath();for(let i=0;i<18;i++){const x=(h3(i,1,b.seed)-.5)*w*1.7,y=top*(.3+h3(i,2,b.seed)*.6);g.moveTo(x,y);g.lineTo(x+(x>0?-1:1)*1,y+2.6);}g.stroke();g.restore();}
  if(lod)inkP(g,bp,QI);
  for(const sd of[-1,1]){const up=sd>0?(b.paw||0):0,gu=sd<0?(b.groom||0):0,fx=sd*w*.34,py=-3-up*(top*-.5)-gu*(top*-.86),px=fx+sd*up*w*.7,q=tubeP([[fx,top*.66],[fx+sd*w*.03,top*.34-up*top*-.1],[px,py]],[w*.2,w*.17,w*.145],n),pc=B.socks||(cat&&b.col2!==b.col)?T.fur2:T.fur;shadeP(g,q,T.fur,lod,.4);if(lod){g.save();g.beginPath();g.rect(-w*3,top*.52,w*6,-top*.6);g.clip();inkP(g,q,QI);g.restore();}const pw=ellP(px,py+1,w*.2,w*.12);shadeP(g,pw,pc,lod,.3);if(lod)inkP(g,pw,QI);if(lod>1){g.strokeStyle=T.fur.d;g.lineWidth=.4;g.beginPath();g.moveTo(px-w*.06,py+.2);g.lineTo(px-w*.06,py+1.8);g.moveTo(px+w*.06,py+.2);g.lineTo(px+w*.06,py+1.8);g.stroke();}}
  g.save();g.translate(lk*w*.1,top-hr*.72+(b.groom||0)*3);g.rotate(lk*.07+(b.tilt||0)*.2);g.scale(hr,hr);
  if(cat){
    for(const sd of[-1,1]){const e=new Path2D();e.moveTo(sd*.3,-.8);e.quadraticCurveTo(sd*.74,-1.34,sd*.94,-1.58);e.quadraticCurveTo(sd*1.06,-1,sd*1,-.46);e.closePath();g.save();if(sd>0)g.rotate(b.ear||0);shadeP(g,e,T.fur,lod,k);if(lod)inkP(g,e,k*QI);if(lod>1){g.fillStyle=T.ear;g.beginPath();g.moveTo(sd*.5,-.82);g.quadraticCurveTo(sd*.76,-1.14,sd*.88,-1.26);g.quadraticCurveTo(sd*.94,-.96,sd*.88,-.64);g.closePath();g.fill();}g.restore();}
    const f=new Path2D();f.moveTo(-.98,-.14);f.bezierCurveTo(-1,-.92,-.5,-1.02,0,-1);f.bezierCurveTo(.5,-1.02,1,-.92,.98,-.14);f.bezierCurveTo(1.04,.26,.7,.56,.34,.68);f.quadraticCurveTo(0,.8,-.34,.68);f.bezierCurveTo(-.7,.56,-1.04,.26,-.98,-.14);f.closePath();shadeP(g,f,T.fur,lod,k*.9);if(lod)inkP(g,f,k*QI);
    if(lod>1){g.save();g.clip(f);if(b.col2!==b.col){g.fillStyle=T.fur2.b;g.beginPath();g.ellipse(0,.44,.54,.4,0,0,TAU);g.fill();}if(b.stripes){g.strokeStyle=T.fur.d;g.lineWidth=.08;g.lineCap='round';g.beginPath();g.moveTo(-.28,-.98);g.lineTo(-.2,-.56);g.moveTo(0,-1);g.lineTo(0,-.58);g.moveTo(.28,-.98);g.lineTo(.2,-.56);g.moveTo(-.98,.04);g.lineTo(-.62,.08);g.moveTo(.98,.04);g.lineTo(.62,.08);g.stroke();}g.restore();
      const sh=1-(b.blink||0);for(const sd of[-1,1]){const ex=sd*.42+lk*.05,ey=-.14;if(sh>.14){g.fillStyle='#0c0a10';g.beginPath();g.moveTo(ex-sd*.25,ey+.06*sh);g.quadraticCurveTo(ex,ey-.32*sh,ex+sd*.27,ey-.08*sh);g.quadraticCurveTo(ex,ey+.22*sh,ex-sd*.25,ey+.06*sh);g.fill();g.fillStyle=b.eye;g.beginPath();g.moveTo(ex-sd*.21,ey+.05*sh);g.quadraticCurveTo(ex,ey-.26*sh,ex+sd*.23,ey-.07*sh);g.quadraticCurveTo(ex,ey+.17*sh,ex-sd*.21,ey+.05*sh);g.fill();g.fillStyle='#08060c';g.beginPath();g.ellipse(ex+lk*.06,ey-.02,.055,.17*sh,0,0,TAU);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(ex-.07,ey-.11*sh,.03,0,TAU);g.fill();}else{g.strokeStyle=INK;g.lineWidth=.06;g.beginPath();g.moveTo(ex-.24,ey);g.quadraticCurveTo(ex,ey+.1,ex+.24,ey);g.stroke();}}
      g.fillStyle='#d88090';g.beginPath();g.moveTo(-.09,.22);g.quadraticCurveTo(0,.17,.09,.22);g.lineTo(0,.31);g.closePath();g.fill();g.strokeStyle=INK;g.lineWidth=.04;g.beginPath();g.moveTo(0,.31);g.lineTo(0,.4);g.quadraticCurveTo(-.1,.5,-.22,.42);g.moveTo(0,.4);g.quadraticCurveTo(.1,.5,.22,.42);g.stroke();
      g.strokeStyle='rgba(240,236,228,.5)';g.lineWidth=.025;g.beginPath();for(const sd of[-1,1])for(let i=0;i<3;i++){g.moveTo(sd*.42,.3+i*.06);g.quadraticCurveTo(sd*.9,.22+i*.08,sd*1.5,.1+i*.2);}g.stroke();}
    else if(lod){g.fillStyle=b.eye;g.fillRect(-.56,-.2,.26,.14);g.fillRect(.3,-.2,.26,.14);}
  }else{
    const m=B.sn/B.hr;if(B.ear==='up')for(const sd of[-1,1]){const e=new Path2D();e.moveTo(sd*.24,-.72);e.quadraticCurveTo(sd*.7,-1.3,sd*.84,-1.74);e.quadraticCurveTo(sd*1.06,-1.1,sd*1,-.36);e.closePath();g.save();if(sd>0)g.rotate(b.ear||0);shadeP(g,e,T.fur,lod,k);if(lod)inkP(g,e,k*QI);if(lod>1){g.fillStyle=T.ear;g.beginPath();g.moveTo(sd*.46,-.74);g.quadraticCurveTo(sd*.74,-1.16,sd*.8,-1.36);g.quadraticCurveTo(sd*.92,-1,sd*.84,-.56);g.closePath();g.fill();}g.restore();}
    const f=new Path2D();f.moveTo(-.92,-.2);f.bezierCurveTo(-.96,-.98,.96,-.98,.92,-.2);f.bezierCurveTo(.94,.3,.56,.5,.44,.66);f.lineTo(-.44,.66);f.bezierCurveTo(-.56,.5,-.94,.3,-.92,-.2);f.closePath();shadeP(g,f,T.fur,lod,k*.9);if(lod)inkP(g,f,k*QI);
    if(B.ear==='flop')for(const sd of[-1,1]){const e=new Path2D();e.moveTo(sd*.56,-.82);e.quadraticCurveTo(sd*1.34,-.72,sd*1.26,.28);e.quadraticCurveTo(sd*1.1,.74,sd*.82,.6);e.quadraticCurveTo(sd*.74,0,sd*.56,-.82);e.closePath();g.save();if(sd>0)g.rotate((b.ear||0)*.4);shadeP(g,e,T.fur,lod,k);g.globalAlpha=.3;g.fillStyle=T.fur.d;g.fill(e);g.globalAlpha=1;if(lod)inkP(g,e,k*QI);g.restore();}
    const mz=new Path2D();mz.moveTo(-.46,.06);mz.bezierCurveTo(-.56,.4,-.42,.96+m*.1,0,1+m*.1);mz.bezierCurveTo(.42,.96+m*.1,.56,.4,.46,.06);mz.quadraticCurveTo(0,-.16,-.46,.06);mz.closePath();const mc=b.col2!==b.col?T.fur2:T.fur;shadeP(g,mz,mc,lod,k*.5);
    if(lod>1){for(const sd of[-1,1]){const ex=sd*.42+lk*.05,ey=-.26;if(b.blinkOn){g.strokeStyle=INK;g.lineWidth=.05;g.beginPath();g.moveTo(ex-.14,ey);g.quadraticCurveTo(ex,ey+.08,ex+.14,ey);g.stroke();}else{g.fillStyle='#120e0c';g.beginPath();g.ellipse(ex,ey,.14,.15,0,0,TAU);g.fill();g.fillStyle='#7a5430';g.beginPath();g.ellipse(ex,ey,.09,.1,0,0,TAU);g.fill();g.fillStyle='#0a0808';g.beginPath();g.arc(ex+lk*.03,ey,.06,0,TAU);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(ex-.04,ey-.05,.03,0,TAU);g.fill();}g.strokeStyle=T.fur.d;g.lineWidth=.05;g.beginPath();g.moveTo(ex-sd*.16,ey-.24);g.quadraticCurveTo(ex,ey-.32,ex+sd*.16,ey-.26);g.stroke();}
      g.fillStyle='#0e0c10';g.beginPath();g.moveTo(-.17,.3);g.quadraticCurveTo(0,.2,.17,.3);g.quadraticCurveTo(.14,.5,0,.52);g.quadraticCurveTo(-.14,.5,-.17,.3);g.fill();g.fillStyle='rgba(255,255,255,.5)';g.beginPath();g.ellipse(-.05,.31,.05,.025,0,0,TAU);g.fill();
      g.strokeStyle=INK;g.lineWidth=.04;g.beginPath();g.moveTo(0,.52);g.lineTo(0,.66);g.moveTo(-.3,.68);g.quadraticCurveTo(0,.84,.3,.68);g.stroke();if(b.pant){const q=.5+.5*Math.sin(t*8+b.seed);g.fillStyle='#d8607c';g.beginPath();g.moveTo(-.15,.74);g.quadraticCurveTo(0,.8,.15,.74);g.quadraticCurveTo(.16,.96+q*.24,0,1.02+q*.26);g.quadraticCurveTo(-.16,.96+q*.24,-.15,.74);g.fill();}}
    else if(lod){g.fillStyle='#120e0c';g.fillRect(-.5,-.3,.2,.14);g.fillRect(.3,-.3,.2,.14);g.fillRect(-.14,.3,.28,.18);}
  }
  g.restore();
}
function beastTones(b,L){const T={fur:tones(b.col,L),fur2:tones(b.col2||b.chest||b.col,L),ear:rgbS(190*L.a[0],110*L.a[1],124*L.a[2])};T.furF={b:T.fur.d};return T;}
// A beast's own life: its gait, its tail on a chain of lagging joints, an ear that twitches, breath and blinks.
function moveBeast(b,dt){
  if(!b.ta){b.ta=TAILS[b.B.tail].slice();b.amp=0;b.v=0;b.sv=null;b.turn=0;b.ear=0;b.earT=expo(3);b.bT=expo(4);b.sniffK=0;b.seed=b.seed||b.id*3.7;}
  const walking=b.state==='walk',B=b.B,G=b.G;b.amp+=((walking?1:0)-b.amp)*Math.min(1,dt*7);b.v+=((walking?b.sp:0)-b.v)*Math.min(1,dt*6);
  if(walking){const Am=B.stride/100*b.hm;b.ph=(b.ph+dt*G.f*Math.max(.15,b.v)/(2*Am))%1;}
  const base=TAILS[B.tail],wag=b.wag||B.tail==='wag'&&walking,amp=wag?.62:walking?.2:.09,fr=wag?11:walking?3.4:1.2;for(let i=0;i<8;i++){const f=i/7,tg=base[i]+Math.sin(t*fr-i*.52+(b.seed||0))*amp*(.25+.75*f)+(walking?Math.sin(TAU*b.ph*2-i*.4)*.05:0),rate=Math.min(1,dt*(16-i*1.3));b.ta[i]+=(tg-b.ta[i])*rate;}
  b.earT-=dt;if(b.earT<=0){b.earT=expo(5);b.earV=rr(-5,5);}b.earV=(b.earV||0)+(-b.ear*90-(b.earV||0)*9)*dt;b.ear+=(b.earV||0)*dt;
  b.bT-=dt;if(b.bT<=0){b.blinkOn=!b.blinkOn;b.bT=b.blinkOn?.13:expo(4);}
  b.sniffK+=((b.sniff?1:0)-b.sniffK)*Math.min(1,dt*5);
  const key=b.state==='sit'?'sit':b.dir>0?'r':'l';if(b.sv===null){b.sv=key;b.sd=b.dir;}if(key!==b.sv&&!b.turn)b.turn=1e-3;if(b.turn){const w=b.turn;b.turn+=dt/.36;if(w<.5&&b.turn>=.5){b.sv=key;b.sd=b.dir;}if(b.turn>=1)b.turn=0;}
}
function drawQuad(g,b,x,y,U,L){
  if(!b.L||Math.abs(b.L.x-L.x)>.2){b.L=L;b.T=beastTones(b,L);}
  const lod=U>.72?2:U>.24?1:0,tk=1-.44*Math.sin(Math.PI*(b.turn||0)),s=b.sv==='sit'?1:(b.sd||b.dir);INKED=lod>1;
  g.setTransform(U*s*tk,0,0,U,x,y);SHX=b.L.lx*s*9;SHY=b.L.ly*9;
  if(b.sv==='sit')quadSit(g,b,b.T,lod);else quadSide(g,b,b.T,lod);
  g.setTransform(1,0,0,1,0,0);
}

/* ---------- vehicles ---------- */
// Side views in metres: length, height, wheel positions and radius, the body's outline, and the glass.
const KINDS={
  sedan:{L:4.5,H:1.42,w:[.9,3.62],r:.33,body:[[0,.34],[.02,.8],[.16,.97],[1.12,1.04],[1.56,1.4],[3,1.42],[3.6,1.02],[4.4,.88],[4.5,.58],[4.46,.3]],glass:[[1.66,1.04],[1.73,1.32],[2.96,1.34],[3.46,1.04]]},
  wedge:{L:4.5,H:1.14,w:[.86,3.62],r:.35,body:[[0,.34],[-.02,.8],[.26,.92],[1.3,.96],[2.06,1.14],[2.96,1.14],[3.66,.82],[4.44,.56],[4.5,.3]],glass:[[2.12,.97],[2.18,1.08],[2.9,1.08],[3.38,.86]]},
  taxi:{L:4.6,H:1.5,w:[.92,3.7],r:.34,body:[[0,.34],[.02,.82],[.2,.99],[1.18,1.06],[1.6,1.42],[3.05,1.44],[3.68,1.04],[4.5,.9],[4.6,.58],[4.56,.3]],glass:[[1.7,1.06],[1.77,1.34],[3,1.36],[3.5,1.06]]},
  kei:{L:3.4,H:1.72,w:[.62,2.76],r:.28,body:[[0,.3],[.02,1.62],[.12,1.72],[2.62,1.72],[3.1,1.08],[3.36,.94],[3.4,.32]],glass:[[1.84,1.08],[1.84,1.6],[2.56,1.6],[2.98,1.08]]},
  van:{L:5,H:2.1,w:[.95,4],r:.36,body:[[0,.36],[0,1.98],[.14,2.1],[3.6,2.1],[4.38,1.4],[4.96,1.22],[5,.36]],glass:[[3.66,1.96],[4.28,1.4],[3.66,1.4]]},
  truck:{L:7,H:3,w:[1.1,2.4,6.1],r:.42,body:[[0,.46],[0,3],[5,3],[5,2.42],[6.1,2.42],[6.88,1.52],[7,.46]],glass:[[5.9,2.26],[5.9,1.6],[6.72,1.6],[6.24,2.26]]},
  bike:{L:2.1,H:1.6,w:[.32,1.78],r:.33}
};
const CARC=[['black','#1c1c26'],['white','#c8c8d2'],['silver','#8a90a0'],['graphite','#30343e'],['blue','#26407c'],['red','#a82a32'],['teal','#1c6a6e'],['violet','#4c2488'],['yellow','#c8b018'],['pink','#c03c7c']];
const WHEELS={};
// A wheel, sharp for when it turns slowly and blurred for when the spokes run together. Drawn once, turned as it rolls.
function wheelSprite(r,hub){
  const key=Math.round(r)+hub;if(WHEELS[key])return WHEELS[key];const n=Math.ceil(r*2+4),[c,g]=mk(n,n),[b,h]=mk(n,n),m=n/2;
  for(const q of[g,h]){q.translate(m,m);ell(q,0,0,r,r,'#0a090f');q.strokeStyle='#2a2833';q.lineWidth=r*.05;q.beginPath();q.arc(0,0,r*.8,0,TAU);q.stroke();q.strokeStyle='rgba(120,116,140,.5)';q.lineWidth=r*.03;q.beginPath();q.arc(0,0,r*.92,-2.4,-1.1);q.stroke();}
  ell(g,0,0,r*.66,r*.66,shade(hub,-.55));for(let i=0;i<5;i++){g.save();g.rotate(i*TAU/5);g.fillStyle=hub;g.beginPath();g.moveTo(-r*.09,-r*.08);g.lineTo(-r*.13,-r*.62);g.lineTo(r*.13,-r*.62);g.lineTo(r*.09,-r*.08);g.closePath();g.fill();g.fillStyle=shade(hub,.3);g.fillRect(-r*.1,-r*.6,r*.05,r*.5);g.restore();}
  ell(g,0,0,r*.17,r*.17,shade(hub,.15));ell(g,0,0,r*.07,r*.07,'#0c0a12');g.strokeStyle=shade(hub,.2);g.lineWidth=r*.035;g.beginPath();g.arc(0,0,r*.65,0,TAU);g.stroke();
  h.fillStyle=rad(h,0,0,r*.1,r*.66,[[0,shade(hub,.1)],[.7,shade(hub,-.2)],[1,shade(hub,-.5)]]);h.beginPath();h.arc(0,0,r*.66,0,TAU);h.fill();ell(h,0,0,r*.12,r*.12,'#0c0a12');
  return WHEELS[key]={c,b,n};
}
function drawWheel(g,x,y,W,rot,v){g.save();g.translate(x,y);if(v<8){g.save();g.rotate(rot);g.drawImage(W.c,-W.n/2,-W.n/2);g.restore();}if(v>2.5){g.globalAlpha=clamp((v-2.5)/5,0,1);g.drawImage(W.b,-W.n/2,-W.n/2);g.globalAlpha=1;}g.restore();}
function carSprite(v){
  const K=KINDS[v.kind],ppm=F/v.z,pad=.4,[c,g]=mk((K.L+pad*2)*ppm,(K.H+.9)*ppm);
  g.setTransform(ppm,0,0,-ppm,pad*ppm,(K.H+.7)*ppm);g.lineJoin='round';g.lineCap='round';
  const col=v.col,lw=.028,trim=v.trim;
  if(v.kind==='bike'){
    // Frame, tank, seat, and a rider leaning over the bars.
    g.strokeStyle='#14121c';g.lineWidth=.07;g.beginPath();g.moveTo(.32,.33);g.lineTo(.74,.66);g.lineTo(1.42,.72);g.lineTo(1.78,.33);g.moveTo(1.42,.72);g.lineTo(1.58,1.02);g.stroke();
    const tank=[[.3,.62],[.66,.86],[1.28,.92],[1.66,.72],[1.92,.86],[1.66,1.02],[1.1,1],[.58,1.02],[.12,.86]];poly(g,tank);g.fillStyle=lin(g,0,1.04,0,.6,[[0,shade(col,.32)],[.32,col],[.36,shade(col,.5)],[.4,shade(col,-.2)],[1,shade(col,-.6)]]);g.fill();g.strokeStyle=INK;g.lineWidth=lw;g.stroke();
    g.fillStyle='#16141e';poly(g,[[.5,.5],[.84,.42],[1.38,.46],[1.5,.66],[.72,.68]]);g.fill();g.strokeStyle='#3a3844';g.lineWidth=.02;for(let i=0;i<4;i++){g.beginPath();g.moveTo(.76+i*.15,.46);g.lineTo(.8+i*.15,.66);g.stroke();}g.fillStyle='#4a4854';poly(g,[[.12,.46],[.66,.42],[.68,.47],[.1,.54]]);g.fill();
    if(v.box){const q=rrP(-.1,.92,.62,.62,.05);g.fillStyle=lin(g,0,1.54,0,.92,[[0,shade(trim,.1)],[1,shade(trim,-.5)]]);g.fill(q);g.strokeStyle=INK;g.stroke(q);g.fillStyle=rgba('#ffffff',.5);g.fillRect(-.02,1.16,.46,.06);}
    const ri=[[.5,.98],[.66,1.5],[1.2,1.44],[1.46,1.1],[1.16,.94]];poly(g,ri);g.fillStyle=lin(g,.5,1.5,1.4,1,[[0,v.rider],[.5,shade(v.rider,.16)],[1,shade(v.rider,-.3)]]);g.fill();g.strokeStyle=INK;g.stroke();g.strokeStyle=trim;g.lineWidth=.022;g.beginPath();g.moveTo(.68,1.46);g.lineTo(1.16,1.42);g.stroke();
    g.strokeStyle=shade(v.rider,-.1);g.lineWidth=.12;g.beginPath();g.moveTo(1.2,1.34);g.lineTo(1.62,1.02);g.stroke();g.lineWidth=.13;g.strokeStyle='#1e1c26';g.beginPath();g.moveTo(.82,.96);g.lineTo(1.16,.72);g.lineTo(1,.46);g.stroke();
    g.beginPath();g.arc(1.3,1.52,.18,0,TAU);g.fillStyle=lin(g,0,1.7,0,1.34,[[0,'#3a3844'],[.4,'#14121c'],[1,'#0c0a12']]);g.fill();g.strokeStyle=INK;g.lineWidth=lw;g.stroke();g.fillStyle=trim;poly(g,[[1.34,1.48],[1.48,1.5],[1.46,1.56],[1.32,1.56]]);g.fill();
    tintNight(c,g);return c;}
  // The body: flat bands of reflected night, a hard line of light along the shoulder and the road's dark along the sill.
  rpoly(g,K.body,.09);g.fillStyle=lin(g,0,K.H,0,.2,[[0,shade(col,.1)],[.3,shade(col,-.08)],[.55,shade(col,-.34)],[.58,shade(col,.1)],[.72,shade(col,-.26)],[1,shade(col,-.68)]]);g.fill();
  g.save();rpoly(g,K.body,.09);g.clip();
  const sh=v.kind==='truck'?1.6:K.H*.67;g.fillStyle=rgba(shade(col,.62),.8);poly(g,[[-.1,sh+.03],[K.L+.1,sh-.05],[K.L+.1,sh-.09],[-.1,sh-.01]]);g.fill();
  g.fillStyle=rgba(trim,.16);poly(g,[[K.L*.1,.46],[K.L*.34,.7],[K.L*.5,.7],[K.L*.26,.46]]);g.fill();poly(g,[[K.L*.58,.44],[K.L*.74,.66],[K.L*.8,.66],[K.L*.64,.44]]);g.fill();
  g.fillStyle=lin(g,0,.52,0,.16,[[0,'rgba(0,0,0,0)'],[1,'rgba(6,4,10,.8)']]);g.fillRect(-1,0,K.L+2,.6);
  // Road dirt thrown up behind the wheels, and scuffs.
  for(let i=0;i<46;i++){const x=h3(i,1,v.s)*K.L,y=.3+h3(i,2,v.s)**2*.5;g.fillStyle=`rgba(8,6,12,${(.08+.12*h3(i,3,v.s)).toFixed(2)})`;g.fillRect(x,y,.02+.06*h3(i,4,v.s),.012+.05*h3(i,5,v.s));}
  if(v.kind==='taxi'){g.fillStyle='#14121c';for(let i=0;i<10;i++)g.fillRect(1.2+i*.22,i%2?.72:.62,.22,.1);}
  if(v.kind==='truck'){const m=mixC('#2c2a36',trim,.1);g.fillStyle=lin(g,0,3,0,.5,[[0,shade(m,.12)],[.7,m],[1,shade(m,-.4)]]);g.fillRect(0,.5,5,2.5);g.fillStyle='rgba(0,0,0,.28)';for(let x=.25;x<5;x+=.25)g.fillRect(x,.5,.012,2.5);g.fillStyle=rgba(trim,.75);poly(g,[[.3,1.1],[2.4,1.1],[2.9,2.2],[2.5,2.2],[2.1,1.5],[.3,1.5]]);g.fill();g.fillStyle=rgba(shade(trim,.3),.8);g.fillRect(3,1.1,1.7,.1);g.fillRect(3,1.3,1.1,.1);for(let i=0;i<9;i++){const x=h3(i,7,v.s)*5,l=.4+h3(i,8,v.s);g.fillStyle='rgba(60,34,26,.34)';g.fillRect(x,3-l,.03,l);}g.fillStyle='rgba(0,0,0,.4)';g.fillRect(0,2.86,5,.05);g.fillRect(0,.56,5,.05);}
  if(v.stripe){g.fillStyle=trim;g.fillRect(-1,.72,K.L+2,.04);}
  // Doors, a sill, vents.
  g.strokeStyle='rgba(6,4,10,.8)';g.lineWidth=.014;g.beginPath();for(const x of v.kind==='truck'?[5.32]:v.kind==='van'?[K.L*.68,K.L*.36]:[K.L*.36,K.L*.58]){g.moveTo(x,.32);g.lineTo(x,K.H-.42);}g.moveTo(0,.42);g.lineTo(K.L,.42);g.stroke();
  g.fillStyle='rgba(6,4,10,.85)';for(const x of v.kind==='truck'?[]:[K.L*.42,K.L*.64])g.fillRect(x,.8,.16,.028);
  if(v.kind==='wedge'){g.fillStyle='rgba(6,4,10,.7)';for(let i=0;i<4;i++)g.fillRect(1.2+i*.12,.56,.07,.22);}
  g.restore();
  rpoly(g,K.body,.09);g.strokeStyle=INK;g.lineWidth=lw;g.stroke();
  if(K.glass){poly(g,K.glass);g.fillStyle=lin(g,0,K.H,0,.9,[[0,'#1a2a44'],[.5,'#101a2e'],[1,'#080e1a']]);g.fill();g.save();poly(g,K.glass);g.clip();
    const gx=K.glass[K.glass.length-1][0]-.56,gy=K.glass[0][1];g.fillStyle='#07060c';g.beginPath();g.arc(gx,gy+.16,.1,0,TAU);g.fill();g.fillRect(gx-.17,gy-.12,.34,.2);
    g.fillStyle=rgba(trim,.42);poly(g,[[K.glass[0][0]+.22,0],[K.glass[0][0]+.5,0],[K.glass[0][0]+1.06,3],[K.glass[0][0]+.78,3]]);g.fill();g.fillStyle='rgba(235,240,255,.1)';poly(g,[[K.glass[0][0]+.62,0],[K.glass[0][0]+.68,0],[K.glass[0][0]+1.24,3],[K.glass[0][0]+1.18,3]]);g.fill();g.restore();
    poly(g,K.glass);g.strokeStyle=INK;g.lineWidth=lw;g.stroke();if(v.kind==='sedan'||v.kind==='taxi'){g.fillStyle=shade(col,-.4);g.fillRect(2.3,1.02,.07,.34);}}
  if(v.kind==='taxi'){g.fillStyle='#e8d818';g.fillRect(2,1.44,.76,.2);g.strokeStyle=INK;g.lineWidth=.022;g.strokeRect(2,1.44,.76,.2);}
  if(v.kind==='van'){g.fillStyle='#14121c';g.fillRect(.5,2.1,2.6,.05);for(let x=.6;x<3.1;x+=.6)g.fillRect(x,2.1,.04,.1);}
  if(v.kind==='wedge'){g.fillStyle=shade(col,-.5);poly(g,[[-.08,.96],[.42,.96],[.36,.9],[-.1,.9]]);g.fill();g.fillRect(.1,.84,.05,.08);}
  // A mirror, and strips of light at each end.
  if(v.kind!=='truck'){const mx=K.L*.74,my=K.H*.74;g.fillStyle=shade(col,-.25);rrect(g,mx,my,.12,.08,.03);g.fill();}
  const fy=v.kind==='truck'?.9:v.kind==='van'?.96:.68;g.fillStyle='#fff8e6';g.fillRect(K.L-.14,fy,.14,.05);g.fillStyle='#ff2436';g.fillRect(0,fy+.06,.06,.1);
  // Wheel arches open so the turning wheels show through.
  g.globalCompositeOperation='destination-out';for(const wx of K.w){g.beginPath();g.arc(wx,K.r,K.r*1.13,0,TAU);g.fill();}g.globalCompositeOperation='source-over';
  for(const wx of K.w){g.strokeStyle=rgba(INK,.9);g.lineWidth=.03;g.beginPath();g.arc(wx,K.r,K.r*1.14,.2,Math.PI-.2);g.stroke();}
  // The outline the street's colours slide across, with the wheels left out.
  const p=new Path2D();K.body.forEach((q,i)=>{if(i)p.lineTo(q[0]*ppm,-q[1]*ppm);else p.moveTo(q[0]*ppm,-q[1]*ppm);});p.closePath();for(const wx of K.w){p.moveTo((wx+K.r*1.13)*ppm,-K.r*ppm);p.arc(wx*ppm,-K.r*ppm,K.r*1.13*ppm,0,TAU);}v.clipP=p;
  tintNight(c,g);return c;}
function tintNight(c,g){g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-atop';g.fillStyle=rgba(MOOD.amb,.22);g.fillRect(0,0,c.width,c.height);g.globalCompositeOperation='source-over';}
const BUSL=11.6,BUSH=3.12,BPAD=.3,BUSWR=.5;
const busDoors=[[BUSL*.46,BUSL*.46+1.25],[BUSL-2.35,BUSL-1.15]];
const BUSW=[2.5,BUSL-3.1];
// A bus in layers: its lit inside, the glass, and the body with the windows and wheel arches cut out of it.
function busSprites(z){
  const key=z.toFixed(2);if(BUSZ[key])return BUSZ[key];
  const ppm=F/z,L=BUSL,H=BUSH,[lower,upper,stripe]=FLEET,W=(L+BPAD*2)*ppm,Hh=(H+.7)*ppm,T=g=>{g.setTransform(ppm,0,0,-ppm,BPAD*ppm,(H+.4)*ppm);g.lineJoin='round';g.lineCap='round';};
  const panes=[],band=(x0,x1)=>{const n=Math.max(1,Math.round((x1-x0)/1.5)),w=(x1-x0-(n-1)*.09)/n;for(let i=0;i<n;i++)panes.push([x0+i*(w+.09),1.24,w,1.34]);};
  band(.7,busDoors[0][0]-.14);band(busDoors[0][1]+.14,busDoors[1][0]-.14);
  const win=new Path2D();for(const[a,b,w,h]of panes)win.addPath(rrP(a,b,w,h,.07));for(const[a,b]of busDoors)win.rect(a,.5,b-a,2.1);
  win.moveTo(L-1.02,1.2);win.lineTo(L-1.02,2.66);win.lineTo(L-.5,2.66);win.quadraticCurveTo(L-.18,2.5,L-.08,1.2);win.closePath();
  let[c,g]=mk(W,Hh);T(g);
  const bp=new Path2D();bp.moveTo(0,.42);bp.lineTo(0,H-.3);bp.quadraticCurveTo(0,H,.3,H);bp.lineTo(L-.86,H);bp.quadraticCurveTo(L-.3,H,L-.14,H-.6);bp.lineTo(L,1.2);bp.lineTo(L,.42);bp.closePath();
  g.fillStyle=lin(g,0,H,0,1.2,[[0,shade(upper,-.1)],[.2,shade(upper,-.32)],[.3,shade(upper,-.5)],[1,shade(upper,-.6)]]);g.fill(bp);g.save();g.clip(bp);
  g.fillStyle=lin(g,0,1.16,0,.3,[[0,shade(lower,.16)],[.3,lower],[.34,shade(lower,.32)],[.4,shade(lower,-.12)],[1,shade(lower,-.66)]]);g.fillRect(-1,-1,L+2,2.16);
  // A long painted advert down the lower side, all shape and no words.
  g.save();g.beginPath();g.rect(3.3,.56,2.1,.5);g.rect(busDoors[0][1]+.2,.56,3.9,.5);g.clip();g.fillStyle=lin(g,3,0,L,0,[[0,stripe],[.5,mixC(stripe,'#ffffff',.2)],[1,shade(stripe,-.3)]]);g.globalAlpha=.55;g.fillRect(0,.5,L,.6);g.globalAlpha=.8;g.fillStyle=rgba(lower,.9);for(let i=0;i<9;i++){const x=3+i*.95;poly(g,[[x,.5],[x+.42,.5],[x+.86,1.1],[x+.44,1.1]]);g.fill();}g.restore();g.globalAlpha=1;
  g.fillStyle=stripe;g.fillRect(-1,1.1,L+2,.045);g.fillStyle=shade(upper,-.55);g.fillRect(-1,H-.15,L+2,.2);g.fillStyle='#14141c';g.fillRect(.5,1.16,L-1.2,1.5);g.fillRect(L*.25,2.74,L*.5,.26);
  // Panels and rivets, and rain streaks down from the roof.
  g.strokeStyle='rgba(6,4,10,.7)';g.lineWidth=.014;g.beginPath();for(let x=1.3;x<L;x+=1.5){g.moveTo(x,.42);g.lineTo(x,1.1);g.moveTo(x,2.7);g.lineTo(x,H);}g.moveTo(0,.74);g.lineTo(L,.74);g.stroke();g.fillStyle='rgba(6,4,10,.7)';for(let x=.4;x<L;x+=.3)g.fillRect(x,1.06,.02,.02);
  for(let i=0;i<40;i++){const x=h3(i,1,z)*L,l=.1+h3(i,2,z)*.24;g.fillStyle='rgba(8,6,12,.22)';g.fillRect(x,H-.16-l,.016,l);}
  g.fillStyle='rgba(6,4,10,.85)';for(let i=0;i<7;i++)g.fillRect(.7+i*.16,2.76,.1,.2);
  g.fillStyle=lin(g,0,.52,0,.3,[[0,'rgba(0,0,0,0)'],[1,'rgba(6,4,10,.85)']]);g.fillRect(-1,0,L+2,.6);
  g.restore();g.strokeStyle=INK;g.lineWidth=.03;g.stroke(bp);
  g.globalCompositeOperation='destination-out';g.fill(win);for(const wx of BUSW){g.beginPath();g.arc(wx,BUSWR,BUSWR*1.14,0,TAU);g.fill();}g.globalCompositeOperation='source-over';g.strokeStyle=INK;g.lineWidth=.024;g.stroke(win);
  for(const wx of BUSW){g.strokeStyle=rgba(INK,.9);g.lineWidth=.04;g.beginPath();g.arc(wx,BUSWR,BUSWR*1.16,.1,Math.PI-.1);g.stroke();}
  g.fillStyle=lin(g,0,H+.12,0,H,[[0,'#6a6e7c'],[1,'#30323c']]);g.fillRect(L*.3,H,L*.24,.12);g.fillRect(L*.62,H,L*.1,.1);g.strokeStyle='#14141c';g.lineWidth=.016;g.beginPath();for(let x=L*.31;x<L*.54;x+=.12){g.moveTo(x,H);g.lineTo(x,H+.1);}g.stroke();
  g.strokeStyle='#14121c';g.lineWidth=.05;g.beginPath();g.moveTo(L-.3,2.7);g.quadraticCurveTo(L+.1,2.76,L+.14,2.5);g.stroke();g.fillStyle='#0e0c14';rrect(g,L+.07,2.1,.14,.42,.04);g.fill();
  g.fillStyle='#fff8e6';g.fillRect(L-.18,.72,.18,.1);g.fillStyle='#ff2436';g.fillRect(0,1,.08,.34);
  const bodyC=c;[c,g]=mk(W,Hh);T(g);g.save();g.clip(win);
  g.fillStyle=lin(g,0,2.75,0,.4,[[0,'#fffbe8'],[.2,'#f4e6c0'],[.24,'#384668'],[.62,'#3e4e72'],[.66,'#e4d8b4'],[1,'#b8ac8c']]);g.fillRect(0,0,L,H);
  g.fillStyle='#ffffff';g.fillRect(0,2.56,L,.05);
  for(let x=1;x<L-2.6;x+=.92){g.fillStyle='#4a68a4';rrect(g,x,.96,.42,.72,.1);g.fill();g.fillStyle='#3a5484';g.fillRect(x+.05,1.5,.32,.16);}
  g.fillStyle='#f0c040';for(let x=1.6;x<L-1;x+=2.4)g.fillRect(x,.6,.035,2);g.fillRect(0,2.3,L,.03);g.restore();const inner=c;
  [c,g]=mk(W,Hh);T(g);g.save();g.clip(win);for(let x=-1;x<L;x+=2.2){g.fillStyle='rgba(225,235,255,.12)';poly(g,[[x,0],[x+.4,0],[x+.9,H],[x+.5,H]]);g.fill();}g.fillStyle='rgba(10,14,30,.16)';g.fillRect(0,0,L,H);g.restore();const glass=c;
  return BUSZ[key]={body:bodyC,inner,glass,ppm,W,Hh};
}

/* ---------- traffic ---------- */
function newVeh(kind,lane,L,H,cruise){
  const j=rr(-.18,.18),z=(lane?FLANE:NLANE)+(kind==='bus'?0:j),d=lane?-ND:ND,front=-d*(halfW(z)+1.5);
  for(const o of veh)if(o.lane===lane&&(o.front-o.d*o.L-front)*d<3)return null;
  const v={kind,lane,z,d,L,H,front,v:cruise,cruise,s:rr(0,99),state:'drive',brk:false};veh.push(v);return v;
}
function spawnCar(){
  const kind=wpick([['sedan',6],['taxi',2.4],['wedge',1.8],['kei',2],['van',1.6],['truck',.7],['bike',1.6],['scooter',1.4]]),k=kind==='scooter'?'bike':kind,K=KINDS[k],lane=chance(.5)?0:1;
  const PACE={sedan:[5,9],wedge:[7,12],taxi:[4,7.5],kei:[4,7],van:[4.5,7.5],truck:[3.5,6],bike:[6,11],scooter:[4,6.5]}[kind];
  const v=newVeh(kind,lane,K.L,K.H,rr(PACE[0],PACE[1]));if(!v)return;
  const[cn,col]=kind==='taxi'?['yellow','#e0c018']:pick(CARC);
  Object.assign(v,{kind:k,scoot:kind==='scooter',col,cn,trim:pick(NEON),hub:pick(['#3a3a46','#8a8a9a','#c8a040','#a8aeba']),stripe:chance(.3),under:chance(.22)?pick(NEON):null,rider:pick(['#1a1626','#22182e','#141c24','#2a1a1a']),box:kind==='scooter',free:kind==='taxi'&&chance(.6)});
  v.spr=carSprite(v);stats.cars++;
  logOnce('car',pick([20,40]),kind==='taxi'?(v.free?'A taxi goes by with its roof light on':'A taxi goes by with a fare in the back'):kind==='van'?`${cap(an(cn))} van rolls past`:kind==='truck'?'A truck grinds through':kind==='bike'?'A motorbike whines past':kind==='scooter'?'A courier buzzes past with a glowing box':kind==='wedge'?`${cap(an(cn))} sports car slips by, low to the road`:`${cap(an(cn))} car goes by`);
}
function paxFrom(o){const q=body(o);return Object.assign(q,{seat:rr(1,BUSL-3)});}
function spawnBus(lane,route){
  const v=newVeh('bus',lane,BUSL,BUSH,rr(4.8,6));if(!v)return null;
  const nis=!route;Object.assign(v,{nis,route,pax:[],doorK:0,stopped:false,passed:false,boarded:0,ind:false,indT:0,sp:busSprites(v.z)});
  if(!nis)for(let i=wpick([[0,2],[1,3],[2,3],[3,2],[5,1]]);i>0;i--)v.pax.push(paxFrom(makeLook()));
  if(lane===0&&!nis&&v.pax.length&&chance(.35))v.alight=true;
  return v;
}
const stopFront=()=>POLE+ND*1.25;
const waitingFor=r=>people.filter(p=>p.task==='wait'&&p.route===r&&!p.board);
function wantsStop(v){return!!v.route&&(!!v.alight||waitingFor(v.route).length>0);}
function updBus(v,dt,want){
  const dist=(stopFront()-v.front)*v.d;
  if(v.lane===0&&v.state==='drive'&&!v.stopped&&dist>0&&wantsStop(v)&&v.v*v.v/(2*1.6)>=dist-.5)v.state='brake';
  if(v.state==='brake'){want=Math.min(want,Math.sqrt(2*1.6*Math.max(0,dist)));v.ind=true;if(dist<.12&&v.v<1){v.front=stopFront();v.v=0;v.state='dwell';v.dw=rr(2.5,4.5);v.stopped=true;v.ind=false;busArrives(v);}}
  else if(v.state==='dwell'){v.doorK=Math.min(1,v.doorK+dt*1.4);v.dwT=(v.dwT||0)+dt;const busy=people.some(p=>p.board===v)&&v.dwT<14;if(!busy){v.dw-=dt;if(v.dw<=0){v.state='close';}}}
  else if(v.state==='close'){v.doorK=Math.max(0,v.doorK-dt*1.4);if(v.doorK<=0){v.state='drive';v.ind=true;v.indT=2.5;busLeaves(v);}}
  if(v.indT>0){v.indT-=dt;if(v.indT<=0)v.ind=false;}
  if(v.lane===0&&!v.passed&&(v.front-POLE)*v.d>3){v.passed=true;if(!v.stopped&&v.route)logOnce('pass',30,pick([`The ${v.route.n} goes by without stopping`,`The ${v.route.n} sweeps past. Not yours anyway`,`An empty ${v.route.n} rattles through`]));}
  return want;
}
function busArrives(v){
  const w=waitingFor(v.route);log(`The ${v.route.n} to ${cap(v.route.dest.toLowerCase())} pulls in. Its doors sigh open`);
  for(const p of w){p.board=v;p.act=null;p.phone=false;go(p,doorX(v),KERB-.1,rr(1.3,1.7),()=>boardBus(p,v));}
  if(v.alight){v.alight=false;const q=v.pax.pop();if(q){const p=newPerson(q.o,q.h);p.x=doorX(v);p.z=KERB+.1;const side=chance(.5)?-1:1;go(p,p.x,rr(2.6,3.1),rr(1.1,1.4),()=>go(p,edgeX(p.z,side),p.z,rr(1.1,1.5),()=>{p.dead=true;}));log(`${cap(p.o.desc)} steps down and walks off`);}}
}
function boardBus(p,v){p.dead=true;if(!veh.includes(v)||v.state==='drive'){log('The doors close just too soon');return;}v.pax.push(paxFrom(p.o));v.boarded++;log(`${cap(p.o.desc)} gets on`);}
function busLeaves(v){log(v.boarded?`The ${v.route.n} pulls away. You stay on your bench`:pick([`The ${v.route.n} pulls away`,`The ${v.route.n} shuts its doors and goes`]));}
const doorX=v=>v.front-v.d*(BUSL-busDoors[1][0]-.6);

/* ---------- people on the street ---------- */
function newPerson(o,h){const p=Object.assign(body(o||makeLook(),h),{id:PID++,kind:'person',x:0,z:3,state:'idle',view:'side',dir:1,head:0,ph:rr(0,TAU),sp:0,phone:false,task:null,act:null,tb:expo(5)});
  if(raining&&chance(.5))p.umb=pick(['#22222c','#c8483a','#2c4278','#e8e4d8','#ff2a7a','#2af0ff']);if(raining&&p.o.top==='hoodie')p.o.hood=true;people.push(p);return p;}
function go(p,tx,tz,sp,then){p.state='walk';p.tx=tx;p.tz=tz;p.sp=sp;p.then=then;p.act=null;}
function leaveAlong(p,sp){const side=chance(.5)?-1:1;go(p,edgeX(p.z,side),p.z,sp||rr(1.05,1.5),()=>{p.dead=true;});}
function hold(p,what,dur,then){p.state=what;p.t=dur;p.then=then;}
const nearZ=()=>rr(2.55,3.15),farZ=()=>rr(FKERB+.6,WALL-.8);
function spawnWalker(near){
  const z=near?nearZ():farZ(),side=chance(.5)?-1:1,mode=wpick([['stroll',2],['walk',5],['brisk',2],['run',.6]]),sp={stroll:rr(.75,1),walk:rr(1.05,1.45),brisk:rr(1.5,1.9),run:rr(2.8,3.8)}[mode];
  if(near&&people.filter(p=>p.z<4&&p.task!=='wait').length>2)return;
  const p=newPerson();p.x=edgeX(z,side);p.z=z;p.phone=mode!=='run'&&chance(.16);
  if(mode!=='run'&&chance(.12))p.dog=makeDog(sp);
  go(p,edgeX(z,-side),z,sp,()=>{p.dead=true;});
  if(near)logOnce('walk',24,mode==='run'?'Someone runs past, breathing hard':p.dog?`${cap(p.o.desc)} walks a ${p.dog.B.name} past the stop`:p.phone?`${cap(p.o.desc)} drifts past, eyes on their phone`:`${cap(p.o.desc)} walks past the stop`);
  return p;
}
// Two friends walking together, one a little ahead, talking.
function spawnPair(){const near=chance(.35),z=near?rr(2.8,3.1):farZ(),side=chance(.5)?-1:1,sp=rr(.9,1.25),a=newPerson(),b=newPerson();a.x=edgeX(z,side);b.x=a.x+side*rr(.7,1);a.z=z;b.z=z+rr(.18,.3);go(a,edgeX(z,-side),z,sp,()=>{a.dead=true;});go(b,edgeX(z,-side)-side*.9,b.z,sp,()=>{b.dead=true;});if(near)logOnce('pair',40,'Two people pass, deep in a conversation you only catch the end of');}
// Someone stops somewhere for a while, then goes on.
function spawnLoiter(){
  const near=chance(.25),z=near?nearZ():farZ(),side=chance(.5)?-1:1,hw=Math.min(halfW(z)*.8,near?3.6:14),xs=rr(-hw,hw),p=newPerson();p.x=edgeX(z,side);p.z=z;
  const what=wpick([['phone',4],['smoke',2.4],['look',1.2]]);
  go(p,xs,z,rr(.9,1.3),()=>{p.view=near?'side':chance(.5)?'front':'side';if(what==='phone')p.phone=true;hold(p,what,rr(8,38),()=>{p.phone=false;p.view='side';leaveAlong(p);});});
  if(near)logOnce('stand',60,what==='smoke'?`${cap(p.o.desc)} stops to light something`:`${cap(p.o.desc)} stops on the pavement and stands there a while`);
}
// Someone stops under the tree to look up at it, sometimes holding up a phone.
function spawnGazer(){
  const z=rr(2.6,3),side=chance(.5)?-1:1,hw=Math.min(halfW(z)*.6,2.6),p=newPerson();p.x=edgeX(z,side);p.z=z;p.dir=TS;
  go(p,TS*hw*rr(.3,.95),z,rr(.9,1.2),()=>{p.dir=TS;const shot=chance(.55);hold(p,shot?'photo':'look',rr(7,20),()=>{p.phone=false;leaveAlong(p);});if(shot)p.phone=true;log(shot?`${cap(p.o.desc)} stops and holds a phone up to the blossom`:`${cap(p.o.desc)} stops under the branches and looks up`);});
}
function spawnWaiter(){
  if(people.filter(p=>p.task==='wait').length>=2)return;
  const z=rr(2.75,3.15),side=chance(.7)?TS:-TS,p=newPerson();p.x=edgeX(z,side);p.z=z;p.task='wait';p.route=chance(.6)?upcoming.route:pick(ROUTES);p.waited=0;p.patience=rr(240,800);
  const hw=Math.min(halfW(z)*.8,3.4);go(p,clamp(POLE-ND*rr(-.4,1.7),-hw,hw),z,rr(1,1.35),()=>{p.state='wait';p.view='back';p.act=actWait;p.tl=expo(6);p.tp=expo(14);log(`${cap(p.o.desc)} comes to wait for the ${p.route.n}`);});
}
function actWait(p,dt){
  p.waited+=dt;if(p.waited>p.patience){p.task=null;p.act=null;log(`${cap(p.o.desc)} gives up on the ${p.route.n} and walks off`);p.view='side';leaveAlong(p);return;}
  p.tl-=dt;if(p.tl<=0){p.tl=expo(9);p.head=p.head?0:(chance(.75)?-ND:ND);}
  p.tp-=dt;if(p.tp<=0){p.phone=!p.phone;p.tp=p.phone?rr(6,30):expo(22);}
}
// Crossing goes from the far side to the near side or back, waiting at the kerb for a gap and then holding the traffic.
function spawnCrosser(){
  const toUs=chance(.55),z0=toUs?FKERB+.5:KERB-.45,z1=toUs?KERB-.45:FKERB+.5,p=newPerson(),side=chance(.5)?-1:1;
  p.z=z0;p.x=edgeX(z0,side);
  go(p,XW+rr(-.5,.5),z0,rr(1.1,1.4),()=>{p.state='kerb';p.t=rr(.6,2.4);p.view=toUs?'front':'back';p.then=()=>{p.cross=true;go(p,p.x+rr(-.3,.3),z1,rr(1.25,1.55),()=>{p.cross=false;p.view='side';if(!toUs||chance(.6))leaveAlong(p);else{p.task='wait';p.route=pick(ROUTES);p.waited=0;p.patience=rr(120,500);go(p,clamp(POLE-ND*rr(0,1.6),-3.4,3.4),rr(2.8,3.1),1.2,()=>{p.state='wait';p.view='back';p.act=actWait;p.tl=expo(6);p.tp=expo(14);});}});};});
  if(toUs)logOnce('cross',60,`${cap(p.o.desc)} crosses the road toward you`);
}
function updPerson(p,dt){
  if(p.state==='walk'){
    const dx=p.tx-p.x,dz=p.tz-p.z,dist=Math.hypot(dx,dz),want=Math.min(p.sp,.2+dist*2.4)*(p.limp?.62+.38*Math.abs(Math.sin(p.ph*TAU)):1);p.v=(p.v||0)+(want-(p.v||0))*Math.min(1,dt*5);const st=Math.max(.05*dt,p.v*dt);
    if(dist<=st||dist<.012){p.x=p.tx;p.z=p.tz;p.state='idle';const f=p.then;p.then=null;if(f)f();}
    else{p.x+=dx/dist*st;p.z+=dz/dist*st;if(Math.abs(dx)>.02)p.dir=Math.sign(dx);p.view=Math.abs(dz)>Math.abs(dx)*1.1?(dz<0?'front':'back'):'side';if(p.dog){const d=p.dog;d.state='walk';d.sp=p.v;d.dir=p.dir;d.id=d.id||PID++;moveBeast(d,dt);}}
    return;}
  p.v=(p.v||0)*Math.max(0,1-dt*7);
  if(p.state==='kerb'){let clear=true;for(const v of veh){const k=Math.abs((v.front-XW));if(k<7&&(XW-v.front)*v.d>-v.L)clear=false;}p.t-=dt;if(p.t<=0&&clear){const f=p.then;p.then=null;f();}return;}
  if(p.state==='phone'||p.state==='smoke'||p.state==='photo'||p.state==='look'){
    p.t-=dt;if(p.state==='smoke'){p.tb-=dt;if(p.tb<=0){p.tb=rr(3,8);p.drag=1.4;}if(p.drag>0){p.drag-=dt;if(p.drag<=0){const G=p.G;puffs.push({x:p.x+p.dir*.18,y:(G.hipH+G.torso+G.neck+G.hr)*UNIT,z:p.z,r:.05,v:.18,life:rr(2,3.4),age:0,col:'#d8d8e4',a:.26});}}}
    if(p.state==='photo'&&chance(dt*.12))p.flashAt=t;
    if(p.t<=0){const f=p.then;p.then=null;p.state='idle';f&&f();}return;}
  if(p.act)p.act(p,dt);
}

/* ---------- a cat, or a dog, comes to see you ---------- */
function newBeast(kind,o){const b=Object.assign({id:PID++,kind,x:0,z:3,dir:1,ph:R(),state:'idle',s:rr(0,99),look:0,blink:0,paw:0,groom:0},o);beasts.push(b);return b;}
function bgo(b,tx,tz,sp,then){b.state='walk';b.tx=tx;b.tz=tz;b.sp=sp;b.then=then;}
function spawnCat(){
  if(beasts.some(b=>b.kind==='cat'))return;
  const plan=wpick([['visit',5],['pass',3],['linger',2.4]]),near=plan!=='linger'&&(plan==='visit'||chance(.7)),z=near?rr(2.7,3.15):farZ(),side=chance(.5)?-1:1,[cn,col,chest,eye]=pick(CATC),c=newBeast('cat',{B:CATB,G:GAITS.walk,hm:rr(CATB.h[0],CATB.h[1]),col,col2:chest,chest,eye,cn,stripes:/tabby|ginger/.test(cn),plan});
  c.x=edgeX(z,side,1);c.z=z;const sp=rr(.42,.68);
  if(plan==='visit'){const hw=Math.min(halfW(2.4)*.6,1.1),tx=rr(-hw,hw);bgo(c,tx,rr(2.2,2.42),sp,()=>catSits(c,rr(12,70),true));log(`A ${cn} cat ${pick(['pads along the pavement toward you','comes round the bus stop pole','wanders over from the kerb'])}`);}
  else if(plan==='linger'){const hw=Math.min(halfW(z)*.8,12);bgo(c,rr(-hw,hw),z,sp,()=>catSits(c,rr(25,120),false));logOnce('fcat',60,`A ${cn} cat crosses the far pavement and sits down in the shop light`);}
  else{bgo(c,edgeX(z,-side,1),z,sp*1.2,()=>{c.dead=true;});logOnce('pcat',60,`A ${cn} cat trots past on some errand of its own`);}
  return c;
}
function catSits(c,rest,visit){c.state='sit';c.rest=rest;c.next=expo(4);c.visit=visit;c.tailS=chance(.5)?1:-1;if(visit){stats.visits++;log(pick([`The ${c.cn} cat sits down in front of you and stares`,`The ${c.cn} cat stops, looks at you for a long moment, and sits`,`The ${c.cn} cat decides you are worth looking at`]));}}
function catLeaves(c,why){c.state='idle';c.paw=c.groom=0;const side=chance(.5)?-1:1,z=rr(2.7,3.15);bgo(c,edgeX(c.z<4?z:c.z,side,1),c.z<4?z:c.z,why?rr(1.8,2.6):rr(.42,.68),()=>{c.dead=true;});if(c.visit&&!why)log(pick([`The ${c.cn} cat loses interest and wanders off`,`The ${c.cn} cat gets up, stretches and leaves without a backward glance`]));}
function updCat(c,dt){
  if(c.state==='walk'){stepBeast(c,dt);return;}
  if(c.state==='sit'){
    c.rest-=dt;c.next-=dt;c.blink=Math.max(0,c.blink-dt*2.5);c.paw=Math.max(0,c.paw-dt*1.6);
    c.look+=((c.lookTo||0)-c.look)*Math.min(1,dt*3);
    if(c.mode==='groom'){c.gt-=dt;c.groom=.5+.5*Math.sin(t*7);if(c.gt<=0){c.mode=null;c.groom=0;}}
    if(c.next<=0){c.next=expo(5);const a=wpick([['blink',3],['look',3],['groom',1.4],['swat',1.2]]);
      if(a==='blink')c.blink=1;else if(a==='look')c.lookTo=rr(-1,1);else if(a==='groom'){c.mode='groom';c.gt=rr(2,6);}
      else{const near=petals.find(p=>Math.abs(p.z-c.z)<.5&&Math.abs(p.x-c.x)<.5&&p.y<.6);if(near||chance(.3)){c.paw=1;if(c.visit&&chance(.3))logOnce('swat',40,`The ${c.cn} cat bats at a falling petal and misses`);}}}
    if(c.rest<=0)catLeaves(c);}
}
function spawnDog(){
  if(beasts.some(b=>b.kind==='dog'))return;
  const plan=wpick([['visit',4],['pass',3.6],['sniff',2.4]]),z=rr(2.7,3.15),side=chance(.5)?-1:1,sp=rr(.85,1.3),D0=makeDog(sp),d=newBeast('dog',Object.assign(D0,{plan}));
  d.x=edgeX(z,side,1.4);d.z=z;
  if(plan==='visit'){const hw=Math.min(halfW(2.5)*.55,1);bgo(d,rr(-hw,hw),rr(2.3,2.5),sp,()=>{d.state='sit';d.rest=rr(7,30);d.wag=true;d.pant=chance(.7);d.next=expo(3);stats.visits++;log(pick([`A ${d.B.name} comes up, sits in front of you and wags its tail`,`A ${d.B.name} stops at your feet and looks up hopefully`]));});log(`A ${d.B.name} with no lead trots along the pavement`);}
  else if(plan==='sniff'){const hw=Math.min(halfW(z)*.75,3.2);d.sniffAt=rr(-hw,hw);bgo(d,d.sniffAt,z,sp,()=>{d.state='sniff';d.sniff=true;d.rest=rr(3,9);});}
  else{bgo(d,edgeX(z,-side,1.4),z,sp*1.2,()=>{d.dead=true;});logOnce('pdog',60,`A ${d.B.name} trots by, nose to the ground`);}
}
function updDog(d,dt){
  if(d.state==='walk'){stepBeast(d,dt);return;}
  if(d.state==='sniff'){d.rest-=dt;if(d.rest<=0){d.sniff=false;const side=chance(.5)?-1:1;bgo(d,edgeX(d.z,side,1.4),d.z,1.1,()=>{d.dead=true;});}return;}
  if(d.state==='sit'){d.rest-=dt;d.next-=dt;if(d.next<=0){d.next=expo(3);d.look=rr(-1,1);}if(d.rest<=0){d.wag=false;const side=chance(.5)?-1:1,z=rr(2.7,3.15);bgo(d,edgeX(z,side,1.4),z,1.15,()=>{d.dead=true;});log(`The ${d.B.name} gives up on you and trots away`);}}
}
function stepBeast(b,dt){const dx=b.tx-b.x,dz=b.tz-b.z,dist=Math.hypot(dx,dz),st=Math.max(.04,(b.v||0))*dt;if(dist<=st){b.x=b.tx;b.z=b.tz;b.state='idle';const f=b.then;b.then=null;if(f)f();}else{b.x+=dx/dist*st;b.z+=dz/dist*st;if(Math.abs(dx)>.01)b.dir=Math.sign(dx);}}

/* ---------- a fight ---------- */
// Rare. Two or three hard cases stop nose to nose, it goes from words to a shove to fists, and then, as fast as it
// started, they break apart and limp off. Nobody is badly hurt and nobody stays.
function startFight(where){
  if(fight)return;
  const zone=where||wpick([['far',5],['near',2.6]]),z=zone==='far'?rr(FKERB+.9,WALL-1):rr(2.95,3.2),hw=Math.min(halfW(z)*.62,zone==='far'?11:3),xm=rr(-hw,hw),three=chance(.26);
  const mk2=side=>{const p=newPerson(makeLook(true),rr(20,22.5));p.umb=null;p.x=edgeX(z,side);p.z=z;p.fighter=true;p.fg={f:'guard',k:0,ph:rr(0,9),hurt:0};return p;};
  const a=mk2(-1),b=mk2(1),c=three?mk2(-1):null;const gap=rr(.72,.86);
  fight={a,b,c,z,xm,gap,phase:'meet',t:0,next:0,left:rr(7,15),ready:0,zone};
  const fin=()=>{fight.ready++;};
  go(a,xm-gap,z,rr(1.5,1.9),fin);go(b,xm+gap,z,rr(1.5,1.9),fin);if(c)go(c,xm-gap-.9,z+.12,rr(1.5,1.9),()=>{c.state='fight';c.dir=1;});
}
function setF(p,f,dur){p.fg.f=f;p.fg.k=0;p.fg.dur=dur;}
function updFight(dt){
  const F_=fight;if(!F_)return;F_.t+=dt;const{a,b,c}=F_;
  for(const p of[a,b,c])if(p&&p.fg){const q=p.fg;if(q.dur){q.k+=dt/q.dur;if(q.k>=1){q.k=0;q.dur=0;if(q.f!=='down')q.f='guard';}}}
  if(F_.phase==='meet'){if(F_.ready>=2){a.state=b.state='fight';a.dir=1;b.dir=-1;F_.phase='face';F_.t=0;F_.dur=rr(3,7);setF(a,'talk',0);setF(b,'talk',0);
      log(F_.zone==='near'?pick([`Two chromed-up strangers square off right in front of the stop`,'Two hard cases stop nose to nose, close enough that you can hear them']):pick(['Across the road, two chromed-up strangers stop nose to nose','Voices go up on the far pavement. Two hard cases square off']));
      for(const p of people)if(p!==a&&p!==b&&p!==c&&!p.fighter&&Math.abs(p.z-F_.z)<3&&Math.abs(p.x-F_.xm)<8&&p.state==='walk'&&!p.cross){p.watch={tx:p.tx,tz:p.tz,sp:p.sp,then:p.then};p.state='watch';p.t=rr(5,14);p.dir=Math.sign(F_.xm-p.x)||1;p.view='side';}
      for(const q of beasts)if(q.z<6===F_.z<6&&Math.abs(q.x-F_.xm)<5){if(q.kind==='cat')catLeaves(q,true);}}
    return;}
  if(F_.phase==='face'){if(F_.t>F_.dur){F_.phase='brawl';F_.t=0;setF(a,'shove',.5);setF(b,'hit',.5);b.x+=.18;F_.next=.7;log('A shove, and then it is on');}return;}
  if(F_.phase==='brawl'){
    F_.next-=dt;if(F_.next<=0){F_.next=rr(.45,1.15);const swap=chance(.5),A=swap?b:a,B_=swap?a:b,kind=wpick([['jab',4],['hook',2.6],['kick',1.2],['shove',1]]);setF(A,kind,kind==='kick'?.5:.34);A.fg.hand=chance(.5)?1:2;
      const blocked=chance(.3);setF(B_,blocked?'block':'hit',.4);B_.fg.hurt+=blocked?0:1;
      const hx=(A.x+B_.x)/2,yh=kind==='kick'?.8:1.45;if(A.o.chrome||kind!=='kick'&&chance(.4))for(let i=0,n=ri(5,12);i<n;i++)sparks.push({x:hx,y:yh,z:F_.z,vx:rr(-1.6,1.6),vy:rr(.2,2),age:0,life:rr(.2,.5),col:pick(['#ffd060','#fff4c0','#ff8a3a',A.o.led||'#2af0ff'])});
      if(!blocked){const d=Math.sign(B_.x-A.x)||1;B_.x+=d*rr(.05,.14);A.x+=d*rr(.02,.08);}
      if(F_.t>2&&F_.c!==null&&c&&chance(.3)){setF(c,'jab',.34);c.fg.hand=1;}}
    if(F_.t>F_.left){F_.phase='end';F_.t=0;const loser=a.fg.hurt>b.fg.hurt?a:b,win=loser===a?b:a;F_.loser=loser;F_.win=win;
      if(chance(.6)){setF(loser,'down',0);loser.fg.dn=0;loser.fg.down=true;loser.fg.lay=rr(3,7);log(pick(['One of them goes down hard. The other stands over them, breathing','A last swing lands, and one of them is on the ground']));}
      else{setF(loser,'guard',0);log('They break apart, spitting and swearing');}}
    return;}
  if(F_.phase==='end'){
    const l=F_.loser;if(l.fg.down){l.fg.dn=Math.min(1,l.fg.dn+dt*2.8);l.fg.lay-=dt;if(l.fg.lay<=0){l.fg.down=false;l.fg.rise=1;}return;}
    if(l.fg.rise>0){l.fg.rise-=dt*.8;l.fg.dn=Math.max(0,l.fg.rise);return;}
    if(F_.t>2){F_.phase='gone';const w=F_.win,sw=w.x<l.x?-1:1;for(const p of[w,c])if(p){p.fighter=false;p.state='idle';p.fg=null;go(p,edgeX(p.z,sw),p.z,rr(1.3,1.7),()=>{p.dead=true;});}
      l.fighter=false;l.fg=null;l.limp=true;l.state='idle';go(l,edgeX(l.z,-sw),l.z,rr(.8,1.05),()=>{l.dead=true;});log(pick(['It is over as fast as it began. They go their separate ways, one of them limping','One walks off rolling a shoulder, the other limps the other way. The petals keep falling']));
      fight=null;for(const p of people)if(p.state==='watch')p.t=Math.min(p.t,rr(.5,2));}}
}
function poseFight(p,o){
  const q=p.fg,G=p.G,k=Math.sin(Math.min(1,q.k)*Math.PI),bob=Math.sin(t*5.2+q.ph)*.16,low=G.hipH*.9,hy=-low+bob,cy=hy-G.torso,chin=cy-.5;
  o[PHX]=-.1;o[PHY]=hy;o[CXI]=.95;o[CY]=cy;o[TW]=.3;o[HDX]=.28;o[HDY]=.1;o[TILT]=.08;o[NF]=2.8;o[NF+1]=0;o[NF+2]=0;o[FF]=-3;o[FF+1]=-.5;o[FF+2]=-.5;o[NH]=3.7;o[NH+1]=chin+.6;o[FH]=2.5;o[FH+1]=chin+.9;
  if(q.f==='down'){poseStand(p,o);o[NH]=o[CXI]+2.8;o[NH+1]=o[CY]+G.up+1;o[FH]=o[CXI]-2.4;o[FH+1]=o[CY]+G.up*.8;o[NF]=2.2;o[FF]=-1.2;o[TILT]=-.22;}
  else if(q.f==='jab'||q.f==='hook'){const j=q.hand===1?NH:FH,reach=q.f==='jab'?8.6:7.4;o[j]=lerp(o[j],reach,k);o[j+1]=chin+(q.f==='hook'?-k*.5:.4);o[CXI]+=k*1.5;o[PHX]+=k*.7;o[TW]=lerp(.3,q.hand===1?.8:-.6,k);}
  else if(q.f==='kick'){o[FF]=lerp(-3,6.6,k);o[FF+1]=-k*6.2;o[FF+2]=.3*k;o[PHX]-=k*1.2;o[CXI]-=k*1.8;}
  else if(q.f==='shove'){o[NH]=lerp(3.7,7.6,k);o[NH+1]=cy+1.8;o[FH]=lerp(2.5,7,k);o[FH+1]=cy+2.1;o[CXI]+=k*1.6;}
  else if(q.f==='hit'){o[CXI]-=k*2.6;o[PHX]-=k*.9;o[TILT]=-k*.36;o[HDX]-=k*.7;o[NH]=2.5;o[NH+1]=cy+3.4;o[FH]=1;o[FH+1]=cy+3.9;}
  else if(q.f==='block'){o[NH]=3;o[NH+1]=chin-.9;o[FH]=2.2;o[FH+1]=chin-1.1;o[CXI]-=k*.8;}
  else if(q.f==='talk'){const u=Math.sin(t*2.4+q.ph);poseStand(p,o);o[CXI]+=.4+u*.25;o[NH]=o[CXI]+5.2+u*1.1;o[NH+1]=o[CY]+.2+Math.sin(t*5+q.ph)*.8;o[TILT]=.05;}
}

/* ---------- events ---------- */
// Each kind of event waits its own exponentially distributed gap. m is the average gap in seconds, f the first wait.
const SCHED={car:{m:6.5,f:2},farbus:{m:210,f:80},near:{m:38,f:6},far:{m:9,f:2},pair:{m:95,f:40},loiter:{m:70,f:16},gazer:{m:240,f:90},waiter:{m:170,f:24},crosser:{m:65,f:26},cat:{m:170,f:45},dog:{m:220,f:100},fight:{m:640,f:300},window:{m:14,f:6},sign:{m:60,f:20},gust:{m:95,f:38},flyer:{m:45,f:10},plane:{m:190,f:60},drone:{m:120,f:50},siren:{m:380,f:220},sweeper:{m:520,f:240},rain:{m:560,f:300},vent:{m:9,f:3},sidecar:{m:7,f:1}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
nextEv.fight+=160;
const FLOORS=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth'];
function fire(k){
  if(k==='car'){if(chance(.4+.6*fbm(t*.004+TO)))spawnCar();}
  else if(k==='farbus'){const v=spawnBus(1,chance(.8)?pick(ROUTES):null);if(v)logOnce('fbus',60,v.route?`A ${v.route.n} goes by on the far side, lit up and nearly empty`:'A bus marked NOT IN SERVICE goes by on the far side');}
  else if(k==='near')spawnWalker(true);else if(k==='far')spawnWalker(false);else if(k==='pair')spawnPair();else if(k==='loiter')spawnLoiter();else if(k==='gazer')spawnGazer();else if(k==='waiter')spawnWaiter();else if(k==='crosser')spawnCrosser();
  else if(k==='cat')spawnCat();else if(k==='dog')spawnDog();else if(k==='fight')startFight();
  else if(k==='window'){const w=pick(DYNW);if(!w)return;if(!w.want&&chance(.4*sstep(0,2400,t)))return;w.want=1-w.want;w.rate=rr(.2,1.2);logOnce('win',60,w.want?`A light comes on, ${FLOORS[w.f]} floor across the road`:`A window goes dark on the ${FLOORS[w.f]} floor`);}
  else if(k==='sign'){const s=pick(SIGNS);if(s.seq)return;const p=[];let u=0;for(let i=ri(2,5)*2;i>0;i--){u+=rr(.05,.35);p.push(u);}s.seq={t0:t,p};logOnce('sign',180,`The ${s.word} sign across the road stutters`);}
  else if(k==='gust'){gustK=Math.max(gustK,.01);gustT=rr(2,4);gustD=(wind>=0?1:-1)*(chance(.8)?1:-1);const strong=chance(.3);gustT*=strong?2:1;gustA=strong?1:rr(.4,.75);if(gustA>.6)log(pick(['A gust goes through the tree and the air fills with petals','The wind picks up, and the whole tree lets go at once','Petals rush past the stop on a sudden breath of wind']));}
  else if(k==='flyer'){const d=chance(.5)?1:-1,z=rr(70,170),y=rr(22,62);flyers.push({x:-d*halfW(z)*1.05,y,z,v:d*rr(5,13)*z/90,c:pick(NEON),ph:rr(0,1),kind:chance(.5)?1:0});}
  else if(k==='plane'){const d=chance(.5)?1:-1,z=700;flyers.push({x:-d*halfW(z)*1.05,y:rr(180,300),z,v:d*rr(18,30),c:'#ff4a3a',ph:rr(0,1),kind:2});logOnce('plane',200,'A plane blinks across the gap in the sky');}
  else if(k==='drone'){const d=chance(.5)?1:-1,z=rr(5,12),y=rr(5.2,8.6);drones.push({x:-d*(halfW(z)+1),y,z,v:d*rr(1.5,3.2),s:rr(0,9),kind:'parcel',col:pick(NEON)});logOnce('drone',120,'A delivery drone hums overhead with a box in its claws');}
  else if(k==='siren'){const d=chance(.5)?1:-1,z=rr(7,11);drones.push({x:-d*(halfW(z)+1),y:rr(6,8),z,v:d*rr(2.2,3.2),s:rr(0,9),kind:'police',col:'#ff2a3a'});log('A police drone drifts down the road, its searchlight sweeping the shopfronts');}
  else if(k==='sweeper'){if(sweeper)return;const d=chance(.5)?1:-1;sweeper={x:edgeX(2.85,-d,.8),z:2.85,d,v:rr(.5,.7),ph:0};log('A little street-sweeping robot comes along, pushing petals into a line');}
  else if(k==='rain'){if(raining){raining=false;log('The rain eases off');}else if(chance(MOOD.rain+.1)){raining=true;log(pick(['It starts to rain, and the petals come down faster','A light rain starts to fall through the branches']));}}
  else if(k==='vent'){const x=VENT.x;for(let i=0;i<3;i++)puffs.push({x:x+rr(-.2,.2),y:.1,z:VENT.z,r:rr(.2,.4),v:rr(.35,.7),life:rr(3,6),age:0,col:'#e8e0f0',a:.16});}
  else if(k==='sidecar'){const a=chance(.5),i=a?1:-1,x=GAPX+i*(GAPW/2-1.6-.9);sidecars.push({x,z:a?26:150,v:a?rr(6,10):-rr(6,10),c:a?'#ff3040':'#fff0d0',a:0});}
}
let gustA=.7;
const VENT={x:(GX0-rr(3,8)),z:FKERB+.8};

/* ---------- update ---------- */
function update(dt){
  t+=dt;
  wind=(fbm(t*.01+WO)-.5)*.5;
  if(gustT>0){gustT-=dt;gustK=Math.min(gustA,gustK+dt*.3);}else gustK=Math.max(0,gustK-dt*.08);
  for(const k in SCHED){nextEv[k]-=dt;if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);fire(k);}}
  // The next bus on the stop's board.
  upcoming.at-=dt;if(upcoming.at<=0){const v=spawnBus(0,upcoming.route);if(v){upcoming={route:pick(ROUTES),at:rr(45,110)+expo(90)};}else upcoming.at=2;}
  // Weather: the road takes a while to get wet and much longer to dry.
  wet+=((raining?1:0)-wet)*dt/(raining?40:220);rainK+=((raining?1:0)-rainK)*dt/6;
  if(rainK>.02){let n=rainK*CW*.028*dt*60*.2;while(n>0){if(R()<n)drops.push({x:rr(-30,CW+30),y:rr(-40,0),v:rr(.9,1.25)*CH,stop:rr(HY,CH),sl:wind*.05});n-=1;}}
  for(const d of drops){if(d.sp===undefined){d.y+=d.v*dt;d.x+=d.v*d.sl*dt;if(d.y>=d.stop)d.sp=.08;}else d.sp-=dt;}
  drops=drops.filter(d=>!(d.sp!==undefined&&d.sp<=0));
  updPetals(dt);
  for(const w of DYNW)w.on+=(w.want-w.on)*Math.min(1,dt/w.rate*3);
  for(const s of SIGNS)if(s.seq){const x=t-s.seq.t0;let on=1;for(const q of s.seq.p)if(x>q)on=1-on;s.on=on;if(x>s.seq.p[s.seq.p.length-1]){s.seq=null;s.on=1;}}
  // Traffic: each keeps its distance from the one ahead, and gives way to anyone on the crossing.
  crossHold=people.some(p=>p.cross);
  for(const v of veh){
    let gap=1e9;for(const o of veh)if(o!==v&&o.lane===v.lane){const q=(o.front-o.d*o.L-v.front)*v.d;if(q>-1&&q<gap)gap=q;}
    let want=v.cruise*(.85+.3*noise(t*.07+v.s));if(gap<1e8)want=Math.min(want,Math.max(0,(gap-1.5)*1.1));
    if(crossHold){const q=(XW-v.d*2.4-v.front)*v.d;if(q>-.6&&q<15)want=Math.min(want,Math.max(0,q*.75));}
    if(v.kind==='bus')want=updBus(v,dt,want);
    if(v.state==='dwell'||v.state==='close')v.v=0;
    else{v.brk=v.v>want+.4;v.v=v.v<want?Math.min(want,v.v+2.4*dt):Math.max(want,v.v-5.5*dt);}
    {const a=(v.v-(v.pv??v.v))/Math.max(dt,1e-3);v.pv=v.v;v.pa=(v.pa||0)+(clamp(a,-6,4)*.0042-(v.pa||0))*Math.min(1,dt*7);v.pitch=(v.pitch||0)+(v.pa-(v.pitch||0))*Math.min(1,dt*9);}
    v.front+=v.d*v.v*dt;v.rot=((v.rot||0)+v.v*dt/(v.kind==='bus'?BUSWR:KINDS[v.kind].r))%TAU;
  }
  veh=veh.filter(v=>{const rear=v.front-v.d*v.L;return v.d*rear<halfW(v.z)+2;});
  for(const p of people){if(p.state==='watch'){p.t-=dt;if(p.t<=0){const w=p.watch;p.state='idle';if(w&&p.tx!==undefined)go(p,w.tx,w.tz,w.sp,w.then);}}else if(p.state!=='fight')updPerson(p,dt);}
  updFight(dt);
  for(const p of people)moveBody(p,dt);
  people=people.filter(p=>!p.dead);
  for(const b of beasts){if(b.kind==='cat')updCat(b,dt);else updDog(b,dt);moveBeast(b,dt);}beasts=beasts.filter(b=>!b.dead);
  for(const q of puffs){q.age+=dt;q.y+=q.v*dt;q.x+=(wind*.6+gustD*gustK)*dt;q.r+=dt*.16;}puffs=puffs.filter(q=>q.age<q.life);
  for(const q of sparks){q.age+=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy-=6*dt;}sparks=sparks.filter(q=>q.age<q.life);
  for(const f of flyers)f.x+=f.v*dt;flyers=flyers.filter(f=>Math.abs(f.x)<halfW(f.z)*1.2);
  for(const d of drones)d.x+=d.v*dt;drones=drones.filter(d=>Math.abs(d.x)<halfW(d.z)+3);
  for(const c of clouds){c.x+=(c.v+wind*CW*.002)*dt;if(c.x>CW+20)c.x=-c.w-20;if(c.x<-c.w-30)c.x=CW+10;}
  for(const c of sidecars){c.z+=c.v*dt;c.a=Math.min(1,c.a+dt);}sidecars=sidecars.filter(c=>c.z<160&&c.z>24);
  if(sweeper){const s=sweeper;s.x+=s.d*s.v*dt;s.ph+=dt*9;if(Math.abs(s.x)>halfW(s.z)+1.2&&s.x*s.d>0)sweeper=null;}
  if(cpg&&t-carpetT>1.5)flushCarpet();
}

/* ---------- live drawing ---------- */
function glowSprite(col){const n=128,[c,g]=mk(n,n);g.fillStyle=rad(g,64,64,0,64,[[0,rgba(col,1)],[.12,rgba(col,.6)],[.4,rgba(col,.16)],[1,rgba(col,0)]]);g.fillRect(0,0,n,n);return c;}
const GL={warm:glowSprite('#ffc078'),white:glowSprite('#fff2dc'),red:glowSprite('#ff2a1a'),amber:glowSprite('#ffa020'),cool:glowSprite('#bfe6ff'),soft:glowSprite('#ffffff'),blue:glowSprite('#3a6aff'),pink:glowSprite('#ff7ab0')};
function flareSprite(col){const[c,g]=mk(256,12);g.fillStyle=lin(g,0,0,256,0,[[0,rgba(col,0)],[.42,rgba(col,.5)],[.5,'rgba(255,255,255,1)'],[.58,rgba(col,.5)],[1,rgba(col,0)]]);g.fillRect(0,4,256,4);return soften(c,1.6);}
const FLARE={white:flareSprite('#bfe0ff'),red:flareSprite('#ff3a2a')};
function glow(g,spr,x,y,rx,a,ry){if(a<=0)return;g.globalAlpha=Math.min(1,a);g.drawImage(spr,x-rx,y-(ry??rx),2*rx,2*(ry??rx));g.globalAlpha=1;}
function bakeSign(s){
  const k=F/s.z,px=Math.max(6,s.m*k),font=`800 ${px}px ${SANS}`,pad=px*.42,m=px*1.1,[,tg]=mk(1,1);tg.font=font;
  const w=tg.measureText(s.word).width+pad*2,h=px*1.5,[c,g]=mk(w+m*2,h+m*2),col=s.col;
  g.translate(m,m);
  if(s.board){g.fillStyle='#0c0a16';rrect(g,0,0,w,h,px*.1);g.fill();g.strokeStyle=rgba(col,.8);g.lineWidth=Math.max(1,px*.05);g.save();g.shadowColor=col;g.shadowBlur=px*.5;g.stroke();g.restore();}
  g.font=font;g.textAlign='center';g.textBaseline='middle';g.fillStyle=mixC(col,'#ffffff',.55);g.shadowColor=col;
  for(const b of[px*.7,px*.3]){g.shadowBlur=b;g.fillText(s.word,w/2,h/2+px*.04);}
  s.spr=c;s.pw=c.width;s.ph2=c.height;s.ax=c.width/2;s.ay=c.height/2;
}
function drawSigns(g){for(const s of SIGNS){const x=PX(s.x,s.z)-s.ax,y=PY(s.y,s.z)-s.ay;if(x>CW||x+s.pw<0||y>CH||y+s.ph2<0)continue;g.globalAlpha=s.on?.9+.1*noise(t*3+s.ph):.14;g.drawImage(s.spr,x,y);}g.globalAlpha=1;}
function drawWindows(g){const k=F/WALL;for(const w of DYNW){if(w.on<.03)continue;const[x,y,ww,wh]=winRect(w.b,w.f,w.c),px=PX(x,WALL),py=PY(y+wh,WALL);if(px>CW||px+ww*k<0)continue;
    if(!w.spr){const[c,cg]=mk(ww*k,wh*k);paintWindow(cg,0,0,c.width,c.height,w.col,w.b.s+w.f*13+w.c);w.spr=c;}g.globalAlpha=w.on;g.drawImage(w.spr,px,py,ww*k,wh*k);}g.globalAlpha=1;}
function drawFlyers(g){for(const f of flyers){const x=PX(f.x,f.z),y=PY(f.y,f.z),k=F/f.z;if(f.kind===2){ell(g,x,y,1.3,1.3,'#ff4a3a');if((t*1.2+f.ph)%1<.1){g.globalCompositeOperation='lighter';glow(g,GL.white,x,y,CH*.008,.9);g.globalCompositeOperation='source-over';}continue;}
    const w=k*(f.kind?5:3.4),h=k*1.1;g.fillStyle=mixC('#0e0c1a',HAZE,.3);rrect(g,x-w/2,y-h/2,w,h,h*.4);g.fill();g.fillStyle=rgba(f.c,.9);g.fillRect(x-w*.38,y+h*.1,w*.76,Math.max(1,h*.14));g.globalCompositeOperation='lighter';glow(g,GL.white,x+Math.sign(f.v)*w*.5,y,k*1.6,.7);glow(g,GL.red,x-Math.sign(f.v)*w*.5,y,k*1.2,.8);g.globalCompositeOperation='source-over';}}
function drawPerson(p){
  const z=p.z,k=F/z,U=k*UNIT,x=PX(p.x,z),y=PY(groundAt(z),z);if(x<-U*30||x>CW+U*30||!p.J)return;
  if(!p.L||Math.abs(p.L.x-p.x)>.2){p.L=lightAt(p.x,z);p.T=figTones(p,p.L);}
  shadowOn(x,y,U*3.6,U*3.6*EYE/z*.9,.6);
  if(z>KERB&&z<FKERB&&sheenNow()>.15){ctx.globalAlpha=sheenNow()*.24;drawBody(ctx,p,x,y,U,null,-.6);ctx.globalAlpha=1;}
  drawBody(ctx,p,x,y,U);
  if(p.flashAt&&t-p.flashAt<.12){ctx.globalCompositeOperation='lighter';glow(ctx,GL.white,x+p.dir*U*4,y-U*(p.h+1),U*7,.9);ctx.globalCompositeOperation='source-over';}
  if(p.dog&&p.state==='walk'&&p.dog.ta){const d=p.dog,dx=p.x+p.dir*.92,dz=z+.08,kk=F/dz,Ud=kk*d.hm/100,xx=PX(dx,dz),yy=PY(groundAt(dz),dz);ctx.strokeStyle=rgba(INK,.9);ctx.lineWidth=Math.max(1,U*.12);ctx.beginPath();ctx.moveTo(x+p.dir*U*2,y-U*9.2);ctx.quadraticCurveTo((x+xx)/2,y-U*3.6,xx+p.dir*Ud*40,yy-Ud*70);ctx.stroke();shadowOn(xx,yy,Ud*62,Ud*16,.4);drawQuad(ctx,d,xx,yy,Ud,lightAt(dx,dz));}
}
function drawBeast(b){
  const z=b.z,k=F/z,x=PX(b.x,z),y=PY(groundAt(z),z),U=k*b.hm/100;if(x<-k*3||x>CW+k*3||!b.ta)return;
  shadowOn(x,y,U*(b.sv==='sit'?48:70),U*(b.sv==='sit'?48:70)*EYE/z*.9,.56);
  drawQuad(ctx,b,x,y,U,lightAt(b.x,z));
}
function drawVeh(v){
  const k=F/v.z,y=PY(ROAD,v.z),xr=PX(v.front-v.d*v.L,v.z),xf=PX(v.front,v.z);if(Math.max(xr,xf)<-k*2||Math.min(xr,xf)>CW+k*2)return;
  shadowOn((xr+xf)/2,y,Math.abs(xf-xr)*.58,k*.26,.72);
  if(v.kind==='bus'){drawBus(v,k,y,xr,xf);vehLights(v,k,y,xr,xf);return;}
  const K=KINDS[v.kind],pad=.4,sw=v.spr.width,sh=v.spr.height,g=ctx,W=wheelSprite(K.r*k,v.hub),m=sheenNow()*.3;
  if(v.under){g.save();g.globalCompositeOperation='lighter';g.translate((xr+xf)/2,y);g.scale(Math.abs(xf-xr)*.62,k*.34);g.fillStyle=rad(g,0,0,0,1,[[0,rgba(v.under,.55)],[1,rgba(v.under,0)]]);g.fillRect(-1,-1,2,2);g.restore();}
  g.save();g.translate(xr,y);g.scale(v.d,1);const ox=-pad*k,oy=-(K.H+.7)*k;
  if(m>.02){g.save();g.scale(1,-.6);g.globalAlpha=m;g.drawImage(v.spr,ox,oy,sw,sh);g.restore();}
  for(const wx of K.w)drawWheel(g,wx*k,-K.r*k,W,v.rot||0,v.v);
  // The body rides on its springs: nose down under braking, back when it pulls away.
  const bob=Math.sin(t*7+v.s)*k*.003*Math.min(1,v.v/3),cx=K.L*k/2;g.translate(cx,bob);g.rotate(-(v.pitch||0));g.translate(-cx,0);
  g.drawImage(v.spr,ox,oy,sw,sh);
  // The street's colours slide along the body as it goes.
  if(v.clipP){g.clip(v.clipP,'evenodd');g.globalAlpha=.3;g.drawImage(STRIP,clamp(xf/CW,0,.7)*STRIP.width,0,STRIP.width*.3,48,ox,oy,sw,sh);}
  g.restore();
  vehLights(v,k,y,xr,xf);
}
// A hot light flares in a long thin line across the lens.
function flare(g,x,y,len,col,a){g.globalAlpha=a;g.drawImage(FLARE[col],x-len,y-len*.024,len*2,len*.048);g.globalAlpha=1;}
function vehLights(v,k,y,xr,xf){
  const g=ctx,d=v.d,bus=v.kind==='bus',bike=v.kind==='bike',hy=y-k*(bike?.82:v.kind==='truck'?.92:bus?.77:v.kind==='van'?.98:.7),ty=y-k*(bike?.86:v.kind==='truck'?1:bus?1.17:v.kind==='van'?1.04:.76),brk=v.brk||v.state==='brake'||v.state==='dwell',blink=v.ind&&(t*1.7)%1<.5;
  g.globalCompositeOperation='lighter';
  g.fillStyle=lin(g,xf,0,xf+d*k*9,0,[[0,'rgba(255,248,220,.28)'],[1,'rgba(255,248,220,0)']]);poly(g,[[xf,hy-k*.05],[xf+d*k*9,hy-k*.5],[xf+d*k*9,y+k*.24],[xf,hy+k*.08]]);g.fill();
  glow(g,GL.white,xf-d*k*.05,hy,k*.5,.95);glow(g,GL.white,xf+d*k*3,y+k*.06,k*3.4,.2,k*.3);flare(g,xf-d*k*.05,hy,k*2.4,'white',.5);
  glow(g,GL.red,xr+d*k*.04,ty,k*(brk?.66:.38),brk?1:.7);flare(g,xr+d*k*.04,ty,k*(brk?1.6:.9),'red',brk?.55:.3);
  if(blink){glow(g,GL.amber,xf-d*k*.1,hy-k*.14,k*.36,.9);glow(g,GL.amber,xr+d*k*.1,ty-k*.14,k*.36,.9);}
  if(v.kind==='taxi'&&v.free)glow(g,GL.warm,(xr+xf)/2-d*k*.06,y-k*1.56,k*.8,.5);
  if(v.box)glow(g,GL.pink,xr+d*k*.2,y-k*1.2,k*.8,.6);
  if(v.kind!=='bus'&&sheenNow()>.2){const a=sheenNow()*.5;glow(g,GL.white,xf,y+k*.5,k*.26,a,k*.8);glow(g,GL.red,xr,y+k*.5,k*.2,a,k*.7);}
  g.globalCompositeOperation='source-over';
}
function drawBus(v,k,y,xr,xf){
  const S=v.sp,g=ctx,ox=-BPAD*k,oy=-(BUSH+.4)*k,lit=v.nis?.32:1,W=wheelSprite(BUSWR*k,'#6a6e7c');
  g.save();g.globalCompositeOperation='lighter';g.fillStyle=rad(g,(xr+xf)/2,y+k*.3,0,Math.abs(xf-xr)*.6,[[0,`rgba(255,236,190,${.16*lit})`],[1,'rgba(255,236,190,0)']]);g.translate(0,y);g.scale(1,.2);g.translate(0,-y);g.fillRect(Math.min(xr,xf)-k,y-k*8,Math.abs(xf-xr)+k*2,k*16);g.restore();
  g.save();g.translate(xr,y);g.scale(v.d,1);
  for(const wx of BUSW)drawWheel(g,wx*k,-BUSWR*k,W,v.rot||0,v.v);
  const cx=BUSL*k/2;g.translate(cx,0);g.rotate(-(v.pitch||0));g.translate(-cx,0);
  g.globalAlpha=lit;g.drawImage(S.inner,ox,oy);g.globalAlpha=1;
  if(!v.nis){for(const q of v.pax){const x=q.seat*k,hy=-1.86*k;g.fillStyle=shade(q.o.coat,-.3);rrect(g,x-.2*k,hy+.12*k,.4*k,.56*k,.1*k);g.fill();ell(g,x+.03*k,hy,.13*k,.14*k,q.o.skin);g.fillStyle=q.o.hair;g.beginPath();g.arc(x+.02*k,hy-.03*k,.14*k,Math.PI,TAU);g.fill();}
    g.fillStyle='#16141e';rrect(g,(BUSL-1.5)*k,-2.2*k,.4*k,.64*k,.1*k);g.fill();ell(g,(BUSL-1.3)*k,-2.3*k,.13*k,.15*k,'#d8a07a');}
  g.drawImage(S.glass,ox,oy);
  for(const[a,b]of busDoors){const w=(b-a)/2,lw=w*(1-.86*v.doorK);g.fillStyle='rgba(14,18,30,.55)';g.fillRect(a*k,-2.6*k,lw*k,2.1*k);g.fillRect((b-lw)*k,-2.6*k,lw*k,2.1*k);g.strokeStyle='#0e0c14';g.lineWidth=Math.max(1,k*.03);g.strokeRect(a*k,-2.6*k,lw*k,2.1*k);g.strokeRect((b-lw)*k,-2.6*k,lw*k,2.1*k);}
  g.drawImage(S.body,ox,oy);
  g.restore();
  // The sign along its side, the same way round whichever way it faces.
  const page=Math.floor(t/2.4)%2,str=v.nis?(page?'SERVICE':'NOT IN'):page?v.route.dest:v.route.n,d=k*.04,w=textW(str)*d,cx2=xr+v.d*BUSL*.5*k;
  led(g,str,cx2-w/2,y-2.97*k,d,'#ffbe48');
  g.globalCompositeOperation='lighter';glow(g,GL.amber,cx2,y-2.87*k,w*.7,.24,k*.26);g.globalCompositeOperation='source-over';
}
function drawPole(){
  const P=POLEC,z=3.05,x=PX(POLE,z),y=PY(0,z),g=ctx,ox=x-P.cx,oy=y-P.y0,k=P.k;if(x<-k||x>CW+k)return;
  g.drawImage(P.c,ox,oy);
  const r=upcoming.route,mins=Math.ceil(upcoming.at/60),l1=r.n,due=upcoming.at<30,l2=due?'DUE':mins+' MIN',key=l1+l2;
  if(P.key!==key){P.key=key;const q=P.tg,d=P.w/30,w=P.tc.width,l3=STOP.split(' ')[0].toUpperCase().slice(0,7),d3=d*.72;q.clearRect(0,0,w,P.tc.height);led(q,l1,w/2-textW(l1)*d/2,0,d,'#ffbe48');led(q,l2,w/2-textW(l2)*d/2,7*d,d,due?'#7aff9a':'#ffbe48');led(q,l3,w/2-textW(l3)*d3/2,15*d,d3,'#7ad8ff');}
  g.drawImage(P.tc,ox+P.cx-P.tc.width/2,oy+P.top+P.h*.14);
  g.globalCompositeOperation='lighter';glow(g,GL.amber,ox+P.cx,oy+P.top+P.h/2,P.w*.9,.2,P.h*.8);g.globalCompositeOperation='source-over';
}
function drawSweeper(){
  INKED=true;const s=sweeper,k=F/s.z,x=PX(s.x,s.z),y=PY(0,s.z),U=k*UNIT,g=ctx,L=lightAt(s.x,s.z),d=s.d,sh=tones('#d4d0c8',L),dk=tones('#3a3a46',L),lod=U>6?2:1;shadowOn(x,y,U*5,U*1.5,.6);
  g.setTransform(U*d,0,0,U,x,y);SHX=L.lx*d*1.6;SHY=L.ly*1.6;
  for(const q of[-2.3,2.3]){const w=ellP(q,-.8,.84,.84);shadeP(g,w,dk,lod);inkP(g,w);g.strokeStyle=sh.d;g.lineWidth=.12;g.beginPath();g.moveTo(q,-.8);g.lineTo(q+Math.cos(s.ph*.4)*.6,-.8+Math.sin(s.ph*.4)*.6);g.stroke();}
  const b=rrP(-3.5,-5.7,7,4.7,1.7);shadeP(g,b,sh,lod);inkP(g,b);
  if(lod>1){g.save();g.clip(b);g.fillStyle=dk.b;g.fillRect(-3.6,-2.2,7.2,1.3);g.fillStyle=ADC[0];g.fillRect(-3.6,-2.4,7.2,.18);texFill(g,GRIME,-4,-6,8,6,.02,0,0,.9);g.restore();g.strokeStyle=sh.d;g.lineWidth=.08;g.beginPath();g.moveTo(-1.2,-5.6);g.lineTo(-1.2,-1);g.moveTo(1.2,-5.6);g.lineTo(1.2,-1);g.stroke();}
  const dm=ellP(0,-5.7,2.6,1);shadeP(g,dm,dk,lod);inkP(g,dm);
  const ar=tubeP([[2.6,-2.6],[3.6,-1.8],[4,-.9]],[.24,.2,.16],2);shadeP(g,ar,dk,lod);inkP(g,ar);g.strokeStyle='#d8b040';g.lineWidth=.16;g.lineCap='round';for(let i=0;i<9;i++){const a=s.ph+i*.7;g.beginPath();g.moveTo(4,-.8);g.lineTo(4+Math.cos(a)*1.3,-.5+Math.abs(Math.sin(a))*.5);g.stroke();}
  g.fillStyle='#08080e';rrect(g,.4,-4.7,2.6,1.4,.4);g.fill();g.fillStyle='#2af0ff';g.beginPath();g.ellipse(1.1,-4,.46,.26+.1*Math.sin(s.ph*.3),0,0,TAU);g.fill();g.beginPath();g.ellipse(2.3,-4,.3,.22+.08*Math.sin(s.ph*.3),0,0,TAU);g.fill();
  g.setTransform(1,0,0,1,0,0);
}
function drawDrone(d){
  const g=ctx,k=F/d.z,x=PX(d.x,d.z),y=PY(d.y,d.z)+Math.sin(t*2+d.s)*k*.05;
  if(d.kind==='police'){const a=Math.sin(t*.8+d.s)*2.4,gx=PX(d.x+a,d.z),gy=PY(0,d.z);g.globalCompositeOperation='lighter';g.fillStyle=lin(g,0,y,0,gy,[[0,'rgba(190,220,255,.3)'],[1,'rgba(190,220,255,.03)']]);poly(g,[[x-k*.05,y],[x+k*.05,y],[gx+k*.9,gy],[gx-k*.9,gy]]);g.fill();glow(g,GL.cool,gx,gy,k*1,.5,k*.3);g.globalCompositeOperation='source-over';}
  g.fillStyle='#14121c';rrect(g,x-k*.34,y-k*.08,k*.68,k*.16,k*.05);g.fill();g.strokeStyle='#14121c';g.lineWidth=Math.max(1,k*.03);g.beginPath();g.moveTo(x-k*.62,y-k*.14);g.lineTo(x+k*.62,y-k*.14);g.stroke();
  g.fillStyle=rgba('#c8d0dc',.4);for(const s of[-1,1])ell(g,x+s*k*.62,y-k*.16,k*.24,k*.03,rgba('#c8d0dc',.4));
  if(d.kind==='parcel'){g.fillStyle='#b88a58';g.fillRect(x-k*.2,y+k*.1,k*.4,k*.28);g.fillStyle='#8a6a3e';g.fillRect(x-k*.2,y+k*.2,k*.4,k*.03);}
  g.globalCompositeOperation='lighter';if(d.kind==='police'){const b=(t*2.6)%1<.5;glow(g,b?GL.red:GL.blue,x,y,k*.9,.95);}else glow(g,GL.soft,x+Math.sign(d.v)*k*.34,y,k*.2,.8);g.globalCompositeOperation='source-over';
}
const sheenNow=()=>clamp(MOOD.sheen+wet*.5,0,1);
function drawBoughs(g,layer){for(const B of BOUGHS){if(B.layer!==layer)continue;const a=B.amp*((noise(t*B.f+B.s)-.5)*2.2+.45*Math.sin(t*B.f*2.3+B.s)*(.4+Math.abs(wind)))+gustK*gustD*B.amp*1.6*(.8+.4*Math.sin(t*2+B.s)),ca=Math.cos(a),sa=Math.sin(a);
    g.setTransform(ca,sa,-sa,ca,B.px,B.py);g.drawImage(B.c,B.x0-B.px,B.y0-B.py,B.w,B.h);}g.setTransform(1,0,0,1,0,0);}
// Only the parts of a layer that hold anything are drawn.
const part=(g,c,rects)=>{for(const[x,y,w,h]of rects)g.drawImage(c,x,y,w,h,x,y,w,h);};
function draw(){
  const g=ctx;g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.imageSmoothingEnabled=true;
  g.drawImage(SKY,0,0);
  for(const c of clouds){g.globalAlpha=c.a;g.drawImage(c.img,c.x,c.y,c.w,c.h);}g.globalAlpha=1;
  drawFlyers(g);
  g.drawImage(CITY,0,0);
  drawWindows(g);drawSigns(g);
  g.globalCompositeOperation='lighter';for(const c of sidecars){const k=F/c.z,x=PX(c.x,c.z),y=PY(.72,c.z),a=c.a*.9*(1-fogK(c.z)*.6);if(c.v>0){glow(g,GL.red,x-k*.7,y,Math.max(1.6,k*.34),a);glow(g,GL.red,x+k*.7,y,Math.max(1.6,k*.34),a);}else{glow(g,GL.white,x-k*.7,y,Math.max(2,k*.5),a);glow(g,GL.white,x+k*.7,y,Math.max(2,k*.5),a);}}
  if(wet>.02){g.globalAlpha=wet*.25;g.drawImage(REFL,0,REFY);g.globalAlpha=1;}g.globalCompositeOperation='source-over';
  g.drawImage(CARPET,0,CARY);for(const p of landQ)stamp(g,p,0);g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;
  // The street, far to near, with the petals in among it at their own depths.
  const L=[];
  for(const p of people)L.push([p.z,0,p]);for(const b of beasts)L.push([b.z,1,b]);for(const v of veh)L.push([v.z,2,v]);for(const d of drones)L.push([d.z,3,d]);
  if(sweeper)L.push([sweeper.z,5,null]);L.push([3.05,4,null]);
  for(const q of[[11,99],[7.5,11],[4.2,7.5],[2.35,4.2]])L.push([q[0]-.001,6,q]);
  L.sort((a,b)=>b[0]-a[0]);
  for(const[,k,o]of L){if(k===0)drawPerson(o);else if(k===1)drawBeast(o);else if(k===2)drawVeh(o);else if(k===3)drawDrone(o);else if(k===4)drawPole();else if(k===5)drawSweeper();else drawPetals(g,o[0],o[1]);}
  for(const q of puffs){const k=F/q.z,x=PX(q.x,q.z),y=PY(q.y,q.z),u=q.age/q.life;glow(g,GL.soft,x,y,q.r*k,q.a*(1-u)*Math.min(1,u*6));}
  if(sparks.length){g.globalCompositeOperation='lighter';for(const q of sparks){const k=F/q.z,x=PX(q.x,q.z),y=PY(q.y,q.z);g.fillStyle=q.col;g.globalAlpha=1-q.age/q.life;g.fillRect(x,y,Math.max(1.4,k*.03),Math.max(1.4,k*.03));}g.globalAlpha=1;g.globalCompositeOperation='source-over';}
  // Rain, in front of the street and behind the tree.
  if(drops.length){g.strokeStyle='rgba(205,220,250,.32)';g.lineWidth=Math.max(1,CH*.0014);g.beginPath();for(const d of drops){if(d.sp!==undefined){g.moveTo(d.x-3,d.y);g.lineTo(d.x+3,d.y);}else{g.moveTo(d.x,d.y-CH*.05);g.lineTo(d.x+wind*8,d.y);}}g.stroke();}
  drawBoughs(g,0);part(g,TRUNK,TRK);drawBoughs(g,1);part(g,FG,FGR);drawBoughs(g,2);
  drawPetals(g,0,2.35);
}

/* ---------- build ---------- */
const GRAIN=(()=>{const n=160,r=stream('grain'),[c,g]=mk(n,n),img=g.createImageData(n,n);for(let i=0;i<img.data.length;i+=4){const v=r()-.5;img.data[i]=img.data[i+1]=img.data[i+2]=v>0?255:0;img.data[i+3]=Math.abs(v)*2*20;}g.putImageData(img,0,0);return c;})();
function build(){
  const vw=Math.max(200,innerWidth),vh=Math.max(150,innerHeight);
  let dpr=LOWQ?.75:Math.min(2,devicePixelRatio||1);const maxPx=LOWQ?1.2e6:2.8e6;if(vw*vh*dpr*dpr>maxPx)dpr=Math.sqrt(maxPx/(vw*vh));dpr*=QK;
  CW=cv.width=Math.round(vw*dpr);CH=cv.height=Math.round(vh*dpr);TALL=CH>CW*1.1;
  // The lens: as wide as a landscape window allows, and wide enough on a phone to keep a car on the screen.
  F=Math.min(.72*CH,Math.max(.62*CW,.42*CH));HY=CH*(TALL?.63:.6);CX=CW/2;SKYH=Math.ceil(HY+2);
  POLE=ND*Math.min(1.9,halfW(3.05)*.62);BUSZ={};
  SHAD=rad(ctx,0,0,0,1,[[0,'rgba(6,4,14,.85)'],[1,'rgba(6,4,14,0)']]);
  for(const s of SIGNS)bakeSign(s);for(const w of DYNW)w.spr=null;
  paintCity();paintSky();
  const by=Math.round(PY(0,WALL));
  {const keep=CITY,[c2,g2]=mk(CW,by);g2.drawImage(keep,0,0);for(const s of SIGNS)g2.drawImage(s.spr,PX(s.x,s.z)-s.ax,PY(s.y,s.z)-s.ay);CITY=c2;paintRefl();CITY=keep;}
  // The night's sheen on the road and a fine grain over everything are painted in once, not drawn every frame.
  {const g=CITY.getContext('2d');const mir=mk(CW,by);mir[1].drawImage(CITY,0,0,CW,by,0,0,CW,by);for(const s of SIGNS)mir[1].drawImage(s.spr,PX(s.x,s.z)-s.ax,PY(s.y,s.z)-s.ay);g.globalCompositeOperation='lighter';g.globalAlpha=.1+MOOD.sheen*.5;g.drawImage(REFL,0,REFY);g.globalAlpha=1;g.globalCompositeOperation='source-over';paintPuddles(g,mir[0],by);gradeCity();g.globalCompositeOperation='source-atop';g.fillStyle=g.createPattern(GRAIN,'repeat');g.globalAlpha=.5;g.fillRect(0,0,CW,CH);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    const k=SKY.getContext('2d');k.fillStyle=k.createPattern(GRAIN,'repeat');k.globalAlpha=.35;k.fillRect(0,0,CW,SKYH);k.globalAlpha=1;}
  CARY=by;[CARPET,cpg]=mk(CW,CH-by);
  paintTree();paintFG();paintPole();busSprites(NLANE);busSprites(FLANE);
  {const fw=Math.round(CW*.16),fx=TS<0?CW-fw:0,ry=Math.round(CH*.14);FGR=[[0,0,CW,ry],[fx,ry,fw,CH-ry]];if(TRUNK){const w=Math.round(CW/2-CH);TRK=[[TS<0?0:CW-w,0,w,CH]];}}
  // A scatter of petals already on the ground, thicker near the tree.
  {const r=stream('fallen');for(let i=0;i<620;i++){const z=lerp(nearZ0(),12,r()**2.2),hw=halfW(z),x=(r()*2-1)*hw+TS*r()*hw*.3;stamp(cpg,{x,z,rot:r()*TAU,size:.02,tone:Math.floor(r()*3)},CARY);}cpg.setTransform(1,0,0,1,0,0);cpg.globalAlpha=1;}
  clouds=[];for(let i=0;i<3;i++){const w=CW*(.3+.3*h3(i,1,6)),h=CH*(.08+.06*h3(i,2,6));clouds.push({img:cloudSprite(Math.round(w),Math.round(h),i*7+1),x:h3(i,3,6)*CW,y:HY*(.1+.42*h3(i,4,6)),w,h,v:(h3(i,5,6)-.5)*CW*.006,a:.5+.3*MOOD.mist});}
}

function rebuild(){build();for(const v of veh){if(v.kind==='bus')v.sp=busSprites(v.z);else v.spr=carSprite(v);}draw();}
// A slow machine gets a smaller canvas rather than a slow scene. A repaint is a long pause, so this only happens in the
// first moments after the page opens, never in the middle of a night. Embeds are held to about 30 fps, so they get more room.
let paceN=0,paceT=0,paceL=0,paceEnd=0;
function pace(){if(paceEnd<0)return;const n=performance.now(),d=n-paceL;paceL=n;if(!paceEnd)paceEnd=n+9000;if(n>paceEnd){paceEnd=-1;return;}if(d>100||document.hidden)return;paceT+=d;if(++paceN<90)return;const a=paceT/paceN;paceN=paceT=0;if(a>(LOWQ?46:25)&&QK>.55){QK*=.78;rebuild();}}

/* ---------- start ---------- */
build();
if(chance(MOOD.rain*.4)){raining=true;wet=1;rainK=1;}
for(let i=0,n=Math.round(CAP*.75);i<n;i++){const p=shed();p.y=rr(groundAt(p.z)+.05,p.y);}
for(let i=0;i<60*40;i++)update(1/60);
warming=false;
const routeList=ROUTES.map(r=>r.n).join(ROUTES.length>2?', ':' and ').replace(/, ([^,]*)$/,' and $1');
log(`${MOOD.name} at the ${STOP} stop. The ${TREE.name} cherry over the bench is in full bloom`);
log(`The ${routeList} stop here. You are in no hurry`);
// With ?debug, draws one part of the scene large on a plain ground, frame by frame, for checking shape and motion.
let LAB=false;
function lab(kind,seedLook){
  N.paused=true;LAB=true;const g=ctx;g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.fillStyle='#14121e';g.fillRect(0,0,CW,CH);
  const L={a:[.8,.78,.92],c:[1,.8,.3],k:.75,s:[8,6,16],lx:-.2,ly:.15,x:0},n=seedLook||8;
  const mkP=(st)=>{const p=Object.assign(body(makeLook(st==='tough')),{id:PID++,state:'walk',view:'side',dir:1,ph:0,sp:1.3,v:1.3,amp:1,z:3,x:0,phone:false});p.L=L;p.T=figTones(p,L);moveBody(p,1/60);p.sv='side';p.sd=1;p.shown='r';p.turn=0;return p;};
  if(kind==='walk'||kind==='run'){const p=mkP();p.v=kind==='run'?3.4:1.3;const U=Math.min(CW/(n*11),CH/26);for(let i=0;i<n;i++){p.ph=i/n;poseWalk(p,POSE_W);p.hs=-p.v*.6;p.cs=-p.v*.42;drawBody(g,p,CW*(i+.5)/n,CH*.92,U,POSE_W);}}
  else if(kind==='cast'){const per=Math.max(3,Math.round(n/2));for(let i=0;i<n;i++){const p=mkP(i%3===2?'tough':'');const U=CH/2/25;p.ph=(i*.37)%1;poseWalk(p,POSE_W);drawBody(g,p,CW*((i%per)+.5)/per,CH*(i<per?.48:.97),U,POSE_W);}}
  else if(kind==='views'){const ps=['front','back','front','back','front','back'];ps.forEach((v,i)=>{const p=mkP();p.sv=v;p.amp=i<2?0:1;p.ph=i<4?.1:.35;p.state=i<2?'idle':'walk';p.J=new Float32Array(PN);poseStand(p,p.J);if(p.amp){poseWalk(p,POSE_W);p.J.set(POSE_W);}drawBody(g,p,CW*(i+.5)/6,CH*.95,CH/25);});}
  else if(kind==='big'){for(let i=0;i<n;i++){const p=mkP(i===n-1?'tough':'');p.ph=(i*.29+.1)%1;poseWalk(p,POSE_W);drawBody(g,p,CW*(i+.5)/n,CH*.985,CH/21.5,POSE_W);}}
  else if(kind==='head'){for(let i=0;i<4;i++){const p=mkP(i===3?'tough':'');const U=CH/8;poseStand(p,POSE_W);p.sv=i%2?'front':'side';p.amp=0;drawBody(g,p,CW*(i+.5)/4,CH*.5+U*(p.G.hipH+p.G.torso+1.6)-CH*.28,U,POSE_W);}}
  else if(kind==='cat'||kind==='dog'){const c=pick(CATC),mkB=i=>{const b=kind==='cat'?Object.assign({B:CATB,G:GAITS.walk,hm:.27,col:CATC[i%6][1],col2:CATC[i%6][2],chest:CATC[i%6][2],eye:CATC[i%6][3],stripes:i%6===4||i%6===1},{}):Object.assign(makeDog(i%2?2:1),{});return Object.assign(b,{id:PID++,state:'walk',sp:1,dir:1,seed:i*3.1,ph:i/n});};const U=CH/(kind==='cat'?2.6:2.5)/100;for(let i=0;i<n;i++){const b=mkB(i);b.state='walk';moveBeast(b,1/60);b.amp=1;b.sv='r';b.sd=1;b.ph=i/n;drawQuad(g,b,CW*((i%(n/2))+.5)/(n/2),CH*(i<n/2?.48:.97),U*(kind==='dog'?(.5/b.hm):1),L);}}
  else if(kind==='catsit'||kind==='dogsit'){for(let i=0;i<4;i++){const b=kind==='catsit'?{B:CATB,G:GAITS.walk,hm:.27,col:CATC[i+1][1],col2:CATC[i+1][2],chest:CATC[i+1][2],eye:CATC[i+1][3],stripes:i===0||i===3}:makeDog(1);Object.assign(b,{id:PID++,state:'sit',sp:0,dir:1,seed:i*2.3,look:(i-1.5)*.3,pant:i%2,wag:!!(i%2)});moveBeast(b,1/60);b.sv='sit';b.sd=1;drawQuad(g,b,CW*(i+.5)/4,CH*.95,CH/1.5/100,L);}}
  else if(kind==='cars'){const ks=['sedan','wedge','taxi','kei','van','truck','bike','bike'],z=NLANE;ks.forEach((kd,i)=>{const K=KINDS[kd],[,col]=CARC[(i*3+1)%10],v={kind:kd,z:z*(kd==='truck'?1.9:1.5),L:K.L,H:K.H,col:kd==='taxi'?'#e0c018':col,s:i*3.3,trim:NEON[i%7],hub:'#8a8a9a',stripe:i%2===0,rider:'#22182e',box:i===7,d:1,v:i%2?1:6,rot:i,front:0,pitch:0};v.spr=carSprite(v);const k=F/v.z,x=CW*((i%4)+.08)/4,y=CH*(i<4?.46:.94),W=wheelSprite(K.r*k,v.hub);g.save();g.translate(x,y);for(const wx of K.w)drawWheel(g,wx*k,-K.r*k,W,v.rot,v.v);g.drawImage(v.spr,-.4*k,-(K.H+.7)*k);g.restore();});}
  else if(kind==='bus'){const z=8.4,S=busSprites(z),k=F/z,v={v:0,rot:0,pitch:0,sp:S,nis:false,pax:[],doorK:.4,route:ROUTES[0],d:1,front:0,L:BUSL};drawBus(v,k,CH*.8,CW*.08,CW*.08+BUSL*k);}
  else if(kind==='fight'){const fs=['guard','jab','hook','kick','shove','hit','block','talk'];fs.forEach((f,i)=>{const p=mkP('tough');p.fg={f,k:.5,ph:1,hand:1,hurt:0};p.J=new Float32Array(PN);poseFight(p,p.J);p.amp=0;drawBody(g,p,CW*((i%4)+.5)/4,CH*(i<4?.48:.97),CH/2/25);});}
}
if(DEBUG)window.SK={lab,brawl:startFight,rebuild,people:()=>people,veh:()=>veh,beasts:()=>beasts,petals:()=>petals,stats,fire,draw:()=>draw(),step:update,pause(){N.paused=true;},resume(){N.paused=false;},get fight(){return fight;},
  run(sec){for(let i=0;i<sec*60;i++)update(1/60);draw();N.refresh();},
  state:()=>({t,people:people.length,veh:veh.length,beasts:beasts.length,petals:petals.length,raining,wet,gustK,fight:fight&&fight.phase,mood:MOOD.name,tree:TREE.name,side:TS})};
N.run({step:1/60,update,draw(){if(LAB)return;draw();pace();},ui:()=>N.stats(stats)});
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(rebuild,200);});
})();
