// Checks for Snow Bubble's film, landings, frost, collapse and rendering. Run with npm run check:snow-bubble.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const runtime=readFileSync(new URL('../assets/js/nightcity.js',import.meta.url),'utf8');
// Global lookups are slow inside a vm context, and the scene reads Math constantly.
const source=readFileSync(new URL('assets/js/main.js',import.meta.url),'utf8').replace("'use strict';","'use strict';const Math=globalThis.Math;")
 .replace('window.SB={pause','window.SB={testSurface(items,dt){let saved=flakes;flakes=items;updateSurface(dt);flakes=saved;return items;},crystalSurface,crystalBranches,crystal,iceDepth,perch,seedFrost,lace:()=>lace,tips:()=>tips,layers:()=>filled.map(m=>m.size),field:()=>Float32Array.from(fieldNow),land:()=>({height:landHeight,color:landColor,width:LAND_W,rows:LAND_H,step:landStepZ,from:LZ0}),treeList:()=>trees,stands:()=>treeStands,testReady(){sceneryAt=1;},landAt,pieceList:()=>pieces,sliverList:()=>slivers,ridge:()=>skyline,perchList:()=>perches,pause');
let points=[],images=0;
const context=new Proxy({}, {get(target,key){
 if(key in target)return target[key];
 if(key==='createLinearGradient'||key==='createRadialGradient')return()=>({addColorStop(){}});
 if(key==='createImageData')return(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h});
 if(key==='moveTo'||key==='lineTo')return(x,y)=>points.push({x,y});
 // The 32 pixel soft dot is a highlight. Anything else here would be a stamped crystal.
 if(key==='drawImage')return image=>{if(image.width!==32)images++;};
 return()=>{};
}});
const canvas=()=>({width:0,height:0,style:{},getContext:()=>context});
function open({stamp='2026-11-01T04:00:00.000Z',search='?debug',reduced=false,wide=1600,high=900,fresh=false}={}){
 // A clock that jumps forward each time it is read, so the land is built one small slice per draw.
 let clock=0;
 const box={URLSearchParams,Math,JSON,Date:class extends Date{constructor(...args){super(...(args.length?args:[stamp]))}},Float32Array,console,
  location:{search},innerWidth:wide,innerHeight:high,performance:{now:()=>clock+=50},navigator:{},requestAnimationFrame(){},matchMedia:()=>({matches:reduced}),addEventListener(){},
  document:{visibilityState:'visible',addEventListener(){},getElementById:canvas,createElement:canvas,documentElement:{hasAttribute:()=>false,classList:{add(){}}}}};
 box.window=box;vm.createContext(box);vm.runInContext(runtime,box);vm.runInContext(source,box);
 // The night comes first and the bubble after it, so most checks start from the moment it appears.
 const api=box.SB;if(!fresh&&!reduced)while(!api.state().bubble)api.step(.25);
 return api;
}
function until(api,test,seconds=900,step=.25){for(let t=0;t<seconds;t+=step){const s=api.state();if(test(s))return s;api.step(step);}assert.fail('Timed out waiting for a state');}

