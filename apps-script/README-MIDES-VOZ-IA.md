# MIDES Voz IA — uso con FreeReadText

## Estado actual
El panel editorial contiene un módulo de preparación de narraciones. Para evitar una suscripción a Azure, la generación se realiza manualmente en FreeReadText, en una pestaña externa. No se necesita desplegar otro Apps Script, registrar claves API ni modificar el servicio principal del Centro de Prensa.

## Cómo utilizarlo
1. Ingresá al Centro de Prensa con tu clave editorial.
2. Abrí **07 · MIDES Voz IA**.
3. Pegá o escribí el texto institucional.
4. Elegí la voz de referencia: Mateo (masculina) o Valentina (femenina).
5. Presioná **Copiar texto para narrar**.
6. Presioná **Abrir FreeReadText** o ingresá a https://freereadtext.com/es.
7. Pegá el texto, seleccioná español de Uruguay y la voz Mateo o Valentina.
8. Generá la locución, escuchala y descargá el MP3 para editarlo en tu programa audiovisual.

## Límites del plan gratuito
La página de precios publica 10.000 créditos mensuales y hasta 2.000 caracteres por conversación en el plan gratuito. El servicio informa que admite SSML para controlar pausas, pronunciación y énfasis. Consultá siempre las condiciones vigentes en https://freereadtext.com/es/pricing y https://freereadtext.com/tos.

## Recomendaciones de locución
- Usá frases relativamente cortas.
- Separá ideas con puntos para dar pausas naturales.
- Escribí números, siglas y horarios de forma que se pronuncien correctamente.
- Escuchá el resultado completo antes de incorporarlo a un video institucional.
- No pegues datos personales sensibles, nombres de personas atendidas ni información privada.

## Privacidad y uso institucional
La generación se realiza en un proveedor externo, no dentro de Google Sheets ni del servidor del Centro de Prensa. Antes de enviar textos institucionales, verificá que su uso esté autorizado por la política de la institución y revisá las condiciones y privacidad del proveedor.

## Evolución futura
La conexión automática mediante API solo se implementará si el proveedor ofrece y autoriza expresamente ese uso, y si sus condiciones permiten el uso institucional/comercial requerido. No se automatiza el sitio mediante scraping ni se exponen claves privadas en GitHub Pages.
