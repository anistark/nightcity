/* One Sock. An unattended machine at 4am, under a seeded starry sky. */
(()=>{
'use strict';
const N=window.NightCity,{rr,ri,pick,expo,noise}=N;
const canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
const colors=['#ffe0a0','#8edce8','#c9a7ef','#f29382','#e1e78d','#81d4ba'];
const stats={flickers:0,cats:0,cars:0,meteors:0};
let time=0,cat=null,flicker=0,mist=0,rattle=0,slip=null,car=null,wind=0;
let surge=null,glint=null,buttons=null,vent=0,drops=[];
let meteor=null,skyHeight=0,roofHeight=0;
const skyCanvas=document.createElement('canvas'),skyContext=skyCanvas.getContext('2d');
const roadCanvas=document.createElement('canvas'),roadContext=roadCanvas.getContext('2d');
let width=0,height=0,scale=1,ox=0,oy=0,DPR=1;
const timers={},means={flicker:42,mist:70,rattle:95,slip:55,car:48,cat:120,breeze:38,surge:28,glint:21,buttons:17,drip:40,vent:60,meteor:75};
const labels=[];
let fontReady=false;
function text(c,s,x,y,col,size=1,align='left',maxWidth=0){
 // Render the actual font at display resolution, never stretch lettering cached at eight logical pixels.
 c.save();c.setTransform(DPR,0,0,DPR,0,0);
 let pixels=Math.max(8,Math.round(size*scale)*8);
 c.font=pixels+'px "Pixelspace"';
 while(maxWidth&&pixels>8&&c.measureText(s).width>maxWidth*scale){pixels-=8;c.font=pixels+'px "Pixelspace"';}
 c.fillStyle=col;c.textBaseline='top';c.textAlign=align;
 c.fillText(s,Math.round((x+ox)*scale),Math.round((y+oy)*scale));c.restore();
}
function label(...args){labels.push(args)}
function drawLabels(surface){if(fontReady)for(const [layer,...args] of labels)if(layer===surface)text(ctx,...args)}
function clockText(){return '04:00:'+String(Math.floor(time+1e-7)%60).padStart(2,'0')}
function drawClock(c){
 // Mount the wider seconds display over the cabinet so all digits remain visible in portrait.
 box(c,546,190,120,23,'#12262e');box(c,548,192,116,19,'#07191e');
 if(fontReady)text(c,clockText(),551,193,'#91c3ad',2);
}
function box(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
function line(c,x,y,x2,y2,col,w=1){c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(Math.round(x)+.5,Math.round(y)+.5);c.lineTo(Math.round(x2)+.5,Math.round(y2)+.5);c.stroke()}
function polygon(c,points,col){c.fillStyle=col;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill()}
function layer(){const c=document.createElement('canvas');c.width=1200;c.height=620;return[c,c.getContext('2d')]}
function sock(){const color=pick(colors),contrast=pick(colors.filter(c=>c!==color));return{color,cuff:contrast,heel:contrast,stripes:ri(0,2),length:ri(11,12),slouch:ri(0,1)}}
const stock=Array.from({length:6},sock);
const stars=Array.from({length:1100},()=>({x:rr(.005,.995),y:rr(.015,.985),size:ri(1,18)===1?2:1,
 color:pick(['#c0d9ec','#eee2c0','#88aaca','#ced5ef']),alpha:rr(.18,.8),glitter:true,phase:rr(0,4000),rate:rr(.5,1.2)}));
const roadGrain=Array.from({length:700},()=>({x:rr(0,1),y:rr(0,1),w:ri(1,3),alpha:rr(.035,.1)}));
// Stylized main-star patterns, not a date- or location-specific sky chart.
const constellations=[
 {name:'Orion',x:.22,y:.49,points:[[.12,0],[.8,.1],[.35,.5],[.48,.46],[.61,.42],[.26,1],[.95,.88]],
  names:['Betelgeuse','Bellatrix','Alnitak','Alnilam','Mintaka','Saiph','Rigel'],edges:[[0,1],[0,2],[1,4],[2,3],[3,4],[2,5],[4,6],[5,6]]},
 {name:'Cassiopeia',x:.51,y:.35,points:[[0,0],[.25,.65],[.5,.15],[.75,.8],[1,.25]],
  names:['Caph','Schedar','Navi','Ruchbah','Segin'],edges:[[0,1],[1,2],[2,3],[3,4]]},
 {name:'Ursa Major',x:.8,y:.56,points:[[0,.15],[.08,.62],[.4,.67],[.48,.22],[.66,.13],[.84,.2],[1,.38]],
  names:['Dubhe','Merak','Phecda','Megrez','Alioth','Mizar','Alkaid'],edges:[[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]]}
];
const lint=Array.from({length:24},()=>({x:rr(230,810),y:rr(409,490),phase:rr(0,100),w:ri(1,3)}));
const scrapes=Array.from({length:42},()=>({x:ri(552,648),y:ri(218,402),w:ri(1,3)}));
const reflections=Array.from({length:32},()=>({x:rr(540,675),y:rr(418,515),w:rr(3,14),a:rr(.02,.12)}));
for(const k in means)timers[k]=expo(means[k]);
function drawSock(c,s,x,y,size=1){
 if(!s)return;c.save();c.translate(x,y);c.scale(size,size);
 const l=s.length;
 // A dark stepped outline separates the L-shaped sock from its recessed display.
 polygon(c,[[3,0],[12,0],[12,l+3],[9,l+5],[-2,l+5],[-2,l],[3,l-3]],'#091b27');
 box(c,4+s.slouch,1,7,3,s.cuff);box(c,4,4,7,l-2,s.color);
 box(c,1,l-1,10,4,s.color);box(c,-1,l+1,6,3,s.color);
 box(c,8,l-2,3,3,s.heel);box(c,-1,l+1,3,3,s.cuff);
 for(let i=0;i<s.stripes;i++)box(c,4,5+i*3,7,1,s.cuff);
 box(c,5,4,1,Math.max(2,l-7),'#ffffff70');box(c,5,1,5,1,'#ffffff55');c.restore();
}
const [street,bg]=layer(),[shell,sg]=layer();
function cacheStreet(){
 const sky=bg.createLinearGradient(0,0,0,620);sky.addColorStop(0,'#080d19');sky.addColorStop(.55,'#121f2c');sky.addColorStop(1,'#0b1520');bg.fillStyle=sky;bg.fillRect(0,0,1200,620);
 box(bg,150,170,670,240,'#1b3038');box(bg,158,174,652,229,'#2a3d42');
 box(bg,158,174,652,3,'#495958');box(bg,809,174,11,229,'#1a2b34');
 // A restrained, aligned brick pattern leaves the cabinet and its signs as the focus.
 for(let y=220;y<402;y+=18){
 box(bg,160,y,648,1,'#31454a');
 for(let x=160+((y-220)%36?22:0);x<808;x+=44)box(bg,x,y+1,1,16,'#304349');
 }
 box(bg,207,222,275,181,'#152831');box(bg,213,228,263,175,'#425255');
 for(let y=232;y<399;y+=8){box(bg,217,y,255,1,'#5a6865');box(bg,217,y+2,255,2,'#34474b');}
 box(bg,335,229,2,173,'#263c41');box(bg,320,374,30,5,'#748079');box(bg,332,378,4,7,'#23383e');
 box(bg,296,235,97,18,'#1c3037');line(bg,299,237,390,237,'#52635f');
 label(bg,'CLOSED',345,240,'#b1beb0',1,'center',88);
 polygon(bg,[[191,190],[681,190],[704,210],[209,210]],'#39504c');
 for(let x=203;x<690;x+=26)polygon(bg,[[x,191],[x+12,191],[x+27,210],[x+15,210]],'#53635a');
 box(bg,208,210,495,6,'#192c31');for(let x=212;x<701;x+=13)box(bg,x,215,6,3,'#273b3d');
 box(bg,208,170,275,20,'#182d35');
 label(bg,'LAUNDROMAT',345,173,'#bcc7b5',2,'center',265);
 box(bg,737,214,8,190,'#152832');line(bg,739,215,739,400,'#38505a',2);
 box(bg,0,403,1200,20,'#475451');box(bg,0,407,1200,3,'#65706a');box(bg,0,422,1200,2,'#1c2e34');
 box(bg,0,424,1200,196,'#13232c');
 box(bg,708,410,42,7,'#101e26');for(let x=711;x<748;x+=5)line(bg,x,411,x+2,415,'#526261');
 // A plastic stool that has spent too many nights outside.
 polygon(bg,[[685,382],[705,382],[709,386],[683,386]],'#9a8562');box(bg,686,386,17,3,'#6f6855');box(bg,686,389,3,17,'#847d62');box(bg,701,389,3,17,'#847d62');
 box(bg,178,293,9,108,'#142933');box(bg,173,286,21,10,'#46554e');box(bg,177,289,14,3,'#b7a67a');
 const glow=bg.createRadialGradient(590,318,10,590,318,185);glow.addColorStop(0,'#a8d7c31a');glow.addColorStop(1,'#a8d7c300');bg.fillStyle=glow;bg.fillRect(400,155,390,370);
}
function cacheMachine(){
 polygon(sg,[[550,216],[652,216],[666,222],[666,401],[652,406],[550,406]],'#205a61');
 polygon(sg,[[652,217],[666,222],[666,401],[652,406]],'#163e49');
 box(sg,550,216,102,190,'#478990');box(sg,553,219,96,183,'#367c84');
 box(sg,555,222,91,36,'#152e38');box(sg,558,225,85,17,'#e4cd92');
 label(sg,'ONE SOCK',600.5,227,'#273e42',1.5,'center',85);label(sg,'NO PAIRS',600.5,247,'#d7c79c',1,'center',88);
 box(sg,572,262,70,88,'#152e36');box(sg,575,265,64,81,'#d2ba85');
 for(let row=0;row<3;row++)for(let col=0;col<2;col++){const x=576+col*31,y=266+row*26;box(sg,x,y,30,25,'#607b77');box(sg,x+1,y+1,28,21,'#142e38');box(sg,x+2,y+2,26,1,'#e6ca8d');box(sg,x+1,y+22,28,2,'#a28b64');}
 box(sg,556,267,11,64,'#234850');for(let i=0;i<3;i++){box(sg,558,278+i*17,7,5,'#f4cb7c');box(sg,559,279+i*17,4,1,'#fff0b2');}
 box(sg,555,339,14,18,'#24424a');box(sg,558,343,8,2,'#091c27');box(sg,560,347,3,4,'#8ba79a');
 box(sg,574,366,65,29,'#21444b');box(sg,577,369,59,23,'#0d222b');box(sg,579,390,56,2,'#7a9f91');
 label(sg,'1 SOCK',607,354,'#ded5af',1,'center',58);
 box(sg,556,398,89,3,'#22525b');box(sg,558,406,11,5,'#0b1a23');box(sg,639,406,11,5,'#0b1a23');
 for(const s of scrapes){if(s.x<554||s.x>645||s.y>396)box(sg,s.x,s.y,s.w,1,'#8aa59b66');}
 line(sg,551,217,650,217,'#a4c9b4');line(sg,651,220,651,403,'#203f4c');
 box(sg,553,221,1,175,'#7be0db');box(sg,647,223,1,172,'#5cb9b9');
 for(let y=361;y<389;y+=4)line(sg,656,y,662,y-2,'#0c2936');
 for(const [x,y] of [[554,219],[647,219],[554,398],[647,398]])box(sg,x,y,2,2,'#bdcbb5');
}
cacheStreet();cacheMachine();
// Font loading only enables native-resolution lettering. It never regenerates the scene.
function paintLabels(){fontReady=true;draw()}
if(document.fonts)document.fonts.load('16px "Pixelspace"').then(paintLabels).catch(paintLabels);
else fontReady=true;
function fire(kind){
 if(!(kind in means))return false;
 let started=true;
 if(kind==='flicker'){flicker=rr(.25,1.1);stats.flickers++;}
 if(kind==='mist')mist=rr(18,48);
 if(kind==='rattle')rattle=rr(.7,1.8);
 if(kind==='slip')slip={slot:ri(0,5),age:0,life:rr(4,9),amount:rr(1,3)};
 if(kind==='car'){if(car)started=false;else{car={age:0,life:rr(2,4),direction:rr(0,1)<.5?-1:1};stats.cars++;}}
 if(kind==='cat'){if(cat)started=false;else{cat={x:rr(760,850),age:0,state:'approach',speed:rr(8,13),pause:rr(8,18)};stats.cats++;N.log('A cat investigates the warm cabinet');}}
 if(kind==='breeze')wind=rr(4,10);
 if(kind==='surge')surge={age:0,life:rr(3,7),strength:rr(.12,.28)};
 if(kind==='glint')glint={age:0,life:rr(3,6)};
 if(kind==='buttons')buttons={age:0,life:rr(2,5),direction:pick([-1,1])};
 if(kind==='drip')drops=Array.from({length:ri(3,6)},()=>({x:rr(578,636),y:rr(268,300),speed:rr(.7,2),life:rr(12,24)}));
 if(kind==='vent')vent=rr(6,12);
 if(kind==='meteor'){
 if(meteor)started=false;
 else{meteor={age:0,life:rr(.8,1.4),x:rr(.15,.7),y:rr(.08,.38),dx:rr(.13,.26)*pick([-1,1]),dy:rr(.18,.36),tail:rr(.15,.3)};stats.meteors++;}
 }
 timers[kind]=time+expo(means[kind]);N.stats(stats);return started;
}
function update(dt){
 if(N.RM)return;
 time+=dt;
 if(meteor){meteor.age+=dt;if(meteor.age>=meteor.life)meteor=null;}
 for(const k in timers)if(time>=timers[k])fire(k);
 flicker=Math.max(0,flicker-dt);mist=Math.max(0,mist-dt);rattle=Math.max(0,rattle-dt);wind=Math.max(0,wind-dt);
 vent=Math.max(0,vent-dt);
 for(const effect of [surge,glint,buttons])if(effect)effect.age+=dt;
 if(surge&&surge.age>=surge.life)surge=null;
 if(glint&&glint.age>=glint.life)glint=null;
 if(buttons&&buttons.age>=buttons.life)buttons=null;
 for(const drop of drops){drop.y+=drop.speed*dt;drop.life-=dt;}
 drops=drops.filter(drop=>drop.life>0&&drop.y<345);
 if(slip){slip.age+=dt;if(slip.age>=slip.life)slip=null}
 if(car){car.age+=dt;if(car.age>=car.life)car=null}
 if(cat){
 cat.age+=dt;
 if(cat.state==='approach'){cat.x=Math.max(681,cat.x-cat.speed*dt);if(cat.x===681){cat.state='sit';cat.age=0}}
 else if(cat.state==='sit'&&cat.age>=cat.pause){cat.state='depart';cat.age=0}
 else if(cat.state==='depart'){cat.x+=cat.speed*dt;if(cat.x>860)cat=null}
 }
}
function drawCat(c){if(!cat)return;c.save();c.translate(cat.x,0);const x=0,y=411,walk=cat.state==='sit'?0:Math.sin(time*cat.speed)*2;
 box(c,x-3,y-9,14,7,'#b4a084');box(c,x-7,y-14,8,10,'#c6b092');polygon(c,[[x-7,y-12],[x-7,y-18],[x-3,y-14],[x,y-18],[x+1,y-12]],'#c6b092');box(c,x-6,y-11,1,1,'#1e3936');box(c,x-2,y-11,1,1,'#1e3936');line(c,x+10,y-6,x+16,y-12,'#b4a084',2);box(c,x,y-2+walk,3,3,'#99886f');box(c,x+8,y-2-walk,3,3,'#99886f');c.restore();}
function draw(){
 ctx.setTransform(1,0,0,1,0,0);box(ctx,0,0,canvas.width,canvas.height,'#080d19');
 ctx.save();ctx.scale(scale*DPR,scale*DPR);ctx.translate(ox,oy);
 // Extend the pavement beyond the cached art on taller overview screens.
 box(ctx,-ox,424,width,Math.max(0,height-oy-424),'#13232c');
 ctx.drawImage(street,0,0);
 if(width-ox>1200)ctx.drawImage(street,1199,0,1,620,1200,0,width-ox-1200,620);
 ctx.drawImage(roadCanvas,-ox,424);
 ctx.save();ctx.setTransform(DPR,0,0,DPR,0,0);drawSky();ctx.restore();
 drawLabels(bg);drawClock(ctx);
 if(car){const p=car.age/car.life,k=Math.sin(p*Math.PI);box(ctx,150,412,660,2,'#ddd2a4');ctx.globalAlpha=k*.16;polygon(ctx,[[car.direction>0?200:950,426],[500,320],[780,380],[680,450]],'#e6c895');ctx.globalAlpha=1;}
 for(const r of reflections)box(ctx,r.x,r.y,r.w,1,'rgba(149,192,170,'+r.a*(flicker>0?.3:1)+')');
 for(const l of lint){const drift=wind>0?noise(time*.2+l.phase)*wind:0;box(ctx,l.x+drift,l.y,l.w,1,'#80909055');}
 ctx.drawImage(shell,0,0);
 drawLabels(sg);
 const light=flicker>0&&Math.floor(time*19)%3===0?.35:1;
 ctx.globalAlpha=light;
 for(let i=0;i<6;i++){const shift=slip?.slot===i?Math.sin(slip.age/slip.life*Math.PI)*slip.amount:0;drawSock(ctx,stock[i],584+(i%2)*31,269+Math.floor(i/2)*26+shift);}
 ctx.globalAlpha=1;
 box(ctx,579,371,55,16,'#507571');
 if(mist>0){ctx.globalAlpha=Math.min(.16,mist*.01);box(ctx,574,264,65,83,'#c6dad0');ctx.globalAlpha=1;line(ctx,635,282,632,336,'#b7d2c655');}
 if(rattle>0)box(ctx,557+Math.round(Math.sin(time*50)),349,9,3,'#a1b8a2');
 if(light<1)box(ctx,554,222,91,128,'#07172266');
 drawMachineEffects();
 drawCat(ctx);
 ctx.restore();
}
function clipSky(c){
 const left=Math.max(0,Math.min(innerWidth,(150+ox)*scale));
 const right=Math.max(0,Math.min(innerWidth,(820+ox)*scale));
 c.beginPath();c.rect(0,0,innerWidth,roofHeight);
 c.rect(0,roofHeight,left,skyHeight-roofHeight);
 c.rect(right,roofHeight,innerWidth-right,skyHeight-roofHeight);c.clip();
}
function cacheSky(){
 skyHeight=Math.max(0,Math.min(innerHeight,(403+oy)*scale));
 roofHeight=Math.max(0,Math.min(skyHeight,(170+oy)*scale));
 skyCanvas.width=innerWidth;skyCanvas.height=Math.ceil(skyHeight);
 if(skyHeight<60)return;
 skyContext.save();clipSky(skyContext);
 for(const star of stars){skyContext.globalAlpha=star.alpha*(!N.RM?.12:1);box(skyContext,star.x*innerWidth,star.y*skyHeight,star.size,star.size,star.color);}
 skyContext.globalAlpha=1;
 if(roofHeight>=60)for(const group of constellations){
 const extent=Math.min(innerWidth*.17,roofHeight*.6),x=group.x*innerWidth-extent/2,y=group.y*roofHeight-extent/2;
 for(const [a,b] of group.edges){const p=group.points[a],q=group.points[b];line(skyContext,x+p[0]*extent,y+p[1]*extent,x+q[0]*extent,y+q[1]*extent,'#8aafca25');}
 for(let i=0;i<group.points.length;i++){
 const p=group.points[i],px=x+p[0]*extent,py=y+p[1]*extent;
 box(skyContext,px-1,py-1,4,4,'#b6d7f01c');
 box(skyContext,px,py,2,2,group.names[i]==='Betelgeuse'?'#ffc293':'#deefff');
 }
 }
 skyContext.restore();
}
function drawSky(){
 if(skyHeight<60)return;
 ctx.drawImage(skyCanvas,0,0);
 if(!N.RM){
 ctx.save();clipSky(ctx);
 for(const star of stars)if(star.glitter){
 const shimmer=.5+.5*Math.sin(time*star.rate*3+star.phase);
 const glow=shimmer*(.7+.3*noise(star.phase+time*.3)),x=star.x*innerWidth,y=star.y*skyHeight;
 ctx.globalAlpha=star.alpha*(.18+.82*glow);
 box(ctx,x,y,star.size,star.size,star.color);
 if(star.alpha>.55&&glow>.62){
 const arm=star.size===2?2:1;
 ctx.globalAlpha=(glow-.62)*1.3;
 box(ctx,x-arm,y,arm*2+1,1,'#e0f3ff');box(ctx,x,y-arm,1,arm*2+1,'#e0f3ff');
 }
 }
 ctx.restore();
 }
 if(!meteor||N.RM)return;
 const p=meteor.age/meteor.life,fade=Math.sin(p*Math.PI),x=meteor.x+meteor.dx*p,y=meteor.y+meteor.dy*p;
 ctx.save();clipSky(ctx);
 for(let i=12;i>0;i--){
 const back=meteor.tail*i/12;
 ctx.globalAlpha=fade*(1-i/13)*.8;
 line(ctx,(x-meteor.dx*back)*innerWidth,(y-meteor.dy*back)*roofHeight,
  (x-meteor.dx*(back-meteor.tail/12))*innerWidth,(y-meteor.dy*(back-meteor.tail/12))*roofHeight,'#b2e4ff');
 }
 ctx.globalAlpha=fade;box(ctx,x*innerWidth,y*roofHeight,2,2,'#f3fbff');ctx.restore();
}
function cacheRoad(){
 roadCanvas.width=Math.ceil(width);roadCanvas.height=Math.max(1,Math.ceil(height-oy-424));
 const shade=roadContext.createLinearGradient(0,0,0,roadCanvas.height);
 shade.addColorStop(0,'#15262e');shade.addColorStop(1,'#111f28');
 roadContext.fillStyle=shade;roadContext.fillRect(0,0,roadCanvas.width,roadCanvas.height);
 for(const grain of roadGrain){roadContext.globalAlpha=grain.alpha;box(roadContext,grain.x*roadCanvas.width,grain.y*roadCanvas.height,grain.w,1,'#829b9f');}
 roadContext.globalAlpha=1;
}
function drawMachineEffects(){
 if(surge){
 const a=Math.sin(surge.age/surge.life*Math.PI)*surge.strength;
 ctx.globalAlpha=a;box(ctx,553,220,96,182,'#95fff0');
 polygon(ctx,[[553,414],[650,414],[690,461],[518,461]],'#81d8c4');ctx.globalAlpha=1;
 }
 if(glint){
 const x=563+glint.age/glint.life*90;
 ctx.save();ctx.beginPath();ctx.rect(575,265,64,81);ctx.clip();
 ctx.globalAlpha=.16*Math.sin(glint.age/glint.life*Math.PI);
 polygon(ctx,[[x,265],[x+5,265],[x-15,346],[x-20,346]],'#d6fff5');ctx.restore();
 }
 if(buttons){
 const index=Math.floor(buttons.age*2)%3,selected=buttons.direction>0?index:2-index;
 box(ctx,557,277+selected*17,9,7,'#ffc968');box(ctx,559,279+selected*17,5,2,'#fff7c7');
 }
 for(const drop of drops){box(ctx,drop.x,drop.y,1,3,'#addfd399');box(ctx,drop.x,drop.y+3,2,1,'#defff0bb');}
 if(vent>0){
 ctx.globalAlpha=Math.min(.14,vent*.03);
 for(let i=0;i<3;i++){const rise=(time*5+i*9)%26,x=663+noise(time*.4+i)*3;line(ctx,x,359-rise,x+2,353-rise,'#c5ece1');}
 ctx.globalAlpha=1;
 }
}
function resize(){
 // One logical pixel always occupies a whole number of CSS pixels.
 const closeUp=innerWidth<768;
 scale=Math.max(1,Math.floor(closeUp?Math.min(innerHeight/250,innerWidth/124):Math.min(innerHeight/440,innerWidth/720)));
 width=innerWidth/scale;height=innerHeight/scale;DPR=Math.min(2,window.devicePixelRatio||1);
 canvas.width=Math.round(innerWidth*DPR);canvas.height=Math.round(innerHeight*DPR);
 canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';
 // Desktop includes the whole storefront and sky. Portrait keeps the cabinet close-up.
 ox=closeUp?Math.round(width/2-608):Math.min(0,Math.round(width/2-485));
 oy=closeUp?Math.round(height*.52-301):Math.max(0,Math.round(height*.52-265));
 ctx.imageSmoothingEnabled=false;cacheSky();cacheRoad();draw();
}
function state(){return JSON.parse(JSON.stringify({coordinates:'Logical pixels, x right and y down. Machine front x 550-652, pavement y 414. Stars and meteors use normalized sky coordinates.',time,clock:clockText(),stats,stock,cat,stars,constellations,meteor,timers,flicker,mist,rattle,slip,car,wind,surge,glint,buttons,drops,vent}))}
function step(seconds){if(!Number.isFinite(seconds)||seconds<0||seconds>3600)throw new Error('Step must be between 0 and 3600 seconds');for(let left=seconds;left>1e-8;left-=1/60)update(Math.min(left,1/60));draw()}
if(N.DEBUG){window.OS={pause(){N.paused=true},run(){N.paused=false},step,draw,state,fire};window.render_game_to_text=()=>JSON.stringify(state());window.advanceTime=ms=>{N.paused=true;step(ms/1000)};}
addEventListener('resize',resize);resize();N.stats(stats);N.log('The laundromat clock reads 04:00');
N.run({update,draw,step:1/60});
})();
