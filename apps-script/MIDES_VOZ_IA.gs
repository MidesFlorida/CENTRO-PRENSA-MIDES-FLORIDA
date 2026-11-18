/**
 * MIDES VOZ IA - servicio independiente para Google Apps Script.
 * Configurar Script Properties:
 * CENTRO_PRENSA_ADMIN_KEY = la misma clave editorial del Centro de Prensa
 * AZURE_SPEECH_KEY = clave del recurso Azure Speech
 * AZURE_SPEECH_REGION = región del recurso (ej.: eastus)
 *
 * Desplegar como Aplicación web: ejecutar como propietario; acceso según la política
 * institucional. La clave editorial se valida en cada solicitud.
 */
function doPost(e) {
  var p = (e && e.parameter) || {};
  var token = String(p.transportToken || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  var response;
  try {
    if (p.action !== 'synthesize') throw new Error('Acción no reconocida.');
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty('CENTRO_PRENSA_ADMIN_KEY') || '';
    if (!expected || !p.key || !constantTimeEqual_(String(p.key), expected)) {
      throw new Error('Acceso no autorizado. Verificá la clave editorial.');
    }
    var text = String(p.text || '').trim();
    if (!text) throw new Error('El texto está vacío.');
    if (text.length > 8000) throw new Error('El texto supera los 8.000 caracteres.');
    var voices = {
      'es-UY-MateoNeural': 'es-UY',
      'es-UY-ValentinaNeural': 'es-UY'
    };
    var voice = String(p.voice || '');
    if (!voices[voice]) throw new Error('La voz seleccionada no está habilitada.');
    var region = String(props.getProperty('AZURE_SPEECH_REGION') || '').trim();
    var azureKey = String(props.getProperty('AZURE_SPEECH_KEY') || '').trim();
    if (!region || !azureKey) throw new Error('Falta configurar AZURE_SPEECH_KEY o AZURE_SPEECH_REGION en las propiedades del script.');
    var format = p.format === 'wav' ? 'wav' : 'mp3';
    var output = format === 'wav' ? 'riff-24khz-16bit-mono-pcm' : 'audio-24khz-160kbitrate-mono-mp3';
    var rate = ['-5%', '0%', '5%'].indexOf(p.rate) >= 0 ? p.rate : '0%';
    var pitch = p.style === 'emotional' ? '+2%' : (p.style === 'informative' ? '-1%' : '+0%');
    var safeText = escapeXml_(text);
    var ssml = '<speak version="1.0" xml:lang="es-UY"><voice name="' + voice + '"><prosody rate="' + rate + '" pitch="' + pitch + '">' + safeText + '</prosody></voice></speak>';
    var url = 'https://' + region + '.tts.speech.microsoft.com/cognitiveservices/v1';
    var azure = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/ssml+xml',
      payload: ssml,
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'X-Microsoft-OutputFormat': output,
        'User-Agent': 'MIDES-Florida-Voz-IA'
      },
      muteHttpExceptions: true
    });
    var code = azure.getResponseCode();
    if (code < 200 || code >= 300) {
      var detail = azure.getContentText() || '';
      throw new Error('Azure Speech respondió HTTP ' + code + (detail ? ': ' + detail.slice(0, 350) : '. Verificá la región, la clave y la disponibilidad del servicio.'));
    }
    var bytes = azure.getContent();
    if (!bytes || !bytes.length) throw new Error('Azure no devolvió contenido de audio.');
    response = {
      ok: true,
      audioBase64: Utilities.base64Encode(bytes),
      mimeType: format === 'wav' ? 'audio/wav' : 'audio/mpeg',
      fileName: 'mides-florida-' + voice.replace(/[^a-zA-Z0-9-]/g, '') + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '.' + format
    };
  } catch (err) {
    response = { ok: false, error: String(err && err.message || err) };
  }
  var payload = JSON.stringify({ channel: 'mides-voz-ia', token: token, response: response }).replace(/</g, '\\u003c');
  var html = '<!doctype html><html><head><meta charset="utf-8"></head><body><script>window.parent.postMessage(' + payload + ', "*");</script></body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function escapeXml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function constantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}