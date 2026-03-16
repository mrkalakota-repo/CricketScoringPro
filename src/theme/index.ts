import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { colors } from './colors';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: '#A8DBAB',
    onPrimaryContainer: '#0A3D14',
    secondary: colors.secondary,
    onSecondary: '#FFFFFF',
    secondaryContainer: '#FFCCBC',
    onSecondaryContainer: colors.secondaryDark,
    background: colors.background,
    onBackground: colors.text,
    surface: colors.surface,
    onSurface: colors.text,
    surfaceVariant: colors.surfaceVariant,
    onSurfaceVariant: colors.textSecondary,
    outline: '#7A9B7C',
    outlineVariant: '#C0DCC2',
    error: colors.error,
    onError: '#FFFFFF',
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#5EBD6A',
    onPrimary: '#0A3D14',
    primaryContainer: '#1B5E20',
    onPrimaryContainer: '#A8DBAB',
    secondary: '#FF8A50',
    onSecondary: '#7B2800',
    secondaryContainer: '#7B2800',
    onSecondaryContainer: '#FFCCBC',
    background: colors.dark.background,
    onBackground: colors.dark.text,
    surface: colors.dark.surface,
    onSurface: colors.dark.text,
    surfaceVariant: colors.dark.surfaceVariant,
    onSurfaceVariant: colors.dark.textSecondary,
    outline: '#4A7A4C',
    outlineVariant: '#2E4D30',
    error: '#EF5350',
    onError: '#690005',
  },
};

export { colors };
