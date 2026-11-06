/* Aurora, WebGL 2 renderer. main.js holds the night and the simulation and loads this file, unless the page has ?2d.

   Light from a curtain comes from a thin sheet lying along the field lines, so the sky is worked out in two steps.
   First the sheets are drawn onto a map of the field lines around the viewer, in polar form around the magnetic zenith:
   angle across, log of distance up. Every line of sight then runs straight along one column of that map, so a pixel's
   light is a walk up one column, adding what each altitude emits. Green from oxygen low down, red from oxygen high up,
   pink at the lower edge where hard electrons reach nitrogen. Perspective, rays meeting at the zenith, curtains brightening
   where they fold edge on and thinning toward the horizon all come out of that walk with nothing faked.
   The map keeps a memory, because the atoms do: green lingers for a fraction of a second and red for most of a minute.

   The land is drawn once for each screen size into a set of buffers, then lit every frame by the sky above it. The river
   in it mirrors the last finished frame, so whatever is up there lands in the water.
   Everything is added up in linear light, then bloomed, toned and dithered, since a dark sky bands easily. */
(()=>{
'use strict';
const A=window.AURORA,{NC,NIGHT,VIEW,RIVER,riverY,paintBoat,sim,stats,arcs,lights,STARS,starColor,skyMatrix,stream,update,fire,glow,energy,strip,crest,paintCity,paintTrees,paintGrass,beacons,clamp,DEG,TAU}=A;
const{RM,LOWQ,DEBUG}=NC;
const QS=new URLSearchParams(location.search);
const cv=document.getElementById('scene');
const gl=cv.getContext('webgl2',{antialias:false,alpha:false,depth:false,stencil:false,powerPreference:'high-performance'});
// ?glfail forces the fallback, for testing it. Buffers of half floats are what the whole picture is built on.
if(!gl||QS.has('glfail')||!(gl.getExtension('EXT_color_buffer_float')||gl.getExtension('EXT_color_buffer_half_float'))){A.fallback();return;}
cv.addEventListener('webglcontextlost',e=>e.preventDefault());
cv.addEventListener('webglcontextrestored',()=>location.reload());

/* ---------- the map ---------- */
const COLS=LOWQ?2048:Math.min(Math.min(screen.width,screen.height)<700?4096:8192,gl.getParameter(gl.MAX_TEXTURE_SIZE)),ROWS=320,DOWN=4;
// Rows run over the log of distance. RMIN keeps the column right at the zenith finite.
const RMIN=3,RMAX=3200,U0=Math.log(RMIN),UI=1/(Math.log(RMAX)-U0);
// Columns are spent where the camera looks: the front of the circle gets several times the back's share.
const WARP=.72;
// The walk up a column: small steps through the low, sharply edged part of the sky, wider ones above it.
// One step is exactly one row of the map, and bilinear rows then add up evenly, so a sheet thinner than a step can't slip
// between two of them. High up, the steps are four rows long and walk a copy of the map with four rows averaged into one.
const H0=86,NLO=25,NHI=13,NT=NLO+NHI,NMIX=6,RLO=Math.exp(1/UI/ROWS),RHI=Math.pow(RLO,DOWN);

/* ---------- what each altitude emits ---------- */
// A Chapman layer: a sharp lower edge, a long upper tail. Four kinds of light: hard, middling and soft electrons as they
// land now, and the slow red glow left behind by the soft ones.
const chap=(h,h0,s)=>{const z=(h-h0)/s;return Math.exp(1-z-Math.exp(-z));};
const GREEN=[.025,1,.17],RED=[1,.02,.1],BLUE=[.3,.08,1],PINK=[1,.05,.36];
function profile(flame){
  const P=new Float32Array(NT*12);let h=H0;
  for(let j=0;j<NT;j++){
    if(j===NLO)h*=Math.pow(RLO,DOWN/2-.5);
    const r=j<NLO?RLO:RHI,dh=h*(Math.sqrt(r)-1/Math.sqrt(r)),lift=flame?1+Math.sin(flame*Math.PI)*1.3*Math.exp(-Math.pow((Math.log(h/135)-(1-flame)*1.1)/.3,2)):1;
    const K=[
      [GREEN,.8*chap(h,109,8)],[PINK,.62*chap(h,96,3.6)],[BLUE,.2*chap(h,104,7)],
      [GREEN,1*chap(h,119,21)],[BLUE,.13*chap(h,122,20)],[PINK,.05*chap(h,106,5)],
      [GREEN,.56*chap(h,140,27)],[RED,.13*NIGHT.red*chap(h,225,56)],[BLUE,.08*chap(h,190,50)],
      [RED,.26*NIGHT.red*chap(h,250,62)],[BLUE,.08*NIGHT.red*chap(h,240,60)]],C=[0,0,0,1,1,1,2,2,2,3,3];
    K.forEach(([c,w],i)=>{const o=j*12+C[i]*3;for(let k=0;k<3;k++)P[o+k]+=c[k]*w*dh*lift*.105;});
    h*=r;}
  return P;}

/* ---------- shaders ---------- */
const VS=`#version 300 es
in vec2 a;out vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0,1);}`;
const LIB=`#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
const float PI=3.14159265,TAU=6.2831853;
uint hu(uint x){x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;x^=x>>16;return x;}
float hf(uint x){return float(hu(x)>>8)*(1./16777216.);}
float h2(ivec2 p){return hf(uint(p.x)+hu(uint(p.y)));}
float h3(ivec3 p){return hf(uint(p.x)+hu(uint(p.y)+hu(uint(p.z))));}
float vn(vec2 p){vec2 q=floor(p),f=p-q,u=f*f*f*(f*(f*6.-15.)+10.);ivec2 i=ivec2(q);
  return mix(mix(h2(i),h2(i+ivec2(1,0)),u.x),mix(h2(i+ivec2(0,1)),h2(i+ivec2(1,1)),u.x),u.y);}
float vn3(vec3 p){vec3 q=floor(p),f=p-q,u=f*f*(3.-2.*f);ivec3 i=ivec3(q);
  return mix(mix(mix(h3(i),h3(i+ivec3(1,0,0)),u.x),mix(h3(i+ivec3(0,1,0)),h3(i+ivec3(1,1,0)),u.x),u.y),
    mix(mix(h3(i+ivec3(0,0,1)),h3(i+ivec3(1,0,1)),u.x),mix(h3(i+ivec3(0,1,1)),h3(i+ivec3(1,1,1)),u.x),u.y),u.z);}
float fbm(vec2 p,int n){float a=.5,s=0.,w=0.;mat2 m=mat2(.8,-.6,.6,.8);for(int i=0;i<n;i++){s+=a*vn(p);w+=a;p=m*p*2.03+11.7;a*=.5;}return s/w;}
float fbm3(vec3 p,int n){float a=.5,s=0.,w=0.;for(int i=0;i<n;i++){s+=a*vn3(p);w+=a;p=p*2.04+vec3(7.1,3.3,5.7);a*=.5;}return s/w;}
`;
const CAM=`uniform vec3 uF,uR,uU;uniform vec2 uTan;
vec3 rayDir(vec2 n){return normalize(uF+n.x*uTan.x*uR+n.y*uTan.y*uU);}
`;

// One curtain into the map. Each sheet is a strip of triangles, with its rays worked out per pixel from where along the
// sheet it is, so they stay fine however the sheet has been folded.
const RIB_VS=`#version 300 es
in vec2 aP;in vec4 aA;in vec4 aE;out float vA,vM,vF,vH,vS,vW,vC;
void main(){vec2 p=aP;p.x+=float(gl_InstanceID-1);vA=aA.x;vM=aA.y;vF=aA.z;vW=aA.w;vH=aE.x;vS=aE.y;vC=aE.z;gl_Position=vec4((p*2.-1.)*aE.w,0,aE.w);}`;
const RIB_FS=LIB+`
in float vA,vM,vF,vH,vS,vW,vC;out vec4 o;
uniform vec4 uRay;uniform vec3 uDrift;
// Time runs along one lattice axis, wrapped at 4096 by the host, so it can run forever without losing precision.
float tn(float x,float y){float q=floor(y),f=y-q,u=f*f*(3.-2.*f);float a=vn(vec2(x,mod(q,4096.)+.5)),b=vn(vec2(x,mod(q+1.,4096.)+.5));return mix(a,b,u);}
// Individual rays, not a pattern. A cell of x may hold one, set at a random place with a width and strength of its own, and
// each brightens and fades on its own clock, so they never fall as evenly as a comb.
float rays(float x,float T,float seed){
  float i=floor(x),s=0.;
  for(int k=-1;k<=1;k++){float c=i+float(k);uint h=hu(uint(int(c)+40000)+uint(seed));
    // Four numbers from one hash: where in the cell, how wide, how strong and how fast it lives.
    float j=float(h&255u)/255.,w=float((h>>8)&255u)/255.,b=float((h>>16)&255u)/255.,r=.45+1.1*float(h>>24)/255.;
    w=mix(.06,.5,w*w);float y=T*r+b*91.,q=floor(y),f=y-q;f=f*f*(3.-2.*f);
    float A=mix(hf(h+uint(int(mod(q,4096.)))),hf(h+uint(int(mod(q+1.,4096.)))),f);
    // Many cells hold nothing, so what's left falls in loose groups with long gaps.
    A=smoothstep(.3,.82,A)*(.35+.95*b)*smoothstep(.42,.62,hf(h^0x9e3779b9u));float d=(x-c-j)/w;s+=A*exp(-d*d);}
  return s;}
void main(){
  float m=vM,w=vW,F=uRay.x,on=uRay.y,T=uRay.z,S=uRay.w;
  // A veil is only a soft glow, so it needs none of what follows.
  // Light has to reach nothing by the edge of the strip, or the edge would show as a faint line.
  float win=1.-vA*vA;win*=win;
  if(on<=0.){float f=vF*exp(-vA*vA*2.88)*win;o=vec4(0.,f*(1.-vS),f*vS,0.);return;}
  // An arc is a bundle of thinner sheets, wandering around each other. Close up, that is what keeps it from looking airbrushed.
  float a1=vA+on*.5*(tn(m*.035*F+S+3.,T*.5)-.5),a2=vA-on*(.4+.7*(tn(m*.06*F+S+8.,T*.7)-.5));
  float g=exp(-a1*a1*3.6)*.62+exp(-a2*a2*6.)*.2*on+exp(-vA*vA*2.)*.36;
  float k1=1.-smoothstep(.3,.9,w*.045*F),k2=1.-smoothstep(.3,.9,w*.13*F);
  float L0=tn(m*.0071*F+S,T*.3),r0=.62*tn(m*.022*F+S*.6,T*.45)+.38*tn(m*.05*F+S*.9,T*.7);
  // Rays finer than a texel can't be drawn, and most of the far sky doesn't need them.
  float r1=k1>0.?mix(.26,rays((m-uDrift.x)*.045*F+S,T*.6,S*13.),k1):.26,r2=k2>0.?mix(.26,rays((m-uDrift.y)*.13*F+S*1.7,T*1.2,S*29.),k2):.26;
  // A sheet is a continuous glow first. A few broad rays lift out of it softly, and never as lines.
  float pat=(.68+.6*L0)*(.66+.7*r0)*(.82+.55*r1+.16*r2);
  // Far off, rays blur together through hundreds of kilometres of air, and a curtain reads as a smooth band.
  float e=mix(1.,pat,on*vC);
  // Bright rays run tall. The poleward side of a sheet is softer than its sharp equatorward edge.
  float tall=clamp(vS*mix(1.,.76+.95*r1,on*vC)*(1.+.35*vA),0.,.9);
  float hard=clamp(vH*(.8+.7*r1),0.,1.-tall);
  float f=vF*g*e*win;
  o=vec4(f*hard,f*(1.-hard-tall),f*tall,0.);}`;

// The map's memory: each kind of light eases toward what the sheets are doing now. The red one drifts outward as it fades.
const MERGE_FS=LIB+`
in vec2 v;out vec4 o;uniform sampler2D uS,uPrev;uniform vec4 uK;uniform vec2 uPx;uniform float uT;
void main(){vec4 s=texture(uS,v),p=texture(uPrev,v);
  float a=p.a*.7+.075*(texture(uPrev,v+vec2(uPx.x*6.,0)).a+texture(uPrev,v-vec2(uPx.x*6.,0)).a+texture(uPrev,v+vec2(0,uPx.y*.5)).a+texture(uPrev,v-vec2(0,uPx.y*.5)).a);
  vec4 n=vec4(mix(p.rgb,s.rgb,uK.xyz),mix(a,s.b,uK.w));
  // A step of a half float is coarser than one frame's fading, so the last bit is rounded at random.
  n.a*=1.+(h2(ivec2(gl_FragCoord.xy)+ivec2(int(uT*977.)&1023))-.5)*.0012;
  o=n;}`;
// The same map with four rows averaged into one, for the wide steps high up, so they can't step over a thin sheet.
const DOWN_FS=LIB+`
in vec2 v;out vec4 o;uniform sampler2D uM;uniform float uPy;
void main(){o=(texture(uM,v+vec2(0,uPy))+texture(uM,v-vec2(0,uPy)))*.5;}`;

const MARCH_FS=LIB+CAM+`
in vec2 v;out vec4 o;uniform sampler2D uMap,uMap2;uniform vec2 uB;uniform mat4x3 uP[${NT}];
void main(){
  vec3 d=rayDir(v*2.-1.);if(d.z<-.07){o=vec4(0,0,0,1);return;}
  vec2 q=d.xy-d.z*uB;float rho=length(q),phi=atan(q.x,q.y);
  float s=(phi+${WARP.toFixed(3)}*sin(phi))/TAU+.5,dz=d.z,c=(1.-dz*dz)/6371.;
  // Where the Earth's curve changes the spacing of the steps they would beat against the map's rows, so each pixel starts at its own offset.
  vec3 col=vec3(0);float h=${H0.toFixed(1)}*(1.+(h2(ivec2(gl_FragCoord.xy))-.5)*${(RLO-1).toFixed(5)});
  // Altitude along a ray that also rises as the Earth curves away below it: h = t dz + t t c / 2.
  for(int j=0;j<${NLO};j++){float sq=sqrt(dz*dz+2.*h*c),t=2.*h/(dz+sq);
    float row=(log(max(t*rho,${RMIN.toFixed(1)}))-${U0.toFixed(6)})*${UI.toFixed(6)};
    vec4 m=textureLod(uMap,vec2(s,row),0.);
    // The last few small steps ease over to the averaged map, or the hand-over shows as a thin line at one height.
    if(j>=${NLO-NMIX})m=mix(m,textureLod(uMap2,vec2(s,row),0.),float(j-${NLO-NMIX-1})/${(NMIX+1).toFixed(1)});
    col+=(uP[j]*m)/sq;h*=${RLO.toFixed(6)};}
  h*=${Math.pow(RLO,DOWN/2-.5).toFixed(6)};
  for(int j=${NLO};j<${NT};j++){float sq=sqrt(dz*dz+2.*h*c),t=2.*h/(dz+sq);
    float row=(log(max(t*rho,${RMIN.toFixed(1)}))-${U0.toFixed(6)})*${UI.toFixed(6)};
    col+=(uP[j]*textureLod(uMap2,vec2(s,row),0.))/sq;h*=${RHI.toFixed(6)};}
  // Looking straight along a sheet adds up hundreds of kilometres of it. The eye and a sensor both run out of range there,
  // so very bright columns level off here and keep their colour, instead of burning out to white.
  float l=dot(col,vec3(.2,.7,.1));col*=2.1*(1.-exp(-l/2.1))/max(l,1e-5);
  o=vec4(col,1);}`;

// The Milky Way, baked once onto the celestial sphere, in galactic coordinates. Star clouds and dust lanes are warped noise
// squashed toward the plane, so the band has knots and rifts and not a smooth stripe.
const MW_FS=LIB+`
in vec2 v;out vec4 o;uniform float uSeed;
const mat3 GAL=mat3(-.0548755604,.4941094279,-.8676661490,-.8734370902,-.4448296300,-.1980763734,-.4838350155,.7469822445,.4559837762);
void main(){
  float ra=v.x*TAU,de=(v.y-.5)*PI;vec3 e=vec3(cos(de)*cos(ra),cos(de)*sin(ra),sin(de)),g=GAL*e;
  float l=atan(g.y,g.x),b=asin(clamp(g.z,-1.,1.));
  vec3 sd=vec3(uSeed,uSeed*.7,uSeed*1.3);
  vec3 w=vec3(fbm3(g*2.6+sd,5),fbm3(g*2.6+sd+9.,5),fbm3(g*2.6+sd+17.,5))-.5;
  vec3 q=g+w*vec3(.3,.3,.13);
  float qb=asin(clamp(q.z,-1.,1.)),cen=exp(-l*l/1.5);
  float thick=mix(.145,.235,cen)*(.8+.5*fbm3(g*1.7+sd+3.,3));
  float disk=exp(-qb*qb/(thick*thick)),wide=exp(-abs(b)/.42);
  float bulge=exp(-l*l/.3-b*b/.052);
  // Clouds of unresolved stars, three sizes. Light first, and smooth at large scale: the band is a glow, not a texture.
  vec3 sq=q*vec3(1.,1.,2.2);
  float c1=fbm3(sq*3.4+sd+21.,5),c2=fbm3(sq*11.+sd+33.,5);
  float clouds=smoothstep(.28,.74,c1);
  float light=disk*(.3+.95*clouds)*(.8+.4*c2)+bulge*(.8+.7*c2)+wide*.05;
  // Dust: thin dark ribbons of a warped field, thick along the plane's middle and wisping out a little way from it.
  vec3 dq=q*vec3(1.,1.,3.6)+.08*vec3(fbm3(g*8.+sd,4)-.5);
  float big=smoothstep(.44,.66,fbm3(dq*2.6+sd+60.,6)),fine=smoothstep(.42,.68,fbm3(dq*7.+sd+71.,6));
  float dust=clamp(big*(.45+.65*fine)*exp(-qb*qb/.011),0.,.86);
  vec3 col=mix(vec3(.66,.76,1.),vec3(1.,.87,.68),clamp(bulge*1.3+cen*.4,0.,1.));
  col=mix(col,vec3(.9,.82,.78),.22*(1.-c2));
  col*=mix(vec3(1.),vec3(.62,.42,.3)*.3,dust);
  // Countless stars too faint to see one by one give the band its grain. Each texel is a little crowd of them.
  float n=h2(ivec2(gl_FragCoord.xy)),n2=h2(ivec2(gl_FragCoord.xy)+ivec2(1711,377));
  light*=.8+.42*n*n+.36*n2*n2*n2;
  // Glowing hydrogen, a few soft pink knots low in the plane.
  float hii=smoothstep(.7,.86,fbm3(q*9.+sd+90.,4))*disk;col+=vec3(.95,.2,.32)*hii*.07*(1.-dust);
  col*=light;
  o=vec4(sqrt(clamp(col*.55,0.,1.)),1);}`;

// The land, once per screen size. Layers from near to far: the snow and the river in front of the camera, a ray marched
// through their height, then the trees on the ridge, the city and two ranges of mountains. The sky's light is added later, so this only
// stores what each surface is: colour, facing, how much air lies in front of it, and any light of its own.
const LAND_FS=LIB+CAM+`
in vec2 v;layout(location=0) out vec4 o0;layout(location=1) out vec4 o1;layout(location=2) out vec4 o2;
uniform sampler2D uCrest,uCity,uTrees,uGrass;uniform vec3 uStrip,uBends[3];uniform vec4 uRiver;uniform float uPx,uSeed;
const float EYE=1.55,D=430.;
float crestAt(float az){return textureLod(uCrest,vec2(az/(2.*uStrip.x)+.5,.5),0.).r;}
// The ground, in metres from the eye: down at the feet, rising to the ridge, smooth along the ridge line itself.
// How far across the river a point is from its middle: 1 on the far bank, -1 on the near one. main.js works out the same line.
float riverU(vec2 p){float c=uRiver.x+uRiver.y*p.x;for(int i=0;i<3;i++)c+=uBends[i].y*sin(uBends[i].x*p.x+uBends[i].z);return (p.y-c)/uRiver.z;}
float plain(vec2 p){
  float d=length(p),az=atan(p.x,p.y),k=min(d/D,1.);
  float h=mix(-EYE,D*tan(crestAt(az)),k*k*(3.-2.*k)*k);
  float amp=min(d*.035,3.2)*(1.-smoothstep(.62*D,.96*D,d));
  h+=amp*(fbm(p*.011+uSeed,3)-.5)*3.+min(d*.03,.8)*(fbm(p*.07+uSeed+4.,3)-.5)*1.5*(1.-smoothstep(.6*D,.95*D,d));
  h+=(fbm(p*.42+uSeed+7.,3)-.5)*.34*smoothstep(1.,6.,d)*(1.-smoothstep(.5*D,.9*D,d));
  return h-max(d-D,0.)*.04;}
// The open ground with the river's bed pressed into it.
float ground(vec2 p){float u=riverU(p),f=abs(u),b=uRiver.w-.7;if(f<.85)return b;float h=plain(p);if(f>2.4)return h;h=mix(h,b,1.-smoothstep(.85,1.75,f));
  if(u>0.)return h;
  // The slope down to the water stays under the line of sight to the near bank, so no rise in the snow can hide the river.
  return mix(h,min(h,max(-EYE-.31*(length(p)-5.),uRiver.w+.3)),1.-smoothstep(1.6,2.4,f));}
// How the snow has settled: long wind-cut ridges and fine crust. Scaled away once a pixel is too coarse to hold them.
float detail(vec2 p,float fw){
  vec2 w=mat2(.86,-.5,.5,.86)*p;
  float a=fbm(vec2(w.x*.35,w.y*.6)+uSeed,4)*.035*(1.-smoothstep(.2,1.,fw));
  float b=(1.-abs(vn(vec2(w.x*1.3,w.y*4.)+fbm(p*2.,2)*2.)*2.-1.))*.004*(1.-smoothstep(.04,.14,fw));
  float c=(fbm(p*11.+3.,4)-.5)*.012*(1.-smoothstep(.015,.05,fw));
  float e=(vn(p*60.)-.5)*.004*(1.-smoothstep(.004,.014,fw));
  return a+b+c+e;}
// A cover of snow thin enough that dark ground and grass come through it where the wind has scoured.
float cover(vec2 p,float d,float fw){
  vec2 w=vec2(fbm(p*.5+uSeed+23.,3),fbm(p*.5+uSeed+29.,3))-.5;vec2 q=p+w*5.;
  float c=fbm(q*.21+uSeed+13.,4)*.46+fbm(q*.9+uSeed+19.,4)*.3+fbm(q*3.7+7.,4)*.16+fbm(q*15.,3)*.08;
  float th=smoothstep(.3,.47,c+smoothstep(14.,120.,d)*.3);
  // Near the edge of the cover the snow lies in grains and scraps between the stalks.
  return clamp(th+(fbm(p*34.,3)-.5)*1.3*(1.-smoothstep(.02,.09,fw))*(1.-abs(th*2.-1.)),0.,1.);}
void surface(vec2 p,float d,float fw,out vec3 alb,out vec3 n,out float glint){
  float e=max(fw*1.2,.006),h0=ground(p)+detail(p,fw);
  float hx=ground(p+vec2(e,0))+detail(p+vec2(e,0),fw),hy=ground(p+vec2(0,e))+detail(p+vec2(0,e),fw);
  n=normalize(vec3(-(hx-h0)/e,-(hy-h0)/e,1.));
  float sn=cover(p,d,fw),g=fbm(p*5.+9.,3),gr=vn(vec2(p.x*90.,p.y*26.)+vn(p*7.)*6.);
  vec3 earth=mix(vec3(.05,.045,.036),vec3(.16,.135,.08),smoothstep(.34,.72,g))*(.6+.8*gr*(1.-smoothstep(.02,.1,fw)));
  // Hollows hold their shade, and old snow is a shade duller than new.
  vec3 snow=vec3(.76,.82,.9)*(.84+.24*fbm(p*.45+2.,4))*(.9+.14*smoothstep(-.03,.03,detail(p,fw)-.03));
  alb=mix(earth,snow,sn);
  n=normalize(mix(normalize(n+vec3((gr-.5)*.9,(vn(p*50.)-.5)*.9,0.)*(1.-smoothstep(.02,.1,fw))),normalize(n*vec3(1.8,1.8,1.)),sn));
  // Single grains that catch the light, only on the snow and only where a pixel is about the size of a grain.
  glint=step(.9988,h2(ivec2(gl_FragCoord.xy)))*sn*(1.-smoothstep(5.,50.,d));}
float ridge(float x,float s){float a=.5,r=0.,f=1.;for(int i=0;i<6;i++){r+=a*(1.-abs(vn(vec2(x*f+s,s+float(i)*3.1))*2.-1.));a*=.48;f*=2.13;}return r;}
void range(float az,float el,float s,float lo,float hi,out float c,out vec3 alb,out vec3 n){
  float x=az*3.1,top=lo+(hi-lo)*pow(ridge(x,s),1.25)*(.74+.36*vn(vec2(az*.8+s,1.)));
  c=smoothstep(-uPx,uPx,top-el);
  // Faces lean down from the ridge in long diagonals. From this far away only the big ones show.
  vec2 q=vec2(az*42.+el*30.,el*96.)+s;
  float e=.4,f0=fbm(q,5),fx=fbm(q+vec2(e,0),5),fy=fbm(q+vec2(0,e),5);
  n=normalize(vec3((f0-fx)*4.,-1.,(f0-fy)*4.+.7));
  float rock=smoothstep(.52,.66,fbm(vec2(az*32.+el*50.,el*120.)+s+5.,4)-(top-el)/max(top,.001)*.1);
  alb=mix(vec3(.62,.67,.76),vec3(.05,.055,.07),rock*.75);}
void main(){
  vec3 d=rayDir(v*2.-1.);float az=atan(d.x,d.y),el=asin(clamp(d.z,-1.,1.));
  vec3 alb=vec3(0),nor=vec3(0),em=vec3(0);float cov=0.,haze=0.,gl=0.;
  // The near snow. Rays that only skim the ridge get a part of a pixel, which is what keeps its line smooth.
  float t=1.2,hit=0.,minr=1.;
  if(d.z<.08){for(int i=0;i<260;i++){vec3 q=d*t;float h=q.z-max(ground(q.xy),uRiver.w);if(h<.0015*t){hit=1.;break;}minr=min(minr,h/t);t+=clamp(h*.6,.02*t+.03,.05*t+.4);if(t>D*1.4)break;}
    if(hit>.5){float a=t*.86,b=t;for(int i=0;i<5;i++){float m=(a+b)*.5;vec3 q=d*m;if(q.z-max(ground(q.xy),uRiver.w)<0.)b=m;else a=m;}t=b;}}
  float c0=hit>.5?1.:1.-smoothstep(0.,uPx*1.4,minr);
  if(c0>0.){vec2 p=(d*t).xy;float fw=t*uPx/max(-d.z+.012,.012),dep=uRiver.w-ground(p);vec3 a,n;float g;
    if(dep>0.){
      // Water. Its light is worked out each frame, so this keeps how open it is: the shallows have skinned over with ice
      // and a dusting of snow. Glint is negative here to mark it, and the first channel of the emission says where the
      // reflection runs into the bank on the far side instead of going on up to the sky.
      vec3 r=vec3(d.xy,-d.z),q0=vec3(p,uRiver.w);float s=.6,mr=1.;
      for(int i=0;i<64;i++){vec3 q=q0+r*s;float h=q.z-ground(q.xy);mr=min(mr,h/s);if(h<0.)break;s+=clamp(h*.7,.3+.02*s,6.);if(s>D*1.3)break;}
      em.r=1.-smoothstep(0.,.012,mr);a=vec3(.72,.78,.86);n=vec3(0,0,1);
      g=-max(smoothstep(.02,.2,dep+(fbm(p*.3+uSeed+41.,4)-.5)*.3),.004);
    }else surface(p,t,fw,a,n,g);
    alb=a*c0;nor=n*c0;haze=c0*smoothstep(0.,D*1.2,t)*.1;gl=g;cov=c0;}
  // Dry grass standing up through the thin snow, painted in place for this view.
  vec4 tu=texture(uGrass,v);if(tu.a>0.){vec3 a=pow(tu.rgb/max(tu.a,.004),vec3(2.2));alb=alb*(1.-tu.a)+a*tu.a;nor=nor*(1.-tu.a)+vec3(0,-.55,.84)*tu.a;gl*=1.-tu.a;em*=1.-tu.a;cov=cov+(1.-cov)*tu.a;}
  // The strips hold their colours as painted, with alpha already multiplied in.
  vec2 suv=vec2(az/(2.*uStrip.x)+.5,(el-uStrip.y)/(uStrip.z-uStrip.y));
  // Sampled before the branch, since a texture read inside one can pick the wrong mip along its edge.
  vec4 tr=texture(uTrees,suv,-.6),ci=texture(uCity,suv,-1.1);
  if(cov<1.&&suv.y>0.&&suv.y<1.&&abs(az)<uStrip.x){
    float k=(1.-cov)*tr.a;
    if(k>0.){alb+=k*pow(tr.rgb/max(tr.a,.004),vec3(2.2));nor+=k*vec3(0,-.25,.97);haze+=k*.2;cov+=k;}
    k=(1.-cov)*ci.a;
    if(k>0.){em+=(1.-cov)*pow(ci.rgb,vec3(1.9));alb+=k*vec3(.02);nor+=k*vec3(0,-1,0);haze+=k*.2;cov+=k;}}
  if(cov<1.){float c;vec3 a,n;
    range(az,el,uSeed+3.,.014,.066,c,a,n);float k=(1.-cov)*c;if(k>0.){alb+=k*a;nor+=k*n;haze+=k*.36;cov+=k;}
    if(cov<1.){range(az,el,uSeed+17.,.03,.112,c,a,n);k=(1.-cov)*c;if(k>0.){alb+=k*a;nor+=k*n;haze+=k*.55;cov+=k;}}}
  float iv=cov>0.?1./cov:0.;
  o0=vec4(sqrt(clamp(alb*iv,0.,1.)),cov);o1=vec4(normalize(nor+1e-5)*.5+.5,haze*iv);o2=vec4(em,gl);}`;

// High cloud and the faint banded airglow, at a quarter of the resolution: rgb is what they add, alpha what they let through.
const CLOUD_FS=LIB+CAM+`
in vec2 v;out vec4 o;uniform float uCov,uT;uniform vec2 uWind;uniform vec3 uLight,uCity,uMoonDir,uMoonCol;uniform float uSeed;
void main(){
  vec3 d=rayDir(v*2.-1.);
  if(d.z<.002){o=vec4(0,0,0,1);return;}
  float z=d.z,t=7./(z+.03),fade=smoothstep(.0,.05,z);
  vec2 p=d.xy*t;
  // Airglow: long slow ripples high in the atmosphere, strongest where the line of sight runs through most of the layer.
  float vr=1./sqrt(1.-.972*(1.-z*z));vec2 ap=d.xy/(z+.2);
  float wv=.5+.5*sin(dot(ap,vec2(5.1,3.4))+uT*.021+fbm(ap*1.3+uSeed,3)*7.)*fbm(ap*.8+uT*.003+uSeed,3)*1.5;
  vec3 air=(vec3(.00024,.00062,.00028)*(.45+wv)+vec3(.0001,.00005,.00006)*(.6+.6*fbm(ap*.7+uSeed+3.,3)))*vr;
  if(uCov<.01){o=vec4(air*fade,1);return;}
  vec2 q=p*.15+uWind;
  float w1=fbm(q*.6+uSeed+5.,3)-.5,w2=fbm(q*.6+uSeed+9.,3)-.5;
  vec2 qq=q+vec2(w1,w2)*2.6;
  float c=fbm(qq,6),big=fbm(q*.17+uSeed,3);
  float thr=mix(.9,.2,uCov)-.2*(big-.5);
  float dens=smoothstep(thr,thr+.3,c);
  // Long streaks of ice, seen thin overhead and thick along the line of sight near the horizon.
  dens*=mix(.62,1.,smoothstep(.45,.05,z));dens*=.35+.65*vn(vec2(qq.x*3.,qq.y*.7));
  dens=clamp(dens*1.15,0.,.94);
  float cm=exp(-max(z,0.)/.09);float ph=pow(max(dot(d,uMoonDir),0.),10.)*.9+.1;
  vec3 s=uLight*.2+uCity*(.05+cm*.85)+uMoonCol*ph*.1+vec3(.0012,.0016,.0026);
  o=vec4(air*(1.-dens*.6)*fade+s*dens*fade,1.-dens*fade);}`;

const SCENE_FS=LIB+CAM+`
in vec2 v;out vec4 o;
uniform sampler2D uG0,uG1,uG2,uA,uC,uMW,uB3,uB6,uRef,uBoatT;uniform vec4 uBoat;uniform vec3 uBoatS,uLamp,uLampC;uniform float uFlow,uFlowD;
uniform mat3 uSkyI;uniform vec3 uMoonDir,uMoonCol,uCity,uAmb;uniform float uCityAz,uCityW,uMoon,uMW1,uT,uSeed,uLevel,uRip,uPx;uniform vec3 uMoonP;
// The river's slope at a point: three sizes of ripple, long along the current and carried by it, the finer ones a little
// faster. Each fades out where a pixel is too coarse to hold it.
vec2 ripple(vec2 p,float fw){vec2 g=vec2(0),sc=vec2(.3,1.05);float a=1.,T=uT*.1;
  for(int i=0;i<3;i++){float m=1.+float(i)*.22,k=1.-smoothstep(.25,1.,fw*sc.y);vec2 q=(p-vec2(uFlowD*m,0))*sc+vec2(0,T*m)+float(i)*37.;float h=vn(q);
    g+=vec2(vn(q+vec2(.35,0))-h,vn(q+vec2(0,.35))-h)*a*k;sc*=2.7;a*=.62;}
  return g;}
// Where a line of sight meets the boat, which passes side on, so it's a picture standing on the water. q is the point
// reached and em what glows there.
vec4 boatAt(vec3 o,vec3 r,out vec3 q,out vec3 em){em=vec3(0);q=vec3(0);if(uBoat.z<=0.)return vec4(0);
  float s=(uBoat.y-o.y)/r.y;if(s<=0.)return vec4(0);q=o+r*s;
  float x=(q.x-uBoat.x)/uBoat.z,y=(q.z-uBoatS.x-x*uBoatS.y*uBoat.z)/uBoat.w;if(abs(x)>.5||y<0.||y>1.)return vec4(0);
  em=textureLod(uBoatT,vec2(x+.5,y*.495),uBoatS.z).rgb;return textureLod(uBoatT,vec2(x+.5,.505+y*.495),uBoatS.z);}
// The boat is lit by the same sky as the snow, faintly, since it faces the viewer and not the sky, and by its own lamp.
vec3 boatLit(vec4 b,vec3 q,vec3 sky){vec3 a=pow(b.rgb/max(b.a,.004),vec3(2.2)),e=q-uLamp;return a*(sky*.34+uAmb*.8+uLampC*1.6/(1.+dot(e,e)*.7));}
// The glow of the city on the air above it, in the night's neon, with a warm core.
vec3 dome(float az,float el){float x=(az-uCityAz)/uCityW,w=exp(-x*x*1.5);float e=max(el,0.);
  return uCity*w*(exp(-e/.05)*.2+exp(-e/.17)*.06)+vec3(.022,.01,.006)*w*exp(-e/.035);}
vec3 base(vec3 d){float z=max(d.z,0.),el=asin(clamp(d.z,-1.,1.)),az=atan(d.x,d.y);
  vec3 c=mix(vec3(.0032,.0042,.0084),vec3(.0007,.0011,.0029),smoothstep(0.,.7,pow(z,.6)));
  c+=dome(az,el);
  // Moonlight scattered in the air: a blue sky turned very far down, brighter around the moon.
  float mc=dot(d,uMoonDir);c+=uMoonCol*(vec3(.018,.03,.058)*(.6+.8*mc*mc)+vec3(.05,.05,.056)*exp((mc-1.)*42.)+vec3(.12)*exp((mc-1.)*900.));
  return c;}
float airmass(float z){return 1./(max(z,0.)+.15*pow(max(z,0.)+.11,-1.25)*.1+.02);}
// A wide lens stretches things near the edge of the view, which the eye forgives in stars and not in the moon, so it is
// drawn as a true circle on the screen. p is the pixel's offset from its centre, in moon radii.
vec3 moon(vec2 ndc){if(uMoon<=0.||uMoonP.z<=0.)return vec3(0);
  vec2 p=(ndc-uMoonP.xy)*vec2(uTan.x,uTan.y)/uMoonP.z;float r=length(p);if(r>1.3)return vec3(0);
  float zz=sqrt(max(1.-r*r,0.)),th=uMoon*PI;vec3 L=normalize(vec3(sin(th)*.92,.38*sin(th),-cos(th)));
  float lit=smoothstep(-.03,.08,dot(vec3(p,zz),L));float sea=.62+.5*fbm(p*2.3+uSeed,4);
  return uMoonCol*(1.-smoothstep(.96,1.02,r))*(lit*sea*2.6+.012);}
void main(){
  vec2 ndc=v*2.-1.;vec3 d=rayDir(ndc);ivec2 px=ivec2(gl_FragCoord.xy);
  vec4 g0=texelFetch(uG0,px,0),g1=texelFetch(uG1,px,0),g2=texelFetch(uG2,px,0);
  vec3 col=vec3(0);float z=max(d.z,0.),az=atan(d.x,d.y),el=asin(clamp(d.z,-1.,1.));
  // What the whole sky is giving out right now, from the bloom's deepest level of the last frame.
  vec3 sky=vec3(0);for(int i=0;i<5;i++)sky+=textureLod(uB6,vec2(.1+.2*float(i),.72),0.).rgb;sky*=.2;
  vec3 skyL=textureLod(uB6,vec2(.2,.75),0.).rgb,skyR=textureLod(uB6,vec2(.8,.75),0.).rgb;
  if(g0.a<1.){
    float am=airmass(z),tr=exp(-.2*(am-1.));
    vec3 e=uSkyI*d;vec2 muv=vec2(atan(e.y,e.x)/TAU,asin(clamp(e.z,-1.,1.))/PI+.5);
    vec3 mw=textureLod(uMW,muv,0.).rgb;mw=mw*mw*uMW1;
    vec3 au=texture(uA,v).rgb;
    vec4 cl=textureLod(uC,v,0.);
    vec3 s=(mw+moon(ndc)+au)*tr*vec3(1.,.97-.3*(1.-tr),.92-.5*(1.-tr));
    col=(base(d)+s)*cl.a+cl.rgb;}
  if(g0.a>0.){
    vec3 alb=g0.rgb*g0.rgb,n=g1.rgb*2.-1.;
    // Snow under an open sky ends up about as bright as the sky itself, tinted by whichever side is brightest.
    // Snow under an open sky is lit by all of it at once, so it never gets near the brightness of the curtains themselves.
    float tilt=clamp(1.+.8*n.y+(dot(skyR-skyL,vec3(.3,.6,.1))/max(dot(sky,vec3(.3,.6,.1)),1e-4))*n.x*1.2,.3,2.);
    vec3 E=sky*.5*(.45+.55*n.z)*tilt;E=mix(E,vec3(dot(E,vec3(.3,.6,.1))),.5)+uAmb*(.55+.45*n.z);
    E+=uMoonCol*.3*max(dot(n,uMoonDir),0.);
    // The snow nearest the horizon picks up the city's glow.
    E+=dome(az,0.)*.6*exp(min(el,0.)*11.);
    vec3 lit=alb*E;
    // Packed snow turns glossy at a grazing angle, so the brightest curtains smear down across it.
    vec3 r=reflect(d,normalize(mix(n,vec3(0,0,1),.93)));float rf=dot(r,uF);
    if(rf>.05&&g1.a<.3){vec2 c=vec2(dot(r,uR)/uTan.x,dot(r,uU)/uTan.y)/rf;vec3 m=textureLod(uB3,clamp(c*.5+.5,0.,1.),0.).rgb;
      lit+=m*.035*pow(1.-max(-d.z,0.),6.)*smoothstep(.25,.7,dot(alb,vec3(.33)));}
    lit+=max(g2.a,0.)*sky*3.2*(.55+.45*sin(uT*1.3+float(px.x)*.7));
    // The river is a mirror of everything above it, read from the last frame. Seen from the water everything near sits a
    // little lower than it does from up here, so the mirror starts a little lower too, and the far shore meets its own
    // reflection. It climbs a little faster than a flat mirror, so more of the aurora reaches the water.
    float wet=-min(g2.a,0.);
    if(wet>0.){
      float tw=uLevel/min(d.z,-.002),fw=tw*uPx/max(-d.z,.012);vec2 pw=d.xy*tw;
      // A boat roughs up the water just around it and behind it.
      vec2 bk=(pw-uBoat.xy)/vec2(max(uBoat.z,1.)*.8,1.5);bk.x+=sign(uFlow)*.5;
      vec3 wn=normalize(vec3(-ripple(pw,fw)*(uRip+(uBoat.z>0.?.3*exp(-dot(bk,bk)):0.)),1.)),r0=reflect(d,wn),r=normalize(vec3(r0.xy,max(r0.z,.004)*1.3-.03));
      vec2 c=vec2(dot(r,uR)/uTan.x,dot(r,uU)/uTan.y)/max(dot(r,uF),.05);
      vec3 m=mix(textureLod(uRef,clamp(c*.5+.5,.001,.999),0.).rgb,lit,g2.r),bq,be;
      vec4 bb=boatAt(vec3(pw,uLevel),r0,bq,be);m=mix(m,boatLit(bb,bq,sky),bb.a)+be*2.;
      float F=.05+.95*pow(1.-max(dot(-d,wn),0.),5.);vec3 w=m*F+vec3(.0008,.0014,.002)*(1.-F);
      // The boat's lamp on the water: a tall streak, since at this low an angle the smallest ripple sends it a long way down.
      vec3 ld=normalize(uLamp-vec3(pw,uLevel)),le=ld-r0;w+=uLampC*step(0.,ld.y)*exp(-le.x*le.x/.00011-le.z*le.z/.0034)*1.5;
      // Pans of new ice ride the current, which is what shows it to be moving when the wind drops.
      vec2 fq=vec2(pw.x-uFlowD,pw.y+2.*sin(pw.x*.04));float pan=smoothstep(.8,.83,vn(fq*vec2(.2,.62)+uSeed)*.72+vn(fq*vec2(.7,1.9)+uSeed+7.)*.28);
      lit=mix(lit,w,wet*(1.-.92*pan));}
    lit=mix(lit,base(normalize(vec3(d.xy,.012)))*1.05+sky*.1,g1.a);
    col=col*(1.-g0.a)+lit*g0.a;}
  if(g2.a>=0.)col+=g2.rgb*2.3;
  {vec3 q,em;vec4 b=boatAt(vec3(0),d,q,em);col=mix(col,boatLit(b,q,sky),b.a)+em*3.;}
  o=vec4(col,1);}`;

// Stars and everything else that is a point of light: a small Gaussian each, added straight into the picture.
const STAR_VS=LIB+CAM+`
in vec3 aD;in vec4 aC;out vec3 vC;out float vS;
uniform mat3 uSky;uniform float uT,uPsf,uStarK;uniform sampler2D uC;
void main(){
  vec3 w=uSky*aD;vec3 c=vec3(dot(w,uR),dot(w,uU),dot(w,uF));
  gl_Position=vec4(2,2,2,1);gl_PointSize=0.;vC=vec3(0);vS=1.;
  if(c.z<=.02||w.z<-.01)return;
  vec2 n=c.xy/(c.z*uTan);if(abs(n.x)>1.03||abs(n.y)>1.03)return;
  float z=max(w.z,0.),am=1./(z+.04),tr=exp(-.2*(am-1.));
  // Stars twinkle most low down, where their light crosses the most air.
  float id=float(gl_VertexID);float tw=1.+min(am*.055,.55)*(vn(vec2(id*.37,uT*(3.+7.*fract(id*.618))))-.5)*2.;
  float cl=textureLod(uC,n*.5+.5,0.).a;
  float f=aC.a*tr*tw*cl*uStarK;
  float sg=uPsf*(1.+.34*log2(1.+f*5.));
  gl_Position=vec4(n,0,1);gl_PointSize=min(ceil(sg*7.),64.);
  vC=aC.rgb*f/(sg*sg);vS=sg;}`;
const STAR_FS=LIB+`
in vec3 vC;in float vS;out vec4 o;uniform sampler2D uG0;
void main(){vec2 p=(gl_PointCoord-.5)*(ceil(vS*7.));float e=exp(-dot(p,p)/(2.*vS*vS));
  o=vec4(vC*e*(1.-texelFetch(uG0,ivec2(gl_FragCoord.xy),0).a),1);}`;
// Lights in the land and the air, already placed on the screen by the host. Lights near the ground aren't hidden by it.
const SPR_VS=`#version 300 es
in vec3 aP;in vec3 aC;out vec3 vC;void main(){vC=aC;gl_Position=vec4(aP.xy,0,1);gl_PointSize=aP.z;}`;
const SPR_FS=LIB+`
in vec3 vC;out vec4 o;void main(){vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);o=vec4(vC*exp(-r*5.),1);}`;

// Bloom: a soft chain of smaller and smaller copies, added back up. It stands in for the glow of the air and the lens.
const BD_FS=LIB+`
in vec2 v;out vec4 o;uniform sampler2D uT;uniform vec2 uPx;
void main(){vec2 p=uPx;
  vec3 c=texture(uT,v).rgb*.125;
  c+=(texture(uT,v+p*vec2(-1,-1)).rgb+texture(uT,v+p*vec2(1,-1)).rgb+texture(uT,v+p*vec2(-1,1)).rgb+texture(uT,v+p*vec2(1,1)).rgb)*.125;
  c+=(texture(uT,v+p*vec2(-2,-2)).rgb+texture(uT,v+p*vec2(2,-2)).rgb+texture(uT,v+p*vec2(-2,2)).rgb+texture(uT,v+p*vec2(2,2)).rgb)*.03125;
  c+=(texture(uT,v+p*vec2(-2,0)).rgb+texture(uT,v+p*vec2(2,0)).rgb+texture(uT,v+p*vec2(0,-2)).rgb+texture(uT,v+p*vec2(0,2)).rgb)*.0625;
  o=vec4(min(c,vec3(60.)),1);}`;
const BU_FS=LIB+`
in vec2 v;out vec4 o;uniform sampler2D uT;uniform vec2 uPx;uniform float uW;
void main(){vec2 p=uPx;
  vec3 c=texture(uT,v).rgb*.25;
  c+=(texture(uT,v+vec2(p.x,0)).rgb+texture(uT,v-vec2(p.x,0)).rgb+texture(uT,v+vec2(0,p.y)).rgb+texture(uT,v-vec2(0,p.y)).rgb)*.125;
  c+=(texture(uT,v+p).rgb+texture(uT,v-p).rgb+texture(uT,v+vec2(p.x,-p.y)).rgb+texture(uT,v+vec2(-p.x,p.y)).rgb)*.0625;
  o=vec4(c*uW,1);}`;
const FINAL_FS=LIB+`
in vec2 v;out vec4 o;uniform sampler2D uH,uB;uniform float uT,uFade;
vec3 tone(vec3 c){
  // Linear through the dark so the night keeps its depth, then a long shoulder. Very bright curtains go pale, as they do on film.
  float l=dot(c,vec3(.2126,.7152,.0722));vec3 t=1.-exp(-c*1.08);float tl=1.-exp(-l*1.08);
  return mix(t,t*(tl/max(dot(t,vec3(.2126,.7152,.0722)),1e-5)),.14)+vec3(max(l-1.6,0.)*.03);}
void main(){
  vec3 c=texture(uH,v).rgb+texture(uB,v).rgb*.034;
  vec2 q=v*2.-1.;c*=1.-.2*pow(dot(q*vec2(.72,.82),q*vec2(.72,.82)),1.4);
  c=tone(c)*uFade;
  c=pow(max(c,0.),vec3(1./2.2));
  ivec2 p=ivec2(gl_FragCoord.xy),f=ivec2(int(uT*61.)&511,int(uT*37.)&511);
  // Dither by two noise values, so the sky's long gradients don't step, plus a whisper of grain that shows mostly in the dark.
  float n=h2(p+f)+h2(p+f+ivec2(113,57))-1.;
  o=vec4(c+n*(1.3/255.)*(1.+1.4*(1.-c.g)),1);}`;

/* ---------- plumbing ---------- */
function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(vs,fs,attrs=['a']){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));attrs.forEach((n,i)=>gl.bindAttribLocation(p,i,n));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));const u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
  for(let i=0;i<n;i++){const a=gl.getActiveUniform(p,i),name=a.name.replace(/\[0\]$/,'');u[name]=gl.getUniformLocation(p,name);}return{p,u};}
