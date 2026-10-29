/* Shoreline, WebGL version, the default. main.js loads this first unless the page has ?2d.
   Standing on a dark beach at night, looking out across the water. Waves run up the sand in front of you and drain
   back, surf lines roll in further out, and across the bay Night City glows: lit towers, neon, a haze of light, the odd
   flying car. The moon and the city lights stretch into long reflections on the water. Now and then something lives
   in it: plankton glowing blue where the foam breaks, a jellyfish drifting in the shallows, a school of fish, fins far out.
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
const SANDS=[[{name:'pale',c:[112,102,88]},4],[{name:'grey',c:[98,94,90]},3],[{name:'dark',c:[76,72,68]},2]];
const SAND=wpick(SANDS);
// Metres: x across the beach, y out to sea, z up. The camera stands on the sand at eye height.
// Waves start from SEA.y and run up the sand toward the camera. The city sits across the bay, opposite the moon.
const SEA={y:rr(5.8,6.8),energy:rr(.8,1.2),tide:rr(-1,1),tideO:rr(0,500),
  moonAz:rr(.15,.5)*(chance(.5)?1:-1),moonEl:rr(.05,.12),cityAz:0,cityW:rr(.6,.95),seed:rr(0,100)};
SEA.cityAz=-Math.sign(SEA.moonAz)*rr(.1,.4);
const NEON=[[1,.12,.6],[.1,.85,1],[.65,.2,1],[1,.35,.15]];
const neonA=pick(NEON),neonB=pick(NEON.filter(c=>c!==neonA));

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
// The wet sand map, in beach coordinates: covered by water now means wet, otherwise it slowly dries.
const STATE_FS=COMMON+`
in vec2 v;out vec4 o;uniform sampler2D uPrev;uniform float uDecay;
void main(){vec2 p=vec2(mix(-7.,7.,v.x),mix(0.,12.,v.y));float w=texture(uPrev,v).r;
  if(p.y>front(0,p.x)-.01)w=1.;else w=max(0.,w-uDecay);o=vec4(w,0,0,1);}`;
const MAIN_FS=COMMON+`
in vec2 v;out vec4 o;
uniform float uT;uniform vec3 uCam,uFwd,uRight,uUp;uniform vec2 uTan;
uniform sampler2D uWet;uniform vec4 uWave[3];uniform vec2 uStrand[3];uniform vec4 uSeed[3];uniform float uRip;
uniform vec3 uMoonDir,uSand,uNeonA,uNeonB;uniform float uBright,uSeaY,uCityAz,uCityW,uCitySeed,uNeonFlick,uBio;
uniform vec4 uJel[2],uFish,uFin,uCar[2];
const float PI=3.14159265;

/* ---- the sky and the city across the bay ---- */
// Directions are turned into an angle around the horizon (az, 0 straight out to sea) and an angle up (el).
vec3 moonCol(){return vec3(.62,.7,.86)*uBright;}
float cityMask(float az){return smoothstep(uCityW,uCityW*.6,abs(az-uCityAz));}
// The skyline: blocks of towers, now and then a tall one, lower toward the ends of the city.
float towerH(float az,out float bi){bi=floor(az*55.+uCitySeed);float h=.004+.024*pow(hash(vec2(bi,1.)),1.5);
  if(hash(vec2(bi,2.))>.86)h+=.035*hash(vec2(bi,3.));return h*cityMask(az);}