// The land: real relief with snow and rock on it, built in slices without touching the world's random numbers.
{
 const a=open({fresh:true});let n=0;
 assert.equal(a.state().scenery,false,'The land is not built in one go');
 assert.equal(a.state().bubble,null,'The night is there before any bubble');assert(a.state().wait>1,'The scene has a moment to itself');
 images=0;
 while(!a.state().scenery&&n++<4000){const before=a.state().scenery;a.draw();if(!before&&!a.state().scenery)assert.equal(images,0,'Nothing is painted until the whole scene exists');images=0;}
 assert(a.state().scenery,'The land finishes building');assert(n>50,'The land is built a slice at a time');
 const {height,color,width,rows,step,from}=a.land();
 let highest=0,lowest=Infinity,sum=0,rough=0,bright=0,dark=0;
 for(let i=0;i<height.length;i++){assert(Number.isFinite(height[i]));highest=Math.max(highest,height[i]);lowest=Math.min(lowest,height[i]);sum+=height[i];}
 for(let j=1;j<rows-1;j+=3)for(let i=1;i<width-1;i+=3){const k=j*width+i;rough+=Math.abs(height[k+1]+height[k-1]-2*height[k]);const v=color[k*4+2];if(v>120)bright++;if(color[k*4+3]>160)dark++;}
 assert(highest>lowest*6,'There are real mountains in it');assert(rough>0,'Erosion leaves fine relief');
 assert(bright>2000,'Moonlit snow covers much of the range');assert(dark>500,'Rock shows on the steep ground');
 assert(a.treeList().length>40,'There are stands of trees');
 assert(a.stands().every(t=>Math.abs(t.u-.5)>=.16),'Trees stand back from the middle of the view');
 // The ground is the same land as the mountains, so its snow is the same snow.
 const tint=(test)=>{let r=0,b=0,count=0;for(let j=2;j<rows-2;j+=2){const z=from+j*step;for(let i=2;i<width-2;i+=2){const k=j*width+i;if(test(z,height[k],color[k*4+3],i)){r+=color[k*4];b+=color[k*4+2];count++;}}}return{ratio:b/r,bright:b/count,count};};
 const field=tint((z,e,rock,i)=>z<.2&&Math.abs(i-width/2)<width*.2),peaks=tint((z,e,rock)=>e>.08&&rock<80&&z>.5);
 assert(field.count>500&&peaks.count>500,'There is snow on both');
 assert(Math.abs(field.ratio-peaks.ratio)<.2,'The snowfield and the peaks are the same color of snow');
 assert(field.bright>peaks.bright*.45,'The snowfield is lit by the same moon');
 let flat=0;for(let i=0;i<width;i+=4)flat=Math.max(flat,Math.abs(height[Math.round((.1-from)/step)*width+i]-.012));
 assert(flat<.006,'The ground near the camera lies low and gentle');
 assert(a.treeList().every(t=>t.z>.3&&t.z<.75),'Trees stand out on the land at their own distance');
}
console.log('Eroded land, snow, rock and trees passed.');

// A quiet sky.
let api=open(),start=api.state();
assert(start.stars.length<520,'The sky stays sparse');
assert(start.center.airborne&&start.center.ground<start.center.snow,'The bubble begins above the snow');
assert.equal(api.fire('nucleate'),false,'Crystals cannot form before touchdown');
assert.equal(api.fire('collapse'),false,'A liquid bubble cannot burst');
api.step(start.bubble.flight/2);let halfway=api.state();
assert(halfway.center.airborne&&halfway.center.ground>start.center.ground&&halfway.center.ground<halfway.center.snow);
assert.equal(halfway.bubble.ice,0);assert.equal(halfway.flakes.length,0);
console.log('Sky and airborne start passed.');

// The film flows: it changes shape instead of holding one pattern, and it never blends away to a single tone.
let film=open(),filmStart=film.state();film.step(filmStart.bubble.flight*.25);
let before=film.field();film.step(1.5);let after=film.field();
let moved=0;for(let i=0;i<before.length;i++)moved+=Math.abs(after[i]-before[i]);moved/=before.length;
assert(moved>25,'Film thickness moves within a second or two');
film.step(filmStart.bubble.flight*.3);
let again=film.field(),mean=again.reduce((a,b)=>a+b,0)/again.length,spread=Math.sqrt(again.reduce((a,b)=>a+(b-mean)**2,0)/again.length);
assert(spread>60,'Stirring does not blend the film to one even color');
console.log('Fluid film passed (moved '+moved.toFixed(0)+' nm, spread '+spread.toFixed(0)+' nm).');

// Every bubble arrives its own way, from its own place, to its own spot and depth.
let spots=[],seats=[],speeds=[],sides=new Set(),depths=[];
for(let i=0;i<24;i++){
 const b=open({stamp:Date.UTC(2026,10,1,4,i,i*2,i*7)}).state().bubble;
 spots.push(b.spot);seats.push(b.base);speeds.push(b.touch);depths.push(b.spotZ);sides.add(Math.sign(b.arrival.x));
}
const range=v=>Math.max(...v)-Math.min(...v);
assert.equal(sides.size,2,'Bubbles arrive from both sides');
assert(range(spots)>200,'Bubbles land in different places');
assert(range(depths)>120,'Some land nearer and some further away');
assert(Math.max(...seats)>.95&&Math.min(...seats)<.87,'Some rest on the snow and some settle into it');
assert(range(speeds)>6,'Some touch down harder than others');
console.log('Varied arrivals passed.');