let RIB,MERGE,DWN,MARCH,MW,LAND,CLOUD,SCENE,STAR,SPR,BD,BU,FINAL;
try{RIB=program(RIB_VS,RIB_FS,['aP','aA','aE']);MERGE=program(VS,MERGE_FS);DWN=program(VS,DOWN_FS);MARCH=program(VS,MARCH_FS);MW=program(VS,MW_FS);LAND=program(VS,LAND_FS);CLOUD=program(VS,CLOUD_FS);SCENE=program(VS,SCENE_FS);
  STAR=program(STAR_VS,STAR_FS,['aD','aC']);SPR=program(SPR_VS,SPR_FS,['aP','aC']);BD=program(VS,BD_FS);BU=program(VS,BU_FS);FINAL=program(VS,FINAL_FS);}catch(e){console.error(e);A.fallback();return;}

function tex(w,h,ifmt,fmt,type,filter,wrapS,wrapT,data=null){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,ifmt,w,h,0,fmt,type,data);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter===gl.NEAREST?gl.NEAREST:gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrapS||gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrapT||gl.CLAMP_TO_EDGE);return t;}
const F16=(w,h,f=gl.LINEAR,s,t)=>tex(w,h,gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT,f,s,t);
function target(...ts){const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);ts.forEach((t,i)=>gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,t,0));
  if(ts.length>1)gl.drawBuffers(ts.map((_,i)=>gl.COLOR_ATTACHMENT0+i));return f;}
