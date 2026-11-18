(function(){
"use strict";
const $=id=>document.getElementById(id);
let generatedUrl="";
function status(message,type){const el=$("voice-status");if(el){el.textContent=message;el.className="action-status "+(type||"")}}
function cleanText(value){const box=document.createElement("div");box.innerHTML=String(value||"");return (box.textContent||box.innerText||"").replace(/\s+/g," ").trim()}
window.loadVoiceStudio=async function(){
 const select=$("voice-publication-select");
 if(select){
  const previous=select.value;
  const published=(typeof items!=="undefined"?items:[]).filter(x=>String(x.estado||"").trim().toLowerCase()==="publicado");
  select.innerHTML='<option value="">Seleccioná un comunicado publicado…</option>'+published.map(x=>'<option value="'+String(x.id).replace(/&/g,"&amp;").replace(/"/g,"&quot;")+'">'+String(x.titulo||"Sin título").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+'</option>').join("");
  if(published.some(x=>String(x.id)===previous))select.value=previous;
 }
 const loadBtn=$("voice-load-publication-btn");
 if(loadBtn&&!loadBtn.dataset.bound){loadBtn.dataset.bound="1";loadBtn.addEventListener("click",()=>{
  const id=$("voice-publication-select").value;
  const item=(typeof items!=="undefined"?items:[]).find(x=>String(x.id)===id);
  if(!item)return status("Seleccioná primero un comunicado publicado.","error");
  const text=[item.titulo,item.resumen,item.contenido].map(cleanText).filter(Boolean).join("\n\n");
  $("voice-text").value=text;
  status("Comunicado cargado desde Google Sheets ("+text.length+" caracteres). Podés editarlo antes de generar el audio.","success");
 })}
 await loadVoices();
};
async function loadVoices(){
 const provider=$("voice-provider"),voiceSelect=$("voice-voice"),gender=$("voice-gender");
 if(!provider||!voiceSelect)return;
 voiceSelect.innerHTML='<option value="">Consultando voces…</option>';
 try{
  const data=await post("voiceVoices",{provider:provider.value});
  const voices=Array.isArray(data.voices)?data.voices:[];
  const filtered=voices.filter(v=>!gender||gender.value==="all"||String(v.gender||"").toLowerCase()===gender.value);
  voiceSelect.innerHTML=filtered.length?filtered.map(v=>'<option value="'+escapeAttr(v.id)+'" data-model="'+escapeAttr(v.model||"kokoro")+'">'+escapeHtml(v.name)+' · '+(v.gender==="male"?"Masculina":v.gender==="female"?"Femenina":"Español")+'</option>').join(""):'<option value="">No hay voces españolas disponibles</option>';
  if(provider.value==="freetts"&&!data.voices.length)status("FreeTTS no devolvió voces. Verificá la clave API configurada en Apps Script.","error");
  else status("Catálogo actualizado: "+filtered.length+" voces en español.","success");
 }catch(err){
  voiceSelect.innerHTML='<option value="">No se pudo cargar el catálogo</option>';
  status(err.message||"No se pudieron consultar las voces.","error");
 }
}
function escapeHtml(v){return String(v||"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}
function escapeAttr(v){return escapeHtml(v).replace(/'/g,"&#39;")}
document.addEventListener("DOMContentLoaded",()=>{
 const field=$("voice-text"),provider=$("voice-provider"),generate=$("voice-generate-btn"),audio=$("voice-audio"),download=$("voice-download");
 if(!field||!generate)return;
 if(provider)provider.addEventListener("change",loadVoices);
 if($("voice-gender"))$("voice-gender").addEventListener("change",loadVoices);
 if($("voice-preview-btn"))$("voice-preview-btn").addEventListener("click",()=>{
  const text=field.value.trim();if(!text)return status("Escribí o cargá un texto antes de escucharlo.","error");
  if(!("speechSynthesis" in window))return status("Este navegador no ofrece lectura de voz.","error");
  window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="es-UY";u.onstart=()=>status("Reproduciendo una prueba del navegador. Esto no genera un MP3.","success");u.onerror=()=>status("No se pudo reproducir la prueba.","error");window.speechSynthesis.speak(u);
 });
 if($("voice-stop-preview-btn"))$("voice-stop-preview-btn").addEventListener("click",()=>{if("speechSynthesis"in window)window.speechSynthesis.cancel();status("Prueba detenida.")});
 generate.addEventListener("click",async()=>{
  const text=field.value.trim(),voice= $("voice-voice")?.value||"";
  if(!text)return status("Escribí o cargá un texto antes de generar el audio.","error");
  if(text.length>5000)return status("El texto supera los 5.000 caracteres gratuitos por generación. Dividilo en partes.","error");
  if(!voice)return status("Seleccioná una voz disponible.","error");
  generate.disabled=true;generate.textContent="Generando MP3…";
  try{
   const option=$("voice-voice").selectedOptions[0],model=option?.dataset.model||"kokoro";
   const result=await post("voiceGenerate",{provider:provider.value,voice,model,text,speed:$("voice-rate")?.value||"1"});
   if(!result.audio||!Array.isArray(result.audio.parts)||!result.audio.parts.length)throw new Error("El proveedor no devolvió un archivo de audio.");
   const blobs=result.audio.parts.map(b64=>{const raw=atob(b64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes});
   const blob=new Blob(blobs,{type:"audio/mpeg"});
   if(generatedUrl)URL.revokeObjectURL(generatedUrl);
   generatedUrl=URL.createObjectURL(blob);
   if(audio){audio.src=generatedUrl;audio.hidden=false}
   if(download){download.href=generatedUrl;download.download=result.audio.filename||"mides-voz-ia.mp3";download.hidden=false}
   status("MP3 generado correctamente. "+result.audio.characters+" caracteres · "+result.audio.partCount+" fragmento(s). Escuchalo y descargalo.","success");
  }catch(err){status(err.message||"No se pudo generar el audio.","error")}
  finally{generate.disabled=false;generate.textContent="Generar MP3"}
 });
 if($("voice-clear-btn"))$("voice-clear-btn").addEventListener("click",()=>{
  field.value="";if(audio){audio.removeAttribute("src");audio.hidden=true}if(download)download.hidden=true;
  if(generatedUrl){URL.revokeObjectURL(generatedUrl);generatedUrl=""}status("Texto y resultado limpiados.");
 });
 const open=$("voice-open-btn");if(open)open.addEventListener("click",()=>window.open("https://freereadtext.com/es","_blank","noopener"));
});
})();