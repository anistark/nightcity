/* Night City embed: a live scene as the background of any page.

   <script src="https://anistark.github.io/nightcity/embed.js" data-scene="pixel-city" async></script>

   data-scene    pixel-city (default), basketball-court, rain-window or shoreline
   data-target   a CSS selector: fill that element instead of the whole page
   data-dim      0 to 1: darken the scene so text on top stays readable
   data-quality  low (default) or high. Low draws at a lower resolution and about 30 frames a second

   The scene runs in an iframe, so it can't touch the page's styles or scripts. It ignores clicks, is hidden from
   screen readers and keyboard focus, pauses while off screen, and shows a still frame to viewers who prefer reduced motion. */
(()=>{
  const me=document.currentScript;if(!me)return;
  const root=new URL('.',me.src).href;
  const SCENES={'pixel-city':'pixel-city/','basketball-court':'basketball-court/','half-court':'basketball-court/','rain-window':'rain-window/','shoreline':'shoreline/'};
  const d=me.dataset,scene=SCENES[d.scene]||SCENES['pixel-city'];
  const dim=Math.min(1,Math.max(0,parseFloat(d.dim)||0));
  const start=()=>{
    const target=d.target?document.querySelector(d.target):null;
    if(d.target&&!target)return;
    const box=document.createElement('div');
    box.setAttribute('data-nightcity','');box.setAttribute('aria-hidden','true');
    box.style.cssText=`position:${target?'absolute':'fixed'};inset:0;z-index:-1;overflow:hidden;pointer-events:none`;
    if(target){
      // Keep the scene inside the element, behind its content.
      if(getComputedStyle(target).position==='static')target.style.position='relative';
      target.style.isolation='isolate';
      target.prepend(box);
    }else document.body.prepend(box);
    const f=document.createElement('iframe');
    f.src=`${root}${scene}embed/${d.quality==='high'?'?q=high':''}`;
    f.title='';f.tabIndex=-1;f.setAttribute('aria-hidden','true');
    // A full-page background is always on screen, so only an embed inside an element waits until it scrolls into view.
    if(target)f.loading='lazy';
    f.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;background:#07081a';
    box.append(f);
    if(dim>0){const v=document.createElement('div');v.style.cssText=`position:absolute;inset:0;background:rgba(0,0,0,${dim})`;box.append(v);}
    // Pause the scene while it's scrolled out of view.
    if('IntersectionObserver'in window)new IntersectionObserver(es=>{for(const e of es)f.contentWindow&&f.contentWindow.postMessage({nightcity:e.isIntersecting?'play':'pause'},'*');}).observe(box);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