const free=(...xs)=>{for(const x of xs)if(x){if(x instanceof WebGLTexture)gl.deleteTexture(x);else gl.deleteFramebuffer(x);}};
function bind(P,name,unit,t){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(P.u[name],unit);}
function cam(P,C){gl.uniform3fv(P.u.uF,C.f);gl.uniform3fv(P.u.uR,C.r);gl.uniform3fv(P.u.uU,C.u);gl.uniform2f(P.u.uTan,C.tanH,C.tanV);}
const quad=gl.createVertexArray();gl.bindVertexArray(quad);{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);}
const tri=()=>{gl.bindVertexArray(quad);gl.drawArrays(gl.TRIANGLES,0,3);};

// The sheets' vertices, rewritten every frame. s and row on the map, then across, along, flux, detail scale, hardness, softness, ray contrast and weight.
const STRIDE=10,MAXV=LOWQ?90000:240000,VBD=new Float32Array(MAXV*STRIDE);
const ribVao=gl.createVertexArray(),ribVb=gl.createBuffer();gl.bindVertexArray(ribVao);gl.bindBuffer(gl.ARRAY_BUFFER,ribVb);gl.bufferData(gl.ARRAY_BUFFER,VBD.byteLength,gl.DYNAMIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,STRIDE*4,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,STRIDE*4,8);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,STRIDE*4,24);

