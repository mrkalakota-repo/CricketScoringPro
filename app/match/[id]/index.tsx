import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card, useTheme, Surface, Portal, Dialog, ActivityIndicator } from 'react-native-paper';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useMatchStore } from '../../../src/store/match-store';
import { useTeamStore } from '../../../src/store/team-store';
import { useLiveScoresStore } from '../../../src/store/live-scores-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatOvers } from '../../../src/utils/formatters';
import { LIVE_RED } from '../../../src/components/NearbyLiveCard';
import type { LiveMatchSummary } from '../../../src/db/repositories/cloud-match-repo';
import * as cloudMatchRepo from '../../../src/db/repositories/cloud-match-repo';

function CloudMatchDetail({ matchId, fallback }: { matchId: string; fallback: LiveMatchSummary | null }) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cloudMatch, setCloudMatch] = useState<import('../../../src/engine/types').Match | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cloudMatchRepo.fetchCloudMatchState(matchId).then(m => {
      setCloudMatch(m);
      setLoading(false);
    });
  }, [matchId]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: fallback ? `${fallback.team1Short} vs ${fallback.team2Short}` : 'Match Details' }} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Loading match…</Text>
      </View>
    );
  }

  // Full state from cloud — render same as local match
  if (cloudMatch) {
    const getStatusColor = () => {
      switch (cloudMatch.status) {
        case 'in_progress': return LIVE_RED;
        case 'completed': return '#2E7D32';
        default: return '#1565C0';
      }
    };
    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: `${cloudMatch.team1.shortName} vs ${cloudMatch.team2.shortName}` }} />
        <Surface style={[styles.header, { backgroundColor: theme.colors.primary }]} elevation={2}>
          <Text style={styles.format}>{cloudMatch.config.format.toUpperCase()} Match</Text>
          <Text style={styles.versus}>{cloudMatch.team1.shortName} vs {cloudMatch.team2.shortName}</Text>
          <Text style={styles.teamFull}>{cloudMatch.team1.name} · {cloudMatch.team2.name}</Text>
          {cloudMatch.venue ? <Text style={styles.venue}>{cloudMatch.venue}</Text> : null}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.statusText}>{cloudMatch.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </Surface>
        <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 8) + 16 }]}>
          {cloudMatch.innings.map((inn, i) => {
            const teamShort = inn.battingTeamId === cloudMatch.team1.id ? cloudMatch.team1.shortName : cloudMatch.team2.shortName;
            return (
              <Card key={i} style={styles.inningsCard}>
                <Card.Content>
                  <View style={styles.inningsRow}>
                    <View>
                      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}>
                        {teamShort} — Innings {i + 1}
                      </Text>
                      <Text variant="headlineMedium" style={{ fontWeight: '900', color: theme.colors.primary, letterSpacing: -0.5 }}>
                        {inn.totalRuns}/{inn.totalWickets}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {inn.totalOvers}.{inn.totalBalls} overs
                      </Text>
                      {inn.totalBalls > 0 && (
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                          RR: {((inn.totalRuns / (inn.totalOvers + inn.totalBalls / 6)) || 0).toFixed(2)}
                        </Text>
                      )}
                    </View>
                  </View>
                </Card.Content>
              </Card>
            );
          })}
          {cloudMatch.result ? (
            <Card style={[styles.resultCard, { backgroundColor: theme.colors.primaryContainer }]}>
              <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialCommunityIcons name="trophy" size={24} color={theme.colors.onPrimaryContainer} />
                <Text variant="titleSmall" style={{ fontWeight: '700', color: theme.colors.onPrimaryContainer, flex: 1 }}>
                  {cloudMatch.result}
                </Text>
              </Card.Content>
            </Card>
          ) : null}
          <Button mode="text" icon="arrow-left" onPress={() => router.back()} style={{ marginTop: 8 }}>Back</Button>
        </View>
      </ScrollView>
    );
  }

  // Fallback: show summary from LiveMatchSummary (limited data)
  if (fallback) {
    const isLive = fallback.status === 'in_progress';
    const isCompleted = fallback.status === 'completed';
    const isToss = fallback.status === 'toss';
    const has2ndInnings = fallback.inningsNum >= 2 && fallback.target != null;
    const bowlingShort = fallback.battingShort === fallback.team1Short ? fallback.team2Short : fallback.team1Short;
    const statusColor = isLive ? LIVE_RED : isToss ? '#F57C00' : theme.colors.primary;
    const statusLabel = isLive ? 'LIVE' : isToss ? 'TOSS' : 'RESULT';

    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: `${fallback.team1Short} vs ${fallback.team2Short}` }} />
        <Surface style={[styles.header, { backgroundColor: theme.colors.primary }]} elevation={2}>
          <Text style={styles.format}>{fallback.format.toUpperCase()} Match</Text>
          <Text style={styles.versus}>{fallback.team1Short} vs {fallback.team2Short}</Text>
          <Text style={styles.teamFull}>{fallback.team1Name} · {fallback.team2Name}</Text>
          {fallback.venue ? <Text style={styles.venue}>{fallback.venue}</Text> : null}
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </Surface>
        <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 8) + 16 }]}>
          {(isLive || isCompleted) && fallback.battingShort ? (
            has2ndInnings ? (
              <>
                <Card style={styles.inningsCard}>
                  <Card.Content>
                    <View style={styles.inningsRow}>
                      <View>
                        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}>{bowlingShort} — Innings 1</Text>
                        <Text variant="headlineMedium" style={{ fontWeight: '900', color: theme.colors.onSurface, letterSpacing: -0.5 }}>{fallback.target! - 1}</Text>
                      </View>
                    </View>
                  </Card.Content>
                </Card>
                <Card style={[styles.inningsCard, isLive && styles.liveInningsCard]}>
                  <Card.Content>
                    <View style={styles.inningsRow}>
                      <View>
                        <Text variant="labelMedium" style={{ color: isLive ? LIVE_RED : theme.colors.onSurfaceVariant, fontWeight: '600' }}>
                          {fallback.battingShort} — Innings 2{isLive ? ' (batting)' : ''}
                        </Text>
                        <Text variant="headlineMedium" style={{ fontWeight: '900', color: isLive ? LIVE_RED : theme.colors.onSurface, letterSpacing: -0.5 }}>
                          {fallback.score}/{fallback.wickets}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{formatOvers(fallback.overs, fallback.balls)} overs</Text>
                        {isLive && fallback.target && (
                          <Text variant="bodySmall" style={{ color: LIVE_RED, marginTop: 4, fontWeight: '700' }}>Need {fallback.target - fallback.score} more</Text>
                        )}
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              </>
            ) : (
              <Card style={[styles.inningsCard, isLive && styles.liveInningsCard]}>
                <Card.Content>
                  <View style={styles.inningsRow}>
                    <View>
                      <Text variant="labelMedium" style={{ color: isLive ? LIVE_RED : theme.colors.onSurfaceVariant, fontWeight: '600' }}>
                        {fallback.battingShort} — Innings 1{isLive ? ' (batting)' : ''}
                      </Text>
                      <Text variant="headlineMedium" style={{ fontWeight: '900', color: isLive ? LIVE_RED : theme.colors.onSurface, letterSpacing: -0.5 }}>
                        {fallback.score}/{fallback.wickets}
                      </Text>
                    </View>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{formatOvers(fallback.overs, fallback.balls)} overs</Text>
                  </View>
                </Card.Content>
              </Card>
            )
          ) : isToss ? (
            <Card style={styles.inningsCard}>
              <Card.Content style={{ alignItems: 'center', paddingVertical: 16 }}>
                <MaterialCommunityIcons name="circle-outline" size={36} color="#F57C00" />
                <Text variant="titleMedium" style={{ color: '#F57C00', marginTop: 8, fontWeight: '700' }}>Toss in progress</Text>
              </Card.Content>
            </Card>
          ) : null}
          {isCompleted && fallback.result ? (
            <Card style={[styles.resultCard, { backgroundColor: theme.colors.primaryContainer }]}>
              <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialCommunityIcons name="trophy" size={24} color={theme.colors.onPrimaryContainer} />
                <Text variant="titleSmall" style={{ fontWeight: '700', color: theme.colors.onPrimaryContainer, flex: 1 }}>{fallback.result}</Text>
              </Card.Content>
            </Card>
          ) : null}
          <Button mode="text" icon="arrow-left" onPress={() => router.back()} style={{ marginTop: 8 }}>Back</Button>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Match Details' }} />
      <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.outlineVariant} />
      <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Match details unavailable</Text>
      <Button mode="text" onPress={() => router.back()} style={{ marginTop: 8 }}>Go Back</Button>
    </View>
  );
}

