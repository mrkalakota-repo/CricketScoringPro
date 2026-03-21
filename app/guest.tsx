import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card, useTheme, ActivityIndicator, Surface, Portal, Dialog } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveScoresStore } from '../src/store/live-scores-store';
import { isCloudEnabled } from '../src/config/supabase';
import { LIVE_RED } from '../src/components/NearbyLiveCard';
import { formatOvers } from '../src/utils/formatters';
import type { LiveMatchSummary } from '../src/db/repositories/cloud-match-repo';

const TOSS_ORANGE = '#F57C00';

function MatchCard({ match, onPress }: { match: LiveMatchSummary; onPress: () => void }) {
  const theme = useTheme();
  const isLive = match.status === 'in_progress';
  const isToss = match.status === 'toss';
  const isCompleted = match.status === 'completed';

  const stripeColor = isCompleted ? theme.colors.primary : isToss ? TOSS_ORANGE : LIVE_RED;
  const badgeBg = isCompleted
    ? theme.colors.primaryContainer
    : isToss ? '#FFF3E0' : '#FFEBEE';
  const badgeColor = isCompleted
    ? theme.colors.onPrimaryContainer
    : isToss ? TOSS_ORANGE : LIVE_RED;
  const badgeLabel = isToss ? 'TOSS' : isLive ? 'LIVE' : 'RESULT';

  return (
    <Card style={[styles.matchCard, (isLive || isToss) && styles.liveMatchCard]} onPress={onPress}>
      <View style={[styles.liveStripe, { backgroundColor: stripeColor }]} />
      <Card.Content style={styles.cardContent}>
        {/* Top row: badge + format + venue */}
        <View style={styles.cardTop}>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            {(isLive || isToss) && <View style={[styles.liveDot, { backgroundColor: stripeColor }]} />}
            {isCompleted && (
              <MaterialCommunityIcons name="check-circle" size={10} color={badgeColor} />
            )}
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
          </View>
          <Text style={[styles.formatChip, { color: theme.colors.onSurfaceVariant }]}>
            {match.format.toUpperCase()}
            {match.venue ? ` · ${match.venue}` : ''}
          </Text>
        </View>

        {/* Teams */}
        <Text variant="titleMedium" style={[styles.teams, { color: theme.colors.onSurface }]}>
          {match.team1Short} vs {match.team2Short}
        </Text>

        {/* Team-level scores */}
        {isLive && match.battingShort ? (() => {
          const bowlingShort = match.battingShort === match.team1Short ? match.team2Short : match.team1Short;
          const inning2 = match.inningsNum >= 2 && match.target != null;
          return (
            <View style={styles.scoreBlock}>
              {inning2 ? (
                <>
                  <View style={styles.scoreLine}>
                    <Text style={[styles.scoreTeam, { color: theme.colors.onSurfaceVariant }]}>{bowlingShort}</Text>
                    <Text style={[styles.scoreVal, { color: theme.colors.onSurfaceVariant }]}>{match.target! - 1}</Text>
                  </View>
                  <View style={styles.scoreLine}>
                    <Text style={[styles.scoreTeam, { color: LIVE_RED }]}>{match.battingShort} *</Text>
                    <Text style={[styles.scoreVal, { color: LIVE_RED }]}>
                      {match.score}/{match.wickets} ({formatOvers(match.overs, match.balls)} ov)
                    </Text>
                  </View>
                  <Text style={[styles.chaseText, { color: theme.colors.onSurfaceVariant }]}>
                    Need {match.target! - match.score} more
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.scoreLine}>
                    <Text style={[styles.scoreTeam, { color: LIVE_RED }]}>{match.battingShort} *</Text>
                    <Text style={[styles.scoreVal, { color: LIVE_RED }]}>
                      {match.score}/{match.wickets} ({formatOvers(match.overs, match.balls)} ov)
                    </Text>
                  </View>
                  <View style={styles.scoreLine}>
                    <Text style={[styles.scoreTeam, { color: theme.colors.onSurfaceVariant }]}>{bowlingShort}</Text>
                    <Text style={[styles.scoreVal, { color: theme.colors.onSurfaceVariant }]}>Yet to bat</Text>
                  </View>
                </>
              )}
            </View>
          );
        })() : isCompleted && match.result ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={2}>
            {match.result}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

interface GuestScreenProps {
  onSignIn: () => void;
}

export default function GuestScreen({ onSignIn }: GuestScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const nearbyMatches = useLiveScoresStore(s => s.matches);
  const loadNearby = useLiveScoresStore(s => s.loadNearby);
  const subscribeLive = useLiveScoresStore(s => s.subscribe);
  const liveLoading = useLiveScoresStore(s => s.loading);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<LiveMatchSummary | null>(null);

  useEffect(() => {
    if (!isCloudEnabled) return;
    loadNearby().then(() => {
      unsubscribeRef.current = subscribeLive();
    });
    return () => { unsubscribeRef.current?.(); };
  }, []);

  const liveCount = nearbyMatches.filter(m => m.status === 'in_progress' || m.status === 'toss').length;
  const completedCount = nearbyMatches.filter(m => m.status === 'completed').length;

  const sel = selectedMatch;

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
      >
        {/* Branding */}
        <Surface style={[styles.hero, { backgroundColor: theme.colors.primary }]} elevation={3}>
          <MaterialCommunityIcons name="cricket" size={52} color="rgba(255,255,255,0.9)" />
          <Text variant="headlineMedium" style={styles.heroTitle}>Gully Cricket Scorer</Text>
          <Text variant="bodyMedium" style={styles.heroSubtitle}>Live scores & results near you</Text>
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

        {/* Nearby Matches */}
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

            {/* Summary chips when matches are loaded */}
            {nearbyMatches.length > 0 && (
              <View style={styles.chipRow}>
                {liveCount > 0 && (
                  <View style={[styles.chip, { backgroundColor: '#FFEBEE' }]}>
                    <View style={[styles.chipDot, { backgroundColor: LIVE_RED }]} />
                    <Text style={[styles.chipText, { color: LIVE_RED }]}>{liveCount} live</Text>
                  </View>
                )}
                {completedCount > 0 && (
                  <View style={[styles.chip, { backgroundColor: theme.colors.primaryContainer }]}>
                    <MaterialCommunityIcons name="check-circle" size={10} color={theme.colors.primary} />
                    <Text style={[styles.chipText, { color: theme.colors.primary }]}>{completedCount} completed</Text>
                  </View>
                )}
              </View>
            )}

            {liveLoading && nearbyMatches.length === 0 ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 24 }} />
            ) : nearbyMatches.length === 0 ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="broadcast-off" size={40} color={theme.colors.outlineVariant} />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}>
                  No matches nearby in the last 24 hours
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' }}>
                  Sign in to start scoring your own match
                </Text>
              </View>
            ) : (
              nearbyMatches.map(m => (
                <MatchCard key={m.id} match={m} onPress={() => setSelectedMatch(m)} />
              ))
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
            Sign in to manage teams, create matches, and join leagues
          </Text>
          <Button mode="outlined" onPress={onSignIn} icon="login">
            Sign In / Register
          </Button>
        </View>
      </ScrollView>

      {/* Score detail dialog */}
      <Portal>
        <Dialog visible={!!selectedMatch} onDismiss={() => setSelectedMatch(null)}>
          {sel && (
            <>
              <Dialog.Title>
                {sel.team1Short} vs {sel.team2Short}
              </Dialog.Title>
              <Dialog.Content>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
                  {sel.format.toUpperCase()}{sel.venue ? ` · ${sel.venue}` : ''}
                </Text>

                {sel.status === 'in_progress' && sel.battingShort ? (
                  <>
                    <View style={styles.scoreRow}>
                      <Text variant="titleLarge" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
                        {sel.battingShort}: {sel.score}/{sel.wickets}
                      </Text>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        ({formatOvers(sel.overs, sel.balls)} ov)
                      </Text>
                    </View>
                    {sel.target && (
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, marginTop: 4 }}>
                        Target: {sel.target} · Need {sel.target - sel.score} more
                      </Text>
                    )}
                  </>
                ) : sel.status === 'toss' ? (
                  <Text variant="bodyMedium" style={{ color: TOSS_ORANGE }}>Toss in progress</Text>
                ) : sel.status === 'completed' && sel.result ? (
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                    {sel.result}
                  </Text>
                ) : null}
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setSelectedMatch(null)}>Close</Button>
                <Button mode="contained" onPress={() => { setSelectedMatch(null); onSignIn(); }} icon="login">
                  Sign In for Full Scorecard
                </Button>
              </Dialog.Actions>
            </>
          )}
        </Dialog>
      </Portal>
    </>
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  matchCard: { marginBottom: 10, borderRadius: 14, overflow: 'hidden' },
  liveMatchCard: { elevation: 3, shadowColor: LIVE_RED, shadowOpacity: 0.1, shadowRadius: 4 },
  liveStripe: { height: 4 },
  cardContent: { paddingTop: 10, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  formatChip: { fontSize: 10, fontWeight: '600' },
  teams: { fontWeight: '800', fontSize: 16 },
  scoreBlock: { gap: 2, marginTop: 4 },
  scoreLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreTeam: { fontSize: 12, fontWeight: '700', minWidth: 36 },
  scoreVal: { fontSize: 12, fontWeight: '600' },
  chaseText: { fontSize: 11, marginTop: 2 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  footer: { marginTop: 24, marginHorizontal: 16, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
});
