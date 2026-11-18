(function(){
"use strict";
const $=id=>document.getElementById(id);
function status(message,type){const el=$("voice-status");if(el){el.textContent=message;el.className="action-status "+(type||"")}}
window.loadVoiceStudio=function(){};
document.addEventListener("DOMContentLoaded",()=>{
 const copy=$("voice-generate-btn"),open=$("voice-open-btn"),clear=$("voice-clear-btn"),field=$("voice-text");
 if(!copy||!open||!clear||!field)return;
 copy.addEventListener("click",async()=>{
  const text=field.value.trim();
  if(!text)return status("Escribí o pegá un texto antes de copiarlo.","error");
  if(text.length>2000)return status("El texto supera el máximo de 8.000 caracteres.","error");
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