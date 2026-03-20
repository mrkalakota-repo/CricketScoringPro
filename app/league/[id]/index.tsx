import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, ScrollView } from 'react-native';
import { Text, Card, Button, useTheme, SegmentedButtons, Divider, Portal, Dialog, IconButton } from 'react-native-paper';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLeagueStore } from '../../../src/store/league-store';
import { useTeamStore } from '../../../src/store/team-store';
import type { LeagueFixture, LeagueStandingRow } from '../../../src/engine/types';

type Tab = 'teams' | 'standings' | 'fixtures' | 'bracket';

function roundLabel(round: number, maxRound: number): string {
  const fromEnd = maxRound - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-Finals';
  if (fromEnd === 2) return 'Quarter-Finals';
  return `Round ${round}`;
}

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { leagues, fixtures: allFixtures, loadLeagues, loadFixtures, addTeamToLeague, removeTeamFromLeague, deleteLeague, computeStandings } = useLeagueStore();
  const teams = useTeamStore(s => s.teams);

  const league = leagues.find(l => l.id === id);
  const fixtures = allFixtures[id ?? ''] ?? [];
  const standings: LeagueStandingRow[] = league ? computeStandings(id!) : [];

  const [tab, setTab] = useState<Tab>(league?.format === 'knockout' ? 'bracket' : 'fixtures');
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [removeTeamId, setRemoveTeamId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    loadLeagues();
    if (id) loadFixtures(id);
  }, [id]));

  if (!league) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons name="trophy-broken" size={48} color={theme.colors.outlineVariant} />
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>League not found</Text>
      </View>
    );
  }

  const leagueTeams = teams.filter(t => league.teamIds.includes(t.id));
  const availableTeams = teams.filter(t => !league.teamIds.includes(t.id));

  const getTeam = (teamId: string) => teams.find(t => t.id === teamId);

  const doDelete = async () => {
    setShowDeleteDialog(false);
    await deleteLeague(league.id);
    router.back();
  };

  const upcoming = fixtures.filter(f => f.status === 'scheduled').sort((a, b) => a.scheduledDate - b.scheduledDate);
  const completed = fixtures.filter(f => f.status !== 'scheduled').sort((a, b) => b.scheduledDate - a.scheduledDate);

  // Knockout bracket helpers
  const knockoutRounds = fixtures
    .map(f => f.round)
    .filter((r): r is number => r != null);
  const maxRound = knockoutRounds.length > 0 ? Math.max(...knockoutRounds) : 1;
  const roundNumbers = [...new Set(knockoutRounds)].sort((a, b) => a - b);
  const byRound = (round: number) =>
    fixtures.filter(f => f.round === round).sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{
        title: league.name,
        headerRight: () => (
          <IconButton icon="delete-outline" iconColor="#FFFFFF" size={22} onPress={() => setShowDeleteDialog(true)} />
        ),
      }} />

      {/* Delete Dialog */}
      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Delete League</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Delete "{league.name}"? All fixtures will be removed. This cannot be undone.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={doDelete}>Delete</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!removeTeamId} onDismiss={() => setRemoveTeamId(null)}>
          <Dialog.Title>Remove Team</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Remove {getTeam(removeTeamId ?? '')?.name} from this league?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRemoveTeamId(null)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={async () => {
              await removeTeamFromLeague(league.id, removeTeamId!);
              setRemoveTeamId(null);
            }}>Remove</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showAddTeam} onDismiss={() => setShowAddTeam(false)}>
          <Dialog.Title>Add Team</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 320 }}>
            <ScrollView>
              {availableTeams.length === 0 ? (
                <Text variant="bodyMedium" style={{ padding: 16, color: theme.colors.onSurfaceVariant }}>
                  All your teams are already in this league.
                </Text>
              ) : (
                availableTeams.map(t => (
                  <Button
                    key={t.id}
                    mode="text"
                    icon="shield-plus"
                    onPress={async () => {
                      await addTeamToLeague(league.id, t.id);
                      setShowAddTeam(false);
                    }}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    {t.name}
                  </Button>
                ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowAddTeam(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Text variant="headlineSmall" style={styles.headerTitle}>{league.name}</Text>
        <Text style={styles.headerSub}>{league.shortName} · {league.format === 'knockout' ? 'Knockout' : 'Round Robin'} · {leagueTeams.length} teams · {fixtures.filter(f => f.result !== 'Bye').length} fixtures</Text>
      </View>

      <SegmentedButtons
        value={tab}
        onValueChange={v => setTab(v as Tab)}
        buttons={league.format === 'knockout' ? [
          { value: 'bracket', label: 'Bracket', icon: 'tournament' },
          { value: 'fixtures', label: 'Fixtures', icon: 'calendar' },
          { value: 'teams', label: 'Teams', icon: 'shield-account' },
        ] : [
          { value: 'fixtures', label: 'Fixtures', icon: 'calendar' },
          { value: 'standings', label: 'Standings', icon: 'podium' },
          { value: 'teams', label: 'Teams', icon: 'shield-account' },
        ]}
        style={styles.tabs}
      />

      {tab === 'teams' && (
        <FlatList
          data={leagueTeams}
          keyExtractor={t => t.id}
          contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 8) + 80 }}
          ListHeaderComponent={
            <Button mode="contained" icon="plus" onPress={() => setShowAddTeam(true)} style={styles.addBtn}>
              Add Team
            </Button>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="shield-account-outline" size={40} color={theme.colors.outlineVariant} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>No teams added yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.teamCard} onPress={() => router.push(`/team/${item.id}`)}>
              <Card.Content style={styles.teamRow}>
                <View style={[styles.teamAvatar, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Text style={{ fontWeight: '900', fontSize: 13, color: theme.colors.primary }}>{item.shortName.substring(0, 3)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>{item.name}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{item.players.length} players</Text>
                </View>
                <IconButton icon="close" size={18} iconColor={theme.colors.error} onPress={() => setRemoveTeamId(item.id)} />
              </Card.Content>
            </Card>
          )}
        />
      )}

      {tab === 'bracket' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 8) + 80 }}>
          <Button mode="contained" icon="plus" onPress={() => router.push(`/league/${id}/schedule`)} style={[styles.addBtn, { marginBottom: 16 }]}>
            Add / Generate Bracket
          </Button>
          {roundNumbers.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="tournament" size={40} color={theme.colors.outlineVariant} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>No bracket yet</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 4 }}>
                Add at least 2 teams, then generate the knockout bracket
              </Text>
            </View>
          ) : (
            roundNumbers.map(round => (
              <View key={round} style={{ marginBottom: 20 }}>
                <View style={[styles.roundHeader, { backgroundColor: theme.colors.primaryContainer }]}>
                  <MaterialCommunityIcons name="tournament" size={14} color={theme.colors.primary} />
                  <Text variant="labelLarge" style={{ color: theme.colors.primary, fontWeight: '800' }}>
                    {roundLabel(round, maxRound)}
                  </Text>
                </View>
                {byRound(round).map(f => {
                  const t1 = getTeam(f.team1Id);
                  const t2 = getTeam(f.team2Id);
                  const isBye = f.result === 'Bye';
                  if (isBye) return null; // hide bye fixtures from bracket display
                  return (
                    <Card key={f.id} style={[styles.fixtureCard, { borderLeftWidth: 3, borderLeftColor: f.status === 'completed' ? theme.colors.primary : theme.colors.outlineVariant }]}
                      onPress={() => router.push(`/league/${id}/schedule?fixtureId=${f.id}`)}>
                      <Card.Content style={{ paddingVertical: 10 }}>
                        <View style={styles.fixtureTeams}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.fixTeam, { color: f.winnerTeamId === f.team1Id ? theme.colors.primary : theme.colors.onSurface, fontSize: 14 }]} numberOfLines={1}>
                              {f.winnerTeamId === f.team1Id && <MaterialCommunityIcons name="trophy" size={13} color={theme.colors.primary} />}
                              {' '}{t1?.shortName ?? '???'}
                            </Text>
                            {f.team1Score && <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{f.team1Score}</Text>}
                          </View>
                          <View style={[styles.vsBox, { backgroundColor: f.status === 'completed' ? theme.colors.primaryContainer : theme.colors.surfaceVariant }]}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: f.status === 'completed' ? theme.colors.primary : theme.colors.onSurfaceVariant }}>
                              {f.status === 'completed' ? 'FT' : 'VS'}
                            </Text>
                          </View>
                          <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={[styles.fixTeam, { color: f.winnerTeamId === f.team2Id ? theme.colors.primary : theme.colors.onSurface, fontSize: 14, textAlign: 'right' }]} numberOfLines={1}>
                              {t2?.shortName ?? '???'}{' '}
                              {f.winnerTeamId === f.team2Id && <MaterialCommunityIcons name="trophy" size={13} color={theme.colors.primary} />}
                            </Text>
                            {f.team2Score && <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'right' }}>{f.team2Score}</Text>}
                          </View>
                        </View>
                        {f.result && f.result !== 'Bye' && (
                          <Text variant="bodySmall" style={{ color: theme.colors.primary, textAlign: 'center', marginTop: 6, fontWeight: '600' }}>
                            {f.result}
                          </Text>
                        )}
                      </Card.Content>
                    </Card>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {tab === 'standings' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 8) + 16 }}>
          {standings.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="podium" size={40} color={theme.colors.outlineVariant} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                Add teams and complete fixtures to see standings
              </Text>
            </View>
          ) : (
            <Card style={{ borderRadius: 12 }}>
              <Card.Content style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
                {/* Header Row */}
                <View style={[styles.standingsRow, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Text style={[styles.posCol, { color: theme.colors.onPrimaryContainer, fontWeight: '700' }]}>#</Text>
                  <Text style={[styles.teamCol, { color: theme.colors.onPrimaryContainer, fontWeight: '700' }]}>Team</Text>
                  <Text style={[styles.numCol, { color: theme.colors.onPrimaryContainer, fontWeight: '700' }]}>P</Text>
                  <Text style={[styles.numCol, { color: theme.colors.onPrimaryContainer, fontWeight: '700' }]}>W</Text>
                  <Text style={[styles.numCol, { color: theme.colors.onPrimaryContainer, fontWeight: '700' }]}>L</Text>
                  <Text style={[styles.numCol, { color: theme.colors.onPrimaryContainer, fontWeight: '700' }]}>T</Text>
                  <Text style={[styles.numCol, { color: theme.colors.primary, fontWeight: '800' }]}>Pts</Text>
                  <Text style={[styles.nrrCol, { color: theme.colors.onPrimaryContainer, fontWeight: '700' }]}>NRR</Text>
                </View>
                <Divider />
                {standings.map((row, idx) => {
                  const team = getTeam(row.teamId);
                  const nrrStr = row.nrr === 0 ? '-' : (row.nrr > 0 ? '+' : '') + row.nrr.toFixed(3);
                  const nrrColor = row.nrr > 0 ? '#2E7D32' : row.nrr < 0 ? theme.colors.error : theme.colors.onSurfaceVariant;
                  return (
                    <View key={row.teamId}>
                      <View style={styles.standingsRow}>
                        <Text style={[styles.posCol, { color: theme.colors.onSurfaceVariant }]}>{idx + 1}</Text>
                        <Text style={[styles.teamCol, { color: theme.colors.onSurface, fontWeight: '600' }]} numberOfLines={1}>
                          {team?.shortName ?? '???'}
                        </Text>
                        <Text style={[styles.numCol, { color: theme.colors.onSurface }]}>{row.played}</Text>
                        <Text style={[styles.numCol, { color: '#2E7D32' }]}>{row.won}</Text>
                        <Text style={[styles.numCol, { color: theme.colors.error }]}>{row.lost}</Text>
                        <Text style={[styles.numCol, { color: theme.colors.onSurfaceVariant }]}>{row.tied}</Text>
                        <Text style={[styles.numCol, { color: theme.colors.primary, fontWeight: '800' }]}>{row.points}</Text>
                        <Text style={[styles.nrrCol, { color: nrrColor, fontWeight: '600' }]}>{nrrStr}</Text>
                      </View>
                      {idx < standings.length - 1 && <Divider />}
                    </View>
                  );
                })}
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      )}

      {tab === 'fixtures' && (
        <FlatList
          data={[
            ...(upcoming.length > 0 ? [{ type: 'header' as const, label: `Upcoming (${upcoming.length})` }] : []),
            ...upcoming.map(f => ({ type: 'fixture' as const, fixture: f })),
            ...(completed.length > 0 ? [{ type: 'header' as const, label: `Completed (${completed.length})` }] : []),
            ...completed.map(f => ({ type: 'fixture' as const, fixture: f })),
          ]}
          keyExtractor={(item, idx) => item.type === 'header' ? `hdr-${idx}` : item.fixture.id}
          contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 8) + 80 }}
          ListHeaderComponent={
            <Button mode="contained" icon="calendar-plus" onPress={() => router.push(`/league/${id}/schedule`)} style={styles.addBtn}>
              Add / Generate Fixtures
            </Button>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="calendar-blank" size={40} color={theme.colors.outlineVariant} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>No fixtures yet</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 4 }}>
                Add at least 2 teams, then generate a round-robin schedule
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <Text variant="labelMedium" style={[styles.sectionLabel, { color: theme.colors.primary }]}>
                  {item.label}
                </Text>
              );
            }
            const f = item.fixture;
            const t1 = getTeam(f.team1Id);
            const t2 = getTeam(f.team2Id);
            const date = new Date(f.scheduledDate);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return (
              <Card style={styles.fixtureCard} onPress={() => router.push(`/league/${id}/schedule?fixtureId=${f.id}`)}>
                <Card.Content>
                  <View style={styles.fixtureTeams}>
                    <Text style={[styles.fixTeam, { color: f.winnerTeamId === f.team1Id ? theme.colors.primary : theme.colors.onSurface }]} numberOfLines={1}>
                      {t1?.shortName ?? '???'}
                    </Text>
                    <View style={[styles.vsBox, { backgroundColor: f.status === 'completed' ? theme.colors.primaryContainer : theme.colors.surfaceVariant }]}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: f.status === 'completed' ? theme.colors.primary : theme.colors.onSurfaceVariant }}>
                        {f.status === 'completed' ? 'FT' : 'VS'}
                      </Text>
                    </View>
                    <Text style={[styles.fixTeam, { color: f.winnerTeamId === f.team2Id ? theme.colors.primary : theme.colors.onSurface, textAlign: 'right' }]} numberOfLines={1}>
                      {t2?.shortName ?? '???'}
                    </Text>
                  </View>
                  {f.team1Score || f.team2Score ? (
                    <View style={styles.fixtureScores}>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{f.team1Score ?? ''}</Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{f.team2Score ?? ''}</Text>
                    </View>
                  ) : null}
                  {f.result && (
                    <Text variant="bodySmall" style={{ color: theme.colors.primary, textAlign: 'center', marginTop: 4, fontWeight: '600' }}>
                      {f.result}
                    </Text>
                  )}
                  <View style={styles.fixtureMeta}>
                    <MaterialCommunityIcons name="calendar" size={12} color={theme.colors.onSurfaceVariant} />
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{dateStr}</Text>
                    {f.venue ? (
                      <>
                        <Text style={{ color: theme.colors.outlineVariant }}>·</Text>
                        <MaterialCommunityIcons name="map-marker" size={12} color={theme.colors.onSurfaceVariant} />
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>{f.venue}</Text>
                      </>
                    ) : null}
                  </View>
                </Card.Content>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, alignItems: 'center', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerTitle: { color: '#FFFFFF', fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.8)', marginTop: 4, fontSize: 13 },
  tabs: { margin: 12 },
  addBtn: { marginBottom: 12, borderRadius: 20 },
  empty: { alignItems: 'center', padding: 32 },
  teamCard: { marginBottom: 8, borderRadius: 12 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamAvatar: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  standingsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  posCol: { width: 24, fontSize: 13 },
  teamCol: { flex: 1, fontSize: 13 },
  numCol: { width: 32, textAlign: 'center', fontSize: 13 },
  nrrCol: { width: 52, textAlign: 'center', fontSize: 12 },
  sectionLabel: { paddingVertical: 8, fontWeight: '700', letterSpacing: 0.5 },
  roundHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 8 },
  fixtureCard: { marginBottom: 8, borderRadius: 12 },
  fixtureTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fixTeam: { flex: 1, fontSize: 16, fontWeight: '700' },
  vsBox: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  fixtureScores: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 2 },
  fixtureMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
});
