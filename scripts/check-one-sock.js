// Ambient-state and seed checks without browser dependencies. Visual checks run separately in a browser.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const runtime=readFileSync(new URL('../assets/js/nightcity.js',import.meta.url),'utf8');
const scene=readFileSync(new URL('../one-sock/assets/js/main.js',import.meta.url),'utf8');
function world(reduced=false,openedAt='2026-11-01T04:00:00.000Z'){
 const gradient={addColorStop(){}};
 const context=new Proxy({}, {get(target,key){
  if(key in target)return target[key];
  if(key==='createLinearGradient'||key==='createRadialGradient')return()=>gradient;
  if(key==='measureText')return s=>({width:s.length*8});
  return()=>{};
 }});
 const canvas=()=>({width:0,height:0,style:{},getContext:()=>context}),surface=canvas(),listeners={};
 const sandbox={URLSearchParams,Float32Array,Math,JSON,console,
  Date:class extends Date{constructor(...args){super(...(args.length?args:[openedAt]))}},
  location:{search:'?debug'},innerWidth:1600,innerHeight:900,
  performance:{now:()=>0},navigator:{},requestAnimationFrame(){},
  matchMedia:()=>({matches:reduced}),addEventListener(type,fn){listeners[type]=fn},
  document:{visibilityState:'visible',addEventListener(){},getElementById:()=>surface,createElement:canvas,
   documentElement:{hasAttribute:()=>false,classList:{add(){}}}}};
 sandbox.window=sandbox;vm.createContext(sandbox);
 vm.runInContext(runtime,sandbox);vm.runInContext(scene,sandbox);
 return{api:sandbox.OS,resize(w,h){sandbox.innerWidth=w;sandbox.innerHeight=h;listeners.resize()},seed:()=>sandbox.NightCity.R()};
}
const copy=x=>JSON.parse(JSON.stringify(x)),a=world(),b=world(),initial=a.api.state();
assert.equal(initial.stars.length,1100);
assert(initial.stars.every(s=>s.x>0&&s.x<1&&s.y>0&&s.y<1));
assert(initial.stars.every(s=>s.glitter));
assert(initial.stars.every(s=>s.rate>=.5&&s.rate<=1.2&&Number.isFinite(s.phase)));
assert.deepEqual(initial.constellations.map(c=>c.name),['Orion','Cassiopeia','Ursa Major']);
assert(initial.constellations.every(c=>c.names.length===c.points.length&&c.edges.every(e=>e.every(i=>i<c.points.length))));
assert.deepEqual(initial.stars,b.api.state().stars);
assert.notDeepEqual(initial.stars,world(false,'2026-11-01T04:00:00.123Z').api.state().stars);
assert.equal(a.api.fire('customer'),false);
assert.equal(a.api.fire('jam'),false);
assert(!('customer' in initial)&&!('customer' in initial.timers));
for(let i=0;i<20;i++)a.api.draw();
a.resize(375,812);a.resize(1024,768);a.resize(1600,900);
a.api.step(600);b.api.step(600);
assert.deepEqual(copy(a.api.state()),copy(b.api.state()));
assert.equal(a.seed(),b.seed());
const reduced=world(true),still=reduced.api.state();
reduced.api.step(120);reduced.resize(375,812);
assert.deepEqual(copy(reduced.api.state()),copy(still));
assert.equal(still.cat,null);
const c=world().api;
assert(c.fire('cat'));assert.equal(c.fire('cat'),false);assert.equal(c.state().stats.cats,1);
assert(c.fire('car'));assert.equal(c.fire('car'),false);assert.equal(c.state().stats.cars,1);
for(const event of ['flicker','mist','rattle','slip','breeze','surge','glint','buttons','drip','vent'])assert(c.fire(event));
assert(c.state().surge&&c.state().glint&&c.state().buttons&&c.state().vent>0);
assert(c.state().drops.length>=3&&c.state().drops.length<=6);
assert(initial.stock.every(s=>s.color!==s.cuff&&s.length<=12),'Socks have contrasting details and fit their slots');
assert.equal(c.state().stats.flickers,1);
c.step(3600);
const end=c.state();
assert.deepEqual(end.stock,initial.stock,'Stock remains displayed without customers or purchases');
assert(!('customer' in end)&&!('tray' in end)&&!('pending' in end));
assert(end.stats.flickers>1&&end.stats.cats>1&&end.stats.cars>1,'Ambient life continues');
assert.equal(end.stars.length,1100);assert.equal(end.stock.length,6);
assert(end.stats.meteors>5,'Occasional shooting stars arrive during long sessions');
if(end.meteor)assert(end.meteor.age<end.meteor.life);
const meteor=world().api;
assert(meteor.fire('meteor'));assert.equal(meteor.fire('meteor'),false);
assert.equal(meteor.state().stats.meteors,1);
const firstMeteor=meteor.state().meteor;
meteor.step(firstMeteor.life/2);assert(meteor.state().meteor.age>0);
meteor.step(firstMeteor.life/2+.01);assert.equal(meteor.state().meteor,null);
assert(end.drops.length<=6);
for(const effect of [end.surge,end.glint,end.buttons])if(effect)assert(effect.age<effect.life);
assert(end.drops.every(d=>d.life>0&&d.y<345));
const snapshot=c.state();snapshot.stock[0].color='#ffffff';
assert.notDeepEqual(copy(c.state()),copy(snapshot));
const clock=world().api;
assert.equal(clock.state().clock,'04:00:00');
clock.step(1);assert.equal(clock.state().clock,'04:00:01');
clock.step(58);assert.equal(clock.state().clock,'04:00:59');
clock.step(1);assert.equal(clock.state().clock,'04:00:00');
clock.step(60);assert.equal(clock.state().clock,'04:00:00');
assert(!scene.includes('Math.random'));assert(!scene.includes('N.People'));
console.log('One Sock: no customers or purchases, ambient events, seeded stars, render invariance, reduced motion, clock rollover and one-hour simulation passed.');