vec3 sky(vec3 d){
  float el=asin(clamp(d.z,-1.,1.)),az=atan(d.x,d.y);
  vec3 c=mix(vec3(.0045,.006,.012),vec3(.0012,.0016,.0035),smoothstep(0.,.5,el))*uBright;
  // The city lights the haze above it in neon tints.
  float cm=cityMask(az),haze=exp(-max(el,0.)/.05)*cm;
  c+=mix(uNeonA,uNeonB,vnoise(vec2(az*6.,3.)))*.03*haze+vec3(.03,.02,.02)*.35*haze;
  // Faint stars, fewer near the glow.
  vec2 sc=vec2(az*700.,el*700.);float st=hash(floor(sc));if(st>.996&&el>.05)c+=vec3(.5,.55,.7)*.04*(st-.996)/.004*(1.-cm)*smoothstep(.05,.2,el)*(1.-smoothstep(.05,.3,length(fract(sc)-.5)));
  // The moon: a soft halo and a bright disc.
  float ma=acos(clamp(dot(d,uMoonDir),-1.,1.));c+=moonCol()*(exp(-ma/.03)*.04+exp(-ma/.2)*.012);c+=moonCol()*1.6*(1.-smoothstep(.0085,.0095,ma));
  // Flying cars: small lights crossing above the towers, blinking.
  for(int i=0;i<2;i++){vec4 C=uCar[i];if(C.z<=0.)continue;float dd=length(vec2((az-C.x)*cos(el),el-C.y));
    vec3 lc=C.w<.5?vec3(1.,.85,.6):uNeonB;c+=lc*C.z*(exp(-dd/.0012)*.9+exp(-dd/.006)*.05)*(.6+.4*step(.5,fract(uT*1.7+float(i)*.3)));}
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
float sandH(vec2 p){return vnoise(p*90.)*.25*lod(90.,FW)+vnoise(p*260.)*.12*lod(260.,FW)+fbm(p*14.)*.6+sin(p.y*30.+vnoise(p*4.)*6.)*.08;}
vec4 bits(vec2 p,float cell,float seed){vec2 g=p/cell,i=floor(g),f=fract(g);vec4 r=vec4(0);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y),h=hash2(i+o+seed);float k=hash(i+o+seed+4.);
    float rad=(.08+.26*pow(hash(i+o+seed+8.),3.))*step(.86,k);float d=length(o+h-f);
    float a=1.-smoothstep(rad*.75,rad,d);if(a>r.w)r=vec4(hash(i+o+seed+2.),d/max(rad,.001),k,a);}
  return r;}
vec3 sandAlbedo(vec2 p){float n=fbm(p*5.),g=(vnoise(p*900.)-.5)*lod(900.,FW);
  vec3 c=uSand*(.82+.36*n)*(1.02+.18*g);
  vec4 b=bits(p,.015,3.);b.w*=lod(1./.015,FW*.5);if(b.w>0.){vec3 bc=b.x<.4?uSand*.4:b.x<.75?mix(uSand,vec3(.9,.87,.82),.6):b.x<.9?vec3(.08,.07,.07):vec3(.32,.16,.11);
    bc*=1.-.35*b.y;c=mix(c,bc,b.w*.9);}
  return c;}
// How deep the water is, in metres: a film at the edge of the swash, deepening toward the sea.
float waterDepth(vec2 p){float f=front(0,p.x),s=p.y-f;if(s<0.)return 0.;return .004+min(s,1.5)*.03+max(0.,p.y-uSeaY)*.08;}
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
    float dense=W.w*(up>0.?1.:.85*k)*(1.-smoothstep(.0,.08+.15*(1.-W.x)*up,s))*step(-.004,s);
    float lace=W.z*(up>0.?1.:.8*k)*(1.-smoothstep(.2,.7+.6*W.x,s))*step(0.,s);
    float ci=max(dense,lace*.8);
    if(W.y<1.5)edge=max(edge,(1.-smoothstep(0.,.012,abs(s-.003)))*(up>0.?1.:.5));
    if(up>0.)bore=max(bore,.012*exp(-max(s,0.)/.06)*step(0.,s)*(1.-W.x*.7));
    vec2 sd=uSeed[i].xy;float lag=min(uSeed[i].z,6.)*.05*smoothstep(0.,1.8,s);
    if(ci>best){best=ci;drain=b*step(0.,s);q=up>0.?vec2(p.x+sd.x,s-lag+sd.y):vec2(p.x+sd.x,(p.y-m)*mix(1.,.62,b)-lag+sd.y);
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
  float h1=holeField(q/.065+w*1.8,1.),h2=holeField(q/.024+w*2.6,7.),h3=holeField(q/.01+w*3.,13.);
  float d1=1.-smoothstep(.15,.45,fw/.065),d2=1.-smoothstep(.15,.45,fw/.024),d3=1.-smoothstep(.15,.45,fw/.01);
  float clump=(fbm(q*3.5+11.)-.5)*(1.5-c);
  float t1=(h1-mix(.45,-.3,c)-clump+(gnoise(q*5.+uT*.35)-.5)*.25*(.3+CHURN))*d1+(c-.5)*(1.-d1);
  float t2=(h2-mix(.4,-.3,c))*d2+1.*(1.-d2),t3=(h3-mix(.3,-.35,c))*d3+1.*(1.-d3);
  float thick=min(t1,min(t2*.55,t3*.3));
  float aa=max(fw/.065*1.5,.03);
  float f=smoothstep(0.,aa,thick);
  vec2 g=q/.011,ci=floor(g),cf=fract(g);float bd=9.;bub=vec2(0);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y),h=hash2(ci+o+21.);float r=.35+.3*hash(ci+o+29.);vec2 dv=(cf-(o+.2+.6*h))/r;float dd=dot(dv,dv);if(dd<bd){bd=dd;bub=dv;}}
  bub*=(1.-smoothstep(.2,.6,fw/.011))*step(bd,1.);
  return vec3(f,clamp(thick*3.,0.,1.),smoothstep(-.25,0.,thick));}