// Touching down.
let land=until(api,s=>s.phase==='landing');
assert(land.puffs>0,'Touching down lifts a breath of powder');assert(land.marks>0,'Touching down leaves a mark');
let give=0;
for(let i=0;i<400&&api.state().phase==='landing';i++){api.step(.05);const s=api.state();give=Math.max(give,Math.abs(s.bubble.squash));assert(s.center.ground<=s.center.snow+1e-9,'The bubble never sinks through the ground plane');}
let settled=api.state();
assert.notEqual(settled.phase,'landing','Every landing comes to rest');
assert(give>.004&&give<.12,'The film gives on touching down, and only a little');
assert(Math.abs(settled.center.x-settled.bubble.spot)<1e-9,'It comes to rest on its own spot');
assert(settled.bubble.ice>=0&&settled.lace<5,'Freezing begins only once it has settled');

// Crystals on the curved film.
until(api,s=>s.bubble.ice>.02);api.fire('nucleate');
let state=api.state(),f=state.flakes.at(-1),p=state.center,tolerance=Math.sqrt(Number.EPSILON);
let mobile={...f,nx:0,ny:0,nz:1,age:f.growth/2,lock:0,locked:false,contacts:[]};
let paired=api.testSurface([{...mobile},{...mobile,offset:mobile.offset+100}],1/60);
assert.deepEqual([paired[0].nx,paired[0].ny,paired[0].nz],[paired[1].nx,paired[1].ny,paired[1].nz],'Coincident crystals share the same current regardless of nucleus noise');
assert(paired.every(v=>!v.locked&&v.lock===0),'Detached crystals can pass through the same current without permanently trapping each other');
let anchored=api.testSurface([{...mobile},{...mobile,locked:true,lock:1}],1/60)[0];
assert(!anchored.locked&&anchored.lock>0&&anchored.lock<1,'Contact with anchored ice gradually reduces mobility');
for(let normal of [[1,0,0],[0,-1,0],[0,1,0],[0,0,1],[0,0,-1]]){
 Object.assign(f,{nx:normal[0],ny:normal[1],nz:normal[2],age:f.growth});
 for(let branch of api.crystalBranches(f)){
  let point=api.crystalSurface(f,branch.x2,branch.y2,p);
  assert(Math.abs(Math.hypot(point.nx,point.ny,point.nz)-1)<tolerance,'Every branch endpoint lies on the sphere, including at the poles');
 }
 points=[];images=0;api.crystal(f,false);api.crystal(f,true);
 assert(points.length>0&&images===0,'Crystals draw curved geometry rather than flat image sprites');
 for(let point of points)assert(Math.hypot(point.x-p.x,point.y-p.y)<=p.r+tolerance,'Projected branches remain inside the silhouette');
}
Object.assign(f,{nx:0,ny:0,nz:1,age:0});points=[];api.crystal(f,true);assert.equal(points.length,0);
f.age=f.growth/4;points=[];api.crystal(f,true);let early=points.length;
f.age=f.growth;points=[];api.crystal(f,true);assert(points.length>early,'Side branches emerge after the advancing main arms');
let frozenState=JSON.stringify(api.state());api.crystal(f,true);assert.equal(JSON.stringify(api.state()),frozenState,'Rendering does not mutate seeded state');
let around=[...Array(8).keys()].map(i=>api.iceDepth(Math.cos(i*.8)*.6,.8,Math.sin(i*.8)*.6));
assert(new Set(around).size>1,'The freeze line is uneven');
// Crystals are feathers, not stars: few arms of uneven length, dense barbs, and never the same one twice.
{
 const shapes=new Set(),v=open();let barbs=[],arms=[],lengths=[];
 until(v,s=>s.bubble&&s.bubble.ice>.02,200);
 for(let i=0;i<40;i++){
  assert(v.fire('nucleate'));
  const c=v.state().flakes.at(-1),branches=v.crystalBranches(c),spines=branches.filter(b=>!b.start);
  shapes.add(branches.map(b=>b.x2.toFixed(3)).join());
  barbs.push(branches.filter(b=>b.level===1).length/Math.max(1,spines.length));arms.push(spines.length);
  lengths.push(Math.max(...spines.map(b=>b.end))/Math.min(...spines.map(b=>b.end)));
 }
 assert.equal(shapes.size,40,'No two crystals are alike');
 assert(new Set(arms).size>1,'Crystals grow different numbers of arms');
 assert(Math.min(...arms)>=2&&Math.max(...arms)<=6,'Arms follow the six axes of ice');
 assert(barbs.reduce((a,b)=>a+b,0)/barbs.length>6,'Arms are feathered with many barbs');
 assert(lengths.reduce((a,b)=>a+b,0)/lengths.length>1.25,'Arms grow to uneven lengths');
}
{
 const nights=[];
 for(let i=0;i<8;i++)nights.push(open({stamp:Date.UTC(2026,10,3,2,i,i*5,i*3)}).state().bubble.weather);
 for(const key of ['barb','bare','fork','full','plate'])assert(new Set(nights.map(w=>w[key].toFixed(4))).size===8,'Each bubble has crystal weather of its own');
}
console.log('Landing, curved crystals and crystal variety passed.');

