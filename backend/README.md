# Mimitu — Backend (API)

API REST de Mimitu: auth, parejas, acciones + moderación, registro con validación mixta, premios, calendario, pregunta diaria, torneos, fotos de evidencia, push y pagos (RevenueCat).

## Correr en local (sin Docker)

```bash
cd backend
cp .env.example .env        # editá JWT_SECRET
npm install
npm start                   # http://localhost:4000
npm test                    # smoke test end-to-end (26 chequeos)
```

Por defecto usa un **store JSON** en `data/db.json` (cero dependencias). Sirve para desarrollo y demo.

**Persistencia en producción (Postgres / Neon):** definí `DATABASE_URL` y el backend cambia automáticamente a Postgres. Al arrancar crea su tabla (`kv`, documentos JSONB) y carga todo en memoria; los cambios se persisten solos. No necesitás correr migraciones para empezar. (El `schema.sql` normalizado queda para una futura migración a tablas relacionales si escalás a varias instancias.)

## Correr con Docker (API + Postgres + MinIO)

```bash
cd backend
docker compose up --build
```

Esto levanta Postgres (con `schema.sql`) y MinIO (S3). Para producción, migrá `src/store.js` a Postgres usando `schema.sql`.

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` · `/login` · `/social` | Email+contraseña y SSO Google/Apple (con vinculación de cuentas) |
| GET | `/api/me` | Usuario + pareja |
| POST | `/api/couples` · `/couples/join` | Crear / unirse por código |
| GET/POST | `/api/actions` | Catálogo + crear acción (pasa por moderación) |
| POST | `/api/logs` | Registrar acción (honor ≤25 / pendiente >25, con foto opcional) |
| POST | `/api/logs/:id/approve` · `/reject` | Validación de la pareja |
| GET/POST | `/api/rewards` (+ `/accept`, `/redeem`) | Premios propuesta-aceptación y canje |
| GET/POST | `/api/daily-question` (+ `/answer`) | Pregunta diaria |
| GET/POST | `/api/dates` (+ `/fulfill`) · `/api/plans` | Calendario |
| GET/POST | `/api/tournaments` (+ `/join`) | Torneos (crear = premium) |
| POST | `/api/push/token` | Registrar token FCM/APNs |
| GET | `/api/entitlements` | Estado Premium de la pareja |
| POST | `/api/webhooks/revenuecat` | Webhook de pagos (activa/desactiva Premium) |

## Notas de implementación

- **Premium es por pareja**, no por usuario: el webhook actualiza `couples.premium` y ambos miembros lo reciben.
- **Foto de evidencia**: en dev se guarda en disco y se sirve por `/uploads`; en prod va a S3/MinIO con URL firmada y temporal (ver `src/services.js`).
- **Moderación**: filtro local de palabras en dev; en prod conectar IA. Fallback del PRD: si el servicio no responde, la acción queda `pending_review`.
- **Auth social**: en dev se simula; en prod verificar `id_token` de Google y el identity token de Apple (ver `src/auth.js`).

Ver `../PAGOS_Y_CONFIGURACION.md` para todo lo que tenés que dar de alta para cobrar, y `../EMPAQUETADO_TIENDAS.md` para llevar la PWA a las tiendas con Capacitor.
