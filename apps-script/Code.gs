const CONFIG = {
  spreadsheetId: '113AiF1ahuZuEW9PWeHNhJYdJXMidZd084LmYOx7N6NU',
  contactSpreadsheetId: '113AiF1ahuZuEW9PWeHNhJYdJXMidZd084LmYOx7N6NU',
  sheetName: 'Comunicados',
  // Claves directas aceptadas para el Panel Editorial (se conserva la anterior).
  adminKeys: ['Ik3r2026', 'Svelez2026'],
  adminKey: 'Ik3r2026',
  driveRootFolderId: '1bgzF1n5ufGlIQ84ykL90pAnJqvoWL2ET'
};

// Permite comprobar desde la URL pública qué versión del backend está desplegada.
const API_VERSION = '2026-10-23-mapa5k-v4';

const HEADERS = ['ID','Estado','Fecha','Categoria','Tag','Titulo','Resumen','Contenido','FotoPrincipal','Fotos','VideoURL','VideoDriveFileId','VideoDriveUrl','VideoDriveFolderId','FechaCreacion','FechaActualizacion','AudioURL','AudioDriveFileId','AudioDriveUrl'];

function getSpreadsheet_() {
  return CONFIG.spreadsheetId ? SpreadsheetApp.openById(CONFIG.spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_() {
  const ss=getSpreadsheet_();
  let sh=ss.getSheetByName(CONFIG.sheetName);
  if(!sh) sh=ss.insertSheet(CONFIG.sheetName);
  if(sh.getLastRow()===0) sh.appendRow(HEADERS);
  ensureHeaders_(sh);
  return sh;
}
function ensureHeaders_(sh,headers){
  headers=headers||HEADERS;
  const width=Math.max(sh.getLastColumn(),headers.length);
  const current=width?sh.getRange(1,1,1,width).getValues()[0]:[];
  let changed=false;
  headers.forEach((h,i)=>{if(current[i]!==h){current[i]=h;changed=true;}});
  if(changed)sh.getRange(1,1,1,width).setValues([current]);
}
function prepararHojasCentroPrensa_(){
  // Inicialización idempotente: crea o normaliza hojas sin borrar filas ni pestañas.
  getSheet_();
  // Si no existe la fuente de contactos, crear una pestaña vacía con encabezados
  // compatibles con una exportación de Google Contacts. Nunca reescribir una fuente existente.
  if(!getSpreadsheet_().getSheetByName(CONTACT_SOURCE_SHEET)){
    getNamedSheet_(CONTACT_SOURCE_SHEET,['Given Name','Family Name','Name','E-mail 1 - Value','Phone 1 - Value','Organization 1 - Name','Organization 1 - Title','Address 1 - City']);
  }
  ensureContactsStructure_();
  getNamedSheet_(CONTACTS_SHEET,CONTACT_HEADERS);
  getMailingSheet_();
  getFuncionarioSheet_();
  getAgendaSheet_();
  const normalized=getSpreadsheet_().getSheetByName(CONTACTS_SHEET);
  const source=contactSource_();
  // Importa solo en el primer arranque de una hoja normalizada vacía.
  if(normalized && normalized.getLastRow()<2 && source.sheet && source.rows.length>1){
    syncContactsNormalized_();
  }
}

function autorizarCentroPrensa(){
  // Ejecutar manualmente desde Apps Script con la cuenta que implementa el Web App.
  // Primero solicita los permisos básicos de Sheets y Drive y valida la carpeta configurada.
  const ss=getSpreadsheet_();
  if(!ss)throw new Error('No se pudo acceder a la hoja de cálculo.');
  prepararHojasCentroPrensa_();
  let root;
  try{
    root=DriveApp.getRootFolder();
    root.getName();
  }catch(err){
    throw new Error('Google Drive todavía no está autorizado para esta cuenta. Ejecutá esta función desde el editor de Apps Script, aceptá los permisos de Drive y volvé a ejecutarla. Detalle: '+String(err));
  }
  let message='Permisos de Google Sheets, Drive y solicitudes externas verificados.';
  if(CONFIG.driveRootFolderId){
    try{
      DriveApp.getFolderById(CONFIG.driveRootFolderId).getName();
    }catch(err){
      // No bloquea la autorización general: getDriveRoot_ usará la carpeta alternativa de la aplicación.
      message+=' La carpeta configurada no está disponible para esta cuenta; se utilizará la carpeta alternativa Centro de Prensa MIDES Florida en Mi unidad. Detalle: '+String(err);
    }
  }
  const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user',{
    headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
    muteHttpExceptions:true
  });
  if(response.getResponseCode()<200||response.getResponseCode()>=300){
    throw new Error('Drive quedó accesible, pero la prueba de solicitudes externas devolvió HTTP '+response.getResponseCode()+': '+response.getContentText().slice(0,300));
  }
  return message;
}

function setup(){
  prepararHojasCentroPrensa_();
  const sh=getSheet_();
  ensureHeaders_(sh,HEADERS);
  sh.setFrozenRows(1);
  SpreadsheetApp.flush();
  const diagnostic=diagnosticoHojasCentroPrensa_();
  const missing=diagnostic.filter(x=>!x.existe).map(x=>x.nombre);
  if(missing.length)throw new Error('Faltan hojas después de inicializar: '+missing.join(', '));
  const result={ok:true,message:'Estructura inicializada y verificada sin borrar datos existentes.',sheets:diagnostic};
  Logger.log(JSON.stringify(result,null,2));
  return result;
}
function doGet(e){
  let result;
  try{
    const a=(e&&e.parameter&&e.parameter.action)||'list';
    if(a==='ping') result={ok:true,service:'Centro de Prensa MIDES Florida'};
    else if(a==='list') result={ok:true,items:listPublishedDirect_()};
    else if(a==='upcomingActivities'){
      // Comparar las fechas como hora local de la hoja (Uruguay), no como UTC.
      // Así no se descartan actividades válidas por diferencias de zona horaria.
      const nowKey=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss');
      const limit=new Date();limit.setDate(limit.getDate()+365);
      const limitKey=Utilities.formatDate(limit,Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss');
      const items=listAgenda_()
        .filter(x=>{
          if(normalizeText_(String(x.estado||'Activa').trim())!=='activa')return false;
          const key=String(x.inicio||'').trim().replace('T',' ').slice(0,19);
          return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(key)&&key>=nowKey&&key<=limitKey;
        })
        .sort((x,y)=>String(x.inicio).localeCompare(String(y.inicio)))
        .map(x=>({id:x.id,inicio:x.inicio,fin:x.fin,actividad:x.actividad,lugar:x.lugar,descripcion:x.descripcion,imagenUrl:x.imagenUrl,estado:x.estado}));
      result={ok:true,items};
    }
    else if(a==='get'){const item=findById_(e.parameter.id);const publicItem=item&&normalizeStatus_(item.estado)==='publicado'?item:null;result={ok:!!publicItem,item:publicItem};}
    else if(a==='mailing'){const item=getMailing_(e.parameter.id);result={ok:!!item,item:item||null};}
    else if(a==='editorBridge') {
      // Transporte JSONP para el panel editorial: evita el bloqueo CORS de fetch desde GitHub Pages.
      // El cliente envía los datos como Base64 UTF-8 dentro de data64.
      const packed=String((e&&e.parameter&&e.parameter.data64)||'');
      const decoded=Utilities.newBlob(Utilities.base64Decode(packed)).getDataAsString('UTF-8');
      result=editorBridgeAction_(JSON.parse(decoded));
    }
    else if(a==='mapa5kInicializar') {
      // Inicialización explícita y segura: crea Mapa5K y sus encabezados si faltan.
      // Nunca borra filas existentes.
      result=prepararMapa5K();
    }
    else if(a==='mapa5kList') result={ok:true,items:mapa5kList_()};
    else if(a==='mapa5kDiagnostico') {
      const sh=mapa5kSheet_();
      result={ok:true,spreadsheetId:MAPA5K_SPREADSHEET_ID_,sheetName:sh.getName(),headers:sh.getRange(1,1,1,MAPA5K_HEADERS_.length).getDisplayValues()[0],elements:Math.max(0,sh.getLastRow()-1),lastRow:sh.getLastRow()};
    }
    else if(a==='mapa5kSave') {
      const payload=JSON.parse(String(e.parameter.data||'{}'));
      const acceptedKeys = Array.isArray(CONFIG.adminKeys) && CONFIG.adminKeys.length ? CONFIG.adminKeys : [CONFIG.adminKey];
      if(!acceptedKeys.some(k=>String(k||'')===String(payload.key||''))) throw new Error('Clave de edición del mapa incorrecta.');
      result={ok:true,items:mapa5kSave_(payload.items||[])};
    }
    else result={ok:false,error:'Acción GET no válida'};
  }catch(err){result={ok:false,error:String(err)};}
  // Marca la versión en todas las respuestas para detectar despliegues antiguos.
  result.apiVersion = API_VERSION;
  result.jsonpSupported = true;
  // GitHub Pages no puede leer directamente el JSON de Apps Script por CORS.
  // La modalidad JSONP permite la lectura pública sin credenciales ni cambios en Sheets.
  const callback=String((e&&e.parameter&&e.parameter.callback)||'');
  if(callback){
    if(!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)){
      return ContentService.createTextOutput('/* callback no válido */').setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(callback+'('+JSON.stringify(result)+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(result);
}


/**
 * Acciones editoriales de bajo volumen servidas mediante JSONP desde doGet.
 * Las cargas multimedia grandes continúan utilizando doPost.
 * El mismo control de clave que doPost se aplica antes de cualquier operación.
 */
function editorBridgeAction_(p) {
  p=p||{};
  const action=String(p.action||'');
  const suppliedKey=String(p.key||'');
  const acceptedKeys=Array.isArray(CONFIG.adminKeys)&&CONFIG.adminKeys.length?CONFIG.adminKeys:[CONFIG.adminKey];
  if(!acceptedKeys.some(k=>String(k||'')===suppliedKey)) throw new Error('Clave editorial incorrecta.');
  switch(action) {
    case 'adminList':
      return {ok:true,items:readAll_().sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)))};
    case 'adminGet':
      return {ok:true,item:findById_(p.id)};
    case 'save':
      return {ok:true,item:save_(p)};
    case 'savePublish':
      return {ok:true,item:saveAndPublish_(p)};
    case 'publish': {
      const item=setStatus_(p.id,'Publicado');
      return {ok:!!item,item:item,error:item?null:'No se encontró el comunicado para publicar.'};
    }
    case 'unpublish': {
      const item=setStatus_(p.id,'Borrador');
      return {ok:!!item,item:item,error:item?null:'No se encontró el comunicado para despublicar.'};
    }
    case 'delete': {
      const deleted=delete_(p.id);
      return {ok:deleted,error:deleted?null:'No se encontró el comunicado para eliminar.'};
    }
    default:
      throw new Error('La acción no está habilitada para el transporte editorial JSONP: '+action);
  }
}