// The frost climbs behind the cold, and nothing ends until it has enclosed the whole shell and turned it white.
let climbed=0;
for(let t=0;t<900;t+=.25){
 const s=api.state();
 assert.equal(s.bubble.ending,null,'Nothing fails while the frost is still spreading');
 if(s.bubble.ready)break;
 assert.equal(api.fire('collapse'),false,'The shell cannot fail before it is whole and white');
 api.step(.25);
 const n=api.state();
 if(n.bubble.ice>.02&&n.bubble.ice<.9){
  // A tip the cold has not reached yet has to wait where it is.
  const ahead=new Map();
  for(const t of api.tips())if(api.iceDepth(t.x,t.y,t.z)<-n.bubble.lead*1.2)ahead.set(t.id,[t.x,t.y,t.z]);
  api.step(.05);climbed++;
  for(const t of api.tips()){const was=ahead.get(t.id);if(was&&api.iceDepth(t.x,t.y,t.z)<-n.bubble.lead*1.2)assert(Math.hypot(t.x-was[0],t.y-was[1],t.z-was[2])<1e-9,'Tips wait for the cold');}
 }
}
let white=api.state();
assert(climbed>20,'The freeze climbs the shell');
assert(white.bubble.ready&&white.bubble.ice===1&&white.bubble.white===1,'The shell is frozen and white before anything else happens');
assert(white.bubble.covered>=.99,'Frost covers the whole sphere');
let layers=api.layers();assert(layers[0]>0&&layers[1]>0&&layers[2]>0,'Flakes build up in several layers');
let grown=api.lace(),joints=0,kinds=[0,0,0];
for(let i=0;i<grown.length;i+=8){if(grown[i+6]===3)joints++;else if(grown[i+6]<3)kinds[grown[i+6]]++;}
assert(kinds[0]&&kinds[1]&&kinds[2],'Dendrites grow leading arms, side branches and finer twigs');
assert(joints>10,'Growing branches fuse where they meet other ice');
for(let i=0;i<grown.length;i+=8){
 assert(Math.abs(Math.hypot(grown[i+3],grown[i+4],grown[i+5])-1)<1e-6,'Every strand of frost lies on the sphere');
 assert(grown[i+4]<=white.bubble.base+1e-9,'Frost stops at the snow');
}
console.log('Climbing frost, full enclosure and layers passed.');

