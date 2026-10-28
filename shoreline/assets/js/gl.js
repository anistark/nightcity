/* Shoreline, WebGL prototype. Open the scene with ?gl to run it.
   A camera at eye height looks down at bare feet on a beach at night. Every pixel is worked out in a fragment shader:
   the sand with grain-level relief and a wet sheen, thin water that refracts the sand beneath it, absorbs light with
   depth and mirrors the moon through moving ripples, procedural foam whose holes grow as it thins, and feet modelled as
   smooth 3D shapes, ray-marched and lit with light scattering through the skin, soft shadows and ambient occlusion.
   The waves are simulated here in metres and handed to the shader in a small data texture each frame.
   If WebGL 2 isn't available, the Canvas 2D version in main.js runs instead. */
(()=>{
'use strict';
const cv=document.getElementById('scene'),SRC=document.currentScript.src;
// Falls back to the Canvas 2D version on a fresh canvas, since one that has had a WebGL context can't take a 2D one.
function fallback(){window.SHORELINE_2D=1;const n=cv.cloneNode();cv.replaceWith(n);n.addEventListener('click',()=>{const h=document.getElementById('hud');if(h)h.classList.toggle('off');});const s=document.createElement('script');s.src=SRC.replace(/gl\.js(\?.*)?$/,'main.js');document.body.append(s);}
const gl=cv.getContext('webgl2',{antialias:false,alpha:false,depth:false,stencil:false,powerPreference:'high-performance'});
// ?glfail forces the fallback, for testing it.
if(!gl||new URLSearchParams(location.search).has('glfail')){fallback();return;}
const{RM,LOWQ,DEBUG,R,rr,ri,pick,chance,expo,wpick,fbm}=NightCity;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
const ease=(dt,tau)=>1-Math.exp(-dt/tau);
const lin=c=>c.map(v=>Math.pow(v/255,2.2));

/* ---------- the night ---------- */
const SANDS=[[{name:'pale',c:[176,158,132]},4],[{name:'golden',c:[184,152,110]},3],[{name:'grey',c:[148,142,134]},2],[{name:'dark',c:[132,124,116]},1]];
const SAND=wpick(SANDS);
const MOONS=[[{name:'cold',c:[.62,.74,1]},3],[{name:'silver',c:[.72,.78,.94]},3],[{name:'pale',c:[.82,.84,.9]},2]];
const MOON=wpick(MOONS);
const SKINS=[['fair',[226,186,160]],['light',[212,166,132]],['medium',[180,128,94]],['tan',[156,106,74]],['brown',[112,74,52]],['deep',[78,50,36]]];
const POLISH=[[150,28,46],[30,42,70],[196,164,214],[232,226,216],[44,108,100],[210,90,60]];
const SEA={y:rr(1.02,1.16),energy:rr(.8,1.2),tide:rr(-1,1),tideO:rr(0,500),moonX:rr(-.25,.25)};
// Metres on the beach: x across, y toward the sea, z up. The toes sit at TOE_Y, the ankles at ANKLE_Y.
const TOE_Y=.56,ANKLE_Y=.33;
function person(){const[name,skin]=pick(SKINS);return{name,skin,size:rr(.93,1.07),nails:chance(.3)?pick(POLISH):null,hair:chance(.5)?rr(.3,1):0};}
// Almost always one pair of feet. A second pair is a rare night.
const people=[person()];if(chance(.04))people.push(person());
const feet=[];
people.forEach((p,i)=>{const cx=people.length>1?(i?.27:-.27):0,dy=people.length>1&&i?rr(-.06,.04):0;
  for(const s of[-1,1])feet.push({p,s,x:cx+s*.1*p.size,y:TOE_Y-.135*p.size+dy,rot:s*rr(.1,.22),hipX:cx+s*.1,wet:0,sink:rr(0,.004),cover:0,dunk:false});});

/* ---------- shaders ---------- */
const VS=`#version 300 es
in vec2 a;out vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0,1);}`;
// Shared by both passes: noise, the beach window, and the wave fronts from the data texture.
const COMMON=`#version 300 es
precision highp float;
uniform sampler2D uFront;
const float X0=-1.8,X1=1.8,NX=256.;
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
// The wet sand map, in beach coordinates: covered by water now means wet, otherwise it slowly dries.
const STATE_FS=COMMON+`
in vec2 v;out vec4 o;uniform sampler2D uPrev;uniform float uDecay;
void main(){vec2 p=vec2(mix(-1.8,1.8,v.x),mix(-.3,2.2,v.y));float w=texture(uPrev,v).r;
  if(p.y>front(0,p.x)-.004)w=1.;else w=max(0.,w-uDecay);o=vec4(w,0,0,1);}`;
const MAIN_FS=COMMON+`
in vec2 v;out vec4 o;
uniform vec2 uRes;uniform float uT;uniform vec3 uCam,uFwd,uRight,uUp;uniform vec2 uTan;
uniform sampler2D uWet;uniform vec4 uWave[3];uniform vec2 uStrand[3];uniform vec2 uFoamOff;uniform vec4 uSeed[3];uniform float uRip;
uniform vec3 uMoonDir,uMoonCol,uSand;uniform float uBright,uSeaY,uMoonX;
uniform vec4 uBox;uniform int uFeet;uniform vec4 uF[4];uniform vec4 uFP[4];uniform vec4 uSkin[4];uniform vec4 uNail[4];
const float PI=3.14159265;

/* ---- feet: smooth 3D shapes in each foot's own frame (x out to the side, y toward the toes, z up) ---- */
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float sdEll(vec3 p,vec3 r){float k0=length(p/r),k1=length(p/(r*r));return k0*(k0-1.)/k1;}
float sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sdRC(vec3 p,vec3 a,vec3 b,float r1,float r2){vec3 ba=b-a;float l2=dot(ba,ba),rr=r1-r2,a2=l2-rr*rr,il2=1./l2;vec3 pa=p-a;float y=dot(pa,ba),z=y-l2;
  vec3 xv=pa*l2-ba*y;float x2=dot(xv,xv),y2=y*y*l2,z2=z*z*l2,k=sign(rr)*rr*rr*x2;
  if(sign(z)*a2*z2>k)return sqrt(x2+z2)*il2-r2;if(sign(y)*a2*y2<k)return sqrt(x2+y2)*il2-r1;return(sqrt(x2*a2*il2)+y*rr)*il2-r1;}
// Toes, big to little, in a right foot's frame: where each meets the foot, its knuckle, its tip and its thickness.
// The knuckle rides high and the tip curls down to rest a fleshy pad on the sand. The second toe is the longest.
const vec3 TB[5]=vec3[5](vec3(-.028,.082,.021),vec3(-.0065,.091,.017),vec3(.0115,.088,.016),vec3(.027,.082,.015),vec3(.0405,.074,.014));
const vec3 TJ[5]=vec3[5](vec3(-.027,.11,.022),vec3(-.0055,.113,.019),vec3(.0135,.107,.018),vec3(.0295,.099,.0165),vec3(.044,.0885,.015));
const vec3 TT[5]=vec3[5](vec3(-.0255,.137,.0135),vec3(-.0045,.134,.0085),vec3(.0155,.126,.008),vec3(.0315,.116,.0075),vec3(.0465,.102,.007));
const float TR[5]=float[5](.0158,.0101,.0096,.009,.0082);
// COARSE skips the small details (bone knobs, tendons, toe pads) for shadows and occlusion, which don't need them.
bool COARSE=false;
// The distance to one foot, which toe is nearest (-1 for the body of the foot), and how far along that toe's last segment.
vec3 footLocal(vec3 p){
  // Heel, the arch rising to the ankle, and the broad ball of the foot.
  float d=sdEll(p-vec3(0,-.082,.034),vec3(.031,.036,.034));
  d=smin(d,sdRC(p,vec3(0,-.05,.06),vec3(-.004,.056,.021),.034,.023),.035);
  d=smin(d,sdEll(p-vec3(-.003,.068,.018),vec3(.051,.03,.018)),.024);
  d=smin(d,sdEll(p-vec3(.031,.008,.016),vec3(.017,.06,.015)),.024);
  d=smin(d,sdEll(p-vec3(-.027,.004,.025),vec3(.018,.058,.023)),.024);
  // The knobs of bone just behind the toes, and the ankle bones, the inner one higher.
  d=smin(d,sdEll(p-vec3(-.033,-.058,.074),vec3(.01,.013,.012)),.012);d=smin(d,sdEll(p-vec3(.035,-.066,.064),vec3(.009,.012,.011)),.012);
  // Details only matter close to the skin: the bone knobs behind the toes, and tendons up to the front of the ankle.
  if(!COARSE&&d<.012){
    for(int i=0;i<5;i++)d=smin(d,length(p-(TB[i]-vec3(0,.012,.002)))-TR[i]*.95,.01);
    d=smin(d,sdCap(p,TB[0]+vec3(.002,-.004,.012),vec3(-.008,-.036,.068),.0032),.006);
    for(int i=1;i<5;i++)d=smin(d,sdCap(p,TB[i]+vec3(0,-.006,.01),vec3(.004+float(i)*.003,-.034,.066),.0019),.005);}
  // Toes: two segments each, a pad under the tip, and only a slight blend into the foot so each stays separate.
  float td=1e9,ti=-1.,th=0.;
  // The toes sit inside one small sphere: outside it, its distance stands in for all five.
  float tb=length(p-vec3(.009,.106,.014))-.056;
  if(tb>.008)td=tb;else
  for(int i=0;i<5;i++){float r=TR[i];
    float a=sdRC(p,TB[i],TJ[i],r,r*.96);
    vec3 pa=p-TJ[i],ba=TT[i]-TJ[i];float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
    float b=sdRC(p,TJ[i],TT[i],r*.96,r*.82);
    float dd=min(a,b);
    if(!COARSE)dd=smin(dd,sdEll(p-(TT[i]+vec3(0,-.003,-.0015)),vec3(r*.9,r*.95,r*.62)),.004);
    if(dd<td){td=dd;ti=float(i);th=h;}}
  float body=d;d=smin(d,td,.0045);
  if(body<td)ti=-1.;
  d=max(d,-p.z);
  return vec3(d,ti,th);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
vec4 feetSDF(vec3 p){vec4 best=vec4(1e9,0,0,-1);
  for(int i=0;i<4;i++){if(i>=uFeet)break;vec4 F=uF[i],P=uFP[i];float sc=P.w;
    // A capsule around the foot and leg: far from it, its distance is enough and the detailed shape is skipped.
    float bound=sdCap(p,vec3(F.xy,.03),vec3(mix(F.x,P.x,.6),P.y,.52),.17*sc);
    if(bound>.03){if(bound<best.x)best=vec4(bound,0,0,float(i));continue;}
    vec3 q=p-vec3(F.xy,-uSkin[i].w);q.xy=rot(-F.z)*q.xy;q.x*=F.w;q/=sc;
    vec3 f=footLocal(q);float d=f.x*sc;
    // The leg: ankle to knee to hip, running up toward the viewer.
    vec3 ank=vec3(F.xy,0)+vec3(rot(F.z)*vec2(0,-.062*sc),.07*sc),knee=vec3(mix(F.x,P.x,.6),P.y,.5),calf=mix(ank,knee,.55)+vec3(0,-.012,0);
    float leg=min(sdRC(p,ank+vec3(0,0,.012*sc),calf,.03*sc,.05*sc),sdRC(p,calf,knee,.05*sc,.046*sc));
    vec3 fwd=vec3(rot(F.z)*vec2(0,1),0);leg=smin(leg,sdCap(p,ank+fwd*.024*sc+vec3(0,0,.03*sc),knee+fwd*.036*sc,.007*sc),.02*sc);
    d=smin(d,leg,.045*sc);
    if(d<best.x)best=vec4(d,f.y,f.z,float(i));}
  return best;}
// A world point in foot i's own frame, as footLocal sees it.
vec3 footSpace(vec3 p,int i){vec4 F=vec4(0),P=vec4(1);float sink=0.;for(int k=0;k<4;k++)if(k==i){F=uF[k];P=uFP[k];sink=uSkin[k].w;}
  vec3 q=p-vec3(F.xy,-sink);q.xy=rot(-F.z)*q.xy;q.x*=F.w;return q/P.w;}
vec3 feetNormal(vec3 p){vec2 e=vec2(.0006,-.0006);return normalize(e.xyy*feetSDF(p+e.xyy).x+e.yyx*feetSDF(p+e.yyx).x+e.yxy*feetSDF(p+e.yxy).x+e.xxx*feetSDF(p+e.xxx).x);}
float feetShadow(vec3 ro,vec3 rd){COARSE=true;float res=1.,t=.004;for(int i=0;i<22;i++){float h=feetSDF(ro+rd*t).x;res=min(res,10.*h/t);t+=clamp(h,.004,.08);if(res<.02||t>1.2)break;}COARSE=false;return clamp(res,0.,1.);}

/* ---- the beach: sand, water, foam ---- */
float sandH(vec2 p){return vnoise(p*90.)*.25*lod(90.,FW)+vnoise(p*260.)*.12*lod(260.,FW)+fbm(p*14.)*.6+sin(p.y*55.+vnoise(p*6.)*6.)*.06;}
// A scatter of round bits in jittered cells: each cell may hold one, with its own size and colour.
vec4 bits(vec2 p,float cell,float seed){vec2 g=p/cell,i=floor(g),f=fract(g);vec4 r=vec4(0);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y),h=hash2(i+o+seed);float k=hash(i+o+seed+4.);
    float rad=(.08+.26*pow(hash(i+o+seed+8.),3.))*step(.86,k);float d=length(o+h-f);
    float a=1.-smoothstep(rad*.75,rad,d);if(a>r.w)r=vec4(hash(i+o+seed+2.),d/max(rad,.001),k,a);}
  return r;}
vec3 sandAlbedo(vec2 p){float n=fbm(p*7.),g=(vnoise(p*900.)-.5)*lod(900.,FW),g2=(vnoise(p*2600.)-.5)*lod(2600.,FW);
  vec3 c=uSand*(.84+.32*n)*(1.02+.18*g+.1*g2);
  vec4 b=bits(p,.012,3.);b.w*=lod(1./.012,FW*.5);if(b.w>0.){vec3 bc=b.x<.4?uSand*.4:b.x<.75?mix(uSand,vec3(.9,.87,.82),.6):b.x<.9?vec3(.08,.07,.07):vec3(.32,.16,.11);
    bc*=1.-.35*b.y;c=mix(c,bc,b.w*.9);}
  vec4 s=bits(p,.003,11.);s.w*=lod(1./.003,FW*.5);if(s.w>0.)c=mix(c,s.x<.5?c*.6:c*1.3,s.w*.45);
  return c;}
// How deep the water is at a point on the beach, in metres: a film at the edge, deepening toward the sea.
float waterDepth(vec2 p){float f=front(0,p.x),s=p.y-f;if(s<0.)return 0.;return .003+min(s,.6)*.05+max(0.,p.y-uSeaY)*.2;}
// Small ripples on the surface. uRip moves them up the beach with the uprush and back down with the drain.
float rippleH(vec2 p,float drain){
  float h=gfbm(p*vec2(10.,16.)+vec2(0,uRip),16.)*.0011+(gnoise(p*vec2(38.,55.)+vec2(uT*.3,uRip*2.3))-.5)*.00035*lod(55.,FW);
  // Draining water runs in fine grooves straight down the slope.
  h+=(gnoise(vec2(p.x*45.,p.y*4.+uRip*1.5))-.5)*.00018*drain*lod(45.,FW)*smoothstep(.35,.7,gnoise(p*6.+3.));
  return h;}
// Which wave owns this spot, how much foam it carries there, and where that foam has travelled to.
// Running up, the foam rides with the front. From the moment a wave stops, its foam stays put where it reached,
// and stretches into streaks down the slope as the water drains.
// How turbulent the foam is here, and how much spray hangs just ahead of a running front. Set by foamCover.
float CHURN=0.,SPRAY=0.;
float foamCover(vec2 p,out float edge,out vec2 q,out float bore,out float drain){
  float c=0.,best=-1.;edge=0.;bore=0.;drain=0.;q=p;CHURN=0.;SPRAY=0.;
  float upS=9.,backWater=0.;
  for(int i=0;i<3;i++){vec4 W=uWave[i];if(W.y>2.5)continue;float f=front(1+i,p.x),m=front(4+i,p.x),s=p.y-f;
    if(W.y<.5&&s>-.03)upS=min(upS,abs(s));
    if(W.y>1.5&&s>0.)backWater=1.;
    // Spray: a scatter of droplets and bubbles just ahead of a front that's still moving fast.
    if(W.y<.5&&s<0.)SPRAY=max(SPRAY,(1.-smoothstep(0.,.035,-s))*pow(1.-W.x,1.5));
    float up=W.y<.5?1.:0.,b=up>0.?0.:clamp(1.-W.x,0.,1.),k=up>0.?1.:pow(max(W.x,0.),1.4);
    float dense=W.w*(up>0.?1.:.85*k)*(1.-smoothstep(.0,.04+.08*(1.-W.x)*up,s))*step(-.002,s);
    float lace=W.z*(up>0.?1.:.8*k)*(1.-smoothstep(.1,.35+.3*W.x,s))*step(0.,s);
    float ci=max(dense,lace*.8);
    if(W.y<1.5)edge=max(edge,(1.-smoothstep(0.,.006,abs(s-.0015)))*(up>0.?1.:.5));
    if(up>0.)bore=max(bore,.007*exp(-max(s,0.)/.03)*step(0.,s)*(1.-W.x*.7));
    vec2 sd=uSeed[i].xy;
    // Foam behind the front moves slower than the front, so it slips back seaward as the wave runs up.
    // Near the front it churns, settling as the wave slows and drains.
    float lag=min(uSeed[i].z,6.)*.025*smoothstep(0.,.9,s);
    if(ci>best){best=ci;drain=b*step(0.,s);q=up>0.?vec2(p.x+sd.x,s-lag+sd.y):vec2(p.x+sd.x,(p.y-m)*mix(1.,.62,b)-lag+sd.y);
      CHURN=up>0.?exp(-max(s,0.)/.18)*(1.-W.x*.6):.25*(1.-b);}
    c=max(c,ci);}
  // Where a new wave runs into water still draining from the last one, the meeting line churns white and piles up.
  float hit=backWater*exp(-upS/.035)*step(upS,8.)*smoothstep(.25,.75,gnoise(vec2(p.x*7.,uT*.6))+gnoise(vec2(p.x*23.,uT*1.3))*.4);
  if(hit>.01){c=max(c,.8*hit);bore+=.005*hit;CHURN=max(CHURN,hit);edge=max(edge,hit*.3);}
  for(int i=0;i<3;i++){vec2 S=uStrand[i];if(S.y<=0.)continue;float m=front(4+i,p.x),wid=.003+.011*fbm(vec2(p.x*18.,float(i)*7.)),d=abs(p.y-m+.004),ci=S.y*(1.-smoothstep(wid*.5,wid,d))*.95*smoothstep(.25,.5,fbm(vec2(p.x*30.,float(i)*3.)));
    if(ci>best){best=ci;q=vec2(p.x+uSeed[i].x,(p.y-m)*.5+uSeed[i].y);}c=max(c,ci);}
  float sea=smoothstep(uSeaY-.1,uSeaY+.15,p.y);float cs=sea*.35*smoothstep(.3,.7,fbm(p*3.+vec2(0,uT*.1)));if(cs>best)q=p+vec2(0,uT*.01);c=max(c,cs);
  return c;}
// One layer of holes: how far a point is inside the nearest hole's rim. Each hole has its own size.
float holeField(vec2 g,float seed){vec2 i=floor(g),f=fract(g);float best=9.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y),h=hash2(i+o+seed);best=min(best,length(o+.1+.8*h-f)-(.12+.38*hash(i+o+seed+3.)));}
  return best;}
