/* Aurora: a low rise of thin snow above a small lake, looking up. Night City and far mountains sit along the horizon, and
   about seventy percent of the view is sky.
   This file holds the night itself, which both renderers share: the seeded choices, the simulation of the aurora, the
   real bright stars, and the painting of the city and the trees. gl.js is the renderer, in WebGL 2, and the bottom of this
   file is a simpler Canvas 2D one for when WebGL 2 or a shader fails, or with ?2d.

   An auroral curtain is a thin sheet of charge lying along the magnetic field, and it moves the way a vortex sheet moves
   in a flat fluid: it folds, rolls up into curls and spirals, and unwinds. So each curtain here is a chain of points
   carried by a flow, and the flow is made of seeded vortices that are born, travel and die on their own timers, on top of
   slow shear that wanders. Folding is chaotic, so the shapes never come round again. A substorm cycle sets the mood:
   quiet arcs, a slow build, a breakup that spreads across the sky, and a recovery of faint pulsing patches.
   No libraries, no image files. */
(()=>{
'use strict';
const NC=NightCity,{RM,LOWQ,DEBUG,R,rr,ri,pick,chance,expo,wpick,fbm,sfc32,cyrb128}=NC;
const QS=new URLSearchParams(location.search);
const DEG=Math.PI/180,TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
const sstep=(a,b,v)=>{const k=clamp((v-a)/(b-a),0,1);return k*k*(3-2*k);};
const ease=(dt,tau)=>1-Math.exp(-dt/tau);
// A private stream of the night's seed, so painting the land or the stars never changes what the aurora does.
function stream(tag){const r=sfc32(...cyrb128(NC.seed+'/'+tag));for(let i=0;i<16;i++)r();return r;}

/* ---------- the night ---------- */
const NEON=[[255,40,150],[40,220,255],[170,70,255],[255,110,50],[80,255,190]];
const neonA=pick(NEON),neonB=pick(NEON.filter(c=>c!==neonA));
const NIGHT={
  // Where on Earth, and where the camera faces: roughly south, so the stars rise on the left and set on the right.
  lat:rr(61,69)*DEG,heading:rr(-.4,.4),lst:rr(0,TAU),
  // The magnetic zenith, the point the rays all aim at. It sits just above the top of a wide view.
  poleAz:rr(-.2,.2),poleEl:rr(60,72)*DEG,
  // How strong tonight's storms run, and how much red they carry.
  storm:rr(.6,1),red:rr(.55,1.35),
  neonA,neonB,cityAz:rr(.08,.3)*(chance(.5)?1:-1),cityW:rr(.42,.62),
  // Some nights have a moon, from a thin crescent to nearly full. On the others the Milky Way has the sky to itself.
  moon:chance(.42)?rr(.08,.85):0,moonAz:rr(-1,1),moonEl:rr(8,34)*DEG,
  mwSeed:rr(0,100),
  // Where the open part of the sky starts tonight, and the noise it wanders on.
  gapA:rr(-.7,.7),gapO:rr(0,900),
};
{const c=Math.cos(NIGHT.poleEl),z=Math.sin(NIGHT.poleEl);NIGHT.B=[Math.sin(NIGHT.poleAz)*c/z,Math.cos(NIGHT.poleAz)*c/z];}

/* ---------- the sky's turning ---------- */
// The real rate, four times over, so the turning shows if you stay a while. Polaris is behind the camera.
const SIDEREAL=7.2921e-5*4;
// Equatorial directions to the camera's world, x right, y ahead, z up. Column-major, ready for a mat3 uniform.
function skyMatrix(lst){
  const sl=Math.sin(NIGHT.lat),cl=Math.cos(NIGHT.lat),sh=Math.sin(NIGHT.heading),ch=Math.cos(NIGHT.heading),c=Math.cos(lst),s=Math.sin(lst),m=[];
  for(const e of[[1,0,0],[0,1,0],[0,0,1]]){
    const x=c*e[0]+s*e[1],y=-s*e[0]+c*e[1],z=e[2];
    // East is y here, and the meridian x. West is the camera's right and south is ahead.
    const E=y,Nn=-sl*x+cl*z,Up=cl*x+sl*z,X=-E,Y=-Nn;
    m.push(X*ch-Y*sh,X*sh+Y*ch,Up);}
  return m;}

// The bright stars as they really are: right ascension in hours, declination in degrees, magnitude and colour index.
const STARS=[[6.752,-16.72,-1.46,0],[14.261,19.18,-.05,1.23],[18.616,38.78,.03,0],[5.278,46,.08,.8],[5.242,-8.2,.13,-.03],[7.655,5.22,.34,.42],[5.919,7.41,.5,1.85],[19.846,8.87,.77,.22],[4.599,16.51,.85,1.54],[16.49,-26.43,1,1.83],[13.42,-11.16,1.04,-.23],[7.755,28.03,1.14,1],[22.96,-29.62,1.16,.09],[20.69,45.28,1.25,.09],[10.139,11.97,1.35,-.09],[7.577,31.89,1.58,.03],[5.419,6.35,1.64,-.22],[5.438,28.61,1.65,-.13],[5.604,-1.2,1.69,-.18],[5.679,-1.94,1.77,-.2],[5.533,-.3,2.23,-.2],[5.796,-9.67,2.06,-.17],[12.9,55.96,1.77,-.02],[11.062,61.75,1.79,1.07],[11.031,56.38,2.37,.03],[11.897,53.69,2.44,0],[12.257,57.03,3.31,.08],[13.399,54.93,2.27,.02],[13.792,49.31,1.86,-.19],[2.53,89.26,1.98,.6],[14.845,74.16,2.08,1.47],[.675,56.54,2.24,1.17],[.153,59.15,2.28,.34],[.945,60.72,2.47,-.15],[1.43,60.24,2.68,.13],[1.907,63.67,3.35,-.15],[3.405,49.86,1.79,.48],[3.136,40.96,2.12,-.05],[.14,29.09,2.06,-.11],[1.162,35.62,2.06,1.58],[2.065,42.33,2.1,1.37],[2.12,23.46,2,1.15],[3.038,4.09,2.54,1.64],[.727,-17.99,2.04,1.02],[23.063,28.08,2.42,1.67],[23.079,15.2,2.49,0],[.221,15.18,2.83,-.23],[21.736,9.87,2.38,1.52],[20.37,40.26,2.23,.67],[19.512,27.96,3.08,1.09],[20.77,33.97,2.48,1.03],[17.582,12.56,2.07,.15],[15.578,26.71,2.22,-.02],[11.818,14.57,2.14,.09],[10.333,19.84,2.01,1.13],[6.629,16.4,1.93,0],[6.378,-17.96,1.98,-.24],[6.977,-28.97,1.5,-.2],[7.14,-26.39,1.84,.67],[7.402,-29.3,2.45,-.08],[9.46,-8.66,1.98,1.44],[18.921,-26.3,2.05,-.13],[18.403,-34.38,1.85,-.03],[17.56,-37.1,1.62,-.22],[17.943,51.49,2.24,1.52],[17.507,52.3,2.79,.98],[16.503,21.49,2.77,.95],[3.791,24.11,2.87,-.09],[3.82,24.05,3.63,-.07],[3.748,24.11,3.7,-.11],[3.763,24.37,3.87,-.07],[3.772,23.95,4.18,-.06],[3.753,24.47,4.3,-.11],[3.82,24.14,5.05,-.08],[4.478,15.87,3.4,.18],[4.33,15.63,3.65,.99],[4.382,17.54,3.76,.98],[4.477,19.18,3.53,1.01],[5.992,44.95,1.9,.03],[5.995,37.21,2.62,-.08],[4.95,33.17,2.69,1.53],[5.033,43.82,3.03,.54],[5.041,41.08,3.75,-.15],[5.109,41.23,3.18,-.18],[5.585,9.93,3.39,-.16],[5.59,-5.91,2.77,-.24],[5.408,-2.4,3.36,-.17],[6.383,22.51,2.87,1.6],[6.248,22.51,3.31,1.62],[6.732,25.13,3.06,1.4],[7.335,21.98,3.53,.37],[7.453,8.29,2.89,-.1],[21.31,62.59,2.45,.26],[23.656,77.63,3.21,1.03],[21.477,70.56,3.23,-.2],[13.036,10.96,2.83,.94],[12.694,-1.45,2.74,.36],[12.934,38.32,2.89,-.12],[13.911,18.4,2.68,.58],[14.75,27.07,2.35,.97],[11.235,20.52,2.56,.13],[11.237,15.43,3.33,0],[12.263,-17.54,2.59,-.11],[12.573,-23.4,2.65,.89],[12.497,-16.52,2.95,-.05],[22.096,-.32,2.96,.97],[21.526,-5.57,2.87,.83]];
// A star's colour from its colour index, through its temperature.
function starColor(bv){const t=4600*(1/(.92*bv+1.7)+1/(.92*bv+.62)),k=t/100;
  const r=k<=66?255:329.7*Math.pow(k-60,-.1332),g=k<=66?99.47*Math.log(k)-161.1:288.1*Math.pow(k-60,-.0755),b=k>=66?255:k<=19?0:138.5*Math.log(k-10)-305;
  return[r,g,b].map(v=>Math.pow(clamp(v,0,255)/255,2.2));}

/* ---------- the aurora ---------- */
// Everything happens on one flat map of the night's magnetic field lines, in kilometres, with the viewer at the origin
// looking toward +y. Each field line is one point on this map, so a curtain is a line on it.
const TIME=1.5,REACH=2800;
const sim={t:0,phase:'quiet',until:0,act:.3,actTo:.34,hard:.05,rays:.7,flame:0,lst:NIGHT.lst,gapX:0,gapY:1,gapD:.3};
const stats={storms:0,curtains:0,coronas:0,meteors:0,satellites:0};
const arcs=[],vortices=[];
let arcId=0;
// Slow shear across the whole map. Each wave's strength wanders, so together they never settle into a pattern.
const FLOW=[];for(let i=0;i<6;i++){const a=rr(0,TAU),l=rr(160,1100);FLOW.push({kx:Math.cos(a)*TAU/l,ky:Math.sin(a)*TAU/l,dx:-Math.sin(a),dy:Math.cos(a),w:rr(.01,.05)*(chance(.5)?1:-1),p:rr(0,TAU),o:rr(0,900),s:rr(.5,1.5),a:0});}
const refY=(a,x)=>a.y0+a.tilt*x+a.bow*x*x;
// The aurora takes part of the sky and leaves the rest to the stars. The boundary is a line across the frame that wanders
// round the top and the sides, never the bottom, so there is always something low enough for the lake to reflect.
// Curtains fade out as they near it, which reads as a curtain ending. VIEW is the renderer's frame.
const VIEW={tanH:1.39,tanV:.78,cp:.955,sp:.297};
function shown(x,y){
  // Where a point halfway up a curtain falls in the sky part of the frame, as -1 to 1 each way.
  const V=VIEW,z=Math.max(y*V.cp+150*V.sp,30),u=clamp(x/z/V.tanH,-2.5,2.5),v=clamp(((150*V.cp-y*V.sp)/z/V.tanV-.3)/.65,-2.5,2.5);
  const s=u*sim.gapX+v*sim.gapY,w=fbm((v*sim.gapX-u*sim.gapY)*1.2+sim.t*.012+NIGHT.gapO+9)-.5;
  return 1-sstep(sim.gapD-.36,sim.gapD+.36,s+w*.8);}
// A place in this range that isn't in the open sky.
function place(lo,hi){let y=rr(lo,hi),b=shown(0,y);for(let i=0;i<5&&b<.6;i++){const c=rr(lo,hi),o=shown(0,c);if(o>b){y=c;b=o;}}return y;}
// How far apart the points along a curtain sit: close together overhead, wider toward the horizon.
const spacing=r=>clamp(.028*r,2.5,48);
function newArc(o={}){
  const y0=o.y0??place(130,760),a={id:++arcId,x:[],y:[],m:[],n:0,y0,tilt:o.tilt??rr(-.16,.16),bow:o.bow??rr(-.6,.35)/1000,
    // Sheets are a few kilometres across. Some are broad and soft, and the veil is the faint glow around each one.
    sig:o.sig??(chance(.3)?rr(6,13):rr(2.6,6)),veil:rr(.1,.2),veilSig:rr(22,70),
    flux:0,fluxTo:o.flux??rr(.45,1),hard:o.hard??rr(0,.16),soft:o.soft??rr(.14,.4),vy:o.vy??rr(-.5,.5),
    relax:rr(50,130),life:o.life??(rr(35,60)+expo(120)),age:0,dying:false,
    // Ripples along the sheet: a few waves of their own, each drawn from continuous ranges.
    rip:[0,1,2,3].map(()=>({k:TAU/rr(45,420),w:rr(.12,.8)*(chance(.5)?1:-1),p:rr(0,TAU),a:rr(.5,2.4),o:rr(0,900)})),
    // Rays: their spacing and how they run along the sheet.
    ray:{f:rr(.6,1.1),amp:rr(.6,.9),v1:rr(-3,3),v2:rr(-9,9),d1:rr(0,900),d2:rr(0,900),p:rr(0,900),rate:rr(.14,.5),o:rr(0,900)},
    env:rr(0,900),sense:chance(.75)?1:-1,mid:0,half:REACH};
  let x=-REACH,m=0;
  while(x<REACH){const y=refY(a,x),r=Math.hypot(x,y),d=spacing(r);a.x.push(x);a.y.push(y);a.m.push(m);x+=d;m+=d;}
  a.n=a.x.length;a.mid=m/2;a.half=m/2;arcs.push(a);stats.curtains++;return a;}
function patch(o={}){
  // A soft patch of the kind left behind after a storm: short, wide and blinking on its own slow period.
  const y=o.y??rr(130,520),x=o.x??rr(-.9,.9)*(y+160),L=o.L??rr(30,130),a=newArc({y0:y,tilt:rr(-.4,.4),bow:0,sig:o.sig??rr(9,24),flux:o.flux??rr(.14,.36),hard:0,soft:o.soft??rr(.05,.25),life:o.life??rr(22,70),vy:rr(-.3,.3)});
  stats.curtains--;a.x.length=a.y.length=a.m.length=0;
  const n=12;for(let i=0;i<n;i++){const k=i/(n-1)*2-1;a.x.push(x+k*L);a.y.push(y+a.tilt*k*L);a.m.push((k+1)*L);}
  a.n=n;a.mid=L;a.half=L;a.patch={per:rr(3,14),ph:rr(0,TAU),o:rr(0,900)};a.veil=0;a.ray.amp=.55;return a;}
function vortex(a,o={}){
  // A swirl in the flow, shielded so it turns the sheet near it and leaves the rest alone.
  a=a||visibleArc();if(!a)return null;
  const i=o.i??visibleNode(a),hot=.5+sim.act;
  const v={x:a.x[i],y:a.y[i],vx:o.vx??rr(-1.2,1.2),vy:o.vy??rr(-.5,.5),d:o.d??rr(18,110),O:(o.O??rr(.03,.11))*hot*a.sense*(chance(.82)?1:-1),t0:sim.t,rise:o.rise??rr(5,18),hold:o.hold??rr(4,28),fall:o.fall??rr(10,34),g:0};
  vortices.push(v);return v;}
function visibleArc(){const v=arcs.filter(a=>!a.patch&&!a.dying&&a.flux>.05);return v.length?pick(v):null;}
function inView(x,y){return Math.abs(x)<(y+180)*1.5&&y>-120&&y<1300;}
function visibleNode(a){for(let k=0;k<24;k++){const i=ri(1,a.n-2);if(inView(a.x[i],a.y[i]))return i;}return a.n>>1;}
// A train of small curls of one sense, running along a sheet the way waves on it roll up.
function train(a){a=a||visibleArc();if(!a)return;const c=ri(4,10),d=rr(11,26),v=rr(-4.5,4.5),O=rr(.14,.34);let i=visibleNode(a);
  for(let k=0;k<c&&i<a.n-1;k++){vortex(a,{i,d,O,vx:v,vy:rr(-.15,.15),rise:rr(2,6),hold:rr(2,9),fall:rr(4,12)});let s=0;const gap=d*rr(3,5);while(s<gap&&i<a.n-2){s+=Math.hypot(a.x[i+1]-a.x[i],a.y[i+1]-a.y[i]);i++;}}}
// A great fold that sweeps along a curtain, carrying a brightening with it.
function surge(a){a=a||visibleArc();if(!a)return;const dir=chance(.7)?1:-1,sp=rr(3,9);
  const i=visibleNode(a);vortex(a,{i,d:rr(110,240),O:rr(.05,.11),vx:dir*sp,vy:rr(-1,1),rise:rr(5,10),hold:rr(10,24),fall:rr(14,28)});
  a.pulses=a.pulses||[];a.pulses.push({c:a.m[i],v:dir*sp*rr(.8,1.3),w:rr(120,340),a:rr(.8,2.2),t0:sim.t,life:rr(16,36)});}
function say(...t){NC.log(pick(t));}

const SCHED={curl:{m:7,f:2},train:{m:22,f:6},arc:{m:34,f:10},pulse:{m:16,f:5},flame:{m:30,f:20},meteor:{m:55,f:18},satellite:{m:110,f:30},plane:{m:170,f:40},car:{m:20,f:4},cloud:{m:260,f:60},patch:{m:3,f:1}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
const lights=[];let cloudTo=rr(0,.3),cloud=cloudTo;
function fire(k){
  if(k==='curl')vortex();
  else if(k==='train')train();
  else if(k==='surge'){surge();say('A great fold sweeps along the curtain, brightening as it goes','A surge runs down the arc, rolling it up behind it');}
  else if(k==='pulse'){const a=visibleArc();if(a){a.pulses=a.pulses||[];const i=visibleNode(a);a.pulses.push({c:a.m[i],v:rr(-60,60),w:rr(40,160),a:rr(.4,1.3),t0:sim.t,life:rr(5,14)});}}
  else if(k==='flame')sim.flame=1;
  else if(k==='arc'){const c=arcs.filter(a=>!a.patch&&!a.dying).length;if(c<2+Math.round(sim.act*2.6))newArc({y0:sim.phase==='expansion'?place(90,420):place(130,760)});}
  else if(k==='split'){const a=visibleArc();if(a){const b=newArc({y0:a.y0+rr(30,110)*(chance(.5)?1:-1),tilt:a.tilt+rr(-.04,.04),bow:a.bow,flux:a.fluxTo*rr(.5,1),vy:a.vy});say('The curtain splits, and a second one draws away from it','A new band peels off the arc beside it');return b;}}
  else if(k==='corona'){const life=rr(25,55),a=newArc({y0:rr(-14,20),tilt:rr(-.5,.5),bow:rr(-.3,.3)/1000,sig:rr(1,2.6),flux:rr(1,1.5),soft:rr(.3,.5),hard:rr(.1,.3),life,vy:rr(-.4,.4)});a.ray.amp=.9;a.free=true;for(let i=0;i<4;i++)vortex(a,{d:rr(40,120),O:rr(.08,.18),rise:rr(3,7)});
    // Sheets that pass close by leave the point itself dark, so a soft patch sits right on it, as the rays run together there.
    const c=patch({x:rr(-10,10),y:rr(-10,10),L:rr(14,30),sig:rr(9,18),flux:rr(.22,.4),soft:rr(.3,.5),life});c.patch.per=rr(9,16);c.free=true;
    stats.coronas++;say('A corona opens above: rays stream outward from one point high in the sky','The curtains pass overhead and fan out from a single point');}
  else if(k==='meteor'){const a=rr(-1,1),b=rr(.1,.8),h=rr(0,TAU),L=rr(.08,.34);stats.meteors++;
    lights.push({kind:'meteor',t0:sim.t,life:rr(.35,1.1),az:a,el:b,dx:Math.cos(h)*L,dy:-Math.abs(Math.sin(h))*L,b:Math.pow(10,rr(-.3,.7)),c:chance(.7)?[.8,1,.86]:[1,.86,.7]});
    if(chance(.5))say('A meteor scratches across the sky','A meteor burns out in a second');}
  else if(k==='satellite'){const dir=chance(.5)?1:-1;stats.satellites++;
    lights.push({kind:'sat',t0:sim.t,life:rr(40,90),az:-dir*1.2,el:rr(.25,.8),v:dir*rr(.02,.05),d:rr(-.002,.002),b:rr(.03,.3)});
    say('A satellite slides across the stars','A satellite crosses without a sound, then fades into the Earth\'s shadow');}
  else if(k==='plane'){const dir=chance(.5)?1:-1;lights.push({kind:'plane',t0:sim.t,life:rr(70,130),az:-dir*1.25,el:rr(.05,.22),v:dir*rr(.018,.032),d:rr(-.0006,.0006),ph:rr(0,1)});
    say('A plane climbs out of the city, its strobes blinking','A plane crosses far off, heading away from the city');}
  else if(k==='car'){const dir=chance(.5)?1:-1,az=NIGHT.cityAz+rr(-.5,.5)*NIGHT.cityW;lights.push({kind:'car',t0:sim.t,life:rr(14,34),az,el:rr(.018,.075),v:dir*rr(.004,.012),c:chance(.6)?[1,.86,.62]:NIGHT.neonB.map(v=>v/255)});}
  else if(k==='cloud'){cloudTo=wpick([[rr(0,.15),4],[rr(.3,.55),3],[rr(.6,.85),1]]);if(cloudTo>.5)say('High cloud drifts in and softens the stars','A veil of cloud slides over the sky, glowing faintly');}
}
function setPhase(p,log=true){
  sim.phase=p;const S=NIGHT.storm;
  if(p==='quiet'){sim.until=sim.t+15+expo(40);sim.actTo=rr(.26,.42);}
  else if(p==='growth'){sim.until=sim.t+20+expo(30);sim.actTo=rr(.45,.62);for(const a of arcs)if(!a.patch)a.vy=rr(-1.4,-.3);if(log)say('The arc brightens and creeps across the sky','The bands begin to stir');}
  else if(p==='expansion'){sim.until=sim.t+24+expo(32);sim.actTo=lerp(.75,1.15,S)*rr(.85,1.1);stats.storms++;for(const a of arcs)if(!a.patch){a.vy=rr(-3.4,-.8);a.life=Math.max(a.life,a.age+40);}
    if(log)say('The sky breaks up: curtains race out and rays flare overhead','Breakup: the arc erupts, and light floods across the sky');
    for(let i=0,c=ri(1,2);i<c;i++)fire('split');for(let i=0,c=ri(1,3);i<c;i++)fire('surge');for(let i=0,c=ri(1,3);i<c;i++)train();
    if(chance(.45+.4*S))later.push({k:'corona',t:sim.t+rr(6,18)});}
  else{sim.until=sim.t+30+expo(55);sim.actTo=rr(.2,.34);for(const a of arcs)if(!a.patch&&a.age>20)a.vy=rr(.1,1.2);if(log)say('The storm eases, leaving soft patches that pulse in the dark','The curtains dissolve into slow, breathing patches');}
}
// Things a phase sets going for a little later.
const later=[];
function nextPhase(){setPhase({quiet:chance(.7)?'growth':'quiet',growth:'expansion',expansion:'recovery',recovery:chance(.65)?'quiet':'growth'}[sim.phase]);}

// Puts points where a stretched curtain has come apart, and takes out those that have bunched up.
function remesh(a){
  const X=[a.x[0]],Y=[a.y[0]],M=[a.m[0]];
  for(let i=1;i<a.n;i++){
    const x0=X[X.length-1],y0=Y[Y.length-1],x=a.x[i],y=a.y[i],L=Math.hypot(x-x0,y-y0),d=spacing(Math.hypot(x,y));
    if(L<d*.4&&i<a.n-1)continue;
    // Tight curves keep more points than straight runs.
    let bend=0;if(i<a.n-1){const ax=x-x0,ay=y-y0,bx=a.x[i+1]-x,by=a.y[i+1]-y;bend=Math.abs(Math.atan2(ax*by-ay*bx,ax*bx+ay*by));}
    // A tight spiral could ask for points without end, so a curtain stops adding them past a limit.
    const c=a.n>2200?0:Math.min(6,Math.floor(Math.max(L/(d*1.5),bend>.35&&L>1.2?2:0)));
    for(let k=1;k<c;k++){const f=k/c,i0=Math.max(0,i-2),i1=i-1,i2=i,i3=Math.min(a.n-1,i+1);
      // Catmull-Rom, so new points fall on the curve and not across its corners.
      const cr=(p0,p1,p2,p3)=>.5*(2*p1+(p2-p0)*f+(2*p0-5*p1+4*p2-p3)*f*f+(3*p1-p0-3*p2+p3)*f*f*f);
      X.push(cr(a.x[i0],a.x[i1],a.x[i2],a.x[i3]));Y.push(cr(a.y[i0],a.y[i1],a.y[i2],a.y[i3]));M.push(lerp(a.m[i1],a.m[i2],f));}
    X.push(x);Y.push(y);M.push(a.m[i]);}
  a.x=X;a.y=Y;a.m=M;a.n=X.length;}
function advect(a,dt){
  const n=a.n,X=a.x,Y=a.y,t=sim.t,k=ease(dt,a.relax),act=sim.act,hot=.45+act*1.1;
  for(const r of a.rip)r.g=r.a*hot*(fbm(t*.03+r.o)*2-.3);
  for(let i=0;i<n;i++){
    const x=X[i],y=Y[i];let vx=0,vy=a.vy;
    for(const f of FLOW){const c=Math.cos(f.kx*x+f.ky*y-f.w*t+f.p)*f.a;vx+=c*f.dx;vy+=c*f.dy;}
    for(const v of vortices){const dx=x-v.x,dy=y-v.y,d2=dx*dx+dy*dy,s=v.d*v.d;if(d2>12*s)continue;const f=v.O*v.g*Math.exp(-d2/(2*s));vx-=dy*f;vy+=dx*f;}
    const i0=i?i-1:0,i1=i<n-1?i+1:i,tx=X[i1]-X[i0],ty=Y[i1]-Y[i0],L=Math.hypot(tx,ty)||1;let w=0;
    for(const r of a.rip)w+=r.g*Math.sin(r.k*a.m[i]-r.w*t+r.p);
    vx-=ty/L*w;vy+=tx/L*w;
    X[i]=x+vx*dt;Y[i]=y+vy*dt;
    if(!a.patch)Y[i]+=(refY(a,X[i])-Y[i])*k;}
  // A little tension, so small kinks relax while the large folds stay.
  const s=Math.min(.45,dt*.9);let px=X[0],py=Y[0];
  for(let i=1;i<n-1;i++){const cx=X[i],cy=Y[i];X[i]=cx+s*.5*(px+X[i+1]-2*cx);Y[i]=cy+s*.5*(py+Y[i+1]-2*cy);px=cx;py=cy;}
}
let meshT=0;
function update(dtReal){
  const dt=dtReal*TIME,t=sim.t+=dt;sim.lst+=dtReal*SIDEREAL;
  if(t>=sim.until)nextPhase();
  for(let i=later.length-1;i>=0;i--)if(t>=later[i].t){fire(later[i].k);later.splice(i,1);}
  const act=sim.act+=(sim.actTo-sim.act)*ease(dt,sim.phase==='expansion'?5:18);
  sim.hard+=((sim.phase==='expansion'?.34:.04)-sim.hard)*ease(dt,6);
  sim.rays+=((sim.phase==='expansion'?1:sim.phase==='recovery'?.45:.75)-sim.rays)*ease(dt,8);
  sim.flame=Math.max(0,sim.flame-dt/3);
  // The open sky drifts round over a few minutes, and a storm eats into it without ever closing it.
  const ga=clamp(NIGHT.gapA+4.6*(fbm(t*.0042+NIGHT.gapO)-.5),-1.8,1.8);sim.gapX=Math.sin(ga);sim.gapY=Math.cos(ga);sim.gapD=lerp(.24,.56,clamp(act,0,1.1));
  for(const k in SCHED){nextEv[k]-=dt*(k==='curl'||k==='train'?.45+act*1.5:1);if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);
    if(k==='patch'){if(sim.phase==='recovery'&&arcs.length<26)patch();}else if(k==='flame'){if(act>.55)fire(k);}else fire(k);}}
  if(chance(dt*.012*act)&&sim.phase==='expansion')fire('surge');
  cloud+=(cloudTo-cloud)*ease(dtReal,40);
  for(const f of FLOW)f.a=f.s*(.25+act*1.15)*(fbm(t*.017+f.o)*2-.55);
  for(let i=vortices.length-1;i>=0;i--){const v=vortices[i],x=t-v.t0,e=v.rise+v.hold+v.fall;if(x>e){vortices.splice(i,1);continue;}
    v.g=x<v.rise?sstep(0,1,x/v.rise):x<v.rise+v.hold?1:1-sstep(0,1,(x-v.rise-v.hold)/v.fall);v.x+=v.vx*dt;v.y+=v.vy*dt;}
  meshT+=dt;const doMesh=meshT>.4;if(doMesh)meshT=0;
  for(let i=arcs.length-1;i>=0;i--){const a=arcs[i];a.age+=dt;
    // Curtains that drift off over the horizon are done, however much life they had left.
    if(a.age>a.life||(!a.patch&&a.y0>1050))a.dying=true;
    const to=a.dying?0:a.fluxTo*(.42+act*.68);a.flux+=(to-a.flux)*ease(dt,a.dying?16:a.patch?5:9);
    if(a.dying&&a.flux<.004){arcs.splice(i,1);continue;}
    a.y0+=a.vy*dt*.6;
    a.vy*=1-ease(dt,70);
    a.ray.p+=dt*a.ray.rate*(.6+act);
    a.ray.d1+=dt*a.ray.v1*(.5+act*1.6);a.ray.d2+=dt*a.ray.v2*(.5+act*1.6);
    a.ray.v1+=(fbm(t*.05+a.ray.o)-.5)*dt*2;a.ray.v2+=(fbm(t*.07+a.ray.o+50)-.5)*dt*5;a.ray.v1=clamp(a.ray.v1,-6,6);a.ray.v2=clamp(a.ray.v2,-16,16);
    if(a.pulses)for(let j=a.pulses.length-1;j>=0;j--){const p=a.pulses[j];p.c+=p.v*dt;if(t-p.t0>p.life)a.pulses.splice(j,1);}
    advect(a,dt);
    if(doMesh&&!a.patch)remesh(a);}
  // At least one curtain is always somewhere in the sky.
  if(!arcs.some(a=>!a.patch&&!a.dying&&shown(0,a.y0)>.3))newArc({y0:place(160,620)});
  // And one sits low enough for the lake, which only sees the lower part of the sky.
  if(!arcs.some(a=>!a.patch&&!a.dying&&a.y0>400))newArc({y0:rr(440,720),flux:rr(.7,1)});
  for(let i=lights.length-1;i>=0;i--){const l=lights[i],x=t-l.t0;if(x>l.life){lights.splice(i,1);continue;}if(l.v){l.az+=l.v*dtReal;if(l.d)l.el+=l.d*dtReal;}}
}
// How bright a curtain burns at one point along it: its own patches, fading out toward its ends, plus anything running along it.
function glow(a,i){
  const m=a.m[i];let e=a.flux*(.28+.72*sstep(.26,.7,fbm(m/520+a.env+sim.t*.011)));
  e*=sstep(0,1,(a.half-Math.abs(m-a.mid))/(a.patch?a.half*.8:320));
  if(!a.free)e*=shown(a.x[i],a.y[i]);
  if(a.patch){const p=a.patch;e*=.25+.75*sstep(-.3,.6,Math.sin(sim.t*TAU/p.per+p.ph)+(fbm(sim.t*.2+p.o)-.5));}
  if(a.pulses)for(const p of a.pulses){const d=(m-p.c)/p.w,x=(sim.t-p.t0)/p.life;e*=1+p.a*Math.exp(-d*d)*Math.sin(Math.min(1,x)*Math.PI);}
  return e;}
// How deep the electrons reach at that point: hard ones light the low pink edge, soft ones the tall red tops.
function energy(a,i){const m=a.m[i],n=fbm(m/280+a.env+70+sim.t*.02)-.5,s=fbm(m/170+a.env+140+sim.t*.016)-.5;
  return[clamp(a.hard+sim.hard+n*.34,0,.75),clamp(a.soft+s*.7+sim.act*.1,.03,.85)];}

/* ---------- the land's outline ---------- */
// A strip of the view as angles, painted once at any screen size: az across, el up. The renderer maps it into the picture.
const SA=78*DEG,E0=-1.6*DEG,E1=11.6*DEG,PPD=LOWQ?20:48;
const strip={az:SA,e0:E0,e1:E1,w:Math.round(2*SA/DEG*PPD),h:Math.round((E1-E0)/DEG*PPD)};
const landR=stream('land');
const landNoise=(()=>{const t=new Float32Array(1024);for(let i=0;i<1024;i++)t[i]=landR();return x=>{const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);return lerp(t[i&1023],t[(i+1)&1023],u);};})();
const landO=[landR()*400,landR()*400,landR()*400];
// The nearest ridge line against the sky, in radians above the level horizon. It rises a little toward the edges of the view.
function crest(az){const x=az/DEG;return(.62+.9*(landNoise(x/34+landO[0])-.5)+.44*(landNoise(x/9+landO[1])-.5)+.1*(landNoise(x/2.2+landO[2])-.5)+Math.pow(Math.abs(az)/1.15,3)*1.3)*DEG;}
const azX=az=>(az+SA)/(2*SA)*strip.w,elY=el=>strip.h*(1-(el-E0)/(E1-E0));

