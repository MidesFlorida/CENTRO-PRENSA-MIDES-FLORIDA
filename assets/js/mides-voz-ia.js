(function(){
"use strict";
const $=id=>document.getElementById(id);
let loaded=false,lastUrl="";
function status(message,type){const el=$("voice-status");if(el){el.textContent=message;el.className="action-status "+(type||"")}}
function cleanupUrl(){if(lastUrl){URL.revokeObjectURL(lastUrl);lastUrl=""}}
function base64ToBlob(b64,mime){const binary=atob(b64),parts=[];for(let i=0;i<binary.length;i+=1024){const slice=binary.slice(i,i+1024),bytes=new Uint8Array(slice.length);for(let j=0;j<slice.length;j++)bytes[j]=slice.charCodeAt(j);parts.push(bytes)}return new Blob(parts,{type:mime})}
function requestVoice(payload){
 return new Promise((resolve,reject)=>{
  const endpoint=window.PRENSA_CONFIG&&window.PRENSA_CONFIG.voiceApiUrl;
  if(!endpoint) return reject(new Error("Falta configurar voiceApiUrl en config.js. Primero hay que desplegar el servicio MIDES Voz IA."));
  const token="midesVoice_"+Date.now()+"_"+Math.floor(Math.random()*1e9),name="midesVoiceFrame_"+token;
  const frame=document.createElement("iframe");frame.name=name;frame.title="Generación segura de locución";frame.hidden=true;
  const form=document.createElement("form");form.method="POST";form.action=endpoint;form.target=name;form.enctype="application/x-www-form-urlencoded";form.style.display="none";
  const data={...payload,transportToken:token};
  Object.entries(data).forEach(([k,v])=>{const input=document.createElement("input");input.type="hidden";input.name=k;input.value=String(v??"");form.appendChild(input)});
  let settled=false,timer;
  const done=()=>{if(settled)return;settled=true;clearTimeout(timer);window.removeEventListener("message",onMessage);form.remove();frame.remove()};
  const onMessage=e=>{const d=e.data;if(!d||d.channel!=="mides-voz-ia"||d.token!==token)return;if(!/^https:\/\/(?:script\.google\.com|(?:[a-z0-9-]+\.)*googleusercontent\.com)$/i.test(e.origin))return;done();if(!d.response||!d.response.ok)return reject(new Error(d.response&&d.response.error||"No se pudo generar el audio."));resolve(d.response)};
  window.addEventListener("message",onMessage);timer=setTimeout(()=>{done();reject(new Error("El servicio de voz no respondió en 120 segundos. Revisá su implementación de Apps Script."))},120000);
  document.body.appendChild(frame);document.body.appendChild(form);form.submit();
 });
}
window.loadVoiceStudio=function(){loaded=true};
document.addEventListener("DOMContentLoaded",()=>{
 const generate=$("voice-generate-btn");if(!generate)return;
 $("voice-clear-btn").onclick=()=>{$("voice-text").value="";$("voice-result").hidden=true;cleanupUrl();status("Texto limpiado.")};
 generate.onclick=async()=>{
  const text=$("voice-text").value.trim();
  if(!text)return status("Pegá o escribí un texto antes de generar la locución.","error");
  if(text.length>8000)return status("El texto supera el máximo de 8.000 caracteres.","error");
  const key=typeof editorKey!=="undefined"?editorKey:"";
  if(!key)return status("La sesión editorial no está autenticada. Volvé a ingresar al panel.","error");
  generate.disabled=true;generate.textContent="Generando audio…";$("voice-result").hidden=true;cleanupUrl();
  try{
   status("Conectando con el servicio de voz uruguaya…");
   const result=await requestVoice({action:"synthesize",key,text,voice:$("voice-speaker").value,style:$("voice-style").value,rate:$("voice-rate").value,format:$("voice-format").value});
   const mime=result.mimeType||($("voice-format").value==="wav"?"audio/wav":"audio/mpeg");
   const blob=base64ToBlob(result.audioBase64,mime);lastUrl=URL.createObjectURL(blob);
   const audio=$("voice-audio"),download=$("voice-download");audio.src=lastUrl;download.href=lastUrl;download.download=result.fileName||("mides-florida-locucion."+($("voice-format").value));$("voice-result").hidden=false;
   status("✓ Locución generada correctamente. Reproducila y descargala para tu edición audiovisual.","success");
  }catch(e){status("No se pudo generar la locución: "+e.message,"error")}
  finally{generate.disabled=false;generate.textContent="Generar locución"}
 };
});
})();