export default function MatchDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Array.isArray(id) ? id[0] : id;
  const { engine, matches, loadMatch, deleteMatch } = useMatchStore();
  const teams = useTeamStore(s => s.teams);
  const nearbyMatches = useLiveScoresStore(s => s.matches);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (matchId && (!engine || engine.getMatch().id !== matchId)) {
      loadMatch(matchId);
    }
  }, [matchId]);

  const match = engine != null && engine.getMatch().id === matchId ? engine.getMatch() : null;
  const row = matches.find(m => m.id === matchId);
  const nearbyMatch = nearbyMatches.find(m => m.id === matchId);

  const doDelete = async () => {
    setShowDeleteDialog(false);
    await deleteMatch(matchId);
    router.back();
  };

  if (!row) {
    return <CloudMatchDetail matchId={matchId} fallback={nearbyMatch ?? null} />;
  }

  const hasStateJson = !!row.match_state_json;
  if (!match && !hasStateJson) {
    const t1 = teams.find(t => t.id === row.team1_id);
    const t2 = teams.find(t => t.id === row.team2_id);
    const t1Name = t1?.shortName ?? '???';
    const t2Name = t2?.shortName ?? '???';

    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: `${t1Name} vs ${t2Name}` }} />
        <Surface style={[styles.header, { backgroundColor: theme.colors.primary }]} elevation={2}>
          <Text style={styles.format}>{row.format.toUpperCase()} Match</Text>
          <Text style={styles.versus}>{t1Name} vs {t2Name}</Text>
          {row.venue ? <Text style={styles.venue}>{row.venue}</Text> : null}
        </Surface>
        <View style={styles.content}>
          <Card style={[styles.alertCard, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Card.Content style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <MaterialCommunityIcons name="information-outline" size={20} color={theme.colors.onSecondaryContainer} style={{ marginTop: 2 }} />
              <Text variant="bodyMedium" style={{ flex: 1, color: theme.colors.onSecondaryContainer }}>
                Match data is unavailable — this match may have been created with an older version of the app.
              </Text>
            </Card.Content>
          </Card>
          <Button
            mode="outlined"
            textColor={theme.colors.error}
            icon="delete"
            onPress={() => setShowDeleteDialog(true)}
            style={{ marginTop: 8, borderRadius: 12 }}
          >
            Delete Match
          </Button>
        </View>
        <Portal>
          <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
            <Dialog.Title>Delete Match</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium">Remove this match from the list?</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
              <Button textColor={theme.colors.error} onPress={doDelete}>Delete</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    );
  }

  if (!match && hasStateJson) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons name="loading" size={40} color={theme.colors.primary} />
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Loading match…</Text>
      </View>
    );
  }

  const getStatusColor = () => {
    switch (match!.status) {
      case 'in_progress': return '#D32F2F';
      case 'completed': return '#2E7D32';
      default: return '#1565C0';
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: `${match!.team1.shortName} vs ${match!.team2.shortName}` }} />

      <Surface style={[styles.header, { backgroundColor: theme.colors.primary }]} elevation={2}>
        <Text style={styles.format}>{match!.config.format.toUpperCase()} Match</Text>
        <Text style={styles.versus}>{match!.team1.shortName} vs {match!.team2.shortName}</Text>
        <Text style={styles.teamFull}>{match!.team1.name} · {match!.team2.name}</Text>
        {match!.venue && <Text style={styles.venue}>{match!.venue}</Text>}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{match!.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </Surface>

      <View style={styles.content}>
        {match!.innings.map((inn, i) => {
          const teamShort = inn.battingTeamId === match!.team1.id ? match!.team1.shortName : match!.team2.shortName;
          return (
            <Card key={i} style={styles.inningsCard}>
              <Card.Content>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}>
                      {teamShort} — Innings {i + 1}
                    </Text>
                    <Text variant="headlineMedium" style={{ fontWeight: '900', color: theme.colors.primary, letterSpacing: -0.5 }}>
                      {inn.totalRuns}/{inn.totalWickets}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {inn.totalOvers}.{inn.totalBalls} overs
                    </Text>
                    {inn.totalBalls > 0 && (
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                        RR: {((inn.totalRuns / (inn.totalOvers + inn.totalBalls / 6)) || 0).toFixed(2)}
                      </Text>
                    )}
                  </View>
                </View>
              </Card.Content>
            </Card>
          );
        })}

        {match!.result ? (
          <Card style={[styles.resultCard, { backgroundColor: theme.colors.primaryContainer }]}>
            <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <MaterialCommunityIcons name="trophy" size={24} color={theme.colors.onPrimaryContainer} />
              <Text variant="titleSmall" style={{ fontWeight: '700', color: theme.colors.onPrimaryContainer, flex: 1 }}>
                {match!.result}
              </Text>
            </Card.Content>
          </Card>
        ) : null}

        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 8) + 16 }]}>
          {match!.status === 'in_progress' && (
            <Button
              mode="contained"
              icon="play"
              onPress={() => router.push(`/match/${matchId}/scoring`)}
              style={[styles.actionButton, { borderRadius: 12 }]}
            >
              Continue Scoring
            </Button>
          )}
          {match!.status === 'toss' && (
            <Button
              mode="contained"
              icon="circle-outline"
              onPress={() => router.push(`/match/${matchId}/toss`)}
              style={[styles.actionButton, { borderRadius: 12 }]}
            >
              Go to Toss
            </Button>
          )}
          {match!.innings.length > 0 && (
            <Button
              mode="outlined"
              icon="format-list-bulleted"
              onPress={() => router.push(`/match/${matchId}/scorecard`)}
              style={[styles.actionButton, { borderRadius: 12 }]}
            >
              View Scorecard
            </Button>
          )}
          <Button
            mode="text"
            icon="delete-outline"
            textColor={theme.colors.error}
            onPress={() => setShowDeleteDialog(true)}
          >
            Delete Match
          </Button>
        </View>
      </View>

      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Delete Match</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Delete this match? This cannot be undone.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={doDelete}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: 24, paddingBottom: 28,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  format: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  versus: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginTop: 6, letterSpacing: 0.3 },
  teamFull: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 3 },
  venue: { color: 'rgba(255,255,255,0.7)', marginTop: 4, fontSize: 13 },
  statusBadge: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 6, borderRadius: 20 },
  statusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  content: { padding: 16 },
  inningsCard: { marginBottom: 10, borderRadius: 14 },
  liveInningsCard: { borderWidth: 1, borderColor: LIVE_RED + '40' },
  inningsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultCard: { marginBottom: 10, borderRadius: 14 },
  alertCard: { marginBottom: 12, borderRadius: 14 },
  actions: { marginTop: 8, gap: 8 },
  actionButton: {},
});
