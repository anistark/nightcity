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
const people=[person()];if(chance(.3))people.push(person());
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
const float X0=-1.8,X1=1.8,NX=128.;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 hash2(vec2 p){return vec2(hash(p),hash(p+19.19));}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+17.1;a*=.5;}return s;}
// The y of a wave front at x. Row 0 is the water's edge now, rows 1 to 3 each wave's front, 4 to 6 the furthest each reached.
float front(int row,float x){float u=clamp((x-X0)/(X1-X0),0.,1.)*(NX-1.);int i=int(floor(u));
  float a=texelFetch(uFront,ivec2(i,row),0).r,b=texelFetch(uFront,ivec2(min(i+1,127),row),0).r;return mix(a,b,fract(u));}
`;
// The wet sand map, in beach coordinates: covered by water now means wet, otherwise it slowly dries.
const STATE_FS=COMMON+`
in vec2 v;out vec4 o;uniform sampler2D uPrev;uniform float uDecay;
void main(){vec2 p=vec2(mix(-1.8,1.8,v.x),mix(-.3,2.2,v.y));float w=texture(uPrev,v).r;
  if(p.y>front(0,p.x)-.004)w=1.;else w=max(0.,w-uDecay);o=vec4(w,0,0,1);}`;
const MAIN_FS=COMMON+`
in vec2 v;out vec4 o;
uniform vec2 uRes;uniform float uT;uniform vec3 uCam,uFwd,uRight,uUp;uniform vec2 uTan;
uniform sampler2D uWet;uniform vec4 uWave[3];uniform vec2 uStrand[3];uniform vec2 uFoamOff;
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
const vec3 TB[5]=vec3[5](vec3(-.027,.086,.018),vec3(-.005,.094,.014),vec3(.013,.091,.013),vec3(.028,.085,.012),vec3(.041,.077,.011));
const vec3 TT[5]=vec3[5](vec3(-.026,.138,.0145),vec3(-.005,.13,.0105),vec3(.014,.124,.0098),vec3(.03,.115,.009),vec3(.044,.104,.0082));
// Returns distance, and which toe is nearest with how far along it, for the nails.
vec3 footLocal(vec3 p){
  float d=sdEll(p-vec3(0,-.078,.036),vec3(.032,.042,.036));
  d=smin(d,sdRC(p,vec3(0,-.055,.058),vec3(-.004,.058,.022),.033,.024),.035);
  d=smin(d,sdEll(p-vec3(-.003,.07,.019),vec3(.05,.034,.019)),.025);
  d=smin(d,sdEll(p-vec3(.03,.005,.017),vec3(.018,.062,.016)),.025);
  d=smin(d,sdEll(p-vec3(-.026,.0,.024),vec3(.018,.06,.022)),.025);
  d=smin(d,length(p-vec3(-.032,-.06,.072))-.011,.012);d=smin(d,length(p-vec3(.034,-.066,.066))-.01,.012);
  float td=1e9,ti=0.,th=0.;
  for(int i=0;i<5;i++){vec3 a=TB[i],b=vec3(TT[i].xy,TT[i].z);float r=TT[i].z;vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
    float rad=r*(1.-.1*h)*(i==0?1.08:1.);float dd=length(pa-ba*h)-rad;if(dd<td){td=dd;ti=float(i);th=h;}}
  d=smin(d,td,.005);
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
    float leg=min(sdRC(p,ank,calf,.033*sc,.05*sc),sdRC(p,calf,knee,.05*sc,.046*sc));
    d=smin(d,leg,.03*sc);
    if(d<best.x)best=vec4(d,f.y,f.z,float(i));}
  return best;}
vec3 feetNormal(vec3 p){vec2 e=vec2(.0006,-.0006);return normalize(e.xyy*feetSDF(p+e.xyy).x+e.yyx*feetSDF(p+e.yyx).x+e.yxy*feetSDF(p+e.yxy).x+e.xxx*feetSDF(p+e.xxx).x);}
float feetShadow(vec3 ro,vec3 rd){float res=1.,t=.004;for(int i=0;i<22;i++){float h=feetSDF(ro+rd*t).x;res=min(res,10.*h/t);t+=clamp(h,.004,.08);if(res<.02||t>1.2)break;}return clamp(res,0.,1.);}

