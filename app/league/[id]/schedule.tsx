import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Text, TextInput, Button, Card, useTheme, SegmentedButtons, Portal, Dialog, Divider } from 'react-native-paper';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLeagueStore } from '../../../src/store/league-store';
import { useTeamStore } from '../../../src/store/team-store';
import type { LeagueFixture } from '../../../src/engine/types';

type Mode = 'add' | 'roundrobin' | 'result';

export default function ScheduleScreen() {
  const { id, fixtureId } = useLocalSearchParams<{ id: string; fixtureId?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { leagues, fixtures: allFixtures, createFixture, updateFixtureResult, deleteFixture, generateRoundRobin, loadFixtures } = useLeagueStore();
  const teams = useTeamStore(s => s.teams);

  const league = leagues.find(l => l.id === id);
  const fixtures = allFixtures[id ?? ''] ?? [];
  const editFixture: LeagueFixture | null = fixtureId ? (fixtures.find(f => f.id === fixtureId) ?? null) : null;

  const [mode, setMode] = useState<Mode>(editFixture ? 'result' : 'add');

  // Add fixture form
  const [team1Id, setTeam1Id] = useState('');
  const [team2Id, setTeam2Id] = useState('');
  const [venue, setVenue] = useState('');
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  // Round robin form
  const [rrStartDate, setRrStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rrDays, setRrDays] = useState('7');
  const [rrVenue, setRrVenue] = useState('');

  // Result form
  const [result, setResult] = useState(editFixture?.result ?? '');
  const [winnerTeamId, setWinnerTeamId] = useState(editFixture?.winnerTeamId ?? '');
  const [t1Score, setT1Score] = useState(editFixture?.team1Score ?? '');
  const [t2Score, setT2Score] = useState(editFixture?.team2Score ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => { if (id) loadFixtures(id); }, [id]);

  if (!league) {
    return <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Schedule' }} />
      <Text style={{ padding: 16, color: theme.colors.onSurface }}>League not found</Text>
    </View>;
  }

  const leagueTeams = teams.filter(t => league.teamIds.includes(t.id));
  const getTeamName = (tid: string) => teams.find(t => t.id === tid)?.name ?? '???';

  const handleAddFixture = async () => {
    if (!team1Id || !team2Id) { setError('Select both teams'); return; }
    if (team1Id === team2Id) { setError('Teams must be different'); return; }
    const d = new Date(dateStr).getTime();
    if (isNaN(d)) { setError('Invalid date'); return; }
    setSaving(true);
    try {
      await createFixture(id!, team1Id, team2Id, venue.trim(), d);
      setError('');
      router.back();
    } catch { setError('Could not add fixture'); setSaving(false); }
  };

  const handleRoundRobin = async () => {
    if (leagueTeams.length < 2) { setError('Need at least 2 teams in the league'); return; }
    const d = new Date(rrStartDate).getTime();
    if (isNaN(d)) { setError('Invalid start date'); return; }
    const days = parseInt(rrDays, 10);
    if (!days || days < 1) { setError('Days apart must be ≥ 1'); return; }
    setSaving(true);
    try {
      await generateRoundRobin(id!, d, days, rrVenue.trim());
      router.back();
    } catch { setError('Could not generate schedule'); setSaving(false); }
  };

  const handleSaveResult = async () => {
    if (!editFixture) return;
    setSaving(true);
    try {
      await updateFixtureResult(editFixture.id, result, winnerTeamId || null, t1Score || null, t2Score || null);
      router.back();
    } catch { setError('Could not save result'); setSaving(false); }
  };

  const handleDeleteFixture = async () => {
    if (!editFixture) return;
    setShowDeleteDialog(false);
    await deleteFixture(editFixture.id, id!);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: editFixture ? 'Edit Fixture' : 'Schedule' }} />

      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Delete Fixture</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Remove this fixture from the schedule?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={handleDeleteFixture}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <ScrollView contentContainerStyle={styles.content}>
        {!editFixture && (
          <SegmentedButtons
            value={mode}
            onValueChange={v => { setMode(v as Mode); setError(''); }}
            buttons={[
              { value: 'add', label: 'Add Fixture', icon: 'plus' },
              { value: 'roundrobin', label: 'Round Robin', icon: 'autorenew' },
            ]}
            style={styles.segmented}
          />
        )}

        {/* ─── Add Fixture ─── */}
        {mode === 'add' && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>New Fixture</Text>

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Team 1</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {leagueTeams.map(t => (
                  <Button key={t.id} mode={team1Id === t.id ? 'contained' : 'outlined'} compact
                    onPress={() => setTeam1Id(t.id)} style={styles.teamBtn} labelStyle={{ fontSize: 12 }}>
                    {t.shortName}
                  </Button>
                ))}
              </ScrollView>

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Team 2</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {leagueTeams.map(t => (
                  <Button key={t.id} mode={team2Id === t.id ? 'contained' : 'outlined'} compact
                    onPress={() => setTeam2Id(t.id)} style={styles.teamBtn} labelStyle={{ fontSize: 12 }}>
                    {t.shortName}
                  </Button>
                ))}
              </ScrollView>

              <TextInput label="Venue (optional)" value={venue} onChangeText={setVenue} mode="outlined" style={styles.input} />
              <TextInput label="Date (YYYY-MM-DD)" value={dateStr} onChangeText={setDateStr} mode="outlined" style={styles.input} keyboardType="numbers-and-punctuation" />

              {!!error && <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>{error}</Text>}
              <Button mode="contained" onPress={handleAddFixture} loading={saving} disabled={saving} style={styles.button}>
                Add Fixture
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* ─── Round Robin ─── */}
        {mode === 'roundrobin' && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Generate Round Robin</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                Creates {Math.max(0, leagueTeams.length * (leagueTeams.length - 1) / 2)} fixtures for {leagueTeams.length} teams ({leagueTeams.map(t => t.shortName).join(', ')})
              </Text>
              <TextInput label="Start Date (YYYY-MM-DD)" value={rrStartDate} onChangeText={setRrStartDate} mode="outlined" style={styles.input} keyboardType="numbers-and-punctuation" />
              <TextInput label="Days between matches" value={rrDays} onChangeText={setRrDays} mode="outlined" style={styles.input} keyboardType="numeric" />
              <TextInput label="Default Venue (optional)" value={rrVenue} onChangeText={setRrVenue} mode="outlined" style={styles.input} />

              {!!error && <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>{error}</Text>}
              <Button mode="contained" icon="autorenew" onPress={handleRoundRobin} loading={saving} disabled={saving || leagueTeams.length < 2} style={styles.button}>
                Generate Schedule
              </Button>
              {leagueTeams.length < 2 && (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' }}>
                  Add at least 2 teams to the league first
                </Text>
              )}
            </Card.Content>
          </Card>
        )}

        {/* ─── Enter Result ─── */}
        {mode === 'result' && editFixture && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.matchupRow}>
                <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>{getTeamName(editFixture.team1Id)}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>vs</Text>
                <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>{getTeamName(editFixture.team2Id)}</Text>
              </View>
              <Divider style={{ marginVertical: 12 }} />

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>{getTeamName(editFixture.team1Id)} Score</Text>
              <TextInput value={t1Score} onChangeText={setT1Score} placeholder="e.g. 145/6 (20)" mode="outlined" style={styles.input} />

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>{getTeamName(editFixture.team2Id)} Score</Text>
              <TextInput value={t2Score} onChangeText={setT2Score} placeholder="e.g. 140/8 (20)" mode="outlined" style={styles.input} />

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Result</Text>
              <TextInput value={result} onChangeText={setResult} placeholder="e.g. Team A won by 5 runs" mode="outlined" style={styles.input} />

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Winner</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {[editFixture.team1Id, editFixture.team2Id].map(tid => (
                  <Button key={tid} mode={winnerTeamId === tid ? 'contained' : 'outlined'} compact
                    onPress={() => setWinnerTeamId(tid)} style={{ flex: 1 }}>
                    {getTeamName(tid)}
                  </Button>
                ))}
                <Button mode={!winnerTeamId ? 'contained' : 'outlined'} compact onPress={() => setWinnerTeamId('')} style={{ flex: 1 }}>
                  Tie / NR
                </Button>
              </View>

              {!!error && <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>{error}</Text>}
              <Button mode="contained" onPress={handleSaveResult} loading={saving} disabled={saving} style={styles.button}>
                Save Result
              </Button>
              <Button mode="text" textColor={theme.colors.error} icon="delete-outline" onPress={() => setShowDeleteDialog(true)} style={{ marginTop: 4 }}>
                Delete Fixture
              </Button>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  segmented: { marginBottom: 16 },
  card: { borderRadius: 12 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 12 },
  label: { marginBottom: 4, fontWeight: '600' },
  input: { marginBottom: 12 },
  teamBtn: { marginRight: 8, borderRadius: 16 },
  button: { borderRadius: 20, marginTop: 4 },
  matchupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
});
