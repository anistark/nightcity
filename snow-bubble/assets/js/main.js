/* Snow Bubble. A little winter held inside a film of color. */
(()=>{
'use strict';
const N=window.NightCity,{R,rr,ri,pick,expo,noise,NT}=N;
const canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
const layer=()=>{const v=document.createElement('canvas');return[v,v.getContext('2d')];};
const [buffer,c]=layer(),[background,bg]=layer(),[scenery,sc]=layer(),[beast,beastContext]=layer(),[darkDot,dd]=layer(),[frostDisc,fd]=layer();
// Frost is baked as it grows: one layer for the near side of the shell, one for the far side, and a small copy for its glow.
const [laceFront,lf]=layer(),[laceBack,lb]=layer(),[laceGlow,lg]=layer(),[filmLayer,fl]=layer(),[veilLayer,vl]=layer(),[softDot,sd]=layer(),[laceFar,lr]=layer(),[pieceAtlas,pa]=layer(),[laceShade,ls]=layer(),[auroraLayer,al]=layer();
const crystalGeometry=new WeakMap(),pieceImage=new WeakMap(),laceBatch=new Map();
const TAU=Math.PI*2,GROUND=652,CONTACT=GROUND+38,CX=400;
// The camera looks slightly down, so a ring of latitude reads as an ellipse and the cold is seen climbing around the shell.
const TILT=.17,TC=Math.cos(TILT),TS=Math.sin(TILT);
const MOON=(()=>{const v=[-.46,-.72,.52],l=Math.hypot(...v);return v.map(n=>n/l);})();
const TIP_WANDER=[.022,.03,.05],TIP_WIDTH=[1.1,.72,.46],TIP_SPEED=[1,.62,.45],SEG=8,FILM=N.LOWQ?72:224,FIELD=N.LOWQ?56:96,COVER=28,HOP=6,LEVEL=[1.7,2,2.5];
// The ground recedes from the camera, so a bubble further back sits higher on the snow and looks smaller.
const nearness=z=>1+z/1000,snowAt=z=>CONTACT+z*.2;
const normal=()=>Math.sqrt(-2*Math.log(1-R()))*Math.cos(TAU*R());
const positive=(mean,spread)=>mean*Math.exp(normal()*spread-spread*spread/2);
const gap=mean=>Math.max(Number.EPSILON,expo(mean));
function sampleCount(mean){let count=0,event=gap(1);while(event<mean){count++;event+=gap(1);}return count;}
const stars=Array.from({length:sampleCount(positive(340,.12))},()=>({x:rr(.005,.995),y:rr(.015,.985),size:ri(1,18)===1?2:1,
 color:pick(['#c0d9ec','#eee2c0','#88aaca','#ced5ef']),alpha:rr(.18,.8),glitter:true,phase:rr(0,4000),rate:rr(.5,1.2)}));
// The same stylized main-star patterns as One Sock, not a location-specific chart.
const constellations=[
 {name:'Orion',x:.22,y:.49,points:[[.12,0],[.8,.1],[.35,.5],[.48,.46],[.61,.42],[.26,1],[.95,.88]],
  names:['Betelgeuse','Bellatrix','Alnitak','Alnilam','Mintaka','Saiph','Rigel'],edges:[[0,1],[0,2],[1,4],[2,3],[3,4],[2,5],[4,6],[5,6]]},
 {name:'Cassiopeia',x:.51,y:.35,points:[[0,0],[.25,.65],[.5,.15],[.75,.8],[1,.25]],
  names:['Caph','Schedar','Navi','Ruchbah','Segin'],edges:[[0,1],[1,2],[2,3],[3,4]]},
 {name:'Ursa Major',x:.8,y:.56,points:[[0,.15],[.08,.62],[.4,.67],[.48,.22],[.66,.13],[.84,.2],[1,.38]],
  names:['Dubhe','Merak','Phecda','Megrez','Alioth','Mizar','Alkaid'],edges:[[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]]}
];
const grain=Array.from({length:sampleCount(positive(3500,.15))},()=>({x:R(),y:R(),a:rr(.05,.24),w:rr(.6,3),angle:rr(0,TAU)}));
// Grains in the foreground snow that catch the moon as the eye moves over them.
const glints=Array.from({length:sampleCount(positive(320,.2))},()=>({x:R(),y:R(),phase:rr(0,4000),rate:rr(.12,.5),size:rr(.5,1.2)}));
const stats={bubbles:0,crystals:0,frozen:0,collapses:0,leopards:0};
let time=0,phase='waiting',phaseAge=0,bubble=null,flakes=[],snow=[],meteors=[],drifters=[],preparingStill=N.RM;
// Everything the frost has become: finished segments, growing tips, the cells each layer fills, and the pieces that come away at the end.
let lace=[],patches=[],tips=[],filled=[new Map(),new Map(),new Map()],perched=[],puffs=[],marks=[],pieces=[],slivers=[];
let tipCount=0,flakeCount=0,mound={x:CX,y:CONTACT,width:150,amount:0,life:14},coverOpen=0,coverAll=1;
const coverGrid=new Uint8Array(COVER*COVER);
const flakeById=new Map();
const snowMean=positive(.1,.35),windMean=positive(6,.35),meteorMean=positive(75,.35),pauseMean=positive(5,.45),driftMean=positive(6.5,.35),auroraMean=positive(130,.4);
// Some nights have no moon in the sky. On the rest it hangs in one place all night, and only its shape and place differ, from a thin crescent to full.
const moon=R()<.22?null:{u:rr(.07,.93),v:rr(.07,.24),size:positive(.026,.14),phase:Math.min(1,rr(.12,1.16)),tilt:rr(-.6,.6),offset:R()*4000};
let wind=normal()*8,wait=0,nextSnow=gap(snowMean),nextWind=gap(windMean),nextMeteor=gap(meteorMean),nextLeopard=gap(positive(70,.3)),leopard=null,nextDrift=gap(driftMean),aurora=null,nextAurora=gap(auroraMean);
let windTarget=wind;
let width=0,height=0,pixel=1,scale=1,ox=0,oy=0,skyHeight=0;
let cameraTime=time,cameraScale=scale,cameraPan=0,pan=0;
let laceTurn=0,shadeDone=-1,shadeStamp=-1,atlasOwner=null,atlasX=0,atlasY=0,atlasRow=0,laceOwner=null,laceSize=0,laceDone=0,patchDone=0,holeDone=0,shellFlat=false,glowSize=0,glowStamp=-1,filmOwner=null,filmStamp=-1,filmMap=null,filmData=null,veilData=null;
const hue=(h,a,l=78)=>`hsla(${h},70%,${l}%,${a})`;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ease=n=>n*n*(3-2*n);
const band=(n,a,b)=>ease(clamp((n-a)/(b-a),0,1));
const depthOf=(y,z)=>z*TC-y*TS;
function line(g,x,y,x2,y2,color,w=1){g.strokeStyle=color;g.lineWidth=w;g.beginPath();g.moveTo(x,y);g.lineTo(x2,y2);g.stroke();}
// Smooth noise in three dimensions, read from the shared seeded table, so drawing never draws a random number.
function value3(x,y,z){
 const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),fx=x-xi,fy=y-yi,fz=z-zi;
 const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz),a=xi*73+yi*179+zi*283;
 const n0=NT[a&4095],n1=NT[(a+73)&4095],n2=NT[(a+179)&4095],n3=NT[(a+252)&4095],n4=NT[(a+283)&4095],n5=NT[(a+356)&4095],n6=NT[(a+462)&4095],n7=NT[(a+535)&4095];
 const x0=n0+(n1-n0)*u,x1=n2+(n3-n2)*u,x2=n4+(n5-n4)*u,x3=n6+(n7-n6)*u,y0=x0+(x1-x0)*v,y1=x2+(x3-x2)*v;
 return y0+(y1-y0)*w;
}
function center(){
 const b=bubble,flight=phase==='forming'?clamp(phaseAge/b.flight,0,1):1,remaining=1-flight;
 const z=b.spotZ+(b.fromZ-b.spotZ)*remaining*remaining,near=nearness(z),snowLine=snowAt(z);
 const r=Math.max(.1,b.radius*near*Math.cbrt(b.volume)*(1+(noise(b.offset+time/b.form)*2-1)*b.sway*(1-b.ice)));
 // Air carries the bubble down on a slow, wandering line. It meets the snow with whatever speed this one still has.
 const fall=b.arrival.height*remaining**2.4+b.touch*b.flight*remaining*(1-remaining)+(noise(b.offset+300+time*.3)-.5)*20*remaining*remaining;
 const lift=phase==='forming'?fall:b.hop;
 const carried=b.arrival.x*remaining*remaining+wind*b.flight*.5*flight*remaining*remaining+(noise(b.offset+900+time*.14)-.5)*b.radius*1.5*remaining-b.glide*b.flight*remaining*(1-remaining);
 const x=b.touchX+carried+b.rolled,seat=1-(1-b.base)*b.seat;
 return{x,y:snowLine-lift-r*seat*TC,r,ground:snowLine-lift,snow:snowLine,z,airborne:phase==='forming'||b.hop>0,seat};
}
function form(){
 if(phase!=='waiting')return false;
 const sink=R()**1.7;
 bubble={radius:positive(150,.21),hue:R()*360,form:positive(3,.3),flight:positive(12,.28),frost:positive(2,.3),sway:positive(.002,.35),offset:R()*4000,age:0,
  ice:0,freezeAt:null,origins:[],ending:null,seat:0,sink:positive(1,.25)*(1+sink*4),squash:0,squashV:0,lean:0,leanV:0,ring:positive(1.5,.15),
  // Where it comes down, how hard, and how far into the powder it ends up. Nothing here is a named kind of landing.
  spot:CX+rr(-1,1)*235,spotZ:rr(-80,70),fromZ:rr(-520,240),close:rr(.32,.395),base:.992-sink*.25,touch:positive(7,.8),give:rr(.3,.7),rollTime:positive(1.2,.35),
  hop:0,hopV:0,rolled:0,rollV:0,trail:0,landed:null,
  groundCold:positive(.85,.55),airCold:normal()*.85+.18,thermalDrift:positive(.55,.3),freezeRate:positive(.046,.28),
  film:positive(1,.35),drain:positive(.008,.65),permeability:positive(.04,.6),volume:1,
  crystalRate:positive(1.05,.5),rootRate:positive(7,.3),layerRate:positive(3.2,.3),circulation:positive(.9,.4),current:normal(),strength:positive(.85,.25),
  nextCrystal:gap(1),nextRoot:gap(.2),nextSprout:gap(1),nextLayer:gap(1),nextGap:gap(1),nextSeed:gap(1),failBudget:gap(1),
  // How readily this bubble takes its ice from the snow below, and how readily from flakes landing on it.
  baseRate:rr(.25,1.05),seedChance:R()**3*.14+.008,seedRate:R()**2*.07,
  // Snow crystals take their form from temperature and humidity, so each bubble has a crystal weather of its own and each crystal varies within it.
  weather:{full:rr(.32,.95),barb:rr(.2,.46),bare:R()**2.5*.4,fork:R()*.6,plate:R()**2*.2,gap:rr(.03,.056),sweep:rr(.96,1.1)},
  cooling:0,stress:0,flow:0,chase:0,white:0,whiteRate:positive(.03,.25),covered:0,enclosed:false,ready:false,
  brittle:0,settleTime:positive(14,.3),tearTime:0,tear:[0,-1,0],broken:null,released:0,
  weave:positive(4.8,.14),tipSpeed:positive(15,.2),lead:positive(.075,.25),weld:positive(1.2,.4),
  lobes:[2,3,5,9].map((k,i)=>({k,size:[.1,.075,.05,.03][i]*rr(.6,1.2),phase:R()*TAU,drift:normal()*.03})),
  tumble:[normal(),normal(),normal()].map(v=>v*positive(.2,.4)),
  eddies:Array.from({length:7},()=>{const y=rr(-1,1),a=R()*TAU,ring=Math.sqrt(1-y*y);return{x:Math.cos(a)*ring,y,z:Math.sin(a)*ring,power:positive(1.7,.3),width:positive(.26,.3),pace:rr(.12,.4),s:0};}),
  frostGrains:Array.from({length:sampleCount(positive(46,.3))},()=>({x:R(),y:R(),size:positive(1,.4)}))};
 const b=bubble,direction=R()*Math.PI,distance=Math.hypot(CX,CONTACT)+b.radius+Math.abs(normal())*b.radius;
 b.stride=b.weave*.62;b.origins.push({x:0,y:1,z:0,edge:b.base,start:b.base,rate:b.baseRate});
 // Anywhere from a low run in along the snow to almost straight down.
 b.arrival={x:Math.cos(direction)*distance,height:Math.sin(direction)*distance*rr(.55,1)+b.radius*rr(1.4,2.4)};
 b.glide=-Math.cos(direction)*positive(20,.6);b.touchX=b.spot-b.glide*b.rollTime;
 b.currentTarget=b.current;b.strengthTarget=b.strength;
 phase='forming';phaseAge=0;stats.bubbles++;N.stats(stats);N.log('A soap bubble drifts toward the snow');
 resetCover();resetFilm();
 if(width)view();return true;
}
function surfacePoint(f,p){return{x:p.x+f.nx*p.r,y:p.y+(f.ny*TC+f.nz*TS)*p.r};}
// The film meets the snow. It gives, pushes out powder and, if it arrived with enough speed, skips on a little way.
function touchSnow(speed){
 const b=bubble,p=center(),foot=p.r*.2;
 b.squashV+=Math.min(.24,.02+speed*.02);
 for(let i=sampleCount(positive(16+speed*14,.3)*p.r/150);i>0;i--){
  const a=R()*TAU,pace=positive(7+speed*1.5,.5),reach=foot*(.5+R());
  puffs.push({x:p.x+Math.cos(a)*reach,z:p.z+Math.sin(a)*reach,h:R()*2,vx:Math.cos(a)*pace,vz:Math.sin(a)*pace,vh:positive(4+speed*.8,.6),age:0,life:positive(1.9,.4),size:positive(.8,.4),drag:positive(1.5,.3)});
 }
 marks.push({x:p.x,z:p.z,size:p.r*(.16+Math.min(speed,20)*.008),age:0,life:positive(26,.3)});
 b.hopV=speed*b.give;if(b.hopV<1.8)b.hopV=0;
 b.landed=time;
}
function touchdown(){
 const b=bubble;phase='landing';phaseAge=0;b.rollV=b.glide;touchSnow(b.touch);
}
function settleDown(dt){
 const b=bubble,slow=Math.exp(-dt/b.rollTime),rolling=Math.abs(b.rollV)>.4;
 b.rollV*=slow;b.rolled+=b.rollV*dt;
 if(b.hop>0||b.hopV>0){
  b.hopV-=HOP*dt;b.hop+=b.hopV*dt;
  if(b.hop<=0){const speed=-b.hopV;b.hop=0;b.hopV=0;touchSnow(speed);}
 }else if(rolling&&Math.abs(b.rolled-b.trail)>b.radius*.1){
  // Rolling leaves a faint track in the powder.
  const p=center();b.trail=b.rolled;marks.push({x:p.x,z:p.z,size:p.r*.12,age:0,life:positive(18,.3)});
 }
 if(!rolling&&b.hop===0&&b.hopV===0&&b.seat>.5){
  b.rolled=b.spot-b.touchX;b.rollV=0;phase='cooling';phaseAge=0;N.log('The bubble settles into the snow and begins cooling');
  for(const g of perched)if(R()<b.seedChance*1.5)seedFrost(g.nx,g.ny,g.nz);
 }
}
// A shape spring for the film: it gives to a touch or a breath of wind, and stiffens as the shell turns to ice.
function shake(dt){
 const b=bubble,give=1-b.ice,omega=TAU/b.ring*(1+b.ice*5),damp=omega*(.13+b.ice*.6);
 const air=phase==='forming'?.5:.16,breath=(noise(b.offset+70+time*.55)-.5)*air*give;
 b.squashV+=(breath-omega*omega*b.squash-2*damp*b.squashV)*dt;b.squash+=b.squashV*dt;
 const target=give*(wind*.0016+(noise(b.offset+140+time*.33)-.5)*.03);
 b.leanV+=(omega*omega*(target-b.lean)-2*damp*b.leanV)*dt;b.lean+=b.leanV*dt;
}
// The film is a real moving layer: thickness is carried around the sphere by the flow, so its colors stretch, fold and never repeat.
// An octahedral map wraps the whole sphere onto one square with no pinched poles, and its seams sit on the far side.
function octNormal(u,v){
 let x=u,y=v,z=1-Math.abs(u)-Math.abs(v);
 if(z<0){const a=(1-Math.abs(y))*(x>=0?1:-1),c=(1-Math.abs(x))*(y>=0?1:-1);x=a;y=c;}
 const l=Math.hypot(x,y,z);return[x/l,y/l,z/l];
}
function octSpot(x,y,z){
 const s=1/(Math.abs(x)+Math.abs(y)+Math.abs(z));let u=x*s,v=y*s;
 if(z<0){const a=(1-Math.abs(v))*(u>=0?1:-1),c=(1-Math.abs(u))*(v>=0?1:-1);u=a;v=c;}
 return[u,v];
}
function octCell(x,y,z,size){
 const s=1/(Math.abs(x)+Math.abs(y)+Math.abs(z));let u=x*s,v=y*s;
 if(z<0){const a=(1-Math.abs(v))*(u>=0?1:-1),c=(1-Math.abs(u))*(v>=0?1:-1);u=a;v=c;}
 return Math.min(size-1,Math.floor((v*.5+.5)*size))*size+Math.min(size-1,Math.floor((u*.5+.5)*size));
}
const CELLS=FIELD*FIELD;
let fieldNow=new Float32Array(CELLS),fieldMid=new Float32Array(CELLS),fieldBack=new Float32Array(CELLS);
const fieldMin=new Float32Array(CELLS),fieldMax=new Float32Array(CELLS),fieldGoal=new Float32Array(CELLS),fieldX=new Float32Array(CELLS),fieldY=new Float32Array(CELLS),fieldZ=new Float32Array(CELLS),flowX=new Float32Array(CELLS),flowY=new Float32Array(CELLS),flowZ=new Float32Array(CELLS);
for(let i=0;i<CELLS;i++){const n=octNormal(((i%FIELD)+.5)/FIELD*2-1,(Math.floor(i/FIELD)+.5)/FIELD*2-1);fieldX[i]=n[0];fieldY[i]=n[1];fieldZ[i]=n[2];}
let fieldClock=0,fieldTurn=0;
function fieldSpot(x,y,z){
 const [u,v]=octSpot(x,y,z),fx=clamp((u*.5+.5)*FIELD-.5,0,FIELD-1.001),fy=clamp((v*.5+.5)*FIELD-.5,0,FIELD-1.001),ix=Math.floor(fx),iy=Math.floor(fy);
 return{i:iy*FIELD+ix,a:fx-ix,b:fy-iy};
}
function fieldRead(data,i,a,b){const t=data[i]+(data[i+1]-data[i])*a,u=data[i+FIELD]+(data[i+FIELD+1]-data[i+FIELD])*a;return t+(u-t)*b;}
// The inner loop of the film. The first pass also notes the range of the four cells it read, which keeps the sharpening below from ringing.
let fieldLow=0,fieldHigh=0,fieldFresh=false;
function fieldAt(data,x,y,z,range){
 const s=1/(Math.abs(x)+Math.abs(y)+Math.abs(z));let u=x*s,v=y*s;
 if(z<0){const a=(1-Math.abs(v))*(u>=0?1:-1),c=(1-Math.abs(u))*(v>=0?1:-1);u=a;v=c;}
 let fx=(u*.5+.5)*FIELD-.5,fy=(v*.5+.5)*FIELD-.5;
 fx=fx<0?0:fx>FIELD-1.001?FIELD-1.001:fx;fy=fy<0?0:fy>FIELD-1.001?FIELD-1.001:fy;
 const ix=fx|0,iy=fy|0,i=iy*FIELD+ix,a=fx-ix,b=fy-iy,p=data[i],q=data[i+1],r=data[i+FIELD],t=data[i+FIELD+1];
 if(range){const lo=p<q?p:q,l2=r<t?r:t,hi=p>q?p:q,h2=r>t?r:t;fieldLow=lo<l2?lo:l2;fieldHigh=hi>h2?hi:h2;}
 const m=p+(q-p)*a,n=r+(t-r)*a;return m+(n-m)*b;
}
function resetFilm(){
 const o=bubble.offset%61;
 for(let i=0;i<CELLS;i++){
  const x=fieldX[i],y=fieldY[i],z=fieldZ[i],w1=value3(x*1.4+o,y*1.4,z*1.4),w2=value3(x*1.4+9,y*1.4+o,z*1.4+4),swirl=value3(x*2.2+w1*3.4,y*4+w2*3.4,z*2.2+o);
  fieldGoal[i]=175+(y+1)*150+(swirl-.5)*520;fieldNow[i]=fieldGoal[i];flowX[i]=flowY[i]=flowZ[i]=0;
 }
 fieldClock=0;fieldTurn=0;
}
function stirFilm(dt){
 const b=bubble,air=phase==='forming'?1:phase==='landing'?.9:.6*(1-.5*b.ice),tumble=phase==='forming'?1:0,o=b.offset%61;
 const rollZ=phase==='landing'?-b.rollV/b.radius:0,wx=b.tumble[0]*tumble,wy=b.tumble[1]*tumble,wz=b.tumble[2]*tumble+rollZ;
 for(let k=0;k<b.eddies.length;k++){
  const e=b.eddies[k],drift=dt*.25;
  e.s=e.power*(noise(b.offset+k*37+time*e.pace)*2-1)*air;
  e.x+=(noise(b.offset+k*53+time*.11)-.5)*drift;e.y+=(noise(b.offset+k*71+time*.13)-.5)*drift;e.z+=(noise(b.offset+k*89+time*.09)-.5)*drift;
  const l=Math.hypot(e.x,e.y,e.z);e.x/=l;e.y/=l;e.z/=l;
 }
 // The flow changes slowly next to the film it moves, so part of the sphere is refreshed each step. Odd strides keep whole columns from updating together.
 const drain=.02*air;
 for(let i=fieldTurn%3;i<CELLS;i+=3){
  const x=fieldX[i],y=fieldY[i],z=fieldZ[i];
  let vx=wy*z-wz*y,vy=wz*x-wx*z,vz=wx*y-wy*x;
  for(const e of b.eddies){
   const g=Math.exp((x*e.x+y*e.y+z*e.z-1)/e.width)*e.s;
   vx+=g*(e.y*z-e.z*y);vy+=g*(e.z*x-e.x*z);vz+=g*(e.x*y-e.y*x);
  }
  vx-=x*y*drain;vy+=(1-y*y)*drain;vz-=z*y*drain;
  // Warm film climbs just above the cold line. Below it the swirls stop where they stand.
  let into=-3,ox=0,oy=1,oz=0;
  for(const c of b.origins){const d=x*c.x+y*c.y+z*c.z-c.edge;if(d>into){into=d;ox=c.x;oy=c.y;oz=c.z;}}
  const rise=phase==='forming'?0:Math.exp(-into*into*30)*.16*(1-b.ice),along=x*ox+y*oy+z*oz;
  vx-=(ox-x*along)*rise;vy-=(oy-y*along)*rise;vz-=(oz-z*along)*rise;
  const free=1-band(into,-.06,.05);
  flowX[i]=vx*free;flowY[i]=vy*free;flowZ[i]=vz*free;
 }
 for(let i=fieldTurn%7;i<CELLS;i+=7){
  const x=fieldX[i],y=fieldY[i],z=fieldZ[i];
  // Thin and thick patches keep regenerating, or the stirring would blend the film to one even grey.
  const w=value3(x*1.3+o,y*1.3-time*.07,z*1.3);
  fieldGoal[i]=175+(y+1)*150+(value3(x*2.1+w*2.6+o,y*3.2+time*.11,z*2.1-w*2.6)-.5)*520;
 }
 fieldTurn=(fieldTurn+1)%21;
 // Carried back along the flow, then forward again to measure and cancel the blur a plain trace would add.
 // Film that has frozen cannot flow, so the work falls away as the ice spreads.
 for(let i=0;i<CELLS;i++){
  if(flowX[i]===0&&flowY[i]===0&&flowZ[i]===0){fieldMid[i]=fieldNow[i];continue;}
  const x=fieldX[i]-flowX[i]*dt,y=fieldY[i]-flowY[i]*dt,z=fieldZ[i]-flowZ[i]*dt;
  fieldMid[i]=fieldAt(fieldNow,x,y,z,true);fieldMin[i]=fieldLow;fieldMax[i]=fieldHigh;
 }
 const settle=dt*.42;
 for(let i=0;i<CELLS;i++){
  if(flowX[i]===0&&flowY[i]===0&&flowZ[i]===0){fieldBack[i]=fieldNow[i];continue;}
  const back=fieldAt(fieldMid,fieldX[i]+flowX[i]*dt,fieldY[i]+flowY[i]*dt,fieldZ[i]+flowZ[i]*dt,false);
  const sharp=clamp(fieldMid[i]+(fieldNow[i]-back)*.5,fieldMin[i],fieldMax[i]);
  fieldBack[i]=clamp(sharp+(fieldGoal[i]-sharp)*settle,30,1000);
 }
 const old=fieldNow;fieldNow=fieldBack;fieldBack=old;fieldFresh=true;
}
// Ice spreads from wherever it first took hold: the line where the film meets the snow, or a flake that landed on the top or side.
// Each origin is a cap that grows over the sphere, and the shell is frozen wherever any cap has reached.
function iceDepth(x,y,z){
 const b=bubble,o=b.offset%43;let best=-3;
 for(const c of b.origins){const d=x*c.x+y*c.y+z*c.z-c.edge;if(d>best)best=d;}
 return best+iceEdge(x,y,z,o)*Math.sqrt(b.ice*(1-b.ice))*.68;
}
const iceEdge=(x,y,z,o)=>value3(x*2.3+o,y*2.3,z*2.3)+value3(x*5.1,y*5.1+o,z*5.1)*.4-.7;
// How much of the cold has reached a point on the shell. Tips run ahead of the freeze line by a little and then wait for it.
const coldAt=(x,y,z)=>clamp((iceDepth(x,y,z)+bubble.lead)/(bubble.lead*2),0,1);
const cellOf=(x,y,z,s)=>((Math.floor(x/s)+512)*1024+Math.floor(y/s)+512)*1024+Math.floor(z/s)+512;
function addLace(ax,ay,az,bx,by,bz,order,w){lace.push(ax,ay,az,bx,by,bz,order,w);}
// A dendrite's own build: how close its barbs lie, how long they run, which side it favors, and how much of it is bare needle.
function frond(){
 const w=bubble.weather;
 return{gap:positive(3,.25),len:positive(w.barb*48,.4),skew:normal()*.42,bare:clamp(w.bare+normal()*.1,0,.85),fork:w.fork*R(),twig:R()*.5};
}
function startTip(x,y,z,hx,hy,hz,order,parent,level=0){
 const b=bubble,l=Math.hypot(hx,hy,hz)||1;
 return{id:++tipCount,parent,x,y,z,hx:hx/l,hy:hy/l,hz:hz/l,order,level,ox:0,oy:1,oz:0,run:0,pace:0,body:0,bx:x,by:y,bz:z,f:order?null:frond(),
  life:positive([64,12,4][order],.6),next:positive([2.4,5,3][order],.3)};
}
function turn(t,angle){
 const cos=Math.cos(angle),sin=Math.sin(angle),cx=t.y*t.hz-t.z*t.hy,cy=t.z*t.hx-t.x*t.hz,cz=t.x*t.hy-t.y*t.hx;
 t.hx=t.hx*cos+cx*sin;t.hy=t.hy*cos+cy*sin;t.hz=t.hz*cos+cz*sin;
}
// One step of a dendrite. A spine runs straight along its crystal axis, and barbs leave it close together, sixty degrees off and nearly parallel, so it reads as a fern blade.
function laceStep(t,born){
 const b=bubble,spine=!t.order,spacing=b.weave*LEVEL[t.level],move=b.stride*(spine?.85:1.6),step=move/b.radius;
 turn(t,normal()*TIP_WANDER[t.order]);
 // Leading arms bear away from where the ice began, toward the warm film.
 if(spine){const d=t.x*t.ox+t.y*t.oy+t.z*t.oz;t.hx-=(t.ox-t.x*d)*.035;t.hy-=(t.oy-t.y*d)*.035;t.hz-=(t.oz-t.z*d)*.035;}
 let x=t.x+t.hx*step,y=t.y+t.hy*step,z=t.z+t.hz*step,l=Math.hypot(x,y,z);x/=l;y/=l;z/=l;
 if(y>b.base)return false;
 const cells=filled[t.level],key=cellOf(x,y,z,spacing/b.radius),owner=cells.get(key);
 addLace(t.x,t.y,t.z,x,y,z,t.order,TIP_WIDTH[t.order]);
 if(!t.level)markCover(x,y,z);
 if(spine){
  // The milky body of the blade, laid down in longer strokes so it stays faint.
  if(t.run>=t.body+9){const half=t.f.len*.63/b.radius;if(Math.abs(depthOf(y,z))>.3&&Math.hypot(x,y*TC+z*TS)+half<1&&Math.hypot(t.bx,t.by*TC+t.bz*TS)+half<1)addLace(t.bx,t.by,t.bz,x,y,z,4,t.f.len*1.25);t.body=t.run;t.bx=x;t.by=y;t.bz=z;}
  if(owner!==undefined&&owner!==t.id&&owner!==t.parent&&t.run>spacing*1.4){addLace(x,y,z,x,y,z,3,1.5);return false;}
  cells.set(key,t.id);
 }else if(owner!==undefined&&owner!==t.parent&&t.run>b.stride*2)return false;
 t.x=x;t.y=y;t.z=z;
 const along=t.hx*x+t.hy*y+t.hz*z;t.hx-=along*x;t.hy-=along*y;t.hz-=along*z;const h=Math.hypot(t.hx,t.hy,t.hz);t.hx/=h;t.hy/=h;t.hz/=h;
 t.run+=move;t.life-=move;t.next-=move;
 if(t.life<=0)return false;
 if(t.next<=0){
  if(spine){
   t.next=t.f.gap*(.72+R()*.56);
   // Some lengths of spine stay bare, and that is a needle.
   if(R()>=t.f.bare)for(const side of [-1,1]){
    const reach=t.f.len*(1+side*t.f.skew)*(.5+R()*.9);
    if(reach<1.5)continue;
    const child=startTip(x,y,z,t.hx,t.hy,t.hz,1,t.id,t.level);turn(child,side*bubble.weather.sweep+normal()*.03);
    child.f=t.f;child.life=reach;child.ox=t.ox;child.oy=t.oy;child.oz=t.oz;
    // Now and then a barb keeps going and becomes an arm of its own.
    if(R()<t.f.fork*.09){child.order=0;child.f=frond();child.life=positive(52,.6);child.next=positive(2.4,.3);}
    born.push(child);
   }
  }else if(t.order===1){
   t.next=positive(5,.3);
   if(R()<t.f.twig){const child=startTip(x,y,z,t.hx,t.hy,t.hz,2,t.id,t.level);turn(child,(R()<.5?-1:1)*bubble.weather.sweep);child.f=t.f;born.push(child);}
  }
 }
 return true;
}
function growLace(dt){
 const b=bubble,born=[];let kept=0;
 for(let i=0;i<tips.length;i++){
  const t=tips[i];let alive=true;
  t.pace+=Math.max(b.tipSpeed,b.chase)*TIP_SPEED[t.order]*(t.level?.7:1)*coldAt(t.x,t.y,t.z)*dt;
  const need=b.stride*(t.order?1.6:.85);
  while(alive&&t.pace>=need){t.pace-=need;alive=laceStep(t,born);}
  if(alive)tips[kept++]=t;
 }
 tips.length=kept;for(const t of born)tips.push(t);
}
// Along the line where film meets snow the ice stands up in a fringe of short fronds, and only some of them go on to climb.
function rootTip(){
 const b=bubble,a=R()*TAU,y=b.base-.01,ring=Math.sqrt(1-y*y),x=Math.cos(a)*ring,z=Math.sin(a)*ring;
 const t=startTip(x,y,z,x*y,-(1-y*y),z*y,0,0);turn(t,normal()*.3);
 if(R()<.8){t.life=positive(17,.6);t.f.len*=.55;}else t.life=positive(90,.5);
 tips.push(t);
 stats.crystals++;N.stats(stats);
}
// New arms also start from lace close to the climbing edge, so the frost keeps feeling its way upward.
function sproutTip(){
 if(!lace.length)return;
 const i=(lace.length/SEG-1-Math.floor(R()*R()*Math.min(lace.length/SEG,900)))*SEG;
 if(lace[i+6]>=3||lace[i]===lace[i+3])return;
 const t=startTip(lace[i+3],lace[i+4],lace[i+5],lace[i+3]-lace[i],lace[i+4]-lace[i+1],lace[i+5]-lace[i+2],0,0);
 turn(t,(R()<.5?-1:1)*bubble.weather.sweep+normal()*.05);t.run=-8;tips.push(t);
}
// Frost keeps arriving on frost. Each new flake opens on ice that is already there, in a layer of its own.
function frostFlake(){
 const b=bubble,y=rr(-.995,b.base-.02),a=R()*TAU,ring=Math.sqrt(1-y*y),x=Math.cos(a)*ring,z=Math.sin(a)*ring,level=R()<.55?1:2;
 if(iceDepth(x,y,z)<.14)return;
 const key=cellOf(x,y,z,b.weave*LEVEL[level]/b.radius);
 if(filled[level].has(key))return;
 filled[level].set(key,0);
 const twist=R()*TAU/6;
 for(let i=0;i<6;i++){
  if(R()>b.weather.full)continue;
  const t=startTip(x,y,z,z||1,0,-x,0,0,level);turn(t,twist+i*TAU/6);t.life=positive(15,.55)*LEVEL[level];t.f.len*=.6;tips.push(t);
 }
 stats.crystals++;N.stats(stats);
}
// A flake touches film that is cold enough, and ice runs out from that point in every direction.
function seedFrost(x,y,z){
 const b=bubble,twist=R()*TAU/6;
 if(b.ice>=1||iceDepth(x,y,z)>0)return false;
 b.origins.push({x,y,z,edge:.999,start:.999,rate:rr(.55,1.1)});
 markCover(x,y,z);
 for(let i=0;i<6;i++){if(i>1&&R()>b.weather.full)continue;const t=startTip(x,y,z,z||1,0,-x,0,0);t.ox=x;t.oy=y;t.oz=z;turn(t,twist+i*TAU/6+normal()*.03);tips.push(t);}
 stats.crystals++;N.stats(stats);N.log(y<-.4?'A flake on the crown of the bubble starts the ice from above':y<.5?'A flake on the side of the bubble starts the ice':'A flake low on the film starts the ice');
 return true;
}
// How much of the shell the first layer has reached, read from a coarse grid over the whole sphere.
function resetCover(){
 const b=bubble;coverOpen=0;
 for(let i=0;i<COVER*COVER;i++){
  const u=((i%COVER)+.5)/COVER*2-1,v=(Math.floor(i/COVER)+.5)/COVER*2-1,n=octNormal(u,v);
  coverGrid[i]=n[1]<b.base-.03?1:0;coverOpen+=coverGrid[i];
 }
 coverAll=coverOpen;
}
function markCover(x,y,z){
 const i=octCell(x,y,z,COVER);
 if(coverGrid[i]===1){coverGrid[i]=2;coverOpen--;bubble.covered=1-coverOpen/coverAll;}
}
// Any gap the lace has grown around gets a crystal of its own, so the shell closes completely.
function fillGap(){
 const b=bubble,start=Math.floor(R()*COVER*COVER);
 for(let k=0;k<COVER*COVER;k++){
  const i=(start+k)%(COVER*COVER);
  if(coverGrid[i]!==1)continue;
  const n=octNormal(((i%COVER)+.5)/COVER*2-1,(Math.floor(i/COVER)+.5)/COVER*2-1),turnBy=R()*TAU;
  markCover(n[0],n[1],n[2]);
  for(let j=0;j<3;j++){const t=startTip(n[0],n[1],n[2],n[2]||1,0,-n[0],0,0);t.life=positive(34,.5);turn(t,turnBy+j*TAU/3);tips.push(t);}
  return;
 }
}
// Every crystal gets its own continuous build within the bubble's weather: which arms grew, how far, how feathered, how lopsided.
function crystalShape(){
 const w=bubble.weather;
 return{full:clamp(w.full+normal()*.18,.15,1),uneven:positive(1.5,.45),gap:clamp(w.gap*positive(1,.25),.03,.13),barb:clamp(w.barb*positive(1,.35),.04,.62),skew:normal()*.38,sweep:w.sweep*(1+normal()*.02),
  bare:clamp(w.bare*R()*1.6,0,.8),fork:clamp(w.fork*positive(1,.5),0,.9),twig:R()*.6,plate:clamp(w.plate*positive(1,.5),0,.34),wobble:normal()*.05};
}
function nucleate(at){
 if(!['cooling','freezing','holding'].includes(phase)||bubble.ice>=1)return false;
 // New crystals appear in the film just ahead of the ice, wherever it is spreading from.
 const from=bubble.origins[Math.floor(R()*bubble.origins.length)],reach=Math.acos(clamp(from.edge-positive(.34,.75),-.999,.999)),spot=at?[at.nx,at.ny,at.nz]:ringPoint(from,R()*TAU,reach);
 if(spot[1]>bubble.base)spot[1]=bubble.base;
 const length=Math.hypot(...spot);
 const f={id:++flakeCount,nx:spot[0]/length,ny:spot[1]/length,nz:spot[2]/length,x:0,y:0,z:0,
  age:0,size:positive(30,.42),growth:positive(24,.35),rotation:R()*TAU,spin:normal()*.05,offset:R()*4000,
  shape:crystalShape(),locked:false,lock:0,vx:0,vy:0,vz:0,contacts:[],dwell:0,baked:false};
 f.group=f.id;
 const point=surfacePoint(f,center());f.x=point.x;f.y=point.y;f.z=f.nz;flakes.push(f);flakeById.set(f.id,f);
 stats.crystals++;N.stats(stats);return true;
}
// A crystal that reaches the climbing ice stops being a separate thing: its arms join the lace and carry on growing from there.
function dock(f){
 if(f.baked)return;f.baked=true;f.locked=true;
 const p=center(),branches=crystalBranches(f),growth=ease(clamp(f.age/f.growth,0,1)),size=branches.span*growth,basis=crystalBasis(f),s=bubble.weave*LEVEL[0]/bubble.radius;
 if(!size)return;
 for(const branch of branches){
  const reach=clamp((size-branch.start)/(branch.end-branch.start),0,1);if(!reach)continue;
  const dx=(branch.x2-branch.x)*reach,dy=(branch.y2-branch.y)*reach,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/bubble.stride));
  let a=crystalSurface(f,branch.x,branch.y,p,basis),b=a;
  for(let i=1;i<=steps;i++){
   b=crystalSurface(f,branch.x+dx*i/steps,branch.y+dy*i/steps,p,basis);
   // An arm that reaches the contact line stops at the snow.
   if(b.ny>bubble.base)break;
   addLace(a.nx,a.ny,a.nz,b.nx,b.ny,b.nz,branch.level,[1.1,.72,.46][branch.level]);
   filled[0].set(cellOf(b.nx,b.ny,b.nz,s),0);markCover(b.nx,b.ny,b.nz);if(i<steps)a=b;
  }
  if(!branch.start&&reach>=1&&b.ny<=bubble.base){const t=startTip(b.nx,b.ny,b.nz,b.nx-a.nx,b.ny-a.ny,b.nz-a.nz,0,0);t.life=positive(26,.6);tips.push(t);}
 }
 for(const blade of branches.blades)patches.push({hex:blade.map(v=>crystalSurface(f,v[0]*growth,v[1]*growth,p,basis)),alpha:.55});
}
function ringPoint(d,a,angle){
 const ax=Math.abs(d.y)<.9?0:1,ay=Math.abs(d.y)<.9?1:0;
 let ex=d.y*0-d.z*ay,ey=d.z*ax-d.x*0,ez=d.x*ay-d.y*ax;const l=Math.hypot(ex,ey,ez);ex/=l;ey/=l;ez/=l;
 const fx=d.y*ez-d.z*ey,fy=d.z*ex-d.x*ez,fz=d.x*ey-d.y*ex,cos=Math.cos(angle),sin=Math.sin(angle),ca=Math.cos(a),sa=Math.sin(a);
 return[d.x*cos+(ex*ca+fx*sa)*sin,d.y*cos+(ey*ca+fy*sa)*sin,d.z*cos+(ez*ca+fz*sa)*sin];
}
// How this shell breaks, taken from slow footage of a frozen bubble. It holds, and then in a moment a tear races round it from one side and the shell is gone.
// What was shell is now a hollow crescent of thin curved pieces and fine slivers, still in the bubble's outline. They hang for an instant, then flutter down, and a faint mist stays where the bubble was.
function collapse(){
 const b=bubble;
 if(!b||!b.ready||b.ending)return false;
 b.ending='break';b.broken=time;b.squashV+=.5;
 tips=[];flakes=[];letGo(center());
 phase='collapsing';phaseAge=0;stats.collapses++;N.stats(stats);N.log('The frozen shell bursts');return true;
}
// The lines it will break along are settled while the white shell holds, so the moment itself costs nothing.
function readyBreak(){
 const b=bubble,p=center(),polar=rr(.25,1.9),a=R()*TAU,ring=Math.sin(polar);
 b.brittle=clamp(.5+b.airCold*.28+normal()*.16,0,1);b.tearTime=positive(.42,.3)*(1.3-b.brittle*.6);
 b.tear=[Math.cos(a)*ring,-Math.cos(polar),Math.abs(Math.sin(a))*ring];
 for(const f of flakes)dock(f);
 flakes=[];cutShell(p);
}
function letGo(p){
 for(const g of perched)puffs.push({x:p.x+g.nx*p.r,z:p.z+depthOf(g.ny,g.nz)*p.r,h:Math.max(0,p.snow-(p.y+(g.ny*TC+g.nz*TS)*p.r)),vx:0,vz:0,vh:-5,age:0,life:positive(6,.3),size:g.size+.6,drag:.5});
 perched=[];
}
function clipIce(polygon,nx,ny,limit){
 let next=[];
 for(let i=0;i<polygon.length;i++){
  let p=polygon[i],q=polygon[(i+1)%polygon.length],dp=p[0]*nx+p[1]*ny-limit,dq=q[0]*nx+q[1]*ny-limit;
  if(dp<=0)next.push(p);
  if((dp<=0)!==(dq<=0)){let t=dp/(dp-dq);next.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
 }
 return next;
}
function shellNormal(u,v,side){
 const d=Math.sqrt(Math.max(0,1-u*u-v*v)),s=side?-1:1;
 return[u,v*TC-s*d*TS,v*TS+s*d*TC];
}
// Every point of a crack moves through the same field, so neighboring pieces keep sharing one torn edge.
function tornEdge(polygon){
 const out=[],o=bubble.offset%31;
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],parts=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.022));
  for(let j=0;j<parts;j++){
   const x=a[0]+(b[0]-a[0])*j/parts,y=a[1]+(b[1]-a[1])*j/parts,room=clamp((1-x*x-y*y)*6,0,1);
   out.push([x+(value3(x*15+o,y*15,2)-.5)*.075*room,y+(value3(x*15,y*15+o,7)-.5)*.075*room]);
  }
 }
 return out;
}
function cutShell(p){
 const b=bubble,[tx,ty,tz]=b.tear;
 const after=(x,y,z)=>Math.acos(clamp(x*tx+y*ty+z*tz,-1,1))/Math.PI*b.tearTime;
 pieces=[];slivers=[];
 for(let side=0;side<2;side++){
  let seeds=Array.from({length:sampleCount(positive(150,.2)*(b.radius/150)**1.4)},()=>{const a=R()*TAU,r=Math.sqrt(R());return[Math.cos(a)*r,Math.sin(a)*r];});
  // Most of the shell goes small. A few broad curved sheets hold together among the rest.
  for(let i=sampleCount(positive(5,.4));i>0;i--){
   const a=R()*TAU,r=Math.sqrt(R()),cx=Math.cos(a)*r,cy=Math.sin(a)*r,reach=rr(.07,.17)*(1.3-b.brittle*.5);
   seeds=seeds.filter(q=>Math.hypot(q[0]-cx,q[1]-cy)>reach);seeds.push([cx,cy]);
  }
  for(const q of seeds){
   let poly=[[-1.2,-1.2],[1.2,-1.2],[1.2,1.2],[-1.2,1.2]];
   for(const d of seeds)if(d!==q)poly=clipIce(poly,d[0]-q[0],d[1]-q[1],(d[0]*d[0]+d[1]*d[1]-q[0]*q[0]-q[1]*q[1])/2);
   for(let i=0;i<48;i++){const a=(i+.5)*TAU/48;poly=clipIce(poly,Math.cos(a),Math.sin(a),1);}
   if(poly.length<3)continue;
   let area=0,cx=0,cy=0;
   for(let i=0;i<poly.length;i++){const v=poly[i],w=poly[(i+1)%poly.length],cross=v[0]*w[1]-w[0]*v[1];area+=cross;cx+=(v[0]+w[0])*cross;cy+=(v[1]+w[1])*cross;}
   if(Math.abs(area)<1e-5)continue;
   cx/=3*area;cy/=3*area;
   const l=Math.hypot(cx,cy),s=l>.995?.995/l:1,n=shellNormal(cx*s,cy*s,side);
   if(n[1]>b.base)continue;
   const outline=tornEdge(poly).map(v=>[v[0]-cx,v[1]-cy]),reach=outline.reduce((m,v)=>Math.max(m,Math.hypot(v[0],v[1])),0),depth=depthOf(n[1],n[2]);
   const pull=Math.hypot(cx-tx,cy-(ty*TC+tz*TS))||1;
   pieces.push({side,u:cx,v:cy,outline,reach,face:Math.abs(depth),x:p.x+cx*p.r,y:p.y+cy*p.r,floor:snowAt(p.z+depth*p.r*.85),when:after(n[0],n[1],n[2])+R()*.05,
    vx:(cx-tx)/pull*positive(13,.5),vy:(cy-(ty*TC+tz*TS))/pull*positive(9,.5),angle:0,spin:normal()*.7,pitch:0,flip:normal()*1.8,fall:positive(48,.3)*(.8+reach*2),gone:false,rest:false});
  }
 }
 pieces.sort((a,d)=>a.when-d.when);
 // The finest pieces are the lace itself: feather-light slivers, more of them where the frost was thickest.
 const stride=Math.max(1,Math.round(lace.length/SEG/1500))*SEG;
 for(let i=0;i<lace.length;i+=stride){
  const x=lace[i],y=lace[i+1],z=lace[i+2],depth=depthOf(y,z);
  if(y>b.base)continue;
  slivers.push({face:Math.abs(depth),x:p.x+x*p.r,y:p.y+(y*TC+z*TS)*p.r,floor:snowAt(p.z+depth*p.r*.85),when:after(x,y,z)+R()*.1,vx:normal()*5,vy:normal()*4,length:positive(7,.5),bend:normal()*.35,angle:R()*TAU,spin:normal()*1.6,sway:rr(.6,1.8),phase:R()*TAU,fall:positive(40,.4),moving:false,rest:false});
 }
}
function fallStep(s,dt,breeze){
 const flat=Math.cos(s.pitch)**2,glide=Math.sin(s.pitch*2),air=1-Math.exp(-dt*2.4);
 s.vy+=(s.fall*(1-.5*flat)-s.vy)*air;s.vx+=(glide*s.fall*.34+breeze-s.vx)*air;
 s.x+=s.vx*dt;s.y+=s.vy*dt;s.pitch+=s.flip*dt;s.angle+=s.spin*dt;
 if(s.y>=s.floor){s.y=s.floor;s.rest=true;}
}
function updateBreak(dt){
 const b=bubble,breeze=wind*.4;let moving=false;
 // A piece stays exactly where it was until the tear reaches it, and hangs a moment longer before it starts to fall.
 for(const s of pieces){
  if(!s.gone){if(phaseAge>=s.when){s.gone=true;b.released++;}moving=true;continue;}
  if(!s.rest){moving=true;if(phaseAge>=s.when+.12)fallStep(s,dt,breeze);}
 }
 for(const s of slivers){
  if(s.rest)continue;moving=true;
  if(phaseAge<s.when+.1)continue;
  const air=1-Math.exp(-dt*2);s.vy+=(s.fall-s.vy)*air;s.vx+=(breeze-s.vx)*air;
  s.x+=(s.vx+Math.sin(s.phase+phaseAge*s.sway*2.4)*s.fall*.3)*dt;s.y+=s.vy*dt;s.angle+=s.spin*dt;
  if(s.y>=s.floor){s.y=s.floor;s.rest=true;}
 }
 return moving;
}
// Now and then, high on the skyline, a snow leopard comes over a ridge, stands for a moment against the night and is gone. It is a very small thing to see.
const leopardMean=positive(110,.3);
function snowLeopard(){
 if(leopard)return false;
 leopard={spot:R(),face:R()<.5?-1:1,age:0,life:positive(14,.2),size:positive(1,.12),walk:rr(.8,2.6),phase:R()*TAU,look:rr(.25,.5)};
 stats.leopards++;N.stats(stats);N.log('High on a ridge, a snow leopard');return true;
}
function changeCurrent(){
 windTarget=normal()*8;
 if(bubble){bubble.currentTarget=normal();bubble.strengthTarget=positive(.85,.3);bubble.squashV+=normal()*.035*(1-bubble.ice);}
 return true;
}
function spawnSnow(initial=false){
 snow.push({x:rr(-420,1220),y:initial?rr(-150,GROUND+100):rr(-280,0),z:rr(-330,230),vx:normal()*2,vy:positive(15,.3),age:0,life:positive(90,.2),size:positive(.9,.4),offset:R()*4000});
 return true;
}
// Other bubbles come down far off, each on its own time and in its own place. They go the way the near one does: frost from the base up, then white, and only then the tear.
function drift(){
 const d={u:rr(-.03,1.03),from:normal()*.1,z:rr(.17,.33),size:positive(.36,.28),fall:positive(17,.28),sway:positive(.5,.3),spin:normal()*.12,hue:R()*360,offset:R()*4000,
  age:0,landed:null,ice:0,freeze:positive(24,.4),hold:positive(5,.6),broken:null,linger:rr(2.4,3.8),frost:[],bits:[]};
 for(let i=sampleCount(positive(44,.25));i>0;i--){const a=R()*TAU,r=Math.sqrt(R())*.94,y=Math.sin(a)*r;d.frost.push({x:Math.cos(a)*r,y,size:positive(.25,.35),at:(1-y)/2*.8+R()*.14});}
 drifters.push(d);return true;
}
function updateDrifters(dt){
 for(const d of drifters){
  d.age+=dt;
  if(d.landed===null){if(d.age>=d.fall)d.landed=d.age;}
  else if(d.broken===null){
   d.ice=Math.min(1,d.ice+dt/d.freeze);
   if(d.ice===1&&(d.hold-=dt)<=0){
    d.broken=d.age;
    for(let i=sampleCount(positive(40,.3));i>0;i--){const a=R()*TAU,r=Math.sqrt(R());d.bits.push({x:Math.cos(a)*r,y:Math.sin(a)*r,vx:normal()*.1,vy:rr(.3,1),size:positive(.03,.4),phase:R()*TAU,rate:rr(2,7)});}
   }
  }
 }
 drifters=drifters.filter(d=>d.broken===null||d.age-d.broken<d.linger);
}
// A faint curtain over the range, which folds and drifts and never holds a shape. It stays well under the brightness of the snow.
function auroraRise(){
 if(aurora)return false;
 const from=rr(-.25,.45);
 aurora={from,to:from+rr(.55,1.15),base:rr(.42,.66),tall:rr(.2,.38),power:rr(.34,.6),life:positive(80,.35),age:0,offset:R()*4000,pace:positive(1,.3)};
 N.log('A faint aurora over the range');return true;
}
function shootingStar(){
 meteors.push({x:rr(.08,.85),y:rr(.04,.3),dx:rr(.09,.22),dy:rr(.07,.18),age:0,life:positive(1,.3)});return true;
}
// However hard the cold drives it, the film only ever moves gently.
const filmPace=()=>bubble.flow/(1+bubble.flow*.8)*.2;
// One rotation field describes the film's circulation everywhere on the shell.
// One rotation field describes the film's circulation everywhere on the shell.
function filmFlow(nx,ny,nz){
 const b=bubble,spatial=b.circulation,clock=time/(b.form*5),offset=b.offset;
 const ax=b.groundCold+noise(offset+ny*spatial+clock)-noise(offset-nz*spatial-clock);
 const ay=b.current+noise(offset+nz*spatial+clock)-noise(offset-nx*spatial-clock);
 const az=noise(offset+nx*spatial+clock)-noise(offset-ny*spatial-clock);
 // Warm film rises across the front and returns down the back instead of piling up at the top.
 return{x:ay*nz-az*ny,y:az*nx-ax*nz,z:ax*ny-ay*nx};
}
function weld(a,d){
 const from=d.group;for(const f of flakes)if(f.group===from)f.group=a.group;
 a.contacts.push(d.id);a.spin=d.spin=0;a.dwell=d.dwell=0;
}
function updateSurface(dt){
 const p=center(),flow=filmPace(),live=flakes.filter(f=>!f.baked);
 if(!live.length)return;
 // One shared field carries nearby crystals together. Growing ice supplies local heat.
 const growing=live.map(f=>({f,r:crystalBranches(f).reach*ease(clamp(f.age/f.growth,0,1))}));
 const diffusion=Math.sqrt(p.r*bubble.frost),cellSize=(growing.reduce((maximum,item)=>Math.max(maximum,item.r),0)*2+diffusion)/p.r;
 const cells=new Map(),key=(x,y,z)=>x+','+y+','+z,weaveSize=bubble.weave/bubble.radius;
 for(const item of growing){
  const f=item.f;item.cell=[Math.floor(f.nx/cellSize),Math.floor(f.ny/cellSize),Math.floor(f.nz/cellSize)];
  const k=key(...item.cell);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(item);
 }
 // Compute from the same snapshot so iteration order cannot move a heat source early.
 for(const a of growing){
  if(a.f.locked)continue;
  const f=a.f;let heatX=0,heatY=0,heatZ=0,pullX=0,pullY=0,pullZ=0,crowding=filled[0].has(cellOf(f.nx,f.ny,f.nz,weaveSize))?1:0,partner=null,closest=Infinity;
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
   for(const b of cells.get(key(a.cell[0]+x,a.cell[1]+y,a.cell[2]+z))||[]){
    if(a===b)continue;
    const dx=f.nx-b.f.nx,dy=f.ny-b.f.ny,dz=f.nz-b.f.nz,distance=Math.hypot(dx,dy,dz)*p.r,reach=a.r+b.r;
    const progress=clamp(b.f.age/b.f.growth,0,1),release=6*progress*(1-progress)/b.f.growth;
    const warmth=release*Math.max(0,1-(distance/(reach+diffusion))**2)**2*p.r/(distance+diffusion);
    heatX+=dx*warmth;heatY+=dy*warmth;heatZ+=dz*warmth;
    if(distance<reach){
     crowding+=(1-distance/reach)*b.f.lock;
     // Bodies floating on a film draw together once they are close, then the ice between them closes.
     if(distance>0&&b.f.group!==f.group){
      const pull=(1-distance/reach)*.05*p.r/distance;pullX-=dx*pull;pullY-=dy*pull;pullZ-=dz*pull;
      if(distance<closest){closest=distance;partner=b.f;}
     }
    }
   }
  }
  const frost=clamp(iceDepth(f.nx,f.ny,f.nz)*p.r/(a.r+bubble.frost),0,1);
  const resistance=(frost*3+crowding)*(.3+bubble.ice);
  const lock=1-(1-f.lock)*Math.exp(-dt*resistance*bubble.strength);
  const v=filmFlow(f.nx,f.ny,f.nz),vx=v.x+heatX,vy=v.y+heatY,vz=v.z+heatZ;
  const radial=vx*f.nx+vy*f.ny+vz*f.nz;
  a.motion={vx:vx-radial*f.nx,vy:vy-radial*f.ny,vz:vz-radial*f.nz,lock,pullX,pullY,pullZ,partner};
 }
 const groups=new Map();
 for(const a of growing){
  const f=a.f,m=a.motion;f.age+=dt;
  if(f.locked){f.lock=1-(1-f.lock)*Math.exp(-dt*bubble.strength);continue;}
  f.lock=m.lock;
  a.mobility=flow*(1-f.lock)*bubble.strength;
  const response=1-Math.exp(-dt*bubble.strength*p.r/(f.size+bubble.frost)*.25);
  const calm=a.mobility/(1+Math.hypot(m.vx,m.vy,m.vz)*a.mobility/.07);
  f.vx+=(m.vx*calm+m.pullX*(1-f.lock)-f.vx)*response;f.vy+=(m.vy*calm+m.pullY*(1-f.lock)-f.vy)*response;f.vz+=(m.vz*calm+m.pullZ*(1-f.lock)-f.vz)*response;
  const radial=f.vx*f.nx+f.vy*f.ny+f.vz*f.nz;
  f.vx-=radial*f.nx;f.vy-=radial*f.ny;f.vz-=radial*f.nz;
  let g=groups.get(f.group);if(!g)groups.set(f.group,g={x:0,y:0,z:0,n:0});
  g.x+=f.vx;g.y+=f.vy;g.z+=f.vz;g.n++;
 }
 const docked=[];
 for(const a of growing){
  const f=a.f,m=a.motion;
  if(!f.locked){
   // Welded crystals travel as one piece.
   const g=groups.get(f.group);if(g.n>1){f.vx=g.x/g.n;f.vy=g.y/g.n;f.vz=g.z/g.n;}
   f.nx+=f.vx*dt;f.ny+=f.vy*dt;f.nz+=f.vz*dt;
   const length=Math.hypot(f.nx,f.ny,f.nz);f.nx/=length;f.ny/=length;f.nz/=length;
   if(f.ny>bubble.base){f.ny=bubble.base;const ring=Math.sqrt(1-f.ny*f.ny),len=Math.hypot(f.nx,f.nz)||1;f.nx=f.nx/len*ring;f.nz=f.nz/len*ring;}
   f.rotation+=(f.spin*a.mobility*6+f.vz*f.nx-f.vx*f.nz)*dt;
   if(m.partner&&!m.partner.locked){f.dwell+=dt;if(f.dwell>=bubble.weld)weld(f,m.partner);}else f.dwell=0;
   if(1-f.lock<=bubble.frost/p.r||bubble.ice>=1){f.locked=true;docked.push(f);}
  }
  const point=surfacePoint(f,p);f.x=point.x;f.y=point.y;f.z=f.nz;
 }
 for(const f of docked)for(const g of flakes)if(g.group===f.group)dock(g);
}
// A falling flake that meets the bubble stays on it. Film carries it and eases it downhill. Ice holds it, and a breath of wind can nudge it.
function perch(f,u,v,w){
 const l=Math.hypot(u,v,w),a=u/l,b=v/l,d=w/l,g={nx:a,ny:b*TC-d*TS,nz:b*TS+d*TC,size:f.size,age:0,melt:positive(18,.5),offset:f.offset};
 if(g.ny>bubble.base-.05)return;
 perched.push(g);
 // A grain of ice touching film that is already close to freezing can start a crystal of its own.
 if(['cooling','freezing','holding'].includes(phase)){
  if(R()<bubble.seedChance)seedFrost(g.nx,g.ny,g.nz);
  else if(iceDepth(g.nx,g.ny,g.nz)>-.4&&R()<.5)nucleate(g);
 }
}
function settlePerched(dt){
 const b=bubble;let kept=0;
 for(const g of perched){
  g.age+=dt;
  const frozen=b.ice>=1||iceDepth(g.nx,g.ny,g.nz)>0,slope=Math.sqrt(1-g.ny*g.ny);
  const dx=-g.nx*g.ny,dy=1-g.ny*g.ny,dz=-g.nz*g.ny;let vx,vy,vz;
  if(frozen){
   const creep=Math.max(0,slope-.5)*.0035,gust=(noise(g.offset+time*.21)-.5)*wind*.0009;
   vx=dx*creep+gust;vy=dy*creep;vz=dz*creep;
  }else{
   const v=filmFlow(g.nx,g.ny,g.nz),m=filmPace()*b.strength;
   vx=v.x*m+dx*.008;vy=v.y*m+dy*.008;vz=v.z*m+dz*.008;
  }
  g.nx+=vx*dt;g.ny+=vy*dt;g.nz+=vz*dt;
  const l=Math.hypot(g.nx,g.ny,g.nz);g.nx/=l;g.ny/=l;g.nz/=l;
  g.wet=frozen?0:clamp(g.age/g.melt,0,1);
  if((frozen||g.age<g.melt)&&g.ny<b.base-.02)perched[kept++]=g;
 }
 perched.length=kept;
}
function evolve(dt){
 const b=bubble;
 const air=b.airCold+(noise(b.offset+time*.025)-.5)*b.thermalDrift;
 const ground=b.groundCold*(.75+noise(b.offset+500+time*.018)*.5);
 const drive=ground*(1-b.ice)+air*b.ice;
 b.cooling+=Math.max(0,ground+air)*dt;
 // A mild spell slows the front but cannot stop it, so frost always closes over the whole shell.
 const cold=Math.max(.5,drive);
 // Ice releases heat as it forms, so a bitter night quickens the freeze without ever making it hurried. Frost does not melt back at these temperatures.
 const climb=cold/(1+cold*1.25)*b.freezeRate,before=b.ice;let open=1;
 for(const c of b.origins){c.edge=Math.max(-1.16,c.edge-climb*(b.base+1.16)*c.rate*dt);open*=1-clamp((c.start-c.edge)/(c.start+1.16),0,1);}
 b.ice=clamp(Math.max(b.ice,1-open),0,1);
 b.chase=climb*(b.base+1.16)*b.radius*2.6*1.1;
 // Now and then a flake lands on the upper film without any help from the snowfall count.
 b.nextSeed-=dt*b.seedRate;
 if(b.nextSeed<=0&&b.ice<.7){
  b.nextSeed+=gap(1);const y=rr(-1,.55),a=R()*TAU,ring=Math.sqrt(1-y*y),x=Math.cos(a)*ring,z=Math.sin(a)*ring;
  perched.push({nx:x,ny:y,nz:z,size:1.1,age:0,melt:positive(18,.5),offset:R()*4000});seedFrost(x,y,z);
 }
 const liquid=1-b.ice;
 b.flow=b.circulation*cold*liquid;
 const area=(b.radius/150)**2;
 b.nextCrystal-=dt*b.crystalRate*area*cold*liquid;
 while(b.nextCrystal<=0&&b.ice<1){nucleate();b.nextCrystal+=gap(1);}
 // Ice takes hold first at the line where the film meets the snow, then keeps feeling its way upward.
 b.nextRoot-=dt*b.rootRate*(.4+b.baseRate)*(b.radius/150)*cold/(1+b.ice*6)*(b.ice<.1?3.5:1);
 while(b.nextRoot<=0&&b.ice<1){rootTip();b.nextRoot+=gap(1);}
 b.nextSprout-=dt*(b.radius/150)*(1+cold)*liquid*4.5;
 while(b.nextSprout<=0&&b.ice<1){sproutTip();b.nextSprout+=gap(1);}
 // Layer on layer: flakes keep opening on the ice behind the front until the shell has turned white.
 b.nextLayer-=dt*b.layerRate*area*b.ice*(1+b.white*3);
 while(b.nextLayer<=0&&b.white<1){frostFlake();b.nextLayer+=gap(1);}
 b.white=clamp(b.white+dt*b.whiteRate*band(b.ice,.5,1),0,1);
 if(b.ice>=1&&!b.enclosed){
  b.nextGap-=dt*7;
  while(b.nextGap<=0){fillGap();b.nextGap+=gap(1);}
 }
 b.film*=Math.exp(-b.drain*liquid*(1+Math.abs(wind)*.025)*dt);
 // Air leaks away a little as the film thins. A frozen shell keeps its size until it fails.
 b.volume=Math.max(.84,b.volume*Math.exp(-b.permeability*b.ice*liquid*dt));
 b.stress+=dt*b.ice*(Math.abs(wind)*.08+Math.abs(air-ground));
 if(before<1&&b.ice>=1){b.freezeAt=time;N.log('Ice reaches the top of the shell');}
 if(!b.enclosed&&b.ice>=1&&b.covered>=.992){b.enclosed=true;stats.frozen++;N.stats(stats);N.log('Frost closes over the whole shell');}
 if(!b.ready&&b.enclosed&&b.white>=1){b.ready=true;readyBreak();N.log('The shell has frosted white all over');}
 phase=b.ice>=1?'frozen':drive<=.5?'holding':'freezing';
 // Only a shell that is whole and white can fail. Air then leaks on, and wind and temperature swings load the ice.
 if(b.ready){
  b.failBudget-=dt*(.025+Math.abs(wind)*.005+Math.abs(air-ground)*.01+b.stress*.0006);
  if(b.failBudget<=0)collapse();
 }
}
function clearBubble(){
 bubble=null;flakes=[];tips=[];lace=[];patches=[];perched=[];pieces=[];slivers=[];filled=[new Map(),new Map(),new Map()];flakeById.clear();
 phase='waiting';phaseAge=0;wait=gap(pauseMean);if(width)view();
}
function update(dt){
 if(N.RM&&!preparingStill)return;
 time+=dt;phaseAge+=dt;
 wind+=(windTarget-wind)*(1-Math.exp(-dt/windMean));
 if(bubble){
  const b=bubble;b.age+=dt;
  b.current+=(b.currentTarget-b.current)*(1-Math.exp(-dt/b.form));
  b.strength+=(b.strengthTarget-b.strength)*(1-Math.exp(-dt/b.form));
  shake(dt);
  if(phase!=='forming')b.seat+=((b.hop>0?0:1)-b.seat)*(1-Math.exp(-dt/(b.hop>0?.25:b.sink)));
 }
 nextSnow-=dt;while(nextSnow<=0){spawnSnow();nextSnow+=gap(snowMean);}
 nextWind-=dt;while(nextWind<=0){changeCurrent();nextWind+=gap(windMean);}
 nextMeteor-=dt;while(nextMeteor<=0){shootingStar();nextMeteor+=gap(meteorMean);}
 nextDrift-=dt;while(nextDrift<=0){drift();nextDrift+=gap(driftMean);}
 if(drifters.length)updateDrifters(dt);
 if(aurora){aurora.age+=dt;if(aurora.age>=aurora.life){aurora=null;nextAurora=gap(auroraMean);}}
 else{nextAurora-=dt;if(nextAurora<=0)auroraRise();}
 if(leopard){leopard.age+=dt;if(leopard.age>=leopard.life){leopard=null;nextLeopard=gap(leopardMean);}}
 else{nextLeopard-=dt;if(nextLeopard<=0)snowLeopard();}
 for(const meteor of meteors)meteor.age+=dt;meteors=meteors.filter(meteor=>meteor.age<meteor.life);
 if(phase==='waiting'){wait-=dt;if(wait<=0)form();}
 if(phase==='forming'&&phaseAge>=bubble.flight)touchdown();
 if(phase==='landing')settleDown(dt);
 if(['cooling','freezing','holding','frozen'].includes(phase))evolve(dt);
 if(bubble&&tips.length)growLace(dt);
 if(bubble&&!bubble.ending&&bubble.ice<1&&!preparingStill){fieldClock+=dt;if(fieldClock>=1/30){stirFilm(fieldClock);fieldClock=0;}}
 if(flakes.length)updateSurface(dt);
 if(perched.length)settlePerched(dt);
 if(phase==='collapsing'&&!updateBreak(dt)){const p=center();phase='settling';phaseAge=0;mound.x=p.x;mound.y=p.snow;mound.width=p.r*1.2;N.log('The last of the ice comes to rest on the snow');}
 if(phase==='settling'){
  mound.amount=Math.max(mound.amount,ease(clamp(phaseAge/bubble.settleTime,0,1))*.8);
  if(phaseAge>bubble.settleTime)clearBubble();
 }
 for(const g of puffs){
  const drag=Math.exp(-dt*g.drag);g.age+=dt;
  g.vx=(g.vx-wind*.4)*drag+wind*.4;g.vz*=drag;g.vh=g.vh*drag-5*dt;
  g.x+=g.vx*dt;g.z+=g.vz*dt;g.h=Math.max(0,g.h+g.vh*dt);
 }
 puffs=puffs.filter(g=>g.age<g.life);
 for(const m of marks)m.age+=dt;marks=marks.filter(m=>m.age<m.life);
 mound.amount*=phase==='settling'?1:Math.exp(-dt/mound.life);
 const p=bubble&&!bubble.ending?center():null;
 for(const f of snow){
  f.age+=dt;f.vx+=(wind*.4-f.vx)*(1-Math.exp(-dt*f.vy/(f.size+f.vy)));
  f.x+=(f.vx+(noise(f.offset+time*.2)-.5)*6)*dt;f.y+=f.vy*dt;
  if(p){
   const u=(f.x-p.x)/p.r,v=(f.y-p.y)/p.r,w=(f.z-p.z)/p.r;
   if(u*u+v*v+w*w<1){f.age=f.life;perch(f,u,v,w);}
  }
 }
 snow=snow.filter(f=>f.age<f.life&&f.y<GROUND+140+f.z*TS);
}
// The land: a real heightfield, carved by water, snowed on, lit by the moon and seen through the night air.
// All of it is built once from its own generator, a little each frame, so it never holds up the page and never touches the world's random numbers.
const LAND_W=N.LOWQ?640:1024,LAND_H=N.LOWQ?360:576,LX0=-1.1,LX1=1.1,LZ0=.05,LZ1=1.22,HORIZON=.59,EYE=.03,LENS=1.25;
const landStep=(LX1-LX0)/(LAND_W-1),landStepZ=(LZ1-LZ0)/(LAND_H-1);
// The moon sits up behind the camera to the left, low enough that every ridge throws a shadow.
const LAND_MOON=(()=>{const v=[-.66,.4,-.64],l=Math.hypot(...v);return v.map(n=>n/l);})();
const landRand=N.sfc32(R()*4294967296,R()*4294967296,R()*4294967296,R()*4294967296),land2=landNoise(landRand);
const landOffset=landRand()*50;
let landHeight=null,landColor=null,landBump=null,landJob=null,sceneryAt=0,sceneryDirty=0,skyline=null,perches=[],landView=null;
const reliefA=new Float32Array(65536),reliefB=new Float32Array(65536),reliefH=new Float32Array(65536);
const landFbm=(x,y,o)=>{let s=0,a=.5,f=1;for(let i=0;i<o;i++){s+=land2(x*f+i*11.7,y*f-i*7.3)*a;f*=2.03;a*=.5;}return s;};
// The wind has laid every drift on the field along one line, a little off the line of sight.
const windAngle=(landRand()<.5?-1:1)*(.1+landRand()*.3),WC=Math.cos(windAngle),WS=Math.sin(windAngle);
// One height for the land under any point, near or far.
const landAt=(x,z)=>{const h=landHeight,W=LAND_W,ax=x<LX0?2*LX0-x:x>LX1?2*LX1-x:x,u=clamp((ax-LX0)/landStep,0,W-1.001),v=clamp((z-LZ0)/landStepZ,0,LAND_H-1.001),i=u|0,j=v|0,a=u-i,b=v-j,k=j*W+i,m=h[k]+(h[k+1]-h[k])*a,n=h[k+W]+(h[k+W+1]-h[k+W])*a;return m+(n-m)*b;};
// Long low drifts running out from the foot of the range, the field rising a little as it goes.
const fieldAtLand=(x,z)=>{const a=x*WC+z*WS,b=z*WC-x*WS,tall=.7+z*1.2;return .012+band(z,.16,.6)*.0055+(land2(a*8+landOffset,b*2.4)*.0016+land2(a*21-landOffset,b*6.5)*.0005)*tall;};
// Trees grow in stands along the far edge of the snowfield, thick at the sides of the view and thinning toward the middle, so the bubble keeps clear air around it.
const treeStands=Array.from({length:9+Math.floor(landRand()*5)},()=>{const side=landRand()<.5?-1:1;return{u:.5+side*(.17+landRand()*.36),z:.34+landRand()*.2,size:.05+landRand()*.1,thick:.6+landRand()*.8};});
const trees=[];
for(const stand of treeStands)for(let tier=0;tier<3;tier++)for(let i=0,count=[46,20,5][tier]*stand.thick*stand.size/.1;i<count;i++){
 const u=stand.u+(landRand()+landRand()-1)*stand.size*(1.5-tier*.3);
 if(u>-.03&&u<1.03)trees.push({u,z:stand.z*(1+[.15,.05,-.05][tier]*(.6+landRand()*.8)),tall:[.012,.021,.034][tier]*(.55+landRand()*.9),seed:landRand()*4294967296});
}
trees.sort((a,d)=>d.z-a.z);
function landNoise(rand){
 const p=new Uint8Array(512),gx=new Float32Array(256),gy=new Float32Array(256);
 for(let i=0;i<256;i++){p[i]=i;const a=rand()*TAU;gx[i]=Math.cos(a);gy[i]=Math.sin(a);}
 for(let i=255;i>0;i--){const j=Math.floor(rand()*(i+1)),t=p[i];p[i]=p[j];p[j]=t;}
 for(let i=0;i<256;i++)p[i+256]=p[i];
 return(x,y)=>{
  const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,X=xi&255,Y=yi&255;
  const u=fx*fx*fx*(fx*(fx*6-15)+10),v=fy*fy*fy*(fy*(fy*6-15)+10);
  const a=p[p[X]+Y],b=p[p[X+1]+Y],c2=p[p[X]+Y+1],d=p[p[X+1]+Y+1];
  const n0=gx[a]*fx+gy[a]*fy,n1=gx[b]*(fx-1)+gy[b]*fy,n2=gx[c2]*fx+gy[c2]*(fy-1),n3=gx[d]*(fx-1)+gy[d]*(fy-1);
  const m=n0+(n1-n0)*u,n=n2+(n3-n2)*u;return(m+(n-m)*v)*1.5;
 };
}
function* buildLand(){
 const W=LAND_W,H=LAND_H,h=new Float32Array(W*H),off=landOffset,fbm=landFbm;
 // Ridged multifractal: each octave only adds detail where the one before it made a ridge, which is how real crests look.
 const ridged=(x,y,o)=>{
  let s=0,a=.55,f=1,w=1;
  for(let i=0;i<o;i++){
   const c=Math.cos(i*.7),d=Math.sin(i*.7),u=(x*c-y*d)*f+i*5.1,v=(x*d+y*c)*f-i*3.3;
   let n=1-Math.abs(land2(u,v));n*=n;
   const g=n*w;s+=g*a;w=clamp(g*2.1,0,1);f*=2.07;a*=.52;
  }
  return s;
 };
 // Everything that varies only along the range is worked out once per column.
 const spineAt=new Float32Array(W),farAt=new Float32Array(W),lowAt=new Float32Array(W),peakAt=new Float32Array(W),backAt=new Float32Array(W);
 for(let i=0;i<W;i++){
  const x=LX0+i*landStep;
  spineAt[i]=.76+fbm(x*1.2+off+3,.5,3)*.2;farAt[i]=1.08+fbm(x*1.5-off,2.5,2)*.09;lowAt[i]=.36+fbm(x*2+off,5.5,3)*.08;
  peakAt[i]=clamp(.66+fbm(x*2.1+off+8,1.5,3)*1.7,.12,1.3);backAt[i]=clamp(.8+fbm(x*2.6-off,8,2)*1.4,.3,1.2);
 }
 // The land folds and wanders before the ridges are laid on it. The fold is smooth, so a coarse grid carries it.
 const CW=(W>>3)+2,CH=(H>>3)+2,wx=new Float32Array(CW*CH),wz=new Float32Array(CW*CH);
 for(let j=0;j<CH;j++)for(let i=0;i<CW;i++){
  const x=LX0+i*8*landStep,z=LZ0+j*8*landStepZ,k=j*CW+i;
  wx[k]=fbm(x*1.6+off,z*1.6,3)*.17;wz[k]=fbm(x*1.6-off,z*1.6+9,3)*.17;
 }
 yield;
 for(let j=0;j<H;j++){
  const z=LZ0+j*landStepZ,cj=j>>3,tj=(j&7)/8;
  for(let i=0;i<W;i++){
   const x=LX0+i*landStep,ci=i>>3,ti=(i&7)/8,k=cj*CW+ci;
   const fx=x+(wx[k]*(1-ti)+wx[k+1]*ti)*(1-tj)+(wx[k+CW]*(1-ti)+wx[k+CW+1]*ti)*tj,fz=z+(wz[k]*(1-ti)+wz[k+1]*ti)*(1-tj)+(wz[k+CW]*(1-ti)+wz[k+CW+1]*ti)*tj;
   const main=Math.exp(-(((z-spineAt[i])/.23)**2)),back=Math.exp(-(((z-farAt[i])/.17)**2)),foot=Math.exp(-(((z-lowAt[i])/.1)**2));
   const rock=ridged(fx*2.1+off,fz*2.1,8);
   h[j*W+i]=Math.max(0,main*peakAt[i]*(.03+rock*.135)+back*backAt[i]*(.04+rock*.125)+foot*(.012+rock*.03)+.012);
  }
  if((j&7)===7)yield;
 }
 // Every night has a real range in it: the highest ground in view is brought to a seeded height in the sky.
 let most=0;
 for(let j=0;j<H;j++){const z=LZ0+j*landStepZ;for(let i=0;i<W;i++)if(Math.abs(LX0+i*landStep)<z*.7)most=Math.max(most,(h[j*W+i]-.03)/z);}
 const lift=(.215+landRand()*.075)/most;
 for(let i=0;i<W*H;i++)h[i]=.012+(h[i]-.012)*lift;
 yield;
 yield* erodeLand(h,W,H,N.LOWQ?24000:60000);
 // Drops cut grooves one cell wide. Weathering opens them out.
 const worn=blurLand(h,W,H,1);
 for(let i=0;i<W*H;i++)h[i]=h[i]*.62+worn[i]*.38;
 yield;
 // Snow lies in the hollows and rounds them over. Rock ribs still stand out of it.
 const smooth=blurLand(h,W,H,2);
 for(let i=0;i<W*H;i++)h[i]=Math.max(h[i],smooth[i]+.00012);
 yield;
 // The snowfield is part of the same land. It runs out from the foot of the range, and the erosion above never reaches it.
 for(let j=0;j<H;j++){
  const z=LZ0+j*landStepZ;
  for(let i=0;i<W;i++){
   const x=LX0+i*landStep,k=j*W+i,field=fieldAtLand(x,z),reach=band(z+fbm(x*3+off,z*3,2)*.1,.24,.44);
   h[k]=field+(Math.max(h[k],field)-field)*reach;
  }
  if((j&31)===31)yield;
 }
 yield* paintLand(h,W,H);
 // A small repeating relief, lit from the moon's side.
 const size=256,rock=new Float32Array(size*size);
 for(let o=0;o<5;o++){
  const P=8<<o,g=Float32Array.from({length:P*P},()=>landRand()*2-1),amp=.6**o;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const fx=x/size*P,fy=y/size*P,ix=fx|0,iy=fy|0,tx=ease(fx-ix),ty=ease(fy-iy),i1=(ix+1)%P,j1=(iy+1)%P;
   const m=g[iy*P+ix]+(g[iy*P+i1]-g[iy*P+ix])*tx,n=g[j1*P+ix]+(g[j1*P+i1]-g[j1*P+ix])*tx;
   rock[y*size+x]+=Math.abs(m+(n-m)*ty)*amp;
  }
  yield;
 }
 landBump=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)landBump[y*size+x]=clamp((rock[y*size+((x+1)&255)]-rock[y*size+((x-1)&255)]+rock[((y+1)&255)*size+x]-rock[((y-1)&255)*size+x])*2.6,-.8,.8);
 yield* buildRelief();
 landHeight=h;
}
// Relief finer than the land's grid: the crust and ripples the wind leaves, which only show close to. It tiles, and is read at three sizes so it never seems to.
function* buildRelief(){
 const size=256,crust=new Float32Array(size*size);
 for(let o=0;o<6;o++){
  const P=4<<o,g=Float32Array.from({length:P*P},()=>landRand()*2-1),amp=.54**o;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const fx=x/size*P,fy=y/size*P,ix=fx|0,iy=fy|0,tx=ease(fx-ix),ty=ease(fy-iy),i1=(ix+1)%P,j1=(iy+1)%P;
   const m=g[iy*P+ix]+(g[iy*P+i1]-g[iy*P+ix])*tx,n=g[j1*P+ix]+(g[j1*P+i1]-g[j1*P+ix])*tx,v=m+(n-m)*ty;
   // Wind cuts the larger forms to a soft edge. The grain on them stays round.
   crust[y*size+x]+=(o<3?.5-Math.abs(v)*.9:v)*amp;
  }
  yield;
 }
 let slope=0,mean=0,spread=0;
 for(let i=0;i<crust.length;i++)mean+=crust[i]/crust.length;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const k=y*size+x,a=(crust[y*size+((x+1)&255)]-crust[y*size+((x-1)&255)])/2,b=(crust[((y+1)&255)*size+x]-crust[((y-1)&255)*size+x])/2;
  reliefA[k]=a;reliefB[k]=b;reliefH[k]=crust[k]-mean;slope+=a*a+b*b;spread+=(crust[k]-mean)**2;
 }
 slope=1/Math.sqrt(slope/crust.length);spread=1/Math.sqrt(spread/crust.length);
 for(let i=0;i<crust.length;i++){reliefA[i]*=slope;reliefB[i]*=slope;reliefH[i]*=spread;}
}
function* erodeLand(h,W,H,drops){
 // Water does the carving. Each drop runs downhill, picks up what its speed can carry and drops it as it slows, and branching gullies come out of that.
 const unit=1/landStep,inertia=.08,capacity=5,minSlope=.012,dig=.35,lay=.25,evaporate=.022,gravity=5,life=46;
 for(let i=0;i<W*H;i++)h[i]*=unit;
 for(let d=0;d<drops;d++){
  let x=1+landRand()*(W-3),y=1+landRand()*(H-3),dx=0,dy=0,speed=1,water=1,load=0;
  for(let s=0;s<life;s++){
   const ix=x|0,iy=y|0,fx=x-ix,fy=y-iy,k=iy*W+ix,a=h[k],b=h[k+1],c2=h[k+W],e=h[k+W+1];
   const gx=(b-a)*(1-fy)+(e-c2)*fy,gy=(c2-a)*(1-fx)+(e-b)*fx,here=a*(1-fx)*(1-fy)+b*fx*(1-fy)+c2*(1-fx)*fy+e*fx*fy;
   dx=dx*inertia-gx*(1-inertia);dy=dy*inertia-gy*(1-inertia);
   const l=Math.hypot(dx,dy);if(l<1e-6)break;dx/=l;dy/=l;
   const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=W-2||ny>=H-2)break;
   const jx=nx|0,jy=ny|0,qx=nx-jx,qy=ny-jy,m=jy*W+jx,next=h[m]*(1-qx)*(1-qy)+h[m+1]*qx*(1-qy)+h[m+W]*(1-qx)*qy+h[m+W+1]*qx*qy;
   const drop=here-next,room=Math.max(drop,minSlope)*speed*water*capacity;
   if(load>room||drop<0){
    const put=drop<0?Math.min(-drop,load):(load-room)*lay;load-=put;
    h[k]+=put*(1-fx)*(1-fy);h[k+1]+=put*fx*(1-fy);h[k+W]+=put*(1-fx)*fy;h[k+W+1]+=put*fx*fy;
   }else{
    const take=Math.min((room-load)*dig,drop);load+=take;
    // Spread the cut so a gully has width.
    const w=take*.125;h[k]-=take*.5*(1-fx)*(1-fy)+w;h[k+1]-=take*.5*fx*(1-fy)+w;h[k+W]-=take*.5*(1-fx)*fy+w;h[k+W+1]-=take*.5*fx*fy+w;
   }
   speed=Math.sqrt(Math.max(.01,speed*speed+drop*gravity));water*=1-evaporate;x=nx;y=ny;
  }
  if(d%800===799)yield;
 }
 for(let i=0;i<W*H;i++)h[i]/=unit;
}
function blurLand(h,W,H,r){
 const a=new Float32Array(W*H),b=new Float32Array(W*H),n=r*2+1;
 for(let j=0;j<H;j++){let s=0;for(let i=-r;i<=r;i++)s+=h[j*W+clamp(i,0,W-1)];for(let i=0;i<W;i++){a[j*W+i]=s/n;s+=h[j*W+Math.min(W-1,i+r+1)]-h[j*W+Math.max(0,i-r)];}}
 for(let i=0;i<W;i++){let s=0;for(let j=-r;j<=r;j++)s+=a[clamp(j,0,H-1)*W+i];for(let j=0;j<H;j++){b[j*W+i]=s/n;s+=a[Math.min(H-1,j+r+1)*W+i]-a[Math.max(0,j-r)*W+i];}}
 return b;
}
function* paintLand(h,W,H){
 const color=new Uint8ClampedArray(W*H*4),shadow=new Float32Array(W*H),line=new Float32Array(H),next=new Float32Array(H),[lx,ly,lz]=LAND_MOON,off=landOffset;
 // Sweep from the moon's side and carry the height of the highest ground that could block it.
 const drop=ly/Math.hypot(lx,lz)*landStep/Math.abs(lx/Math.hypot(lx,lz)),shift=lz/lx*landStep/landStepZ;
 for(let i=0;i<W;i++){
  for(let j=0;j<H;j++){
   const k=j*W+i,from=j+shift,a=Math.floor(from),t=from-a,past=i?(line[clamp(a,0,H-1)]*(1-t)+line[clamp(a+1,0,H-1)]*t)-drop:-1;
   next[j]=Math.max(h[k],past);shadow[k]=clamp((past-h[k])/.004,0,1);
  }
  line.set(next);
  if((i&127)===127)yield;
 }
 const soft=blurLand(shadow,W,H,1),wide=blurLand(h,W,H,9),near=blurLand(h,W,H,2);
 yield;
 // Runnels: noise smeared along the real downhill path of every point, which is how snow ribs and avalanche tracks lie on a face.
 const speck=new Float32Array(W*H),streak=new Float32Array(W*H);
 for(let j=0;j<H;j++){for(let i=0;i<W;i++)speck[j*W+i]=land2(i*.71,j*.71)+land2(i*.29+7,j*.29)*.3;if((j&63)===63)yield;}
 for(let j=2;j<H-2;j++){
  for(let i=2;i<W-2;i++){
   let x=i,y=j,sum=speck[j*W+i],n=1;
   for(let s=0;s<11;s++){
    const q=(y|0)*W+(x|0),gx=h[q+1]-h[q-1],gy=(h[q+W]-h[q-W])*.6,l=Math.hypot(gx,gy);
    if(l<1e-6)break;x-=gx/l*1.3;y-=gy/l*1.3;
    if(x<2||y<2||x>W-3||y>H-3)break;
    sum+=speck[(y|0)*W+(x|0)];n++;
   }
   streak[j*W+i]=sum/n*2.1;
  }
  if((j&15)===15)yield;
 }
 for(let j=1;j<H-1;j++){
  for(let i=1;i<W-1;i++){
   // The view compresses distance, so the true slope is gentler than it looks in plan.
   const k=j*W+i,gx=(h[k+1]-h[k-1])/(2*landStep)*.72,gz=(h[k+W]-h[k-W])/(2*landStepZ)*.72,nl=1/Math.hypot(gx,1,gz),nx=-gx*nl,ny=nl,nz=-gz*nl;
   const x=LX0+i*landStep,z=LZ0+j*landStepZ,e=h[k],steep=1-ny,light=Math.max(0,nx*lx+ny*ly+nz*lz);
   const hollow=clamp((wide[k]-e)*38,-1,1),crease=clamp((near[k]-e)*520,-1,1),rill=streak[k];
   // Snow only holds up to about fifty degrees. Beyond that the rock shows in broken bands, with snow caught on its ledges.
   const mottle=landFbm(x*26+off,z*26,3),ledge=land2(x*46+off,e*1400+mottle*2),bare=band(steep+mottle*.11+rill*.06-crease*.06,.2,.31)*band(ledge+.35,-.25,.2);
   const strata=.74+.26*Math.sin(e*560+mottle*6)+ledge*.16,open=1-soft[k],lit=open*light;
   // The moon lights snow white. Shade fills in from the sky, blue, and snow bounces a little to itself.
   const sky=(.36+.3*ny-.14*clamp(hollow,0,1)+.05*crease)*(1+rill*.32*(.3+steep*2.4)),moon=lit*(1.12+rill*.5*(.3+steep*2.2))*(1+.3*(1-band(steep,0,.1)));
   let r=214*moon+112*sky,g=226*moon+140*sky,b=242*moon+192*sky;
   const rockShade=(lit*.9+sky*.44)*strata;
   r+=(84*rockShade-r)*bare;g+=(92*rockShade-g)*bare;b+=(108*rockShade-b)*bare;
   // Trees climb the lower slopes and stop where the cold does. Seen from this far they are a dark, snow-flecked grain.
   if(e<.11){
    const timber=band(.082+mottle*.07-e,0,.012)*(1-band(steep,.16,.3))*band(e+mottle*.018,.036,.046)*band(landFbm(x*7-off,z*7,2)+.14,0,.12),stand=band(speck[k]*1.5,-.5,.4),forest=timber*(.84+.14*stand),dark=.24+lit*.3;
    r+=(34*dark-r)*forest;g+=(46*dark-g)*forest;b+=(60*dark-b)*forest;
   }
   // Highlights roll off together, so bright snow keeps its color instead of clipping.
   const roll=1/(1+Math.max(r,g,b)/430)*1.5;
   color[k*4]=r*roll;color[k*4+1]=g*roll;color[k*4+2]=b*roll;color[k*4+3]=40+bare*215;
  }
  if((j&15)===15)yield;
 }
 landColor=color;
}
// The whole view is one surface under one moon, so the snow at the bubble's foot and the snow on the peaks are the same stuff.
function* renderLand(g,RW,RH){
 const out=g.createImageData(RW,RH),data=out.data,ridge=new Float32Array(RW),W=LAND_W,H=LAND_H,col=landColor,hazeR=52,hazeG=72,hazeB=104,seen=.74,cx=RW/2,horizon=RH*HORIZON,focal=RH*LENS;
 const [lx,,lz]=LAND_MOON,moonA=WC*lx+WS*lz,moonB=WC*lz-WS*lx,slant=Math.abs(WS),near=.62;
 // [width across the wind, stretch along it, how steep]. Each size fades out before the pixels can no longer hold it.
 const sizes=[[.11,1.8,.075],[.03,2.3,.066],[.0072,1.7,.05]];
 for(let px=0;px<RW;px++){
  const dirx=(px+.5-cx)/focal;let top=RH,z=LZ0+.002,dz=.0002,prevY=RH,prevZ=z;
  while(z<LZ1&&top>0){
   const e=landAt(dirx*z,z),y=horizon-(e-EYE)/z*focal;
   if(y<top){
    const start=Math.max(0,Math.floor(y));
    for(let py=(top-1)|0;py>=start;py--){
     const t=prevY===y?1:clamp((prevY-(py+.5))/(prevY-y),0,1),zz=prevZ+(z-prevZ)*t,xx=dirx*zz,bx=xx<LX0?2*LX0-xx:xx>LX1?2*LX1-xx:xx;
     const u=clamp((bx-LX0)/landStep,0,W-1.001),v=clamp((zz-LZ0)/landStepZ,0,H-1.001),i=u|0,j=v|0,a=u-i,b=v-j,k=(j*W+i)*4,w=W*4,q=(1-a)*(1-b),s=a*(1-b),m=(1-a)*b,n=a*b;
     let r=col[k]*q+col[k+4]*s+col[k+w]*m+col[k+w+4]*n,gg=col[k+1]*q+col[k+5]*s+col[k+w+1]*m+col[k+w+5]*n,bb=col[k+2]*q+col[k+6]*s+col[k+w+2]*m+col[k+w+6]*n;
     // Grain finer than the land itself, stronger on rock than on snow.
     const rough=(col[k+3]*q+col[k+7]*s+col[k+w+3]*m+col[k+w+7]*n)/255*band(zz,.26,.5),lift=1+landBump[(((v*4.3)&255)<<8)|((u*4.3)&255)]*rough;r*=lift;gg*=lift;bb*=lift;
     if(zz<near){
      // Close to, the drifts turn their faces to the moon or away from it. That changes the moon's share of the light, and what is left is blue from the sky.
      const across=xx*WC+zz*WS,along=zz*WC-xx*WS,foot=zz*zz/((EYE-.012)*focal),wide=zz/focal;
      let turn=0,hollow=0;
      for(let d=0;d<3;d++){
       const size=sizes[d],span=size[0],long=span*size[1],seen1=clamp(2-Math.max((foot*slant+wide)/span,foot/long)*43,0,1);
       if(seen1<=0)continue;
       const fa=across/span*256,fb=along/long*256,ia=Math.floor(fa),ib=Math.floor(fb),ta=fa-ia,tb=fb-ib,i0=ia&255,i1=(ia+1)&255,j0=(ib&255)<<8,j1=((ib+1)&255)<<8;
       const p=j0+i0,p2=j0+i1,p3=j1+i0,p4=j1+i1,c0=(1-ta)*(1-tb),c1=ta*(1-tb),c2=(1-ta)*tb,c3=ta*tb;
       const ga=reliefA[p]*c0+reliefA[p2]*c1+reliefA[p3]*c2+reliefA[p4]*c3,gb=reliefB[p]*c0+reliefB[p2]*c1+reliefB[p3]*c2+reliefB[p4]*c3,hh=reliefH[p]*c0+reliefH[p2]*c1+reliefH[p3]*c2+reliefH[p4]*c3;
       turn-=(ga*moonA+gb*moonB/size[1])*size[2]*seen1;hollow+=hh*size[2]*seen1;
      }
      const plain=1-band(e,.03,.05);turn*=plain;hollow*=plain;
      r+=turn*236+hollow*26;gg+=turn*248+hollow*26;bb+=turn*262+hollow*20;
     }
     // Air between here and the mountain.
     const air=Math.max(0,1-Math.exp(-(zz-.1)*.8)),o=(py*RW+px)*4;
     data[o]=(r+(hazeR-r)*air)*seen;data[o+1]=(gg+(hazeG-gg)*air)*seen;data[o+2]=(bb+(hazeB-bb)*air)*seen;data[o+3]=255;
    }
    top=Math.max(0,y);
   }
   prevY=y;prevZ=z;z+=dz;dz*=1.0045;
  }
  // Only the true skyline is soft.
  if(top>0&&top<RH){const row=Math.floor(top);data[(row*RW+px)*4+3]=255*(1-(top-row));}
  ridge[px]=top/RH;
  if((px&63)===63)yield;
 }
 g.putImageData(out,0,0);landView=out;
 // High places on the skyline, for the only animal that lives up there.
 const top=ridge.reduce((m,v)=>Math.min(m,v),1),limit=top+(ridge.reduce((a,v)=>a+v,0)/RW-top)*.8,span=Math.max(3,RW*.012|0),spots=[];
 for(let i=span;i<RW-span;i+=span)if(ridge[i]<limit&&ridge[i]<=ridge[i-span]&&ridge[i]<=ridge[i+span]&&i/RW>.03&&i/RW<.97)spots.push(i/RW);
 skyline=ridge;perches=spots.length?spots:[.5];
}
// Spruce under a winter's load. Dark boughs droop in uneven tiers and carry snow where it has settled, lit from the moon's side.
function conifer(g,x,base,tall,rand,air){
 const dark=`rgb(${18+air*34|0},${30+air*40|0},${38+air*52|0})`,spread=tall*(.17+rand()*.1),rows=Math.max(5,Math.round(tall/(2.8+tall*.03))),lean=(rand()-.5)*tall*.03;
 const mix=k=>`rgb(${(58+air*30)+(92-air*16)*k|0},${(78+air*30)+(92-air*14)*k|0},${(104+air*30)+(92-air*12)*k|0})`;
 g.fillStyle=dark;g.fillRect(x-tall*.01,base-tall*.16,tall*.02,tall*.17);
 // First the whole dark body, ragged at the edges.
 g.beginPath();g.moveTo(x+lean,base-tall);
 for(const side of [1,-1])for(let i=side>0?0:rows;side>0?i<=rows:i>=0;i+=side){
  const t=i/rows,y=base-tall*(1-t*.93),wide=spread*Math.pow(t,.86)*(.72+rand()*.52)+tall*.006;
  g.lineTo(x+lean*(1-t)+side*wide,y+tall*.016*rand());g.lineTo(x+lean*(1-t)+side*wide*.66,y-tall*.022);
 }
 g.closePath();g.fill();
 // Then the load of snow, bough by bough, and not on every bough.
 for(let i=0;i<rows;i++){
  const t=i/(rows-1),y=base-tall*(.1+t*.88),reach=spread*Math.pow(1-t,.86)*(.7+rand()*.5);
  for(const side of [-1,1]){
   if(rand()<.3)continue;
   const from=reach*rand()*.35,to=reach*(.7+rand()*.34),drop=tall*(.012+(1-t)*.03)*(.7+rand()*.7),thick=tall*(.008+rand()*.014)*(1+t);
   g.fillStyle=mix(side<0?.5+rand()*.5:.04+rand()*.34);
   g.beginPath();g.moveTo(x+lean*t+side*from,y);g.quadraticCurveTo(x+lean*t+side*(from+to)/2,y-thick,x+lean*t+side*to,y+drop);g.quadraticCurveTo(x+lean*t+side*(from+to)/2,y+thick*.7+drop*.5,x+lean*t+side*from,y+thick);g.closePath();g.fill();
  }
 }
}
// The moon behind the camera throws each tree's shadow away across the snow, to the right.
function treeShadow(g,x,base,tall,z,W,H){
 const reach=tall*z/(LENS*H)*2.3,dx=reach*.72/z*LENS*H,lift=(1/z-1/(z+reach*.7))*(EYE-.02)*LENS*H,wide=tall*.09;
 g.fillStyle='rgba(30,48,76,.34)';g.beginPath();g.moveTo(x-wide,base);g.lineTo(x+dx,base-lift);g.lineTo(x+wide,base+tall*.012);g.closePath();g.fill();
}
// Trees stand on the land itself, at their own distance, and the snow takes their feet. Soft resolution here is the camera's focus falling off behind the bubble.
function* renderScenery(){
 const W=width,H=height,RW=Math.min(W,N.LOWQ?640:1600),RH=Math.round(RW*H/W),soft=.62;
 const [land,pg]=layer(),[woods,wg]=layer();
 land.width=RW;land.height=RH;woods.width=Math.ceil(W*soft);woods.height=Math.ceil(H*soft);
 yield* renderLand(pg,RW,RH);
 wg.scale(soft,soft);
 for(let i=0;i<trees.length;i++){
  const t=trees[i],r=N.sfc32(t.seed,7,11,13);for(let k=0;k<8;k++)r();
  const x=t.u*W,base=H*(HORIZON+(EYE-landAt((t.u-.5)*W/H/LENS*t.z,t.z))/t.z*LENS),tall=t.tall/t.z*LENS*H,o=(clamp(base*RH/H|0,0,RH-1)*RW+clamp(x*RW/W|0,0,RW-1))*4,d=landView.data;
  treeShadow(wg,x,base,tall,t.z,W,H);
  conifer(wg,x,base+tall*.012,tall,r,band(t.z,.3,.75)*.6);
  wg.fillStyle=`rgb(${d[o]},${d[o+1]},${d[o+2]})`;wg.beginPath();wg.ellipse(x,base+tall*.02,tall*.17,tall*.022,0,0,TAU);wg.fill();
  if((i&31)===31)yield;
 }
 landView=null;
 if(W!==width||H!==height)return;
 scenery.width=W;scenery.height=H;
 sc.imageSmoothingEnabled=true;sc.imageSmoothingQuality='high';sc.drawImage(land,0,0,W,H);sc.drawImage(woods,0,0,W,H);
 const horizon=H*HORIZON;
 for(const g of grain){
  const depth=Math.pow(g.y,.65),x=g.x*W,y=horizon+12*pixel+depth*Math.max(1,H-horizon),size=(.15+depth*depth*g.w*.6)*pixel;
  sc.fillStyle=`rgba(214,230,240,${g.a*(.1+depth*.5)})`;sc.beginPath();sc.ellipse(x,y,size,size*.35,g.angle,0,TAU);sc.fill();
  if(g.a>.23&&depth>.5){sc.fillStyle=`rgba(232,244,250,${depth*.3})`;sc.fillRect(x,y,.65*pixel,.65*pixel);}
 }
 // A lens gathers the edge of the frame into shadow, which keeps the eye on the bubble.
 const edge=sc.createLinearGradient(0,H*.72,0,H);edge.addColorStop(0,'rgba(6,16,32,0)');edge.addColorStop(1,'rgba(6,16,32,.46)');sc.fillStyle=edge;sc.fillRect(0,H*.72,W,H*.28);
 sceneryAt=sceneryAt||performance.now();
}
function* allLand(){if(!landHeight)yield* buildLand();yield* renderScenery();}
// A slice of the land each frame until it is done, and a large one while nothing is showing yet. A still has no next frame, so it finishes at once.
function growScenery(){
 const now=performance.now();
 if(sceneryDirty&&now-sceneryDirty>160&&landHeight){sceneryDirty=0;landJob=renderScenery();}
 if(!landJob)return;
 const budget=sceneryAt?7:45;
 do{if(landJob.next().done){landJob=null;break;}}while(N.RM||performance.now()-now<budget);
}
function terrain(){
 background.width=width;background.height=height;
 const gradient=bg.createLinearGradient(0,0,0,height);gradient.addColorStop(0,'#050b19');gradient.addColorStop(.58,'#101f35');gradient.addColorStop(1,'#233c51');bg.fillStyle=gradient;bg.fillRect(0,0,width,height);
 skyHeight=Math.max(1,height*.62);
 if(!landJob&&!landHeight)landJob=allLand();else if(landHeight)sceneryDirty=performance.now();
}
function resize(){
 pixel=N.LOWQ?.75:Math.min(window.devicePixelRatio||1,2);
 width=Math.round(innerWidth*pixel);height=Math.round(innerHeight*pixel);
 canvas.width=width;canvas.height=height;buffer.width=width;buffer.height=height;
 view();scale=cameraScale;pan=cameraPan;cameraTime=time;
 terrain();draw();
}
function view(){
 // Fit the camera to the sampled size rather than limiting the bubble's radius. A narrow screen pans to keep the landing in frame.
 const b=bubble,r=b?b.radius*nearness(b.spotZ):150;
 // The bubble is close to the lens and fills most of the frame.
 cameraScale=Math.min(width*.45,height*(b?b.close:.36))/r;
 const room=width/2/cameraScale-r*1.08,off=b?b.spot-CX:0;
 cameraPan=Math.sign(off)*Math.max(0,Math.abs(off)-Math.max(0,room));
 ox=width/2-(CX+pan)*scale;oy=height*.81-CONTACT*scale;
}
function drawSky(){
 c.save();c.beginPath();c.rect(0,0,width,skyHeight);c.clip();
 for(const s of stars){
  const glow=N.RM?1:(.5+.5*Math.sin(time*s.rate*3+s.phase))*(.7+.3*noise(s.phase+time*.3));
  c.globalAlpha=s.alpha*(N.RM?1:.18+.82*glow);c.fillStyle=s.color;
  const x=Math.round(s.x*width),y=Math.round(s.y*skyHeight),size=s.size===2?2:1;c.fillRect(x,y,size,size);
  if(!N.RM&&s.alpha>.55&&glow>.62){c.globalAlpha=(glow-.62)*1.3;c.fillStyle='#e0f3ff';c.fillRect(x-1,y,3,1);c.fillRect(x,y-1,1,3);}
 }
 c.globalAlpha=1;
 for(const g of constellations){
  const extent=Math.min(width*.17,skyHeight*.36),x=g.x*width-extent/2,y=g.y*skyHeight*.62-extent/2;
  for(let i=0;i<g.points.length;i++){const p=g.points[i],px=x+p[0]*extent,py=y+p[1]*extent;c.fillStyle='#b6d7f01c';c.fillRect(px-1,py-1,4,4);c.fillStyle=g.names[i]==='Betelgeuse'?'#ffc293':'#deefff';c.fillRect(px,py,2,2);}
 }
 for(const meteor of meteors){const t=meteor.age/meteor.life,x=(meteor.x+meteor.dx*t)*width,y=(meteor.y+meteor.dy*t)*skyHeight;c.globalAlpha=Math.sin(t*Math.PI);line(c,x,y,x-meteor.dx*width*.18,y-meteor.dy*skyHeight*.18,'#bce2f0',1);}
 c.restore();
}
// The moon is a small lit sphere with its own dark seas, painted once. The lit limb always faces down toward where the sun went.
const moonImage=new WeakMap();
function moonFace(m,r){
 const known=moonImage.get(m);if(known&&known.r===r)return known.v;
 const [v,g]=layer(),q=Math.ceil(r)+2,size=q*2;v.width=v.height=size;
 const out=g.createImageData(size,size),data=out.data,angle=Math.PI*(1-m.phase),lx=Math.sin(angle),lz=Math.cos(angle),ct=Math.cos(m.tilt),st=Math.sin(m.tilt),o=m.offset%37;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5-q)/r,w=(y+.5-q)/r,reach=u*u+w*w,i=(y*size+x)*4;if(reach>=1.05)continue;
  const d=Math.sqrt(Math.max(0,1-reach)),nx=u*ct+w*st,ny=w*ct-u*st;
  // Broad dark seas, then the fine pale splash of craters.
  const seas=band(value3(nx*2.1+o,ny*2.1,d*2.1)+value3(nx*4.6,ny*4.6+o,d*4.6)*.45,.62,1.05),dust=value3(nx*13+o,ny*13,d*13)*.2+value3(nx*29,ny*29+o,d*29)*.12,tone=.74-.34*seas+dust;
  // The line between day and night on it is soft, and the dark part keeps a trace of earthshine.
  const lit=band(nx*lx+d*lz+.03,-.05,.16),limb=.84+.16*d,glow=lit*tone*limb,earth=.05*tone*(1-lit);
  data[i]=clamp(16+glow*240+earth*200,0,255);data[i+1]=clamp(24+glow*234+earth*220,0,255);data[i+2]=clamp(40+glow*216+earth*260,0,255);
  data[i+3]=clamp((1-Math.sqrt(reach))*r+.5,0,1)*(.34+.66*band(lit,0,.25))*255;
 }
 g.putImageData(out,0,0);moonImage.set(m,{r,v});return v;
}
function moonLayer(){
 const m=moon;if(!m)return;
 const r=Math.max(3,Math.min(height,width*1.2)*m.size),x=m.u*width,y=m.v*height,bright=.3+.7*m.phase**1.5,q=Math.ceil(r)+2;
 c.save();c.beginPath();c.rect(0,0,width,skyHeight);c.clip();
 // Air scatters what the moon sends, so the sky around it is lit, more as it fills.
 c.globalCompositeOperation='lighter';
 c.globalAlpha=.11*bright;c.drawImage(softDot,x-r*7,y-r*7,r*14,r*14);
 c.globalAlpha=.18*bright;c.drawImage(softDot,x-r*2.4,y-r*2.4,r*4.8,r*4.8);
 c.globalCompositeOperation='source-over';c.globalAlpha=1;c.drawImage(moonFace(m,r),x-q,y-q);
 c.restore();
}
// The curtain is painted small and stretched over the sky, which is what softens it. Each column has its own lower edge, height and brightness, all slowly moving.
const AURORA_W=N.LOWQ?160:320,AURORA_H=N.LOWQ?64:128;
let auroraData=null,auroraStamp=-1;
const auroraPower=a=>a.power*band(a.age,0,20)*(1-band(a.age,a.life-24,a.life))*(.72+.28*noise(a.offset+a.age*.05));
function auroraLayerDraw(){
 const a=aurora;if(!a)return;
 const power=auroraPower(a);if(power<=.002)return;
 if(!auroraData){auroraLayer.width=AURORA_W;auroraLayer.height=AURORA_H;auroraData=al.createImageData(AURORA_W,AURORA_H);}
 if(auroraStamp<0||Math.abs(time-auroraStamp)>=.09){
  auroraStamp=time;
  const data=auroraData.data,t=a.age*a.pace,o=a.offset;
  for(let x=0;x<AURORA_W;x++){
   const u=x/AURORA_W,side=band(u,a.from,a.from+.16)*(1-band(u,a.to-.16,a.to));
   const foot=a.base+(noise(o+u*2.3+t*.016)-.5)*.34+(noise(o+70+u*6.1-t*.03)-.5)*.1+(noise(o+600+u*37+t*.04)-.5)*.07,tall=a.tall*(.55+.8*noise(o+500+u*3+t*.022));
   const rays=(.45+.55*noise(o+200+u*17+t*.05))*(.55+.45*noise(o+300+u*47-t*.09))*(.75+.25*noise(o+400+u*110+t*.2)),col=side*rays;
   for(let y=0;y<AURORA_H;y++){
    const i=(y*AURORA_W+x)*4,above=foot-y/AURORA_H,k=col*band(above,-.1,.07)*Math.exp(-Math.max(0,above)/tall),high=band(above/tall,.7,2);
    // Oxygen glows green low down and a thin red higher up.
    data[i]=70+150*high;data[i+1]=236-170*high;data[i+2]=168+20*high;data[i+3]=k*255;
   }
  }
  al.putImageData(auroraData,0,0);
 }
 c.save();c.beginPath();c.rect(0,0,width,skyHeight);c.clip();c.globalCompositeOperation='lighter';c.globalAlpha=power;c.imageSmoothingEnabled=true;c.drawImage(auroraLayer,0,0,width,skyHeight);c.restore();
}
// Snow takes up a breath of that light.
function auroraOnSnow(){
 const a=aurora;if(!a)return;
 const power=auroraPower(a);if(power<=.002)return;
 const top=height*HORIZON,bottom=height*.86,wash=c.createLinearGradient(0,top,0,bottom);
 wash.addColorStop(0,'rgba(90,230,170,0)');wash.addColorStop(.3,`rgba(90,230,170,${power*.11})`);wash.addColorStop(1,'rgba(90,230,170,0)');
 c.save();c.globalCompositeOperation='lighter';c.fillStyle=wash;c.fillRect(0,top,width,bottom-top);c.restore();
}
// Single grains flash as the night moves, the way moonlit snow does.
function sparkle(){
 const horizon=height*.59+14*pixel;
 c.fillStyle='#e6f3fb';
 for(const g of glints){
  const v=noise(g.phase+time*g.rate);if(v<.8)continue;
  const depth=g.y**1.4,x=g.x*width,y=horizon+depth*(height-horizon),a=(v-.8)*5,s=(.5+depth*g.size)*pixel;
  c.globalAlpha=a*(.3+.5*depth);c.fillRect(x-s/2,y-s/2,s,s);
  if(a>.7){c.globalAlpha=(a-.7)*(.5+depth*.5);c.fillRect(x-s*1.6,y-s*.16,s*3.2,s*.32);c.fillRect(x-s*.16,y-s*1.6,s*.32,s*3.2);}
 }
 c.globalAlpha=1;
}
function crystalBranches(f){
 let branches=crystalGeometry.get(f);if(branches)return branches;
 branches=[];branches.blades=[];
 const q=f.shape,seed=Math.floor(f.offset*53);let n=0;
 const h=()=>NT[(seed+(n++)*131)&4095];
 // One feathered blade: a straight spine, barbs close together and nearly parallel, longest through the middle and running out toward the point.
 function blade(x,y,a,length,start,depth){
  const ux=Math.cos(a),uy=Math.sin(a),mid=length*.6,tip=length*.86;
  // The spine thins toward a sharp point.
  branches.push({x,y,x2:x+ux*mid,y2:y+uy*mid,start,end:start+mid,level:0});
  branches.push({x:x+ux*mid,y:y+uy*mid,x2:x+ux*tip,y2:y+uy*tip,start:start+mid,end:start+tip,level:1});
  branches.push({x:x+ux*tip,y:y+uy*tip,x2:x+ux*length,y2:y+uy*length,start:start+tip,end:start+length,level:2});
  const left=1-q.skew,right=1+q.skew,feather=f.size*q.barb,bareFrom=1-q.bare*(.6+h()*.4),outline=[[x,y]],far=[];
  for(let d=length*.07;d<length*bareFrom;d+=f.size*q.gap*(.72+h()*.56)){
   const t=d/length,shape=Math.sin(Math.PI*t**.72)**.7,px=x+ux*d,py=y+uy*d;
   for(const side of [-1,1]){
    const reach=feather*shape*(side<0?left:right)*(.62+h()*.76);
    if(reach<f.size*.012)continue;
    const b=a+side*q.sweep,bx=Math.cos(b),by=Math.sin(b);
    // A strong barb now and then grows into an arm of its own.
    if(depth<1&&reach>feather*.7&&h()<q.fork*.12){blade(px,py,b,reach*(1.5+h()*1.4),start+d,depth+1);continue;}
    branches.push({x:px,y:py,x2:px+bx*reach,y2:py+by*reach,start:start+d,end:start+d+reach,level:1});
    if(reach>f.size*.08&&h()<q.twig){
     const mid=reach*(.35+h()*.35),twig=reach*.3,mx=px+bx*mid,my=py+by*mid,t2=b+(h()<.5?-1:1)*q.sweep;
     branches.push({x:mx,y:my,x2:mx+Math.cos(t2)*twig,y2:my+Math.sin(t2)*twig,start:start+d+mid,end:start+d+mid+twig,level:2});
    }
   }
   (t<.5?outline:far).push([px-uy*feather*shape*right*.72,py+ux*feather*shape*right*.72]);
  }
  // The milky body of the blade between its barbs.
  if(!depth){
   const back=[];
   for(let d=length*.9;d>0;d-=length/7){const t=d/length,shape=Math.sin(Math.PI*t**.72)**.7;back.push([x+ux*d+uy*feather*shape*left*.72,y+uy*d-ux*feather*shape*left*.72]);}
   branches.blades.push([...outline,...far,[x+ux*length,y+uy*length],...back]);
  }
 }
 const twist=q.wobble,order=[0,1,2,3,4,5].map(i=>[NT[(seed+i*57)&4095],i]).sort((a,d)=>a[0]-d[0]);
 // Not every arm grows. Most crystals on a film are lopsided, with one or two long arms and the rest short or missing.
 order.forEach(([,i],rank)=>{
  if(rank>1&&h()>q.full)return;
  const a=i*TAU/6+twist+(h()-.5)*.05,length=f.size*(.3+.7*h()**q.uneven)*(rank?1:1.05);
  blade(0,0,a,length,0,0);
 });
 if(q.plate>.02){
  const ring=[];for(let i=0;i<6;i++){const a=i*TAU/6+twist;ring.push([Math.cos(a)*f.size*q.plate,Math.sin(a)*f.size*q.plate]);}
  branches.blades.push(ring);
 }
 branches.reach=branches.reduce((radius,branch)=>Math.max(radius,Math.hypot(branch.x2,branch.y2)),0);
 branches.span=branches.reduce((most,branch)=>Math.max(most,branch.end),1);
 crystalGeometry.set(f,branches);return branches;
}
function crystalBasis(f){
 let horizontal=Math.hypot(f.nx,f.nz),ux=horizontal?f.nz/horizontal:1,uz=horizontal?-f.nx/horizontal:0;
 let vx=f.ny*uz,vy=horizontal,vz=-f.ny*ux,cos=Math.cos(f.rotation),sin=Math.sin(f.rotation);
 return{ux,uz,vx,vy,vz,cos,sin};
}
function crystalSurface(f,x,y,p,basis=crystalBasis(f)){
 let {ux,uz,vx,vy,vz,cos,sin}=basis;
 let tx=x*cos-y*sin,ty=x*sin+y*cos,distance=Math.hypot(tx,ty),angle=distance/p.r;
 let radial=Math.cos(angle),tangent=distance?Math.sin(angle)/distance:0;
 return{nx:f.nx*radial+(ux*tx+vx*ty)*tangent,ny:f.ny*radial+vy*ty*tangent,nz:f.nz*radial+(uz*tx+vz*ty)*tangent};
}
function crystal(f,front){
 const growth=ease(clamp(f.age/f.growth,0,1)),branches=crystalBranches(f),size=branches.span*growth;
 if(!size)return;
 const p=center(),near=depthOf(f.ny,f.nz);
 if(front!==undefined&&(near>=0)!==front&&Math.abs(near)>branches.reach*growth/p.r*1.3)return;
 const basis=crystalBasis(f),light=(.62+.38*Math.max(0,f.nx*MOON[0]+f.ny*MOON[1]+f.nz*MOON[2]))*(front===false?.5:1);
 // Project every branch point onto the sphere, including branches that cross its silhouette.
 function visible(v){return front===undefined||(depthOf(v.ny,v.nz)>=0)===front;}
 function edge(a,b){
  if(!visible(a)&&!visible(b))return;
  if(visible(a)!==visible(b)){
   const da=depthOf(a.ny,a.nz),db=depthOf(b.ny,b.nz),t=da/(da-db),rim={nx:a.nx+(b.nx-a.nx)*t,ny:a.ny+(b.ny-a.ny)*t,nz:a.nz+(b.nz-a.nz)*t},length=Math.hypot(rim.nx,rim.ny,rim.nz);
   rim.nx/=length;rim.ny/=length;rim.nz/=length;
   if(visible(a))b=rim;else a=rim;
  }
  const pa=surfacePoint(a,p),pb=surfacePoint(b,p);
  c.moveTo(pa.x,pa.y);c.lineTo(pb.x,pb.y);
 }
 c.save();
 // The milky body of each blade, under its barbs.
 c.fillStyle='#c9e0ec';c.globalAlpha=light*.2*Math.max(.35,Math.abs(near));
 for(const blade of branches.blades){
  c.beginPath();let shown=0;
  for(const v of blade){const q=crystalSurface(f,v[0]*growth,v[1]*growth,p,basis);if(visible(q)){const w=surfacePoint(q,p);c.lineTo(w.x,w.y);shown++;}}
  if(shown>2){c.closePath();c.fill();}
 }
 // Where two crystals have welded, the neck of ice between them shows as a soft bright bridge.
 if(f.contacts.length){
  c.globalAlpha=light*.34;c.beginPath();c.strokeStyle='#d4e8f2';c.lineCap='round';c.lineWidth=Math.max(pixel/scale,size*.045);
  for(const id of f.contacts){
   const other=flakeById.get(id);if(!other)continue;
   const steps=6;let a=f;
   for(let i=1;i<=steps;i++){
    const t=i/steps,b={nx:f.nx+(other.nx-f.nx)*t,ny:f.ny+(other.ny-f.ny)*t,nz:f.nz+(other.nz-f.nz)*t},length=Math.hypot(b.nx,b.ny,b.nz);
    b.nx/=length;b.ny/=length;b.nz/=length;edge(a,b);a=b;
   }
  }
  c.stroke();
 }
 c.strokeStyle='#e4f1f9';
 for(let level=0;level<3;level++){
  c.lineCap=level?'butt':'round';c.globalAlpha=light*[.98,.78,.56][level];c.lineWidth=[1.15,.74,.46][level]*(front===false?1.7:1)*pixel/scale*(.6+.4*growth);c.beginPath();
  for(const branch of branches){
   if(branch.level!==level)continue;
   const reach=clamp((size-branch.start)/(branch.end-branch.start),0,1);
   if(!reach)continue;
   const dx=(branch.x2-branch.x)*reach,dy=(branch.y2-branch.y)*reach;
   const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)*Math.sqrt(scale/(p.r*pixel))));
   let a=crystalSurface(f,branch.x,branch.y,p,basis);
   for(let i=1;i<=steps;i++){
    const b=crystalSurface(f,branch.x+dx*i/steps,branch.y+dy*i/steps,p,basis);
    edge(a,b);a=b;
   }
  }
  c.stroke();
 }
 // A facet turning through the moonlight flashes, then goes quiet.
 const flash=Math.max(0,Math.sin(f.rotation*6+f.nx*9+f.ny*7+time*.4))**30;
 if(flash>.03&&(front===undefined||(near>=0)===front)){
  const q=surfacePoint(f,p),s=(1.2+size*.16)*pixel/scale;c.globalCompositeOperation='lighter';c.globalAlpha=flash*light;c.drawImage(softDot,q.x-s,q.y-s,s*2,s*2);
 }
 c.restore();
}
// Bake what the frost has grown since the last frame. Nothing here reads or writes the simulation's random numbers.
function bakeLace(){
 const b=bubble,size=clamp(Math.ceil(b.radius*nearness(b.spotZ)*cameraScale*2),96,2048);
 if(laceOwner!==b||laceSize!==size){
  laceOwner=b;laceSize=size;laceDone=0;patchDone=0;holeDone=0;shellFlat=false;glowStamp=-1;
  laceFront.width=laceFront.height=laceBack.width=laceBack.height=size;
  glowSize=Math.ceil(size/5);laceGlow.width=laceGlow.height=glowSize;laceFar.width=laceFar.height=Math.ceil(size/3.2);laceShade.width=laceShade.height=Math.ceil(size/2);shadeDone=-1;shadeStamp=-1;
 }
 // White frost hides white lace. Each strand keeps a soft blue shadow on the side away from the moon, so the feathers stand up out of the shell.
 if(b.white>.02&&shadeDone!==laceDone&&(shadeStamp<0||time-shadeStamp>.6)){
  const edge=laceShade.width;shadeStamp=time;shadeDone=laceDone;
  ls.globalCompositeOperation='source-over';ls.clearRect(0,0,edge,edge);ls.drawImage(laceFront,0,0,edge,edge);
  ls.globalCompositeOperation='source-in';ls.fillStyle='#3f5a78';ls.fillRect(0,0,edge,edge);
 }
 // Pieces are copied a few at a time while the shell holds, and any left over when it goes.
 if(pieces.length&&!shellFlat)pieceSprites(size,b.ending?Infinity:24);
 if(laceDone===lace.length&&patchDone===patches.length&&holeDone===b.released&&glowStamp>=0&&(shellFlat||!b.ending))return;
 // New strands go in every third frame. Writing to an image the GPU is still reading makes it copy the whole image, and the live tips cover the wait.
 laceTurn=(laceTurn+1)%3;if(laceTurn&&glowStamp>=0&&!b.ending)return;
 // Strands keep their width against the bubble, not the screen, or a small bubble fills in solid.
 const k=size/2,fine=clamp(size/650,.7,2),tint=['#eef7fc','#dcecf5','#cfe3ee','#f0f9ff','#c9e0ec'],strength=[.96,.74,.5,.7,.075];
 lf.lineCap=lb.lineCap='round';
 for(;patchDone<patches.length;patchDone++){
  const patch=patches[patchDone],mid=patch.hex.reduce((sum,v)=>sum+depthOf(v.ny,v.nz),0),g=mid>=0?lf:lb;
  g.globalAlpha=patch.alpha*.2;g.fillStyle='#c3deec';g.beginPath();
  for(const v of patch.hex)g.lineTo(k+v.nx*k,k+(v.ny*TC+v.nz*TS)*k);
  g.closePath();g.fill();
 }
 for(;laceDone<lace.length;laceDone+=SEG){
  const i=laceDone,ax=lace[i],ay=lace[i+1],az=lace[i+2],bx=lace[i+3],by=lace[i+4],bz=lace[i+5],order=lace[i+6];
  const near=depthOf((ay+by)/2,(az+bz)/2)>=0,moon=Math.max(0,ax*MOON[0]+ay*MOON[1]+az*MOON[2]);
  // Hundreds of tips lay down strands every frame, so strands of one style are gathered and drawn as a single path.
  const tone=order===4?Math.round(lace[i+7]/3):Math.min(3,moon*4|0),key=(near?4096:0)+order*256+tone;
  let batch=laceBatch.get(key);
  if(!batch){batch={g:near?lf:lb,order,alpha:strength[order]*(.62+.38*(order===4?.5:(tone+.5)/4)),width:order===4?tone*3*k/b.radius:lace[i+7]*fine,points:[]};laceBatch.set(key,batch);}
  batch.points.push(k+ax*k,k+(ay*TC+az*TS)*k,k+bx*k+.01,k+(by*TC+bz*TS)*k);
 }
 for(const batch of laceBatch.values()){
  const g=batch.g,points=batch.points;
  g.globalAlpha=batch.alpha;g.strokeStyle=tint[batch.order];g.lineWidth=batch.width;g.lineCap=batch.order===4?'butt':'round';g.beginPath();
  for(let i=0;i<points.length;i+=4){g.moveTo(points[i],points[i+1]);g.lineTo(points[i+2],points[i+3]);}
  g.stroke();
 }
 laceBatch.clear();
 if(b.ending&&!shellFlat){flattenShell(size);shellFlat=true;}
 // Behind the tear the shell is gone. Each hole is the exact shape of the piece that left it.
 for(;holeDone<b.released;holeDone++){
  const q=pieces[holeDone],g=q.side?lb:lf,cx=k+q.u*k,cy=k+q.v*k;
  g.save();g.globalCompositeOperation='destination-out';g.globalAlpha=1;g.fillStyle='#000';g.strokeStyle='#000';g.lineWidth=1.5;g.beginPath();
  for(const v of q.outline)g.lineTo(cx+v[0]*k,cy+v[1]*k);g.closePath();g.fill();g.stroke();g.restore();
 }
 if(glowStamp<0||time-glowStamp>.6){
  glowStamp=time;lg.clearRect(0,0,glowSize,glowSize);lg.drawImage(laceFront,0,0,glowSize,glowSize);
  // The far wall is out of the lens's focus, so its crystals are soft grey shapes.
  lr.clearRect(0,0,laceFar.width,laceFar.height);lr.drawImage(laceBack,0,0,laceFar.width,laceFar.height);
  // Soft copies would bleed past the rim and show the square edge of their image, so each is cut to the disk.
  for(const [g,edge] of [[lg,glowSize],[lr,laceFar.width]]){g.globalCompositeOperation='destination-in';g.beginPath();g.arc(edge/2,edge/2,edge/2-1.5,0,TAU);g.fill();g.globalCompositeOperation='source-over';}
 }
}
// Thin ice, seen on its own, is nearly clear: lace and a little haze, with a bright torn edge. The shell only looked white because so much of it lay together.
function pieceSprites(size,budget){
 const k=size/2,edge=Math.min(4096,Math.ceil(size*2.3));
 // All the pieces share one image, so hundreds of them cost the GPU a single texture.
 if(atlasOwner!==bubble){atlasOwner=bubble;pieceAtlas.width=pieceAtlas.height=edge;atlasX=atlasY=atlasRow=0;}
 for(const q of pieces){
  if(pieceImage.has(q))continue;
  if(budget--<=0)return;
  const px=Math.ceil(q.reach*k*2)+6,cx=k+q.u*k,cy=k+q.v*k,half=px/2;
  if(atlasX+px>pieceAtlas.width){atlasX=0;atlasY+=atlasRow+2;atlasRow=0;}
  if(atlasY+px>pieceAtlas.height)continue;
  const g=pa;
  g.save();g.translate(atlasX,atlasY);g.beginPath();for(const w of q.outline)g.lineTo(half+w[0]*k,half+w[1]*k);g.closePath();
  g.save();g.clip();g.globalAlpha=.1;g.imageSmoothingEnabled=true;g.drawImage(veilLayer,half-cx,half-cy,size,size);g.globalAlpha=.62;g.drawImage(q.side?laceBack:laceFront,half-cx,half-cy);g.restore();
  g.strokeStyle='rgba(232,244,251,.46)';g.lineWidth=Math.max(.7,size/760);g.lineJoin='round';g.stroke();g.restore();
  pieceImage.set(q,{x:atlasX,y:atlasY,px,span:px/k});
  atlasX+=px+2;atlasRow=Math.max(atlasRow,px);
 }
}
// Until the tear reaches it, frost and lace are one white skin.
function flattenShell(size){
 for(const g of [lf,lb]){
  g.save();g.beginPath();g.arc(size/2,size/2,size/2,0,TAU);g.clip();g.globalCompositeOperation='destination-over';g.globalAlpha=1;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(veilLayer,0,0,size,size);g.restore();
 }
}
function shellRemains(p){
 const x=p.x-p.r,y=p.y-p.r,d=p.r*2;
 c.save();deform(p);c.drawImage(laceBack,x,y,d,d);c.drawImage(laceFront,x,y,d,d);c.restore();
}
// Broad pieces turn as they fall, thinning to a line when edge on and catching the moon as they swing round.
function pieceLayer(alpha,r){
 for(const q of pieces){
  if(!q.gone)continue;
  const image=pieceImage.get(q);if(!image)continue;
  // Thin ice seen face on is nearly clear. Seen edge on, the eye looks along it and it shines, which is why a broken shell reads as a bright rim around nothing.
  const size=image.span*r,tilt=q.rest?.24:Math.max(.12,Math.abs(Math.cos(q.pitch))),facing=q.rest?.5:tilt*(.25+.75*q.face),cos=Math.cos(q.angle),sin=Math.sin(q.angle);
  c.globalAlpha=alpha*(.1+.9*(1-facing)**1.8)*(q.side?.7:1);
  c.setTransform(scale*cos,scale*sin,-scale*sin*tilt,scale*cos*tilt,ox+q.x*scale,oy+q.y*scale);
  c.drawImage(pieceAtlas,image.x,image.y,image.px,image.px,-size/2,-size/2,size,size);
 }
 c.setTransform(scale,0,0,scale,ox,oy);c.globalAlpha=1;
}
function sliverLayer(alpha){
 if(!slivers.length)return;
 const b=bubble,tiers=[[],[],[]];
 for(const s of slivers){
  if(phaseAge<s.when&&phase==='collapsing')continue;
  // The same rule as the broad pieces: most of the light comes from the rim of what was the shell, and it spreads out as they fall and turn.
  const flash=Math.abs(Math.sin(s.angle*1.7+s.phase))*(1-s.face*.72*Math.exp(-phaseAge/2.2));
  if(!s.rest&&flash<.16)continue;
  tiers[s.rest?0:flash>.72?2:flash>.36?1:0].push(s);
 }
 c.save();c.strokeStyle='#e6f2fa';c.lineCap='round';c.lineWidth=.8*pixel/scale;
 for(let i=0;i<3;i++){
  c.globalAlpha=alpha*[.34,.6,.92][i];c.beginPath();
  for(const s of tiers[i]){
   const edge=s.rest?.25:.35+.65*Math.abs(Math.cos(s.angle)),dx=Math.cos(s.angle)*s.length*.5,dy=Math.sin(s.angle)*s.length*.5*edge;
   c.moveTo(s.x-dx,s.y-dy);c.quadraticCurveTo(s.x-dy*s.bend,s.y+dx*s.bend,s.x+dx,s.y+dy);
  }
  c.stroke();
 }
 c.restore();
}
function laceLayer(p,front){
 if(!lace.length)return;
 const x=p.x-p.r,y=p.y-p.r,d=p.r*2;
 c.save();
 if(front){
  // As the shell fills in, the lace stops glowing and is carried by its shadow instead.
  const white=bubble.white,lift=p.r*.0055;
  if(white>.02&&shadeDone>=0){c.globalAlpha=.44*white;c.drawImage(laceShade,x+lift,y+lift*1.3,d,d);}
  c.globalAlpha=1-.08*white;c.drawImage(laceFront,x,y,d,d);
  c.globalCompositeOperation='lighter';c.globalAlpha=.26*(1-bubble.white);c.drawImage(laceGlow,x,y,d,d);
 }else{c.globalAlpha=.62;c.imageSmoothingEnabled=true;c.drawImage(laceFar,x,y,d,d);}
 c.restore();
}
// Single points of the lace catch the moon in turn, slowly, so even a finished shell is never quite still.
function laceGlints(p){
 const total=lace.length/SEG,count=Math.floor(total/260);if(!count)return;
 c.save();c.globalCompositeOperation='lighter';
 for(let i=0;i<count;i++){
  const v=Math.sin(time*(.25+NT[(i*7+3)&4095]*.6)+NT[i&4095]*TAU);if(v<.965)continue;
  const j=Math.floor(NT[(i*13+5)&4095]*total+i*97)%total*SEG,x=lace[j],y=lace[j+1],z=lace[j+2];
  if(depthOf(y,z)<0)continue;
  const s=(1.6+NT[(i*5+1)&4095]*2)*pixel/scale;c.globalAlpha=(v-.965)/.035*(.7-.1*bubble.white);c.drawImage(softDot,p.x+x*p.r-s,p.y+(y*TC+z*TS)*p.r-s,s*2,s*2);
 }
 c.restore();
}
// The tips themselves are drawn live, so growth reads as a steady creep and not a series of steps.
function tipLines(p,front){
 const k=1/bubble.radius;
 c.save();c.strokeStyle='#f0f9ff';c.lineCap='round';c.lineWidth=.8*pixel/scale;c.globalAlpha=front?.85:.35;c.beginPath();
 for(const t of tips){
  if((depthOf(t.y,t.z)>=0)!==front)continue;
  const x=t.x+t.hx*t.pace*k,y=t.y+t.hy*t.pace*k,z=t.z+t.hz*t.pace*k;
  c.moveTo(p.x+t.x*p.r,p.y+(t.y*TC+t.z*TS)*p.r);c.lineTo(p.x+x*p.r,p.y+(y*TC+z*TS)*p.r);
 }
 c.stroke();c.restore();
}
function perchedLayer(p,front){
 c.save();
 for(const g of perched){
  if((depthOf(g.ny,g.nz)>=0)!==front)continue;
  const x=p.x+g.nx*p.r,y=p.y+(g.ny*TC+g.nz*TS)*p.r,s=(g.size*.8+1.3)*pixel/scale,moon=Math.max(0,g.nx*MOON[0]+g.ny*MOON[1]+g.nz*MOON[2]);
  c.globalAlpha=(.5+.5*moon)*(front?.95:.4)*(1-(g.wet||0)**3)*(1-.75*bubble.white);c.drawImage(softDot,x-s,y-s,s*2,s*2);
 }
 c.restore();
}
// Soap film colors come from light interfering across a film a few hundred nanometres thick.
const PATHS=1024,PATH_MAX=3200,rainbow=new Float32Array(PATHS*3);
for(let i=0;i<PATHS;i++){
 const path=i/PATHS*PATH_MAX,wash=Math.exp(-path/3400);
 [630,532,465].forEach((w,k)=>{const s=Math.sin(Math.PI*path/w);rainbow[i*3+k]=.5+(s*s-.5)*wash;});
}
function filmGeometry(){
 filmLayer.width=filmLayer.height=veilLayer.width=veilLayer.height=FILM;filmData=fl.createImageData(FILM,FILM);veilData=vl.createImageData(FILM,FILM);filmMap=[];
 const seen=r=>.1+.62*band(r,-.1,.14)*(1-.3*clamp(r,0,1));
 for(let py=0;py<FILM;py++)for(let px=0;px<FILM;px++){
  // Pixels just past the silhouette repeat its edge, so the soft image can be cut by a clean circle.
  let u=(px+.5)/FILM*2-1,v=(py+.5)/FILM*2-1;const reach=Math.hypot(u,v);if(reach>1.06)continue;
  if(reach>.996){u*=.996/reach;v*=.996/reach;}
  const d2=1-u*u-v*v,d=Math.sqrt(d2),x=u,y=v*TC-d*TS,z=v*TS+d*TC,yb=v*TC+d*TS,zb=v*TS-d*TC;
  // The near wall reflects the scene upright and the far wall reflects it upside down, each squeezed toward the rim.
  const rise=2*d2-1,down=2*d*v*TC-rise*TS,backDown=-2*d*v*TC-rise*TS,fresnel=.075+.6*(1-d)**3;
  const i=(py*FILM+px)*4,moon=x*MOON[0]+y*MOON[1]+z*MOON[2];filmData.data[i+3]=255;
  filmMap.push({i,x,y,z,yb,zb,edge:0,edgeFar:0,cos:Math.sqrt(1-(1-d2)/1.77),near:seen(down)*fresnel,far:.65*seen(backDown)*fresnel,moon:Math.max(0,moon),tone:.58+.42*(.5+.5*moon)**.8,rim:(1-d)**2,grain:.72+.56*value3(x*5,y*5,z*5),spot:fieldSpot(x,y,z),back:fieldSpot(x,yb,zb)});
 }
}
function paintFilm(){
 const b=bubble;
 if(filmOwner===b&&(b.ending||time-filmStamp<(N.LOWQ?1/12:1/30)))return;
 // Stirring and painting take turns, so no frame carries both.
 if(filmOwner===b&&fieldFresh){fieldFresh=false;return;}
 if(!filmMap)filmGeometry();
 if(filmOwner!==b){const o=b.offset%43;for(const m of filmMap){m.edge=iceEdge(m.x,m.y,m.z,o);m.edgeFar=iceEdge(m.x,m.yb,m.zb,o);}}
 filmOwner=b;filmStamp=time;
 const data=filmData.data,veil=veilData.data,thin=clamp(b.film,.25,1.5),shift=b.hue*.45-80,cold=b.ice>0&&b.ice<1?1:0,gain=2.66*thin/PATH_MAX*PATHS,white=b.white,thicken=white*1.15,wander=Math.sqrt(b.ice*(1-b.ice))*.68,origins=b.origins;
 for(const m of filmMap){
  let into=-3,beyond=-3;
  for(let o=0;o<origins.length;o++){const c2=origins[o],d=m.x*c2.x+m.y*c2.y+m.z*c2.z-c2.edge,e=m.x*c2.x+m.yb*c2.y+m.zb*c2.z-c2.edge;if(d>into)into=d;if(e>beyond)beyond=e;}
  into+=m.edge*wander;beyond+=m.edgeFar*wander;
  const frozen=band(into,-.02,.1),far=band(beyond,-.02,.1),seep=Math.exp(-into*into*42)*cold;
  // Each layer of flakes scatters more light. Frost is thickest where it has been growing longest, so white rises from the base.
  const pack=band(into*.42+thicken,.14,1),packed=frozen*pack;
  let r=0,g=0,l=0;
  if(frozen<.995){
   const near=clamp(Math.floor((fieldRead(fieldNow,m.spot.i,m.spot.a,m.spot.b)+shift)*gain*m.cos),0,PATHS-1)*3,back=clamp(Math.floor((fieldRead(fieldNow,m.back.i,m.back.a,m.back.b)+shift)*gain*m.cos),0,PATHS-1)*3;
   const open=(1-frozen*.92)*2.1,a=m.near*open,d=m.far*open*.42;
   r=rainbow[near]*a+rainbow[back]*d;g=rainbow[near+1]*a+rainbow[back+1]*d;l=rainbow[near+2]*a+rainbow[back+2]*d;
  }
  // Below the line the shell is frosted. Right at the line the cold shows as a pale, creeping edge.
  const haze=(frozen*(.035+.13*m.moon+.07*m.rim)+far*.03+seep*.09)*m.grain*(1-pack);
  data[m.i]=(r+haze*.74)*510;data[m.i+1]=(g+haze*.87)*510;data[m.i+2]=(l+haze)*510;
  const tone=m.tone*(.93+.14*(m.grain-.72)/.56),clear=1-pack;
  veil[m.i]=(104*clear+224*pack)*tone;veil[m.i+1]=(132*clear+235*pack)*tone;veil[m.i+2]=(154*clear+246*pack)*tone;
  veil[m.i+3]=clamp((frozen*clear*(.24+.36*m.rim)+far*.06*clear)*m.grain+packed*.985,0,1)*255;
 }
 fl.putImageData(filmData,0,0);vl.putImageData(veilData,0,0);
}
function filmImage(p){
 c.save();c.beginPath();c.arc(p.x,p.y,p.r,0,TAU);c.clip();
  // Plain smoothing on purpose: the better filter is far too slow for an image this large, and the film has no hard edges to show the difference.
 c.imageSmoothingEnabled=true;c.drawImage(veilLayer,p.x-p.r,p.y-p.r,p.r*2,p.r*2);
 c.globalCompositeOperation='lighter';c.globalAlpha=.5;c.drawImage(filmLayer,p.x-p.r,p.y-p.r,p.r*2,p.r*2);c.restore();
}
function film(p){
 const b=bubble,filmTime=b.ice===1?(b.freezeAt??time):time,r=p.r,h=b.hue+(N.RM?0:(noise(b.offset+filmTime*b.drain)-.5)*18),glaze=(1-.6*band(b.ice,.55,1))*(1-band(b.white,.35,.9));
 filmImage(p);
 c.save();
 // The silhouette: a hair of light, broken into the colors of the film where it is seen edge on.
 c.lineWidth=.8*pixel/scale;c.strokeStyle=`rgba(208,228,240,${.3*(1-b.white*.7)})`;c.beginPath();c.arc(p.x,p.y,r,0,TAU);c.stroke();
 const segments=Math.max(24,Math.ceil(TAU*r*scale/(16*pixel)));
 for(let i=0;i<segments;i++){
  const a=i/segments*TAU,thickness=noise(b.offset+a*2.1+filmTime*.09)+Math.sin(a)*.13-Math.log1p(b.age)*b.drain;
  const edge=clamp((thickness-.22)*.8,.015,.48)*glaze;
  c.strokeStyle=hue(h+thickness*240,edge);c.lineWidth=.9*pixel/scale;c.beginPath();c.arc(p.x,p.y,r*.997,a,a+TAU/segments+.003);c.stroke();
 }
 // The moon itself, reflected small and oval near the rim of the near wall, and again, inverted, in the far wall.
 const shine=(noise(b.offset+time*.3)-.5)*.2+b.lean*3;
 for(const [a,d,long,wide,alpha] of [[3.5,.9,.092,.04,.62],[.42,.88,.07,.03,.3]]){
  const at=a+shine*.6;c.save();c.translate(p.x+Math.cos(at)*r*d,p.y+Math.sin(at)*r*d);c.rotate(at+Math.PI/2);c.globalCompositeOperation='lighter';c.globalAlpha=alpha*glaze;
  c.drawImage(softDot,-r*long,-r*wide,r*long*2,r*wide*2);c.restore();
 }
 // Moonlight lies along the curve as a crescent that thins away at both ends. The far wall returns it upside down, and both ride the moving surface.
 const wander=(noise(b.offset+time*.3)-.5)*.2+b.lean*3+b.squash*2,reach=1+b.squash,parts=16;
 c.lineCap='round';
 for(let i=0;i<parts;i++){
  const t=(i+.5)/parts,swell=Math.sin(Math.PI*t)**1.6,a=3.72+wander+t*1.02,step=1.02/parts*.56;
  c.strokeStyle=`rgba(232,246,255,${.3*swell*glaze})`;c.lineWidth=(.5+2.1*swell)*pixel/scale;c.beginPath();c.arc(p.x,p.y,r*.965*reach,a-step,a+step);c.stroke();
  c.strokeStyle=`rgba(232,246,255,${.1*swell*glaze})`;c.lineWidth=(.5+1.5*swell)*pixel/scale;c.beginPath();c.arc(p.x,p.y,r*.885/reach,a-Math.PI-wander*2-step,a-Math.PI-wander*2+step);c.stroke();
 }
 c.restore();
}
function contact(p){
 // The shadow gathers as the bubble comes down. A film this thin also lets a soft glow through its middle, until the frost closes it off.
 const b=bubble,clearance=p.snow-p.ground,near=Math.exp(-clearance/(p.r*1.6)),fade=b.broken===null?1:1-ease(clamp((time-b.broken)/1.4,0,1));
 c.save();c.globalAlpha=near*fade;
 c.translate(p.x,p.snow+1);c.scale(1+clearance/(p.r*1.5),TS*.95);
 const reach=Math.max(.1,p.r*.95),shadow=c.createRadialGradient(0,0,0,0,0,reach);
 shadow.addColorStop(0,'#06152444');shadow.addColorStop(.35,'#06152458');shadow.addColorStop(.7,'#0c253c22');shadow.addColorStop(1,'#0c253c00');
 c.fillStyle=shadow;c.beginPath();c.arc(0,0,reach,0,TAU);c.fill();
 const caustic=c.createRadialGradient(0,0,0,0,0,reach*.4);
 caustic.addColorStop(0,`rgba(200,226,242,${.13*(1-b.ice)})`);caustic.addColorStop(1,'rgba(200,226,242,0)');
 c.fillStyle=caustic;c.beginPath();c.arc(0,0,reach*.4,0,TAU);c.fill();c.restore();
 if(p.airborne)return;
 // The foot of the bubble sits in a dish of its own making.
 const foot=p.r*Math.sqrt(Math.max(0,1-p.seat*p.seat)),rx=Math.max(.1,foot*1.32+p.r*.05),ry=Math.max(.1,rx*TS*1.05);
 c.save();c.globalAlpha=fade;c.translate(p.x,p.ground);c.scale(1,ry/rx);
 const dish=c.createRadialGradient(0,0,rx*.55,0,0,rx);
 dish.addColorStop(0,'#0a1f3240');dish.addColorStop(.8,'#0a1f3226');dish.addColorStop(1,'#0a1f3200');
 c.fillStyle=dish;c.beginPath();c.arc(0,0,rx,0,TAU);c.fill();c.restore();
}
// Everything below the near edge of the contact ring is under the snow.
function seatClip(p){
 const foot=p.r*Math.sqrt(Math.max(0,1-p.seat*p.seat)),reach=Math.max(.1,foot),wide=p.r*1.8;
 c.beginPath();c.moveTo(p.x-wide,p.y-p.r*2);c.lineTo(p.x+wide,p.y-p.r*2);c.lineTo(p.x+wide,p.ground);c.lineTo(p.x+reach,p.ground);
 c.ellipse(p.x,p.ground,reach,reach*TS,0,0,Math.PI);c.lineTo(p.x-wide,p.ground);c.closePath();c.clip();
}
function frost(p){
 if(p.airborne)return;
 const b=bubble,foot=p.r*Math.sqrt(Math.max(0,1-p.seat*p.seat)),fade=b.broken===null?1:1-ease(clamp((time-b.broken)/6,0,1)),ry=Math.max(.1,foot*TS),buried=(1-p.seat)/.25;
 if(fade<=0)return;
 // Powder banks up around the near side of the contact line, higher the deeper the bubble has settled.
 c.save();c.globalAlpha=fade;
 c.translate(p.x,p.ground);c.scale(1,TS);
 const rx=Math.max(.2,foot*1.16+p.r*.06),lip=c.createRadialGradient(0,0,Math.max(.1,foot),0,0,rx);
 lip.addColorStop(0,`rgba(136,166,186,${.38+buried*.26})`);lip.addColorStop(.45,'rgba(118,148,168,.15)');lip.addColorStop(1,'rgba(100,130,150,0)');
 c.fillStyle=lip;c.beginPath();c.arc(0,0,rx,0,Math.PI);c.arc(0,0,Math.max(.1,foot),Math.PI,0,true);c.closePath();c.fill();c.restore();
 c.save();c.globalAlpha=fade*.34;c.strokeStyle='#bcd2de';c.lineWidth=.8*pixel/scale;c.beginPath();c.ellipse(p.x,p.ground,Math.max(.1,foot),ry,0,.1,Math.PI-.1);c.stroke();c.restore();
  // The line where ice meets the snow gathers the light. The far half shows through the film, dimmer.
 const lit=band(b.ice,0,.05)*fade;
 if(lit>0){
  c.save();c.lineCap='round';c.strokeStyle='#eef7fd';
  for(const [from,to,alpha] of [[.04,Math.PI-.04,.8],[Math.PI+.04,TAU-.04,.3*(1-band(b.ice,.5,.95))]]){
   c.globalAlpha=lit*alpha*.2;c.lineWidth=4.5*pixel/scale;c.beginPath();c.ellipse(p.x,p.ground,Math.max(.1,foot),ry,0,from,to);c.stroke();
   c.globalAlpha=lit*alpha;c.lineWidth=1.2*pixel/scale;c.beginPath();c.ellipse(p.x,p.ground,Math.max(.1,foot),ry,0,from,to);c.stroke();
  }
  c.restore();
 }
 // Nearby grains overlap the film's base instead of sitting behind it.
 c.save();c.globalAlpha=fade;
 for(const g of b.frostGrains){
  const a=g.x*Math.PI,x=p.x+Math.cos(a)*foot*(1+g.y*.4),y=p.ground+Math.sin(a)*ry*(1+g.y*.4),size=g.size*pixel/scale;
  c.fillStyle=g.y>.5?'#a6bdcc80':'#ecf4f8b0';c.beginPath();c.moveTo(x-size,y+size*.5);c.lineTo(x,y-size);c.lineTo(x+size,y);c.closePath();c.fill();
 }
 c.restore();
}
// Dimples from each touch, and the faint track of a roll, slowly smoothed away by the falling snow.
function markLayer(){
 for(const m of marks){
  const a=(1-m.age/m.life)**1.5,y=snowAt(m.z);
  c.save();c.globalAlpha=a;c.translate(m.x,y);c.scale(1,TS*1.1);
  const dip=c.createRadialGradient(0,-m.size*.1,0,0,0,m.size);
  dip.addColorStop(0,'rgba(10,28,46,.26)');dip.addColorStop(.72,'rgba(10,28,46,.12)');dip.addColorStop(.86,'rgba(196,220,234,.14)');dip.addColorStop(1,'rgba(196,220,234,0)');
  c.fillStyle=dip;c.beginPath();c.arc(0,0,m.size,0,TAU);c.fill();c.restore();
 }
}
function puffLayer(p){
 const b=bubble,since=b&&b.landed!==null?time-b.landed:Infinity;
 if(p&&since>=0&&since<2.4){
  // The little ring of air that leaves as the film meets the snow.
  const k=since/2.4,rx=b.radius*(.3+.75*Math.sqrt(k)),ry=rx*TS*1.1;
  c.save();c.translate(p.x,p.snow);c.scale(1,ry/rx);c.globalAlpha=(1-k)**2*(1-Math.exp(-since*10));
  const puff=c.createRadialGradient(0,0,rx*.5,0,0,rx);
  puff.addColorStop(0,'rgba(200,222,236,0)');puff.addColorStop(.75,'rgba(200,222,236,.1)');puff.addColorStop(1,'rgba(200,222,236,0)');
  c.fillStyle=puff;c.beginPath();c.arc(0,0,rx,0,TAU);c.fill();c.restore();
 }
 if(!puffs.length)return;
 c.save();
 for(const g of puffs){
  const k=g.age/g.life,s=g.size*pixel/scale*(1+k*.8);
  c.globalAlpha=Math.min(1,k*9)*(1-k)**1.5*.8;c.drawImage(softDot,g.x-s,snowAt(g.z)-g.h-s,s*2,s*2);
 }
 c.restore();
}
function moundLayer(){
 if(mound.amount<.003)return;
 const a=mound.amount,rx=mound.width*(.6+.5*a),ry=rx*TS*1.5;
 c.save();c.translate(mound.x,mound.y+ry*.05);c.scale(1,ry/rx);
 const heap=c.createRadialGradient(-rx*.1,-rx*.14,0,0,0,rx);
 heap.addColorStop(0,`rgba(214,232,242,${.42*a})`);heap.addColorStop(.5,`rgba(196,220,234,${.2*a})`);heap.addColorStop(1,'rgba(196,220,234,0)');
 c.fillStyle=heap;c.beginPath();c.arc(0,0,rx,0,TAU);c.fill();c.restore();
}
// So far away it is little more than a shape: a long low back, a heavy tail, and the fur that lets it vanish on rock and snow.
function ridgeAt(u){
 const n=skyline.length-1,f=clamp(u,0,1)*n,i=Math.min(n-1,f|0);
 return(skyline[i]+(skyline[i+1]-skyline[i])*(f-i))*height;
}
function leopardLayer(){
 if(!leopard||!sceneryAt||!skyline)return;
 const l=leopard,t=l.age/l.life,size=height*.0145*l.size,rise=ease(clamp(t/.18,0,1))*(1-ease(clamp((t-.82)/.16,0,1))),walking=band(t,.46,.56)*(1-band(t,.78,.84)),along=band(t,.46,.82)*l.walk*l.face;
 const home=perches[Math.floor(l.spot*perches.length)],x=home*width+along*size,base=ridgeAt(x/width),gait=Math.sin(l.age*4.4+l.phase)*walking,sink=(1-rise)*size*.75;
 // The ground it stands on tips it a little.
 const slope=Math.atan2(ridgeAt((x+size)/width)-ridgeAt((x-size)/width),size*2)*.8;
 const q=Math.max(12,Math.ceil(size*1.5)),g=beastContext,fur='#8f99a6',pale='#a9b2bb',mark='#4a5462',sway=Math.sin(l.age*1.1+l.phase)*.05;
 beast.width=q*3;beast.height=q*2;
 g.translate(q*1.7,q*1.7);g.scale(q,q);g.lineCap='round';g.lineJoin='round';
 g.strokeStyle=fur;g.lineWidth=.13;g.beginPath();g.moveTo(-.44,-.3);g.bezierCurveTo(-.72,-.26,-.78,-.05-sway,-1.04,-.15+sway);g.stroke();
 g.fillStyle='#7d8794';
 for(const [hip,swing] of [[-.33,gait],[.17,-gait]]){g.beginPath();g.moveTo(hip-.09,-.24);g.lineTo(hip-.07+swing*.12,0);g.lineTo(hip+.08+swing*.12,0);g.lineTo(hip+.09,-.24);g.closePath();g.fill();}
 const coat=g.createLinearGradient(-.3,-.46,.1,-.12);coat.addColorStop(0,pale);coat.addColorStop(.6,fur);coat.addColorStop(1,'#78828f');
 g.fillStyle=coat;g.beginPath();g.moveTo(-.5,-.28);g.bezierCurveTo(-.48,-.46,-.22,-.46,-.02,-.4);g.bezierCurveTo(.1,-.4,.24,-.42,.3,-.38);g.bezierCurveTo(.35,-.3,.33,-.2,.26,-.14);g.bezierCurveTo(.04,-.1,-.26,-.1,-.45,-.14);g.bezierCurveTo(-.53,-.18,-.52,-.24,-.5,-.28);g.closePath();g.fill();
 const hx=.4,hy=-.42+Math.abs(gait)*.012;
 g.fillStyle=fur;g.beginPath();g.moveTo(.18,-.39);g.quadraticCurveTo(.3,-.46,hx,-.5);g.lineTo(hx+.05,-.34);g.quadraticCurveTo(.32,-.28,.24,-.26);g.closePath();g.fill();
 g.beginPath();g.ellipse(hx,hy,.09,.078,0,0,TAU);g.fill();
 g.fillStyle=mark;for(const side of [-1,1]){g.beginPath();g.arc(hx+side*.06,hy-.07,.026,0,TAU);g.fill();}
 c.save();c.beginPath();
 for(let i=-20;i<=20;i++){const px=x+i*size*.2;c.lineTo(px,ridgeAt(px/width));}
 c.lineTo(x+size*4,base-size*3);c.lineTo(x-size*4,base-size*3);c.closePath();c.clip();
 c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.globalAlpha=.82;
 c.translate(x,base+sink);c.rotate(slope);c.scale(l.face,1);c.drawImage(beast,-size*1.7,-size*1.7,size*3,size*2);
 c.restore();
}
// Each far bubble's film is painted once, a little under size, because the lens is not focused that far back.
const driftImage=new WeakMap();
function drifterFilm(d,r){
 let image=driftImage.get(d);if(image)return image;
 const q=Math.max(10,Math.ceil(r*.7)),[v,g]=layer();v.width=v.height=q*2+4;g.translate(q+2,q+2);
 const body=g.createRadialGradient(0,0,q*.5,0,0,q);body.addColorStop(0,'rgba(190,220,240,.02)');body.addColorStop(.84,'rgba(200,226,244,.08)');body.addColorStop(1,'rgba(216,236,250,.3)');
 g.fillStyle=body;g.beginPath();g.arc(0,0,q,0,TAU);g.fill();g.globalCompositeOperation='lighter';
 for(let i=0;i<7;i++){
  const a=noise(d.offset+i*3.1)*TAU*2,x=Math.cos(a)*q*.55,y=Math.sin(a)*q*.55,reach=q*(.35+noise(d.offset+i*1.7)*.5),wash=g.createRadialGradient(x,y,0,x,y,reach);
  wash.addColorStop(0,hue(d.hue+i*47,.13,62));wash.addColorStop(1,hue(d.hue+i*47,0,62));g.fillStyle=wash;g.beginPath();g.arc(0,0,q,0,TAU);g.fill();
 }
 for(let i=0,parts=28;i<parts;i++){const a=i/parts*TAU,n=noise(d.offset+a*2.1);g.strokeStyle=hue(d.hue+n*240,.2+.5*n,72);g.lineWidth=Math.max(1,q*.03);g.beginPath();g.arc(0,0,q*.98,a,a+TAU/parts+.02);g.stroke();}
 driftImage.set(d,v);return v;
}
function drifterLayer(){
 if(!drifters.length||!landHeight)return;
 c.save();
 for(const d of [...drifters].sort((a,e)=>e.z-a.z)){
  const r=Math.min(height*.36,width*.45)*.1/d.z*d.size,t=Math.min(1,d.age/d.fall),left=1-t,x=(d.u+d.from*left*left+Math.sin(time*d.sway+d.offset)*.012*left)*width;
  const ground=height*(HORIZON+(EYE-landAt((d.u-.5)*width/height/LENS*d.z,d.z))/d.z*LENS),y=-r*2+(ground-r*.94+r*2)*(1-left**1.5),since=d.broken===null?0:d.age-d.broken,fade=1-since/d.linger;
  // Its shadow gathers under it as it comes down, and goes with it.
  c.globalAlpha=band(t,.6,1)*.5*fade;c.drawImage(darkDot,x-r*1.15,ground-r*.2,r*2.3,r*.4);
  if(d.broken!==null){
   // The tear takes no time at this distance. What was shell is a drift of glints going down.
   const mist=Math.exp(-since*2.2);c.globalCompositeOperation='lighter';c.globalAlpha=mist*.3;c.drawImage(softDot,x-r*1.2,y-r*1.2,r*2.4,r*2.4);c.globalCompositeOperation='source-over';
   c.fillStyle='#e6f2f9';
   for(const b of d.bits){
    const s=Math.max(.6*pixel,b.size*r);c.globalAlpha=fade**1.5*(.45+.55*Math.abs(Math.sin(since*b.rate+b.phase)));
    c.fillRect(x+(b.x+b.vx*since)*r-s/2,y+Math.min(.98,b.y+b.vy*since*since*.5)*r-s/2,s,s);
   }
   continue;
  }
  const white=band(d.ice,.7,1),glaze=1-white;
  c.save();c.translate(x,y);
  c.save();c.rotate(time*d.spin);c.globalAlpha=.92;c.drawImage(drifterFilm(d,r),-r,-r,r*2,r*2);c.restore();
  if(d.ice>0){
   c.save();c.beginPath();c.arc(0,0,r,0,TAU);c.clip();
   for(const f of d.frost){const a=band(d.ice,f.at,f.at+.1);if(a<=0)continue;const s=f.size*r;c.globalAlpha=a*.72;c.drawImage(softDot,f.x*r-s,f.y*r-s,s*2,s*2);}
   if(white>0){c.globalAlpha=white*.9;c.drawImage(frostDisc,-r,-r,r*2,r*2);}
   c.restore();
  }
  // The moon, small in the near wall and turned over in the far one.
  c.globalCompositeOperation='lighter';
  c.globalAlpha=.75*glaze;c.drawImage(softDot,-r*.62,-r*.64,r*.3,r*.2);
  c.globalAlpha=.3*glaze;c.drawImage(softDot,r*.36,r*.42,r*.22,r*.14);
  c.restore();
 }
 c.restore();
}
function deform(p){
 const b=bubble;
 c.translate(p.x,p.ground);c.transform(1+b.squash*.5,0,-b.lean,1-b.squash,0,0);c.translate(-p.x,-p.ground);
}
function snowLayer(near,plane){
 c.save();
 for(const f of snow){
  if((f.z>=plane)!==near)continue;
  const depth=1+f.z/520,close=f.z>0?depth**3:depth,s=f.size*pixel/scale*close*1.5;
  c.globalAlpha=(.3+.34*depth*depth/2)/Math.sqrt(close);c.drawImage(softDot,f.x-s,f.y-s,s*2,s*2);
 }
 c.restore();
}
function draw(){
 if(!width)return;
 // Camera easing follows simulation time, so paused redraws cannot advance it.
 const glide=1-Math.exp(-(time-cameraTime)/(bubble?bubble.form:pauseMean));
 scale+=(cameraScale-scale)*glide;pan+=(cameraPan-pan)*glide;cameraTime=time;
 ox=width/2-(CX+pan)*scale;oy=height*.81-CONTACT*scale;
 growScenery();
 // Nothing shows until the whole scene exists. Then it is simply there.
 if(!sceneryAt)return;
 c.globalAlpha=1;c.setTransform(1,0,0,1,0,0);c.drawImage(background,0,0);drawSky();moonLayer();auroraLayerDraw();
 c.drawImage(scenery,0,0,width,height);
 auroraOnSnow();leopardLayer();sparkle();drifterLayer();
 const p=bubble?center():null,plane=p?p.z:0;
 c.save();c.translate(ox,oy);c.scale(scale,scale);
 snowLayer(false,plane);moundLayer();markLayer();
 if(bubble){
  const b=bubble,left=phase==='settling'?1-ease(clamp(phaseAge/b.settleTime,0,1)):1;
  bakeLace();paintFilm();contact(p);
  c.save();
  if(!p.airborne)seatClip(p);
  if(b.ending){if(b.released<pieces.length)shellRemains(p);}
  else{
   c.save();deform(p);
   laceLayer(p,false);tipLines(p,false);
   for(const f of flakes)if(!f.baked)crystal(f,false);
   perchedLayer(p,false);
   film(p);
   laceLayer(p,true);tipLines(p,true);laceGlints(p);
   for(const f of flakes)if(!f.baked)crystal(f,true);
   perchedLayer(p,true);
   c.restore();
  }
  c.restore();
  frost(p);
  if(b.ending){
   // The mist of the finest ice stays a little while in the shape of the air it held.
   const age=time-b.broken,mist=band(age,0,.3)*Math.exp(-age/2.6);
   if(mist>.01){const s=p.r*1.3;c.save();c.globalCompositeOperation='lighter';c.globalAlpha=mist*.17;c.drawImage(softDot,p.x-s,p.y-s-age*5,s*2,s*2);c.restore();}
   sliverLayer(left);pieceLayer(left,p.r);
  }
 }
 puffLayer(p);
 snowLayer(true,plane);
 c.restore();c.globalAlpha=1;ctx.imageSmoothingEnabled=true;
 const open=N.RM?1:clamp((performance.now()-sceneryAt)/700,0,1);
 if(open<1){ctx.fillStyle='#050b19';ctx.fillRect(0,0,width,height);ctx.globalAlpha=open;}
 ctx.drawImage(buffer,0,0);ctx.globalAlpha=1;
}
function step(seconds){if(!Number.isFinite(seconds)||seconds<0)return;for(let left=seconds;left>1e-9;left-=1/60)update(Math.min(left,1/60));draw();N.refresh();}
function state(){
 const p=bubble?center():null;
 return JSON.parse(JSON.stringify({time,phase,phaseAge,bubble,center:p,flakes,snow,meteors,wind,wait,nextSnow,nextWind,nextMeteor,stats,stars,constellations,
  lace:lace.length/SEG,tips:tips.length,perched,puffs:puffs.length,pieces:pieces.length,slivers:slivers.length,marks:marks.length,mound:mound.amount,leopard,nextLeopard,scenery:sceneryAt>0,drifters,moon,aurora,nextAurora}));
}
function fire(event){if(N.RM)return false;const actions={form,nucleate,collapse,current:changeCurrent,snow:spawnSnow,meteor:shootingStar,leopard:snowLeopard,drift,aurora:auroraRise};const ok=actions[event]?actions[event]():false;draw();N.refresh();return ok;}
softDot.width=softDot.height=32;darkDot.width=darkDot.height=32;frostDisc.width=frostDisc.height=128;
{const dot=dd.createRadialGradient(16,16,0,16,16,16);dot.addColorStop(0,'rgba(8,20,38,.8)');dot.addColorStop(.5,'rgba(8,20,38,.4)');dot.addColorStop(1,'rgba(8,20,38,0)');dd.fillStyle=dot;dd.fillRect(0,0,32,32);}
{const disc=fd.createRadialGradient(48,44,6,64,64,64);disc.addColorStop(0,'#f4fafe');disc.addColorStop(.7,'#dbe9f2');disc.addColorStop(1,'#a9c2d3');fd.fillStyle=disc;fd.beginPath();fd.arc(64,64,63,0,TAU);fd.fill();}
{const dot=sd.createRadialGradient(16,16,0,16,16,16);dot.addColorStop(0,'rgba(236,246,252,1)');dot.addColorStop(.35,'rgba(226,240,249,.7)');dot.addColorStop(1,'rgba(214,232,244,0)');sd.fillStyle=dot;sd.fillRect(0,0,32,32);}
wait=positive(3.5,.25);
N.log(!moon?'No moon in the sky tonight':moon.phase<.36?'A thin moon tonight':moon.phase<.68?'A half moon tonight':moon.phase<1?'A bright moon tonight':'A full moon tonight');
for(let i=sampleCount(positive(56,.15)/snowMean);i>0;i--)spawnSnow(true);
// Select a naturally developed still from this seed, without inventing a crystal count or outcome.
if(N.RM)while(!bubble||bubble.ending||bubble.ice<.72)update(1/60);
preparingStill=false;
addEventListener('resize',resize);resize();
// The clock waits for the scene, so the night is there before anything happens in it.
N.run({update:dt=>{if(sceneryAt)update(dt);},draw,step:1/60});
if(N.DEBUG){window.SB={pause(){N.paused=true;},run(){N.paused=false;},step,draw,state,fire};
 window.render_game_to_text=()=>JSON.stringify(state());window.advanceTime=ms=>step(ms/1000);}
})();
