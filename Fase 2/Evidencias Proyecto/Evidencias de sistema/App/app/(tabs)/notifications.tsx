import { StyleSheet, TouchableOpacity, ActivityIndicator, View as RNView, ScrollView, TextInput } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSAMStore } from '@/store/samStore';
import { useCallback, useEffect, useState } from 'react';
import { subscribeCollection, setDocument, COLLECTIONS, fetchDoc, addDocument, queryCollection } from '@/lib/firestore';
import { where, orderBy } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { router } from 'expo-router';

export default function Notifications() {
  const requests = useSAMStore((s) => s.solicitudes);
  const services = useSAMStore((s) => s.servicios);
  const user = useSAMStore((s) => s.usuario);
  const isAdmin = useSAMStore((s) => s.isAdmin);
  const sessionReady = useSAMStore((s) => s.sessionReady);
  const isAuthenticated = useSAMStore((s) => s.isAuthenticated);
  const [loading, setLoading] = useState(true);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});
  const [observacionesFinales, setObservacionesFinales] = useState<Record<string, string>>({});
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const isServiceRole = ['servicios_generales','salud','soporte','seguridad'].includes((user?.rol ?? '').toLowerCase());

  // Guard: Docentes no ven Notificaciones (ellos usan Historial)
  if ((user?.rol ?? '').toLowerCase() === 'docente') {
    router.replace('/(tabs)/dashboard');
    return null;
  }

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
      // Si es admin, ve todo. Si es docente, ve sus propias solicitudes.
      // Si es de un servicio (p.ej. servicios generales), ve solicitudes de su servicio.
      const serviceNameForRole = (rol?: string | null) => {
        switch ((rol ?? '').toLowerCase()) {
          case 'servicios_generales':
            return 'SERVICIOS GENERALES';
          case 'salud':
            return 'ENFERMERIA';
          case 'soporte':
            return 'SOPORTE CETECOM';
          case 'seguridad':
            return 'SEGURIDAD';
          default:
            return null;
        }
      };
      const rolName = serviceNameForRole(user?.rol);
      // Buscar el servicio correspondiente al rol:
      // 1) Coincidencia exacta por nombre (mayúsculas)
      let roleServiceId = rolName ? services.find((s) => (s.nombre ?? '').toUpperCase() === rolName)?.id ?? null : null;
      // 2) Fallback: coincidencias por palabras clave (más tolerante a variaciones)
      if (!roleServiceId) {
        const nameLc = (s: typeof services[number]) => (s.nombre ?? '').toLowerCase();
        const rolLc = (user?.rol ?? '').toLowerCase();
        roleServiceId = services.find((s) => {
          const n = nameLc(s);
          switch (rolLc) {
            case 'seguridad':
              return n.includes('seguridad');
            case 'soporte':
              return n.includes('soporte');
            case 'servicios_generales':
              return n.includes('servicios') || n.includes('generales') || n.includes('general');
            case 'salud':
              return n.includes('enfer') || n.includes('salud');
            default:
              return false;
          }
        })?.id ?? null;
      }
      // Construcción de constraints:
      // - Admin: todo
      // - Usuario de servicio: por servicioId; si aún no tenemos serviceId, traer todo y filtrar client-side
      // - Docente: solo sus solicitudes
      const constraints = isAdmin
        ? [orderBy('fecha', 'desc')]
        : isServiceRole
          ? (roleServiceId ? [where('servicioId', '==', roleServiceId)] : [orderBy('fecha', 'desc')])
          : [where('usuarioId', '==', user.id)];
      const unsub = subscribeCollection<any>({
        collectionPath: COLLECTIONS.solicitudes,
        constraints,
        onData: (rows) => {
          // Si es un usuario de servicio y no pudimos resolver serviceId, filtramos client-side más tarde.
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
    }, [sessionReady, user?.id, user?.rol, isAdmin, services])
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

  // Obtener nombres de agentes de servicio que tomaron las solicitudes
  useEffect(() => {
    // Obtener ids únicos de agentes presentes y aún no resueltos a nombre
    const uniqueAgentIds = Array.from(new Set(requests.map((r) => r.agenteId).filter(Boolean) as string[]));
    const missingAgents = uniqueAgentIds.filter((uid) => !agentNames[uid]);
    if (missingAgents.length === 0) return;
    (async () => {
      const fetched: Record<string, string> = {};
      for (const uid of missingAgents) {
        const doc = await fetchDoc<{ nombre: string }>(COLLECTIONS.usuarios, uid);
        if (doc?.nombre) fetched[uid] = doc.nombre;
      }
      if (Object.keys(fetched).length) {
        setAgentNames((prev) => ({ ...prev, ...fetched }));
      }
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

  // Resolver el serviceId asociado al rol actual (para filtrar client-side si aplica)
  const resolveRoleServiceId = (): string | null => {
    const serviceNameForRole = (rol?: string | null) => {
      switch ((rol ?? '').toLowerCase()) {
        case 'servicios_generales':
          return 'SERVICIOS GENERALES';
        case 'salud':
          return 'ENFERMERIA';
        case 'soporte':
          return 'SOPORTE CETECOM';
        case 'seguridad':
          return 'SEGURIDAD';
        default:
          return null;
      }
    };
    const rolName = serviceNameForRole(user?.rol);
    let sid = rolName ? services.find((s) => (s.nombre ?? '').toUpperCase() === rolName)?.id ?? null : null;
    if (!sid) {
      const rolLc = (user?.rol ?? '').toLowerCase();
      sid = services.find((s) => {
        const n = (s.nombre ?? '').toLowerCase();
        switch (rolLc) {
          case 'seguridad':
            return n.includes('seguridad');
          case 'soporte':
            return n.includes('soporte');
          case 'servicios_generales':
            return n.includes('servicios') || n.includes('generales') || n.includes('general');
          case 'salud':
            return n.includes('enfer') || n.includes('salud');
          default:
            return false;
        }
      })?.id ?? null;
    }
    return sid;
  };

  const currentRoleServiceId = resolveRoleServiceId();
  const visibleRequests = isServiceRole
    ? requests.filter((r) => {
        const sameService = currentRoleServiceId ? (r.servicioId === currentRoleServiceId) : true;
        const s = normalizeEstadoKey(r.estado);
        const visibleByState = (s === 'pendiente') || (s === 'tomado' && r.agenteId === user?.id);
        return sameService && visibleByState;
      })
    : requests;

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

  const updateEstado = async (
    id: string,
    estado: 'pendiente' | 'tomado' | 'realizado'
  ) => {
    if (!isAdmin) return; // Solo admin puede cambiar estado
    const store = useSAMStore.getState();
    const cur = store.solicitudes.find((s) => s.id === id);
    if (!cur) return;
    try {
      await setDocument(COLLECTIONS.solicitudes, id, { ...cur, estado });
    } catch {}
    useSAMStore.setState({ solicitudes: store.solicitudes.map((s) => (s.id === id ? { ...s, estado } : s)) });
  };

  const marcarRealizada = async (id: string) => {
    if (!isServiceRole) return;
    const store = useSAMStore.getState();
    const cur = store.solicitudes.find((s) => s.id === id);
    if (!cur) return;
    // Solo el agente asignado puede marcar como realizada
    if ((cur.agenteId ?? '') !== (user?.id ?? '')) return;
    try {
      const now = new Date().toISOString();
      const finalObs = (observacionesFinales[id] ?? '').trim();
      // Marcar como leídas notificaciones previas de esta solicitud para el docente
      try {
        const prev = await queryCollection<any>('notificaciones', [
          where('solicitudId', '==', id),
          where('userId', '==', cur.usuarioId),
        ]);
        for (const n of prev) {
          if (!n.leida) {
            await setDocument('notificaciones', n.id, { ...n, leida: true });
          }
        }
      } catch {}
      await setDocument(COLLECTIONS.solicitudes, id, { ...cur, estado: 'realizado', observacionFinal: finalObs || cur.observacion || '' });
      // Notificar al docente que su solicitud fue realizada
      await addDocument('notificaciones', {
        titulo: 'Solicitud realizada',
        cuerpo: finalObs || cur.observacion || 'Tu solicitud fue realizada.',
        fecha: now,
        solicitudId: id,
        userId: cur.usuarioId,
        leida: false,
      });
      try {
        const doc = await fetchDoc<any>(COLLECTIONS.usuarios, cur.usuarioId);
        const token = (doc as any)?.expoPushToken;
        if (token) {
          const message = [{ to: token, title: 'Solicitud realizada', body: finalObs || cur.observacion || 'Tu solicitud fue realizada.', data: { solicitudId: id } }];
          await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
        }
      } catch {}
    } catch {}
    useSAMStore.setState({ solicitudes: store.solicitudes.map((s) => (s.id === id ? { ...s, estado: 'realizado', observacionFinal: (observacionesFinales[id] ?? '').trim() || s.observacion || '' } : s)) });
    setObservacionesFinales((prev) => ({ ...prev, [id]: '' }));
  };

  const tomarConMensaje = async (id: string) => {
    // Permitir a cualquier rol de servicio tomar la solicitud con mensaje
    if (!isServiceRole) return;
    const store = useSAMStore.getState();
    const cur = store.solicitudes.find((s) => s.id === id);
    if (!cur) return;
    const obs = (observaciones[id] ?? '').trim();
    try {
      const now = new Date();
      const iso = now.toISOString();
      await setDocument(COLLECTIONS.solicitudes, id, { ...cur, estado: 'tomado', observacion: obs, agenteId: user!.id });
      // Crear notificación para el docente dueño de la solicitud
      await addDocument('notificaciones', {
        titulo: 'Solicitud tomada',
        cuerpo: obs || 'Tu solicitud fue tomada.',
        fecha: iso,
        solicitudId: id,
        userId: cur.usuarioId,
        leida: false,
      });
      try {
        const doc = await fetchDoc<any>(COLLECTIONS.usuarios, cur.usuarioId);
        const token = (doc as any)?.expoPushToken;
        if (token) {
          const message = [{ to: token, title: 'Solicitud tomada', body: obs || 'Tu solicitud fue tomada.', data: { solicitudId: id } }];
          await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
        }
      } catch {}
    } catch {}
    useSAMStore.setState({ solicitudes: store.solicitudes.map((s) => (s.id === id ? { ...s, estado: 'tomado', observacion: obs, agenteId: user!.id } : s)) });
    setObservaciones((prev) => ({ ...prev, [id]: '' }));
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
      {sessionReady && !loading && visibleRequests.length === 0 && isAuthenticated && (
        <Text>No hay solicitudes</Text>
      )}
      <ScrollView>
        {sessionReady && !loading && visibleRequests.map((req) => (
          <View key={req.id} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Text style={styles.line}>Servicio: {getServiceName(req.servicioId)}</Text>
            <Text style={[styles.line, { color: theme.muted }]}>Sala: {req.roomId ?? '-'}</Text>
            <RNView style={styles.estadoRow}>
              <Text style={styles.line}>Estado: </Text>
              <RNView style={[styles.estadoBadge, getEstadoStyle(req.estado)]}>
                <Text style={[styles.estadoText, estadoTextColor(req.estado)]}>{labelEstado(normalizeEstadoKey(req.estado))}</Text>
              </RNView>
            </RNView>
            {/* Línea “Última acción” eliminada por solicitud del usuario */}
            <Text style={[styles.line, { color: theme.muted }]}>Fecha: {formatDDMMYYYYHHMM(req.fecha)}</Text>
            {!!req.comentario && <Text style={styles.line}>Comentario: {req.comentario}</Text>}
            {!!req.observacion && <Text style={styles.line}>Mensaje del servicio: {req.observacion}</Text>}
            {(isAdmin || isServiceRole) && (
              <Text style={[styles.line, { color: theme.muted }]}>Enviado por: {userNames[req.usuarioId] ?? 'Desconocido'}</Text>
            )}
            {(req.agenteId) && (
              <Text style={[styles.line, { color: theme.muted }]}> 
                {(normalizeEstadoKey(req.estado) === 'realizado' ? 'Atendió' : 'Tomado por')}: {agentNames[req.agenteId] ?? 'Desconocido'}
              </Text>
            )}
            {isAdmin && (
              <RNView style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: theme.tint }]} onPress={() => updateEstado(req.id, 'tomado')}>
              <Text style={{ color: '#fff' }}>Tomado</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: theme.success }]} onPress={() => updateEstado(req.id, 'realizado')}>
              <Text style={{ color: '#fff' }}>Realizado</Text>
            </TouchableOpacity>
                </RNView>
            )}
            {isServiceRole && (req.estado === 'pendiente') && (
              <RNView style={{ marginTop: 8 }}>
                <Text style={{ marginBottom: 6 }}>Mensaje para el docente (opcional)</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 8 }}
                  placeholder="Escribe una observación"
                  value={observaciones[req.id] ?? ''}
                  onChangeText={(t) => setObservaciones((prev) => ({ ...prev, [req.id]: t }))}
                />
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#22c55e', marginTop: 8 }]} onPress={() => tomarConMensaje(req.id)}>
                  <Text style={{ color: '#fff' }}>Tomar solicitud</Text>
                </TouchableOpacity>
              </RNView>
            )}
            {isServiceRole && (normalizeEstadoKey(req.estado) === 'tomado') && (req.agenteId === user?.id) && (
              <RNView style={{ marginTop: 8 }}>
                <Text style={{ marginBottom: 6 }}>Mensaje final para el docente (opcional)</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 8 }}
                  placeholder="Escribe un mensaje final"
                  value={observacionesFinales[req.id] ?? ''}
                  onChangeText={(t) => setObservacionesFinales((prev) => ({ ...prev, [req.id]: t }))}
                />
                <RNView style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: theme.success }]} onPress={() => marcarRealizada(req.id)}>
                    <Text style={{ color: '#fff' }}>Marcar realizado</Text>
                  </TouchableOpacity>
                </RNView>
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
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: 'transparent',
    // el color de fondo/borde se aplica inline con theme
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  line: { marginVertical: 2 },
  btn: { padding: 10, borderRadius: 10, alignItems: 'center' },
  estadoRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  estadoBadge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  estadoText: { fontWeight: '600' },
});