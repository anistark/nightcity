/* Shared scene overlay. The scene layout renders the markup: title, clock, log panel and log button.
   This wires it to the scene through window.NightCity: the clock, whose colon blinks once a second, the log list and
   counters, the log toggle (L) and hiding the overlay (H, or a click on the scene).
   Then it adds a back link to Night City (bottom left), and in the top-right corner a share button that opens
   a dialog of share options, beside a fullscreen toggle (F).
   Load it after the scene, with data-text set to the share message. {seed} in the message becomes the scene's seed. */
(()=>{
  const me=document.currentScript,hud=document.getElementById('hud'),logBtn=document.getElementById('logBtn'),NC=window.NightCity;
  if(!hud||!logBtn||!NC||NC.EMBED)return;
  const $=id=>document.getElementById(id);
  const panel=$('log'),list=$('logList'),clock=$('clock'),LOG_HTML=logBtn.innerHTML;
  $('seed').textContent=NC.seed;

  // The clock's colon shows for the first half of every second, like a bedside clock. Checked each frame, redrawn only on change.
  clock.innerHTML='<span></span><span class="colon">:</span><span></span>';
  const[clkH,clkC,clkM]=clock.children;let clkKey='';
  const tickClock=blink=>{
    const d=new Date(),on=!blink||d.getMilliseconds()<500,k=d.getHours()*60+d.getMinutes()+(on?'':'-');
    if(k===clkKey)return;clkKey=k;clkH.textContent=NC.p2(d.getHours());clkM.textContent=NC.p2(d.getMinutes());clkC.classList.toggle('off',!on);
  };
  let shown=-1;
  const refresh=()=>{
    tickClock(!NC.RM);
    for(const el of hud.querySelectorAll('[data-stat]'))el.textContent=NC.counts[el.dataset.stat]??0;
    if(!panel.hidden&&shown!==NC.logVersion){
      shown=NC.logVersion;list.textContent='';
      for(const e of NC.entries.slice(0,40)){const li=document.createElement('li'),tm=document.createElement('time'),sp=document.createElement('span');tm.textContent=e.time;sp.textContent=e.text;li.append(tm,sp);list.append(li);}
    }
  };
  NC.ui={tick:()=>tickClock(!NC.RM),refresh};
  refresh();

  const CLOSE_HTML='<svg viewBox="0 0 7 7" width="16" height="16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M0 0h1v1H0zM1 1h1v1H1zM2 2h1v1H2zM3 3h1v1H3zM4 4h1v1H4zM5 5h1v1H5zM6 6h1v1H6zM6 0h1v1H6zM5 1h1v1H5zM4 2h1v1H4zM2 4h1v1H2zM1 5h1v1H1zM0 6h1v1H0z"/></svg>';
  const toggleLog=()=>{panel.hidden=!panel.hidden;logBtn.setAttribute('aria-expanded',String(!panel.hidden));logBtn.innerHTML=panel.hidden?LOG_HTML:CLOSE_HTML;logBtn.setAttribute('aria-label',panel.hidden?'Open log':'Close log');shown=-1;NC.refresh();};
  logBtn.addEventListener('click',e=>{e.stopPropagation();toggleLog();});
  const cv=$('scene');if(cv)cv.addEventListener('click',()=>hud.classList.toggle('off'));
  addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||document.querySelector('dialog[open]'))return;if(e.key==='l'||e.key==='L')toggleLog();if(e.key==='h'||e.key==='H')hud.classList.toggle('off');});

  // The rest are controls for a scene opened on its own, not inside the landing page's live previews.
  if(window.self!==window.top)return;
  // Pixel icons drawn from small grids, like the log's close button.
  const icon=(rows,size)=>{let d='';rows.forEach((r,y)=>{for(let x=0;x<r.length;x++)if(r[x]==='#')d+=`M${x} ${y}h1v1H${x}z`;});
    return`<svg viewBox="0 0 ${rows[0].length} ${rows.length}" width="${size||16}" height="${size||16}" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="${d}"/></svg>`;};
  const ICON={
    back:icon(['...#...','..#....','.#.....','#######','.#.....','..#....','...#...']),
    full:icon(['###.###','#.....#','#.....#','.......','#.....#','#.....#','###.###']),
    exit:icon(['..#.#..','..#.#..','###.###','.......','###.###','..#.#..','..#.#..']),
    share:icon(['...#...','..###..','.#.#.#.','...#...','#..#..#','#.....#','#######']),
    close:icon(['#.....#','.#...#.','..#.#..','...#...','..#.#..','.#...#.','#.....#'])
  };
  // Pixel versions of each platform's mark, 9 pixels square.
  const MARK={
    x:['##.....#.','.##...#..','..##.#...','...##....','...###...','..#.##...','.#...##..','#.....##.','.......##'],
    bluesky:['##.....##','###...###','####.####','#########','.#######.','..##.##..','.###.###.','.##...##.','.........'],
    linkedin:['#########','#.......#','#.#.....#','#.......#','#.#.###.#','#.#.#.#.#','#.#.#.#.#','#.......#','#########'],
    reddit:['......#..','....##.#.','....#....','.#######.','#.......#','#.#...#.#','#.......#','#..###..#','.#######.'],
    copy:['..######.','..#....#.','######.#.','#....#.#.','#....#.#.','#....###.','#....#...','######...','.........'],
    more:['....#....','...###...','..#.#.#..','....#....','#...#...#','#.......#','#.......#','#.......#','#########'],
    embed:['.........','.....#...','..#..##..','.#..#..#.','#...#...#','.#..#..#.','..##..#..','...#.....','.........']
  };
  const el=(tag,attrs,html)=>{const e=document.createElement(tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(html!==undefined)e.innerHTML=html;return e;};

  // Back to the landing page.
  hud.append(el('a',{class:'ctl ctl-back',href:'../','aria-label':'Back to Night City',title:'Back to Night City'},ICON.back));

  // Top-right corner: share, then fullscreen where the browser allows it.
  const top=el('div',{class:'ctl-top'});hud.append(top);
  if(document.fullscreenEnabled){
    const fs=el('button',{type:'button',class:'ctl','aria-label':'Enter fullscreen',title:'Fullscreen (F)'},ICON.full);
    const toggle=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});};
    fs.addEventListener('click',e=>{e.stopPropagation();toggle();});
    document.addEventListener('fullscreenchange',()=>{const on=!!document.fullscreenElement;fs.innerHTML=on?ICON.exit:ICON.full;fs.setAttribute('aria-label',on?'Exit fullscreen':'Enter fullscreen');});
    addEventListener('keydown',e=>{if((e.key==='f'||e.key==='F')&&!e.metaKey&&!e.ctrlKey&&!dlg.open)toggle();});
    top.append(fs);
  }

  // Share: a button beside fullscreen and a dialog of options.
  const shareBtn=el('button',{type:'button',class:'ctl','aria-label':'Share','aria-haspopup':'dialog',title:'Share'},ICON.share);
  top.prepend(shareBtn);
  const url=/^https?:$/.test(location.protocol)&&!/^(localhost|127\.|\[::1\])/.test(location.hostname)?location.origin+location.pathname:'https://github.com/anistark/nightcity';
  const message=()=>{const seed=(document.getElementById('seed')||{}).textContent||'';return(me.dataset.text||document.title).replace('{seed}',seed.trim());};
  const dlg=el('dialog',{class:'share-dlg','aria-labelledby':'share-h'});
  dlg.innerHTML=`<div class="share-head"><h2 id="share-h">Share ${document.title}</h2><button type="button" class="ctl share-close" aria-label="Close">${ICON.close}</button></div>
    <p class="share-text"></p>
    <div class="share-link"><span class="share-url"></span><button type="button" class="ctl share-copy" aria-label="Copy link" title="Copy link">${icon(MARK.copy,16)}</button></div>
    <div class="share-grid"></div><div class="share-extra"></div>`;
  document.body.append(dlg);
  const grid=dlg.querySelector('.share-grid');
  const targets=[
    ['X','x',(t,u)=>`https://x.com/intent/post?text=${t}&url=${u}`],
    ['Bluesky','bluesky',(t,u)=>`https://bsky.app/intent/compose?text=${t}%20${u}`],
    ['LinkedIn','linkedin',(t,u)=>`https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ['Reddit','reddit',(t,u)=>`https://www.reddit.com/submit?url=${u}&title=${t}`]
  ];
  // Icon-only options: the name lives in the tooltip and the accessible label.
  const opt=mark=>icon(MARK[mark],32);
  const named=(e,label)=>{e.setAttribute('aria-label',label);e.title=label;return e;};
  const links=targets.map(([name,mark,make])=>{const a=named(el('a',{class:'share-opt',target:'_blank',rel:'noopener'},opt(mark)),name);grid.append(a);return[a,make];});
  // Copy sits at the end of the link itself.
  const copy=dlg.querySelector('.share-copy');
  const say=txt=>{named(copy,txt);copy.classList.toggle('done',txt!=='Copy link');};
  copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(url);say('Copied');}catch(e){say('Press Ctrl+C');}setTimeout(()=>say('Copy link'),1600);});
  if(navigator.share){const more=named(el('button',{type:'button',class:'share-opt'},opt('more')),'More');grid.append(more);more.addEventListener('click',()=>navigator.share({title:document.title,text:message(),url}).catch(()=>{}));}
  // Embed is a different job from sharing, so it gets its own labelled button below the social ones.
  const embedBtn=el('button',{type:'button',class:'share-embed','aria-haspopup':'dialog'},`${icon(MARK.embed,24)}<span>Embed</span>`);dlg.querySelector('.share-extra').append(embedBtn);
  embedBtn.addEventListener('click',()=>{dlg.close();openEmbed();});
  const open=()=>{
    const m=message();dlg.querySelector('.share-text').textContent=m;dlg.querySelector('.share-url').textContent=url;
    const t=encodeURIComponent(m),u=encodeURIComponent(url);for(const[a,make]of links)a.href=make(t,u);
    dlg.showModal();
  };
  shareBtn.addEventListener('click',e=>{e.stopPropagation();open();});
  dlg.querySelector('.share-close').addEventListener('click',()=>dlg.close());
  // Clicking the dimmed backdrop closes the dialog too.
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});

  // Embed: snippets for putting this scene behind another site or app, one tab per platform.
  const local=!/^https?:$/.test(location.protocol)||/^(localhost|127\.|\[::1\])/.test(location.hostname);
  const root=local?'https://anistark.github.io/nightcity/':new URL('..',location.href).href;
  const key=me.dataset.scene||'pixel-city',folder=location.pathname.split('/').filter(Boolean).slice(-2,-1)[0]||key;
  const src=`${root}${local?key:folder}/embed/`,origin=new URL(root).origin;
  const style="position:fixed;inset:0;width:100%;height:100%;border:0;z-index:-1;pointer-events:none";
  const TABS=[
    ['HTML',`<script src="${root}embed.js" data-scene="${key}" async></script>`,
      'Paste it before </body>. Add data-target="#hero" to fill one element instead of the page, or data-dim="0.4" to darken the scene under your text.'],
    ['iframe',`<iframe src="${src}" title="" aria-hidden="true" tabindex="-1"\n  style="${style}"></iframe>`,
      'For site builders that allow iframes but not scripts. Add ?q=high to the address for full quality.'],
    ['React',`export function NightCityBackground() {\n  return (\n    <iframe\n      src="${src}"\n      title=""\n      aria-hidden="true"\n      tabIndex={-1}\n      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%',\n        border: 0, zIndex: -1, pointerEvents: 'none' }}\n    />\n  );\n}`,
      'Render it once, near the root of your app. It works with server rendering, including Next.js.'],
    ['Vue',`<template>\n  <iframe :src="src" title="" aria-hidden="true" tabindex="-1" class="night-city" />\n</template>\n\n<script setup>\nconst src = '${src}'\n</script>\n\n<style scoped>\n.night-city {\n  position: fixed; inset: 0; width: 100%; height: 100%;\n  border: 0; z-index: -1; pointer-events: none;\n}\n</style>`,
      'A single-file component. Place it once, near the root of your app. Works the same in Nuxt.'],
    ['React Native',`import { StyleSheet, View } from 'react-native';\nimport { WebView } from 'react-native-webview';\n\nexport function NightCityBackground() {\n  return (\n    <View style={StyleSheet.absoluteFill} pointerEvents="none">\n      <WebView\n        source={{ uri: '${src}' }}\n        scrollEnabled={false}\n        style={{ backgroundColor: '#07081a' }}\n      />\n    </View>\n  );\n}`,
      'Needs react-native-webview. Put it first inside a full-screen container, with your content after it.'],
    ['Flutter',`import 'package:flutter/material.dart';\nimport 'package:webview_flutter/webview_flutter.dart';\n\nclass NightCityBackground extends StatelessWidget {\n  NightCityBackground({super.key});\n\n  final controller = WebViewController()\n    ..setJavaScriptMode(JavaScriptMode.unrestricted)\n    ..setBackgroundColor(const Color(0xFF07081A))\n    ..loadRequest(Uri.parse('${src}'));\n\n  @override\n  Widget build(BuildContext context) =>\n      IgnorePointer(child: WebViewWidget(controller: controller));\n}`,
      'Needs webview_flutter. Put it at the bottom of a Stack, with your content above it.']
  ];
  const ed=el('dialog',{class:'share-dlg embed-dlg','aria-labelledby':'embed-h'});
  const csp=`Content-Security-Policy: frame-src ${origin}; script-src 'self' ${origin};`;
  ed.innerHTML=`<div class="share-head"><h2 id="embed-h">Embed ${document.title}</h2><button type="button" class="ctl share-close" aria-label="Close">${ICON.close}</button></div>
    <p class="share-text">Put this scene behind your own site or app. Pick your platform and paste the snippet.</p>
    <div class="embed-tabs" role="tablist" aria-label="Platform"></div>
    <div class="code-box" role="tabpanel"><button type="button" class="ctl code-copy" aria-label="Copy code" title="Copy">${icon(MARK.copy,16)}</button><pre><code class="embed-code"></code></pre></div>
    <p class="embed-hint"></p>
    <h3 class="embed-sub">Before it shows up</h3>
    <ul class="embed-notes">
      <li><b>Content Security Policy.</b> If your site sends one, allow frames and scripts from ${origin}. The script line is only needed for the HTML tab.
        <div class="code-box"><button type="button" class="ctl code-copy" aria-label="Copy policy" title="Copy">${icon(MARK.copy,16)}</button><pre><code></code></pre></div></li>
      <li><b>Transparent backgrounds.</b> A full-page scene sits behind your content, so the page and any full-width sections above it need transparent backgrounds.
        <div class="code-box"><button type="button" class="ctl code-copy" aria-label="Copy CSS" title="Copy">${icon(MARK.copy,16)}</button><pre><code>html, body { background: transparent; }</code></pre></div></li>
      <li><b>Battery.</b> Embeds run at lower quality, around 30 frames a second. The script version also pauses while the scene is scrolled out of view, and viewers who prefer reduced motion see a still frame.</li>
    </ul>`;
  document.body.append(ed);
  ed.querySelector('.embed-notes code').textContent=csp;
  const tabs=ed.querySelector('.embed-tabs'),code=ed.querySelector('.embed-code'),hint=ed.querySelector('.embed-hint');
  const show=i=>{
    [...tabs.children].forEach((b,j)=>{b.setAttribute('aria-selected',String(i===j));b.tabIndex=i===j?0:-1;});
    code.textContent=TABS[i][1];hint.textContent=TABS[i][2];
  };
  TABS.forEach(([name],i)=>{const b=el('button',{type:'button',class:'embed-tab',role:'tab'},name);b.addEventListener('click',()=>show(i));tabs.append(b);});
  tabs.addEventListener('keydown',e=>{const n=TABS.length,cur=[...tabs.children].findIndex(b=>b.getAttribute('aria-selected')==='true');
    const nx=e.key==='ArrowRight'?(cur+1)%n:e.key==='ArrowLeft'?(cur+n-1)%n:-1;if(nx>=0){e.preventDefault();show(nx);tabs.children[nx].focus();}});
  for(const b of ed.querySelectorAll('.code-copy'))b.addEventListener('click',async()=>{
    const txt=b.parentNode.querySelector('code').textContent;
    try{await navigator.clipboard.writeText(txt);b.classList.add('done');b.setAttribute('aria-label','Copied');}catch(e){b.setAttribute('aria-label','Press Ctrl+C');}
    setTimeout(()=>{b.classList.remove('done');b.setAttribute('aria-label','Copy');},1600);
  });
  const openEmbed=()=>{show(0);ed.showModal();};
  ed.querySelector('.share-close').addEventListener('click',()=>ed.close());
  ed.addEventListener('click',e=>{if(e.target===ed)ed.close();});
})();
