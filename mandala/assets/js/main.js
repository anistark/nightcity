/* Mandala. A sand mandala made grain by grain on a board in a lamplit hall at night, seen from straight above.
   Chalk lines mark it out, then coloured sand goes down from the centre outward, every section outlined first and then filled.
   When it is finished it rests for 42 seconds. Then it is cut, swept into a heap and poured into a bowl of water, and a new one begins.
   Every choice comes from the shared seeded generator in ../assets/js/nightcity.js, so no two mandalas are the same. */
(()=>{
'use strict';
const N=window.NightCity;
const{R,rr,ri,pick,chance,expo,noise}=N;
const QS=new URLSearchParams(location.search);
const TAU=Math.PI*2,SQ2=Math.SQRT2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const fract=x=>x-Math.floor(x);
const mod=(a,m)=>((a%m)+m)%m;
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
const HOLD=42;

/* ---------- canvases ---------- */
// Two layers, each pixel one grain, scaled up with crisp edges. The board and the sand live on #scene, and only the grains
// that change are written to it. Everything that moves every frame goes on the layer above, so the sand is never copied.
const cvA=document.getElementById('scene'),ctxA=cvA.getContext('2d');
const cvB=document.createElement('canvas');cvB.className='fx';cvB.setAttribute('aria-hidden','true');cvA.after(cvB);
const ctxB=cvB.getContext('2d');

/* ---------- randomness ---------- */
const SALT=Math.floor(R()*4294967296);
// Per-grain detail comes from a seeded hash of its place, so a resize repaints the same world without drawing new numbers.
function hash(i,k){let h=Math.imul((i|0)^SALT,2654435761)^Math.imul((k|0)+374761393,2246822519);h=Math.imul(h^(h>>>15),2246822519);h=Math.imul(h^(h>>>13),3266489917);h^=h>>>16;return(h>>>0)/4294967296;}
function stream(s){s>>>=0;const r=N.sfc32(s,(s^0x9e3779b9)>>>0,Math.imul(s,2654435761)>>>0,(s+0x6d2b79f5)>>>0);for(let i=0;i<12;i++)r();return r;}
const seedOf=()=>Math.floor(R()*4294967296);
// Sparkle, falling grains, smoke and the water only ever draw from this, never from the world's generator.
const fx=stream(seedOf());

/* ---------- sand colours ---------- */
const PAL=[[0,0,0],
  [238,232,216],[248,202,56],[238,130,44],[208,48,42],[130,32,48],[240,146,176],
  [144,204,94],[44,144,80],[30,92,64],[116,186,230],[44,100,204],[28,44,126],
  [26,26,34],[218,172,70],[44,174,164],[116,66,146]];
const NP=PAL.length;
const WHITE=1,YELLOW=2,ORANGE=3,RED=4,MAROON=5,PINK=6,LGREEN=7,GREEN=8,DGREEN=9,LBLUE=10,BLUE=11,DBLUE=12,BLACK=13,GOLD=14,TEAL=15,PURPLE=16;
const SCHEMES={
  classic:{bg:[DBLUE,RED,GREEN,BLUE,BLACK,MAROON],fg:[WHITE,YELLOW,GOLD,PINK,LBLUE,LGREEN,ORANGE],name:'in the old colours'},
  warm:{bg:[RED,MAROON,ORANGE,BLACK,DBLUE],fg:[YELLOW,GOLD,WHITE,PINK,ORANGE,LGREEN],name:'in reds and golds'},
  cool:{bg:[DBLUE,BLUE,DGREEN,TEAL,BLACK],fg:[WHITE,LBLUE,GOLD,LGREEN,YELLOW,PINK],name:'in blues and greens'},
  jewel:{bg:[MAROON,DBLUE,DGREEN,BLACK,PURPLE],fg:[GOLD,YELLOW,WHITE,PINK,LBLUE,LGREEN],name:'in deep jewel colours'},
};
const RING_TYPES=['beads','teeth','waves','scallops','jewels','chain','dots','checker','stripes'];
// The length of one repeat of each motif, in widths of its band.
const PERIOD={beads:[.45,.55],teeth:[.5,.8],waves:[1,1.6],scallops:[.55,.85],jewels:[.6,.9],chain:[.42,.5],dots:[.5,.8],checker:[.5,.8],vajra:[1.6,2.2],petals:[.32,.46]};

/* ---------- the design of one mandala ---------- */
// A design is a function from a point to a colour and the part of the mandala it belongs to, in units of the mandala's radius,
// plus the chalk lines that mark it out and the parts in the order they are made, from the centre outward.
function makeDesign(seed){
  const g=stream(seed);
  const f=(a,b)=>a+(b-a)*g(),p=a=>a[Math.floor(g()*a.length)],c=q=>g()<q,fi=(a,b)=>Math.floor(f(a,b+1));
  const wp=l=>{let s=0;for(const it of l)s+=it[1];let r=g()*s;for(const it of l){r-=it[1];if(r<=0)return it[0];}return l[0][0];};
  const not=(l,av)=>{const m=l.filter(x=>!av.includes(x));return p(m.length?m:l);};
  const schemeKey=wp([['classic',4],['warm',2],['cool',2],['jewel',2]]),S=SCHEMES[schemeKey];
  // The four directions keep their traditional colours: east at the bottom, then south, west and north going round.
  const dir=[p([WHITE,WHITE,BLUE]),YELLOW,RED,GREEN];
  const nFor=(rm,w,P)=>Math.max(8,Math.round(Math.PI*rm/(w*P)/8)*8);
  const per=t=>f(PERIOD[t][0],PERIOD[t][1]);
  function band(type,r0,r1,prev){
    const w=r1-r0,rm=(r0+r1)/2,b={type,r0,r1,w,align:c(.5)?1:0};
    const bg=not(S.bg,[prev]),c1=not(S.fg,[bg]),c2=not(S.fg,[bg,c1]),c3=not([WHITE,GOLD,YELLOW,BLACK],[c1,bg]);
    Object.assign(b,{bg,c1,c2,c3,alt:c(.5),out:c(.5)});
    if(PERIOD[type])b.n=nFor(rm,w,per(type));
    if(type==='plain')b.cols=[bg];
    if(type==='stripes'){const k=fi(2,4),cs=[];let last=prev;for(let i=0;i<k;i++){const x=not(i%2?S.fg:S.bg,[last]);cs.push(x);last=x;}b.cols=cs;}
    return b;
  }
  function petals(r0,r1,prev,n){
    const w=r1-r0,rm=(r0+r1)/2,PC=[PINK,RED,WHITE,YELLOW,LBLUE,ORANGE];
    const bg=not([BLACK,DBLUE,MAROON,BLUE,DGREEN],[prev]),pc=not(PC,[bg]),pc2=not(PC,[bg,pc]);
    return{type:'petals',r0,r1,w,align:1,n:n||nFor(rm,w,per('petals')),bg,pc,pc2,cc:not([WHITE,PINK,YELLOW],[pc]),oc:not([WHITE,GOLD,BLACK],[pc,bg]),pc3:not([GOLD,LGREEN,RED,LBLUE],[pc,bg]),alt:c(.4),dbl:c(.55),olX:.006/w};
  }
  const edgeOf=b=>b.bg||b.cols[0];
  function mkCentre(r,prev){
    const type=wp([['bindu',2],['wheel',3],['swirl',2],['vajra',2],['star',2]]);
    const c1=p([GOLD,WHITE,YELLOW]),c2=not([DBLUE,RED,BLUE,MAROON,GREEN],[prev]),c3=not([RED,BLUE,WHITE,YELLOW],[c1,c2]),c4=not([ORANGE,LBLUE,PINK,LGREEN],[c1,c2]);
    const cols=type==='swirl'?p([[RED,BLUE,YELLOW],[YELLOW,GREEN,RED],[WHITE,RED,BLUE]]):[c3,c1,c2,c1];
    return{type,r,c1,c2,c3,c4,cols};
  }

  // The outer rings, from the rim inward: fire, then vajras, then lotus petals, then a band or two, with fine lines between.
  const outer=[];let r=1,prev=0;
  const add=b=>{outer.push(b);r=b.r0;prev=edgeOf(b);return b;};
  const thin=()=>add({type:'plain',r0:r-f(.0055,.008),r1:r,cols:[not([BLACK,WHITE,GOLD],[prev])],thin:1});
  const fireCols=wp([[[BLUE,GREEN,YELLOW,ORANGE,RED],4],[[RED,ORANGE,YELLOW,GREEN,BLUE,WHITE],2],[[DBLUE,BLUE,LBLUE,WHITE,YELLOW,ORANGE,RED],1],[[MAROON,RED,ORANGE,YELLOW],2]]);
  {const w=f(.045,.062);add({type:'fire',r0:r-w,r1:r,w,cols:fireCols,n:p([20,24,28,32]),dir:c(.5)?1:-1,tw:f(.55,1.15),lc:p([BLACK,MAROON,DBLUE]),name:'The ring of fire closes the mandala'});prev=-1;}
  thin();
  if(c(.78)){const w=f(.026,.038),b=band('vajra',r-w,r,prev);b.bg=not([DBLUE,BLACK,BLUE,DGREEN,MAROON],[prev]);b.c1=p([GOLD,YELLOW]);b.c2=not([GOLD,YELLOW,WHITE],[b.c1]);b.c3=not([RED,BLUE,WHITE,GREEN],[b.bg]);b.name='The ring of vajras is finished';add(b);thin();}
  if(c(.9)){const w=f(.04,.058),b=petals(r-w,r,prev);b.name='The ring of lotus petals is finished';add(b);thin();}
  for(let k=fi(0,2);k>0;k--){const w=f(.022,.036);add(band(p(RING_TYPES),r-w,r,prev));thin();}
  const rc=r;

  const palace=c(.82);
  const levels=[],inner=[],orns=[];
  let centre=null,rIn=0,star=null,groundQ=false,groundC=0,groundCs=null,orn=null;
  let r2=rc,prv=prev;
  const pushIn=b=>{inner.push(b);r2=b.r0;prv=edgeOf(b);return b;};
  const thinIn=w=>pushIn({type:'plain',r0:r2-w,r1:r2,cols:[not([WHITE,GOLD,BLACK],[prv])],thin:1});
  if(palace){
    // One to three palaces nested inside each other, each a square with a gate in every side.
    const nLv=wp([[1,5],[2,4],[3,2]]);
    let a=(rc-f(.025,.04))/SQ2;
    for(let L=0;L<nLv;L++){
      const k=Math.max(.55,a/.5);
      const ww=f(.034,.05)*k,ns=L?fi(3,4):fi(3,5),fw=f(.022,.034)*k;
      const stripes=[];let last=-1;
      for(let i=0;i<ns;i++){const x=not([WHITE,YELLOW,RED,GREEN,BLUE,DBLUE,BLACK,GOLD],[last]);stripes.push(x);last=x;}
      const gw=Math.max(ww+fw+f(.018,.03)*k,a*f(.17,.23)),gd=a*f(.1,.14),jd=gd*f(.35,.55),js=a*f(.025,.045);
      let td=a*f(.08,.11),rd=a*f(.03,.045);
      const room=(L?levels[L-1].a-levels[L-1].ww-levels[L-1].fw:rc)-.012-(a+gd);
      if(td+2.3*rd>room){const s=Math.max(0,room)/(td+2.3*rd);td*=s;rd*=s;}
      const tc=[];last=-1;for(let i=fi(3,4);i>0;i--){const x=not([RED,YELLOW,GREEN,BLUE,WHITE,GOLD],[last]);tc.push(x);last=x;}
      const fc=not([RED,MAROON,DBLUE,RED],[stripes[ns-1]]);
      levels.push({a,ww,fw,ns,stripes,gw,gd,jd,js,td,rd,tc,dc:GOLD,dc2:p([RED,BLUE,BLACK]),fc,fc2:not([WHITE,GOLD,YELLOW],[fc]),gp:a*f(.07,.1),
        dlc:c(.65)?p([WHITE,BLACK,GOLD]):0,dlw:.0045,seats:c(.45),sc:p([WHITE,GOLD,LBLUE]),sc2:p([RED,BLUE,GREEN]),sr:0,sd:0});
      a*=f(.5,.6);
    }
    const Li=levels[nLv-1];
    rIn=(Li.a-Li.ww-Li.fw)*f(.74,.86);
    for(let L=0;L<nLv;L++){const Lv=levels[L],lo=L===nLv-1?rIn/SQ2+.004:levels[L+1].a+.004,hi=Lv.a-Lv.ww-Lv.fw-.004;Lv.sr=Lv.seats&&hi-lo>.03?(hi-lo)*.32:0;Lv.sd=(lo+hi)/2;}
    // Inside the innermost palace: a band or two, then the lotus of eight petals and the centre.
    r2=rIn;prv=Li.fc;
    thinIn(Math.max(.0055,rIn*.03));
    if(c(.65)){const w=rIn*f(.1,.15);pushIn(band(p(['beads','vajra','teeth','dots','plain']),r2-w,r2,prv));thinIn(Math.max(.0055,rIn*.03));}
    const rCen=Math.min(r2*.45,rIn*f(.28,.38));
    const lot=petals(rCen,r2,prv,8);lot.dirC=1;lot.pd=p([GOLD,WHITE,PINK]);lot.name='The lotus at the centre is finished';pushIn(lot);
    centre=mkCentre(rCen,lot.bg);
    groundQ=c(.5);groundC=not(S.bg,[prev]);groundCs=c(.5)?dir.slice():[LBLUE,YELLOW,PINK,LGREEN];
    // Ornaments on the ground either side of each gate, the same on all four sides.
    const L0=levels[0],xo=L0.gw*1.35+(L0.a-L0.gw*1.35)*.55,y0=L0.a+.008,y1=Math.sqrt(Math.max(0,rc*rc-xo*xo))-.008,yo=(y0+y1)/2;
    const orr=Math.min((y1-y0)/2,(L0.a-L0.gw*1.35)*.4)*.85;
    if(orr>.018){
      orn={type:wp([['jewels',3],['moon',2],['swirl',2],['cloud',2]]),cs:[not(S.fg,[groundC]),not(S.fg,[groundC]),not([WHITE,GOLD,RED,BLUE],[groundC])]};
      for(let s=0;s<4;s++){const ph=Math.PI/2+s*Math.PI/2,ox=Math.cos(ph),oy=Math.sin(ph);for(const m of[-1,1]){const tx=-oy*m*xo,ty=ox*m*xo;orns.push({x:ox*yo+tx,y:oy*yo+ty,r:orr,ox,oy,m});}}
    }
  }else{
    // No palace: rings all the way in, around an eight pointed star.
    for(let k=fi(3,5);k>0;k--){const w=f(.04,.07);pushIn(c(.3)?petals(r2-w,r2,prv):band(p(RING_TYPES),r2-w,r2,prv));thinIn(f(.0055,.008));}
    const ro=r2,ri0=ro*f(.48,.6);
    // A second star turned between the points of the first, with a jewel beyond each of its tips.
    const sbg=not(S.bg,[prv]);
    star={ro,ri:ri0,bg:sbg,c1:p([GOLD,WHITE,YELLOW]),c2:p([RED,BLUE,GREEN,ORANGE]),c3:not(S.bg,[sbg]),c4:not(S.fg,[sbg]),oc:p([BLACK,WHITE,GOLD])};
    r2=ri0*.92;prv=star.bg;
    const rCen=r2*f(.32,.42);
    const lot=petals(rCen,r2,prv,8);lot.dirC=1;lot.pd=p([GOLD,WHITE,PINK]);lot.name='The lotus at the centre is finished';pushIn(lot);
    centre=mkCentre(rCen,lot.bg);
    rIn=ro;
  }

  // The parts, numbered in the order they are made: the centre first, then outward to the ring of fire.
  const els=[];
  const mk=(kind,rOut,name)=>{const e={id:els.length+1,kind,rOut,name:name||null,nSec:rOut<.13?1:rOut<.32?4:8};els.push(e);return e;};
  centre.el=mk('centre',centre.r,'The centre is laid');
  const innerSorted=inner.slice().sort((x,y)=>x.r0-y.r0);
  let groundEl=null;
  if(palace){
    for(const b of innerSorted)b.el=mk('ring',b.r1,b.name);
    for(let L=levels.length-1;L>=0;L--){
      const Lv=levels[L],court=levels.length===1?'':L===levels.length-1?'inner court':'middle court';
      Lv.floorEl=mk('floor',Lv.a*SQ2);Lv.friezeEl=mk('frieze',Lv.a*SQ2);
      Lv.wallEl=mk('walls',Math.max(Lv.a*SQ2,Lv.a+Lv.gd),L===0?'The palace walls are up':'The walls of the '+court+' are up');
    }
    groundEl=mk('ground',rc,'The palace grounds are filled');
  }else{
    for(const b of innerSorted)if(b.r1<=star.ri)b.el=mk('ring',b.r1,b.name);
    star.el=mk('star',star.ro,'The star is finished');
    for(const b of innerSorted)if(b.r1>star.ri)b.el=mk('ring',b.r1,b.name);
  }
  for(const b of outer.slice().sort((x,y)=>x.r0-y.r0))b.el=mk('ring',b.r1,b.name);

  /* ---- what colour a point is ---- */
  const cd=(e,k)=>(e.id<<5)|k;
  function motif(b,r,x,y){
    if(b.type==='plain')return b.cols[0];
    const v=(r-b.r0)/b.w;
    if(b.type==='stripes')return b.cols[Math.min(b.cols.length-1,(v*b.cols.length)|0)];
    const th=Math.atan2(y,x);
    if(b.type==='fire'){const q=fract(th*b.n/TAU*b.dir+v*b.tw+.05*Math.sin(v*7+th*b.n)),m=b.cols.length,qq=q*m,ci=Math.floor(qq);return qq-ci<.14?b.lc:b.cols[ci];}
    const s=th*b.n/TAU+(b.align?.5:0),k=Math.floor(s),u=s-k-.5,P=Math.PI*r/(b.n*b.w),X=u*2*P,ax=Math.abs(X),yy=v-.5;
    switch(b.type){
      case 'petals':{
        const W=P*.98,y1=(v-.03)/.94;
        if(y1>0&&y1<1){
          const hw=W*Math.pow(1-y1,.7)*Math.sqrt(Math.min(1,y1*5));
          if(ax<hw){
            if(ax>hw-b.olX)return b.oc;
            const y3=y1/.66;if(y3<1&&ax<W*.48*Math.pow(1-y3,.7)*Math.sqrt(Math.min(1,y3*6)))return b.cc;
            if(b.dirC){const tc=(k+.5-(b.align?.5:0))*TAU/b.n,q=Math.round(tc/(Math.PI/2));return Math.abs(tc-q*Math.PI/2)<.01?dir[mod(q+3,4)]:b.pd;}
            return b.alt&&(k&1)?b.pc2:b.pc;
          }
        }
        if(b.dbl){const u2=fract(s+.5)-.5,X2=Math.abs(u2*2*P),y2=(v-.03)/.7;if(y2>0&&y2<1){const hw=W*Math.pow(1-y2,.7)*Math.sqrt(Math.min(1,y2*5));if(X2<hw)return X2>hw-b.olX?b.oc:b.pc3;}}
        return b.bg;
      }
      case 'vajra':{if(ax*ax+yy*yy<.05)return b.c1;if(Math.abs(yy)<.07&&ax<P*.95)return b.c1;const lx=(ax-P*.55)/(P*.32),ly=yy/.34,e=lx*lx+ly*ly;if(e<1)return e<.3?b.c3:b.c2;return b.bg;}
      case 'beads':{const d=X*X+yy*yy;if(d<.13)return d<.015?b.c3:(b.alt&&(k&1)?b.c2:b.c1);return b.bg;}
      case 'teeth':return ax<P*(b.out?1-v:v)?b.c1:b.c2;
      case 'waves':return Math.abs(v-.5-.28*Math.cos(u*TAU))<.15?b.c1:b.bg;
      case 'scallops':{const z=b.out?1-v:v,d=Math.sqrt(X*X+z*z)/(P*.98);if(d<1)return d<.55?b.c2:d>.8?b.c3:b.c1;return b.bg;}
      case 'jewels':{const q=ax/(P*.85)+Math.abs(yy)/.42;if(q<1)return q<.45?b.c2:b.c1;return b.bg;}
      case 'checker':return((k+(v<.5?0:1))&1)?b.c1:b.c2;
      case 'chain':{const d1=Math.sqrt(X*X+yy*yy),d2=Math.sqrt((ax-P)*(ax-P)+yy*yy);return Math.abs(d1-.3)<.075||Math.abs(d2-.3)<.075?b.c1:b.bg;}
      case 'dots':return X*X+yy*yy<.04?b.c1:b.bg;
    }
    return b.bg||WHITE;
  }
  function centreAt(r,x,y){
    const z=centre,q=r/z.r,th=Math.atan2(y,x);
    switch(z.type){
      case 'bindu':return z.cols[Math.min(3,(q*4)|0)];
      case 'wheel':if(q>.84)return z.c1;if(q<.26)return q<.12?z.c3:z.c1;return Math.abs(Math.sin(4*th))*q<.07?z.c1:z.c2;
      case 'swirl':if(q>.88)return z.c1;return z.cols[Math.min(2,Math.floor(fract(th/TAU+q*.6)*3))];
      case 'vajra':{if(q<.2)return z.c3;const ax=Math.abs(x)/z.r,ay=Math.abs(y)/z.r,X=Math.max(ax,ay),Y=Math.min(ax,ay),lx=(X-.56)/.36,ly=Y/.2,e=lx*lx+ly*ly;if(e<1)return e<.3?z.c3:z.c1;return q>.9?z.c1:z.c2;}
      default:{const sf=fract(th*4/Math.PI),t=Math.abs(sf-.5)*2;if(q<.22)return z.c3;if(q<.4+.55*t)return sf<.5?z.c1:z.c4;return z.c2;}
    }
  }
  function starAt(r,th){
    const z=star,sf=fract(th*4/Math.PI),t=Math.abs(sf-.5)*2,rs=z.ri+(z.ro-z.ri)*t;
    if(r<rs)return r>rs-.007?z.oc:sf<.5?z.c1:z.c2;
    const sf2=fract(th*4/Math.PI+.5),t2=Math.abs(sf2-.5)*2,rs2=z.ri*.9+(z.ro*.8-z.ri*.9)*t2;
    if(r<rs2)return r>rs2-.006?z.oc:z.c3;
    const a=(Math.floor(th*4/Math.PI)+.5)*Math.PI/4,jx=Math.cos(a)*z.ro*.9,jy=Math.sin(a)*z.ro*.9,d=Math.hypot(r*Math.cos(th)-jx,r*Math.sin(th)-jy)/(z.ro*.045);
    if(d<1)return d<.45?z.c1:z.c4;
    return z.bg;
  }
  // How far a point lies inside a palace's outline, the square with its stepped gates, in the folded corner where X >= Y.
  function lvD(Lv,X,Y){
    let d=Lv.a-X;
    if(Y<Lv.gw){const e=Math.min(Lv.a+Lv.gd-X,Lv.gw-Y);if(e>d)d=e;}
    const jw=Lv.gw+Lv.js;if(Y<jw){const e=Math.min(Lv.a+Lv.jd-X,jw-Y);if(e>d)d=e;}
    return d;
  }
  function torana(Lv,X,Y,e){
    const x0=Lv.a+Lv.gd,t=X-x0;
    if(t>=0&&t<Lv.td&&Y<Lv.gw*(.72+.5*t/Lv.td))return cd(e,Lv.tc[Math.min(Lv.tc.length-1,(t/Lv.td*Lv.tc.length)|0)]);
    if(Lv.rd>.004){const dx=X-(x0+Lv.td+Lv.rd*1.15),d=Math.sqrt(dx*dx+Y*Y)/Lv.rd;if(d<1)return cd(e,d<.34||d>.78?Lv.dc2:Lv.dc);}
    return 0;
  }
  function floorAt(Lv,x,y,ax,ay){
    if(Lv.sr){const dx=ax-Lv.sd,dy=ay-Lv.sd,d=Math.sqrt(dx*dx+dy*dy)/Lv.sr;if(d<1)return cd(Lv.floorEl,d<.5?Lv.sc2:Lv.sc);}
    if(Lv.dlc&&Math.abs(ax-ay)<Lv.dlw)return cd(Lv.floorEl,Lv.dlc);
    return cd(Lv.floorEl,ay>=ax?(y>0?dir[0]:dir[2]):(x<0?dir[1]:dir[3]));
  }
  function friezeAt(Lv,X,Y,d){
    // Garlands hang from the walls along each side, away from the gates.
    const t=d-Lv.ww;
    if(X<Lv.a&&Y>Lv.gw+Lv.js+Lv.fw){
      const s=mod(Y,Lv.gp)-Lv.gp/2,e=Math.sqrt((s/(Lv.gp*.5))**2+(t/(Lv.fw*.72))**2);
      if(Math.abs(e-1)<.2)return Lv.fc2;
      if(s*s+(t-Lv.fw*.8)**2<(Lv.fw*.13)**2)return Lv.fc2;
    }
    return Lv.fc;
  }
  const CLOUD=[[-.5,.1,.45],[0,-.15,.52],[.5,.1,.45]],JEWEL=[[0,-.32],[-.36,.28],[.36,.28]];
  function ornAt(u,v){
    const d=Math.sqrt(u*u+v*v);
    switch(orn.type){
      case 'jewels':for(let k=0;k<3;k++){const du=u-JEWEL[k][0],dv=v-JEWEL[k][1];if(du*du+dv*dv<.17)return(du+.12)**2+(dv+.12)**2<.012?WHITE:orn.cs[k];}return 0;
      case 'moon':if(u*u+(v-.42)**2<.1)return orn.cs[1];if(d<1&&u*u+(v-.38)**2>.67)return orn.cs[0];return 0;
      case 'swirl':if(d<1)return d>.86?orn.cs[2]:fract(d*2.2+Math.atan2(v,u)/TAU)<.5?orn.cs[0]:orn.cs[1];return 0;
      default:{let inside=false,core=false;for(const q of CLOUD){const e=Math.sqrt((u-q[0])**2+(v-q[1])**2);if(e<q[2]){inside=true;if(e<q[2]-.14)core=true;}}return inside?(core?orn.cs[0]:orn.cs[1]):0;}
    }
  }
  function at(x,y){
    const r2=x*x+y*y;if(r2>=1)return 0;
    const r=Math.sqrt(r2);
    if(r>=rc){for(const b of outer)if(r>=b.r0&&r<b.r1)return cd(b.el,motif(b,r,x,y));return 0;}
    if(r<centre.r)return cd(centre.el,centreAt(r,x,y));
    if(!palace){
      for(const b of inner)if(r>=b.r0&&r<b.r1)return cd(b.el,motif(b,r,x,y));
      return cd(star.el,starAt(r,Math.atan2(y,x)));
    }
    const ax=Math.abs(x),ay=Math.abs(y),X=ax>ay?ax:ay,Y=ax>ay?ay:ax;
    for(let L=levels.length-1;L>=0;L--){
      const Lv=levels[L],d=lvD(Lv,X,Y);
      if(d<0)continue;
      if(d<Lv.ww)return cd(Lv.wallEl,Lv.stripes[Math.min(Lv.ns-1,(d/Lv.ww*Lv.ns)|0)]);
      if(d<Lv.ww+Lv.fw)return cd(Lv.friezeEl,friezeAt(Lv,X,Y,d));
      if(L===levels.length-1&&r<rIn){for(const b of inner)if(r>=b.r0&&r<b.r1)return cd(b.el,motif(b,r,x,y));}
      if(L<levels.length-1){const t=torana(levels[L+1],X,Y,Lv.floorEl);if(t)return t;}
      return floorAt(Lv,x,y,ax,ay);
    }
    const t=torana(levels[0],X,Y,groundEl);if(t)return t;
    if(orn)for(const o of orns){const dx=x-o.x,dy=y-o.y;if(dx*dx+dy*dy>=o.r*o.r*1.1)continue;const k=ornAt((-dx*o.oy+dy*o.ox)/o.r*o.m,(dx*o.ox+dy*o.oy)/o.r);if(k)return cd(groundEl,k);}
    return cd(groundEl,groundQ?groundCs[ay>=ax?(y>0?0:2):(x<0?1:3)]:groundC);
  }

  /* ---- the chalk lines, drawn before any sand ---- */
  const strokes=[];
  for(const k of[0,2,1,3]){const a=k*Math.PI/4,ca=Math.cos(a)*1.03,sa=Math.sin(a)*1.03;strokes.push({pts:[[-ca,-sa],[ca,sa]],sp:.55});}
  const radii=[];
  const circ=rad=>{if(rad<.02||radii.some(q=>Math.abs(q-rad)<.012))return;radii.push(rad);const m=Math.max(32,Math.round(rad*180)),a0=g()*TAU,sg=c(.5)?1:-1,pts=[];for(let i=0;i<=m;i++){const a=a0+sg*i/m*TAU;pts.push([Math.cos(a)*rad,Math.sin(a)*rad]);}strokes.push({pts,sp:.38});};
  circ(1);for(const b of outer)if(!b.thin)circ(b.r0);
  if(palace){
    for(const Lv of levels){
      const{a,gw,gd,jd}=Lv,jw=gw+Lv.js,side=[[a,-a],[a,-jw],[a+jd,-jw],[a+jd,-gw],[a+gd,-gw],[a+gd,gw],[a+jd,gw],[a+jd,jw],[a,jw]],pts=[];
      for(let s=0;s<4;s++){const ang=s*Math.PI/2,cs=Math.cos(ang),sn=Math.sin(ang);for(const[x,y]of side)pts.push([x*cs-y*sn,x*sn+y*cs]);}
      pts.push(pts[0]);strokes.push({pts,sp:.42});
    }
    circ(rIn);
  }else{
    for(const b of inner)if(!b.thin)circ(b.r1);
    const pts=[];for(let i=0;i<=16;i++){const a=i*Math.PI/8,q=i%2?star.ri:star.ro;pts.push([Math.cos(a)*q,Math.sin(a)*q]);}strokes.push({pts,sp:.42});
  }
  circ(centre.r);
  let t=1.5;
  for(const k of strokes){k.cum=[0];for(let i=1;i<k.pts.length;i++)k.cum.push(k.cum[i-1]+Math.hypot(k.pts[i][0]-k.pts[i-1][0],k.pts[i][1]-k.pts[i-1][1]));k.len=k.cum[k.cum.length-1];k.t0=t;t+=k.len/k.sp;t+=f(.9,2);}

  const units=[],ub=[0];
  for(const e of els){ub[e.id]=units.length;for(let s=0;s<e.nSec;s++)units.push({el:e.id,sec:s,ang:s*TAU/e.nSec,dur:0,p:0,state:0});}
  const desc=palace?`a palace of ${['one court','two courts','three courts'][levels.length-1]} ${S.name}`:`rings round an eight pointed star ${S.name}`;
  return{seed,at,els,units,ub,strokes,chalkT:t+.8,monks:wp([[2,5],[3,3]]),rate:f(1.8,2.3),estT:0,nz:f(0,500),desc,
    scheme:schemeKey,palace,courts:levels.length,centre:centre.type,rings:outer.filter(b=>!b.thin).map(b=>b.type),measured:false};
}

/* ---------- the place, picked once a night ---------- */
// The floor and the things around the board are chosen when the page opens. Places are in units of the mandala's radius:
// u runs out from the centre along the screen's longer side, past the edge of the board, and v runs across it, with a side
// of 1 or -1. Everything then lands on floor that is in view in any shape of window.
const BOARD=1.1,UMAX=1.66,VMAX=1.12;
const PLACE=(()=>{
  const FLOORS=[['wood',3],['marble',2],['granite',2],['cement',2],['sand',2],['terracotta',1.5],['slate',1.5],['rug',1.5],['cobbles',1],['grass',1]];
  let type=N.wpick(FLOORS);
  if(N.DEBUG&&FLOORS.some(f=>f[0]===QS.get('floor')))type=QS.get('floor');
  const F={type,outside:['sand','cobbles','grass'].includes(type),gloss:type==='marble'||type==='granite'};
  if(type==='wood'||type==='rug'){F.c=pick([[56,37,26],[92,58,34],[74,42,30],[40,30,24],[110,76,46]]);F.pw=rr(.13,.24);F.pl=rr(1.2,2.2);F.dir=chance(.5);}
  if(type==='rug'){F.ru=rr(1.48,1.62);F.field=pick([[112,26,30],[64,28,60],[24,40,92],[28,72,60]]);F.band=pick([[26,40,96],[140,30,30],[22,22,28]]);F.acc=pick([[224,204,150],[64,146,176],[224,124,60]]);}
  if(type==='marble'){const m=pick([[[226,222,214],[118,116,122]],[[32,32,36],[214,210,204]],[[212,222,210],[86,120,98]],[[230,214,196],[164,122,92]],[[200,200,208],[80,84,98]]]);F.c=m[0];F.vein=m[1];F.ts=rr(.45,.85);F.grout=chance(.5)?[64,62,60]:[204,200,192];}
  if(type==='granite'){const m=pick([[[118,116,118],[34,34,36],[222,220,216]],[[152,106,98],[52,32,32],[232,204,194]],[[38,38,42],[12,12,14],[206,172,92]],[[196,188,178],[92,88,82],[242,238,232]]]);F.c=m[0];F.dk=m[1];F.lt=m[2];F.ts=rr(.9,1.4);}
  if(type==='cement')F.c=pick([[128,128,124],[112,110,104],[142,138,130],[100,104,110]]),F.ts=rr(.8,1.4);
  if(type==='sand')F.c=pick([[198,172,130],[186,160,120],[212,192,152],[172,142,106]]),F.rd=rr(0,Math.PI),F.rw=rr(22,34);
  if(type==='terracotta')F.c=pick([[178,88,54],[164,96,64],[192,112,72],[150,70,46]]),F.ts=rr(.18,.3);
  if(type==='slate')F.c=pick([[70,76,86],[64,72,70],[86,82,80],[56,60,72]]),F.ts=rr(.28,.42);
  if(type==='cobbles')F.c=pick([[112,108,102],[122,110,94],[98,100,106]]),F.ts=rr(.09,.13);
  if(type==='grass')F.c=pick([[40,72,36],[46,66,34],[34,64,44]]);

  const items=[],flames=[],sticks=[];
  const fits=(side,u,v,ru,rv)=>u-ru>=BOARD+.05&&u+ru<=UMAX&&Math.abs(v)+rv*.6<=VMAX&&items.every(o=>o.side!==side||Math.abs(o.u-u)>=o.ru+ru+.025||Math.abs(o.v-v)>=o.rv+rv+.025);
  const add=(type,side,u,v,ru,rv,o)=>{const it=Object.assign({type,side,u,v,ru,rv,a:rr(0,TAU),seed:seedOf()},o);items.push(it);return it;};
  function put(type,ru,rv,o={},tries=120){
    for(let k=0;k<tries;k++){const side=chance(.5)?1:-1,u=rr(BOARD+.05+ru,Math.max(BOARD+.05+ru,UMAX-ru)),v=rr(-VMAX+rv*.6,VMAX-rv*.6);if(fits(side,u,v,ru,rv))return add(type,side,u,v,ru,rv,o);}
    return null;
  }
  // A pair across the board from each other, mirrored or turned half round.
  function pair(type,r,mk){
    for(let k=0;k<120;k++){const u=rr(BOARD+.05+r,UMAX-r),v=rr(-VMAX+r,VMAX-r),v2=chance(.5)?v:-v;if(fits(1,u,v,r,r)&&fits(-1,u,v2,r,r)){add(type,1,u,v,r,r,mk());add(type,-1,u,v2,r,r,mk());return true;}}
    return false;
  }
  const flame=(it,x,y,s,pw,rad)=>{const f={it,x,y,s,pw,rad,st:{ph:rr(0,100),gut:0,gutD:1}};flames.push(f);return f;};
  // The bowl of water is always there, since the sand ends up in it.
  const bowl=put('bowl',.2,.2,{r:rr(.16,.19),kind:pick(['brass','copper','clay','stone','silver'])},600)||add('bowl',1,1.42,0,.2,.2,{r:.18,kind:'brass'});
  // At least one stick of incense, often more.
  for(let k=N.wpick([[1,4],[2,2],[3,1]]);k>0;k--){
    const pot=chance(.35),n=pot?ri(2,3):ri(1,2),it=put(pot?'pot':'incense',pot?.075:.06,pot?.075:.06,{n},sticks.length?120:600);
    if(!it)continue;
    for(let j=0;j<n;j++){const a=j*TAU/n+rr(-.3,.3),d=n>1?rr(.01,pot?.03:.016):0;sticks.push({it,x:Math.cos(a)*d,y:Math.sin(a)*d});}
  }
  if(!sticks.length){const it=add('incense',-1,1.3,0,.06,.06,{n:1});sticks.push({it,x:0,y:0});}
  // Light: butter lamps in pairs, candles, rows of tea lights, or some of each.
  const lamp=()=>({});
  const addLampFlame=it=>flame(it,0,0,.011,.45,.33);
  const candles=()=>{const n=N.wpick([[1,2],[2,2],[3,2]]),cs=[];for(let j=0;j<n;j++){const r=rr(.022,.032);let x=0,y=0;if(n>1){const a=j*TAU/n+rr(-.4,.4),d=.034;x=Math.cos(a)*d;y=Math.sin(a)*d;}cs.push({x,y,r});}return{cs};};
  function teaRow(){
    const n=ri(3,6),gap=rr(.075,.095);
    for(let k=0;k<80;k++){
      const side=chance(.5)?1:-1,u=rr(BOARD+.09,UMAX-.04),len=(n-1)*gap,v0=rr(-VMAX+.04,VMAX-.04-len);
      let ok=true;for(let j=0;j<n;j++)if(!fits(side,u,v0+j*gap,.035,.035)){ok=false;break;}
      if(ok){for(let j=0;j<n;j++){const it=add('tealight',side,u,v0+j*gap,.035,.035,{});flame(it,0,0,.0065,.12,.18);}return;}
    }
  }
  const lighting=N.wpick([['lamps',4],['candles',2],['tealights',2],['mixed',2]]);
  if(lighting==='lamps'){for(let k=ri(1,3);k>0;k--)pair('lamp',.055,lamp);}
  if(lighting==='candles'){for(let k=ri(2,4);k>0;k--)put('candle',.075,.075,candles());}
  if(lighting==='tealights'){teaRow();if(chance(.6))teaRow();}
  if(lighting==='mixed'){pair('lamp',.055,lamp);put('candle',.075,.075,candles());if(chance(.5))teaRow();}
  for(const it of items){if(it.type==='lamp')addLampFlame(it);if(it.type==='candle')for(const c of it.cs)flame(it,c.x,c.y,.008,.3,.26);}
  while(flames.length<2){const it=put('lamp',.055,.055,{},300);if(!it)break;addLampFlame(it);}
  // And a few of the things that are kept near a sand mandala.
  const pool=F.outside?[['dishes',2],['funnels',2],['flowers',2],['mala',1.5],['conch',1.5],['pebbles',3],['scarf',1],['singing',1],['bell',1],['plate',1]]
    :[['dishes',3],['funnels',2.5],['singing',2],['mala',2],['flowers',2.5],['plate',1.5],['scarf',1.5],['conch',1],['bell',1.5],['pebbles',.3]];
  const took=new Set(),SANDC=[WHITE,YELLOW,ORANGE,RED,PINK,GREEN,LGREEN,LBLUE,BLUE,DBLUE,BLACK,GOLD];
  for(let k=ri(2,5);k>0;k--){
    const t=N.wpick(pool.filter(e=>!took.has(e[0])||e[0]==='flowers'||e[0]==='pebbles'));took.add(t);
    if(t==='dishes'){const n=ri(3,6),rd=rr(.032,.042),gap=rr(.008,.014),len=n*2*rd+(n-1)*gap,cols=N.shuffle(SANDC.slice()).slice(0,n);put(t,rd+.012,len/2+.012,{n,rd,gap,len,cols,clay:chance(.4),a:Math.PI/2+rr(-.08,.08)});}
    if(t==='funnels'){const n=ri(1,3);put(t,.035+n*.022,.13,{n,brass:chance(.4),j:[0,0,0].map(()=>rr(-.12,.12)),rod:chance(.6),a:Math.PI/2+rr(-.2,.2)});}
    if(t==='singing')put(t,.13,.13,{});
    if(t==='mala')put(t,.1,.1,{bead:pick([[110,66,38],[176,52,40],[52,140,140],[40,34,30],[210,180,120]]),tassel:pick([[190,40,40],[220,170,60],[150,40,120]]),p1:rr(0,TAU),p2:rr(0,TAU)});
    if(t==='flowers'||t==='plate'){
      const R0=t==='plate'?.06:.075,heads=[],petals=[];
      for(let j=ri(t==='plate'?3:2,t==='plate'?6:6);j>0;j--){const a=rr(0,TAU),d=rr(0,R0-.025);heads.push({x:Math.cos(a)*d,y:Math.sin(a)*d,r:rr(.02,.03),c:pick([[234,122,28],[244,176,30],[226,92,24]])});}
      for(let j=ri(8,26);j>0;j--){const a=rr(0,TAU),d=rr(0,R0+.02);petals.push({x:Math.cos(a)*d,y:Math.sin(a)*d,c:pick([[234,122,28],[244,176,30]])});}
      put(t,t==='plate'?.1:.09,t==='plate'?.1:.09,{heads,petals});
    }
    if(t==='scarf')put(t,.06,.19,{a:Math.PI/2+rr(-.3,.3),c:pick([[234,228,214],[240,236,226],[228,214,180]])});
    if(t==='conch')put(t,.07,.07,{});
    if(t==='bell')put(t,.1,.1,{});
    if(t==='pebbles'){const ps=[];for(let j=ri(5,12);j>0;j--){const a=rr(0,TAU),d=rr(0,.075),g=rr(.45,.85),shell=F.type==='sand'&&chance(.3);ps.push({x:Math.cos(a)*d,y:Math.sin(a)*d,rx:rr(.008,.02),ry:rr(.006,.014),a:rr(0,TAU),c:shell?[232,220,200]:[150*g+20,140*g+20,128*g+20]});}put(t,.1,.1,{ps});}
  }
  const where={wood:'wooden floorboards',marble:'a marble floor',granite:'a granite floor',cement:'a cement floor',sand:'sand under the open sky',terracotta:'terracotta tiles',slate:'slate flagstones',rug:'a woven carpet',cobbles:'cobblestones under the open sky',grass:'grass under the open sky'}[type];
  const lit={lamps:'butter lamps',candles:'candles',tealights:'tea lights',mixed:'lamps and candles'}[lighting];
  return{floor:F,items,flames,sticks,bowl,lighting,desc:`The board is set out on ${where}, lit by ${lit}, with incense burning`};
})();

/* ---------- layout ---------- */
let cw=0,ch=0,cell=1,DPR=1,Rc=100,cx=0,cy=0,nC=0,bh=0,land=true;
let lights=[],incs=[],bowl={x:0,y:0,r:1};
let col,st,ht,chalkA,dustA,dustC,gv,lt,warm,base,img,buf,dmark,dlist,dcount=0,tw=0,tmark,tlist,tcount=0;
let rb=null,rbR=null,rbT=null;
// From the place's units to grains on screen, and the angle an item is turned to.
const toG=(side,u,v)=>{const U=side*u;return land?[cx+U*Rc,cy+v*Rc]:[cx+v*Rc,cy+U*Rc];};
const angOf=it=>land?it.a:Math.PI/2-it.a;
function itemPt(it,ox,oy){const[x,y]=toG(it.side,it.u,it.v),a=angOf(it),c=Math.cos(a),s=Math.sin(a);return[x+(ox*c-oy*s)*Rc,y+(ox*s+oy*c)*Rc];}
function layout(){
  DPR=Math.min(N.LOWQ?1:3,window.devicePixelRatio||1);
  const W=Math.max(1,innerWidth),H=Math.max(1,innerHeight);
  land=W>=H;
  // The mandala is about 240 grains across its radius, whatever the screen, and each grain is a whole number of device pixels.
  const Rcss=Math.max(40,Math.min(Math.min(W,H)*.43,Math.max(W,H)*.29));
  cell=Math.max(1,Math.round(Rcss*DPR/(N.LOWQ?140:240)));
  cw=Math.ceil(W*DPR/cell);ch=Math.ceil(H*DPR/cell);nC=cw*ch;
  Rc=Rcss*DPR/cell;cx=Math.floor(cw/2);cy=Math.floor(ch/2);
  bh=Math.round(Rc*BOARD);
  const cssW=cw*cell/DPR,cssH=ch*cell/DPR,left=Math.round((W-cssW)/2*DPR)/DPR,top=Math.round((H-cssH)/2*DPR)/DPR;
  for(const c of[cvA,cvB]){c.width=cw;c.height=ch;Object.assign(c.style,{width:cssW+'px',height:cssH+'px',left:left+'px',top:top+'px'});}
  lights=PLACE.flames.map(f=>{const[x,y]=itemPt(f.it,f.x,f.y);return{x,y,s:f.s,pw:f.pw,rad:f.rad,st:f.st};});
  incs=PLACE.sticks.map(s=>{const[x,y]=itemPt(s.it,s.x,s.y);return{x,y};});
  {const b=PLACE.bowl,[x,y]=toG(b.side,b.u,b.v);bowl={x,y,r:b.r*Rc};}
  col=new Uint8Array(nC);st=new Uint8Array(nC);ht=new Float32Array(nC);chalkA=new Uint8Array(nC);dustA=new Uint8Array(nC);dustC=new Uint8Array(nC);
  gv=new Float32Array(nC);lt=new Float32Array(nC);warm=new Float32Array(nC);base=new Uint32Array(nC);
  img=ctxA.createImageData(cw,ch);buf=new Uint32Array(img.data.buffer);
  dmark=new Uint8Array(nC);dlist=new Int32Array(nC);dcount=0;
  tw=Math.ceil(cw/32);tmark=new Uint8Array(tw*Math.ceil(ch/32));tlist=new Int32Array(tmark.length);tcount=0;
  for(let i=0;i<nC;i++)gv[i]=(.9+.2*hash(i,5))*(hash(i,6)<.05?(hash(i,7)<.5?.72:1.22):1);
  // Every grain near the mandala, sorted by its distance from the centre, for the sweep.
  const max=Math.ceil(Rc*1.14)+2,cnt=new Int32Array(max+1),x0=Math.max(1,cx-max),x1=Math.min(cw-1,cx+max),y0=Math.max(1,cy-max),y1=Math.min(ch-1,cy+max);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const k=Math.floor(Math.hypot(x+.5-cx,y+.5-cy));if(k<max)cnt[k]++;}
  const off=new Int32Array(max+1);for(let k=0;k<max;k++)off[k+1]=off[k]+cnt[k];
  const cells=new Int32Array(off[max]),pos=off.slice();rbR=new Float32Array(off[max]);rbT=new Float32Array(off[max]);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const dx=x+.5-cx,dy=y+.5-cy,d=Math.hypot(dx,dy),k=Math.floor(d);if(k<max){const j=pos[k]++;cells[j]=y*cw+x;rbR[j]=d/Rc;rbT[j]=Math.atan2(dy,dx);}}
  rb={max,off,cells};
}