// Foam at foam-space point q, given how much there is (c) and how many metres a pixel covers (fw).
// Three sizes of holes, warped so none is a clean circle, cut a sheet whose thickness peaks along the strands.
// Finer layers fade out once they get smaller than a pixel, so the foam doesn't shimmer.
vec3 foamAt(vec2 q,float c,float fw,out vec2 bub){
  vec2 w=vec2(fbm(q*6.),fbm(q*6.+5.2))-.5;w+=(vec2(vnoise(q*35.),vnoise(q*35.+3.))-.5)*.35;
  // Churn: the lace keeps swirling, so holes open, close and drift while the water is lively.
  w+=(vec2(gnoise(q*12.+vec2(0,uT*.9)),gnoise(q*12.+vec2(7.,uT*.9)))-.5)*.9*CHURN;
  float h1=holeField(q/.055+w*1.6,1.),h2=holeField(q/.019+w*2.4,7.),h3=holeField(q/.007+w*3.,13.);
  float d2=1.-smoothstep(.15,.45,fw/.019),d3=1.-smoothstep(.15,.45,fw/.007);
  float clump=(fbm(q*4.5+11.)-.5)*(1.2-c);
  float t1=h1-mix(.45,-.3,c)-clump+(gnoise(q*9.+uT*.35)-.5)*.25*(.3+CHURN),t2=(h2-mix(.4,-.3,c))*d2+1.*(1.-d2),t3=(h3-mix(.3,-.35,c))*d3+1.*(1.-d3);
  float thick=min(t1*1.,min(t2*.55,t3*.3));
  float aa=max(fw/.055*1.5,.02);
  float f=smoothstep(0.,aa,thick);
  // Bubbles about six millimetres across, each a little dome that catches the moon.
  vec2 g=q/.006,ci=floor(g),cf=fract(g);float bd=9.;bub=vec2(0);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y),h=hash2(ci+o+21.);float r=.35+.3*hash(ci+o+29.);vec2 dv=(cf-(o+.2+.6*h))/r;float dd=dot(dv,dv);if(dd<bd){bd=dd;bub=dv;}}
  bub*=(1.-smoothstep(.2,.6,fw/.006))*step(bd,1.);
  return vec3(f,clamp(thick*3.,0.,1.),smoothstep(-.25,0.,thick));}