const CONTACT_HEADERS=['ID','Nombre','Apellido','NombreCompleto','Medio','Cargo','Email','Telefono','Localidad','Listas','Estado','Observaciones','FechaActualizacion'];
const LIST_HEADERS=['ID','Nombre','Descripcion','Estado','FechaCreacion','FechaActualizacion'];
const MEMBERSHIP_HEADERS=['ContactoID','ListaID','FechaAsignacion'];
const CAMPAIGN_HEADERS=['ID','Fecha','Asunto','ComunicadoID','ListaIDs','Destinatarios','Estado','Notas'];
const MAILING_HEADERS=['ID','Fecha','Asunto','ListaIDs','ComunicadoIDs','Destinatarios','Estado','PublicUrl','WhatsAppUrl'];
const CONTACT_SOURCE_SHEET='Contactos', CONTACTS_SHEET='Contactos_Normalizados', LISTS_SHEET='ListasMailing', MEMBERSHIPS_SHEET='Contactos_Listas', CAMPAIGNS_SHEET='Mailing_Campañas';
function ensureContactsStructure_(){ensureLists_();getNamedSheet_(MEMBERSHIPS_SHEET,MEMBERSHIP_HEADERS);getNamedSheet_(CAMPAIGNS_SHEET,CAMPAIGN_HEADERS);}
function getNamedSheet_(name,headers){
 const ss=getSpreadsheet_();let sh=ss.getSheetByName(name),created=false;
 if(!sh){sh=ss.insertSheet(name);created=true;}
 const empty=sh.getLastRow()===0;
 if(empty)sh.getRange(1,1,1,headers.length).setValues([headers]);
 ensureHeaders_(sh,headers);
 if(created||empty){sh.setFrozenRows(1);const h=sh.getRange(1,1,1,headers.length);h.setFontWeight('bold').setBackground('#005ca9').setFontColor('#ffffff');}
 return sh;
}
function diagnosticoHojasCentroPrensa_(){
 const ss=getSpreadsheet_(),keep=[CONFIG.sheetName,CONTACT_SOURCE_SHEET,CONTACTS_SHEET,LISTS_SHEET,MEMBERSHIPS_SHEET,CAMPAIGNS_SHEET,'Mailings',FUNC_SHEET,AGENDA_SHEET];
 const actual=ss.getSheets().map(sh=>({nombre:sh.getName(),filas:sh.getLastRow(),columnas:sh.getLastColumn(),oficial:keep.includes(sh.getName()),vacia:sh.getLastRow()<=1,existe:true}));
 const missing=keep.filter(name=>!ss.getSheetByName(name)).map(nombre=>({nombre,filas:0,columnas:0,oficial:true,vacia:true,existe:false}));
 return actual.concat(missing);
}
function normalizeHeader_(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
function contactHeaderMap_(sh){const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0],m={};h.forEach((x,i)=>m[normalizeHeader_(x)]=i);return m;}
function firstCol_(m,names){for(const n of names){const k=normalizeHeader_(n);if(m[k]!==undefined)return m[k];}return -1;}
function contactSource_(){const sh=getSpreadsheet_().getSheetByName(CONTACT_SOURCE_SHEET);if(!sh||sh.getLastRow()<2)return {sheet:sh,rows:[],map:{}};return {sheet:sh,rows:sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues(),map:contactHeaderMap_(sh)};}
function sourceContact_(r,m){const val=a=>{const c=firstCol_(m,a);return c>=0?String(r[c]??'').trim():''};const nombre=val(['Nombre','First Name','Given Name']),apellido=val(['Apellido','Last Name','Family Name']),nombreCompleto=val(['NombreCompleto','Nombre completo','Name','Display Name'])||[nombre,apellido].filter(Boolean).join(' ');const emailPrincipal=val(['E-mail 1 - Value']);const emailFallback=val(['Email','E-mail','Correo electrónico','Correo','Email 1 - Value']);return {nombre,apellido,nombreCompleto,email:emailPrincipal||emailFallback,telefono:val(['Telefono','Teléfono','Phone','Mobile Phone','Phone 1 - Value']),medio:val(['Medio','Organization','Organización','Empresa','Company','Organization 1 - Name']),cargo:val(['Cargo','Title','Puesto','Organization 1 - Title']),localidad:val(['Localidad','Ciudad','City','Address 1 - City'])};}
function contactRow_(r){return {id:String(r[0]),nombre:String(r[1]||''),apellido:String(r[2]||''),nombreCompleto:String(r[3]||''),medio:String(r[4]||''),cargo:String(r[5]||''),email:String(r[6]||''),telefono:String(r[7]||''),localidad:String(r[8]||''),listas:String(r[9]||'').split(';').map(x=>x.trim()).filter(Boolean),estado:String(r[10]||'Activo'),observaciones:String(r[11]||''),fechaActualizacion:formatDateTime_(r[12])};}
function syncContactsNormalized_(){
 const src=contactSource_();if(!src.sheet)throw new Error('No existe la hoja Contactos.');
 const sh=getNamedSheet_(CONTACTS_SHEET,CONTACT_HEADERS),out=[],seen={},existing={};
 if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,CONTACT_HEADERS.length).getValues().forEach(r=>{
   const key=String(r[6]||'').trim().toLowerCase()||String(r[7]||'').trim()||String(r[3]||'').trim().toLowerCase();
   if(key)existing[key]=r;
 });
 src.rows.slice(1).forEach(r=>{
  const o=sourceContact_(r,src.map);if(!(o.nombreCompleto||o.email||o.telefono))return;
  const key=String(o.email||'').trim().toLowerCase()||String(o.telefono||'').trim()||String(o.nombreCompleto||'').trim().toLowerCase();
  const id='C-'+Utilities.base64EncodeWebSafe(key).replace(/=+$/,'').slice(0,36);
  if(seen[id])return;seen[id]=1;
  const prior=existing[key]||[];
  out.push([id,o.nombre,o.apellido,o.nombreCompleto,o.medio,o.cargo,o.email,o.telefono,o.localidad,prior[9]||'',prior[10]||'Activo',prior[11]||'',prior[12]||formatDateTime_(new Date())]);
 });
 if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,CONTACT_HEADERS.length).clearContent();
 if(out.length)sh.getRange(2,1,out.length,CONTACT_HEADERS.length).setValues(out);
 SpreadsheetApp.flush();return {imported:out.length,sourceRows:Math.max(0,src.rows.length-1)};
}
function readContacts_(){
 // La sincronización completa solo se ejecuta al inicializar una hoja vacía o mediante Importar.
 // No volver a sobrescribir cambios editoriales (estado, observaciones y listas) en cada lectura.
 let sh=getNamedSheet_(CONTACTS_SHEET,CONTACT_HEADERS);
 if(sh.getLastRow()<2){
   const src=contactSource_();
   if(src.sheet&&src.rows.length>1){syncContactsNormalized_();sh=getNamedSheet_(CONTACTS_SHEET,CONTACT_HEADERS);}
 }
 if(sh.getLastRow()<2)return [];
 const listNames={};listMailingLists_().forEach(x=>listNames[x.id]=x.nombre);
 const memberships={};const ms=getNamedSheet_(MEMBERSHIPS_SHEET,MEMBERSHIP_HEADERS);if(ms.getLastRow()>1)ms.getRange(2,1,ms.getLastRow()-1,3).getValues().forEach(r=>{if(r[0]&&r[1])(memberships[String(r[0])]||(memberships[String(r[0])]=[])).push(listNames[String(r[1])]||String(r[1]));});
 return sh.getRange(2,1,sh.getLastRow()-1,CONTACT_HEADERS.length).getValues().filter(r=>r[0]).map(r=>{const x=contactRow_(r);x.listas=memberships[x.id]||[];return x;});
}
function importContacts_(){return syncContactsNormalized_();}
function listContacts_(){ensureContactsStructure_();return readContacts_();}
function saveContact_(p){const sh=getNamedSheet_(CONTACTS_SHEET,CONTACT_HEADERS),id=p.id||'C-'+Utilities.getUuid().slice(0,8),old=readContacts_().find(x=>x.id===id),item=[id,p.nombre||'',p.apellido||'',p.nombreCompleto||[p.nombre,p.apellido].filter(Boolean).join(' '),p.medio||'',p.cargo||'',p.email||'',p.telefono||'',p.localidad||'',p.listas||'',p.estado||old?.estado||'Activo',p.observaciones||old?.observaciones||'',formatDateTime_(new Date())];const rows=sh.getDataRange().getValues();let n=-1;for(let i=1;i<rows.length;i++)if(String(rows[i][0])===id){n=i+1;break;}if(n<0)sh.appendRow(item);else sh.getRange(n,1,1,CONTACT_HEADERS.length).setValues([item]);return contactRow_(item);}
function setContactStatus_(id,status){const c=readContacts_().find(x=>x.id===id);if(!c)return null;c.estado=status;return saveContact_(c);}
function ensureLists_(){const sh=getNamedSheet_(LISTS_SHEET,LIST_HEADERS),have=sh.getDataRange().getValues().slice(1).map(r=>String(r[1]).toLowerCase());['Prensa Florida','Radios','Televisión','Prensa escrita','Medios digitales','Medios nacionales','Institucional','Prioritarios'].forEach(n=>{if(!have.includes(n.toLowerCase()))sh.appendRow(['L-'+Utilities.getUuid().slice(0,8),n,'','Activa',formatDateTime_(new Date()),formatDateTime_(new Date())]);});}
function listMailingLists_(){ensureLists_();const sh=getSpreadsheet_().getSheetByName(LISTS_SHEET);return sh.getLastRow()<2?[]:sh.getRange(2,1,sh.getLastRow()-1,LIST_HEADERS.length).getValues().filter(r=>r[0]).map(r=>({id:String(r[0]),nombre:String(r[1]),descripcion:String(r[2]||''),estado:String(r[3]||'Activa'),fechaCreacion:formatDateTime_(r[4]),fechaActualizacion:formatDateTime_(r[5])}));}
function saveMailingList_(p){const sh=getNamedSheet_(LISTS_SHEET,LIST_HEADERS),id=p.id||'L-'+Utilities.getUuid().slice(0,8),rows=sh.getDataRange().getValues(),now=formatDateTime_(new Date());let n=-1;for(let i=1;i<rows.length;i++)if(String(rows[i][0])===id){n=i+1;break;}const v=[id,p.nombre||'',p.descripcion||'',p.estado||'Activa',p.fechaCreacion||now,now];if(n<0)sh.appendRow(v);else sh.getRange(n,1,1,LIST_HEADERS.length).setValues([v]);return {id,nombre:v[1],descripcion:v[2],estado:v[3]};}
function setMailingListStatus_(id,status){const l=listMailingLists_().find(x=>x.id===id);return l?saveMailingList_({...l,estado:status}):null;}
function saveMemberships_(contactId,listIds){
  const sh=getNamedSheet_(MEMBERSHIPS_SHEET,MEMBERSHIP_HEADERS),rows=sh.getDataRange().getValues(),ids=String(listIds||'').split(',').map(x=>x.trim()).filter(Boolean);
  for(let i=rows.length-1;i>=1;i--)if(String(rows[i][0])===String(contactId))sh.deleteRow(i+1);
  ids.forEach(id=>sh.appendRow([contactId,id,formatDateTime_(new Date())]));
  return {contactId,listIds:ids};
}
function addContactsToList_(contactIds,listId){
  const ids=String(contactIds||'').split(',').map(x=>x.trim()).filter(Boolean),lid=String(listId||'').trim();
  if(!lid||!ids.length)throw new Error('Seleccioná contactos y una lista.');
  const sh=getNamedSheet_(MEMBERSHIPS_SHEET,MEMBERSHIP_HEADERS),rows=sh.getDataRange().getValues(),existing={};
  rows.slice(1).forEach(r=>{const k=String(r[0]||'')+'|'+String(r[1]||'');if(k!=='|')existing[k]=true;});
  let added=0;
  ids.forEach(cid=>{const k=cid+'|'+lid;if(!existing[k]){sh.appendRow([cid,lid,formatDateTime_(new Date())]);existing[k]=true;added++;}});
  return {contactIds:ids,listId:lid,added};
}
function previewCampaign_(p){const ids=String(p.listIds||'').split(',').map(x=>x.trim()).filter(Boolean),lists=listMailingLists_().filter(l=>ids.includes(l.id)),contacts=readContacts_().filter(c=>c.estado==='Activo'&&c.email),set={};contacts.forEach(c=>{const a=c.listas.map(x=>x.toLowerCase());if(lists.some(l=>a.includes(l.nombre.toLowerCase())))set[c.email.toLowerCase()]=c;});return {total:Object.keys(set).length,destinatarios:Object.values(set).map(c=>({id:c.id,nombre:c.nombreCompleto,email:c.email,medio:c.medio}))};}
function saveCampaign_(p){const sh=getNamedSheet_(CAMPAIGNS_SHEET,CAMPAIGN_HEADERS),preview=previewCampaign_(p),id=p.id||'M-'+Utilities.getUuid().slice(0,8),now=formatDateTime_(new Date());sh.appendRow([id,p.fecha||now,p.asunto||'',p.comunicadoId||'',p.listIds||'',preview.total,'Preparada',p.notas||'']);return {id,estado:'Preparada',destinatarios:preview.total};}
function getMailingSheet_(){return getNamedSheet_('Mailings',MAILING_HEADERS);}
function saveMailing_(p){
 const sh=getMailingSheet_(),id=p.id||'ML-'+Utilities.getUuid().slice(0,8),now=formatDateTime_(new Date());
 const listIds=String(p.listIds||'').split(',').map(x=>x.trim()).filter(Boolean),comunicadoIds=String(p.comunicadoIds||'').split(',').map(x=>x.trim()).filter(Boolean);
 const preview=previewCampaign_({listIds:listIds.join(',')}),publicUrl=String(p.publicUrl||'').trim(),whats=publicUrl?'https://wa.me/?text='+encodeURIComponent('Compartir mailing institucional MIDES Florida: '+publicUrl):'';
 const row=[id,p.fecha||now,p.asunto||'Mailing institucional',listIds.join(','),comunicadoIds.join(','),preview.total,'Publicado',publicUrl,whats];
 const rows=sh.getDataRange().getValues();let n=-1;for(let i=1;i<rows.length;i++)if(String(rows[i][0])===id){n=i+1;break}if(n<0)sh.appendRow(row);else sh.getRange(n,1,1,row.length).setValues([row]);
 return{id,fecha:row[1],asunto:row[2],listIds:row[3],comunicadoIds:row[4],destinatarios:preview.total,estado:row[6],publicUrl,whatsappUrl:whats};
}
function sendMailing_(id){
  const mailing=getMailing_(id);if(!mailing)throw new Error('No se encontró el mailing.');
  const preview=previewCampaign_({listIds:mailing.listaIds.join(',')});
  const emails=preview.destinatarios.map(x=>String(x.email||'').trim().toLowerCase()).filter(x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
  if(!emails.length)throw new Error('No hay destinatarios con correo válido en las listas seleccionadas.');
  const quota=MailApp.getRemainingDailyQuota();if(emails.length>quota)throw new Error('La cuota diaria de correo disponible ('+quota+') no alcanza para '+emails.length+' destinatarios.');
  const rows=mailing.items.map(x=>'<article style="margin:0 0 24px;padding:18px;border:1px solid #dce3e7;border-radius:10px"><h2 style="margin:0 0 8px">'+escapeHtml_(x.titulo)+'</h2><p style="margin:0 0 10px">'+escapeHtml_(x.resumen||'')+'</p><a href="'+escapeAttr_(mailing.publicUrl||'')+'" style="font-weight:700">Ver mailing institucional</a></article>').join('');
  const html='<div style="font-family:Arial,sans-serif;max-width:720px;margin:auto"><h1>MIDES Florida</h1><h2>'+escapeHtml_(mailing.asunto)+'</h2>'+rows+'<p><a href="'+escapeAttr_(mailing.publicUrl||'')+'">Abrir mailing institucional completo</a></p></div>';
  const body=mailing.asunto+'\n\n'+mailing.items.map(x=>x.titulo).join('\n')+'\n\n'+(mailing.publicUrl||'');
  const to=Session.getEffectiveUser().getEmail()||emails[0],bcc=emails.join(',');
  MailApp.sendEmail({to, bcc, subject:mailing.asunto, body, htmlBody:html, name:'MIDES Florida'});
  return {sent:emails.length,id};
}
function escapeHtml_(v){return String(v??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function escapeAttr_(v){return escapeHtml_(v).replace(/'/g,'&#39;')}
function getMailing_(id){
 if(!id)return null;const sh=getMailingSheet_();if(sh.getLastRow()<2)return null;
 const r=sh.getRange(2,1,sh.getLastRow()-1,MAILING_HEADERS.length).getValues().find(x=>String(x[0])===String(id));if(!r)return null;
 const ids=String(r[4]||'').split(',').map(x=>x.trim()).filter(Boolean);
 return{id:String(r[0]),fecha:formatDateTime_(r[1]),asunto:String(r[2]||''),listaIds:String(r[3]||'').split(',').filter(Boolean),destinatarios:Number(r[5]||0),estado:String(r[6]||''),publicUrl:String(r[7]||''),whatsappUrl:String(r[8]||''),items:ids.map(findById_).filter(x=>x&&x.estado==='Publicado')};
}


/* =========================
   AGENDA DE FUNCIONARIOS
   ========================= */
const FUNC_HEADERS=['ID','Nombre','Area','Password','Rol','Color','Estado','FechaCreacion','DebeCambiarPassword','FechaCambioPassword','UltimoAcceso'];
const AGENDA_HEADERS=['ID','UsuarioID','NombreUsuario','Area','Inicio','Fin','Actividad','Lugar','Descripcion','ImagenURL','FechaCreacion','Estado'];
const FUNC_SHEET='Funcionarios';
const AGENDA_SHEET='AgendaFuncionarios';
const AREA_PALETTE=['#005ca9','#177245','#8a4b08','#7b2cbf','#c0392b','#007f86','#9a6700','#31572c','#6a1b9a','#006d77','#a23e48','#3a506b'];

function normalizeText_(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
}
function makeFuncionarioPassword_(nombre,area,id){
  return String(nombre||'').trim().replace(/\s+/g,'')+'+'+String(area||'').trim().replace(/\s+/g,'')+'+'+id;
}
function getFuncionarioSheet_(){return getNamedSheet_(FUNC_SHEET,FUNC_HEADERS);}
function getAgendaSheet_(){return getNamedSheet_(AGENDA_SHEET,AGENDA_HEADERS);}
function areaColor_(area,excludeId){
  const sh=getFuncionarioSheet_(),rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,FUNC_HEADERS.length).getValues():[];
  for(const r of rows)if(String(r[2]||'').trim().toLowerCase()===String(area||'').trim().toLowerCase() && String(r[0])!==String(excludeId||''))return String(r[5]||AREA_PALETTE[0]);
  const used=rows.map(r=>String(r[5]||'')).filter(Boolean);
  return AREA_PALETTE.find(c=>!used.includes(c))||AREA_PALETTE[used.length%AREA_PALETTE.length];
}
function funcionarioRow_(r){
 return {id:String(r[0]||''),nombre:String(r[1]||''),area:String(r[2]||''),password:String(r[3]||''),rol:String(r[4]||'Funcionario'),color:String(r[5]||AREA_PALETTE[0]),estado:String(r[6]||'Activo'),fechaCreacion:formatDateTime_(r[7])||String(r[7]||''),debeCambiarPassword:String(r[8]||'').toUpperCase()==='SI',fechaCambioPassword:formatDateTime_(r[9])||String(r[9]||''),ultimoAcceso:formatDateTime_(r[10])||String(r[10]||'')};
}
function ensureFuncionarioHeaders_(){const sh=getNamedSheet_(FUNC_SHEET,FUNC_HEADERS);ensureHeaders_(sh,FUNC_HEADERS);return sh;}
function listFuncionarios_(){
  const sh=getFuncionarioSheet_();
  if(sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,FUNC_HEADERS.length).getValues().filter(r=>r[0]).map(funcionarioRow_);
}
function findFuncionario_(id){return listFuncionarios_().find(x=>String(x.id)===String(id))||null;}
function findFuncionarioByCredentials_(nombre,area,password){
 const n=normalizeText_(nombre),a=normalizeText_(area),p=String(password||'');
 const u=listFuncionarios_().find(x=>normalizeText_(x.estado)==='activo'&&normalizeText_(x.rol)==='funcionario'&&normalizeText_(x.nombre)===n&&normalizeText_(x.area)===a&&String(x.password||'')===p)||null;
 if(u)try{
   const sh=ensureFuncionarioHeaders_(),rows=sh.getDataRange().getValues(),idx=rows.findIndex(r=>String(r[0])===u.id);
   if(idx>0){sh.getRange(idx+1,11).setValue(formatDateTime_(new Date()));SpreadsheetApp.flush();}
 }catch(_){}
 return u;
}
function generateTemporaryPassword_(){return 'MIDES-'+Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase();}
function saveFuncionario_(p){
 const nombre=String(p.nombre||'').trim(),area=String(p.area||'').trim(),provisional=String(p.passwordProvisoria||'').trim()||generateTemporaryPassword_();
 if(!nombre||!area)throw new Error('Nombre y área de trabajo son obligatorios.');
 if(provisional.length<8)throw new Error('La contraseña provisoria debe tener al menos 8 caracteres.');
 const sh=ensureFuncionarioHeaders_(),id=p.id||'F-'+Utilities.getUuid().slice(0,8).toUpperCase(),old=findFuncionario_(id),color=old?.color||areaColor_(area,id),now=formatDateTime_(new Date());
 const rows=sh.getDataRange().getValues();
 const duplicate=rows.slice(1).find(r=>String(r[0])!==String(id)&&String(r[6]||'')==='Activo'&&normalizeText_(r[1])===normalizeText_(nombre)&&normalizeText_(r[2])===normalizeText_(area));
 if(duplicate)throw new Error('Ya existe un funcionario activo con ese nombre y área de trabajo.');
 const row=[id,nombre,area,provisional,'Funcionario',color,p.estado||old?.estado||'Activo',old?.fechaCreacion||now,old?.debeCambiarPassword===false?'NO':'SI',old?.fechaCambioPassword||'',old?.ultimoAcceso||''];
 let n=-1;for(let i=1;i<rows.length;i++)if(String(rows[i][0])===id){n=i+1;break;}
 if(n<0)sh.appendRow(row);else sh.getRange(n,1,1,FUNC_HEADERS.length).setValues([row]);
 SpreadsheetApp.flush();
 const verify=sh.getDataRange().getValues().find(r=>String(r[0])===id);
 if(!verify)throw new Error('Google Sheets no confirmó la escritura del usuario.');
 for(let i=0;i<FUNC_HEADERS.length;i++)if(String(verify[i]??'')!==String(row[i]??''))throw new Error('Google Sheets confirmó la fila, pero no todos los campos guardados coinciden.');
 return funcionarioRow_(verify);
}
function changeFuncionarioPassword_(p){
 const nombre=String(p.nombre||'').trim(),area=String(p.area||'').trim(),oldPass=String(p.passwordActual||''),newPass=String(p.passwordNueva||'').trim();
 if(newPass.length<8)throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');if(oldPass===newPass)throw new Error('La nueva contraseña debe ser diferente a la provisoria.');
 const u=findFuncionarioByCredentials_(nombre,area,oldPass);if(!u)throw new Error('La contraseña actual no es válida.');
 const sh=ensureFuncionarioHeaders_(),rows=sh.getDataRange().getValues(),idx=rows.findIndex(r=>String(r[0])===u.id);if(idx<1)throw new Error('Usuario no encontrado.');
 rows[idx][3]=newPass;rows[idx][8]='NO';rows[idx][9]=formatDateTime_(new Date());sh.getRange(idx+1,1,1,FUNC_HEADERS.length).setValues([rows[idx]]);SpreadsheetApp.flush();return funcionarioRow_(sh.getRange(idx+1,1,1,FUNC_HEADERS.length).getValues()[0]);
}
function deleteFuncionario_(id){
  const sh=getFuncionarioSheet_(),rows=sh.getDataRange().getValues();
  for(let i=1;i<rows.length;i++)if(String(rows[i][0])===String(id)){sh.getRange(i+1,7).setValue('Inactivo');return funcionarioRow_(sh.getRange(i+1,1,1,FUNC_HEADERS.length).getValues()[0]);}
  return null;
}
function parseAgendaDate_(s){
  const d=new Date(String(s||''));
  if(isNaN(d.getTime()))throw new Error('Fecha u horario inválido.');
  return d;
}
function agendaRow_(r,colorMap){
  const area=String(r[3]||'');
  return {id:String(r[0]),usuarioId:String(r[1]),nombreUsuario:String(r[2]||''),area,inicio:String(r[4]||''),fin:String(r[5]||''),actividad:String(r[6]||''),lugar:String(r[7]||''),descripcion:String(r[8]||''),imagenUrl:String(r[9]||''),fechaCreacion:String(r[10]||''),estado:String(r[11]||'Activa'),color:colorMap&&colorMap[normalizeText_(area)]||areaColor_(area)};
}
function listAgenda_(from,to){
  const cache=CacheService.getScriptCache(),version=cache.get('agenda_version')||'0';
  const cacheKey='agenda_'+version+'_'+Utilities.base64EncodeWebSafe(String(from||'')+'|'+String(to||''));
  const cached=cache.get(cacheKey);if(cached)try{return JSON.parse(cached);}catch(_){}
  const sh=getAgendaSheet_();if(sh.getLastRow()<2)return [];
  const lo=from?parseAgendaDate_(from):new Date(0),hi=to?parseAgendaDate_(to):new Date('2999-12-31T23:59:59');
  const colors={};listFuncionarios_().forEach(u=>{if(u.area&&!colors[normalizeText_(u.area)])colors[normalizeText_(u.area)]=u.color;});
  const result=sh.getRange(2,1,sh.getLastRow()-1,AGENDA_HEADERS.length).getValues()
    .filter(r=>r[0]&&normalizeText_(String(r[11]||'Activa').trim())==='activa')
    .map(r=>agendaRow_(r,colors))
    .filter(x=>{
      // Una fila incompleta no debe bloquear la lectura pública de toda la agenda.
      try{const s=parseAgendaDate_(x.inicio),f=parseAgendaDate_(x.fin);return f>=lo&&s<=hi;}catch(_){return false;}
    });
  try{cache.put(cacheKey,JSON.stringify(result),30);}catch(_){}
  return result;
}
function agendaConflict_(inicio,fin,excludeId){
  const s=parseAgendaDate_(inicio),f=parseAgendaDate_(fin);
  return listAgenda_().find(x=>String(x.id)!==String(excludeId||'')&&parseAgendaDate_(x.inicio)<f&&parseAgendaDate_(x.fin)>s)||null;
}
function saveAgenda_(p){
  const u=findFuncionarioByCredentials_(p.nombreUsuario||'',p.area||'',p.password||'');
  if(!u)throw new Error('No se pudo validar el funcionario. Volvé a iniciar sesión.');
  const inicio=String(p.inicio||''),fin=String(p.fin||''),actividad=String(p.actividad||'').trim(),lugar=String(p.lugar||'').trim(),descripcion=String(p.descripcion||'').trim();
  const s=parseAgendaDate_(inicio),f=parseAgendaDate_(fin);
  if(f<=s)throw new Error('La hora de finalización debe ser posterior a la de inicio.');
  if(!actividad||!lugar)throw new Error('Actividad y lugar son obligatorios.');
  const conflict=agendaConflict_(inicio,fin,p.id),sh=getAgendaSheet_(),id=p.id||'A-'+Utilities.getUuid().slice(0,8).toUpperCase(),now=formatDateTime_(new Date());
  const row=[id,u.id,u.nombre,u.area,inicio,fin,actividad,lugar,descripcion,String(p.imagenUrl||''),now,'Activa'];
  const rows=sh.getDataRange().getValues();let n=-1;for(let i=1;i<rows.length;i++)if(String(rows[i][0])===id){n=i+1;break;}
  if(n<0)sh.appendRow(row);else sh.getRange(n,1,1,AGENDA_HEADERS.length).setValues([row]);
  try{CacheService.getScriptCache().put('agenda_version',Utilities.getUuid(),21600);}catch(_){}
  const item=agendaRow_(row);
  return {item,conflict:conflict?agendaRow_(conflict):null,message:conflict?'La actividad fue registrada, pero existe una actividad paralela en el mismo horario. Queda a criterio de la Dirección definir la prioridad.':'Actividad creada correctamente.'};
}
function validateFuncionario_(p){const u=findFuncionarioByCredentials_(p.nombre||p.nombreUsuario||'',p.area||'',p.password||'');if(!u)throw new Error('Credenciales de funcionario incorrectas.');return u;}
function uploadAgendaImage_(p){
  const u=validateFuncionario_(p);if(!p.data)throw new Error('No se recibió la imagen.');
  const bytes=Utilities.base64Decode(String(p.data).replace(/^data:[^;]+;base64,/,''));

  const root=getDriveRoot_(),folder=getOrCreateFolder_(root,'Agenda de actividades - MIDES Florida');
  const safe=String(p.fileName||'actividad.jpg').replace(/[^a-zA-Z0-9._-]/g,'_');
  const file=folder.createFile(Utilities.newBlob(bytes,p.mimeType||'image/jpeg',u.id+'_'+Date.now()+'_'+safe));
  try{file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);}catch(err){}
  return {url:'https://drive.google.com/uc?export=view&id='+file.getId(),fileId:file.getId(),name:file.getName()};
}
function adminCalendar_(p){return listAgenda_(p.from,p.to);}

function doPost(e){
  try{
    const p=e&&e.parameter?e.parameter:{};
    if(p.action==='funcionarioLogin'){const u=findFuncionarioByCredentials_(p.nombre||'',p.area||'',p.password||'');return apiResponse_(p,{ok:!!u,user:u||null,error:u?null:'Credenciales de funcionario incorrectas'});}
    if(p.action==='funcionarioChangePassword'){const u=changeFuncionarioPassword_(p);return apiResponse_(p,{ok:true,user:u,message:'Contraseña actualizada correctamente.'});}
    if(p.action==='agendaList'){validateFuncionario_(p);return apiResponse_(p,{ok:true,items:listAgenda_(p.from,p.to)});}
    if(p.action==='agendaSave'){const r=saveAgenda_(p);return apiResponse_(p,{ok:true,...r});}
    if(p.action==='agendaUploadImage'){return apiResponse_(p,{ok:true,image:uploadAgendaImage_(p)});}
    if(p.action==='agendaDeleteOwn'){const u=validateFuncionario_(p),sh=getAgendaSheet_(),rows=sh.getDataRange().getValues();for(let i=1;i<rows.length;i++)if(String(rows[i][0])===String(p.id)&&String(rows[i][1])===u.id){sh.getRange(i+1,12).setValue('Inactiva');try{CacheService.getScriptCache().put('agenda_version',Utilities.getUuid(),21600);}catch(_){}return apiResponse_(p,{ok:true});}return apiResponse_(p,{ok:false,error:'Actividad no encontrada'});}
    // Acceso editorial directo: aceptar cualquiera de las claves habilitadas.
    const suppliedKey=String(p.key||'');
    const acceptedKeys=CONFIG.adminKeys||[CONFIG.adminKey];
    if(!acceptedKeys.includes(suppliedKey))return apiResponse_(p,{ok:false,error:'Clave editorial incorrecta'});
    if(p.action==='adminList'){return apiResponse_(p,{ok:true,items:readAll_().sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)))});}
    if(p.action==='funcionariosList')return apiResponse_(p,{ok:true,items:listFuncionarios_().map(u=>({id:u.id,nombre:u.nombre,area:u.area,rol:u.rol,color:u.color,estado:u.estado,fechaCreacion:u.fechaCreacion,debeCambiarPassword:u.debeCambiarPassword,fechaCambioPassword:u.fechaCambioPassword,ultimoAcceso:u.ultimoAcceso}))});
    if(p.action==='funcionarioSave')return apiResponse_(p,{ok:true,item:saveFuncionario_(p)});
    if(p.action==='funcionarioDelete')return apiResponse_(p,{ok:true,item:deleteFuncionario_(p.id)});
    if(p.action==='adminAgendaList')return apiResponse_(p,{ok:true,items:adminCalendar_(p)});
    if(p.action==='diagnosticoHojas')return apiResponse_(p,{ok:true,items:diagnosticoHojasCentroPrensa_()});
    if(p.action==='adminGet')return apiResponse_(p,{ok:true,item:findById_(p.id)});
    if(p.action==='save')return apiResponse_(p,{ok:true,item:save_(p)});
    if(p.action==='savePublish')return apiResponse_(p,{ok:true,item:saveAndPublish_(p)});
    if(p.action==='contactsList')return apiResponse_(p,{ok:true,items:listContacts_()});
    if(p.action==='contactsImport')return apiResponse_(p,{ok:true,result:importContacts_()});
    if(p.action==='contactSave')return apiResponse_(p,{ok:true,item:saveContact_(p)});
    if(p.action==='contactDelete')return apiResponse_(p,{ok:true,item:setContactStatus_(p.id,'Inactivo')});
    if(p.action==='listsList')return apiResponse_(p,{ok:true,items:listMailingLists_()});
    if(p.action==='listSave')return apiResponse_(p,{ok:true,item:saveMailingList_(p)});
    if(p.action==='listDelete')return apiResponse_(p,{ok:true,item:setMailingListStatus_(p.id,'Inactiva')});
    if(p.action==='membershipSave')return apiResponse_(p,{ok:true,item:saveMemberships_(p.contactId,p.listIds)});
    if(p.action==='contactsAssignList')return apiResponse_(p,{ok:true,result:addContactsToList_(p.contactIds,p.listId)});
    if(p.action==='campaignPreview')return apiResponse_(p,{ok:true,preview:previewCampaign_(p)});
    if(p.action==='campaignSave')return apiResponse_(p,{ok:true,item:saveCampaign_(p)});
    if(p.action==='mailingSave')return apiResponse_(p,{ok:true,item:saveMailing_(p)});
    if(p.action==='mailingSend')return apiResponse_(p,{ok:true,result:sendMailing_(p.id)});
    if(p.action==='uploadVideoStart')return apiResponse_(p,{ok:true,upload:uploadVideoStart_(p)});
    if(p.action==='uploadVideoChunk')return apiResponse_(p,{ok:true,upload:uploadVideoChunk_(p)});
    if(p.action==='uploadVideoComplete')return apiResponse_(p,{ok:true,upload:uploadVideoComplete_(p)});
    if(p.action==='uploadImages')return apiResponse_(p,{ok:true,images:uploadImages_(p)});
    if(p.action==='uploadCover')return apiResponse_(p,{ok:true,cover:uploadCover_(p)});
    if(p.action==='uploadAudio')return apiResponse_(p,{ok:true,audio:uploadAudio_(p)});
    if(p.action==='delete')return apiResponse_(p,{ok:delete_(p.id)});
    if(p.action==='publish'){const item=setStatus_(p.id,'Publicado');return apiResponse_(p,{ok:!!item,item:item,error:item?null:'No se encontró el comunicado para publicar.'});}
    if(p.action==='unpublish')return apiResponse_(p,{ok:setStatus_(p.id,'Borrador'),item:findById_(p.id)});
    return apiResponse_(p,{ok:false,error:'Acción POST no válida'});
  }catch(err){
    const action=(e&&e.parameter&&e.parameter.action)||'desconocida';
    const message=String(err&&err.message?err.message:err);
    // Dar contexto para distinguir un fallo al guardar texto en Sheets de un fallo de Drive.
    const driveFailure=/DriveApp|Google Drive|drive\.googleapis\.com|Acceso denegado/i.test(message);
    return apiResponse_(p,{ok:false,action:action,error:driveFailure
      ? 'La acción "'+action+'" falló al acceder a Google Drive. Si es una carga multimedia, el texto del comunicado debe guardarse primero con la acción save. Para habilitar archivos, sincronizá este Code.gs con Apps Script, ejecutá autorizarCentroPrensa desde el editor, aceptá los permisos y volvé a implementar la aplicación web. Detalle: '+message
      : message});
  }
}