/* ---------- the lake ---------- */
// A small lake in a dip below the viewer, in metres, early in the winter before it has frozen over. Its shore is a circle
// pushed in and out by a few waves, simple enough for this file and the renderer to work out the same edge.
const lakeR=stream('lake'),lr=(a,b)=>a+(b-a)*lakeR();
const LAKE={x:lr(-20,20),y:62,rx:lr(38,48),ry:38,rot:lr(-.14,.14),level:-7,shore:[2,3,5,8].map((k,i)=>[k,lr(.4,1)*[.1,.09,.05,.03][i],lr(0,TAU)])};
const shoreAt=a=>{let r=1;for(const[k,w,p]of LAKE.shore)r+=w*Math.sin(k*a+p);return r;};
// The near shore always sits the same way from the viewer, however the rest of it wanders, so the water never hides behind the bank.
{const k=shoreAt(-Math.PI/2);LAKE.rx/=k;LAKE.ry/=k;}
// 1 on the shore, less out on the water, more on the land.
function lakeF(x,y){const dx=x-LAKE.x,dy=y-LAKE.y,c=Math.cos(LAKE.rot),s=Math.sin(LAKE.rot),u=(dx*c+dy*s)/LAKE.rx,v=(dy*c-dx*s)/LAKE.ry;return Math.hypot(u,v)/shoreAt(Math.atan2(v,u));}
// The ground around it, roughly, for what stands on it.
const lakeZ=(x,y)=>{const f=lakeF(x,y),h=lerp(-1.55,LAKE.level-.7,1-sstep(.85,1.75,f));return lerp(h,Math.min(h,Math.max(-1.55-.31*(Math.hypot(x,y)-5),LAKE.level+.3)),1-sstep(1.6,2.4,f));};

