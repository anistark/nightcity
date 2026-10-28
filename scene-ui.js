/* Shared scene controls: a back link to Night City (bottom left), a fullscreen toggle (top right),
   and a share button beside Log that opens a dialog of share options.
   Load it with data-text set to the share message. {seed} in the message becomes the scene's seed. */
(()=>{
  const me=document.currentScript,hud=document.getElementById('hud'),logBtn=document.getElementById('logBtn');
  // Skip them inside the landing page's live previews.
  if(!hud||!logBtn||window.self!==window.top)return;
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
    more:['....#....','...###...','..#.#.#..','....#....','#...#...#','#.......#','#.......#','#.......#','#########']
  };
  const el=(tag,attrs,html)=>{const e=document.createElement(tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(html!==undefined)e.innerHTML=html;return e;};

  // Back to the landing page.
  hud.append(el('a',{class:'ctl ctl-back',href:'../index.html','aria-label':'Back to Night City',title:'Back to Night City'},ICON.back));

  // Fullscreen, where the browser allows it.
  if(document.fullscreenEnabled){
    const fs=el('button',{type:'button',class:'ctl ctl-full','aria-label':'Enter fullscreen',title:'Fullscreen (F)'},ICON.full);
    const toggle=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});};
    fs.addEventListener('click',e=>{e.stopPropagation();toggle();});
    document.addEventListener('fullscreenchange',()=>{const on=!!document.fullscreenElement;fs.innerHTML=on?ICON.exit:ICON.full;fs.setAttribute('aria-label',on?'Exit fullscreen':'Enter fullscreen');});
    addEventListener('keydown',e=>{if((e.key==='f'||e.key==='F')&&!e.metaKey&&!e.ctrlKey&&!dlg.open)toggle();});
    hud.append(fs);
  }

  // Share: a button beside Log and a dialog of options.
  const row=el('div',{class:'ctl-row'});logBtn.parentNode.insertBefore(row,logBtn);
  const shareBtn=el('button',{type:'button',class:'ctl','aria-label':'Share','aria-haspopup':'dialog',title:'Share'},ICON.share);
  row.append(shareBtn,logBtn);
  const url=/^https?:$/.test(location.protocol)&&!/^(localhost|127\.|\[::1\])/.test(location.hostname)?location.origin+location.pathname:'https://github.com/anistark/nightcity';
  const message=()=>{const seed=(document.getElementById('seed')||{}).textContent||'';return(me.dataset.text||document.title).replace('{seed}',seed.trim());};
  const dlg=el('dialog',{class:'share-dlg','aria-labelledby':'share-h'});
  dlg.innerHTML=`<div class="share-head"><h2 id="share-h">Share ${document.title}</h2><button type="button" class="ctl share-close" aria-label="Close">${ICON.close}</button></div>
    <p class="share-text"></p><p class="share-url"></p><div class="share-grid"></div>`;
  document.body.append(dlg);
  const grid=dlg.querySelector('.share-grid');
  const targets=[
    ['X','x',(t,u)=>`https://x.com/intent/post?text=${t}&url=${u}`],
    ['Bluesky','bluesky',(t,u)=>`https://bsky.app/intent/compose?text=${t}%20${u}`],
    ['LinkedIn','linkedin',(t,u)=>`https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ['Reddit','reddit',(t,u)=>`https://www.reddit.com/submit?url=${u}&title=${t}`]
  ];
  const opt=(mark,label)=>`${icon(MARK[mark],24)}<span>${label}</span>`;
  const links=targets.map(([name,mark,make])=>{const a=el('a',{class:'share-opt',target:'_blank',rel:'noopener'},opt(mark,name));grid.append(a);return[a,make];});
  const copy=el('button',{type:'button',class:'share-opt'},opt('copy','Copy link'));grid.append(copy);
  const say=txt=>{copy.querySelector('span').textContent=txt;};
  copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(message()+' '+url);say('Copied');}catch(e){say('Press Ctrl+C');}setTimeout(()=>say('Copy link'),1600);});
  if(navigator.share){const more=el('button',{type:'button',class:'share-opt'},opt('more','More'));grid.append(more);more.addEventListener('click',()=>navigator.share({title:document.title,text:message(),url}).catch(()=>{}));}
  const open=()=>{
    const m=message();dlg.querySelector('.share-text').textContent=m;dlg.querySelector('.share-url').textContent=url;
    const t=encodeURIComponent(m),u=encodeURIComponent(url);for(const[a,make]of links)a.href=make(t,u);
    dlg.showModal();
  };
  shareBtn.addEventListener('click',e=>{e.stopPropagation();open();});
  dlg.querySelector('.share-close').addEventListener('click',()=>dlg.close());
  // Clicking the dimmed backdrop closes the dialog too.
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
})();
