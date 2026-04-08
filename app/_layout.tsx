import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { useColorScheme, Platform, View, ActivityIndicator, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { lightTheme, darkTheme } from '../src/theme';
import { useTeamStore } from '../src/store/team-store';
import { useMatchStore } from '../src/store/match-store';
import { usePrefsStore } from '../src/store/prefs-store';
import { useUserAuth } from '../src/hooks/useUserAuth';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { stopDrainTimer } from '../src/db/repositories/cloud-match-repo';
import { configurePurchases, getCurrentPlan, loginPurchasesUser, logoutPurchasesUser } from '../src/services/purchases';
import LoginScreen from './login';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const loadTeams = useTeamStore(s => s.loadTeams);
  const loadMatches = useMatchStore(s => s.loadMatches);
  const loadPrefs = usePrefsStore(s => s.loadPrefs);
  const { loadProfile, isLoading, isAuthenticated, profile, updateProfile } = useUserAuth();
  // Track previous auth state to detect login/logout transitions
  const prevAuthRef = useRef<boolean | null>(null);

  // Re-load data whenever auth resolves or the user logs in/out, so the
  // home screen stats (teams, matches, live) are always current without
  // requiring a manual tab switch.
  useEffect(() => {
    if (!isLoading) {
      loadTeams();
      loadMatches();
    }
  }, [isLoading, isAuthenticated]);

  // Configure RevenueCat once on mount (no-op if API key not set)
  useEffect(() => {
    configurePurchases();
    loadProfile();
    loadPrefs();

    // Stop the cloud-match drain timer when the app goes to background,
    // and restart it (lazily, on next publish) when foregrounded.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        stopDrainTimer();
      }
    });
    return () => {
      sub.remove();
      stopDrainTimer();
    };
  }, []);

  // RC user login/logout + background plan sync whenever auth state changes
  useEffect(() => {
    if (isLoading) return;
    const wasAuthenticated = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (isAuthenticated && profile) {
      // Associate this device's RC anonymous user with the phone number
      loginPurchasesUser(profile.phone);

      // Background plan sync: if RC disagrees with stored plan, reconcile
      getCurrentPlan().then(rcPlan => {
        if (rcPlan !== profile.plan) {
          updateProfile(profile.name, undefined, undefined, rcPlan).catch(() => {});
        }
      });
    } else if (wasAuthenticated === true && !isAuthenticated) {
      // User signed out — switch RC back to anonymous
      logoutPurchasesUser();
    }
  }, [isLoading, isAuthenticated, profile?.phone]);

  const screenOptions = {
    headerStyle: { backgroundColor: theme.colors.primary },
    headerTintColor: '#FFFFFF' as const,
    headerTitleStyle: { fontWeight: 'bold' as const },
    headerBackButtonDisplayMode: 'minimal' as const,
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
      <Stack.Screen name="upgrade" options={{ title: 'Upgrade Plan', presentation: 'modal' }} />
    </Stack>
  );

  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PaperProvider theme={theme}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        </PaperProvider>
      </GestureHandlerRootView>
    );
  }

  if (!isAuthenticated) {
    const loginContent = <LoginScreen />;
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            {Platform.OS === 'web' ? (
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colorScheme === 'dark' ? theme.colors.background : '#C8E8CA' }}>
                <View style={{ flex: 1, width: '100%', maxWidth: 480, backgroundColor: theme.colors.background }}>
                  {loginContent}
                </View>
              </View>
            ) : loginContent}
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <ErrorBoundary>
          {Platform.OS === 'web' ? (
            <View style={{
              flex: 1,
              alignItems: 'center',
              backgroundColor: colorScheme === 'dark' ? theme.colors.background : '#C8E8CA',
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