function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')];}
const css=(c,a=1)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
const mix3=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
// Night City: blocks of towers in three depths, far ones lost in haze. Emission and silhouette, on a transparent strip.
const beacons=[];
function paintCity(){
  const r=stream('city'),rrr=(a,b)=>a+(b-a)*r(),[c,g]=canvas(strip.w,strip.h),W=strip.w,px=PPD;
  const cx=azX(NIGHT.cityAz),half=NIGHT.cityW/DEG*px,o1=r()*400,o2=rrr(-.55,.55),o3=rrr(.14,.3);
  // Tall in the middle, with a second cluster of its own, and thinning out toward the ends.
  const env=x=>{const u=(x-cx)/half,a=Math.exp(-u*u/.1),b=Math.exp(-(u-o2)*(u-o2)/(o3*o3));return clamp(Math.max(a,b*.8)*(.74+.54*landNoise(x/px/2.4+o1))+.38*(.6+.8*landNoise(x/px/5+o1+7)),0,1.25)*(1-sstep(.8,1.04,Math.abs(u)));};
  const WARM=[[255,206,140],[255,182,110],[255,226,180]],COOL=[[170,214,255],[130,190,255],[200,240,255]];
  const layers=[{hz:.86,wall:[8,9,17],wv:.3,span:1.04,h:[1.1,7.4],w:[.16,.56],gap:.62,seed:.5},{hz:.42,wall:[5,5,11],wv:.7,span:.96,h:[1,8.8],w:[.22,.7],gap:.72,seed:.9},{hz:.12,wall:[2,2,5],wv:1,span:.86,h:[.9,3.6],w:[.3,.9],gap:.82,seed:1}];
  const base=strip.h+2;
  for(const L of layers){
    let x=cx-half*L.span;
    while(x<cx+half*L.span){
      const e=env(x),w=rrr(L.w[0],L.w[1])*px,hd=(L.h[0]+(L.h[1]-L.h[0])*e*Math.pow(r(),1.2))*(.62+.5*e),h=hd*px;
      if(e>.03)tower(x,w,h,L,e);
      x+=w*rrr(L.gap*.75,L.gap*1.2);}}
  function tower(x,w,h,L,e){
    const lit=rrr(.18,.55)*(.5+L.wv*.5),warm=r()<.8?WARM:COOL,accent=r()<.5?NIGHT.neonA:NIGHT.neonB,style=r();
    let top=base,left=x,ww=w,left0=h;
    const sections=h>px*2?1+Math.floor(r()*3):1;
    for(let s=0;s<sections;s++){
      const hs=s===sections-1?left0:left0*rrr(.45,.72);left0-=hs;
      g.fillStyle=css(L.wall);g.fillRect(left,top-hs,ww,hs);
      // A lit edge, the way one face of a tower catches the city's glow.
      g.fillStyle=css(mix3(L.wall,[60,56,90],.14));g.fillRect(left,top-hs,Math.max(1,ww*.06),hs);
      windows(left,top-hs,ww,hs,lit,warm,L,style);
      if(r()<.3*L.wv&&ww>6){g.save();g.shadowColor=css(accent);g.shadowBlur=px*.22;g.fillStyle=css(accent,.95*L.wv+.1);g.fillRect(left,top-hs,ww,Math.max(1.2,px*.024));g.restore();}
      top-=hs;const nw=ww*rrr(.62,.9);left+=(ww-nw)*rrr(.2,.8);ww=nw;}
    // Vertical signs on some, in the night's neon, cut into blocks like characters.
    if(L.wv>.5&&r()<.34&&h>px*1.2&&w>px*.22){const sh=Math.min(h*.6,rrr(.6,2.2)*px),sx=x+w*rrr(.1,.8),sy=base-h*rrr(.25,.8),sw=Math.max(2,px*.06);
      g.save();g.shadowColor=css(accent);g.shadowBlur=px*.3;g.fillStyle=css(accent);for(let y=0;y<sh;y+=sw*2.3)if(r()<.86)g.fillRect(sx,sy+y,sw,sw*1.7);g.restore();}
    if(L.wv>.5&&r()<.14&&w>px*.3&&h>px*1.4){const bw=w*rrr(.5,.9),bh=bw*rrr(.4,.8),bx=x+(w-bw)*.5,by=base-h*rrr(.45,.86);const col=r()<.5?NIGHT.neonA:NIGHT.neonB;
      g.save();g.shadowColor=css(col);g.shadowBlur=px*.34;g.fillStyle=css(mix3(col,[255,255,255],.2),.9);g.fillRect(bx,by,bw,bh);g.restore();
      g.fillStyle=css(L.wall,.7);for(let i=0,n=2+Math.floor(r()*3);i<n;i++)g.fillRect(bx+bw*r()*.8,by+bh*(.15+.7*r()),bw*rrr(.08,.3),Math.max(1,bh*.09));}
    // What stands on the roof: an antenna, a spire or a flat crown.
    const sx=left+ww/2;
    if(h>px*2.2){const k=r();g.fillStyle=css(L.wall);
      if(k<.38){const s=rrr(.3,1)*px;g.fillRect(sx-Math.max(.6,px*.012),top-s,Math.max(1.2,px*.024),s);top-=s;}
      else if(k<.62){const s=rrr(.3,.9)*px;g.beginPath();g.moveTo(left,top+.5);g.lineTo(sx,top-s);g.lineTo(left+ww,top+.5);g.fill();top-=s;}
      if(L.wv>.5)beacons.push({az:(sx/strip.w)*2*SA-SA,el:E0+(1-top/strip.h)*(E1-E0),per:rrr(16,38),ph:r()});}
  }
  function windows(x,y,w,h,lit,cols,L,style){
    const cw=Math.max(2,px*.062),ch=Math.max(2.4,px*.075),nx=Math.floor(w/cw),ny=Math.floor(h/ch);if(nx<1||ny<1)return;
    const dw=Math.max(1,cw*.56),dh=Math.max(1,ch*.54),a=L.wv*.9+.1,off=(w-nx*cw)/2,o=r()*400;
    for(let j=0;j<ny;j++){
      // Whole floors go dark together, and some towers light in bands or in columns.
      const fl=landNoise(j*.37+o);if(fl<.22)continue;
      for(let i=0;i<nx;i++){
        const p=lit*(style<.3?(j%3?.7:1.7):style<.5?(i%4?.8:1.6):1)*sstep(.1,.7,landNoise(i*.31+j*.17+o+9)+.25);
        if(r()>p)continue;
        const c=cols[Math.floor(r()*3)],b=rrr(.45,1)*a;
        g.fillStyle=css(c,b);g.fillRect(x+off+i*cw,y+j*ch,dw,dh);}}
  }
  return c;}