/*
 * Módulo independiente del mapa 5K INJU–MIDES Florida.
 * Usa exclusivamente la pestaña Mapa5K y helpers con prefijo mapa5k_.
 * No modifica las hojas ni las funciones editoriales del Centro de Prensa.
 */
const MAPA5K_SPREADSHEET_ID_ = '1OuIrwtwKQ1mDDTCq-QLuyH-q82Pla2HcKiXqOerDwn4';
const MAPA5K_HEADERS_ = ['ID','Nombre','Tipo','Geometria','Descripcion','Horario','Detalles','Color','Visible','PuntosJSON','FechaActualizacion'];

// Ejecutar manualmente una vez desde Apps Script para crear/verificar la pestaña dedicada.
// No borra elementos existentes ni toca las hojas del Centro de Prensa.
function prepararMapa5K() {
  const sh = mapa5kSheet_();
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,MAPA5K_HEADERS_.length).setFontWeight('bold').setBackground('#0756a4').setFontColor('#ffffff');
  SpreadsheetApp.flush();
  const result = {ok:true, spreadsheetId:MAPA5K_SPREADSHEET_ID_, sheetName:sh.getName(), headers:sh.getRange(1,1,1,MAPA5K_HEADERS_.length).getValues()[0], elements:Math.max(0,sh.getLastRow()-1)};
  Logger.log(JSON.stringify(result));
  return result;
}