const mapS=F16(COLS,ROWS,gl.LINEAR,gl.REPEAT),mapF=[F16(COLS,ROWS,gl.LINEAR,gl.REPEAT),F16(COLS,ROWS,gl.LINEAR,gl.REPEAT)],mapD=F16(COLS,ROWS/DOWN,gl.LINEAR,gl.REPEAT);
const fbS=target(mapS),fbF=[target(mapF[0]),target(mapF[1])],fbD=target(mapD);let mapI=0;
for(const f of[fbS,...fbF,fbD]){gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}

/* ---------- stars ---------- */
function makeStars(){
  const r=stream('stars'),n=LOWQ?19000:80000,D=new Float32Array((n+STARS.length)*7);let o=0;
  const put=(x,y,z,c,f)=>{D[o++]=x;D[o++]=y;D[o++]=z;D[o++]=c[0];D[o++]=c[1];D[o++]=c[2];D[o++]=f;};
  const flux=m=>Math.pow(10,-.4*m)*3.4;
  for(const[ra,de,m,bv]of STARS){const a=ra*15*DEG,d=de*DEG;put(Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d),starColor(bv),flux(m));}
  const G=[[-.0548756,-.8734371,-.4838350],[.4941094,-.4448296,.7469822],[-.8676661,-.1980764,.4559838]];
  for(let i=0;i<n;){
    const z=r()*2-1,a=r()*TAU,s=Math.sqrt(1-z*z),x=s*Math.cos(a),y=s*Math.sin(a);
    // Faint stars crowd toward the plane of the galaxy. Bright ones hardly care.
    const b=G[2][0]*x+G[2][1]*y+G[2][2]*z,m=8.1+Math.log10(1-r()*.9998)/.46;
    if(m<3.4)continue;
    const keep=.14+.86*Math.exp(-b*b/(m>6?.035:.2));if(r()>keep)continue;
    const bv=clamp(.42+(r()+r()+r()-1.5)*.95,-.3,1.8);put(x,y,z,starColor(bv),flux(m));i++;}
  const vao=gl.createVertexArray(),b=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,D,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,28,12);
  return{vao,n:o/7};}