/* ---------- the floor ---------- */
// Smooth noise on a seeded lattice, in units of the mandala's radius, so the floor is the same at any size.
const h2=(x,y,k)=>hash(Math.imul(x|0,73856093)^Math.imul(y|0,19349663),k);
function vn2(x,y,k){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),a=h2(ix,iy,k),b=h2(ix+1,iy,k),c=h2(ix,iy+1,k),d=h2(ix+1,iy+1,k);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;}
const fbm2=(x,y,k)=>vn2(x,y,k)*.5+vn2(x*2.1+5.3,y*2.1+1.7,k+1)*.3+vn2(x*4.3+9.1,y*4.3+3.3,k+2)*.2;
// The nearest seeded point in a jittered grid: which cell a point is in and how close it is to the cell's edge.
let VID=0,VEDGE=0,VD=0;
function voronoi(x,y,s,k){
  const gx=Math.floor(x/s),gy=Math.floor(y/s);let d1=1e9,d2=1e9,id=0;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx2=gx+i,cy2=gy+j,px=(cx2+.15+.7*h2(cx2,cy2,k))*s,py=(cy2+.15+.7*h2(cx2,cy2,k+1))*s,d=Math.hypot(x-px,y-py);if(d<d1){d2=d1;d1=d;id=cx2*7919+cy2;}else if(d<d2)d2=d;}
  VID=id;VEDGE=d2-d1;VD=d1;
}
let FR=0,FG=0,FB=0;
const setC=(c,m)=>{FR=c[0]*m;FG=c[1]*m;FB=c[2]*m;};
function woodAt(F,nx,ny){
  const p=F.dir?ny:nx,q=F.dir?nx:ny,pi=Math.floor(p/F.pw),fy=(p/F.pw-pi)*F.pw*Rc,off=h2(pi,0,11)*3,pj=Math.floor((q+off)/F.pl),fq=((q+off)/F.pl-pj)*F.pl*Rc;
  const tone=.72+.5*h2(pi,pj,12),gr=1+.14*(noise(q*7+pi*17.3+pj*5.1)-.5)+.07*Math.sin(q*21+noise(q*3.5+pi*3.7)*7+pi);
  setC(F.c,tone*gr);if(fy<1||fq<1){FR*=.45;FG*=.45;FB*=.45;}
}
function floorAt(nx,ny,i){
  const F=PLACE.floor,px=1/Rc;
  switch(F.type){
    case 'wood':woodAt(F,nx,ny);break;
    case 'rug':{
      // A big woven carpet under the board, its ends showing on either side, on floorboards.
      const U=land?nx:ny,V=land?ny:nx,e=F.ru-Math.abs(U);
      if(e<0){if(e>-.03&&fract(V*120)<.5){setC(F.acc,.8);break;}woodAt(F,nx,ny);FR*=.8;FG*=.8;FB*=.8;break;}
      const wv=.94+.06*(((i%2)^((i/cw|0)%2))?1:0)+.04*(hash(i,61)-.5);
      if(e<.016)setC(F.band,.6*wv);
      else if(e<.03||(e>.09&&e<.104))setC([200,156,70],wv);
      else if(e<.09){const t=fract(V/.06)-.5,d=Math.abs(t)*2+Math.abs(e-.06)/.026;setC(d<1?F.acc:F.band,wv);}
      else{const t=Math.abs(fract(V/.18)-.5)+Math.abs(fract(U/.18)-.5);setC(F.field,(Math.abs(t-.35)<.025?1.25:1)*wv);}
      break;
    }
    case 'marble':{
      const tx=Math.floor(nx/F.ts),ty=Math.floor(ny/F.ts),gx=(nx/F.ts-tx)*F.ts*Rc,gy=(ny/F.ts-ty)*F.ts*Rc;
      if(gx<1||gy<1){setC(F.grout,1);break;}
      const th=h2(tx,ty,21)*Math.PI,w=nx*Math.cos(th)+ny*Math.sin(th),turb=fbm2(nx*3,ny*3,22);
      // Veins wander across each tile and fade in and out along their length.
      const val=Math.abs(Math.sin((w*2.2+turb*4.5+h2(tx,ty,23)*6)*Math.PI)),fade=smooth((fbm2(nx*2.3+7,ny*2.3,25)-.38)*4);
      const k=Math.pow(1-Math.min(1,val/.07),2)*.75*fade+Math.pow(1-Math.min(1,val/.3),2)*.12;
      const m=.92+.12*fbm2(nx*1.5+tx,ny*1.5,24)+.06*(h2(tx,ty,26)-.5);
      FR=(F.c[0]+(F.vein[0]-F.c[0])*k)*m;FG=(F.c[1]+(F.vein[1]-F.c[1])*k)*m;FB=(F.c[2]+(F.vein[2]-F.c[2])*k)*m;
      break;
    }
    case 'granite':{
      const gx=fract(nx/F.ts)*F.ts*Rc,gy=fract(ny/F.ts)*F.ts*Rc,m=.86+.24*fbm2(nx*6,ny*6,31),h=hash(i,32);
      const c=h<.16?F.dk:h<.27?F.lt:h<.3?[F.c[0]*1.3,F.c[1]*1.1,F.c[2]*.9]:F.c;
      setC(c,m*(.92+.16*hash(i,33)));if(gx<1||gy<1){FR*=.55;FG*=.55;FB*=.55;}
      break;
    }
    case 'cement':{
      const gx=fract(nx/F.ts)*F.ts*Rc,gy=fract(ny/F.ts)*F.ts*Rc,m=.86+.18*fbm2(nx*2,ny*2,41)+.06*(hash(i,42)-.5)-.05*fbm2(nx*9,ny*9,45);
      setC(F.c,m);
      const crack=Math.abs(vn2(nx*1.6,ny*1.6,43)-.5)<.007&&fbm2(nx*.8,ny*.8,44)>.58;
      if(gx<1.6||gy<1.6||crack){FR*=.62;FG*=.62;FB*=.62;}
      break;
    }
    case 'sand':{
      const w=nx*Math.cos(F.rd)+ny*Math.sin(F.rd),rip=Math.sin((w*F.rw+fbm2(nx*2,ny*2,52)*4)*Math.PI);
      setC(F.c,(.9+.12*fbm2(nx*4,ny*4,51))*(1+.06*rip)*(.92+.16*hash(i,53)));
      if(hash(i,54)<.004){FR*=.6;FG*=.6;FB*=.62;}
      break;
    }
    case 'terracotta':{
      const tx=Math.floor(nx/F.ts),ty=Math.floor(ny/F.ts),gx=(nx/F.ts-tx)*F.ts*Rc,gy=(ny/F.ts-ty)*F.ts*Rc,ts=F.ts*Rc;
      if(gx<1.5||gy<1.5){setC([150,136,118],.9+.1*hash(i,62));break;}
      const edge=Math.min(gx,gy,ts-gx,ts-gy)/ts,m=(.84+.3*h2(tx,ty,63))*(.92+.1*fbm2(nx*5,ny*5,64))*(edge<.06?.88:1)*(.95+.1*hash(i,65));
      setC(F.c,m);break;
    }
    case 'slate':{
      voronoi(nx,ny,F.ts,71);
      if(VEDGE<2.2*px){setC(F.c,.32);break;}
      const hv=hash(VID,72),th=hash(VID,73)*Math.PI,w=nx*Math.cos(th)+ny*Math.sin(th);
      setC([F.c[0]*(.85+.3*hv),F.c[1]*(.85+.3*hash(VID,74)),F.c[2]*(.85+.3*hv)],(.9+.08*Math.sin(w*90+fbm2(nx*4,ny*4,75)*6))*(.94+.1*hash(i,76)));
      break;
    }
    case 'cobbles':{
      voronoi(nx,ny,F.ts,81);
      if(VEDGE<1.8*px){setC([60,54,46],.8+.3*hash(i,82));break;}
      setC(F.c,(.75+.45*hash(VID,83))*(1.08-.5*Math.min(1,VD/F.ts))*(.9+.16*hash(i,84)));
      break;
    }
    case 'grass':{
      const blade=hash(Math.floor(nx*Rc*1.3)*31+Math.floor(ny*Rc*.45),91);
      setC(F.c,(.62+.5*fbm2(nx*3,ny*3,92))*(.7+.55*blade)*(.9+.2*hash(i,93)));
      break;
    }
  }
}

