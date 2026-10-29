/* Shoreline, WebGL version, the default. main.js loads this first unless the page has ?2d.
   Standing on a dark beach at night, looking out across the water. Waves run up the sand in front of you and drain
   back, surf lines roll in further out, and across the bay Night City glows: lit towers, neon, a haze of light, the odd
   flying car. The moon and the city lights stretch into long reflections on the water. Now and then something lives
   in it: plankton glowing blue where the foam breaks, a school of fish in the shallows, fins far out, a speedboat.
   Every pixel is worked out in a fragment shader. The waves and the creatures are simulated here and handed over each
   frame. If WebGL 2 isn't available, the Canvas 2D version in main.js runs instead. */
(()=>{
'use strict';
const cv=document.getElementById('scene'),SRC=document.currentScript.src;
// Falls back to the Canvas 2D version on a fresh canvas, since one that has had a WebGL context can't take a 2D one.
function fallback(){window.SHORELINE_2D=1;const n=cv.cloneNode();cv.replaceWith(n);n.addEventListener('click',()=>{const h=document.getElementById('hud');if(h)h.classList.toggle('off');});
  const s=document.createElement('script');s.src=SRC.replace(/gl\.js(\?.*)?$/,'main.js');document.body.append(s);}
const gl=cv.getContext('webgl2',{antialias:false,alpha:false,depth:false,stencil:false,powerPreference:'high-performance'});
// ?glfail forces the fallback, for testing it.
if(!gl||new URLSearchParams(location.search).has('glfail')){fallback();return;}
const{LOWQ,DEBUG,rr,ri,pick,chance,expo,wpick,fbm}=NightCity;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
const ease=(dt,tau)=>1-Math.exp(-dt/tau);
const lin=c=>c.map(v=>Math.pow(v/255,2.2));

/* ---------- the night ---------- */
const SANDS=[[{name:'white',c:[182,176,164]},4],[{name:'pale',c:[168,158,140]},3],[{name:'grey',c:[150,146,140]},2]];
const SAND=wpick(SANDS);
// Metres: x across the beach, y out to sea, z up. The camera stands on the sand at eye height.
// Waves start from SEA.y and run up the sand toward the camera. The city sits across the bay, opposite the moon.
const SEA={y:rr(5.8,6.8),energy:rr(.8,1.2),tide:rr(-1,1),tideO:rr(0,500),
  moonAz:rr(.15,.5)*(chance(.5)?1:-1),moonEl:rr(.05,.12),cityAz:0,cityW:rr(.6,.95),seed:rr(0,100)};
SEA.cityAz=-Math.sign(SEA.moonAz)*rr(.1,.4);
const NEON=[[1,.12,.6],[.1,.85,1],[.65,.2,1],[1,.35,.15]];
const neonA=pick(NEON),neonB=pick(NEON.filter(c=>c!==neonA));
// About one night in 28 has no moon: only the city and the stars light the beach. Stars are faint, and some nights clearer.
SEA.moon=chance(1/28)?0:1;SEA.stars=SEA.moon?rr(.3,1):1.7;
// People have walked here: some nights a few trails of footprints, along the beach or down to the water, and loose
// prints where people stood about. Each trail is a point, a heading and a slight curve, then its stride, foot length,
// depth and where along it the first step falls.
const TRAILS=[[],[]],nTr=wpick([[0,.2],[2,.25],[3,.25],[5,.2],[7,.1]]);
for(let i=0;i<8;i++){if(i>=nTr){TRAILS[0].push(0,0,0,0);TRAILS[1].push(0,0,0,0);continue;}
  const down=chance(.3),ang=down?rr(1.2,1.95)*(chance(.5)?1:-1):rr(-.3,.3)+(chance(.5)?0:Math.PI);
  TRAILS[0].push(rr(-4,4),rr(1,SEA.y-.6),ang,rr(-.04,.04));TRAILS[1].push(rr(1.25,1.6),rr(.24,.29),rr(.45,1),rr(0,2));}
SEA.prints=chance(.7)?rr(.12,.5):0;

/* ---------- shaders ---------- */
const VS=`#version 300 es
in vec2 a;out vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0,1);}`;
const COMMON=`#version 300 es
precision highp float;
uniform sampler2D uFront;
const float X0=-7.,X1=7.,NX=256.;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 hash2(vec2 p){return vec2(hash(p),hash(p+19.19));}
// Fades out detail at a given frequency (cycles per metre) once it gets finer than a couple of pixels (fw metres each).
float lod(float freq,float fw){return 1.-smoothstep(.2,.55,fw*freq);}
float FW=.002;
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+17.1;a*=.5;}return s;}
// Gradient noise, smooth through its curvature, with each octave turned so no grid lines up. For the water.
vec2 grad2(vec2 i){float a=hash(i)*6.2831853;return vec2(cos(a),sin(a));}
float gnoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);
  return .5+.7*mix(mix(dot(grad2(i),f),dot(grad2(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(grad2(i+vec2(0,1)),f-vec2(0,1)),dot(grad2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}
// f is the frequency of the first octave in cycles per metre, so each octave can fade out before it aliases.
float gfbm(vec2 p,float f){float a=.5,s=0.;mat2 m=mat2(.8,-.6,.6,.8);p=mat2(.866,-.5,.5,.866)*p;p+=vec2(gnoise(p*.31+5.),gnoise(p*.31+9.))*1.2;for(int i=0;i<3;i++){s+=a*((gnoise(p)-.5)*lod(f,FW)+.5);p=m*p*2.03+3.7;a*=.5;f*=2.03;}return s;}
// The y of a wave front at x. Row 0 is the water's edge now, rows 1 to 3 each wave's front, 4 to 6 the furthest each reached.
float front(int row,float x){float u=clamp((x-X0)/(X1-X0),0.,1.)*(NX-1.);int i=int(floor(u));
  float a=texelFetch(uFront,ivec2(i,row),0).r,b=texelFetch(uFront,ivec2(min(i+1,255),row),0).r;return mix(a,b,fract(u));}
`;
// The sand map, in beach coordinates. Red is wet: covered by water now, otherwise slowly drying.
// Green is how freshly the water has smoothed and combed the sand, fading over minutes as it dries out.
// Blue is the swash mark, a thin line of grit left where a wave stopped, until another wave washes it off.
// Alpha is how worn the relief is: each moment under water smooths it a little, so footprints fade over many waves.
// Green and blue fade, and alpha grows, slower than a step of the 8-bit texture, so they change at random, a little at a time.
const STATE_FS=COMMON+`
in vec2 v;out vec4 o;uniform sampler2D uPrev;uniform float uDecay,uT;
void main(){vec2 p=vec2(mix(-7.,7.,v.x),mix(0.,12.,v.y));vec4 c=texture(uPrev,v);float w=c.r,g=c.g,b=c.b,f0=front(0,p.x);
  float r=hash(p*37.+fract(uT*.731)*91.);
  if(p.y>f0-.01){w=1.;g=1.;b*=.6;c.a=min(1.,c.a+step(r,.25)/255.);}
  else{w=max(0.,w-uDecay);g=max(0.,g-uDecay*step(r,.12));b=max(0.,b-uDecay*step(r,.25));
    for(int i=0;i<3;i++){float m=front(4+i,p.x);if(m>50.||f0<m+.04)continue;b=max(b,1.-smoothstep(.006,.022,abs(p.y-m-.008)));}}
  o=vec4(w,g,b,c.a);}`;
const MAIN_FS=COMMON+`
in vec2 v;out vec4 o;
uniform float uT;uniform vec3 uCam,uFwd,uRight,uUp;uniform vec2 uTan;
uniform sampler2D uWet;uniform vec4 uWave[3];uniform vec2 uStrand[3];uniform vec4 uSeed[3];uniform float uRip;
uniform vec3 uMoonDir,uSand,uNeonA,uNeonB;uniform float uBright,uSeaY,uCityAz,uCityW,uCitySeed,uNeonFlick,uBio;
uniform vec4 uFish,uFin,uCar[2];uniform float uMoon,uStars,uPx,uPrints;uniform vec4 uBoat;uniform vec3 uBoatC;uniform vec4 uTr[8],uTr2[8];
const float PI=3.14159265;

/* ---- the sky and the city across the bay ---- */
// Directions are turned into an angle around the horizon (az, 0 straight out to sea) and an angle up (el).
// With no moon, the light is a dim glow from the sky and the stars.
vec3 moonCol(){return vec3(.62,.7,.86)*uBright*mix(.16,1.,uMoon);}
// Highlights are the moon's mirror image, so a moonless night has none.
vec3 moonSpec(){return moonCol()*uMoon;}
float cityMask(float az){return smoothstep(uCityW,uCityW*.6,abs(az-uCityAz));}
// The skyline: blocks of towers, now and then a tall one, lower toward the ends of the city.
float towerH(float az,out float bi){bi=floor(az*55.+uCitySeed);float h=.004+.024*pow(hash(vec2(bi,1.)),1.5);
  if(hash(vec2(bi,2.))>.86)h+=.035*hash(vec2(bi,3.));return h*cityMask(az);}
// DISC is 0 while the water samples the sky, so the moon's disc is only ever drawn once, in the sky itself.
float DISC=1.;
vec3 sky(vec3 d){
  // Straight up, the angle around the horizon is undefined (atan(0,0)), and some GPUs turn it into NaN, so it is pinned to 0.
  float el=asin(clamp(d.z,-1.,1.)),az=abs(d.x)+abs(d.y)<1e-5?0.:atan(d.x,d.y);
  vec3 c=mix(vec3(.0045,.006,.012),vec3(.0012,.0016,.0035),smoothstep(0.,.5,el))*uBright;
  // The city lights the haze above it in neon tints.
  float cm=cityMask(az),haze=exp(-max(el,0.)/.05)*cm;
  c+=mix(uNeonA,uNeonB,vnoise(vec2(az*6.,3.)))*.03*haze+vec3(.03,.02,.02)*.35*haze;
  // Stars: a few faint ones, fewer near the city's glow, and more on a moonless night. Each is drawn about a pixel wide.
  if(el>.04){vec2 sc=vec2(az*cos(el),el)*250.,si=floor(sc);float sh=hash(si+.5);
    if(sh<.012*uStars){vec2 so=hash2(si+7.)*.8+.1;float d=length(fract(sc)-so)/250.,sg=uPx*.7;
      float b=(.04+.5*pow(hash(si+3.),4.))*(.8+.2*sin(uT*2.3+sh*500.));
      c+=mix(vec3(.6,.65,.85),vec3(.85,.8,.7),hash(si+11.))*b*exp(-d*d/(2.*sg*sg))*(1.-cm)*smoothstep(.04,.15,el);}}
  // The moon, the only disc in the sky: a soft halo and a bright disc.
  float ma=acos(clamp(dot(d,uMoonDir),-1.,1.));c+=moonCol()*uMoon*((exp(-ma/.03)*.04+exp(-ma/.2)*.012)+1.6*DISC*(1.-smoothstep(.0085,.0095,ma)));
  // Flying cars: a pinpoint headlight and a blinking tail light crossing above the towers. Kept small and dim, so none can pass for a moon.
  for(int i=0;i<2;i++){vec4 C=uCar[i];if(C.z<=0.)continue;float dd=length(vec2((az-C.x)*cos(el),el-C.y));
    float dt2=length(vec2((az-C.x+(C.w>1.5?.004:-.004))*cos(el),el-C.y));
    vec3 lc=mod(C.w,2.)<.5?vec3(1.,.85,.6):uNeonB;c+=lc*C.z*exp(-dd/.0005)*.3+vec3(1.,.1,.08)*C.z*exp(-dt2/.0005)*.25*step(.5,fract(uT*1.7+float(i)*.3));}
  // Towers: dark silhouettes, lit windows, neon strips on some, and red lights blinking on the tall ones.
  float bi,h=towerH(az,bi);
  if(el>-.002&&el<h){
    vec3 b=vec3(.0015,.0016,.0025);
    vec2 g=vec2(az*55.*7.,el*55.*10.);vec2 gi=floor(g),gf=fract(g);
    float lit=step(hash(gi+bi*.7),.32+.25*hash(vec2(bi,5.)))*step(.2,gf.x)*step(gf.x,.8)*step(.25,gf.y)*step(gf.y,.75);
    vec3 wc=mix(vec3(1.,.72,.42),vec3(.6,.75,1.),step(.7,hash(gi+3.1)));
    b+=wc*lit*.12*(.6+.4*hash(gi+9.));
    if(hash(vec2(bi,7.))>.6){float ny=h*(.35+.5*hash(vec2(bi,8.)));float band=1.-smoothstep(.0,.0012,abs(el-ny));
      vec3 nc=hash(vec2(bi,9.))>.5?uNeonA:uNeonB;b+=nc*band*1.2*mix(1.,uNeonFlick,step(.8,hash(vec2(bi,11.))));}
    c=mix(c,b,1.-smoothstep(h-.0006,h,el));
    c=mix(c,c+mix(uNeonA,uNeonB,.5)*.012,.5*haze);}
  float tip=1.-smoothstep(0.,.0016,length(vec2((fract(az*55.+uCitySeed)-.5)/55.,el-h-.001)));
  if(h>.02)c+=vec3(1.,.1,.08)*tip*.6*step(.5,fract(uT*.6+bi*.13));
  return c;}

/* ---- the beach: sand, water, foam ---- */
// Grain-scale relief. cmb is how freshly the water has run over the sand: it softens the small ripples and leaves faint
// lines down the slope, but the grain stays, so wet sand never looks like cement.
float sandH(vec2 p,float cmb){return vnoise(p*90.)*.3*lod(90.,FW)+vnoise(p*260.)*.16*lod(260.,FW)+fbm(p*14.)*.6*(1.-.2*cmb)
  +sin(p.y*30.+vnoise(p*4.)*6.)*.1*(1.-.5*cmb)+(cmb>.01?(vnoise(vec2(p.x*70.,p.y*4.))-.5)*.1*cmb*lod(70.,FW):0.);}
// One footprint in its own frame, x from heel to toe and y across, in metres: a soft bowl, deeper at the heel and the
// ball of the foot, with a low rim of pushed-out sand.
float footprint(vec2 q,float L,float D){vec2 a=vec2(q.x/(L*.5),q.y/(L*.19));
  // A rounded outline: a blunt heel, wide across the ball, round at the toes.
  float hw=mix(.66,1.,smoothstep(-.6,.45,a.x))*(1.-.15*smoothstep(.7,1.,a.x));vec2 aa=abs(vec2(a.x,a.y/hw));float r=pow(pow(aa.x,2.6)+pow(aa.y,2.6),1./2.6);
  if(r>1.8)return 0.;
  float k=max(0.,1.-r*r),dip=k*k*(.8+.35*smoothstep(-.2,-.75,a.x)+.3*exp(-(a.x-.45)*(a.x-.45)/.05));
  return D*(-.024*dip+.005*exp(-(r-1.15)*(r-1.15)/.06));}
mat2 rot(float a){return mat2(cos(a),sin(a),-sin(a),cos(a));}
// The beach's larger relief, in metres: lumps and hollows, sand kicked about, trails of footprints and loose prints.
float relief(vec2 p){
  float h=(gnoise(p*1.6+3.)*.65+gnoise(p*3.4+9.)*.35-.5)*.045+(gnoise(p*6.5)-.5)*.012+(gnoise(p*17.+4.)-.5)*.005*lod(17.,FW);
  for(int i=0;i<8;i++){vec4 A=uTr[i],B=uTr2[i];if(B.z<=0.)break;vec2 dir=vec2(cos(A.z),sin(A.z)),d=p-A.xy;
    float u=dot(d,dir),v=dot(d,vec2(-dir.y,dir.x))-A.w*u*u;if(abs(v)>.4)continue;
    float hs=B.x*.5,k=floor((u-B.w)/hs+.5),side=mod(k,2.)<.5?1.:-1.,j=hash(vec2(k,float(i)+.5));
    vec2 q=vec2(u-(B.w+k*hs)-(j-.5)*.06,v-side*(.085+.025*j));
    h+=footprint(rot(side*(.1+.1*j)+atan(2.*A.w*u))*q,B.y,B.z*(.8+.4*j));}
  if(uPrints>0.){vec2 g=p/1.1,ci=floor(g);
    // Offset by the night's seed, so loose prints fall in different places each night.
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 c=ci+vec2(x,y),cs=c+uCitySeed*1.37;if(hash(cs+71.)>uPrints)continue;
      vec2 o=(c+.2+.6*hash2(cs+73.))*1.1;h+=footprint(rot(hash(cs+79.)*6.2832)*(p-o),.26,.4+.6*hash(cs+83.));}}
  return h;}
vec4 bits(vec2 p,float cell,float seed){vec2 g=p/cell,i=floor(g),f=fract(g);vec4 r=vec4(0);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y),h=hash2(i+o+seed);float k=hash(i+o+seed+4.);
    float rad=(.08+.26*pow(hash(i+o+seed+8.),3.))*step(.86,k);float d=length(o+h-f);
    float a=1.-smoothstep(rad*.75,rad,d);if(a>r.w)r=vec4(hash(i+o+seed+2.),d/max(rad,.001),k,a);}
  return r;}
vec3 sandAlbedo(vec2 p){float n=fbm(p*5.),m=gnoise(p*23.+7.)*.6+gnoise(p*61.)*.4*lod(61.,FW),g=(vnoise(p*900.)-.5)*lod(900.,FW),g2=(vnoise(p*300.+5.)-.5)*lod(300.,FW);
  vec3 c=uSand*(.8+.36*n)*(.93+.14*m)*(1.02+.24*g+.16*g2);
  // Fine grains, dark minerals and pale shell, close to the camera.
  // One grain per cell at most, so no neighbours need checking.
  float fl=lod(1./.005,FW*.5);if(fl>0.){vec2 gi=floor(p/.005),gf=fract(p/.005)-.2-.6*hash2(gi+19.);float gk=hash(gi+23.);
    if(gk>.8){float ga=1.-smoothstep(.12,.22,length(gf));c=mix(c,gk<.9?uSand*.3:mix(uSand,vec3(1.),.45),ga*fl*.75);}}
  vec4 b=bits(p,.015,3.);b.w*=lod(1./.015,FW*.5);if(b.w>0.){vec3 bc=b.x<.4?uSand*.4:b.x<.75?mix(uSand,vec3(.9,.87,.82),.6):b.x<.9?vec3(.08,.07,.07):vec3(.32,.16,.11);
    bc*=1.-.35*b.y;c=mix(c,bc,b.w*.9);}
  return c;}
// How deep the water is, in metres: a film at the edge of the swash, deepening toward the sea.
// The water's edge wobbles at a scale finer than the simulated front: small scallops that shift as the water moves.
float edgeJ(vec2 p){return (gnoise(vec2(p.x*7.,p.y*4.+uRip*1.3))-.5)*.09+(gnoise(vec2(p.x*23.+p.y*4.,uT*.9+uRip*2.))-.5)*.025*lod(23.,FW);}
// j is the edge's wobble here, worked out once per pixel and shared by the nearby samples.
float waterDepth(vec2 p,float j){float f=front(0,p.x)+j,s=p.y-f;if(s<0.)return 0.;
  return .004+min(s,1.5)*.03+max(0.,p.y-uSeaY)*.08;}
float rippleH(vec2 p,float drain){
  float h=gfbm(p*vec2(5.,8.)+vec2(0,uRip),8.)*.0018+(gnoise(p*vec2(19.,28.)+vec2(uT*.3,uRip*2.3))-.5)*.0006*lod(28.,FW);
  h+=(gnoise(vec2(p.x*22.,p.y*2.+uRip*1.5))-.5)*.0003*drain*lod(22.,FW)*smoothstep(.35,.7,gnoise(p*3.+3.));
  return h;}
// Out past the swash: long swells rolling in, and the white lines of broken waves heading for the shore.
float swellH(vec2 p){return sin(p.y*.85+uT*1.05+sin(p.x*.13)*1.5)*.05+sin(p.y*1.7-p.x*.4+uT*1.6)*.02+(gnoise(p*.6+uT*.05)-.5)*.06;}
float surfLines(vec2 p){if(p.y<uSeaY-.5)return 0.;float u=(p.y+uT*1.35)/5.5+gnoise(vec2(p.x*.25,2.))*.6;float f=fract(u);
  float b1=f-.12,b2=f-.2;float band=exp(-b1*b1/.0035)+exp(-b2*b2/.02)*.35;
  return band*smoothstep(.35,.75,gnoise(vec2(p.x*.8,floor(u)*3.7)))*smoothstep(.3,.6,gnoise(p*vec2(2.5,1.2)+floor(u)))*smoothstep(uSeaY-.5,uSeaY+2.,p.y)*(1.-smoothstep(25.,45.,p.y));}
float CHURN=0.,SPRAY=0.;
float foamCover(vec2 p,out float edge,out vec2 q,out float bore,out float drain){
  float c=0.,best=-1.;edge=0.;bore=0.;drain=0.;q=p;CHURN=0.;SPRAY=0.;
  float upS=9.,backWater=0.;
  for(int i=0;i<3;i++){vec4 W=uWave[i];if(W.y>2.5)continue;float f=front(1+i,p.x),m=front(4+i,p.x),s=p.y-f;
    if(W.y<.5&&s>-.06)upS=min(upS,abs(s));
    if(W.y>1.5&&s>0.)backWater=1.;
    if(W.y<.5&&s<0.)SPRAY=max(SPRAY,(1.-smoothstep(0.,.07,-s))*pow(1.-W.x,1.5));
    float up=W.y<.5?1.:0.,b=up>0.?0.:clamp(1.-W.x,0.,1.),k=up>0.?1.:pow(max(W.x,0.),1.4);
    // The white roll along the front is thicker in places and breaks up in others, never one even ribbon.
    float brk=s>-.05&&s<.45?fbm(vec2(p.x*2.2+uSeed[i].x,uT*.15+float(i))):.5;
    float dense=W.w*(up>0.?1.:.85*k)*(1.-smoothstep(.0,(.08+.15*(1.-W.x)*up)*(.4+1.3*brk),s))*step(-.004,s)*mix(.3,1.,smoothstep(.3,.6,brk));
    // Behind the front the foam spreads out across the swash, thinning into patches.
    float lace=W.z*(up>0.?1.:.8*k)*(1.-smoothstep(.15,.9+1.5*W.x,s))*step(0.,s);
    if(lace>.01&&s>.15)lace*=mix(1.,.35+.65*smoothstep(.3,.6,fbm(vec2(p.x+uSeed[i].x,s*.8+uSeed[i].y)*1.4)),smoothstep(.15,1.,s));
    float ci=max(dense,lace*.75);
    if(W.y<1.5)edge=max(edge,(1.-smoothstep(0.,.012,abs(s-.003)))*(up>0.?1.:.5)*smoothstep(.25,.6,brk));
    if(up>0.)bore=max(bore,.012*exp(-max(s,0.)/.06)*step(0.,s)*(1.-W.x*.7));
    vec2 sd=uSeed[i].xy;float lag=min(uSeed[i].z,6.)*.05*smoothstep(0.,1.8,s);
    // Running up, foam near the front rides with it while foam further back slows toward the sand, so the lace stretches.
    float ride=1.-.45*smoothstep(.1,1.6,s);
    if(ci>best){best=ci;drain=b*step(0.,s);q=up>0.?vec2(p.x+sd.x,mix(p.y-m,s,ride)-lag+sd.y):vec2(p.x+sd.x,(p.y-m)*mix(1.,.62,b)-lag+sd.y);
      CHURN=up>0.?exp(-max(s,0.)/.36)*(1.-W.x*.6):.25*(1.-b);}
    c=max(c,ci);}
  float hit=backWater*exp(-upS/.07)*step(upS,8.)*smoothstep(.25,.75,gnoise(vec2(p.x*3.5,uT*.6))+gnoise(vec2(p.x*11.,uT*1.3))*.4);
  if(hit>.01){c=max(c,.8*hit);bore+=.008*hit;CHURN=max(CHURN,hit);edge=max(edge,hit*.3);}
  for(int i=0;i<3;i++){vec2 S=uStrand[i];if(S.y<=0.)continue;float m=front(4+i,p.x),wid=.006+.02*fbm(vec2(p.x*9.,float(i)*7.)),d=abs(p.y-m+.008),ci=S.y*(1.-smoothstep(wid*.5,wid,d))*.95*smoothstep(.25,.5,fbm(vec2(p.x*15.,float(i)*3.)));
    if(ci>best){best=ci;q=vec2(p.x+uSeed[i].x,(p.y-m)*.5+uSeed[i].y);}c=max(c,ci);}
  // The sea beyond the swash: drifting foam, and the white lines of the surf.
  float sl=surfLines(p);float cs=max(sl*.9,smoothstep(uSeaY-.3,uSeaY+.5,p.y)*.3*smoothstep(.3,.7,fbm(p*1.5+vec2(0,uT*.05))));
  if(cs>best){q=p+vec2(0,uT*1.35);CHURN=sl;}c=max(c,cs);
  return c;}
float holeField(vec2 g,float seed){vec2 i=floor(g),f=fract(g);float best=9.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y),h=hash2(i+o+seed);best=min(best,length(o+.1+.8*h-f)-(.12+.38*hash(i+o+seed+3.)));}
  return best;}
// Foam: holes of three sizes, warped, cut a sheet that's thick along its strands. Finer layers fade before they alias.
vec3 foamAt(vec2 q,float c,float fw,out vec2 bub){
  vec2 w=vec2(fbm(q*3.3),fbm(q*3.3+5.2))-.5;w+=(vec2(vnoise(q*19.),vnoise(q*19.+3.))-.5)*.35;
  w+=(vec2(gnoise(q*6.5+vec2(0,uT*.9)),gnoise(q*6.5+vec2(7.,uT*.9)))-.5)*.9*CHURN;
  float h0=holeField(q/.18+w*1.1,31.),h1=holeField(q/.065+w*1.8,1.),h2=holeField(q/.024+w*2.6,7.),h3=holeField(q/.01+w*3.,13.);
  float d1=1.-smoothstep(.15,.45,fw/.065),d2=1.-smoothstep(.15,.45,fw/.024),d3=1.-smoothstep(.15,.45,fw/.01);
  float clump=(fbm(q*3.5+11.)-.5)*(1.5-c);
  float t1=(h1-mix(.45,-.3,c)-clump+(gnoise(q*5.+uT*.35)-.5)*.25*(.3+CHURN))*d1+(c-.5)*(1.-d1);
  float t2=(h2-mix(.4,-.3,c))*d2+1.*(1.-d2),t3=(h3-mix(.3,-.35,c))*d3+1.*(1.-d3);
  // Where the foam has spread thin, big holes open and it breaks into patches.
  float t0=(h0-mix(.45,-.6,smoothstep(.05,.85,c)))*2.77;
  float thick=min(min(t0,t1),min(t2*.55,t3*.3));
  float aa=max(fw/.065*1.5,.03);
  float f=smoothstep(0.,aa,thick);
  // Loose bubbles scattered between the patches.
  vec2 sg=q/.007+w*4.,si=floor(sg),so=hash2(si+51.)*.6+.2;
  f=max(f,(1.-smoothstep(.15,.32,length(fract(sg)-so)))*step(.9,hash(si+57.))*smoothstep(.04,.35,c)*(1.-smoothstep(.15,.45,fw/.007))*.85);
  vec2 g=q/.011,ci=floor(g),cf=fract(g);float bd=9.;bub=vec2(0);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y),h=hash2(ci+o+21.);float r=.35+.3*hash(ci+o+29.);vec2 dv=(cf-(o+.2+.6*h))/r;float dd=dot(dv,dv);if(dd<bd){bd=dd;bub=dv;}}
  bub*=(1.-smoothstep(.2,.6,fw/.011))*step(bd,1.);
  return vec3(f,clamp(thick*3.,0.,1.),smoothstep(-.25,0.,thick));}

/* ---- light ---- */
float ggx(vec3 n,vec3 h,float r){float a=r*r,a2=a*a,d=max(dot(n,h),0.);float k=d*d*(a2-1.)+1.;return a2/(PI*k*k);}
// Light on the beach: the moon, the dark sky, and the faint neon glow of the city across the water.
vec3 ambient(vec3 n){return sky(normalize(vec3(n.xy*.6,max(n.z,.2))))*2.+mix(uNeonA,uNeonB,.5)*.0012;}
// The water's mirror: the sky, smeared up and down where the surface is rougher, so lights stretch into streaks.
vec3 reflSky(vec3 r,float smear){r.z=abs(r.z);vec3 c=vec3(0);float wsum=0.;DISC=0.;
  for(int i=-3;i<=3;i++){float k=float(i)/3.,w=1.-abs(k)*.6;c+=sky(normalize(r+vec3(0,0,smear*k*2.)))*w;wsum+=w;}c/=wsum;DISC=1.;
  // In place of the disc, a soft glow where the moon would be mirrored. The glitter of its path comes from the ripples.
  float mr=acos(clamp(dot(normalize(r),uMoonDir),-1.,1.));c+=moonCol()*uMoon*exp(-mr/(.03+smear*3.))*.06;
  // The city's lights blur into a broad shimmer on the water below it.
  float az=abs(r.x)+abs(r.y)<1e-5?0.:atan(r.x,r.y),el=asin(clamp(r.z,0.,1.));c+=mix(uNeonA,uNeonB,vnoise(vec2(az*14.,1.)))*cityMask(az)*exp(-el/(.015+smear))*.03*(.5+1.*vnoise(vec2(az*90.,uT*.5)));
  c+=vec3(1.,.75,.5)*cityMask(az)*exp(-el/(.01+smear))*.014*(.4+1.2*vnoise(vec2(az*260.,uT*.8)));
  return c;}

void main(){
  vec2 uv=v*2.-1.;
  vec3 rd=normalize(uFwd+uv.x*uTan.x*uRight+uv.y*uTan.y*uUp),ro=uCam,vdir=-rd;vec3 col;
  vec3 L=uMoonDir;
  float tgw=1e9;
  if(rd.z>=-.0005){col=sky(rd);}
  else{
  float tg=-ro.z/rd.z;tgw=tg;vec2 p=(ro+rd*tg).xy;FW=length(fwidth(p));float dist=tg;
  float ej=edgeJ(p),fJ=front(0,p.x)+ej,wd=waterDepth(p,ej);
  vec4 SM=texture(uWet,vec2((p.x+7.)/14.,p.y/12.));float cmb=SM.g*(1.-smoothstep(uSeaY-1.,uSeaY,p.y));
  float wet=max(SM.r,smoothstep(uSeaY-1.,uSeaY,p.y));
  float fresh=wet>.85?smoothstep(.9,1.,wet+(fbm(p*7.)-.5)*.07):0.;
  wet=smoothstep(.0,.6,wet+(fbm(p*11.)-.5)*.45+(vnoise(p*45.)-.5)*.16);
  float edge,bore,drain;vec2 fq;float cov=foamCover(p,edge,fq,bore,drain);
  // Sand: grains and ripples, darker and shinier where wet, glittering where the water has only just left.
  vec2 e=vec2(.003,0);float h0=sandH(p,cmb),hx=sandH(p+e.xy,cmb),hy=sandH(p+e.yx,cmb);
  // Footprints and lumps wear down a little each time water runs over them (the map's alpha), and never wholly.
  float rel=(1.-.88*SM.a)*(1.-smoothstep(uSeaY-1.5,uSeaY,p.y)),R=relief(p)*rel;
  // Their slope comes from screen-space derivatives, so the relief is worked out once per pixel.
  vec2 J1=dFdx(p),J2=dFdy(p);float r1=dFdx(R),r2=dFdy(R),det=J1.x*J2.y-J1.y*J2.x;
  vec2 gR=abs(det)>1e-12?vec2(J2.y*r1-J1.y*r2,J1.x*r2-J2.x*r1)/det:vec2(0);gR=clamp(gR,-1.,1.);
  vec3 n=normalize(vec3(-(hx-h0)/e.x*.004-gR.x,-(hy-h0)/e.x*.004-gR.y,1.));
  // The moon is low, so slopes turned even slightly away from it fall into shade.
  float msh=smoothstep(-.02,.06,dot(n,L));
  vec3 alb=sandAlbedo(p)*(1.+min(R,0.)*3.);
  vec3 H=normalize(L+vdir);
  vec3 dry=alb*(moonCol()*max(dot(n,L),0.)*msh+ambient(n));
  vec3 wa=alb*vec3(.55,.56,.6);vec3 wn=normalize(mix(n,vec3(0,0,1),.3));
  vec3 wetC=wa*(moonCol()*max(dot(wn,L),0.)*msh+ambient(wn))+moonSpec()*ggx(wn,H,mix(.3,.16,cmb))*mix(.04,.07,cmb);
  col=mix(dry,wetC,wet);
  // The swash mark: a thin wavy line of dark grit and shell bits where a wave stopped.
  float mk=smoothstep(.2,.6,SM.b)*smoothstep(.25,.6,fbm(vec2(p.x*9.,5.))+.15);
  if(mk>0.){vec4 sb=bits(p,.006,61.);col*=1.-.45*mk;col+=moonCol()*uSand*sb.w*step(.6,sb.x)*mk*.5*lod(1./.006,FW*.6);}
  // Air pushed out of the sand once the water has gone: pinholes that open in the fresh wet sand.
  float ph=smoothstep(.75,.85,SM.r)*(1.-smoothstep(.97,.99,SM.r))*SM.g;
  if(ph>0.){vec4 hb=bits(p,.03,77.);col*=1.-.7*ph*hb.w*step(hb.x,.55)*smoothstep(.3,.9,1.-hb.y)*lod(1./.03,FW*.4);}
  if(fresh>0.){vec3 fn0=normalize(mix(n,vec3(0,0,1),.85));float F0=.02+.98*pow(1.-max(dot(fn0,vdir),0.),5.);
    col=mix(col,col*.85+reflSky(reflect(rd,fn0),.02)*F0*1.4,fresh*.85);
    vec4 gl0=bits(p,.008,41.);col+=moonSpec()*step(.93,gl0.x)*gl0.w*lod(1./.008,FW*.6)*fresh*.25;}
  float ahead=fJ-p.y;if(ahead>0.)col*=1.-.3*exp(-ahead/.025);
  vec3 sandC=col;
  if(wd>0.){
    // Water: the lip of an incoming wave, ripples near shore and swells further out, which bend the view of the sand,
    // focus faint caustics on it and mirror the sky, the moon and the city in long broken streaks.
    // The sheet is deeper in some places than others, and the pattern drifts with the flow.
    float dr=drain;if(p.y<uSeaY+.5)wd=(wd-.004)*mix(.55+.9*gnoise(p*vec2(1.4,1.9)+vec2(0,uRip*.8)),1.,smoothstep(uSeaY-1.,uSeaY+.5,p.y))+.004;wd=wd*mix(1.,.45,dr)+bore;
    float amp=smoothstep(.0,.015,wd)*(1.-smoothstep(12.,30.,dist));
    vec2 e2=vec2(.006,0);
    float R0=rippleH(p,dr),Rxp=rippleH(p+e2.xy,dr),Rxm=rippleH(p-e2.xy,dr),Ryp=rippleH(p+e2.yx,dr),Rym=rippleH(p-e2.yx,dr);
    float D0=waterDepth(p,ej),gx=(waterDepth(p+e2.xy,ej)-D0)/e2.x*mix(1.,.45,dr)+(Rxp-Rxm)/(2.*e2.x)*amp,gy=(waterDepth(p+e2.yx,ej)-D0)/e2.x*mix(1.,.45,dr)+(Ryp-Rym)/(2.*e2.x)*amp;
    float sw=smoothstep(uSeaY-1.,uSeaY+3.,p.y);vec2 es=vec2(.05,0);float S0=swellH(p);
    gx+=(swellH(p+es.xy)-S0)/es.x*sw*.6;gy+=(swellH(p+es.yx)-S0)/es.x*sw*.6;
    // A thin sheet is never glassy: rills down the slope as it drains, choppy little ripples as it runs up.
    float tA=(1.-smoothstep(.008,.05,wd))*lod(30.,FW);
    if(tA>.01){vec2 q1=vec2(p.x*26.,p.y*5.+uRip*6.),q2=p*34.+vec2(uT*.5,uRip*5.);float a1=gnoise(q1),a2=gnoise(q2);
      float k1=.003*mix(.4,1.,dr)*tA,k2=.002*(1.-.5*dr)*tA;
      gx+=(gnoise(q1+vec2(.2,0))-a1)/.2*26.*k1+(gnoise(q2+vec2(.2,0))-a2)/.2*34.*k2;
      gy+=(gnoise(q1+vec2(0,.2))-a1)/.2*5.*k1+(gnoise(q2+vec2(0,.2))-a2)/.2*34.*k2;}
    vec3 wn2=normalize(vec3(-gx,-gy,1.));
    vec2 rp=p-wn2.xy*min(wd,.08)*.8;vec3 ra=sandAlbedo(rp)*vec3(.55,.56,.6);
    float caust=clamp(1.-(Rxp+Rxm+Ryp+Rym-4.*R0)*amp*1.5e3,.8,1.3);
    vec3 under=ra*(moonCol()*max(dot(wn,L),0.)*caust+ambient(wn));
    // A thin sheet is clear, so the wet sand shows through it. Deeper, the water reads dark and close to grey
    // at night: it soaks up light, and the sand's colour fades.
    under=mix(under,mix(vec3(dot(under,vec3(.3,.5,.2))),under,.45)*.55,smoothstep(.006,.06,wd));
    // Sand stirred up by the water: clouds of it behind the front as it runs up, and streaks dragged back down the slope
    // as it drains. They drift with the flow, up the beach and then back.
    float sf=p.y-fJ,near=exp(-sf/.9)*(1.-smoothstep(uSeaY-1.,uSeaY+.5,p.y));
    float sed=0.;
    if(near>.03){float cl=smoothstep(.45,.85,gfbm(p*vec2(2.2,3.)+vec2(0,uRip*1.6),2.2))*(CHURN*.9+.15);
      float sk=dr>.01?smoothstep(.55,.9,gnoise(vec2(p.x*9.,p.y*.9+uRip*3.5)))*dr*smoothstep(0.,.25,sf):0.;
      sed=clamp((cl+sk*.7)*near,0.,1.)*(1.-exp(-wd*60.));}vec3 sedC=ra*1.2*(moonCol()*.5+ambient(vec3(0,0,1))*1.3);
    under=mix(under,sedC,sed*.55);
    under*=exp(-wd*vec3(40.,22.,15.));under+=vec3(.0008,.0016,.002)*(1.-exp(-wd*4.));
    // A school of fish in the water.
    if(uFish.w>0.){mat2 fr=mat2(cos(uFish.z),-sin(uFish.z),sin(uFish.z),cos(uFish.z));
      for(int i=0;i<9;i++){vec2 o=(hash2(vec2(float(i),3.))-.5)*vec2(.9,.6);vec2 c0=uFish.xy+fr*(o+vec2(sin(uT*3.+float(i))*.03,0));
        vec2 lp=transpose(fr)*(p-c0);float fd=length(lp/vec2(.075,.018));float body=1.-smoothstep(.7,1.,fd);
        under*=1.-body*.45*uFish.w;under+=moonCol()*body*.03*uFish.w*step(.92,fract(uT*.7+float(i)*.37));}}
    float F=.02+.98*pow(1.-max(dot(wn2,vdir),0.),5.);
    vec3 refl=reflSky(reflect(rd,wn2),.004+.0012*dist+.012*sw);
    vec3 spec=moonSpec()*ggx(wn2,normalize(L+vdir),.05)*.03;
    // A thin sheet looks like the glossy wet sand it covers, with ripples catching the light, so its edge barely shows.
    // Only deeper water turns into a dark mirror.
    vec3 thinC=mix(col,sedC,sed*.4)*(1.-F*.5)+refl*F+spec*.6;
    col=mix(thinC,mix(under,refl,F)+spec,smoothstep(.004,.045,wd));
    col+=moonCol()*(edge*.05+smoothstep(.004,.012,bore)*.015);
    // Under about a centimetre the sheet breaks up: the sand pokes through in patches, so a draining wave thins into
    // islands and threads instead of sliding away in one piece.
    float film=smoothstep(-.15,.15,(wd-.003)/.012-.9+(gnoise(p*vec2(16.,11.)+vec2(0,uRip*1.2))-.5)*1.3+(gnoise(p*45.+uT*.3)-.5)*.5*lod(45.,FW));
    col=mix(sandC,col,film);
  }
  if(cov>.01){vec2 bub;vec3 fa=foamAt(fq,cov,FW,bub);float f=fa.x,th=fa.y;
    col*=1.-.25*cov*(1.-fa.z)*(1.-f);
    vec3 fn=normalize(vec3(bub*.9+(vec2(vnoise(fq*150.),vnoise(fq*150.+4.))-.5)*.5,1.));
    float ring=length(bub);float bubShade=1.-.28*smoothstep(.55,1.,ring)*step(.001,ring);
    vec3 fc=vec3(.86,.88,.92)*mix(.68,1.12,th)*bubShade;
    vec3 lit=fc*(moonCol()*(max(dot(fn,L),0.)*.6+.16)+ambient(fn)*1.3)+moonSpec()*ggx(fn,normalize(L+vdir),.12)*.1*(.3+th);
    col=mix(col,lit,f*mix(.3,.92,th));
    // Plankton: where the foam churns, specks of it glow blue for a moment.
    vec2 bc=floor(fq*60.);float bio=step(.986,hash(bc+floor(uT*5.)*.17))*f*(.25+CHURN)*uBio*lod(60.,FW);
    col+=vec3(.1,.55,1.)*bio*.35;}
  if(SPRAY>.01){vec2 g=p/.008,ci=floor(g),cf=fract(g);float fr=floor(uT*9.);float hh=hash(ci+fr*.37);
    vec2 o=hash2(ci+fr*.61)*.6+.2;float d0=(1.-smoothstep(.12,.3,length(cf-o)))*step(.82,hh)*lod(1./.008,FW*.7);
    col=mix(col,vec3(.85,.88,.92)*(moonCol()*.9+ambient(vec3(0,0,1))*2.),d0*SPRAY);}
  // Fins: far out in the moon's path, a dark shape breaking the water now and then.
  if(uFin.w>0.){float t2=(uFin.y-ro.y)/rd.y;if(t2>0.&&t2<tg+5.){vec3 X=ro+rd*t2;float lx=(X.x-uFin.x)/.35;float up=sin(uFin.z*PI);
      float hz=up*.32*(1.-abs(lx))*(1.-.4*max(lx,0.));if(abs(lx)<1.&&X.z>0.&&X.z<hz)col=mix(col,vec3(.0015,.002,.003),uFin.w);}}
  // A speedboat's wake: white water churned up behind it, and the two arms of the V spreading from it. Far out, a metre
  // of water is less than a pixel tall, so the lines are spread over the pixel instead of flickering.
  if(uBoat.w>0.&&p.y>uBoat.y-40.&&p.y<uBoat.y+40.){float a=(uBoat.x-p.x)*uBoat.z,l=p.y-uBoat.y;
    if(a>-3.&&a<90.){float sy=max(.5+a*.06,FW*.6),cov=min(1.,(.5+a*.06)/sy);
      float wk=exp(-l*l/(2.*sy*sy))*exp(-max(a,0.)/14.)*cov*.6+exp(-pow(abs(l)-a*.35,2.)/(2.*max(.35,FW*.6)*max(.35,FW*.6)))*exp(-max(a,0.)/30.)*.35*min(1.,.35/max(.35,FW*.6));
      wk*=smoothstep(-3.,0.,a)*(.6+.4*gnoise(vec2(p.x*.3+uT*.4,l*.5)))*uBoat.w;
      col=mix(col,vec3(.7,.74,.8)*(moonCol()*.35+ambient(vec3(0,0,1))*1.5)+uBoatC*.004,clamp(wk,0.,1.)*.75);}}
  // Haze toward the horizon.
  col=mix(col,sky(normalize(vec3(rd.xy,.0)))*1.1,smoothstep(80.,400.,dist)*.6);
  }
  // The speedboat: a dark hull with a neon strip along it and a lit cabin, a white masthead light, a stern light and a bow
  // light, red or green for the side facing the beach. Its lights stretch into broken streaks on the water below.
  if(uBoat.w>0.){float dx=uBoat.z;
    if(rd.y>0.){float t2=(uBoat.y-ro.y)/rd.y;vec3 X=ro+rd*t2;float lx=(X.x-uBoat.x)*dx,z=X.z;
      if(t2<tgw&&lx>-3.6&&lx<3.6&&z>0.){float top=.85-.35*smoothstep(1.5,3.6,lx)+.25*smoothstep(2.8,3.6,lx);
        float cab=(lx>-1.6&&lx<1.1&&z<1.55-.5*smoothstep(.3,1.1,lx))?1.:0.;
        if(z<top||cab>0.){vec3 hc=vec3(.0012,.0013,.0018);
          if(z>.3&&z<.42&&z<top)hc+=uBoatC*.5;
          if(cab>0.&&z>top+.15&&z<1.35&&lx<.7)hc+=vec3(1.,.8,.55)*.025*step(.35,fract(lx*1.6));
          col=mix(col,hc,uBoat.w*(1.-smoothstep(150.,400.,t2)*.5));}}}
    vec3 bp=vec3(uBoat.x,uBoat.y,0.);float az=atan(rd.x,rd.y),el=asin(clamp(rd.z,-1.,1.));
    for(int i=0;i<4;i++){vec3 lp=bp+vec3(dx*(i==0?.4:i==1?-3.5:i==2?3.3:0.),0.,i==0?2.3:i==1?1.:i==2?.95:.36);vec3 lc=i==2?(dx>0.?vec3(.1,1.,.3):vec3(1.,.1,.08)):i==3?uBoatC:vec3(1.,.95,.85);
      float li=i==3?.25:i==2?.35:.6;vec3 dl=lp-ro;float laz=atan(dl.x,dl.y),lel=atan(dl.z,length(dl.xy)),D=length(dl.xy);
      float da=(az-laz)*cos(el),de=el-lel,sg=uPx*.8;
      if(i<3)col+=lc*li*uBoat.w*exp(-(da*da+de*de)/(2.*sg*sg))*step(D*.98,tgw);
      // The reflection: a streak below the light, broken up by the waves between.
      if(rd.z<0.&&tgw>D*.3&&tgw<D*1.1){float w=uPx*(1.5+3.*(tgw/D));float br=smoothstep(.45,.75,gnoise(vec2(tgw*.6,uT*2.+float(i))));
        col+=lc*li*.05*uBoat.w*exp(-da*da/(2.*w*w))*br*smoothstep(D*.3,D*.55,tgw)*(1.-smoothstep(D*.9,D*1.1,tgw));}}}
  // Exposure, a filmic curve, a night grade, vignette and a little grain.
  col*=1.8;col=(col*(2.51*col+.03))/(col*(2.43*col+.59)+.14);
  float l=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(l),col,.8)*vec3(.94,.98,1.06);
  col*=1.-.5*pow(length(uv*vec2(.8,1.)),2.2)*.5;
  col=pow(max(col,0.),vec3(1./2.2));
  col+=(hash(gl_FragCoord.xy+fract(uT*7.)*91.)-.5)*.02;
  o=vec4(col,1);}`;
function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(fs){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,VS));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));const u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
  for(let i=0;i<n;i++){const a=gl.getActiveUniform(p,i),name=a.name.replace(/\[0\]$/,'');u[name]=gl.getUniformLocation(p,name);}return{p,u};}
