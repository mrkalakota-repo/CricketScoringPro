import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, useTheme, Surface, Portal, Dialog } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useMatchStore } from '../../src/store/match-store';
import { useTeamStore } from '../../src/store/team-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadSingleSeedTeam, deleteSeedData, SEED_TEAM_NAMES } from '../../src/utils/seed-data';
import type { MatchRow } from '../../src/db/repositories/match-repo';

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
  const deleteMatch = useMatchStore(s => s.deleteMatch);
  const teams = useTeamStore(s => s.teams);
  const loadTeams = useTeamStore(s => s.loadTeams);
  const deleteTeam = useTeamStore(s => s.deleteTeam);
  const [seeding, setSeeding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSamplePickerDialog, setShowSamplePickerDialog] = useState(false);
  const [showDeleteSampleDialog, setShowDeleteSampleDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ title: string; body: string } | null>(null);

  useFocusEffect(useCallback(() => { loadMatches(); }, []));

  const liveMatches = matches.filter(m => m.status === 'in_progress' || m.status === 'toss');
  const recentMatches = matches.filter(m => m.status === 'completed').slice(0, 5);

  const handleLoadSample = () => setShowSamplePickerDialog(true);

  const doLoadTeam = async (teamName: typeof SEED_TEAM_NAMES[number]) => {
    setShowSamplePickerDialog(false);
    setSeeding(true);
    try {
      const result = await loadSingleSeedTeam(teamName);
      if (result.created) await loadTeams();
      setFeedbackMsg({ title: result.created ? 'Team Loaded' : 'Already Exists', body: result.message });
    } finally {
      setSeeding(false);
    }
  };

  const handleDeleteSample = () => setShowDeleteSampleDialog(true);

  const doDeleteSample = async () => {
    setShowDeleteSampleDialog(false);
    setDeleting(true);
    try {
      const result = await deleteSeedData();
      await loadTeams();
      await loadMatches();
      setFeedbackMsg({ title: result.deleted ? 'Deleted' : 'Not Found', body: result.message });
    } finally {
      setDeleting(false);
    }
  };

  const handleClearAllData = () => setShowClearDialog(true);

  const doClearAll = async () => {
    setShowClearDialog(false);
    setDeleting(true);
    try {
      const matchIds = matches.map(m => m.id);
      const teamIds = teams.map(t => t.id);
      for (const id of matchIds) await deleteMatch(id);
      for (const id of teamIds) await deleteTeam(id);
    } finally {
      setDeleting(false);
    }
  };

  const handleLiveMatchPress = (match: MatchRow) => {
    if (match.status === 'toss') {
      router.push(`/match/${match.id}/toss`);
    } else {
      router.push(`/match/${match.id}/scoring`);
    }
  };

  const hasAnyData = matches.length > 0 || teams.length > 0;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Hero */}
      <Surface style={[styles.hero, { backgroundColor: theme.colors.primary }]} elevation={3}>
        <MaterialCommunityIcons name="cricket" size={52} color="rgba(255,255,255,0.9)" />
        <Text variant="headlineMedium" style={styles.heroTitle}>Gully Cricket Scorer</Text>
        <Text variant="bodyMedium" style={styles.heroSubtitle}>Score matches like a pro</Text>
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
      </Surface>

      {/* Quick Actions Row */}
      {hasAnyData && (
        <View style={styles.quickActions}>
          <Button compact mode="text" icon="account-search" onPress={() => router.push('/profile')} labelStyle={styles.actionLabel}>
            My Profile
          </Button>
          <Button compact mode="text" icon="database-remove-outline" loading={deleting} onPress={handleDeleteSample} labelStyle={styles.actionLabel}>
            Sample Data
          </Button>
          <Button compact mode="text" icon="trash-can-outline" textColor={theme.colors.error} loading={deleting} onPress={handleClearAllData} labelStyle={[styles.actionLabel, { color: theme.colors.error }]}>
            Clear All
          </Button>
        </View>
      )}

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <MaterialCommunityIcons name="shield-account" size={22} color={theme.colors.primary} />
          <Text variant="headlineMedium" style={[styles.statNum, { color: theme.colors.primary }]}>
            {teams.length}
          </Text>
          <Text variant="bodySmall" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Teams</Text>
        </Surface>
        <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <MaterialCommunityIcons name="trophy" size={22} color={theme.colors.primary} />
          <Text variant="headlineMedium" style={[styles.statNum, { color: theme.colors.primary }]}>
            {matches.length}
          </Text>
          <Text variant="bodySmall" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Matches</Text>
        </Surface>
        <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <MaterialCommunityIcons name="broadcast" size={22} color={liveMatches.length > 0 ? '#D32F2F' : theme.colors.primary} />
          <Text variant="headlineMedium" style={[styles.statNum, { color: liveMatches.length > 0 ? '#D32F2F' : theme.colors.primary }]}>
            {liveMatches.length}
          </Text>
          <Text variant="bodySmall" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Live</Text>
        </Surface>
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
                <View style={[styles.liveStripe, { backgroundColor: match.status === 'toss' ? '#F57C00' : '#D32F2F' }]} />
                <Card.Content style={styles.liveCardContent}>
                  <View style={styles.liveTop}>
                    <View style={[styles.liveBadge, { backgroundColor: match.status === 'toss' ? '#FFF3E0' : '#FFEBEE' }]}>
                      <View style={[styles.liveDot, { backgroundColor: match.status === 'toss' ? '#F57C00' : '#D32F2F' }]} />
                      <Text style={[styles.liveBadgeText, { color: match.status === 'toss' ? '#F57C00' : '#D32F2F' }]}>
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
            <Button mode="outlined" onPress={handleLoadSample} loading={seeding} icon="database-import-outline" style={{ borderRadius: 12 }}>
              Load Sample Team
            </Button>
            <Button mode="text" onPress={() => router.push('/profile')} icon="account-search">
              Find My Profile
            </Button>
          </View>
        </View>
      )}

      <View style={{ height: 24 }} />

      <Portal>
        {/* Load Sample Team Picker */}
        <Dialog visible={showSamplePickerDialog} onDismiss={() => setShowSamplePickerDialog(false)}>
          <Dialog.Title>Load Sample Team</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Choose a team to add:</Text>
          </Dialog.Content>
          <Dialog.Actions style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <Button onPress={() => doLoadTeam('Mumbai Blasters')}>Mumbai Blasters</Button>
            <Button onPress={() => doLoadTeam('Chennai Challengers')}>Chennai Challengers</Button>
            <Button onPress={() => doLoadTeam('Delhi Dynamos')}>Delhi Dynamos</Button>
            <Button onPress={() => setShowSamplePickerDialog(false)} textColor={theme.colors.onSurfaceVariant}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Delete Sample Confirm */}
        <Dialog visible={showDeleteSampleDialog} onDismiss={() => setShowDeleteSampleDialog(false)}>
          <Dialog.Title>Delete Sample Teams</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will delete Mumbai Blasters, Chennai Challengers and Delhi Dynamos, plus any matches involving them.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteSampleDialog(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={doDeleteSample} loading={deleting}>Delete</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Clear All Confirm */}
        <Dialog visible={showClearDialog} onDismiss={() => setShowClearDialog(false)}>
          <Dialog.Title>Clear All Data</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will permanently delete ALL teams, players, and matches. This cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowClearDialog(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={doClearAll} loading={deleting}>
              Clear Everything
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Feedback / result message */}
        <Dialog visible={!!feedbackMsg} onDismiss={() => setFeedbackMsg(null)}>
          <Dialog.Title>{feedbackMsg?.title}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{feedbackMsg?.body}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFeedbackMsg(null)}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: -16,
  },
  statCard: {
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
  liveHeaderDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D32F2F' },
  matchCard: { marginBottom: 10, borderRadius: 16, overflow: 'hidden' },
  liveMatchCard: { elevation: 4, shadowColor: '#D32F2F', shadowOpacity: 0.15, shadowRadius: 6 },
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