function mapa5kSheet_() {
  const ss = SpreadsheetApp.openById(MAPA5K_SPREADSHEET_ID_);
  let sh = ss.getSheetByName('Mapa5K');
  if (!sh) {
    sh = ss.insertSheet('Mapa5K');
    sh.getRange(1,1,1,MAPA5K_HEADERS_.length).setValues([MAPA5K_HEADERS_]);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,MAPA5K_HEADERS_.length).setValues([MAPA5K_HEADERS_]);
    sh.setFrozenRows(1);
  } else {
    const existing = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),MAPA5K_HEADERS_.length)).getValues()[0];
    const matches = MAPA5K_HEADERS_.every((h,i)=>existing[i]===h);
    if (!matches) {
      // Es seguro corregir encabezados si la hoja no contiene registros; nunca se pisan datos.
      if (sh.getLastRow() <= 1) {
        sh.getRange(1,1,1,MAPA5K_HEADERS_.length).setValues([MAPA5K_HEADERS_]);
        if (sh.getLastColumn() > MAPA5K_HEADERS_.length) {
          sh.getRange(1,MAPA5K_HEADERS_.length+1,1,sh.getLastColumn()-MAPA5K_HEADERS_.length).clearContent();
        }
        sh.setFrozenRows(1);
      } else {
        throw new Error('La pestaña Mapa5K tiene datos pero sus encabezados no coinciden. Para protegerlos, no se modificó automáticamente. Revisá la fila 1.');
      }
    }
  }
  return sh;
}