let MAIN,STATE;
try{MAIN=program(MAIN_FS);STATE=program(STATE_FS);}catch(e){console.error(e);fallback();return;}
const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
const NX=256,FRONT=new Float32Array(NX*7);
const frontTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,frontTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,NX,7,0,gl.RED,gl.FLOAT,FRONT);
for(const k of[gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.NEAREST);
const WS=512,wetTex=[],wetFb=[];
for(let i=0;i<2;i++){const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,WS,WS,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  for(const k of[gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.LINEAR);
  for(const k of[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
  const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tx,0);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);wetTex.push(tx);wetFb.push(f);}
gl.bindFramebuffer(gl.FRAMEBUFFER,null);
let wetI=0,wetT=0;

/* ---------- waves ---------- */
let t=0,bright=1,brightTo=1,cloudEnd=0,rip=0,neonFlick=1,flickEnd=0,bio=.35,bioTo=.35,bloomEnd=0;
const waves=[],stats={waves:0,far:0,sights:0};
const xAt=i=>-7+i*14/(NX-1);
// Where a wave stops, in metres from the camera: most well down the sand, some further, a few a long way up.
const REACH={short:[3.5,4.7],mid:[2.6,3.5],far:[1.8,2.6]};
// us and ds stretch the run up and the drain, so each stretch of the front keeps its own time.
function phase(w,tt,us=1,ds=1){const x=tt-w.t0,up=w.up*us,down=w.down*ds;if(x<0)return[0,0];if(x<up){const k=x/up;return[1-Math.pow(1-k,2.3),0];}
  if(x<up+w.hold)return[1,1];const k=(x-up-w.hold)/down;return k>=1?[0,3]:[1-Math.pow(k,1.7)*(1-.15*Math.sin(k*Math.PI)),2];}
function tide(){return(fbm(t*.0015+SEA.tideO)-.5)*.6+SEA.tide*Math.min(1,t/1800)*.4;}
function newWave(kind){
  kind=kind||wpick([['short',.45],['mid',.38],['far',.17]]);
  const[a,b]=REACH[kind];
  waves.push({kind,t0:t,up:rr(2.8,4.2),hold:rr(.2,.7),down:rr(4.5,7),reach:clamp(rr(a,b)-tide()*SEA.energy*.6,1.6,SEA.y-.8),
    a1:rr(.08,.2),l1:rr(.25,.55),p1:rr(0,6.3),a2:rr(.03,.08),l2:rr(.8,1.6),p2:rr(0,6.3),nO:rr(0,500),obl:rr(-.5,.5),
    dl:rr(.4,.9),uv:rr(.15,.3),dv:rr(.4,.8),lace:rr(.55,1),dense:rr(.7,1),sx:rr(0,50),sy:rr(0,50),front:new Float32Array(NX),max:new Float32Array(NX).fill(99),st:0,logged:false,strand:0,strandLife:rr(6,14)});
  stats.waves++;
}
function waveFront(w){const top=SEA.y+.6;let st=0;
  for(let i=0;i<NX;i++){const x=xAt(i);
    // Each stretch of the front arrives a little earlier or later, runs up faster or slower and drains at its own pace,
    // so the edge keeps changing shape instead of sliding as one curve.
    const[p,s]=phase(w,t-w.obl*(x/7)*.6-(fbm(x*.32+w.nO+70)-.5)*w.dl,1+(fbm(x*.55+w.nO+90)-.5)*w.uv*2,1+(fbm(x*.9+w.nO+120)-.5)*w.dv*2);st=Math.max(st,s);
    const lobe=w.a1*Math.sin(x*Math.PI*w.l1+w.p1)+w.a2*Math.sin(x*Math.PI*w.l2+w.p2)+.14*(fbm(x*.9+w.nO)-.5)+.05*(fbm(x*3+w.nO+40)-.5);
    // While it runs up, the front pushes ahead in shifting fingers that settle as it slows.
    // While it drains, it pulls back in tongues, faster down the hollows.
    const finger=s===0?(fbm(x*2.6+t*.6+w.nO)-.5)*.16*(1-p*.6)+(fbm(x*7+t*1.4+w.nO)-.5)*.04*(1-p*.5):
      s===2?(fbm(x*1.8+w.nO+200)-.5)*.4*(1-p)+(fbm(x*5+w.nO+230)-.5)*.08*(1-p):0;
    w.front[i]=top-(top-(w.reach+lobe))*p+finger;if(w.front[i]<w.max[i])w.max[i]=w.front[i];}
  return st;}
const frontAt=(row,x)=>{const u=clamp((x+7)/14,0,1)*(NX-1),i=Math.floor(u),j=Math.min(NX-1,i+1);return lerp(FRONT[row*NX+i],FRONT[row*NX+j],u-i);};
let nextWave=0;

/* ---------- life ---------- */
const cars=[];let fish=null,fin=null,boat=null,wakeAt=0,wakeN=0,wakeLog=false;
// Each kind of event waits its own exponentially distributed gap. m is the average gap in seconds, f the first wait.
const SCHED={boat:{m:150,f:35},fish:{m:110,f:25},fin:{m:300,f:120},car:{m:45,f:10},bloom:{m:240,f:90},neon:{m:80,f:30},cloud:{m:240,f:100}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
const side=x=>x<-.5?'left':x>.5?'right':'middle';
function fire(k){
  // A speedboat idles slowly across the bay, drifting a little closer and further as it goes.
  if(k==='boat'){if(boat)return;const dir=chance(.5)?1:-1,y0=rr(80,220);
    boat={y0,y:y0,x:-dir*(y0*.8+12),v:dir*rr(1.6,3.2),dir,mA:rr(4,16),mW:rr(.025,.06),mP:rr(0,6.3),neon:pick(NEON),wake:false};
    stats.sights++;NightCity.log(pick(['A speedboat idles slowly across the bay, its lights trailing on the water','A speedboat cruises along the far water, in no hurry']));}
  else if(k==='fish'){if(fish)return;const dir=chance(.5)?1:-1;fish={x:-dir*4,y:rr(SEA.y-2.5,SEA.y-.5),h:dir>0?0:Math.PI,v:dir*rr(.6,1.2),a:0};
    stats.sights++;NightCity.log('A small school of fish flickers through the shallows');}
  else if(k==='fin'){if(fin)return;fin={x:Math.tan(SEA.moonAz)*rr(35,60)+rr(-3,3),y:rr(35,60),ph:0,dur:rr(2.5,4),n:ri(1,3)};
    stats.sights++;const where=SEA.moon?'the moon\'s path':'the dark water';NightCity.log(fin.n>1?`Fins break ${where} far out, then slip under`:`A fin breaks ${where} far out, then slips under`);}
  else if(k==='car'){if(cars.length>=2)return;const dir=chance(.5)?1:-1;cars.push({az:SEA.cityAz-dir*SEA.cityW,el:rr(.02,.06),v:dir*rr(.01,.03),a:0,c:chance(.6)?0:1});
    NightCity.log(pick(['A flying car crosses above the towers across the bay','Lights drift across the skyline, a car on its way somewhere']));}
  else if(k==='bloom'){bioTo=rr(.8,1);bloomEnd=t+rr(40,90);NightCity.log('The breaking foam starts to glow blue: plankton in the surf');}
  else if(k==='neon'){flickEnd=t+rr(1.5,4);NightCity.log('A neon sign across the bay stutters');}
  else if(k==='cloud'){if(brightTo<1||!SEA.moon)return;brightTo=rr(.45,.65);cloudEnd=t+rr(30,80);NightCity.log('A cloud slides over the moon and the beach goes darker');}
}

function update(dt){
  t+=dt;
  if(t>=nextWave){newWave();nextWave=t+(4.5+expo(5.2))/SEA.energy;}
  for(const k in SCHED){nextEv[k]-=dt;if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);fire(k);}}
  if(cloudEnd&&t>cloudEnd){brightTo=1;cloudEnd=0;NightCity.log('The cloud passes and the moonlight comes back');}
  if(bloomEnd&&t>bloomEnd){bioTo=.35;bloomEnd=0;}
  bright+=(brightTo-bright)*ease(dt,6);bio+=(bioTo-bio)*ease(dt,8);
  neonFlick=t<flickEnd?(Math.sin(t*40)>.2?1:.1):1;
  // Between waves the sea's edge rests in an uneven line that shifts slowly with the water.
  for(let i=0;i<NX;i++){const x=xAt(i);FRONT[i]=SEA.y+.04*Math.sin(x*1.2+t*.7)+(fbm(x*.35+t*.02+SEA.tideO)-.5)*.5+(fbm(x*1.3+t*.08+40)-.5)*.12;}
  for(const w of waves){w.st=waveFront(w);for(let i=0;i<NX;i++)FRONT[i]=Math.min(FRONT[i],w.front[i]);
    if(w.st>=1&&!w.logged){w.logged=true;logWave(w);}
    if(w.st>=2&&!w.strand)w.strand=t;}
  for(let i=waves.length-1;i>=0;i--){const w=waves[i];if(w.st===3&&t-w.strand>w.strandLife)waves.splice(i,1);}
  // Ripples drift up the beach with the newest wave running up, and back down while it drains.
  const lead=waves.filter(w=>w.st<3).slice(-1)[0];rip+=dt*(lead&&lead.st===0?.35:-.14);
  if(fish){fish.x+=fish.v*dt;fish.a=Math.min(1,fish.a+dt/1.5)*clamp(4.5-Math.abs(fish.x),0,1);fish.y+=Math.sin(t*.8)*.1*dt;if(Math.abs(fish.x)>4.6&&Math.sign(fish.x)===Math.sign(fish.v))fish=null;}
  if(fin){fin.ph+=dt/fin.dur;if(fin.ph>=fin.n)fin=null;}
  // A speedboat crosses the bay slowly. Its wake reaches the beach a while later as a small wave or two.
  if(boat){boat.x+=boat.v*dt;boat.y=boat.y0+boat.mA*Math.sin(t*boat.mW+boat.mP);
    if(!boat.wake&&Math.abs(boat.x)<6){boat.wake=true;wakeAt=t+boat.y/rr(5,7);wakeN=ri(1,3);wakeLog=true;}
    if(Math.abs(boat.x)>boat.y*.8+16&&Math.sign(boat.x)===Math.sign(boat.v))boat=null;}
  if(wakeN&&t>=wakeAt){if(wakeLog){wakeLog=false;NightCity.log('The speedboat\'s wake reaches the shore as a small wave or two');}newWave('short');wakeN--;wakeAt=t+rr(1.4,2.4);}
  for(let i=cars.length-1;i>=0;i--){const c=cars[i];c.az+=c.v*dt;c.a=clamp(SEA.cityW*1.15-Math.abs(c.az-SEA.cityAz),0,.15)/.15;if(Math.abs(c.az-SEA.cityAz)>SEA.cityW*1.2&&Math.sign(c.az-SEA.cityAz)===Math.sign(c.v))cars.splice(i,1);}
}
function logWave(w){
  if(w.kind==='far'){stats.far++;NightCity.log(pick(['A bigger wave runs a long way up the sand','A wave races far up the beach, foam hissing']));}
  else if(w.kind==='mid')NightCity.log(pick(['A wave runs up the sand and slides back','Foam spreads up the beach and drains away']));
  else NightCity.log(pick(['A small wave laps at the wet sand','A wave folds over and barely reaches the beach']));
}

/* ---------- drawing ---------- */
let CW=0,CH=0,DPR=1;
const SCALE=parseFloat(new URLSearchParams(location.search).get('glq'))||1;
// If frames keep running long, the render resolution steps down, at most a few times.
// Embeds run at about 30 fps on purpose, and hidden pages are throttled, so neither counts.
let dyn=1,perfLast=0,perfAcc=0,perfN=0;
function watchPace(){if(LOWQ||document.hidden){perfLast=0;return;}const now=performance.now(),d=now-perfLast;perfLast=now;if(d>0&&d<120){perfAcc+=d;perfN++;}
  if(perfN>=120){if(perfAcc/perfN>19&&dyn>.6){dyn*=.85;build();}perfAcc=perfN=0;}}
function build(){
  CW=Math.max(240,innerWidth);CH=Math.max(240,innerHeight);
  DPR=(LOWQ?.55:Math.min(1.25,devicePixelRatio||1)*.85)*SCALE*dyn;
  const maxPx=(LOWQ?6e5:1.3e6)*dyn*dyn;if(CW*CH*DPR*DPR>maxPx)DPR=Math.sqrt(maxPx/(CW*CH));
  cv.width=Math.round(CW*DPR);cv.height=Math.round(CH*DPR);
}
// The camera stands on the sand at eye height, looking out to sea and a little down at the swash.
// On a tall screen it keeps about the same view up and down and crops the sides.
function camera(){const asp=CW/CH,cam=[0,0,1.65],pitch=-.21,f=[0,Math.cos(pitch),Math.sin(pitch)],r=[1,0,0],u=cross(r,f);
  const tanY=asp<1?Math.tan(.42)*1.15:Math.tan(.42),tanX=tanY*asp;return{cam,f,r,u,tanX,tanY};}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const MOON_DIR=[Math.sin(SEA.moonAz)*Math.cos(SEA.moonEl),Math.cos(SEA.moonAz)*Math.cos(SEA.moonEl),Math.sin(SEA.moonEl)];
// Wet sand: mark what the water covers and let the rest dry. Runs a few times a second, reading the fronts already uploaded.
function wetPass(){gl.useProgram(STATE.p);gl.bindFramebuffer(gl.FRAMEBUFFER,wetFb[1-wetI]);gl.viewport(0,0,WS,WS);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,frontTex);gl.uniform1i(STATE.u.uFront,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,wetTex[wetI]);gl.uniform1i(STATE.u.uPrev,1);gl.uniform1f(STATE.u.uDecay,1/255);gl.uniform1f(STATE.u.uT,t);
  gl.drawArrays(gl.TRIANGLES,0,3);wetI=1-wetI;gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
// Rows 1 to 6 of the front texture: each recent wave's front and the furthest it reached. Empty slots sit far behind the camera.
function uploadFronts(){const slots=waves.slice(-3);
  for(let s=0;s<3;s++){const w=slots[s];for(let i=0;i<NX;i++){FRONT[(1+s)*NX+i]=w?w.front[i]:99;FRONT[(4+s)*NX+i]=w?w.max[i]:99;}}
  gl.bindTexture(gl.TEXTURE_2D,frontTex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,NX,7,gl.RED,gl.FLOAT,FRONT);return slots;}
function draw(){
  const slots=uploadFronts();
  wetT+=1/60;if(wetT>.2){wetT=0;wetPass();}
  gl.viewport(0,0,cv.width,cv.height);gl.useProgram(MAIN.p);const U=MAIN.u;
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,frontTex);gl.uniform1i(U.uFront,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,wetTex[wetI]);gl.uniform1i(U.uWet,1);
  const C=camera();gl.uniform3fv(U.uCam,C.cam);gl.uniform3fv(U.uFwd,C.f);gl.uniform3fv(U.uRight,C.r);gl.uniform3fv(U.uUp,C.u);gl.uniform2f(U.uTan,C.tanX,C.tanY);gl.uniform1f(U.uPx,2*C.tanY/cv.height);
  gl.uniform1f(U.uT,t);
  const W=[],S=[];for(let s=0;s<3;s++){const w=slots[s];if(!w){W.push(0,3,0,0);S.push(0,0);continue;}const[p,st]=phase(w,t);W.push(p,w.st===3?3:st,w.lace,w.dense);
    S.push(0,w.strand?Math.max(0,1-(t-w.strand)/w.strandLife)*w.lace:0);}
  gl.uniform4fv(U.uSeed,[0,1,2].flatMap(i=>slots[i]?[slots[i].sx,slots[i].sy,t-slots[i].t0,0]:[0,0,0,0]));gl.uniform1f(U.uRip,rip);
  gl.uniform4fv(U.uWave,W);gl.uniform2fv(U.uStrand,S);
  gl.uniform3fv(U.uMoonDir,MOON_DIR);gl.uniform3fv(U.uSand,lin(SAND.c));gl.uniform3fv(U.uNeonA,neonA);gl.uniform3fv(U.uNeonB,neonB);
  gl.uniform1f(U.uBright,bright);gl.uniform1f(U.uSeaY,SEA.y);gl.uniform1f(U.uCityAz,SEA.cityAz);gl.uniform1f(U.uCityW,SEA.cityW);gl.uniform1f(U.uCitySeed,SEA.seed);
  gl.uniform1f(U.uNeonFlick,neonFlick);gl.uniform1f(U.uMoon,SEA.moon);gl.uniform1f(U.uPrints,SEA.prints);gl.uniform4fv(U.uTr,TRAILS[0]);gl.uniform4fv(U.uTr2,TRAILS[1]);gl.uniform1f(U.uStars,SEA.stars);gl.uniform1f(U.uBio,bio);
  gl.uniform4fv(U.uFish,fish?[fish.x,fish.y,fish.h,fish.a*.8]:[0,0,0,0]);
  gl.uniform4fv(U.uBoat,boat?[boat.x,boat.y,boat.dir,1]:[0,0,1,0]);gl.uniform3fv(U.uBoatC,boat?boat.neon:[0,0,0]);
  gl.uniform4fv(U.uFin,fin?[fin.x,fin.y,fin.ph%1,1]:[0,0,0,0]);
  const Cr=[];for(let i=0;i<2;i++){const c=cars[i];Cr.push(...(c?[c.az,c.el,c.a,c.c+(c.v>0?2:0)]:[0,0,0,0]));}gl.uniform4fv(U.uCar,Cr);
  gl.drawArrays(gl.TRIANGLES,0,3);
}

/* ---------- start ---------- */
if(DEBUG)window.SH={gl:true,SEA,get boat(){return boat;},cars,waves,stats,newWave,fire,get t(){return t;},get paused(){return NightCity.paused;},set paused(v){NightCity.paused=v;},
  draw:()=>draw(),step:dt=>update(dt),run(sec){for(let i=0;i<sec*60;i++){update(1/60);if(i%12===11){uploadFronts();wetPass();}}draw();NightCity.refresh();}};
build();
for(let i=0;i<30*14;i++){update(1/30);if(i%6===5){uploadFronts();wetPass();}}
stats.waves=stats.far=stats.sights=0;
NightCity.log(`${SEA.moon?'Moonlight on the water':'No moon tonight, only stars'}, and Night City glowing across the bay to the ${SEA.cityAz<0?'left':'right'}`);
NightCity.run({step:1/60,update,draw:()=>{watchPace();draw();},ui:()=>NightCity.stats(stats)});
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{build();draw();},200);});
})();
