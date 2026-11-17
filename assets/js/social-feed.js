(function(){
  const host=document.getElementById('instagramFeed');
  if(!host)return;
  const PROFILE='https://www.instagram.com/mides_florida/';
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function jsonp(url){
    return new Promise((resolve,reject)=>{
      const callback='__midesInstagram_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      let done=false;
      const timer=setTimeout(()=>finish(new Error('La consulta de Instagram tardó demasiado.')),18000);
      function finish(error,data){
        if(done)return;done=true;clearTimeout(timer);delete window[callback];script.remove();
        if(error)reject(error);else resolve(data);
      }
      window[callback]=data=>finish(null,data);
      script.onerror=()=>finish(new Error('No se pudo conectar con la API de Instagram.'));
      const endpoint=new URL(url);endpoint.searchParams.set('action','instagramFeed');endpoint.searchParams.set('callback',callback);endpoint.searchParams.set('_',Date.now());
      script.src=endpoint.toString();script.async=true;document.head.appendChild(script);
    });
  }
  function dateLabel(value){
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return '';
    return d.toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'});
  }
  function render(data){
    if(!data||data.ok!==true)throw new Error(data&&data.error?data.error:'No se pudo consultar Instagram.');
    if(!data.configured){
      host.innerHTML='<div class="instagram-feed-message">La conexión automática está preparada, pero todavía falta autorizar la cuenta de Instagram en Meta y guardar su credencial privada en Apps Script. Mientras tanto, podés visitar el <a href="'+PROFILE+'" target="_blank" rel="noopener noreferrer">perfil oficial @mides_florida ↗</a>.</div>';
      return;
    }
    const posts=Array.isArray(data.items)?data.items:[];
    if(!posts.length){
      host.innerHTML='<div class="instagram-feed-message">La cuenta está conectada, pero Instagram no devolvió publicaciones recientes. <a href="'+PROFILE+'" target="_blank" rel="noopener noreferrer">Abrir perfil ↗</a></div>';
      return;
    }
    host.innerHTML=posts.map(post=>{
      const first=post.children&&post.children.length?post.children[0]:null;
      const image=(post.mediaType==='VIDEO'?post.thumbnailUrl:post.mediaUrl)||(first&&(first.mediaType==='VIDEO'?first.thumbnailUrl:first.mediaUrl))||post.thumbnailUrl||'';
      const video=post.mediaType==='VIDEO'||(first&&first.mediaType==='VIDEO');
      const caption=String(post.caption||'').trim();
      const excerpt=caption.length>150?caption.slice(0,147)+'…':caption;
      const url=/^https:\/\//i.test(post.permalink||'')?post.permalink:PROFILE;
      return '<a class="instagram-feed-item" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer" aria-label="Ver publicación de MIDES Florida en Instagram">'+
        '<span class="instagram-feed-media">'+(image?'<img src="'+esc(image)+'" alt="'+esc(excerpt||'Publicación de MIDES Florida')+'" loading="lazy" referrerpolicy="no-referrer">':'<span class="instagram-feed-image-placeholder">MIDES Florida</span>')+(video?'<span class="instagram-feed-play" aria-hidden="true">▶</span>':'')+'</span>'+
        '<span class="instagram-feed-copy"><span class="instagram-feed-date">'+esc(dateLabel(post.timestamp))+'</span><span class="instagram-feed-caption">'+esc(excerpt||'Publicación de MIDES Florida.')+'</span><span class="instagram-feed-more">Ver en Instagram ↗</span></span></a>';
    }).join('');
  }
  async function load(){
    const endpoint=window.PRENSA_CONFIG&&window.PRENSA_CONFIG.apiUrl;
    if(!endpoint){host.innerHTML='<div class="instagram-feed-message">La conexión con el servicio institucional no está configurada.</div>';return;}
    host.innerHTML='<div class="instagram-feed-loading">Cargando publicaciones de Instagram…</div>';
    try{render(await jsonp(endpoint));}
    catch(error){
      console.error('MIDES Florida: error al cargar Instagram',error);
      host.innerHTML='<div class="instagram-feed-message">No fue posible actualizar las publicaciones en este momento. <a href="'+PROFILE+'" target="_blank" rel="noopener noreferrer">Abrir perfil oficial ↗</a></div>';
    }
  }
  load();
})();
