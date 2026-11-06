# Phase Pal Music Bridge

[English](README.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Español](README.es.md) · [日本語](README.ja.md)

Conecta la reproducción del navegador con **Dance to Music** de Phase Pal, con análisis opcional del ritmo en tu dispositivo. Mantenido por Consistency AI.

**Versión preliminar:** el código es abierto bajo MIT; la imagen del conejo tiene condiciones aparte. No es una publicación en Chrome Web Store ni un instalador firmado de Phase Pal. Necesitas una aplicación de escritorio compatible con el puente del navegador incluido; esa aplicación no se incluye aquí. Quedan pendientes las pruebas de reproducción real en Chrome y de la aplicación empaquetada.

## Configuración y privacidad

- [Guía de configuración](https://consistencyai.github.io/phasepal_extension/) en inglés
- [Política de privacidad](https://consistencyai.github.io/phasepal_extension/privacy/) en inglés
- [Privacidad técnica y permisos](docs/PRIVACY.md)
- [Desarrollo y configuración del host nativo](docs/DEVELOPMENT.md)

## Qué hace

Informa del estado de reproducción y pausa en Spotify Web, YouTube Music, SoundCloud, Apple Music, los reproductores regionales de Amazon Music, Deezer, TIDAL, Qobuz, Pandora, Yandex Music, QQ Music, KuGou, JioSaavn, LINE MUSIC, Bugs, JOOX, Anghami y Audiomack. Consulta los [dominios exactos y límites de verificación](docs/SUPPORTED_SITES.md). También puedes añadir un sitio concreto en **Custom websites**, después de que Chrome conceda acceso a ese sitio; consulta la [configuración de sitios personalizados](docs/CUSTOM_SITES.md).

La reproducción en un sitio compatible se trata como música. La voz, los pódcast y los anuncios también pueden activar el baile: no distingue entre canciones y voz. Siguen vigentes las restricciones de cuenta, suscripción, región, contenido protegido y reproductor. Estas integraciones necesitan pruebas de reproducción real antes de una versión plenamente verificada.

## Usar la extensión

1. Usa Chrome 116 o posterior en Windows o macOS y una versión compatible de Phase Pal que incluya y registre el puente del navegador. El proceso actual de instalación no admite Linux ni otros navegadores. Actualizar la extensión no añade el puente a aplicaciones antiguas.
2. Para esta versión preliminar de desarrollo, descarga `phasepal-music-bridge-preview-0.1.0.zip` de [Releases](https://github.com/ConsistencyAI/phasepal_extension/releases) y descomprímelo. Activa **Developer mode** en `chrome://extensions`, elige **Load unpacked** y selecciona la carpeta que contiene `manifest.json`. El ZIP separado para la tienda se destina al panel de desarrolladores y omite la clave pública de desarrollo.
3. Abre Phase Pal y activa **Dance to Music**. Inicia la reproducción en un sitio compatible o personalizado autorizado y abre la ventana de la extensión para comprobar la conexión.
4. Selecciona **Enable Beat Sync** para analizar localmente el audio de esa pestaña. Chrome muestra el indicador de captura y la pestaña sigue sonando. Selecciona **Stop Beat Sync** para detenerla.

**Auto Beat Sync** está desactivado por defecto y solo se guarda en este dispositivo. Al activarlo, abrir la ventana de la extensión en una pestaña de música preparada intenta iniciar la captura una vez. El flujo autorizado puede continuar durante pausas y cambios de canción en el mismo sitio. Una pestaña nueva o un flujo terminado requieren volver a abrir la extensión o pulsar Enable; la opción nunca autoriza capturas desatendidas. La captura termina al pulsar Stop, desactivar Auto Beat Sync o Dance to Music, perder la conexión con la aplicación o el permiso del sitio, salir del sitio, cerrar la pestaña o terminar el flujo.

Un recordatorio que puedes cerrar te dirige a la ventana de la extensión en la barra de herramientas. **Not now** lo oculta para el documento actual; **Don't show again** guarda una preferencia local que persiste entre sitios y reinicios. Desactivar o eliminar la extensión también detiene el envío del estado de reproducción.

## Los datos permanecen en tu dispositivo

El audio de la pestaña, incluidas voces y anuncios, se analiza en la memoria de la extensión, sin acceso al micrófono, grabación en archivos, transcripción, telemetría analítica ni subidas remotas. Solo se envían a la aplicación local Phase Pal indicadores fijos de reproducción y proveedor, valores booleanos sobre la presencia de metadatos, campos de sesión y protocolo, y valores numéricos del ritmo. No se envían nombres de canciones o artistas, URL, texto de páginas, historial del navegador ni audio sin procesar. Los orígenes personalizados y las dos preferencias se guardan localmente en Chrome. Phase Pal, Chrome y los servicios de música tienen prácticas propias; consulta los [límites completos](docs/PRIVACY.md).

## Compilar y comprobar

Usa Node.js 22.12+ de la rama 22.x o Node.js 24+, npm y el archivo de bloqueo incluido en el repositorio:

```bash
npm ci
npm run check
```

Carga el directorio generado `dist/` como una extensión descomprimida. El ID de desarrollo debe ser `liinajbmlphpehjkmjdffpjhajdpgfpm`, correspondiente al host nativo `app.phasepal.music`. La clave pública del manifiesto fija este ID; no es una credencial privada.

Consulta los [comandos de desarrollo y del host nativo](docs/DEVELOPMENT.md), el [diseño V1](docs/DESIGN.md) y la [guía para contribuir](CONTRIBUTING.md). Los usuarios de una aplicación empaquetada compatible no necesitan Rust, Python ni instalar el host manualmente. Para desarrollar el host se necesitan Rust 1.85+, Python 3 y las herramientas de compilación de la plataforma.

```bash
cargo test --manifest-path native-host/Cargo.toml --locked
npm run package:store
```

El empaquetado requiere Python 3 y guarda ambos ZIP y sus sumas de verificación en `BuildArtifacts/chrome-web-store/0.1.0/`. El ZIP preliminar conserva la clave de desarrollo; el paquete para la tienda la omite. Verifica el ID asignado por Google y coordina ambas copias del código del host nativo y el registro de la aplicación antes de distribuir una aplicación para ese ID. No se incluye ningún ejecutable nativo. Las pruebas locales no verifican la captura real en Chrome ni la aplicación empaquetada. No se configura CI.

## Publicación y soporte

Consulta la [preparación de la tienda](docs/STORE_PREPARATION.md) y la [lista de envío](store/RELEASE_CHECKLIST.md) para los requisitos pendientes. No añadas a Git compilaciones, audio, cachés, ajustes personales ni secretos.

Contacto: [hello@consistencyai.net](mailto:hello@consistencyai.net). Consulta los [avisos de seguridad](SECURITY.md), el [código de conducta](CODE_OF_CONDUCT.md) y la [revisión de publicación del código](docs/PUBLIC_RELEASE_REVIEW.md). El código y los documentos usan la [licencia MIT](LICENSE); también se aplican las licencias de las dependencias a las compilaciones. La imagen del conejo tiene condiciones aparte en [NOTICE](NOTICE).