// It breaks the way frozen bubbles do on film. A tear races round the shell, and the shell becomes thin pieces that hang, then flutter down and stay.
let prepared=api.pieceList();
assert(prepared.length>80,'The shell is ready to come apart into many pieces');
assert(api.sliverList().length>200,'And into fine slivers of its own lace');
assert(api.fire('collapse')||api.state().bubble.ending==='break','A white shell can burst');
let gone=api.state(),tear=gone.bubble.tearTime;
assert.equal(api.tips().length,0,'Frost stops growing the moment it breaks');
assert(tear>.1&&tear<1.6,'The tear is over in about a second, however cold the night');
const whole=api.pieceList().map(q=>({y:q.y,when:q.when}));
for(let i=1;i<whole.length;i++)assert(whole[i].when>=whole[i-1].when,'Pieces go in the order the tear reaches them');
assert(whole.at(-1).when-whole[0].when>tear*.5,'The tear travels, it does not happen everywhere at once');
api.step(tear*.3);
let partly=api.pieceList(),waiting=partly.filter(q=>!q.gone);
assert(waiting.length>0&&waiting.length<partly.length,'Part way through, some of the shell is still whole');
for(const q of waiting)assert.equal(q.y,whole.find(v=>v.when===q.when).y,'Ice the tear has not reached stays exactly where it is');
api.step(tear+.25);
assert(api.pieceList().every(q=>q.gone),'Soon the shell has gone');
let hung=api.pieceList(),fell=0;for(let i=0;i<hung.length;i++)fell=Math.max(fell,Math.abs(hung[i].y-whole[i].y));
assert(fell<api.state().center.r,'For a moment the pieces still hold the shape of the bubble');
let heldCount=api.pieceList().length,sliverCount=api.sliverList().length;
for(let t=0;t<90&&api.state().phase==='collapsing';t+=.1){
 api.step(.1);
 assert.equal(api.pieceList().length,heldCount,'Nothing vanishes in the air');assert.equal(api.sliverList().length,sliverCount,'Not even the slivers');
 for(const q of api.pieceList())assert(q.y<=q.floor+1e-9&&Number.isFinite(q.x),'Pieces stop at the snow');
}
let down=api.state();
assert.equal(down.phase,'settling','Everything comes to rest');
assert(api.pieceList().every(q=>q.rest)&&api.sliverList().every(q=>q.rest),'And stays where it landed');
assert(!('shards' in down),'There is no dust');
let debris=JSON.stringify(api.state());api.draw();assert.equal(JSON.stringify(api.state()),debris,'Drawing never advances the physics');
until(api,s=>!s.bubble,200);
assert.equal(api.lace().length,0);assert.equal(api.tips().length,0);assert.equal(api.pieceList().length,0);
until(api,s=>s.bubble&&s.phase==='forming',600);
console.log('Tear, hanging pieces, flutter and resting flakes passed.');

// Ice can start anywhere a flake lands, not only at the snow.
{
 const a=open();until(a,s=>s.bubble&&s.bubble.ice>0&&s.bubble.ice<.3,200);
 const crown=[.2,-.9,Math.sqrt(1-.04-.81)],before=a.state().bubble.origins.length;
 if(a.iceDepth(...crown)<0)assert(a.seedFrost(...crown),'A flake on the crown can start the ice');
 const s=a.state(),o=s.bubble.origins.at(-1);
 assert.equal(s.bubble.origins.length,before+1);assert(o.y<-.8,'It starts where the flake landed');
 const far=[-.2,.9,-Math.sqrt(1-.04-.81)],edge=o.edge;
 a.step(8);
 assert(a.state().bubble.origins.at(-1).edge<edge,'From there it spreads');
 assert(a.iceDepth(crown[0]+.04,crown[1]-.0,crown[2])>-.1,'Ice surrounds the place the flake landed');
 assert(a.tips().some(t=>t.oy<-.5)||a.lace().length>0,'Dendrites grow out from it');
}
{
 const sites=[];
 for(let i=0;i<10;i++){
  const a=open({stamp:Date.UTC(2026,10,2,3,i,i*3,i*11)});until(a,s=>s.bubble&&s.bubble.ice>.5,240,.5);
  sites.push(a.state().bubble.origins.length);
 }
 assert(new Set(sites).size>1,'Some bubbles take their ice from one place and some from several');
 console.log('Ice from any side passed (starting points per bubble: '+sites.join(' ')+').');
}

// Gentle current over the film. How far a crystal rides depends on how soon the ice arrives, so this looks across bubbles and not at one.
const carried=[];let fastest=0;
for(let i=0;i<6;i++){
 const motion=open({stamp:Date.UTC(2026,10,3,5,i,i*5,i*17)});until(motion,s=>s.phase==='freezing');
 const tracks=new Map();let travel=0;
 for(let frame=0;frame<400&&!motion.state().bubble.ending;frame++){
  motion.step(.1);const s=motion.state();
  for(const v of s.flakes){
   const previous=tracks.get(v.offset);
   if(previous&&!previous.locked){
    const arc=Math.acos(Math.max(-1,Math.min(1,previous.nx*v.nx+previous.ny*v.ny+previous.nz*v.nz)));
    v.distance=previous.distance+arc;fastest=Math.max(fastest,arc*s.center.r/.1);travel=Math.max(travel,v.distance*s.center.r/v.size);
   }else v.distance=0;
   tracks.set(v.offset,v);
  }
 }
 carried.push(travel);
}
assert(carried.filter(v=>v>1).length>=carried.length/2,'Surface flow carries naturally formed crystals farther than their own radius on most bubbles');
assert(fastest<30,'The film carries crystals gently');
console.log('Gentle currents passed ('+carried.map(v=>v.toFixed(1)).join(' ')+' crystal radii, fastest '+fastest.toFixed(1)+' units a second).');