/* ---- light ---- */
float ggx(vec3 n,vec3 h,float r){float a=r*r,a2=a*a,d=max(dot(n,h),0.);float k=d*d*(a2-1.)+1.;return a2/(PI*k*k);}
// Light on the beach: the moon, the dark sky, and the faint neon glow of the city across the water.
vec3 ambient(vec3 n){return sky(normalize(vec3(n.xy*.6,max(n.z,.2))))*2.+mix(uNeonA,uNeonB,.5)*.0012;}
// The water's mirror: the sky, smeared up and down where the surface is rougher, so lights stretch into streaks.
vec3 reflSky(vec3 r,float smear){r.z=abs(r.z);vec3 c=vec3(0);float wsum=0.;
  for(int i=-3;i<=3;i++){float k=float(i)/3.,w=1.-abs(k)*.6;c+=sky(normalize(r+vec3(0,0,smear*k*2.)))*w;wsum+=w;}c/=wsum;
  // The city's lights blur into a broad shimmer on the water below it.
  float az=atan(r.x,r.y),el=asin(clamp(r.z,0.,1.));c+=mix(uNeonA,uNeonB,vnoise(vec2(az*14.,1.)))*cityMask(az)*exp(-el/(.015+smear))*.03*(.5+1.*vnoise(vec2(az*90.,uT*.5)));
  c+=vec3(1.,.75,.5)*cityMask(az)*exp(-el/(.01+smear))*.014*(.4+1.2*vnoise(vec2(az*260.,uT*.8)));
  return c;}

