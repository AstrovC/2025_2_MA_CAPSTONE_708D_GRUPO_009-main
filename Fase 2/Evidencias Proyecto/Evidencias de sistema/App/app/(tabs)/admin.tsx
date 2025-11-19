import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSAMStore } from '@/store/samStore';
import { addDocument, COLLECTIONS } from '@/lib/firestore';
import { router } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function Admin() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const usuario = useSAMStore((s) => s.usuario);
  const services = useSAMStore((s) => s.servicios);
  const setServices = useSAMStore((s) => s.setServicios);
  const [name, setName] = useState('Nuevo servicio');
  const [description, setDescription] = useState('Descripción');

  if (!usuario || (usuario.rol ?? '').toLowerCase() !== 'admin') {
    router.replace('/(tabs)/dashboard');
    return null;
  }

  const addService = async () => {
    const nameVal = name.trim();
    const descriptionVal = description.trim();
    if (!nameVal) {
      console.warn('Nombre requerido');
      return;
    }
    try {
      const ref = await addDocument(COLLECTIONS.servicios, {
        nombre: nameVal,
        descripcion: descriptionVal,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log('Servicio creado en Firestore:', ref.id);
      // Actualiza UI inmediatamente
      const newItem = { id: ref.id, nombre: nameVal, descripcion: descriptionVal };
      setServices([...services, newItem]);
      setName('');
      setDescription('');
    } catch (e) {
      console.error('Error al crear servicio en Firestore:', e);
      // Fallback local: agrega al store para no bloquear la UI
      const newItem = { id: `serv-${Date.now()}`, nombre: nameVal, descripcion: descriptionVal };
      setServices([...services, newItem]);
      setName('');
      setDescription('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin: Crear servicio</Text>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card }]} value={name} onChangeText={setName} placeholder="Nombre" />
        <TextInput style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card }]} value={description} onChangeText={setDescription} placeholder="Descripción" />
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme.tint }]} onPress={addService}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Crear</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10 },
  btn: { padding: 12, borderRadius: 10, alignItems: 'center' },
});