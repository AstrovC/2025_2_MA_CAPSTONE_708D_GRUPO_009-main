import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {  Tabs } from "expo-router";

import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { useSAMStore } from "@/store/samStore";

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const sessionReady = useSAMStore((s) => s.sessionReady);
  const isAuthenticated = useSAMStore((s) => s.isAuthenticated);
  const user = useSAMStore((s) => s.usuario);
  const isAdmin = useSAMStore((s) => s.isAdmin);
  const isDocente = ((user?.rol ?? '').toLowerCase() === 'docente');
  const isServiceRole = ['servicios_generales','salud','soporte','seguridad'].includes((user?.rol ?? '').toLowerCase());
  const hideNotifications = isDocente || isAdmin;

  // Esperar a que la sesión esté lista para evitar flicker
  if (!sessionReady) return null;
  // Si no hay usuario autenticado, no renderizar las tabs
  if (!isAuthenticated) return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Panel",
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          href: isServiceRole ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: isDocente ? "Notificaciones" : "Historial",
          tabBarIcon: ({ color }) => <TabBarIcon name="list" color={color} />,
          href: isDocente ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
          href: isAdmin ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notificaciones",
          tabBarIcon: ({ color }) => <TabBarIcon name="bell" color={color} />,
          href: hideNotifications ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