void main(){
  vec2 uv=v*2.-1.;
  vec3 rd=normalize(uFwd+uv.x*uTan.x*uRight+uv.y*uTan.y*uUp),ro=uCam,vdir=-rd;vec3 col;
  vec3 L=uMoonDir;
  if(rd.z>=-.0005){col=sky(rd);}
  else{
  float tg=-ro.z/rd.z;vec2 p=(ro+rd*tg).xy;FW=length(fwidth(p));float dist=tg;
  float wd=waterDepth(p);
  float wet=max(texture(uWet,vec2((p.x+7.)/14.,p.y/12.)).r,smoothstep(uSeaY-1.,uSeaY,p.y));
  float fresh=smoothstep(.9,1.,wet);
  wet=smoothstep(.0,.6,wet+(fbm(p*11.)-.5)*.45+(vnoise(p*45.)-.5)*.16);
  float edge,bore,drain;vec2 fq;float cov=foamCover(p,edge,fq,bore,drain);
  // Sand: grains and ripples, darker and shinier where wet, glittering where the water has only just left.
  vec2 e=vec2(.003,0);float h0=sandH(p),hx=sandH(p+e.xy),hy=sandH(p+e.yx);vec3 n=normalize(vec3(-(hx-h0)/e.x*.004,-(hy-h0)/e.x*.004,1.));
  vec3 alb=sandAlbedo(p);
  vec3 H=normalize(L+vdir);
  vec3 dry=alb*(moonCol()*max(dot(n,L),0.)+ambient(n));
  vec3 wa=alb*vec3(.55,.56,.6);vec3 wn=normalize(mix(n,vec3(0,0,1),.6));
  vec3 wetC=wa*(moonCol()*max(dot(wn,L),0.)+ambient(wn))+moonCol()*ggx(wn,H,.3)*.04;
  col=mix(dry,wetC,wet);
  if(fresh>0.){vec3 fn0=normalize(mix(n,vec3(0,0,1),.85));float F0=.02+.98*pow(1.-max(dot(fn0,vdir),0.),5.);
    col=mix(col,col*.85+reflSky(reflect(rd,fn0),.02)*F0*1.4,fresh*.85);
    vec4 gl0=bits(p,.008,41.);col+=moonCol()*step(.93,gl0.x)*gl0.w*lod(1./.008,FW*.6)*fresh*.25;}
  float ahead=front(0,p.x)-p.y;if(ahead>0.)col*=1.-.3*exp(-ahead/.025);
  if(wd>0.){
    // Water: the lip of an incoming wave, ripples near shore and swells further out, which bend the view of the sand,
    // focus faint caustics on it and mirror the sky, the moon and the city in long broken streaks.
    float dr=drain;wd=wd*mix(1.,.45,dr)+bore;
    float amp=smoothstep(.0,.015,wd)*(1.-smoothstep(12.,30.,dist));
    vec2 e2=vec2(.006,0);
    float R0=rippleH(p,dr),Rxp=rippleH(p+e2.xy,dr),Rxm=rippleH(p-e2.xy,dr),Ryp=rippleH(p+e2.yx,dr),Rym=rippleH(p-e2.yx,dr);
    float D0=waterDepth(p),gx=(waterDepth(p+e2.xy)-D0)/e2.x*mix(1.,.45,dr)+(Rxp-Rxm)/(2.*e2.x)*amp,gy=(waterDepth(p+e2.yx)-D0)/e2.x*mix(1.,.45,dr)+(Ryp-Rym)/(2.*e2.x)*amp;
    float sw=smoothstep(uSeaY-1.,uSeaY+3.,p.y);vec2 es=vec2(.05,0);float S0=swellH(p);
    gx+=(swellH(p+es.xy)-S0)/es.x*sw*.6;gy+=(swellH(p+es.yx)-S0)/es.x*sw*.6;
    vec3 wn2=normalize(vec3(-gx,-gy,1.));
    vec2 rp=p-wn2.xy*min(wd,.08)*.8;vec3 ra=sandAlbedo(rp)*vec3(.55,.56,.6);
    float caust=clamp(1.-(Rxp+Rxm+Ryp+Rym-4.*R0)*amp*1.5e3,.8,1.3);
    vec3 under=ra*(moonCol()*max(L.z,0.)*caust+ambient(vec3(0,0,1)));
    // At night the water over sand reads dark and close to grey: it soaks up light, and the sand's colour fades.
    under=mix(vec3(dot(under,vec3(.3,.5,.2))),under,.45)*.55;
    under*=exp(-wd*vec3(40.,22.,15.));under+=vec3(.0008,.0016,.002)*(1.-exp(-wd*4.));
    // Creatures in the water: a jellyfish's glowing bell, a school of fish.
    for(int i=0;i<2;i++){vec4 J=uJel[i];if(J.w<=0.)continue;float jd=length((p-J.xy)/vec2(1.,1.25))/J.z;
      float bell=1.-smoothstep(.55,1.,jd),rim=exp(-(jd-.85)*(jd-.85)/.0144);float pulse=.6+.4*sin(uT*2.1+float(i)*2.);
      float tent=(1.-smoothstep(0.,.08,abs(p.x-J.x+sin(p.y*30.+uT*2.)*.02)))*step(J.y,p.y)*(1.-smoothstep(J.y,J.y+J.z*2.6,p.y));
      under+=vec3(.25,.55,1.)*J.w*(bell*.025*pulse+rim*.05*pulse+tent*.01);}
    if(uFish.w>0.){mat2 fr=mat2(cos(uFish.z),-sin(uFish.z),sin(uFish.z),cos(uFish.z));
      for(int i=0;i<9;i++){vec2 o=(hash2(vec2(float(i),3.))-.5)*vec2(.9,.6);vec2 c0=uFish.xy+fr*(o+vec2(sin(uT*3.+float(i))*.03,0));
        vec2 lp=transpose(fr)*(p-c0);float fd=length(lp/vec2(.075,.018));float body=1.-smoothstep(.7,1.,fd);
        under*=1.-body*.45*uFish.w;under+=moonCol()*body*.03*uFish.w*step(.92,fract(uT*.7+float(i)*.37));}}
    float F=.02+.98*pow(1.-max(dot(wn2,vdir),0.),5.);
    vec3 refl=reflSky(reflect(rd,wn2),.004+.0012*dist+.012*sw);
    col=mix(under,refl,F)+moonCol()*ggx(wn2,normalize(L+vdir),.05)*.03;
    col+=moonCol()*(edge*.05+smoothstep(.004,.012,bore)*.015);
  }
  if(cov>.01){vec2 bub;vec3 fa=foamAt(fq,cov,FW,bub);float f=fa.x,th=fa.y;
    col*=1.-.25*cov*(1.-fa.z)*(1.-f);
    vec3 fn=normalize(vec3(bub*.9+(vec2(vnoise(fq*150.),vnoise(fq*150.+4.))-.5)*.5,1.));
    float ring=length(bub);float bubShade=1.-.28*smoothstep(.55,1.,ring)*step(.001,ring);
    vec3 fc=vec3(.86,.88,.92)*mix(.68,1.12,th)*bubShade;
    vec3 lit=fc*(moonCol()*(max(dot(fn,L),0.)*.6+.16)+ambient(fn)*1.3)+moonCol()*ggx(fn,normalize(L+vdir),.12)*.1*(.3+th);
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
  // Haze toward the horizon.
  col=mix(col,sky(normalize(vec3(rd.xy,.0)))*1.1,smoothstep(80.,400.,dist)*.6);
  }
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
  gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);wetTex.push(tx);wetFb.push(f);}
