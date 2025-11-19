import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSAMStore } from '@/store/samStore';
import { load } from '@/lib/storage';
import { router, usePathname } from 'expo-router';
import { subscribeCollection, COLLECTIONS, type WithId, queryCollection, setDocument, fetchDoc } from '@/lib/firestore';
import { where } from 'firebase/firestore';

export {
  // Captura cualquier error lanzado por el componente de Layout.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Usar Tabs como ruta inicial para evitar saltos a login en navegación.
  initialRouteName: '(tabs)',
};

// Evita que el splash se oculte automáticamente antes de cargar los recursos.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router usa límites de error (Error Boundaries) para capturar errores en el árbol de navegación.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const setServices = useSAMStore((s) => s.setServicios);
  const setUser = useSAMStore((s) => s.setUsuario);
  const setSessionReady = useSAMStore((s) => s.setSessionReady);
  const services = useSAMStore((s) => s.servicios);
  const pathname = usePathname();

  // Mostrar notificaciones en foreground (iOS: banner y lista)
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // Reemplaza el uso de shouldShowAlert (deprecado)
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });


  useEffect(() => {
     // Restaurar sesión si existe
     (async () => {
      const user = await load<any>('usuario_actual');
      const isAtLogin = pathname === '/login';
      if (user) {
        setUser(user);
        if (isAtLogin) {
          const rolLc = (user?.rol ?? '').toLowerCase();
          const goto = ['servicios_generales','salud','soporte','seguridad'].includes(rolLc) ? '/(tabs)/notifications' : '/(tabs)/dashboard';
          router.replace(goto);
        }
      }
      setSessionReady(true);
    })();

     // Carga inicial inmediata desde Firestore (una vez)
     (async () => {
       try {
         const initial = await queryCollection<{ nombre: string; descripcion?: string }>(
           COLLECTIONS.servicios,
           [where('active', '==', true)]
         );
         // Ordenar en cliente para evitar índice compuesto en Firestore
         const mapped = initial
           .map((r) => ({ id: r.id, nombre: r.nombre, descripcion: r.descripcion }))
           .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));
         setServices(mapped);
       } catch {
         setServices([]);
       }
     })();

  }, []);

  // Suscribir servicios desde Firestore y sincronizar el store
  useEffect(() => {
    const unsubscribe = subscribeCollection<{ nombre: string; descripcion?: string }>({
      collectionPath: COLLECTIONS.servicios,
      constraints: [where('active', '==', true)],
      onData: (rows) => {
        // Ordenar en cliente para evitar índice compuesto en Firestore
        const live = rows
          .map((r) => ({ id: r.id, nombre: r.nombre, descripcion: r.descripcion }))
          .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));
        setServices(live);
      },
      onError: () => {
        setServices([]);
      },
    });
    return () => unsubscribe();
  }, [setServices]);

  // Configurar permisos y canal de notificaciones
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        // En web los tokens/push no están completamente soportados; evitamos pedir permisos
        return;
      }
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    })();
  }, []);

  const currentUser = useSAMStore((s) => s.usuario);
  useEffect(() => {
    (async () => {
      if (!currentUser?.id) return;
      if (Platform.OS === 'web') return;
      try {
        const projectId = (require('../app.json') as any)?.expo?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData?.data;
        if (token) {
          await setDocument(COLLECTIONS.usuarios, currentUser.id, { ...currentUser, expoPushToken: token } as any);
        }
      } catch {}
    })();
  }, [currentUser?.id]);

  useEffect(() => {
    (async () => {
      if (!currentUser?.id) return;
      if (Platform.OS === 'web') return;
      try {
        const projectId = (require('../app.json') as any)?.expo?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData?.data;
        if (!token) return;
        const unread = await queryCollection<any>('notificaciones', [
          where('userId', '==', currentUser.id),
          where('leida', '==', false),
        ]);
        for (const n of unread) {
          if (n.pushed) continue;
          const solId = n.solicitudId as string | undefined;
          let isPending = true;
          if (solId) {
            const sol = await fetchDoc<any>(COLLECTIONS.solicitudes, solId);
            isPending = ((sol?.estado ?? 'pendiente') === 'pendiente');
          }
          if (!isPending) continue;
          try {
            const message = [{ to: token, title: n.titulo ?? 'Notificación', body: n.cuerpo ?? '', data: { solicitudId: solId } }];
            await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
            await setDocument('notificaciones', n.id, { pushed: true } as any);
          } catch {}
        }
      } catch {}
    })();
  }, [currentUser?.id]);

  useEffect(() => {
    (async () => {
      const rol = (currentUser?.rol ?? '').toLowerCase();
      const isServiceRole = ['servicios_generales','salud','soporte','seguridad'].includes(rol);
      if (!isServiceRole) return;
      if (Platform.OS === 'web') return;
      try {
        const projectId = (require('../app.json') as any)?.expo?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData?.data;
        if (!token) return;
        const serviceNameForRole = (r?: string | null) => {
          switch ((r ?? '').toLowerCase()) {
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
        const rolName = serviceNameForRole(currentUser?.rol);
        let sid = rolName ? services.find((s) => (s.nombre ?? '').toUpperCase() === rolName)?.id ?? null : null;
        if (!sid) {
          sid = services.find((s) => {
            const n = (s.nombre ?? '').toLowerCase();
            switch (rol) {
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
        if (!sid) return;
        const rows = await queryCollection<any>(COLLECTIONS.solicitudes, [where('servicioId', '==', sid)]);
        const pending = rows.filter((r) => (r.estado ?? 'pendiente') === 'pendiente').length;
        if (pending > 0) {
          const message = [{ to: token, title: 'Solicitudes pendientes', body: `Tienes ${pending} solicitudes pendientes`, data: {} }];
          await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
        }
      } catch {}
    })();
  }, [currentUser?.id, services]);

  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="scan" options={{ title: 'Escanear QR' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

