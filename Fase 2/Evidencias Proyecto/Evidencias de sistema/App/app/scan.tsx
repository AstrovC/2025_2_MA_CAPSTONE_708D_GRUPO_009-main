import { useState, useCallback } from 'react';
import { Platform, StyleSheet, TextInput, TouchableOpacity, View as RNView, ScrollView, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSAMStore } from '@/store/samStore';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { addDocument, COLLECTIONS, queryCollection, fetchDoc } from '@/lib/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { orderBy, where } from 'firebase/firestore';
export default function Scan() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [roomId, setRoomId] = useState('');
  const [hasPermission, setHasPermission] = useState<null | boolean>(null);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);
  const [comentario, setComentario] = useState<string>('');
  const [showSelection, setShowSelection] = useState(false);
  const services = useSAMStore((s) => s.servicios);
  const user = useSAMStore((s) => s.usuario);
  const sessionReady = useSAMStore((s) => s.sessionReady);
  const isAuthenticated = useSAMStore((s) => s.isAuthenticated);
  const [, requestPermission] = useCameraPermissions();
  const setServicios = useSAMStore((s) => s.setServicios);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);

  // Validación: la sala debe existir en la colección 'salas'
  const isValidManualRoom = (input: string) => {
    const t = (input ?? '').trim();
    if (!t) return false;
    // Si aún no cargamos salas, permitir 1/2/3 como fallback
    if (availableRooms.length === 0) return /^([123])$/.test(t);
    return availableRooms.includes(t);
  };

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setServicesLoading(true);
        const rows = await queryCollection<{ nombre: string; descripcion?: string }>(
          COLLECTIONS.servicios,
          [orderBy('createdAt', 'desc')]
        );
        if (!alive) return;
        setServicios(rows.map((r) => ({ id: r.id, nombre: r.nombre, descripcion: r.descripcion })));
        // Cargar salas disponibles (IDs como '1', '2', '3')
        try {
          const roomDocs = await queryCollection<{ nombre?: string }>('salas', [orderBy('createdAt', 'desc')]);
          if (alive) setAvailableRooms(roomDocs.map((d) => d.id));
        } catch {}
        setServicesLoading(false);
      })().catch(() => {
        setServicesLoading(false);
      });
      return () => { alive = false; };
    }, [setServicios])
  );

  const startScan = async () => {
    const perm = await requestPermission();
    const granted = !!perm?.granted;
    setHasPermission(granted);
    if (granted) {
      setScanning(true);
      setScanned(false);
      setError(undefined);
      setSuccess(undefined);
    }
  };

  const onConfirm = async () => {
    if (!showSelection) {
      // Requiere escanear QR o ingresar manualmente "1/2/3" para continuar
      const canProceed = (scanned && !!roomId.trim()) || isValidManualRoom(roomId);
      if (!canProceed) {
        setError('Primero escanea el QR o ingresa 1, 2 o 3');
        return;
      }
      setError(undefined);
      setSuccess(undefined);
      setShowSelection(true);
      return;
    }
    if (!selectedServiceId) {
      setError('Selecciona un servicio');
      return;
    }
    if (!user) {
      setError('Inicia sesión para continuar');
      return;
    }
    setError(undefined);
    setSuccess(undefined);

    try {
      const now = new Date();
      const iso = now.toISOString();
      const solRef = await addDocument(COLLECTIONS.solicitudes, {
        servicioId: selectedServiceId,
        roomId: roomId.trim(),
        usuarioId: user.id,
        fecha: iso,
        estado: 'pendiente',
        comentario: comentario.trim() || undefined,
        source: 'app',
      });
      await addDocument('notificaciones', {
        titulo: 'Solicitud enviada',
        cuerpo: `Sala ${roomId.trim()} asociada. Enviada a administración.`,
        fecha: iso,
        solicitudId: solRef.id,
        userId: user.id,
        leida: false,
      });
      try {
        const servicio = services.find((s) => s.id === selectedServiceId);
        const nombre = (servicio?.nombre ?? '').toUpperCase();
        const rolForService = (() => {
          if (nombre.includes('SERVICIOS GENERALES')) return 'servicios_generales';
          if (nombre.includes('ENFERMERIA') || nombre.includes('ENFERMERÍA') || nombre.includes('SALUD')) return 'salud';
          if (nombre.includes('SOPORTE') || nombre.includes('CETECOM')) return 'soporte';
          if (nombre.includes('SEGURIDAD')) return 'seguridad';
          return '';
        })();
        if (rolForService) {
          const agentes = await queryCollection<any>(COLLECTIONS.usuarios, [where('rol', '==', rolForService)]);
          const tokens = agentes.map((a) => a.expoPushToken).filter(Boolean);
          if (tokens.length) {
            const messages = tokens.map((to: string) => ({ to, title: 'Nueva solicitud', body: `Sala ${roomId.trim()} • ${servicio?.nombre ?? ''}`, data: { solicitudId: solRef.id } }));
            await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(messages),
            });
          }
        }
      } catch {}
      if (Platform.OS !== 'web') {
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Solicitud enviada',
            body: `Sala ${roomId.trim()} asociada. Enviada a administración.`,
            data: { solicitudId: solRef.id },
          },
          trigger: null,
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Error al persistir solicitud/notificación', e);
    }

    // Mostrar pantalla de éxito y volver al inicio
    setShowSelection(false);
    setSelectedServiceId(undefined);
    setRoomId('');
    setComentario('');
    setScanning(false);
    router.push({
      pathname: '/modal',
      params: {
        title: 'Solicitud enviada',
        message: `Sala ${roomId.trim()} asociada. Enviada a administración.`,
      },
    });
  };

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    setScanned(true);
    setScanning(false);
    const text = data ?? '';
    if (!text.trim()) {
      setError('El QR no contiene datos válidos');
      return;
    }
    // Intentar extraer roomId y servicio desde el QR
    const parsed = (() => {
      try {
        const obj = JSON.parse(text);
        return { roomId: String(obj.roomId ?? obj.room ?? ''), servicioId: String(obj.servicioId ?? obj.serviceId ?? '') };
      } catch {}
      const parts = text.split(/[;,&\s]+/).filter(Boolean);
      const map: Record<string, string> = {};
      for (const p of parts) {
        const [k, v] = p.split(/[:=]/);
        if (k && v) map[k.toLowerCase()] = v;
      }
      const candidateRoom = map['roomid'] || map['room'] || parts.find((p) => /^([123])$/.test(p)) || '';
      const candidateService = map['servicioid'] || map['serviceid'] || map['servicio'] || map['service'] || '';
      return { roomId: candidateRoom, servicioId: candidateService };
    })();

    // Si el QR provee ambos (sala válida y servicio válido), enviar automáticamente
    const serviceMatch = services.find((s) => [s.id, (s.nombre ?? '').toLowerCase()].includes((parsed.servicioId ?? '').toLowerCase()));
    const roomCandidate = (parsed.roomId ?? '').trim();
    const validRoom = isValidManualRoom(roomCandidate);

    if (validRoom && serviceMatch && user) {
      // Auto-submit
      (async () => {
        try {
          const now = new Date();
          const iso = now.toISOString();
          const solRef = await addDocument(COLLECTIONS.solicitudes, {
            servicioId: serviceMatch.id,
            roomId: roomCandidate,
            usuarioId: user.id,
            fecha: iso,
            estado: 'pendiente',
            comentario: '',
            source: 'qr',
          });
          await addDocument('notificaciones', {
            titulo: 'Solicitud enviada',
            cuerpo: `Sala ${roomCandidate} asociada. Enviada a administración.`,
            fecha: iso,
            solicitudId: solRef.id,
            userId: user.id,
            leida: false,
          });
          try {
            const servicio = services.find((s) => s.id === serviceMatch.id);
            const nombre = (servicio?.nombre ?? '').toUpperCase();
            const rolForService = (() => {
              if (nombre.includes('SERVICIOS GENERALES')) return 'servicios_generales';
              if (nombre.includes('ENFERMERIA') || nombre.includes('ENFERMERÍA') || nombre.includes('SALUD')) return 'salud';
              if (nombre.includes('SOPORTE') || nombre.includes('CETECOM')) return 'soporte';
              if (nombre.includes('SEGURIDAD')) return 'seguridad';
              return '';
            })();
            if (rolForService) {
              const agentes = await queryCollection<any>(COLLECTIONS.usuarios, [where('rol', '==', rolForService)]);
              const tokens = agentes.map((a) => a.expoPushToken).filter(Boolean);
              if (tokens.length) {
                const messages = tokens.map((to: string) => ({ to, title: 'Nueva solicitud', body: `Sala ${roomCandidate} • ${servicio?.nombre ?? ''}`, data: { solicitudId: solRef.id } }));
                await fetch('https://exp.host/--/api/v2/push/send', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(messages),
                });
              }
            }
          } catch {}
          if (Platform.OS !== 'web') {
            Notifications.scheduleNotificationAsync({
              content: {
                title: 'Solicitud enviada',
                body: `Sala ${roomCandidate} asociada. Enviada a administración.`,
                data: { solicitudId: solRef.id },
              },
              trigger: null,
            }).catch(() => {});
          }
          router.push({ pathname: '/modal', params: { title: 'Solicitud enviada', message: `Sala ${roomCandidate} asociada. Enviada a administración.` } });
        } catch (e) {
          setError('No se pudo enviar automáticamente');
        }
      })();
      return;
    }

    // Si solo provee sala, preparar selección
    setRoomId(roomCandidate || text);
    setError(undefined);
    setSuccess(undefined);
    setShowSelection(true);
  };

  // Esperar a que la sesión esté lista para evitar falsos negativos
  if (!sessionReady) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Escanear QR</Text>
        <RNView style={{ paddingVertical: 12, alignItems: 'center' }}>
          <ActivityIndicator color={theme.tabIconDefault} />
          <Text style={{ marginTop: 8, opacity: 0.8 }}>Preparando sesión...</Text>
        </RNView>
      </View>
    );
  }

  // Solo docentes y administradores pueden escanear y enviar solicitudes
  if (!isAuthenticated || !user || !['docente','admin'].includes((user.rol ?? '').toLowerCase())) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Acceso restringido</Text>
        <Text style={{ marginTop: 8 }}>Solo docentes y administradores pueden escanear el QR y enviar solicitudes.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Escanear QR</Text>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
      {hasPermission === false && (
        <Text>Sin permiso de cámara. Actívalo en ajustes del navegador.</Text>
      )}

      <TextInput
        style={[
          styles.input,
          { borderColor: error ? theme.error : theme.border, backgroundColor: theme.card },
        ]}
        value={roomId}
        onChangeText={(t) => {
          setRoomId(t);
          if (error && (t.trim() || isValidManualRoom(t))) setError(undefined);
        }}
        placeholder="ID de sala o QR leído"
        placeholderTextColor={colorScheme === 'dark' ? '#94a3b8' : '#64748b'}
      />
      {error && <Text style={{ color: theme.error, marginTop: 6 }}>{error}</Text>}
      {success && <Text style={{ color: theme.success, marginTop: 6 }}>{success}</Text>}
      <Text style={{ opacity: 0.7, marginTop: 6 }}>Tip: puedes ingresar una sala válida ({availableRooms.join(', ') || '1, 2, 3'}) para habilitar sin escanear.</Text>

      {showSelection && (
        <RNView style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Selecciona servicio</Text>
          {servicesLoading ? (
            <RNView style={{ paddingVertical: 12, alignItems: 'center' }}>
              <ActivityIndicator color={theme.tabIconDefault} />
              <Text style={{ marginTop: 8, opacity: 0.8 }}>Cargando servicios...</Text>
            </RNView>
          ) : (
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
              {services.map((s) => (
                <TouchableOpacity key={s.id} onPress={() => setSelectedServiceId(s.id)}>
                  <RNView style={[
                    styles.serviceItem,
                    { borderColor: theme.border, backgroundColor: theme.card },
                    selectedServiceId === s.id && { borderColor: theme.tint }
                  ]}>
                    <Text style={styles.serviceTitle}>{s.nombre}</Text>
                    {!!s.descripcion && <Text style={styles.serviceDesc}>{s.descripcion}</Text>}
                  </RNView>
                </TouchableOpacity>
              ))}
              <Text style={{ fontWeight: 'bold', marginVertical: 8 }}>Comentario (opcional)</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card }]}
                placeholder="Describe el tema o detalle adicional"
                value={comentario}
                onChangeText={setComentario}
                multiline
              />
            </ScrollView>
          )}
        </RNView>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme.tint }]} onPress={startScan}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Escanear QR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.btn,
            {
              backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#111827',
              opacity: (showSelection ? selectedServiceId : ((scanned && roomId.trim()) || isValidManualRoom(roomId))) ? 1 : 0.6,
            },
          ]}
          onPress={onConfirm}
          disabled={showSelection ? !selectedServiceId : (!((scanned && roomId.trim()) || isValidManualRoom(roomId)))}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>{showSelection ? 'Confirmar' : 'Continuar'}</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>

      {scanning && hasPermission && (
        <RNView style={styles.overlay}>
          <RNView style={[styles.scannerBox, { borderColor: theme.border, backgroundColor: theme.card }] }>
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarCodeScanned}
              style={{ width: '100%', height: '100%' }}
            />
          </RNView>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colorScheme === 'dark' ? '#111827' : '#1f2937' }]} onPress={() => setScanning(false)}>
            <Text style={{ color: '#fff' }}>Cerrar cámara</Text>
          </TouchableOpacity>
        </RNView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  scannerBox: { width: '100%', maxWidth: 480, height: 320, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 12 },
  btn: { padding: 12, borderRadius: 10, marginTop: 12, alignItems: 'center', flex: 1 },
  closeBtn: { marginTop: 12, padding: 12, borderRadius: 10 },
  serviceItem: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  serviceTitle: { fontWeight: 'bold' },
  serviceDesc: { opacity: 0.8, marginTop: 4 },
});