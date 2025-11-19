import { StyleSheet, ScrollView, View as RNView, TouchableOpacity } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSAMStore } from '@/store/samStore';
import { useCallback, useEffect, useState } from 'react';
import { subscribeCollection, COLLECTIONS, fetchDoc } from '@/lib/firestore';
import { where } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function History() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const requests = useSAMStore((s) => s.solicitudes);
  const services = useSAMStore((s) => s.servicios);
  const user = useSAMStore((s) => s.usuario);
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  // Eliminado: conteo de no leídas y última fecha de notificación (no se requiere)

  // Guard: Solo docentes pueden ver el historial
  if ((user?.rol ?? '').toLowerCase() !== 'docente') {
    router.replace('/(tabs)/notifications');
    return null;
  }

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      const unsub = subscribeCollection<any>({
        collectionPath: COLLECTIONS.solicitudes,
        constraints: [where('usuarioId', '==', user.id)],
        onData: (rows) => {
          const sorted = rows.slice().sort((a: any, b: any) => {
            const ta = new Date(a?.fecha ?? 0).getTime();
            const tb = new Date(b?.fecha ?? 0).getTime();
            return tb - ta;
          });
          useSAMStore.setState({ solicitudes: sorted });
        },
      });
      return () => unsub();
    }, [user?.id])
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

  // Eliminado: suscripción a notificaciones para conteo de no leídas

  // Eliminado: marcado de notificaciones como leídas al tocar la tarjeta

  // Obtener nombres de agentes (usuarios) que atendieron/tomaron solicitudes
  useEffect(() => {
    const ids = Array.from(new Set((requests || [])
      .map((r: any) => r.agenteId)
      .filter((id: string | undefined) => !!id))) as string[];
    const missing = ids.filter((id) => !agentNames[id]);
    if (missing.length === 0) return;
    (async () => {
      const updates: Record<string, string> = {};
      for (const id of missing) {
        const doc = await fetchDoc<{ nombre?: string; apellido?: string; displayName?: string }>(COLLECTIONS.usuarios, id);
        if (doc) {
          const display = doc.displayName || [doc.nombre, doc.apellido].filter(Boolean).join(' ').trim() || doc.id;
          updates[id] = display;
        }
      }
      if (Object.keys(updates).length) setAgentNames((prev) => ({ ...prev, ...updates }));
    })().catch(() => {});
  }, [requests, agentNames]);

  const estadoColors = {
    pendiente: { bg: '#FEF3C7', border: theme.warning, text: '#92400e' },
    tomado: { bg: '#DBEAFE', border: theme.info, text: '#1e3a8a' },
    realizado: { bg: '#D1FAE5', border: theme.success, text: '#065f46' },
  } as const;
  const normalizeEstadoKey = (estado: any): keyof typeof estadoColors => {
    if (estado === 'tomada' || estado === 'en_proceso') return 'tomado';
    if (estado === 'realizada' || estado === 'atendido') return 'realizado';
    if (estado === 'cancelado') return 'pendiente';
    if (estado === 'pendiente' || estado === 'tomado' || estado === 'realizado') return estado as keyof typeof estadoColors;
    return 'pendiente';
  };
  const getEstadoStyle = (estado: any) => {
    const key = normalizeEstadoKey(estado);
    return {
      backgroundColor: estadoColors[key].bg,
      borderColor: estadoColors[key].border,
    };
  };
  const estadoTextColor = (estado: any) => {
    const key = normalizeEstadoKey(estado);
    return { color: estadoColors[key].text };
  };
  const labelEstado = (estado: 'pendiente' | 'tomado' | 'realizado') => {
    switch (estado) {
      case 'tomado':
        return 'Tomado';
      case 'realizado':
        return 'Realizado';
      case 'pendiente':
      default:
        return 'Pendiente';
    }
  };

  const getServiceName = (id: string) => services.find((s) => s.id === id)?.nombre ?? 'Desconocido';
  const formatDDMMYYYY = (iso: string) => {
    let d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatDDMMYYYYHHMM = (iso: string) => {
    let d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notificaciones</Text>
      {requests.length === 0 && <Text>No hay solicitudes aún.</Text>}
      <ScrollView>
        {requests.map((req) => (
          <TouchableOpacity key={req.id} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Text style={styles.line}>Servicio: {getServiceName(req.servicioId)}</Text>
            <Text style={[styles.line, { color: theme.muted }]}>Sala: {req.roomId ?? '-'}</Text>
            <View style={styles.estadoRow}>
              <Text style={styles.line}>Estado: </Text>
              <View style={[styles.estadoBadge, getEstadoStyle(req.estado)]}>
                <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <FontAwesome
                    name={
                      normalizeEstadoKey(req.estado) === 'pendiente' ? 'clock-o' :
                      normalizeEstadoKey(req.estado) === 'tomado' ? 'hand-paper-o' :
                      normalizeEstadoKey(req.estado) === 'realizado' ? 'check-circle' :
                      'ban'
                    }
                    size={14}
                    color={estadoColors[normalizeEstadoKey(req.estado)].text}
                  />
                  <Text style={[styles.estadoText, estadoTextColor(req.estado)]}>{labelEstado(normalizeEstadoKey(req.estado))}</Text>
                </RNView>
              </View>
              {/* Badge de no leídas removido */}
            </View>
            {/* Línea “Última acción” eliminada por solicitud del usuario */}
            {/* Línea de último aviso removida: mostramos solo fecha de solicitud y badge de nuevos */}
            {!!req.agenteId ? (
              <Text style={styles.line}>
                {((req.estado === 'realizado')  ? 'Atendió' : 'Tomó')}: {agentNames[req.agenteId] ?? req.agenteId}
              </Text>
            ) : (
              <Text style={[styles.line, { opacity: 0.8 }]}>Sin agente asignado</Text>
            )}
            {!!req.observacion && (
              <Text style={styles.line}>Mensaje del servicio: {req.observacion}</Text>
            )}
            {!!req.observacionFinal && (
              <Text style={styles.line}>Mensaje final del servicio: {req.observacionFinal}</Text>
            )}
            <Text style={[styles.line, { color: theme.muted }]}>Fecha solicitud: {formatDDMMYYYYHHMM(req.fecha)}</Text>
            {/* Fechas de tomada/realizada no se muestran */}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  line: { marginVertical: 2 },
  estadoRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2, backgroundColor: 'transparent' },
  estadoBadge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  estadoText: { fontWeight: '600' },
  badge: { marginLeft: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
});