function mapa5kList_() {
  const sh = mapa5kSheet_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,MAPA5K_HEADERS_.length).getValues()
    .filter(r=>r[0])
    .map(r=>({
      id:String(r[0]), nombre:String(r[1]||''), tipo:String(r[2]||'otros'),
      geometria:String(r[3]||'punto'), descripcion:String(r[4]||''),
      horario:String(r[5]||''), detalles:String(r[6]||''), color:String(r[7]||'#0756a4'),
      visible:String(r[8]).toLowerCase()!=='false', puntos:mapa5kParsePoints_(r[9])
    }));
}

function mapa5kParsePoints_(value) {
  if (Array.isArray(value)) return value;
  try { const parsed=JSON.parse(String(value||'[]')); return Array.isArray(parsed)?parsed:[]; }
  catch (_) { return []; }
}

function mapa5kSave_(items) {
  if (!Array.isArray(items)) throw new Error('Los elementos del mapa no tienen un formato válido.');
  if (items.length > 300) throw new Error('El mapa supera el máximo de 300 elementos por guardado.');
  const sh=mapa5kSheet_();
  const existing=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,MAPA5K_HEADERS_.length).getValues():[];
  const rowById={};
  existing.forEach((r,i)=>{if(r[0])rowById[String(r[0])]=i+2;});
  const incoming={};
  items.forEach(o=>{
    if(!o||!o.id) throw new Error('Hay un elemento del mapa sin identificador.');
    const id=String(o.id);
    if(incoming[id]) throw new Error('Hay identificadores duplicados en el mapa.');
    incoming[id]=true;
    const row=[id,String(o.nombre||''),String(o.tipo||'otros'),String(o.geometria||'punto'),
      String(o.descripcion||''),String(o.horario||''),String(o.detalles||''),String(o.color||'#0756a4'),
      o.visible===false?'false':'true',JSON.stringify(mapa5kParsePoints_(o.puntos)),new Date()];
    const oldRow=rowById[id];
    if(oldRow) sh.getRange(oldRow,1,1,MAPA5K_HEADERS_.length).setValues([row]);
    else { sh.appendRow(row); rowById[id]=sh.getLastRow(); }
  });
  // Guardado acumulativo: un guardado o una lista incompleta nunca borra otros elementos.
  // Para retirar algo del mapa, marcarlo como "Oculto" desde el editor.
  SpreadsheetApp.flush();
  const saved=mapa5kList_();
  const savedById={};saved.forEach(o=>savedById[String(o.id)]=o);
  items.forEach(o=>{
    const check=savedById[String(o.id)];
    if(!check)throw new Error('Google Sheets no confirmó el registro del elemento: '+String(o.nombre||o.id));
    if(JSON.stringify(mapa5kParsePoints_(check.puntos))!==JSON.stringify(mapa5kParsePoints_(o.puntos)))
      throw new Error('Google Sheets no confirmó la geometría del elemento: '+String(o.nombre||o.id));
  });
  return saved;
}
function normalizeStatus_(value){return String(value==null?'':value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();}
function listPublished_(){return readAll_().filter(x=>normalizeStatus_(x.estado)==='publicado').sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||'')));}
// La sala pública lee directamente la hoja para evitar una caché editorial antigua.
function listPublishedDirect_(){const values=getSheet_().getDataRange().getValues();if(values.length<2)return [];return values.slice(1).filter(r=>r[0]&&normalizeStatus_(r[1])==='publicado').map(rowToObject_).sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||'')));}
function readAll_(){const cache=CacheService.getScriptCache(),cached=cache.get('centro_prensa_comunicados');if(cached)try{return JSON.parse(cached);}catch(_){}const v=getSheet_().getDataRange().getValues();const items=v.length<2?[]:v.slice(1).filter(r=>r[0]).map(rowToObject_);try{cache.put('centro_prensa_comunicados',JSON.stringify(items),60);}catch(_){}return items;}
function invalidateEditorialCache_(){try{CacheService.getScriptCache().remove('centro_prensa_comunicados');}catch(_){}}

