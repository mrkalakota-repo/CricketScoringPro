import { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useResponsive } from '../../src/hooks/useResponsive';
import { Text, Card, useTheme, Divider, Surface, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useMatchStore } from '../../src/store/match-store';
import { useTeamStore } from '../../src/store/team-store';
import { usePrefsStore } from '../../src/store/prefs-store';
import { useUserAuth } from '../../src/hooks/useUserAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Match } from '../../src/engine/types';
import { economyRate } from '../../src/utils/cricket-math';
import { formatOvers } from '../../src/utils/formatters';
import * as cloudMatchRepo from '../../src/db/repositories/cloud-match-repo';
import type { CloudMatchRow } from '../../src/db/repositories/cloud-match-repo';
import { isCloudEnabled } from '../../src/config/supabase';

type PlayerRunStat = { name: string; runs: number; matches: number; high: number };
type PlayerWktStat = { name: string; wickets: number; matches: number; bestWickets: number; bestRuns: number; economy: number };

function parseCompletedMatches(matchRows: ReturnType<typeof useMatchStore.getState>['matches']): Match[] {
  return matchRows
    .filter(m => m.status === 'completed' && m.match_state_json)
    .map(m => {
      try { return JSON.parse(m.match_state_json!) as Match; } catch { return null; }
    })
    .filter(Boolean) as Match[];
}

