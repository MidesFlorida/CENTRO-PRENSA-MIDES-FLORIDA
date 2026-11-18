(function(){
"use strict";
const $=id=>document.getElementById(id);
function status(message,type){const el=$("voice-status");if(el){el.textContent=message;el.className="action-status "+(type||"")}}
window.loadVoiceStudio=function(){
 const select=$("voice-publication-select");
 if(!select)return;
 const previous=select.value;
 const published=(typeof items!=="undefined"?items:[]).filter(x=>String(x.estado||"").trim().toLowerCase()==="publicado");
 select.innerHTML='<option value="">Seleccioná un comunicado publicado…</option>'+published.map(x=>'<option value="'+String(x.id).replace(/&/g,"&amp;").replace(/"/g,"&quot;")+'">'+String(x.titulo||"Sin título").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+'</option>').join("");
 if(published.some(x=>String(x.id)===previous))select.value=previous;
 const btn=$("voice-load-publication-btn");
 if(btn&&!btn.dataset.bound){btn.dataset.bound="1";btn.addEventListener("click",()=>{
  const item=published.find(x=>String(x.id)===select.value);
  if(!item)return status("Seleccioná primero un comunicado publicado.","error");
  const clean=value=>{const box=document.createElement("div");box.innerHTML=String(value||"");return (box.textContent||box.innerText||"").replace(/\\s+/g," ").trim()};
  const text=[item.titulo,item.resumen,item.contenido].map(clean).filter(Boolean).join("\\n\\n");
  $("voice-text").value=text;
  status(text.length>2000?"Comunicado cargado ("+text.length+" caracteres). Supera el límite de 2.000 caracteres de FreeReadText; dividilo o prepará una versión resumida.":"Comunicado cargado desde Google Sheets ("+text.length+" caracteres). Podés editarlo antes de narrar.","success");
 })}
};
document.addEventListener("DOMContentLoaded",()=>{
 const copy=$("voice-generate-btn"),open=$("voice-open-btn"),clear=$("voice-clear-btn"),field=$("voice-text"),preview=$("voice-preview-btn"),stop=$("voice-stop-preview-btn");
 if(!copy||!open||!clear||!field)return;\n if(preview)preview.addEventListener("click",()=>{const text=field.value.trim();if(!text)return status("Escribí o cargá un texto antes de escucharlo.","error");if(!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window))return status("Este navegador no ofrece lectura de voz. Usá el generador externo.","error");window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang="es-UY";utterance.rate=1;utterance.pitch=1;utterance.onstart=()=>status("Reproduciendo una prueba con las voces disponibles en este dispositivo. Esto no genera un MP3.","success");utterance.onerror=()=>status("No se pudo reproducir la prueba en este navegador.","error");utterance.onend=()=>status("Prueba finalizada. Para descargar un MP3, usá el generador externo autorizado.","success");window.speechSynthesis.speak(utterance)});\n if(stop)stop.addEventListener("click",()=>{if("speechSynthesis" in window)window.speechSynthesis.cancel();status("Prueba detenida.")});
 copy.addEventListener("click",async()=>{
  const text=field.value.trim();
  if(!text)return status("Escribí o pegá un texto antes de copiarlo.","error");
  if(text.length>2000)return status("El texto supera el máximo de 2.000 caracteres de FreeReadText. Dividilo en bloques o prepará una versión más breve.","error");
  try{
   await navigator.clipboard.writeText(text);
   $("voice-result").hidden=false;
   status("✓ Texto copiado. Ahora abrí FreeReadText, pegalo y generá el audio.","success");
  }catch(_){
   field.focus();field.select();
   status("El navegador no permitió copiar automáticamente. Seleccioná el texto y copialo con Ctrl+C.","error");
  }
 });
 open.addEventListener("click",()=>window.open("https://freereadtext.com/es","_blank","noopener"));
 clear.addEventListener("click",()=>{
  field.value="";$("voice-result").hidden=true;status("Texto limpiado.");
 });
});
})();