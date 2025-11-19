import { StyleSheet, TouchableOpacity, ActivityIndicator, View as RNView, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSAMStore } from '@/store/samStore';
import { useCallback, useEffect, useState } from 'react';
import { subscribeCollection, setDocument, COLLECTIONS, fetchDoc } from '@/lib/firestore';
import { where, orderBy } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function Notifications() {
  const requests = useSAMStore((s) => s.solicitudes);
  const services = useSAMStore((s) => s.servicios);
  const user = useSAMStore((s) => s.usuario);
  const isAdmin = useSAMStore((s) => s.isAdmin);
  const sessionReady = useSAMStore((s) => s.sessionReady);
  const isAuthenticated = useSAMStore((s) => s.isAuthenticated);
  const [loading, setLoading] = useState(true);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  useFocusEffect(
    useCallback(() => {
      if (!sessionReady) {
        setLoading(true);
        return;
      }
      if (!user?.id) {
        setLoading(false);
        useSAMStore.setState({ solicitudes: [] });
        return;
      }
      setLoading(true);
      const constraints = isAdmin
        ? [orderBy('fecha', 'desc')]
        : [where('usuarioId', '==', user.id), orderBy('fecha', 'desc')];
      const unsub = subscribeCollection<any>({
        collectionPath: COLLECTIONS.solicitudes,
        constraints,
        onData: (rows) => {
          const sorted = rows.slice().sort((a, b) => {
            const ad = new Date(a.fecha).getTime();
            const bd = new Date(b.fecha).getTime();
            return bd - ad;
          });
          useSAMStore.setState({ solicitudes: sorted });
          setLoading(false);
        },
      });
      return () => {
        unsub();
        setLoading(false);
      };
    }, [sessionReady, user?.id, isAdmin])
  );

  // Obtener nombres de servicios faltantes para no mostrar IDs
  useEffect(() => {
    const missing = Array.from(new Set(requests.map((r) => r.servicioId).filter((id) => !services.find((s) => s.id === id))));
    if (missing.length === 0) return;
    (async () => {
      const fetched: { id: string; nombre: string; descripcion?: string }[] = [];
      for (const id of missing) {
        const doc = await fetchDoc<{ nombre: string; descripcion?: string }>(COLLECTIONS.servicios, id);
        if (doc) fetched.push({ id: doc.id, nombre: doc.nombre, descripcion: doc.descripcion });
      }
      if (fetched.length) {
        const merged = [...services, ...fetched.filter((f) => !services.find((s) => s.id === f.id))];
        useSAMStore.setState({ servicios: merged });
      }
    })().catch(() => {});
  }, [requests, services]);

  // Obtener nombres de usuarios que enviaron las solicitudes (solo para mostrar en admin)
  useEffect(() => {
    const missingUsers = Array.from(new Set(requests.map((r) => r.usuarioId).filter((uid) => !userNames[uid])));
    if (missingUsers.length === 0) return;
    (async () => {
      const fetched: Record<string, string> = {};
      for (const uid of missingUsers) {
        const doc = await fetchDoc<{ nombre: string }>(COLLECTIONS.usuarios, uid);
        if (doc?.nombre) fetched[uid] = doc.nombre;
      }
      if (Object.keys(fetched).length) {
        setUserNames((prev) => ({ ...prev, ...fetched }));
      }
    })().catch(() => {});
  }, [requests, userNames]);

  const estadoColors = {
    pendiente: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    tomado: { bg: '#dbeafe', border: '#1d4ed8', text: '#1e3a8a' },
    realizado: { bg: '#d1fae5', border: '#059669', text: '#065f46' },
  } as const;
  const normalizeEstadoKey = (estado: any): keyof typeof estadoColors => {
    if (estado === 'tomada' || estado === 'en_proceso') return 'tomado';
    if (estado === 'realizada' || estado === 'atendido') return 'realizado';
    if (estado === 'cancelado') return 'pendiente';
    if (estado === 'pendiente' || estado === 'tomado' || estado === 'realizado') return estado as keyof typeof estadoColors;
    return 'pendiente';
  };
  const getEstadoStyle = (estado: any) => ({
    backgroundColor: estadoColors[normalizeEstadoKey(estado)].bg,
    borderColor: estadoColors[normalizeEstadoKey(estado)].border,
  });
  const estadoTextColor = (estado: any) => ({ color: estadoColors[normalizeEstadoKey(estado)].text });
  const labelEstado = (estado: 'pendiente' | 'tomado' | 'realizado') => {
    switch (estado) {
      case 'pendiente':
        return 'Pendiente';
      case 'tomado':
        return 'Tomado';
      case 'realizado':
        return 'Realizado';
      default:
        return 'Pendiente';
    }
  };

  const getServiceName = (id: string) => services.find((s) => s.id === id)?.nombre ?? 'Desconocido';

  const formatDDMMYYYY = (iso: string) => {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  const updateEstado = async (id: string, estado: 'pendiente' | 'tomado' | 'realizado') => {
    if (!isAdmin) return; // Solo admin puede cambiar estado
    const store = useSAMStore.getState();
    const cur = store.solicitudes.find((s) => s.id === id);
    if (!cur) return;
    try {
      await setDocument(COLLECTIONS.solicitudes, id, { ...cur, estado });
    } catch {}
    useSAMStore.setState({ solicitudes: store.solicitudes.map((s) => (s.id === id ? { ...s, estado } : s)) });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notificaciones</Text>
      {(!sessionReady || loading) && (
        <RNView style={{ paddingVertical: 12, alignItems: 'center' }}>
          <ActivityIndicator color={theme.tabIconDefault} />
          <Text style={{ marginTop: 8, opacity: 0.8 }}>Cargando solicitudes...</Text>
        </RNView>
      )}
      {sessionReady && !isAuthenticated && (
        <Text>Inicia sesión para ver tus solicitudes.</Text>
      )}
      {sessionReady && !loading && requests.length === 0 && isAuthenticated && (
        <Text>No hay solicitudes</Text>
      )}
      <ScrollView>
        {sessionReady && !loading && requests.map((req) => (
          <View key={req.id} style={styles.card}>
            <Text style={styles.line}>Servicio: {getServiceName(req.servicioId)}</Text>
            <Text style={styles.line}>Sala: {req.roomId ?? '-'}</Text>
            <RNView style={styles.estadoRow}>
              <Text style={styles.line}>Estado: </Text>
              <RNView style={[styles.estadoBadge, getEstadoStyle(req.estado)]}>
                <Text style={[styles.estadoText, estadoTextColor(req.estado)]}>{labelEstado(normalizeEstadoKey(req.estado))}</Text>
              </RNView>
            </RNView>
            <Text style={styles.line}>Fecha: {formatDDMMYYYY(req.fecha)}</Text>
            {isAdmin && (
              <Text style={styles.line}>Usuario: {userNames[req.usuarioId] ?? 'Desconocido'}</Text>
            )}
            {isAdmin && (
              <RNView style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#1d4ed8' }]} onPress={() => updateEstado(req.id, 'tomado')}>
                  <Text style={{ color: '#fff' }}>Tomado</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#059669' }]} onPress={() => updateEstado(req.id, 'realizado')}>
                  <Text style={{ color: '#fff' }}>Realizado</Text>
                </TouchableOpacity>
              </RNView>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  line: { marginVertical: 2 },
  btn: { padding: 8, borderRadius: 8, alignItems: 'center' },
  estadoRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  estadoBadge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  estadoText: { fontWeight: '600' },
});