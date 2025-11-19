// Migración de estados antiguos a los oficiales en Firestore
// Ejecuta: node scripts/migrate-states.mjs

import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

function loadFirebaseConfig() {
  const appJsonPath = path.join(process.cwd(), 'app.json');
  const raw = fs.readFileSync(appJsonPath, 'utf-8');
  const json = JSON.parse(raw);
  const cfg = json?.expo?.extra?.firebase;
  if (!cfg?.apiKey || !cfg?.projectId || !cfg?.appId) {
    throw new Error('Credenciales Firebase faltantes en app.json (expo.extra.firebase).');
  }
  return cfg;
}

function normalizeEstado(estado) {
  if (estado === 'tomada' || estado === 'en_proceso') return 'tomado';
  if (estado === 'realizada' || estado === 'atendido') return 'realizado';
  if (estado === 'cancelado') return 'pendiente';
  if (estado === 'pendiente' || estado === 'tomado' || estado === 'realizado') return estado;
  return 'pendiente';
}

async function migrateSolicitudes(db) {
  const oldStates = ['tomada', 'realizada', 'en_proceso', 'atendido', 'cancelado'];
  console.log('[Migración] Buscando solicitudes con estados antiguos...', oldStates);
  const q = query(collection(db, 'solicitudes'), where('estado', 'in', oldStates));
  const snap = await getDocs(q);
  let updated = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const current = data?.estado;
    const next = normalizeEstado(current);
    if (current !== next) {
      await updateDoc(doc(db, 'solicitudes', d.id), { estado: next });
      updated += 1;
      console.log(` - ${d.id}: ${current} -> ${next}`);
    }
  }
  console.log(`[Migración] Solicitudes actualizadas: ${updated}`);
}

async function main() {
  const cfg = loadFirebaseConfig();
  const app = initializeApp(cfg);
  const db = getFirestore(app);
  await migrateSolicitudes(db);
  console.log('[Migración] Completada.');
}

main().catch((err) => {
  console.error('[Migración] Error:', err);
  process.exit(1);
});