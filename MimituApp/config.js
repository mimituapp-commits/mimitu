/* Configuración de Mimitu.
 * - Dejá MIMITU.api en "" para el modo DEMO LOCAL (datos en el dispositivo).
 * - Poné la URL de tu backend (terminada en /api) para el MODO ONLINE real,
 *   con sincronización entre los teléfonos de la pareja.
 *   Ej: window.MIMITU.api = "https://api.mimitu.app/api";
 * En el build nativo (Capacitor) podés inyectar esta URL aquí.
 */
window.MIMITU = window.MIMITU || {};
if (window.MIMITU.api === undefined) window.MIMITU.api = "";
