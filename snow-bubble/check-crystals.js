// Geometry checks for curved crystal growth. Run with node snow-bubble/check-crystals.js.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
let points=[],images=0;
let context=new Proxy({}, {get(target,key){
 if(key in target)return target[key];
 if(key==='createLinearGradient'||key==='createRadialGradient')return()=>({addColorStop(){}});
 if(key==='moveTo'||key==='lineTo')return(x,y)=>points.push({x,y});
 if(key==='drawImage')return()=>images++;
 return()=>{};
}});
let canvas=()=>({width:0,height:0,style:{},getContext:()=>context});
let sandbox={URLSearchParams,Math,JSON,Date:class extends Date{constructor(...args){super(...(args.length?args:['2026-11-01T04:00:00.000Z']))}},Float32Array,console,
 location:{search:'?debug'},innerWidth:1600,innerHeight:900,performance:{now:()=>0},navigator:{},
 requestAnimationFrame(){},matchMedia:()=>({matches:false}),addEventListener(){},
 document:{visibilityState:'visible',addEventListener(){},getElementById:canvas,createElement:canvas,
 documentElement:{hasAttribute:()=>false,classList:{add(){}}}}};
sandbox.window=sandbox;vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../assets/js/nightcity.js',import.meta.url),'utf8'),sandbox);
let source=readFileSync(new URL('assets/js/main.js',import.meta.url),'utf8');
source=source.replace('window.SB={pause','window.SB={testSurface(items,dt){let saved=flakes;flakes=items;updateSurface(dt);flakes=saved;return items;},crystalSurface,crystalBranches,crystal,iceFront,sheetPose,icePieces,pause');
vm.runInContext(source,sandbox);
let api=sandbox.SB,start=api.state();
assert(start.center.airborne&&start.center.ground<start.center.snow,'The bubble begins above the snow');
assert(Math.abs(start.center.r/start.bubble.radius-1)<=start.bubble.sway,'The incoming bubble already has its full radius');
assert.equal(api.fire('nucleate'),false,'Crystals cannot form before touchdown');
api.step(start.bubble.form/2);let halfway=api.state();
assert(halfway.center.airborne&&halfway.center.ground>start.center.ground&&halfway.center.ground<halfway.center.snow);
assert.equal(halfway.bubble.ice,0);assert.equal(halfway.flakes.length,0);
api.step(start.bubble.form/2+1/60);let landed=api.state();
assert(!landed.center.airborne&&landed.center.ground===landed.center.snow,'The flight ends at the snow contact plane');
assert.equal(landed.center.x,400);assert(landed.bubble.ice>0,'Cooling begins after landing');
api.fire('nucleate');
let state=api.state(),f=state.flakes[0],p=state.center,tolerance=Math.sqrt(Number.EPSILON);
// Compare identical points with different nucleus offsets to detect per-particle wandering.
let mobile={...f,nx:0,ny:0,nz:1,age:f.growth/2,lock:0,locked:false,contacts:[]};
let paired=api.testSurface([{...mobile},{...mobile,offset:mobile.offset+100}],1/60);
assert.deepEqual([paired[0].nx,paired[0].ny,paired[0].nz],[paired[1].nx,paired[1].ny,paired[1].nz],'Coincident crystals share the same current regardless of nucleus noise');
assert(paired.every(v=>!v.locked&&v.lock===0),'Detached crystals can pass through the same current without permanently trapping each other');
let anchored=api.testSurface([{...mobile},{...mobile,locked:true,lock:1}],1/60)[0];
assert(!anchored.locked&&anchored.lock>0&&anchored.lock<1,'Contact with anchored ice gradually reduces mobility');
let alone=api.testSurface([{...mobile}],1/60)[0];
let nearby=api.testSurface([{...mobile},{...mobile,nx:.05,nz:Math.sqrt(1-.05**2)}],1/60)[0];
assert.notDeepEqual([alone.nx,alone.ny,alone.nz],[nearby.nx,nearby.ny,nearby.nz],'Growing neighboring ice changes the local surface flow');
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
let before=JSON.stringify(api.state());api.crystal(f,true);assert.equal(JSON.stringify(api.state()),before,'Rendering does not mutate seeded state');
let fronts=[-1,0,1].map(x=>api.iceFront(x,p));
assert(fronts.every(y=>y>=-1&&y<=.975)&&new Set(fronts).size>1,'The partial freeze boundary is uneven and stays on the shell');
for(let elapsed=0;elapsed<3600;elapsed+=.25){
 let s=api.state();if(s.bubble&&!s.bubble.ending&&s.bubble.ice>.5)break;
 api.step(.25);
}
assert(api.state().bubble.ice>.5&&!api.state().bubble.ending,'Exercise a naturally developed icy shell');
assert(api.fire('fracture'),'An icy shell can fracture');
let broken=api.state(),releases=new Set(),seenGround=false;
assert(api.icePieces().length>1,'The fixture exercises several independently moving pieces');
for(let plate of api.icePieces()){
 let pose=api.sheetPose(plate,broken.center);
 assert(Math.abs(pose.a-1)<tolerance&&Math.abs(pose.d-1)<tolerance,'Breaking the shell does not instantly squash it');
}
for(let frame=0;frame<1800&&api.state().phase==='collapsing';frame++){
 api.step(.1);let s=api.state();
 let pieces=api.icePieces(),supported=new Set(),queue=[];
 for(let [index,plate] of pieces.entries())if(plate.anchored&&!plate.released){supported.add(index);queue.push(index);}
 while(queue.length){let index=queue.pop();for(let neighbor of pieces[index].neighbors)if(!pieces[neighbor].released&&!supported.has(neighbor)){supported.add(neighbor);queue.push(neighbor);}}
 for(let [index,plate] of pieces.entries())assert(plate.released||plate.rested||supported.has(index),'No unsupported ice remains suspended');
 for(let plate of pieces){
  if(!plate.polygon.length)continue;
  let pose=api.sheetPose(plate,s.center);
  assert(Number.isFinite(plate.x)&&Number.isFinite(plate.y)&&Number.isFinite(plate.pitch));
  assert(plate.y+pose.bottom<=s.center.ground+tolerance*s.center.r,'No falling or rotating piece penetrates the snow');
  if(!plate.released)assert.equal(plate.pitch,0,'Supported pieces wait for their crack to release');
  if(plate.grounded){seenGround=true;assert(Math.abs(plate.y+pose.bottom-s.center.ground)<tolerance*s.center.r,'Resting pieces stay in contact with the snow');}
  releases.add(plate.delay);
 }
}
assert(seenGround&&api.state().phase==='settling','The shell reaches rest and the scene continues');
if(api.icePieces().length>1)assert(releases.size>1,'Pieces have independent release timing');
let debris=JSON.stringify(api.state());api.draw();assert.equal(JSON.stringify(api.state()),debris,'Drawing debris never advances its physics');
console.log('Full-size airborne arrival, touchdown before cooling, curved branches, silhouette crossing, pole projection, progressive growth, uneven frost and render-state isolation, independent ice release, ground collision and settled debris passed.');

let motionSandbox={...sandbox};motionSandbox.window=motionSandbox;vm.createContext(motionSandbox);
vm.runInContext(readFileSync(new URL('../assets/js/nightcity.js',import.meta.url),'utf8'),motionSandbox);
vm.runInContext(source,motionSandbox);
let motionAPI=motionSandbox.SB;motionAPI.step(motionAPI.state().bubble.form+1/60);
let tracks=new Map(),travel=0;
for(let frame=0;frame<600&&!motionAPI.state().bubble.ending;frame++){
 motionAPI.step(1/60);let motionState=motionAPI.state();
 for(let v of motionState.flakes){
  let previous=tracks.get(v.offset);
  if(previous&&!previous.locked){
   let arc=Math.acos(Math.max(-1,Math.min(1,previous.nx*v.nx+previous.ny*v.ny+previous.nz*v.nz)));
   v.distance=previous.distance+arc;
   travel=Math.max(travel,v.distance*motionState.center.r/v.size);
  }else v.distance=0;
  tracks.set(v.offset,v);
 }
}
assert(travel>1,'Surface flow carries naturally formed crystals farther than their own radius');
console.log('Shared currents, anchored contact and natural surface travel passed ('+travel.toFixed(1)+' crystal radii).');
