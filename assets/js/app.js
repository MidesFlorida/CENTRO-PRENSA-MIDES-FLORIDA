const grid=document.getElementById("newsGrid"),search=document.getElementById("search"),category=document.getElementById("category"),count=document.getElementById("resultCount");
let items=[];
function esc(v){return String(v??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}
function driveFileId(url){try{const u=new URL(url);if(!/(^|\.)drive\.google\.com$/i.test(u.hostname))return "";return u.searchParams.get("id")||((u.pathname.match(/\/file\/d\/([^/]+)/)||[])[1]||"")}catch(e){return ""}}
function publicImageUrl(url){const id=driveFileId(url);return id?"https://drive.google.com/thumbnail?id="+encodeURIComponent(id)+"&sz=w1000":url}
function cardImageError(img){const original=img.dataset.original||"",id=driveFileId(original),stage=Number(img.dataset.retry||0);if(id&&stage===0){img.dataset.retry="1";img.src="https://drive.google.com/uc?export=view&id="+encodeURIComponent(id);return}if(stage<2&&original&&img.src!==original){img.dataset.retry="2";img.src=original;return}const host=img.parentElement;if(host)host.innerHTML="<div class=\"news-image-empty\">MIDES Florida</div>"}
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
 <div class="news-image">${x.fotoPrincipal&&/^https?:\/\//i.test(x.fotoPrincipal)?'<img src="'+esc(publicImageUrl(x.fotoPrincipal))+'" data-original="'+esc(x.fotoPrincipal)+'" data-retry="0" alt="Fotografía de '+esc(x.titulo)+'" loading="lazy" onerror="cardImageError(this)">'':'<div class="news-image-empty">MIDES Florida</div>'}<span>${esc(x.tag||x.categoria)}</span></div>
 <div class="news-body"><div class="meta"><span>${esc(formatDate(x.fecha))}</span><span>${esc(x.categoria)}</span></div>
 <h3>${esc(x.titulo)}</h3><p>${esc(x.resumen)}</p>${mediaBadges(x)}<a href="comunicado.html?id=${encodeURIComponent(x.id)}">Ver comunicado y material →</a></div></article>`).join("")||'<div class="empty">No encontramos contenidos publicados con esos criterios.</div>';
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