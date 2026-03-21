import { useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, useTheme, ActivityIndicator, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveScoresStore } from '../src/store/live-scores-store';
import { isCloudEnabled } from '../src/config/supabase';
import { NearbyLiveCard } from '../src/components/NearbyLiveCard';

interface GuestScreenProps {
  onSignIn: () => void;
}

export default function GuestScreen({ onSignIn }: GuestScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const nearbyLive = useLiveScoresStore(s => s.matches);
  const loadNearby = useLiveScoresStore(s => s.loadNearby);
  const subscribeLive = useLiveScoresStore(s => s.subscribe);
  const liveLoading = useLiveScoresStore(s => s.loading);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isCloudEnabled) return;
    loadNearby().then(() => {
      unsubscribeRef.current = subscribeLive();
    });
    return () => { unsubscribeRef.current?.(); };
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
    >
      {/* Branding */}
      <Surface style={[styles.hero, { backgroundColor: theme.colors.primary }]} elevation={3}>
        <MaterialCommunityIcons name="cricket" size={52} color="rgba(255,255,255,0.9)" />
        <Text variant="headlineMedium" style={styles.heroTitle}>Gully Cricket Scorer</Text>
        <Text variant="bodyMedium" style={styles.heroSubtitle}>Live scores near you</Text>
        <Button
          mode="contained"
          onPress={onSignIn}
          style={styles.heroButton}
          buttonColor="rgba(255,255,255,0.95)"
          textColor={theme.colors.primary}
          icon="account-circle"
          contentStyle={{ paddingHorizontal: 8 }}
        >
          Sign In / Register
        </Button>
      </Surface>

      {/* Nearby Live Scores */}
      {isCloudEnabled ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="map-marker-radius" size={16} color={theme.colors.primary} />
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Nearby Matches
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 'auto' }}>
              within 50 miles
            </Text>
          </View>

          {liveLoading && nearbyLive.length === 0 ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 24 }} />
          ) : nearbyLive.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="broadcast-off" size={40} color={theme.colors.outlineVariant} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}>
                No live matches nearby right now
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' }}>
                Check back soon or sign in to start scoring
              </Text>
            </View>
          ) : (
            nearbyLive.map(m => <NearbyLiveCard key={m.id} match={m} />)
          )}
        </View>
      ) : (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="cloud-off-outline" size={40} color={theme.colors.outlineVariant} />
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}>
            Cloud not configured
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' }}>
            Sign in to access scoring and team management
          </Text>
        </View>
      )}

      {/* Sign-in nudge at bottom */}
      <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 12 }}>
          Sign in to score matches, manage teams, and create leagues
        </Text>
        <Button mode="outlined" onPress={onSignIn} icon="login">
          Sign In / Register
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    padding: 28,
    paddingTop: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 6,
  },
  heroTitle: { color: '#FFFFFF', fontWeight: 'bold', marginTop: 8 },
  heroSubtitle: { color: 'rgba(255,255,255,0.85)', marginBottom: 8 },
  heroButton: { marginTop: 12, borderRadius: 24 },
  section: { padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  footer: { marginTop: 24, marginHorizontal: 16, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
});
