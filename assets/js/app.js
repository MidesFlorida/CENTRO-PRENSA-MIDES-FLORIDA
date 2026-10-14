const grid=document.getElementById("newsGrid"),search=document.getElementById("search"),category=document.getElementById("category"),count=document.getElementById("resultCount");
let items=[];
function esc(v){return String(v??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}
function publicImageUrl(url){try{const u=new URL(url);if(!/(^|\\.)drive\\.google\\.com$/i.test(u.hostname))return url;const id=u.searchParams.get("id")||((u.pathname.match(/\\/file\\/d\\/([^/]+)/)||[])[1]||"");return id?"https://drive.google.com/thumbnail?id="+encodeURIComponent(id)+"&sz=w800":url}catch(e){return url}}
function formatDate(v){if(!v)return "";const d=new Date(v+"T00:00:00");return isNaN(d)?v:d.toLocaleDateString("es-UY",{day:"2-digit",month:"long",year:"numeric"});}
function mediaBadges(x){
  const b=[];
  if(x.fotoPrincipal||(x.fotos||[]).length)b.push("📷 Fotos");
  if(x.videoUrl||x.videoDriveFileId)b.push("▶ Video");
  if(x.audioUrl||x.audioDriveFileId)b.push("🎧 Audio");
  return b.length?'<div class="media-badges">'+b.map(v=>'<span>'+v+'</span>').join("")+'</div>':"";
}
function render(){
 const q=search.value.toLowerCase().trim(),c=category.value;
 const data=items.filter(x=>(!q||Object.values(x).join(" ").toLowerCase().includes(q))&&(!c||x.categoria===c));
 count.textContent=data.length+" resultado"+(data.length===1?"":"s");
 grid.innerHTML=data.map(x=>`<article class="news-card">
 <div class="news-image">${x.fotoPrincipal&&/^https?:\/\//i.test(x.fotoPrincipal)?'<img src="'+esc(publicImageUrl(x.fotoPrincipal))+'" alt="Fotografía de '+esc(x.titulo)+'" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=&quot;news-image-empty&quot;>MIDES Florida</div>\'">':'<div class="news-image-empty">MIDES Florida</div>'}<span>${esc(x.tag||x.categoria)}</span></div>
 <div class="news-body"><div class="meta"><span>${esc(formatDate(x.fecha))}</span><span>${esc(x.categoria)}</span></div>
 <h3>${esc(x.titulo)}</h3><p>${esc(x.resumen)}</p>${mediaBadges(x)}<a href="comunicado.html?id=${encodeURIComponent(x.id)}">Ver comunicado y material →</a></div></article>`).join("")||'<div class="empty">No encontramos contenidos publicados con esos criterios.</div>';
}
async function load(){
 if(!window.PRENSA_CONFIG?.apiUrl){grid.innerHTML='<div class="empty">La sala de prensa está pendiente de conectar con su base institucional.</div>';return;}
 try{
  const res=await fetch(window.PRENSA_CONFIG.apiUrl+"?action=list",{cache:"no-store"}),data=await res.json();
  if(!data.ok)throw new Error(data.error||"Error de API");
  items=(data.items||[]).filter(x=>String(x.estado||"").toLowerCase()==="publicado");render();
 }catch(e){console.error(e);grid.innerHTML='<div class="empty">No fue posible consultar los comunicados en este momento.</div>';count.textContent="";}
}
search.addEventListener("input",render);category.addEventListener("change",render);load();