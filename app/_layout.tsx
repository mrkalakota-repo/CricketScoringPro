import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { useColorScheme, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { lightTheme, darkTheme } from '../src/theme';
import { useTeamStore } from '../src/store/team-store';
import { useMatchStore } from '../src/store/match-store';
import { usePrefsStore } from '../src/store/prefs-store';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const loadTeams = useTeamStore(s => s.loadTeams);
  const loadMatches = useMatchStore(s => s.loadMatches);
  const loadPrefs = usePrefsStore(s => s.loadPrefs);

  useEffect(() => {
    loadTeams();
    loadMatches();
    loadPrefs();
  }, []);

  const screenOptions = {
    headerStyle: { backgroundColor: theme.colors.primary },
    headerTintColor: '#FFFFFF' as const,
    headerTitleStyle: { fontWeight: 'bold' as const },
  };

  const nav = (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="team/create" options={{ title: 'Create Team', presentation: 'modal' }} />
      <Stack.Screen name="team/[id]/index" options={{ title: 'Team' }} />
      <Stack.Screen name="team/[id]/edit" options={{ title: 'Edit Team', presentation: 'modal' }} />
      <Stack.Screen name="team/[id]/roster" options={{ title: 'Roster' }} />
      <Stack.Screen name="match/create" options={{ title: 'New Match', presentation: 'modal' }} />
      <Stack.Screen name="match/[id]/index" options={{ title: 'Match' }} />
      <Stack.Screen name="match/[id]/toss" options={{ title: 'Toss', presentation: 'modal' }} />
      <Stack.Screen name="match/[id]/scoring" options={{ title: 'Scoring', headerShown: false }} />
      <Stack.Screen name="match/[id]/scorecard" options={{ title: 'Scorecard' }} />
      <Stack.Screen name="profile" options={{ title: 'Find My Profile', presentation: 'modal' }} />
    </Stack>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <ErrorBoundary>
          {Platform.OS === 'web' ? (
            <View style={{
              flex: 1,
              alignItems: 'center',
              backgroundColor: '#C8E8CA',
            }}>
              <View style={{
                flex: 1,
                width: '100%',
                maxWidth: 480,
                backgroundColor: theme.colors.background,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 12,
              }}>
                {nav}
              </View>
            </View>
          ) : nav}
          </ErrorBoundary>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
