import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMatchStore } from '../../src/store/match-store';
import { useTeamStore } from '../../src/store/team-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function StatsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const matches = useMatchStore(s => s.matches);
  const teams = useTeamStore(s => s.teams);

  const completedMatches = matches.filter(m => m.status === 'completed').length;
  const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);

  const stats = [
    { icon: 'cricket' as const, value: completedMatches, label: 'Matches Played' },
    { icon: 'shield-account' as const, value: teams.length, label: 'Teams' },
    { icon: 'account-group' as const, value: totalPlayers, label: 'Players' },
    { icon: 'trophy' as const, value: matches.length, label: 'Total Matches' },
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

        <View style={styles.grid}>
          {stats.map(({ icon, value, label }) => (
            <Card key={label} style={styles.statCard}>
              <Card.Content style={styles.statContent}>
                <MaterialCommunityIcons name={icon} size={32} color={theme.colors.primary} />
                <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                  {value}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
              </Card.Content>
            </Card>
          ))}
        </View>

        {completedMatches === 0 && (
          <View style={styles.emptyState}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
              Complete matches to see detailed player and team statistics here
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  title: { fontWeight: 'bold', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '47%', borderRadius: 12 },
  statContent: { alignItems: 'center', padding: 8, gap: 4 },
  emptyState: { padding: 32, alignItems: 'center' },
});