/* ---- light ---- */
float ggx(vec3 n,vec3 h,float r){float a=r*r,a2=a*a,d=max(dot(n,h),0.);float k=d*d*(a2-1.)+1.;return a2/(PI*k*k);}
vec3 sky(vec3 d){return mix(vec3(.012,.017,.03),vec3(.03,.04,.065),smoothstep(-.1,.5,d.z))*uBright;}
vec3 shadeSurface(vec3 alb,vec3 n,vec3 vdir,float rough,float f0,float sh){
  vec3 L=uMoonDir,h=normalize(L+vdir);float nl=max(dot(n,L),0.);
  float F=f0+(1.-f0)*pow(1.-max(dot(n,vdir),0.),5.);
  vec3 diff=alb*(uMoonCol*nl*sh+sky(n)*2.2);
  vec3 spec=uMoonCol*ggx(n,h,rough)*F*nl*sh*.25;
  return diff+spec;}

void main(){
  vec2 uv=v*2.-1.;
  vec3 rd=normalize(uFwd+uv.x*uTan.x*uRight+uv.y*uTan.y*uUp),ro=uCam;
  vec3 vdir=-rd;vec3 col;
  // The beach: where the ray meets the ground.
  float tg=-ro.z/rd.z;vec3 P=ro+rd*tg;vec2 p=P.xy;FW=length(fwidth(p));
  // The feet, if the ray meets one before the ground.
  float tf=1e9;vec4 hit=vec4(0);
  {vec3 bmin=vec3(-.8,-.2,-.01),bmax=vec3(.8,.75,.6);vec3 i0=(bmin-ro)/rd,i1=(bmax-ro)/rd;vec3 lo=min(i0,i1),hi=max(i0,i1);
   float t0=max(max(lo.x,lo.y),lo.z),t1=min(min(hi.x,hi.y),hi.z);
   if(t1>max(t0,0.)){float t=max(t0,0.);for(int i=0;i<110;i++){vec4 h=feetSDF(ro+rd*t);if(h.x<.0004){tf=t;hit=h;break;}t+=h.x*.9;if(t>t1)break;}}}
  float wd=waterDepth(p);
  // Sand dries unevenly, so the edge of the wet patch is mottled rather than a clean line.
  float wet=max(texture(uWet,vec2((p.x+1.8)/3.6,(p.y+.3)/2.5)).r,smoothstep(1.,1.4,p.y));
  float fresh=smoothstep(.9,1.,wet);
  wet=smoothstep(.0,.6,wet+(fbm(p*22.)-.5)*.45+(vnoise(p*90.)-.5)*.16+(vnoise(p*300.)-.5)*.08*lod(300.,FW));
  float edge,bore,drain;vec2 fq;float cov=foamCover(p,edge,fq,bore,drain);
  if(tf<tg){
    vec3 X=ro+rd*tf,n=feetNormal(X);int fi=int(hit.w);vec4 S=uSkin[fi];vec3 skin=S.rgb;
    vec4 FF=uF[fi];float hair=uFP[fi].z,wetF=uNail[fi].w;vec3 q=footSpace(X,fi);float toe=hit.y,along=hit.z;
    // Nails: on top of each toe's last segment, with a pale half-moon at the base and a whiter free edge.
    float nail=0.,lunula=0.,edgeW=0.,rimN=0.;vec3 axW=vec3(0,1,0);float knuckle=0.;
    if(toe>-.5){int k=int(toe);vec3 J=TJ[k],T=TT[k];float r=TR[k];vec3 ax=normalize(T-J);
      vec3 pj=q-J;float u=dot(pj,ax)/length(T-J);vec3 side=normalize(cross(ax,vec3(0,0,1)));float lat=dot(pj,side);
      float nw=r*(k==0?.74:.64);
      nail=(1.-smoothstep(nw*.8,nw,abs(lat)))*smoothstep(.3,.42,u)*(1.-smoothstep(.96,1.04,u))*smoothstep(.15,.45,n.z);
      lunula=nail*(1.-smoothstep(.34,.42,u));edgeW=nail*smoothstep(.9,.98,u);
      // A thin darker rim where the skin folds over the nail at its sides and base.
      rimN=nail*max(1.-smoothstep(0.,.18,(nw-abs(lat))/nw),1.-smoothstep(.3,.36,u));
      // Fine creases across the top of each toe joint.
      vec3 pb=q-mix(TB[k],J,.85);float kd=dot(pb,normalize(J-TB[k]));knuckle=sin(kd*2400.)*exp(-kd*kd/(r*r*.35))*(1.-nail);
      vec2 a2=ax.xy;a2.x*=FF.w;a2=rot(FF.z)*a2;axW=normalize(vec3(a2,ax.z));}
    // Skin: uneven in tone, flushed toward the toe tips, with pores and creases in its surface.
    vec3 alb=skin*(1.+.08*(fbm(X.xy*150.+X.z*40.)-.5)+.04*(vnoise(X.yz*420.)-.5));
    float flush=toe>-.5?.4+.6*along:smoothstep(.06,.0,X.z)*.3;
    alb=mix(alb,alb*vec3(1.1,.84,.82),flush*.35);
    // Fine hair down the shin.
    if(hair>0.&&X.z>.08){vec2 sd=rot(FF.z)*vec2(1,0);float hx=dot(X.xy,sd);float hs=smoothstep(.8,.93,vnoise(vec2(hx*1800.,X.z*110.)))*smoothstep(.08,.14,X.z)*lod(1800.,FW*.8);alb*=1.-.22*hs*hair;}
    vec3 nailC=uNail[fi].rgb;alb=mix(alb,mix(nailC,vec3(.84,.78,.74),lunula*.15+edgeW*.3)*mix(1.,.75,rimN),nail);
    alb*=mix(1.,.86,wetF*(1.-nail));
    vec3 bn=normalize(n+vec3(vnoise(X.xy*1100.)-.5,vnoise(X.yz*1100.+3.)-.5,vnoise(X.xz*1100.+7.)-.5)*.07*(1.-nail)+axW*knuckle*.07);
    float sh=feetShadow(X+n*.002,uMoonDir);
    COARSE=true;float ao=0.;for(int i=1;i<=4;i++){float h=.005*float(i);ao+=(h-feetSDF(X+n*h).x)/h;}ao=clamp(1.-ao*.24,0.,1.);COARSE=false;
    // Light spreads further through skin in red than in blue, so shadows turn warm, and thin edges glow red.
    vec3 L=uMoonDir;float nl=dot(bn,L);vec3 wr=vec3(.6,.36,.26);vec3 diff=max((vec3(nl)+wr)/(1.+wr),0.);
    col=alb*uMoonCol*diff*sh+alb*sky(bn)*2.4*ao;
    float rimT=pow(1.-max(dot(n,vdir),0.),3.)*(.5+.5*max(-dot(n,L),0.));col+=skin*vec3(.9,.22,.15)*uMoonCol*rimT*.22*sh;
    // Shine: a broad soft sheen and a tighter oily one, a sharp one when wet, and glossy nails.
    vec3 h=normalize(L+vdir);float F=.028+.972*pow(1.-max(dot(bn,vdir),0.),5.);
    float spec=ggx(bn,h,.62)*.45+ggx(bn,h,.36)*.3+wetF*ggx(n,h,.14)*.55+nail*ggx(n,h,.12)*.8;
    col+=uMoonCol*spec*F*max(nl,0.)*sh;
    col*=mix(.55,1.,ao);
    // Water running over the top of the foot, and foam where the water surface meets the skin.
    float wl=wd*.9;if(X.z<wl&&wd>0.){float dep=wl-X.z;col*=exp(-dep*vec3(60.,24.,18.));col+=vec3(.6,.7,.8)*uMoonCol*.02;}
    float ring=wd>.004?(1.-smoothstep(.0,.0035,abs(X.z-wl)))*smoothstep(.004,.01,wd)*smoothstep(.35,.65,vnoise(X.xy*500.)+vnoise(X.xy*150.)*.4):0.;
    col=mix(col,vec3(.8,.84,.88)*(uMoonCol*.5+sky(vec3(0,0,1))*3.),ring*.55);
  }else{
    // Sand: relief from grains and ripples, darker and shinier where wet.
    vec2 e=vec2(.0015,0);float h0=sandH(p),hx=sandH(p+e.xy),hy=sandH(p+e.yx);vec3 n=normalize(vec3(-(hx-h0)/e.x*.004,-(hy-h0)/e.x*.004,1.));
    // Shadows from the feet, worked out only in the box around them and their shadows.
    float sh=1.;bool nearFeet=p.x>uBox.x&&p.x<uBox.z&&p.y>uBox.y&&p.y<uBox.w;
    if(nearFeet){sh=feetShadow(vec3(p,.001),uMoonDir);float near=feetSDF(vec3(p,.004)).x;sh*=mix(.35,1.,smoothstep(.0,.02,near));}
    vec3 alb=sandAlbedo(p);
    vec3 dry=shadeSurface(alb,n,vdir,.85,.03,sh);
    vec3 wa=alb*vec3(.62,.63,.66);vec3 wn=normalize(mix(n,vec3(0,0,1),.6));
    vec3 wetC=shadeSurface(wa,wn,vdir,.32,.04,sh);
    col=mix(dry,wetC,wet);
    // Sand the water has only just left still holds a film: smoother, reflecting the sky, and glittering where grains catch the moon.
    if(fresh>0.){vec3 fn0=normalize(mix(n,vec3(0,0,1),.85));vec3 hv0=normalize(uMoonDir+vdir);
      float F0=.02+.98*pow(1.-max(dot(fn0,vdir),0.),5.);
      col=mix(col,col*.9+sky(reflect(rd,fn0))*F0*1.2+uMoonCol*ggx(fn0,hv0,.12)*.05*sh,fresh*.8);
      vec4 gl0=bits(p,.004,41.);float glint=step(.93,gl0.x)*gl0.w*lod(1./.004,FW*.6);
      col+=uMoonCol*glint*fresh*sh*.35;}
    // Just ahead of the water the sand is soaked darker, right up to the edge.
    float ahead=front(0,p.x)-p.y;if(ahead>0.)col*=1.-.3*exp(-ahead/.012);
    float fw=length(fwidth(p));
    if(wd>0.){
      // Water: a surface of depth, the lip of an incoming wave and ripples, which bends the view of the sand,
      // focuses moonlight into faint caustics on it, soaks up red light with depth and mirrors the moon.
      float dr=drain;wd=wd*mix(1.,.45,dr)+bore;
      float amp=smoothstep(.0,.008,wd);
      vec2 e2=vec2(.003,0);
      // Five ripple samples give both the slope of the surface and its curvature, which focuses the caustics.
      float R0=rippleH(p,dr),Rxp=rippleH(p+e2.xy,dr),Rxm=rippleH(p-e2.xy,dr),Ryp=rippleH(p+e2.yx,dr),Rym=rippleH(p-e2.yx,dr);
      float D0=waterDepth(p),gx=(waterDepth(p+e2.xy)-D0)/e2.x*mix(1.,.45,dr)+(Rxp-Rxm)/(2.*e2.x)*amp,gy=(waterDepth(p+e2.yx)-D0)/e2.x*mix(1.,.45,dr)+(Ryp-Rym)/(2.*e2.x)*amp;
      vec3 wn2=normalize(vec3(-gx,-gy,1.));
      vec2 rp=p-wn2.xy*wd*.8;vec3 ra=sandAlbedo(rp)*vec3(.62,.63,.66);
      float lap=(Rxp+Rxm+Ryp+Rym-4.*R0)*amp;
      float caust=clamp(1.-lap*1.1e4,.6,1.8);
      float rsh=nearFeet?sh:1.;
      vec3 under=ra*(uMoonCol*max(uMoonDir.z,0.)*rsh*caust+sky(vec3(0,0,1))*2.2);
      under*=exp(-wd*vec3(26.,10.,7.));under+=vec3(.012,.03,.035)*uMoonCol*(1.-exp(-wd*8.));
      float F=.02+.98*pow(1.-max(dot(wn2,vdir),0.),5.);
      vec3 hv=normalize(uMoonDir+vdir);float glint=ggx(wn2,hv,.05);
      vec3 refl=sky(reflect(rd,wn2))+uMoonCol*glint*.5;
      col=mix(under,refl,F)+uMoonCol*glint*.04*rsh;
      // The thin edge of the water catches a bright line, and the lip of a wave running up catches more.
      col+=uMoonCol*(edge*.22+smoothstep(.002,.007,bore)*.05);
    }
    // Foam: thick bright strands that thin to translucent lace at their edges, bubbles that catch the moon,
    // water darkened in the shade at the rim of each hole, and a faint shadow on the sand beneath.
    if(cov>.01){vec2 bub;vec3 fa=foamAt(fq,cov,fw,bub);float f=fa.x,th=fa.y;
      col*=1.-.25*cov*(1.-fa.z)*(1.-f);
      vec3 fn=normalize(vec3(bub*.9+(vec2(vnoise(fq*300.),vnoise(fq*300.+4.))-.5)*.5,1.));
      float lam=max(dot(fn,uMoonDir),0.);
      // Each bubble is darker at its rim and bright where its dome faces the moon.
      float ring=length(bub);float bubShade=1.-.28*smoothstep(.55,1.,ring)*step(.001,ring);
      vec3 fc=vec3(.88,.9,.93)*mix(.68,1.12,th)*bubShade;
      vec3 lit=fc*(uMoonCol*(lam*.75+.3)*sh+sky(fn)*3.2)+uMoonCol*ggx(fn,normalize(uMoonDir+vdir),.12)*.14*sh*(.3+th);
      col=mix(col,lit,f*mix(.42,1.,th));}
    // Spray: droplets and flecks of foam that flicker in and out just ahead of a fast front.
    if(SPRAY>.01){vec2 g=p/.004,ci=floor(g),cf=fract(g);float fr=floor(uT*9.);float h=hash(ci+fr*.37);
      vec2 o=hash2(ci+fr*.61)*.6+.2;float dot0=(1.-smoothstep(.12,.3,length(cf-o)))*step(.82,h)*lod(1./.004,FW*.7);
      col=mix(col,vec3(.85,.88,.92)*(uMoonCol*.9*sh+sky(vec3(0,0,1))*3.),dot0*SPRAY);}
  }
  // Exposure, a filmic curve, a cool night grade, vignette and a little grain.
  col*=1.45;col=(col*(2.51*col+.03))/(col*(2.43*col+.59)+.14);
  float l=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(l),col,.72)*vec3(.93,.98,1.06);
  col*=1.-.42*pow(length(uv*vec2(.85,1.)),2.2)*.5;
  col=pow(max(col,0.),vec3(1./2.2));
  col+=(hash(gl_FragCoord.xy+fract(uT*7.)*91.)-.5)*.025;
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
for(let i=0;i<2;i++){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,WS,WS,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  for(const k of[gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.LINEAR);
  for(const k of[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
  const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
  gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);wetTex.push(t);wetFb.push(f);}
gl.bindFramebuffer(gl.FRAMEBUFFER,null);
let wetI=0,wetT=0;

/* ---------- waves ---------- */
let t=0,bright=1,brightTo=1,cloudEnd=0,foamOX=0,foamOY=0,lastMid=SEA.y,rip=0;
const waves=[],stats={waves:0,reached:0,short:0};
const xAt=i=>-1.8+i*3.6/(NX-1);
function phase(w,tt){const x=tt-w.t0;if(x<0)return[0,0];if(x<w.up){const k=x/w.up;return[1-Math.pow(1-k,2.3),0];}
  if(x<w.up+w.hold)return[1,1];const k=(x-w.up-w.hold)/w.down;return k>=1?[0,3]:[1-Math.pow(k,1.7)*(1-.15*Math.sin(k*Math.PI)),2];}
function tide(){return(fbm(t*.0015+SEA.tideO)-.5)*.1+SEA.tide*Math.min(1,t/1800)*.05;}
function newWave(kind){
  kind=kind||wpick([['short',.42],['touch',.4],['past',.18]]);
  const reach=kind==='short'?TOE_Y+rr(.02,.22):kind==='touch'?lerp(ANKLE_Y,TOE_Y,rr(.05,.95)):ANKLE_Y-rr(.04,.3);
  waves.push({kind,t0:t,up:rr(2.4,3.8),hold:rr(.2,.7),down:rr(4,6.5),reach:clamp(reach-tide()*SEA.energy,-.1,SEA.y-.2),
    a1:rr(.02,.05),l1:rr(1.2,2.6),p1:rr(0,6.3),a2:rr(.008,.022),l2:rr(3.5,7),p2:rr(0,6.3),nO:rr(0,500),obl:rr(-.5,.5),
    lace:rr(.55,1),dense:rr(.7,1),sx:rr(0,50),sy:rr(0,50),front:new Float32Array(NX),max:new Float32Array(NX).fill(9),st:0,logged:false,strand:0,strandLife:rr(6,14)});
  stats.waves++;
}
function waveFront(w){const top=SEA.y+.15;let st=0;
  for(let i=0;i<NX;i++){const x=xAt(i),[p,s]=phase(w,t-w.obl*(x/1.8)*.5);st=Math.max(st,s);
    const lobe=w.a1*Math.sin(x*Math.PI*w.l1+w.p1)+w.a2*Math.sin(x*Math.PI*w.l2+w.p2)+.035*(fbm(x*4+w.nO)-.5)+.012*(fbm(x*13+w.nO+40)-.5);
    // While it runs up, the front pushes ahead in shifting fingers that settle as it slows.
    const finger=s===0?(fbm(x*16+t*.9+w.nO)-.5)*.018*(1-p*.7):0;
    w.front[i]=top-(top-(w.reach+lobe))*p+finger;if(w.front[i]<w.max[i])w.max[i]=w.front[i];}
  return st;}
const frontAt=(row,x)=>{const u=clamp((x+1.8)/3.6,0,1)*(NX-1),i=Math.floor(u),j=Math.min(NX-1,i+1);return lerp(FRONT[row*NX+i],FRONT[row*NX+j],u-i);};
let nextWave=0;
const SCHED={cloud:{m:220,f:90}},nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
const cm=m=>Math.max(1,Math.round(m*100));
function update(dt){
  t+=dt;
  if(t>=nextWave){newWave();nextWave=t+(4.2+expo(4.8))/SEA.energy;}
  for(const k in SCHED){nextEv[k]-=dt;if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);if(brightTo===1){brightTo=rr(.45,.7);cloudEnd=t+rr(25,70);NightCity.log('A cloud slides over the moon and the beach goes dim');}}}
  if(cloudEnd&&t>cloudEnd){brightTo=1;cloudEnd=0;NightCity.log('The cloud passes and the moonlight comes back');}
  bright+=(brightTo-bright)*ease(dt,6);
  for(let i=0;i<NX;i++)FRONT[i]=SEA.y+.01*Math.sin(xAt(i)*4+t*.7);
  for(const w of waves){w.st=waveFront(w);for(let i=0;i<NX;i++)FRONT[i]=Math.min(FRONT[i],w.front[i]);
    if(w.st>=1&&!w.logged){w.logged=true;logWave(w);}
    if(w.st>=2&&!w.strand)w.strand=t;}
  for(let i=waves.length-1;i>=0;i--){const w=waves[i];if(w.st===3&&t-w.strand>w.strandLife)waves.splice(i,1);}
  // Ripples drift up the beach with the newest wave running up, and back down while it drains.
  const lead=waves.filter(w=>w.st<3).slice(-1)[0];rip+=dt*(lead&&lead.st===0?.3:-.12);
  const mid=frontAt(0,0),d=mid-lastMid;lastMid=mid;foamOY+=d<0?d:d*.55;foamOX+=dt*.004;
  for(const f of feet){const depth=f.y+.13*f.p.size-frontAt(0,f.x);
    if(depth>0){f.wet=1;if(!f.dunk){f.dunk=true;if(depth>.08)f.sink=Math.min(.012,f.sink+rr(.001,.0025));}}else if(depth<-.03)f.dunk=false;
    f.wet=Math.max(0,f.wet-dt/40);}
}
function logWave(w){
  let near=1e9,hit=0;for(const f of feet){const g=frontAt(0,f.x)-(f.y+.13*f.p.size);near=Math.min(near,g);if(g<0)hit++;}
  const feetWord=people.length>1?'all four feet':'both feet';
  if(!hit){stats.short++;NightCity.log(pick([`A wave runs up and stops ${cm(near)} cm short of the toes`,`The water slides up and falls ${cm(near)} cm short`]));}
  else{stats.reached++;const past=Math.min(...w.max)<ANKLE_Y-.08;
    NightCity.log(past?`A bigger wave runs past ${feetWord} and up the beach`:hit>=feet.length?pick([`A wave washes over ${feetWord} and pulls back`,`Cold water swirls around ${feetWord}`]):'A wave just reaches the toes of one foot');}
}