// Spruce on the ridge, close to black, each with a winter's load on its boughs.
function paintTrees(){
  const r=stream('trees'),rrr=(a,b)=>a+(b-a)*r(),[c,g]=canvas(strip.w,strip.h),px=PPD;
  function spruce(x,base,h,dark,snow){
    const rows=Math.max(5,Math.floor(h/Math.max(1.4,h*.035))),wid=h*rrr(.2,.3),lean=rrr(-.02,.02)*h;
    g.fillStyle=css(dark);g.fillRect(x-h*.012,base-h,Math.max(.8,h*.024),h);
    for(let i=0;i<rows;i++){
      const k=(i+.4)/rows,y=base-h*(1-k)+h*.03,len=wid*Math.pow(k,.82)*rrr(.68,1.08),droop=h*(.018+.05*k),tx=x+lean*(1-k);
      for(const s of[-1,1]){
        const l=len*rrr(.72,1.06);
        g.fillStyle=css(dark);g.beginPath();g.moveTo(tx,y-h*.022);g.lineTo(tx+s*l,y+droop);g.lineTo(tx+s*l*.5,y+droop*.5+h*.018);g.lineTo(tx,y+h*.03);g.fill();
        if(snow>0&&r()<.74){g.fillStyle=`rgba(222,232,240,${snow*rrr(.5,1)})`;g.beginPath();g.moveTo(tx+s*l*.14,y-h*.016);g.lineTo(tx+s*l*.96,y+droop*.92);g.lineTo(tx+s*l*.6,y+droop*.62);g.fill();}}}
  }
  // Stands of trees thicken and thin along the ridge, far ones first, so nearer ones stand in front.
  for(const L of[{d:.42,hmin:.5,hmax:.85,dark:[10,14,18],snow:.26,step:.09,lift:.05},{d:.62,hmin:.8,hmax:1.5,dark:[6,9,11],snow:.42,step:.13,lift:-.02}]){
    for(let az=-SA;az<SA;az+=L.step*DEG*rrr(.6,1.5)){
      const st=landNoise(az/DEG/7.5+landO[1]+L.d*40);if(st<1-L.d-.08)continue;
      spruce(azX(az),elY(crest(az)+L.lift*DEG),rrr(L.hmin,L.hmax)*px*(.7+.6*st),L.dark,L.snow);}}
  // A few close ones at the sides of the view, where they frame the sky and leave the city clear.
  for(let i=0,n=2+Math.floor(r()*3);i<n;i++){
    const side=r()<.5?-1:1,az=side*rrr(.5,1.2);
    if(Math.abs(az-NIGHT.cityAz)<NIGHT.cityW*.6)continue;
    spruce(azX(az),elY(crest(az)-.5*DEG),rrr(3,6.6)*px,[4,6,8],.62);}
  return c;}

