import { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, useTheme, Divider, Surface } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMatchStore } from '../../src/store/match-store';
import { useTeamStore } from '../../src/store/team-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Match } from '../../src/engine/types';
import { economyRate } from '../../src/utils/cricket-math';
import { formatOvers } from '../../src/utils/formatters';

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
    const getName = (id: string) => allPlayers.find(p => p.id === id)?.name ?? id;
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
    const getName = (id: string) => allPlayers.find(p => p.id === id)?.name ?? id;
    for (const inn of match.innings) {
      for (const b of inn.bowlers) {
        const name = getName(b.playerId);
        const prev = map.get(name) ?? { name, wickets: 0, matches: 0, bestWickets: 0, bestRuns: 0, economy: 0 };
        const isNewBest = b.wickets > prev.bestWickets || (b.wickets === prev.bestWickets && b.runsConceded < prev.bestRuns);
        const totalBalls = prev.matches > 0 ? (prev.economy / 6) * prev.matches : 0; // rough accumulation
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
  const matches = useMatchStore(s => s.matches);
  const teams = useTeamStore(s => s.teams);

  const completedCount = matches.filter(m => m.status === 'completed').length;
  const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);

  const completedMatches = useMemo(() => parseCompletedMatches(matches), [matches]);
  const runStats = useMemo(() => computeRunStats(completedMatches), [completedMatches]);
  const wktStats = useMemo(() => computeWktStats(completedMatches), [completedMatches]);

  const overviewStats = [
    { icon: 'cricket' as const,        value: completedCount,    label: 'Completed' },
    { icon: 'trophy' as const,         value: matches.length,    label: 'Total Matches' },
    { icon: 'shield-account' as const, value: teams.length,      label: 'Teams' },
    { icon: 'account-group' as const,  value: totalPlayers,      label: 'Players' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 8) + 16 }}
    >
      <View style={styles.content}>
        <Text variant="titleLarge" style={[styles.title, { color: theme.colors.primary }]}>
          Statistics
        </Text>

        {/* Overview counts */}
        <View style={styles.grid}>
          {overviewStats.map(({ icon, value, label }) => (
            <Card key={label} style={styles.statCard}>
              <Card.Content style={styles.statContent}>
                <MaterialCommunityIcons name={icon} size={28} color={theme.colors.primary} />
                <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                  {value}
                </Text>
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
          <>
            {/* Top Scorers */}
            {runStats.length > 0 && (
              <Surface style={[styles.tableCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
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
              <Surface style={[styles.tableCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
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
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  title: { fontWeight: 'bold' },
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
