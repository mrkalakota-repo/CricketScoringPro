import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Button, useTheme, Surface } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useMatchStore } from '../../src/store/match-store';
import { useTeamStore } from '../../src/store/team-store';
import { usePrefsStore } from '../../src/store/prefs-store';
import * as cloudMatchRepo from '../../src/db/repositories/cloud-match-repo';
import type { CloudMatchRow } from '../../src/db/repositories/cloud-match-repo';
import { isCloudEnabled } from '../../src/config/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MatchRow } from '../../src/db/repositories/match-repo';
import { useUserAuth } from '../../src/hooks/useUserAuth';
import { useRole } from '../../src/hooks/useRole';
import { LIVE_RED } from '../../src/components/NearbyLiveCard';
import { formatOvers } from '../../src/utils/formatters';
import * as Location from 'expo-location';
import Constants from 'expo-constants';

const SIMULATOR_DEFAULT_LOC = { lat: 37.3318, lng: -122.0312 };
const RADIUS_KM = 80.47; // 50 miles

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ScoreLine { label: string; score: string; live?: boolean }

interface RecentMatchEntry {
  id: string;
  teams: string;
  scoreLines: ScoreLine[];
  result: string | null;
  venue: string;
}

function getMatchDisplayInfo(row: MatchRow): { teams: string; scoreLines: ScoreLine[] } {
  if (!row.match_state_json) {
    return { teams: `${row.format.toUpperCase()} Match`, scoreLines: [] };
  }
  try {
    const match = JSON.parse(row.match_state_json);
    const teams = `${match.team1.shortName} vs ${match.team2.shortName}`;
    const innings: any[] = match.innings ?? [];
    const currentIdx: number = match.currentInningsIndex ?? 0;
    const scoreLines: ScoreLine[] = [];

    for (let i = 0; i <= currentIdx && i < innings.length; i++) {
      const inn = innings[i];
      if (!inn) continue;
      const short = inn.battingTeamId === match.team1.id ? match.team1.shortName : match.team2.shortName;
      const overs = formatOvers(inn.totalOvers, inn.totalBalls);
      const isCurrentLive = i === currentIdx && row.status !== 'completed';
      scoreLines.push({
        label: isCurrentLive ? `${short} *` : short,
        score: `${inn.totalRuns}/${inn.totalWickets} (${overs} ov)`,
        live: isCurrentLive,
      });
    }

    // For in_progress matches with no innings yet (toss done, openers not set) show 0/0
    if (row.status === 'in_progress' && innings.length === 0) {
      const battingShort = match.team1.shortName;
      scoreLines.push({ label: `${battingShort} *`, score: '0/0 (0 ov)', live: true });
      scoreLines.push({ label: match.team2.shortName, score: 'Yet to bat' });
    }

    // Show "Yet to bat" for the other team when only 1st innings is in progress
    if (row.status !== 'completed' && currentIdx === 0 && innings.length >= 1) {
      const inn = innings[0];
      const otherShort = inn.battingTeamId === match.team1.id ? match.team2.shortName : match.team1.shortName;
      scoreLines.push({ label: otherShort, score: 'Yet to bat' });
    }

    return { teams, scoreLines };
  } catch {
    return { teams: `${row.format.toUpperCase()} Match`, scoreLines: [] };
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const matches = useMatchStore(s => s.matches);
  const loadMatches = useMatchStore(s => s.loadMatches);
  const teams = useTeamStore(s => s.teams);
  const loadTeams = useTeamStore(s => s.loadTeams);
  const profile = useUserAuth(s => s.profile);
  const myPhone = useUserAuth(s => s.profile?.phone ?? null);
  const { roleLabel, roleIcon, roleColor, canCreateMatch } = useRole();
  const [cloudOnlyCount, setCloudOnlyCount] = useState(0);
  const [myCloudMatches, setMyCloudMatches] = useState<CloudMatchRow[]>([]);

  // Load on mount (initial launch — useFocusEffect doesn't fire on first render in Expo Router)
  useEffect(() => { loadMatches(); loadTeams(); }, []);
  // Re-trigger cloud sync when auth loads after mount (phone was null on initial mount)
  useEffect(() => { if (myPhone) loadTeams(); }, [myPhone]);
  // Reload on every subsequent focus (returning from other tabs)
  useFocusEffect(useCallback(() => { loadMatches(); loadTeams(); }, []));

  // Fetch cloud-only matches (cross-device history not in local SQLite)
  useEffect(() => {
    if (!isCloudEnabled) return;
    (async () => {
      try {
        const localIds = new Set(useMatchStore.getState().matches.map(m => m.id));
        let mine: CloudMatchRow[] = [];
        if (myPhone) {
          const all = await cloudMatchRepo.fetchMyCloudMatches(myPhone, 90);
          mine = all.filter(m => !localIds.has(m.id));
          mine.forEach(m => localIds.add(m.id));
        }
        const community = await cloudMatchRepo.fetchRecentCloudMatches(90);
        const communityNew = community.filter(m => !localIds.has(m.id));
        setCloudOnlyCount(mine.length + communityNew.length);
        setMyCloudMatches(mine);
      } catch { /* silent — stat card falls back to local count */ }
    })();
  }, [myPhone]);

  const myTeamIds = usePrefsStore(s => s.myTeamIds);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
        if (lastKnown) { setUserLoc({ lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude }); return; }
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(), 10_000));
        const loc = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeout]);
        setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        try {
          const fallback = await Location.getLastKnownPositionAsync();
          if (fallback) { setUserLoc({ lat: fallback.coords.latitude, lng: fallback.coords.longitude }); return; }
        } catch {}
        if (Platform.OS === 'ios' && !Constants.isDevice) setUserLoc(SIMULATOR_DEFAULT_LOC);
      }
    })();
  }, []);

  const nearbyTeamCount = useMemo(() => {
    if (!userLoc) return teams.length;
    return teams.filter(t => {
      if (myTeamIds.includes(t.id)) return true;
      if (t.latitude == null || t.longitude == null) return false;
      return haversineKm(userLoc.lat, userLoc.lng, t.latitude, t.longitude) <= RADIUS_KM;
    }).length;
  }, [teams, userLoc, myTeamIds]);

  const liveMatches = useMemo(
    () => matches.filter(m => m.status === 'in_progress' || m.status === 'toss'),
    [matches]
  );
  const recentMatches = useMemo<RecentMatchEntry[]>(() => {
    const localEntries: RecentMatchEntry[] = matches
      .filter(m => m.status === 'completed')
      .map(m => {
        const { teams, scoreLines } = getMatchDisplayInfo(m);
        return { id: m.id, teams, scoreLines, result: m.result, venue: m.venue };
      });
    const localIds = new Set(localEntries.map(e => e.id));
    const cloudEntries: RecentMatchEntry[] = myCloudMatches
      .filter(m => m.status === 'completed' && !localIds.has(m.id))
      .map(m => ({
        id: m.id,
        teams: `${m.team1Short} vs ${m.team2Short}`,
        scoreLines: [],
        result: m.result,
        venue: m.venue,
      }));
    return [...localEntries, ...cloudEntries].slice(0, 5);
  }, [matches, myCloudMatches]);

  const handleLiveMatchPress = (match: MatchRow) => {
    if (match.status === 'toss') {
      router.push(`/match/${match.id}/toss`);
    } else {
      // Navigate to detail screen — it loads the engine before entering scoring,
      // preventing the "No active match" dead-end on the scoring screen.
      router.push(`/match/${match.id}`);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Hero */}
      <Surface style={[styles.hero, { backgroundColor: theme.colors.primary, paddingTop: insets.top + 20 }]} elevation={3}>
        <TouchableOpacity
          onPress={() => router.push('/my-profile')}
          style={[styles.heroProfileButton, { top: insets.top + 8 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="account-circle" size={28} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <MaterialCommunityIcons name="cricket" size={52} color="rgba(255,255,255,0.9)" />
        <Text variant="headlineMedium" style={styles.heroTitle}>Inningsly</Text>
        <Text variant="bodyMedium" style={styles.heroSubtitle}>Score matches like a pro</Text>
        {profile && (
          <View style={styles.roleBadge}>
            <MaterialCommunityIcons name={roleIcon as any} size={14} color={roleColor} />
            <Text style={[styles.roleBadgeText, { color: roleColor }]} numberOfLines={1}>
              {profile.name || 'My Account'} · {roleLabel}
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

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/teams')} activeOpacity={0.75} style={styles.statTouchable}>
          <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <MaterialCommunityIcons name="shield-account" size={22} color={theme.colors.primary} />
            <Text variant="headlineMedium" style={[styles.statNum, { color: theme.colors.primary }]}>
              {nearbyTeamCount}
            </Text>
            <Text variant="bodySmall" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
              {userLoc ? 'Nearby' : 'Teams'}
            </Text>
          </Surface>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)/matches')} activeOpacity={0.75} style={styles.statTouchable}>
          <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <MaterialCommunityIcons name="trophy" size={22} color={theme.colors.primary} />
            <Text variant="headlineMedium" style={[styles.statNum, { color: theme.colors.primary }]}>
              {matches.length + cloudOnlyCount}
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
            const { teams: teamNames, scoreLines } = getMatchDisplayInfo(match);
            const isTossMatch = match.status === 'toss';
            return (
              <Card
                key={match.id}
                style={[styles.matchCard, styles.liveMatchCard]}
                onPress={() => handleLiveMatchPress(match)}
              >
                <View style={[styles.liveStripe, { backgroundColor: isTossMatch ? '#F57C00' : LIVE_RED }]} />
                <Card.Content style={styles.liveCardContent}>
                  <View style={styles.liveTop}>
                    <View style={[styles.liveBadge, { backgroundColor: isTossMatch ? '#FFF3E0' : '#FFEBEE' }]}>
                      <View style={[styles.liveDot, { backgroundColor: isTossMatch ? '#F57C00' : LIVE_RED }]} />
                      <Text style={[styles.liveBadgeText, { color: isTossMatch ? '#F57C00' : LIVE_RED }]}>
                        {isTossMatch ? 'TOSS' : 'LIVE'}
                      </Text>
                    </View>
                    <Text style={[styles.formatChip, { color: theme.colors.onSurfaceVariant }]}>{match.format.toUpperCase()}</Text>
                  </View>
                  <Text variant="titleMedium" style={[styles.liveTeams, { color: theme.colors.onSurface }]}>{teamNames}</Text>
                  {scoreLines.length > 0 && (
                    <View style={styles.scoreBlock}>
                      {scoreLines.map((line, i) => (
                        <View key={i} style={styles.scoreLine}>
                          <Text style={[styles.scoreTeam, { color: line.live ? LIVE_RED : theme.colors.onSurfaceVariant }]}>{line.label}</Text>
                          <Text style={[styles.scoreValue, { color: line.live ? LIVE_RED : theme.colors.onSurfaceVariant }]}>{line.score}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {match.venue ? <Text variant="bodySmall" style={[styles.liveVenue, { color: theme.colors.onSurfaceVariant }]}>{match.venue}</Text> : null}
                </Card.Content>
              </Card>
            );
          })}
        </View>
      )}

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Recent Matches</Text>
          {recentMatches.map(entry => (
            <Card
              key={entry.id}
              style={styles.matchCard}
              onPress={() => router.push(`/match/${entry.id}`)}
            >
              <Card.Content style={styles.recentCardContent}>
                <View style={styles.recentInfo}>
                  <Text variant="titleSmall" style={[styles.recentTeams, { color: theme.colors.onSurface }]}>{entry.teams}</Text>
                  {entry.scoreLines.length > 0 ? (
                    <View style={[styles.scoreBlock, { marginTop: 3 }]}>
                      {entry.scoreLines.map((line, i) => (
                        <View key={i} style={styles.scoreLine}>
                          <Text style={[styles.scoreTeam, { color: theme.colors.onSurfaceVariant }]}>{line.label}</Text>
                          <Text style={[styles.scoreValue, { color: theme.colors.onSurfaceVariant }]}>{line.score}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {entry.result ? <Text variant="bodySmall" style={{ color: theme.colors.primary, marginTop: 3, fontWeight: '600' }}>{entry.result}</Text> : null}
                  {entry.venue ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 1 }}>{entry.venue}</Text> : null}
                </View>
                <View style={[styles.doneChip, { backgroundColor: theme.colors.primaryContainer }]}>
                  <MaterialCommunityIcons name="check" size={12} color={theme.colors.onPrimaryContainer} />
                  <Text style={[styles.doneChipText, { color: theme.colors.onPrimaryContainer }]}>DONE</Text>
                </View>
              </Card.Content>
            </Card>
          ))}
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
          </View>
        </View>
      )}

      <View style={{ height: Math.max(insets.bottom, 24) }} />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    padding: 36,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroProfileButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  heroTitle: { color: '#FFFFFF', fontWeight: '900', marginTop: 10, letterSpacing: 0.3 },
  heroSubtitle: { color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, maxWidth: '88%' },
  roleBadgeText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  heroButton: { marginTop: 20, borderRadius: 28, paddingHorizontal: 8 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
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
  liveTeams: { fontWeight: '800', fontSize: 16, marginBottom: 4 },
  liveVenue: { marginTop: 4, fontSize: 12 },
  scoreBlock: { gap: 2 },
  scoreLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreTeam: { fontSize: 13, fontWeight: '700', minWidth: 40 },
  scoreValue: { fontSize: 13, fontWeight: '600' },
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
