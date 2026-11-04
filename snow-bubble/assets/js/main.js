/* Snow Bubble. A little winter held inside a film of color. */
(()=>{
'use strict';
const N=window.NightCity,{R,rr,ri,pick,expo,noise}=N;
const canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
const buffer=document.createElement('canvas'),c=buffer.getContext('2d');
const background=document.createElement('canvas'),bg=background.getContext('2d');
const crystalGeometry=new WeakMap();
const TAU=Math.PI*2,GROUND=652,CONTACT=GROUND+38,CX=400;
const normal=()=>Math.sqrt(-2*Math.log(1-R()))*Math.cos(TAU*R());
const positive=(mean,spread)=>mean*Math.exp(normal()*spread-spread*spread/2);
const gap=mean=>Math.max(Number.EPSILON,expo(mean));
function sampleCount(mean){let count=0,event=gap(1);while(event<mean){count++;event+=gap(1);}return count;}
const stars=Array.from({length:sampleCount(positive(1100,.1))},()=>({x:rr(.005,.995),y:rr(.015,.985),size:ri(1,18)===1?2:1,
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
const ridges=Array.from({length:3},()=>Array.from({length:21},()=>rr(-1,1)));
const stats={bubbles:0,crystals:0,bursts:0,collapses:0,frozen:0};
let time=0,phase='waiting',phaseAge=0,bubble=null,flakes=[],fragments=[],snow=[],meteors=[],preparingStill=N.RM;
const snowMean=positive(.16,.45),windMean=positive(6,.35),meteorMean=positive(75,.35),pauseMean=positive(5,.45);
let wind=normal()*8,wait=0,nextSnow=gap(snowMean),nextWind=gap(windMean),nextMeteor=gap(meteorMean);
let windTarget=wind;
let width=0,height=0,pixel=1,scale=1,ox=0,oy=0,skyHeight=0;
let cameraTime=time,cameraScale=scale;
const hue=(h,a,l=78)=>`hsla(${h},70%,${l}%,${a})`;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ease=n=>n*n*(3-2*n);
function line(g,x,y,x2,y2,color,w=1){g.strokeStyle=color;g.lineWidth=w;g.beginPath();g.moveTo(x,y);g.lineTo(x2,y2);g.stroke();}
function center(){
 const r=bubble.fractureRadius??Math.max(.1,bubble.radius*Math.cbrt(bubble.volume)*(1+(noise(bubble.offset+time/bubble.form)*2-1)*bubble.sway*(1-bubble.ice)));
 let flight=phase==='forming'?clamp(phaseAge/bubble.form,0,1):1,remaining=1-flight;
 let height=bubble.arrival.height*remaining*remaining;
 let x=CX+bubble.arrival.x*remaining*remaining+wind*bubble.form*flight*remaining*remaining;
 // The bubble arrives at full size and approaches the fixed snow plane with zero landing velocity.
 return{x,y:CONTACT-height-r*.975,r,ground:CONTACT-height,snow:CONTACT,airborne:phase==='forming'};
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
function iceSheets(){
 let p=center(),plates=Array.from({length:sampleCount(positive(9,.4)*(bubble.radius/150)**2*bubble.ice)},()=>{
  let angle=R()*TAU,r=Math.sqrt(R());
  return{nx:Math.cos(angle)*r,ny:Math.sin(angle)*r,dx:normal()*10,delay:gap(bubble.collapseTime),spin:normal()*bubble.frost/(bubble.radius*bubble.collapseTime),pitchSpeed:normal()/bubble.collapseTime};
 });
 // With no separating cracks, the shell buckles as one piece instead of disappearing.
 if(!plates.length)bubble.uncutShell={nx:0,ny:0,dx:wind*bubble.permeability,delay:gap(bubble.collapseTime),spin:bubble.current*bubble.frost/(bubble.radius*bubble.collapseTime),pitchSpeed:bubble.strength/bubble.collapseTime};
 let pieces=plates.length?plates:[bubble.uncutShell],segments=Math.ceil(TAU*p.r/bubble.frost);
 for(let a of pieces){
  let polygon=[[-1,-1],[1,-1],[1,1],[-1,1]];
  for(let b of pieces)if(a!==b)polygon=clipIce(polygon,b.nx-a.nx,b.ny-a.ny,(b.nx*b.nx+b.ny*b.ny-a.nx*a.nx-a.ny*a.ny)/2);
  for(let i=0;i<segments;i++){let angle=(i+.5)*TAU/segments;polygon=clipIce(polygon,Math.cos(angle),Math.sin(angle),Math.cos(Math.PI/segments));}
  polygon=clipIce(polygon,0,1,.975);
  a.polygon=polygon;
  let area=0,cx=0,cy=0;
  for(let i=0;i<polygon.length;i++){let v=polygon[i],w=polygon[(i+1)%polygon.length],cross=v[0]*w[1]-w[0]*v[1];area+=cross;cx+=(v[0]+w[0])*cross;cy+=(v[1]+w[1])*cross;}
  a.cx=area?cx/(3*area):a.nx;a.cy=area?cy/(3*area):a.ny;
  Object.assign(a,{x:p.x+a.cx*p.r,y:p.y+a.cy*p.r,vx:(a.dx+wind-a.cx*p.r/bubble.collapseTime)*bubble.permeability,vy:0,angle:0,pitch:0,grounded:false,released:false,releaseAt:null,anchored:polygon.some(v=>Math.abs(v[1]-.975)<Math.sqrt(Number.EPSILON)),rested:!polygon.length,crystals:[],neighbors:[]});
  // A crack travels from the seeded tear before each unsupported patch releases.
  a.delay+=Math.abs(Math.atan2(Math.sin(Math.atan2(a.cy,a.cx)-bubble.tear),Math.cos(Math.atan2(a.cy,a.cx)-bubble.tear)))/Math.PI*bubble.collapseTime;
 }
 for(let [index,a] of pieces.entries())for(let [other,b] of pieces.entries()){
  if(index===other)continue;
  let nx=b.nx-a.nx,ny=b.ny-a.ny,limit=(b.nx*b.nx+b.ny*b.ny-a.nx*a.nx-a.ny*a.ny)/2;
  if(a.polygon.filter(v=>Math.abs(v[0]*nx+v[1]*ny-limit)<Math.sqrt(Number.EPSILON)).length>=2)a.neighbors.push(other);
 }
 return plates;
}
function icePieces(){return bubble.plates.length?bubble.plates:[bubble.uncutShell];}
function sheetPose(plate,p){
 let cos=Math.cos(plate.angle),sin=Math.sin(plate.angle),tilt=Math.hypot(Math.cos(plate.pitch),Math.sin(plate.pitch)*bubble.frost/p.r);
 let a=cos,b=sin,c=-sin*tilt,d=cos*tilt;
 let vertices=plate.polygon.map(v=>{let x=(v[0]-plate.cx)*p.r,y=(v[1]-plate.cy)*p.r;return{x:a*x+c*y,y:b*x+d*y};});
 return{a,b,c,d,vertices,bottom:vertices.reduce((bottom,v)=>Math.max(bottom,v.y),-Infinity)};
}
function updateSheets(dt){
 let p=center(),gravity=2*p.r/(bubble.collapseTime*bubble.collapseTime),pieces=icePieces();
 for(let plate of pieces)if(!plate.released&&phaseAge>=plate.delay){plate.released=true;plate.releaseAt=plate.delay;}
 // A patch cannot hang in the air after every route to its supporting base has broken.
 let supported=new Set(),queue=[];
 for(let [index,plate] of pieces.entries())if(plate.anchored&&!plate.released){supported.add(index);queue.push(index);}
 while(queue.length){let index=queue.pop();for(let neighbor of pieces[index].neighbors)if(!pieces[neighbor].released&&!supported.has(neighbor)){supported.add(neighbor);queue.push(neighbor);}}
 for(let [index,plate] of pieces.entries())if(!plate.released&&!supported.has(index)){plate.released=true;plate.releaseAt=phaseAge;}
 for(let plate of pieces){
  if(plate.rested||!plate.released)continue;
  let elapsed=Math.min(dt,phaseAge-plate.releaseAt),drag=Math.exp(-elapsed*(bubble.strength+bubble.film)/(bubble.permeability+bubble.frost/p.r));
  if(plate.grounded){
   plate.vx*=drag;plate.spin*=drag;
   plate.pitch+=(Math.PI/2-plate.pitch)*(1-Math.exp(-elapsed/bubble.collapseTime));
  }else{plate.vy+=gravity*elapsed;plate.pitch+=plate.pitchSpeed*elapsed;}
  plate.x+=plate.vx*elapsed;plate.y+=plate.vy*elapsed;plate.angle+=plate.spin*elapsed;
  let pose=sheetPose(plate,p);
  if(plate.grounded||plate.y+pose.bottom>=p.ground){plate.y=p.ground-pose.bottom;plate.vy=0;plate.grounded=true;}
  let motion=Math.abs(plate.vx)+Math.abs(plate.spin)*p.r+Math.abs(Math.PI/2-plate.pitch)*p.r/bubble.collapseTime;
  if(plate.grounded&&motion<=bubble.frost/bubble.collapseTime)plate.rested=true;
 }
}
function form(){
 if(phase!=='waiting')return false;
 bubble={radius:positive(150,.21),hue:R()*360,form:positive(3,.3),frost:positive(2,.3),sway:positive(.002,.35),offset:R()*4000,age:0,
  ice:0,freezeAt:null,front:.975,ending:null,
  groundCold:positive(.85,.55),airCold:normal()*.85+.18,thermalDrift:positive(.55,.3),freezeRate:positive(.065,.35),
  film:positive(1,.35),drain:positive(.018,.65),permeability:positive(.1,.6),volume:1,
  ruptureSensitivity:positive(.003,.8),collapseSensitivity:positive(.012,.65),fractureSensitivity:positive(.008,.7),
  crystalRate:positive(6,.65),circulation:positive(.9,.4),current:normal(),strength:positive(.85,.25),
  nextCrystal:gap(1),ruptureBudget:gap(1),collapseBudget:gap(1),fractureBudget:gap(1),
  cooling:0,stress:0,flow:0,collapseTime:0,settleTime:positive(4,.35),tear:R()*TAU,burstDuration:positive(.001,.15),plates:[],
  veins:Array.from({length:sampleCount(positive(52,.25))},()=>({x:R(),y:R(),length:positive(12,.4)})),
  frostGrains:Array.from({length:sampleCount(positive(32,.3))},()=>({x:R(),y:R(),size:positive(1,.4)}))};
 let direction=R()*TAU,distance=Math.hypot(CX,CONTACT)+bubble.radius+Math.abs(normal())*bubble.radius;
 bubble.arrival={x:Math.cos(direction)*distance,height:Math.abs(Math.sin(direction))*distance+bubble.radius};
 bubble.currentTarget=bubble.current;bubble.strengthTarget=bubble.strength;
 phase='forming';phaseAge=0;stats.bubbles++;N.stats(stats);N.log('A soap bubble drifts toward the snow');
 if(width)view();return true;
}
function domeScale(){
 if(!bubble||bubble.ending==='sheets'||!['collapsing','settling','bursting'].includes(phase))return 1;
 if(bubble.ending==='rupture')return .001;
 return 1-(phase==='settling'?1:ease(clamp(phaseAge/bubble.collapseTime,0,1)))*.98;
}
function surfacePoint(f,p){
 const x=p.x+f.nx*p.r;let y=p.y+f.ny*p.r;
 if(bubble.ending&&bubble.ending!=='sheets'){
  const frontY=p.y+bubble.front*p.r;if(y<frontY)y=frontY+(y-frontY)*domeScale();
 }
 return{x,y};
}
function nucleate(){
 if(!['cooling','freezing','holding'].includes(phase)||bubble.ice>=1)return false;
 const azimuth=R()*TAU,ny=clamp(bubble.front-positive(.075,.65),-.999,.975),ring=Math.sqrt(1-ny*ny);
 const f={nx:Math.cos(azimuth)*ring,ny,nz:Math.sin(azimuth)*ring,x:0,y:0,z:0,
  age:0,size:positive(23,.38),growth:positive(8,.45),rotation:R()*TAU,spin:normal()*.09,offset:R()*4000,
  branches:sampleCount(positive(4,.25)),spread:rr(.35,.65),arm:rr(.72,1),locked:false,lock:0,vx:0,vy:0,vz:0,contacts:[]};
 // Nuclei begin mobile. Crystal habit varies continuously from plates to branches.
 f.habit=R();
 const point=surfacePoint(f,center());f.x=point.x;f.y=point.y;f.z=f.nz;flakes.push(f);
 stats.crystals++;N.stats(stats);return true;
}
function burst(){
 if(!bubble||!['cooling','freezing','holding'].includes(phase)||bubble.ice>=1)return false;
 const p=center(),liquid=1-bubble.ice,dropletMean=positive(24,.5)*(p.r/150)**2*liquid/bubble.film;
 fragments=Array.from({length:sampleCount(dropletMean)},()=>{
  const a=R()*TAU,speed=positive(20,.45);return{x:p.x+Math.cos(a)*p.r,y:Math.min(CONTACT,p.y+Math.sin(a)*p.r),
   vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-positive(5,.3),age:0,life:positive(.32,.4),radius:positive(.4,.45)};
 });
 flakes=flakes.filter(f=>f.ny>=bubble.front);bubble.ending='rupture';phase='bursting';phaseAge=0;
 stats.bursts++;N.stats(stats);N.log(bubble.ice>0?'The remaining liquid film ruptures above the ice':'The liquid film ruptures into tiny droplets');return true;
}
function collapse(){
 if(!bubble||!['cooling','freezing','holding'].includes(phase)||bubble.ice<=0||bubble.ice>=1)return false;
 bubble.ending='deflation';bubble.collapseTime=positive(6,.45)*(1+bubble.volume);
 phase='collapsing';phaseAge=0;stats.collapses++;N.stats(stats);N.log('The liquid dome deflates above its frozen base');return true;
}
function fracture(){
 if(!bubble||!['freezing','holding','frozen'].includes(phase)||bubble.ice<=0)return false;
 bubble.fractureRadius=center().r;bubble.ending='sheets';bubble.collapseTime=positive(2,.35);bubble.plates=iceSheets();
 flakes=flakes.filter(f=>f.locked||f.ny>=bubble.front);
 for(let [index,f] of flakes.entries()){
  f.locked=true;
  let nearest=null,distance=Infinity;
  for(let plate of icePieces()){if(!plate.polygon.length)continue;let d=(f.nx-plate.nx)**2+(f.ny-plate.ny)**2;if(d<distance){nearest=plate;distance=d;}}
  if(nearest)nearest.crystals.push(index);
 }
 phase='collapsing';phaseAge=0;stats.collapses++;N.stats(stats);N.log('Stress breaks the ice into irregular sheets');return true;
}
function changeCurrent(){
 windTarget=normal()*8;
 if(bubble){bubble.currentTarget=normal();bubble.strengthTarget=positive(.85,.3);}
 return true;
}
function spawnSnow(initial=false){
 snow.push({x:rr(-750,1550),y:initial?rr(-150,GROUND):rr(-280,0),vx:normal()*2,vy:positive(15,.3),age:0,life:positive(43,.3),size:positive(.9,.4),offset:R()*4000});
 return true;
}
function shootingStar(){
 meteors.push({x:rr(.08,.85),y:rr(.04,.3),dx:rr(.09,.22),dy:rr(.07,.18),age:0,life:positive(1,.3)});return true;
}
function updateSurface(dt){
 const p=center(),flow=bubble.flow;
 if(flakes.every(f=>f.locked)){
  for(const f of flakes){f.age+=dt;f.lock=1-(1-f.lock)*Math.exp(-dt*bubble.strength);const point=surfacePoint(f,p);f.x=point.x;f.y=point.y;f.z=f.nz;}
  return;
 }
 // One shared field carries nearby crystals together. Growing ice supplies local heat.
 const growing=flakes.map(f=>({f,r:crystalBranches(f).reduce((radius,branch)=>Math.max(radius,Math.hypot(branch.x2,branch.y2)),0)*ease(clamp(f.age/f.growth,0,1))}));
 const diffusion=Math.sqrt(p.r*bubble.frost),cellSize=(growing.reduce((maximum,item)=>Math.max(maximum,item.r),0)*2+diffusion)/p.r;
 const cells=new Map(),key=(x,y,z)=>x+','+y+','+z;
 for(const item of growing){
  const f=item.f;item.cell=[Math.floor(f.nx/cellSize),Math.floor(f.ny/cellSize),Math.floor(f.nz/cellSize)];
  const k=key(...item.cell);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(item);
 }
 // Compute from the same snapshot so iteration order cannot move a heat source early.
 for(const a of growing){
  if(a.f.locked)continue;
  const f=a.f;let heatX=0,heatY=0,heatZ=0,crowding=0,contacts=[];
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
   for(const b of cells.get(key(a.cell[0]+x,a.cell[1]+y,a.cell[2]+z))||[]){
    if(a===b)continue;
    const dx=f.nx-b.f.nx,dy=f.ny-b.f.ny,dz=f.nz-b.f.nz,distance=Math.hypot(dx,dy,dz)*p.r,reach=a.r+b.r;
    const progress=clamp(b.f.age/b.f.growth,0,1),release=6*progress*(1-progress)/b.f.growth;
    const warmth=release*Math.max(0,1-(distance/(reach+diffusion))**2)**2*p.r/(distance+diffusion);
    heatX+=dx*warmth;heatY+=dy*warmth;heatZ+=dz*warmth;
    if(distance<reach){crowding+=(1-distance/reach)*b.f.lock;contacts.push({nx:b.f.nx,ny:b.f.ny,nz:b.f.nz});}
   }
  }
  const frost=clamp((f.ny-iceFront(f.nx,p))*p.r/(a.r+bubble.frost),0,1);
  const resistance=(frost+crowding)*bubble.ice;
  const lock=1-(1-f.lock)*Math.exp(-dt*resistance*bubble.strength);
  const spatial=bubble.circulation,clock=time/bubble.form,offset=bubble.offset;
  const ax=bubble.groundCold+noise(offset+f.ny*spatial+clock)-noise(offset-f.nz*spatial-clock);
  const ay=bubble.current+noise(offset+f.nz*spatial+clock)-noise(offset-f.nx*spatial-clock);
  const az=noise(offset+f.nx*spatial+clock)-noise(offset-f.ny*spatial-clock);
  // Warm film rises across the front and returns down the back instead of piling up at the top.
  const vx=ay*f.nz-az*f.ny+heatX;
  const vy=az*f.nx-ax*f.nz+heatY;
  const vz=ax*f.ny-ay*f.nx+heatZ;
  const radial=vx*f.nx+vy*f.ny+vz*f.nz;
  a.motion={vx:vx-radial*f.nx,vy:vy-radial*f.ny,vz:vz-radial*f.nz,lock,contacts};
 }
 for(const a of growing){
  const f=a.f,m=a.motion;f.age+=dt;
  if(!f.locked){
   f.lock=m.lock;
   const mobility=flow*(1-f.lock)*bubble.strength;
   const response=1-Math.exp(-dt*bubble.strength*p.r/(f.size+bubble.frost));
   f.vx+=(m.vx*mobility-f.vx)*response;f.vy+=(m.vy*mobility-f.vy)*response;f.vz+=(m.vz*mobility-f.vz)*response;
   const radial=f.vx*f.nx+f.vy*f.ny+f.vz*f.nz;
   f.vx-=radial*f.nx;f.vy-=radial*f.ny;f.vz-=radial*f.nz;
   f.nx+=f.vx*dt;f.ny+=f.vy*dt;f.nz+=f.vz*dt;
   const length=Math.hypot(f.nx,f.ny,f.nz);f.nx/=length;f.ny/=length;f.nz/=length;
   if(f.ny>.975){f.ny=.975;const ring=Math.sqrt(1-f.ny*f.ny),len=Math.hypot(f.nx,f.nz)||1;f.nx=f.nx/len*ring;f.nz=f.nz/len*ring;}
   f.rotation+=(f.spin*mobility+f.vz*f.nx-f.vx*f.nz)*dt;
   if(1-f.lock<=bubble.frost/p.r||bubble.ice>=1){f.locked=true;f.contacts=m.contacts;}
  }else f.lock=1-(1-f.lock)*Math.exp(-dt*bubble.strength);
  const point=surfacePoint(f,p);f.x=point.x;f.y=point.y;f.z=f.nz;
 }
}
function evolve(dt){
 const b=bubble;
 const air=b.airCold+(noise(b.offset+time*.025)-.5)*b.thermalDrift;
 const ground=b.groundCold*(.75+noise(b.offset+500+time*.018)*.5);
 const drive=ground*(1-b.ice)+air*b.ice;
 b.cooling+=Math.max(0,ground+air)*dt;
 const before=b.ice;b.ice=clamp(b.ice+drive*b.freezeRate*dt,0,1);b.front=.975-b.ice*1.975;
 const liquid=1-b.ice;
 b.flow=b.circulation*Math.max(0,drive)*liquid;
 const area=(b.radius/150)**2;
 b.nextCrystal-=dt*b.crystalRate*area*Math.max(0,drive)*liquid;
 while(b.nextCrystal<=0&&b.ice<1){nucleate();b.nextCrystal+=gap(1);}
 b.film*=Math.exp(-b.drain*liquid*(1+Math.abs(wind)*.025)*dt);
 b.volume*=Math.exp(-b.permeability*b.ice*liquid*dt);
 const ruptureRate=b.ruptureSensitivity*liquid*(1+Math.abs(wind)*.08)/(b.film*b.film);
 const collapseRate=b.collapseSensitivity*b.ice*liquid*(1-b.volume)**2*(1+b.cooling*.03);
 // Freezing is a material change, never a terminal state. Weather keeps loading the shell.
 b.stress+=dt*b.ice*(Math.abs(wind)*.08+Math.abs(air-ground));
 const fractureRate=b.fractureSensitivity*b.ice**4*(.2+Math.abs(wind)*.08+Math.abs(air-ground)+b.stress);
 b.ruptureBudget-=dt*ruptureRate;b.collapseBudget-=dt*collapseRate;b.fractureBudget-=dt*fractureRate;
 if(before<1&&b.ice>=1){b.freezeAt=time;stats.frozen++;N.stats(stats);N.log('Ice closes over the shell');}
 phase=b.ice>=1?'frozen':drive<=0?'holding':'freezing';
 const candidates=[];
 if(b.ice<1&&b.ruptureBudget<=0)candidates.push({excess:b.ruptureBudget/ruptureRate,action:burst});
 if(b.ice>0&&b.ice<1&&b.collapseBudget<=0)candidates.push({excess:b.collapseBudget/collapseRate,action:collapse});
 if(b.ice>0&&b.fractureBudget<=0)candidates.push({excess:b.fractureBudget/fractureRate,action:fracture});
 if(candidates.length)candidates.sort((a,c)=>a.excess-c.excess)[0].action();
}
function update(dt){
 if(N.RM&&!preparingStill)return;
 time+=dt;phaseAge+=dt;
 wind+=(windTarget-wind)*(1-Math.exp(-dt/windMean));
 if(bubble){
  bubble.age+=dt;
  bubble.current+=(bubble.currentTarget-bubble.current)*(1-Math.exp(-dt/bubble.form));
  bubble.strength+=(bubble.strengthTarget-bubble.strength)*(1-Math.exp(-dt/bubble.form));
 }
 nextSnow-=dt;while(nextSnow<=0){spawnSnow();nextSnow+=gap(snowMean);}
 nextWind-=dt;while(nextWind<=0){changeCurrent();nextWind+=gap(windMean);}
 nextMeteor-=dt;while(nextMeteor<=0){shootingStar();nextMeteor+=gap(meteorMean);}
 for(const meteor of meteors)meteor.age+=dt;meteors=meteors.filter(meteor=>meteor.age<meteor.life);
 if(phase==='waiting'){wait-=dt;if(wait<=0)form();}
 if(phase==='forming'&&phaseAge>=bubble.form){phase='cooling';phaseAge=0;N.log('The bubble settles into the snow and begins cooling');}
 if(['cooling','freezing','holding','frozen'].includes(phase))evolve(dt);
 if(flakes.length)updateSurface(dt);
 for(const f of fragments){f.age+=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=28*dt;}
 fragments=fragments.filter(f=>f.age<f.life&&f.y<CONTACT+1);
 if(phase==='bursting'&&phaseAge>=bubble.burstDuration){phase='settling';phaseAge=0;}
 if(phase==='collapsing'){
  if(bubble.ending==='sheets')updateSheets(dt);
  if(bubble.ending==='sheets'?icePieces().every(plate=>plate.rested):phaseAge>=bubble.collapseTime){phase='settling';phaseAge=0;}
 }
 if(phase==='settling'&&phaseAge>bubble.settleTime&&!fragments.length){bubble=null;flakes=[];phase='waiting';phaseAge=0;wait=gap(pauseMean);if(width)view();}
 for(const f of snow){
  f.age+=dt;f.vx+=(wind*.4-f.vx)*(1-Math.exp(-dt*f.vy/(f.size+f.vy)));
  f.x+=(f.vx+(noise(f.offset+time*.2)-.5)*6)*dt;f.y+=f.vy*dt;
 }
 snow=snow.filter(f=>f.age<f.life&&f.y<GROUND+140);
}
function terrain(){
 background.width=width;background.height=height;
 const horizon=height*.59;
 const gradient=bg.createLinearGradient(0,0,0,height);gradient.addColorStop(0,'#050b19');gradient.addColorStop(.58,'#101f35');gradient.addColorStop(1,'#233c51');bg.fillStyle=gradient;bg.fillRect(0,0,width,height);
 // Distant snow-covered ridges leave the stars and bubble as the brightest elements.
 for(let layer=0;layer<3;layer++){
  bg.save();bg.filter=`blur(${(2-layer*.7)*pixel}px)`;
  const base=horizon-(105-layer*35)*scale;bg.fillStyle=['#152b40','#20394e','#344e63'][layer];bg.beginPath();bg.moveTo(0,height);
  const points=ridges[layer].map((v,i)=>({x:i/20*width,y:base+v*(25-layer*5)*scale}));
  bg.lineTo(0,points[0].y);
  for(let i=0;i<points.length-1;i++){const p=points[i],q=points[i+1];bg.quadraticCurveTo(p.x,p.y,(p.x+q.x)/2,(p.y+q.y)/2);}
  bg.lineTo(width,points[20].y);
  bg.lineTo(width,height);bg.closePath();bg.fill();bg.restore();
 }
 const snowGradient=bg.createLinearGradient(0,horizon-15*scale,0,height);snowGradient.addColorStop(0,'#6b8395');snowGradient.addColorStop(.12,'#526f85');snowGradient.addColorStop(1,'#263f57');
 bg.fillStyle=snowGradient;bg.beginPath();bg.moveTo(0,height);
 for(let x=0;x<=width+4;x+=4)bg.lineTo(x,horizon+Math.sin(x/width*7.8)*7*scale+Math.sin(x/width*14)*3*scale);
 bg.lineTo(width,height);bg.closePath();bg.fill();
 bg.strokeStyle='#a0b7c355';bg.lineWidth=1;bg.stroke();
 for(const g of grain){
  const depth=Math.pow(g.y,.65),x=g.x*width,y=horizon+12*pixel+depth*Math.max(1,height-horizon),size=(.15+depth*depth*g.w*.6)*pixel;
  bg.fillStyle=`rgba(187,216,226,${g.a*(.15+depth*.85)})`;bg.beginPath();bg.ellipse(x,y,size,size*.35,g.angle,0,TAU);bg.fill();
  if(g.a>.23&&depth>.5){bg.fillStyle=`rgba(226,241,248,${depth*.3})`;bg.fillRect(x,y,.65*pixel,.65*pixel);}
 }
 // Broad, faint wind ripples and fine grains put the foreground in focus.
 for(let i=0;i<12;i++){
  const y=horizon+Math.pow(i/11,1.5)*(height-horizon);bg.strokeStyle='#b2c9d40b';bg.lineWidth=pixel;
  bg.beginPath();bg.moveTo(0,y);bg.bezierCurveTo(width*.3,y+9*pixel,width*.7,y-5*pixel,width,y+4*pixel);bg.stroke();
 }
 skyHeight=Math.max(1,horizon-105*scale);
}
function resize(){
 pixel=N.LOWQ?.75:Math.min(window.devicePixelRatio||1,2);
 width=Math.round(innerWidth*pixel);height=Math.round(innerHeight*pixel);
 canvas.width=width;canvas.height=height;buffer.width=width;buffer.height=height;
 view();scale=cameraScale;cameraTime=time;
 terrain();draw();
}
function view(){
 // Fit the camera to the sampled size rather than limiting the bubble's radius.
 cameraScale=Math.min(width/520,height/650,...(bubble?[width*.43/bubble.radius,height*.37/bubble.radius]:[]));
 ox=width/2-CX*scale;oy=height*.81-CONTACT*scale;
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
  const extent=Math.min(width*.17,skyHeight*.36),x=g.x*width-extent/2,y=g.y*skyHeight-extent/2;
  for(const [a,b] of g.edges)line(c,x+g.points[a][0]*extent,y+g.points[a][1]*extent,x+g.points[b][0]*extent,y+g.points[b][1]*extent,'#8aafca25');
  for(let i=0;i<g.points.length;i++){const p=g.points[i],px=x+p[0]*extent,py=y+p[1]*extent;c.fillStyle='#b6d7f01c';c.fillRect(px-1,py-1,4,4);c.fillStyle=g.names[i]==='Betelgeuse'?'#ffc293':'#deefff';c.fillRect(px,py,2,2);}
 }
 for(const meteor of meteors){const t=meteor.age/meteor.life,x=(meteor.x+meteor.dx*t)*width,y=(meteor.y+meteor.dy*t)*skyHeight;c.globalAlpha=Math.sin(t*Math.PI);line(c,x,y,x-meteor.dx*width*.18,y-meteor.dy*skyHeight*.18,'#bce2f0',1);}
 c.restore();
}
function crystalBranches(f){
 let branches=crystalGeometry.get(f);if(branches)return branches;
 branches=[];
 for(let i=0;i<6;i++){
  let a=i*TAU/6,ux=Math.cos(a),uy=Math.sin(a),length=f.size*(i%2?f.arm:1)*(f.arm+(1-f.arm)*noise(f.offset+i));
  branches.push({x:0,y:0,x2:ux*length,y2:uy*length,start:0,end:length});
  for(let j=1;j<=f.branches;j++){
   let dist=length*j/(f.branches+1),branch=(length-dist)*f.spread*(1-f.arm**(f.branches*f.habit))*noise(f.offset+i+j);
   for(let side of [-1,1]){
    let b=a+side*Math.PI/3;
    branches.push({x:ux*dist,y:uy*dist,x2:ux*dist+Math.cos(b)*branch,y2:uy*dist+Math.sin(b)*branch,start:dist,end:dist+branch});
   }
  }
 }
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
 let growth=ease(clamp(f.age/f.growth,0,1)),size=f.size*growth;
 if(!size)return;
 let p=center(),basis=crystalBasis(f),fade=phase==='settling'?1-ease(clamp(phaseAge/bubble.settleTime,0,1)):1;
 // Project every branch point onto the sphere, including branches that cross its silhouette.
 function visible(v){return front===undefined||((v.nz>=0)===front);}
 function edge(a,b){
  if(!visible(a)&&!visible(b))return;
  if(visible(a)!==visible(b)){
   let t=a.nz/(a.nz-b.nz),rim={nx:a.nx+(b.nx-a.nx)*t,ny:a.ny+(b.ny-a.ny)*t,nz:0},length=Math.hypot(rim.nx,rim.ny);
   rim.nx/=length;rim.ny/=length;
   if(visible(a))b=rim;else a=rim;
  }
  let pa=surfacePoint(a,p),pb=surfacePoint(b,p);
  c.moveTo(pa.x,pa.y);c.lineTo(pb.x,pb.y);
 }
 c.save();c.beginPath();c.arc(p.x,p.y,p.r,0,TAU);c.clip();
 c.beginPath();c.rect(p.x-p.r,p.y-p.r,p.r*2,p.ground-p.y+p.r);c.clip();
 // Faceted plates and dendrites share sixfold symmetry, with continuously varying habit.
 const habit=f.arm**(f.branches*f.habit);
 {
  c.fillStyle='#c3deec28';c.globalAlpha=fade*Math.abs(f.nz)*(habit+f.lock*bubble.ice)/(1+habit);c.beginPath();
  let patch=[];
  for(let branch of crystalBranches(f)){
   if(branch.start)continue;
   let v=crystalSurface(f,branch.x2*growth*habit,branch.y2*growth*habit,p,basis);
   if(visible(v))patch.push(surfacePoint(v,p));
  }
  if(patch.length){c.moveTo(patch[0].x,patch[0].y);for(let v of patch)c.lineTo(v.x,v.y);c.closePath();c.fill();c.strokeStyle='#c3deec28';c.lineWidth=pixel/scale*growth;c.stroke();}
 }
 c.globalAlpha=fade*clamp((Math.abs(f.nz)+f.lock*bubble.ice)*f.spread,0,1)*(front===false?1-bubble.ice:1);
 c.beginPath();c.strokeStyle='#c3deec28';c.lineWidth=size*f.spread*f.lock;
 for(let contact of f.contacts){
  let distance=Math.hypot(contact.nx-f.nx,contact.ny-f.ny,contact.nz-f.nz);
  let steps=Math.max(1,Math.ceil(distance*Math.sqrt(p.r*scale/pixel))),a=f;
  for(let i=1;i<=steps;i++){
   let t=i/steps,b={nx:f.nx+(contact.nx-f.nx)*t,ny:f.ny+(contact.ny-f.ny)*t,nz:f.nz+(contact.nz-f.nz)*t};
   let length=Math.hypot(b.nx,b.ny,b.nz);b.nx/=length;b.ny/=length;b.nz/=length;
   edge(a,b);a=b;
  }
 }
 c.stroke();c.beginPath();c.strokeStyle='#e0f0f8';c.lineCap='round';c.lineWidth=pixel/scale*growth/(1+f.spread);
 for(let branch of crystalBranches(f)){
  let reach=clamp((size-branch.start)/(branch.end-branch.start),0,1);
  if(!reach)continue;
  let dx=(branch.x2-branch.x)*reach,dy=(branch.y2-branch.y)*reach;
  let steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)*Math.sqrt(scale/(p.r*pixel))));
  let a=crystalSurface(f,branch.x,branch.y,p,basis);
  for(let i=1;i<=steps;i++){
   let b=crystalSurface(f,branch.x+dx*i/steps,branch.y+dy*i/steps,p,basis);
   edge(a,b);a=b;
  }
 }
 c.stroke();c.restore();
}
function iceFront(nx,p){
 let index=Math.floor((nx+1)/2*(bubble.veins.length-1)),vein=bubble.veins[index];
 let rough=(noise(bubble.offset+nx*bubble.crystalRate)-.5)*(vein?vein.length:bubble.frost);
 return clamp(bubble.front+rough/p.r*Math.sqrt(bubble.ice*(1-bubble.ice)),-1,.975);
}
function iceRegion(p,upper=false){
 c.beginPath();
 let steps=Math.max(1,Math.ceil(Math.sqrt(p.r*2*scale/pixel)));
 for(let i=0;i<=steps;i++){
  let nx=i/steps*2-1,x=p.x+nx*p.r,y=p.y+iceFront(nx,p)*p.r;
  if(i)c.lineTo(x,y);else c.moveTo(x,y);
 }
 let edge=upper?p.y-p.r:p.ground;
 c.lineTo(p.x+p.r,edge);c.lineTo(p.x-p.r,edge);c.closePath();
}
function ice(p){
 if(bubble.ice<=0)return;
 const frontY=p.y+bubble.front*p.r;
 c.save();c.beginPath();c.arc(p.x,p.y,p.r*.998,0,TAU);c.clip();iceRegion(p);c.clip();
 const frost=c.createLinearGradient(0,frontY,0,p.ground);
 frost.addColorStop(0,'#c3deec0b');frost.addColorStop(.25,'#c3deec28');frost.addColorStop(1,'#d3e6ee4a');c.fillStyle=frost;c.fillRect(p.x-p.r,p.y-p.r,p.r*2,p.r*2);
 // Fine branching veins tie neighboring crystals into a continuous icy shell.
 for(const g of bubble.veins){
  const a=g.x*TAU,x=p.x+Math.cos(a)*p.r*.97,y=p.y+Math.sin(a)*p.r*.97;
  if(y<p.y+iceFront((x-p.x)/p.r,p)*p.r)continue;
  const length=g.length*bubble.ice;c.strokeStyle='#deedf330';c.lineWidth=.5*pixel/scale;
  line(c,x,y,x-Math.cos(a)*length,y-Math.sin(a)*length,c.strokeStyle,c.lineWidth);
 }
 c.restore();
}
function shell(p){
 if(bubble.ending&&bubble.ending!=='sheets'&&bubble.ice>0){
  const frontY=p.y+bubble.front*p.r;
  c.save();iceRegion(p,true);c.clip();
  c.translate(0,frontY);c.scale(1,domeScale());c.translate(0,-frontY);film(p);c.restore();
  c.save();iceRegion(p);c.clip();film(p);c.restore();
 }else film(p);
 ice(p);
}
function frozenSheets(p){
 for(let plate of icePieces()){
  if(!plate.polygon.length)continue;
  let pose=sheetPose(plate,p),height=Math.max(0,p.ground-plate.y-pose.bottom);
  c.save();c.globalAlpha*=Math.exp(-height/p.r);c.fillStyle='#0c253c26';c.beginPath();
  let left=Math.min(...pose.vertices.map(v=>v.x)),right=Math.max(...pose.vertices.map(v=>v.x));
  c.ellipse(plate.x+(left+right)/2,p.ground,(right-left)/2,bubble.frost,0,0,TAU);c.fill();c.restore();
  c.save();c.translate(plate.x,plate.y);c.transform(pose.a,pose.b,pose.c,pose.d,0,0);c.translate(-p.x-plate.cx*p.r,-p.y-plate.cy*p.r);
  c.beginPath();for(let [i,v] of plate.polygon.entries()){if(i)c.lineTo(p.x+v[0]*p.r,p.y+v[1]*p.r);else c.moveTo(p.x+v[0]*p.r,p.y+v[1]*p.r);}c.closePath();
  c.fillStyle='#d9eaf020';c.fill();c.save();c.globalAlpha*=plate.released?1:clamp(phaseAge/plate.delay,0,1);c.strokeStyle='#cde4ed55';c.lineWidth=.7*pixel/scale;c.stroke();c.restore();c.clip();
  ice(p);
  for(let index of plate.crystals)crystal(flakes[index]);
  c.restore();
 }
}
function film(p){
 const filmTime=bubble.ice===1?(bubble.freezeAt??time):time;
 const r=p.r,h=bubble.hue+(N.RM?0:(noise(bubble.offset+filmTime*bubble.drain)-.5)*18),fade=phase==='settling'?1-ease(clamp(phaseAge/bubble.settleTime,0,1)):1;
 const tint=c.createRadialGradient(p.x-r*.2,p.y-r*.3,r*.05,p.x,p.y,r);
 tint.addColorStop(0,hue(h,.003));tint.addColorStop(.78,hue(h,.012));tint.addColorStop(.96,hue(h,.045));tint.addColorStop(1,hue(h,.13));
 c.fillStyle=tint;c.beginPath();c.arc(p.x,p.y,r,0,TAU);c.fill();
 // A thin soap film reflects the landscape while the enclosed air stays transparent.
 c.save();c.beginPath();c.arc(p.x,p.y,r*.995,0,TAU);c.clip();
 c.globalAlpha=fade*bubble.film/(1+bubble.film);
 // The reflected horizon bends over the shell and shares the scene's ridges.
 for(let layer=0;layer<3;layer++){
  c.fillStyle=['#8eacbf08','#b1cbd90d','#e0edf416'][layer];c.beginPath();
  for(let i=0;i<=32;i++){
   const u=i/16-1,arch=Math.sqrt(Math.max(0,1-u*u)),t=i/32*20,j=Math.floor(t);
   const terrain=ridges[layer][j]+((ridges[layer][Math.min(20,j+1)]-ridges[layer][j])*ease(t-j));
   const x=p.x+u*r,y=p.y+r*(.27+layer*.16+arch*.22+terrain*.018);
   if(i)c.lineTo(x,y);else c.moveTo(x,y);
  }
  c.lineTo(p.x+r,p.ground+2);c.lineTo(p.x-r,p.ground+2);c.closePath();c.fill();
 }
 c.restore();
 // Uneven thickness and slow drainage produce broken, shifting color bands.
 const segments=Math.max(1,Math.ceil(TAU*r*scale/(6*pixel)));
 for(let i=0;i<segments;i++){
  const a=i/segments*TAU,thickness=noise(bubble.offset+a*2.1+filmTime*bubble.drain)+Math.sin(a)*.13-Math.log1p(bubble.age)*bubble.drain;
  const edge=clamp((thickness-.22)*.8,.015,.48);
  c.strokeStyle=hue(h+thickness*240,edge);c.lineWidth=.7*pixel/scale;c.beginPath();c.arc(p.x,p.y,r,a,a+TAU/segments+.003);c.stroke();
  if(thickness>.34)for(let band=0;band<3;band++){
   const inset=(.009+band*.013+(noise(a*3+bubble.offset+band+filmTime*bubble.drain)-.5)*.012)*bubble.film/(1+bubble.film);
   c.strokeStyle=hue(h+thickness*240+band*53,edge*.18);c.lineWidth=(1.1+band*.5)*pixel/scale;
   c.beginPath();c.arc(p.x,p.y,r*(1-inset),a,a+TAU/segments+.003);c.stroke();
  }
 }
 // Faint moonlight follows the curvature, with gaps in the specular streak.
 for(const [from,to] of [[3.8,4.17],[4.22,4.49],[4.54,4.65]])for(const [width,alpha] of [[5,.02],[2.5,.065],[.7,.32]]){
  c.strokeStyle=`rgba(228,244,255,${alpha*fade})`;c.lineWidth=width*pixel/scale;c.beginPath();c.arc(p.x,p.y,r*.977,from+(noise(bubble.offset+filmTime*bubble.sway)-.5)*bubble.sway,to+(noise(bubble.offset+filmTime*bubble.sway)-.5)*bubble.sway);c.stroke();
 }
 c.strokeStyle='#eff8ff55';c.lineWidth=.8*pixel/scale;c.beginPath();c.ellipse(p.x-r*.37,p.y-r*.69,r*.028,r*.065,-.6,3.3,5.7);c.stroke();
}
function contact(p){
 // A soft shadow meets the film, surrounded by a small rim of snow crystals.
 c.save();
 let clearance=CONTACT-p.ground;
 c.globalAlpha*=Math.exp(-clearance/p.r);
 c.translate(p.x,CONTACT+1);c.scale(1+clearance/p.r,.13);
 const shadow=c.createRadialGradient(0,0,0,0,0,Math.max(.1,p.r*.64));
 shadow.addColorStop(0,'#06152465');shadow.addColorStop(.45,'#0c253c26');shadow.addColorStop(1,'#0c253c00');
 c.fillStyle=shadow;c.beginPath();c.arc(0,0,Math.max(.1,p.r*.64),0,TAU);c.fill();c.restore();
 if(p.airborne)return;
 const foot=p.r*Math.sqrt(1-.975*.975);
 c.fillStyle='#0a223226';c.beginPath();c.ellipse(p.x,p.ground+1,Math.max(.1,foot*1.18),Math.max(.1,p.r*.026),0,0,TAU);c.fill();
 c.strokeStyle='#b9d0dd4a';c.lineWidth=1.1*pixel/scale;c.beginPath();c.ellipse(p.x,p.ground+1,Math.max(.1,foot*1.2),Math.max(.1,p.r*.027),0,.05,Math.PI-.05);c.stroke();
}
function frost(p){
 if(p.airborne)return;
 const foot=p.r*Math.sqrt(1-.975*.975);
 c.strokeStyle='#bed6df80';c.lineWidth=.8*pixel/scale;c.beginPath();c.ellipse(p.x,p.ground,foot,Math.max(.1,p.r*.015),0,0,Math.PI);c.stroke();
 const spread=bubble.ice;
 c.save();c.beginPath();c.rect(p.x-p.r,p.y-p.r,p.r*2,p.ground-(p.y-p.r));c.clip();
 for(const g of bubble.veins){
  const a=Math.PI*.5+(g.x*2-1)*(.24+spread*.57),r=p.r*(.965-g.y*.035*spread);
  const x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r,length=g.length*spread*.5;
  c.strokeStyle=`rgba(201,226,238,${(.08+g.y*.24)*spread})`;c.lineWidth=.65*pixel/scale;
  line(c,x,y,x-Math.cos(a)*length,y-Math.sin(a)*length,c.strokeStyle,c.lineWidth);
  if(length>2){line(c,x,y,x-Math.cos(a+.5)*length*.7,y-Math.sin(a+.5)*length*.7,c.strokeStyle,c.lineWidth);}
 }
 c.restore();
 // Nearby grains overlap the film's base instead of sitting behind it.
 for(const g of bubble.frostGrains){
  const x=p.x+(g.x*2-1)*foot*1.22,y=p.ground+(g.y-.3)*bubble.frost,size=g.size*pixel/scale;
  c.fillStyle=g.y>.3?'#a6bdcc80':'#ecf4f8b0';c.beginPath();c.moveTo(x-size,y+size*.5);c.lineTo(x,y-size);c.lineTo(x+size,y);c.closePath();c.fill();
 }
}
function draw(){
 if(!width)return;
 // Camera easing follows simulation time, so paused redraws cannot advance it.
 scale+=(cameraScale-scale)*(1-Math.exp(-(time-cameraTime)/(bubble?bubble.form:pauseMean)));cameraTime=time;
 ox=width/2-CX*scale;oy=height*.81-CONTACT*scale;
 c.globalAlpha=1;c.setTransform(1,0,0,1,0,0);c.drawImage(background,0,0);drawSky();
 c.save();c.translate(ox,oy);c.scale(scale,scale);
 for(const f of snow){if(f.size>1.1)continue;c.fillStyle='#c7deed66';c.beginPath();c.ellipse(f.x,f.y,f.size/scale,f.size/scale,f.offset,0,TAU);c.fill();}
 if(bubble){
  const p=center(),sheets=bubble.ending==='sheets';
  c.globalAlpha=phase==='settling'?1-ease(clamp(phaseAge/bubble.settleTime,0,1)):1;
  if(sheets){contact(p);frozenSheets(p);frost(p);}
  else if(phase!=='bursting'&&!(phase==='settling'&&bubble.ending==='rupture'&&bubble.ice===0)){
   contact(p);c.save();c.beginPath();c.rect(p.x-p.r-2,p.y-p.r-2,p.r*2+4,(p.airborne?p.r*2:p.ground-(p.y-p.r))+2);c.clip();
   for(const f of flakes)crystal(f,false);
   shell(p);
   for(const f of flakes)crystal(f,true);
   c.restore();frost(p);
  }else if(phase==='bursting'){
    if(bubble.ice>0){ice(p);for(const f of flakes)crystal(f);frost(p);}
    // The opening travels from the tear until no complete membrane remains.
    const progress=Math.sqrt(clamp(phaseAge/bubble.burstDuration,0,1));c.save();c.beginPath();c.rect(p.x-p.r-2,p.y-p.r-2,p.r*2+4,p.ground-p.y+p.r+2);c.clip();
    c.strokeStyle=hue(bubble.hue,.5*(1-progress));c.lineWidth=.7*pixel/scale;c.beginPath();c.arc(p.x,p.y,p.r,bubble.tear+progress*Math.PI,bubble.tear+TAU-progress*Math.PI);c.stroke();c.restore();
  }
  for(const f of fragments){c.globalAlpha=(1-f.age/f.life)*.65;c.fillStyle='#d7eaf5';c.beginPath();c.arc(f.x,f.y,f.radius,0,TAU);c.fill();}
  c.globalAlpha=1;
 }
 for(const f of snow){
  if(f.size<=1.1)continue;
  c.save();c.translate(f.x,f.y);c.rotate(-Math.atan2(f.vx,f.vy));
  c.fillStyle='#d5eaf58c';c.beginPath();c.ellipse(0,0,f.size/scale,Math.hypot(f.size,f.vy/f.life)/scale,0,0,TAU);c.fill();c.restore();
 }
 c.restore();ctx.imageSmoothingEnabled=true;ctx.drawImage(buffer,0,0);
}
function step(seconds){if(!Number.isFinite(seconds)||seconds<0)return;for(let left=seconds;left>1e-9;left-=1/60)update(Math.min(left,1/60));draw();N.refresh();}
function state(){
 const p=bubble?center():null,front=p?p.y+bubble.front*p.r:0;
 const shape=p?{top:front+(p.y-p.r-front)*domeScale(),front,base:CONTACT,domeScale:domeScale()}:null;
 return JSON.parse(JSON.stringify({time,phase,phaseAge,bubble,center:p,shape,flakes,fragments,snow,meteors,wind,wait,nextSnow,nextWind,nextMeteor,stats,stars,constellations}));
}
function fire(event){if(N.RM)return false;const actions={form,nucleate,burst,collapse,fracture,current:changeCurrent,snow:spawnSnow,meteor:shootingStar};const ok=actions[event]?actions[event]():false;draw();N.refresh();return ok;}
form();
for(let i=sampleCount(positive(7,.3)/snowMean);i>0;i--)spawnSnow(true);
// Select a naturally developed still from this seed, without inventing a crystal count or outcome.
if(N.RM)while(!bubble||!flakes.some(f=>f.age>f.growth*.5)||bubble.ending)update(1/60);
preparingStill=false;
addEventListener('resize',resize);resize();N.run({update,draw,step:1/60});
if(N.DEBUG){window.SB={pause(){N.paused=true;},run(){N.paused=false;},step,draw,state,fire};
 window.render_game_to_text=()=>JSON.stringify(state());window.advanceTime=ms=>step(ms/1000);}
})();