function computeRunStats(completedMatches: Match[]): PlayerRunStat[] {
  const map = new Map<string, PlayerRunStat>();
  for (const match of completedMatches) {
    const allPlayers = [...match.team1.players, ...match.team2.players];
    const playerNames = new Map(allPlayers.map(p => [p.id, p.name]));
    const getName = (id: string) => playerNames.get(id) ?? id;
    for (const inn of match.innings) {
      for (const b of inn.batters) {
        const name = getName(b.playerId);
        const prev = map.get(name) ?? { name, runs: 0, matches: 0, high: 0 };
        map.set(name, {
          name,
          runs: prev.runs + b.runs,
          matches: prev.matches + 1,
          high: Math.max(prev.high, b.runs),
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.runs - a.runs).slice(0, 5);
}

function computeWktStats(completedMatches: Match[]): PlayerWktStat[] {
  const map = new Map<string, PlayerWktStat>();
  for (const match of completedMatches) {
    const allPlayers = [...match.team1.players, ...match.team2.players];
    const playerNames = new Map(allPlayers.map(p => [p.id, p.name]));
    const getName = (id: string) => playerNames.get(id) ?? id;
    for (const inn of match.innings) {
      for (const b of inn.bowlers) {
        const name = getName(b.playerId);
        const prev = map.get(name) ?? { name, wickets: 0, matches: 0, bestWickets: 0, bestRuns: 0, economy: 0 };
        const isNewBest = b.wickets > prev.bestWickets || (b.wickets === prev.bestWickets && b.runsConceded < prev.bestRuns);
        map.set(name, {
          name,
          wickets: prev.wickets + b.wickets,
          matches: prev.matches + 1,
          bestWickets: isNewBest ? b.wickets : prev.bestWickets,
          bestRuns: isNewBest ? b.runsConceded : prev.bestRuns,
          economy: economyRate(prev.wickets > 0 ? prev.bestRuns : b.runsConceded, b.overs, b.ballsBowled),
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.wickets - a.wickets || a.bestRuns - b.bestRuns).slice(0, 5);
}

export default function StatsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const matches = useMatchStore(s => s.matches);
  const { teams, loading: teamsLoading, loadTeams } = useTeamStore();
  const myTeamIds = usePrefsStore(s => s.myTeamIds);
  const playerTeamIds = usePrefsStore(s => s.playerTeamIds);
  const myPhone = useUserAuth(s => s.profile?.phone ?? null);

  // Prefer prefs-based count (updated by cloud sync before local import completes)
  // so the card shows the correct number immediately after login.
  const teamsCount = myTeamIds.length + playerTeamIds.length || teams.length;

  // Ensure cloud-owned/member teams are in the store when this tab is viewed
  useFocusEffect(useCallback(() => { loadTeams(); }, []));

  const [cloudRows, setCloudRows] = useState<CloudMatchRow[]>([]);
  const [cloudCompleted, setCloudCompleted] = useState<Match[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);

  const loadCloud = useCallback(async () => {
    if (!isCloudEnabled) return;
    setCloudLoading(true);
    try {
      const localIds = new Set(matches.map(m => m.id));
      const [mine, recent, completedStates] = await Promise.all([
        myPhone ? cloudMatchRepo.fetchMyCloudMatches(myPhone, 90) : Promise.resolve([] as CloudMatchRow[]),
        cloudMatchRepo.fetchRecentCloudMatches(30),
        cloudMatchRepo.fetchCompletedCloudMatchStates(myPhone, 90),
      ]);
      // Deduplicate cloud rows against local
      const seen = new Set(localIds);
      const deduped: CloudMatchRow[] = [];
      for (const r of [...mine, ...recent]) {
        if (!seen.has(r.id)) { seen.add(r.id); deduped.push(r); }
      }
      setCloudRows(deduped);
      // Deduplicate completed states against local
      const localCompletedIds = new Set(
        matches.filter(m => m.status === 'completed').map(m => m.id)
      );
      setCloudCompleted(completedStates.filter(m => !localCompletedIds.has(m.id)));
    } finally {
      setCloudLoading(false);
    }
  }, [matches, myPhone]);

  useFocusEffect(useCallback(() => { loadCloud(); }, []));

  // Overview counts — local + cloud
  const localCompletedCount = matches.filter(m => m.status === 'completed').length;
  const cloudCompletedCount = cloudRows.filter(r => r.status === 'completed').length;
  const completedCount = localCompletedCount + cloudCompletedCount;
  const totalCount = matches.length + cloudRows.length;
  const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);
  const statsLoading = teamsLoading || cloudLoading;

  // Player stats — merge local + cloud completed match JSONs
  const localCompleted = useMemo(() => parseCompletedMatches(matches), [matches]);
  const allCompleted = useMemo(() => [...localCompleted, ...cloudCompleted], [localCompleted, cloudCompleted]);
  const runStats = useMemo(() => computeRunStats(allCompleted), [allCompleted]);
  const wktStats = useMemo(() => computeWktStats(allCompleted), [allCompleted]);

  const { isTablet } = useResponsive();

  const overviewStats = [
    { icon: 'cricket' as const,        value: completedCount, label: 'Completed',     onPress: () => router.push('/matches') },
    { icon: 'trophy' as const,         value: totalCount,     label: 'Total Matches', onPress: () => router.push('/matches') },
    { icon: 'shield-account' as const, value: teamsCount,     label: 'Teams',         onPress: () => router.push('/teams') },
    { icon: 'account-group' as const,  value: totalPlayers,   label: 'Players',       onPress: () => router.push('/teams') },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 8) + 16 }}
    >
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text variant="titleLarge" style={[styles.title, { color: theme.colors.primary }]}>
            Statistics
          </Text>
          {cloudLoading && (
            <View style={styles.syncRow}>
              <ActivityIndicator size={12} color={theme.colors.primary} />
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>syncing…</Text>
            </View>
          )}
          {!cloudLoading && isCloudEnabled && cloudRows.length > 0 && (
            <View style={styles.syncRow}>
              <MaterialCommunityIcons name="cloud-check-outline" size={13} color={theme.colors.primary} />
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                +{cloudRows.length} cloud
              </Text>
            </View>
          )}
        </View>

        {/* Overview counts */}
        <View style={styles.grid}>
          {overviewStats.map(({ icon, value, label, onPress }) => (
            <Card key={label} style={[styles.statCard, isTablet && { width: '22%' }]} onPress={onPress}>
              <Card.Content style={styles.statContent}>
                <MaterialCommunityIcons name={icon} size={28} color={theme.colors.primary} />
                {statsLoading && value === 0 ? (
                  <ActivityIndicator size={20} color={theme.colors.primary} />
                ) : (
                  <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                    {value}
                  </Text>
                )}
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>{label}</Text>
              </Card.Content>
            </Card>
          ))}
        </View>

        {completedCount === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chart-bar" size={48} color={theme.colors.outlineVariant} />
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 12 }}>
              Complete matches to see player statistics here
            </Text>
          </View>
        ) : (
          <View style={isTablet && { flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
            {/* Top Scorers */}
            {runStats.length > 0 && (
              <Surface style={[styles.tableCard, { backgroundColor: theme.colors.surface }, isTablet && { flex: 1 }]} elevation={1}>
                <View style={styles.tableHeader}>
                  <MaterialCommunityIcons name="cricket" size={16} color={theme.colors.primary} />
                  <Text variant="titleSmall" style={[styles.tableTitle, { color: theme.colors.onSurface }]}>
                    Top Scorers
                  </Text>
                </View>
                <Divider />
                <View style={[styles.columnRow, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text style={[styles.colHdr, { flex: 3 }]}>Player</Text>
                  <Text style={[styles.colHdr, { flex: 1, textAlign: 'center' }]}>Runs</Text>
                  <Text style={[styles.colHdr, { flex: 1, textAlign: 'center' }]}>High</Text>
                  <Text style={[styles.colHdr, { flex: 1, textAlign: 'center' }]}>Mat</Text>
                </View>
                {runStats.map((s, i) => (
                  <View key={s.name}>
                    <View style={styles.dataRow}>
                      <View style={styles.rankBadge}>
                        <Text style={[styles.rankText, { color: i === 0 ? '#F57C00' : theme.colors.onSurfaceVariant }]}>
                          {i + 1}
                        </Text>
                      </View>
                      <Text style={[styles.playerCol, { flex: 3, color: theme.colors.onSurface }]} numberOfLines={1}>{s.name}</Text>
                      <Text style={[styles.numCol, { flex: 1, color: theme.colors.primary, fontWeight: '800' }]}>{s.runs}</Text>
                      <Text style={[styles.numCol, { flex: 1, color: theme.colors.onSurface }]}>{s.high}</Text>
                      <Text style={[styles.numCol, { flex: 1, color: theme.colors.onSurfaceVariant }]}>{s.matches}</Text>
                    </View>
                    {i < runStats.length - 1 && <Divider />}
                  </View>
                ))}
              </Surface>
            )}

            {/* Top Wicket-Takers */}
            {wktStats.length > 0 && (
              <Surface style={[styles.tableCard, { backgroundColor: theme.colors.surface }, isTablet && { flex: 1 }]} elevation={1}>
                <View style={styles.tableHeader}>
                  <MaterialCommunityIcons name="baseball" size={16} color={theme.colors.primary} />
                  <Text variant="titleSmall" style={[styles.tableTitle, { color: theme.colors.onSurface }]}>
                    Top Wicket-Takers
                  </Text>
                </View>
                <Divider />
                <View style={[styles.columnRow, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text style={[styles.colHdr, { flex: 3 }]}>Bowler</Text>
                  <Text style={[styles.colHdr, { flex: 1, textAlign: 'center' }]}>Wkts</Text>
                  <Text style={[styles.colHdr, { flex: 1.5, textAlign: 'center' }]}>Best</Text>
                  <Text style={[styles.colHdr, { flex: 1, textAlign: 'center' }]}>Mat</Text>
                </View>
                {wktStats.map((s, i) => (
                  <View key={s.name}>
                    <View style={styles.dataRow}>
                      <View style={styles.rankBadge}>
                        <Text style={[styles.rankText, { color: i === 0 ? '#F57C00' : theme.colors.onSurfaceVariant }]}>
                          {i + 1}
                        </Text>
                      </View>
                      <Text style={[styles.playerCol, { flex: 3, color: theme.colors.onSurface }]} numberOfLines={1}>{s.name}</Text>
                      <Text style={[styles.numCol, { flex: 1, color: theme.colors.primary, fontWeight: '800' }]}>{s.wickets}</Text>
                      <Text style={[styles.numCol, { flex: 1.5, color: theme.colors.onSurface }]}>{s.bestWickets}/{s.bestRuns}</Text>
                      <Text style={[styles.numCol, { flex: 1, color: theme.colors.onSurfaceVariant }]}>{s.matches}</Text>
                    </View>
                    {i < wktStats.length - 1 && <Divider />}
                  </View>
                ))}
              </Surface>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontWeight: 'bold', flex: 1 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%', borderRadius: 12 },
  statContent: { alignItems: 'center', padding: 10, gap: 4 },
  emptyState: { padding: 32, alignItems: 'center' },
  tableCard: { borderRadius: 12, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingBottom: 10 },
  tableTitle: { fontWeight: '700' },
  columnRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6 },
  colHdr: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.3 },
  dataRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10 },
  rankBadge: { width: 20, alignItems: 'center', marginRight: 4 },
  rankText: { fontSize: 11, fontWeight: '700' },
  playerCol: { fontSize: 13, fontWeight: '600' },
  numCol: { textAlign: 'center', fontSize: 13 },
});