function rowToObject_(r){
  return {id:String(r[0]),estado:String(r[1]||'').trim(),fecha:formatDate_(r[2]),categoria:String(r[3]),tag:String(r[4]),titulo:String(r[5]),resumen:String(r[6]),contenido:String(r[7]),fotoPrincipal:String(r[8]||''),fotos:splitPhotos_(r[9]),videoUrl:String(r[10]||''),videoDriveFileId:String(r[11]||''),videoDriveUrl:String(r[12]||''),videoDriveFolderId:String(r[13]||''),fechaCreacion:formatDateTime_(r[14]),fechaActualizacion:formatDateTime_(r[15]),audioUrl:String(r[16]||''),audioDriveFileId:String(r[17]||''),audioDriveUrl:String(r[18]||'')};
}
function splitPhotos_(v){return String(v||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);}
function findById_(id){if(!id)return null;const sh=getSheet_(),row=findRow_(sh,id);return row<0?null:rowToObject_(sh.getRange(row,1,1,HEADERS.length).getValues()[0]);}
function save_(p){
  const sh=getSheet_(),id=p.id||Utilities.getUuid(),now=new Date(),old=findById_(id);
  const item={id:id,estado:old?old.estado:'Borrador',fecha:p.fecha||'',categoria:p.categoria||'Comunicado',tag:p.tag||'',titulo:p.titulo||'',resumen:p.resumen||'',contenido:p.contenido||'',fotoPrincipal:p.fotoPrincipal||'',fotos:splitPhotos_(p.fotos),videoUrl:p.videoUrl||'',videoDriveFileId:old?.videoDriveFileId||'',videoDriveUrl:old?.videoDriveUrl||'',videoDriveFolderId:old?.videoDriveFolderId||'',fechaCreacion:old&&old.fechaCreacion?old.fechaCreacion:formatDateTime_(now),fechaActualizacion:formatDateTime_(now),audioUrl:old?.audioUrl||'',audioDriveFileId:old?.audioDriveFileId||'',audioDriveUrl:old?.audioDriveUrl||''};
  const row=[item.id,item.estado,item.fecha,item.categoria,item.tag,item.titulo,item.resumen,item.contenido,item.fotoPrincipal,item.fotos.join('\n'),item.videoUrl,item.videoDriveFileId,item.videoDriveUrl,item.videoDriveFolderId,item.fechaCreacion,item.fechaActualizacion,item.audioUrl,item.audioDriveFileId,item.audioDriveUrl];
  const values=sh.getDataRange().getValues();let n=-1;
  for(let i=1;i<values.length;i++)if(String(values[i][0])===id){n=i+1;break;}
  if(n<0)sh.appendRow(row);else sh.getRange(n,1,1,row.length).setValues([row]);
  SpreadsheetApp.flush();
  const verify=findById_(id);if(!verify)throw new Error('Google Sheets no confirmó la escritura del comunicado.');
  invalidateEditorialCache_();
  return verify;
}
function uploadVideoStart_(p){
  if(!p.id)throw new Error('Primero guardá el comunicado como borrador.');
  if(!p.fileName)throw new Error('No se recibió el nombre del video.');
  const root=getDriveRoot_(),titleFolder=getOrCreateCommunicationFolder_(root,p.titulo||'Comunicado '+p.id),mime=p.mimeType||'video/mp4';
  const response=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',{method:'post',contentType:'application/json; charset=UTF-8',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken(),'X-Upload-Content-Type':mime,'X-Upload-Content-Length':String(p.totalSize||0)},payload:JSON.stringify({name:p.fileName,mimeType:mime,parents:[titleFolder.getId()]}),muteHttpExceptions:true,followRedirects:false});
  const status=response.getResponseCode(),headers=response.getAllHeaders();
  if(status<200||status>=300)throw new Error('No se pudo iniciar la carga en Google Drive: HTTP '+status+' '+response.getContentText());
  const location=headers.Location||headers.location;
  if(!location)throw new Error('Google Drive no devolvió la URL de carga reanudable.');
  return {sessionUrl:String(location),folderId:titleFolder.getId(),folderName:titleFolder.getName()};
}
function uploadVideoComplete_(p){
  if(!p.id||!p.fileId)throw new Error('Faltan datos para finalizar la carga del video.');
  const sh=getSheet_(),row=findRow_(sh,p.id);
  if(row<0)throw new Error('No se encontró el comunicado para asociar el video.');
  const file=DriveApp.getFileById(p.fileId);
  try{file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);}catch(err){}
  const fileUrl='https://drive.google.com/file/d/'+p.fileId+'/view',previewUrl='https://drive.google.com/file/d/'+p.fileId+'/preview';
  sh.getRange(row,12,1,4).setValues([[p.fileId,fileUrl,p.folderId||'',formatDateTime_(new Date())]]);
  sh.getRange(row,16).setValue(formatDateTime_(new Date()));
  SpreadsheetApp.flush();invalidateEditorialCache_();
  return {complete:true,fileId:p.fileId,fileUrl:fileUrl,previewUrl:previewUrl,folderId:p.folderId||'',folderName:p.folderName||'',name:file.getName()};
}
function uploadVideoChunk_(p){
  if(!p.sessionUrl)throw new Error('Falta la sesión de carga de Google Drive.');
  const total=Number(p.totalSize||0),start=Number(p.start||0),end=Number(p.end||0);
  if(!total||end<=start||end>total)throw new Error('Rango de video inválido.');
  const data=String(p.chunkData||'').replace(/^data:[^;]+;base64,/,'');
  if(!data)throw new Error('No se recibió el fragmento del video.');
  const bytes=Utilities.base64Decode(data);
  const response=UrlFetchApp.fetch(p.sessionUrl,{method:'put',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken(),'Content-Range':'bytes '+start+'-'+(end-1)+'/'+total},payload:bytes,muteHttpExceptions:true,followRedirects:false});
  const status=response.getResponseCode();
  if(status===308){const h=response.getAllHeaders(),range=h.Range||h.range||'';return {complete:false,nextStart:range?parseInt(String(range).split('-').pop(),10)+1:end};}
  if(status!==200&&status!==201)throw new Error('Google Drive rechazó el fragmento: HTTP '+status+' '+response.getContentText());
  const file=JSON.parse(response.getContentText());
  if(!file.id)throw new Error('Google Drive no devolvió el ID del archivo.');
  try{DriveApp.getFileById(file.id).setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);}catch(err){}
  const sh=getSheet_(),row=findRow_(sh,p.id);
  if(row<0)throw new Error('No se encontró el comunicado para asociar el video.');
  const fileUrl='https://drive.google.com/file/d/'+file.id+'/view',previewUrl='https://drive.google.com/file/d/'+file.id+'/preview';
  sh.getRange(row,12,1,4).setValues([[file.id,fileUrl,p.folderId||'',formatDateTime_(new Date())]]);
  sh.getRange(row,16).setValue(formatDateTime_(new Date()));
  SpreadsheetApp.flush();invalidateEditorialCache_();
  return {complete:true,fileId:file.id,fileUrl:fileUrl,previewUrl:previewUrl,folderId:p.folderId||'',folderName:p.folderName||'',name:file.name||''};
}
function uploadCover_(p){
  if(!p.id)throw new Error('Primero guardá el comunicado como borrador.');
  if(!p.data)throw new Error('No se recibió la foto principal.');
  // Usa la API REST de Drive en vez de DriveApp, que devuelve "Acceso denegado".
  const bytes=Utilities.base64Decode(String(p.data).replace(/^data:[^;]+;base64,/, ''));
  const fileName=String(p.fileName||'foto-principal.jpg'),mimeType=String(p.mimeType||'image/jpeg');
  const folder=driveGetOrCreateCommunicationFolderRest_(p.titulo||'Comunicado '+p.id);
  const boundary='----CentroPrensa'+Utilities.getUuid().replace(/-/g,'');
  const metadata={name:fileName,mimeType:mimeType,parents:[folder.id]};
  const prefix='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: '+mimeType+'\r\nContent-Transfer-Encoding: binary\r\n\r\n';
  const suffix='\r\n--'+boundary+'--';
  const payload=joinByteArrays_([Utilities.newBlob(prefix).getBytes(),bytes,Utilities.newBlob(suffix).getBytes()]);
  const response=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',{
    method:'post',contentType:'multipart/related; boundary='+boundary,
    headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:payload,muteHttpExceptions:true
  });
  const status=response.getResponseCode();
  if(status<200||status>=300)throw new Error('La API REST de Google Drive rechazó la foto (HTTP '+status+'): '+response.getContentText().slice(0,500));
  const file=JSON.parse(response.getContentText());
  if(!file.id)throw new Error('Google Drive no devolvió el ID de la foto principal.');
  try{
    const pr=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.id)+'/permissions',{
      method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
      payload:JSON.stringify({type:'anyone',role:'reader'}),muteHttpExceptions:true
    });
    if(pr.getResponseCode()>=300)console.warn('La foto se guardó, pero no se pudo habilitar el enlace público: '+pr.getContentText().slice(0,200));
  }catch(err){console.warn('La foto se guardó, pero no se pudo configurar el enlace público: '+String(err));}
  const sh=getSheet_(),row=findRow_(sh,p.id);
  if(row<0)throw new Error('La foto se guardó en Drive, pero no se encontró el comunicado para asociarla en Sheets.');
  const url='https://drive.google.com/uc?export=view&id='+file.id;
  sh.getRange(row,9).setValue(url);sh.getRange(row,16).setValue(formatDateTime_(new Date()));
  SpreadsheetApp.flush();invalidateEditorialCache_();
  return{url,fileId:file.id,driveUrl:file.webViewLink||('https://drive.google.com/file/d/'+file.id+'/view'),name:file.name||fileName,folderName:folder.name};
}
function driveGetOrCreateCommunicationFolderRest_(title){
  let parentId='root';
  if(CONFIG.driveRootFolderId){
    try{parentId=driveRestRequest_('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(CONFIG.driveRootFolderId)+'?fields=id,name',{method:'get'}).id;}
    catch(err){console.warn('La carpeta configurada no está disponible; se intentará Mi unidad. '+String(err));}
  }
  if(parentId==='root')parentId=findOrCreateFolderRest_('root','Centro de Prensa MIDES Florida').id;
  return findOrCreateFolderRest_(parentId,safeFolderName_(title));
}
function findOrCreateFolderRest_(parentId,name){
  const escaped=String(name).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const q="'"+parentId+"' in parents and name='"+escaped+"' and mimeType='application/vnd.google-apps.folder' and trashed=false";
  const result=driveRestRequest_('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&pageSize=100&fields=files(id,name)',{method:'get'});
  if(result.files&&result.files.length)return result.files[0];
  return driveRestRequest_('https://www.googleapis.com/drive/v3/files?fields=id,name',{
    method:'post',contentType:'application/json',
    payload:JSON.stringify({name:name,mimeType:'application/vnd.google-apps.folder',parents:[parentId]})
  });
}
function driveRestRequest_(url,options){
  options=options||{};
  const response=UrlFetchApp.fetch(url,{method:options.method||'get',contentType:options.contentType,
    headers:Object.assign({Authorization:'Bearer '+ScriptApp.getOAuthToken()},options.headers||{}),
    payload:options.payload,muteHttpExceptions:true});
  const status=response.getResponseCode(),body=response.getContentText();
  if(status<200||status>=300)throw new Error('Drive API HTTP '+status+': '+body.slice(0,400));
  return body?JSON.parse(body):{};
}
function joinByteArrays_(arrays){
  let total=0;arrays.forEach(a=>total+=a.length);
  const out=new Array(total);let offset=0;
  arrays.forEach(a=>{for(let i=0;i<a.length;i++)out[offset++]=a[i];});
  return out;
}
function uploadImages_(p){
  if(!p.id)throw new Error('Primero guardá el comunicado como borrador.');
  if(!p.files)throw new Error('No se recibieron imágenes.');
  const files=JSON.parse(p.files),root=getDriveRoot_(),titleFolder=getOrCreateCommunicationFolder_(root,p.titulo||'Comunicado '+p.id),uploaded=[];
  files.forEach(f=>{const data=String(f.data||'').replace(/^data:[^;]+;base64,/,'');const bytes=Utilities.base64Decode(data);const file=titleFolder.createFile(Utilities.newBlob(bytes,f.type||'image/jpeg',f.name));try{file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);}catch(err){}uploaded.push({id:file.getId(),name:file.getName(),url:file.getUrl(),directUrl:'https://drive.google.com/uc?export=view&id='+file.getId()});});
  const sh=getSheet_(),row=findRow_(sh,p.id);if(row<0)throw new Error('No se encontró el comunicado para asociar las imágenes.');
  const current=splitPhotos_(sh.getRange(row,10).getValue());sh.getRange(row,10).setValue(current.concat(uploaded.map(x=>x.directUrl)).join('\n'));sh.getRange(row,16).setValue(formatDateTime_(new Date()));SpreadsheetApp.flush();invalidateEditorialCache_();
  return {folderId:titleFolder.getId(),folderName:titleFolder.getName(),items:uploaded};
}
function uploadAudio_(p){
  if(!p.id)throw new Error('Primero guardá el comunicado como borrador.');
  if(!p.data)throw new Error('No se recibió el archivo MP3.');
  if(!/\.mp3$/i.test(String(p.fileName||'')))throw new Error('La nota de audio debe ser un archivo MP3.');
  const root=getDriveRoot_(),folder=getOrCreateCommunicationFolder_(root,p.titulo||'Comunicado '+p.id);
  const data=String(p.data).replace(/^data:[^;]+;base64,/,'');
  const bytes=Utilities.base64Decode(data);

  const file=folder.createFile(Utilities.newBlob(bytes,'audio/mpeg',p.fileName));
  try{file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);}catch(err){}
  const sh=getSheet_(),row=findRow_(sh,p.id);
  if(row<0)throw new Error('No se encontró el comunicado para asociar el audio.');
  const url='https://drive.google.com/uc?export=download&id='+file.getId();
  sh.getRange(row,17,1,3).setValues([[url,file.getId(),file.getUrl()]]);
  sh.getRange(row,16).setValue(formatDateTime_(new Date()));SpreadsheetApp.flush();invalidateEditorialCache_();
  return {fileId:file.getId(),url:url,driveUrl:file.getUrl(),name:file.getName()};
}
function diagnosticoDriveCentroPrensa(){
  // Ejecutar manualmente desde el editor de Apps Script después de sincronizar este archivo.
  // Permite confirmar qué permisos tiene realmente la identidad que ejecuta el proyecto.
  const result={ok:false,identity:'',rootAccessible:false,configuredFolderAccessible:false,detail:''};
  try{result.identity=Session.getEffectiveUser().getEmail()||'(correo no disponible)';}catch(err){result.identity='(no disponible: '+String(err)+')';}
  try{const root=DriveApp.getRootFolder();result.rootAccessible=!!root.getId();}catch(err){result.detail='DriveApp no está autorizado o la cuenta ejecutora no tiene acceso: '+String(err);return result;}
  if(CONFIG.driveRootFolderId){try{result.configuredFolderAccessible=!!DriveApp.getFolderById(CONFIG.driveRootFolderId).getId();}catch(err){result.detail='La carpeta configurada no es accesible; se usará la carpeta alternativa. '+String(err);}}
  result.ok=result.rootAccessible;
  if(!result.detail)result.detail=result.configuredFolderAccessible?'Drive y carpeta configurada accesibles.':'Drive accesible; la carpeta configurada no está disponible y se usará la alternativa.';
  return result;
}

