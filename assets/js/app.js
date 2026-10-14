const grid=document.getElementById("newsGrid"),search=document.getElementById("search"),category=document.getElementById("category"),count=document.getElementById("resultCount");
let items=[];
function esc(v){return String(v??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}
function driveFileId(value){
 const raw=String(value||"").trim();if(!raw)return "";
 if(/^[a-zA-Z0-9_-]{20,}$/.test(raw)&&!/^https?:/i.test(raw))return raw;
 try{const u=new URL(raw),host=u.hostname.toLowerCase();if(host==="drive.google.com"||host.endsWith(".drive.google.com")||host==="docs.google.com")return u.searchParams.get("id")||((u.pathname.match(/\/(?:file\/d|document\/d|spreadsheets\/d)\/([^/]+)/)||[])[1]||"")}catch(e){}
 return "";
}
function publicImageUrl(value,variant=0){
 const raw=String(value||"").trim();if(!raw)return "";
 const id=driveFileId(raw);
 if(id){const urls=["https://drive.google.com/thumbnail?id="+encodeURIComponent(id)+"&sz=w1200","https://drive.google.com/uc?export=view&id="+encodeURIComponent(id),"https://drive.google.com/uc?id="+encodeURIComponent(id)];return urls[Math.min(variant,urls.length-1)]}
 return /^https?:\/\//i.test(raw)?raw:"";
}
function cardImageError(img){
 const original=img.dataset.original||"",stage=Number(img.dataset.retry||0),id=driveFileId(original);
 if(id&&stage<2){img.dataset.retry=String(stage+1);img.src=publicImageUrl(original,stage+1);return}
 if(stage<1&&original&&img.src!==original){img.dataset.retry="2";img.src=original;return}
 const host=img.parentElement;if(host)host.innerHTML='<img class="public-card-fallback" src="https://www.gub.uy/ministerio-desarrollo-social/sites/ministerio-desarrollo-social/files/styles/documento/public/imagenes/publicaciones/logo_mides.png" alt="MIDES Florida" loading="eager" onerror="this.onerror=null;this.parentElement.innerHTML=\'<span>MIDES Florida</span>\'">';
}
function featuredPhoto(x){
 const values=[x.fotoPrincipal,x.foto_principal,x.imagenPrincipal,x.imagen_principal,x.foto,x.imagen,x.fotos,x.galeria];
 for(const value of values){const candidates=Array.isArray(value)?value:[value];for(const candidate of candidates){
  if(typeof candidate==="string"&&publicImageUrl(candidate))return candidate.trim();
  if(candidate&&typeof candidate==="object"){const nested=candidate.url||candidate.link||candidate.src||candidate.foto;if(typeof nested==="string"&&publicImageUrl(nested))return nested.trim()}
 }}
 return "";
}
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
 const data=items.filter(x=>{
  const published=String(x.estado||"").trim().toLowerCase()==="publicado";
  const matchesQuery=!q||[x.titulo,x.resumen,x.contenido,x.categoria,x.tag,x.fecha].join(" ").toLowerCase().includes(q);
  return published&&matchesQuery&&(!c||String(x.categoria||"").toLowerCase()===c.toLowerCase());
 });
 count.textContent=data.length+" "+(data.length===1?"comunicado publicado":"comunicados publicados");
 grid.classList.remove("draft-list","public-press-list");
 grid.classList.add("news-grid","public-vertical-grid");
 grid.innerHTML=data.map(x=>{
  const photo=featuredPhoto(x);
  const photoMarkup=photo
   ? '<div class="public-card-image"><img src="'+esc(publicImageUrl(photo))+'" data-original="'+esc(photo)+'" alt="'+esc(x.titulo||"Foto destacada del comunicado")+'" loading="eager" decoding="async" referrerpolicy="no-referrer" onerror="cardImageError(this)"></div>'
   : '<div class="public-card-image public-card-image-placeholder"><img class="public-card-fallback" src="https://www.gub.uy/ministerio-desarrollo-social/sites/ministerio-desarrollo-social/files/styles/documento/public/imagenes/publicaciones/logo_mides.png" alt="MIDES Florida" loading="eager" onerror="this.onerror=null;this.parentElement.innerHTML=\'<span>MIDES Florida</span>\'"></div>';
  return '<article class="news-card public-vertical-card">'+photoMarkup+
   '<div class="news-body public-vertical-body">'+
    '<div class="public-card-meta">'+esc(x.categoria||"Comunicado")+(x.fecha?' · '+esc(formatDate(x.fecha)):"")+'</div>'+
    '<h3>'+esc(x.titulo||"Comunicado MIDES Florida")+'</h3>'+
    '<p>'+esc(x.resumen||"Comunicado oficial de MIDES Florida.")+'</p>'+
    '<a class="public-card-button" href="comunicado.html?id='+encodeURIComponent(x.id)+'">Ver comunicado <span aria-hidden="true">→</span></a>'+
   '</div></article>';
 }).join("")||'<div class="empty public-empty">No hay comunicados publicados que coincidan con la búsqueda.</div>';
}
function requestJsonp(url){
 return new Promise((resolve,reject)=>{
  const callbackName="__prensaJsonp_"+Date.now()+"_"+Math.random().toString(36).slice(2);
  const script=document.createElement("script");
  let finished=false;
  const cleanup=()=>{if(finished)return;finished=true;clearTimeout(timer);delete window[callbackName];script.remove();};
  const timer=setTimeout(()=>{cleanup();reject(new Error("La API no respondió por JSONP. Hay que actualizar la implementación de Apps Script."));},15000);
  window[callbackName]=(data)=>{cleanup();resolve(data);};
  script.onerror=()=>{cleanup();reject(new Error("No se pudo cargar la respuesta de Google Apps Script."));};
  const endpoint=new URL(url);
  endpoint.searchParams.set("action","list");
  endpoint.searchParams.set("callback",callbackName);
  endpoint.searchParams.set("_",String(Date.now()));
  script.src=endpoint.toString();
  script.async=true;
  document.head.appendChild(script);
 });
}
async function load(){
 if(!grid||!search||!category||!count)return;
 if(!window.PRENSA_CONFIG?.apiUrl){
  grid.innerHTML='<div class="empty">La sala de prensa está pendiente de conectar con su base institucional.</div>';
  count.textContent="";
  return;
 }
 grid.innerHTML='<div class="empty">Cargando comunicados publicados…</div>';
 try{
  // JSONP evita el bloqueo CORS de Google Apps Script al consultarlo desde GitHub Pages.
  const data=await requestJsonp(window.PRENSA_CONFIG.apiUrl);
  if(!data||data.ok!==true)throw new Error(data?.error||"La API no confirmó la consulta");
  if(!Array.isArray(data.items))throw new Error("La API respondió, pero no entregó una lista de comunicados");
  // La API pública ya filtra por estado; no se vuelve a filtrar en el navegador.
  items=data.items;
  render();
  if(!items.length)grid.innerHTML='<div class="empty">Todavía no hay comunicados publicados.</div>';
 }catch(e){
  console.error("Centro de Prensa: no se pudieron cargar los comunicados",e);
  grid.innerHTML='<div class="empty"><strong>No fue posible mostrar los comunicados.</strong><br>La conexión con Google respondió con un error. Actualizá la página en unos segundos. Si persiste, contactá al administrador.<br><small>'+esc(e&&e.message?e.message:"Error de conexión")+'</small></div>';
  count.textContent="";
 }
}
search.addEventListener("input",render);category.addEventListener("change",render);load();