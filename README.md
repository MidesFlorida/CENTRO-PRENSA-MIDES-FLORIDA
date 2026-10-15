# Centro de Prensa — MIDES Florida

Aplicación web para centralizar la comunicación institucional de MIDES Florida: publicación de comunicados, organización de materiales audiovisuales, gestión de contactos de prensa y coordinación de actividades mediante una agenda compartida.

- **Sitio público:** https://pablocerrutti.github.io/CENTRO-PRENSA-MIDES-FLORIDA/
- **Repositorio:** https://github.com/pablocerrutti/CENTRO-PRENSA-MIDES-FLORIDA
- **Manual de uso para el equipo:** [docs/MANUAL-DE-USO.md](docs/MANUAL-DE-USO.md)

## Objetivos

- Ofrecer a periodistas y medios una sala de prensa con comunicados y materiales oficiales publicados.
- Facilitar la creación, revisión y publicación de contenidos desde un panel editorial.
- Mantener en una fuente compartida la información editorial y la agenda institucional.
- Permitir que funcionarios autorizados registren actividades que luego pueden mostrarse en la sección pública **Próximas actividades**.
- Organizar contactos y listas de distribución para apoyar la preparación de comunicaciones.

## Funcionalidades actuales

### Sala de prensa pública
- Portada institucional adaptable a computadoras y celulares.
- Listado de comunicados en estado **Publicado**.
- Búsqueda por texto y filtro por categoría.
- Ficha individual de cada comunicado.
- Visualización de foto principal, galería y material audiovisual disponible.
- Sección **Próximas actividades**, que consulta la agenda compartida y presenta actividades futuras activas dentro de los próximos 90 días.
- Accesos a la agenda de funcionarios y al panel editorial.

### Panel editorial
El acceso está restringido a la clave administrativa configurada en Apps Script. Desde el panel se puede:

- Crear y editar comunicados.
- Guardar borradores, publicar y retirar de publicación.
- Incorporar foto principal, galería y video; los archivos multimedia se gestionan mediante Google Drive.
- Consultar comunicados y la agenda institucional.
- Crear usuarios funcionarios y registrar sus datos en Google Sheets.
- Acceder a los módulos de contactos y mailing.

### Contactos de prensa
- Lectura de contactos desde la estructura de Google Sheets.
- Búsqueda por nombre, medio, correo, teléfono o localidad.
- Selección de contactos y asignación a listas de distribución.
- Estructura para contactos normalizados, listas y relación contacto-lista.

### Mailing editorial
- Selección de listas y comunicados publicados.
- Generación de un mailing institucional con URL pública.
- Registro de los mailings y destinatarios únicos en la base de datos.

**Alcance actual:** el módulo prepara y genera el contenido/URL del mailing. No debe considerarse un servicio de envío automático de correos masivos hasta que se integre y pruebe expresamente un proveedor de correo.

### Agenda de funcionarios
- Acceso con nombre, área y contraseña personal.
- En el primer acceso, cambio obligatorio de la contraseña provisoria.
- Calendario mensual compartido.
- Alta de actividades con fecha, horario, título, lugar, descripción e imagen opcional.
- Registro de actividades en Google Sheets.
- Consulta editorial de la agenda por mes.
- Las actividades futuras activas pueden mostrarse en **Próximas actividades** de la sala pública.

### Administración de funcionarios
- Alta de funcionarios desde el panel editorial.
- Asignación de un identificador único.
- Registro del nombre, área, rol y estado en Google Sheets.
- Contraseña provisoria que el funcionario debe cambiar en su primer ingreso.

## Arquitectura

- **Interfaz:** HTML, CSS y JavaScript.
- **Publicación web:** GitHub Pages.
- **Datos:** Google Sheets.
- **API:** Google Apps Script publicado como aplicación web.
- **Archivos multimedia:** Google Drive.
- **Lectura pública:** las páginas públicas consultan la API; la lectura de la agenda usa la acción `upcomingActivities`.

La hoja de cálculo configurada en `apps-script/Code.gs` es la fuente de datos. No crear otra hoja ni cambiar su identificador sin planificar y verificar una migración. El navegador no debe utilizarse como fuente permanente de los datos institucionales.

## Páginas principales

| Página | Uso |
|---|---|
| `index.html` | Sala de prensa pública y próximas actividades |
| `comunicado.html` | Lectura de un comunicado publicado |
| `admin.html` | Panel editorial y gestión de comunicados |
| `contactos-editorial.html` | Consulta y organización de contactos |
| `mailing-editorial.html` | Preparación de mailings institucionales |
| `agenda-editorial.html` | Vista mensual editorial de la agenda |
| `funcionarios.html` | Acceso de funcionarios y creación de actividades |
| `config.js` | Configuración de la API utilizada por el sitio |
| `apps-script/Code.gs` | API y lógica de acceso a Google Sheets/Drive |

## Estructura de datos

El script inicializa o verifica, entre otras, las siguientes hojas:

- `Comunicados`: contenido editorial y estados.
- `Contactos`: fuente original de contactos.
- `Contactos_Normalizados`: contactos organizados para la aplicación.
- `ListasMailing`: listas de distribución.
- `Contactos_Listas`: relación entre contactos y listas.
- `Mailing_Campañas`: registro de campañas.
- `Mailings`: mailings generados.
- `Funcionarios`: cuentas y estado de funcionarios.
- `AgendaFuncionarios`: actividades de la agenda.

La inicialización no está diseñada para borrar automáticamente las pestañas ajenas al sistema. Antes de migrar datos, realizar una copia de seguridad y verificar las hojas involucradas.

## Configuración y despliegue

1. Revisar [apps-script/SETUP.md](apps-script/SETUP.md).
2. Confirmar que `config.js` apunte a la URL de la implementación web correcta.
3. Si se modifica `apps-script/Code.gs`, copiar/actualizar ese código en el editor de Apps Script.
4. Guardar y publicar una **nueva versión** desde **Implementar → Gestionar implementaciones**. Un commit en GitHub no actualiza por sí mismo el despliegue de Apps Script.
5. Probar el endpoint `?action=ping`, la carga de comunicados, el login de funcionarios y la persistencia de actividades antes de considerar finalizada la actualización.

## Recomendaciones de uso responsable

- Publicar solamente información revisada y autorizada por el equipo responsable.
- No registrar datos personales sensibles ni información confidencial en descripciones públicas.
- Confirmar que las imágenes y videos puedan compartirse públicamente antes de subirlos.
- No compartir claves administrativas ni contraseñas personales.
- Las cuentas de funcionarios deben ser individuales; cambiar siempre la contraseña provisoria en el primer acceso.
- Realizar verificaciones periódicas de los datos en Google Sheets y Google Drive.

## Identidad institucional

La interfaz toma como referencia la identidad del Ministerio de Desarrollo Social y su manual de identidad visual.

Fuente oficial: https://www.gub.uy/ministerio-desarrollo-social/comunicacion/publicaciones/manual-identidad-visual-del-ministerio

## Estado del proyecto

El repositorio incluye los módulos descritos en esta documentación. La disponibilidad real de cada función depende de que la versión publicada de Apps Script, la configuración de `config.js` y los permisos de Google Sheets/Drive estén sincronizados. Después de cada actualización, realizar una prueba funcional de extremo a extremo.
