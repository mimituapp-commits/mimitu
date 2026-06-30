# Mimitu — Cómo instalar en Android y iPhone

Esta es una **PWA (app web instalable)**: se instala en la pantalla de inicio y se abre como una app nativa (pantalla completa, ícono propio, funciona offline). No necesita tiendas ni cuentas de desarrollador.

> Por qué PWA y no `.ipa`/`.apk` nativos: Apple exige firmar el `.ipa` con una cuenta de Apple Developer ($99/año) y compilar en Mac; eso no se puede hacer en este entorno. La PWA es lo que se instala **hoy** en un iPhone y un Android reales, ideal para validar el MVP. Cuando quieras publicar en las tiendas, este mismo código se puede empaquetar (Capacitor/TWA) o reescribir nativo.

---

## Paso 1 — Publicar los archivos (1 sola vez, ~2 minutos)

Una PWA necesita abrirse desde una URL `https://` para poder instalarse. La forma más rápida y gratis:

**Opción A — Netlify Drop (sin cuenta técnica, arrastrar y soltar)**
1. Entrá a https://app.netlify.com/drop
2. Arrastrá la **carpeta `MimituApp` completa** a la página.
3. Te da una URL del tipo `https://algo-azar.netlify.app` — esa es tu app.

**Opción B — GitHub Pages / Vercel**
- Subí la carpeta a un repo y activá Pages, o importala en Vercel. Mismo resultado.

> Para probar en tu computadora: abrí una terminal en la carpeta y corré `python3 -m http.server 8080`, luego entrá a `http://localhost:8080`. (En el teléfono conviene usar la URL `https` del Paso 1.)

---

## Paso 2 — Instalar en el teléfono

**📱 Android (Chrome)**
1. Abrí la URL en Chrome.
2. Tocá el menú **⋮** (arriba a la derecha).
3. Elegí **"Instalar app"** o **"Agregar a pantalla de inicio"**.
4. Confirmá. Queda el ícono de Mimitu como una app más.

**🍎 iPhone (Safari — importante: usar Safari, no Chrome)**
1. Abrí la URL en **Safari**.
2. Tocá el botón **Compartir** (el cuadrado con la flecha hacia arriba).
3. Bajá y elegí **"Agregar a pantalla de inicio"**.
4. Tocá **"Agregar"**. Queda el ícono de Mimitu en tu pantalla.

---

## Cómo probar la app (demo)

Como es un prototipo con **datos locales** (sin servidor), ambos miembros de la pareja viven en el mismo dispositivo. Para ver el flujo completo:

1. Completá el **onboarding** (mayoría de edad → cuenta → tu nombre → invitar/usar código → nombre de tu pareja).
2. En la pantalla principal vas a ver el **marcador**.
3. Registrá una acción chica (ej. *Lavar los platos, +15*): se acredita al instante **por honor** (≤ 25).
4. Registrá una acción grande (ej. *Cocinar, +30*): queda **pendiente de aprobación**.
5. Tocá el **chip de arriba a la izquierda (⇄)** para **cambiar de miembro** (simula el teléfono de tu pareja) y **aprobá** la acción.
6. En **Premios**: proponé un premio, cambiá de miembro para **aceptarlo**, y **canjealo** (baja tu saldo).
7. En **Ajustes** podés activar **Premium** (quita ads, desbloquea límites y el umbral configurable) y **reiniciar** la demo.

---

## Qué incluye esta versión (MVP completo del PRD)

- Onboarding diferenciado (invitar / unirse por código) + gate de mayoría de edad y términos + login simulado (Google / Apple / email).
- Marcador de la pareja en tiempo real (y modo grupo para 3+ integrantes en Premium).
- Catálogo de acciones por categoría + acciones rápidas + **crear acción propia con filtro de contenido** (rechaza lenguaje no permitido).
- **Validación mixta**: ≤ 25 por honor, > 25 requiere aprobación de la pareja (umbral configurable en Premium).
- Premios por **propuesta-aceptación** y **canje** (única forma de bajar el saldo).
- **Calendario**: fechas significativas (recordatorio + bonificación al cumplir, sin penalización por olvido) y **planes compartidos**.
- **Pregunta diaria** (ambos responden en privado, se revela al responder los dos, +5 mimitus).
- **Agradecimientos** sobre las acciones del feed (reacción + nota).
- Feed / historial de actividad.
- **Torneos de Amigos**: unirse (gratuito) o crear (Premium), leaderboard con vista **por pareja e individual**, duración con cierre y pareja ganadora, privacidad (solo totales).
- **Notificaciones** in-app + opción de activar notificaciones del navegador.
- **Freemium / Premium** completo (comparación de planes, límites, ads en zona fría).
- **Gestión de la relación**: disolver y agregar integrantes (3+ en Premium).
- Tono 100% positivo: nada resta puntos.

### Probar lo nuevo
- **Pregunta diaria / validación / torneos**: usá el chip **⇄** (arriba a la izquierda) para alternar entre los dos miembros y ver ambos lados (responder, aprobar, aceptar premios).
- **Torneos**: las otras parejas están simuladas; tu pareja arranca en 0 y sube a medida que registrás acciones validadas.
- **Notificaciones reales**: tocá "Activar notificaciones" en Ajustes (requiere la app instalada; en iPhone, iOS 16.4+).

> Pendiente para producción (fuera de un prototipo local): backend real con sincronización entre los dos teléfonos, push server (FCM/APNs), almacenamiento de fotos de evidencia, pagos de la suscripción y el servicio de IA de moderación. El comportamiento ya está modelado en la app.