gl.bindFramebuffer(gl.FRAMEBUFFER,null);
let wetI=0,wetT=0;

/* ---------- waves ---------- */
let t=0,bright=1,brightTo=1,cloudEnd=0,rip=0,neonFlick=1,flickEnd=0,bio=.35,bioTo=.35,bloomEnd=0;
const waves=[],stats={waves:0,far:0,sights:0};
const xAt=i=>-7+i*14/(NX-1);
// Where a wave stops, in metres from the camera: most well down the sand, some further, a few a long way up.
const REACH={short:[3.5,4.7],mid:[2.6,3.5],far:[1.8,2.6]};
function phase(w,tt){const x=tt-w.t0;if(x<0)return[0,0];if(x<w.up){const k=x/w.up;return[1-Math.pow(1-k,2.3),0];}
  if(x<w.up+w.hold)return[1,1];const k=(x-w.up-w.hold)/w.down;return k>=1?[0,3]:[1-Math.pow(k,1.7)*(1-.15*Math.sin(k*Math.PI)),2];}
function tide(){return(fbm(t*.0015+SEA.tideO)-.5)*.6+SEA.tide*Math.min(1,t/1800)*.4;}
function newWave(kind){
  kind=kind||wpick([['short',.45],['mid',.38],['far',.17]]);
  const[a,b]=REACH[kind];
  waves.push({kind,t0:t,up:rr(2.8,4.2),hold:rr(.2,.7),down:rr(4.5,7),reach:clamp(rr(a,b)-tide()*SEA.energy*.6,1.6,SEA.y-.8),
    a1:rr(.08,.2),l1:rr(.25,.55),p1:rr(0,6.3),a2:rr(.03,.08),l2:rr(.8,1.6),p2:rr(0,6.3),nO:rr(0,500),obl:rr(-.5,.5),
    lace:rr(.55,1),dense:rr(.7,1),sx:rr(0,50),sy:rr(0,50),front:new Float32Array(NX),max:new Float32Array(NX).fill(99),st:0,logged:false,strand:0,strandLife:rr(6,14)});
  stats.waves++;
}
function waveFront(w){const top=SEA.y+.6;let st=0;
  for(let i=0;i<NX;i++){const x=xAt(i),[p,s]=phase(w,t-w.obl*(x/7)*.6);st=Math.max(st,s);
    const lobe=w.a1*Math.sin(x*Math.PI*w.l1+w.p1)+w.a2*Math.sin(x*Math.PI*w.l2+w.p2)+.14*(fbm(x*.9+w.nO)-.5)+.05*(fbm(x*3+w.nO+40)-.5);
    // While it runs up, the front pushes ahead in shifting fingers that settle as it slows.
    const finger=s===0?(fbm(x*4+t*.9+w.nO)-.5)*.07*(1-p*.7):0;
    w.front[i]=top-(top-(w.reach+lobe))*p+finger;if(w.front[i]<w.max[i])w.max[i]=w.front[i];}
  return st;}
const frontAt=(row,x)=>{const u=clamp((x+7)/14,0,1)*(NX-1),i=Math.floor(u),j=Math.min(NX-1,i+1);return lerp(FRONT[row*NX+i],FRONT[row*NX+j],u-i);};
let nextWave=0;

