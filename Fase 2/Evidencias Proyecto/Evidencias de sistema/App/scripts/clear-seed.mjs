// Limpieza de datos de seed en Firestore con Firebase Admin SDK
// Requiere credenciales de servicio:
// - GOOGLE_APPLICATION_CREDENTIALS=/ruta/service-account.json
// - o FIREBASE_SERVICE_ACCOUNT_PATH=/ruta/service-account.json

import fs from 'fs';
import path from 'path';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initAdminApp() {
  const envCredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
  const localCredPath = path.resolve(process.cwd(), 'service-account.json');

  const tryInitWithPath = (credPath) => {
    if (credPath && fs.existsSync(credPath)) {
      const key = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      return initializeApp({ credential: cert(key) });
    }
    return null;
  };

  const appFromEnv = tryInitWithPath(envCredPath);
  if (appFromEnv) return appFromEnv;

  const appFromLocal = tryInitWithPath(localCredPath);
  if (appFromLocal) return appFromLocal;

  return initializeApp({ credential: applicationDefault() });
}

async function deleteAllDocs(db, collectionName, batchLimit = 500) {
  let totalDeleted = 0;
  while (true) {
    const snap = await db.collection(collectionName).limit(batchLimit).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    totalDeleted += snap.docs.length;
    console.log(`• Borrados ${snap.docs.length} documentos de ${collectionName} (acumulado: ${totalDeleted})`);
  }
  console.log(`✓ Colección ${collectionName} vaciada. Total eliminados: ${totalDeleted}`);
}

async function main() {
  try {
    initAdminApp();
    const db = getFirestore();
    console.log('Iniciando limpieza de seed (Admin SDK)...');
    await deleteAllDocs(db, 'notificaciones');
    await deleteAllDocs(db, 'servicios');
    await deleteAllDocs(db, 'solicitudes');
    await deleteAllDocs(db, 'usuarios');
    console.log('Limpieza completada.');
  } catch (err) {
    console.error('Error durante la limpieza:', err?.message ?? err);
    process.exitCode = 1;
  }
}

main();