const stars=makeStars();
const SPRN=800,sprD=new Float32Array(SPRN*6),sprVao=gl.createVertexArray(),sprVb=gl.createBuffer();gl.bindVertexArray(sprVao);gl.bindBuffer(gl.ARRAY_BUFFER,sprVb);gl.bufferData(gl.ARRAY_BUFFER,sprD.byteLength,gl.DYNAMIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);

/* ---------- things baked once ---------- */
const MWW=LOWQ?1536:4096,MWH=MWW/2,mwTex=tex(MWW,MWH,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,gl.LINEAR,gl.REPEAT),fbMW=target(mwTex);
let cityTex=null,treeTex=null,crestTex=null,grassTex=null;
function bakeMW(y0,y1){gl.bindFramebuffer(gl.FRAMEBUFFER,fbMW);gl.viewport(0,0,MWW,MWH);gl.useProgram(MW.p);gl.uniform1f(MW.u.uSeed,NIGHT.mwSeed);gl.enable(gl.SCISSOR_TEST);gl.scissor(0,y0,MWW,y1-y0);tri();gl.disable(gl.SCISSOR_TEST);}
function strips(){
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  const put=c=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;};
  cityTex=put(paintCity());treeTex=put(paintTrees());
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  const n=1024,D=new Float32Array(n);for(let i=0;i<n;i++)D[i]=crest((i/(n-1)*2-1)*strip.az);
  crestTex=tex(n,1,gl.R16F,gl.RED,gl.FLOAT,gl.LINEAR,0,0,D);}