// Dry grass poking through the snow near the camera. Blades stand upright, which a height map can't do, so they are painted
// straight into the view for each screen size: placed on the ground, then sized by distance.
function paintGrass(W,H,tanH,tanV){
  const r=stream('grass'),rrr=(a,b)=>a+(b-a)*r(),[c,g]=canvas(W,H),p=Math.atan(.4*tanV),cp=Math.cos(p),sp=Math.sin(p),eye=1.55;
  const put=(x,y,z)=>{const f=y*cp+z*sp,u=-y*sp+z*cp;return f>.1?[(x/f/tanH*.5+.5)*W,(.5-u/f/tanV*.5)*H,f]:null;};
  const tufts=[];
  for(let i=0,n=LOWQ?900:3000;i<n;i++){
    // Tufts gather in clumps, thinning with distance. Far ones are too small to bother with.
    const y=2.4+Math.pow(r(),2.3)*60,x=(r()*2-1)*(y*1.7+2);
    if(lakeF(x,y)<1.12||landNoise(x*.085+landO[0]+y*.06)*landNoise(y*.11+x*.04+landO[1])<.16+r()*.2)continue;
    tufts.push([x,y]);}
  // Sedge along the water's edge, thicker in some stretches than others.
  for(let i=0,n=LOWQ?260:700;i<n;i++){
    const a=r()*TAU,k=shoreAt(a)*(1.05+Math.pow(r(),2)*.2),u=Math.cos(a)*k*LAKE.rx,v=Math.sin(a)*k*LAKE.ry,c=Math.cos(LAKE.rot),s=Math.sin(LAKE.rot),x=LAKE.x+u*c-v*s,y=LAKE.y+u*s+v*c;
    if(y>2.4&&landNoise(a*2.6+landO[2])>.42)tufts.push([x,y]);}
  tufts.sort((a,b)=>b[1]-a[1]);
  g.lineCap='round';
  for(const[x,y]of tufts){
    const b=put(x,y,lakeZ(x,y)+rrr(-.01,.03));if(!b)continue;
    const s=H/tanV*.5/b[2],hgt=rrr(.09,.3),blades=Math.floor(rrr(10,44)*clamp(s/70,.35,1.2)),lean=rrr(-.5,.5),w=rrr(.04,.16);
    for(let i=0;i<blades;i++){
      const ox=(r()+r()-1)*w*s,len=hgt*s*rrr(.45,1.05),bend=(lean+rrr(-.55,.55))*len*.62,tone=r();
      const c0=rrr(.17,.34)+tone*.13;g.strokeStyle=`rgba(${(c0*255)|0},${(c0*226)|0},${(c0*160)|0},${rrr(.55,.95)})`;g.lineWidth=Math.max(.5,s*rrr(.0022,.005));
      const x0=b[0]+ox,y0=b[1]+rrr(-.5,.5)*w*s*.22;g.beginPath();g.moveTo(x0,y0);g.quadraticCurveTo(x0+bend*.18,y0-len*.68,x0+bend,y0-len*rrr(.82,1));g.stroke();}}
  return c;}

