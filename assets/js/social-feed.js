(function(){
  const host=document.getElementById('instagramFeed');
  if(!host)return;
  const profile='https://www.instagram.com/mides_florida/';
  // Instagram official profile embed: no Meta app, API token or Apps Script connection required.
  host.innerHTML='<blockquote class="instagram-media" data-instgrm-permalink="'+profile+'" data-instgrm-version="14" style="background:#fff;border:0;border-radius:12px;box-shadow:none;margin:0 auto;max-width:540px;min-width:280px;padding:0;width:calc(100% - 2px)"><a href="'+profile+'" target="_blank" rel="noopener noreferrer">Ver el perfil @mides_florida en Instagram</a></blockquote>';
  function processEmbed(){
    if(window.instgrm&&window.instgrm.Embeds&&typeof window.instgrm.Embeds.process==='function'){
      window.instgrm.Embeds.process();
    }
  }
  if(!document.querySelector('script[data-mides-instagram-embed]')){
    const script=document.createElement('script');
    script.src='https://www.instagram.com/embed.js';
    script.async=true;
    script.dataset.midesInstagramEmbed='true';
    script.onload=processEmbed;
    document.body.appendChild(script);
  }else{
    processEmbed();
  }
})();