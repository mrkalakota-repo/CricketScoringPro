import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Button, useTheme, Surface, ActivityIndicator } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useMatchStore } from '../../src/store/match-store';
import { useTeamStore } from '../../src/store/team-store';
import { useLiveScoresStore } from '../../src/store/live-scores-store';
import { isCloudEnabled } from '../../src/config/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MatchRow } from '../../src/db/repositories/match-repo';
import { useUserAuth } from '../../src/hooks/useUserAuth';
import { useRole } from '../../src/hooks/useRole';
import { NearbyLiveCard, LIVE_RED } from '../../src/components/NearbyLiveCard';

function getMatchDisplayInfo(row: MatchRow): { teams: string; score: string | null } {
  if (!row.match_state_json) {
    return { teams: `${row.format.toUpperCase()} Match`, score: null };
  }
  try {
    const match = JSON.parse(row.match_state_json);
    const teams = `${match.team1.shortName} vs ${match.team2.shortName}`;
    const inn = match.innings?.[match.currentInningsIndex];
    if (!inn) return { teams, score: null };
    const battingShort = inn.battingTeamId === match.team1.id
      ? match.team1.shortName : match.team2.shortName;
    const overs = `${inn.totalOvers}.${inn.totalBalls}`;
    return { teams, score: `${battingShort}: ${inn.totalRuns}/${inn.totalWickets} (${overs} ov)` };
  } catch {
    return { teams: `${row.format.toUpperCase()} Match`, score: null };
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const matches = useMatchStore(s => s.matches);
  const loadMatches = useMatchStore(s => s.loadMatches);
  const teams = useTeamStore(s => s.teams);
  const loadTeams = useTeamStore(s => s.loadTeams);
  const nearbyLive = useLiveScoresStore(s => s.matches);
  const loadNearby = useLiveScoresStore(s => s.loadNearby);
  const subscribeLive = useLiveScoresStore(s => s.subscribe);
  const liveLoading = useLiveScoresStore(s => s.loading);
  const profile = useUserAuth(s => s.profile);
  const { roleLabel, roleIcon, roleColor, canCreateMatch } = useRole();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useFocusEffect(useCallback(() => { loadMatches(); loadTeams(); }, []));

  // Load nearby live matches and subscribe to real-time updates
  useEffect(() => {
    if (!isCloudEnabled) return;
    loadNearby().then(() => {
      unsubscribeRef.current = subscribeLive();
    });
    return () => { unsubscribeRef.current?.(); };
  }, []);

  const liveMatches = useMemo(
    () => matches.filter(m => m.status === 'in_progress' || m.status === 'toss'),
    [matches]
  );
  const recentMatches = useMemo(
    () => matches.filter(m => m.status === 'completed').slice(0, 5),
    [matches]
  );

  const handleLiveMatchPress = (match: MatchRow) => {
    if (match.status === 'toss') {
      router.push(`/match/${match.id}/toss`);
    } else {
      router.push(`/match/${match.id}/scoring`);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Hero */}
      <Surface style={[styles.hero, { backgroundColor: theme.colors.primary }]} elevation={3}>
        <MaterialCommunityIcons name="cricket" size={52} color="rgba(255,255,255,0.9)" />
        <Text variant="headlineMedium" style={styles.heroTitle}>Gully Cricket Scorer</Text>
        <Text variant="bodyMedium" style={styles.heroSubtitle}>Score matches like a pro</Text>
        {profile && (
          <View style={styles.roleBadge}>
            <MaterialCommunityIcons name={roleIcon as any} size={14} color={roleColor} />
            <Text style={[styles.roleBadgeText, { color: roleColor }]}>
              {profile.name} · {roleLabel}
            </Text>
          </View>
        )}
        {canCreateMatch && (
          <Button
            mode="contained"
            onPress={() => router.push('/match/create')}
            style={styles.heroButton}
            buttonColor="rgba(255,255,255,0.95)"
            textColor={theme.colors.primary}
            icon="plus-circle"
            contentStyle={{ paddingHorizontal: 8 }}
          >
            New Match
          </Button>
        )}
      </Surface>

      {/* Quick Actions Row */}
      <View style={styles.quickActions}>
        <Button compact mode="text" icon="account-circle" onPress={() => router.push('/my-profile')} labelStyle={styles.actionLabel}>
          My Profile
        </Button>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/teams')} activeOpacity={0.75} style={styles.statTouchable}>
          <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <MaterialCommunityIcons name="shield-account" size={22} color={theme.colors.primary} />
            <Text variant="headlineMedium" style={[styles.statNum, { color: theme.colors.primary }]}>
              {teams.length}
            </Text>
            <Text variant="bodySmall" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Teams</Text>
          </Surface>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)/matches')} activeOpacity={0.75} style={styles.statTouchable}>
          <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <MaterialCommunityIcons name="trophy" size={22} color={theme.colors.primary} />
            <Text variant="headlineMedium" style={[styles.statNum, { color: theme.colors.primary }]}>
              {matches.length}
            </Text>
            <Text variant="bodySmall" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Matches</Text>
          </Surface>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)/matches')} activeOpacity={0.75} style={styles.statTouchable}>
          <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <MaterialCommunityIcons name="broadcast" size={22} color={liveMatches.length > 0 ? LIVE_RED : theme.colors.primary} />
            <Text variant="headlineMedium" style={[styles.statNum, { color: liveMatches.length > 0 ? LIVE_RED : theme.colors.primary }]}>
              {liveMatches.length}
            </Text>
            <Text variant="bodySmall" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Live</Text>
          </Surface>
        </TouchableOpacity>
      </View>

      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.liveHeaderDot} />
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Live Now</Text>
          </View>
          {liveMatches.map(match => {
            const { teams: teamNames, score } = getMatchDisplayInfo(match);
            return (
              <Card
                key={match.id}
                style={[styles.matchCard, styles.liveMatchCard]}
                onPress={() => handleLiveMatchPress(match)}
              >
                <View style={[styles.liveStripe, { backgroundColor: match.status === 'toss' ? '#F57C00' : LIVE_RED }]} />
                <Card.Content style={styles.liveCardContent}>
                  <View style={styles.liveTop}>
                    <View style={[styles.liveBadge, { backgroundColor: match.status === 'toss' ? '#FFF3E0' : '#FFEBEE' }]}>
                      <View style={[styles.liveDot, { backgroundColor: match.status === 'toss' ? '#F57C00' : LIVE_RED }]} />
                      <Text style={[styles.liveBadgeText, { color: match.status === 'toss' ? '#F57C00' : LIVE_RED }]}>
                        {match.status === 'toss' ? 'TOSS' : 'LIVE'}
                      </Text>
                    </View>
                    <Text style={[styles.formatChip, { color: theme.colors.onSurfaceVariant }]}>{match.format.toUpperCase()}</Text>
                  </View>
                  <Text variant="titleMedium" style={[styles.liveTeams, { color: theme.colors.onSurface }]}>{teamNames}</Text>
                  {score && (
                    <Text variant="bodyMedium" style={[styles.liveScore, { color: theme.colors.primary }]}>{score}</Text>
                  )}
                  {match.venue ? <Text variant="bodySmall" style={[styles.liveVenue, { color: theme.colors.onSurfaceVariant }]}>{match.venue}</Text> : null}
                </Card.Content>
              </Card>
            );
          })}
        </View>
      )}

      {/* Nearby Live Matches (from other devices via Supabase) */}
      {isCloudEnabled && (nearbyLive.length > 0 || liveLoading) && (
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
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
          ) : (
            nearbyLive.map(m => <NearbyLiveCard key={m.id} match={m} />)
          )}
        </View>
      )}

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Recent Matches</Text>
          {recentMatches.map(match => {
            const { teams: teamNames } = getMatchDisplayInfo(match);
            return (
              <Card
                key={match.id}
                style={styles.matchCard}
                onPress={() => router.push(`/match/${match.id}`)}
              >
                <Card.Content style={styles.recentCardContent}>
                  <View style={styles.recentInfo}>
                    <Text variant="titleSmall" style={[styles.recentTeams, { color: theme.colors.onSurface }]}>{teamNames}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>{match.result ?? 'No result'}</Text>
                    {match.venue ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 1 }}>{match.venue}</Text> : null}
                  </View>
                  <View style={[styles.doneChip, { backgroundColor: theme.colors.primaryContainer }]}>
                    <MaterialCommunityIcons name="check" size={12} color={theme.colors.onPrimaryContainer} />
                    <Text style={[styles.doneChipText, { color: theme.colors.onPrimaryContainer }]}>DONE</Text>
                  </View>
                </Card.Content>
              </Card>
            );
          })}
        </View>
      )}

      {/* Empty State */}
      {matches.length === 0 && teams.length === 0 && (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="cricket" size={52} color={theme.colors.onPrimaryContainer} />
          </View>
          <Text variant="titleLarge" style={[styles.emptyTitle, { color: theme.colors.primary }]}>
            Welcome!
          </Text>
          <Text variant="bodyMedium" style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Start by adding teams, then set up your first match
          </Text>
          <View style={styles.emptyActions}>
            <Button mode="contained" onPress={() => router.push('/team/create')} icon="shield-account" style={{ borderRadius: 12 }}>
              Create Team
            </Button>
            <Button mode="text" onPress={() => router.push('/profile')} icon="account-search">
              Find My Profile
            </Button>
          </View>
        </View>
      )}

      <View style={{ height: 24 }} />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    padding: 36,
    paddingTop: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroTitle: { color: '#FFFFFF', fontWeight: '900', marginTop: 10, letterSpacing: 0.3 },
  heroSubtitle: { color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  roleBadgeText: { fontSize: 12, fontWeight: '700' },
  heroButton: { marginTop: 20, borderRadius: 28, paddingHorizontal: 8 },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 8,
    gap: 0,
  },
  actionLabel: { fontSize: 11 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: -16,
  },
  statTouchable: { flex: 1 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 2,
  },
  statNum: { fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: '600' },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontWeight: '800' },
  liveHeaderDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: LIVE_RED },
  matchCard: { marginBottom: 10, borderRadius: 16, overflow: 'hidden' },
  liveMatchCard: { elevation: 4, shadowColor: LIVE_RED, shadowOpacity: 0.15, shadowRadius: 6 },
  // Local live card styles (for matches scored on this device — full card with venue)
  liveStripe: { height: 4 },
  liveCardContent: { paddingTop: 10 },
  liveTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  formatChip: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  liveTeams: { fontWeight: '800', fontSize: 16 },
  liveScore: { fontWeight: '700', marginTop: 4, fontSize: 14 },
  liveVenue: { marginTop: 4, fontSize: 12 },
  recentCardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentInfo: { flex: 1 },
  recentTeams: { fontWeight: '700' },
  doneChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  doneChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyIcon: { width: 96, height: 96, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontWeight: '900', marginBottom: 8 },
  emptySubtitle: { textAlign: 'center', marginBottom: 28 },
  emptyActions: { width: '100%', gap: 12 },
});
