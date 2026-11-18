# MIDES Voz IA — instalación del servicio

## Estado
El panel editorial incluye el módulo de locución. El servicio de síntesis se despliega como una aplicación web independiente de Google Apps Script para que la clave de Azure nunca llegue al navegador.

## 1. Crear el recurso Azure Speech
1. En Azure Portal, crear un recurso **Speech**.
2. Copiar una clave y la región exacta del recurso.
3. Las voces configuradas son `es-UY-MateoNeural` y `es-UY-ValentinaNeural` (español de Uruguay).

## 2. Crear el servicio Apps Script
1. Abrir https://script.google.com/ y crear un proyecto nuevo llamado **MIDES Voz IA**.
2. Pegar el contenido de `MIDES_VOZ_IA.gs` en el editor.
3. En **Configuración del proyecto → Propiedades del script**, crear:
   - `CENTRO_PRENSA_ADMIN_KEY`: la misma clave administrativa que ya utiliza el Centro de Prensa.
   - `AZURE_SPEECH_KEY`: clave del recurso Azure Speech.
   - `AZURE_SPEECH_REGION`: región del recurso, por ejemplo `eastus`.
4. Guardar y desplegar como **Aplicación web**. Ejecutar como propietario. Restringir el acceso según las opciones institucionales disponibles y la política de la organización. Copiar la URL terminada en `/exec`.

## 3. Conectar el panel
En `config.js`, completar `voiceApiUrl` con la URL /exec del nuevo servicio. No colocar la clave de Azure en config.js ni en ningún archivo público.

## 4. Probar
Ingresar al panel editorial, abrir **07 · MIDES Voz IA**, escribir un texto breve, probar Mateo y Valentina, y generar MP3. Luego probar WAV.

## Seguridad y límites
- El servicio valida la clave editorial en el servidor.
- No registrar datos personales sensibles en los textos.
- Azure Speech puede generar cargos según consumo y región; revisar la tarifa vigente y el presupuesto de Azure antes de producción.
- La API REST de síntesis tiene un límite de duración por solicitud; para textos largos conviene dividirlos en bloques.
- El servicio devuelve el audio al navegador para descarga; no lo guarda automáticamente en Drive.