/* ---------- drawing ---------- */
let CW=0,CH=0,DPR=1;
const SCALE=parseFloat(new URLSearchParams(location.search).get('glq'))||1;
function build(){
  CW=Math.max(240,innerWidth);CH=Math.max(240,innerHeight);
  DPR=(LOWQ?.55:Math.min(1.25,devicePixelRatio||1)*.85)*SCALE;
  const maxPx=LOWQ?6e5:1.3e6;if(CW*CH*DPR*DPR>maxPx)DPR=Math.sqrt(maxPx/(CW*CH));
  cv.width=Math.round(CW*DPR);cv.height=Math.round(CH*DPR);
}
// The camera: at eye height a little behind the feet, looking down and forward toward the sea.
// ZOOM narrows the view onto the feet, for looking at them closely in ?debug.
let ZOOM=1;
function camera(){const asp=CW/CH,cam=[0,.06,1.42],target=[0,lerp(.6,TOE_Y-.1,1-1/ZOOM),0];
  const f=norm(sub(target,cam)),r=norm(cross(f,[0,0,1])),u=cross(r,f);
  // On a tall screen, keep about the same view up and down and crop the sides, so the legs don't fill the frame.
  const tanY=(asp<1?Math.tan(.3)*1.22:Math.tan(.3))/ZOOM,tanX=tanY*asp;return{cam,f,r,u,tanX,tanY};}
