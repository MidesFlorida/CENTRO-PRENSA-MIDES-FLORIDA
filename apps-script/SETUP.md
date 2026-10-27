# Centro de Prensa MIDES Florida — Google Sheets + Apps Script

## Importante antes de ejecutar

- El código actual está configurado para la hoja de cálculo cuyo ID figura en CONFIG.spreadsheetId dentro de Code.gs. **No crear otra hoja ni cambiar ese ID sin migrar primero los datos**, porque la web seguiría leyendo la hoja anterior.
- La carpeta de Google Drive también está configurada mediante CONFIG.driveRootFolderId.
- La clave editorial se administra mediante la propiedad privada `CENTRO_PRENSA_ADMIN_KEY`; no debe escribirse en el código ni en la documentación.
- La inicialización es idempotente: crea las pestañas que falten y ajusta encabezados, pero no elimina pestañas ni borra filas existentes.

## Clave del Panel Editorial (privada)

La clave ya no se guarda en `Code.gs` ni en GitHub. Se almacena como propiedad privada del proyecto de Apps Script:

- Nombre de propiedad: `CENTRO_PRENSA_ADMIN_KEY`.
- Para crearla sin escribir una clave en el código, primero guardá este `Code.gs`, seleccioná la función `generarClaveEditorialSegura` en el editor de Apps Script y pulsá **Ejecutar**.
- En el registro de ejecución, copiá el valor que aparece después de `CLAVE EDITORIAL NUEVA` y guardalo en un lugar seguro. Esa clave es la que se ingresa en la pantalla de acceso del panel.
- La función solo genera una clave si la propiedad todavía no existe; si ya existe, no la reemplaza ni la revela. Para cambiarla, editá o eliminá `CENTRO_PRENSA_ADMIN_KEY` en **Configuración del proyecto → Propiedades de secuencia de comandos** y generá una nueva.
- No publiques ni compartas el registro de ejecución ni la clave. Las claves anteriores escritas en el código dejan de ser válidas tras desplegar esta versión.

Si el ingreso falla por falta de configuración, ejecutá `diagnosticoClaveEditorial` desde Apps Script. Devuelve únicamente si la propiedad existe; nunca revela el valor.

## Inicialización y verificación

1. Abrir la hoja de cálculo configurada en CONFIG.spreadsheetId.
2. Ir a **Extensiones → Apps Script**.
3. Reemplazar el contenido de Code.gs por la versión actual de este repositorio: [apps-script/Code.gs](Code.gs).
4. Guardar el proyecto.
5. En el selector de funciones, ejecutar setup y aceptar los permisos solicitados.
6. Revisar el registro de ejecución. La función devuelve un diagnóstico de pestañas esperadas, filas y columnas. Si aparece un error, no continuar con el despliegue hasta corregirlo.
7. Ejecutar autorizarCentroPrensa una vez y aceptar los permisos de Google Sheets, Drive y servicios asociados.
8. Ir a **Implementar → Gestionar implementaciones**, abrir la implementación web existente y pulsar **Editar**. Elegir **Nueva versión** y desplegar. Mantener la ejecución como el propietario y el acceso que ya usa la plataforma.
9. Confirmar que la URL /exec de esa implementación coincide con apiUrl en config.js. Si se creó una implementación distinta, actualizar config.js con su URL.
10. Abrir la API con ?action=ping. Debe devolver JSON con `ok:true`, el nombre del servicio y `jsonpSupported:true`. Durante el retorno a la implementación conocida, también puede aparecer `apiVersion:"2026-10-23-mapa5k-v4"`; después de copiar y desplegar el Code.gs limpio debe aparecer `apiVersion:"2026-10-26-centro-prensa-v2-keyprops"`. La sala pública admite temporalmente esas versiones anteriores.
11. Verificar también JSONP abriendo la URL de la implementación con `?action=ping&callback=prensaTest`. La respuesta debe comenzar con `prensaTest(` y terminar con `);`. Si aparece solo JSON, HTML o una pantalla de error, la implementación publicada no está usando esta versión de Code.gs o tiene un problema de acceso.
12. Abrir la sala pública y comprobar que aparecen los comunicados y la agenda. Luego, desde el panel editorial, guardar un borrador de prueba, volver a cargar y confirmar que persiste en Google Sheets. Después eliminar el borrador de prueba desde el panel.

## Pestañas que administra el sistema

- Comunicados: contenidos editoriales y estados.
- Contactos: fuente original de contactos. Si no existe, se crea vacía con encabezados compatibles con una exportación de Google Contacts; no se inventan registros.
- Contactos_Normalizados: contactos preparados para la plataforma; la importación inicial solo se ejecuta cuando esta hoja está vacía.
- ListasMailing: listas de distribución.
- Contactos_Listas: relación entre contactos y listas.
- Mailing_Campañas: registro de campañas.
- Mailings: mailings institucionales publicados.
- Funcionarios: usuarios, área, estado y control de cambio de contraseña.
- AgendaFuncionarios: actividades de la agenda.

Las pestañas ajenas al sistema no se eliminan automáticamente. Antes de una migración a una hoja nueva, exportar y verificar los datos de comunicados, contactos, listas, usuarios y agenda; no copiar solo los encabezados.

## API

GET público:
- `?action=ping` — informa la versión del backend.
- `?action=ping&callback=prensaTest` — comprueba que la respuesta JSONP se ejecuta correctamente desde GitHub Pages.
- `?action=list`
- `?action=get&id=ID`

Las operaciones editoriales se envían por POST con la clave editorial. Los cambios en Code.gs de GitHub **no se aplican automáticamente** al despliegue de Apps Script: se debe crear una nueva versión siguiendo los pasos anteriores.
