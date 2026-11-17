# Integración automática de Instagram — MIDES Florida

La sala pública consulta las últimas 9 publicaciones de la cuenta profesional autorizada mediante la API oficial de Instagram de Meta. El token permanece en las propiedades privadas del proyecto de Apps Script; nunca se incluye en GitHub ni se envía al navegador.

## Requisitos

- La cuenta `@mides_florida` debe ser profesional: Empresa o Creador. La API oficial no permite leer el contenido de una cuenta personal.
- La persona que administra la cuenta debe poder autorizarla en la aplicación de Meta.
- La aplicación debe tener habilitado **Instagram API with Instagram Login** y el permiso `instagram_business_basic`.

## Configuración inicial en Meta

1. Ingresar en [Meta for Developers](https://developers.facebook.com/) con la cuenta que administra MIDES Florida.
2. Crear una aplicación de tipo empresarial (Business) o abrir una aplicación institucional existente.
3. Desde el panel de la aplicación, agregar el producto **Instagram** y elegir **Instagram API with Instagram Login**.
4. En la configuración de Instagram, completar los datos básicos solicitados por Meta y habilitar el inicio de sesión empresarial de Instagram.
5. Agregar la cuenta profesional `@mides_florida` como cuenta autorizada/rol de prueba si el panel lo solicita. Aceptar la invitación desde Instagram.
6. En el apartado de configuración de la API, iniciar el proceso de autorización con la cuenta profesional MIDES Florida y conceder el permiso `instagram_business_basic`.
7. Generar u obtener un token de usuario de Instagram de larga duración. No utilizar el App Secret como token. No publicar el token ni enviarlo por correo o chat.

> Si Meta muestra un token de corta duración, primero debe intercambiarse por uno de larga duración siguiendo el flujo oficial de Meta. Los tokens de larga duración tienen vencimiento y deben renovarse antes de expirar.

## Guardar el token en Apps Script

1. Abrir el proyecto de Apps Script que está conectado a la URL de producción de `config.js`.
2. Ir a **Configuración del proyecto → Propiedades de secuencia de comandos**.
3. Crear una propiedad:
   - Nombre: `MIDES_INSTAGRAM_ACCESS_TOKEN`
   - Valor: pegar el token de larga duración obtenido en Meta.
4. Guardar. El token no debe escribirse en `Code.gs`, `config.js`, GitHub ni en la web pública.
5. En el editor de Apps Script, seleccionar y ejecutar `probarInstagramFeed`.
6. En el registro de ejecución, comprobar que indique `configured:true` y que el número de publicaciones sea mayor que cero. La función no registra el token.
7. Si Google solicita permisos, aceptar `UrlFetchApp` para que Apps Script pueda consultar la API de Meta.
8. Ir a **Implementar → Gestionar implementaciones → Editar → Nueva versión → Implementar**. Mantener la misma URL /exec, la ejecución como propietario y el acceso público que ya utiliza el sitio.
9. Abrir la web de MIDES Florida y recargar con Ctrl+F5.

## Renovación del token

Los tokens de larga duración de Instagram vencen. Antes de que caduquen, abrir Apps Script y ejecutar `renovarTokenInstagram`. La función actualiza la propiedad privada y limpia la caché de publicaciones. Solo puede renovarse un token de larga duración que todavía esté vigente y cumpla las condiciones de Meta; si venció o fue revocado, habrá que autorizar la cuenta nuevamente.

## Diagnóstico

- `probarInstagramFeed`: verifica la conexión y devuelve solo el estado y la cantidad de publicaciones.
- `?action=instagramFeed&callback=prueba`: endpoint público JSONP usado por la web. No expone el token.
- Si aparece un error de permisos, revisar que la cuenta sea profesional, que haya concedido `instagram_business_basic` y que el token corresponda al flujo **Instagram Login** (host `graph.instagram.com`).
- La API devuelve contenido multimedia de la cuenta profesional autorizada, no de perfiles ajenos.

Documentación oficial:
- [Instagram API — Meta for Developers](https://developers.facebook.com/docs/instagram-platform/)
- [Usuario de Instagram y permisos](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/)
- [Contenido multimedia de Instagram](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/)
