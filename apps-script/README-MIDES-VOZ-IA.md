# MIDES Voz IA — generación de MP3 mediante API gratuitas

## Estado de la integración
El módulo 07 · MIDES Voz IA del panel editorial ya incorpora:
- Selección de proveedor: TTS.ai o FreeTTS.
- Consulta dinámica de voces en español y filtro por voz masculina/femenina.
- Carga de comunicados publicados desde Google Sheets.
- Generación de MP3 desde el panel, reproductor y descarga.
- División automática del texto en fragmentos para respetar los límites gratuitos.
- Vista previa opcional con la voz del navegador (no genera MP3).

La generación se ejecuta desde Apps Script. Las claves privadas nunca se colocan en GitHub Pages ni en el navegador.

## Proveedor recomendado: TTS.ai
- Base: https://api.tts.ai/v1/
- Catálogo: GET /voices/?language=es
- Generación: POST /tts/
- Formato: MP3.
- Sin API key en el nivel anónimo.
- La documentación informa un máximo de 500 caracteres por solicitud y 5.000 caracteres diarios por IP. El panel divide el texto en fragmentos de 450 caracteres.
- Se usa el identificador de voz y modelo devuelto por el catálogo dinámico.

Documentación y condiciones:
- https://tts.ai/api/?lang=es
- https://tts.ai/pricing/?lang=es
- https://tts.ai/terms/

El catálogo es dinámico: no se fijan nombres de voces que puedan dejar de existir. La disponibilidad de acento uruguayo no está garantizada.

## Alternativa: FreeTTS
FreeTTS requiere una clave API gratuita y su endpoint no habilita CORS para llamadas directas desde el navegador. Por eso la llamada se realiza desde Apps Script.

1. Crear una cuenta gratuita en https://freetts.org/.
2. En el panel del proveedor, crear una API key.
3. Abrir el proyecto Apps Script asociado al Centro de Prensa.
4. Ir a Configuración del proyecto → Propiedades de secuencia de comandos.
5. Agregar la propiedad FREETTS_API_KEY con el valor de la clave emitida por FreeTTS.
6. Guardar. No pegar la clave en config.js, admin.html, GitHub ni en este README.

La API consulta GET https://freetts.org/api/voices, genera mediante POST https://freetts.org/api/v1/tts y recupera el MP3 con el file_id recibido. Los archivos gratuitos tienen una ventana de disponibilidad temporal; el backend los descarga inmediatamente.

Documentación y condiciones:
- https://freetts.org/developers
- https://freetts.org/pricing
- https://freetts.org/terms

Las páginas del proveedor han mostrado cifras de cuota gratuitas distintas. Confirmar el límite vigente en la cuenta antes de realizar producciones frecuentes.

## Publicar la actualización de Apps Script
El repositorio contiene el código actualizado en apps-script/Code.gs, pero GitHub Pages no actualiza por sí solo el proyecto Apps Script.

1. Abrir el proyecto Apps Script que corresponde a la URL configurada en config.js.
2. Reemplazar el contenido del archivo Code.gs por el contenido actualizado de este repositorio.
3. Guardar.
4. Ir a Implementar → Administrar implementaciones.
5. Editar la implementación existente, seleccionar Nueva versión y actualizarla. Mantener la misma URL /exec.
6. Volver al panel, ingresar con la clave editorial y abrir 07 · MIDES Voz IA.

No cambiar la propiedad CENTRO_PRENSA_ADMIN_KEY, la URL /exec ni las demás propiedades existentes. No crear una implementación nueva si se puede actualizar la existente.

## Límites y privacidad
- El módulo limita cada generación a 5.000 caracteres.
- TTS.ai anónimo divide en fragmentos de 450 caracteres; la cuota diaria es compartida por IP según la documentación.
- FreeTTS utiliza la cuota de la clave gratuita configurada.
- El audio se recibe en el panel y se descarga en el dispositivo; no se guarda automáticamente en Google Drive ni en Google Sheets.
- No enviar datos personales sensibles, historias de atención individual ni información privada.
- Los niveles gratuitos de ambos servicios están sujetos a condiciones no comerciales. Esta integración se destina a pruebas y uso personal no comercial; no usar esos audios en trabajos comerciales sin una licencia adecuada.

## Diagnóstico
- Si el catálogo no carga, confirmar que Apps Script se actualizó con el Code.gs del repositorio y que se conserva la URL /exec.
- Para FreeTTS, comprobar que FREETTS_API_KEY existe y es válida.
- Probar primero TTS.ai, que no requiere clave.
- Si el MP3 no se genera, el panel mostrará el error HTTP informado por el proveedor.