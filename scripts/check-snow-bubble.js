// Ambient-state and seed checks without browser dependencies. Visual checks run separately in a browser.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const runtime=readFileSync(new URL('../assets/js/nightcity.js',import.meta.url),'utf8');
const scene=readFileSync(new URL('../snow-bubble/assets/js/main.js',import.meta.url),'utf8');
function world(reduced=false,openedAt='2026-11-01T04:00:00.000Z',embed=false,quality='low'){
 const gradient={addColorStop(){}};
 const context=new Proxy({}, {get(target,key){
  if(key in target)return target[key];
  if(key==='createLinearGradient'||key==='createRadialGradient')return()=>gradient;
  if(key==='arc')return(x,y,r)=>assert(r>=0,'Canvas radii must be nonnegative');
  if(key==='measureText')return s=>({width:s.length*8});
  return()=>{};
 }});
 const canvas=()=>({width:0,height:0,style:{},getContext:()=>context}),surface=canvas(),listeners={};
 const sandbox={URLSearchParams,Float32Array,Math,JSON,console,
  Date:class extends Date{constructor(...args){super(...(args.length?args:[openedAt]))}},
  location:{search:'?debug'+(embed?'&embed'+(quality==='high'?'&q=high':''):'')},innerWidth:1600,innerHeight:900,
  performance:{now:()=>0},navigator:{},requestAnimationFrame(fn){sandbox.frame=fn},
  matchMedia:()=>({matches:reduced}),addEventListener(type,fn){listeners[type]=fn},
  document:{visibilityState:'visible',addEventListener(){},getElementById:()=>surface,createElement:canvas,
   documentElement:{hasAttribute:()=>false,classList:{add(){}}}}};
 sandbox.window=sandbox;vm.createContext(sandbox);
 vm.runInContext(runtime,sandbox);vm.runInContext(scene,sandbox);
 return{api:sandbox.SB,resize(w,h){sandbox.innerWidth=w;sandbox.innerHeight=h;listeners.resize()},seed:()=>sandbox.NightCity.R(),sandbox,listeners};
}
const copy=x=>JSON.parse(JSON.stringify(x));
function active(w){w.api.step(w.api.state().bubble.form+.001);return w.api;}
function check(s){
 assert(['waiting','forming','cooling','freezing','holding','frozen','collapsing','bursting','settling'].includes(s.phase));
 if(s.bubble){
  assert(s.bubble.ice>=0&&s.bubble.ice<=1);
  assert(!('mode' in s.bubble)&&!('target' in s.bubble)&&!('holdTime' in s.bubble)&&!('burstAt' in s.bubble),'No outcome or lifetime is selected at birth');
  assert(Math.abs(s.center.y+s.center.r*.975-s.center.ground)<1e-8);
 }
 for(const f of s.flakes){
  assert(Math.abs(Math.hypot(f.nx,f.ny,f.nz)-1)<1e-8,'Crystals stay attached to the spherical film');
  assert(f.ny<=.97500001&&f.y<=s.center.ground+.00001);
  assert(Number.isFinite(f.x)&&Number.isFinite(f.y)&&Number.isFinite(f.z));
 }
 for(const f of [...s.fragments,...s.snow])for(const k of ['x','y','vx','vy'])assert(Number.isFinite(f[k]));
}
const a=world(),b=world();assert.deepEqual(copy(a.api.state()),copy(b.api.state()));
assert.deepEqual(a.api.state().constellations.map(g=>g.name),['Orion','Cassiopeia','Ursa Major']);
assert.notDeepEqual(a.api.state().stars,world(false,'2026-11-01T04:00:00.123Z').api.state().stars);
for(let i=0;i<12;i++)a.api.draw();a.resize(375,812);a.resize(1024,768);a.resize(1600,900);
a.api.step(180);b.api.step(180);assert.deepEqual(copy(a.api.state()),copy(b.api.state()));assert.equal(a.seed(),b.seed());
const qlow=world(false,undefined,true),qhigh=world(false,undefined,true,'high');
qlow.api.step(60);qhigh.api.step(60);assert.deepEqual(copy(qlow.api.state()),copy(qhigh.api.state()));
const reduced=world(true),still=copy(reduced.api.state());check(still);
assert(still.flakes.some(f=>f.age>f.growth*.5),'The reduced-motion still is selected from natural seeded growth');
reduced.api.step(120);reduced.resize(375,812);assert.equal(reduced.api.fire('burst'),false);assert.deepEqual(copy(reduced.api.state()),still);
const many=active(world());
for(let i=0;i<1000;i++)assert(many.fire('nucleate'),'Every requested nucleation remains possible beyond the old ceiling');
assert(many.state().flakes.length>=1000);
for(let i=0;i<180;i++)assert(many.fire('snow'));
const priorMeteors=many.state().meteors.length;
for(let i=0;i<40;i++)assert(many.fire('meteor'));
assert(many.state().snow.length>120&&many.state().meteors.length===priorMeteors+40,'Snow and meteor concurrency have no population ceiling');
many.step(.25);check(many.state());
const sampled={stars:new Set(),drops:new Set(),sheets:new Set(),counts:new Set()},ends=new Set();
let partlyFrozenRuptures=0,overOldLimit=0;
for(let seed=0;seed<16;seed++){
 const w=world(false,'2026-11-01T04:00:'+String(seed).padStart(2,'0')+'.000Z'),api=active(w);
 sampled.stars.add(api.state().stars.length);
 const before=api.state();assert(api.fire('burst'),'Liquid film can rupture while freezing');
 const ruptured=api.state();sampled.drops.add(ruptured.fragments.length);
 assert.equal(ruptured.bubble.ending,'rupture');assert(ruptured.flakes.every(f=>f.ny>=ruptured.bubble.front));
 if(before.bubble.ice>0)partlyFrozenRuptures++;
}
assert(sampled.stars.size>1&&sampled.drops.size>1&&partlyFrozenRuptures>0,'Population sizes vary with the seed and partial shells can rupture');
const long=world().api;
const frozenShells=new Set(),failedFrozenShells=new Set(),renewedFrozenShells=new Set();
let pendingFrozenFailure=null;
for(let i=0;i<3600;i++){
 long.step(1);const s=long.state();check(s);
 if(s.phase==='frozen')frozenShells.add(s.stats.bubbles);
 if(s.bubble?.ending&&frozenShells.has(s.stats.bubbles)){
  assert.equal(s.bubble.ending,'sheets','A fully frozen shell collapses through ice fracture');
  failedFrozenShells.add(s.stats.bubbles);pendingFrozenFailure=s.stats.bubbles;
 }
 if(pendingFrozenFailure!==null&&s.stats.bubbles>pendingFrozenFailure){renewedFrozenShells.add(pendingFrozenFailure);pendingFrozenFailure=null;}
 if(s.bubble){sampled.counts.add(s.flakes.length);if(s.flakes.length>96)overOldLimit++;if(s.bubble.ending)ends.add(s.bubble.ending);if(s.bubble.plates.length)sampled.sheets.add(s.bubble.plates.length);}
}
const end=long.state();assert(end.stats.bubbles>1&&end.stats.crystals>0);
assert(overOldLimit>0,'Natural runs can continue nucleating past 96');
assert(ends.has('rupture')&&ends.size>1,'Different endings emerge from the same ongoing simulation');
assert(frozenShells.size>0,'The natural run exercises complete freezing');
assert(failedFrozenShells.size>0&&renewedFrozenShells.size>0,'Complete freezing must continue through collapse and a fresh bubble');
const snap=long.state();snap.stars[0].x=99;assert.notDeepEqual(copy(long.state()),copy(snap));
const embedded=world(false,undefined,true),sbox=embedded.sandbox;
embedded.listeners.message({data:{nightcity:'pause'}});const paused=copy(embedded.api.state());sbox.frame(1000);assert.deepEqual(copy(embedded.api.state()),paused);
embedded.listeners.message({data:{nightcity:'play'}});sbox.frame(1100);assert(embedded.api.state().time>paused.time);
assert(!scene.includes('Math.random'));assert(!/flakes\.length\s*>?=\s*\d+/.test(scene));assert(!/snow\.length\s*<\s*\d+/.test(scene));
console.log('Snow Bubble: uncapped crystal/snow/meteor creation, varying seeded counts, competing failure processes, spherical attachment, draw/resize/quality determinism, reduced motion, host pause/play and one-hour simulation passed.');
console.log(JSON.stringify({endings:[...ends],frozenShells:frozenShells.size,failedFrozenShells:failedFrozenShells.size,renewedFrozenShells:renewedFrozenShells.size,crystals:end.stats.crystals,bubbles:end.stats.bubbles,maximumObserved:Math.max(...sampled.counts),dropletCounts:[...sampled.drops],sheetCounts:[...sampled.sheets]}));
