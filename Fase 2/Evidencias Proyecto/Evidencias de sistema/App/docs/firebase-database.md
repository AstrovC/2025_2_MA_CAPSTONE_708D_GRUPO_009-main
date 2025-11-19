# Base de datos Firebase / Firestore

Este documento resume el modelo de datos y flujos de lectura/escritura usados por la app.

## Colecciones
- `usuarios`: perfil básico (`nombre`, `email`, `rol`).
- `servicios`: catálogo con `nombre`, `descripcion`, `active`, `createdAt`, `updatedAt`.
- `solicitudes`: referencias a `servicioId`, `usuarioId`, `roomId`, `fecha`, `estado`.
- `notificaciones`: mensajes ligados a `solicitudId` y `userId`.

## Lecturas en la app
- Servicios (Dashboard/Scan):
  - `queryCollection(COLLECTIONS.servicios, [where('active','==',true)])`
  - Ordenar en cliente (p.ej. por `nombre`) para evitar índices compuestos.
- Historial (History):
  - Suscripción realtime filtrando por `usuarioId`:
    ```ts
    const unsub = subscribeCollection({
      collectionPath: COLLECTIONS.solicitudes,
      constraints: [where('usuarioId','==',user.id)],
      onData: (rows) => useSAMStore.setState({ solicitudes: rows }),
    });
    ```
- Notificaciones:
  - Suscripción filtrando por `userId`.

## Escrituras en la app
- Crear servicio (pantalla Admin):
  - `addDocument(COLLECTIONS.servicios, { nombre, descripcion, active: true, createdAt: ISO, updatedAt: ISO })`
- Crear solicitud:
  - `addDocument(COLLECTIONS.solicitudes, { servicioId, roomId, usuarioId, fecha: ISO, estado: 'pendiente', source: 'app' })`
- Crear notificación:
  - `addDocument('notificaciones', { titulo, cuerpo, fecha: ISO, solicitudId, userId, leida: false })`

## Reglas para pruebas (simplificadas temporalmente)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
Luego endurece reglas con Auth y roles.

## Observaciones
- La app ahora no mezcla datos de demo: todos los listados provienen de Firestore.
- Si no ves servicios, confirma que tengan `active: true` y que las credenciales de Firebase cargan en la app (`lib/firebase.ts` logs).