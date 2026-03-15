import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { colors } from './colors';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    primaryContainer: colors.primaryLight,
    secondary: colors.secondary,
    secondaryContainer: colors.secondaryLight,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceVariant,
    error: colors.error,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primaryLight,
    primaryContainer: colors.primary,
    secondary: colors.secondary,
    secondaryContainer: colors.secondaryDark,
    background: colors.dark.background,
    surface: colors.dark.surface,
    surfaceVariant: colors.dark.surfaceVariant,
    error: colors.error,
  },
};

export { colors };