const sub=(a,b)=>a.map((v,i)=>v-b[i]),norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const MOON_DIR=norm([SEA.moonX,.78,.56]);
// Wet sand: mark what the water covers and let the rest dry. Runs a few times a second, reading the fronts already uploaded.
function wetPass(){gl.useProgram(STATE.p);gl.bindFramebuffer(gl.FRAMEBUFFER,wetFb[1-wetI]);gl.viewport(0,0,WS,WS);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,frontTex);gl.uniform1i(STATE.u.uFront,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,wetTex[wetI]);gl.uniform1i(STATE.u.uPrev,1);gl.uniform1f(STATE.u.uDecay,1/255);
  gl.drawArrays(gl.TRIANGLES,0,3);wetI=1-wetI;gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
function draw(){
  // Rows 1 to 6: each recent wave's front and the furthest it reached. Empty slots sit far up the beach.
  const slots=waves.slice(-3);
  for(let s=0;s<3;s++){const w=slots[s];for(let i=0;i<NX;i++){FRONT[(1+s)*NX+i]=w?w.front[i]:9;FRONT[(4+s)*NX+i]=w?w.max[i]:9;}}
  gl.bindTexture(gl.TEXTURE_2D,frontTex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,NX,7,gl.RED,gl.FLOAT,FRONT);
  wetT+=1/60;if(wetT>.2){wetT=0;wetPass();}
gl.bindFramebuffer(gl.FRAMEBUFFER,wetFb[1-wetI]);gl.viewport(0,0,WS,WS);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,frontTex);gl.uniform1i(STATE.u.uFront,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,wetTex[wetI]);gl.uniform1i(STATE.u.uPrev,1);gl.uniform1f(STATE.u.uDecay,1/255);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cv.width,cv.height);gl.useProgram(MAIN.p);const U=MAIN.u;
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,frontTex);gl.uniform1i(U.uFront,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,wetTex[wetI]);gl.uniform1i(U.uWet,1);
  const C=camera();gl.uniform3fv(U.uCam,C.cam);gl.uniform3fv(U.uFwd,C.f);gl.uniform3fv(U.uRight,C.r);gl.uniform3fv(U.uUp,C.u);gl.uniform2f(U.uTan,C.tanX,C.tanY);
  gl.uniform2f(U.uRes,cv.width,cv.height);gl.uniform1f(U.uT,t);
  const W=[],S=[];for(let s=0;s<3;s++){const w=slots[s];if(!w){W.push(0,3,0,0);S.push(0,0);continue;}const[p,st]=phase(w,t);W.push(p,w.st===3?3:st,w.lace,w.dense);
    S.push(0,w.strand?Math.max(0,1-(t-w.strand)/w.strandLife)*w.lace:0);}
  gl.uniform4fv(U.uSeed,[0,1,2].flatMap(i=>slots[i]?[slots[i].sx,slots[i].sy,t-slots[i].t0,0]:[0,0,0,0]));gl.uniform1f(U.uRip,rip);
  gl.uniform4fv(U.uWave,W);gl.uniform2fv(U.uStrand,S);gl.uniform2f(U.uFoamOff,foamOX,-foamOY);
  gl.uniform3fv(U.uMoonDir,MOON_DIR);gl.uniform3fv(U.uMoonCol,MOON.c.map(v=>v*.4*bright));gl.uniform3fv(U.uSand,lin(SAND.c));
  gl.uniform1f(U.uBright,bright);gl.uniform1f(U.uSeaY,SEA.y);gl.uniform1f(U.uMoonX,SEA.moonX);
  const F=[],FP=[],SK=[],NL=[];
  for(let i=0;i<4;i++){const f=feet[i];if(!f){F.push(0,0,0,1);FP.push(0,0,0,1);SK.push(0,0,0,0);NL.push(0,0,0,0);continue;}
    F.push(f.x,f.y,f.rot,f.s);FP.push(f.hipX,.02,f.p.hair,f.p.size);SK.push(...lin(f.p.skin),f.sink);
    const nail=f.p.nails?lin(f.p.nails):lin(f.p.skin.map((v,i)=>Math.min(255,v*.8+[46,26,30][i])));NL.push(...nail,f.wet);}
  {let x0=9,x1=-9,y0=9,y1=-9;for(const f of feet){x0=Math.min(x0,f.x);x1=Math.max(x1,f.x);y0=Math.min(y0,f.y);y1=Math.max(y1,f.y);}
   gl.uniform4f(U.uBox,x0-.12,y0-.42,x1+.12,y1+.18);}
  gl.uniform1i(U.uFeet,feet.length);gl.uniform4fv(U.uF,F);gl.uniform4fv(U.uFP,FP);gl.uniform4fv(U.uSkin,SK);gl.uniform4fv(U.uNail,NL);
  gl.drawArrays(gl.TRIANGLES,0,3);
}

