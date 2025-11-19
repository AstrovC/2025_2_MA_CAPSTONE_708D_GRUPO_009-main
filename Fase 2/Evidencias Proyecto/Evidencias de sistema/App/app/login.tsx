import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Modal, View as RNView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSAMStore, Rol, Usuario } from '@/store/samStore';
import { save, load } from '@/lib/storage';
import { router } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { queryCollection, addDocument, COLLECTIONS } from '@/lib/firestore';
import { isFirebaseEnabled } from '@/lib/firebase';
import { where } from 'firebase/firestore';

export default function LoginScreen() {
  const setUser = useSAMStore((s) => s.setUsuario);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Rol | null>(null);
  const [roleSelectorOpen, setRoleSelectorOpen] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const handleSubmit = async () => {
    setError(null);
    let user: Usuario | undefined;
    if (!isFirebaseEnabled) {
      setError('Base de datos no disponible. Revisa configuración de Firebase.');
      return;
    }
    if (mode === 'login') {
      // Solo buscar por email (normalizado)
      const normEmail = email.trim().toLowerCase();
      const byEmail = await queryCollection<Usuario>(COLLECTIONS.usuarios, [where('email', '==', normEmail)]);
      user = byEmail[0] || undefined;
      if (!user || user.password !== password) {
        setError('Credenciales inválidas');
        return;
      }
    } else {
      // Validaciones de registro
      const emailVal = email.trim();
      const emailNorm = emailVal.toLowerCase();
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
      const nameVal = fullName.trim();
      if (!nameVal) {
        setError('Ingresa tu nombre y apellido');
        return;
      }
      
      if (!isValidEmail) {
        setError('El email debe ser válido');
        return;
      }
      
      // Validación de rol permitido y bloqueo de registro como admin
      const rolesPermitidos: Rol[] = ['docente', 'salud', 'servicios_generales', 'soporte', 'seguridad'];
      if (!role) {
        setError('Selecciona un rol válido');
        return;
      }
      const rolSel = role as Rol;
      if (rolSel === 'admin') {
        setError('No es posible registrar usuarios con rol administrador');
        return;
      }
      if (!rolesPermitidos.includes(rolSel)) {
        setError('Selecciona un rol válido');
        return;
      }
      
      // Unicidad de email
      const existsByEmail = await queryCollection<Usuario>(COLLECTIONS.usuarios, [where('email', '==', emailNorm)]);
      if (existsByEmail.length > 0) {
        setError('El email ya está registrado');
        return;
      }

      // Usar nombre y apellido ingresado
      const newUser: Omit<Usuario, 'id'> = { nombre: nameVal, email: emailNorm, rol: rolSel, password };
      try {
        const ref = await addDocument(COLLECTIONS.usuarios, {
          ...newUser,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any);
        user = { id: ref.id, ...newUser } as Usuario;
      } catch (e) {
        setError('No se pudo registrar en la base de datos');
        return;
      }
    }
    const rolLc = (user!.rol ?? '').toLowerCase();
    const goto = ['servicios_generales','salud','soporte','seguridad'].includes(rolLc) ? '/(tabs)/notifications' : '/(tabs)/dashboard';
    if (mode === 'register') {
      setRegisterSuccess(true);
      setTimeout(async () => {
        await save('usuario_actual', user!);
        setUser(user!);
        router.replace(goto);
      }, 1300);
    } else {
      await save('usuario_actual', user!);
      setUser(user!);
      router.replace(goto);
    }
  };

  return (
    <View style={[styles.container]}> 
      {registerSuccess && (
        <RNView style={[styles.successOverlay]}> 
          <View style={[styles.successCard, { borderColor: palette.border, backgroundColor: palette.card }] }>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <FontAwesome name="check-circle" size={48} color={palette.success} />
            </View>
            <Text style={styles.successTitle}>Registro exitoso</Text>
            <Text style={[styles.successSubtitle, { color: palette.muted }]}>Ingresando para entrar a la aplicación…</Text>
            <TouchableOpacity style={[styles.successBtn, { backgroundColor: palette.tint }]} onPress={() => router.replace('/(tabs)/dashboard')}>
              <Text style={{ color: '#fff' }}>Ir al inicio</Text>
            </TouchableOpacity>
          </View>
        </RNView>
      )}
      {!registerSuccess && (
        <>
      <Text style={[styles.title, { color: palette.text }]}>Sistema Asistencia Móvil (SAM)</Text>
      <Text style={[styles.subtitle, { color: palette.text }]}>{mode === 'login' ? 'Inicia Sesión' : 'Regístrate'}</Text>

      {mode === 'register' && (
        <TextInput
          style={[styles.input, { backgroundColor: scheme === 'dark' ? '#0f172a' : '#fff', borderColor: '#334155', color: palette.text }]}
          placeholder="Nombre y apellido"
          autoCapitalize="words"
          autoCorrect={false}
          value={fullName}
          onChangeText={setFullName}
        />
      )}

      <TextInput
        style={[styles.input, { backgroundColor: scheme === 'dark' ? '#0f172a' : '#fff', borderColor: '#334155', color: palette.text }]}
        placeholder="Email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        textContentType="emailAddress"
      />

      <TextInput
        style={[styles.input, { backgroundColor: scheme === 'dark' ? '#0f172a' : '#fff', borderColor: '#334155', color: palette.text }]}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {mode === 'register' && (
        <View style={{ width: '100%', maxWidth: 360, marginBottom: 12 }}>
          <Text style={{ marginBottom: 6, color: palette.text }}>Tipo de usuario</Text>
          <TouchableOpacity
            style={[
              styles.input,
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: scheme === 'dark' ? '#0f172a' : '#fff',
                borderColor: '#334155',
              },
            ]}
            onPress={() => setRoleSelectorOpen(true)}
          >
            <Text style={{ color: palette.text }}>{labelForRole(role)}</Text>
            <Text style={{ color: palette.text }}>▼</Text>
          </TouchableOpacity>
          <Modal
            visible={roleSelectorOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setRoleSelectorOpen(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalSheet, { backgroundColor: scheme === 'dark' ? '#0f172a' : '#fff' }]}> 
                <Text style={[styles.modalTitle, { color: palette.text }]}>Selecciona tu tipo</Text>
                {ROLE_OPTIONS.map((opt, idx) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.dropdownItem,
                      idx < ROLE_OPTIONS.length - 1 ? { borderBottomColor: '#334155', borderBottomWidth: 1 } : null,
                    ]}
                    onPress={() => {
                      setRole(opt.value);
                      setRoleSelectorOpen(false);
                    }}
                  >
                    <Text style={{ color: palette.text }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.cancelBtn]} onPress={() => setRoleSelectorOpen(false)}>
                  <Text style={{ color: '#ef4444', fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      )}

      <TouchableOpacity style={[styles.primary, { backgroundColor: palette.tint }]} onPress={handleSubmit}>
        <Text style={styles.primaryText}>{mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}</Text>
      </TouchableOpacity>

      {error && <Text style={{ color: 'red', marginTop: 8 }}>{error}</Text>}

      <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
        <Text style={[styles.link, { color: palette.tint }]}>{mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}</Text>
      </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, marginBottom: 16 },
  input: { width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  roleBtn: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8 },
  roleBtnActive: { backgroundColor: '#ddd' },
  dropdown: { marginTop: 4, borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 12 },
  modalTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  successOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 16 },
  successCard: {
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
  successTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  successSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  successBtn: { padding: 12, borderRadius: 10, alignItems: 'center' },
  primary: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginTop: 8 },
  primaryText: { color: '#fff', fontWeight: 'bold' },
  link: { marginTop: 12, textDecorationLine: 'underline' },
});
  // Opciones visibles para el selector de rol (etiquetas capitalizadas)
  const ROLE_OPTIONS: { label: string; value: Rol }[] = [
    { label: 'Docente', value: 'docente' },
    { label: 'Enfermería', value: 'salud' },
    { label: 'Servicios generales', value: 'servicios_generales' },
    { label: 'Soporte', value: 'soporte' },
    { label: 'Seguridad', value: 'seguridad' },
  ];

  const labelForRole = (r: Rol | null) => {
    if (!r) return 'Selecciona un rol';
    const found = ROLE_OPTIONS.find((o) => o.value === r);
    return found ? found.label : 'Selecciona un rol';
  };