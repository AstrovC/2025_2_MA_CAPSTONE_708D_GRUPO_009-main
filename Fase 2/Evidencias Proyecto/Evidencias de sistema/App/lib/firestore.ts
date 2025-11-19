import { db, isFirebaseEnabled } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  addDoc,
  setDoc,
  type Query,
  type CollectionReference,
  type DocumentData,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
  type QueryConstraint,
  type FirestoreError,
} from 'firebase/firestore';

export type WithId<T> = T & { id: string };

/**
 * Obtiene todos los documentos de una colección.
 */
export async function fetchCollection<T>(collectionPath: string): Promise<WithId<T>[]> {
  if (!isFirebaseEnabled || !db) return [];
  try {
    const snap = await getDocs(collection(db, collectionPath));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
  } catch (err) {
    try { console.warn('[Firestore] fetchCollection error', { collectionPath, err }); } catch {}
    return [];
  }
}

/**
 * Obtiene un documento por id.
 */
export async function fetchDoc<T>(collectionPath: string, id: string): Promise<WithId<T> | null> {
  if (!isFirebaseEnabled || !db) return null;
  try {
    const ref = doc(db, collectionPath, id);
    const snap = await getDoc(ref);
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as T) }) : null;
  } catch (err) {
    try { console.warn('[Firestore] fetchDoc error', { collectionPath, id, err }); } catch {}
    return null;
  }
}

/**
 * Ejecuta una consulta con constraints en una colección.
 */
export async function queryCollection<T>(
  collectionPath: string,
  constraints: QueryConstraint[] = []
): Promise<WithId<T>[]> {
  if (!isFirebaseEnabled || !db) return [];
  try {
    const q = query(collection(db, collectionPath), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
  } catch (err) {
    try { console.warn('[Firestore] queryCollection error', { collectionPath, constraints, err }); } catch {}
    return [];
  }
}

/**
 * Suscribe a cambios en una colección (realtime). Devuelve `unsubscribe`.
 */
export function subscribeCollection<T>(args: {
  collectionPath: string;
  constraints?: QueryConstraint[];
  onData: (docs: WithId<T>[]) => void;
  onError?: (e: FirestoreError) => void;
}): () => void {
  const { collectionPath, constraints = [], onData, onError } = args;
  if (!isFirebaseEnabled || !db) {
    try { onData([]); } catch {}
    onError?.({ code: 'unavailable', message: 'Firestore disabled', name: 'FirestoreError' } as FirestoreError);
    try { console.warn('[Firestore] subscribeCollection disabled', { collectionPath }); } catch {}
    return () => {};
  }
  try {
    const q = constraints.length ? query(collection(db, collectionPath), ...constraints) : collection(db, collectionPath);
    const unsub = onSnapshot(
      q as Query<DocumentData> | CollectionReference<DocumentData>,
      (snap: QuerySnapshot<DocumentData>) => {
        const rows = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...(d.data() as T) }));
        onData(rows);
      },
      (err: FirestoreError) => {
        try { console.warn('[Firestore] subscribeCollection error', { collectionPath, constraints, err }); } catch {}
        onError?.(err);
      }
    );
    return unsub;
  } catch (err) {
    try { console.warn('[Firestore] subscribeCollection setup error', { collectionPath, constraints, err }); } catch {}
    onError?.(err as FirestoreError);
    return () => {};
  }
}

// Ejemplos de nombres de colecciones (ajusta según tu estructura real)
export const COLLECTIONS = {
  usuarios: 'usuarios',
  servicios: 'servicios',
  solicitudes: 'solicitudes',
} as const;

/**
 * Crea un documento en una colección (id autogenerado).
 */
export async function addDocument<T extends DocumentData>(collectionPath: string, data: T) {
  if (!isFirebaseEnabled || !db) return Promise.reject(new Error('Firestore disabled'));
  try {
    return await addDoc(collection(db, collectionPath), data);
  } catch (err) {
    try { console.warn('[Firestore] addDocument error', { collectionPath, err, data }); } catch {}
    return Promise.reject(err);
  }
}

/**
 * Crea/actualiza un documento por id.
 */
export async function setDocument<T extends DocumentData>(collectionPath: string, id: string, data: T) {
  if (!isFirebaseEnabled || !db) return Promise.reject(new Error('Firestore disabled'));
  try {
    return await setDoc(doc(db, collectionPath, id), data, { merge: true });
  } catch (err) {
    try { console.warn('[Firestore] setDocument error', { collectionPath, id, err, data }); } catch {}
    return Promise.reject(err);
  }
}