/* ---------- life ---------- */
const jellies=[],cars=[];let fish=null,fin=null;
// Each kind of event waits its own exponentially distributed gap. m is the average gap in seconds, f the first wait.
const SCHED={jelly:{m:150,f:40},fish:{m:110,f:25},fin:{m:300,f:120},car:{m:45,f:10},bloom:{m:240,f:90},neon:{m:80,f:30},cloud:{m:240,f:100}};
const nextEv={};for(const k in SCHED)nextEv[k]=expo(SCHED[k].f);
const side=x=>x<-.5?'left':x>.5?'right':'middle';
function fire(k){
  if(k==='jelly'){if(jellies.length>=2)return;const x=rr(-2.5,2.5),y=rr(SEA.y-1.8,SEA.y+1.5);jellies.push({x,y,vx:rr(-.04,.04),vy:rr(-.05,.02),r:rr(.07,.14),a:0,life:rr(40,90),age:0});
    stats.sights++;NightCity.log(`A jellyfish drifts into the shallows on the ${side(x)}, glowing faintly`);}
  else if(k==='fish'){if(fish)return;const dir=chance(.5)?1:-1;fish={x:-dir*4,y:rr(SEA.y-2.5,SEA.y-.5),h:dir>0?0:Math.PI,v:dir*rr(.6,1.2),a:0};
    stats.sights++;NightCity.log('A small school of fish flickers through the shallows');}
  else if(k==='fin'){if(fin)return;fin={x:Math.tan(SEA.moonAz)*rr(35,60)+rr(-3,3),y:rr(35,60),ph:0,dur:rr(2.5,4),n:ri(1,3)};
    stats.sights++;NightCity.log(fin.n>1?'Fins break the moon\'s path far out, then slip under':'A fin breaks the moon\'s path far out, then slips under');}
  else if(k==='car'){if(cars.length>=2)return;const dir=chance(.5)?1:-1;cars.push({az:SEA.cityAz-dir*SEA.cityW,el:rr(.02,.06),v:dir*rr(.01,.03),a:0,c:chance(.6)?0:1});
    NightCity.log(pick(['A flying car crosses above the towers across the bay','Lights drift across the skyline, a car on its way somewhere']));}
  else if(k==='bloom'){bioTo=rr(.8,1);bloomEnd=t+rr(40,90);NightCity.log('The breaking foam starts to glow blue: plankton in the surf');}
  else if(k==='neon'){flickEnd=t+rr(1.5,4);NightCity.log('A neon sign across the bay stutters');}
  else if(k==='cloud'){if(brightTo<1)return;brightTo=rr(.45,.65);cloudEnd=t+rr(30,80);NightCity.log('A cloud slides over the moon and the beach goes darker');}
}

