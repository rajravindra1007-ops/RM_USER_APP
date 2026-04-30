import { useColorScheme } from 'react-native'

export type ColorScheme = 'light' | 'dark'

const light = {
  background: '#FFFFFF',
  card: '#F7F7F7',
  text: '#111827',
  primary: '#EF4444',
  secondary: '#6366F1',
  border: '#E5E7EB',
  muted: '#6B7280',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
}

const dark = {
  background: '#0B1220',
  card: '#0F1724',
  text: '#E6EEF8',
  primary: '#EF4444',
  secondary: '#7C3AED',
  border: '#1F2937',
  muted: '#9CA3AF',
  success: '#34D399',
  danger: '#F87171',
  warning: '#FBBF24',
}

export const Colors = { light, dark }

export function getColors(scheme?: ColorScheme) {
  if (!scheme) return light
  return scheme === 'dark' ? dark : light
}

export function useColors() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  return getColors(scheme)
}

export default useColors