// Two crystals held in contact weld and then move as one piece.
let welding=open();until(welding,s=>s.phase==='freezing'&&s.bubble.ice>.05);
welding.fire('nucleate');welding.fire('nucleate');
let w=welding.state(),first=w.flakes.at(-2),other=w.flakes.at(-1);
Object.assign(first,{nx:0,ny:-.3,nz:Math.sqrt(1-.09),age:first.growth,lock:0,locked:false,contacts:[],dwell:0,baked:false,group:1});
Object.assign(other,{nx:.04,ny:-.3,nz:Math.sqrt(1-.09-.0016),age:other.growth,lock:0,locked:false,contacts:[],dwell:0,baked:false,group:2,id:first.id+1});
let pair=[first,other];
for(let i=0;i<Math.ceil(w.bubble.weld*60)+6;i++)pair=welding.testSurface(pair,1/60);
assert.equal(pair[0].group,pair[1].group,'Crystals that stay in contact weld together');
let apart=Math.hypot(pair[0].nx-pair[1].nx,pair[0].ny-pair[1].ny,pair[0].nz-pair[1].nz);
for(let i=0;i<120;i++)pair=welding.testSurface(pair,1/60);
assert(Math.abs(Math.hypot(pair[0].nx-pair[1].nx,pair[0].ny-pair[1].ny,pair[0].nz-pair[1].nz)-apart)<.01,'Welded crystals travel as one piece');
console.log('Crystal welding passed.');

// Snow resting on the film drifts with it.
let resting=open();until(resting,s=>s.phase==='freezing'&&s.bubble.ice>.1);
const flat=-.4;resting.perch({size:1,offset:7},.1,flat,Math.sqrt(1-.01-flat*flat));
let grain=resting.state().perched.find(g=>g.offset===7);assert(grain,'A falling flake that meets the bubble stays on it');
resting.step(1);let drifted=resting.state().perched.find(g=>g.offset===7);
assert(drifted&&Math.hypot(drifted.nx-grain.nx,drifted.ny-grain.ny,drifted.nz-grain.nz)>1e-4,'Snow resting on the film drifts with it');
console.log('Resting snow passed.');

// Other bubbles come down far off, at their own times and places, and end the way every bubble does.
{
 const a=open({stamp:Date.UTC(2026,10,4,6,1,2,3)});const seen=new Map();let most=0;
 for(let t=0;t<300;t++){
  a.step(1);const s=a.state();most=Math.max(most,s.drifters.length);
  for(const d of s.drifters){
   seen.set(d.offset,d);
   if(d.landed===null)assert.equal(d.ice,0,'Nothing freezes in the air');
   if(d.broken!==null)assert.equal(d.ice,1,'A far bubble only breaks once it has frozen white');
   assert(d.z>.15&&d.z<.34,'They stay between the near bubble and the trees');
  }
 }
 const list=[...seen.values()],spread=v=>Math.max(...v)-Math.min(...v);
 assert(list.length>15,'They keep coming');assert(most>=2,'More than one is about at a time');
 assert(spread(list.map(d=>d.u))>.6,'They come down at random places');assert(spread(list.map(d=>d.z))>.08,'Some are further off than others');assert(spread(list.map(d=>d.fall))>4,'Each takes its own time');
 assert(list.some(d=>d.broken!==null),'Some have already run their course');
 assert(new Set(list.map(d=>d.hue)).size===list.length,'No two are the same');
 const before=a.state().drifters.length;assert(a.fire('drift'));assert.equal(a.state().drifters.length,before+1);
}
console.log('Background bubbles passed.');

