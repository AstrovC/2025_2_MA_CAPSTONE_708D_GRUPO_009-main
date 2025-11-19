import { StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useSAMStore } from '@/store/samStore';
import { remove } from '@/lib/storage';
import { router } from 'expo-router';

export default function Profile() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const user = useSAMStore((s) => s.usuario);
  const reset = useSAMStore((s) => s.reset);

  const logout = async () => {
    try { await remove('usuario_actual'); } catch {}
    reset();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil de usuario</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {user ? (
          <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Text style={styles.row}>Nombre: {user.nombre}</Text>
            <Text style={styles.row}>Email: {user.email}</Text>
            <Text style={styles.row}>Rol: {user.rol}</Text>
          </View>
        ) : (
          <Text>No hay usuario activo</Text>
        )}

        <TouchableOpacity style={[styles.btn, { backgroundColor: theme.tint }]} onPress={logout}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  row: { marginBottom: 6 },
  btn: { marginTop: 16, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
});