/* ---------- the things around the board ---------- */
// Painted once at each size on a canvas of their own, in units of the mandala's radius, then laid over the floor and lit with it.
const disc=(g,x,y,r)=>{g.beginPath();g.arc(x,y,r,0,TAU);g.fill();};
const hex=c=>`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;
const shade=(c,m)=>[c[0]*m,c[1]*m,c[2]*m];
const BOWLS={brass:['#8a6a2c','#d8b466','#b08a40'],copper:['#7c3e22','#d08458','#a85a36'],clay:['#6e3820','#b06a44','#8e4a2e'],stone:['#56534e','#a4a098','#77736c'],silver:['#7c8084','#dcdfe2','#a8acb0']};
const PAINT={
  lamp(g,it,q,sh){
    g.fillStyle=sh||'#9e7a32';disc(g,0,0,.05);if(sh)return;
    g.fillStyle='#d6ae5c';disc(g,-.005,-.006,.044);g.fillStyle='#a98236';disc(g,0,0,.039);
    g.fillStyle='#e8cc88';disc(g,0,0,.032);g.fillStyle='#f6e4b0';disc(g,-.006,-.008,.013);g.fillStyle='#4a3018';disc(g,0,0,.004);
  },
  candle(g,it,q,sh){
    for(const c of it.cs){
      g.fillStyle=sh||'#c8b894';disc(g,c.x,c.y,c.r);if(sh)continue;
      g.fillStyle='#eadfc6';disc(g,c.x,c.y,c.r-.004);g.fillStyle='#f5eedc';disc(g,c.x-.002,c.y-.002,c.r*.55);g.fillStyle='#2a1c12';disc(g,c.x,c.y,.003);
    }
  },
  tealight(g,it,q,sh){
    g.fillStyle=sh||'#8e8e88';disc(g,0,0,.03);if(sh)return;
    g.fillStyle='#d0d0ca';disc(g,-.002,-.002,.027);g.fillStyle='#efe8d8';disc(g,0,0,.023);g.fillStyle='#2a1c12';disc(g,0,0,.003);
  },
  incense(g,it,q,sh){
    g.fillStyle=sh||'#4e3c2a';disc(g,0,0,.055);if(sh)return;
    g.fillStyle='#7a6248';disc(g,-.004,-.004,.05);g.fillStyle='#5e4a34';disc(g,0,0,.045);g.fillStyle='#7c776e';disc(g,0,0,.039);
    for(let k=0;k<40;k++){const a=q()*TAU,d=Math.sqrt(q())*.037;g.fillStyle=q()<.5?'#9c978c':'#5c5852';g.fillRect(Math.cos(a)*d,Math.sin(a)*d,1/Rc,1/Rc);}
    for(const s of PLACE.sticks)if(s.it===it){g.fillStyle='#5a2418';disc(g,s.x,s.y,.0055);}
  },
  pot(g,it,q,sh){
    g.fillStyle=sh||'#7a5c26';disc(g,0,0,.072);if(sh)return;
    g.fillStyle='#d4ae62';disc(g,-.005,-.005,.066);g.fillStyle='#9c7a3a';disc(g,0,0,.062);g.fillStyle='#3a2c1c';disc(g,0,0,.054);g.fillStyle='#cbb990';disc(g,.002,.002,.05);
    for(let k=0;k<60;k++){const a=q()*TAU,d=Math.sqrt(q())*.048;g.fillStyle=q()<.5?'#e0d0a8':'#a8966e';g.fillRect(Math.cos(a)*d,Math.sin(a)*d,1/Rc,1/Rc);}
    for(const s of PLACE.sticks)if(s.it===it){g.fillStyle='#5a2418';disc(g,s.x,s.y,.0055);}
  },
  bowl(g,it,q,sh){
    const r=it.r,c=BOWLS[it.kind];
    g.fillStyle=sh||c[0];disc(g,0,0,r);if(sh)return;
    g.fillStyle=c[1];disc(g,-.006,-.007,r*.97);g.fillStyle=c[2];disc(g,.002,.002,r*.93);g.fillStyle=c[0];disc(g,0,0,r*.885);
    const gr=g.createRadialGradient(0,0,0,0,0,r*.86);gr.addColorStop(0,'#08161a');gr.addColorStop(1,'#16343a');g.fillStyle=gr;disc(g,0,0,r*.86);
  },
  dishes(g,it,q,sh){
    for(let k=0;k<it.n;k++){
      const x=-it.len/2+it.rd+k*(2*it.rd+it.gap),rd=it.rd;
      g.fillStyle=sh||(it.clay?'#8a4a2c':'#9c7a36');disc(g,x,0,rd);if(sh)continue;
      g.fillStyle=it.clay?'#b06a44':'#d2ac60';disc(g,x-.003,-.003,rd*.92);g.fillStyle='#3a2a1a';disc(g,x,0,rd*.8);
      const c=PAL[it.cols[k]];g.fillStyle=hex(shade(c,.9));disc(g,x,0,rd*.76);g.fillStyle=hex(shade(c,1.12));disc(g,x-rd*.18,-rd*.18,rd*.42);
      for(let j=0;j<30;j++){const a=q()*TAU,d=Math.sqrt(q())*rd*.74;g.fillStyle=hex(shade(c,.72+q()*.6));g.fillRect(x+Math.cos(a)*d,Math.sin(a)*d,1/Rc,1/Rc);}
    }
  },
  funnels(g,it,q,sh){
    const dk=it.brass?'#8c6c30':'#7e8286',lt=it.brass?'#d8b464':'#d0d4d8',px=1/Rc;
    for(let k=0;k<it.n;k++){
      g.save();g.translate(0,(k-(it.n-1)/2)*.044);g.rotate(it.j[k]);
      g.fillStyle=sh||dk;g.beginPath();g.moveTo(-.11,-.017);g.lineTo(.11,-.004);g.lineTo(.11,.004);g.lineTo(-.11,.017);g.closePath();g.fill();
      if(!sh){
        g.fillStyle=lt;g.beginPath();g.moveTo(-.11,-.017);g.lineTo(.11,-.004);g.lineTo(.11,-.0005);g.lineTo(-.11,-.003);g.closePath();g.fill();
        g.strokeStyle=dk;g.lineWidth=px;for(let x=-.07;x<.085;x+=.011){const hw=.017-(x+.11)/.22*.013;g.beginPath();g.moveTo(x,-hw);g.lineTo(x,hw);g.stroke();}
        g.fillStyle='#1c1c1c';g.beginPath();g.ellipse(-.11,0,.004,.014,0,0,TAU);g.fill();
      }
      g.restore();
    }
    if(it.rod){g.strokeStyle=sh||'#a0a09a';g.lineWidth=2/Rc;g.beginPath();g.moveTo(-.09,it.n*.024+.02);g.lineTo(.08,it.n*.024+.03);g.stroke();}
  },
  singing(g,it,q,sh){
    g.fillStyle=sh||'#6a4c26';disc(g,-.02,0,.085);
    g.save();g.translate(.06,.07);g.rotate(-.5);g.fillStyle=sh||'#6b4a2a';g.fillRect(-.06,-.007,.12,.014);if(!sh){g.fillStyle='#3c2c22';g.fillRect(.03,-.009,.032,.018);}g.restore();
    if(sh)return;
    g.fillStyle='#b8925a';disc(g,-.024,-.004,.08);g.fillStyle='#7a5a30';disc(g,-.02,0,.075);g.fillStyle='#5a4022';disc(g,-.02,0,.068);g.fillStyle='#4a341c';disc(g,-.02,0,.05);
    g.strokeStyle='#7a5c32';g.lineWidth=1/Rc;g.beginPath();g.arc(-.02,0,.06,0,TAU);g.stroke();
    g.strokeStyle='#e0c084';g.lineWidth=2/Rc;g.beginPath();g.arc(-.02,0,.077,3.5,4.6);g.stroke();
  },
  mala(g,it,q,sh){
    const n=48;let gx=0,gy=0;
    for(let k=0;k<n;k++){
      const t=k/n*TAU,r=.068*(1+.18*Math.sin(2*t+it.p1)+.1*Math.sin(3*t+it.p2)),x=Math.cos(t)*r*1.15,y=Math.sin(t)*r;
      if(k===12){gx=x;gy=y;}
      g.fillStyle=sh||hex(it.bead);disc(g,x,y,.0085);if(!sh){g.fillStyle=hex(shade(it.bead,1.5));disc(g,x-.0025,y-.0025,.003);}
    }
    g.strokeStyle=sh||hex(it.tassel);g.lineWidth=1.5/Rc;for(let j=-2;j<=2;j++){g.beginPath();g.moveTo(gx,gy);g.lineTo(gx+j*.006,gy+.045);g.stroke();}
    g.fillStyle=sh||hex(shade(it.bead,.8));disc(g,gx,gy,.012);
  },
  flowers(g,it,q,sh){flowersIn(g,it,sh);},
  plate(g,it,q,sh){
    g.fillStyle=sh||'#8a6a2c';disc(g,0,0,.092);
    if(!sh){g.fillStyle='#d2ae62';disc(g,-.004,-.004,.088);g.fillStyle='#a8843e';disc(g,0,0,.082);g.fillStyle='#96742e';disc(g,0,0,.07);}
    flowersIn(g,it,sh);
  },
  scarf(g,it,q,sh){
    const c=it.c;g.fillStyle=sh||hex(c);g.beginPath();if(g.roundRect)g.roundRect(-.17,-.042,.34,.084,.008);else g.rect(-.17,-.042,.34,.084);g.fill();if(sh)return;
    g.lineWidth=1/Rc;g.strokeStyle=hex(shade(c,.86));for(const y of[-.014,.014]){g.beginPath();g.moveTo(-.165,y);g.lineTo(.165,y);g.stroke();}
    g.strokeStyle=hex(shade(c,1.06));g.beginPath();g.moveTo(-.165,-.03);g.lineTo(.165,-.03);g.stroke();
    g.strokeStyle=hex(shade(c,.92));for(let y=-.038;y<=.038;y+=.007)for(const s of[-1,1]){g.beginPath();g.moveTo(s*.17,y);g.lineTo(s*.186,y+(q()-.5)*.004);g.stroke();}
  },
  conch(g,it,q,sh){
    g.fillStyle=sh||'#cfc3ae';disc(g,0,0,.034);g.beginPath();g.moveTo(.018,-.031);g.lineTo(.066,0);g.lineTo(.018,.031);g.closePath();g.fill();if(sh)return;
    g.fillStyle='#ece2cf';disc(g,-.003,-.003,.031);g.beginPath();g.moveTo(.016,-.026);g.lineTo(.06,0);g.lineTo(.016,.026);g.closePath();g.fill();
    g.strokeStyle='#bba98c';g.lineWidth=1.2/Rc;g.beginPath();for(let t=0;t<11;t+=.2){const r=.03*(1-t/12);const x=Math.cos(t)*r,y=Math.sin(t)*r;t?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();
    g.fillStyle='#e2a898';g.beginPath();g.ellipse(.01,.018,.022,.007,.2,0,TAU);g.fill();
  },
  bell(g,it,q,sh){
    g.fillStyle=sh||'#7a5a2a';disc(g,0,-.03,.046);
    g.save();g.translate(0,.05);g.fillStyle=sh||'#b08838';g.fillRect(-.035,-.004,.07,.008);disc(g,0,0,.009);for(const s of[-1,1]){disc(g,s*.03,0,.011);disc(g,s*.044,0,.006);}g.restore();
    if(sh)return;
    g.fillStyle='#b08a44';disc(g,-.004,-.034,.043);g.fillStyle='#8e6a32';disc(g,0,-.03,.038);g.strokeStyle='#5c4220';g.lineWidth=2/Rc;g.beginPath();g.arc(0,-.03,.03,0,TAU);g.stroke();
    g.fillStyle='#d8b456';disc(g,0,-.03,.013);g.fillStyle='#f0d478';disc(g,-.003,-.033,.005);
    g.save();g.translate(0,.05);g.fillStyle='#e4c066';disc(g,0,0,.006);for(const s of[-1,1]){g.fillStyle='#d4ac50';disc(g,s*.03,-.002,.007);}g.restore();
  },
  pebbles(g,it,q,sh){
    for(const p of it.ps){g.fillStyle=sh||hex(p.c);g.beginPath();g.ellipse(p.x,p.y,p.rx,p.ry,p.a,0,TAU);g.fill();if(!sh){g.fillStyle=hex(shade(p.c,1.18));g.beginPath();g.ellipse(p.x-p.rx*.25,p.y-p.ry*.3,p.rx*.45,p.ry*.4,p.a,0,TAU);g.fill();}}
  },
};
function flowersIn(g,it,sh){
  if(!sh)for(const p of it.petals){g.fillStyle=hex(p.c);g.fillRect(p.x,p.y,2/Rc,1.5/Rc);}
  for(const h of it.heads){
    g.fillStyle=sh||hex(shade(h.c,.85));for(let j=0;j<12;j++){const a=j/12*TAU;disc(g,h.x+Math.cos(a)*h.r*.72,h.y+Math.sin(a)*h.r*.72,h.r*.36);}
    if(sh)continue;
    g.fillStyle=hex(h.c);disc(g,h.x-.002,h.y-.002,h.r*.78);g.fillStyle=hex(shade(h.c,.78));disc(g,h.x,h.y,h.r*.4);g.fillStyle=hex(shade(h.c,1.15));disc(g,h.x-h.r*.25,h.y-h.r*.25,h.r*.2);
  }
}
function paintItems(){
  const [cv,g]=(()=>{const c=document.createElement('canvas');c.width=cw;c.height=ch;return[c,c.getContext('2d')];})();
  const [sv,sg]=(()=>{const c=document.createElement('canvas');c.width=cw;c.height=ch;return[c,c.getContext('2d')];})();
  // A soft shadow first, cast a little down and to the right by the lamp overhead, then the things themselves.
  for(const pass of[1,0])for(const it of PLACE.items){
    const ctx=pass?sg:g,[x,y]=toG(it.side,it.u,it.v),q=stream(it.seed);
    ctx.save();ctx.translate(x+(pass?Rc*.012:0),y+(pass?Rc*.018:0));ctx.rotate(angOf(it));ctx.scale(Rc,Rc);
    PAINT[it.type](ctx,it,q,pass?'#000':null);
    ctx.restore();
  }
  const out=document.createElement('canvas');out.width=cw;out.height=ch;const og=out.getContext('2d');
  og.globalAlpha=.34;og.drawImage(sv,0,0);og.globalAlpha=1;og.drawImage(cv,0,0);
  return og.getImageData(0,0,cw,ch).data;
}

/* ---------- the board, the floor and the light ---------- */
function paintBase(){
  const fbw=Math.max(3,Rc*.05),gl=Math.max(1,Math.round(Rc*.006)),F=PLACE.floor,pd=paintItems();
  for(let y=0;y<ch;y++){
    for(let x=0;x<cw;x++){
      const i=y*cw+x,dx=x+.5-cx,dy=y+.5-cy,rd=Math.hypot(dx,dy)/Rc;
      // A warm light hangs over the board, and every flame adds its own pool.
      let L=.15+.87/(1+Math.pow(rd/1.38,4)),Wl=0;
      for(const lp of lights){const ex=(x+.5-lp.x)/Rc,ey=(y+.5-lp.y)/Rc;Wl+=lp.pw*Math.exp(-(ex*ex+ey*ey)/(lp.rad*lp.rad));}
      L+=Wl;let W=Wl/.45;if(W>1)W=1;
      lt[i]=L;warm[i]=W;
      let r,g,b;
      const ax=Math.abs(dx),ay=Math.abs(dy),e=ax>ay?ax:ay;
      if(e<=bh){
        if(e>bh-fbw){
          if(e>bh-1.6){const lit=(ay>=ax&&dy<0)||(ax>ay&&dx<0);r=lit?156:64;g=lit?54:18;b=lit?44:16;}
          else if(e<bh-fbw+gl){r=196;g=152;b=66;}
          else{const m=.92+.12*noise(x*.13+y*.07);r=116*m;g=32*m;b=28*m;}
        }else{
          const m=(.94+.1*noise(x*.05+noise(y*.05)*5)+.04*(hash(i,3)-.5))*(1-.3*smooth((e-(bh-fbw-Rc*.03))/(Rc*.03)));
          r=24*m;g=30*m;b=52*m;
        }
        r*=L*(1+.22*W);g*=L*(1+.07*W);b*=L*(1-.2*W);
      }else{
        // A pale floor still reads as dim at night, so lighter floors are held down more than dark ones.
        floorAt(dx/Rc,dy/Rc,i);const fk=.9-.45*(FR*.3+FG*.59+FB*.11)/255;r=FR*fk;g=FG*fk;b=FB*fk;
        const sd=Math.max(Math.abs(dx-Rc*.035),Math.abs(dy-Rc*.05))-bh;
        if(sd<Rc*.06){const s=1-.6*(1-smooth(sd/(Rc*.06)));r*=s;g*=s;b*=s;}
        const a=pd[i*4+3]/255;if(a>0){r+=(pd[i*4]-r)*a;g+=(pd[i*4+1]-g)*a;b+=(pd[i*4+2]-b)*a;}
        // Polished stone throws the lamplight back, and out of doors the dark is a little blue with the night sky.
        const Lf=L+(F.gloss?Wl*.3:0);
        r*=Lf*(1+.22*W);g*=Lf*(1+.07*W);b*=Lf*(1-.2*W);
        if(F.outside){r*=.84+.16*W;g*=.94+.06*W;b*=1.12-.12*W;}
      }
      base[i]=0xff000000|(clamp(b,0,255)<<16)|(clamp(g,0,255)<<8)|clamp(r,0,255);
    }
  }
}

/* ---------- grains to pixels ---------- */
const CHA=[0,.2,.28,.36],DUA=[0,.22,.34,.46];
// A grain's colour, lit from the lamp above, with its own small variation and the light and shadow of the sand's relief.
function pix(i){
  let r,g,b;const s=st[i],L=lt[i];
  if(!s){
    const c=base[i];r=c&255;g=(c>>>8)&255;b=(c>>>16)&255;
    const ca=chalkA[i];if(ca){const a=CHA[ca];r+=(228*L-r)*a;g+=(224*L-g)*a;b+=(212*L-b)*a;}
    const da=dustA[i];if(da){const a=DUA[da],p=PAL[dustC[i]];r+=(p[0]*L*.8-r)*a;g+=(p[1]*L*.8-g)*a;b+=(p[2]*L*.8-b)*a;}
    if(ht[i-cw-1]>.05){r*=.7;g*=.7;b*=.75;}
  }else{
    const p=PAL[col[i]];let d=ht[i-cw-1]-ht[i+cw+1];d=d>2.5?2.5:d<-2.5?-2.5:d;
    const f=L*gv[i]*(1+.16*d),w=warm[i];
    r=p[0]*f*(1+.12*w);g=p[1]*f*(1+.03*w);b=p[2]*f*(1-.18*w);
  }
  buf[i]=0xff000000|((b>255?255:b<0?0:b)<<16)|((g>255?255:g<0?0:g)<<8)|(r>255?255:r<0?0:r);
}
function mark(i){if(!dmark[i]){dmark[i]=1;dlist[dcount++]=i;}}
function markR(i){mark(i);mark(i+cw+1);mark(i-cw-1);}
function flush(){
  if(!dcount)return;
  for(let k=0;k<dcount;k++){const i=dlist[k];dmark[i]=0;if(i<=cw||i>=nC-cw-1)continue;pix(i);const t=(((i/cw)|0)>>5)*tw+((i%cw)>>5);if(!tmark[t]){tmark[t]=1;tlist[tcount++]=t;}}
  dcount=0;
  for(let k=0;k<tcount;k++){const t=tlist[k];tmark[t]=0;const tx=(t%tw)*32,ty=((t/tw)|0)*32;ctxA.putImageData(img,0,0,tx,ty,Math.min(32,cw-tx),Math.min(32,ch-ty));}
  tcount=0;
}
function repaint(){for(let i=0;i<nC;i++)pix(i);for(let k=0;k<dcount;k++)dmark[dlist[k]]=0;dcount=0;ctxA.putImageData(img,0,0);}

/* ---------- turning a design into grains ---------- */
// The design is evaluated for every grain, split into pieces of one colour, and each piece gets a path for the sand to follow:
// round its edge first, then inward in rings, the way a section is outlined and then filled.
// A line takes about 8 s to run the length of the radius, and a field fills at about a 750th of the radius squared a second.
const KL=4,KA=400;
let B=null,scr=null;
function scratch(mn){if(!scr||scr.mn<mn)scr={mn,code:new Int32Array(mn),pid:new Int32Array(mn),lay:new Uint16Array(mn),vis:new Uint8Array(mn),q:new Int32Array(mn),q2:new Int32Array(mn),sec:new Uint8Array(mn),tmp:new Int32Array(mn)};return scr;}
const workersFor=(D,e)=>Math.min(D.monks,e.rOut<.22?1:e.rOut<.55?2:3);
// Each section's time is measured once on a fixed grid, so the mandala is made at the same pace on any screen.
function*measure(D){
  const Rr=110,M=Rr+2,w=2*M,code=new Int32Array(w*w);
  for(let y=0;y<w;y++){for(let x=0;x<w;x++)code[y*w+x]=D.at((x+.5-M)/Rr,(y+.5-M)/Rr);if((y&15)===15)yield;}
  const cells=new Float64Array(D.units.length),bnd=new Float64Array(D.units.length);
  for(let y=1;y<w-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x,k=code[i];if(!k)continue;
    const e=D.els[(k>>5)-1],ns=e.nSec,s=ns>1?Math.floor(mod(Math.atan2(y+.5-M,x+.5-M)+Math.PI/ns,TAU)/(TAU/ns))%ns:0,u=D.ub[e.id]+s;
    cells[u]++;if(code[i-1]!==k||code[i+1]!==k||code[i-w]!==k||code[i+w]!==k)bnd[u]++;
  }
  let est=0;
  for(const e of D.els){let sum=0,busy=0;for(let s=0;s<e.nSec;s++){const u=D.ub[e.id]+s,d=bnd[u]*KL/Rr+(cells[u]-bnd[u])*KA/(Rr*Rr);D.units[u].dur=d;if(d>0){sum+=d;busy++;}}est+=sum/Math.max(1,Math.min(busy,workersFor(D,e)));}
  const k=D.rate;
  for(const U of D.units)U.dur=U.dur>0?Math.max(1,U.dur*k):0;
  D.estT=est*k;
  D.measured=true;
}
const OX=[1,0,-1,0,1,-1,-1,1],OY=[0,1,0,-1,1,1,-1,-1];
function walkSub(A,cells,n,id,mw,out,pos,toC){
  const{pid,lay,vis}=A,off=OX.map((x,k)=>x+OY[k]*mw);
  let sx=0,sy=0;for(let h=0;h<n;h++){const c=cells[h];sx+=c%mw;sy+=(c/mw)|0;}sx/=n;sy/=n;
  const key=new Float64Array(n),ord=new Uint32Array(n);
  for(let h=0;h<n;h++){const c=cells[h];key[h]=lay[c]+(Math.atan2(((c/mw)|0)-sy,c%mw-sx)+Math.PI)/TAU*.999;ord[h]=h;}
  ord.sort((a,b)=>key[a]-key[b]);
  let len=0,n0=0;
  for(let ph=0;ph<2;ph++){
    let ptr=0,cur=-1,pdx=0,pdy=0;
    for(;;){
      if(cur<0){while(ptr<n){const c=cells[ord[ptr]];if(!vis[c]&&(ph||!lay[c]))break;ptr++;}if(ptr>=n)break;cur=cells[ord[ptr]];pdx=pdy=0;}
      vis[cur]=1;out[pos+len++]=toC(cur);
      const lc=lay[cur],px=cur%mw,py=(cur/mw)|0;let best=-1,bs=-1e9,bk=0;
      for(let k=0;k<8;k++){
        const nb=cur+off[k];if(pid[nb]!==id||vis[nb])continue;
        const ln=lay[nb];if(!ph&&ln)continue;
        let s=ln===lc?4:ln===lc+1?2:ln<lc?1.2:.5;
        const ul=k<4?1:Math.SQRT1_2;
        if(pdx||pdy)s+=(OX[k]*pdx+OY[k]*pdy)*ul*1.6;else if((px-sx)*OY[k]-(py-sy)*OX[k]>0)s+=.6;
        if(k<4)s+=.25;
        if(s>bs){bs=s;best=nb;bk=k;}
      }
      if(best<0){cur=-1;continue;}
      const ul=bk<4?1:Math.SQRT1_2;pdx=pdx*.5+OX[bk]*ul*.5;pdy=pdy*.5+OY[bk]*ul*.5;cur=best;
    }
    if(!ph)n0=len;
  }
  return{len,n0,ang:Math.atan2(sy+.5-mw/2,sx+.5-mw/2)};
}
function*build(D){
  if(!D.measured)yield*measure(D);
  const M=Math.ceil(Rc*1.02)+3,mw=2*M,mn=mw*mw,x0=cx-M,y0=cy-M;
  const A=scratch(mn),{code,pid,lay,vis,q,q2,sec,tmp}=A,N4=[1,-1,mw,-mw];
  vis.fill(0,0,mn);pid.fill(0,0,mn);
  for(let my=0;my<mw;my++){const y=(my+.5-M)/Rc;for(let mx=0;mx<mw;mx++)code[my*mw+mx]=D.at((mx+.5-M)/Rc,y);if((my&7)===7)yield;}
  const walk=new Int32Array(mn),patches=[];let wpos=0,pidN=0,work=0;
  const toC=m=>(y0+((m/mw)|0))*cw+x0+m%mw;
  for(let i=0;i<mn;i++){
    const k=code[i];if(!k||pid[i])continue;
    let qt=0;q[qt++]=i;pid[i]=-1;
    for(let h=0;h<qt;h++){const c=q[h];for(let j=0;j<4;j++){const nb=c+N4[j];if(!pid[nb]&&code[nb]===k){pid[nb]=-1;q[qt++]=nb;}}}
    let n2=0,maxL=0;
    for(let h=0;h<qt;h++){const c=q[h];let edge=false;for(let j=0;j<4;j++)if(code[c+N4[j]]!==k){edge=true;break;}if(edge){lay[c]=0;q2[n2++]=c;}else lay[c]=65535;}
    for(let h=0;h<n2;h++){const c=q2[h],L=lay[c]+1;for(let j=0;j<4;j++){const nb=c+N4[j];if(pid[nb]===-1&&lay[nb]>L){lay[nb]=L;if(L>maxL)maxL=L;q2[n2++]=nb;}}}
    // A piece that runs round much of the mandala is shared out between the sections, so several funnels can work on it.
    const e=D.els[(k>>5)-1],ns=e.nSec,cnt=[0,0,0,0,0,0,0,0];
    for(let h=0;h<qt;h++){const c=q[h];let s=0;if(ns>1)s=Math.floor(mod(Math.atan2(((c/mw)|0)+.5-M,c%mw+.5-M)+Math.PI/ns,TAU)/(TAU/ns))%ns;sec[h]=s;cnt[s]++;}
    let big=0,best=0;for(let s=0;s<ns;s++){if(cnt[s]>=qt*.1)big++;if(cnt[s]>cnt[best])best=s;}
    const split=ns>1&&(big>=3||(big>=2&&qt>mn*.012));
    for(let s=0;s<ns;s++){
      if(split?!cnt[s]:s!==best)continue;
      const id=++pidN;let n=0;
      for(let h=0;h<qt;h++)if(!split||sec[h]===s){pid[q[h]]=id;tmp[n++]=q[h];}
      const w=walkSub(A,tmp,n,id,mw,walk,wpos,toC),line=maxL<=1;
      patches.push({u:D.ub[e.id]+s,start:wpos,len:w.len,n0:line?w.len:w.n0,color:k&31,line,ang:w.ang});
      wpos+=w.len;
    }
    work+=qt;if(work>12000){work=0;yield;}
  }
  // Within a section: lines first, then the small pieces, then the wide fields, each in turn across the section.
  const units=D.units.map(()=>({list:[],cum:[],total:0,pi:0,ci:0,cells:0}));
  for(let j=0;j<patches.length;j++){const U=units[patches[j].u];U.list.push(j);U.cells+=patches[j].len;}
  const wb=KL/Rc,wi=KA/(Rc*Rc);
  units.forEach((U,u)=>{
    const D0=D.units[u],ns=D.els[D0.el-1].nSec,start=D0.ang-Math.PI/ns;
    const rank=j=>{const P=patches[j];return(P.line?0:P.len>U.cells*.25?2:1)*10+mod(P.ang-start,TAU);};
    U.list.sort((a,b)=>rank(a)-rank(b));
    let t=0;for(const j of U.list){const P=patches[j];P.w=P.n0*wb+(P.len-P.n0)*wi;U.cum.push(t);t+=P.w;}U.total=t;
  });
  B={walk,patches,units,wb,wi};
}
let builder=null;
function stepBuilder(ms){if(!builder)return;const t0=performance.now();do{if(builder.next().done){builder=null;return;}}while(performance.now()-t0<ms);}
function ensureBuilt(){if(builder){while(!builder.next().done);builder=null;}}

/* ---------- the world ---------- */
let time=0,phase='rest',phaseT=0,replaying=false;
let mand=null,workers=[],diss=null,chalkTip=null;
const stats={grains:0,lines:0,mandalas:0};
function setPhase(p){phase=p;phaseT=0;}
function clearBoard(){st.fill(0);ht.fill(0);col.fill(0);chalkA.fill(0);dustA.fill(0);}
function newMandala(first){
  mand=makeDesign(seedOf());
  mand.salt=Math.floor(R()*1e6);
  mand.rest=first?2.5:rr(8,14);
  mand.ck=0;mand.cl=0;mand.cur=0;mand.done=0;mand.grains=0;
  mand.free=mand.els.map(e=>e.nSec);mand.left=mand.els.map(e=>e.nSec);
  workers=[];diss=null;chalkTip=null;B=null;
  builder=build(mand);
  setPhase('rest');
}

/* ---- chalk ---- */
function chalkAt(x,y){
  const gx=Math.floor(cx+x*Rc),gy=Math.floor(cy+y*Rc);if(gx<1||gy<1||gx>=cw-1||gy>=ch-1)return;
  const i=gy*cw+gx;if(chalkA[i]||hash(i,91)<.1)return;
  chalkA[i]=1+((hash(i,92)*3)|0);if(!st[i])mark(i);
}
function rasterStroke(k,a,b){
  const step=.45/Rc;let lx=0,ly=0;
  for(let j=1;j<k.pts.length;j++){
    const s0=k.cum[j-1],s1=k.cum[j];if(s1<=a)continue;if(s0>=b)break;
    const p0=k.pts[j-1],p1=k.pts[j],sl=s1-s0||1e-9,e=Math.min(b,s1);
    for(let s=Math.max(a,s0);s<=e;s+=step){const q=(s-s0)/sl;lx=p0[0]+(p1[0]-p0[0])*q;ly=p0[1]+(p1[1]-p0[1])*q;chalkAt(lx,ly);}
  }
  return[lx,ly];
}
function chalkTo(t){
  const S=mand.strokes;chalkTip=null;
  while(mand.ck<S.length){
    const k=S[mand.ck];if(t<k.t0)break;
    const L=Math.min(k.len,(t-k.t0)*k.sp);
    if(L>mand.cl){const p=rasterStroke(k,mand.cl,L);chalkTip=p;mand.cl=L;}
    if(L>=k.len){mand.ck++;mand.cl=0;if(!replaying)stats.lines++;}else break;
  }
}

/* ---- sand ---- */
function deposit(i,c,line){
  col[i]=c;st[i]=1;ht[i]=(line?1.2:1)+(hash(i,77)-.5)*.22;markR(i);
  if(!replaying){stats.grains++;mand.grains++;}
  // Now and then a grain bounces off and lands a little way away.
  const h=hash(i,mand.salt);
  if(h<.006){
    const a=hash(i,mand.salt+1)*TAU,d=2+hash(i,mand.salt+2)*3,j=i+Math.round(Math.sin(a)*d)*cw+Math.round(Math.cos(a)*d);
    if(j>cw&&j<nC-cw){if(!st[j]){col[j]=c;st[j]=1;ht[j]=.45;markR(j);}else if(h<.0012&&st[j]===1){col[j]=c;markR(j);}}
  }
}
function reveal(u,p,wk){
  const U=B.units[u];if(!U.total)return;
  const W=Math.min(1,p)*U.total;
  while(U.pi<U.list.length){
    const P=B.patches[U.list[U.pi]],loc=W-U.cum[U.pi];
    let tgt;
    if(loc>=P.w)tgt=P.len;else{tgt=loc<P.n0*B.wb?loc/B.wb:P.n0+(loc-P.n0*B.wb)/B.wi;tgt=Math.min(P.len,tgt|0);}
    while(U.ci<tgt){deposit(B.walk[P.start+U.ci],P.color,P.line);U.ci++;}
    if(wk&&U.ci>0){wk.tip=B.walk[P.start+U.ci-1];wk.tc=P.color;wk.active=true;}
    if(U.ci>=P.len){U.pi++;U.ci=0;if(P.line&&!replaying)stats.lines++;}else break;
  }
}
function finishUnit(u){
  const D=mand,U=D.units[u];U.state=2;U.p=1;D.done++;
  const e=U.el-1;if(!--D.left[e]&&D.els[e].name&&!replaying)N.log(D.els[e].name);
}
function addWorker(){
  let ang=0;
  if(workers.length){const as=workers.map(w=>mod(w.ang,TAU)).sort((a,b)=>a-b);let gap=-1;for(let k=0;k<as.length;k++){const a=as[k],b=k+1<as.length?as[k+1]:as[0]+TAU;if(b-a>gap){gap=b-a;ang=a+gap/2;}}}
  workers.push({ang,u:-1,wait:workers.length?rr(.5,2):0,tip:-1,tc:0,active:false});
}
function claim(w){
  const D=mand;
  for(let e=D.cur;e<D.els.length;e++){
    if(!D.free[e])continue;
    const el=D.els[e],b=D.ub[el.id];let best=-1,bs=1e9;
    for(let s=0;s<el.nSec;s++){const u=b+s,U=D.units[u];if(U.state)continue;const sc=Math.min(mod(U.ang-w.ang,TAU),mod(w.ang-U.ang,TAU)*1.3);if(sc<bs){bs=sc;best=u;}}
    if(best>=0){D.units[best].state=1;D.free[e]--;return best;}
  }
  return -1;
}
function sandUpdate(dt){
  const D=mand,US=D.units;
  while(D.cur<D.els.length&&!D.free[D.cur])D.cur++;
  if(D.cur<D.els.length){const need=workersFor(D,D.els[D.cur]);while(workers.length<need)addWorker();}
  // The pace drifts, slower and faster over the minutes.
  const pace=.88+.24*noise(time*.02+D.nz);
  for(const w of workers){
    w.active=false;
    if(w.wait>0){w.wait-=dt;continue;}
    let left=dt;
    while(left>0){
      if(w.u<0){
        const u=claim(w);if(u<0){w.wait=.4;break;}
        // An empty section is passed over without a pause.
        if(!US[u].dur&&!B.units[u].total){finishUnit(u);continue;}
        w.u=u;
      }
      const U=US[w.u],dur=U.dur||1;
      const need=(1-U.p)*dur/pace;
      if(left>=need){U.p=1;left-=need;}else{U.p+=left*pace/dur;left=0;}
      reveal(w.u,U.p,w);
      if(U.p>=1){finishUnit(w.u);w.ang=U.ang;w.u=-1;w.wait=expo(1.8)+(chance(.1)?rr(5,12):0);break;}
    }
  }
  if(D.done>=US.length)complete();
}
function complete(){
  workers=[];setPhase('hold');
  if(!replaying)N.log('Finished, with '+mand.grains.toLocaleString('en-US')+' grains of sand. It rests for '+HOLD+' seconds');
}

/* ---- the sweeping away ---- */
const BINS=48;
const binOf=th=>(((th+Math.PI)/TAU*BINS)|0)%BINS;
const harmAt=(D,th)=>D.harm[(((th+Math.PI)/TAU*1024)|0)&1023];
function startDiss(){
  const seed=seedOf(),cuts=[];let t=0;
  // Eight cuts along the main lines, east and west, south and north, then the diagonals.
  for(const k of[2,6,4,0,1,5,3,7]){const d=rr(3.5,5);cuts.push({a:k*Math.PI/4,t0:t,d,hw:.012});t+=d+rr(1,2);}
  const sw={t0:t+rr(2,4),d:rr(70,95),K:ri(8,11),A:.045,h:[3,5,7,11].map(n=>({n,a:rr(.3,1),p:rr(0,TAU)}))};
  t=sw.t0+sw.d;
  const heap={t0:t,d:6};t+=heap.d;
  const drain={t0:t,d:rr(26,34)};t+=drain.d+rr(2,4);
  const wipe={t0:t,d:rr(12,16),dir:ri(0,3)};t+=wipe.d+1;
  diss={seed,cuts,sw,heap,drain,wipe,T:t,curve:chance(.5)?1:-1};
  resetDiss();
  setPhase('diss');
}
function resetDiss(){
  const D=diss;D.t=0;D.g=stream(D.seed);D.pool=new Float32Array(BINS*NP);D.ptot=new Float32Array(BINS);D.tmp=new Float32Array(BINS*NP);
  D.R0=1.08;D.heapCells=null;D.tot=null;D.cutHead=null;D.wipeAt=null;
  D.harm=new Float32Array(1024);
  let n=0;for(const h of D.sw.h)n+=h.a;
  for(let b=0;b<1024;b++){const th=b/1024*TAU-Math.PI;let s=0;for(const h of D.sw.h)s+=Math.sin(h.n*th+h.p)*h.a;D.harm[b]=s/n;}
}
// Most of a cleared grain's colour goes with it, and a few specks stay behind on the board.
function clearCell(i,keep=.2){const h=hash(i,33);dustC[i]=col[i];dustA[i]=h<keep?1+((h/keep*2.99)|0):0;st[i]=0;ht[i]=0;markR(i);}
function cutRange(c,rA,rB){
  const ca=Math.cos(c.a),sa=Math.sin(c.a),px=-sa,py=ca,hw=c.hw*Rc,stepR=.5/Rc;
  for(let r=rB;r>rA;r-=stepR){
    const bx=cx+ca*r*Rc,by=cy+sa*r*Rc;
    const w=hw+(noise(r*Rc*.4+c.a*50)-.5)*1.6;
    for(let o=-w;o<=w;o+=.5){
      const i=Math.floor(by+py*o)*cw+Math.floor(bx+px*o);
      if(!st[i])continue;
      // The sand in the cut is pushed up to either side.
      const sd=o<0?-1:1,push=hw+1+((hash(i,31)*2.5)|0),j=Math.floor(by+py*sd*push)*cw+Math.floor(bx+px*sd*push);
      if(st[j]){ht[j]=Math.min(4,ht[j]+.18);if(hash(i,32)<.45)col[j]=col[i];}else{st[j]=1;col[j]=col[i];ht[j]=.7;dustA[j]=0;}
      markR(j);clearCell(i,.08);
    }
  }
}
function addPool(D,th,c){const b=binOf(th);D.pool[b*NP+c]++;D.ptot[b]++;}
function samplePool(D,th){
  const g=D.g,b=(binOf(th)+Math.round((g()-.5)*2.4)+BINS)%BINS,tot=D.ptot[b];if(tot<.5)return 0;
  let r=g()*tot,last=0;const o=b*NP;for(let c=1;c<NP;c++){const v=D.pool[o+c];if(v>0){last=c;r-=v;if(r<=0)return c;}}return last;
}
function sampleTot(D,g){let r=g()*D.totSum,last=1;for(let c=1;c<NP;c++){const v=D.tot[c];if(v>0){last=c;r-=v;if(r<=0)return c;}}return last;}
function diffuse(D){
  const P=D.pool,T=D.tmp;T.set(P);
  for(let b=0;b<BINS;b++){const a=((b+BINS-1)%BINS)*NP,c=((b+1)%BINS)*NP,o=b*NP;let s=0;for(let k=1;k<NP;k++){const v=T[o+k]*.94+(T[a+k]+T[c+k])*.03;P[o+k]=v;s+=v;}D.ptot[b]=s;}
}
function sweepTo(D,Ra,Rb){
  const S=D.sw,A=S.A,wr=Rb<.14?Rb*(1+A)+.012:.032;
  const k0=Math.max(0,Math.floor((Rb*(1-A)-wr-.01)*Rc)),k1=Math.min(rb.max-1,Math.ceil((Ra*(1+A)+.012)*Rc));
  diffuse(D);
  const arc=TAU*Math.max(Rb,.02)*Rc/BINS,area=arc*Math.max(1,wr*Rc);
  for(let k=k0;k<=k1;k++)for(let j=rb.off[k];j<rb.off[k+1];j++){
    const i=rb.cells[j],s=st[i],r=rbR[j],th=rbT[j],Rf=Rb*(1+A*harmAt(D,th));
    if(r>Rf){if(s===1||s===2){if(s===1)addPool(D,th,col[i]);clearCell(i);}}
    else if(r>Rf-wr&&s!==2){
      // The front pushes a ridge of mixed sand ahead of it, taller as it gathers more.
      if(s===1)addPool(D,th,col[i]);
      const c=samplePool(D,th);
      if(c){col[i]=c;st[i]=2;ht[i]=1+Math.min(6,D.ptot[binOf(th)]/area*.5)*(.6+.8*hash(i,41));dustA[i]=0;markR(i);}
    }
  }
}
function sweepR(S,x){const E=x-Math.sin(TAU*S.K*x)/(TAU*S.K)*.6;return 1.08-(1.08-.065)*E;}
function makeHeap(D){
  const rH=.085,tot=new Float32Array(NP);let sum=0;
  for(let b=0;b<BINS;b++)for(let c=1;c<NP;c++){tot[c]+=D.pool[b*NP+c];sum+=D.pool[b*NP+c];}
  if(sum<1){tot[RED]=1;sum=1;}
  D.tot=tot;D.totSum=sum;D.rH=rH;
  const cells=[],kmax=Math.min(rb.max-1,Math.ceil(rH*1.5*Rc));
  for(let k=0;k<=kmax;k++)for(let j=rb.off[k];j<rb.off[k+1];j++){
    const i=rb.cells[j],r=rbR[j],e=rH*(1+.12*harmAt(D,rbT[j]*2));
    if(r<e){col[i]=sampleTot(D,D.g);st[i]=3;ht[i]=1+6*Math.pow(1-r/e,1.1);dustA[i]=0;markR(i);cells.push(j);}
    else if(st[i])clearCell(i);
  }
  D.heapCells=cells;
}
function drainTo(D,x){
  if(!D.heapCells)return 0;
  const rh=D.rH*Math.pow(1-x,.8),k=rh/D.rH;let out=0;
  for(const j of D.heapCells){
    const i=rb.cells[j];if(st[i]!==3)continue;
    const r=rbR[j],e=rh*(1+.12*harmAt(D,rbT[j]*2));
    if(r>=e){clearCell(i);out++;}else{ht[i]=1+6*k*Math.pow(1-r/e,1.1);markR(i);}
  }
  return out;
}
function wipeTo(W,a,b){
  const span=2*bh+6,p0=Math.floor(-bh-3+span*a),p1=Math.floor(-bh-3+span*b);
  for(let p=p0;p<p1;p++){
    const pp=W.dir&1?-p:p;
    for(let q=-bh-3;q<=bh+3;q++){
      const x=W.dir<2?cx+pp:cx+q,y=W.dir<2?cy+q:cy+pp;
      if(x<1||y<1||x>=cw-1||y>=ch-1)continue;
      const i=y*cw+x;if(st[i]||chalkA[i]||dustA[i]){st[i]=0;ht[i]=0;col[i]=0;chalkA[i]=0;dustA[i]=0;markR(i);}
    }
  }
  diss.wipeAt=W.dir&1?-p1:p1;
}
function dissTo(t){
  const D=diss,t0=D.t;if(t<=t0)return;D.t=t;
  D.cutHead=null;
  for(const c of D.cuts){
    const a=clamp((t0-c.t0)/c.d,0,1),b=clamp((t-c.t0)/c.d,0,1);
    if(b>a){if(a===0&&c===D.cuts[0]&&!replaying)N.log('Eight cuts run from the rim to the centre');const rB=1.06*(1-smooth(a)),rA=1.06*(1-smooth(b));cutRange(c,rA,rB);if(b<1)D.cutHead={a:c.a,r:rA};}
  }
  const S=D.sw,sa=clamp((t0-S.t0)/S.d,0,1),sb=clamp((t-S.t0)/S.d,0,1);
  if(sb>sa){if(sa===0&&!replaying)N.log('The sand is swept in toward the centre');const R0=sweepR(S,sb);sweepTo(D,D.R0,R0);D.R0=R0;}
  if(t>=D.heap.t0&&t0<D.heap.t0)makeHeap(D);
  const dr=D.drain,da=clamp((t0-dr.t0)/dr.d,0,1),db=clamp((t-dr.t0)/dr.d,0,1);
  if(db>da){
    if(da===0&&!replaying)N.log('The heap of sand is poured into the water');
    const out=drainTo(D,db);
    if(!replaying)pour(out,t-t0);
    if(db>=1&&!replaying)stats.mandalas++;
  }
  const W=D.wipe,wa=clamp((t0-W.t0)/W.d,0,1),wb=clamp((t-W.t0)/W.d,0,1);
  if(wb>wa){if(wa===0&&!replaying)N.log('The board is wiped clean');wipeTo(W,wa,wb);if(wb>=1)D.wipeAt=null;}
}

/* ---------- lamps, smoke, a moth and the water ---------- */
let draft=null,moth=null,incBoost=0;
const means={draft:150,flicker:160,moth:300,incense:360},timers={};
for(const k in means)timers[k]=expo(means[k])+(k==='moth'?40:0);
function fire(kind){
  if(!(kind in means))return false;
  let ok=true;
  if(kind==='draft'){const a=rr(0,TAU);draft={x:Math.cos(a),y:Math.sin(a),s:rr(.5,1),t:0,life:rr(3,7)};N.log(PLACE.floor.outside?'A breeze leans the flames':'A draft leans the flames');}
  if(kind==='flicker'){const L=pick(PLACE.flames).st;L.gut=L.gutD=rr(3,6);N.log('A flame gutters, then steadies');}
  if(kind==='incense'){incBoost=rr(25,50);N.log('A fresh stick of incense is lit');}
  if(kind==='moth'){if(moth)ok=false;else{spawnMoth();N.log('A moth comes in to the light');}}
  timers[kind]=time+expo(means[kind]);
  return ok;
}
function spawnMoth(){
  const k=ri(0,PLACE.flames.length-1),edge=ri(0,3);
  const x=edge===0?-8:edge===1?cw+8:rr(0,cw),y=edge===2?-8:edge===3?ch+8:rr(0,ch);
  moth={k,x,y,vx:0,vy:0,state:'in',t:0,stay:rr(10,28),land:chance(.5),hold:rr(6,18),dir:chance(.5)?1:-1,nz:rr(0,500),ex:ri(0,3),ang:rr(0,TAU)};
}
function mothUpdate(dt){
  const m=moth,lp=lights[m.k];m.t+=dt;
  let tx=lp.x,ty=lp.y,sp=Rc*.32;
  const jit=Rc*.05;
  if(m.state==='in'){if(Math.hypot(m.x-lp.x,m.y-lp.y)<Rc*.16){m.state='orbit';m.t=0;}}
  if(m.state==='orbit'){
    m.ang+=dt*m.dir*(1.1+.8*noise(time*.5+m.nz));
    const rad=Rc*(.07+.06*noise(time*.9+m.nz+9));tx=lp.x+Math.cos(m.ang)*rad;ty=lp.y+Math.sin(m.ang)*rad;sp=Rc*.5;
    if(m.t>m.stay){m.state=m.land?'toLand':'out';m.t=0;}
  }
  if(m.state==='toLand'){
    // It settles on the edge of the board nearest its light.
    tx=clamp(lp.x,cx-bh+2,cx+bh-2);ty=clamp(lp.y,cy-bh+2,cy+bh-2);
    if(Math.abs(lp.x-cx)>Math.abs(lp.y-cy))tx=cx+Math.sign(lp.x-cx)*(bh-Rc*.025);else ty=cy+Math.sign(lp.y-cy)*(bh-Rc*.025);
    sp=Rc*.22;
    if(Math.hypot(m.x-tx,m.y-ty)<1.5){m.state='rest';m.t=0;m.vx=m.vy=0;}
  }
  if(m.state==='rest'){if(m.t>m.hold){m.state='out';m.t=0;}return;}
  if(m.state==='out'){tx=m.ex===0?-40:m.ex===1?cw+40:lp.x;ty=m.ex===2?-40:m.ex===3?ch+40:lp.y;sp=Rc*.4;if(m.x<-30||m.y<-30||m.x>cw+30||m.y>ch+30){moth=null;return;}}
  tx+=(noise(time*1.2+m.nz)-.5)*jit*2;ty+=(noise(time*1.3+m.nz+50)-.5)*jit*2;
  const dx=tx-m.x,dy=ty-m.y,d=Math.hypot(dx,dy)||1,v=Math.min(sp,d*4);
  const k=1-Math.exp(-dt*3);m.vx+=(dx/d*v-m.vx)*k;m.vy+=(dy/d*v-m.vy)*k;
  m.x+=m.vx*dt;m.y+=m.vy*dt;
}
function ambient(dt){
  for(const k in timers)if(time>=timers[k])fire(k);
  for(const f of PLACE.flames)if(f.st.gut>0)f.st.gut=Math.max(0,f.st.gut-dt);
  if(draft){draft.t+=dt;if(draft.t>draft.life)draft=null;}
  if(incBoost>0)incBoost=Math.max(0,incBoost-dt);
  if(moth)mothUpdate(dt);
}
const draftK=()=>draft?Math.sin(Math.min(1,draft.t/draft.life)*Math.PI)*draft.s:0;
// Flames breathe slowly. A guttering lamp dims and comes back over a few seconds.
function flame(k){const L=lights[k].st,dip=L.gut>0?Math.sin(L.gut/L.gutD*Math.PI):0,g=1-.32*dip*(.7+.3*noise(time*3+L.ph));return(.88+.12*noise(time*1.8+L.ph)+.04*noise(time*5+L.ph*3))*g*(1+.15*draftK()*(noise(time*3+L.ph)-.5));}

// Particles for the eye only: grains falling from the funnel, chalk dust, the stream to the bowl, sand in the water, smoke and motes.
const falls=[],dusts=[],streams=[],inWater=[],ripples=[],smoke=[],motes=[];
let tint=[60,60,60],tintA=0;
function pour(out,dt){
  if(!diss.tot)return;
  const n=Math.min(30,out*1.4+dt*40);
  for(let k=0;k<n;k++){
    const a=Math.atan2(bowl.y-cy,bowl.x-cx)+(fx()-.5)*.9,r0=diss.rH*Rc*fx();
    streams.push({x0:cx+Math.cos(a)*r0,y0:cy+Math.sin(a)*r0,t:0,sp:rr2(.18,.26),off:(fx()-.5)*3,lx:(fx()-.5)*bowl.r*1.1,ly:(fx()-.5)*bowl.r*1.1,c:sampleTot(diss,fx)});
  }
}
const rr2=(a,b)=>a+(b-a)*fx();
function cosmetic(dt){
  // Grains falling from each funnel tip.
  for(const w of workers)if(w.active&&w.tip>=0){let n=dt*22;while(n>0){if(fx()<n)falls.push({x:w.tip%cw+.5,y:((w.tip/cw)|0)+.5,ox:(fx()-.5)*5,oy:(fx()-.5)*5,a:0,life:rr2(.3,.55),c:w.tc});n-=1;}}
  for(let i=falls.length-1;i>=0;i--){const p=falls[i];p.a+=dt;if(p.a>p.life)falls.splice(i,1);}
  if(phase==='chalk'&&chalkTip&&fx()<dt*8)dusts.push({x:cx+chalkTip[0]*Rc,y:cy+chalkTip[1]*Rc,vx:(fx()-.5)*3,vy:(fx()-.5)*3,a:0,life:rr2(.8,1.6),c:null});
  if(diss&&diss.cutHead){const h=diss.cutHead,x=cx+Math.cos(h.a)*h.r*Rc,y=cy+Math.sin(h.a)*h.r*Rc;for(let n=dt*30;n>0;n--)if(fx()<n){const s=fx()<.5?-1:1,i=Math.floor(y)*cw+Math.floor(x);dusts.push({x,y,vx:-Math.sin(h.a)*s*rr2(3,8),vy:Math.cos(h.a)*s*rr2(3,8),a:0,life:rr2(.3,.6),c:col[i]||RED});}}
  for(let i=dusts.length-1;i>=0;i--){const p=dusts[i];p.a+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.a>p.life)dusts.splice(i,1);}
  // The stream of sand into the bowl, and what it does in the water.
  for(let i=streams.length-1;i>=0;i--){
    const p=streams[i];p.t+=dt*p.sp;
    if(p.t>=1){
      const x=bowl.x+p.lx,y=bowl.y+p.ly,dx=x-bowl.x,dy=y-bowl.y;
      inWater.push({a:Math.atan2(dy,dx),r:Math.min(bowl.r*.8,Math.hypot(dx,dy)),w:rr2(.25,.6)*diss.curve,age:0,life:rr2(8,16),c:p.c});
      const q=PAL[p.c];tint[0]+=(q[0]-tint[0])*.03;tint[1]+=(q[1]-tint[1])*.03;tint[2]+=(q[2]-tint[2])*.03;tintA=Math.min(.42,tintA+.0022);
      if(fx()<.04)ripples.push({x,y,r:1,age:0,life:rr2(1.5,2.5)});
      streams.splice(i,1);
    }
  }
  for(let i=inWater.length-1;i>=0;i--){const p=inWater[i];p.age+=dt;p.a+=p.w*dt*(1.2-p.r/bowl.r);p.r=Math.min(bowl.r*.82,p.r+dt*bowl.r*.03);if(p.age>p.life)inWater.splice(i,1);}
  if(inWater.length>900)inWater.splice(0,inWater.length-900);
  tintA*=Math.exp(-dt/50);
  if(fx()<dt/14)ripples.push({x:bowl.x+(fx()-.5)*bowl.r,y:bowl.y+(fx()-.5)*bowl.r,r:1,age:0,life:rr2(1.5,3)});
  for(let i=ripples.length-1;i>=0;i--){const q=ripples[i];q.age+=dt;q.r+=dt*Rc*.03;if(q.age>q.life)ripples.splice(i,1);}
  // Incense smoke curls up and drifts.
  const rate=incBoost>0?7:3,air=noise(time*.015+7)*TAU*1.6,ax=Math.cos(air)*Rc*.018,ay=Math.sin(air)*Rc*.018;
  for(const inc of incs)for(let n=dt*rate;n>0;n--)if(fx()<n)smoke.push({x:inc.x+(fx()-.5)*2,y:inc.y+(fx()-.5)*2,vx:(fx()-.5)*Rc*.04,vy:(fx()-.5)*Rc*.04,r:.6,a:0,life:rr2(8,13),nz:fx()*100});
  const dk=draftK();
  for(let i=smoke.length-1;i>=0;i--){
    const s=smoke[i];s.a+=dt;
    const k=Rc*.03;s.vx+=((noise(s.nz+time*.3)-.5)*k+ax+(draft?draft.x*dk*Rc*.12:0)-s.vx)*Math.min(1,dt*1.5);
    s.vy+=((noise(s.nz+time*.3+40)-.5)*k+ay+(draft?draft.y*dk*Rc*.12:0)-s.vy)*Math.min(1,dt*1.5);
    s.x+=s.vx*dt;s.y+=s.vy*dt;s.r+=dt*Rc*.008;
    if(s.a>s.life)smoke.splice(i,1);
  }
  if(!motes.length)for(let k=0;k<26;k++)motes.push({x:rr2(-1.2,1.2),y:rr2(-1.2,1.2),ph:fx()*100,rt:rr2(.6,1.6)});
  for(const m of motes){m.x+=((noise(m.ph+time*.08)-.5)*.02+(draft?draft.x*dk*.03:0))*dt;m.y+=((noise(m.ph+time*.08+30)-.5)*.02+(draft?draft.y*dk*.03:0))*dt;if(m.x<-1.3)m.x=1.3;if(m.x>1.3)m.x=-1.3;if(m.y<-1.3)m.y=1.3;if(m.y>1.3)m.y=-1.3;}
}

/* ---------- update ---------- */
function update(dt){
  time+=dt;phaseT+=dt;
  ambient(dt);
  stepBuilder(4);
  if(phase==='rest'){if(phaseT>=mand.rest){setPhase('chalk');if(!replaying)N.log('A new mandala is marked out in chalk: '+mand.desc);}}
  else if(phase==='chalk'){chalkTo(phaseT);if(phaseT>=mand.chalkT){ensureBuilt();chalkTip=null;setPhase('sand');N.log('The first sand goes down at the centre');}}
  else if(phase==='sand')sandUpdate(dt);
  else if(phase==='hold'){if(phaseT>=HOLD)startDiss();}
  else if(phase==='diss'){dissTo(phaseT);if(phaseT>=diss.T)newMandala(false);}
  cosmetic(dt);
  N.stats(stats);
}

/* ---------- drawing the moving layer ---------- */
const rgba=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
function drawWater(){
  const x=bowl.x,y=bowl.y,r=bowl.r*.86;
  ctxB.save();ctxB.beginPath();ctxB.arc(x,y,r,0,TAU);ctxB.clip();
  if(tintA>.004){ctxB.fillStyle=rgba([tint[0]*.55,tint[1]*.55,tint[2]*.55],tintA);ctxB.fillRect(x-r,y-r,2*r,2*r);}
  for(const p of inWater){const k=1-p.age/p.life,q=PAL[p.c];ctxB.fillStyle=rgba([q[0]*.8,q[1]*.8,q[2]*.8],Math.min(1,k*1.4)*.85);ctxB.fillRect(x+Math.cos(p.a)*p.r,y+Math.sin(p.a)*p.r,1,1);}
  ctxB.lineWidth=1;
  for(const q of ripples){ctxB.strokeStyle=`rgba(190,215,225,${(1-q.age/q.life)*.22})`;ctxB.beginPath();ctxB.arc(q.x,q.y,q.r,0,TAU);ctxB.stroke();}
  // The lamps show in the water as small wavering lights.
  for(let k=0;k<lights.length;k++){const lp=lights[k],a=Math.atan2(lp.y-y,lp.x-x),f=flame(k),wob=Math.sin(time*2.3+k)*.6;ctxB.fillStyle=`rgba(255,214,150,${.35*f*lp.pw/.45})`;ctxB.fillRect(x+Math.cos(a)*r*.6+wob,y+Math.sin(a)*r*.6,2,1);}
  ctxB.restore();
}
function drawLamps(){
  ctxB.globalCompositeOperation='lighter';
  for(let k=0;k<lights.length;k++){const lp=lights[k],f=flame(k)*lp.pw/.45,R1=Rc*lp.rad*1.36,g=ctxB.createRadialGradient(lp.x,lp.y,0,lp.x,lp.y,R1);g.addColorStop(0,`rgba(255,160,70,${.16*f})`);g.addColorStop(.4,`rgba(255,140,60,${.05*f})`);g.addColorStop(1,'rgba(255,140,60,0)');ctxB.fillStyle=g;ctxB.fillRect(lp.x-R1,lp.y-R1,2*R1,2*R1);}
  ctxB.globalCompositeOperation='source-over';
  const dk=draftK();
  for(let k=0;k<lights.length;k++){
    const lp=lights[k],f=flame(k),s=Math.max(1,Rc*lp.s)*(.8+.3*f);
    const lx=(draft?draft.x*dk:0)*s*1.6+(noise(time*1.4+k*9)-.5)*s*.4,ly=(draft?draft.y*dk:0)*s*1.6+(noise(time*1.4+k*9+40)-.5)*s*.4;
    ctxB.fillStyle='rgba(255,110,40,.85)';ctxB.beginPath();ctxB.arc(lp.x+lx*1.2,lp.y+ly*1.2,s*1.5,0,TAU);ctxB.fill();
    ctxB.fillStyle='#ffc856';ctxB.beginPath();ctxB.arc(lp.x+lx*.7,lp.y+ly*.7,s,0,TAU);ctxB.fill();
    ctxB.fillStyle='#fff6dc';ctxB.beginPath();ctxB.arc(lp.x+lx*.3,lp.y+ly*.3,s*.55,0,TAU);ctxB.fill();
  }
  // The incense embers.
  incs.forEach((inc,k)=>{const e=.6+.4*noise(time*.8+k*13);ctxB.fillStyle=`rgba(255,${(90+60*e)|0},40,${.6+.4*e})`;ctxB.fillRect(Math.floor(inc.x),Math.floor(inc.y),1,1);});
}
function drawTips(){
  for(const p of falls){const k=p.a/p.life,q=PAL[p.c];ctxB.fillStyle=rgba([q[0]*1.1+20,q[1]*1.1+20,q[2]*1.1+20],(1-k*.6)*.9);ctxB.fillRect(Math.floor(p.x+p.ox*(1-k)),Math.floor(p.y+p.oy*(1-k)),1,1);}
  for(const w of workers)if(w.active&&w.tip>=0){
    const x=w.tip%cw,y=(w.tip/cw)|0;
    ctxB.fillStyle='rgba(255,246,220,.14)';ctxB.fillRect(x-1,y-1,3,3);
    ctxB.fillStyle=`rgba(255,250,236,${.78+.22*Math.sin(time*2.4+w.ang*3)})`;ctxB.fillRect(x,y,1,1);
  }
  if(chalkTip){const x=Math.floor(cx+chalkTip[0]*Rc),y=Math.floor(cy+chalkTip[1]*Rc);ctxB.fillStyle='rgba(240,236,224,.2)';ctxB.fillRect(x-1,y-1,3,3);ctxB.fillStyle='rgba(250,248,240,.95)';ctxB.fillRect(x,y,1,1);}
  if(diss&&diss.cutHead){const h=diss.cutHead,x=Math.floor(cx+Math.cos(h.a)*h.r*Rc),y=Math.floor(cy+Math.sin(h.a)*h.r*Rc);ctxB.fillStyle='rgba(255,248,230,.2)';ctxB.fillRect(x-1,y-1,3,3);ctxB.fillStyle='rgba(255,250,240,.9)';ctxB.fillRect(x,y,1,1);}
  for(const p of dusts){const k=1-p.a/p.life;ctxB.fillStyle=p.c?rgba(PAL[p.c],k*.8):`rgba(235,232,222,${k*.5})`;ctxB.fillRect(Math.floor(p.x),Math.floor(p.y),1,1);}
  if(diss&&diss.wipeAt!=null){
    const W=diss.wipe,v=diss.wipeAt;ctxB.fillStyle='rgba(255,240,215,.07)';
    if(W.dir<2)ctxB.fillRect(cx+v-(W.dir&1?-1:2),cy-bh,3,2*bh);else ctxB.fillRect(cx-bh,cy+v-(W.dir&1?-1:2),2*bh,3);
  }
}
function drawStream(){
  if(!streams.length)return;
  const x0=cx,y0=cy,x1=bowl.x,y1=bowl.y,dx=x1-x0,dy=y1-y0,d=Math.hypot(dx,dy),nx=-dy/d,ny=dx/d,bend=d*.18*(diss?diss.curve:1);
  for(const p of streams){
    const t=p.t,u=1-t,mx=(x0+x1)/2+nx*bend,my=(y0+y1)/2+ny*bend,ex=x1+p.lx,ey=y1+p.ly;
    const x=u*u*p.x0+2*u*t*mx+t*t*ex+nx*p.off*Math.sin(Math.PI*t),y=u*u*p.y0+2*u*t*my+t*t*ey+ny*p.off*Math.sin(Math.PI*t);
    const q=PAL[p.c];ctxB.fillStyle=rgba([q[0]*.95,q[1]*.95,q[2]*.95],.95);ctxB.fillRect(Math.floor(x),Math.floor(y),1,1);
  }
}
function drawMotes(){
  for(const m of motes){const a=(.12+.3*(.5+.5*Math.sin(time*m.rt+m.ph)))*(1-Math.min(1,Math.hypot(m.x,m.y)/1.3));if(a<.02)continue;ctxB.fillStyle=`rgba(255,238,205,${a})`;ctxB.fillRect(Math.floor(cx+m.x*Rc),Math.floor(cy+m.y*Rc),1,1);}
}
function drawMoth(){
  if(!moth)return;
  const m=moth,flying=m.state!=='rest',a=flying?Math.atan2(m.vy,m.vx)+Math.PI/2:0,flap=flying?Math.abs(Math.sin(time*30+m.nz)):0;
  const s=Math.max(1,Rc/120);
  for(const sh of[1,0]){
    ctxB.save();ctxB.translate(m.x+sh*(flying?3:1.5)*s,m.y+sh*(flying?4:2)*s);ctxB.rotate(a);ctxB.scale(s,s);
    ctxB.fillStyle=sh?'rgba(0,0,0,.35)':'#a8977c';
    const span=flying?1+flap*2.2:1.4;
    ctxB.fillRect(-span-.5,-1.5,span,2.6);ctxB.fillRect(.5,-1.5,span,2.6);
    if(!sh){ctxB.fillStyle='#5a4c3c';}
    ctxB.fillRect(-.5,-2,1,3.5);
    ctxB.restore();
  }
}
function drawSmoke(){
  for(const s of smoke){const k=s.a/s.life,al=.045*Math.min(1,s.a*.8)*(1-k);if(al<.004)continue;ctxB.fillStyle=`rgba(196,194,204,${al})`;ctxB.beginPath();ctxB.arc(s.x,s.y,s.r,0,TAU);ctxB.fill();}
}
function draw(){
  flush();
  ctxB.clearRect(0,0,cw,ch);
  drawWater();drawStream();drawTips();drawLamps();drawMotes();drawMoth();drawSmoke();
}

/* ---------- resize and replay ---------- */
// A new size means a new grid, so the current mandala is rebuilt at it and everything done so far is laid down again.
function rebuild(){
  const ocx=cx,ocy=cy,oR=Rc;
  layout();paintBase();
  // Things in the air keep their place relative to the board.
  const k=Rc/oR,mv=p=>{p.x=cx+(p.x-ocx)*k;p.y=cy+(p.y-ocy)*k;};
  for(const s of smoke){mv(s);s.r*=k;}
  for(const q of ripples){mv(q);q.r*=k;}
  if(moth){mv(moth);moth.vx*=k;moth.vy*=k;}
  falls.length=dusts.length=streams.length=0;
  if(mand){
    replaying=true;
    builder=null;B=null;
    const it=build(mand);while(!it.next().done);
    mand.ck=0;mand.cl=0;
    if(phase==='chalk')chalkTo(phaseT);else if(phase!=='rest')chalkTo(1e9);
    if(phase==='sand'||phase==='hold'||phase==='diss')for(let u=0;u<mand.units.length;u++){const U=mand.units[u];if(U.state===2||U.p>0)reveal(u,U.state===2?1:U.p,null);}
    if(phase==='diss'){const t=diss.t;resetDiss();for(let s=1/30;s<t;s+=1/30)dissTo(s);dissTo(t);}
    chalkTip=null;
    replaying=false;
  }
  repaint();draw();
}
let rzT=0;
addEventListener('resize',()=>{clearTimeout(rzT);rzT=setTimeout(rebuild,140);});

/* ---------- debugging ---------- */
function finish(){
  ensureBuilt();
  replaying=true;
  if(phase==='rest'||phase==='chalk'){mand.ck=0;mand.cl=0;chalkTo(1e9);chalkTip=null;}
  for(let u=0;u<mand.units.length;u++){const U=mand.units[u];if(U.state!==2){reveal(u,1,null);if(!U.state)mand.free[U.el-1]--;finishUnit(u);}}
  replaying=false;
  complete();
}
function state(){
  const D=mand;
  return{phase,phaseT:+phaseT.toFixed(2),time:+time.toFixed(1),
    place:{floor:PLACE.floor.type,lighting:PLACE.lighting,items:PLACE.items.map(it=>it.type)},
    design:{desc:D.desc,scheme:D.scheme,palace:D.palace,courts:D.courts,centre:D.centre,rings:D.rings,monks:D.monks,minutes:+(D.estT/60).toFixed(1),parts:D.els.length,sections:D.units.length},
    progress:{done:D.done,of:D.units.length,part:D.cur,workers:workers.map(w=>({ang:+w.ang.toFixed(2),section:w.u,wait:+w.wait.toFixed(2)}))},
    grid:{cw,ch,cell,Rc:+Rc.toFixed(1),patches:B?B.patches.length:0,built:!builder},
    stats:{...stats},moth:moth&&moth.state,draft:!!draft};
}

/* ---------- start ---------- */
layout();paintBase();
newMandala(true);ensureBuilt();
N.log(PLACE.desc);
// Reduced motion shows a finished mandala. Inside a frame, as a landing page preview or an embed, it starts partway through one.
if(N.RM||(N.DEBUG&&QS.has('done')))finish();
else if(window.top!==window.self){const t=mand.rest+mand.chalkT+rr(.3,.65)*mand.estT;for(let s=0;s<t&&phase!=='hold';s+=.5)update(.5);}
repaint();
if(N.DEBUG)window.MD={pause(){N.paused=true;},resume(){N.paused=false;},run(s){for(let t=0;t<s;t+=.05)update(.05);draw();},step(s){N.paused=true;for(let t=0;t<s;t+=1/60)update(Math.min(1/60,s-t));draw();},
  draw,state,fire,finish,skip(){if(phase!=='hold')finish();phaseT=HOLD;update(0);draw();},next(){clearBoard();newMandala(false);repaint();draw();}};
N.stats(stats);
N.run({update,draw,step:0});
})();