// The moon belongs to the night: fixed in the sky, in a shape of its own, and some nights not there at all.
{
 const shapes=[];let none=0,steady=null;
 for(let i=0;i<40;i++){
  const a=open({stamp:Date.UTC(2026,10,6,1,i,i,i*3),fresh:true}),m=a.state().moon;
  if(!m){none++;continue;}
  shapes.push(m.phase);steady=steady||a;
  assert(m.u>.05&&m.u<.95&&m.v>.05&&m.v<.26,'It hangs clear of the range, somewhere in the sky');
 }
 assert(none>2&&none<20,'Some nights have no moon, and most do');
 assert(shapes.some(p=>p<.3),'Some nights it is a crescent');assert(shapes.some(p=>p>.4&&p<.6),'Some nights about half');assert(shapes.some(p=>p===1),'Some nights full');
 const before=JSON.stringify(steady.state().moon);steady.step(300);
 assert.equal(JSON.stringify(steady.state().moon),before,'It does not rise, set or move');assert.equal(steady.fire('moon'),false,'Nothing can summon one');
}
// A faint aurora comes and goes.
{
 const a=open({stamp:Date.UTC(2026,10,4,7,2,3,4)});a.testReady();
 const auroras=new Set();let brightest=0,clear=0;
 for(let t=0;t<1000;t++){
  a.step(1);const s=a.state();
  if(s.aurora){auroras.add(s.aurora.offset);brightest=Math.max(brightest,s.aurora.power);}else clear++;
  if(t%50===0)a.draw();
 }
 assert(auroras.size>=2,'The aurora comes back');assert(clear>100,'Much of the night has none');assert(brightest<.62,'The aurora stays faint');
 const b=open({stamp:Date.UTC(2026,10,4,7,2,3,5)});b.testReady();
 if(!b.state().aurora)assert(b.fire('aurora'),'An aurora can begin');assert.equal(b.fire('aurora'),false,'One aurora at a time');
 const before=b.state().time;b.draw();assert.equal(b.state().time,before,'Drawing it advances nothing');
}
console.log('Moon and aurora passed.');

// Drawing at any size, or not at all, leaves the seeded world exactly the same.
function world(drawing,wide){
 const a=open({wide,high:700}),flight=a.state().bubble.flight;a.testReady();
 a.step(flight+8);for(let i=0;i<6;i++){a.step(1);if(drawing)for(let j=0;j<3;j++)a.draw();}
 const s=a.state();return JSON.stringify([s.time,s.bubble,s.flakes,s.lace,s.tips,s.perched,s.drifters,s.moon,s.aurora]);
}
assert.equal(world(true,1600),world(false,420),'Rendering never changes the seeded world');
console.log('Render independence passed.');

// A rare snow leopard, far up on the skyline.
{
 const a=open();let n=0;while(!a.state().scenery&&n++<4000)a.draw();
 until(a,s=>s.bubble&&s.bubble.ice>0,200);
 const perches=a.perchList(),ridge=a.ridge(),top=ridge.reduce((m,v)=>Math.min(m,v),1),mean=ridge.reduce((m,v)=>m+v,0)/ridge.length;
 assert(perches.length>0,'There are high places for it');
 for(const u of perches){const y=ridge[Math.floor(u*(ridge.length-1))];assert(y<top+(mean-top)*.85,'It only ever comes out on high ground');assert(y<.5,'Far above the plain');}
 const before=a.state().stats.leopards||0;
 if(!a.state().leopard)assert(a.fire('leopard'),'A snow leopard can appear');
 const l=a.state().leopard;assert.equal(a.fire('leopard'),false,'One at a time');
 assert(a.state().stats.leopards>before);a.draw();
 a.step(l.life+.1);assert.equal(a.state().leopard,null,'It leaves');assert(a.state().nextLeopard>0,'Another comes much later');
}
console.log('Snow leopard passed.');

// Reduced motion shows one developed still and nothing advances after it.
let still=open({reduced:true}),held=still.state();
assert(held.bubble.ice>=.72&&!held.bubble.ending,'Reduced motion selects developed frost');
assert(held.scenery,'A still has its mountains, since no later frame can finish them');
still.step(5);assert.equal(still.state().time,held.time,'Reduced motion stays still');assert.equal(still.fire('collapse'),false);
console.log('Reduced motion passed.');
