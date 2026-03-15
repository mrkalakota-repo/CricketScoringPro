import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, useTheme, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useMatchStore } from '../../src/store/match-store';
import { useTeamStore } from '../../src/store/team-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadSeedData } from '../../src/utils/seed-data';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const matches = useMatchStore(s => s.matches);
  const teams = useTeamStore(s => s.teams);
  const loadTeams = useTeamStore(s => s.loadTeams);
  const [seeding, setSeeding] = useState(false);

  const liveMatches = matches.filter(m => m.status === 'in_progress' || m.status === 'toss');
  const recentMatches = matches.filter(m => m.status === 'completed').slice(0, 5);

  const handleLoadSample = async () => {
    setSeeding(true);
    try {
      const result = await loadSeedData();
      if (result.created) await loadTeams();
      Alert.alert(result.created ? 'Sample Data Loaded' : 'Already Exists', result.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Hero Section */}
      <Surface style={[styles.hero, { backgroundColor: theme.colors.primary }]} elevation={2}>
        <MaterialCommunityIcons name="cricket" size={48} color="#FFFFFF" />
        <Text variant="headlineMedium" style={styles.heroTitle}>
          Gully Cricket Scoring
        </Text>
        <Text variant="bodyMedium" style={styles.heroSubtitle}>
          Score matches like a pro
        </Text>
        <Button
          mode="contained"
          onPress={() => router.push('/match/create')}
          style={styles.heroButton}
          buttonColor="#FFFFFF"
          textColor={theme.colors.primary}
          icon="plus"
        >
          New Match
        </Button>
      </Surface>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <Surface style={styles.statCard} elevation={1}>
          <Text variant="headlineLarge" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
            {teams.length}
          </Text>
          <Text variant="bodySmall" style={{ color: '#666' }}>Teams</Text>
        </Surface>
        <Surface style={styles.statCard} elevation={1}>
          <Text variant="headlineLarge" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
            {matches.length}
          </Text>
          <Text variant="bodySmall" style={{ color: '#666' }}>Matches</Text>
        </Surface>
        <Surface style={styles.statCard} elevation={1}>
          <Text variant="headlineLarge" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
            {liveMatches.length}
          </Text>
          <Text variant="bodySmall" style={{ color: '#666' }}>Live</Text>
        </Surface>
      </View>

      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Live Matches</Text>
          {liveMatches.map(match => (
            <Card
              key={match.id}
              style={styles.matchCard}
              onPress={() => router.push(`/match/${match.id}/scoring`)}
            >
              <Card.Content>
                <View style={styles.liveIndicator}>
                  <View style={[styles.liveDot, { backgroundColor: '#F44336' }]} />
                  <Text variant="labelSmall" style={{ color: '#F44336' }}>LIVE</Text>
                </View>
                <Text variant="titleSmall">{match.format.toUpperCase()} Match</Text>
                <Text variant="bodySmall" style={{ color: '#666' }}>{match.venue}</Text>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Recent Matches</Text>
          {recentMatches.map(match => (
            <Card
              key={match.id}
              style={styles.matchCard}
              onPress={() => router.push(`/match/${match.id}`)}
            >
              <Card.Content>
                <Text variant="titleSmall">{match.format.toUpperCase()} Match</Text>
                <Text variant="bodySmall" style={{ color: '#666' }}>{match.result ?? 'No result'}</Text>
                <Text variant="bodySmall" style={{ color: '#999' }}>{match.venue}</Text>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {/* Empty State */}
      {matches.length === 0 && teams.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="cricket" size={64} color="#CCC" />
          <Text variant="titleMedium" style={{ color: '#999', marginTop: 16 }}>
            Welcome to Gully Cricket Scoring
          </Text>
          <Text variant="bodyMedium" style={{ color: '#BBB', textAlign: 'center', marginTop: 8 }}>
            Start by creating teams, then set up your first match
          </Text>
          <View style={styles.emptyActions}>
            <Button mode="contained" onPress={() => router.push('/team/create')} icon="account-group-outline">
              Create Team
            </Button>
            <Button mode="outlined" onPress={handleLoadSample} loading={seeding} icon="database-import-outline">
              Load Sample Data
            </Button>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    padding: 32,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTitle: { color: '#FFFFFF', fontWeight: 'bold', marginTop: 8 },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  heroButton: { marginTop: 16, borderRadius: 24 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    marginTop: -20,
  },
  statCard: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    minWidth: 90,
  },
  section: { padding: 16 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 12 },
  matchCard: { marginBottom: 8, borderRadius: 12 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  emptyState: { alignItems: 'center', padding: 48 },
  emptyActions: { marginTop: 24, gap: 12 },
});