/* ---- the beach: sand, water, foam ---- */
float sandH(vec2 p){return vnoise(p*90.)*.25+vnoise(p*260.)*.12+fbm(p*14.)*.6+sin(p.y*55.+vnoise(p*6.)*6.)*.06;}
// A scatter of round bits in jittered cells: each cell may hold one, with its own size and colour.
vec4 bits(vec2 p,float cell,float seed){vec2 g=p/cell,i=floor(g),f=fract(g);vec4 r=vec4(0);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y),h=hash2(i+o+seed);float k=hash(i+o+seed+4.);
    float rad=(.08+.26*pow(hash(i+o+seed+8.),3.))*step(.86,k);float d=length(o+h-f);
    float a=1.-smoothstep(rad*.75,rad,d);if(a>r.w)r=vec4(hash(i+o+seed+2.),d/max(rad,.001),k,a);}
  return r;}
vec3 sandAlbedo(vec2 p){float n=fbm(p*7.),g=vnoise(p*900.),g2=vnoise(p*2600.);
  vec3 c=uSand*(.84+.32*n)*(.88+.18*g+.1*g2);
  vec4 b=bits(p,.012,3.);if(b.w>0.){vec3 bc=b.x<.4?uSand*.4:b.x<.75?mix(uSand,vec3(.9,.87,.82),.6):b.x<.9?vec3(.08,.07,.07):vec3(.32,.16,.11);
    bc*=1.-.35*b.y;c=mix(c,bc,b.w*.9);}
  vec4 s=bits(p,.003,11.);if(s.w>0.)c=mix(c,s.x<.5?c*.6:c*1.3,s.w*.45);
  return c;}
// How deep the water is at a point on the beach, in metres: a film at the edge, deepening toward the sea.
float waterDepth(vec2 p){float f=front(0,p.x),s=p.y-f;if(s<0.)return 0.;return .003+min(s,.6)*.05+max(0.,p.y-uSeaY)*.2;}
vec2 ripple(vec2 p){float t=uT;vec2 q=p*vec2(9.,14.)+vec2(0,t*1.6);
  float h0=fbm(q),hx=fbm(q+vec2(.02,0)),hy=fbm(q+vec2(0,.02));vec2 g=vec2(hx-h0,hy-h0)/.02;
  q=p*vec2(28.,40.)+vec2(t*.3,t*2.5);float k0=vnoise(q),kx=vnoise(q+vec2(.05,0)),ky=vnoise(q+vec2(0,.05));g+=vec2(kx-k0,ky-k0)/.05*.25;
  return g;}
// Foam: holes punched in a sheet of bubbles. c is how much foam there is, from none to a solid sheet;
// as it drops the same holes grow and join up. Two sizes of holes, warped so none is a clean circle.
float holes(vec2 p,float cell,float seed,out float rim){vec2 g=p/cell+vec2(fbm(p*7.+seed),fbm(p*7.+seed+5.))*1.6+vec2(vnoise(p*40.+seed),vnoise(p*40.+seed+2.))*.35;vec2 i=floor(g),f=fract(g);float best=9.,rad=0.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y);vec2 h=hash2(i+o+seed);float d=length(o+.1+.8*h-f)-hash(i+o+seed+7.)*.4;if(d<best){best=d;rad=hash(i+o+seed+3.);}}
  rim=best;return best+.25*rad;}
float foam(vec2 p,float c,out float shade){
  if(c<.01){shade=0.;return 0.;}
  p+=uFoamOff;float r1,r2;float a=holes(p,.045,1.,r1),b=holes(p,.014,9.,r2);
  float t1=mix(.85,-.1,c),t2=mix(.62,-.25,c);
  float bub=vnoise(p*1400.)*.18+vnoise(p*420.)*.14;
  float f=smoothstep(t1-.04,t1+.08,a+bub-.12)*smoothstep(t2-.05,t2+.1,b+bub*.6-.06);
  f*=smoothstep(.1,.35,fbm(p*6.)+c*.5);
  shade=.85+.15*hash(floor(p*900.))-.2*(1.-smoothstep(t1,t1+.2,a));
  return f;}
