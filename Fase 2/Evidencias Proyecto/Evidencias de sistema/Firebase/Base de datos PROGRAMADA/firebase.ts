import Constants from 'expo-constants';
import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Resuelve configuración desde expo.extra.firebase y variables de entorno EXPO_PUBLIC_*
function resolveFirebaseConfig(): FirebaseOptions {
  const extra = (Constants?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra ?? {}) as { firebase?: FirebaseOptions };
  const fromExtra = (extra?.firebase ?? {}) as FirebaseOptions;

  const fromEnv: FirebaseOptions = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  // Merge: prioridad a extra, fallback a env
  return {
    apiKey: fromExtra.apiKey || fromEnv.apiKey,
    authDomain: fromExtra.authDomain || fromEnv.authDomain,
    projectId: fromExtra.projectId || fromEnv.projectId,
    storageBucket: fromExtra.storageBucket || fromEnv.storageBucket,
    messagingSenderId: fromExtra.messagingSenderId || fromEnv.messagingSenderId,
    appId: fromExtra.appId || fromEnv.appId,
    measurementId: fromExtra.measurementId || fromEnv.measurementId,
  } as FirebaseOptions;
}

const firebaseConfig = resolveFirebaseConfig();

// Detecta si hay credenciales mínimas para habilitar Firebase
const hasMinimalConfig = Boolean(firebaseConfig?.apiKey && firebaseConfig?.projectId && firebaseConfig?.appId);

// Debug de configuración
try {
  console.info('[Firebase] Config detectada', { projectId: firebaseConfig?.projectId });
} catch {}

let app: FirebaseApp | null = null;
if (hasMinimalConfig) {
  if (getApps().length) {
    app = getApps()[0];
  } else {
    try {
      app = initializeApp(firebaseConfig);
      try {
        console.info('[Firebase] App inicializada', { name: app?.name, projectId: app?.options?.projectId });
      } catch {}
    } catch (e) {
      console.warn('No se pudo inicializar Firebase; modo sin conexión activado.', e);
      app = null;
    }
  }
} else {
  console.warn('Firebase deshabilitado: credenciales faltantes en expo.extra.firebase o EXPO_PUBLIC_*. Continuando sin conexión.', { projectId: firebaseConfig?.projectId });
}

let authInstance: ReturnType<typeof getAuth> | null = null;
let dbInstance: ReturnType<typeof getFirestore> | null = null;

try {
  authInstance = app ? getAuth(app) : null;
} catch (e) {
  console.warn('Auth no disponible; continuará sin autenticación.', e);
  authInstance = null;
}

try {
  dbInstance = app ? getFirestore(app) : null;
} catch (e) {
  console.warn('Firestore no disponible; modo sin conexión.', e);
  dbInstance = null;
}

// Habilita funcionalidades de Firestore aunque Auth no esté configurado
export const isFirebaseEnabled = Boolean(app && dbInstance);
export const auth = authInstance as any;
export const db = dbInstance as any;
export default app as any;