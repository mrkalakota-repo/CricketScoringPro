import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card, useTheme, Surface } from 'react-native-paper';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useMatchStore } from '../../../src/store/match-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function MatchDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { engine, loadMatch, deleteMatch } = useMatchStore();

  useEffect(() => {
    if (!engine || engine.getMatch().id !== id) {
      loadMatch(id);
    }
  }, [id]);

  const match = engine?.getMatch();

  if (!match) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text variant="titleMedium" style={{ color: '#999' }}>Loading match...</Text>
      </View>
    );
  }

  const getStatusColor = () => {
    switch (match.status) {
      case 'in_progress': return '#F44336';
      case 'completed': return '#4CAF50';
      default: return '#2196F3';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: `${match.team1.shortName} vs ${match.team2.shortName}` }} />
      <Surface style={[styles.header, { backgroundColor: theme.colors.primary }]} elevation={2}>
        <Text style={styles.format}>{match.config.format.toUpperCase()} Match</Text>
        <Text style={styles.versus}>
          {match.team1.shortName} vs {match.team2.shortName}
        </Text>
        {match.venue && <Text style={styles.venue}>{match.venue}</Text>}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{match.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </Surface>

      <View style={styles.content}>
        {/* Score Summary */}
        {match.innings.map((inn, i) => {
          const teamName = inn.battingTeamId === match.team1.id ? match.team1.shortName : match.team2.shortName;
          return (
            <Card key={i} style={styles.inningsCard}>
              <Card.Content>
                <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
                  {teamName} - {inn.totalRuns}/{inn.totalWickets}
                </Text>
                <Text variant="bodySmall" style={{ color: '#666' }}>
                  ({inn.totalOvers}.{inn.totalBalls} overs)
                </Text>
              </Card.Content>
            </Card>
          );
        })}

        {/* Result */}
        {match.result && (
          <Card style={[styles.resultCard, { backgroundColor: '#E8F5E9' }]}>
            <Card.Content>
              <Text variant="titleSmall" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                {match.result}
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {(match.status === 'in_progress' || match.status === 'toss') && (
            <Button
              mode="contained"
              icon="play"
              onPress={() => router.push(`/match/${id}/scoring`)}
              style={styles.actionButton}
            >
              Continue Scoring
            </Button>
          )}
          {match.innings.length > 0 && (
            <Button
              mode="outlined"
              icon="format-list-bulleted"
              onPress={() => router.push(`/match/${id}/scorecard`)}
              style={styles.actionButton}
            >
              View Scorecard
            </Button>
          )}
          <Button
            mode="text"
            icon="delete"
            textColor={theme.colors.error}
            onPress={async () => {
              await deleteMatch(id);
              router.replace('/');
            }}
          >
            Delete Match
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  format: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  versus: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginTop: 4 },
  venue: { color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  statusBadge: {
    marginTop: 12, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16,
  },
  statusText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  content: { padding: 16 },
  inningsCard: { marginBottom: 8, borderRadius: 12 },
  resultCard: { marginBottom: 8, borderRadius: 12 },
  actions: { marginTop: 16, gap: 8 },
  actionButton: { borderRadius: 20 },
});
