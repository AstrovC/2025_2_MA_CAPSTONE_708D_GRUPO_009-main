import { StyleSheet, TouchableOpacity, View as RNView, ActivityIndicator, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSAMStore } from '@/store/samStore';
import { router } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { queryCollection, COLLECTIONS } from '@/lib/firestore';
import { where, orderBy } from 'firebase/firestore';

export default function Dashboard() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const user = useSAMStore((s) => s.usuario);
  const services = useSAMStore((s) => s.servicios);
  const setServicios = useSAMStore((s) => s.setServicios);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        const rows = await queryCollection<{ nombre: string; descripcion?: string }>(
          COLLECTIONS.servicios,
          [orderBy('createdAt', 'desc')]
        );
        if (alive) setServicios(rows.map((r) => ({ id: r.id, nombre: r.nombre, descripcion: r.descripcion })));
        setLoading(false);
      })().catch(() => {
        setServicios([]);
        setLoading(false);
      });
      return () => { alive = false; };
    }, [setServicios])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Hola {user?.nombre ?? 'Usuario'}</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {(['docente','admin'].includes((user?.rol ?? '').toLowerCase())) ? (
          <>
            <TouchableOpacity style={[styles.scanBtn, { backgroundColor: theme.tint }]} onPress={() => router.push('/scan')}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Escanear QR</Text>
            </TouchableOpacity>
            <Text style={{ opacity: 0.8, marginTop: 8 }}>Luego selecciona el servicio desde el listado.</Text>
          </>
        ) : (
          <Text style={{ opacity: 0.8, marginTop: 8 }}>El envío de solicitudes está habilitado solo para docentes y administradores.</Text>
        )}
        <Text style={styles.sub}>Servicios disponibles</Text>
        {loading && (
          <RNView style={{ paddingVertical: 12, alignItems: 'center' }}>
            <ActivityIndicator color={theme.tabIconDefault} />
            <Text style={{ marginTop: 8, opacity: 0.8 }}>Cargando servicios...</Text>
          </RNView>
        )}
        {!loading && (
          <View style={styles.list}>
            {services.map((s) => {
              const n = (s.nombre ?? '').toLowerCase();
              const color =
                n.includes('enfermeria') ? '#e74c3c' :
                n.includes('soporte') || n.includes('cetecom') ? '#3498db' :
                n.includes('seguridad') ? '#f39c12' :
                n.includes('servicios generales') ? '#27ae60' :
                '#9b59b6';
              return (
                <RNView key={s.id} style={[styles.item, { borderColor: color, borderWidth: 2, backgroundColor: theme.card }] }>
                  <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <RNView style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                    <Text style={styles.itemTitle}>{s.nombre}</Text>
                  </RNView>
                  {!!s.descripcion && <Text style={styles.itemDesc}>{s.descripcion}</Text>}
                </RNView>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  sub: { fontSize: 16, marginBottom: 12 },
  list: { gap: 8 },
  item: {
    padding: 12,
    borderWidth: 2,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  itemTitle: { fontWeight: 'bold' },
  itemDesc: { opacity: 0.8 },
  scanBtn: { padding: 12, alignItems: 'center', borderRadius: 8, marginTop: 16 },
});