/* ---------- sizes ---------- */
const SCALE=parseFloat(QS.get('glq'))||1;
let W=0,H=0,CW=0,CH=0,DPR=1,AW=0,AH=0,CAMERA=null;
let hdr=null,fbH=null,aur=null,fbA=null,clo=null,fbC=null,ref=null,fbR=null,G=null,fbG=null,bl=[];
// If frames keep running long, the sky's resolution steps down first, then the whole picture's.
// Embeds run at about 30 fps on purpose, and hidden pages are throttled, so neither counts.
let aq=QS.has('aq')?parseFloat(QS.get('aq')):.8,aqMax=QS.has('aq')?aq:1,dyn=1,perfLast=0,perfAcc=0,perfN=0;
function watchPace(){if(LOWQ||document.hidden||QS.has('aq')){perfLast=0;return;}const now=performance.now(),d=now-perfLast;perfLast=now;if(d>0&&d<120){perfAcc+=d;perfN++;}
  if(perfN>=90){const ms=perfAcc/perfN;perfAcc=perfN=0;
    if(ms>20){if(aq>.42){aqMax=aq*.95;aq*=.82;sizeAurora();}else if(dyn>.55){dyn*=.86;build();bakeLand();}}
    // Frames arrive no faster than the display, so holding its pace is the sign that there is room to spare.
    else if(ms<17.4&&aq<aqMax&&dyn===1){aq=Math.min(aqMax,aq*1.1);sizeAurora();}}}
function camera(){const a=W/H,tanV=clamp(1.04/Math.sqrt(a),.62,1.2),tanH=tanV*a,p=Math.atan(.4*tanV);Object.assign(VIEW,{tanV,tanH,cp:Math.cos(p),sp:Math.sin(p)});return{tanV,tanH,f:[0,Math.cos(p),Math.sin(p)],r:[1,0,0],u:[0,-Math.sin(p),Math.cos(p)]};}
function sizeAurora(){free(aur,fbA);AW=Math.max(64,Math.round(W*aq));AH=Math.max(64,Math.round(H*aq));aur=F16(AW,AH);fbA=target(aur);}
function build(){
  CW=Math.max(240,innerWidth);CH=Math.max(240,innerHeight);
  DPR=(LOWQ?.6:Math.min(2,devicePixelRatio||1))*SCALE*dyn;
  const maxPx=(LOWQ?5e5:8.3e6)*dyn*dyn;if(CW*CH*DPR*DPR>maxPx)DPR=Math.sqrt(maxPx/(CW*CH));
  W=cv.width=Math.round(CW*DPR);H=cv.height=Math.round(CH*DPR);CAMERA=camera();
  free(hdr,fbH,clo,fbC,ref,fbR,fbG);if(G)free(...G);for(const b of bl)free(b.t,b.f);
  hdr=F16(W,H);fbH=target(hdr);sizeAurora();
  // Last frame at half size, for the river to reflect.
  ref=F16(Math.max(2,W>>1),Math.max(2,H>>1));fbR=target(ref);
  const cw=Math.ceil(W/4),ch=Math.ceil(H/4);clo=F16(cw,ch);fbC=target(clo);
  G=[tex(W,H,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,gl.NEAREST),tex(W,H,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,gl.NEAREST),F16(W,H,gl.NEAREST)];fbG=target(...G);
  bl=[];let w=W,h=H;for(let i=0;i<7;i++){w=Math.max(2,w>>1);h=Math.max(2,h>>1);const t=F16(w,h);bl.push({t,f:target(t),w,h});gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);}
}
// The land, in bands, so no single draw runs long enough to stall a small GPU.
function bakeLandBand(y0,y1){const C=CAMERA,P=LAND;gl.bindFramebuffer(gl.FRAMEBUFFER,fbG);gl.viewport(0,0,W,H);gl.useProgram(P.p);cam(P,C);
  bind(P,'uCrest',0,crestTex);bind(P,'uCity',1,cityTex);bind(P,'uTrees',2,treeTex);bind(P,'uGrass',3,grassTex);gl.uniform3f(P.u.uStrip,strip.az,strip.e0,strip.e1);gl.uniform1f(P.u.uPx,2*C.tanV/H);gl.uniform1f(P.u.uSeed,NIGHT.mwSeed);
  gl.uniform4f(P.u.uRiver,RIVER.y,RIVER.tilt,RIVER.hw,RIVER.level);gl.uniform3fv(P.u.uBends,RIVER.bends.flat());
  gl.enable(gl.SCISSOR_TEST);gl.scissor(0,y0,W,y1-y0);tri();gl.disable(gl.SCISSOR_TEST);}
// The top of what the land can reach on screen. One elevation sits higher at the sides of a wide view than in the middle,
// so this is found at the edge of the frame.
function landTop(){const C=CAMERA,s=Math.sin(strip.e1);for(let y=-.4;y<1;y+=.005){const v=y*C.tanV,z=C.f[2]+v*C.u[2];if(z/Math.sqrt(1+C.tanH*C.tanH+v*v)>s)return Math.min(H,Math.ceil(H*(.5+.5*y))+2);}return H;}
function grass(){if(grassTex)gl.deleteTexture(grassTex);const c=paintGrass(W,H,CAMERA.tanH,CAMERA.tanV);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  grassTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,grassTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,c);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);}
function bakeLand(){grass();gl.bindFramebuffer(gl.FRAMEBUFFER,fbG);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);const top=landTop(),n=6;for(let i=0;i<n;i++)bakeLandBand(Math.floor(top*i/n),Math.floor(top*(i+1)/n));}

