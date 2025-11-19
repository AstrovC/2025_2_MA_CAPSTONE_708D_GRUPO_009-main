# Seed rápido de Firestore (Admin SDK)

Guía para cargar datos iniciales en Firebase/Firestore usando exclusivamente el Admin SDK.

## Prerrequisitos
- Credenciales Firebase en `app.json` bajo `expo.extra.firebase` (apiKey, projectId, appId) para la app.
- Archivo de **service account** JSON (Admin SDK) para el seed.

## Seed con Admin SDK (ignora reglas)
1. Descarga tu `service-account.json` desde Firebase Console → Configuración del proyecto → Cuentas de servicio.
2. Exporta la variable de entorno con la ruta del JSON:
   - PowerShell (sesión actual):
     - `$env:GOOGLE_APPLICATION_CREDENTIALS="C:\\ruta\\service-account.json"`
   - PowerShell (persistente):
     - `setx GOOGLE_APPLICATION_CREDENTIALS "C:\\ruta\\service-account.json"`
   - Alternativa: usa `FIREBASE_SERVICE_ACCOUNT_PATH`.
3. Ejecuta: `npm run seed:admin`

## Qué se crea
- Colección `usuarios`: usuario admin (`email: "admin"`, `nombre: "Admin"`, `rol: "admin"`).
- Colección `servicios`: `SEGURIDAD`, `SOPORTE CETECOM`, `ENFERMERIA`, `SERVICIOS GENERALES` (con `active: true`, timestamps ISO).
- Colección `salas`: documentos con IDs `1`, `2`, `3` (cada uno con `nombre`, `active`, timestamps) para validar salas.
- Solicitudes de ejemplo: 3 solicitudes pendientes en salas `1`, `2` y `3` para facilitar pruebas del flujo.

## Verificación
- Ve a Firebase Console → Firestore y confirma documentos en `usuarios` y `servicios`.
- El terminal mostrará IDs creados y mensajes ✓.

## Personalización
- Edita `scripts/seed-admin.mjs` para:
  - Cambiar nombres/descripciones de servicios.
  - Ajustar las salas de las solicitudes de ejemplo (por defecto `1`, `2`, `3`).

## Notas de integración
- La app lista servicios activos usando filtros: `where('active','==',true)` y `orderBy('createdAt','desc')`.
- La pantalla Admin crea servicios con `active: true` y timestamps para que aparezcan en Dashboard/Scan.

## Siguiente paso
- Ajusta reglas seguras (roles/Auth) según `docs/firebase-database.md` tras finalizar pruebas.