/* ---------- start ---------- */
if(DEBUG)window.SH={gl:true,set zoom(v){ZOOM=v;},readWet(){const px=new Uint8Array(WS*WS*4);gl.bindFramebuffer(gl.FRAMEBUFFER,wetFb[wetI]);gl.readPixels(0,0,WS,WS,gl.RGBA,gl.UNSIGNED_BYTE,px);gl.bindFramebuffer(gl.FRAMEBUFFER,null);const col=[];for(let y=0;y<WS;y+=32)col.push(px[(y*WS+128)*4]);return{status:gl.checkFramebufferStatus(gl.FRAMEBUFFER),col};},waves,feet,people,stats,newWave,get t(){return t;},get paused(){return NightCity.paused;},set paused(v){NightCity.paused=v;},
  draw:()=>draw(),step:dt=>update(dt),run(sec){for(let i=0;i<sec*60;i++)update(1/60);draw();NightCity.refresh();}};
build();
for(let i=0;i<30*14;i++){update(1/30);if(i%6===5){gl.bindTexture(gl.TEXTURE_2D,frontTex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,NX,7,gl.RED,gl.FLOAT,FRONT);wetPass();}}
stats.waves=stats.reached=stats.short=0;
NightCity.log(`${MOON.name[0].toUpperCase()+MOON.name.slice(1)} moonlight on ${SAND.name} sand. ${people.length>1?'Two pairs':'A pair'} of bare feet at the water's edge (WebGL prototype)`);
NightCity.run({step:1/60,update,draw,ui:()=>NightCity.stats(stats)});
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{build();draw();},200);});
})();