/* ---------- each frame ---------- */
// Lays every sheet onto the map as a strip of triangles.
const draws=[];
function sheet(a,sig,gain,rays){
  let first=vN,prev=null;const n=a.n,X=a.x,Y=a.y,cols=COLS,rows=ROWS;
  for(let i=0;i<n;i++){
    if(vN+2>=MAXV)break;
    const x=X[i],y=Y[i],i0=i?i-1:0,i1=i<n-1?i+1:i,tx=X[i1]-X[i0],ty=Y[i1]-Y[i0],L=Math.hypot(tx,ty)||1,nx=-ty/L,ny=tx/L;
    // The map has no room right at the zenith line itself, so a sheet fades out over its last few kilometres to it.
    const r=Math.max(Math.hypot(x,y),RMIN),near=A.sstep(3.6,9,r);if(near<=0){if(vN-first>=4)draws.push({first,count:vN-first,a,rays});first=vN;prev=null;continue;}let phi=Math.atan2(x,y);
    // The angle runs on past a half turn so a sheet that wraps the zenith stays one strip. A sheet passing right through the
    // zenith swings half a turn between two points, and which way round is a coin toss, so the strip stops there and starts again.
    if(prev!==null){while(phi-prev>Math.PI)phi-=TAU;while(phi-prev<-Math.PI)phi+=TAU;
      if(Math.abs(phi-prev)>.8){if(vN-first>=4)draws.push({first,count:vN-first,a,rays});first=vN;phi=Math.atan2(x,y);}}prev=phi;
    // How many map texels one kilometre across the sheet covers here. A sheet thinner than a texel is widened and dimmed to match.
    // Texels aren't square in kilometres, so this is the sheet's true thickness on the map: its area over its length. Far off, a
    // sheet thinner than that lands on one row and steps to the next, and every step shows in the sky as a bar.
    const rx=x/r,ry=y/r,nr=nx*rx+ny*ry,nt=nx*ry-ny*rx,J=(1+WARP*Math.cos(phi))/TAU,tc=J*cols/r,tr=UI*rows/r;
    const pxKm=tc*tr/Math.max(Math.hypot(tc*nr,tr*nt),1e-9);
    let se=Math.max(sig,1.05/pxKm);se=Math.min(se,r*.3);
    // Kilometres along the sheet per texel, so its rays can fade out smoothly before the map can no longer hold them.
    const lod=1/Math.max(Math.hypot(tc*nr,tr*nt),1e-6);
    const far=A.sstep(170,720,r),e=glow(a,i)*gain*near/se;let[hd,sf]=rays?energy(a,i):[.0,a.soft*.8+.1];sf*=1-.72*A.sstep(480,1300,r);
    const o0=vN*STRIDE;
    for(let s=-1;s<=1;s+=2){
      const px=x+nx*se*2.4*s,py=y+ny*se*2.4*s;let p2=Math.atan2(px,py);while(p2-phi>Math.PI)p2-=TAU;while(p2-phi<-Math.PI)p2+=TAU;
      const o=vN*STRIDE;VBD[o]=(p2+WARP*Math.sin(p2))/TAU+.5;VBD[o+1]=(Math.log(Math.max(Math.hypot(px,py),RMIN))-U0)*UI;VBD[o+2]=s;VBD[o+3]=a.m[i];VBD[o+4]=e;VBD[o+5]=lod;VBD[o+6]=hd;VBD[o+7]=sf;VBD[o+8]=1-.8*far;vN++;}
    // A strip narrows and widens as it crosses the map. Left alone, the two triangles of each step would interpolate
    // differently and leave a comb at the spacing of the points, so a weight like perspective makes each step one trapezoid.
    VBD[o0+9]=VBD[o0+STRIDE+9]=1/Math.max(Math.hypot((VBD[o0]-VBD[o0+STRIDE])*cols,(VBD[o0+1]-VBD[o0+STRIDE+1])*rows),.5);}
  if(vN-first>=4)draws.push({first,count:vN-first,a,rays});
}
let vN=0,dtAcc=0,profT=-1,P=profile(0);
function drawMap(){
  vN=0;draws.length=0;
  for(const a of arcs){if(a.flux<.002)continue;sheet(a,a.sig,1,1);if(a.veil>0)sheet(a,a.veilSig,a.veil,0);}
  gl.bindBuffer(gl.ARRAY_BUFFER,ribVb);gl.bufferSubData(gl.ARRAY_BUFFER,0,VBD,0,vN*STRIDE);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbS);gl.viewport(0,0,COLS,ROWS);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(RIB.p);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.bindVertexArray(ribVao);
  for(const d of draws){const y=d.a.ray;gl.uniform4f(RIB.u.uRay,y.f,d.rays?y.amp*sim.rays:0,y.p,d.a.id*17.3);gl.uniform3f(RIB.u.uDrift,y.d1,y.d2,0);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,d.first,d.count,3);}
  gl.disable(gl.BLEND);
  // Each light eases toward what the sheets are doing. Hard electrons light the prompt nitrogen, so that keeps the least memory.
  const k=tau=>1-Math.exp(-dtAcc/tau);dtAcc=Math.min(dtAcc,3);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbF[1-mapI]);gl.useProgram(MERGE.p);bind(MERGE,'uS',0,mapS);bind(MERGE,'uPrev',1,mapF[mapI]);
  gl.uniform4f(MERGE.u.uK,k(.06),k(.2),k(.36),k(34));gl.uniform2f(MERGE.u.uPx,1/COLS,1/ROWS);gl.uniform1f(MERGE.u.uT,sim.t%1000);tri();mapI=1-mapI;dtAcc=0;
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbD);gl.viewport(0,0,COLS,ROWS/DOWN);gl.useProgram(DWN.p);bind(DWN,'uM',0,mapF[mapI]);gl.uniform1f(DWN.u.uPy,1/ROWS);tri();
}
// The boat's picture, repainted when a new one sets off, and where it is this frame: it rides the river's line, and bobs.
const boatT=tex(1,1,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,gl.LINEAR,0,0,new Uint8Array(4));let boatId=0,lampP=null,lampC=[0,0,0];
function boatNow(S,C,t){
  const b=sim.boat;bind(S,'uBoatT',9,boatT);lampP=null;lampC=[0,0,0];
  if(!b){gl.uniform4f(S.u.uBoat,0,0,0,1);gl.uniform3f(S.u.uLamp,0,0,99);gl.uniform3f(S.u.uLampC,0,0,0);return;}
  if(b.id!==boatId){boatId=b.id;gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,paintBoat(b));gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);}
  const y=riverY(b.x)+b.lane,z=RIVER.level+.035*Math.sin(t*.8+b.ph)+.02*Math.sin(t*1.7+b.ph*2),roll=.012*Math.sin(t*.55+b.ph),f=Math.max(y*C.f[1]+RIVER.level*C.f[2],8),px=b.span/f/C.tanH*W/2;
  gl.uniform4f(S.u.uBoat,b.x,y,b.span,b.span*.3125);gl.uniform3f(S.u.uBoatS,z,roll,Math.max(0,Math.log2(1024/px)-.4));
  lampP=[b.x+b.lampX*b.face,y,z+b.lampZ];const k=b.lamp?.9+.1*NC.fbm(t*2.4+b.ph):0;lampC=b.lampC.map(v=>v*k);
  gl.uniform3fv(S.u.uLamp,lampP);gl.uniform3fv(S.u.uLampC,lampC);}
function dirOf(az,el){const c=Math.cos(el);return[Math.sin(az)*c,Math.cos(az)*c,Math.sin(el)];}
function toNdc(d){const C=CAMERA,z=d[0]*C.f[0]+d[1]*C.f[1]+d[2]*C.f[2];if(z<=.02)return null;return[(d[0]*C.r[0]+d[1]*C.r[1]+d[2]*C.r[2])/z/C.tanH,(d[0]*C.u[0]+d[1]*C.u[1]+d[2]*C.u[2])/z/C.tanV];}
let sprN=0;
function spr(n,size,c,i){if(sprN>=SPRN||!n)return;const o=sprN*6;sprD[o]=n[0];sprD[o+1]=n[1];sprD[o+2]=size;sprD[o+3]=c[0]*i;sprD[o+4]=c[1]*i;sprD[o+5]=c[2]*i;sprN++;}
function buildSprites(){
  sprN=0;const px=Math.max(2.4,H/420),t=sim.t;
  for(const b of beacons){if(b.el<crest(b.az)+.006)continue;const on=Math.pow(.5+.5*Math.cos((t/b.per+b.ph)*TAU),5);if(on>.01)spr(toNdc(dirOf(b.az,b.el)),px*1.4,[1,.06,.05],on*1.1);}
  if(lampP&&lampC[0]>0){const L=Math.hypot(...lampP),n=toNdc(lampP.map(v=>v/L));spr(n,px*5,lampC,.24);spr(n,px*1.3,lampC,1.5);}
  for(const l of lights){const x=(t-l.t0)/l.life;
    if(l.kind==='meteor'){const n=70,head=Math.min(1,x*1.5),br=l.b*Math.sin(Math.min(1,x)*Math.PI);for(let i=0;i<n;i++){const k=i/n,f=head*(1-.6*k);spr(toNdc(dirOf(l.az+l.dx*f,l.el+l.dy*f)),px*(1.5-k),l.c,br*(1-k)*(1-k)*.9);}}
    else if(l.kind==='sat')spr(toNdc(dirOf(l.az,l.el)),px*.9,[.9,.92,1],l.b*(1-Math.pow(x,6)));
    else if(l.kind==='plane'){const n=toNdc(dirOf(l.az,l.el));const s=(t*.14+l.ph)%1,f=(a,w)=>Math.max(0,1-Math.abs(s-a)/w);spr(n,px*.9,[1,.92,.8],.3);spr(n,px*1.5,[1,1,1],1.4*f(.1,.1));spr(n,px*1.1,[1,.1,.08],.8*f(.6,.1));}
    else if(l.kind==='car'){const a=Math.sin(Math.min(1,x)*Math.PI);spr(toNdc(dirOf(l.az,l.el)),px*.8,l.c,a*.7);spr(toNdc(dirOf(l.az-Math.sign(l.v)*.0016,l.el)),px*.6,[1,.1,.08],a*.35);}}
}
function bloomChain(){
  gl.useProgram(BD.p);let src=hdr,sw=W,sh=H;
  for(const b of bl){gl.bindFramebuffer(gl.FRAMEBUFFER,b.f);gl.viewport(0,0,b.w,b.h);bind(BD,'uT',0,src);gl.uniform2f(BD.u.uPx,1/sw,1/sh);tri();src=b.t;sw=b.w;sh=b.h;}
  // The first level is the frame at half size, properly filtered, which is what the river mirrors next time.
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,bl[0].f);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,fbR);gl.blitFramebuffer(0,0,bl[0].w,bl[0].h,0,0,bl[0].w,bl[0].h,gl.COLOR_BUFFER_BIT,gl.NEAREST);
  gl.useProgram(BU.p);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
  for(let i=bl.length-1;i>0;i--){const s=bl[i],d=bl[i-1];gl.bindFramebuffer(gl.FRAMEBUFFER,d.f);gl.viewport(0,0,d.w,d.h);bind(BU,'uT',0,s.t);gl.uniform2f(BU.u.uPx,1/s.w,1/s.h);gl.uniform1f(BU.u.uW,.62);tri();}
  gl.disable(gl.BLEND);}
