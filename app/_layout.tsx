import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { useColorScheme, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { lightTheme, darkTheme } from '../src/theme';
import { useTeamStore } from '../src/store/team-store';
import { useMatchStore } from '../src/store/match-store';

const SCREENS = (
  <>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="team/create" options={{ title: 'Create Team', presentation: 'modal' }} />
    <Stack.Screen name="team/[id]/index" options={{ title: 'Team Details' }} />
    <Stack.Screen name="team/[id]/edit" options={{ title: 'Edit Team', presentation: 'modal' }} />
    <Stack.Screen name="team/[id]/roster" options={{ title: 'Manage Roster' }} />
    <Stack.Screen name="match/create" options={{ title: 'New Match', presentation: 'modal' }} />
    <Stack.Screen name="match/[id]/index" options={{ title: 'Match Details' }} />
    <Stack.Screen name="match/[id]/toss" options={{ title: 'Toss', presentation: 'modal' }} />
    <Stack.Screen name="match/[id]/scoring" options={{ title: 'Live Scoring', headerShown: false }} />
    <Stack.Screen name="match/[id]/scorecard" options={{ title: 'Scorecard' }} />
  </>
);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const loadTeams = useTeamStore(s => s.loadTeams);
  const loadMatches = useMatchStore(s => s.loadMatches);

  useEffect(() => {
    loadTeams();
    loadMatches();
  }, []);

  const stackOptions = {
    screenOptions: {
      headerStyle: { backgroundColor: theme.colors.primary },
      headerTintColor: '#FFFFFF' as const,
      headerTitleStyle: { fontWeight: 'bold' as const },
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? '#F5F5F5' : undefined }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          {Platform.OS === 'web' ? (
            <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#F5F5F5' }}>
              <View style={{
                flex: 1,
                width: '100%',
                maxWidth: 480,
                backgroundColor: theme.colors.background,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
              }}>
                <Stack {...stackOptions}>{SCREENS}</Stack>
              </View>
            </View>
          ) : (
            <Stack {...stackOptions}>{SCREENS}</Stack>
          )}
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
