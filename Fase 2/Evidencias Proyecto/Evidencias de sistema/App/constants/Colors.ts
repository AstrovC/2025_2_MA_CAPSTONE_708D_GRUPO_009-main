// Paleta profesional con neutrales y acentos consistentes
const palette = {
  // neutrales
  lightText: '#0F172A', // slate-900
  lightBg: '#F8FAFC', // slate-50
  lightCard: '#FFFFFF',
  lightBorder: '#E2E8F0', // slate-200
  lightMuted: '#64748B', // slate-500

  darkText: '#E5E7EB', // slate-200
  darkBg: '#0B1220',
  darkCard: '#0F172A', // slate-900
  darkBorder: '#1F2937', // gray-800
  darkMuted: '#9CA3AF', // gray-400

  // acentos
  primary: '#2563EB', // blue-600
  primaryDark: '#1D4ED8', // blue-700
  info: '#0EA5E9', // sky-500
  success: '#16A34A', // green-600
  warning: '#D97706', // amber-600
  error: '#DC2626', // red-600

  tabDefault: '#94A3B8', // slate-400
};

export default {
  light: {
    text: palette.lightText,
    background: palette.lightBg,
    card: palette.lightCard,
    border: palette.lightBorder,
    muted: palette.lightMuted,
    tint: palette.primary,
    info: palette.info,
    success: palette.success,
    warning: palette.warning,
    error: palette.error,
    tabIconDefault: palette.tabDefault,
    tabIconSelected: palette.primary,
  },
  dark: {
    text: palette.darkText,
    background: palette.darkBg,
    card: palette.darkCard,
    border: palette.darkBorder,
    muted: palette.darkMuted,
    tint: palette.primaryDark,
    info: palette.info,
    success: palette.success,
    warning: palette.warning,
    error: palette.error,
    tabIconDefault: palette.tabDefault,
    tabIconSelected: palette.primaryDark,
  },
};
