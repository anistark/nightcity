// Twinkling stars behind the page. Every star has its own random period and phase so the sky never pulses in step,
// and a random star flares into a small cross after exponentially distributed gaps, the same timing Pixel City uses.
// Stars sit on a 2px grid to match the pixel type. Reduced motion gets a still sky.
(()=>{
  const sky=document.createElement('canvas');sky.id='sky';sky.setAttribute('aria-hidden','true');document.body.prepend(sky);
  const g=sky.getContext('2d');
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS=['#ffffff','#ffffff','#ffffff','#bcd3ff','#ffe6c0'];
  const CELL=2,FLARE_GAP=2.5,FLARE_LEN=0.9;
  let stars=[],W=0,H=0,flare=null,nextFlare=0;
  const rand=(a,b)=>a+Math.random()*(b-a);
  const gap=m=>-Math.log(1-Math.random())*m;
  function seed(){
    const dpr=Math.min(devicePixelRatio||1,2);
    W=innerWidth;H=innerHeight;
    sky.width=Math.round(W*dpr);sky.height=Math.round(H*dpr);
    g.setTransform(dpr,0,0,dpr,0,0);
    stars=Array.from({length:Math.round(W*H/7000)},()=>({
      x:Math.floor(rand(0,W/CELL))*CELL,y:Math.floor(rand(0,H/CELL))*CELL,
      c:COLORS[Math.floor(Math.random()*COLORS.length)],
      base:rand(.15,.5),amp:rand(.05,.35),per:rand(1.5,6),ph:rand(0,Math.PI*2)
    }));
    flare=null;
  }
  function draw(t){
    g.clearRect(0,0,W,H);
    for(const s of stars){
      g.globalAlpha=still?s.base:Math.max(0,Math.min(1,s.base+s.amp*Math.sin(t/s.per+s.ph)));
      g.fillStyle=s.c;g.fillRect(s.x,s.y,CELL,CELL);
    }
    if(flare){
      const k=(t-flare.t0)/FLARE_LEN;
      if(k>=1)flare=null;
      else{
        const a=Math.sin(k*Math.PI),arm=Math.round(a*2)*CELL,{x,y,c}=flare.s;
        g.globalAlpha=a;g.fillStyle=c;
        g.fillRect(x-arm,y,CELL*2+arm*2-CELL,CELL);
        g.fillRect(x,y-arm,CELL,CELL*2+arm*2-CELL);
      }
    }
    g.globalAlpha=1;
  }
  function frame(ms){
    const t=ms/1000;
    if(!flare&&t>=nextFlare&&stars.length){flare={s:stars[Math.floor(Math.random()*stars.length)],t0:t};nextFlare=t+FLARE_LEN+gap(FLARE_GAP);}
    draw(t);requestAnimationFrame(frame);
  }
  let resizeTimer;
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{seed();if(still)draw(0);},150);});
  seed();
  if(still)draw(0);else requestAnimationFrame(frame);
})();
