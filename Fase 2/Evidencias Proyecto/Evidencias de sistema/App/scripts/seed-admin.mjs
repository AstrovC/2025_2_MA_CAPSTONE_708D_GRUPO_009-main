// Seed de Firestore con Firebase Admin SDK (ignora reglas de seguridad)
// Requiere credenciales de servicio:
// - O bien exporta GOOGLE_APPLICATION_CREDENTIALS=/ruta/service-account.json
// - O define FIREBASE_SERVICE_ACCOUNT_PATH=/ruta/service-account.json

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

  // 1) Intentar con variables de entorno
  const appFromEnv = tryInitWithPath(envCredPath);
  if (appFromEnv) return appFromEnv;

  // 2) Intentar con service-account.json en el proyecto
  const appFromLocal = tryInitWithPath(localCredPath);
  if (appFromLocal) return appFromLocal;

  // 3) Intentar applicationDefault (p.ej. en Cloud o con var de entorno global)
  return initializeApp({ credential: applicationDefault() });
}

async function ensureAdminUser(db) {
  const email = 'admin@admin.com';
  const nombre = 'Admin';
  const rol = 'admin';
  console.log('> Verificando usuario admin (Admin SDK)...');
  const snap = await db.collection('usuarios').where('email', '==', email).limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    const data = doc.data() || {};
    if (!data.password) {
      await db.collection('usuarios').doc(doc.id).set({ ...data, password: 'admin', updatedAt: new Date().toISOString() });
      console.log('• Contraseña establecida para admin');
    }
    console.log('✓ Usuario admin ya existe:', doc.id);
    return doc.id;
  }
  const ref = await db.collection('usuarios').add({
    nombre,
    email,
    rol,
    password: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log('✓ Usuario admin creado:', ref.id);
  return ref.id;
}

async function ensureServices(db) {
  const services = [
    { nombre: 'ENFERMERIA', descripcion: 'Atención de salud básica y primeros auxilios; control de signos vitales y apoyo TENS.' },
    { nombre: 'SERVICIOS GENERALES', descripcion: 'Aseo y mantención menor; suministro de insumos y apoyo operativo en salas.' },
    { nombre: 'SOPORTE CETECOM', descripcion: 'Soporte técnico de equipos y conectividad; diagnóstico y resolución de incidencias.' },
    { nombre: 'SEGURIDAD', descripcion: 'Resguardo y asistencia ante incidentes; coordinación con guardias y control de acceso.' },
  ];
  console.log('> Sembrando servicios (Admin SDK)...');
  for (const s of services) {
    const snap = await db.collection('servicios').where('nombre', '==', s.nombre).limit(1).get();
    if (!snap.empty) {
      console.log(`• Servicio ya existe: ${s.nombre} -> ${snap.docs[0].id}`);
      continue;
    }
    const ref = await db.collection('servicios').add({
      nombre: s.nombre,
      descripcion: s.descripcion,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`✓ Servicio creado: ${s.nombre} -> ${ref.id}`);
  }
}

async function getServiceIdByName(db, nombre) {
  const snap = await db.collection('servicios').where('nombre', '==', nombre).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

async function ensureRooms(db) {
  const rooms = ['1', '2', '3'];
  console.log('> Sembrando salas (1, 2, 3)...');
  for (const id of rooms) {
    const docRef = db.collection('salas').doc(id);
    const doc = await docRef.get();
    if (doc.exists) {
      console.log(`• Sala ya existe: ${id}`);
      continue;
    }
    await docRef.set({
      nombre: `Sala ${id}`,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`✓ Sala creada: ${id}`);
  }
}

async function seedSampleRequestAndNotification(db, servicioId, usuarioId, roomId = '1') {
  if (!servicioId || !usuarioId) {
    console.log('• Omitiendo solicitud/notificación de ejemplo: faltan IDs');
    return;
  }
  const solRef = await db.collection('solicitudes').add({
    servicioId,
    roomId,
    usuarioId,
    fecha: new Date().toISOString(),
    estado: 'pendiente',
    source: 'seed',
  });
  console.log(`✓ Solicitud creada (sala ${roomId}):`, solRef.id);
  await db.collection('notificaciones').add({
    titulo: 'Solicitud enviada',
    cuerpo: `Sala ${roomId} asociada. Enviada a administración.`,
    fecha: new Date().toISOString(),
    solicitudId: solRef.id,
    userId: usuarioId,
    leida: false,
    source: 'seed',
  });
  console.log('✓ Notificación creada para la solicitud:', solRef.id);
}

async function main() {
  try {
    initAdminApp();
    const db = getFirestore();
    console.log('Iniciando seed (Admin SDK)...');
    const adminId = await ensureAdminUser(db);
    await ensureServices(db);
    await ensureRooms(db);

    // Semillas de ejemplo: solicitudes en salas 1, 2 y 3
    const seguridadId = await getServiceIdByName(db, 'SEGURIDAD');
    await seedSampleRequestAndNotification(db, seguridadId, adminId, '1');
    await seedSampleRequestAndNotification(db, seguridadId, adminId, '2');
    await seedSampleRequestAndNotification(db, seguridadId, adminId, '3');

    console.log('Seed (Admin) completado.');
  } catch (err) {
    console.error('Error durante el seed (Admin):', err?.message ?? err);
    process.exitCode = 1;
  }
}

main();