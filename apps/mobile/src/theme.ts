export const colors = {
  primary: '#4f46e5',
  primaryDark: '#4338ca',
  primaryLight: '#eef2ff',

  white: '#ffffff',
  background: '#f3f4f6',

  gray50:  '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  green400: '#34d399',
  green500: '#10b981',
  green600: '#059669',
  greenBg:  '#d1fae5',
  greenText: '#065f46',

  yellow400: '#fbbf24',
  yellowBg:  '#fef3c7',
  yellowText: '#92400e',

  red400: '#f87171',
  red500: '#ef4444',
  red600: '#dc2626',
  redBg:  '#fee2e2',
  redText: '#991b1b',

  blue400: '#60a5fa',
  blueBg:  '#dbeafe',
  blueText: '#1e40af',

  violet: '#7c3aed',
  violetBg: '#ede9fe',
  violetText: '#4c1d95',
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardMd: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  fab: {
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;