// With ?debug, AU.profile() waits for the GPU after each stage, to show where a frame's time goes.
let lap=null;const mark=DEBUG?n=>{if(!lap)return;if(gl.getParameter(gl.FRAMEBUFFER_BINDING))gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,new Float32Array(4));else gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));const t=performance.now();lap[n]=(lap[n]||0)+t-lap.t;lap.t=performance.now();}:()=>{};
function draw(){
  const C=CAMERA,t=sim.t;
  mark('start');drawMap();mark('map');
  const flame=sim.flame;if(flame>0||profT!==0){P=profile(flame);profT=flame>0?1:0;}
  gl.useProgram(MARCH.p);gl.bindFramebuffer(gl.FRAMEBUFFER,fbA);gl.viewport(0,0,AW,AH);cam(MARCH,C);bind(MARCH,'uMap',0,mapF[mapI]);bind(MARCH,'uMap2',1,mapD);gl.uniform2fv(MARCH.u.uB,NIGHT.B);gl.uniformMatrix4x3fv(MARCH.u.uP,false,P);tri();mark('march');
  // The moon rides with the stars. Its light on the land changes only with how high it is.
  const M=skyMatrix(sim.lst),Mi=[M[0],M[3],M[6],M[1],M[4],M[7],M[2],M[5],M[8]];
  const mc=moonE,md=[M[0]*mc[0]+M[3]*mc[1]+M[6]*mc[2],M[1]*mc[0]+M[4]*mc[1]+M[7]*mc[2],M[2]*mc[0]+M[5]*mc[1]+M[8]*mc[2]];
  const up=clamp(md[2]*6+.2,0,1),mb=NIGHT.moon*NIGHT.moon*(.35+.65*NIGHT.moon)*up,moonCol=[.74*mb,.8*mb,.94*mb];
  const city=NIGHT.neonA.map((v,i)=>Math.pow(v/255,2.2)*.1+Math.pow(NIGHT.neonB[i]/255,2.2)*.05+[.05,.024,.012][i]);
  gl.useProgram(CLOUD.p);gl.bindFramebuffer(gl.FRAMEBUFFER,fbC);gl.viewport(0,0,Math.ceil(W/4),Math.ceil(H/4));cam(CLOUD,C);
  const lightNow=skyGlow();gl.uniform1f(CLOUD.u.uCov,A.cloud());gl.uniform1f(CLOUD.u.uT,t);gl.uniform2f(CLOUD.u.uWind,t*.0035*windX,t*.0015);gl.uniform3fv(CLOUD.u.uLight,lightNow);gl.uniform3fv(CLOUD.u.uCity,city);gl.uniform3fv(CLOUD.u.uMoonDir,md);gl.uniform3fv(CLOUD.u.uMoonCol,moonCol);gl.uniform1f(CLOUD.u.uSeed,NIGHT.mwSeed);tri();mark('cloud');
  const S=SCENE;gl.useProgram(S.p);gl.bindFramebuffer(gl.FRAMEBUFFER,fbH);gl.viewport(0,0,W,H);cam(S,C);
  bind(S,'uG0',0,G[0]);bind(S,'uG1',1,G[1]);bind(S,'uG2',2,G[2]);bind(S,'uA',3,aur);bind(S,'uC',4,clo);bind(S,'uMW',5,mwTex);bind(S,'uB3',6,bl[4].t);bind(S,'uB6',7,bl[bl.length-1].t);bind(S,'uRef',8,ref);
  // The wind comes and goes, and when it drops the river runs smooth as glass.
  {const w=A.sstep(.38,.72,NC.fbm(t*.02+NIGHT.gapO+31));gl.uniform1f(S.u.uRip,.03+.17*w*w);gl.uniform1f(S.u.uLevel,RIVER.level);gl.uniform1f(S.u.uPx,2*C.tanV/H);gl.uniform1f(S.u.uFlow,RIVER.flow);gl.uniform1f(S.u.uFlowD,RIVER.flow*(t/A.TIME)%65536);}
  boatNow(S,C,t);
  gl.uniformMatrix3fv(S.u.uSkyI,false,Mi);gl.uniform3fv(S.u.uMoonDir,md);gl.uniform3fv(S.u.uMoonCol,moonCol);gl.uniform3fv(S.u.uCity,city);gl.uniform3f(S.u.uAmb,.0105,.0135,.0205);gl.uniform1f(S.u.uCityAz,NIGHT.cityAz);gl.uniform1f(S.u.uCityW,NIGHT.cityW);{const n=toNdc(md);gl.uniform3f(S.u.uMoonP,n?n[0]:0,n?n[1]:0,n&&md[2]>-.02?.0084:0);}gl.uniform1f(S.u.uMoon,NIGHT.moon);
  gl.uniform1f(S.u.uMW1,.1*(1-.82*Math.min(1,NIGHT.moon*up*1.5)));gl.uniform1f(S.u.uT,t%65536);gl.uniform1f(S.u.uSeed,NIGHT.mwSeed);tri();mark('scene');
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
  gl.useProgram(STAR.p);cam(STAR,C);gl.uniformMatrix3fv(STAR.u.uSky,false,M);gl.uniform1f(STAR.u.uT,t%4096);gl.uniform1f(STAR.u.uPsf,.62*Math.pow(H/1080,.8)+.12);gl.uniform1f(STAR.u.uStarK,Math.pow(H/1080,1.2));bind(STAR,'uC',0,clo);bind(STAR,'uG0',1,G[0]);
  gl.bindVertexArray(stars.vao);gl.drawArrays(gl.POINTS,0,stars.n);
  buildSprites();if(sprN){gl.useProgram(SPR.p);gl.bindVertexArray(sprVao);gl.bindBuffer(gl.ARRAY_BUFFER,sprVb);gl.bufferSubData(gl.ARRAY_BUFFER,0,sprD,0,sprN*6);gl.drawArrays(gl.POINTS,0,sprN);}
  gl.disable(gl.BLEND);mark('stars');
  bloomChain();mark('bloom');
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,W,H);gl.useProgram(FINAL.p);bind(FINAL,'uH',0,hdr);bind(FINAL,'uB',1,bl[0].t);gl.uniform1f(FINAL.u.uT,t%512);gl.uniform1f(FINAL.u.uFade,fade*fade*(3-2*fade));tri();mark('final');
}
const windX=stream('wind')()<.5?-1:1;
// A cheap reading of how much light the aurora is putting out, for what the clouds catch.
function skyGlow(){const a=sim.act;return[.012*a*a,.05*a*a,.024*a*a];}
const moonE=(()=>{const M=skyMatrix(NIGHT.lst),d=dirOf(NIGHT.moonAz,NIGHT.moonEl);return[M[0]*d[0]+M[1]*d[1]+M[2]*d[2],M[3]*d[0]+M[4]*d[1]+M[5]*d[2],M[6]*d[0]+M[7]*d[1]+M[8]*d[2]];})();

/* ---------- start ---------- */
const tick=f=>document.hidden?setTimeout(f,16):requestAnimationFrame(f);
// The night opens slowly once it's ready, the way eyes adjust.
let fade=RM||DEBUG?1:0;
function step(dt){update(dt);dtAcc+=dt*A.TIME;fade=Math.min(1,fade+dt/2.2);}
function start(){
  if(DEBUG)window.AU={gl:true,sim,arcs,NIGHT,stats,fire,pause(){NC.paused=true;},resume(){NC.paused=false;},draw,step(s=1/60){for(let d=s;d>1e-9;d-=.05)step(Math.min(d,.05));},
    run(sec){for(let i=0,n=sec*20;i<n;i++)step(.05);dtAcc=4;draw();NC.refresh();},
    state(){return{boat:sim.boat?{x:+sim.boat.x.toFixed(1),lamp:sim.boat.lamp,cabin:sim.boat.cabin}:null,t:sim.t,phase:sim.phase,act:sim.act,arcs:arcs.length,nodes:arcs.reduce((s,a)=>s+a.n,0),vortices:A.vortices.length,verts:vN,size:[W,H],aurora:[AW,AH],aq,dyn,stars:stars.n};},
    set aq(v){aq=v;sizeAurora();},
    // The share of the sky in view that the aurora lights above this level.
    cover(th=.02){const f=new Float32Array(AW*AH*4),C=CAMERA;gl.bindFramebuffer(gl.FRAMEBUFFER,fbA);gl.readPixels(0,0,AW,AH,gl.RGBA,gl.FLOAT,f);let n=0,c=0;
      for(let y=0;y<AH;y+=8)for(let x=0;x<AW;x+=8){const a=(x/AW*2-1)*C.tanH,b=(y/AH*2-1)*C.tanV;if(C.f[2]+b*C.u[2]<.06*Math.hypot(1,a,b))continue;n++;const o=(y*AW+x)*4;if(.2*f[o]+.7*f[o+1]+.1*f[o+2]>th)c++;}return c/n;},
    clouds:A.setCloud,
    profile(n=30){lap={t:performance.now()};for(let i=0;i<n;i++){const a=performance.now();step(1/60);lap.sim=(lap.sim||0)+performance.now()-a;lap.t=performance.now();draw();}const r={};for(const k in lap)if(k!=='t')r[k]=+(lap[k]/n).toFixed(2);lap=null;return r;},
    renderer(){const e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);},
    map(ch=1,g=1){const b=new Uint8ClampedArray(COLS*ROWS*4),f=new Float32Array(COLS*ROWS*4);gl.bindFramebuffer(gl.FRAMEBUFFER,fbF[mapI]);gl.readPixels(0,0,COLS,ROWS,gl.RGBA,gl.FLOAT,f);for(let i=0;i<COLS*ROWS;i++){const v=Math.pow(f[i*4+ch]*g,.5)*255;b[i*4]=b[i*4+1]=b[i*4+2]=v;b[i*4+3]=255;}const c=document.createElement('canvas');c.width=COLS;c.height=ROWS;c.getContext('2d').putImageData(new ImageData(b,COLS,ROWS),0,0);return c.toDataURL('image/jpeg',.9);}};
  // A first few passes fill the map's memory, so the first frame isn't an empty sky.
  dtAcc=3;drawMap();dtAcc=3;drawMap();draw();
  NC.run({step:.05,update:step,draw:()=>{watchPace();draw();},ui:()=>NC.stats(stats)});
  let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{build();bakeLand();draw();draw();},200);});}
// Baking happens a band at a time, so the page stays responsive. Nothing is shown until the whole night is ready.
const jobs=[];for(let i=0,n=LOWQ?4:16;i<n;i++)jobs.push(()=>bakeMW(Math.floor(MWH*i/n),Math.floor(MWH*(i+1)/n)));
jobs.push(strips,build,grass);for(let i=0;i<6;i++)jobs.push(()=>{if(i===0){gl.bindFramebuffer(gl.FRAMEBUFFER,fbG);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}const top=landTop();bakeLandBand(Math.floor(top*i/6),Math.floor(top*(i+1)/6));});
function work(){if(RM){while(jobs.length)jobs.shift()();start();return;}
  const j=jobs.shift();if(j)j();if(jobs.length)tick(work);else start();}
work();
})();
