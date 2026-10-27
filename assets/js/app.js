const grid=document.getElementById("newsGrid"),search=document.getElementById("search"),category=document.getElementById("category"),count=document.getElementById("resultCount");
let items=[];
const REQUIRED_API_VERSION="2026-10-26-centro-prensa-v1";
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
function requestJsonp(url,action="list"){
 return new Promise((resolve,reject)=>{
  const callbackName="__prensaJsonp_"+Date.now()+"_"+Math.random().toString(36).slice(2);
  const script=document.createElement("script");
  let finished=false,loadTimer=null;
  const timer=setTimeout(()=>{
   cleanup();
   reject(new Error("La API no respondió por JSONP. Actualizá apps-script/Code.gs en el proyecto de Apps Script y publicá una Nueva versión desde Implementar → Gestionar implementaciones."));
  },15000);
  const cleanup=()=>{
   if(finished)return;
   finished=true;
   clearTimeout(timer);
   if(loadTimer!==null)clearTimeout(loadTimer);
   delete window[callbackName];
   script.remove();
  };
  window[callbackName]=(data)=>{cleanup();resolve(data);};
  script.onerror=()=>{
   cleanup();
   reject(new Error("No se pudo cargar la respuesta de Google Apps Script. Verificá que la URL de la API y el acceso del Web App sean correctos."));
  };
  // Una versión antigua puede devolver JSON sin ejecutar la función callback.
  // En ese caso la etiqueta script carga, pero JSONP nunca completa la petición.
  script.onload=()=>{
   if(finished)return;
   loadTimer=setTimeout(()=>{
    if(finished)return;
    cleanup();
    reject(new Error("Google Apps Script respondió, pero no ejecutó la función JSONP. La implementación publicada está desactualizada: publicá una Nueva versión con el contenido de apps-script/Code.gs."));
   },350);
  };
  const endpoint=new URL(url);
  endpoint.searchParams.set("action",action);
  endpoint.searchParams.set("callback",callbackName);
  endpoint.searchParams.set("_",String(Date.now()));
  script.src=endpoint.toString();
  script.async=true;
  document.head.appendChild(script);
 });
}
function verifyApiVersion(data){
 if(!data||data.apiVersion!==REQUIRED_API_VERSION||data.jsonpSupported!==true){
  throw new Error("La implementación de Apps Script está desactualizada. Publicá una nueva versión desde Implementar → Gestionar implementaciones → Editar → Nueva versión. Versión requerida: "+REQUIRED_API_VERSION+".");
 }
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
  verifyApiVersion(data);
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

function parseActivityDate(value){
 const raw=String(value||'').trim();
 if(!raw)return new Date(NaN);
 // Las fechas de la agenda se guardan como hora local de Uruguay: YYYY-MM-DDTHH:mm:ss.
 const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
 if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]||0));
 return new Date(raw);
}
function formatActivityDate(value){
 const d=parseActivityDate(value);
 if(Number.isNaN(d.getTime()))return {day:'—',month:'',weekday:'',full:String(value||'')};
 return {day:d.toLocaleDateString('es-UY',{day:'2-digit'}),month:d.toLocaleDateString('es-UY',{month:'short'}).replace('.','').toUpperCase(),weekday:d.toLocaleDateString('es-UY',{weekday:'long'}),full:d.toLocaleDateString('es-UY',{day:'2-digit',month:'long',year:'numeric'})};
}
function renderUpcoming(items){
 const host=document.getElementById('upcomingActivities');if(!host)return;
 const now=new Date();
 const upcoming=(Array.isArray(items)?items:[]).filter(x=>{const d=parseActivityDate(x.inicio);return !Number.isNaN(d.getTime())&&d>=now&&String(x.estado||'Activa').trim().toLowerCase()==='activa';}).sort((a,b)=>String(a.inicio).localeCompare(String(b.inicio))).slice(0,5);
 if(!upcoming.length){host.innerHTML='<div class="empty">No hay próximas actividades publicadas en este momento.</div>';return;}
 host.innerHTML=upcoming.map(x=>{
  const date=formatActivityDate(x.inicio),dt=parseActivityDate(x.inicio),time=Number.isNaN(dt.getTime())?'':dt.toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit',hour12:false});
  const desc=String(x.descripcion||'').trim(),place=String(x.lugar||'').trim(),image=String(x.imagenUrl||'').trim();
  return '<article class="upcoming-card"><div class="upcoming-date"><span>'+esc(date.month)+'</span><strong>'+esc(date.day)+'</strong><small>'+esc(date.weekday)+'</small></div><div class="upcoming-content"><h3>'+esc(x.actividad||'Actividad institucional')+'</h3><div class="upcoming-meta">'+(time?'<span>◷ '+esc(time)+' h</span>':'')+(place?'<span>⌖ '+esc(place)+'</span>':'')+'</div>'+(desc?'<p>'+esc(desc)+'</p>':'')+(image?'<a class="upcoming-image-link" href="'+esc(image)+'" target="_blank" rel="noopener">Ver imagen de la actividad →</a>':'')+'</div></article>';
 }).join('');
}
async function loadUpcoming(){
 const host=document.getElementById('upcomingActivities');if(!host)return;
 if(!window.PRENSA_CONFIG?.apiUrl){host.innerHTML='<div class="empty">La agenda institucional está pendiente de conexión.</div>';return;}
 try{
  const data=await requestJsonp(window.PRENSA_CONFIG.apiUrl,'upcomingActivities');
  verifyApiVersion(data);
  if(!data||data.ok!==true||!Array.isArray(data.items))throw new Error(data?.error||'La agenda no devolvió actividades');
  renderUpcoming(data.items);
 }catch(e){
  console.error('No se pudieron cargar las próximas actividades',e);
  host.innerHTML='<div class="empty">No fue posible cargar la agenda en este momento. Intentá actualizar la página más tarde.</div>';
 }
}

search.addEventListener("input",render);category.addEventListener("change",render);load();loadUpcoming();