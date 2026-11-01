/* Shared articulated people, extracted from Half Court. No randomness is consumed here. */
(()=>{
'use strict';
const hyp=Math.hypot,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,u)=>a+(b-a)*u;
function ik2(a,b,l1,l2,bend){
  const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L=Math.max(1e-4,hyp(d[0],d[1],d[2]));
  const u=[d[0]/L,d[1]/L,d[2]/L],dl=Math.min(L,(l1+l2)*.999);
  const x=(l1*l1-l2*l2+dl*dl)/(2*dl),y=Math.sqrt(Math.max(0,l1*l1-x*x));
  const bd=bend[0]*u[0]+bend[1]*u[1]+bend[2]*u[2],v=[bend[0]-u[0]*bd,bend[1]-u[1]*bd,bend[2]-u[2]*bd],vl=hyp(v[0],v[1],v[2])||1;
  return[a[0]+u[0]*x+v[0]/vl*y,a[1]+u[1]*x+v[1]/vl*y,a[2]+u[2]*x+v[2]/vl*y];
}
function limbsOf(p,P){
  const fx=Math.cos(p.face),fz=Math.sin(p.face),wx=-fz,wz=fx,Hh=p.hgt;
  const thigh=Hh*.26,shin=Hh*.26,upper=Hh*.17,fore=Hh*.16;
  const kneeBend=p.sit?[fx,fz,.6]:p.air?[fx,fz,.5]:[fx,fz,.12];
  P.hipJ=P.feet.map((f,i)=>{const s=i?-1:1;return[P.hip[0]+wx*s*.1,P.hip[1]+wz*s*.1,P.hip[2]-.05];});
  P.knees=P.feet.map((f,i)=>ik2(P.hipJ[i],f,thigh,shin,kneeBend));
  const shJ=P.hands.map(h=>{const s=((h[0]-P.sh[0])*wx+(h[1]-P.sh[1])*wz)>=0?1:-1;return[P.sh[0]+wx*s*.19,P.sh[1]+wz*s*.19,P.sh[2]-.04,s];});
  P.elb=P.hands.map((h,i)=>{const s=shJ[i][3];return ik2(shJ[i],h,upper,fore,[wx*s*.55-fx*.55,wz*s*.55-fz*.55,-.45]);});
  P.shJ=shJ.map(v=>[v[0],v[1],v[2]]);
  return P;
}
const EASE={hip:22,sh:16,head:14,hands:18};
function easePose(p,raw,dt){
  const ox_=p.x,oz_=p.z,oh=p.j;p.ease=p.ease||{};
  const out={};
  for(const key in raw){
    const v=raw[key];if(!EASE[key]){out[key]=v;continue;}
    const multi=Array.isArray(v[0]),list=multi?v:[v],prev=p.ease[key],a=1-Math.exp(-dt*EASE[key]);
    const rel=list.map((pt,i)=>{const r=[pt[0]-ox_,pt[1]-oz_,pt[2]-oh],q=prev&&prev[i];
      if(!q||hyp(q[0]-r[0],q[1]-r[1],q[2]-r[2])>1.2)return r;return[lerp(q[0],r[0],a),lerp(q[1],r[1],a),lerp(q[2],r[2],a)];});
    p.ease[key]=rel;
    const abs=rel.map(r=>[r[0]+ox_,r[1]+oz_,r[2]+oh]);
    out[key]=multi?abs:abs[0];
  }
  return out;
}
function renderer(environment){
let ctx,k,t,P2;
function shade(c,f){const n=parseInt(c.slice(1),16);return '#'+[(n>>16)&255,(n>>8)&255,n&255].map(x=>Math.max(0,Math.min(255,Math.round(f<0?x*(1+f):x+(255-x)*f))).toString(16).padStart(2,'0')).join('')}
function line(a,b,w,col){ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke()}
function glowLine(a,b,w,col,blur){ctx.save();ctx.shadowColor=col;ctx.shadowBlur=blur;line(a,b,w,col);ctx.restore()}
const off=(p,v,s)=>[p[0]+v[0]*s,p[1]+v[1]*s];
function drawPerson(p){
  const P=p.pose,L=p.look;if(!P)return;
  const fx=Math.cos(p.face),fz=Math.sin(p.face),wx=-fz,wz=fx;   // facing and the body's side, in world space
  const side=[(wx-wz)*k,(wx+wz)*k*.5],sl=hyp(side[0],side[1])||1,sv=[side[0]/sl,side[1]/sl];
  const toCam=Math.cos(p.face-Math.PI/4);              // 1 when facing the viewer, -1 when facing away
  const faceDir=[(fx-fz),(fx+fz)*.5];
  const W3=(b,s,d,f,up)=>[b[0]+wx*s*d+fx*(f||0),b[1]+wz*s*d+fz*(f||0),b[2]+(up||0)];
  const head=P2(P.head);
  const depth=v=>v[0]+v[1];
  const fo=depth(P.feet[0])<depth(P.feet[1])?[0,1]:[1,0];
  const ao=depth(P.hands[0])<depth(P.hands[1])?[0,1]:[1,0];
  const mix=(a,b,u)=>[lerp(a[0],b[0],u),lerp(a[1],b[1],u)];
  ctx.lineCap='round';ctx.lineJoin='round';
  const legW=.15*k,armW=.1*k,c=p.cr||0;
  const sleeved=L.top==='hoodie'||L.top==='jacket';
  const leg=(i,far)=>{
    const ft=P.feet[i],s=i?-1:1,A=P2(P.hipJ[i]),K=P2(P.knees[i]),F=P2(ft);
    const dk=col=>far?shade(col,-.4):col;
    if(L.bottom==='shorts'){
      line(A,K,legW*.82,dk(L.skin));line(K,F,legW*.74,dk(L.skin));
      line(mix(F,K,.3),F,legW*.78,dk(L.socks));
      line(A,mix(A,K,.82),legW*1.2,dk(L.botCol));
      if(!far){ctx.globalAlpha=.18;line(off(K,sv,s*legW*.2),off(mix(K,F,.6),sv,s*legW*.2),legW*.2,'#fff');ctx.globalAlpha=1;}
    }else{
      line(A,K,legW,dk(L.botCol));line(K,F,legW*.82,dk(L.botCol));
      if(!far){ctx.globalAlpha=.2;line(off(A,sv,s*legW*.22),off(K,sv,s*legW*.22),legW*.22,'#fff');ctx.globalAlpha=1;}
      crease(A,K,F,legW,far);
    }
    // Shoe, pointing the way the player faces.
    const fl=Math.hypot(faceDir[0],faceDir[1])||1,fd=[faceDir[0]/fl,faceDir[1]/fl];
    ctx.save();ctx.translate(F[0]+fd[0]*.05*k,F[1]+fd[1]*.05*k);ctx.rotate(Math.atan2(fd[1],fd[0]));
    ctx.fillStyle=dk(L.shoes);ctx.beginPath();ctx.ellipse(0,0,.15*k,.065*k,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=L.sole;ctx.fillRect(-.15*k,.03*k,.3*k,.03*k);
    if(L.trim){ctx.fillStyle=L.trim[0];ctx.globalAlpha=.9;ctx.fillRect(-.06*k,-.03*k,.08*k,.025*k);ctx.globalAlpha=1;}
    ctx.restore();
  };
  const arm=(i,far)=>{
    const hd=P.hands[i],S=P2(P.shJ[i]),E2=P2(P.elb[i]),Hd=P2(hd);
    const dk=col=>far?shade(col,-.3):col;
    if(sleeved){
      line(S,E2,armW*1.2,dk(L.topCol));line(E2,Hd,armW,dk(L.topCol));
      crease(S,E2,Hd,armW,far);
      if(L.trim&&!far)glowLine(S,E2,.016*k,L.trim[1],.1*k);
    }else{
      line(S,E2,armW*1.02,dk(L.skin));line(E2,Hd,armW*.9,dk(L.skin));
      if(L.top==='tee')line(S,mix(S,E2,.55),armW*1.4,dk(L.topCol));
    }
    ctx.fillStyle=dk(L.skin);ctx.beginPath();ctx.arc(Hd[0],Hd[1],.055*k,0,Math.PI*2);ctx.fill();
  };
  leg(fo[0],true);arm(ao[0],true);
  // A hood worn down bunches up behind the neck.
  const neckP=P2([P.sh[0],P.sh[1],P.sh[2]+.02]);
  if(L.hood==='down'){const b=P2([P.sh[0]-fx*.1,P.sh[1]-fz*.1,P.sh[2]+.06]);ctx.fillStyle=shade(L.topCol,-.15);ctx.beginPath();ctx.ellipse(b[0],b[1],.17*k,.1*k,0,0,Math.PI*2);ctx.fill();}
  // Torso: broad at the shoulders, tapering to the waist. A jacket or hoodie hangs below the hips and trails when running.
  const shoW=L.top==='tank'?.17:.24;
  const sR=P2(W3(P.sh,1,.19,0,-.04)),sLft=P2(W3(P.sh,-1,.19,0,-.04)),sR2=P2(W3(P.sh,1,shoW,0,-.12)),sL2=P2(W3(P.sh,-1,shoW,0,-.12));
  const wR=P2(W3(P.hip,1,.16,0,.16)),wL=P2(W3(P.hip,-1,.16,0,.16));
  const long=sleeved?1:0;
  const trail=s=>{const q=W3(P.hip,s,.17+.02*long*Math.sin(t*9+s),0,(long?-.1:-.03)+long*Math.min(.06,hyp(p.vx,p.vz)*.012));return P2([q[0]-p.vx*.035*long,q[1]-p.vz*.035*long,q[2]]);};
  const hR=trail(1),hL=trail(-1);
  if(!sleeved){
    // Bare shoulders and neck under a tank or tee.
    ctx.fillStyle=shade(L.skin,-.1);ctx.beginPath();ctx.ellipse(neckP[0],neckP[1]+.02*k,.2*k,.07*k,0,0,Math.PI*2);ctx.fill();
    line(neckP,[lerp(neckP[0],head[0],.6),lerp(neckP[1],head[1],.6)],.09*k,L.skin);
  }
  const tg=ctx.createLinearGradient(neckP[0],neckP[1],(hR[0]+hL[0])/2,(hR[1]+hL[1])/2);tg.addColorStop(0,shade(L.topCol,.2));tg.addColorStop(1,shade(L.topCol,-.28));
  ctx.fillStyle=tg;ctx.beginPath();
  if(L.top==='tank'){const nR=mix(sR,neckP,.45),nL=mix(sLft,neckP,.45);ctx.moveTo(sR[0],sR[1]);ctx.lineTo(nR[0],nR[1]);ctx.quadraticCurveTo(neckP[0],neckP[1]+.08*k,nL[0],nL[1]);ctx.lineTo(sLft[0],sLft[1]);}
  else{ctx.moveTo(sR[0],sR[1]);ctx.quadraticCurveTo(neckP[0],neckP[1]-(sleeved?.04:-.03)*k,sLft[0],sLft[1]);}
  ctx.quadraticCurveTo(sL2[0],sL2[1]-.03*k,sL2[0],sL2[1]);ctx.lineTo(wL[0],wL[1]);ctx.lineTo(hL[0],hL[1]);
  ctx.lineTo(hR[0],hR[1]);ctx.lineTo(wR[0],wR[1]);ctx.lineTo(sR2[0],sR2[1]);ctx.quadraticCurveTo(sR2[0],sR2[1]-.03*k,sR[0],sR[1]);ctx.closePath();ctx.fill();
  // Folds: creases from the armpits toward the waist and across it, deeper as the body bends or twists.
  {const fold=clamp(.25+c*.9+hyp(p.vx,p.vz)*.06,0,1),w=mix(wR,wL,.5);
   ctx.globalAlpha=.3*fold;ctx.lineWidth=.014*k;ctx.strokeStyle='#000';ctx.beginPath();
   for(const[a,u]of[[sR2,.35],[sL2,.65]]){ctx.moveTo(a[0],a[1]);ctx.quadraticCurveTo(lerp(a[0],w[0],.5),lerp(a[1],w[1],.5)+.04*k,lerp(wR[0],wL[0],u),lerp(wR[1],wL[1],u));}
   ctx.moveTo(wR[0],wR[1]);ctx.quadraticCurveTo(w[0],w[1]+.05*k*fold,wL[0],wL[1]);ctx.stroke();ctx.globalAlpha=1;}
  // Light from above-left catches one edge.
  const lit=sv[0]<0?1:-1;ctx.globalAlpha=.16;line(lit>0?sR2:sL2,lit>0?wR:wL,.035*k,'#fff');ctx.globalAlpha=1;
  if(L.trim){
    if(sleeved){
      glowLine(mix(sR,sLft,.25),mix(hR,hL,.3),.022*k,L.trim[0],.14*k);
      glowLine(mix(sR,sLft,.8),mix(hR,hL,.72),.018*k,L.trim[1],.12*k);
      if(toCam>-.2){ctx.globalAlpha=.6;line(mix(sR,sLft,.5),mix(hR,hL,.5),.012*k,'#000');ctx.globalAlpha=1;}
    }else{
      // Piping round the neckline and down the sides.
      ctx.save();ctx.shadowColor=L.trim[0];ctx.shadowBlur=.08*k;ctx.strokeStyle=L.trim[0];ctx.lineWidth=.014*k;
      ctx.beginPath();ctx.moveTo(mix(sR,neckP,.45)[0],mix(sR,neckP,.45)[1]);ctx.quadraticCurveTo(neckP[0],neckP[1]+.08*k,mix(sLft,neckP,.45)[0],mix(sLft,neckP,.45)[1]);
      ctx.moveTo(sR2[0],sR2[1]);ctx.lineTo(hR[0],hR[1]);ctx.moveTo(sL2[0],sL2[1]);ctx.lineTo(hL[0],hL[1]);ctx.stroke();ctx.restore();
    }
  }
  // Jersey number, on the chest or the back.
  if(L.number){const m=mix(neckP,mix(wR,wL,.5),.5);ctx.save();ctx.font=`800 ${Math.max(6,Math.round(.17*k))}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=L.numCol;ctx.globalAlpha=Math.abs(toCam)>.15?.95:.6;ctx.fillText(L.number,m[0],m[1]);ctx.restore();}
  // Scarf, or a high collar, wrapped at the neck.
  if(L.neck){const n=[(neckP[0]*2+head[0])/3,(neckP[1]*2+head[1])/3];ctx.fillStyle=L.top==='jacket'?shade(L.topCol,-.1):L.neck;ctx.beginPath();ctx.ellipse(n[0],n[1],.13*k,(L.top==='jacket'?.09:.07)*k,0,0,Math.PI*2);ctx.fill();}
  leg(fo[1],false);
  drawHead(p,head,sv,toCam,faceDir);
  arm(ao[1],false);
}
// A fold of fabric at a bent knee or elbow: a short dark crease across the inside of the bend.
function crease(a,m,b,w,far){
  const u=[a[0]-m[0],a[1]-m[1]],v=[b[0]-m[0],b[1]-m[1]],ul=hyp(u[0],u[1])||1,vl=hyp(v[0],v[1])||1;
  const bend=1-Math.abs((u[0]*v[0]+u[1]*v[1])/(ul*vl)+1);   // 0 when straight
  if(bend<.08)return;
  const bis=[u[0]/ul+v[0]/vl,u[1]/ul+v[1]/vl],bl=hyp(bis[0],bis[1])||1,n=[-bis[1]/bl,bis[0]/bl];
  ctx.globalAlpha=Math.min(.55,bend*.9)*(far?.6:1);ctx.strokeStyle='#000';ctx.lineWidth=Math.max(.8,w*.12);
  ctx.beginPath();for(const o of[-.15,.15]){const c0=[m[0]+bis[0]/bl*w*.3+n[0]*w*o,m[1]+bis[1]/bl*w*.3+n[1]*w*o];ctx.moveTo(c0[0]-n[0]*w*.25,c0[1]-n[1]*w*.25);ctx.lineTo(c0[0]+n[0]*w*.25,c0[1]+n[1]*w*.25);}
  ctx.stroke();ctx.globalAlpha=1;
}
function drawHead(p,head,sv,toCam,faceDir){
  const L=p.look,r=.12*k,up=L.hood==='up';
  const fl=Math.hypot(faceDir[0],faceDir[1])||1,fd=[faceDir[0]/fl,faceDir[1]/fl];
  const fc=[head[0]+fd[0]*r*.35*Math.max(0,toCam),head[1]+fd[1]*r*.2];
  const hair=L.hairCol;
  if(up){
    // Hood: a peaked shell around the head, open toward the face. Its peak sways back with speed.
    const peak=[head[0]-fd[0]*r*.5-(p.vx-p.vz)*k*.012,head[1]-r*1.9-(p.vx+p.vz)*k*.006];
    const hg=ctx.createLinearGradient(head[0],peak[1],head[0],head[1]+r);hg.addColorStop(0,shade(L.topCol,.22));hg.addColorStop(1,shade(L.topCol,-.2));
    ctx.fillStyle=hg;ctx.beginPath();
    ctx.moveTo(head[0]+sv[0]*r*1.35,head[1]+r*1.05);
    ctx.quadraticCurveTo(head[0]+sv[0]*r*1.6,head[1]-r*.6,peak[0],peak[1]);
    ctx.quadraticCurveTo(head[0]-sv[0]*r*1.6,head[1]-r*.6,head[0]-sv[0]*r*1.35,head[1]+r*1.05);
    ctx.closePath();ctx.fill();
    if(L.trim){ctx.save();ctx.shadowColor=L.trim[0];ctx.shadowBlur=.1*k;ctx.strokeStyle=L.trim[0];ctx.lineWidth=.016*k;ctx.beginPath();ctx.moveTo(peak[0],peak[1]+r*.25);ctx.lineTo(head[0]-fd[0]*r*.2+sv[0]*r*.35,head[1]-r*.4);ctx.stroke();ctx.restore();}
  }else if(L.hairdo==='long'){
    // Long hair falls behind the head to the shoulders.
    ctx.fillStyle=shade(hair,-.1);ctx.beginPath();ctx.ellipse(head[0]-fd[0]*r*.3,head[1]+r*.5,r*.95,r*1.2,0,0,Math.PI*2);ctx.fill();
  }
  if(toCam>-.25){
    // Face, shaded on the side away from the light, darker up under a hood.
    const fw=r*(.55+.35*Math.max(0,toCam)),fh=r*.95;
    const sg=ctx.createLinearGradient(fc[0]-fw,fc[1],fc[0]+fw,fc[1]);sg.addColorStop(0,shade(L.skin,.08));sg.addColorStop(1,shade(L.skin,-.35));
    ctx.fillStyle=sg;ctx.beginPath();ctx.ellipse(fc[0],fc[1]+r*.1,fw,fh,0,0,Math.PI*2);ctx.fill();
    if(up){
      const dg=ctx.createLinearGradient(0,fc[1]-fh,0,fc[1]+fh*.2);dg.addColorStop(0,'rgba(0,0,0,.6)');dg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=dg;ctx.beginPath();ctx.ellipse(fc[0],fc[1]+r*.1,fw,fh,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=hair;ctx.lineWidth=.02*k;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(fc[0]+i*fw*.3,fc[1]-fh*.7);ctx.lineTo(fc[0]+i*fw*.35+fd[0]*r*.1,fc[1]-fh*.25);ctx.stroke();}
    }else drawHair(L,head,r,fd,true);
    if(L.shades&&toCam>0){
      // Shades with the neon city reflected in them.
      const ey=fc[1]-r*.05,ew=fw*.95,eh=r*(L.shades==='wrap'?.24:.3);
      const a0=L.trim?L.trim[0]:'#38c8ff',a1=L.trim?L.trim[1]:'#ffcf7a';
      const lg=ctx.createLinearGradient(fc[0]-ew,ey-eh,fc[0]+ew,ey+eh);lg.addColorStop(0,a0);lg.addColorStop(.5,'#0a0a14');lg.addColorStop(1,a1);
      ctx.fillStyle=lg;
      if(L.shades==='wrap'){ctx.beginPath();ctx.ellipse(fc[0],ey,ew,eh,0,0,Math.PI*2);ctx.fill();}
      else{for(const s of[-1,1]){ctx.beginPath();ctx.ellipse(fc[0]+s*ew*.48,ey,ew*.45,eh,0,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='#0a0a12';ctx.lineWidth=.012*k;ctx.beginPath();ctx.moveTo(fc[0]-ew*.1,ey-eh*.3);ctx.lineTo(fc[0]+ew*.1,ey-eh*.3);ctx.stroke();}
      ctx.fillStyle='rgba(255,255,255,.75)';ctx.fillRect(fc[0]-ew*.6,ey-eh*.55,ew*.25,eh*.25);
    }else if(toCam>.2){
      // Eyes, when there are no shades.
      ctx.fillStyle='#120c10';for(const s of[-1,1]){ctx.beginPath();ctx.ellipse(fc[0]+s*fw*.38,fc[1]-r*.02,r*.07,r*.05,0,0,Math.PI*2);ctx.fill();}
    }
    if(toCam>.1){
      if(L.beard==='goatee'){ctx.fillStyle=hair;ctx.beginPath();ctx.ellipse(fc[0],fc[1]+r*.72,fw*.28,r*.18,0,0,Math.PI*2);ctx.fill();ctx.fillRect(fc[0]-fw*.35,fc[1]+r*.38,fw*.7,r*.06);}
      else if(L.beard==='full'){ctx.fillStyle=hair;ctx.globalAlpha=.85;ctx.beginPath();ctx.ellipse(fc[0],fc[1]+r*.6,fw*.9,r*.45,0,0,Math.PI);ctx.fill();ctx.globalAlpha=1;}
      ctx.strokeStyle=shade(L.skin,-.55);ctx.lineWidth=.012*k;ctx.beginPath();ctx.arc(fc[0],fc[1]+r*.3,fw*.28,.25*Math.PI,.75*Math.PI);ctx.stroke();
    }
  }else if(!up){
    // The back of the head.
    if(L.hairdo==='buzz'||L.hairdo==='fade'){ctx.fillStyle=L.skin;ctx.beginPath();ctx.arc(head[0],head[1],r,0,Math.PI*2);ctx.fill();}
    drawHair(L,head,r,fd,false);
  }else if(L.trim){glowLine([head[0],head[1]-r*1.3],[head[0],head[1]+r*.6],.016*k,L.trim[1],.1*k);}
  if(!up&&L.headwear)drawHeadwear(L,head,r,fd,toCam);
}
function drawHair(L,head,r,fd,front){
  const c=L.hairCol;ctx.fillStyle=c;
  const top=(rx,ry,dy)=>{ctx.beginPath();ctx.ellipse(head[0],head[1]-r*(dy||.35),r*rx,r*ry,0,Math.PI,2*Math.PI);ctx.fill();};
  if(!front&&L.hairdo!=='buzz'&&L.hairdo!=='fade'){ctx.beginPath();ctx.arc(head[0],head[1],r*1.02,0,Math.PI*2);ctx.fill();}
  switch(L.hairdo){
    case 'buzz':ctx.globalAlpha=.85;top(1,.6,.3);ctx.globalAlpha=1;break;
    case 'fade':top(1,.75,.38);ctx.fillStyle=shade(c,.25);ctx.globalAlpha=.5;top(1.04,.45,.15);ctx.globalAlpha=1;break;
    case 'curly':for(let i=-2;i<=2;i++){ctx.beginPath();ctx.arc(head[0]+i*r*.42,head[1]-r*(.55+.15*(2-Math.abs(i))*.5),r*.38,0,Math.PI*2);ctx.fill();}break;
    case 'bun':top(1.03,.78);ctx.beginPath();ctx.arc(head[0]-fd[0]*r*.4,head[1]-r*1.1,r*.32,0,Math.PI*2);ctx.fill();break;
    default:top(1.04,.82);
  }
}
function drawHeadwear(L,head,r,fd,toCam){
  if(L.headwear==='headband'){
    ctx.save();ctx.strokeStyle=L.trim?L.trim[0]:'#e8ecff';ctx.lineWidth=r*.28;if(L.trim){ctx.shadowColor=L.trim[0];ctx.shadowBlur=.06*k;}
    ctx.beginPath();ctx.ellipse(head[0],head[1]-r*.45,r*1.02,r*.32,0,Math.PI*.05,Math.PI*.95,true);ctx.stroke();ctx.restore();
    return;
  }
  // Cap: a dome over the head and a brim, worn forward or backward.
  const col=L.trim&&!L.white?L.topCol:L.topCol,b=L.capBack?-1:1;
  ctx.fillStyle=shade(col,.05);ctx.beginPath();ctx.ellipse(head[0],head[1]-r*.4,r*1.08,r*.85,0,Math.PI,2*Math.PI);ctx.fill();
  ctx.fillStyle=shade(col,-.3);ctx.beginPath();ctx.ellipse(head[0]+fd[0]*r*.75*b,head[1]-r*.38+fd[1]*r*.3*b,r*.75,r*.22,Math.atan2(fd[1],fd[0])*.3,0,Math.PI*2);ctx.fill();
  if(L.trim){ctx.fillStyle=L.trim[0];ctx.beginPath();ctx.arc(head[0],head[1]-r*1.2,r*.12,0,Math.PI*2);ctx.fill();}
  void toCam;
}
return p=>{const env=environment();ctx=env.ctx;k=env.k;t=env.time;P2=env.project;drawPerson(p)};
}
window.NightCity.People={limbs:limbsOf,ease:easePose,renderer};
})();
