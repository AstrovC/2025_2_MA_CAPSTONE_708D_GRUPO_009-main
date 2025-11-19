import { create } from 'zustand';
import type { ReactNode } from 'react';

export type Rol = 'docente' | 'salud' | 'servicios_generales' | 'soporte' | 'seguridad' | 'admin';

export type Servicio = {
  id: string;
  nombre: string;
  descripcion?: string;
};

export type SolicitudEstado = 'pendiente' | 'tomado' | 'realizado';

export type Solicitud = {
  id: string;
  servicioId: string;
  roomId?: string;
  usuarioId: string;
  fecha: string; // ISO
  estado: SolicitudEstado;
  observacion?: string;
  observacionFinal?: string;
  comentario?: string;
  agenteId?: string;
};

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  password?: string;
  expoPushToken?: string;
};

export type Notificacion = {
  id: string;
  titulo: string;
  cuerpo: string;
  fecha: string;
  solicitudId?: string;
  leida?: boolean;
  pushed?: boolean;
};

type SAMState = {
  usuario?: Usuario | null;
  servicios: Servicio[];
  solicitudes: Solicitud[];
  notificaciones: Notificacion[];
  sessionReady: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  setUsuario: (u: Usuario | null) => void;
  setServicios: (s: Servicio[]) => void;
  addSolicitud: (s: Solicitud) => void;
  updateSolicitudEstado: (id: string, estado: SolicitudEstado) => void;
  addNotificacion: (n: Notificacion) => void;
  setSessionReady: (ready: boolean) => void;
  reset: () => void;
};

export const useSAMStore = create<SAMState>((set) => ({
  usuario: null,
  servicios: [],
  solicitudes: [],
  notificaciones: [],
  sessionReady: false,
  isAuthenticated: false,
  isAdmin: false,
  setUsuario: (usuario) => set({
    usuario,
    isAuthenticated: !!usuario,
    isAdmin: ((usuario?.rol ?? '').toLowerCase() === 'admin'),
    sessionReady: true,
  }),
  setServicios: (servicios) => set({ servicios }),
  addSolicitud: (solicitud) => set((state) => ({ solicitudes: [solicitud, ...state.solicitudes] })),
  updateSolicitudEstado: (id, estado) => set((state) => ({
    solicitudes: state.solicitudes.map((s) => (s.id === id ? { ...s, estado } : s)),
  })),
  addNotificacion: (n) => set((state) => ({ notificaciones: [n, ...state.notificaciones] })),
  setSessionReady: (ready) => set({ sessionReady: ready }),
  reset: () => set({ usuario: null, servicios: [], solicitudes: [], notificaciones: [], isAuthenticated: false, isAdmin: false, sessionReady: true }),
}));