function update(dt){
  t+=dt;
  if(t>=nextWave){newWave();nextWave=t+(4.5+expo(5.2))/SEA.energy;}
  for(const k in SCHED){nextEv[k]-=dt;if(nextEv[k]<=0){nextEv[k]=expo(SCHED[k].m);fire(k);}}
  if(cloudEnd&&t>cloudEnd){brightTo=1;cloudEnd=0;NightCity.log('The cloud passes and the moonlight comes back');}
  if(bloomEnd&&t>bloomEnd){bioTo=.35;bloomEnd=0;}
  bright+=(brightTo-bright)*ease(dt,6);bio+=(bioTo-bio)*ease(dt,8);
  neonFlick=t<flickEnd?(Math.sin(t*40)>.2?1:.1):1;
  for(let i=0;i<NX;i++)FRONT[i]=SEA.y+.04*Math.sin(xAt(i)*1.2+t*.7);
  for(const w of waves){w.st=waveFront(w);for(let i=0;i<NX;i++)FRONT[i]=Math.min(FRONT[i],w.front[i]);
    if(w.st>=1&&!w.logged){w.logged=true;logWave(w);}
    if(w.st>=2&&!w.strand)w.strand=t;}
  for(let i=waves.length-1;i>=0;i--){const w=waves[i];if(w.st===3&&t-w.strand>w.strandLife)waves.splice(i,1);}
  // Ripples drift up the beach with the newest wave running up, and back down while it drains.
  const lead=waves.filter(w=>w.st<3).slice(-1)[0];rip+=dt*(lead&&lead.st===0?.35:-.14);
  for(let i=jellies.length-1;i>=0;i--){const j=jellies[i];j.age+=dt;j.x+=j.vx*dt;j.y+=j.vy*dt;j.a=Math.min(1,j.age/6)*Math.min(1,(j.life-j.age)/6);if(j.age>j.life)jellies.splice(i,1);}
  if(fish){fish.x+=fish.v*dt;fish.a=Math.min(1,fish.a+dt/1.5)*clamp(4.5-Math.abs(fish.x),0,1);fish.y+=Math.sin(t*.8)*.1*dt;if(Math.abs(fish.x)>4.6&&Math.sign(fish.x)===Math.sign(fish.v))fish=null;}
  if(fin){fin.ph+=dt/fin.dur;if(fin.ph>=fin.n)fin=null;}
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
function build(){
  CW=Math.max(240,innerWidth);CH=Math.max(240,innerHeight);
  DPR=(LOWQ?.55:Math.min(1.25,devicePixelRatio||1)*.85)*SCALE;
  const maxPx=LOWQ?6e5:1.3e6;if(CW*CH*DPR*DPR>maxPx)DPR=Math.sqrt(maxPx/(CW*CH));
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
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,wetTex[wetI]);gl.uniform1i(STATE.u.uPrev,1);gl.uniform1f(STATE.u.uDecay,1/255);
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
  const C=camera();gl.uniform3fv(U.uCam,C.cam);gl.uniform3fv(U.uFwd,C.f);gl.uniform3fv(U.uRight,C.r);gl.uniform3fv(U.uUp,C.u);gl.uniform2f(U.uTan,C.tanX,C.tanY);
  gl.uniform1f(U.uT,t);
  const W=[],S=[];for(let s=0;s<3;s++){const w=slots[s];if(!w){W.push(0,3,0,0);S.push(0,0);continue;}const[p,st]=phase(w,t);W.push(p,w.st===3?3:st,w.lace,w.dense);
    S.push(0,w.strand?Math.max(0,1-(t-w.strand)/w.strandLife)*w.lace:0);}
  gl.uniform4fv(U.uSeed,[0,1,2].flatMap(i=>slots[i]?[slots[i].sx,slots[i].sy,t-slots[i].t0,0]:[0,0,0,0]));gl.uniform1f(U.uRip,rip);
  gl.uniform4fv(U.uWave,W);gl.uniform2fv(U.uStrand,S);
  gl.uniform3fv(U.uMoonDir,MOON_DIR);gl.uniform3fv(U.uSand,lin(SAND.c));gl.uniform3fv(U.uNeonA,neonA);gl.uniform3fv(U.uNeonB,neonB);
  gl.uniform1f(U.uBright,bright);gl.uniform1f(U.uSeaY,SEA.y);gl.uniform1f(U.uCityAz,SEA.cityAz);gl.uniform1f(U.uCityW,SEA.cityW);gl.uniform1f(U.uCitySeed,SEA.seed);
  gl.uniform1f(U.uNeonFlick,neonFlick);gl.uniform1f(U.uBio,bio);
  const J=[];for(let i=0;i<2;i++){const j=jellies[i];J.push(...(j?[j.x,j.y,j.r,j.a]:[0,0,1,0]));}gl.uniform4fv(U.uJel,J);
  gl.uniform4fv(U.uFish,fish?[fish.x,fish.y,fish.h,fish.a*.8]:[0,0,0,0]);
  gl.uniform4fv(U.uFin,fin?[fin.x,fin.y,fin.ph%1,1]:[0,0,0,0]);
  const Cr=[];for(let i=0;i<2;i++){const c=cars[i];Cr.push(...(c?[c.az,c.el,c.a,c.c]:[0,0,0,0]));}gl.uniform4fv(U.uCar,Cr);
  gl.drawArrays(gl.TRIANGLES,0,3);
}

/* ---------- start ---------- */
if(DEBUG)window.SH={gl:true,cars,waves,jellies,stats,newWave,fire,get t(){return t;},get paused(){return NightCity.paused;},set paused(v){NightCity.paused=v;},
  draw:()=>draw(),step:dt=>update(dt),run(sec){for(let i=0;i<sec*60;i++)update(1/60);draw();NightCity.refresh();}};
build();
for(let i=0;i<30*14;i++){update(1/30);if(i%6===5){uploadFronts();wetPass();}}
stats.waves=stats.far=stats.sights=0;
NightCity.log(`Moonlight on the water, and Night City glowing across the bay to the ${SEA.cityAz<0?'left':'right'}`);
NightCity.run({step:1/60,update,draw,ui:()=>NightCity.stats(stats)});
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{build();draw();},200);});
})();