float foamCover(vec2 p,out float edge){
  float c=0.;edge=0.;
  for(int i=0;i<3;i++){vec4 W=uWave[i];if(W.y>2.5)continue;float f=front(1+i,p.x),s=p.y-f;
    float up=W.y<.5?1.:0.,k=up>0.?1.:pow(max(W.x,0.),1.4);
    float dense=W.w*(up>0.?1.:.85*k)*(1.-smoothstep(.0,.05+.07*(1.-W.x)*up,s))*step(-.002,s);
    float lace=W.z*(up>0.?1.:.8*k)*(1.-smoothstep(.1,.35+.3*W.x,s))*step(0.,s);
    c=max(c,max(dense,lace*.62));
    if(W.y<1.5)edge=max(edge,(1.-smoothstep(0.,.008,abs(s-.002)))*(up>0.?1.:.5));}
  for(int i=0;i<3;i++){vec2 S=uStrand[i];if(S.y<=0.)continue;float m=front(4+i,p.x),s=abs(p.y-m+.006);c=max(c,S.y*(1.-smoothstep(.0,.03,s))*.75);}
  float sea=smoothstep(uSeaY-.1,uSeaY+.15,p.y);c=max(c,sea*.35*smoothstep(.3,.7,fbm(p*3.+vec2(0,uT*.1))));
  return c;}

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
  float tg=-ro.z/rd.z;vec3 P=ro+rd*tg;vec2 p=P.xy;
  // The feet, if the ray meets one before the ground.
  float tf=1e9;vec4 hit=vec4(0);
  {vec3 bmin=vec3(-.8,-.2,-.01),bmax=vec3(.8,.75,.6);vec3 i0=(bmin-ro)/rd,i1=(bmax-ro)/rd;vec3 lo=min(i0,i1),hi=max(i0,i1);
   float t0=max(max(lo.x,lo.y),lo.z),t1=min(min(hi.x,hi.y),hi.z);
   if(t1>max(t0,0.)){float t=max(t0,0.);for(int i=0;i<110;i++){vec4 h=feetSDF(ro+rd*t);if(h.x<.0004){tf=t;hit=h;break;}t+=h.x*.9;if(t>t1)break;}}}
  float wd=waterDepth(p);
  float wet=max(texture(uWet,vec2((p.x+1.8)/3.6,(p.y+.3)/2.5)).r,smoothstep(1.,1.4,p.y));
  float edge,cov=foamCover(p,edge);
  if(tf<tg){
    vec3 X=ro+rd*tf,n=feetNormal(X);int fi=int(hit.w);vec4 S=uSkin[fi];vec3 skin=S.rgb;
    float foot=0.;for(int i=0;i<4;i++)if(i==fi)foot=uF[i].z;
    // Skin: a little bumpy, warm where light scatters through it, glossier when wet. The nails are smooth and pale.
    vec3 bn=normalize(n+vec3(vnoise(X.xy*900.)-.5,vnoise(X.yz*900.+3.)-.5,vnoise(X.xz*900.+7.)-.5)*.08);
    float nail=0.;if(X.z<.045&&hit.z>.55){vec3 a=vec3(0);nail=smoothstep(.55,.75,hit.z)*smoothstep(.35,.7,n.z);}
    vec3 alb=mix(skin,uNail[fi].rgb,nail*.9);
    float wetF=uNail[fi].w,rough=mix(mix(.62,.28,wetF),.2,nail);
    float sh=feetShadow(X+n*.002,uMoonDir);
    float ao=0.;for(int i=1;i<=4;i++){float h=.006*float(i);ao+=(h-feetSDF(X+n*h).x)/h;}ao=clamp(1.-ao*.22,0.,1.);
    vec3 L=uMoonDir;float nl=dot(bn,L),wrap=max((nl+.45)/1.45,0.);
    vec3 sss=skin*vec3(1.,.42,.3)*max(0.,.35-abs(nl))*1.4;
    vec3 h=normalize(L+vdir);float F=.028+.972*pow(1.-max(dot(bn,vdir),0.),5.);
    col=alb*uMoonCol*wrap*sh+uMoonCol*sss*sh+alb*sky(bn)*2.4*ao+uMoonCol*ggx(bn,h,rough)*F*max(nl,0.)*sh*(.12+wetF*.5+nail*.4);
    col*=mix(.6,1.,ao);
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
    if(wd>0.){
      // Water: ripples bend the view of the sand, depth soaks up the red first, and the surface mirrors the moon.
      vec2 g=ripple(p);vec3 wn2=normalize(vec3(-g*.012*(.3+min(wd*30.,1.)),1.));
      vec2 rp=p+wn2.xy*wd*1.6;vec3 ra=sandAlbedo(rp)*vec3(.62,.63,.66);
      float rsh=nearFeet?sh:1.;
      vec3 under=shadeSurface(ra,vec3(0,0,1),vdir,.6,.0,rsh);
      under*=exp(-wd*vec3(26.,10.,7.));under+=vec3(.012,.03,.035)*uMoonCol*(1.-exp(-wd*8.));
      float F=.02+.98*pow(1.-max(dot(wn2,vdir),0.),5.);
      vec3 hv=normalize(uMoonDir+vdir);vec3 refl=sky(reflect(rd,wn2))+uMoonCol*ggx(wn2,hv,.06)*.6;
      col=mix(under,refl,F)+uMoonCol*ggx(wn2,hv,.06)*.05;
      // The film right at the edge catches a bright line of light.
      col+=uMoonCol*edge*.18;
    }
    // Foam, lit by the moon, with a little shadow under it on the sand.
    if(cov>.01){float fs;float f=foam(p,cov,fs);
      col*=1.-.3*cov*(1.-f);
      vec3 fc=vec3(.78,.82,.86)*fs*(.82+.18*vnoise(p*60.));vec3 fn=normalize(vec3((vnoise(p*800.)-.5)*.6,(vnoise(p*800.+5.)-.5)*.6,1.));
      vec3 lit=fc*(uMoonCol*(max(dot(fn,uMoonDir),0.)*.85+.25)*sh+sky(fn)*3.)+uMoonCol*ggx(fn,normalize(uMoonDir+vdir),.25)*.08;
      col=mix(col,lit,f);}
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
const NX=128,FRONT=new Float32Array(NX*7);
const frontTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,frontTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,NX,7,0,gl.RED,gl.FLOAT,FRONT);
for(const k of[gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.NEAREST);
const WS=256,wetTex=[],wetFb=[];
for(let i=0;i<2;i++){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,WS,WS,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  for(const k of[gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.LINEAR);
  for(const k of[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
  const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
  gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);wetTex.push(t);wetFb.push(f);}
gl.bindFramebuffer(gl.FRAMEBUFFER,null);
let wetI=0,wetT=0;

/* ---------- waves ---------- */
let t=0,bright=1,brightTo=1,cloudEnd=0,foamOX=0,foamOY=0,lastMid=SEA.y;
const waves=[],stats={waves:0,reached:0,short:0};
const xAt=i=>-1.8+i*3.6/(NX-1);
function phase(w,tt){const x=tt-w.t0;if(x<0)return[0,0];if(x<w.up){const k=x/w.up;return[1-Math.pow(1-k,2.3),0];}
  if(x<w.up+w.hold)return[1,1];const k=(x-w.up-w.hold)/w.down;return k>=1?[0,3]:[1-Math.pow(k,1.7)*(1-.15*Math.sin(k*Math.PI)),2];}
function tide(){return(fbm(t*.0015+SEA.tideO)-.5)*.1+SEA.tide*Math.min(1,t/1800)*.05;}
function newWave(kind){
  kind=kind||wpick([['short',.42],['touch',.4],['past',.18]]);
  const reach=kind==='short'?TOE_Y+rr(.02,.22):kind==='touch'?lerp(ANKLE_Y,TOE_Y,rr(.05,.95)):ANKLE_Y-rr(.04,.3);
  waves.push({kind,t0:t,up:rr(2.4,3.8),hold:rr(.2,.7),down:rr(4,6.5),reach:clamp(reach-tide()*SEA.energy,-.1,SEA.y-.2),
    a1:rr(.02,.07),l1:rr(.4,1.1),p1:rr(0,6.3),a2:rr(.008,.03),l2:rr(1.8,3.5),p2:rr(0,6.3),nO:rr(0,500),obl:rr(-.5,.5),
    lace:rr(.55,1),dense:rr(.7,1),front:new Float32Array(NX),max:new Float32Array(NX).fill(9),st:0,logged:false,strand:0,strandLife:rr(6,14)});
  stats.waves++;
}
function waveFront(w){const top=SEA.y+.15;let st=0;
  for(let i=0;i<NX;i++){const x=xAt(i),[p,s]=phase(w,t-w.obl*(x/1.8)*.5);st=Math.max(st,s);
    const lobe=w.a1*Math.sin(x*Math.PI*w.l1+w.p1)+w.a2*Math.sin(x*Math.PI*w.l2+w.p2)+.02*(fbm(x*3+w.nO)-.5);
    w.front[i]=top-(top-(w.reach+lobe))*p;if(w.front[i]<w.max[i])w.max[i]=w.front[i];}
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
  const mid=frontAt(0,0),d=mid-lastMid;lastMid=mid;foamOY+=d<0?d:d*.55;foamOX+=dt*.004;
  for(const f of feet){const depth=f.y+.13*f.p.size-frontAt(0,f.x);
    if(depth>0){f.wet=1;if(!f.dunk){f.dunk=true;if(depth>.08)f.sink=Math.min(.012,f.sink+rr(.001,.0025));}}else if(depth<-.03)f.dunk=false;
    f.wet=Math.max(0,f.wet-dt/30);}
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
  const maxPx=LOWQ?6e5:1.8e6;if(CW*CH*DPR*DPR>maxPx)DPR=Math.sqrt(maxPx/(CW*CH));
  cv.width=Math.round(CW*DPR);cv.height=Math.round(CH*DPR);
}
// The camera: at eye height a little behind the feet, looking down and forward toward the sea.
function camera(){const asp=CW/CH,cam=[0,.06,1.42],target=[0,.6,0];
  const f=norm(sub(target,cam)),r=norm(cross(f,[0,0,1])),u=cross(r,f);
  // On a tall screen, keep about the same view up and down and crop the sides, so the legs don't fill the frame.
  const tanY=asp<1?Math.tan(.3)*1.22:Math.tan(.3),tanX=tanY*asp;return{cam,f,r,u,tanX,tanY};}
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
  gl.uniform4fv(U.uWave,W);gl.uniform2fv(U.uStrand,S);gl.uniform2f(U.uFoamOff,foamOX,-foamOY);
  gl.uniform3fv(U.uMoonDir,MOON_DIR);gl.uniform3fv(U.uMoonCol,MOON.c.map(v=>v*.4*bright));gl.uniform3fv(U.uSand,lin(SAND.c));
  gl.uniform1f(U.uBright,bright);gl.uniform1f(U.uSeaY,SEA.y);gl.uniform1f(U.uMoonX,SEA.moonX);
  const F=[],FP=[],SK=[],NL=[];
  for(let i=0;i<4;i++){const f=feet[i];if(!f){F.push(0,0,0,1);FP.push(0,0,0,1);SK.push(0,0,0,0);NL.push(0,0,0,0);continue;}
    F.push(f.x,f.y,f.rot,f.s);FP.push(f.hipX,.02,0,f.p.size);SK.push(...lin(f.p.skin),f.sink);
    const nail=f.p.nails?lin(f.p.nails):lin(f.p.skin.map((v,i)=>Math.min(255,v*.75+[52,44,44][i])));NL.push(...nail,f.wet);}
  {let x0=9,x1=-9,y0=9,y1=-9;for(const f of feet){x0=Math.min(x0,f.x);x1=Math.max(x1,f.x);y0=Math.min(y0,f.y);y1=Math.max(y1,f.y);}
   gl.uniform4f(U.uBox,x0-.12,y0-.42,x1+.12,y1+.18);}
  gl.uniform1i(U.uFeet,feet.length);gl.uniform4fv(U.uF,F);gl.uniform4fv(U.uFP,FP);gl.uniform4fv(U.uSkin,SK);gl.uniform4fv(U.uNail,NL);
  gl.drawArrays(gl.TRIANGLES,0,3);
}

/* ---------- start ---------- */
if(DEBUG)window.SH={gl:true,readWet(){const px=new Uint8Array(WS*WS*4);gl.bindFramebuffer(gl.FRAMEBUFFER,wetFb[wetI]);gl.readPixels(0,0,WS,WS,gl.RGBA,gl.UNSIGNED_BYTE,px);gl.bindFramebuffer(gl.FRAMEBUFFER,null);const col=[];for(let y=0;y<WS;y+=32)col.push(px[(y*WS+128)*4]);return{status:gl.checkFramebufferStatus(gl.FRAMEBUFFER),col};},waves,feet,people,stats,newWave,get t(){return t;},get paused(){return NightCity.paused;},set paused(v){NightCity.paused=v;},
  draw:()=>draw(),step:dt=>update(dt),run(sec){for(let i=0;i<sec*60;i++)update(1/60);draw();NightCity.refresh();}};
build();
for(let i=0;i<30*14;i++){update(1/30);if(i%6===5){gl.bindTexture(gl.TEXTURE_2D,frontTex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,NX,7,gl.RED,gl.FLOAT,FRONT);wetPass();}}
stats.waves=stats.reached=stats.short=0;
NightCity.log(`${MOON.name[0].toUpperCase()+MOON.name.slice(1)} moonlight on ${SAND.name} sand. ${people.length>1?'Two pairs':'A pair'} of bare feet at the water's edge (WebGL prototype)`);
NightCity.run({step:1/60,update,draw,ui:()=>NightCity.stats(stats)});
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{build();draw();},200);});
})();