function getDriveRoot_(){
  // La carpeta configurada se prefiere, pero un ID inaccesible no debe bloquear toda la carga.
  if(CONFIG.driveRootFolderId){
    try{
      const configured=DriveApp.getFolderById(CONFIG.driveRootFolderId);
      configured.getName();
      return configured;
    }catch(err){
      console.warn('No se pudo usar la carpeta Drive configurada; se utilizará la carpeta alternativa. '+String(err));
    }
  }
  try{
    const root=DriveApp.getRootFolder();
    return getOrCreateFolder_(root,'Centro de Prensa MIDES Florida');
  }catch(err){
    throw new Error('No se puede acceder a Google Drive con la cuenta que ejecuta la API. Abrí el proyecto Apps Script, ejecutá autorizarCentroPrensa y aceptá los permisos. Si el Web App está implementado como propietario, verificá que esa misma cuenta tenga Drive habilitado. Detalle: '+String(err));
  }
}
function getOrCreateFolder_(parent,name){const it=parent.getFoldersByName(name);return it.hasNext()?it.next():parent.createFolder(name);}
function getOrCreateCommunicationFolder_(parent,title){return getOrCreateFolder_(parent,safeFolderName_(title));}
function safeFolderName_(name){return String(name).replace(/[\\/:*?"<>|#%{}~&]/g,' ').replace(/\s+/g,' ').trim().slice(0,150)||'Comunicado';}
function findRow_(sh,id){const v=sh.getDataRange().getValues();for(let i=1;i<v.length;i++)if(String(v[i][0])===String(id))return i+1;return -1;}
function setStatus_(id,status){const sh=getSheet_(),v=sh.getDataRange().getValues();for(let i=1;i<v.length;i++)if(String(v[i][0])===String(id)){const now=formatDateTime_(new Date());sh.getRange(i+1,2).setValue(status);sh.getRange(i+1,16).setValue(now);SpreadsheetApp.flush();invalidateEditorialCache_();return rowToObject_(sh.getRange(i+1,1,1,HEADERS.length).getValues()[0]);}return null;}
function saveAndPublish_(p){const item=save_(p);const sh=getSheet_(),row=findRow_(sh,item.id);if(row<0)throw new Error('No se encontró el comunicado recién guardado.');const now=formatDateTime_(new Date());sh.getRange(row,2).setValue('Publicado');sh.getRange(row,16).setValue(now);SpreadsheetApp.flush();invalidateEditorialCache_();return rowToObject_(sh.getRange(row,1,1,HEADERS.length).getValues()[0]);}
function delete_(id){const sh=getSheet_(),v=sh.getDataRange().getValues();for(let i=1;i<v.length;i++)if(String(v[i][0])===String(id)){sh.deleteRow(i+1);SpreadsheetApp.flush();invalidateEditorialCache_();return true;}return false;}
function formatDate_(v){if(!v)return '';if(Object.prototype.toString.call(v)==='[object Date]')return Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd');return String(v);}
function formatDateTime_(v){if(!v)return '';if(Object.prototype.toString.call(v)==='[object Date]')return Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss');return String(v);}
// Devuelve JSON normal a clientes compatibles; para cargas de archivos permite confirmar al editor
// mediante postMessage desde un iframe, sin depender de CORS entre GitHub Pages y Apps Script.
function apiResponse_(p,obj){
  const token=String(p&&p.transportToken||'');
  if(p&&p.transport==='iframe'&&/^[A-Za-z0-9_-]{16,100}$/.test(token)){
    const message={channel:'mides-prensa-api',token:token,response:obj};
    const safe=JSON.stringify(message).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
    return HtmlService.createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"></head><body><script>parent.postMessage('+safe+',"*");</script></body></html>')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return json_(obj);
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
