import { useEffect } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useLocalSearchParams, router } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function ModalScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { title, message } = useLocalSearchParams<{ title?: string; message?: string }>();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/(tabs)/dashboard');
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }] }>
      <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }] }>
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <FontAwesome name="check-circle" size={48} color={theme.success} />
        </View>
        <Text style={styles.title}>{title ?? 'Solicitud enviada'}</Text>
        <Text style={[styles.desc, { color: theme.muted }]}>
          {message ?? 'Tu solicitud fue enviada correctamente.'}
        </Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme.tint }]} onPress={() => router.replace('/(tabs)/dashboard')}>
          <Text style={{ color: '#fff' }}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  desc: { textAlign: 'center', marginBottom: 12 },
  btn: { padding: 12, borderRadius: 10, alignItems: 'center' },
});