/* ---------- share with the renderers ---------- */
const A=window.AURORA={NC,NIGHT,VIEW,LAKE,sim,stats,arcs,vortices,lights,STARS,starColor,skyMatrix,stream,update,fire,glow,energy,strip,crest,paintCity,paintTrees,paintGrass,beacons,TIME,
  cloud:()=>cloud,setCloud:v=>{cloud=cloudTo=v;},clamp,lerp,sstep,ease,DEG,TAU,fallback};
// The arcs a night starts with, already moving, so the first frame is already a sky in motion.
function warm(){
  setPhase(wpick([['quiet',3],['growth',4]]),false);sim.until=sim.t+rr(8,40);
  newArc({y0:rr(170,420),flux:rr(.7,1)});if(chance(.7))newArc({y0:rr(280,700)});
  for(let i=0;i<40*10;i++)update(.1/TIME);
  for(const k in stats)stats[k]=0;NC.entries.length=0;
  NC.log(NIGHT.moon?(NIGHT.moon>.5?'A bright moon tonight, and the aurora is already out':'A thin moon tonight, and the aurora is already out'):'No moon tonight, and the aurora is already out');
}
warm();

/* ---------- start ---------- */
// The Canvas 2D version: the same aurora, drawn as soft wide strokes of light up each curtain.
function fallback(){
  const old=document.getElementById('scene');let cv=old;
  // A canvas that has had a WebGL context can't take a 2D one.
  if(A.triedGL){cv=old.cloneNode();old.replaceWith(cv);cv.addEventListener('click',()=>{const h=document.getElementById('hud');if(h)h.classList.toggle('off');});}
  const g=cv.getContext('2d',{alpha:false});let W=0,H=0,hor=0,sky=null,land=null,water=null;
  const city=paintCity(),trees=paintTrees(),S=stream('stars2d');
  const dots=[];for(const s of STARS)dots.push(s);for(let i=0;i<650;i++)dots.push([S()*24,Math.asin(S()*2-1)/DEG,3.6+S()*2.4,S()*1.4]);
  function cam(){const a=W/H,tanV=clamp(1.04/Math.sqrt(a),.62,1.2),p=Math.atan(.4*tanV),C={tanV,tanH:tanV*a,cp:Math.cos(p),sp:Math.sin(p)};Object.assign(VIEW,C);return C;}
  // World direction to the screen, or null when it is behind the camera.
  function proj(C,x,y,z){const f=y*C.cp+z*C.sp,u=-y*C.sp+z*C.cp;if(f<=.02)return null;return[(x/f/C.tanH*.5+.5)*W,(.5-u/f/C.tanV*.5)*H];}
  function layout(){
    const dpr=Math.min(1.5,devicePixelRatio||1)*(LOWQ?.6:1);W=cv.width=Math.round(innerWidth*dpr);H=cv.height=Math.round(innerHeight*dpr);
    const C=cam();hor=H*.7;
    sky=document.createElement('canvas');sky.width=W;sky.height=H;let q=sky.getContext('2d');
    const gr=q.createLinearGradient(0,0,0,hor);gr.addColorStop(0,'#03050c');gr.addColorStop(.7,'#070b18');gr.addColorStop(1,'#141430');q.fillStyle=gr;q.fillRect(0,0,W,H);
    const gl2=q.createRadialGradient(W*(.5+NIGHT.cityAz*.5),hor,0,W*(.5+NIGHT.cityAz*.5),hor,W*.5);gl2.addColorStop(0,css(NIGHT.neonA,.22));gl2.addColorStop(1,css(NIGHT.neonA,0));q.fillStyle=gl2;q.fillRect(0,0,W,hor);
    // The strips are in angles, so they are drawn in columns, each at its place in the picture.
    land=document.createElement('canvas');land.width=W;land.height=H;q=land.getContext('2d');
    const step=Math.max(2,W/500|0);
    for(let x=0;x<W;x+=step){const az=Math.atan(((x+.5)/W*2-1)*C.tanH/C.cp),sx=azX(az),y0=H*(.5-(Math.tan(E1)*C.cp-C.sp)/(C.cp+Math.tan(E1)*C.sp)/C.tanV*.5),y1=H*(.5-(Math.tan(E0)*C.cp-C.sp)/(C.cp+Math.tan(E0)*C.sp)/C.tanV*.5);
      q.drawImage(city,sx,0,Math.max(1,strip.w/W*step),strip.h,x,y0,step,y1-y0);q.drawImage(trees,sx,0,Math.max(1,strip.w/W*step),strip.h,x,y0,step,y1-y0);}
    q.globalCompositeOperation='source-over';const sn=q.createLinearGradient(0,hor,0,H);sn.addColorStop(0,'#1b2230');sn.addColorStop(1,'#0c1018');q.fillStyle=sn;
    q.beginPath();q.moveTo(0,H);for(let x=0;x<=W;x+=8){const az=Math.atan(((x+.5)/W*2-1)*C.tanH/C.cp);q.lineTo(x,hor-crest(az)/DEG*H*.0125);}q.lineTo(W,H);q.fill();
    // The lake's shore, in the picture.
    water=new Path2D();const c=Math.cos(LAKE.rot),s=Math.sin(LAKE.rot);
    for(let i=0;i<=72;i++){const a=i/72*TAU,k=shoreAt(a),u=Math.cos(a)*k*LAKE.rx,v=Math.sin(a)*k*LAKE.ry,p=proj(C,LAKE.x+u*c-v*s,LAKE.y+u*s+v*c,LAKE.level);if(p)water.lineTo(p[0],p[1]);}
    water.closePath();}
  function draw(){
    const C=cam();g.globalCompositeOperation='source-over';g.drawImage(sky,0,0);
    const M=skyMatrix(sim.lst);g.fillStyle='#dfe8ff';
    for(const s of dots){const ra=s[0]*15*DEG,de=s[1]*DEG,cx=Math.cos(de)*Math.cos(ra),cy=Math.cos(de)*Math.sin(ra),cz=Math.sin(de);
      const x=M[0]*cx+M[3]*cy+M[6]*cz,y=M[1]*cx+M[4]*cy+M[7]*cz,z=M[2]*cx+M[5]*cy+M[8]*cz;if(z<0)continue;const p=proj(C,x,y,z);if(!p||p[1]>H*.7)continue;
      g.globalAlpha=clamp(.9-s[2]*.13,.1,1);const w=s[2]<2?2:1;g.fillRect(p[0],p[1],w,w);}
    g.globalAlpha=1;g.globalCompositeOperation='lighter';g.lineCap='round';
    const B=NIGHT.B,lw=Math.max(1,W/1300);
    for(const a of arcs){const st=Math.max(1,Math.floor(a.n/420));
      for(let i=0;i<a.n;i+=st){const e=glow(a,i);if(e<.01)continue;const x=a.x[i],y=a.y[i];
        const[hd,sf]=energy(a,i),rayK=.7+.8*fbm(a.m[i]/90+a.ray.d1*.02),e2=e*rayK;
        // A stroke up the field line, from the lower edge to the top of the ray.
        const hi=150+sf*240,lo=100+(1-hd)*10,p0=proj(C,x+B[0]*lo,y+B[1]*lo,lo),p1=proj(C,x+B[0]*hi,y+B[1]*hi,hi);if(!p0||!p1)continue;
        const gr=g.createLinearGradient(p0[0],p0[1],p1[0],p1[1]),k=clamp(e2*.1,0,.2);
        gr.addColorStop(0,`rgba(${hd*255|0},${90+hd*30|0},${90+hd*60|0},${k*.4})`);gr.addColorStop(.1,`rgba(70,255,150,${k})`);gr.addColorStop(.6,`rgba(60,220,140,${k*.34})`);gr.addColorStop(1,`rgba(170,40,110,${k*.16*NIGHT.red})`);
        g.strokeStyle=gr;g.lineWidth=lw*(9+e*12);g.beginPath();g.moveTo(p0[0],p0[1]);g.lineTo(p1[0],p1[1]);g.stroke();}}
    g.globalCompositeOperation='source-over';g.drawImage(land,0,0);
    // The lake holds the whole sky, turned over at the horizon.
    g.save();g.clip(water);g.fillStyle='#05070d';g.fillRect(0,0,W,H);g.translate(0,2*hor);g.scale(1,-1);g.globalAlpha=.62;g.drawImage(cv,0,0);g.restore();
    // The snow takes on the sky's light.
    g.globalCompositeOperation='lighter';g.fillStyle=`rgba(40,120,80,${clamp(sim.act*.16,0,.2)})`;g.fillRect(0,H*.72,W,H*.28);g.globalCompositeOperation='source-over';}
  layout();
  if(DEBUG)window.AU={gl:false,sim,arcs,NIGHT,fire,step:update,draw,run(s){for(let i=0;i<s*20;i++)update(.05);draw();}};
  NC.run({step:.05,update,draw,ui:()=>NC.stats(stats)});
  let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{layout();draw();},200);});
}
if(QS.has('2d'))fallback();
else{A.triedGL=true;const s=document.createElement('script');s.src=document.currentScript.src.replace(/main\.js(\?.*)?$/,'gl.js');document.body.append(s);}
})();
